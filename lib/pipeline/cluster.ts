import { ClusteredItem, RankedItem, SourceName } from '@/lib/types';
import { normalizeText } from '@/lib/utils/text';
import { CLUSTER_THRESHOLD } from '@/config/tuning';

const STOPWORDS = new Set([
  'the',
  'a',
  'an',
  'and',
  'or',
  'to',
  'of',
  'in',
  'on',
  'for',
  'with',
  'from',
  'using',
  'use',
  'new',
  'ai',
  'llm',
  'gpt',
  'model',
  'models',
  'paper',
  'research',
  'study',
  'approach',
  'method',
  'based',
  '위',
  '및',
  '에서',
  '대한',
  '하는',
]);

const isHangul = (value: string) => /[\uac00-\ud7a3]/.test(value);

const normalizeForTokens = (text: string) =>
  normalizeText(text)
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]+/gu, ' ');

const tokenize = (text: string) => {
  const cleaned = normalizeForTokens(text);
  return cleaned
    .split(/\s+/)
    .map((token) => token.trim())
    .filter((token) => token.length > 1)
    .filter((token) => !STOPWORDS.has(token))
    .filter((token) => token.length >= 3 || isHangul(token));
};

const pickTopTokens = (tokens: string[], limit: number) => {
  const counts = new Map<string, number>();
  for (const token of tokens) {
    counts.set(token, (counts.get(token) ?? 0) + 1);
  }
  return Array.from(counts.entries())
    .sort((a, b) => b[1] - a[1] || b[0].length - a[0].length)
    .slice(0, limit)
    .map(([token]) => token);
};

const buildBigrams = (tokens: string[], limit: number) => {
  const bigrams: string[] = [];
  for (let i = 0; i < tokens.length - 1 && bigrams.length < limit; i += 1) {
    bigrams.push(`${tokens[i]} ${tokens[i + 1]}`);
  }
  return bigrams;
};

const buildTokenSet = (text: string) => {
  const tokens = tokenize(text);
  const topTokens = pickTopTokens(tokens, 80);
  const bigrams = buildBigrams(tokens.slice(0, 40), 40);
  return new Set([...topTokens, ...bigrams]);
};

const jaccard = (a: Set<string>, b: Set<string>) => {
  if (a.size === 0 || b.size === 0) return 0;
  let intersection = 0;
  for (const value of a) {
    if (b.has(value)) intersection += 1;
  }
  const union = a.size + b.size - intersection;
  return union === 0 ? 0 : intersection / union;
};

interface Cluster {
  items: RankedItem[];
  tokenSet: Set<string>;
  keywordSet: Set<string>;
}

const toClusteredItem = (cluster: Cluster): ClusteredItem => {
  const representative = cluster.items.reduce((best, current) =>
    current.trendScore > best.trendScore ? current : best
  );

  const relatedTitles = cluster.items
    .map((entry) => entry.item.title)
    .filter(Boolean)
    .slice(0, 3);
  const relatedUrls = cluster.items
    .map((entry) => entry.item.url)
    .filter(Boolean)
    .slice(0, 3);
  const relatedSources = Array.from(
    new Set(cluster.items.map((entry) => entry.item.source))
  ) as SourceName[];

  return {
    item: representative.item,
    trendScore: representative.trendScore,
    clusterSize: cluster.items.length,
    relatedSources,
    relatedUrls,
    relatedTitles,
  };
};

const similarityScore = (itemTokens: Set<string>, itemKeywords: Set<string>, cluster: Cluster) => {
  const tokenScore = jaccard(itemTokens, cluster.tokenSet);
  const keywordScore = jaccard(itemKeywords, cluster.keywordSet);
  return tokenScore * 0.65 + keywordScore * 0.35;
};

export const clusterRankedItems = (
  ranked: RankedItem[],
  threshold: number = CLUSTER_THRESHOLD
) => {
  const clusters: Cluster[] = [];

  for (const rankedItem of ranked) {
    const baseText = `${rankedItem.item.title} ${rankedItem.item.content || ''}`.slice(0, 2000);
    const tokens = buildTokenSet(baseText);
    const keywords = new Set(rankedItem.item.keywords.map((keyword) => keyword.toLowerCase()));

    let bestIndex = -1;
    let bestScore = 0;

    clusters.forEach((cluster, index) => {
      const score = similarityScore(tokens, keywords, cluster);
      if (score > bestScore) {
        bestScore = score;
        bestIndex = index;
      }
    });

    if (bestIndex !== -1 && bestScore >= threshold) {
      const target = clusters[bestIndex];
      target.items.push(rankedItem);
      tokens.forEach((token) => target.tokenSet.add(token));
      keywords.forEach((keyword) => target.keywordSet.add(keyword));
      continue;
    }

    clusters.push({
      items: [rankedItem],
      tokenSet: tokens,
      keywordSet: keywords,
    });
  }

  return clusters
    .map((cluster) => toClusteredItem(cluster))
    .sort((a, b) => b.trendScore - a.trendScore);
};
