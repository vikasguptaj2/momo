import React, { useEffect, useState } from 'react';
import ReactDOM from 'react-dom/client';
import type { CompanionEvent } from '../shared/types.js';
import './styles.css';
import './companion.css';

const moodFor = (kind: CompanionEvent['kind']) => {
  if (kind === 'distraction') return 'concerned';
  if (kind === 'complete') return 'celebrating';
  if (kind === 'timer') return 'focused';
  if (kind === 'idle' || kind === 'break') return 'resting';
  if (kind === 'focus') return 'focused';
  if (kind === 'productive' || kind === 'recovery' || kind === 'checkin') return 'encouraging';
  return 'happy';
};

const titleFor = (kind: CompanionEvent['kind']) => ({
  focus: 'Focus mode, activated!',
  productive: 'Nice work. Keep going!',
  distraction: 'A gentle nudge',
  idle: 'Taking a little breather?',
  complete: 'You did it!',
  timer: 'Your planned time is up.',
  break: 'Rest is part of progress.',
  recovery: 'Good to have you back.',
  checkin: 'Thanks for checking in.',
  welcome: 'Scout is by your side.'
})[kind];

function Companion() {
  const [event, setEvent] = useState<CompanionEvent>({ kind: 'welcome', message: 'I am here. One small step at a time.', createdAt: new Date().toISOString() });
  const [busy, setBusy] = useState(false);
  const [actionMessage, setActionMessage] = useState('');
  useEffect(() => window.cys.onCompanionEvent(setEvent), []);
  const act = async (action: Parameters<typeof window.cys.companionAction>[0]) => { setBusy(true); setActionMessage(''); try { await window.cys.companionAction(action); } catch (error) { setActionMessage(error instanceof Error ? error.message : 'Could not complete that action.'); } finally { setBusy(false); } };
  const mood = moodFor(event.kind);
  const modeLabel = event.workspaceMode === 'playful' ? 'PLAYFUL SIDEKICK' : event.workspaceMode === 'encouraging' ? 'HERE TO CHEER YOU ON' : 'QUIET COMPANION';
  return <main className="companion-shell">
    <div className={`companion-card scout-companion-card ${event.kind} mode-${event.workspaceMode ?? 'quiet'}`}>
      <div className="companion-drag"/>
      <div className="companion-topline"><span><b>🐾</b> SCOUT · YOUR SIDEKICK</span><button className="companion-close" onClick={() => window.close()} aria-label="Close companion">×</button></div>
      <div className="companion-main">
        <img className="companion-scout-image" src={`./assets/scout-${mood}.jpg`} alt={`Scout looking ${mood}`}/>
        <div className="companion-copy"><strong>{titleFor(event.kind)}</strong><p>{event.message}</p></div>
      </div>
      {event.kind === 'distraction' && <div className="companion-recovery-actions"><button disabled={busy} onClick={() => void act('resume-focus')}>Back to work</button><button disabled={busy} onClick={() => void act('take-break')}>Take a break</button><button disabled={busy} onClick={() => void window.cys.recordRecovery({action:'intentional', appName:event.appName ?? ''})}>Intentional</button></div>}
      <div className="companion-quick-actions"><button disabled={busy} onClick={() => void act('start-short-focus')}>Start 25 min</button><button disabled={busy} onClick={() => void act('motivate')}>Motivate me</button><button disabled={busy} onClick={() => void act('open-dashboard')}>Open app</button></div>
      {actionMessage && <div className="companion-action-message">{actionMessage}</div>}
      <div className="companion-foot"><span>{modeLabel} · YOUR PERSONAL ACCOUNTABILITY PARTNER</span><b>✦</b></div>
    </div>
  </main>;
}

ReactDOM.createRoot(document.getElementById('root')!).render(<React.StrictMode><Companion /></React.StrictMode>);
