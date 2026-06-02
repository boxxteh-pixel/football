import { useEffect, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  fetchRecentResults,
  fetchResultsOnDate,
} from "@/services/api/smInsights";
import { predictFromInsights } from "@/services/ai/predictor";
import {
  gradePrediction,
  summarizeAccuracy,
  type GradedPrediction,
} from "@/services/ai/evaluate";
import { useSettingsStore } from "@/store/settingsStore";
import { useCalibrationStore } from "@/store/calibrationStore";
import { hasApiKey } from "@/constants/config";
import { todayIsoDate } from "@/utils/date";
import type { Fixture } from "@/types/match";
import type { PredictionResult } from "@/types/prediction";

export interface ResultRow {
  fixture: Fixture;
  prediction: PredictionResult;
  graded: GradedPrediction;
}

/**
 * Finished matches graded against the model's prediction.
 *
 * - When `date` is null → the last `days` of recent results (default view).
 * - When `date` is set  → results for that single calendar day (calendar pick).
 *
 * Returns rows (newest first) plus an accuracy summary (hit rate + Brier).
 */
export const useResults = (date: string | null, days = 4) => {
  const selectedLeagueIds = useSettingsStore(
    (s) => s.settings.selectedLeagueIds,
  );
  const recordCalibration = useCalibrationStore((s) => s.record);

  const query = useQuery({
    queryKey: [
      "results",
      date ?? `recent-${todayIsoDate()}`,
      selectedLeagueIds.join(","),
      days,
    ],
    queryFn: () =>
      date
        ? fetchResultsOnDate(date, selectedLeagueIds)
        : fetchRecentResults(todayIsoDate(), selectedLeagueIds, days),
    enabled: hasApiKey() && selectedLeagueIds.length > 0,
    staleTime: 15 * 60 * 1000,
    gcTime: 24 * 60 * 60 * 1000,
    placeholderData: (prev) => prev,
    refetchOnWindowFocus: false,
    refetchOnMount: false,
    refetchOnReconnect: false,
  });

  const { rows, summary } = useMemo(() => {
    const list: ResultRow[] = (query.data ?? []).map(
      ({ fixture, insights }) => {
        const prediction = predictFromInsights(fixture, insights);
        const graded = gradePrediction(fixture, prediction);
        return { fixture, prediction, graded };
      },
    );
    const summary = summarizeAccuracy(
      list.map((r) => ({
        grade: r.graded.grade,
        probability: r.graded.probability,
        odds: r.prediction.topPick.odds,
      })),
    );
    return { rows: list, summary };
  }, [query.data]);

  // Feed settled outcomes into the self-improving calibration model (deduped).
  useEffect(() => {
    for (const r of rows) {
      if (r.graded.grade === "pending") continue;
      const key = `${r.fixture.fixture.id}:${r.prediction.topPick.market}`;
      recordCalibration(
        key,
        r.prediction.topPick.probability,
        r.graded.grade === "correct",
        r.prediction.topPick.market,
      ).catch(() => {});
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rows]);

  return { ...query, rows, summary };
};
