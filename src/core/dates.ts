export const DATE_FORMATS = ['MM/DD/YYYY', 'DD/MM/YYYY', 'YYYY-MM-DD'] as const;
export type DateFormat = typeof DATE_FORMATS[number];

export function resolveDateFormat(value?: string): DateFormat {
  const normalized = value?.trim().toUpperCase();
  return DATE_FORMATS.find(format => format === normalized) ?? 'MM/DD/YYYY';
}

export const dateFormat = resolveDateFormat(process.env.EXPO_PUBLIC_DATE_FORMAT);

// Calendar dates remain strings so timezone conversion cannot move the day.
export function formatDate(value: string, format: DateFormat = dateFormat): string {
  const [year, month, day] = value.split('-');
  return format.replace('YYYY', year).replace('MM', month).replace('DD', day);
}

export function formatTimestamp(value: string): string {
  const date = new Date(value);
  const localDate = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
  return `${formatDate(localDate)} ${date.toLocaleTimeString()}`;
}
