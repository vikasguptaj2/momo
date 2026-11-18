import { randomUUID } from 'node:crypto';
import type { ActivitySample, AppCategory, DailyReport } from '../../shared/types.js';
import type { Storage } from '../database/storage.js';
import type { SettingsService } from './settings.js';
import type { FocusService } from './focus.js';
import { classifyApplication, normalizeProcessName } from '../engines/classification.js';
import { DistractionEngine } from '../engines/distraction.js';

interface Segment { appName: string; title: string | null; category: AppCategory; startedAt: string; lastAt: string; seconds: number; focusSessionId: string | null; }

export class ActivityService {
  private segment: Segment | null = null;
  private lastSampleMs: number | null = null;
  private lastFlushMs = 0;
  private distraction = new DistractionEngine();
  private lastApp = '';
  private lastDashboardBroadcastAt = 0;
  private wasIdle = false;
  private lastFocusSessionId: string | null = null;
  private ignoredDistractionApp: string | null = null;
  private idleStartedAt: string | null = null;
  private lastIdleFlushMs = 0;

  constructor(
    private storage: Storage,
    private settings: SettingsService,
    private focus: FocusService,
    private onDistraction: (appName: string, message: string) => void,
    private onDashboard: () => void,
    private onCompanion: (kind: 'idle' | 'welcome' | 'productive', message: string) => void
  ) {}

  snoozeDistractions(minutes = 10) {
    const safeMinutes = Math.max(1, Math.min(60, Math.floor(minutes)));
    this.distraction.snoozeUntil(Date.now() + safeMinutes * 60_000);
  }

  ignoreDistractionAppUntilSwitch(appName: string) {
    const normalized = normalizeProcessName(appName);
    if (normalized) this.ignoredDistractionApp = normalized;
  }

  sample(sample: ActivitySample) {
    if (!this.settings.get().trackingEnabled) return;
    const at = new Date(sample.timestamp);
    if (!Number.isFinite(at.getTime())) return;
    const nowMs = at.getTime();
    const settings = this.settings.get();
    const processName = normalizeProcessName(sample.processName || 'unknown');
    const currentFocus = this.focus.current();
    const rules = new Map<string, AppCategory>(
      (this.storage.raw.prepare('SELECT app_name, category FROM app_rules').all() as Array<{ app_name: string; category: AppCategory }>)
        .map(row => [normalizeProcessName(row.app_name), row.category] as const)
    );
    // Workspace-specific rules override global preferences only during that workspace run.
    if (currentFocus?.workspaceRunId) {
      const workspaceRules = this.storage.raw.prepare(`SELECT app_name, category FROM workspace_app_rules WHERE preset_id = (SELECT preset_id FROM workspace_runs WHERE id = ?)`).all(currentFocus.workspaceRunId) as Array<{ app_name: string; category: AppCategory }>;
      for (const row of workspaceRules) rules.set(normalizeProcessName(row.app_name), row.category);
    }
    const category = classifyApplication(processName, rules);

    const previousMs = this.lastSampleMs;
    const previousApp = this.lastApp;
    const previousWasIdle = this.wasIdle;
    const elapsed = previousMs === null ? 0 : Math.min(3, Math.max(0, (nowMs - previousMs) / 1000));
    const idle = sample.idleSeconds >= settings.idleThresholdSeconds;
    const appChanged = previousApp !== processName;
    if (this.ignoredDistractionApp && appChanged && processName !== this.ignoredDistractionApp) this.ignoredDistractionApp = null;
    const activeSessionId = currentFocus?.status === 'running' ? currentFocus.id : null;
    const sessionChanged = this.lastFocusSessionId !== activeSessionId;
    const contextChanged = appChanged || sessionChanged;
    const continuesSameActiveApp = !idle && !previousWasIdle && !contextChanged;

    if (idle && !previousWasIdle) this.onCompanion('idle', 'Looks like you stepped away. Take the time you need.');
    if (!idle && previousWasIdle) this.onCompanion('welcome', 'Welcome back. Ready for the next small step?');
    if (!idle && category === 'productive' && currentFocus?.status === 'running' && appChanged) {
      this.onCompanion('productive', `Nice, back to ${processName.replace(/\.exe$/i, '')}. Keep going at your pace.`);
    }

    this.lastSampleMs = nowMs;
    this.wasIdle = idle;
    this.lastFocusSessionId = activeSessionId;

    if (idle && !previousWasIdle) {
      // Count extended idle only after the configured threshold is crossed.
      this.idleStartedAt = sample.timestamp;
      this.lastIdleFlushMs = nowMs;
    } else if (idle && this.idleStartedAt && nowMs - this.lastIdleFlushMs >= 15000) {
      this.flushIdle(nowMs);
    } else if (!idle && previousWasIdle && this.idleStartedAt) {
      this.flushIdle(nowMs);
      this.idleStartedAt = null;
      this.lastIdleFlushMs = 0;
    }

    // The interval between two polls belongs to the app seen at the previous poll.
    // Close that interval before switching to the newly observed foreground app.
    if (this.segment && (idle || contextChanged)) {
      if (!previousWasIdle && elapsed > 0) {
        this.segment.seconds += elapsed;
        this.segment.lastAt = sample.timestamp;
      }
      this.flush();
    }

    if (!idle) {
      if (!this.segment) {
        const startedAt = continuesSameActiveApp && elapsed > 0
          ? new Date(nowMs - elapsed * 1000).toISOString()
          : sample.timestamp;
        this.segment = {
          appName: processName,
          title: settings.captureWindowTitles ? sample.windowTitle || null : null,
          category,
          startedAt,
          lastAt: sample.timestamp,
          seconds: continuesSameActiveApp ? elapsed : 0,
          focusSessionId: currentFocus?.status === 'running' ? currentFocus.id : null
        };
        if (this.lastFlushMs === 0) this.lastFlushMs = nowMs;
      } else if (continuesSameActiveApp && elapsed > 0) {
        this.segment.seconds += elapsed;
        this.segment.lastAt = sample.timestamp;
        if (this.segment.title && sample.windowTitle && settings.captureWindowTitles) this.segment.title = sample.windowTitle;
      }

      if (this.lastFlushMs > 0 && nowMs - this.lastFlushMs >= 15000) this.flush();
    }

    const decision = this.ignoredDistractionApp === processName
      ? { shouldRemind: false, reason: 'user-marked-intentional' }
      : this.distraction.evaluate({
      focusRunning: currentFocus?.status === 'running',
      category,
      processName,
      idleSeconds: sample.idleSeconds,
      idleThresholdSeconds: settings.idleThresholdSeconds,
      thresholdSeconds: settings.distractionThresholdSeconds,
      cooldownSeconds: settings.reminderCooldownSeconds,
      nowMs
    });
    if (decision.shouldRemind) {
      const message = `You've been on ${processName.replace(/\.exe$/i, '')} for a while. Is this part of your current task?`;
      this.storage.raw.prepare('INSERT INTO distraction_events (id, app_name, created_at, focus_session_id, message) VALUES (?, ?, ?, ?, ?)')
        .run(randomUUID(), processName, sample.timestamp, currentFocus?.id ?? null, message);
      this.onDistraction(processName, message);
    }

    this.lastApp = processName;
    if (nowMs - this.lastDashboardBroadcastAt >= 5000) {
      this.lastDashboardBroadcastAt = nowMs;
      this.onDashboard();
    }
  }

  flush() {
    if (this.segment && this.segment.seconds >= 0.5) {
      const s = this.segment;
      this.storage.raw.prepare('INSERT INTO activity_segments (id, app_name, window_title, category, started_at, ended_at, duration_seconds, focus_session_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?)')
        .run(randomUUID(), s.appName, s.title, s.category, s.startedAt, s.lastAt, Math.max(1, Math.round(s.seconds)), s.focusSessionId);
    }
    this.segment = null;
    this.lastFlushMs = Date.now();
    if (this.idleStartedAt && this.lastSampleMs !== null) this.flushIdle(this.lastSampleMs);
  }

  private flushIdle(endMs: number) {
    if (!this.idleStartedAt) return;
    const startMs = new Date(this.idleStartedAt).getTime();
    const duration = Math.floor((endMs - startMs) / 1000);
    if (Number.isFinite(startMs) && duration > 0) {
      this.storage.raw.prepare('INSERT INTO idle_segments (id, started_at, ended_at, duration_seconds) VALUES (?, ?, ?, ?)')
        .run(randomUUID(), this.idleStartedAt, new Date(endMs).toISOString(), duration);
    }
    this.idleStartedAt = new Date(endMs).toISOString();
    this.lastIdleFlushMs = endMs;
  }

  reset() { this.flush(); this.idleStartedAt = null; this.lastIdleFlushMs = 0; this.lastSampleMs = null; this.lastFlushMs = 0; this.lastApp = ''; this.wasIdle = false; this.lastFocusSessionId = null; this.ignoredDistractionApp = null; this.distraction.reset(); }

  getRecentActivity(limit = 8) {
    const rows = this.storage.raw.prepare('SELECT id, app_name as appName, window_title as windowTitle, category, started_at as startedAt, ended_at as endedAt, duration_seconds as durationSeconds FROM activity_segments ORDER BY started_at DESC LIMIT ?').all(limit) as Array<{ id: string; appName: string; windowTitle: string | null; category: AppCategory; startedAt: string; endedAt: string; durationSeconds: number }>;
    if (this.segment && this.segment.seconds >= 1) rows.unshift({ id: 'current-segment', appName: this.segment.appName, windowTitle: this.segment.title, category: this.segment.category, startedAt: this.segment.startedAt, endedAt: this.segment.lastAt, durationSeconds: Math.round(this.segment.seconds) });
    return rows.slice(0, limit);
  }

  report(date = `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}-${String(new Date().getDate()).padStart(2, '0')}`, flushCurrent = true): DailyReport {
    if (flushCurrent) this.flush();
    const dateParts = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date);
    if (!dateParts) throw new Error('Invalid report date. Expected YYYY-MM-DD.');
    const year = Number(dateParts[1]);
    const month = Number(dateParts[2]);
    const day = Number(dateParts[3]);
    const startDate = new Date(year, month - 1, day);
    if (startDate.getFullYear() !== year || startDate.getMonth() !== month - 1 || startDate.getDate() !== day) {
      throw new Error('Invalid report date.');
    }
    const endDate = new Date(year, month - 1, day + 1);
    const start = startDate.toISOString();
    const end = endDate.toISOString();
    const aggregates = this.storage.raw.prepare('SELECT category, SUM(duration_seconds) as seconds FROM activity_segments WHERE started_at >= ? AND started_at < ? GROUP BY category').all(start, end) as Array<{ category: AppCategory; seconds: number | null }>;
    const seconds = (category: AppCategory) => Number(aggregates.find(x => x.category === category)?.seconds ?? 0);
    const idle = this.storage.raw.prepare('SELECT COALESCE(SUM(duration_seconds), 0) AS seconds FROM idle_segments WHERE started_at >= ? AND started_at < ?').get(start, end) as { seconds: number };
    const focus = this.storage.raw.prepare("SELECT COUNT(*) as count, SUM(accumulated_seconds + CASE WHEN status = 'running' AND resumed_at IS NOT NULL THEN MAX(0, CAST((julianday('now') - julianday(resumed_at)) * 86400 AS INTEGER)) ELSE 0 END) as seconds, SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) as completed FROM focus_sessions WHERE started_at >= ? AND started_at < ?").get(start, end) as { count: number; seconds: number | null; completed: number | null };
    const distractions = this.storage.raw.prepare('SELECT COUNT(*) as count FROM distraction_events WHERE created_at >= ? AND created_at < ?').get(start, end) as { count: number };
    const topApps = this.storage.raw.prepare('SELECT app_name as appName, category, SUM(duration_seconds) as durationSeconds FROM activity_segments WHERE started_at >= ? AND started_at < ? GROUP BY app_name, category ORDER BY durationSeconds DESC LIMIT 5').all(start, end) as DailyReport['topApps'];
    const plan = this.storage.raw.prepare(`SELECT COUNT(*) AS planned, SUM(CASE WHEN t.status='completed' OR t.completed_at IS NOT NULL THEN 1 ELSE 0 END) AS completed FROM daily_plan_items dpi JOIN tasks t ON t.id=dpi.task_id WHERE dpi.date=?`).get(date) as { planned: number; completed: number | null };
    const recovery = this.storage.raw.prepare("SELECT (SELECT COUNT(*) FROM distraction_events WHERE created_at>=? AND created_at<?) AS prompts, (SELECT COUNT(*) FROM recovery_events WHERE created_at>=? AND created_at<? AND action='restart') AS successful").get(start, end, start, end) as { prompts: number; successful: number | null };
    const breakTotals = this.storage.raw.prepare("SELECT COALESCE(SUM(accumulated_seconds + CASE WHEN status='running' AND resumed_at IS NOT NULL THEN MAX(0, CAST((julianday('now') - julianday(resumed_at)) * 86400 AS INTEGER)) ELSE 0 END), 0) AS seconds, SUM(CASE WHEN status='completed' THEN 1 ELSE 0 END) AS completed FROM break_sessions WHERE started_at>=? AND started_at<?").get(start, end) as { seconds: number | null; completed: number | null };
    const reflectionRows = this.storage.raw.prepare('SELECT outcome, COUNT(*) AS count FROM session_reflections WHERE created_at>=? AND created_at<? GROUP BY outcome').all(start, end) as Array<{ outcome: string; count: number }>;
    const outcomeCount = (outcome: string) => Number(reflectionRows.find(row => row.outcome === outcome)?.count ?? 0);
    return { date, totalActiveSeconds: seconds('productive') + seconds('distracting') + seconds('unclassified'), idleSeconds: Number(idle.seconds ?? 0), productiveSeconds: seconds('productive'), distractingSeconds: seconds('distracting'), unclassifiedSeconds: seconds('unclassified'), focusSeconds: Number(focus.seconds ?? 0), sessionCount: focus.count, completedSessions: Number(focus.completed ?? 0), distractionCount: distractions.count, topApps, plannedMissions: Number(plan.planned ?? 0), completedMissions: Number(plan.completed ?? 0), recoveryPrompts: Number(recovery.prompts ?? 0), successfulRecoveries: Number(recovery.successful ?? 0), taskOutcomes: { completed: outcomeCount('completed'), partial: outcomeCount('partial'), blocked: outcomeCount('blocked'), noProgress: outcomeCount('no_progress') }, breakSeconds: Number(breakTotals.seconds ?? 0), completedBreaks: Number(breakTotals.completed ?? 0) };
  }

  todaySummary() {
    const report = this.report(undefined, false);
    const segment = this.segment;
    const isToday = segment ? new Date(segment.startedAt).toLocaleDateString() === new Date().toLocaleDateString() : false;
    const extra = isToday && segment ? Math.round(segment.seconds) : 0;
    const liveIdle = this.idleStartedAt ? Math.max(0, Math.floor((Date.now() - new Date(this.idleStartedAt).getTime()) / 1000)) : 0;
    return { totalActiveSeconds: report.totalActiveSeconds + extra, idleSeconds: report.idleSeconds + liveIdle, productiveSeconds: report.productiveSeconds + (segment?.category === 'productive' && isToday ? extra : 0), distractingSeconds: report.distractingSeconds + (segment?.category === 'distracting' && isToday ? extra : 0), unclassifiedSeconds: report.unclassifiedSeconds + (segment?.category === 'unclassified' && isToday ? extra : 0), focusSeconds: report.focusSeconds, sessionCount: report.sessionCount };
  }
}
