import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core';

export const projects = sqliteTable('projects', {
  id: text('id').primaryKey(), name: text('name').notNull(), description: text('description').notNull().default(''),
  status: text('status').notNull().default('active'), color: text('color').notNull().default('#D6A84B'),
  createdAt: text('created_at').notNull(), updatedAt: text('updated_at').notNull()
});
export const tasks = sqliteTable('tasks', {
  id: text('id').primaryKey(), title: text('title').notNull(), description: text('description').notNull().default(''),
  projectId: text('project_id'), status: text('status').notNull().default('todo'), priority: text('priority').notNull().default('medium'),
  estimatedMinutes: integer('estimated_minutes'), dueAt: text('due_at'), parentTaskId: text('parent_task_id'), sortOrder: integer('sort_order').notNull().default(0),
  createdAt: text('created_at').notNull(), completedAt: text('completed_at')
});
export const focusSessions = sqliteTable('focus_sessions', {
  id: text('id').primaryKey(), taskId: text('task_id'), taskTitle: text('task_title').notNull(), startedAt: text('started_at').notNull(),
  resumedAt: text('resumed_at'), endedAt: text('ended_at'), plannedMinutes: integer('planned_minutes').notNull(),
  accumulatedSeconds: integer('accumulated_seconds').notNull().default(0), status: text('status').notNull(), workspaceRunId: text('workspace_run_id')
});
export const activitySegments = sqliteTable('activity_segments', {
  id: text('id').primaryKey(), appName: text('app_name').notNull(), windowTitle: text('window_title'), category: text('category').notNull(),
  startedAt: text('started_at').notNull(), endedAt: text('ended_at').notNull(), durationSeconds: integer('duration_seconds').notNull(), focusSessionId: text('focus_session_id')
});
export const idleSegments = sqliteTable('idle_segments', { id: text('id').primaryKey(), startedAt: text('started_at').notNull(), endedAt: text('ended_at').notNull(), durationSeconds: integer('duration_seconds').notNull() });
export const appRules = sqliteTable('app_rules', { appName: text('app_name').primaryKey(), category: text('category').notNull(), updatedAt: text('updated_at').notNull() });
export const distractionEvents = sqliteTable('distraction_events', { id: text('id').primaryKey(), appName: text('app_name').notNull(), createdAt: text('created_at').notNull(), focusSessionId: text('focus_session_id'), message: text('message').notNull() });
export const companionEvents = sqliteTable('companion_events', { id: text('id').primaryKey(), kind: text('kind').notNull(), message: text('message').notNull(), createdAt: text('created_at').notNull() });
export const milestones = sqliteTable('milestones', { code: text('code').primaryKey(), title: text('title').notNull(), description: text('description').notNull(), achievedAt: text('achieved_at').notNull() });
export const userSettings = sqliteTable('user_settings', { key: text('key').primaryKey(), value: text('value').notNull() });
export const workspacePresets = sqliteTable('workspace_presets', { id: text('id').primaryKey(), name: text('name').notNull(), configJson: text('config_json').notNull(), updatedAt: text('updated_at').notNull() });
export const workspaceRuns = sqliteTable('workspace_runs', { id: text('id').primaryKey(), presetId: text('preset_id'), presetName: text('preset_name').notNull(), taskTitle: text('task_title').notNull(), focusMinutes: integer('focus_minutes').notNull(), status: text('status').notNull(), launchResultsJson: text('launch_results_json').notNull(), startedAt: text('started_at').notNull(), completedAt: text('completed_at'), focusSessionId: text('focus_session_id'), configSnapshotJson: text('config_snapshot_json').notNull().default('{}') });
export const workspaceAppRules = sqliteTable('workspace_app_rules', { presetId: text('preset_id').notNull(), appName: text('app_name').notNull(), category: text('category').notNull(), updatedAt: text('updated_at').notNull() });
export const userProfile = sqliteTable('user_profile', {
  id: text('id').primaryKey(), preferredName: text('preferred_name').notNull(), userType: text('user_type').notNull(), currentGoal: text('current_goal').notNull(),
  workingDaysJson: text('working_days_json').notNull(), workStartTime: text('work_start_time').notNull(), workEndTime: text('work_end_time').notNull(),
  breakStartTime: text('break_start_time').notNull(), breakEndTime: text('break_end_time').notNull(), quietStartTime: text('quiet_start_time').notNull(), quietEndTime: text('quiet_end_time').notNull(),
  timezone: text('timezone').notNull(), communicationStyle: text('communication_style').notNull(), interactionFrequency: text('interaction_frequency').notNull(),
  createdAt: text('created_at').notNull(), updatedAt: text('updated_at').notNull()
});
export const moodCheckins = sqliteTable('mood_checkins', { id: text('id').primaryKey(), mood: text('mood').notNull(), energy: integer('energy').notNull(), motivation: integer('motivation').notNull(), supportStyle: text('support_style').notNull(), note: text('note').notNull(), createdAt: text('created_at').notNull() });
export const dailyPlanItems = sqliteTable('daily_plan_items', { date: text('date').notNull(), taskId: text('task_id').notNull(), kind: text('kind').notNull(), sortOrder: integer('sort_order').notNull().default(0), createdAt: text('created_at').notNull() });
export const sessionReflections = sqliteTable('session_reflections', { id: text('id').primaryKey(), sessionId: text('session_id').notNull(), outcome: text('outcome').notNull(), note: text('note').notNull(), createdAt: text('created_at').notNull() });
export const recoveryEvents = sqliteTable('recovery_events', { id: text('id').primaryKey(), focusSessionId: text('focus_session_id'), appName: text('app_name').notNull(), action: text('action').notNull(), outcome: text('outcome').notNull(), createdAt: text('created_at').notNull() });
export const routines = sqliteTable('routines', { id: text('id').primaryKey(), name: text('name').notNull(), description: text('description').notNull().default(''), stepsJson: text('steps_json').notNull(), isBuiltIn: integer('is_built_in').notNull().default(0), createdAt: text('created_at').notNull(), updatedAt: text('updated_at').notNull() });
export const routineRuns = sqliteTable('routine_runs', { id: text('id').primaryKey(), routineId: text('routine_id').notNull(), routineName: text('routine_name').notNull(), stepsJson: text('steps_json').notNull(), currentStepIndex: integer('current_step_index').notNull().default(0), status: text('status').notNull(), startedAt: text('started_at').notNull(), completedAt: text('completed_at') });

export const schema = { projects, tasks, focusSessions, activitySegments, idleSegments, appRules, distractionEvents, companionEvents, milestones, userSettings, workspacePresets, workspaceRuns, workspaceAppRules, userProfile, moodCheckins, dailyPlanItems, sessionReflections, recoveryEvents, routines, routineRuns };
