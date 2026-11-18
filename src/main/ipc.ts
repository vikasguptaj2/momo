import { ipcMain, BrowserWindow, dialog } from 'electron';
import { writeFile } from 'node:fs/promises';
import { eq } from 'drizzle-orm';
import {
  taskInputSchema, taskUpdateSchema, projectInputSchema, projectUpdateSchema, dailyPlanSchema, profileSchema,
  moodCheckinSchema, reflectionSchema, recoveryResponseSchema, startFocusSchema, ruleInputSchema,
  settingPatchSchema, workspaceConfigSchema, routineInputSchema, focusExtendSchema, breakStartSchema
} from '../shared/validation.js';
import type { Storage } from './database/storage.js';
import { appRules } from './database/schema.js';
import type { FocusService } from './services/focus.js';
import type { BreakService } from './services/breaks.js';
import type { ActivityService } from './services/activity.js';
import type { SettingsService } from './services/settings.js';
import type { MonitorService } from './services/monitor.js';
import type { CompanionService } from './services/companion.js';
import type { MilestoneService } from './services/milestones.js';
import type { WorkspaceService } from './services/workspace.js';
import type { ProductivityService } from './services/productivity.js';
import type { RecoveryService } from './services/recovery.js';
import type { RoutineService } from './services/routines.js';
import type { P1Service } from './services/p1.js';
import type { DashboardData, AppCategory, WorkspaceConfig } from '../shared/types.js';

export interface IpcServices {
  storage: Storage; focus: FocusService; breaks: BreakService; activity: ActivityService; settings: SettingsService; monitor: MonitorService;
  companion: CompanionService; milestones: MilestoneService; workspace: WorkspaceService;
  productivity: ProductivityService; recovery: RecoveryService; routines: RoutineService; p1: P1Service;
}

export function registerIpc(services: IpcServices, broadcast: (channel: string, payload?: unknown) => void) {
  const { storage, focus, breaks, activity, settings, monitor, companion, milestones, workspace, productivity, recovery, routines, p1 } = services;
  const refresh = () => broadcast('dashboard:updated');
  const celebrateMilestones = () => {
    for (const milestone of milestones.newlyUnlocked()) companion.emit('complete', `Badge unlocked: ${milestone.title}. ${milestone.description}`);
  };

  ipcMain.handle('p1:get-state', () => p1.getState());
  ipcMain.handle('p1:save-preference', (_event, key: unknown, value: unknown) => p1.savePreference(String(key), value));
  ipcMain.handle('p1:add-journal', (_event, input: unknown) => p1.addJournal(input as {kind:string;title:string;body?:string;tags?:string[]}));
  ipcMain.handle('p1:delete-journal', (_event, id: unknown) => p1.deleteJournal(String(id)));
  ipcMain.handle('p1:pin-journal', (_event, id: unknown, pinned: unknown) => p1.pinJournal(String(id), Boolean(pinned)));
  ipcMain.handle('p1:save-ritual', (_event, input: unknown) => p1.saveRitual(input as {id?:string;name:string;ritualType:string;timeOfDay?:string;steps:string[];enabled?:boolean}));
  ipcMain.handle('p1:complete-ritual', (_event, id: unknown, note?: unknown) => p1.completeRitual(String(id), String(note??'')));
  ipcMain.handle('p1:unlock', (_event, code: unknown) => p1.unlock(String(code)));
  ipcMain.handle('p1:weekly-review', () => p1.getWeeklyReview());

  ipcMain.handle('workspace:get-config', (_event, id?: unknown) => workspace.getConfig(typeof id === 'string' ? id : undefined));
  ipcMain.handle('workspace:list-presets', () => workspace.listPresets().map(preset => ({ ...preset, appRules: workspace.getAppRules(preset.id) })));
  ipcMain.handle('workspace:list-runs', (_event, limit?: unknown) => workspace.listRuns(typeof limit === 'number' ? limit : 20));
  ipcMain.handle('workspace:create-preset', (_event, kind: unknown) => {
    if (!['coding', 'study', 'writing', 'design', 'deep-work', 'freelance', 'custom'].includes(String(kind))) throw new Error('Invalid workspace template.');
    const result = workspace.createPreset(kind as NonNullable<WorkspaceConfig['kind']>); refresh(); return result;
  });
  ipcMain.handle('workspace:delete-preset', (_event, id: unknown) => { if (typeof id !== 'string' || id.length > 80) throw new Error('Invalid preset ID.'); workspace.deletePreset(id); refresh(); });
  ipcMain.handle('workspace:save-config', (_event, input: unknown) => { const result = workspace.saveConfig(workspaceConfigSchema.parse(input)); refresh(); return result; });
  ipcMain.handle('workspace:preview', (_event, input: unknown) => workspace.preview(workspaceConfigSchema.parse(input)));
  ipcMain.handle('workspace:start', (_event, input: unknown) => workspace.start(workspaceConfigSchema.parse(input)).then(result => { refresh(); return result; }));
  ipcMain.handle('workspace:save-app-rule', (_event, input: unknown) => {
    if (!input || typeof input !== 'object') throw new Error('Invalid workspace rule.');
    const value = input as Record<string, unknown>;
    if (typeof value.presetId !== 'string' || typeof value.appName !== 'string' || !['productive', 'distracting', 'unclassified'].includes(String(value.category))) throw new Error('Invalid workspace rule.');
    workspace.saveAppRule(value.presetId, value.appName, value.category as AppCategory); refresh();
  });
  ipcMain.handle('workspace:get-app-rules', (_event, presetId: unknown) => {
    if (typeof presetId !== 'string') throw new Error('Invalid preset ID.');
    return workspace.getAppRules(presetId);
  });
  ipcMain.handle('workspace:delete-app-rule', (_event, input: unknown) => {
    if (!input || typeof input !== 'object') throw new Error('Invalid workspace rule.');
    const value = input as Record<string, unknown>;
    if (typeof value.presetId !== 'string' || typeof value.appName !== 'string') throw new Error('Invalid workspace rule.');
    workspace.deleteAppRule(value.presetId, value.appName); refresh();
  });
  ipcMain.handle('workspace:pick-executable', async event => {
    const parent = BrowserWindow.fromWebContents(event.sender);
    const options = { title: 'Choose an application', properties: ['openFile'] as Array<'openFile'>, filters: [{ name: 'Windows applications', extensions: ['exe'] }] };
    const result = parent ? await dialog.showOpenDialog(parent, options) : await dialog.showOpenDialog(options);
    const selected = result.canceled ? null : result.filePaths[0] ?? null;
    if (selected) workspace.approveExecutableSelection(selected);
    return selected;
  });
  ipcMain.handle('workspace:pick-folder', async event => {
    const parent = BrowserWindow.fromWebContents(event.sender);
    const options = { title: 'Choose a project or working folder', properties: ['openDirectory'] as Array<'openDirectory'> };
    const result = parent ? await dialog.showOpenDialog(parent, options) : await dialog.showOpenDialog(options);
    const selected = result.canceled ? null : result.filePaths[0] ?? null;
    if (selected) workspace.approveFolderSelection(selected);
    return selected;
  });

  ipcMain.handle('dashboard:get', (): DashboardData => {
    const config = settings.get();
    const todayPlan = productivity.getDailyPlan();
    const lastMood = productivity.getMoodHistory(1)[0] ?? null;
    return {
      tasks: productivity.listTasks({ limit: 20 }),
      activeSession: focus.current(), activeBreak: breaks.current(), today: activity.todaySummary(), recentActivity: activity.getRecentActivity(8),
      rules: storage.db.select().from(appRules).all().map(x => ({ appName: x.appName, category: x.category as AppCategory, updatedAt: x.updatedAt })),
      milestones: milestones.list(), trackingEnabled: config.trackingEnabled, monitorStatus: monitor.getStatus(),
      profile: productivity.getProfile(), todayPlan, projects: productivity.listProjects(), lastMood
    };
  });

  // Profile and daily planning
  ipcMain.handle('profile:get', () => productivity.getProfile());
  ipcMain.handle('profile:save', (_event, input: unknown) => { const parsed = profileSchema.parse(input); const result = productivity.saveProfile(parsed); refresh(); return result; });
  ipcMain.handle('daily-plan:get', (_event, date?: unknown) => productivity.getDailyPlan(typeof date === 'string' ? date : undefined));
  ipcMain.handle('daily-plan:save', (_event, input: unknown) => { const result = productivity.saveDailyPlan(dailyPlanSchema.parse(input)); refresh(); return result; });
  ipcMain.handle('daily-plan:carry-forward', (_event, fromDate: unknown, toDate?: unknown) => { if (typeof fromDate !== 'string' || (toDate !== undefined && typeof toDate !== 'string')) throw new Error('Invalid plan dates.'); const result = productivity.carryForwardDailyPlan(fromDate, typeof toDate === 'string' ? toDate : undefined); refresh(); return result; });

  // Projects and tasks
  ipcMain.handle('projects:list', (_event, includeArchived?: unknown) => productivity.listProjects(includeArchived === true));
  ipcMain.handle('projects:create', (_event, input: unknown) => { const result = productivity.createProject(projectInputSchema.parse(input)); refresh(); return result; });
  ipcMain.handle('projects:update', (_event, input: unknown) => { const result = productivity.updateProject(projectUpdateSchema.parse(input)); refresh(); return result; });
  ipcMain.handle('projects:delete', (_event, id: unknown) => { if (typeof id !== 'string') throw new Error('Invalid project ID.'); productivity.deleteProject(id); refresh(); });
  ipcMain.handle('tasks:list', (_event, options?: unknown) => {
    const value = options && typeof options === 'object' ? options as { projectId?: unknown; status?: unknown; limit?: unknown } : {};
    return productivity.listTasks({ projectId: typeof value.projectId === 'string' ? value.projectId : undefined, status: typeof value.status === 'string' ? value.status as never : undefined, limit: typeof value.limit === 'number' ? value.limit : undefined });
  });
  ipcMain.handle('task:create', (_event, input: unknown) => { const result = productivity.createTask(taskInputSchema.parse(input)); refresh(); return result; });
  ipcMain.handle('task:update', (_event, input: unknown) => { const result = productivity.updateTask(taskUpdateSchema.parse(input)); celebrateMilestones(); refresh(); return result; });
  ipcMain.handle('task:delete', (_event, id: unknown) => { if (typeof id !== 'string') throw new Error('Invalid task ID.'); productivity.deleteTask(id); refresh(); });
  ipcMain.handle('task:complete', (_event, taskId: unknown) => { if (typeof taskId !== 'string') throw new Error('Invalid task ID.'); productivity.completeTask(taskId); celebrateMilestones(); refresh(); });

  // Mood check-ins, session reflections and recovery
  ipcMain.handle('mood:create', (_event, input: unknown) => { const result = productivity.createMoodCheckin(moodCheckinSchema.parse(input)); companion.emit('checkin', moodMessage(result.mood, result.energy)); refresh(); return result; });
  ipcMain.handle('mood:history', (_event, limit?: unknown) => productivity.getMoodHistory(typeof limit === 'number' ? limit : 14));
  ipcMain.handle('reflection:save', (_event, input: unknown) => { const result = productivity.saveSessionReflection(reflectionSchema.parse(input)); refresh(); return result; });
  ipcMain.handle('reflection:get', (_event, sessionId: unknown) => { if (typeof sessionId !== 'string') throw new Error('Invalid session ID.'); return productivity.getSessionReflection(sessionId); });
  ipcMain.handle('recovery:respond', (_event, input: unknown) => { const parsed = recoveryResponseSchema.parse(input); const result = recovery.respond(parsed.action, parsed.appName); refresh(); return result; });
  ipcMain.handle('recovery:summary', (_event, date?: unknown) => productivity.getRecoverySummary(typeof date === 'string' ? date : undefined));

  // Manually started routines guide users through repeatable work sequences.
  ipcMain.handle('routines:list', () => routines.list());
  ipcMain.handle('routines:create', (_event, input: unknown) => { const result = routines.create(routineInputSchema.parse(input)); refresh(); return result; });
  ipcMain.handle('routines:delete', (_event, id: unknown) => { if (typeof id !== 'string') throw new Error('Invalid routine ID.'); routines.delete(id); refresh(); });
  ipcMain.handle('routines:start', (_event, id: unknown) => { if (typeof id !== 'string') throw new Error('Invalid routine ID.'); if (focus.current() || breaks.current()) throw new Error('Finish your current focus session or break before starting a routine.'); const result = routines.start(id); refresh(); return result; });
  ipcMain.handle('routines:current', () => routines.current());
  ipcMain.handle('routines:history', (_event, limit?: unknown) => routines.history(typeof limit === 'number' ? limit : 20));
  ipcMain.handle('routines:complete-step', () => { const currentRoutine = routines.current(); const currentStep = currentRoutine?.steps[currentRoutine.currentStepIndex]; if (currentStep?.kind === 'focus' && focus.current()) throw new Error('Finish the focus session before completing this routine step.'); if (currentStep?.kind === 'break' && breaks.current()) throw new Error('Finish the timed break before completing this routine step.'); const result = routines.completeCurrentStep(); refresh(); return result; });
  ipcMain.handle('routines:cancel', () => { routines.cancelCurrent(); refresh(); });

  ipcMain.handle('focus:start', (_event, input: unknown) => { const parsed = startFocusSchema.parse(input); if (breaks.current()) throw new Error('Finish your break before starting a focus session.'); if (!parsed.workspaceRunId) companion.clearWorkspaceMode(); const result = focus.start(parsed); refresh(); return result; });
  ipcMain.handle('focus:pause', () => { const result = focus.pause(); refresh(); return result; });
  ipcMain.handle('focus:resume', () => { if (breaks.current()) throw new Error('Finish your break before resuming focus.'); const result = focus.resume(); refresh(); return result; });
  ipcMain.handle('focus:end', (_event, completed: unknown) => { if (typeof completed !== 'boolean') throw new Error('Invalid completion flag.'); if (breaks.current()) throw new Error('Finish or cancel your break before ending the focus session.'); const result = focus.end(completed); companion.clearWorkspaceMode(); if (completed) celebrateMilestones(); refresh(); return result; });
  ipcMain.handle('focus:extend', (_event, minutes: unknown) => { const parsed = focusExtendSchema.parse(minutes); const result = focus.extend(parsed); refresh(); return result; });
  ipcMain.handle('break:start', (_event, input: unknown) => { const parsed = breakStartSchema.parse(input); const result = breaks.start(parsed.plannedMinutes, parsed.kind ?? 'short'); refresh(); return result; });
  ipcMain.handle('break:pause', () => { const result = breaks.pause(); refresh(); return result; });
  ipcMain.handle('break:resume', () => { const result = breaks.resume(); refresh(); return result; });
  ipcMain.handle('break:end', (_event, completed: unknown) => { if (typeof completed !== 'boolean') throw new Error('Invalid break completion flag.'); const result = breaks.end(completed); refresh(); return result; });

  ipcMain.handle('tracking:set', (_event, enabled: unknown) => {
    if (typeof enabled !== 'boolean') throw new Error('Invalid tracking state.');
    settings.update({ trackingEnabled: enabled });
    if (enabled) monitor.start(settings.get().captureWindowTitles); else { monitor.stop(); activity.reset(); }
    refresh(); return enabled;
  });
  ipcMain.handle('rule:save', (_event, input: unknown) => {
    const parsed = ruleInputSchema.parse(input); const appName = parsed.appName.toLowerCase().replace(/\.exe$/i, '') + '.exe';
    const row = { appName, category: parsed.category, updatedAt: new Date().toISOString() };
    storage.db.insert(appRules).values(row).onConflictDoUpdate({ target: appRules.appName, set: { category: row.category, updatedAt: row.updatedAt } }).run();
    refresh(); return row;
  });
  ipcMain.handle('rule:delete', (_event, appName: string) => { storage.db.delete(appRules).where(eq(appRules.appName, appName)).run(); refresh(); });
  ipcMain.handle('report:get', (_event, date?: string) => activity.report(date));
  ipcMain.handle('settings:get', () => settings.get());
  ipcMain.handle('settings:update', (_event, patch: unknown) => {
    const parsed = settingPatchSchema.parse(patch); const before = settings.get(); const after = settings.update(parsed);
    if (before.showCompanion !== after.showCompanion) { if (after.showCompanion) companion.open(); else companion.close(); }
    if (before.trackingEnabled !== after.trackingEnabled || before.captureWindowTitles !== after.captureWindowTitles) {
      monitor.stop(); activity.reset(); if (after.trackingEnabled) monitor.start(after.captureWindowTitles);
    }
    refresh(); return after;
  });
  ipcMain.handle('history:delete', () => {
    if (focus.current()) throw new Error('End or cancel the active focus session before deleting history.');
    if (breaks.current()) throw new Error('Finish or cancel the active break before deleting history.');
    activity.reset();
    storage.raw.exec('DELETE FROM activity_segments; DELETE FROM idle_segments; DELETE FROM focus_sessions; DELETE FROM break_sessions; DELETE FROM distraction_events; DELETE FROM companion_events; DELETE FROM workspace_runs; DELETE FROM mood_checkins; DELETE FROM session_reflections; DELETE FROM recovery_events; DELETE FROM routine_runs; DELETE FROM milestones;');
    refresh();
  });
  ipcMain.handle('data:export', async event => {
    const parent = BrowserWindow.fromWebContents(event.sender);
    const options = { title: 'Export CaughtYouSlacking data', defaultPath: `caught-you-slacking-export-${new Date().toISOString().slice(0, 10)}.json`, filters: [{ name: 'JSON backup', extensions: ['json'] }] };
    const selection = parent ? await dialog.showSaveDialog(parent, options) : await dialog.showSaveDialog(options);
    if (selection.canceled || !selection.filePath) return null;
    const tables = ['user_profile','user_settings','projects','tasks','daily_plan_items','focus_sessions','break_sessions','activity_segments','idle_segments','app_rules','workspace_presets','workspace_app_rules','workspace_runs','distraction_events','recovery_events','session_reflections','mood_checkins','companion_events','milestones','routines','routine_runs','scout_journal','scout_rituals','scout_ritual_completions','scout_unlocks','scout_preferences'];
    const payload: Record<string, unknown> = { product: 'CaughtYouSlacking', schemaVersion: 3, exportedAt: new Date().toISOString(), data: {} };
    for (const table of tables) {
      if (!/^[a-z_]+$/.test(table)) continue;
      (payload.data as Record<string, unknown>)[table] = storage.raw.prepare(`SELECT * FROM ${table}`).all();
    }
    await writeFile(selection.filePath, JSON.stringify(payload, null, 2), 'utf8');
    return selection.filePath;
  });
  ipcMain.handle('companion:open', () => companion.open());
  ipcMain.handle('companion:action', (_event, action: unknown) => {
    if (typeof action !== 'string') throw new Error('Invalid companion action.');
    if (action === 'start-short-focus') {
      if (breaks.current()) throw new Error('Finish your break before starting a focus session.');
      if (focus.current()) throw new Error('Finish or pause your current session first.');
      const plan = productivity.getDailyPlan();
      const primary = plan.items.find(item => item.kind === 'primary');
      const title = primary?.title ?? 'A small step';
      const session = focus.start({ taskId: primary?.taskId ?? null, taskTitle: title, plannedMinutes: 25 });
      companion.emit('focus', `Let's work on ${title} for 25 minutes. I'll stay nearby.`); refresh(); return session;
    }
    if (action === 'take-break') {
      const current = focus.current();
      breaks.start(10, 'short');
      productivity.recordRecovery({ action: 'break' }, current?.id ?? null);
      refresh(); return;
    }
    if (action === 'resume-focus') {
      if (breaks.current()) throw new Error('Finish your break before returning to focus.');
      const current = focus.current();
      if (!current) throw new Error('There is no focus session to return to. Start a focus session or choose a mission first.');
      if (current.status === 'paused') focus.resume();
      else if (current.status !== 'running') throw new Error('This focus session has already ended.');
      productivity.recordRecovery({ action: 'restart' }, current.id);
      companion.emit('recovery', "Welcome back. Let's take the next small step."); refresh(); return;
    }
    if (action === 'celebrate') {
      companion.emit('complete', 'A little progress worth celebrating. Keep going at your own pace.'); celebrateMilestones(); refresh(); return;
    }
    if (action === 'motivate') {
      const profile = productivity.getProfile();
      const lines: Record<string, string[]> = {
        gentle: ['You do not need to do everything right now. Just choose one small step.', 'Progress can be quiet. Showing up is already a start.'],
        direct: ['Choose the next action and give it ten focused minutes.', 'Less planning now. One concrete step. You have got this.'],
        playful: ['Scout reporting for duty! What little mission are we conquering?', 'Adventure time. Pick one task and let us make a dent.'],
        quiet: ['I am here when you need me. Take the next step at your pace.', 'No rush. Your next small step is enough.']
      };
      const defaultChoices = ['You do not need to do everything right now. Just choose one small step.', 'Progress can be quiet. Showing up is already a start.'];
      const choices = lines[profile.communicationStyle] ?? defaultChoices;
      const selected = choices[Math.floor(Math.random() * choices.length)] ?? defaultChoices[0]!;
      companion.emit('welcome', selected); return;
    }
    if (action === 'open-dashboard') {
      const main = BrowserWindow.getAllWindows().find(win => { const [width = 0] = win.getSize(); return width > 500; });
      main?.show(); main?.focus(); return;
    }
    throw new Error('Unsupported companion action.');
  });

  ipcMain.on('renderer:ready', event => { BrowserWindow.fromWebContents(event.sender); });
}

function moodMessage(mood: string, energy: number): string {
  if (mood === 'overwhelmed') return 'Thank you for telling me. We can make the next step smaller.';
  if (mood === 'tired' || energy <= 2) return 'I hear you. Let us keep things gentle and make room for a proper break.';
  if (mood === 'frustrated') return 'That sounds difficult. We can pause and work out one next step when you are ready.';
  if (mood === 'motivated') return 'I love that energy. Let us turn it into one meaningful win.';
  return 'Thanks for checking in. I will follow your lead today.';
}
