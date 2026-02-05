import { CanonicalItem } from '@/lib/types';
import { fetchContentForUrl } from '@/lib/utils/content';
import { matchKeywords, normalizeText } from '@/lib/utils/text';

const MIN_CONTENT_CHARS = 200;
const FETCH_LIMIT = 40;

const scoreItem = (item: CanonicalItem) =>
  (item.score ?? 0) + (item.commentCount ?? 0) * 0.5;

export const enrichItemsWithContent = async (items: CanonicalItem[]) => {
  const candidates = items.filter(
    (item) => !item.content || item.content.length < MIN_CONTENT_CHARS
  );

  const prioritized = candidates
    .sort((a, b) => scoreItem(b) - scoreItem(a))
    .slice(0, FETCH_LIMIT);

  const contentMap = new Map<string, string>();

  for (const item of prioritized) {
    const content = await fetchContentForUrl(item.url);
    if (!content) continue;
    contentMap.set(item.id, normalizeText(content));
  }

  return items.map((item) => {
    const content = contentMap.get(item.id);
    const mergedText = `${item.title} ${content ?? item.content ?? ''}`;
    const keywords = matchKeywords(mergedText);

    if (!content) {
      return {
        ...item,
        keywords: keywords.length > 0 ? keywords : item.keywords,
      };
    }

    return {
      ...item,
      content,
      keywords: keywords.length > 0 ? keywords : item.keywords,
    };
  });
};
