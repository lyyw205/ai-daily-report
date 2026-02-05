import { CanonicalItem, RankedItem, SourceName } from '@/lib/types';
import { normalizeText } from '@/lib/utils/text';
import { SOURCE_WEIGHTS, VELOCITY_WEIGHT } from '@/config/tuning';

const hoursSince = (iso: string) => {
  const diff = Date.now() - new Date(iso).getTime();
  return diff / (1000 * 60 * 60);
};

export const dedupeItems = (items: CanonicalItem[]) => {
  const seen = new Map<string, CanonicalItem>();
  for (const item of items) {
    const key = normalizeText(item.url || item.title).toLowerCase();
    if (!seen.has(key)) {
      seen.set(key, item);
      continue;
    }

    const existing = seen.get(key) as CanonicalItem;
    if ((item.score || 0) > (existing.score || 0)) {
      seen.set(key, item);
    }
  }
  return Array.from(seen.values());
};

const getSourceWeight = (source: SourceName) => SOURCE_WEIGHTS[source] ?? 1;

export const computeTrendScore = (item: CanonicalItem, velocity = 0) => {
  const score = Math.log((item.score || 0) + 1);
  const comments = 0.5 * Math.log((item.commentCount || 0) + 1);
  const agePenalty = hoursSince(item.createdAt) * 0.12;
  const velocityBoost = Math.max(0, velocity) * VELOCITY_WEIGHT;
  const base = score + comments - agePenalty + velocityBoost;
  return base * getSourceWeight(item.source);
};

export const rankItems = (
  items: CanonicalItem[],
  velocityMap: Map<string, number>,
  limit = 50
): RankedItem[] => {
  const ranked = items
    .map((item) => {
      const velocity = velocityMap.get(item.id) || 0;
      return { item, trendScore: computeTrendScore(item, velocity), velocity };
    })
    .sort((a, b) => b.trendScore - a.trendScore)
    .slice(0, limit);
  return ranked;
};
