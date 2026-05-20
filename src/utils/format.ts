export const formatPercent = (value: number, digits = 0): string => {
  if (Number.isNaN(value)) return '—';
  return `${value.toFixed(digits)}%`;
};

export const formatOdds = (probability: number): string => {
  if (probability <= 0) return '—';
  const decimal = 1 / (probability / 100);
  return decimal.toFixed(2);
};

export const formatScore = (home: number | null, away: number | null): string => {
  if (home === null || away === null) return '— : —';
  return `${home} : ${away}`;
};

export const teamShortCode = (name: string): string => {
  if (!name) return '';
  const cleaned = name.replace(/\b(FC|CF|AC|SC|RC|Football Club|Club|United|City)\b/gi, '').trim();
  const parts = cleaned.split(/\s+/).filter(Boolean);
  if (parts.length === 1) return parts[0].slice(0, 3).toUpperCase();
  return parts
    .slice(0, 3)
    .map((p) => p[0])
    .join('')
    .toUpperCase();
};

export const clamp = (value: number, min: number, max: number): number =>
  Math.min(Math.max(value, min), max);

export const clampPercent = (value: number): number => clamp(value, 0, 100);

export const truncate = (text: string, max = 24): string =>
  text.length <= max ? text : `${text.slice(0, max - 1)}…`;
