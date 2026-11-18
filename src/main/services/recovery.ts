import type { FocusService } from './focus.js';
import type { ProductivityService } from './productivity.js';
import type { CompanionService } from './companion.js';
import type { RecoveryAction } from '../../shared/types.js';
import type { BreakService } from './breaks.js';

export class RecoveryService {
  constructor(
    private productivity: ProductivityService,
    private focus: FocusService,
    private companion: CompanionService,
    private onRefresh: () => void,
    private snoozeDistractions: (minutes: number) => void,
    private ignoreAppUntilSwitch: (appName: string) => void,
    private breaks: BreakService
  ) {}

  respond(action: RecoveryAction, appName = '') {
    if (action === 'break' && this.breaks.current()) throw new Error('A break is already active. Finish it before starting another.');
    const session = this.focus.current();
    const event = this.productivity.recordRecovery({ action, appName }, session?.id ?? null);
    if (action === 'break') {
      this.breaks.start(10, 'short');
    } else if (action === 'restart') {
      if (this.breaks.current()) this.breaks.end(false);
      if (session?.status === 'paused') this.focus.resume();
      this.companion.emit('recovery', 'Welcome back. Let us take the next small step together.');
    } else if (action === 'intentional') {
      if (appName) this.ignoreAppUntilSwitch(appName);
      this.companion.emit('recovery', 'Got it. You know what you are doing. I will stay out of the way.');
    } else if (action === 'replan') {
      this.companion.emit('recovery', 'It is okay to adjust the plan. Choose a smaller next step when you are ready.');
    } else if (action === 'snooze') {
      this.snoozeDistractions(10);
      this.companion.emit('recovery', 'I will give you ten quiet minutes.');
    } else {
      this.companion.emit('recovery', 'No pressure. I am here when you need me.');
    }
    this.onRefresh();
    return event;
  }
}
