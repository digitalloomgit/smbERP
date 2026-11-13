import React, { useEffect, useState } from 'react';
import { Text, View } from 'react-native';
import { formatDate, formatTimestamp } from '../../core/dates';
import { supabase, result } from '../../core/supabase';
import { Activity, Entry, Project, Sheet, SheetEvent } from '../../core/types';
import { Badge, Button, Field, Loading, colors, styles } from '../../core/ui';
import { dateKey, editable, monday, parseHours, shiftDate, sumHours, unusualHours, weekDays } from './domain';

import { Calendar, Dropdown } from './EntryControls';

type EntryRow = { key: string; project: string; activity: string; hours: string; description: string };
let rowSequence = 0;
const emptyRow = (): EntryRow => ({ key: String(++rowSequence), project: '', activity: '', hours: '', description: '' });

export function EntryList({ entries, projects, activities, onEdit, onDelete }: {
  entries: Entry[]; projects: Project[]; activities: Activity[]; onEdit?: (entry: Entry) => void; onDelete?: (entry: Entry) => void;
}) {
  return <View style={{ gap: 12 }}>{!entries.length && <Text style={styles.subtitle}>No time recorded yet.</Text>}{entries.map(e => <View key={e.id} style={{ borderBottomWidth: 1, borderColor: colors.line, paddingVertical: 12, gap: 8 }}>
    <View style={[styles.row, { justifyContent: 'space-between' }]}><View style={{ flex: 1, minWidth: 180, gap: 5 }}><Text style={styles.heading}>{projects.find(p => p.id === e.project_id)?.name || 'Project'} · {activities.find(a => a.id === e.activity_id)?.name || 'Activity'}</Text><Text style={styles.subtitle}>{formatDate(e.work_date)}{e.description ? ` · ${e.description}` : ''}</Text></View><Text style={{ color: unusualHours(Number(e.hours)) ? colors.red : colors.ink, fontWeight: '700', fontSize: 24 }}>{e.hours} h</Text></View>
    {unusualHours(Number(e.hours)) && <Text style={styles.error}>Hours are outside the usual 1–8 range. This entry is allowed.</Text>}
    {onEdit && <View style={styles.row}><Button title="Edit" secondary onPress={() => onEdit(e)} /><Button title="Delete" secondary onPress={() => onDelete?.(e)} /></View>}
  </View>)}</View>;
}
export function History({ events }: { events: SheetEvent[] }) {
  return <View style={styles.card}><Text style={styles.heading}>Approval history</Text>{!events.length && <Text style={styles.subtitle}>Your submission and review history will appear here.</Text>}{events.map(e => <View key={e.id} style={{ gap: 5 }}><Text style={{ color: colors.ink, fontWeight: '600', textTransform: 'capitalize' }}>{e.kind} · submission {e.version}</Text><Text style={styles.subtitle}>{formatTimestamp(e.created_at)}</Text>{e.reason && <Text style={{ color: colors.ink }}>{e.reason}</Text>}</View>)}</View>;
}

export function Timesheets({ userId }: { userId: string }) {
  const [week, setWeek] = useState(monday(dateKey(new Date())));
  const [sheet, setSheet] = useState<Sheet | null>(null);
  const [entries, setEntries] = useState<Entry[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [activities, setActivities] = useState<Activity[]>([]);
  const [assigned, setAssigned] = useState<string[]>([]);
  const [events, setEvents] = useState<SheetEvent[]>([]);
  const [date, setDate] = useState(dateKey(new Date()));
  const [rows, setRows] = useState<EntryRow[]>(() => [emptyRow()]);
  function updateRow(key: string, change: Partial<EntryRow>) { setRows(current => current.map(row => row.key === key ? { ...row, ...change } : row)); setConfirmation(false); }
  const [editing, setEditing] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [confirmation, setConfirmation] = useState(false);

  async function load() {
    const found = await result<Sheet[]>(supabase.from('timesheets').select('*').eq('employee_id', userId).eq('week_start', week));
    const current = found[0] || null;
    const [ps, acts, assignments, es, history] = await Promise.all([
      result<Project[]>(supabase.from('projects').select('*').order('name')),
      result<Activity[]>(supabase.from('project_activities').select('*').order('name')),
      result<{ project_id: string }[]>(supabase.from('project_assignments').select('project_id').eq('employee_id', userId).eq('active', true)),
      current ? result<Entry[]>(supabase.from('time_entries').select('*').eq('timesheet_id', current.id).order('work_date')) : Promise.resolve([]),
      current ? result<SheetEvent[]>(supabase.from('timesheet_events').select('*').eq('timesheet_id', current.id).order('created_at', { ascending: false })) : Promise.resolve([]),
    ]);
    setSheet(current); setProjects(ps); setActivities(acts); setAssigned(assignments.map(a => a.project_id)); setEntries(es); setEvents(history);
  }
  useEffect(() => {
    setLoading(true); setError(''); setConfirmation(false); reset(); setDate(week);
    load().catch(e => setError(e.message)).finally(() => setLoading(false));
  }, [week, userId]);
  function reset() { setEditing(null); setRows([emptyRow()]); }
  async function action(work: () => Promise<void>) {
    setBusy(true); setError(''); setNotice('');
    try { await work(); await load(); } catch (e) { setError((e as Error).message); } finally { setBusy(false); }
  }
  async function save() {
    if (date < week || date > shiftDate(week, 6) || date > dateKey(new Date())) throw new Error('Select a work date in this week, up to today.');
    const seen = new Set<string>();
    const parsed = rows.map((row, index) => {
      if (!row.project || !row.activity) throw new Error(`Row ${index + 1}: select a project and activity.`);
      const key = `${row.project}:${row.activity}`;
      if (seen.has(key) || entries.some(e => e.id !== editing && e.work_date === date && e.project_id === row.project && e.activity_id === row.activity)) throw new Error(`Row ${index + 1}: this date, project and activity already have an entry. Edit that entry instead.`);
      seen.add(key);
      return { ...row, parsedHours: parseHours(row.hours) };
    });
    const id = sheet?.id || await result<string>(supabase.rpc('open_week', { p_week: week }));
    let saved = 0;
    try {
      for (const row of parsed) {
        await result(supabase.rpc('save_entry', { p_sheet: id, p_date: date, p_project: row.project, p_activity: row.activity, p_hours: row.parsedHours, p_description: row.description, p_entry: editing }));
        saved++;
        setRows(current => current.filter(r => r.key !== row.key));
      }
    } catch (error) {
      await load();
      throw new Error(`${saved} row(s) saved. Remaining rows were kept. ${(error as Error).message}`);
    }
    reset(); setNotice(`${saved} time entry row(s) saved.`);
  }
  const hasUnsavedRows = rows.some(row => row.project || row.activity || row.hours || row.description);

  const canEdit = !sheet || editable(sheet.status);
  const availableProjects = projects.filter(p => p.active && assigned.includes(p.id));
  const latestReturn = events.find(e => e.kind === 'returned');
  return <View style={{ gap: 22 }}>
    <View style={[styles.row, { justifyContent: 'space-between' }]}><View style={{ gap: 7 }}><Text style={styles.label}>WORKSPACE / TIMESHEETS</Text><Text style={styles.title}>Your week, accounted for.</Text><Text style={styles.subtitle}>Record your work. Submit one complete week.</Text></View><Badge value={sheet?.status || 'draft'} /></View>
    <View style={styles.card}><View style={[styles.row, { justifyContent: 'space-between' }]}><View style={styles.row}><Button title="← Previous" secondary disabled={busy || loading} onPress={() => setWeek(shiftDate(week, -7))} /><Text style={styles.heading}>{formatDate(week)} — {formatDate(shiftDate(week, 6))}</Text><Button title="Next →" secondary disabled={busy || loading} onPress={() => setWeek(shiftDate(week, 7))} /></View><Text style={{ color: colors.teal, fontSize: 28, fontWeight: '700' }}>{sumHours(entries)} h</Text></View><Text style={styles.subtitle}>Monday – Sunday · Weekly total</Text></View>
    {error ? <Text accessibilityRole="alert" style={styles.error}>{error}</Text> : null}{notice ? <Text accessibilityLiveRegion="polite" style={{ color: colors.teal }}>{notice}</Text> : null}
    {loading ? <Loading /> : <>
      {sheet?.status === 'returned' && latestReturn && <View style={[styles.card, { backgroundColor: '#fff7ed' }]}><Text style={styles.heading}>Changes requested</Text><Text style={styles.subtitle}>{latestReturn.reason}</Text></View>}
      <View style={styles.row}>{weekDays(week).map(day => <View key={day} style={[styles.card, { flex: 1, minWidth: 100, padding: 15 }]}><Text style={styles.label}>{new Date(`${day}T12:00:00`).toLocaleDateString('en-US', { weekday: 'short' })}</Text><Text style={{ color: colors.ink, fontSize: 22, fontWeight: '600' }}>{sumHours(entries.filter(e => e.work_date === day))} h</Text></View>)}</View>
      <View style={styles.card}><Text style={styles.heading}>Recorded time</Text><EntryList entries={entries} projects={projects} activities={activities} onEdit={canEdit && !busy ? e => { setEditing(e.id); setDate(e.work_date); setRows([{ key: String(++rowSequence), project: e.project_id, activity: e.activity_id, hours: String(e.hours), description: e.description }]); setConfirmation(false); } : undefined} onDelete={e => { void action(async () => { await result(supabase.rpc('delete_entry', { p_sheet: sheet!.id, p_entry: e.id })); if (editing === e.id) reset(); }); }} /></View>
      {canEdit ? <View style={styles.card}><Text style={styles.heading}>{editing ? 'Edit time entry' : 'Add time entry'}</Text>
        <View pointerEvents={busy ? 'none' : 'auto'} style={{ gap: 16, opacity: busy ? 0.5 : 1 }}>
          <Calendar value={date} min={week} max={dateKey(new Date()) < shiftDate(week, 6) ? dateKey(new Date()) : shiftDate(week, 6)} onChange={value => { setDate(value); setConfirmation(false); }} />
          {!availableProjects.length && <Text style={styles.subtitle}>Ask your administrator to assign an active project.</Text>}
          {rows.map((row, index) => <View key={row.key} style={{ gap: 10, borderTopWidth: 1, borderColor: colors.line, paddingTop: 14 }}>
            <Text style={styles.label}>Entry {index + 1}</Text>
            <View style={[styles.row, { alignItems: 'flex-start' }]}>
              <Dropdown label="Assigned project" value={row.project} options={availableProjects} onChange={project => updateRow(row.key, { project, activity: '' })} />
              <Dropdown label="Project activity" value={row.activity} options={activities.filter(a => a.project_id === row.project && a.active)} onChange={activity => updateRow(row.key, { activity })} />
              <View style={{ width: 110 }}><Field label="Hours" value={row.hours} onChange={hours => updateRow(row.key, { hours })} numeric placeholder="7.5" /></View>
              <View style={{ flex: 2, minWidth: 200 }}><Field multiline label="Description (optional)" value={row.description} onChange={description => updateRow(row.key, { description })} placeholder="What did you work on?" /></View>
              {!editing && rows.length > 1 && <Button title="Remove row" secondary onPress={() => setRows(current => current.filter(r => r.key !== row.key))} />}
            </View>
            {row.hours && Number.isFinite(Number(row.hours)) && unusualHours(Number(row.hours)) ? <Text style={styles.error}>Below 1 or above 8 hours. You can still save and submit.</Text> : null}
          </View>)}
        </View>
        <View style={styles.row}>{!editing && <Button title="+ Add row" secondary disabled={busy} onPress={() => setRows(current => [...current, emptyRow()])} />}<Button title={busy ? 'Saving…' : editing ? 'Save entry' : 'Save entries'} disabled={busy} onPress={() => { void action(save); }} /><Button title={editing ? 'Cancel edit' : 'Clear rows'} secondary disabled={busy} onPress={reset} /></View>
      </View> : <Text style={styles.subtitle}>This {sheet?.status} timesheet is locked. Returned timesheets become editable.</Text>}
      {canEdit && entries.length > 0 && <View style={styles.card}><Text style={styles.heading}>Ready for review?</Text><Text style={styles.subtitle}>Submit the entire week to your designated manager. Entries will be locked until the timesheet is returned.</Text>{editing && <Text style={styles.error}>Save or cancel your current edit before submitting.</Text>}{confirmation ? <View style={{ gap: 12 }}><Text style={styles.subtitle}>Submit {sumHours(entries)} hours for {formatDate(week)} through {formatDate(shiftDate(week, 6))}?</Text><View style={styles.row}><Button title="Confirm submission" disabled={busy} onPress={() => { void action(async () => { await result(supabase.rpc('submit_week', { p_sheet: sheet!.id })); setConfirmation(false); setNotice('Weekly timesheet submitted to your manager.'); }); }} /><Button title="Keep editing" secondary disabled={busy} onPress={() => setConfirmation(false)} /></View></View> : <Button title="Submit weekly timesheet →" disabled={busy || Boolean(editing) || hasUnsavedRows} onPress={() => setConfirmation(true)} />}</View>}
      <History events={events} />
    </>}
  </View>;
}
