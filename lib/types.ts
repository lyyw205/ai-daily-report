export type SourceName = 'reddit' | 'hackernews' | 'arxiv' | 'producthunt';

export interface CanonicalItem {
  id: string;
  source: SourceName;
  title: string;
  url: string;
  author?: string;
  createdAt: string;
  score?: number;
  commentCount?: number;
  content?: string;
  keywords: string[];
  raw?: Record<string, unknown>;
}

export interface RankedItem {
  item: CanonicalItem;
  trendScore: number;
  velocity?: number;
}

export interface ClusteredItem {
  item: CanonicalItem;
  trendScore: number;
  clusterSize: number;
  relatedSources: SourceName[];
  relatedUrls: string[];
  relatedTitles: string[];
}

export interface SummaryResult {
  itemId: string;
  summary: string;
  evidence: string[];
  model: string;
  createdAt: string;
}

export interface ReportSection {
  title: string;
  description?: string;
  items: ReportItem[];
}

export interface ReportItem {
  itemId: string;
  title: string;
  url: string;
  source: SourceName;
  score?: number;
  commentCount?: number;
  createdAt: string;
  summary?: string;
  evidence?: string[];
  keywords: string[];
  clusterSize?: number;
  relatedSources?: SourceName[];
  relatedUrls?: string[];
  relatedTitles?: string[];
}

export interface DailyReport {
  date: string;
  title: string;
  sections: ReportSection[];
  createdAt: string;
}

export interface RunStats {
  collected: number;
  deduped: number;
  ranked: number;
  summarized: number;
  errors: string[];
}
