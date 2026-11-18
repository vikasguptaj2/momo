import type Database from 'better-sqlite3';
import { randomUUID } from 'node:crypto';
import type { P1State } from '../../shared/types.js';

export class P1Service {
  constructor(private db: Database.Database) {
    db.exec(`
      CREATE TABLE IF NOT EXISTS scout_journal (id TEXT PRIMARY KEY, kind TEXT NOT NULL, title TEXT NOT NULL, body TEXT NOT NULL DEFAULT '', tags_json TEXT NOT NULL DEFAULT '[]', pinned INTEGER NOT NULL DEFAULT 0, created_at TEXT NOT NULL);
      CREATE INDEX IF NOT EXISTS idx_scout_journal_created ON scout_journal(created_at DESC);
      CREATE TABLE IF NOT EXISTS scout_rituals (id TEXT PRIMARY KEY, name TEXT NOT NULL, ritual_type TEXT NOT NULL, enabled INTEGER NOT NULL DEFAULT 1, time_of_day TEXT NOT NULL DEFAULT '', steps_json TEXT NOT NULL DEFAULT '[]', last_completed_at TEXT, created_at TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS scout_ritual_completions (id TEXT PRIMARY KEY, ritual_id TEXT NOT NULL, completed_at TEXT NOT NULL, note TEXT NOT NULL DEFAULT '');
      CREATE TABLE IF NOT EXISTS scout_unlocks (code TEXT PRIMARY KEY, category TEXT NOT NULL, title TEXT NOT NULL, description TEXT NOT NULL, unlocked_at TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS scout_preferences (key TEXT PRIMARY KEY, value TEXT NOT NULL);
    `);
    const insert = db.prepare('INSERT OR IGNORE INTO scout_preferences(key,value) VALUES(?,?)');
    for (const [k,v] of Object.entries({ personality:'supportive', interactionFrequency:'normal', voiceEnabled:false, reducedMotion:false, highContrast:false, textScale:100, soundEnabled:true, currentEnvironment:'cozy-desk', currentAccessory:'default-scarf' })) insert.run(k, JSON.stringify(v));
    const seed = db.prepare('INSERT OR IGNORE INTO scout_unlocks(code,category,title,description,unlocked_at) VALUES(?,?,?,?,?)');
    for (const [code,category,title,description] of [['cozy-desk','environment','Cozy Desk','Scout’s first little home.'],['default-scarf','accessory','Golden Scarf','A familiar favourite.'],['trail-camp','environment','Trail Camp','A quiet place for new adventures.'],['star-pin','accessory','Star Pin','A small reminder of showing up.']]) seed.run(code,category,title,description,new Date().toISOString());
    const ritualCount = db.prepare('SELECT COUNT(*) n FROM scout_rituals').get() as {n:number};
    if (!ritualCount.n) {
      const add = db.prepare('INSERT INTO scout_rituals(id,name,ritual_type,enabled,time_of_day,steps_json,created_at) VALUES(?,?,?,?,?,?,?)');
      const now = new Date().toISOString();
      add.run(randomUUID(),'Morning intention','morning',1,'08:30',JSON.stringify(['Choose one meaningful outcome','Name the first small action','Set a realistic focus block']),now);
      add.run(randomUUID(),'Workday check-in','work',1,'09:00',JSON.stringify(['How is your energy?','What would make this session useful?']),now);
      add.run(randomUUID(),'Evening reflection','evening',1,'18:00',JSON.stringify(['What moved forward today?','What can wait until tomorrow?','Give yourself credit for showing up']),now);
    }
  }
  private row<T>(sql:string,...args:unknown[]):T[] { return this.db.prepare(sql).all(...args) as T[]; }
  getState(): P1State {
    const prefs = Object.fromEntries(this.row<{key:string;value:string}>('SELECT key,value FROM scout_preferences').map(x=>[x.key,JSON.parse(x.value)]));
    return {
      preferences: prefs,
      journal: this.row<P1State['journal'][number]>('SELECT id, kind, title, body, created_at, pinned FROM scout_journal ORDER BY pinned DESC, created_at DESC LIMIT 100'),
      rituals: this.row<P1State['rituals'][number]>('SELECT id, name, ritual_type, enabled, time_of_day, steps_json, last_completed_at FROM scout_rituals ORDER BY CASE ritual_type WHEN \'morning\' THEN 1 WHEN \'work\' THEN 2 ELSE 3 END'),
      unlocks: this.row<P1State['unlocks'][number]>('SELECT code, category, title, description, unlocked_at FROM scout_unlocks ORDER BY unlocked_at'),
      completions: this.row<P1State['completions'][number]>('SELECT id, ritual_id, completed_at, note FROM scout_ritual_completions ORDER BY completed_at DESC LIMIT 30'),
      weekly: this.getWeeklyReview()
    };
  }
  savePreference(key:string,value:unknown): P1State { const allowed=['personality','interactionFrequency','voiceEnabled','reducedMotion','highContrast','textScale','soundEnabled','currentEnvironment','currentAccessory']; if(!allowed.includes(key)) throw new Error('Unsupported Scout preference.'); if(key==='personality'&&!['supportive','curious','playful','cheeky'].includes(String(value))) throw new Error('Invalid personality.'); if(key==='interactionFrequency'&&!['low','normal','high'].includes(String(value))) throw new Error('Invalid interaction frequency.'); if(key==='textScale'&&(typeof value!=='number'||!Number.isInteger(value)||value<80||value>140)) throw new Error('Text scale must be between 80 and 140.'); this.db.prepare('INSERT INTO scout_preferences(key,value) VALUES(?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value').run(key,JSON.stringify(value)); return this.getState(); }
  addJournal(input:{kind:string;title:string;body?:string;tags?:string[]}): P1State['journal'][number] { const kinds=['reflection','memory','achievement','note','conversation']; if(!kinds.includes(input.kind)||!input.title?.trim()||input.title.length>120||(input.body??'').length>4000) throw new Error('Check the journal entry and try again.'); const id=randomUUID(); this.db.prepare('INSERT INTO scout_journal(id,kind,title,body,tags_json,created_at) VALUES(?,?,?,?,?,?)').run(id,input.kind,input.title.trim(),(input.body??'').trim(),JSON.stringify((input.tags??[]).slice(0,8)),new Date().toISOString()); return this.row<P1State['journal'][number]>('SELECT id, kind, title, body, created_at, pinned FROM scout_journal WHERE id=?',id)[0]!; }
  deleteJournal(id:string): P1State { this.db.prepare('DELETE FROM scout_journal WHERE id=?').run(id); return this.getState(); }
  pinJournal(id:string,pinned:boolean): P1State { this.db.prepare('UPDATE scout_journal SET pinned=? WHERE id=?').run(pinned?1:0,id); return this.getState(); }
  saveRitual(input:{id?:string;name:string;ritualType:string;timeOfDay?:string;steps:string[];enabled?:boolean}): P1State { if(!input.name?.trim()||input.name.length>80||!['morning','work','evening','custom'].includes(input.ritualType)||!Array.isArray(input.steps)||input.steps.length<1||input.steps.length>8||input.steps.some(s=>typeof s!=='string'||!s.trim()||s.length>160)) throw new Error('Invalid ritual details.'); const id=input.id??randomUUID(); const now=new Date().toISOString(); this.db.prepare(`INSERT INTO scout_rituals(id,name,ritual_type,enabled,time_of_day,steps_json,created_at) VALUES(?,?,?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET name=excluded.name,ritual_type=excluded.ritual_type,time_of_day=excluded.time_of_day,steps_json=excluded.steps_json,enabled=excluded.enabled`).run(id,input.name.trim(),input.ritualType,input.enabled===false?0:1,input.timeOfDay??'',JSON.stringify(input.steps),now); return this.getState(); }
  completeRitual(id:string,note=''): P1State { const ritual=this.row<{id:string;name:string;enabled:number}>('SELECT id,name,enabled FROM scout_rituals WHERE id=?',id)[0]; if(!ritual) throw new Error('Ritual not found.'); if(!ritual.enabled) throw new Error('Disabled rituals cannot be completed.'); const now=new Date().toISOString(); this.db.prepare('INSERT INTO scout_ritual_completions(id,ritual_id,completed_at,note) VALUES(?,?,?,?)').run(randomUUID(),id,now,note.slice(0,500)); this.db.prepare('UPDATE scout_rituals SET last_completed_at=? WHERE id=?').run(now,id); this.addJournal({kind:'achievement',title:`Completed ${ritual.name}`,body:note||'A small ritual completed.'}); return this.getState(); }
  unlock(code:string): P1State { const item=this.row<{code:string;category:string}>('SELECT code,category FROM scout_unlocks WHERE code=?',code)[0]; if(!item) throw new Error('That item is not available.'); this.savePreference(item.category==='environment'?'currentEnvironment':'currentAccessory',code); return this.getState(); }
  getWeeklyReview(): P1State['weekly'] {
    const since=new Date(Date.now()-7*86400000).toISOString();
    const focus=this.db.prepare("SELECT COUNT(*) sessions, COALESCE(SUM(accumulated_seconds),0) seconds, SUM(CASE WHEN status='completed' THEN 1 ELSE 0 END) completed FROM focus_sessions WHERE started_at>=?").get(since) as {sessions:number;seconds:number;completed:number} | undefined;
    const missions=this.db.prepare("SELECT COUNT(*) total, SUM(CASE WHEN status='completed' AND completed_at>=? THEN 1 ELSE 0 END) completed FROM tasks WHERE completed_at>=? OR created_at>=?").get(since, since, since) as {total:number;completed:number} | undefined;
    const distractions=this.db.prepare("SELECT COUNT(*) total FROM distraction_events WHERE created_at>=?").get(since) as {total:number} | undefined;
    const recoveries=this.db.prepare("SELECT COUNT(*) total, SUM(CASE WHEN outcome IN ('returned','break','restarted') OR action IN ('restart','break') THEN 1 ELSE 0 END) returned FROM recovery_events WHERE created_at>=?").get(since) as {total:number;returned:number} | undefined;
    const rituals=this.db.prepare('SELECT COUNT(*) total FROM scout_ritual_completions WHERE completed_at>=?').get(since) as {total:number} | undefined;
    const recoveryPrompts = Math.max(distractions?.total ?? 0, recoveries?.total ?? 0);
    return {
      from:since,
      to:new Date().toISOString(),
      focusSessions:focus?.sessions??0,
      focusSeconds:focus?.seconds??0,
      completedSessions:focus?.completed??0,
      missionsCompleted:missions?.completed??0,
      missionsTouched:missions?.total??0,
      recoveryPrompts,
      successfulReturns:recoveries?.returned??0,
      ritualsCompleted:rituals?.total??0
    };
  }
}
