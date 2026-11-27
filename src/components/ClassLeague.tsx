import { useMemo, useState, type ReactNode } from 'react'
import { Lock, Plus, Trash2, Trophy, X, Minus, CalendarDays, Crown, Medal, Users, Sparkles } from 'lucide-react'

const ADMIN_PASSWORD = 'Arena001'
const CLASS_KEY = 'gpa_classes_v1'
const POINTS_KEY = 'gpa_points_v1'

type Student = { id: string; name: string }
type Klass = { id: string; name: string; students: Student[] }
type Points = Record<string, Record<string, number>>
type Range = 'day' | 'week' | 'month'

const uid = () => Math.random().toString(36).slice(2, 10)
const dayKeyOf = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
const todayKey = () => dayKeyOf(new Date())

function weekKeys() {
  const d = new Date()
  const day = (d.getDay() + 6) % 7 // Monday = 0
  const keys: string[] = []
  for (let i = 0; i < 7; i++) {
    const x = new Date(d)
    x.setDate(d.getDate() - day + i)
    keys.push(dayKeyOf(x))
  }
  return keys
}
const monthPrefix = () => todayKey().slice(0, 7)

function readStore<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key)
    if (!raw) return fallback
    return JSON.parse(raw) as T
  } catch {
    return fallback
  }
}
function writeStore(key: string, value: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(value))
  } catch {
    /* storage unavailable */
  }
}

function scoreFor(points: Points, studentId: string, range: Range, day: string) {
  const dates = points[studentId] || {}
  if (range === 'day') return dates[day] || 0
  const keys = range === 'week' ? weekKeys() : Object.keys(dates).filter(k => k.startsWith(monthPrefix()))
  return keys.reduce((sum, k) => sum + (dates[k] || 0), 0)
}

function rowsFor(klass: Klass | undefined, points: Points, range: Range, day: string) {
  if (!klass) return []
  return klass.students
    .map(s => ({ id: s.id, name: s.name, score: scoreFor(points, s.id, range, day) }))
    .sort((a, b) => b.score - a.score || a.name.localeCompare(b.name))
}

export default function ClassLeague() {
  const [classes, setClasses] = useState<Klass[]>(() => readStore<Klass[]>(CLASS_KEY, []))
  const [points, setPoints] = useState<Points>(() => readStore<Points>(POINTS_KEY, {}))
  const [day, setDay] = useState(todayKey())
  const [range, setRange] = useState<Range>('day')
  const [activeClass, setActiveClass] = useState('')
  const [teacherOpen, setTeacherOpen] = useState(false)
  const [unlocked, setUnlocked] = useState(false)
  const [pw, setPw] = useState('')
  const [pwError, setPwError] = useState('')
  const [newClass, setNewClass] = useState('')
  const [studentDrafts, setStudentDrafts] = useState<Record<string, string>>({})

  const saveClasses = (next: Klass[]) => { setClasses(next); writeStore(CLASS_KEY, next) }
  const savePoints = (next: Points) => { setPoints(next); writeStore(POINTS_KEY, next) }
  const selected = classes.find(c => c.id === activeClass) || classes[0]

  // Each class is scored independently: its own daily table and its own
  // player of the week / player of the month.
  const rows = useMemo(() => rowsFor(selected, points, range, day), [selected, points, range, day])
  const weekRows = useMemo(() => rowsFor(selected, points, 'week', day), [selected, points, day])
  const monthRows = useMemo(() => rowsFor(selected, points, 'month', day), [selected, points, day])
  const classTotal = rows.reduce((sum, r) => sum + r.score, 0)
  const topScore = rows[0]?.score || 0

  const addClass = () => {
    const name = newClass.trim()
    if (!name) return
    const next = [...classes, { id: uid(), name, students: [] }]
    saveClasses(next)
    setActiveClass(next[next.length - 1].id)
    setNewClass('')
  }
  const removeClass = (id: string) => {
    const target = classes.find(c => c.id === id)
    if (!target) return
    if (!window.confirm(`Remove ${target.name} and all its students?`)) return
    saveClasses(classes.filter(c => c.id !== id))
    if (activeClass === id) setActiveClass('')
  }
  const addStudent = (classId: string) => {
    const name = (studentDrafts[classId] || '').trim()
    if (!name) return
    saveClasses(classes.map(c => (c.id === classId ? { ...c, students: [...c.students, { id: uid(), name }] } : c)))
    setStudentDrafts(d => ({ ...d, [classId]: '' }))
  }
  const removeStudent = (classId: string, studentId: string) => {
    saveClasses(classes.map(c => (c.id === classId ? { ...c, students: c.students.filter(s => s.id !== studentId) } : c)))
  }
  const setPointsFor = (studentId: string, value: number) => {
    const safe = Math.max(0, Math.min(999, Math.round(value) || 0))
    const dates = { ...(points[studentId] || {}) }
    if (safe === 0) delete dates[day]
    else dates[day] = safe
    savePoints({ ...points, [studentId]: dates })
  }

  const openTeacher = () => {
    setTeacherOpen(true)
    setUnlocked(false)
    setPw('')
    setPwError('')
  }
  const unlock = () => {
    if (pw.trim() !== ADMIN_PASSWORD) { setPwError('Wrong password. Ask the teacher.'); return }
    setUnlocked(true)
    setPw('')
    setPwError('')
    if (!activeClass && classes[0]) setActiveClass(classes[0].id)
  }

  const award = (title: string, top: { name: string; score: number } | undefined, icon: ReactNode, tone: string) => (
    <div className={`award-card ${tone}`}>
      <div className="award-icon">{icon}</div>
      <div className="award-copy">
        <span>{title}</span>
        <b>{top && top.score > 0 ? top.name : 'Not decided yet'}</b>
        <small>{top && top.score > 0 ? `${top.score} points` : 'Add points to announce a winner'}</small>
      </div>
    </div>
  )

  return (
    <div className="class-league">
      <div className="page-heading">
        <div>
          <div className="eyebrow">CLASS LEAGUE</div>
          <h1>Leaderboard</h1>
          <p className="muted">Every class has its own board — its own rankings, its own player of the week and month.</p>
        </div>
        <button className="secondary-btn" onClick={openTeacher}><Lock size={15}/> EDIT · TEACHER</button>
      </div>

      {!classes.length ? (
        <div className="empty-state">
          <Trophy size={28}/>
          <p><b>No classes yet.</b></p>
          <p>Tap <b>EDIT · TEACHER</b> (password) to add a class, its students and their daily points.</p>
        </div>
      ) : (
        <>
          <div className="class-tabs" role="tablist" aria-label="Choose a class">
            {classes.map(c => (
              <button
                key={c.id}
                role="tab"
                aria-selected={selected?.id === c.id}
                className={`class-tab ${selected?.id === c.id ? 'on' : ''}`}
                onClick={() => setActiveClass(c.id)}
              >
                <span className="class-tab-avatar"><Users size={15}/></span>
                <span className="class-tab-copy">
                  <b>{c.name}</b>
                  <small>{c.students.length} {c.students.length === 1 ? 'student' : 'students'}</small>
                </span>
              </button>
            ))}
          </div>

          {selected && (
            <div className="league-board">
              <div className="league-board-head">
                <div className="league-board-title">
                  <span className="league-board-chip">{selected.name}</span>
                  <h2>{selected.name} leaderboard</h2>
                  <p className="muted">
                    {range === 'day' ? `Daily points · ${day}` : range === 'week' ? 'This week · Monday to Sunday' : 'This month · 1st to today'}
                  </p>
                </div>
                <div className="league-total">
                  <strong>{classTotal}</strong>
                  <span>CLASS PTS</span>
                </div>
              </div>

              <div className="award-grid">
                {award('PLAYER OF THE WEEK · ' + selected.name, weekRows[0], <Crown size={20}/>, 'gold')}
                {award('PLAYER OF THE MONTH · ' + selected.name, monthRows[0], <Medal size={20}/>, 'violet')}
              </div>

              <div className="league-toolbar">
                <div className="kids-levels" style={{ margin: 0 }}>
                  {(['day', 'week', 'month'] as Range[]).map(r => (
                    <button key={r} className={range === r ? 'selected' : ''} onClick={() => setRange(r)}>
                      {r === 'day' ? 'Daily' : r === 'week' ? 'This week' : 'This month'}
                    </button>
                  ))}
                </div>
                <label className="day-picker"><CalendarDays size={15}/><input type="date" value={day} onChange={e => setDay(e.target.value)}/></label>
              </div>

              {rows.length ? (
                <div className="league-rows">
                  {rows.map((r, i) => (
                    <div className={`league-row ${i === 0 && r.score > 0 ? 'is-top' : ''}`} key={r.id}>
                      <span className={`league-rank rank-${i + 1}`}>
                        {i < 3 ? <Medal size={16}/> : i + 1}
                      </span>
                      <span className="avatar">{r.name.slice(0, 2).toUpperCase()}</span>
                      <span className="league-name">
                        <b>{r.name}</b>
                        <span className="league-bar"><i style={{ width: `${topScore > 0 ? Math.max(6, (r.score / topScore) * 100) : 6}%` }}/></span>
                      </span>
                      <strong>{r.score} <small>pts</small></strong>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="league-empty">
                  <Sparkles size={22}/>
                  <p>No students in <b>{selected.name}</b> yet. Add them with <b>EDIT · TEACHER</b>.</p>
                </div>
              )}
            </div>
          )}
        </>
      )}

      {teacherOpen && (
        <div className="modal-backdrop" onClick={() => setTeacherOpen(false)}>
          <div className="modal teacher-modal" onClick={e => e.stopPropagation()}>
            <button className="modal-close" onClick={() => setTeacherOpen(false)}><X size={18}/></button>
            {!unlocked ? (
              <>
                <div className="modal-avatar"><Lock size={22}/></div>
                <h2>Teacher access</h2>
                <p className="muted">Manage classes, students and daily points.</p>
                <label>Password
                  <input type="password" value={pw} onChange={e => setPw(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') unlock() }} autoFocus/>
                </label>
                {pwError && <div className="notice" style={{ color: '#ef8888' }}>{pwError}</div>}
                <button className="primary-btn wide" onClick={unlock}>Unlock</button>
              </>
            ) : (
              <>
                <h2>Classes &amp; points</h2>
                <p className="muted">Add or remove classes and students, then set the daily points.</p>
                <div className="admin-form" style={{ gridTemplateColumns: '1fr auto', alignItems: 'end' }}>
                  <label>New class name
                    <input value={newClass} onChange={e => setNewClass(e.target.value)} placeholder="e.g. Beginner A" onKeyDown={e => { if (e.key === 'Enter') addClass() }}/>
                  </label>
                  <button className="primary-btn" onClick={addClass}><Plus size={15}/> Add class</button>
                </div>

                {!classes.length && <p className="muted">No classes yet — add the first one above.</p>}

                <div className="class-pills">
                  {classes.map(c => (
                    <button key={c.id} className={`filter-chip ${selected?.id === c.id ? 'selected' : ''}`} onClick={() => setActiveClass(c.id)}>{c.name}</button>
                  ))}
                </div>

                {selected && (
                  <div className="teacher-class">
                    <div className="teacher-class-head">
                      <b>{selected.name}</b>
                      <button className="text-btn" onClick={() => removeClass(selected.id)}><Trash2 size={14}/> Delete class</button>
                    </div>
                    <div className="admin-form" style={{ gridTemplateColumns: '1fr auto', alignItems: 'end' }}>
                      <label>Add student
                        <input value={studentDrafts[selected.id] || ''} onChange={e => setStudentDrafts(d => ({ ...d, [selected.id]: e.target.value }))} placeholder="Student name" onKeyDown={e => { if (e.key === 'Enter') addStudent(selected.id) }}/>
                      </label>
                      <button className="primary-btn" onClick={() => addStudent(selected.id)}><Plus size={15}/> Add</button>
                    </div>
                    <label className="day-picker" style={{ marginBottom: 10 }}><CalendarDays size={15}/> Points for
                      <input type="date" value={day} onChange={e => setDay(e.target.value)}/>
                    </label>
                    <div className="point-rows">
                      {selected.students.map(s => {
                        const value = (points[s.id] || {})[day] || 0
                        return (
                          <div className="point-row" key={s.id}>
                            <span className="avatar">{s.name.slice(0, 2).toUpperCase()}</span>
                            <b>{s.name}</b>
                            <div className="stepper">
                              <button onClick={() => setPointsFor(s.id, value - 5)} aria-label="Remove five points"><Minus size={13}/></button>
                              <input type="number" value={value} onChange={e => setPointsFor(s.id, Number(e.target.value))}/>
                              <button onClick={() => setPointsFor(s.id, value + 5)} aria-label="Add five points"><Plus size={13}/></button>
                            </div>
                            <button className="icon-btn" onClick={() => removeStudent(selected.id, s.id)} aria-label="Remove student"><Trash2 size={15}/></button>
                          </div>
                        )
                      })}
                      {!selected.students.length && <p className="muted">No students yet — add one above.</p>}
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
