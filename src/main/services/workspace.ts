import { randomUUID } from 'node:crypto';
import { spawn } from 'node:child_process';
import { access, stat } from 'node:fs/promises';
import { extname, isAbsolute } from 'node:path';
import { shell } from 'electron';
import type { FocusSession, WorkspaceConfig, WorkspaceLaunchResult, WorkspacePreview, WorkspacePreviewItem, WorkspaceStartResult, WorkspaceRunHistoryItem } from '../../shared/types.js';
import type { Storage } from '../database/storage.js';
import type { FocusService } from './focus.js';
import type { BreakService } from './breaks.js';
import type { SettingsService } from './settings.js';
import type { CompanionService } from './companion.js';

const PRESET_ID = 'coding-workspace-default';
const WORKSPACE_TEMPLATES: Record<NonNullable<WorkspaceConfig['kind']>, Partial<WorkspaceConfig>> = {
  coding: { name: 'Coding Workspace', intentionTemplate: 'Make meaningful progress on my coding project', focusMinutes: 50, scoutMode: 'quiet' },
  study: { name: 'Study Workspace', intentionTemplate: 'Make progress on my study goals', focusMinutes: 45, scoutMode: 'encouraging' },
  writing: { name: 'Writing Workspace', intentionTemplate: 'Make progress on my writing task', focusMinutes: 50, scoutMode: 'quiet' },
  design: { name: 'Design Workspace', intentionTemplate: 'Make progress on my design project', focusMinutes: 60, scoutMode: 'playful' },
  'deep-work': { name: 'Deep Work', intentionTemplate: 'Make focused progress on my most important task', focusMinutes: 75, scoutMode: 'quiet' },
  freelance: { name: 'Freelance Workspace', intentionTemplate: 'Make progress on my client deliverable', focusMinutes: 50, scoutMode: 'encouraging' },
  custom: { name: 'My Workspace', intentionTemplate: 'Make progress on my next task', focusMinutes: 50, scoutMode: 'quiet' }
};

export const DEFAULT_WORKSPACE_CONFIG: WorkspaceConfig = {
  id: PRESET_ID, kind: 'coding', name: 'Coding Workspace',
  intentionTemplate: 'Make meaningful progress on my coding project',
  focusMinutes: 50,
  breakMinutes: 10,
  longBreakMinutes: 20,
  longBreakEvery: 3,
  idePath: '',
  projectPath: '',
  terminalPath: '',
  docsUrl: '',
  scoutMode: 'quiet'
};

export class WorkspaceService {
  private readonly approvedExecutablePaths = new Set<string>();
  private readonly approvedFolderPaths = new Set<string>();

  constructor(
    private storage: Storage,
    private focus: FocusService,
    private settings: SettingsService,
    private companion: CompanionService,
    private breaks?: BreakService
  ) {
    this.ensureDefaultPreset();
    this.ensureStarterPresets();
    for (const preset of this.listPresets()) {
      if (preset.idePath) this.approvedExecutablePaths.add(pathKey(preset.idePath));
      if (preset.terminalPath) this.approvedExecutablePaths.add(pathKey(preset.terminalPath));
      if (preset.projectPath) this.approvedFolderPaths.add(pathKey(preset.projectPath));
    }
  }

  getConfig(id = PRESET_ID): WorkspaceConfig {
    const row = this.storage.raw.prepare('SELECT config_json FROM workspace_presets WHERE id = ?').get(id) as { config_json: string } | undefined;
    if (!row) return { ...DEFAULT_WORKSPACE_CONFIG, id };
    try {
      const parsed = JSON.parse(row.config_json) as Partial<WorkspaceConfig>;
      return { ...DEFAULT_WORKSPACE_CONFIG, ...parsed, id };
    } catch {
      return { ...DEFAULT_WORKSPACE_CONFIG, id };
    }
  }

  listPresets(): Array<WorkspaceConfig & { id: string; updatedAt: string }> {
    const rows = this.storage.raw.prepare('SELECT id, config_json, updated_at FROM workspace_presets ORDER BY updated_at DESC').all() as Array<{ id: string; config_json: string; updated_at: string }>;
    return rows.map(row => {
      let config: Partial<WorkspaceConfig> = {};
      try { config = JSON.parse(row.config_json) as Partial<WorkspaceConfig>; } catch { /* fall back to a safe starter */ }
      return { ...DEFAULT_WORKSPACE_CONFIG, ...config, id: row.id, updatedAt: row.updated_at };
    });
  }

  listRuns(limit = 20): WorkspaceRunHistoryItem[] {
    const safeLimit = Math.max(1, Math.min(100, Math.floor(limit)));
    const rows = this.storage.raw.prepare('SELECT id, preset_id, preset_name, task_title, focus_minutes, status, launch_results_json, started_at, completed_at, focus_session_id, config_snapshot_json FROM workspace_runs ORDER BY started_at DESC LIMIT ?').all(safeLimit) as Array<{
      id: string; preset_id: string | null; preset_name: string; task_title: string; focus_minutes: number; status: WorkspaceRunHistoryItem['status']; launch_results_json: string; started_at: string; completed_at: string | null; focus_session_id: string | null; config_snapshot_json: string;
    }>;
    return rows.map(row => ({
      id: row.id,
      presetId: row.preset_id,
      presetName: row.preset_name,
      taskTitle: row.task_title,
      focusMinutes: row.focus_minutes,
      status: row.status,
      launchResults: parseLaunchResults(row.launch_results_json),
      configSnapshot: parseConfigSnapshot(row.config_snapshot_json),
      startedAt: row.started_at,
      completedAt: row.completed_at,
      focusSessionId: row.focus_session_id
    }));
  }

  createPreset(kind: NonNullable<WorkspaceConfig['kind']>) {
    const id = randomUUID();
    const template = WORKSPACE_TEMPLATES[kind] ?? WORKSPACE_TEMPLATES.custom;
    const config: WorkspaceConfig = { ...DEFAULT_WORKSPACE_CONFIG, ...template, id, kind, idePath: '', projectPath: '', terminalPath: '', docsUrl: '' };
    this.saveConfig(config);
    return { ...config, updatedAt: new Date().toISOString() };
  }

  deletePreset(id: string) {
    if (id === PRESET_ID) throw new Error('The original Coding Workspace preset cannot be deleted.');
    const active = this.storage.raw.prepare('SELECT id FROM workspace_runs WHERE preset_id=? AND status IN (\'preparing\',\'running\')').get(id);
    if (active) throw new Error('Finish the active workspace run before deleting this preset.');
    this.storage.raw.prepare('DELETE FROM workspace_app_rules WHERE preset_id=?').run(id);
    const result = this.storage.raw.prepare('DELETE FROM workspace_presets WHERE id=?').run(id);
    if (result.changes === 0) throw new Error('Workspace preset not found.');
  }

  saveAppRule(presetId: string, appName: string, category: 'productive' | 'distracting' | 'unclassified') {
    const exists = this.storage.raw.prepare('SELECT id FROM workspace_presets WHERE id=?').get(presetId);
    if (!exists) throw new Error('Workspace preset not found.');
    const normalized = appName.trim().toLowerCase().replace(/\.exe$/i, '') + '.exe';
    const updatedAt = new Date().toISOString();
    this.storage.raw.prepare(`INSERT INTO workspace_app_rules (preset_id, app_name, category, updated_at) VALUES (?,?,?,?) ON CONFLICT(preset_id, app_name) DO UPDATE SET category=excluded.category, updated_at=excluded.updated_at`)
      .run(presetId, normalized, category, updatedAt);
  }

  getAppRules(presetId: string) {
    return this.storage.raw.prepare('SELECT app_name AS appName, category, updated_at AS updatedAt FROM workspace_app_rules WHERE preset_id=? ORDER BY app_name').all(presetId) as Array<{ appName: string; category: 'productive' | 'distracting' | 'unclassified'; updatedAt: string }>;
  }

  deleteAppRule(presetId: string, appName: string) {
    this.storage.raw.prepare('DELETE FROM workspace_app_rules WHERE preset_id=? AND app_name=?').run(presetId, appName.trim().toLowerCase().replace(/\.exe$/i, '') + '.exe');
  }

  approveExecutableSelection(path: string) {
    this.approvedExecutablePaths.add(pathKey(path));
  }

  approveFolderSelection(path: string) {
    this.approvedFolderPaths.add(pathKey(path));
  }

  saveConfig(input: WorkspaceConfig): WorkspaceConfig {
    const config = normalizeConfig(input);
    const presetId = config.id || PRESET_ID;
    const current = this.getConfig(presetId);
    if (config.idePath && pathKey(config.idePath) !== pathKey(current.idePath) && !this.approvedExecutablePaths.has(pathKey(config.idePath))) {
      throw new Error('Choose the editor executable using the Browse button before saving this workspace.');
    }
    if (config.terminalPath && pathKey(config.terminalPath) !== pathKey(current.terminalPath) && !this.approvedExecutablePaths.has(pathKey(config.terminalPath))) {
      throw new Error('Choose the terminal executable using the Browse button before saving this workspace.');
    }
    if (config.projectPath && pathKey(config.projectPath) !== pathKey(current.projectPath) && !this.approvedFolderPaths.has(pathKey(config.projectPath))) {
      throw new Error('Choose the project folder using the Browse button before saving this workspace.');
    }
    const now = new Date().toISOString();
    this.storage.raw.prepare(`INSERT INTO workspace_presets (id, name, config_json, updated_at) VALUES (?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET name = excluded.name, config_json = excluded.config_json, updated_at = excluded.updated_at`)
      .run(presetId, config.name, JSON.stringify({ ...config, id: presetId }), now);
    return config;
  }

  async preview(input: WorkspaceConfig): Promise<WorkspacePreview> {
    const config = normalizeConfig(input);
    const [ideExists, projectExists, terminalExists] = await Promise.all([
      isFile(config.idePath), isDirectory(config.projectPath), config.terminalPath ? isFile(config.terminalPath) : Promise.resolve(false)
    ]);
    const activeSession = this.focus.current();
    const activeBreak = this.breaks?.current() ?? null;
    const items: WorkspacePreviewItem[] = [
      {
        id: 'ide', label: primaryAppLabel(config.kind), detail: config.idePath || 'Choose the primary application executable', required: true,
        status: ideExists ? 'ready' : 'missing', message: ideExists ? 'Application path verified' : 'Select a valid .exe file'
      },
      {
        id: 'project', label: 'Project folder', detail: config.projectPath || 'Choose the folder to open', required: true,
        status: projectExists ? 'ready' : 'missing', message: projectExists ? 'Folder is available' : 'Select an existing project folder'
      },
      {
        id: 'terminal', label: 'Terminal', detail: config.terminalPath || 'Not configured — optional', required: false,
        status: !config.terminalPath ? 'not-configured' : terminalExists ? 'ready' : 'missing',
        message: !config.terminalPath ? 'You can add a terminal later' : terminalExists ? 'Application path verified' : 'The optional terminal path is unavailable'
      },
      {
        id: 'docs', label: 'Documentation', detail: config.docsUrl || 'Not configured — optional', required: false,
        status: !config.docsUrl ? 'not-configured' : isHttpsUrl(config.docsUrl) ? 'ready' : 'missing',
        message: !config.docsUrl ? 'No documentation URL will be opened' : isHttpsUrl(config.docsUrl) ? 'HTTPS link ready to open' : 'Use a valid HTTPS URL'
      }
    ];
    const blockingIssues: string[] = [];
    if (process.platform !== 'win32') blockingIssues.push('Workspace launching is available on Windows only.');
    if (!ideExists) blockingIssues.push(`Choose a valid ${primaryAppLabel(config.kind)} executable.`);
    if (!projectExists) blockingIssues.push('Choose an existing project folder.');
    if (config.docsUrl && !isHttpsUrl(config.docsUrl)) blockingIssues.push('Use a valid HTTPS documentation URL or clear the optional field.');
    if (activeSession) blockingIssues.push('Finish or cancel your current focus session before starting a workspace.');
    if (activeBreak) blockingIssues.push('Finish or cancel your active break before starting a workspace.');
    return {
      ready: blockingIssues.length === 0,
      hasActiveSession: Boolean(activeSession),
      hasActiveBreak: Boolean(activeBreak),
      trackingEnabled: this.settings.get().trackingEnabled,
      focusMinutes: config.focusMinutes,
      intention: config.intentionTemplate,
      scoutMode: config.scoutMode,
      items,
      blockingIssues
    };
  }

  async start(input: WorkspaceConfig): Promise<WorkspaceStartResult> {
    const config = this.saveConfig(input);
    const presetId = config.id || PRESET_ID;
    const preview = await this.preview(config);
    const runId = randomUUID();
    const now = new Date().toISOString();
    if (!preview.ready) {
      return { started: false, runId, focusSession: null, launchResults: [], message: preview.blockingIssues.join(' ') || 'Workspace is not ready.' };
    }

    this.storage.raw.prepare(`INSERT INTO workspace_runs
      (id, preset_id, preset_name, task_title, focus_minutes, status, launch_results_json, started_at, completed_at, focus_session_id, config_snapshot_json)
      VALUES (?, ?, ?, ?, ?, 'preparing', '[]', ?, NULL, NULL, ?)`)
      .run(runId, presetId, config.name, config.intentionTemplate, config.focusMinutes, now, JSON.stringify(config));

    const launchResults: WorkspaceLaunchResult[] = [];
    try {
      await launchExecutable(config.idePath, [config.projectPath], config.projectPath);
      launchResults.push({ id: 'ide', label: primaryAppLabel(config.kind), status: 'launched', message: `${primaryAppLabel(config.kind)} accepted the launch request.` });
    } catch (error) {
      const message = errorMessage(error, 'Could not launch Visual Studio Code.');
      launchResults.push({ id: 'ide', label: primaryAppLabel(config.kind), status: 'failed', message });
      this.finishRun(runId, 'failed', launchResults);
      return { started: false, runId, focusSession: null, launchResults, message: 'The required application could not be launched. Your focus session was not started.' };
    }

    if (config.terminalPath) {
      try {
        await launchExecutable(config.terminalPath, [], config.projectPath, false);
        launchResults.push({ id: 'terminal', label: 'Terminal', status: 'launched', message: 'Terminal launch request accepted.' });
      } catch (error) {
        launchResults.push({ id: 'terminal', label: 'Terminal', status: 'failed', message: errorMessage(error, 'Could not launch the terminal.') });
      }
    } else {
      launchResults.push({ id: 'terminal', label: 'Terminal', status: 'skipped', message: 'Not configured.' });
    }

    if (config.docsUrl && !isHttpsUrl(config.docsUrl)) {
      launchResults.push({ id: 'docs', label: 'Documentation', status: 'failed', message: 'Skipped because documentation links must use HTTPS.' });
    } else if (config.docsUrl) {
      try {
        await shell.openExternal(config.docsUrl);
        launchResults.push({ id: 'docs', label: 'Documentation', status: 'launched', message: 'Documentation opened in the default browser.' });
      } catch (error) {
        launchResults.push({ id: 'docs', label: 'Documentation', status: 'failed', message: errorMessage(error, 'Could not open documentation.') });
      }
    } else {
      launchResults.push({ id: 'docs', label: 'Documentation', status: 'skipped', message: 'Not configured.' });
    }

    const taskId = randomUUID();
    const taskTitle = config.intentionTemplate.trim();
    this.companion.setWorkspaceMode(config.scoutMode);
    this.storage.raw.prepare('INSERT INTO tasks (id, title, created_at, completed_at) VALUES (?, ?, ?, NULL)').run(taskId, taskTitle, new Date().toISOString());
    let focusSession: FocusSession;
    try {
      focusSession = this.focus.start({ taskId, taskTitle, plannedMinutes: config.focusMinutes, workspaceRunId: runId });
    } catch (error) {
      this.storage.raw.prepare('DELETE FROM tasks WHERE id = ?').run(taskId);
      this.companion.clearWorkspaceMode();
      this.finishRun(runId, 'failed', launchResults);
      return { started: false, runId, focusSession: null, launchResults, message: errorMessage(error, 'Applications opened, but the focus session could not start.') };
    }

    this.finishRun(runId, 'running', launchResults, focusSession.id);
    if (this.settings.get().showCompanion) {
      this.companion.open();
      this.companion.emit('welcome', `Coding Workspace is ready. I'll stay nearby while you work on ${taskTitle}.`);
    }
    return { started: true, runId, focusSession, launchResults, message: 'Your coding workspace is ready. Scout is with you.' };
  }

  private ensureStarterPresets() {
    this.ensureDefaultPreset();
    const kinds: Array<NonNullable<WorkspaceConfig['kind']>> = ['study', 'writing', 'design', 'deep-work', 'freelance'];
    for (const kind of kinds) {
      const id = `starter-${kind}`;
      const exists = this.storage.raw.prepare('SELECT id FROM workspace_presets WHERE id=?').get(id);
      if (!exists) { const template = WORKSPACE_TEMPLATES[kind]; this.saveConfig({ ...DEFAULT_WORKSPACE_CONFIG, ...template, id, kind, idePath: '', projectPath: '', terminalPath: '', docsUrl: '' }); }
    }
  }

  private ensureDefaultPreset() {
    const exists = this.storage.raw.prepare('SELECT id FROM workspace_presets WHERE id = ?').get(PRESET_ID);
    if (!exists) this.saveConfig(DEFAULT_WORKSPACE_CONFIG);
  }

  private finishRun(runId: string, status: string, results: WorkspaceLaunchResult[], focusSessionId: string | null = null) {
    const completedAt = status === 'running' ? null : new Date().toISOString();
    this.storage.raw.prepare('UPDATE workspace_runs SET status = ?, launch_results_json = ?, completed_at = ?, focus_session_id = ? WHERE id = ?')
      .run(status, JSON.stringify(results), completedAt, focusSessionId, runId);
  }
}

function primaryAppLabel(kind?: WorkspaceConfig['kind']): string {
  switch (kind) { case 'study': return 'Study application'; case 'writing': return 'Writing application'; case 'design': return 'Design application'; case 'deep-work': return 'Primary application'; case 'freelance': return 'Work application'; default: return 'Primary application'; }
}

function pathKey(value: string): string { return value.trim().replaceAll('/', '\\').toLowerCase(); }

function normalizeConfig(input: WorkspaceConfig): WorkspaceConfig {
  return {
    ...input,
    name: input.name.trim(),
    intentionTemplate: input.intentionTemplate.trim(),
    idePath: input.idePath.trim(),
    projectPath: input.projectPath.trim(),
    terminalPath: input.terminalPath.trim(),
    docsUrl: input.docsUrl.trim()
  };
}

async function isFile(path: string): Promise<boolean> {
  if (!path || !isAbsolute(path)) return false;
  try { await access(path); return (await stat(path)).isFile() && extname(path).toLowerCase() === '.exe'; } catch { return false; }
}

async function isDirectory(path: string): Promise<boolean> {
  if (!path || !isAbsolute(path)) return false;
  try { await access(path); return (await stat(path)).isDirectory(); } catch { return false; }
}

function isHttpsUrl(value: string): boolean {
  try { const url = new URL(value); return url.protocol === 'https:' && Boolean(url.hostname); } catch { return false; }
}

function launchExecutable(executablePath: string, args: string[], cwd: string, hideWindow = true): Promise<void> {
  if (process.platform !== 'win32') return Promise.reject(new Error('Windows application launching is supported only on Windows.'));
  if (!isAbsolute(executablePath) || !isAbsolute(cwd)) return Promise.reject(new Error('Application and working directory paths must be absolute.'));
  if (extname(executablePath).toLowerCase() !== '.exe') return Promise.reject(new Error('Choose a Windows .exe application.'));
  return new Promise((resolve, reject) => {
    const child = spawn(executablePath, args, { cwd, shell: false, windowsHide: hideWindow, detached: true, stdio: 'ignore' });
    child.once('error', reject);
    child.once('spawn', () => { child.unref(); resolve(); });
  });
}

function errorMessage(error: unknown, fallback: string): string {
  return error instanceof Error ? error.message : fallback;
}

function parseLaunchResults(value: string): WorkspaceLaunchResult[] {
  try {
    const parsed = JSON.parse(value) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((item): item is WorkspaceLaunchResult => Boolean(item) && typeof item === 'object'
      && ['ide', 'project', 'terminal', 'docs'].includes(String((item as { id?: unknown }).id))
      && typeof (item as { label?: unknown }).label === 'string'
      && ['launched', 'failed', 'skipped'].includes(String((item as { status?: unknown }).status))
      && typeof (item as { message?: unknown }).message === 'string');
  } catch {
    return [];
  }
}

function parseConfigSnapshot(value: string): WorkspaceConfig | null {
  try {
    const parsed = JSON.parse(value) as Partial<WorkspaceConfig>;
    if (!parsed || typeof parsed !== 'object' || typeof parsed.name !== 'string' || typeof parsed.intentionTemplate !== 'string') return null;
    return { ...DEFAULT_WORKSPACE_CONFIG, ...parsed };
  } catch {
    return null;
  }
}
