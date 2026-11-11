import React, { useEffect, useState } from 'react';
import { Text, View } from 'react-native';
import { result, supabase } from '../../core/supabase';
import { Activity, Assignment, Profile, Project, Role } from '../../core/types';
import { Button, Choice, Field, Loading, styles } from '../../core/ui';

export function Administration({ userId }: { userId: string }) {
  const [people, setPeople] = useState<Profile[]>([]);
  const [roles, setRoles] = useState<{ user_id: string; role: Role }[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [activities, setActivities] = useState<Activity[]>([]);
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [person, setPerson] = useState('');
  const [name, setName] = useState('');
  const [manager, setManager] = useState('');
  const [project, setProject] = useState('');
  const [code, setCode] = useState('');
  const [projectName, setProjectName] = useState('');
  const [activityCode, setActivityCode] = useState('');
  const [activityName, setActivityName] = useState('');
  const [busy, setBusy] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  async function load() {
    const [ps, rs, projs, acts, assigned] = await Promise.all([
      result<Profile[]>(supabase.from('profiles').select('*').order('display_name')),
      result<{ user_id: string; role: Role }[]>(supabase.from('user_roles').select('*')),
      result<Project[]>(supabase.from('projects').select('*').order('name')),
      result<Activity[]>(supabase.from('project_activities').select('*').order('name')),
      result<Assignment[]>(supabase.from('project_assignments').select('*')),
    ]);
    setPeople(ps); setRoles(rs); setProjects(projs); setActivities(acts); setAssignments(assigned);
  }
  useEffect(() => { load().catch(e => setError(e.message)).finally(() => setBusy(false)); }, []);
  async function action(work: () => Promise<void>) {
    setBusy(true); setError(''); setNotice('');
    try { await work(); await load(); setNotice('Changes saved.'); } catch (e) { setError((e as Error).message); } finally { setBusy(false); }
  }
  const selected = people.find(p => p.id === person);
  return <View style={{ gap: 22 }}><Text style={styles.label}>WORKSPACE / ADMINISTRATION</Text><Text style={styles.title}>Set your team up for good work.</Text><Text style={styles.subtitle}>Manage people, project activities, and access in one place.</Text>
    {error ? <Text accessibilityRole="alert" style={styles.error}>{error}</Text> : null}{notice ? <Text accessibilityLiveRegion="polite" style={styles.subtitle}>{notice}</Text> : null}{busy && <Loading />}
    <View style={styles.card}><Text style={styles.heading}>People & approving managers</Text><Text style={styles.subtitle}>Create employee sign-in accounts in Supabase Authentication. Their profiles appear here automatically.</Text>
      <Choice label="Employee" value={person} options={people.map(p => ({ id: p.id, name: `${p.display_name}${p.active ? '' : ' (inactive)'}` }))} onChange={id => { const p = people.find(x => x.id === id)!; setPerson(id); setName(p.display_name); setManager(p.manager_id || ''); }} />
      {selected && <><Field label="Display name" value={name} onChange={setName} /><Choice label="Approving manager" value={manager} options={[{ id: '', name: 'Unassigned' }, ...people.filter(p => p.id !== person && p.active && roles.some(r => r.user_id === p.id && r.role === 'manager')).map(p => ({ id: p.id, name: p.display_name }))]} onChange={setManager} />
        <View style={styles.row}><Button title="Save employee" disabled={busy || !name.trim()} onPress={() => { void action(async () => { await result(supabase.from('profiles').update({ display_name: name.trim(), manager_id: manager || null }).eq('id', person)); }); }} /><Button title={selected.active ? 'Deactivate employee' : 'Activate employee'} secondary disabled={busy || person === userId} onPress={() => { void action(async () => { await result(supabase.from('profiles').update({ active: !selected.active }).eq('id', person)); }); }} /></View>
        <Text style={styles.label}>Roles</Text><View style={styles.row}>{(['employee', 'manager', 'admin'] as Role[]).map(role => {
          const enabled = roles.some(r => r.user_id === person && r.role === role);
          return <Button key={role} title={`${enabled ? '✓ ' : '+ '}${role}`} secondary={!enabled} disabled={busy || (person === userId && role === 'admin')} onPress={() => { void action(async () => {
            if (enabled) await result(supabase.from('user_roles').delete().eq('user_id', person).eq('role', role));
            else await result(supabase.from('user_roles').insert({ user_id: person, role }));
          }); }} />;
        })}</View></>}
    </View>
    <View style={styles.card}><Text style={styles.heading}>Projects</Text><View style={styles.row}><Field label="Project code" value={code} onChange={setCode} /><Field label="Project name" value={projectName} onChange={setProjectName} /><Button title="Create project" disabled={busy || !code.trim() || !projectName.trim()} onPress={() => { void action(async () => { await result(supabase.from('projects').insert({ code: code.trim(), name: projectName.trim() })); setCode(''); setProjectName(''); }); }} /></View>
      <Choice label="Manage project" value={project} options={projects.map(p => ({ id: p.id, name: `${p.code} · ${p.name}${p.active ? '' : ' (inactive)'}` }))} onChange={setProject} />
      {project && <Button title={projects.find(p => p.id === project)?.active ? 'Deactivate project' : 'Activate project'} secondary disabled={busy} onPress={() => { void action(async () => { await result(supabase.from('projects').update({ active: !projects.find(p => p.id === project)?.active }).eq('id', project)); }); }} />}
    </View>
    {project && <View style={styles.card}><Text style={styles.heading}>Project activities</Text><Text style={styles.subtitle}>Every activity is available to everyone assigned to this project.</Text><View style={styles.row}><Field label="Activity code" value={activityCode} onChange={setActivityCode} /><Field label="Activity name" value={activityName} onChange={setActivityName} /><Button title="Add activity" disabled={busy || !activityCode.trim() || !activityName.trim()} onPress={() => { void action(async () => { await result(supabase.from('project_activities').insert({ project_id: project, code: activityCode.trim(), name: activityName.trim() })); setActivityCode(''); setActivityName(''); }); }} /></View>
      {activities.filter(a => a.project_id === project).map(a => <View key={a.id} style={[styles.row, { justifyContent: 'space-between' }]}><Text style={styles.subtitle}>{a.code} · {a.name}</Text><Button title={a.active ? 'Deactivate' : 'Activate'} secondary disabled={busy} onPress={() => { void action(async () => { await result(supabase.from('project_activities').update({ active: !a.active }).eq('id', a.id)); }); }} /></View>)}
    </View>}
    {person && project && <View style={styles.card}><Text style={styles.heading}>Project assignment</Text><Text style={styles.subtitle}>{selected?.display_name} → {projects.find(p => p.id === project)?.name}</Text><Button title={assignments.some(a => a.employee_id === person && a.project_id === project && a.active) ? 'Remove project access' : 'Assign project'} disabled={busy} onPress={() => { void action(async () => {
      const existing = assignments.find(a => a.employee_id === person && a.project_id === project);
      await result(supabase.from('project_assignments').upsert({ ...(existing ? { id: existing.id } : {}), employee_id: person, project_id: project, active: !existing?.active }, { onConflict: 'employee_id,project_id' }));
    }); }} /></View>}
  </View>;
}
