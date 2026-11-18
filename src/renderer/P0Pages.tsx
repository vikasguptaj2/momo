import React, { useEffect, useMemo, useState } from 'react';
import { ArrowRight, BookOpen, BriefcaseBusiness, Check, CheckCircle2, Circle, Clock3, FolderKanban, Plus, Save, ShieldCheck, Sparkles, Trash2, UserRound, Zap } from 'lucide-react';
import type { CommunicationStyle, DailyPlan, MoodCheckin, MoodValue, ProjectRecord, RoutineRecord, RoutineRun, RoutineStep, RoutineStepKind, TaskPriority, TaskRecord, TaskStatus, UserProfile, FocusSession, UpdateTaskInput, UpdateProjectInput, BreakSession } from '../shared/types.js';

const localDate = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`; };
const fmtMinutes = (value: number | null | undefined) => value ? `${value} min` : 'No estimate';

export function MissionsPage() {
  const [tasks, setTasks] = useState<TaskRecord[]>([]);
  const [editingTask, setEditingTask] = useState<TaskRecord | null>(null);
  const [editingProject, setEditingProject] = useState<ProjectRecord | null>(null);
  const [projects, setProjects] = useState<ProjectRecord[]>([]);
  const [plan, setPlan] = useState<DailyPlan | null>(null);
  const [tab, setTab] = useState<'missions'|'tasks'|'projects'>('missions');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [projectId, setProjectId] = useState('');
  const [priority, setPriority] = useState<TaskPriority>('medium');
  const [estimatedMinutes, setEstimatedMinutes] = useState('30');
  const [dueDate, setDueDate] = useState('');
  const [projectName, setProjectName] = useState('');
  const [projectDescription, setProjectDescription] = useState('');
  const [primaryTaskId, setPrimaryTaskId] = useState<string | null>(null);
  const [subtaskFor, setSubtaskFor] = useState<string | null>(null);
  const [subtaskTitle, setSubtaskTitle] = useState('');
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const refresh = async () => {
    const [nextTasks, nextProjects, nextPlan] = await Promise.all([window.cys.tasksList({ limit: 200 }), window.cys.listProjects(true), window.cys.getDailyPlan(localDate())]);
    setTasks(nextTasks); setProjects(nextProjects); setPlan(nextPlan); setPrimaryTaskId(nextPlan.primaryTaskId); setSelectedIds(nextPlan.items.map(item => item.taskId));
  };
  useEffect(() => { void refresh().catch(e => setError(e instanceof Error ? e.message : 'Could not load missions.')); }, []);
  const activeTasks = useMemo(() => tasks.filter(task => !['completed','cancelled'].includes(task.status ?? 'todo')), [tasks]);
  const completedCount = plan?.items.filter(item => item.status === 'completed').length ?? 0;
  const perform = async (fn: () => Promise<unknown>) => { setBusy(true); setError(''); try { await fn(); await refresh(); } catch (e) { setError(e instanceof Error ? e.message : 'The action could not be completed.'); } finally { setBusy(false); } };
  const createTask = (event: React.FormEvent) => { event.preventDefault(); if (!title.trim()) return; void perform(async () => { await window.cys.createTask({ title: title.trim(), description: description.trim(), projectId: projectId || null, priority, estimatedMinutes: estimatedMinutes ? Number(estimatedMinutes) : null, dueAt: dueDate ? new Date(`${dueDate}T23:59:00`).toISOString() : null }); setTitle(''); setDescription(''); setDueDate(''); }); };
  const toggleMission = (id: string) => {
    const isSelected = selectedIds.includes(id);
    if (!isSelected && selectedIds.length >= 30) {
      setError('A daily plan can contain at most 30 tasks. Remove a mission before adding another.');
      return;
    }
    const next = isSelected ? selectedIds.filter(x => x !== id) : [...selectedIds, id];
    setSelectedIds(next);
    if (isSelected && primaryTaskId === id) setPrimaryTaskId(null);
    setError('');
  };
  const carryForward = () => { const yesterday = new Date(); yesterday.setDate(yesterday.getDate() - 1); const fromDate = `${yesterday.getFullYear()}-${String(yesterday.getMonth()+1).padStart(2,'0')}-${String(yesterday.getDate()).padStart(2,'0')}`; void perform(() => window.cys.carryForwardDailyPlan(fromDate, localDate())); };
  const createSubtask = (parent: TaskRecord) => { if (!subtaskTitle.trim()) return; void perform(async () => { await window.cys.createTask({ title: subtaskTitle.trim(), projectId: parent.projectId ?? null, parentTaskId: parent.id, priority: parent.priority ?? 'medium' }); setSubtaskTitle(''); setSubtaskFor(null); }); };
  const savePlan = () => void perform(async () => { await window.cys.saveDailyPlan({ date: localDate(), primaryTaskId, taskIds: selectedIds }); });

  return <div className="page-content p0-page">
    <div className="page-heading"><div><div className="eyebrow">PLAN WITH SCOUT</div><h1>Make a plan worth showing up for.</h1><p>Turn projects into small, finishable missions. Choose one primary outcome for today.</p></div><div className="p0-heading-art"><img src="./assets/scout-hero.jpg" alt="Scout"/></div></div>
    {error && <div className="error-banner">{error}<button onClick={() => setError('')}>×</button></div>}
    <div className="p0-tabs"><button className={tab==='missions'?'active':''} onClick={()=>setTab('missions')}>Daily missions</button><button className={tab==='tasks'?'active':''} onClick={()=>setTab('tasks')}>Task library</button><button className={tab==='projects'?'active':''} onClick={()=>setTab('projects')}>Projects</button></div>
    {tab === 'missions' && <>
      <section className="panel p0-panel"><div className="p0-panel-head"><div><div className="eyebrow">TODAY'S PLAN · {new Date().toLocaleDateString(undefined,{weekday:'long',month:'long',day:'numeric'})}</div><h3>Your important outcomes</h3></div><div className="p0-header-actions"><button className="button button-light" onClick={carryForward} disabled={busy}>Carry forward unfinished</button><div className="p0-count">{completedCount}/{plan?.items.length ?? 0} done</div></div></div>
        <div className="p0-progress"><i style={{width:`${plan?.items.length ? completedCount/plan.items.length*100 : 0}%`}}/></div>
        <div className="mission-list">
          {activeTasks.map(task => <div className={`mission-choice ${selectedIds.includes(task.id)?'selected':''}`} key={task.id}>
            <button className="mission-check" onClick={()=>toggleMission(task.id)} aria-label={selectedIds.includes(task.id)?'Remove from today':'Add to today'}>{selectedIds.includes(task.id)?<CheckCircle2 size={18}/>:<Circle size={18}/>}</button>
            <div className="mission-task-copy"><strong>{task.title}</strong><span>{task.projectId ? projects.find(p=>p.id===task.projectId)?.name ?? 'Project' : 'Personal task'} · {fmtMinutes(task.estimatedMinutes)}</span></div>
            <select aria-label="Set primary mission" value={primaryTaskId===task.id?'primary':'normal'} onChange={e=>setPrimaryTaskId(e.target.value==='primary'?task.id:primaryTaskId===task.id?null:primaryTaskId)}><option value="normal">Additional</option><option value="primary">Primary mission</option></select>
          </div>)}
          {!activeTasks.length && <p className="small-muted">Create a task in your library, then add it to today's plan.</p>}
        </div>
        {(plan?.items.filter(item => item.status === 'completed').length ?? 0) > 0 && <div className="completed-missions"><div className="eyebrow">COMPLETED TODAY</div>{plan?.items.filter(item => item.status === 'completed').map(item => <div className="completed-mission-row" key={item.taskId}><CheckCircle2 size={15}/><span>{item.title}</span></div>)}</div>}
        <div className="p0-actions"><span className="small-muted">Choose up to 30 tasks. A primary mission is optional.</span><button className="button button-dark" onClick={savePlan} disabled={busy}><Save size={15}/> Save today's plan</button></div>
      </section>
      <section className="panel p0-panel"><div className="eyebrow">QUICK ADD</div><h3>Add a mission without leaving today's plan</h3>
        <form className="p0-form-grid" onSubmit={createTask}><label>Task title<input value={title} onChange={e=>setTitle(e.target.value)} placeholder="e.g. Finish the login flow" maxLength={160}/></label><label>Project<select value={projectId} onChange={e=>setProjectId(e.target.value)}><option value="">Personal / no project</option>{projects.filter(p=>p.status==='active').map(p=><option key={p.id} value={p.id}>{p.name}</option>)}</select></label><label>Priority<select value={priority} onChange={e=>setPriority(e.target.value as TaskPriority)}><option value="low">Low</option><option value="medium">Medium</option><option value="high">High</option><option value="urgent">Urgent</option></select></label><label>Estimate<select value={estimatedMinutes} onChange={e=>setEstimatedMinutes(e.target.value)}><option value="15">15 minutes</option><option value="30">30 minutes</option><option value="50">50 minutes</option><option value="60">1 hour</option><option value="90">90 minutes</option><option value="120">2 hours</option></select></label><label>Due date<input type="date" value={dueDate} onChange={e=>setDueDate(e.target.value)}/></label><label className="p0-wide">Description<textarea rows={2} value={description} onChange={e=>setDescription(e.target.value)} placeholder="Optional details or next step"/></label><button className="button button-dark" disabled={busy||!title.trim()}><Plus size={15}/> Create task</button></form>
      </section>
    </>}
    {tab === 'tasks' && <>
      <section className="panel p0-panel"><div className="p0-panel-head"><div><div className="eyebrow">TASK LIBRARY</div><h3>All your tasks</h3></div><span className="p0-count">{tasks.length} tasks</span></div>
        {tasks.filter(task=>!task.parentTaskId).map(task=><div className="p0-task-group" key={task.id}>
          <div className="p0-task-row"><div className="p0-task-main"><strong>{task.title}</strong><span>{projects.find(p=>p.id===task.projectId)?.name ?? 'Personal'} · {task.priority ?? 'medium'} priority · {fmtMinutes(task.estimatedMinutes)}{task.dueAt ? ` · Due ${new Date(task.dueAt).toLocaleDateString()}` : ''}</span></div><select aria-label={`Status for ${task.title}`} value={task.status??'todo'} onChange={e=>void perform(()=>window.cys.updateTask({id:task.id,status:e.target.value as TaskStatus}))}><option value="todo">To do</option><option value="in_progress">In progress</option><option value="blocked">Blocked</option><option value="deferred">Deferred</option><option value="completed">Completed</option><option value="cancelled">Cancelled</option></select><button className="icon-button" title="Edit task" onClick={()=>setEditingTask(task)}><Save size={15}/></button><button className="icon-button" title="Delete task" onClick={()=>void perform(()=>window.cys.deleteTask(task.id))}><Trash2 size={15}/></button><button className="button button-light" onClick={()=>setSubtaskFor(subtaskFor===task.id?null:task.id)}>+ Subtask</button></div>
          {editingTask?.id===task.id && <TaskEditor task={editingTask} projects={projects} onCancel={()=>setEditingTask(null)} onSave={async input=>{await window.cys.updateTask(input);await refresh();setEditingTask(null);}}/>}
          {tasks.filter(child=>child.parentTaskId===task.id).map(child=><div className="p0-subtask-row" key={child.id}><div className="p0-task-main"><strong>{child.title}</strong><span>Subtask · {child.priority ?? 'medium'} priority</span></div><button className="icon-button" title="Edit subtask" onClick={()=>setEditingTask(child)}><Save size={14}/></button><select aria-label={`Status for ${child.title}`} value={child.status??'todo'} onChange={e=>void perform(()=>window.cys.updateTask({id:child.id,status:e.target.value as TaskStatus}))}><option value="todo">To do</option><option value="in_progress">In progress</option><option value="blocked">Blocked</option><option value="deferred">Deferred</option><option value="completed">Completed</option><option value="cancelled">Cancelled</option></select><button className="icon-button" title="Delete subtask" onClick={()=>void perform(()=>window.cys.deleteTask(child.id))}><Trash2 size={15}/></button></div>)}
          {editingTask?.parentTaskId===task.id && <TaskEditor task={editingTask} projects={projects} onCancel={()=>setEditingTask(null)} onSave={async input=>{await window.cys.updateTask(input);await refresh();setEditingTask(null);}}/>}
          {subtaskFor===task.id&&<form className="p0-subtask-form" onSubmit={e=>{e.preventDefault();createSubtask(task);}}><input autoFocus value={subtaskTitle} onChange={e=>setSubtaskTitle(e.target.value)} placeholder={`Add a step under ${task.title}`} maxLength={160}/><button className="button button-dark" disabled={busy||!subtaskTitle.trim()}><Plus size={14}/> Add</button></form>}
        </div>)}
        {tasks.filter(task=>task.parentTaskId && !tasks.some(parent=>parent.id===task.parentTaskId)).map(task=><div className="p0-task-row" key={task.id}><div className="p0-task-main"><strong>{task.title}</strong><span>Subtask whose parent is no longer available</span></div><select value={task.status??'todo'} onChange={e=>void perform(()=>window.cys.updateTask({id:task.id,status:e.target.value as TaskStatus}))}><option value="todo">To do</option><option value="in_progress">In progress</option><option value="blocked">Blocked</option><option value="deferred">Deferred</option><option value="completed">Completed</option><option value="cancelled">Cancelled</option></select></div>)}
        {!tasks.length && <p className="small-muted">Your task library is empty. Create your first task above.</p>}
      </section>
    </>}
    {tab === 'projects' && <>
      <section className="panel p0-panel"><div className="eyebrow">PROJECT ORGANIZER</div><h3>Create a project</h3><form className="p0-form-grid" onSubmit={e=>{e.preventDefault();if(projectName.trim())void perform(async()=>{await window.cys.createProject({name:projectName.trim(),description:projectDescription.trim()});setProjectName('');setProjectDescription('');});}}><label>Project name<input value={projectName} onChange={e=>setProjectName(e.target.value)} placeholder="e.g. Biolio" maxLength={120}/></label><label>What is this project about?<input value={projectDescription} onChange={e=>setProjectDescription(e.target.value)} placeholder="A short description" maxLength={500}/></label><button className="button button-dark" disabled={busy||!projectName.trim()}><Plus size={15}/> Create project</button></form></section>
      <section className="panel p0-panel"><div className="p0-panel-head"><div className="eyebrow">YOUR PROJECTS</div><span className="p0-count">{projects.length} projects</span></div>{projects.map(project=><React.Fragment key={project.id}><div className="p0-project-row" key={project.id}><div className="project-dot" style={{background:project.color}}/><div className="p0-task-main"><strong>{project.name}</strong><span>{project.description || 'No description'} · {project.completedTaskCount ?? 0}/{project.taskCount ?? 0} tasks completed</span></div><button className="icon-button" title="Edit project" onClick={()=>setEditingProject(project)}><Save size={15}/></button><select value={project.status} onChange={e=>void perform(()=>window.cys.updateProject({id:project.id,status:e.target.value as ProjectRecord['status']}))}><option value="active">Active</option><option value="on_hold">On hold</option><option value="completed">Completed</option><option value="archived">Archived</option></select><button className="icon-button" title="Delete project (tasks will be kept)" onClick={()=>void perform(()=>window.cys.deleteProject(project.id))}><Trash2 size={15}/></button></div>{editingProject?.id===project.id && <ProjectEditor project={editingProject} onCancel={()=>setEditingProject(null)} onSave={async input=>{await window.cys.updateProject(input);await refresh();setEditingProject(null);}}/>}</React.Fragment>)}</section>
    </>}
    <div className="p0-note"><ShieldCheck size={16}/> Missions and project records are stored locally. Activity tracking is separate and remains off until you enable it.</div>
  </div>;
}

function dateInputValue(value: string | null | undefined) {
  if (!value) return '';
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return '';
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

function TaskEditor({ task, projects, onCancel, onSave }: { task: TaskRecord; projects: ProjectRecord[]; onCancel: () => void; onSave: (input: UpdateTaskInput) => Promise<void> }) {
  const [title, setTitle] = useState(task.title);
  const [description, setDescription] = useState(task.description ?? '');
  const [projectId, setProjectId] = useState(task.projectId ?? '');
  const [priority, setPriority] = useState<TaskPriority>(task.priority ?? 'medium');
  const [status, setStatus] = useState<TaskStatus>(task.status ?? 'todo');
  const [estimated, setEstimated] = useState(task.estimatedMinutes ? String(task.estimatedMinutes) : '');
  const [dueDate, setDueDate] = useState(dateInputValue(task.dueAt));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const submit = async (event: React.FormEvent) => {
    event.preventDefault(); if (!title.trim()) return;
    setSaving(true); setError('');
    try { await onSave({ id: task.id, title: title.trim(), description, projectId: projectId || null, priority, status, estimatedMinutes: estimated ? Number(estimated) : null, dueAt: dueDate ? new Date(`${dueDate}T23:59:00`).toISOString() : null }); }
    catch (e) { setError(e instanceof Error ? e.message : 'Could not save task.'); }
    finally { setSaving(false); }
  };
  return <form className="p0-inline-editor" onSubmit={event => void submit(event)}><div className="eyebrow">EDIT TASK</div><label>Title<input value={title} onChange={e=>setTitle(e.target.value)} maxLength={160}/></label><label>Description<textarea rows={2} value={description} onChange={e=>setDescription(e.target.value)} maxLength={2000}/></label><div className="p0-form-grid"><label>Project<select value={projectId} onChange={e=>setProjectId(e.target.value)}><option value="">Personal / no project</option>{projects.map(project=><option key={project.id} value={project.id}>{project.name}</option>)}</select></label><label>Priority<select value={priority} onChange={e=>setPriority(e.target.value as TaskPriority)}><option value="low">Low</option><option value="medium">Medium</option><option value="high">High</option><option value="urgent">Urgent</option></select></label><label>Status<select value={status} onChange={e=>setStatus(e.target.value as TaskStatus)}><option value="todo">To do</option><option value="in_progress">In progress</option><option value="blocked">Blocked</option><option value="deferred">Deferred</option><option value="completed">Completed</option><option value="cancelled">Cancelled</option></select></label><label>Estimate (minutes)<input type="number" min={1} max={10080} value={estimated} onChange={e=>setEstimated(e.target.value)}/></label><label>Due date<input type="date" value={dueDate} onChange={e=>setDueDate(e.target.value)}/></label></div>{error&&<div className="error-banner">{error}</div>}<div className="p0-actions"><button type="button" className="button button-light" onClick={onCancel}>Cancel</button><button className="button button-dark" disabled={saving||!title.trim()}>{saving?'Saving…':'Save task'}</button></div></form>;
}

function ProjectEditor({ project, onCancel, onSave }: { project: ProjectRecord; onCancel: () => void; onSave: (input: UpdateProjectInput) => Promise<void> }) {
  const [name, setName] = useState(project.name);
  const [description, setDescription] = useState(project.description);
  const [color, setColor] = useState(project.color);
  const [status, setStatus] = useState<ProjectRecord['status']>(project.status);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const submit = async (event: React.FormEvent) => {
    event.preventDefault(); if (!name.trim()) return;
    setSaving(true); setError('');
    try { await onSave({ id: project.id, name: name.trim(), description, color, status }); }
    catch (e) { setError(e instanceof Error ? e.message : 'Could not save project.'); }
    finally { setSaving(false); }
  };
  return <form className="p0-inline-editor" onSubmit={event=>void submit(event)}><div className="eyebrow">EDIT PROJECT</div><label>Name<input value={name} onChange={e=>setName(e.target.value)} maxLength={120}/></label><label>Description<textarea rows={2} value={description} onChange={e=>setDescription(e.target.value)} maxLength={2000}/></label><div className="p0-form-grid"><label>Project color<input type="color" value={color} onChange={e=>setColor(e.target.value)}/></label><label>Status<select value={status} onChange={e=>setStatus(e.target.value as ProjectRecord['status'])}><option value="active">Active</option><option value="on_hold">On hold</option><option value="completed">Completed</option><option value="archived">Archived</option></select></label></div>{error&&<div className="error-banner">{error}</div>}<div className="p0-actions"><button type="button" className="button button-light" onClick={onCancel}>Cancel</button><button className="button button-dark" disabled={saving||!name.trim()}>{saving?'Saving…':'Save project'}</button></div></form>;
}

export function OnboardingPage({ profile, onComplete }: { profile: UserProfile; onComplete: (enableTracking: boolean) => Promise<void> }) {
  const [preferredName, setPreferredName] = useState(profile.preferredName === 'Friend' ? '' : profile.preferredName);
  const [userType, setUserType] = useState<UserProfile['userType']>(profile.userType === 'custom' ? 'developer' : profile.userType);
  const [goal, setGoal] = useState(profile.currentGoal);
  const [communicationStyle, setCommunicationStyle] = useState<CommunicationStyle>(profile.communicationStyle);
  const [workStart, setWorkStart] = useState(profile.workStartTime);
  const [workEnd, setWorkEnd] = useState(profile.workEndTime);
  const [enableTracking, setEnableTracking] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!preferredName.trim()) { setError('Tell Scout what to call you.'); return; }
    setBusy(true); setError('');
    try {
      await window.cys.saveProfile({
        preferredName: preferredName.trim(), userType, currentGoal: goal.trim(),
        workingDays: profile.workingDays, workStartTime: workStart, workEndTime: workEnd,
        breakStartTime: profile.breakStartTime, breakEndTime: profile.breakEndTime,
        quietStartTime: profile.quietStartTime, quietEndTime: profile.quietEndTime,
        timezone: profile.timezone, communicationStyle, interactionFrequency: profile.interactionFrequency
      });
      await onComplete(enableTracking);
    } catch (e) { setError(e instanceof Error ? e.message : 'Could not finish setup.'); }
    finally { setBusy(false); }
  };
  const skip = async () => { setBusy(true); setError(''); try { await onComplete(false); } catch (e) { setError(e instanceof Error ? e.message : 'Could not finish setup.'); } finally { setBusy(false); } };
  return <div className="onboarding-overlay"><form className="onboarding-card" onSubmit={submit}>
    <div className="onboarding-art"><img src="./assets/scout-hero.jpg" alt="Scout welcoming you"/></div>
    <div className="eyebrow">A LITTLE INTRODUCTION</div>
    <h1>Let's make this your space.</h1>
    <p>Scout will help you plan, focus and recover at your pace. Start with a few preferences. You can change them any time.</p>
    {error && <div className="error-banner">{error}</div>}
    <div className="p0-form-grid">
      <label>What should Scout call you?<input autoFocus value={preferredName} onChange={e=>setPreferredName(e.target.value)} maxLength={60} placeholder="Your preferred name"/></label>
      <label>How will you use the app?<select value={userType} onChange={e=>setUserType(e.target.value as UserProfile['userType'])}><option value="developer">Developer / programmer</option><option value="student">Student</option><option value="freelancer">Freelancer</option><option value="remote-worker">Remote worker</option><option value="custom">Something else</option></select></label>
      <label className="p0-wide">One thing you'd like to make progress on<input value={goal} onChange={e=>setGoal(e.target.value)} maxLength={240} placeholder="e.g. Finish my portfolio project"/></label>
      <label>Usual work starts<input type="time" value={workStart} onChange={e=>setWorkStart(e.target.value)}/></label>
      <label>Usual work ends<input type="time" value={workEnd} onChange={e=>setWorkEnd(e.target.value)}/></label>
      <label className="p0-wide">How should Scout support you?<select value={communicationStyle} onChange={e=>setCommunicationStyle(e.target.value as CommunicationStyle)}><option value="gentle">Gentle and supportive</option><option value="direct">Direct and practical</option><option value="playful">Playful and energetic</option><option value="quiet">Mostly quiet</option></select></label>
    </div>
    <label className="onboarding-consent"><input type="checkbox" checked={enableTracking} onChange={e=>setEnableTracking(e.target.checked)}/><span><strong>Enable desktop activity awareness</strong><small>Optional. Scout can use foreground app and idle-time information to support focus sessions. Window-title capture stays off. You can change this later in Settings.</small></span></label>
    <div className="onboarding-actions"><button type="button" className="button button-light" onClick={()=>void skip()} disabled={busy}>Skip for now</button><button className="button button-dark" disabled={busy||!preferredName.trim()}>{busy?'Setting up…':'Meet Scout'} <ArrowRight size={15}/></button></div>
  </form></div>;
}

export function ProfilePage() {
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [moods, setMoods] = useState<MoodCheckin[]>([]);
  const [mood, setMood] = useState<MoodValue>('calm');
  const [energy, setEnergy] = useState(3);
  const [motivation, setMotivation] = useState(3);
  const [supportStyle, setSupportStyle] = useState<CommunicationStyle>('gentle');
  const [note, setNote] = useState('');
  const [savedMessage, setSavedMessage] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  useEffect(()=>{void Promise.all([window.cys.getProfile(),window.cys.getMoodHistory(7)]).then(([p,m])=>{setProfile(p);setMoods(m);setSupportStyle(p.communicationStyle);}).catch(e=>setError(e instanceof Error?e.message:'Could not load profile.'));},[]);
  const update = <K extends keyof UserProfile>(key:K,value:UserProfile[K]) => setProfile(current=>current?({...current,[key]:value}):current);
  const saveProfile = async (event:React.FormEvent) => {event.preventDefault();if(!profile)return;setBusy(true);setError('');setSavedMessage('');try{const { preferredName, userType, currentGoal, workingDays, workStartTime, workEndTime, breakStartTime, breakEndTime, quietStartTime, quietEndTime, timezone, communicationStyle, interactionFrequency } = profile; const next=await window.cys.saveProfile({ preferredName, userType, currentGoal, workingDays, workStartTime, workEndTime, breakStartTime, breakEndTime, quietStartTime, quietEndTime, timezone, communicationStyle, interactionFrequency });setProfile(next);setSavedMessage('Your profile and working preferences are saved.');}catch(e){setError(e instanceof Error?e.message:'Could not save profile.');}finally{setBusy(false);}};
  const saveMood = async (event:React.FormEvent) => {event.preventDefault();setBusy(true);setError('');setSavedMessage('');try{const value=await window.cys.createMoodCheckin({mood,energy,motivation,supportStyle,note});setMoods(current=>[value,...current].slice(0,7));setNote('');setSavedMessage('Thanks for checking in. Scout will use your preferences for this interaction.');}catch(e){setError(e instanceof Error?e.message:'Could not save check-in.');}finally{setBusy(false);}};
  if(!profile)return <div className="page-content"><div className="panel report-loading">Loading your profile…</div></div>;
  return <div className="page-content p0-page"><div className="page-heading"><div><div className="eyebrow">YOUR SPACE, YOUR PREFERENCES</div><h1>Let Scout get to know your routine.</h1><p>Only save details you are comfortable sharing with your local companion.</p></div><div className="p0-heading-art"><img src="./assets/scout-happy.jpg" alt="Scout"/></div></div>
    {error&&<div className="error-banner">{error}</div>}{savedMessage&&<div className="success-banner"><CheckCircle2 size={16}/>{savedMessage}</div>}
    <form onSubmit={saveProfile} className="panel p0-panel"><div className="eyebrow">PERSONAL PROFILE</div><h3>About you</h3><div className="p0-form-grid"><label>What should Scout call you?<input value={profile.preferredName} onChange={e=>update('preferredName',e.target.value)} maxLength={60}/></label><label>How do you use CaughtYouSlacking?<select value={profile.userType} onChange={e=>update('userType',e.target.value as UserProfile['userType'])}><option value="developer">Developer / programmer</option><option value="student">Student</option><option value="freelancer">Freelancer</option><option value="remote-worker">Remote worker</option><option value="custom">Something else</option></select></label><label className="p0-wide">Current personal goal<input value={profile.currentGoal} onChange={e=>update('currentGoal',e.target.value)} placeholder="e.g. Complete my portfolio project" maxLength={240}/></label></div>
      <div className="eyebrow p0-subhead">WORKING SCHEDULE</div><div className="p0-form-grid"><label>Work starts<input type="time" value={profile.workStartTime} onChange={e=>update('workStartTime',e.target.value)}/></label><label>Work ends<input type="time" value={profile.workEndTime} onChange={e=>update('workEndTime',e.target.value)}/></label><label>Break starts<input type="time" value={profile.breakStartTime} onChange={e=>update('breakStartTime',e.target.value)}/></label><label>Break ends<input type="time" value={profile.breakEndTime} onChange={e=>update('breakEndTime',e.target.value)}/></label><label>Quiet hours start<input type="time" value={profile.quietStartTime} onChange={e=>update('quietStartTime',e.target.value)}/></label><label>Quiet hours end<input type="time" value={profile.quietEndTime} onChange={e=>update('quietEndTime',e.target.value)}/></label><label>Time zone (IANA)<input value={profile.timezone} onChange={e=>update('timezone',e.target.value)} placeholder="Asia/Kolkata" maxLength={80}/></label></div>
      <div className="eyebrow p0-subhead">WORKING DAYS</div><div className="weekday-picker">{['Sun','Mon','Tue','Wed','Thu','Fri','Sat'].map((day,index)=><label key={day} className={profile.workingDays.includes(index)?'selected':''}><input type="checkbox" checked={profile.workingDays.includes(index)} onChange={e=>update('workingDays',e.target.checked?[...profile.workingDays,index]:profile.workingDays.filter(d=>d!==index))}/>{day}</label>)}</div>
      <div className="eyebrow p0-subhead">SCOUT'S COMMUNICATION</div><div className="p0-form-grid"><label>Preferred style<select value={profile.communicationStyle} onChange={e=>{update('communicationStyle',e.target.value as CommunicationStyle);setSupportStyle(e.target.value as CommunicationStyle);}}><option value="gentle">Gentle and supportive</option><option value="direct">Direct and practical</option><option value="playful">Playful and energetic</option><option value="quiet">Mostly quiet</option></select></label><label>Interaction frequency<select value={profile.interactionFrequency} onChange={e=>update('interactionFrequency',e.target.value as UserProfile['interactionFrequency'])}><option value="low">Low — only important moments</option><option value="normal">Normal</option><option value="high">High — more check-ins</option></select></label></div>
      <button className="button button-dark" disabled={busy}><Save size={15}/> Save profile</button>
    </form>
    <form onSubmit={saveMood} className="panel p0-panel"><div className="eyebrow">A QUICK CHECK-IN</div><h3>How are you feeling right now?</h3><p className="small-muted">This is self-reported. Scout won't try to guess your mood from computer activity.</p><div className="p0-form-grid"><label>Current mood<select value={mood} onChange={e=>setMood(e.target.value as MoodValue)}><option value="motivated">Motivated</option><option value="calm">Calm</option><option value="overwhelmed">Overwhelmed</option><option value="frustrated">Frustrated</option><option value="tired">Tired</option><option value="unmotivated">Low motivation</option><option value="distracted">Distracted</option></select></label><label>Support style<select value={supportStyle} onChange={e=>setSupportStyle(e.target.value as CommunicationStyle)}><option value="gentle">Gentle</option><option value="direct">Direct</option><option value="playful">Playful</option><option value="quiet">Quiet</option></select></label><label>Energy (1–5)<input type="number" min={1} max={5} value={energy} onChange={e=>setEnergy(Number(e.target.value))}/></label><label>Motivation (1–5)<input type="number" min={1} max={5} value={motivation} onChange={e=>setMotivation(Number(e.target.value))}/></label><label className="p0-wide">Optional note<textarea rows={2} value={note} onChange={e=>setNote(e.target.value)} maxLength={1000} placeholder="Anything you want Scout to know?"/></label></div><button className="button button-dark" disabled={busy}><HeartIcon/> Save check-in</button>
      {moods.length>0&&<div className="mood-history"><div className="eyebrow">RECENT CHECK-INS</div>{moods.map(item=><div className="p0-task-row" key={item.id}><div className="p0-task-main"><strong>{item.mood.replaceAll('_',' ')}</strong><span>Energy {item.energy}/5 · Motivation {item.motivation}/5 · {new Date(item.createdAt).toLocaleString()}</span></div><span className="category-tag productive">{item.supportStyle}</span></div>)}</div>}
    </form>
    <div className="p0-note"><ShieldCheck size={16}/> Your profile and check-ins stay in the local SQLite database. They are not sent to a model or an external service.</div>
  </div>;
}

export function ScoutPage({ onNavigate }: { onNavigate: (page: 'missions' | 'workspaces' | 'focus' | 'overview') => void }) {
  const [message,setMessage] = useState('');
  const [busy,setBusy] = useState(false);
  const [error,setError] = useState('');
  const [flow,setFlow] = useState<'home'|'start'|'overwhelmed'|'distracted'|'break'|'finished'>('home');
  type ScoutAction = 'start-short-focus' | 'take-break' | 'resume-focus' | 'motivate' | 'celebrate' | 'open-dashboard';
  type Choice = { title:string; detail:string; action?:ScoutAction; page?:'missions'|'workspaces'|'focus'|'overview'; response:string };
  const flows: Record<Exclude<typeof flow,'home'>, {heading:string; message:string; choices:Choice[]}> = {
    start: { heading:"Let’s make starting easier.", message:'We do not need to solve the whole project right now. Choose one small way to begin.', choices:[
      {title:'Start a 25-minute sprint',detail:'Use today’s primary mission if one is selected.',action:'start-short-focus',page:'focus',response:'Your short focus sprint is ready. I will stay nearby.'},
      {title:'Choose a mission first',detail:'Review your tasks and pick the next action.',page:'missions',response:'Let’s choose one clear mission before we begin.'},
      {title:'Prepare my workspace',detail:'Open a saved Coding, Study or Custom workspace.',page:'workspaces',response:'Let’s get your workspace ready.'}
    ]},
    overwhelmed: { heading:'We can make this smaller.', message:'When everything feels like too much, the next step should be small enough to start.', choices:[
      {title:'Break down my task',detail:'Open your mission board and choose a smaller action.',page:'missions',response:'Choose just one small next step. The rest can wait.'},
      {title:'Take a proper break',detail:'Start a timed 10-minute break.',action:'take-break',page:'focus',response:'Your break has started. Take the time you need.'},
      {title:'Give me encouragement',detail:'Ask Scout for a little support.',action:'motivate',response:'I am here with you. One manageable step is enough.'}
    ]},
    distracted: { heading:'A gentle way back.', message:'You are allowed to reset. Choose what would help rather than forcing yourself to continue.', choices:[
      {title:'Return to my focus session',detail:'Resume a paused focus session or acknowledge your return to a running session.',action:'resume-focus',page:'focus',response:'Welcome back. Let’s continue at your pace.'},
      {title:'Take a short break',detail:'Pause focus and start a timed break.',action:'take-break',page:'focus',response:'Your focus session is safely paused. Take a breather.'},
      {title:'Review my next task',detail:'Choose a smaller or different mission.',page:'missions',response:'A clearer next step can make it easier to return.'}
    ]},
    break: { heading:"Let’s take a proper pause.", message:'A break is part of a sustainable work routine, not a failure.', choices:[
      {title:'Start a 10-minute break',detail:'Pause a running focus session and start the break timer.',action:'take-break',page:'focus',response:'Enjoy your break. I will let you know when it ends.'},
      {title:'Open the focus room',detail:'Review your current session and break controls.',page:'focus',response:'Your focus room is ready when you are.'}
    ]},
    finished: { heading:'A win is worth noticing.', message:'You made progress. Let’s record it or celebrate without changing your active focus session.', choices:[
      {title:'Celebrate this progress',detail:'Scout celebrates without ending your focus session.',action:'celebrate',response:'That progress counts. Well done!'},
      {title:'Update my mission',detail:'Mark a task complete or add a progress note.',page:'missions',response:'Let’s record what you accomplished.'}
    ]}
  };
  const perform = async (choice: Choice) => {
    setBusy(true); setError(''); setMessage('');
    try {
      if (choice.action) await window.cys.companionAction(choice.action);
      if (choice.page) onNavigate(choice.page);
      setMessage(choice.response);
      setFlow('home');
    } catch(e) { setError(e instanceof Error ? e.message : 'The action could not be completed.'); }
    finally { setBusy(false); }
  };
  const quick = async (action: ScoutAction, response: string) => perform({title:'Quick action',detail:'',action,response});
  const active = flow === 'home' ? null : flows[flow];
  return <div className="page-content p0-page"><div className="page-heading"><div><div className="eyebrow">YOUR DIGITAL SIDEKICK</div><h1>Spend a moment with Scout.</h1><p>Choose what is happening. Scout will guide you through a practical, offline interaction rather than just showing a generic message.</p></div><div className="p0-heading-art"><img src="./assets/scout-hero.jpg" alt="Scout"/></div></div>
    {error&&<div className="error-banner">{error}</div>}{message&&<div className="success-banner"><CheckCircle2 size={16}/>{message}</div>}
    <section className="panel p0-panel"><div className="p0-panel-head"><div><div className="eyebrow">SCOUT CHECK-IN</div><h3>What would help right now?</h3></div><button className="button button-light" onClick={()=>void window.cys.openCompanion()}>Open floating Scout</button></div>
      {!active ? <div className="scout-action-grid">
        <button className="scout-action-card" disabled={busy} onClick={()=>setFlow('start')}><span><Zap size={18}/></span><strong>Help me start</strong><small>Find one small action and begin.</small></button>
        <button className="scout-action-card" disabled={busy} onClick={()=>setFlow('overwhelmed')}><span><HeartIcon/></span><strong>I'm overwhelmed</strong><small>Make the next step feel manageable.</small></button>
        <button className="scout-action-card" disabled={busy} onClick={()=>setFlow('distracted')}><span><ArrowRight size={18}/></span><strong>I'm distracted</strong><small>Choose a gentle way back.</small></button>
        <button className="scout-action-card" disabled={busy} onClick={()=>setFlow('break')}><span><Clock3 size={18}/></span><strong>I need a break</strong><small>Start a timed, intentional pause.</small></button>
        <button className="scout-action-card" disabled={busy} onClick={()=>setFlow('finished')}><span><CheckCircle2 size={18}/></span><strong>I finished something</strong><small>Celebrate or record your progress.</small></button>
        <button className="scout-action-card" disabled={busy} onClick={()=>void quick('motivate','Scout has sent you an encouraging message.')}><span><Sparkles size={18}/></span><strong>Motivate me</strong><small>A little encouragement in your chosen style.</small></button>
        <button className="scout-action-card" disabled={busy} onClick={()=>onNavigate('missions')}><span><BookOpen size={18}/></span><strong>Plan today</strong><small>Open your daily mission board.</small></button>
        <button className="scout-action-card" disabled={busy} onClick={()=>onNavigate('workspaces')}><span><BriefcaseBusiness size={18}/></span><strong>Prepare a workspace</strong><small>Choose Coding, Study or another preset.</small></button>
      </div> : <div className="scout-flow-panel"><div className="scout-flow-copy"><div className="eyebrow">A MOMENT WITH SCOUT</div><h3>{active.heading}</h3><p>{active.message}</p></div><div className="scout-flow-choices">{active.choices.map(choice=><button key={choice.title} className="scout-flow-choice" disabled={busy} onClick={()=>void perform(choice)}><span><strong>{choice.title}</strong><small>{choice.detail}</small></span><ArrowRight size={16}/></button>)}</div><button className="button button-ghost" disabled={busy} onClick={()=>setFlow('home')}>Back to Scout</button></div>}
    </section>
    <section className="panel p0-panel"><div className="eyebrow">SCOUT'S PROMISE</div><h3>Support, never surveillance.</h3><p className="small-muted">Scout uses your explicit preferences and selected focus context. It does not diagnose your mood, read your documents, capture keystrokes or make assumptions about your intent. These interactions use predefined decision flows and work offline.</p></section>
  </div>;
}

function HeartIcon(){return <span aria-hidden="true">♥</span>;}


export function RoutinesPage({ activeSession, activeBreak, onNavigate }: { activeSession: FocusSession | null; activeBreak: BreakSession | null; onNavigate: (page: 'missions' | 'workspaces' | 'focus') => void }) {
  const [routines, setRoutines] = useState<RoutineRecord[]>([]);
  const [run, setRun] = useState<RoutineRun | null>(null);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [steps, setSteps] = useState<RoutineStep[]>([]);
  const [stepKind, setStepKind] = useState<RoutineStepKind>('focus');
  const [stepTitle, setStepTitle] = useState('Complete a focused work block');
  const [stepDuration, setStepDuration] = useState('50');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [completedRoutineName, setCompletedRoutineName] = useState('');
  const [runHistory, setRunHistory] = useState<RoutineRun[]>([]);
  const refresh = async () => {
    const [items, active, history] = await Promise.all([window.cys.routinesList(), window.cys.getActiveRoutine(), window.cys.routinesHistory(12)]);
    setRoutines(items); setRun(active); setRunHistory(history);
  };
  useEffect(() => { void refresh().catch(e => setError(e instanceof Error ? e.message : 'Could not load routines.')); }, []);
  const perform = async (action: () => Promise<unknown>, success?: string) => {
    setBusy(true); setError(''); setNotice('');
    try { await action(); await refresh(); if (success) setNotice(success); }
    catch (e) { setError(e instanceof Error ? e.message : 'The routine action could not be completed.'); }
    finally { setBusy(false); }
  };
  const addStep = () => {
    if (!stepTitle.trim() || steps.length >= 12) return;
    setSteps(current => [...current, { id: `step-${Date.now()}-${current.length}`, kind: stepKind, title: stepTitle.trim(), durationMinutes: ['focus', 'break'].includes(stepKind) ? Number(stepDuration) : null, workspacePresetId: null }]);
    setStepTitle(stepKind === 'focus' ? 'Complete a focused work block' : stepKind === 'break' ? 'Take a short break' : '');
  };
  const create = (event: React.FormEvent) => {
    event.preventDefault();
    void perform(async () => {
      await window.cys.createRoutine({ name: name.trim(), description: description.trim(), steps });
      setName(''); setDescription(''); setSteps([]);
    }, 'Your routine has been saved.');
  };
  const currentStep = run?.steps[run.currentStepIndex] ?? null;
  const doStepAction = async () => {
    if (!currentStep) return;
    if (currentStep.kind === 'review_missions') { onNavigate('missions'); return; }
    if (currentStep.kind === 'workspace') { onNavigate('workspaces'); return; }
    if (currentStep.kind === 'focus') {
      if (activeSession) { onNavigate('focus'); return; }
      await perform(() => window.cys.startFocus({ taskTitle: currentStep.title, plannedMinutes: currentStep.durationMinutes ?? 50 }), 'Focus step started. Return here when you finish.');
      return;
    }
    if (currentStep.kind === 'break') {
      await perform(() => window.cys.startBreak({ plannedMinutes: currentStep.durationMinutes ?? 10, kind: (currentStep.durationMinutes ?? 10) >= 20 ? 'long' : 'short' }), 'Your timed break has started. Scout will let you know when it is complete.');
      return;
    }
    setNotice('Take a moment to record what went well, then mark this reflection step complete.');
  };
  const completeStep = () => void perform(async () => { const next = await window.cys.completeRoutineStep(); setRun(next); if (next?.status === 'completed') setCompletedRoutineName(next.routineName); }, 'Routine progress saved.');

  return <div className="page-content p0-page">
    <div className="page-heading"><div><div className="eyebrow">REPEATABLE WORKFLOWS</div><h1>Build a routine that supports you.</h1><p>Save a sequence of small actions and start it whenever you need a reliable way to begin.</p></div><div className="p0-heading-art"><img src="./assets/scout-focused.jpg" alt="Scout ready for a routine"/></div></div>
    {error && <div className="error-banner">{error}<button onClick={() => setError('')}>×</button></div>}
    {notice && <div className="success-banner"><CheckCircle2 size={16}/>{notice}</div>}
    {run && currentStep && <section className="panel p0-panel routine-active-panel">
      <div className="p0-panel-head"><div><div className="eyebrow">ROUTINE IN PROGRESS</div><h3>{run.routineName}</h3></div><span className="p0-count">Step {run.currentStepIndex + 1} of {run.steps.length}</span></div>
      <div className="p0-progress"><i style={{ width: `${run.currentStepIndex / run.steps.length * 100}%` }}/></div>
      <div className="routine-current-step"><span className="routine-step-kind">{currentStep.kind.replaceAll('_', ' ')}</span><h2>{currentStep.title}</h2><p>{currentStep.durationMinutes ? `${currentStep.durationMinutes} minute step` : 'Complete this step at your own pace.'}</p></div>
      <div className="routine-step-actions">
        <button className="button button-light" onClick={() => void doStepAction()} disabled={busy || (currentStep.kind === 'break' && Boolean(activeBreak))}>{currentStep.kind === 'review_missions' ? 'Open daily missions' : currentStep.kind === 'workspace' ? 'Open workspaces' : currentStep.kind === 'focus' ? activeSession ? 'Go to focus room' : 'Start focus step' : currentStep.kind === 'break' ? 'Begin break' : 'Start reflection'}</button>
        <button className="button button-dark" onClick={completeStep} disabled={busy || (currentStep.kind === 'focus' && Boolean(activeSession)) || (currentStep.kind === 'break' && Boolean(activeBreak))}>Complete this step <ArrowRight size={15}/></button>
        <button className="button button-ghost" onClick={() => void perform(() => window.cys.cancelRoutine(), 'Routine cancelled.')} disabled={busy}>Cancel routine</button>
      </div>
      <div className="routine-step-list">{run.steps.map((step,index)=><div className={`routine-step-row ${index<run.currentStepIndex?'done':index===run.currentStepIndex?'current':''}`} key={step.id}><span>{index<run.currentStepIndex?<CheckCircle2 size={17}/>:index+1}</span><div><strong>{step.title}</strong><small>{step.kind.replaceAll('_',' ')}{step.durationMinutes?` · ${step.durationMinutes} min`:''}</small></div></div>)}</div>
    </section>}
    {completedRoutineName && <section className="panel p0-panel"><div className="success-banner"><CheckCircle2 size={17}/> You completed {completedRoutineName}. Scout is proud of the progress you made.</div><button className="button button-light" onClick={()=>setCompletedRoutineName('')}>Dismiss</button></section>}
    <section className="panel p0-panel"><div className="p0-panel-head"><div><div className="eyebrow">STARTER ROUTINES</div><h3>Choose a proven starting point</h3></div><span className="p0-count">{routines.length} saved</span></div>
      <div className="routine-library">{routines.map(item=><article className="routine-card" key={item.id}><div className="routine-card-top"><span className="routine-card-icon"><BookOpen size={18}/></span>{item.isBuiltIn&&<span className="category-tag productive">Starter</span>}</div><h4>{item.name}</h4><p>{item.description}</p><small>{item.steps.length} steps · {item.steps.filter(s=>s.durationMinutes).reduce((sum,s)=>sum+(s.durationMinutes??0),0)} planned minutes</small><div className="routine-card-actions"><button className="button button-dark" disabled={busy||Boolean(run)||Boolean(activeSession)||Boolean(activeBreak)} onClick={()=>void perform(async()=>{setCompletedRoutineName('');const next=await window.cys.startRoutine(item.id);setRun(next);},'Routine started. Scout is ready to go.')}>Start routine</button>{!item.isBuiltIn&&<button className="icon-button" title="Delete routine" disabled={busy||run?.routineId===item.id} onClick={()=>void perform(()=>window.cys.deleteRoutine(item.id))}><Trash2 size={15}/></button>}</div></article>)}</div>
    </section>
    <section className="panel p0-panel"><div className="p0-panel-head"><div><div className="eyebrow">ROUTINE HISTORY</div><h3>Recent routines</h3></div><span className="p0-count">{runHistory.length} runs</span></div>{runHistory.length ? <div className="routine-history-list">{runHistory.map(item=><div className="p0-task-row" key={item.id}><div className="p0-task-main"><strong>{item.routineName}</strong><span>{new Date(item.startedAt).toLocaleString()} · {Math.min(item.currentStepIndex,item.steps.length)}/{item.steps.length} steps</span></div><span className={`category-tag ${item.status==='completed'?'productive':item.status==='running'?'unclassified':'distracting'}`}>{item.status.replaceAll('_',' ')}</span></div>)}</div> : <p className="small-muted">Completed and cancelled routine runs will appear here.</p>}</section>
    <section className="panel p0-panel"><div className="eyebrow">CUSTOM ROUTINE BUILDER</div><h3>Create your own sequence</h3><form onSubmit={create} className="p0-form-grid"><label>Routine name<input value={name} onChange={e=>setName(e.target.value)} maxLength={100} placeholder="e.g. My evening study routine"/></label><label>Description<input value={description} onChange={e=>setDescription(e.target.value)} maxLength={1000} placeholder="What does this routine help you do?"/></label><label>Step type<select value={stepKind} onChange={e=>{const kind=e.target.value as RoutineStepKind;setStepKind(kind);setStepTitle(kind==='focus'?'Complete a focused work block':kind==='break'?'Take a short break':kind==='workspace'?'Prepare a workspace':kind==='review_missions'?"Review today's missions":'Reflect on progress');}}><option value="review_missions">Review missions</option><option value="workspace">Prepare workspace</option><option value="focus">Focus session</option><option value="break">Break</option><option value="reflection">Reflection</option></select></label><label>Step title<input value={stepTitle} onChange={e=>setStepTitle(e.target.value)} maxLength={120}/></label>{['focus','break'].includes(stepKind)&&<label>Duration in minutes<input type="number" min={1} max={240} value={stepDuration} onChange={e=>setStepDuration(e.target.value)}/></label>}<button type="button" className="button button-light" onClick={addStep} disabled={!stepTitle.trim()||steps.length>=12}><Plus size={15}/> Add step</button>
        <div className="routine-builder-steps p0-wide">{steps.map((step,index)=><div className="routine-builder-step" key={step.id}><span>{index+1}</span><div><strong>{step.title}</strong><small>{step.kind.replaceAll('_',' ')}{step.durationMinutes?` · ${step.durationMinutes} min`:''}</small></div><button type="button" className="icon-button" onClick={()=>setSteps(current=>current.filter(item=>item.id!==step.id))}><Trash2 size={14}/></button></div>)}{!steps.length&&<p className="small-muted">Add at least one step to create a routine. You can reorder steps in a later release.</p>}</div>
        <button className="button button-dark" disabled={busy||!name.trim()||steps.length===0}><Save size={15}/> Save custom routine</button>
      </form>
    </section>
    <div className="p0-note"><ShieldCheck size={16}/> Routines are local, manually started checklists. They do not run background scripts or launch applications without your confirmation.</div>
  </div>;
}
