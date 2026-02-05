import { CanonicalItem } from '@/lib/types';
import { fetchHackerNews } from '@/lib/sources/hackerNews';
import { fetchArxiv } from '@/lib/sources/arxiv';
import { fetchReddit } from '@/lib/sources/reddit';
import { fetchProductHunt } from '@/lib/sources/productHunt';
import { ARXIV_LIMIT, HN_LIMIT } from '@/config/sources';
import { KEYWORDS } from '@/config/keywords';

export const collectItems = async () => {
  const tasks: Promise<CanonicalItem[]>[] = [
    fetchHackerNews(HN_LIMIT),
    fetchArxiv(KEYWORDS, ARXIV_LIMIT),
    fetchReddit(),
    fetchProductHunt(),
  ];

  const results = await Promise.allSettled(tasks);
  const items: CanonicalItem[] = [];
  const errors: string[] = [];

  results.forEach((result, index) => {
    if (result.status === 'fulfilled') {
      items.push(...result.value);
      return;
    }

    const source = ['hackernews', 'arxiv', 'reddit', 'producthunt'][index];
    errors.push(`${source}: ${result.reason instanceof Error ? result.reason.message : 'unknown error'}`);
  });

  return { items, errors };
};
