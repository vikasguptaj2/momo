import { app, BrowserWindow, Menu, Tray, nativeImage, shell, powerMonitor } from 'electron';
import { join } from 'node:path';
import { Storage } from './database/storage.js';
import { SettingsService } from './services/settings.js';
import { FocusService } from './services/focus.js';
import { ActivityService } from './services/activity.js';
import { MonitorService } from './services/monitor.js';
import { CompanionService } from './services/companion.js';
import { MilestoneService } from './services/milestones.js';
import { WorkspaceService } from './services/workspace.js';
import { ProductivityService } from './services/productivity.js';
import { RecoveryService } from './services/recovery.js';
import { RoutineService } from './services/routines.js';
import { BreakService } from './services/breaks.js';
import { registerIpc } from './ipc.js';
import { notify } from './services/notifications.js';
import { P1Service } from './services/p1.js';

let mainWindow: BrowserWindow | null = null;
let tray: Tray | null = null;
let quitting = false;
const windows = new Set<BrowserWindow>();

function broadcast(channel: string, payload?: unknown) {
  for (const win of windows) if (!win.isDestroyed()) win.webContents.send(channel, payload);
}

const storage = new Storage();
const settings = new SettingsService(storage);
const p1 = new P1Service(storage.raw);
const productivity = new ProductivityService(storage);
let monitor: MonitorService;
const companion = new CompanionService(storage, event => broadcast('companion:event', event), () => productivity.getProfile());
const milestones = new MilestoneService(storage);
const focus = new FocusService(storage, (kind, message) => {
  companion.emit(kind, message);
  notify(kind === 'complete' ? 'Focus session complete' : kind === 'timer' ? 'Focus time reached' : 'Focus session started', message);
  broadcast('dashboard:updated');
});
const breaks = new BreakService(storage, focus, (kind, message) => { companion.emit(kind, message); notify(kind === 'break' ? 'Break time' : 'Ready when you are', message); broadcast('dashboard:updated'); });
const workspace = new WorkspaceService(storage, focus, settings, companion, breaks);
const routines = new RoutineService(storage);
const activity = new ActivityService(storage, settings, focus, (appName, message) => {
  companion.emit('distraction', message, { appName, canRecover: true });
  notify('A gentle nudge', message);
  broadcast('dashboard:updated');
}, () => broadcast('dashboard:updated'), (kind, message) => companion.emit(kind, message));
const recovery = new RecoveryService(
  productivity, focus, companion, () => broadcast('dashboard:updated'),
  minutes => activity.snoozeDistractions(minutes),
  appName => activity.ignoreDistractionAppUntilSwitch(appName), breaks
);
monitor = new MonitorService(sample => activity.sample(sample), status => {
  broadcast('monitor:status', status);
  broadcast('dashboard:updated');
});
registerIpc({ storage, focus, breaks, activity, settings, monitor, companion, milestones, workspace, productivity, recovery, routines, p1 }, broadcast);

function createMainWindow() {
  mainWindow = new BrowserWindow({
    width: 1440, height: 940, minWidth: 1050, minHeight: 700,
    title: 'CaughtYouSlacking', show: false, backgroundColor: '#111329',
    icon: app.isPackaged ? join(process.resourcesPath, 'icon.ico') : join(app.getAppPath(), 'resources', 'icon.ico'),
    webPreferences: { preload: join(__dirname, '../preload/index.js'), contextIsolation: true, nodeIntegration: false, sandbox: true }
  });
  windows.add(mainWindow);
  mainWindow.on('closed', () => { if (mainWindow) windows.delete(mainWindow); mainWindow = null; });
  mainWindow.webContents.setWindowOpenHandler(({ url }) => { if (url.startsWith('https://')) void shell.openExternal(url); return { action: 'deny' }; });
  mainWindow.webContents.on('will-navigate', (event, url) => { if (!url.startsWith('file://') && !url.startsWith(process.env.ELECTRON_RENDERER_URL ?? 'http://localhost:5173')) event.preventDefault(); });
  if (process.env.ELECTRON_RENDERER_URL) void mainWindow.loadURL(process.env.ELECTRON_RENDERER_URL);
  else void mainWindow.loadFile(join(__dirname, '../renderer/index.html'));
  mainWindow.once('ready-to-show', () => mainWindow?.show());
  mainWindow.on('close', event => { if (!quitting && process.platform === 'win32') { event.preventDefault(); mainWindow?.hide(); } });
}

function createTray() {
  const iconPath = app.isPackaged ? join(process.resourcesPath, 'icon.ico') : join(app.getAppPath(), 'resources', 'icon.ico');
  const icon = nativeImage.createFromPath(iconPath);
  tray = new Tray(icon.isEmpty() ? nativeImage.createEmpty() : icon);
  tray.setToolTip('CaughtYouSlacking — accountability companion');
  tray.setContextMenu(Menu.buildFromTemplate([
    { label: 'Open CaughtYouSlacking', click: () => { if (!mainWindow) createMainWindow(); mainWindow?.show(); mainWindow?.focus(); } },
    { label: 'Open companion', click: () => companion.open() },
    { type: 'separator' },
    { label: 'Quit', click: () => { quitting = true; app.quit(); } }
  ]));
  tray.on('double-click', () => { mainWindow?.show(); mainWindow?.focus(); });
}

let focusCheckpoint: NodeJS.Timeout | null = null;
app.whenReady().then(() => {
  createMainWindow();
  focusCheckpoint = setInterval(() => { try { focus.checkpoint(); focus.checkDeadline(); breaks.checkpoint(); breaks.checkDeadline(); } catch (error) { console.warn('Could not checkpoint focus session:', error); } }, 10000);
  focusCheckpoint.unref();
  if (process.platform === 'win32') createTray();
  const config = settings.get();
  const savedSession = focus.current();
  if (savedSession?.workspaceRunId) {
    const run = storage.raw.prepare('SELECT preset_id FROM workspace_runs WHERE id=?').get(savedSession.workspaceRunId) as { preset_id: string | null } | undefined;
    if (run?.preset_id) companion.setWorkspaceMode(workspace.getConfig(run.preset_id).scoutMode);
  }
  if (config.trackingEnabled) monitor.start(config.captureWindowTitles);
  if (config.showCompanion) companion.open();
  app.on('activate', () => { if (BrowserWindow.getAllWindows().length === 0) createMainWindow(); else mainWindow?.show(); });
});

powerMonitor.on('suspend', () => {
  try { if (focus.current()?.status === 'running') focus.pause(); if (breaks.current()?.status === 'running') breaks.pause(); } catch (error) { console.warn('Could not pause sessions before suspend:', error); }
  activity?.reset();
  monitor?.stop();
  broadcast('dashboard:updated');
});

powerMonitor.on('resume', () => {
  if (settings.get().trackingEnabled) monitor?.start(settings.get().captureWindowTitles);
  broadcast('dashboard:updated');
});

app.on('before-quit', () => {
  quitting = true;
  if (focusCheckpoint) clearInterval(focusCheckpoint);
  try { if (focus.current()?.status === 'running') focus.pause(); if (breaks.current()?.status === 'running') breaks.pause(); } catch (error) { console.warn('Could not pause sessions before quit:', error); }
  monitor?.stop();
  activity?.reset();
  companion?.close();
  storage?.close();
});

app.on('window-all-closed', () => { if (process.platform !== 'darwin') { quitting = true; app.quit(); } });
