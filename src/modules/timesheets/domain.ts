export function dateKey(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}
export function shiftDate(day: string, offset: number): string {
  const date = new Date(`${day}T12:00:00`);
  date.setDate(date.getDate() + offset);
  return dateKey(date);
}
export function monday(day: string): string {
  const date = new Date(`${day}T12:00:00`);
  return shiftDate(day, -((date.getDay() + 6) % 7));
}
export const weekDays = (start: string) => Array.from({ length: 7 }, (_, i) => shiftDate(start, i));
export const unusualHours = (hours: number) => hours < 1 || hours > 8;
export function parseHours(value: string): number {
  if (!/^\d+(\.\d{1,2})?$/.test(value.trim())) throw new Error('Enter positive hours with up to two decimal places.');
  const hours = Number(value);
  if (!Number.isFinite(hours) || hours <= 0) throw new Error('Hours must be greater than zero.');
  return hours;
}
export const editable = (status: string) => status === 'draft' || status === 'returned';
export const sumHours = (entries: { hours: number }[]) => Math.round(entries.reduce((sum, e) => sum + Number(e.hours), 0) * 100) / 100;
