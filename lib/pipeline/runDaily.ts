import { collectItems } from '@/lib/pipeline/collect';
import { dedupeItems, rankItems } from '@/lib/pipeline/rank';
import { summarizeItem } from '@/lib/pipeline/summarize';
import { verifySummary } from '@/lib/pipeline/verify';
import { buildReport } from '@/lib/report/buildReport';
import { clusterRankedItems } from '@/lib/pipeline/cluster';
import { enrichItemsWithContent } from '@/lib/pipeline/enrich';
import { CLUSTER_THRESHOLD } from '@/config/tuning';
import {
  upsertItems,
  upsertReport,
  upsertSummary,
  getSummaryForItem,
  insertRun,
  insertSnapshots,
  getLatestSnapshots,
} from '@/lib/db';
import { CanonicalItem, SummaryResult } from '@/lib/types';

const ensureSummaries = async (items: CanonicalItem[]) => {
  const summaryMap = new Map<string, SummaryResult>();
  for (const item of items) {
    const existing = getSummaryForItem(item.id);
    if (existing) {
      summaryMap.set(item.id, existing);
      continue;
    }
    const summary = verifySummary(item, await summarizeItem(item));
    upsertSummary(summary);
    summaryMap.set(item.id, summary);
  }
  return summaryMap;
};

export const runDaily = async () => {
  const { items, errors } = await collectItems();
  const uniqueItems = dedupeItems(items);
  const enrichedItems = await enrichItemsWithContent(uniqueItems);
  upsertItems(enrichedItems);

  const latestSnapshots = getLatestSnapshots(enrichedItems.map((item) => item.id));
  const velocityMap = new Map<string, number>();
  const now = Date.now();
  for (const item of enrichedItems) {
    const prev = latestSnapshots.get(item.id);
    if (!prev || item.score === undefined || prev.score === null) continue;
    const hours = (now - new Date(prev.capturedAt).getTime()) / (1000 * 60 * 60);
    if (hours <= 0) continue;
    const velocity = (item.score - prev.score) / hours;
    velocityMap.set(item.id, velocity);
  }

  const rankedEntries = rankItems(enrichedItems, velocityMap, 80);
  const clustered = clusterRankedItems(rankedEntries, CLUSTER_THRESHOLD);
  const draft = buildReport(clustered, new Map());
  const reportTargets = new Set(
    draft.sections.flatMap((section) => section.items.map((item) => item.itemId))
  );
  const itemsForSummary = clustered
    .filter((entry) => reportTargets.has(entry.item.id))
    .map((entry) => entry.item);
  const summaryMap = await ensureSummaries(itemsForSummary);

  const report = buildReport(clustered, summaryMap);
  upsertReport(report);
  insertRun(report.date, {
    collected: items.length,
    deduped: uniqueItems.length,
    ranked: rankedEntries.length,
    summarized: summaryMap.size,
    errors,
  });
  insertSnapshots(enrichedItems);

  return {
    report,
    stats: {
      collected: items.length,
      deduped: uniqueItems.length,
      ranked: rankedEntries.length,
      summarized: summaryMap.size,
      errors,
    },
  };
};
