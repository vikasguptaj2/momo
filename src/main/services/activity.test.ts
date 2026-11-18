import { describe, expect, it, vi } from 'vitest';
import { ActivityService } from './activity.js';
import type { Storage } from '../database/storage.js';
import type { SettingsService } from './settings.js';
import type { FocusService } from './focus.js';
import type { ActivitySample } from '../../shared/types.js';

function createHarness() {
  const segments: Array<{ appName: string; windowTitle: string | null; category: string; durationSeconds: number }> = [];
  const idleSegments: Array<{ startedAt: string; endedAt: string; durationSeconds: number }> = [];
  const rules = [
    { app_name: 'code.exe', category: 'productive' },
    { app_name: 'instagram.exe', category: 'distracting' }
  ];
  const raw = {
    prepare(sql: string) {
      if (sql.startsWith('SELECT app_name, category FROM app_rules')) return { all: () => rules };
      if (sql.startsWith('INSERT INTO activity_segments')) {
        return { run: (...values: unknown[]) => segments.push({ appName: String(values[1]), windowTitle: values[2] as string | null, category: String(values[3]), durationSeconds: Number(values[6]) }) };
      }
      if (sql.startsWith('INSERT INTO idle_segments')) return { run: (...values: unknown[]) => idleSegments.push({ startedAt: String(values[1]), endedAt: String(values[2]), durationSeconds: Number(values[3]) }) };
      if (sql.startsWith('INSERT INTO distraction_events')) return { run: vi.fn() };
      throw new Error(`Unexpected SQL in activity test: ${sql}`);
    }
  };
  const storage = { raw } as unknown as Storage;
  const settings = {
    get: () => ({ trackingEnabled: true, captureWindowTitles: false, showCompanion: true, distractionThresholdSeconds: 10, reminderCooldownSeconds: 60, idleThresholdSeconds: 60 })
  } as unknown as SettingsService;
  const focus = { current: () => null } as unknown as FocusService;
  const service = new ActivityService(storage, settings, focus, vi.fn(), vi.fn(), vi.fn());
  return { service, segments, idleSegments };
}

function sample(timestamp: number, processName: string, idleSeconds = 0): ActivitySample {
  return { type: 'sample', timestamp: new Date(timestamp).toISOString(), processName, windowTitle: 'Sensitive window title', idleSeconds };
}

describe('activity aggregation', () => {
  it('credits poll intervals to the app observed before a process switch', () => {
    const { service, segments } = createHarness();
    const start = Date.now() - 60_000;
    service.sample(sample(start, 'Code.exe'));
    service.sample(sample(start + 1_000, 'Code.exe'));
    service.sample(sample(start + 2_000, 'Instagram.exe'));
    service.sample(sample(start + 3_000, 'Instagram.exe'));
    service.sample(sample(start + 4_000, 'Instagram.exe', 60));

    expect(segments).toHaveLength(2);
    expect(segments[0]).toMatchObject({ appName: 'code.exe', category: 'productive', durationSeconds: 2 });
    expect(segments[1]).toMatchObject({ appName: 'instagram.exe', category: 'distracting', durationSeconds: 2 });
  });


  it('records extended idle only after the configured threshold is crossed', () => {
    const { service, idleSegments } = createHarness();
    const start = Date.now() - 120_000;
    service.sample(sample(start, 'Code.exe'));
    service.sample(sample(start + 1_000, 'Code.exe'));
    service.sample(sample(start + 61_000, 'Code.exe', 60));
    service.sample(sample(start + 76_000, 'Code.exe', 75));
    service.sample(sample(start + 80_000, 'Code.exe', 0));

    expect(idleSegments.reduce((sum, item) => sum + item.durationSeconds, 0)).toBe(19);
  });

  it('does not persist window titles when title capture is disabled', () => {
    const { service, segments } = createHarness();
    const start = Date.now() - 5_000;
    service.sample(sample(start, 'Code.exe'));
    service.sample(sample(start + 1_000, 'Code.exe'));
    service.sample(sample(start + 2_000, 'Notepad.exe', 60));

    expect(segments[0]?.windowTitle).toBeNull();
  });
});
