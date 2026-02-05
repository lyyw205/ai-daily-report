import { ClusteredItem, DailyReport, ReportItem, SummaryResult } from '@/lib/types';
import { formatDateKST, nowIso } from '@/lib/utils/time';

const toReportItem = (
  clustered: ClusteredItem,
  summary?: SummaryResult
): ReportItem => ({
  itemId: clustered.item.id,
  title: clustered.item.title,
  url: clustered.item.url,
  source: clustered.item.source,
  score: clustered.item.score,
  commentCount: clustered.item.commentCount,
  createdAt: clustered.item.createdAt,
  summary: summary?.summary,
  evidence: summary?.evidence,
  keywords: clustered.item.keywords,
  clusterSize: clustered.clusterSize,
  relatedSources: clustered.relatedSources,
  relatedUrls: clustered.relatedUrls,
  relatedTitles: clustered.relatedTitles,
});

const pickTop = (items: ClusteredItem[], limit: number) => items.slice(0, limit);

export const buildReport = (
  rankedItems: ClusteredItem[],
  summaries: Map<string, SummaryResult>
): DailyReport => {
  const community = rankedItems.filter((entry) =>
    ['reddit', 'hackernews'].includes(entry.item.source)
  );
  const papers = rankedItems.filter((entry) => entry.item.source === 'arxiv');
  const products = rankedItems.filter((entry) => entry.item.source === 'producthunt');

  const sections = [
    {
      title: '커뮤니티 핫 토픽',
      description: 'Reddit·Hacker News에서 급상승 중인 AI 이야기',
      items: pickTop(community, 8).map((entry) =>
        toReportItem(entry, summaries.get(entry.item.id))
      ),
    },
    {
      title: '연구/논문',
      description: 'arXiv 최신 AI 논문 중 주목할 만한 주제',
      items: pickTop(papers, 5).map((entry) =>
        toReportItem(entry, summaries.get(entry.item.id))
      ),
    },
    {
      title: '제품/툴',
      description: 'Product Hunt에서 인기 있는 AI 제품',
      items: pickTop(products, 5).map((entry) =>
        toReportItem(entry, summaries.get(entry.item.id))
      ),
    },
  ].filter((section) => section.items.length > 0);

  const date = formatDateKST();
  return {
    date,
    title: `AI 데일리 리포트 · ${date}`,
    sections,
    createdAt: nowIso(),
  };
};
