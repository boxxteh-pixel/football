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

/**
 * Rolling "live + upcoming" window used by the home screen and the prediction
 * batch. Defined relative to NOW (not a calendar day) so it is fully
 * timezone-proof: a 01:00 local kickoff that lives in the previous UTC date
 * bucket is still captured, instead of vanishing after local midnight.
 */
export const MATCH_WINDOW_PAST_MS = 3.5 * 60 * 60 * 1000; // keep in-play games (~kicked off up to 3.5h ago)
export const MATCH_WINDOW_FUTURE_MS = 5 * 24 * 60 * 60 * 1000; // 5 days lookahead

/** True if a kickoff (unix seconds) falls in the current live+upcoming window. */
export const inMatchWindow = (tsSeconds: number, now: number = Date.now()): boolean => {
  const ts = tsSeconds * 1000;
  return ts >= now - MATCH_WINDOW_PAST_MS && ts <= now + MATCH_WINDOW_FUTURE_MS;
};
