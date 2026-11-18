import type { AppCategory } from '../../shared/types.js';

export function normalizeProcessName(value: string): string {
  const trimmed = value.trim();
  if (!trimmed) return 'unknown';
  const normalized = trimmed.toLowerCase();
  return normalized;
}

export function classifyApplication(processName: string, rules: Map<string, AppCategory>): AppCategory {
  const normalized = normalizeProcessName(processName);
  const match = rules.get(normalized) ?? rules.get(normalized.replace(/\.exe$/i, ''));
  return match ?? 'unclassified';
}
