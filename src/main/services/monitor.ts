import { spawn, type ChildProcess } from 'node:child_process';
import { join } from 'node:path';
import { app } from 'electron';
import { existsSync } from 'node:fs';
import { StringDecoder } from 'node:string_decoder';
import { z } from 'zod';
import type { ActivitySample } from '../../shared/types.js';

const sampleSchema = z.object({ type: z.literal('sample'), timestamp: z.string(), processName: z.string(), windowTitle: z.string(), idleSeconds: z.number().nonnegative() });
export type MonitorStatus = 'stopped' | 'starting' | 'running' | 'unavailable' | 'error';

export class MonitorService {
  private child: ChildProcess | null = null;
  private status: MonitorStatus = 'stopped';
  private decoder = new StringDecoder('utf8');
  private buffer = '';
  private restartTimer: NodeJS.Timeout | null = null;
  private intentionalStop = false;
  private captureWindowTitles = false;

  constructor(private onSample: (sample: ActivitySample) => void, private onStatus: (status: MonitorStatus) => void) {}
  getStatus() { return this.status; }

  start(captureWindowTitles = this.captureWindowTitles) {
    this.captureWindowTitles = captureWindowTitles;
    if (process.platform !== 'win32') { this.setStatus('unavailable'); return; }
    if (this.child) return;
    this.intentionalStop = false;
    this.setStatus('starting');
    let command: string; let args: string[];
    if (app.isPackaged) {
      command = join(process.resourcesPath, 'windows-monitor', 'WindowsMonitor.exe');
      if (!existsSync(command)) { this.setStatus('error'); return; }
      args = ['--interval-ms=1000', `--capture-window-titles=${captureWindowTitles}`];
    } else {
      command = 'dotnet';
      args = ['run', '--no-launch-profile', '--project', join(app.getAppPath(), 'native', 'WindowsMonitor.csproj'), '--', '--interval-ms=1000', `--capture-window-titles=${captureWindowTitles}`];
    }
    try {
      const child = spawn(command, args, { windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] });
      this.child = child;
      child.stdout?.on('data', chunk => { if (this.child === child) this.consume(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)); });
      child.stderr?.on('data', chunk => { const message = String(chunk).trim(); if (message) console.warn('[monitor]', message); });
      child.once('spawn', () => { if (this.child === child && !this.intentionalStop) this.setStatus('running'); });
      child.once('error', error => {
        console.error('Monitor failed to start:', error);
        if (this.child !== child) return;
        this.child = null; this.setStatus('error'); this.scheduleRestart();
      });
      child.once('exit', code => {
        if (this.child !== child) return;
        this.child = null;
        if (!this.intentionalStop) { console.warn(`Monitor exited with code ${code}`); this.setStatus('error'); this.scheduleRestart(); }
      });
    } catch (error) { console.error(error); this.setStatus('error'); }
  }

  stop() {
    this.intentionalStop = true;
    if (this.restartTimer) clearTimeout(this.restartTimer);
    this.restartTimer = null;
    if (this.child) { this.child.kill(); this.child = null; }
    this.buffer = '';
    this.setStatus('stopped');
  }

  private consume(chunk: Buffer) {
    this.buffer += this.decoder.write(chunk);
    let newline: number;
    while ((newline = this.buffer.indexOf('\n')) >= 0) {
      const line = this.buffer.slice(0, newline).trim(); this.buffer = this.buffer.slice(newline + 1);
      if (!line) continue;
      try {
        const parsed = sampleSchema.safeParse(JSON.parse(line));
        if (parsed.success) this.onSample(parsed.data);
      } catch (error) { console.warn('Ignoring malformed monitor line', error); }
    }
  }

  private scheduleRestart() {
    if (this.intentionalStop || this.restartTimer) return;
    this.restartTimer = setTimeout(() => { this.restartTimer = null; this.start(this.captureWindowTitles); }, 5000);
  }

  private setStatus(status: MonitorStatus) { this.status = status; this.onStatus(status); }
}
