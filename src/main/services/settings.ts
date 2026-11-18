import type { UserSettings } from '../../shared/types.js';
import type { Storage } from '../database/storage.js';

const defaults: UserSettings = {
  onboardingCompleted: false, trackingEnabled: false, captureWindowTitles: false, showCompanion: true,
  distractionThresholdSeconds: 10, reminderCooldownSeconds: 60, idleThresholdSeconds: 60
};

export class SettingsService {
  constructor(private storage: Storage) {}

  get(): UserSettings {
    const rows = this.storage.raw.prepare('SELECT key, value FROM user_settings').all() as Array<{ key: string; value: string }>;
    const result: Record<string, unknown> = { ...defaults };
    for (const row of rows) {
      try { result[row.key] = JSON.parse(row.value); } catch { /* ignore malformed local preference */ }
    }
    // Local preferences may be stale or malformed after an app update.
    // Reconstruct the typed settings object and fall back to safe defaults.
    return {
      onboardingCompleted: typeof result.onboardingCompleted === 'boolean' ? result.onboardingCompleted : defaults.onboardingCompleted,
      trackingEnabled: typeof result.trackingEnabled === 'boolean' ? result.trackingEnabled : defaults.trackingEnabled,
      captureWindowTitles: typeof result.captureWindowTitles === 'boolean' ? result.captureWindowTitles : defaults.captureWindowTitles,
      showCompanion: typeof result.showCompanion === 'boolean' ? result.showCompanion : defaults.showCompanion,
      distractionThresholdSeconds: typeof result.distractionThresholdSeconds === 'number' && Number.isFinite(result.distractionThresholdSeconds)
        ? result.distractionThresholdSeconds : defaults.distractionThresholdSeconds,
      reminderCooldownSeconds: typeof result.reminderCooldownSeconds === 'number' && Number.isFinite(result.reminderCooldownSeconds)
        ? result.reminderCooldownSeconds : defaults.reminderCooldownSeconds,
      idleThresholdSeconds: typeof result.idleThresholdSeconds === 'number' && Number.isFinite(result.idleThresholdSeconds)
        ? result.idleThresholdSeconds : defaults.idleThresholdSeconds
    };
  }

  update(patch: Partial<UserSettings>): UserSettings {
    const merged = { ...this.get(), ...patch };
    const statement = this.storage.raw.prepare('INSERT INTO user_settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value=excluded.value');
    for (const [key, value] of Object.entries(merged)) statement.run(key, JSON.stringify(value));
    return merged;
  }
}
