import React, { useEffect, useState } from 'react';
import { Text, View } from 'react-native';
import { formatDate } from '../../core/dates';
import { result, supabase } from '../../core/supabase';
import { Activity, Entry, Profile, Project, Sheet, SheetEvent } from '../../core/types';
import { Badge, Button, Field, Loading, styles } from '../../core/ui';
import { EntryList, History } from '../timesheets/Timesheets';
import { shiftDate, sumHours } from '../timesheets/domain';

export function Approvals({ userId }: { userId: string }) {
  const [sheets, setSheets] = useState<Sheet[]>([]);
  const [people, setPeople] = useState<Profile[]>([]);
  const [selected, setSelected] = useState<Sheet | null>(null);
  const [entries, setEntries] = useState<Entry[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [activities, setActivities] = useState<Activity[]>([]);
  const [events, setEvents] = useState<SheetEvent[]>([]);
  const [reason, setReason] = useState('');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState(true);
  async function load() {
    const [ss, ps] = await Promise.all([result<Sheet[]>(supabase.from('timesheets').select('*').eq('approver_id', userId).eq('status', 'submitted').order('week_start')), result<Profile[]>(supabase.from('profiles').select('*'))]);
    setSheets(ss); setPeople(ps);
  }
  useEffect(() => { load().catch(e => setError(e.message)).finally(() => setBusy(false)); }, [userId]);
  async function open(sheet: Sheet) {
    setBusy(true); setError(''); setSelected(null); setReason('');
    try {
      const [es, ps, acts, history] = await Promise.all([
        result<Entry[]>(supabase.from('time_entries').select('*').eq('timesheet_id', sheet.id).order('work_date')),
        result<Project[]>(supabase.from('projects').select('*')), result<Activity[]>(supabase.from('project_activities').select('*')),
        result<SheetEvent[]>(supabase.from('timesheet_events').select('*').eq('timesheet_id', sheet.id).order('created_at', { ascending: false })),
      ]);
      setEntries(es); setProjects(ps); setActivities(acts); setEvents(history); setSelected(sheet);
    } catch (e) { setError((e as Error).message); } finally { setBusy(false); }
  }
  async function decide(action: 'approved' | 'returned') {
    if (!selected) return;
    setBusy(true); setError(''); setNotice('');
    try {
      await result(supabase.rpc('decide_week', { p_sheet: selected.id, p_version: selected.version, p_action: action, p_reason: reason }));
      setSelected(null); setReason(''); setNotice(`Weekly timesheet ${action}.`); await load();
    } catch (e) { setError((e as Error).message); } finally { setBusy(false); }
  }
  return <View style={{ gap: 22 }}><Text style={styles.label}>WORKSPACE / APPROVALS</Text><Text style={styles.title}>Team time, ready for review.</Text><Text style={styles.subtitle}>Review each complete week, then approve or return it with a reason.</Text>
    {error ? <Text accessibilityRole="alert" style={styles.error}>{error}</Text> : null}{notice ? <Text style={styles.subtitle}>{notice}</Text> : null}
    <Button title="Refresh queue" secondary disabled={busy} onPress={() => { setBusy(true); setSelected(null); load().catch(e => setError(e.message)).finally(() => setBusy(false)); }} />
    {busy && <Loading />}{!busy && !sheets.length && <View style={styles.card}><Text style={styles.heading}>You're all caught up.</Text><Text style={styles.subtitle}>Submitted weeks assigned to you will appear here.</Text></View>}
    {sheets.map(s => <View key={s.id} style={styles.card}><View style={[styles.row, { justifyContent: 'space-between' }]}><View style={{ gap: 7 }}><Text style={styles.heading}>{people.find(p => p.id === s.employee_id)?.display_name || 'Employee'}</Text><Text style={styles.subtitle}>{formatDate(s.week_start)} — {formatDate(shiftDate(s.week_start, 6))}</Text></View><Badge value={s.status} /><Button title="Review week" disabled={busy} onPress={() => { void open(s); }} /></View></View>)}
    {selected && <><View style={styles.card}><Text style={styles.heading}>Weekly review · {sumHours(entries)} h</Text><EntryList entries={entries} projects={projects} activities={activities} /><Field label="Reason for returning (required to return)" value={reason} onChange={setReason} /><View style={styles.row}><Button title="Approve entire week" disabled={busy} onPress={() => { void decide('approved'); }} /><Button title="Return for correction" secondary disabled={busy || !reason.trim()} onPress={() => { void decide('returned'); }} /></View></View><History events={events} /></>}
  </View>;
}
