import React, { useEffect, useState } from 'react';
import { ScrollView, Text, View } from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { Session } from '@supabase/supabase-js';
import { configured, result, supabase } from './src/core/supabase';
import { Profile, Role } from './src/core/types';
import { Button, Field, Loading, colors, styles } from './src/core/ui';
import { Timesheets } from './src/modules/timesheets/Timesheets';
import { Approvals } from './src/modules/approvals/Approvals';
import { Administration } from './src/modules/administration/Administration';

function SignIn() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  async function signIn() {
    setBusy(true); setError('');
    try { const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password }); if (error) throw error; }
    catch (e) { setError((e as Error).message); } finally { setBusy(false); }
  }
  return <View style={[styles.page, { maxWidth: 520, paddingTop: 80 }]}><Text style={[styles.label, { color: colors.teal }]}>smbERP / PEOPLE & PROJECTS</Text><Text style={[styles.title, { fontSize: 42 }]}>Make time for{ '\n' }what matters.</Text><Text style={styles.subtitle}>Your projects, your hours, one clear week.</Text><View style={styles.card}><Text style={styles.heading}>Welcome back</Text><Field label="Email" value={email} onChange={setEmail} placeholder="you@company.com" /><Field label="Password" value={password} onChange={setPassword} secret />{error ? <Text accessibilityRole="alert" style={styles.error}>{error}</Text> : null}<Button title={busy ? 'Signing in…' : 'Sign in →'} disabled={busy || !email.trim() || !password} onPress={() => { void signIn(); }} /><Text style={styles.subtitle}>Use the account provided by your administrator.</Text></View></View>;
}
function Workspace({ session }: { session: Session }) {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [roles, setRoles] = useState<Role[]>([]);
  const [page, setPage] = useState('timesheets');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    Promise.all([
      result<Profile>(supabase.from('profiles').select('*').eq('id', session.user.id).single()),
      result<{ role: Role }[]>(supabase.from('user_roles').select('role').eq('user_id', session.user.id)),
    ]).then(([p, r]) => { setProfile(p); setRoles(r.map(x => x.role)); }).catch(e => setError(e.message)).finally(() => setLoading(false));
  }, [session.user.id]);
  async function signOut() { const { error } = await supabase.auth.signOut(); if (error) setError(error.message); }
  return <><View style={{ backgroundColor: '#fff', borderBottomWidth: 1, borderColor: colors.line, padding: 20 }}><View style={[styles.row, { maxWidth: 1132, alignSelf: 'center', width: '100%', justifyContent: 'space-between' }]}><Text style={{ color: colors.teal, fontSize: 25, fontWeight: '800' }}>smbERP<Text style={{ color: colors.muted, fontSize: 13 }}>  / WORKSPACE</Text></Text><View style={styles.row}><Text style={styles.subtitle}>{profile?.display_name}</Text><Button title="Sign out" secondary onPress={() => { void signOut(); }} /></View></View></View>
    <View style={styles.page}>{loading ? <Loading /> : error || !profile?.active ? <View style={styles.card}><Text style={styles.heading}>Account unavailable</Text><Text style={styles.error}>{error || 'Ask your administrator to activate your account.'}</Text></View> : <><View style={styles.row}>{[{ id: 'timesheets', name: 'My timesheets' }, ...(roles.includes('manager') ? [{ id: 'approvals', name: 'Team approvals' }] : []), ...(roles.includes('admin') ? [{ id: 'admin', name: 'Administration' }] : [])].map(tab => <Button key={tab.id} title={tab.name} secondary={page !== tab.id} onPress={() => setPage(tab.id)} />)}</View>{page === 'timesheets' ? <Timesheets userId={session.user.id} /> : page === 'approvals' ? <Approvals userId={session.user.id} /> : <Administration userId={session.user.id} />}</>}</View>
  </>;
}
export default function App() {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  useEffect(() => {
    if (!configured) { setLoading(false); return; }
    supabase.auth.getSession().then(({ data, error }) => { if (error) setError(error.message); setSession(data.session); setLoading(false); }).catch(e => { setError(e.message); setLoading(false); });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, current) => { setSession(current); });
    return () => subscription.unsubscribe();
  }, []);
  return <SafeAreaProvider><SafeAreaView style={{ flex: 1, backgroundColor: colors.paper }}><StatusBar style="dark" /><ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ flexGrow: 1 }}>{!configured ? <View style={[styles.page, { maxWidth: 650, paddingTop: 80 }]}><Text style={styles.title}>Welcome to smbERP.</Text><View style={styles.card}><Text style={styles.heading}>Connect your workspace</Text><Text style={styles.subtitle}>Copy .env.example to .env, set your Supabase project URL and publishable key, then restart Expo. Apply the database migration before signing in.</Text><Text style={styles.subtitle}>See README.md for the setup steps.</Text></View></View> : loading ? <Loading /> : error ? <Text style={[styles.error, { padding: 30 }]}>{error}</Text> : session ? <Workspace key={session.user.id} session={session} /> : <SignIn />}</ScrollView></SafeAreaView></SafeAreaProvider>;
}
