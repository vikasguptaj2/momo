import React, { useEffect, useMemo, useState } from 'react';
import {
  ArrowLeft, ArrowRight, CheckCircle2, CircleAlert, Clock3, Code2,
  Folder, FolderOpen, Globe, Loader2,
  Play, RotateCcw, ShieldCheck, Sparkles, Terminal, XCircle
} from 'lucide-react';
import type { FocusSession, WorkspaceConfig, WorkspaceLaunchResult, WorkspacePreview, WorkspaceStartResult, WorkspacePreset, AppRule, AppCategory, WorkspaceRunHistoryItem } from '../shared/types.js';

type Props = {
  trackingEnabled: boolean;
  activeSession: FocusSession | null;
  onFocusRoom: () => void;
};

type Stage = 'setup' | 'preview' | 'result';

const FALLBACK_CONFIG: WorkspaceConfig = {
  name: 'Coding Workspace',
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

function fileName(path: string) {
  return path.split(/[\\/]/).filter(Boolean).at(-1) || path;
}

export default function WorkspacePage({ trackingEnabled, activeSession, onFocusRoom }: Props) {
  const [config, setConfig] = useState<WorkspaceConfig>(FALLBACK_CONFIG);
  const [presets, setPresets] = useState<WorkspacePreset[]>([]);
  const [workspaceRules, setWorkspaceRules] = useState<AppRule[]>([]);
  const [ruleName, setRuleName] = useState('');
  const [ruleCategory, setRuleCategory] = useState<AppCategory>('productive');
  const [stage, setStage] = useState<Stage>('setup');
  const [preview, setPreview] = useState<WorkspacePreview | null>(null);
  const [result, setResult] = useState<WorkspaceStartResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [launching, setLaunching] = useState(false);
  const [localError, setLocalError] = useState('');
  const [runHistory, setRunHistory] = useState<WorkspaceRunHistoryItem[]>([]);

  useEffect(() => {
    let alive = true;
    void Promise.all([window.cys.getWorkspaceConfig(), window.cys.listWorkspacePresets(), window.cys.listWorkspaceRuns(12)]).then(([value, list, runs]) => {
      if (alive) { setConfig(value); setPresets(list); setRunHistory(runs); void window.cys.getWorkspaceAppRules(value.id ?? 'coding-workspace-default').then(setWorkspaceRules); }
    }).catch(error => {
      if (alive) setLocalError(error instanceof Error ? error.message : 'Could not load the Coding Workspace preset.');
    }).finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, []);

  const selectPreset = async (id: string) => {
    setLocalError('');
    try { const [value, rules] = await Promise.all([window.cys.getWorkspaceConfig(id), window.cys.getWorkspaceAppRules(id)]); setConfig(value); setWorkspaceRules(rules); setStage('setup'); setPreview(null); setResult(null); }
    catch (error) { setLocalError(error instanceof Error ? error.message : 'Could not load this workspace.'); }
  };
  const createPreset = async (kind: NonNullable<WorkspaceConfig['kind']>) => {
    setLocalError('');
    try { const created = await window.cys.createWorkspacePreset(kind); const [list, rules] = await Promise.all([window.cys.listWorkspacePresets(), window.cys.getWorkspaceAppRules(created.id)]); setPresets(list); setConfig(created); setWorkspaceRules(rules); setStage('setup'); setPreview(null); setResult(null); }
    catch (error) { setLocalError(error instanceof Error ? error.message : 'Could not create the workspace.'); }
  };
  const removePreset = async () => {
    if (!config.id || config.id === 'coding-workspace-default') return;
    if (!window.confirm(`Delete ${config.name}? Previous workspace history will be preserved.`)) return;
    try { await window.cys.deleteWorkspacePreset(config.id); const list = await window.cys.listWorkspacePresets(); setPresets(list); const fallback = await window.cys.getWorkspaceConfig(); setConfig(fallback); setStage('setup'); setPreview(null); }
    catch (error) { setLocalError(error instanceof Error ? error.message : 'Could not delete this workspace.'); }
  };

  const addWorkspaceRule = async () => {
    if (!config.id || !ruleName.trim()) return;
    setLocalError('');
    try { await window.cys.saveWorkspaceAppRule({ presetId: config.id, appName: ruleName.trim(), category: ruleCategory }); const rules = await window.cys.getWorkspaceAppRules(config.id); setWorkspaceRules(rules); setRuleName(''); }
    catch (error) { setLocalError(error instanceof Error ? error.message : 'Could not save workspace rule.'); }
  };

  const setField = <K extends keyof WorkspaceConfig>(key: K, value: WorkspaceConfig[K]) => {
    setConfig(current => ({ ...current, [key]: value }));
    setPreview(null);
  };

  const browseExecutable = async (field: 'idePath' | 'terminalPath') => {
    setLocalError('');
    try {
      const selected = await window.cys.pickWorkspaceExecutable();
      if (selected) setField(field, selected);
    } catch (error) {
      setLocalError(error instanceof Error ? error.message : 'Could not open the application picker.');
    }
  };

  const browseProject = async () => {
    setLocalError('');
    try {
      const selected = await window.cys.pickWorkspaceFolder();
      if (selected) setField('projectPath', selected);
    } catch (error) {
      setLocalError(error instanceof Error ? error.message : 'Could not open the folder picker.');
    }
  };

  const openPreview = async () => {
    setSaving(true);
    setLocalError('');
    try {
      const saved = await window.cys.saveWorkspaceConfig(config);
      setConfig(saved);
      const nextPreview = await window.cys.previewWorkspace(saved);
      setPreview(nextPreview);
      setStage('preview');
    } catch (error) {
      setLocalError(error instanceof Error ? error.message : 'Could not prepare the launch preview.');
    } finally {
      setSaving(false);
    }
  };

  const confirmLaunch = async () => {
    if (!preview?.ready || launching) return;
    setLaunching(true);
    setLocalError('');
    try {
      const next = await window.cys.startWorkspace(config);
      setResult(next);
      setRunHistory(await window.cys.listWorkspaceRuns(12));
      setStage('result');
      if (!next.started) setLocalError(next.message);
    } catch (error) {
      setLocalError(error instanceof Error ? error.message : 'The workspace could not be started.');
    } finally {
      setLaunching(false);
    }
  };

  const items = useMemo(() => preview?.items ?? [], [preview]);
  const isTrackingEnabled = preview?.trackingEnabled ?? trackingEnabled;

  if (loading) {
    return <div className="page-content"><div className="workspace-loading"><Loader2 size={20} className="spin"/> Loading your coding workspace…</div></div>;
  }

  return <div className="page-content workspace-page">
    {stage === 'setup' && <>
      <div className="workspace-heading-row">
        <div>
          <div className="eyebrow">REUSABLE WORK ROUTINES</div>
          <h1>Workspaces that get you started.</h1>
          <p>Prepare a reusable environment once. Scout will help you begin with intention every time.</p>
        </div>
        <div className="workspace-heading-art"><img src="./assets/scout-focused.jpg" alt="Scout ready to focus"/></div>
      </div>

      <section className="panel workspace-library-strip"><div><div className="eyebrow">YOUR WORKSPACE LIBRARY</div><strong>Choose a reusable setup</strong><span>{presets.length} presets available</span></div><select aria-label="Select workspace preset" value={config.id ?? 'coding-workspace-default'} onChange={event => void selectPreset(event.target.value)}>{presets.map(preset => <option key={preset.id} value={preset.id}>{preset.name}</option>)}</select><select aria-label="Create a workspace template" value="" onChange={event => { if (event.target.value) void createPreset(event.target.value as NonNullable<WorkspaceConfig['kind']>); }}><option value="">+ Add template</option><option value="study">Study</option><option value="writing">Writing</option><option value="design">Design</option><option value="deep-work">Deep work</option><option value="freelance">Freelance</option><option value="custom">Custom</option></select>{config.id !== 'coding-workspace-default' && <button className="button button-light" onClick={()=>void removePreset()}>Delete</button>}</section>
      {localError && <div className="workspace-inline-error"><CircleAlert size={16}/>{localError}<button onClick={() => setLocalError('')} aria-label="Dismiss error"><XCircle size={15}/></button></div>}

      <section className="workspace-setup-banner">
        <div className="workspace-setup-icon"><Code2 size={21}/></div>
        <div className="workspace-setup-copy">
          <span className="eyebrow">STARTER PRESET</span>
          <h2>{config.name}</h2>
          <p>Prepare a reusable {config.kind ?? 'custom'} environment, set your intention and choose how Scout accompanies you.</p>
        </div>
        <div className="workspace-preset-tag">WINDOWS DESKTOP</div>
      </section>

      <div className="workspace-config-grid">
        <section className="panel workspace-config-panel">
          <div className="panel-heading">
            <div><div className="eyebrow">01 · YOUR PROJECT</div><h3>Choose your {config.kind === 'study' ? 'study' : config.kind === 'writing' ? 'writing' : config.kind === 'design' ? 'design' : config.kind === 'freelance' ? 'client work' : 'work'} environment</h3></div>
            <span className="workspace-step-count">2 required</span>
          </div>
          <div className="workspace-path-field">
            <div className="workspace-path-icon"><Code2 size={18}/></div>
            <div className="workspace-path-copy"><strong>Primary application</strong><span>{config.idePath ? fileName(config.idePath) : 'Choose the main application executable (.exe)'}</span>{config.idePath && <small title={config.idePath}>{config.idePath}</small>}</div>
            <button className="button button-light workspace-browse" onClick={() => void browseExecutable('idePath')}><FolderOpen size={14}/> Browse</button>
          </div>
          <div className="workspace-path-field">
            <div className="workspace-path-icon"><Folder size={18}/></div>
            <div className="workspace-path-copy"><strong>Project folder</strong><span>{config.projectPath ? fileName(config.projectPath) : 'Choose the folder you want to open'}</span>{config.projectPath && <small title={config.projectPath}>{config.projectPath}</small>}</div>
            <button className="button button-light workspace-browse" onClick={() => void browseProject()}><FolderOpen size={14}/> Browse</button>
          </div>
          <div className="workspace-path-field optional">
            <div className="workspace-path-icon"><Terminal size={18}/></div>
            <div className="workspace-path-copy"><strong>Terminal <em>Optional</em></strong><span>{config.terminalPath ? fileName(config.terminalPath) : 'Open a terminal in your project folder'}</span>{config.terminalPath && <small title={config.terminalPath}>{config.terminalPath}</small>}</div>
            {config.terminalPath ? <button className="button button-light workspace-browse" onClick={() => void setField('terminalPath', '')}><XCircle size={14}/> Remove</button> : <button className="button button-light workspace-browse" onClick={() => void browseExecutable('terminalPath')}><FolderOpen size={14}/> Add</button>}
          </div>
          <div className="workspace-url-field">
            <label htmlFor="workspace-docs">Documentation URL <span>Optional · HTTPS only</span></label>
            <div className="workspace-url-input"><Globe size={16}/><input id="workspace-docs" value={config.docsUrl} onChange={event => setField('docsUrl', event.target.value)} placeholder="https://react.dev"/><button onClick={() => setField('docsUrl', '')} title="Clear documentation URL"><XCircle size={15}/></button></div>
          </div>
        </section>

        <section className="panel workspace-config-panel">
          <div className="panel-heading"><div><div className="eyebrow">02 · YOUR INTENTION</div><h3>What matters this session?</h3></div><div className="workspace-mini-mark"><Sparkles size={17}/></div></div>
          <label className="workspace-label" htmlFor="workspace-intention">Focus intention</label>
          <textarea id="workspace-intention" className="workspace-intention-input" value={config.intentionTemplate} maxLength={160} onChange={event => setField('intentionTemplate', event.target.value)} placeholder="e.g. Complete Supabase authentication" rows={3}/>
          <div className="workspace-number-row">
            <label htmlFor="workspace-focus">Focus duration</label>
            <select id="workspace-focus" value={config.focusMinutes} onChange={event => setField('focusMinutes', Number(event.target.value))}>
              {[25, 40, 50, 60, 75, 90, 120].map(value => <option key={value} value={value}>{value} minutes</option>)}
            </select>
          </div>
          <div className="workspace-number-row">
            <label htmlFor="workspace-break">Break suggestion</label>
            <select id="workspace-break" value={config.breakMinutes} onChange={event => setField('breakMinutes', Number(event.target.value))}>
              {[5, 10, 15, 20].map(value => <option key={value} value={value}>{value} minutes</option>)}
            </select>
          </div>
          <div className="workspace-number-row">
            <label htmlFor="workspace-scout">Scout's presence</label>
            <select id="workspace-scout" value={config.scoutMode} onChange={event => setField('scoutMode', event.target.value as WorkspaceConfig['scoutMode'])}>
              <option value="quiet">Quiet companion</option>
              <option value="encouraging">Encouraging</option>
              <option value="playful">Playful</option>
            </select>
          </div>
          <div className="workspace-scout-note"><img src="./assets/scout-happy.jpg" alt="Scout"/><div><strong>Scout will join your session.</strong><span>{scoutDescription(config.scoutMode)}</span></div></div>
        </section>
      </div>

      <section className="panel workspace-rules-panel">
        <div className="panel-heading"><div><div className="eyebrow">03 · WORKSPACE ACTIVITY RULES</div><h3>What counts as focused work here?</h3></div><span className="workspace-step-count">{workspaceRules.length} overrides</span></div>
        <p className="small-muted">These rules apply only while this workspace is active. Unlisted apps use your global app rules, then remain unclassified.</p>
        <form className="workspace-rule-form" onSubmit={event => { event.preventDefault(); void addWorkspaceRule(); }}>
          <input aria-label="Application name" value={ruleName} onChange={event => setRuleName(event.target.value)} placeholder="Application name, e.g. chrome.exe" maxLength={100}/>
          <select aria-label="Application category" value={ruleCategory} onChange={event => setRuleCategory(event.target.value as AppCategory)}><option value="productive">Productive</option><option value="distracting">Distracting</option><option value="unclassified">Unclassified</option></select>
          <button className="button button-light" type="submit" disabled={!ruleName.trim()}>Add rule</button>
        </form>
        <div className="workspace-rule-list">{workspaceRules.map(rule => <div className="workspace-rule-row" key={rule.appName}><strong>{rule.appName}</strong><span className={`category-tag ${rule.category}`}>{rule.category}</span><button className="icon-button" title={`Remove ${rule.appName} workspace override`} onClick={() => void window.cys.deleteWorkspaceAppRule({ presetId: config.id ?? 'coding-workspace-default', appName: rule.appName }).then(() => window.cys.getWorkspaceAppRules(config.id ?? 'coding-workspace-default').then(setWorkspaceRules)).catch(error => setLocalError(error instanceof Error ? error.message : 'Could not remove rule.'))}><XCircle size={15}/></button></div>)}</div>
      </section>

      <section className="workspace-privacy-note"><ShieldCheck size={17}/><div><strong>Your computer stays yours.</strong><span>Workspace launch only opens the items you selected. It does not enable activity tracking, close apps or run scripts.</span></div></section>
      <section className="panel workspace-history-panel"><div className="panel-heading"><div><div className="eyebrow">WORKSPACE HISTORY</div><h3>Recent workspace runs</h3></div><span className="workspace-step-count">{runHistory.length} recent</span></div>{runHistory.length ? <div className="workspace-run-history">{runHistory.map(run=><div className="workspace-run-history-row" key={run.id}><div className="workspace-run-history-copy"><strong>{run.presetName}</strong><span>{run.taskTitle}</span><small>{new Date(run.startedAt).toLocaleString()} · {run.focusMinutes} min planned</small></div><span className={`workspace-run-status ${run.status}`}>{run.status.replaceAll('_',' ')}</span></div>)}</div> : <p className="small-muted">Your workspace runs will appear here after you start one.</p>}</section>
      {activeSession && <div className="workspace-inline-error"><CircleAlert size={16}/>You already have an active focus session. Finish or cancel it before starting a workspace.</div>}
      <div className="workspace-footer-actions">
        <span><Clock3 size={14}/> {config.focusMinutes}-minute focus · {config.breakMinutes}-minute break suggestion</span>
        <button className="button button-dark" onClick={() => void openPreview()} disabled={saving || !config.name.trim() || !config.intentionTemplate.trim() || Boolean(activeSession)}>{saving ? <Loader2 size={15} className="spin"/> : <ArrowRight size={15}/>} Preview launch</button>
      </div>
    </>}

    {stage === 'preview' && preview && <>
      <button className="workspace-back-link" onClick={() => setStage('setup')}><ArrowLeft size={15}/> Back to workspace setup</button>
      <div className="workspace-preview-hero">
        <div className="workspace-preview-copy"><div className="eyebrow">FINAL CHECK · CODING WORKSPACE</div><h1>Scout is ready when you are.</h1><p>Review what will open and how your focus session will begin. Nothing launches until you confirm.</p></div>
        <img src="./assets/scout-focused.jpg" alt="Scout is ready"/>
      </div>
      <section className="panel workspace-library-strip"><div><div className="eyebrow">YOUR WORKSPACE LIBRARY</div><strong>Choose a reusable setup</strong><span>{presets.length} presets available</span></div><select aria-label="Select workspace preset" value={config.id ?? 'coding-workspace-default'} onChange={event => void selectPreset(event.target.value)}>{presets.map(preset => <option key={preset.id} value={preset.id}>{preset.name}</option>)}</select><select aria-label="Create a workspace template" value="" onChange={event => { if (event.target.value) void createPreset(event.target.value as NonNullable<WorkspaceConfig['kind']>); }}><option value="">+ Add template</option><option value="study">Study</option><option value="writing">Writing</option><option value="design">Design</option><option value="deep-work">Deep work</option><option value="freelance">Freelance</option><option value="custom">Custom</option></select>{config.id !== 'coding-workspace-default' && <button className="button button-light" onClick={()=>void removePreset()}>Delete</button>}</section>
      {localError && <div className="workspace-inline-error"><CircleAlert size={16}/>{localError}</div>}
      <div className="workspace-preview-layout">
        <section className="panel workspace-preview-panel">
          <div className="panel-heading"><div><div className="eyebrow">LAUNCH CHECKLIST</div><h3>Your environment</h3></div><span className={`workspace-ready-pill ${preview.ready ? 'ready' : 'blocked'}`}><i/>{preview.ready ? 'Ready to launch' : 'Needs attention'}</span></div>
          <div className="workspace-preview-items">
            {items.map(item => <div className="workspace-preview-item" key={item.id}>
              <div className={`workspace-item-status ${item.status}`}>{item.status === 'ready' ? <CheckCircle2 size={17}/> : item.status === 'not-configured' ? <span>—</span> : <CircleAlert size={17}/>}</div>
              <div className="workspace-preview-item-copy"><strong>{item.label} {item.required && <em>Required</em>}</strong><span title={item.detail}>{item.detail}</span><small>{item.message}</small></div>
              <span className={`workspace-item-label ${item.status}`}>{statusLabel(item.status)}</span>
            </div>)}
          </div>
          {preview.blockingIssues.length > 0 && <div className="workspace-blocking-list"><strong>Before you can start</strong>{preview.blockingIssues.map(issue => <span key={issue}><CircleAlert size={14}/>{issue}</span>)}</div>}
        </section>
        <section className="panel workspace-session-summary">
          <div className="eyebrow">YOUR FOCUS SESSION</div>
          <h3>{config.intentionTemplate}</h3>
          <div className="workspace-summary-metrics"><div><Clock3 size={17}/><span><strong>{config.focusMinutes} min</strong><small>Focus duration</small></span></div><div><Sparkles size={17}/><span><strong>{capitalize(config.scoutMode)}</strong><small>Scout presence</small></span></div></div>
          <div className="workspace-summary-line"><span>Break suggestion</span><strong>{config.breakMinutes} minutes</strong></div>
          <div className="workspace-summary-line"><span>Session tracking</span><strong>{isTrackingEnabled ? 'Enabled' : 'Off'}</strong></div>
          {!isTrackingEnabled && <div className="workspace-tracking-warning"><ShieldCheck size={16}/><span>Activity tracking is off. Your applications and focus timer can still start, but app activity will not be recorded. This workspace will not turn tracking on for you.</span></div>}
          <div className="workspace-scout-confirm"><img src="./assets/scout-happy.jpg" alt="Scout"/><div><strong>Scout will be nearby.</strong><span>{scoutDescription(config.scoutMode)}</span></div></div>
        </section>
      </div>
      <div className="workspace-confirm-bar">
        <div><strong>Ready to begin?</strong><span>Only the items listed above will be opened.</span></div>
        <div className="workspace-confirm-actions"><button className="button button-light" onClick={() => setStage('setup')} disabled={launching}>Edit setup</button><button className="button button-dark" onClick={() => void confirmLaunch()} disabled={!preview.ready || launching}>{launching ? <Loader2 size={15} className="spin"/> : <Play size={15}/>} {launching ? 'Starting workspace…' : 'Confirm & start'}</button></div>
      </div>
    </>}

    {stage === 'result' && result && <>
      <div className="workspace-result-hero">
        <div className={`workspace-result-icon ${result.started ? 'success' : 'failed'}`}>{result.started ? <CheckCircle2 size={28}/> : <CircleAlert size={28}/>}</div>
        <div><div className="eyebrow">WORKSPACE LAUNCH RESULT</div><h1>{result.started ? 'Your workspace is ready.' : 'A little setup is still needed.'}</h1><p>{result.message}</p></div>
      </div>
      <section className="panel workspace-result-panel">
        <div className="panel-heading"><div><div className="eyebrow">LAUNCH REPORT</div><h3>What happened</h3></div></div>
        {result.launchResults.map(item => <LaunchResultRow key={item.id} item={item}/>)}
      </section>
      {result.started ? <div className="workspace-confirm-bar"><div><strong>Scout is with you.</strong><span>Your focus session has started. You can review it in the Focus room.</span></div><button className="button button-dark" onClick={onFocusRoom}>Go to focus room <ArrowRight size={15}/></button></div> : <div className="workspace-confirm-bar"><div><strong>Your focus session was not started.</strong><span>Fix the issue and try again. Successfully opened applications may remain open.</span></div><div className="workspace-confirm-actions"><button className="button button-light" onClick={() => setStage('setup')}><RotateCcw size={14}/> Edit setup</button><button className="button button-dark" onClick={() => void openPreview()}>Review again <ArrowRight size={15}/></button></div></div>}
    </>}
  </div>;
}

function LaunchResultRow({ item }: { item: WorkspaceLaunchResult }) {
  const Icon = item.status === 'launched' ? CheckCircle2 : item.status === 'failed' ? XCircle : CircleAlert;
  return <div className="workspace-result-row"><Icon className={item.status} size={17}/><div><strong>{item.label}</strong><span>{item.message}</span></div><em className={item.status}>{item.status}</em></div>;
}

function statusLabel(status: WorkspacePreview['items'][number]['status']) {
  if (status === 'ready') return 'Ready';
  if (status === 'not-configured') return 'Optional';
  return 'Missing';
}
function scoutDescription(mode: WorkspaceConfig['scoutMode']) {
  if (mode === 'encouraging') return 'Gentle reminders and milestone celebrations.';
  if (mode === 'playful') return 'More expressive reactions and playful moments.';
  return 'Quiet presence with important milestone reactions.';
}
function capitalize(value: string) { return value.charAt(0).toUpperCase() + value.slice(1); }
