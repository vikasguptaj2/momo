import { describe, expect, it } from 'vitest';
import { DistractionEngine } from './distraction.js';

const base = { focusRunning: true, category: 'distracting', processName: 'social.exe', idleSeconds: 0, idleThresholdSeconds: 60, thresholdSeconds: 10, cooldownSeconds: 60 };

describe('distraction engine', () => {
  it('waits for a sustained distracting app during an active focus session', () => {
    const engine = new DistractionEngine();
    expect(engine.evaluate({ ...base, nowMs: 1000 }).shouldRemind).toBe(false);
    expect(engine.evaluate({ ...base, nowMs: 10999 }).shouldRemind).toBe(false);
    expect(engine.evaluate({ ...base, nowMs: 11000 }).shouldRemind).toBe(true);
  });
  it('does not alert while focus is stopped or app is unclassified', () => {
    const engine = new DistractionEngine();
    expect(engine.evaluate({ ...base, focusRunning: false, nowMs: 1000 }).shouldRemind).toBe(false);
    expect(engine.evaluate({ ...base, category: 'unclassified', nowMs: 2000 }).shouldRemind).toBe(false);
  });
  it('enforces the reminder cooldown', () => {
    const engine = new DistractionEngine();
    engine.evaluate({ ...base, nowMs: 1000 });
    expect(engine.evaluate({ ...base, nowMs: 11000 }).shouldRemind).toBe(true);
    expect(engine.evaluate({ ...base, nowMs: 12000 }).shouldRemind).toBe(false);
  });
});
