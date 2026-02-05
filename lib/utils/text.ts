import { KEYWORDS, KEYWORD_SYNONYMS } from '@/config/keywords';

export const normalizeText = (value: string) =>
  value
    .replace(/\s+/g, ' ')
    .replace(/[\u0000-\u001F]+/g, ' ')
    .trim();

export const stripHtml = (value: string) =>
  normalizeText(value.replace(/<[^>]*>/g, ' '));

export const extractSentences = (value: string, limit = 2) => {
  const cleaned = normalizeText(value);
  if (!cleaned) return [];
  const parts = cleaned.split(/(?<=[.!?])\s+/);
  return parts.slice(0, limit).filter(Boolean);
};

const escapeRegex = (value: string) =>
  value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const normalizeForMatch = (value: string) =>
  normalizeText(value.toLowerCase().replace(/[\u2019']/g, "'").replace(/[-_/]+/g, ' '));

const containsHangul = (value: string) => /[\uac00-\ud7a3]/.test(value);

const buildVariants = (term: string) => {
  const cleaned = normalizeForMatch(term);
  const variants = new Set<string>([cleaned]);
  if (cleaned.includes(' ')) {
    variants.add(cleaned.replace(/\s+/g, ''));
  }
  return Array.from(variants);
};

const buildPattern = (term: string) => {
  const escaped = escapeRegex(term);
  if (containsHangul(term)) {
    return new RegExp(escaped, 'i');
  }
  if (term.length <= 3 || term.includes(' ')) {
    return new RegExp(`(^|[^\\p{L}\\p{N}])${escaped}([^\\p{L}\\p{N}]|$)`, 'iu');
  }
  return new RegExp(`\\b${escaped}\\b`, 'i');
};

const keywordMatchers = KEYWORDS.map((keyword) => {
  const synonyms = KEYWORD_SYNONYMS[keyword] ?? [];
  const terms = [keyword, ...synonyms].flatMap(buildVariants);
  const patterns = terms.map(buildPattern);
  return { keyword, patterns };
});

export const matchKeywords = (text: string) => {
  const normalized = normalizeForMatch(text);
  const matched: string[] = [];
  for (const entry of keywordMatchers) {
    if (entry.patterns.some((pattern) => pattern.test(normalized))) {
      matched.push(entry.keyword);
    }
  }
  return matched;
};
