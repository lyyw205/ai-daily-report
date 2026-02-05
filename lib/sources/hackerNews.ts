import { CanonicalItem } from '@/lib/types';
import { matchKeywords, normalizeText } from '@/lib/utils/text';
import { fetchWithRetry } from '@/lib/utils/fetch';
import { KEYWORDS } from '@/config/keywords';

const HN_BASE = 'https://hacker-news.firebaseio.com/v0';

const fetchJson = async <T>(url: string): Promise<T> => {
  const res = await fetchWithRetry(url, undefined, { timeoutMs: 7000, retries: 2 });
  if (!res.ok) {
    throw new Error(`Hacker News fetch failed: ${res.status} ${res.statusText}`);
  }
  return res.json() as Promise<T>;
};

interface HNItem {
  id: number;
  by?: string;
  time?: number;
  title?: string;
  url?: string;
  score?: number;
  descendants?: number;
  type?: string;
  text?: string;
}

interface AlgoliaHit {
  objectID: string;
  title?: string;
  url?: string;
  author?: string;
  created_at_i?: number;
  points?: number;
  num_comments?: number;
  story_text?: string;
}

const toCanonical = (item: HNItem, keywords: string[]): CanonicalItem | null => {
  if (!item.title || !item.time) return null;
  const createdAt = new Date(item.time * 1000).toISOString();
  const url = item.url || `https://news.ycombinator.com/item?id=${item.id}`;
  const content = item.text ? normalizeText(item.text) : undefined;

  return {
    id: `hackernews:${item.id}`,
    source: 'hackernews',
    title: normalizeText(item.title),
    url,
    author: item.by,
    createdAt,
    score: item.score,
    commentCount: item.descendants,
    content,
    keywords,
    raw: item as unknown as Record<string, unknown>,
  };
};

export const fetchHackerNews = async (limit = 120): Promise<CanonicalItem[]> => {
  try {
    const [topIds, newIds] = await Promise.all([
      fetchJson<number[]>(`${HN_BASE}/topstories.json`),
      fetchJson<number[]>(`${HN_BASE}/newstories.json`),
    ]);

    const ids = [...new Set([...topIds.slice(0, limit), ...newIds.slice(0, limit)])];
    const items = await Promise.all(
      ids.map((id) => fetchJson<HNItem>(`${HN_BASE}/item/${id}.json`))
    );

    const filtered: CanonicalItem[] = [];
    for (const item of items) {
      if (!item.title) continue;
      const keywords = matchKeywords(item.title + ' ' + (item.text || ''));
      if (keywords.length === 0) continue;
      const canonical = toCanonical(item, keywords);
      if (canonical) filtered.push(canonical);
    }

    return filtered;
  } catch (error) {
    const message = error instanceof Error ? error.message : 'unknown error';
    const fallback = await fetchHackerNewsAlgolia(limit).catch((fallbackError) => {
      const fallbackMessage =
        fallbackError instanceof Error ? fallbackError.message : 'unknown error';
      throw new Error(`Hacker News failed (${message}); Algolia failed (${fallbackMessage})`);
    });
    return fallback;
  }
};

const fetchHackerNewsAlgolia = async (limit = 80): Promise<CanonicalItem[]> => {
  const query = KEYWORDS.join(' OR ');
  const url = `https://hn.algolia.com/api/v1/search_by_date?query=${encodeURIComponent(
    query
  )}&tags=story&hitsPerPage=${limit}`;

  const res = await fetchWithRetry(url, undefined, { timeoutMs: 7000, retries: 2 });
  if (!res.ok) {
    throw new Error(`HN Algolia fetch failed: ${res.status} ${res.statusText}`);
  }

  const data = (await res.json()) as { hits?: AlgoliaHit[] };
  const items: CanonicalItem[] = [];

  for (const hit of data.hits ?? []) {
    if (!hit.title || !hit.created_at_i) continue;
    const text = `${hit.title} ${hit.story_text || ''}`;
    const keywords = matchKeywords(text);
    if (keywords.length === 0) continue;

    items.push({
      id: `hackernews:${hit.objectID}`,
      source: 'hackernews',
      title: normalizeText(hit.title),
      url: hit.url || `https://news.ycombinator.com/item?id=${hit.objectID}`,
      author: hit.author,
      createdAt: new Date(hit.created_at_i * 1000).toISOString(),
      score: hit.points,
      commentCount: hit.num_comments,
      content: hit.story_text ? normalizeText(hit.story_text) : undefined,
      keywords,
      raw: hit as unknown as Record<string, unknown>,
    });
  }

  return items;
};
