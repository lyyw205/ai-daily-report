import { CanonicalItem, SummaryResult } from '@/lib/types';
import { extractSentences, normalizeText } from '@/lib/utils/text';

const fallbackSummary = (item: CanonicalItem) => {
  const baseText = item.content || item.title;
  const sentences = extractSentences(baseText, 2);
  const summary = sentences.join(' ') || item.title;
  return {
    summary,
    evidence: sentences.length ? sentences : [item.title],
    model: 'extractive',
  };
};

export const verifySummary = (item: CanonicalItem, summary: SummaryResult) => {
  const sourceText = normalizeText(`${item.title} ${item.content || ''}`).toLowerCase();
  const filteredEvidence = summary.evidence
    .map((evidence) => normalizeText(evidence))
    .filter((evidence) => evidence && sourceText.includes(evidence.toLowerCase()));

  if (!summary.summary || filteredEvidence.length === 0) {
    const fallback = fallbackSummary(item);
    return { ...summary, ...fallback };
  }

  return { ...summary, evidence: filteredEvidence };
};
