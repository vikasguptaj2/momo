import { BrowserWindow, screen } from 'electron';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';
import type { CompanionEvent, WorkspaceScoutMode, UserProfile } from '../../shared/types.js';
import type { Storage } from '../database/storage.js';

export class CompanionService {
  private window: BrowserWindow | null = null;
  private workspaceMode: WorkspaceScoutMode = 'quiet';
  private workspaceModeSet = false;
  private latestEvent: CompanionEvent = { kind: 'welcome', message: 'I am here. One small step at a time.', createdAt: new Date().toISOString(), workspaceMode: 'quiet' };
  constructor(private storage: Storage, private broadcast: (event: CompanionEvent) => void, private getProfile: () => UserProfile) {}

  open() {
    if (this.window && !this.window.isDestroyed()) { this.window.show(); this.window.focus(); return; }
    const area = screen.getPrimaryDisplay().workArea;
    this.window = new BrowserWindow({
      width: 340, height: 390, x: area.x + area.width - 320, y: area.y + 80,
      frame: false, transparent: true, resizable: false, alwaysOnTop: true, skipTaskbar: true,
      show: false, backgroundColor: '#00000000',
      webPreferences: { preload: join(__dirname, '../preload/index.js'), contextIsolation: true, nodeIntegration: false, sandbox: true }
    });
    this.window.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: false });
    this.window.on('closed', () => { this.window = null; });
    if (process.env.ELECTRON_RENDERER_URL) this.window.loadURL(`${process.env.ELECTRON_RENDERER_URL}/companion.html`);
    else this.window.loadFile(join(__dirname, '../renderer/companion.html'));
    this.window.once('ready-to-show', () => {
      if (this.window && !this.window.isDestroyed()) {
        this.window.webContents.send('companion:event', this.latestEvent);
        this.window.show();
      }
    });
  }

  close() { this.window?.close(); this.window = null; }
  setWorkspaceMode(mode: WorkspaceScoutMode) { this.workspaceMode = mode; this.workspaceModeSet = true; }
  clearWorkspaceMode() { this.workspaceMode = 'quiet'; this.workspaceModeSet = false; }
  emit(kind: CompanionEvent['kind'], message: string, details: Partial<Pick<CompanionEvent, 'appName' | 'canRecover'>> = {}) {
    const event: CompanionEvent = { kind, message: this.applyPersonality(kind, message), createdAt: new Date().toISOString(), workspaceMode: this.workspaceMode, ...details };
    this.storage.raw.prepare('INSERT INTO companion_events (id, kind, message, created_at) VALUES (?, ?, ?, ?)').run(randomUUID(), kind, message, event.createdAt);
    // Ambient reactions respect user-selected working days, hours, quiet hours and interaction frequency.
    const ambient = kind === 'productive' || kind === 'idle';
    if (ambient && !this.ambientInteractionsAllowed(new Date(event.createdAt))) return;
    // Quiet workspace mode suppresses low-priority reactions without suppressing accountability or celebrations.
    if (this.workspaceModeSet && this.workspaceMode === 'quiet' && ambient) return;
    this.latestEvent = event;
    this.broadcast(event);
    if (this.window && !this.window.isDestroyed()) this.window.webContents.send('companion:event', event);
  }

  private applyPersonality(kind: CompanionEvent['kind'], message: string): string {
    try {
      const row = this.storage.raw.prepare("SELECT value FROM scout_preferences WHERE key='personality'").get() as { value: string } | undefined;
      const style = row ? JSON.parse(row.value) as string : 'supportive';
      if (style === 'curious' && ['welcome','checkin','productive'].includes(kind)) return `${message} What felt like the most useful part of that?`;
      if (style === 'playful' && ['complete','productive','focus'].includes(kind)) return `${message} Scout gives a tiny celebratory paw-wave. 🐾`;
      if (style === 'cheeky' && kind === 'distraction') return `${message} No dramatic speeches. Just one small comeback. 😉`;
      if (style === 'supportive' && kind === 'recovery') return `${message} You can begin again without making up for lost time.`;
    } catch { /* P1 tables are initialized during app startup; keep P0 safe if unavailable. */ }
    return message;
  }

  private ambientInteractionsAllowed(now: Date): boolean {
    let profile: UserProfile;
    try { profile = this.getProfile(); } catch { return true; }
    let freq = profile.interactionFrequency;
    try {
      const row = this.storage.raw.prepare("SELECT value FROM scout_preferences WHERE key='interactionFrequency'").get() as { value: string } | undefined;
      if (row) freq = (JSON.parse(row.value) as 'low' | 'normal' | 'high') ?? freq;
    } catch { /* use profile interaction frequency if scout_preferences is unavailable */ }
    if (freq === 'low') return false;
    const timeZone = profile.timezone || Intl.DateTimeFormat().resolvedOptions().timeZone;
    let weekday = now.getDay();
    let minutes = now.getHours() * 60 + now.getMinutes();
    try {
      const parts = new Intl.DateTimeFormat('en-US', { timeZone, weekday: 'short', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).formatToParts(now);
      const values = Object.fromEntries(parts.map(part => [part.type, part.value]));
      const days: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
      weekday = days[values.weekday ?? ''] ?? weekday;
      minutes = Number(values.hour ?? '0') * 60 + Number(values.minute ?? '0');
    } catch { /* use the Windows local clock if the profile timezone is unavailable */ }
    if (!profile.workingDays.includes(weekday)) return false;
    if (!isWithinClockRange(minutes, profile.workStartTime, profile.workEndTime)) return false;
    if (isWithinQuietHours(minutes, profile.quietStartTime, profile.quietEndTime)) return false;
    return true;
  }
}

function parseClock(value: string): number {
  const match = /^(\d{2}):(\d{2})$/.exec(value);
  return match ? Number(match[1]) * 60 + Number(match[2]) : 0;
}

function isWithinClockRange(now: number, startText: string, endText: string): boolean {
  const start = parseClock(startText); const end = parseClock(endText);
  if (start === end) return true;
  return start < end ? now >= start && now < end : now >= start || now < end;
}

function isWithinQuietHours(now: number, startText: string, endText: string): boolean {
  const start = parseClock(startText); const end = parseClock(endText);
  if (start === end) return false;
  return start < end ? now >= start && now < end : now >= start || now < end;
}
