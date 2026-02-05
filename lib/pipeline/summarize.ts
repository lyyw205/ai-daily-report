import { CanonicalItem, SummaryResult } from '@/lib/types';
import { extractSentences, normalizeText } from '@/lib/utils/text';
import { nowIso } from '@/lib/utils/time';

interface LLMResponse {
  summary: string;
  evidence: string[];
}

const getModelConfig = () => ({
  apiKey: process.env.LLM_API_KEY,
  baseUrl: (process.env.LLM_API_BASE_URL || 'https://api.openai.com/v1').replace(/\/$/, ''),
  model: process.env.LLM_MODEL || 'gpt-4o-mini',
});

const parseJsonResponse = (text: string): LLMResponse | null => {
  const tryParse = (value: string) => {
    try {
      return JSON.parse(value) as LLMResponse;
    } catch {
      return null;
    }
  };

  const direct = tryParse(text);
  if (direct) return direct;

  const match = text.match(/\{[\s\S]*\}/);
  if (!match) return null;

  return tryParse(match[0]);
};

const normalizeResponse = (response: LLMResponse | null): LLMResponse | null => {
  if (!response?.summary) return null;
  return {
    summary: normalizeText(response.summary),
    evidence: Array.isArray(response.evidence)
      ? response.evidence.map((item) => normalizeText(String(item))).filter(Boolean)
      : [],
  };
};

const callLLM = async (item: CanonicalItem): Promise<LLMResponse | null> => {
  const { apiKey, baseUrl, model } = getModelConfig();
  if (!apiKey) return null;

  const trimmedContent =
    item.content && item.content.length > 3500 ? item.content.slice(0, 3500) : item.content || '';
  const content = `${item.title}\n\n${trimmedContent}`.trim();
  if (!content) return null;

  const res = await fetch(`${baseUrl}/chat/completions`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model,
      temperature: 0.2,
      messages: [
        {
          role: 'system',
          content:
            '너는 한국어 데일리 리포트 요약가다. 반드시 근거 문장을 제공하고, 사실만 요약한다.',
        },
        {
          role: 'user',
          content: [
            '다음 글을 2~3문장으로 요약해줘. JSON으로만 응답해.',
            '형식: {"summary": "...", "evidence": ["근거 문장1", "근거 문장2"]}',
            '요약에는 추측을 포함하지 말고, 원문에 없는 내용은 금지.',
            `\n\n[원문]\n${content}`,
          ].join('\n'),
        },
      ],
    }),
  });

  if (!res.ok) {
    return null;
  }

  const data = (await res.json()) as {
    choices?: { message?: { content?: string } }[];
  };

  const message = data.choices?.[0]?.message?.content;
  if (!message) return null;

  const parsed = parseJsonResponse(message);
  return normalizeResponse(parsed);
};

const fallbackSummary = (item: CanonicalItem): LLMResponse => {
  const baseText = item.content || item.title;
  const sentences = extractSentences(baseText, 2);
  const summary = sentences.join(' ');
  return {
    summary: summary || item.title,
    evidence: sentences.length ? sentences : [item.title],
  };
};

export const summarizeItem = async (item: CanonicalItem): Promise<SummaryResult> => {
  const llmResult = await callLLM(item);
  const result = llmResult || fallbackSummary(item);

  return {
    itemId: item.id,
    summary: result.summary,
    evidence: result.evidence,
    model: llmResult ? (process.env.LLM_MODEL || 'gpt-4o-mini') : 'extractive',
    createdAt: nowIso(),
  };
};
