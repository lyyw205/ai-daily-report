import Link from 'next/link';
import { getReportByDate, getRunByDate } from '@/lib/db';
import { formatDisplayDate } from '@/lib/utils/time';

export const dynamic = 'force-dynamic';

interface PageProps {
  params: { date: string };
}

export default function DailyReportPage({ params }: PageProps) {
  const report = getReportByDate(params.date);
  const run = getRunByDate(params.date);

  if (!report) {
    return (
      <div className="min-h-screen max-w-4xl mx-auto px-6 py-16">
        <div className="section-card p-8 text-center">
          <h1 className="text-3xl font-semibold">리포트를 찾지 못했습니다</h1>
          <p className="mt-4 text-[color:var(--ink)] opacity-70">
            요청한 날짜({params.date}) 리포트가 아직 생성되지 않았습니다.
          </p>
          <Link
            href="/daily"
            className="inline-flex mt-6 px-6 py-3 rounded-full bg-[color:var(--accent)] text-white"
          >
            아카이브로 이동
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen max-w-6xl mx-auto px-6 py-12">
      <header className="mb-10">
        <div className="flex items-center gap-3 mb-4">
          <span className="badge">Daily Report</span>
          <span className="text-sm uppercase tracking-[0.24em] text-[color:var(--ink)] opacity-70">
            {formatDisplayDate(report.date)}
          </span>
        </div>
        <h1 className="text-4xl md:text-5xl font-semibold">{report.title}</h1>
        <div className="mt-6 flex gap-4 text-sm text-[color:var(--ink)] opacity-60">
          <span>섹션 {report.sections.length}개</span>
          <span>생성 {new Date(report.createdAt).toLocaleString('ko-KR')}</span>
        </div>
        <Link href="/" className="inline-flex mt-6 text-[color:var(--accent-dark)]">
          ← 홈으로 돌아가기
        </Link>
      </header>

      {run && (
        <section className="section-card p-6 mb-8">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-semibold">수집 상태</h2>
            <span className="text-sm text-[color:var(--ink)] opacity-60">
              수집 {run.collected}건 · 요약 {run.summarized}건
            </span>
          </div>
          <div className="divider my-4" />
          {run.errors.length === 0 ? (
            <p className="text-[color:var(--ink)] opacity-70">모든 소스 정상 수집</p>
          ) : (
            <div className="text-[color:var(--ink)] opacity-70 space-y-2">
              <p>일부 소스에서 오류가 발생했습니다.</p>
              <ul className="list-disc list-inside text-sm">
                {run.errors.map((error) => (
                  <li key={error}>{error}</li>
                ))}
              </ul>
            </div>
          )}
        </section>
      )}

      <div className="grid gap-8">
        {report.sections.map((section) => (
          <section key={section.title} className="section-card p-8">
            <div className="flex items-center justify-between gap-4">
              <div>
                <h2 className="text-2xl font-semibold">{section.title}</h2>
                {section.description && (
                  <p className="text-[color:var(--ink)] opacity-60 mt-2">{section.description}</p>
                )}
              </div>
              <span className="text-sm text-[color:var(--ink)] opacity-60">
                {section.items.length}건
              </span>
            </div>
            <div className="divider my-6" />
            <div className="grid gap-6">
              {section.items.map((item) => (
                <article
                  key={item.itemId}
                  className="p-5 rounded-2xl border border-[color:var(--border)] bg-[color:var(--surface-muted)]"
                >
                  <div className="flex flex-wrap items-center gap-3 text-sm text-[color:var(--ink)] opacity-60">
                    <span className="uppercase tracking-[0.2em]">{item.source}</span>
                    {item.score !== undefined && <span>스코어 {item.score}</span>}
                    {item.commentCount !== undefined && <span>댓글 {item.commentCount}</span>}
                    <span>{new Date(item.createdAt).toLocaleString('ko-KR')}</span>
                  </div>
                  <h3 className="text-xl font-semibold mt-3">
                    <a href={item.url} target="_blank" rel="noreferrer">
                      {item.title}
                    </a>
                  </h3>
                  {item.summary && (
                    <p className="mt-3 text-[color:var(--ink)] opacity-70">{item.summary}</p>
                  )}
                  {item.clusterSize && item.clusterSize > 1 && (
                    <div className="mt-3 text-sm text-[color:var(--ink)] opacity-60">
                      관련 소스: {item.relatedSources?.join(', ')} · {item.clusterSize}건 묶음
                    </div>
                  )}
                  {item.relatedUrls && item.relatedUrls.length > 1 && (
                    <div className="mt-3 text-sm text-[color:var(--ink)] opacity-60">
                      <p className="uppercase tracking-[0.2em] mb-2">관련 링크</p>
                      <ul className="space-y-1">
                        {item.relatedUrls.map((url, index) => (
                          <li key={url}>
                            <a href={url} target="_blank" rel="noreferrer">
                              {item.relatedTitles?.[index] ?? url}
                            </a>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                  {item.evidence && item.evidence.length > 0 && (
                    <div className="mt-4 text-sm text-[color:var(--ink)] opacity-60">
                      <p className="uppercase tracking-[0.2em] mb-2">근거</p>
                      <ul className="space-y-1">
                        {item.evidence.map((evidence) => (
                          <li key={evidence}>• {evidence}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                  <div className="mt-4 flex flex-wrap gap-2">
                    {item.keywords.map((keyword) => (
                      <span
                        key={keyword}
                        className="badge text-[color:var(--ink)] opacity-70"
                      >
                        {keyword}
                      </span>
                    ))}
                  </div>
                </article>
              ))}
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}
