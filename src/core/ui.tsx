import React from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

export const colors = { ink: '#172a35', muted: '#637680', teal: '#12685d', paper: '#f3f5f4', line: '#dce5e1', red: '#b42335' };
export const styles = StyleSheet.create({
  page: { gap: 22, width: '100%', maxWidth: 1180, alignSelf: 'center', padding: 24, paddingBottom: 70 },
  card: { backgroundColor: '#fff', borderWidth: 1, borderColor: colors.line, borderRadius: 16, padding: 22, gap: 15 },
  title: { fontSize: 30, fontWeight: '700', color: colors.ink },
  subtitle: { fontSize: 16, color: colors.muted, lineHeight: 24 },
  heading: { fontSize: 19, fontWeight: '600', color: colors.ink },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, alignItems: 'center' },
  label: { color: colors.muted, fontSize: 12, fontWeight: '700', letterSpacing: 1, textTransform: 'uppercase' },
  input: { borderColor: colors.line, borderWidth: 1, backgroundColor: '#fbfcfb', color: colors.ink, padding: 13, borderRadius: 9, fontSize: 16, minWidth: 100 },
  error: { color: colors.red, lineHeight: 22 },
});
export function Button({ title, onPress, disabled = false, secondary = false }: { title: string; onPress: () => void; disabled?: boolean; secondary?: boolean }) {
  return <Pressable accessibilityRole="button" accessibilityState={{ disabled }} disabled={disabled} onPress={onPress} style={({ pressed }) => ({ paddingVertical: 12, paddingHorizontal: 18, borderRadius: 9, backgroundColor: secondary ? '#eaf1ee' : colors.teal, opacity: disabled ? 0.4 : pressed ? 0.7 : 1 })}><Text style={{ color: secondary ? colors.teal : '#fff', fontWeight: '600' }}>{title}</Text></Pressable>;
}
export function Field({ label, value, onChange, secret = false, numeric = false, placeholder }: { label: string; value: string; onChange: (value: string) => void; secret?: boolean; numeric?: boolean; placeholder?: string }) {
  return <View style={{ gap: 7, flexGrow: 1 }}><Text style={styles.label}>{label}</Text><TextInput accessibilityLabel={label} value={value} onChangeText={onChange} secureTextEntry={secret} keyboardType={numeric ? 'decimal-pad' : 'default'} autoCapitalize="none" placeholder={placeholder} style={styles.input} /></View>;
}
export function Choice({ label, value, options, onChange }: { label: string; value: string; options: { id: string; name: string }[]; onChange: (id: string) => void }) {
  return <View style={{ gap: 9 }}><Text style={styles.label}>{label}</Text><View style={styles.row}>{options.map(o => <Pressable accessibilityRole="radio" accessibilityState={{ selected: value === o.id }} key={o.id} onPress={() => onChange(o.id)} style={{ padding: 10, borderRadius: 8, backgroundColor: value === o.id ? colors.teal : '#edf2ef' }}><Text style={{ color: value === o.id ? '#fff' : colors.ink }}>{o.name}</Text></Pressable>)}{!options.length && <Text style={styles.subtitle}>No options available.</Text>}</View></View>;
}
export function Badge({ value }: { value: string }) {
  return <View style={{ paddingHorizontal: 11, paddingVertical: 6, borderRadius: 20, backgroundColor: value === 'returned' ? '#fff0df' : '#e4f1eb' }}><Text style={{ color: value === 'returned' ? '#92541d' : colors.teal, fontWeight: '600', textTransform: 'capitalize' }}>{value}</Text></View>;
}
export function Loading() { return <ActivityIndicator accessibilityLabel="Loading" color={colors.teal} style={{ padding: 40 }} />; }
