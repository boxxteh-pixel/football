import { format, formatDistanceToNowStrict, isToday, isTomorrow, parseISO } from 'date-fns';

export const formatKickoff = (iso: string): string => {
  const date = parseISO(iso);
  if (isToday(date)) return format(date, 'HH:mm');
  if (isTomorrow(date)) return `Tomorrow ${format(date, 'HH:mm')}`;
  return format(date, 'EEE d MMM • HH:mm');
};

export const formatRelative = (iso: string): string => {
  return formatDistanceToNowStrict(parseISO(iso), { addSuffix: true });
};

export const todayIsoDate = (): string => format(new Date(), 'yyyy-MM-dd');

export const dateIso = (date: Date): string => format(date, 'yyyy-MM-dd');
