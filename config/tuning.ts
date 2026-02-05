import { SourceName } from '@/lib/types';

export const CLUSTER_THRESHOLD = 0.5;
export const VELOCITY_WEIGHT = 0.18;

export const SOURCE_WEIGHTS: Record<SourceName, number> = {
  reddit: 1.0,
  hackernews: 1.05,
  arxiv: 1.1,
  producthunt: 0.95,
};
