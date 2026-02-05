import { CanonicalItem } from '@/lib/types';
import { matchKeywords, normalizeText, stripHtml } from '@/lib/utils/text';
import { fetchWithRetry } from '@/lib/utils/fetch';

const ARXIV_BASE = 'https://export.arxiv.org/api/query';

const buildQuery = (keywords: string[]) => {
  const terms = keywords.map((kw) => `all:${kw.replace(/\s+/g, '+')}`);
  return terms.join('+OR+');
};

const parseEntries = (xml: string) => {
  const entries: string[] = [];
  const regex = /<entry>([\s\S]*?)<\/entry>/g;
  let match = regex.exec(xml);
  while (match) {
    entries.push(match[1]);
    match = regex.exec(xml);
  }
  return entries;
};

const extractTag = (entry: string, tag: string) => {
  const match = entry.match(new RegExp(`<${tag}>([\s\S]*?)<\/${tag}>`));
  return match ? normalizeText(stripHtml(match[1])) : '';
};

const extractId = (entry: string) => extractTag(entry, 'id');

export const fetchArxiv = async (keywords: string[], maxResults = 50): Promise<CanonicalItem[]> => {
  if (keywords.length === 0) return [];
  const query = buildQuery(keywords);
  const url = `${ARXIV_BASE}?search_query=${query}&start=0&max_results=${maxResults}&sortBy=submittedDate&sortOrder=descending`;

  const res = await fetchWithRetry(url, undefined, { timeoutMs: 8000, retries: 1 });
  if (!res.ok) {
    throw new Error(`arXiv fetch failed: ${res.status}`);
  }
  const xml = await res.text();
  const entries = parseEntries(xml);

  const items: CanonicalItem[] = [];
  for (const entry of entries) {
    const title = extractTag(entry, 'title');
    const summary = extractTag(entry, 'summary');
    const id = extractId(entry);
    const published = extractTag(entry, 'published');
    if (!title || !id || !published) continue;

    const text = `${title} ${summary}`;
    const matched = matchKeywords(text);
    if (matched.length === 0) continue;

    items.push({
      id: `arxiv:${id}`,
      source: 'arxiv',
      title,
      url: id,
      createdAt: new Date(published).toISOString(),
      content: summary,
      keywords: matched,
      raw: { id, title, summary, published },
    });
  }

  return items;
};
