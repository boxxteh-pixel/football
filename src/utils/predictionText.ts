type Translator = (key: string) => string;

const interpolate = (template: string, values: Record<string, string>): string =>
  Object.entries(values).reduce(
    (text, [key, value]) => text.replace(`{${key}}`, value),
    template,
  );

export const formatPredictionSelection = (selection: string, t: Translator): string => {
  const winMatch = selection.match(/^(.+)\s+to Win$/i);
  if (winMatch) {
    return interpolate(t('prediction.win'), { team: winMatch[1] });
  }

  if (/^draw$/i.test(selection)) return t('prediction.draw');
  if (/^both teams to score$/i.test(selection)) return t('prediction.bothTeamsToScore');

  const overMatch = selection.match(/^Over\s+([\d.]+)\s+Goals$/i);
  if (overMatch) {
    return interpolate(t('prediction.overGoals'), { line: overMatch[1] });
  }

  const underMatch = selection.match(/^Under\s+([\d.]+)\s+Goals$/i);
  if (underMatch) {
    return interpolate(t('prediction.underGoals'), { line: underMatch[1] });
  }

  return selection;
};

export const formatReasoningLine = (line: string, t: Translator): string => {
  let match = line.match(/^Sportmonks Pro AI predicts a (\d+)% probability for this match outcome\.$/);
  if (match) return interpolate(t('reason.sportmonks'), { pct: match[1] });

  match = line.match(/^(.+) on a (\d+)-match win streak at home\.$/);
  if (match) return interpolate(t('reason.homeWinStreak'), { team: match[1], count: match[2] });

  match = line.match(/^(.+) riding a (\d+)-game win streak\.$/);
  if (match) return interpolate(t('reason.awayWinStreak'), { team: match[1], count: match[2] });

  match = line.match(/^ELO gap of \+(\d+) favors (.+)\.$/);
  if (match) return interpolate(t('reason.eloGap'), { gap: match[1], team: match[2] });

  match = line.match(/^Expected goal total ([\d.]+)/);
  if (match) return interpolate(t('reason.goalsStrong'), { total: match[1] });

  if (line.startsWith('Both attacks averaging > 1 goal')) return t('reason.bttsLikely');

  match = line.match(/^(.+) won (\d+) of last (\d+) H2H\.$/);
  if (match) return interpolate(t('reason.h2hWins'), { team: match[1], wins: match[2], total: match[3] });

  if (line === 'Model output based on team form + season-long goal averages.') {
    return t('reason.modelBased');
  }

  return line;
};
