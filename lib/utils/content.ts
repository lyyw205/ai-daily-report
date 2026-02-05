import { fetchWithRetry } from '@/lib/utils/fetch';
import { normalizeText, stripHtml } from '@/lib/utils/text';

const BLOCKED_HOSTS = new Set([
  'news.ycombinator.com',
  'www.reddit.com',
  'reddit.com',
  'old.reddit.com',
  'redd.it',
  'arxiv.org',
]);

const BLOCKED_EXTENSIONS = ['.pdf', '.zip', '.png', '.jpg', '.jpeg', '.gif', '.mp4', '.mp3'];

const MIN_CONTENT_CHARS = 160;
const MAX_CONTENT_CHARS = 4000;

const decodeEntities = (value: string) =>
  value
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/g, "'");

const isLikelyHtml = (contentType: string | null) => {
  if (!contentType) return true;
  return contentType.includes('text/html') || contentType.includes('application/xhtml');
};

export const shouldFetchContent = (url: string) => {
  try {
    const parsed = new URL(url);
    if (!['http:', 'https:'].includes(parsed.protocol)) return false;
    const host = parsed.hostname.replace(/^www\./, '');
    if (BLOCKED_HOSTS.has(host)) return false;
    const path = parsed.pathname.toLowerCase();
    if (BLOCKED_EXTENSIONS.some((ext) => path.endsWith(ext))) return false;
    return true;
  } catch {
    return false;
  }
};

const pickBestSection = (html: string) => {
  const candidates = [
    html.match(/<article[\s\S]*?<\/article>/i)?.[0],
    html.match(/<main[\s\S]*?<\/main>/i)?.[0],
    html.match(/<body[\s\S]*?<\/body>/i)?.[0],
  ].filter(Boolean) as string[];

  if (candidates.length === 0) return html;

  return candidates.reduce((best, current) => {
    const bestLen = stripHtml(best).length;
    const currentLen = stripHtml(current).length;
    return currentLen > bestLen ? current : best;
  }, candidates[0]);
};

const scoreParagraph = (text: string) => {
  const lengthScore = text.length;
  const punctuationScore = (text.match(/[.!?]/g) || []).length * 8;
  return lengthScore + punctuationScore;
};

const isNoise = (text: string) => {
  const lower = text.toLowerCase();
  const noisePatterns = [
    'cookie',
    'privacy',
    'newsletter',
    'subscribe',
    'sign in',
    'sign up',
    'login',
    'register',
    'advertisement',
    'sponsored',
    'all rights reserved',
    '©',
    'share',
  ];
  return noisePatterns.some((pattern) => lower.includes(pattern));
};

const extractText = (html: string) => {
  const main = pickBestSection(html);
  let cleaned = main
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<noscript[\s\S]*?<\/noscript>/gi, ' ')
    .replace(/<svg[\s\S]*?<\/svg>/gi, ' ')
    .replace(/<iframe[\s\S]*?<\/iframe>/gi, ' ')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/(p|div|h1|h2|h3|h4|h5|h6|li|section|article)>/gi, '\n');

  cleaned = decodeEntities(cleaned);
  cleaned = cleaned.replace(/<[^>]+>/g, ' ');

  const lines = cleaned
    .split('\n')
    .map((line) => normalizeText(line))
    .filter((line) => line.length > 40 && line.length < 500)
    .filter((line) => !isNoise(line));

  if (lines.length === 0) return '';

  const scored = lines.map((line, index) => ({
    line,
    index,
    score: scoreParagraph(line),
  }));

  scored.sort((a, b) => b.score - a.score);
  const picked = scored.slice(0, 6).sort((a, b) => a.index - b.index);
  const combined = normalizeText(picked.map((entry) => entry.line).join(' '));
  return combined;
};

export const fetchContentForUrl = async (url: string): Promise<string | null> => {
  if (!shouldFetchContent(url)) return null;

  try {
    const res = await fetchWithRetry(
      url,
      {
        headers: {
          Accept: 'text/html,application/xhtml+xml',
          'User-Agent': 'ai-daily-report/0.1',
        },
      },
      { timeoutMs: 9000, retries: 1, backoffMs: 700 }
    );

    if (!res.ok) return null;
    if (!isLikelyHtml(res.headers.get('content-type'))) return null;

    const html = await res.text();
    const text = extractText(html);
    if (!text || text.length < MIN_CONTENT_CHARS) return null;

    return text.length > MAX_CONTENT_CHARS ? text.slice(0, MAX_CONTENT_CHARS) : text;
  } catch {
    return null;
  }
};
