import { z } from 'zod';

export const taskInputSchema = z.object({
  title: z.string().trim().min(1).max(160), description: z.string().max(2000).optional(),
  projectId: z.string().uuid().nullable().optional(), priority: z.enum(['low', 'medium', 'high', 'urgent']).optional(),
  estimatedMinutes: z.number().int().min(1).max(10080).nullable().optional(), dueAt: z.string().datetime().nullable().optional(),
  parentTaskId: z.string().uuid().nullable().optional()
}).strict();
export const taskUpdateSchema = taskInputSchema.partial().extend({ id: z.string().uuid(), status: z.enum(['todo', 'in_progress', 'blocked', 'completed', 'deferred', 'cancelled']).optional() }).strict();
export const projectInputSchema = z.object({ name: z.string().trim().min(1).max(120), description: z.string().max(2000).optional(), color: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional() }).strict();
export const projectUpdateSchema = projectInputSchema.partial().extend({ id: z.string().uuid(), status: z.enum(['active', 'on_hold', 'completed', 'archived']).optional() }).strict();
export const dailyPlanSchema = z.object({ date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/), primaryTaskId: z.string().uuid().nullable(), taskIds: z.array(z.string().uuid()).max(30) }).strict();
export const profileSchema = z.object({
  preferredName: z.string().trim().min(1).max(60), userType: z.enum(['developer', 'student', 'freelancer', 'remote-worker', 'custom']), currentGoal: z.string().max(240),
  workingDays: z.array(z.number().int().min(0).max(6)).max(7), workStartTime: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/), workEndTime: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/),
  breakStartTime: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/), breakEndTime: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/), quietStartTime: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/), quietEndTime: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/),
  timezone: z.string().min(1).max(80), communicationStyle: z.enum(['gentle', 'direct', 'playful', 'quiet']), interactionFrequency: z.enum(['low', 'normal', 'high'])
}).strict();
export const moodCheckinSchema = z.object({ mood: z.enum(['motivated', 'calm', 'overwhelmed', 'frustrated', 'tired', 'unmotivated', 'distracted']), energy: z.number().int().min(1).max(5), motivation: z.number().int().min(1).max(5), supportStyle: z.enum(['gentle', 'direct', 'playful', 'quiet']), note: z.string().max(1000).optional() }).strict();
export const reflectionSchema = z.object({ sessionId: z.string().uuid(), outcome: z.enum(['completed', 'partial', 'blocked', 'no_progress']), note: z.string().max(2000).optional() }).strict();
export const recoveryResponseSchema = z.object({ action: z.enum(['restart', 'break', 'intentional', 'dismiss', 'snooze', 'replan']), appName: z.string().max(120).optional() }).strict();
export const startFocusSchema = z.object({ taskId: z.string().uuid().nullable().optional(), taskTitle: z.string().trim().min(1).max(160), plannedMinutes: z.number().int().min(1).max(240), workspaceRunId: z.string().uuid().nullable().optional() }).strict();
export const ruleInputSchema = z.object({ appName: z.string().trim().min(1).max(100), category: z.enum(['productive', 'distracting', 'unclassified']) }).strict();
export const settingPatchSchema = z.object({ onboardingCompleted: z.boolean().optional(), trackingEnabled: z.boolean().optional(), captureWindowTitles: z.boolean().optional(), showCompanion: z.boolean().optional(), distractionThresholdSeconds: z.number().int().min(5).max(300).optional(), reminderCooldownSeconds: z.number().int().min(15).max(3600).optional(), idleThresholdSeconds: z.number().int().min(15).max(600).optional() }).strict();
export const workspaceConfigSchema = z.object({ id: z.string().max(80).optional(), name: z.string().trim().min(1).max(80), kind: z.enum(['coding', 'study', 'writing', 'design', 'deep-work', 'freelance', 'custom']).optional(), intentionTemplate: z.string().trim().min(1).max(160), focusMinutes: z.number().int().min(5).max(240), breakMinutes: z.number().int().min(1).max(60), longBreakMinutes: z.number().int().min(1).max(60), longBreakEvery: z.number().int().min(2).max(8), idePath: z.string().max(2048), projectPath: z.string().max(2048), terminalPath: z.string().max(2048), docsUrl: z.string().max(2048), scoutMode: z.enum(['quiet', 'encouraging', 'playful']) }).strict();

export const routineInputSchema = z.object({ name: z.string().trim().min(1).max(100), description: z.string().max(1000).optional(), steps: z.array(z.object({ id: z.string().min(1).max(80), kind: z.enum(['review_missions','workspace','focus','break','reflection']), title: z.string().trim().min(1).max(120), durationMinutes: z.number().int().min(1).max(240).nullable(), workspacePresetId: z.string().max(80).nullable().optional() }).strict()).min(1).max(12) }).strict();

export const focusExtendSchema = z.number().int().min(5).max(60);

export const breakStartSchema = z.object({ plannedMinutes: z.number().int().min(1).max(60), kind: z.enum(['short', 'long', 'custom']).optional() }).strict();
