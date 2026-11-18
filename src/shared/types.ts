export type AppCategory = 'productive' | 'distracting' | 'unclassified';
export type SessionStatus = 'running' | 'paused' | 'completed' | 'cancelled';
export type WorkspaceScoutMode = 'quiet' | 'encouraging' | 'playful';
export type WorkspaceLaunchStatus = 'ready' | 'missing' | 'not-configured' | 'launched' | 'failed' | 'skipped';
export type UserType = 'developer' | 'student' | 'freelancer' | 'remote-worker' | 'custom';
export type CommunicationStyle = 'gentle' | 'direct' | 'playful' | 'quiet';
export type TaskStatus = 'todo' | 'in_progress' | 'blocked' | 'completed' | 'deferred' | 'cancelled';
export type TaskPriority = 'low' | 'medium' | 'high' | 'urgent';
export type ProjectStatus = 'active' | 'on_hold' | 'completed' | 'archived';
export type MoodValue = 'motivated' | 'calm' | 'overwhelmed' | 'frustrated' | 'tired' | 'unmotivated' | 'distracted';
export type RecoveryAction = 'restart' | 'break' | 'intentional' | 'dismiss' | 'snooze' | 'replan';
export type ReflectionOutcome = 'completed' | 'partial' | 'blocked' | 'no_progress';
export type RoutineStepKind = 'review_missions' | 'workspace' | 'focus' | 'break' | 'reflection';
export type RoutineRunStatus = 'running' | 'completed' | 'cancelled';
export type BreakKind = 'short' | 'long' | 'custom';
export type BreakStatus = 'running' | 'paused' | 'completed' | 'cancelled';

export interface ActivitySample { type: 'sample'; timestamp: string; processName: string; windowTitle: string; idleSeconds: number; }

export interface UserProfile {
  id: string;
  preferredName: string;
  userType: UserType;
  currentGoal: string;
  workingDays: number[];
  workStartTime: string;
  workEndTime: string;
  breakStartTime: string;
  breakEndTime: string;
  quietStartTime: string;
  quietEndTime: string;
  timezone: string;
  communicationStyle: CommunicationStyle;
  interactionFrequency: 'low' | 'normal' | 'high';
  createdAt: string;
  updatedAt: string;
}

export interface ProjectRecord {
  id: string;
  name: string;
  description: string;
  status: ProjectStatus;
  color: string;
  createdAt: string;
  updatedAt: string;
  taskCount?: number;
  completedTaskCount?: number;
}

export interface TaskRecord {
  id: string;
  title: string;
  description?: string;
  projectId?: string | null;
  status?: TaskStatus;
  priority?: TaskPriority;
  estimatedMinutes?: number | null;
  dueAt?: string | null;
  parentTaskId?: string | null;
  sortOrder?: number;
  createdAt: string;
  completedAt: string | null;
}

export interface DailyPlanItem { taskId: string; title: string; status: TaskStatus; priority: TaskPriority; kind: 'primary' | 'mission'; sortOrder: number; estimatedMinutes: number | null; }
export interface DailyPlan { date: string; primaryTaskId: string | null; items: DailyPlanItem[]; updatedAt: string | null; }

export interface MoodCheckin {
  id: string;
  mood: MoodValue;
  energy: number;
  motivation: number;
  supportStyle: CommunicationStyle;
  note: string;
  createdAt: string;
}

export interface SessionReflection {
  id: string;
  sessionId: string;
  outcome: ReflectionOutcome;
  note: string;
  createdAt: string;
}

export interface RecoveryEvent {
  id: string;
  focusSessionId: string | null;
  appName: string;
  action: RecoveryAction;
  outcome: string;
  createdAt: string;
}

export interface RoutineStep { id: string; kind: RoutineStepKind; title: string; durationMinutes: number | null; workspacePresetId?: string | null; }
export interface RoutineRecord { id: string; name: string; description: string; steps: RoutineStep[]; isBuiltIn: boolean; createdAt: string; updatedAt: string; }
export interface RoutineRun { id: string; routineId: string; routineName: string; steps: RoutineStep[]; currentStepIndex: number; status: RoutineRunStatus; startedAt: string; completedAt: string | null; }
export interface WorkspaceRunHistoryItem { id: string; presetId: string | null; presetName: string; taskTitle: string; focusMinutes: number; status: 'preparing' | 'running' | 'completed' | 'cancelled' | 'failed'; launchResults: WorkspaceLaunchResult[]; configSnapshot: WorkspaceConfig | null; startedAt: string; completedAt: string | null; focusSessionId: string | null; }
export interface CreateRoutineInput { name: string; description?: string; steps: RoutineStep[]; }

export interface BreakSession {
  id: string;
  focusSessionId: string | null;
  kind: BreakKind;
  plannedMinutes: number;
  startedAt: string;
  resumedAt: string | null;
  endedAt: string | null;
  accumulatedSeconds: number;
  status: BreakStatus;
}

export interface FocusSession {
  id: string;
  taskId: string | null;
  taskTitle: string;
  startedAt: string;
  resumedAt: string | null;
  endedAt: string | null;
  plannedMinutes: number;
  accumulatedSeconds: number;
  status: SessionStatus;
  workspaceRunId?: string | null;
}

export interface AppRule { appName: string; category: AppCategory; updatedAt: string; }
export interface ActivityItem { id: string; appName: string; windowTitle: string | null; category: AppCategory; startedAt: string; endedAt: string; durationSeconds: number; }
export interface MilestoneItem { code: string; title: string; description: string; target: number; progress: number; achievedAt: string | null; }

export interface DashboardData {
  tasks: TaskRecord[];
  activeSession: FocusSession | null;
  activeBreak: BreakSession | null;
  today: { totalActiveSeconds: number; productiveSeconds: number; distractingSeconds: number; unclassifiedSeconds: number; idleSeconds: number; focusSeconds: number; sessionCount: number };
  recentActivity: ActivityItem[];
  rules: AppRule[];
  milestones: MilestoneItem[];
  trackingEnabled: boolean;
  monitorStatus: 'stopped' | 'starting' | 'running' | 'unavailable' | 'error';
  profile: UserProfile;
  todayPlan: DailyPlan;
  projects: ProjectRecord[];
  lastMood: MoodCheckin | null;
}

export interface DailyReport {
  date: string;
  totalActiveSeconds: number;
  idleSeconds: number;
  productiveSeconds: number;
  distractingSeconds: number;
  unclassifiedSeconds: number;
  focusSeconds: number;
  sessionCount: number;
  completedSessions: number;
  distractionCount: number;
  topApps: Array<{ appName: string; durationSeconds: number; category: AppCategory }>;
  plannedMissions: number;
  completedMissions: number;
  recoveryPrompts: number;
  successfulRecoveries: number;
  taskOutcomes: { completed: number; partial: number; blocked: number; noProgress: number };
  breakSeconds: number;
  completedBreaks: number;
}

export interface WorkspaceConfig {
  id?: string;
  name: string;
  kind?: 'coding' | 'study' | 'writing' | 'design' | 'deep-work' | 'freelance' | 'custom';
  intentionTemplate: string;
  focusMinutes: number;
  breakMinutes: number;
  longBreakMinutes: number;
  longBreakEvery: number;
  idePath: string;
  projectPath: string;
  terminalPath: string;
  docsUrl: string;
  scoutMode: WorkspaceScoutMode;
}
export interface WorkspacePreset extends WorkspaceConfig { id: string; updatedAt: string; appRules?: AppRule[]; }
export interface WorkspacePreviewItem { id: 'ide' | 'project' | 'terminal' | 'docs'; label: string; detail: string; required: boolean; status: WorkspaceLaunchStatus; message?: string; }
export interface WorkspacePreview { ready: boolean; hasActiveSession: boolean; hasActiveBreak: boolean; trackingEnabled: boolean; focusMinutes: number; intention: string; scoutMode: WorkspaceScoutMode; items: WorkspacePreviewItem[]; blockingIssues: string[]; }
export interface WorkspaceLaunchResult { id: 'ide' | 'project' | 'terminal' | 'docs'; label: string; status: 'launched' | 'failed' | 'skipped'; message: string; }
export interface WorkspaceStartResult { started: boolean; runId: string; focusSession: FocusSession | null; launchResults: WorkspaceLaunchResult[]; message: string; }

export interface UserSettings {
  onboardingCompleted: boolean;
  trackingEnabled: boolean;
  captureWindowTitles: boolean;
  showCompanion: boolean;
  distractionThresholdSeconds: number;
  reminderCooldownSeconds: number;
  idleThresholdSeconds: number;
}

export interface CompanionEvent {
  kind: 'focus' | 'productive' | 'distraction' | 'idle' | 'complete' | 'timer' | 'break' | 'welcome' | 'checkin' | 'recovery';
  message: string;
  createdAt: string;
  workspaceMode?: WorkspaceScoutMode;
  appName?: string;
  canRecover?: boolean;
}

export interface CreateTaskInput {
  title: string;
  description?: string;
  projectId?: string | null;
  priority?: TaskPriority;
  estimatedMinutes?: number | null;
  dueAt?: string | null;
  parentTaskId?: string | null;
}
export interface UpdateTaskInput extends Partial<CreateTaskInput> { id: string; status?: TaskStatus; }
export interface CreateProjectInput { name: string; description?: string; color?: string; }
export interface UpdateProjectInput extends Partial<CreateProjectInput> { id: string; status?: ProjectStatus; }
export interface SaveDailyPlanInput { date: string; primaryTaskId: string | null; taskIds: string[]; }
export interface SaveMoodCheckinInput { mood: MoodValue; energy: number; motivation: number; supportStyle: CommunicationStyle; note?: string; }
export interface SaveReflectionInput { sessionId: string; outcome: ReflectionOutcome; note?: string; }
export interface RecoveryResponseInput { action: RecoveryAction; appName?: string; }
export interface StartFocusInput { taskId?: string | null; taskTitle: string; plannedMinutes: number; workspaceRunId?: string | null; }
export interface SaveRuleInput { appName: string; category: AppCategory; }

export interface P1JournalInput { kind: 'reflection'|'memory'|'achievement'|'note'|'conversation'; title: string; body?: string; tags?: string[]; }
export interface P1RitualInput { id?: string; name: string; ritualType: 'morning'|'work'|'evening'|'custom'; timeOfDay?: string; steps: string[]; enabled?: boolean; }
export interface P1State { preferences: Record<string, unknown>; journal: Array<{id:string;kind:string;title:string;body:string;created_at:string;pinned:number}>; rituals: Array<{id:string;name:string;ritual_type:string;enabled:number;time_of_day:string;steps_json:string;last_completed_at:string|null}>; unlocks: Array<{code:string;category:string;title:string;description:string;unlocked_at:string}>; completions: Array<{id:string;ritual_id:string;completed_at:string;note:string}>; weekly: {from:string;to:string;focusSessions:number;focusSeconds:number;completedSessions:number;missionsCompleted:number;missionsTouched:number;recoveryPrompts:number;successfulReturns:number;ritualsCompleted:number}; }
export interface CysApi {
  p1GetState(): Promise<P1State>;
  p1SavePreference(key:string,value:unknown): Promise<P1State>;
  p1AddJournal(input:P1JournalInput): Promise<unknown>;
  p1DeleteJournal(id:string): Promise<P1State>;
  p1PinJournal(id:string,pinned:boolean): Promise<P1State>;
  p1SaveRitual(input:P1RitualInput): Promise<P1State>;
  p1CompleteRitual(id:string,note?:string): Promise<P1State>;
  p1Unlock(code:string): Promise<P1State>;
  p1WeeklyReview(): Promise<P1State['weekly']>;
  getDashboard(): Promise<DashboardData>;
  getWorkspaceConfig(id?: string): Promise<WorkspaceConfig>;
  listWorkspacePresets(): Promise<WorkspacePreset[]>;
  createWorkspacePreset(kind: NonNullable<WorkspaceConfig['kind']>): Promise<WorkspacePreset>;
  deleteWorkspacePreset(id: string): Promise<void>;
  saveWorkspaceConfig(input: WorkspaceConfig): Promise<WorkspaceConfig>;
  saveWorkspaceAppRule(input: { presetId: string; appName: string; category: AppCategory }): Promise<void>;
  deleteWorkspaceAppRule(input: { presetId: string; appName: string }): Promise<void>;
  getWorkspaceAppRules(presetId: string): Promise<AppRule[]>;
  pickWorkspaceExecutable(): Promise<string | null>;
  pickWorkspaceFolder(): Promise<string | null>;
  previewWorkspace(input: WorkspaceConfig): Promise<WorkspacePreview>;
  startWorkspace(input: WorkspaceConfig): Promise<WorkspaceStartResult>;
  listWorkspaceRuns(limit?: number): Promise<WorkspaceRunHistoryItem[]>;
  tasksList(options?: { projectId?: string; status?: TaskStatus; limit?: number }): Promise<TaskRecord[]>;
  createTask(input: CreateTaskInput): Promise<TaskRecord>;
  updateTask(input: UpdateTaskInput): Promise<TaskRecord>;
  deleteTask(taskId: string): Promise<void>;
  completeTask(taskId: string): Promise<void>;
  listProjects(includeArchived?: boolean): Promise<ProjectRecord[]>;
  createProject(input: CreateProjectInput): Promise<ProjectRecord>;
  updateProject(input: UpdateProjectInput): Promise<ProjectRecord>;
  deleteProject(projectId: string): Promise<void>;
  getDailyPlan(date?: string): Promise<DailyPlan>;
  saveDailyPlan(input: SaveDailyPlanInput): Promise<DailyPlan>;
  carryForwardDailyPlan(fromDate: string, toDate?: string): Promise<DailyPlan>;
  getProfile(): Promise<UserProfile>;
  saveProfile(input: Partial<UserProfile>): Promise<UserProfile>;
  createMoodCheckin(input: SaveMoodCheckinInput): Promise<MoodCheckin>;
  getMoodHistory(limit?: number): Promise<MoodCheckin[]>;
  saveSessionReflection(input: SaveReflectionInput): Promise<SessionReflection>;
  getSessionReflection(sessionId: string): Promise<SessionReflection | null>;
  recordRecovery(input: RecoveryResponseInput): Promise<RecoveryEvent>;
  getRecoverySummary(date?: string): Promise<{ prompts: number; returned: number; breaks: number; dismissed: number }>;
  startFocus(input: StartFocusInput): Promise<FocusSession>;
  startBreak(input: { plannedMinutes: number; kind?: BreakKind }): Promise<BreakSession>;
  pauseBreak(): Promise<BreakSession>;
  resumeBreak(): Promise<BreakSession>;
  endBreak(completed: boolean): Promise<BreakSession>;
  pauseFocus(): Promise<FocusSession>;
  resumeFocus(): Promise<FocusSession>;
  endFocus(completed: boolean): Promise<FocusSession>;
  extendFocus(minutes: number): Promise<FocusSession>;
  setTracking(enabled: boolean): Promise<boolean>;
  saveRule(input: SaveRuleInput): Promise<AppRule>;
  deleteRule(appName: string): Promise<void>;
  getReport(date?: string): Promise<DailyReport>;
  getSettings(): Promise<UserSettings>;
  updateSettings(patch: Partial<UserSettings>): Promise<UserSettings>;
  deleteHistory(): Promise<void>;
  exportData(): Promise<string | null>;
  routinesList(): Promise<RoutineRecord[]>;
  createRoutine(input: CreateRoutineInput): Promise<RoutineRecord>;
  deleteRoutine(id: string): Promise<void>;
  startRoutine(id: string): Promise<RoutineRun>;
  getActiveRoutine(): Promise<RoutineRun | null>;
  completeRoutineStep(): Promise<RoutineRun | null>;
  cancelRoutine(): Promise<void>;
  routinesHistory(limit?: number): Promise<RoutineRun[]>;
  openCompanion(): Promise<void>;
  companionAction(action: 'start-short-focus' | 'take-break' | 'resume-focus' | 'celebrate' | 'motivate' | 'open-dashboard'): Promise<void>;
  onDashboardUpdated(callback: () => void): () => void;
  onCompanionEvent(callback: (event: CompanionEvent) => void): () => void;
  onMonitorStatus(callback: (status: DashboardData['monitorStatus']) => void): () => void;
}

declare global { interface Window { cys: CysApi } }
