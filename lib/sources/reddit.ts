import { CanonicalItem } from '@/lib/types';
import { matchKeywords, normalizeText } from '@/lib/utils/text';
import { KEYWORDS } from '@/config/keywords';
import { REDDIT_SUBREDDITS } from '@/config/sources';
import { fetchWithRetry } from '@/lib/utils/fetch';

const REDDIT_TOKEN_URL = 'https://www.reddit.com/api/v1/access_token';
const REDDIT_API_BASE = 'https://oauth.reddit.com';

const getRedditAccessToken = async () => {
  const clientId = process.env.REDDIT_CLIENT_ID;
  const clientSecret = process.env.REDDIT_CLIENT_SECRET;
  const userAgent = process.env.REDDIT_USER_AGENT;

  if (!clientId || !clientSecret || !userAgent) {
    return null;
  }

  const credentials = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');
  const res = await fetchWithRetry(REDDIT_TOKEN_URL, {
    method: 'POST',
    headers: {
      Authorization: `Basic ${credentials}`,
      'Content-Type': 'application/x-www-form-urlencoded',
      'User-Agent': userAgent,
    },
    body: 'grant_type=client_credentials',
  });

  if (!res.ok) {
    throw new Error(`Reddit token failed: ${res.status} ${res.statusText}`);
  }

  const json = (await res.json()) as { access_token?: string };
  return json.access_token || null;
};

const buildQuery = () => KEYWORDS.map((kw) => `"${kw}"`).join(' OR ');

interface RedditPost {
  id: string;
  title: string;
  permalink: string;
  url: string;
  author: string;
  score: number;
  num_comments: number;
  created_utc: number;
  selftext?: string;
}

const toCanonical = (post: RedditPost, keywords: string[]): CanonicalItem => {
  return {
    id: `reddit:${post.id}`,
    source: 'reddit',
    title: normalizeText(post.title),
    url: post.url || `https://www.reddit.com${post.permalink}`,
    author: post.author,
    createdAt: new Date(post.created_utc * 1000).toISOString(),
    score: post.score,
    commentCount: post.num_comments,
    content: post.selftext ? normalizeText(post.selftext) : undefined,
    keywords,
    raw: post as unknown as Record<string, unknown>,
  };
};

export const fetchReddit = async (): Promise<CanonicalItem[]> => {
  const token = await getRedditAccessToken();
  if (!token) return [];

  const userAgent = process.env.REDDIT_USER_AGENT as string;
  const query = buildQuery();
  const items: CanonicalItem[] = [];

  for (const subreddit of REDDIT_SUBREDDITS) {
    const url = `${REDDIT_API_BASE}/r/${subreddit}/search?q=${encodeURIComponent(
      query
    )}&sort=hot&t=day&restrict_sr=1&limit=50`;

    const res = await fetchWithRetry(url, {
      headers: {
        Authorization: `Bearer ${token}`,
        'User-Agent': userAgent,
      },
    });

    if (!res.ok) {
      throw new Error(`Reddit fetch failed: ${res.status} ${res.statusText}`);
    }

    const json = (await res.json()) as {
      data?: { children?: { data: RedditPost }[] };
    };

    for (const child of json.data?.children ?? []) {
      const post = child.data;
      const keywords = matchKeywords(`${post.title} ${post.selftext || ''}`);
      if (keywords.length === 0) continue;
      items.push(toCanonical(post, keywords));
    }
  }

  return items;
};
