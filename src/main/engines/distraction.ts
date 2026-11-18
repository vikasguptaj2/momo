export interface DistractionDecisionInput {
  focusRunning: boolean;
  category: string;
  processName: string;
  idleSeconds: number;
  idleThresholdSeconds: number;
  thresholdSeconds: number;
  cooldownSeconds: number;
  nowMs: number;
}

export class DistractionEngine {
  private candidate = '';
  private candidateSince = 0;
  private lastReminderAt = 0;
  private snoozedUntil = 0;

  snoozeUntil(untilMs: number) { this.snoozedUntil = Math.max(this.snoozedUntil, untilMs); }

  evaluate(input: DistractionDecisionInput): { shouldRemind: boolean; reason: string } {
    if (input.nowMs < this.snoozedUntil) return { shouldRemind: false, reason: 'snoozed' };
    if (!input.focusRunning || input.category !== 'distracting' || input.idleSeconds >= input.idleThresholdSeconds) {
      this.candidate = '';
      this.candidateSince = 0;
      return { shouldRemind: false, reason: 'not-eligible' };
    }

    const key = input.processName.toLowerCase();
    if (key !== this.candidate) {
      this.candidate = key;
      this.candidateSince = input.nowMs;
      return { shouldRemind: false, reason: 'candidate-started' };
    }

    const sustainedSeconds = Math.max(0, (input.nowMs - this.candidateSince) / 1000);
    if (sustainedSeconds < input.thresholdSeconds) return { shouldRemind: false, reason: 'below-threshold' };
    if (this.lastReminderAt && input.nowMs - this.lastReminderAt < input.cooldownSeconds * 1000) {
      return { shouldRemind: false, reason: 'cooldown' };
    }

    this.lastReminderAt = input.nowMs;
    // Reset the continuous candidate timer so that the next reminder requires a fresh interval.
    this.candidateSince = input.nowMs;
    return { shouldRemind: true, reason: 'threshold-reached' };
  }

  reset(clearSnooze = true) { this.candidate = ''; this.candidateSince = 0; this.lastReminderAt = 0; if (clearSnooze) this.snoozedUntil = 0; }
}
