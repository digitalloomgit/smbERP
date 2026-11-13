import React, { useState } from 'react';
import { Modal, Pressable, ScrollView, Text, View } from 'react-native';
import { Button, colors, styles } from '../../core/ui';
import { formatDate } from '../../core/dates';
import { monday, shiftDate } from './domain';

export function Dropdown({ label, value, options, onChange }: { label: string; value: string; options: { id: string; name: string }[]; onChange: (id: string) => void }) {
  const [open, setOpen] = useState(false);
  return <View style={{ flex: 1, minWidth: 180, gap: 7 }}><Text style={styles.label}>{label}</Text>
    <Pressable accessibilityRole="button" accessibilityLabel={label} accessibilityState={{ expanded: open }} onPress={() => setOpen(true)} style={styles.input}><Text style={{ color: colors.ink }}>{options.find(o => o.id === value)?.name || 'Select…'} ▾</Text></Pressable>
    <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}><View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#0006', padding: 24 }}><View style={[styles.card, { width: '100%', maxWidth: 480, maxHeight: '80%' }]}><Text style={styles.heading}>{label}</Text><ScrollView>{options.map(o => <Pressable key={o.id} accessibilityRole="radio" accessibilityState={{ selected: value === o.id }} onPress={() => { onChange(o.id); setOpen(false); }} style={{ padding: 15, backgroundColor: value === o.id ? '#e4f1eb' : '#fff' }}><Text style={styles.subtitle}>{o.name}</Text></Pressable>)}{!options.length && <Text style={styles.subtitle}>No options available.</Text>}</ScrollView><Button title="Close" secondary onPress={() => setOpen(false)} /></View></View></Modal>
  </View>;
}

export function Calendar({ value, min, max, onChange }: { value: string; min: string; max: string; onChange: (date: string) => void }) {
  const [open, setOpen] = useState(false);
  const [month, setMonth] = useState(value.slice(0, 7) + '-01');
  const start = monday(month);
  const move = (offset: number) => {
    const date = new Date(`${month}T12:00:00`);
    date.setMonth(date.getMonth() + offset);
    setMonth(`${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-01`);
  };
  return <View style={{ gap: 8, maxWidth: 360 }}><Text style={styles.label}>Work date</Text><Button title={`${formatDate(value)} ▾`} secondary onPress={() => { setMonth(value.slice(0, 7) + '-01'); setOpen(!open); }} />
    {open && <View style={[styles.card, { padding: 12 }]}><View style={[styles.row, { justifyContent: 'space-between' }]}><Button title="‹" secondary onPress={() => move(-1)} /><Text style={{ color: colors.ink }}>{new Date(`${month}T12:00:00`).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}</Text><Button title="›" secondary onPress={() => move(1)} /></View>
      <View style={{ flexDirection: 'row' }}>{['Mo','Tu','We','Th','Fr','Sa','Su'].map(day => <Text key={day} style={{ width: '14.2857%', textAlign: 'center', color: colors.muted }}>{day}</Text>)}</View>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>{Array.from({ length: 42 }, (_, i) => shiftDate(start, i)).map(day => {
        const disabled = day < min || day > max;
        return <Pressable key={day} accessibilityRole="button" accessibilityLabel={formatDate(day)} accessibilityState={{ disabled, selected: value === day }} disabled={disabled} onPress={() => { onChange(day); setOpen(false); }} style={{ width: '14.2857%', paddingVertical: 12, borderRadius: 6, backgroundColor: value === day ? colors.teal : 'transparent', opacity: disabled ? 0.25 : 1 }}><Text style={{ textAlign: 'center', color: value === day ? '#fff' : colors.ink }}>{Number(day.slice(-2))}</Text></Pressable>;
      })}</View><Text style={styles.subtitle}>Select a date in this week, up to today.</Text></View>}
  </View>;
}
