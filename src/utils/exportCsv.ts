/**
 * CSV export utility.
 *
 * - Web: triggers a direct file download via a hidden anchor element.
 * - Mobile (iOS/Android): writes file to cache dir and opens native share sheet.
 */
import { Platform, Share } from 'react-native';
import type { Fixture } from '@/types/match';
import type { PredictionResult } from '@/types/prediction';

/** Build a CSV string from today's fixtures + prediction map. */
export const buildPredictionsCsv = (
  fixtures: Fixture[],
  predictionMap: Map<number, PredictionResult>,
): string => {
  const header = [
    'Data',
    'Ora',
    'Lega',
    'Casa',
    'Ospite',
    'TopPick',
    'Probabilità%',
    'Quota',
    'Confidenza',
    'Casa%',
    'Pareggio%',
    'Ospite%',
    'Over2.5%',
    'BTTS%',
    'ValueBets',
  ].join(',');

  const rows = fixtures.map((f) => {
    const pred = predictionMap.get(f.fixture.id);
    const date = new Date(f.fixture.timestamp * 1000);
    const dateStr = date.toLocaleDateString('it-IT');
    const timeStr = date.toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' });

    const escape = (s: string) => `"${s.replace(/"/g, '""')}"`;

    if (!pred) {
      return [
        dateStr, timeStr,
        escape(f.league.name),
        escape(f.teams.home.name),
        escape(f.teams.away.name),
        '', '', '', '', '', '', '', '', '', '',
      ].join(',');
    }

    return [
      dateStr,
      timeStr,
      escape(f.league.name),
      escape(f.teams.home.name),
      escape(f.teams.away.name),
      escape(pred.topPick.selection),
      Math.round(pred.topPick.probability).toString(),
      pred.topPick.odds.toFixed(2),
      pred.confidence,
      Math.round(pred.homeWinPct).toString(),
      Math.round(pred.drawPct).toString(),
      Math.round(pred.awayWinPct).toString(),
      Math.round(pred.over25Pct).toString(),
      Math.round(pred.bttsPct).toString(),
      (pred.valueBets?.length ?? 0).toString(),
    ].join(',');
  });

  return [header, ...rows].join('\n');
};

/** Download / share the CSV content. */
export const exportPredictionsCsv = async (
  fixtures: Fixture[],
  predictionMap: Map<number, PredictionResult>,
): Promise<void> => {
  const today = new Date().toISOString().slice(0, 10);
  const filename = `BORO_predizioni_${today}.csv`;
  const csv = buildPredictionsCsv(fixtures, predictionMap);

  if (Platform.OS === 'web') {
    // Web: blob download
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    setTimeout(() => {
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    }, 100);
    return;
  }

  // Mobile: use expo-file-system + expo-sharing
  try {
    const FileSystem = require('expo-file-system');
    const Sharing = require('expo-sharing');

    const uri = `${FileSystem.cacheDirectory}${filename}`;
    await FileSystem.writeAsStringAsync(uri, csv, {
      encoding: FileSystem.EncodingType.UTF8,
    });

    if (await Sharing.isAvailableAsync()) {
      await Sharing.shareAsync(uri, {
        mimeType: 'text/csv',
        dialogTitle: 'Esporta predizioni BORO',
        UTI: 'public.comma-separated-values-text',
      });
    }
  } catch (err) {
    // Fallback: use native Share with text
    try {
      await Share.share({ message: csv, title: filename });
    } catch {
      console.warn('[exportCsv] Failed to export:', err);
    }
  }
};
