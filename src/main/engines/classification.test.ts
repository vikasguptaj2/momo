import { describe, expect, it } from 'vitest';
import { classifyApplication, normalizeProcessName } from './classification.js';

describe('application classification', () => {
  it('normalizes executable names case-insensitively', () => {
    expect(normalizeProcessName(' Code.EXE ')).toBe('code.exe');
  });
  it('uses the user rule and leaves unknown apps unclassified', () => {
    const rules = new Map([['code.exe', 'productive' as const], ['instagram.exe', 'distracting' as const]]);
    expect(classifyApplication('CODE.EXE', rules)).toBe('productive');
    expect(classifyApplication('Instagram.exe', rules)).toBe('distracting');
    expect(classifyApplication('chrome.exe', rules)).toBe('unclassified');
  });
});
