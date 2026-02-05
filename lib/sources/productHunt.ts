import { CanonicalItem } from '@/lib/types';
import { matchKeywords, normalizeText } from '@/lib/utils/text';
import { fetchWithRetry } from '@/lib/utils/fetch';

const PH_ENDPOINT = 'https://api.producthunt.com/v2/api/graphql';

interface ProductHuntPost {
  id: string;
  name: string;
  tagline: string;
  url: string;
  votesCount: number;
  commentsCount: number;
  createdAt: string;
}

export const fetchProductHunt = async (): Promise<CanonicalItem[]> => {
  const token = process.env.PRODUCT_HUNT_TOKEN;
  if (!token) return [];

  const query = `
    query DailyPosts {
      posts(order: RANKING, first: 50, postedAfter: "${new Date(
        Date.now() - 24 * 60 * 60 * 1000
      ).toISOString()}") {
        nodes {
          id
          name
          tagline
          url
          votesCount
          commentsCount
          createdAt
        }
      }
    }
  `;

  const res = await fetchWithRetry(PH_ENDPOINT, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ query }),
  });

  if (!res.ok) {
    throw new Error(`Product Hunt fetch failed: ${res.status} ${res.statusText}`);
  }

  const json = (await res.json()) as {
    data?: { posts?: { nodes?: ProductHuntPost[] } };
  };

  const items: CanonicalItem[] = [];
  for (const post of json.data?.posts?.nodes ?? []) {
    const text = `${post.name} ${post.tagline}`;
    const keywords = matchKeywords(text);
    if (keywords.length === 0) continue;
    items.push({
      id: `producthunt:${post.id}`,
      source: 'producthunt',
      title: normalizeText(post.name),
      url: post.url,
      createdAt: new Date(post.createdAt).toISOString(),
      score: post.votesCount,
      commentCount: post.commentsCount,
      content: normalizeText(post.tagline),
      keywords,
      raw: post as unknown as Record<string, unknown>,
    });
  }

  return items;
};
