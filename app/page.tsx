import Link from 'next/link';
import { getLatestReport, getLatestRun } from '@/lib/db';
import { formatDisplayDate } from '@/lib/utils/time';

export const dynamic = 'force-dynamic';

export default function Home() {
  const report = getLatestReport();
  const run = getLatestRun();

  return (
    <div className="min-h-screen">
      <header className="max-w-6xl mx-auto px-6 pt-16 pb-12">
        <div className="flex items-center gap-3 mb-6">
          <span className="badge">AI Daily</span>
          <span className="text-sm uppercase tracking-[0.24em] text-[color:var(--ink)] opacity-70">
            09:00 KST
          </span>
        </div>
        <h1 className="text-5xl md:text-6xl font-semibold max-w-3xl">
          아침 9시에 도착하는 AI 커뮤니티 핵심 리포트
        </h1>
        <p className="mt-6 text-lg text-[color:var(--ink)] opacity-70 max-w-2xl">
          Reddit, Hacker News, arXiv, Product Hunt에서 키워드 기반으로 수집한 AI 이슈를
          요약하고 근거 문장까지 연결해주는 데일리 브리핑입니다.
        </p>
        <div className="mt-10 flex flex-wrap gap-4">
          <Link
            href={report ? `/daily/${report.date}` : '/daily'}
            className="px-6 py-3 rounded-full bg-[color:var(--accent)] text-white font-semibold shadow-[0_10px_30px_var(--glow)]"
          >
            최신 리포트 보기
          </Link>
          <Link
            href="/daily"
            className="px-6 py-3 rounded-full border border-[color:var(--border)] bg-[color:var(--surface)]"
          >
            리포트 아카이브
          </Link>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-6 pb-20 grid gap-8 md:grid-cols-[1.4fr_1fr]">
        <section className="section-card p-8">
          <h2 className="text-2xl font-semibold">최신 리포트</h2>
          {report ? (
            <div className="mt-6 space-y-6">
              <div>
                <p className="text-sm uppercase tracking-[0.2em] text-[color:var(--ink)] opacity-60">
                  {formatDisplayDate(report.date)}
                </p>
                <p className="text-lg font-semibold mt-2">{report.title}</p>
              </div>
              <div className="divider" />
              <div className="space-y-4">
                {report.sections.map((section) => (
                  <div key={section.title}>
                    <p className="text-sm text-[color:var(--ink)] opacity-60">{section.title}</p>
                    <p className="text-xl font-semibold">{section.items.length}개 항목</p>
                  </div>
                ))}
              </div>
              <Link
                href={`/daily/${report.date}`}
                className="inline-flex items-center gap-2 text-[color:var(--accent-dark)] font-semibold"
              >
                리포트 열기 →
              </Link>
            </div>
          ) : (
            <div className="mt-6 text-[color:var(--ink)] opacity-70">
              아직 생성된 리포트가 없습니다. `npm run daily` 또는
              `/api/cron/daily` 엔드포인트를 호출해 첫 리포트를 생성하세요.
            </div>
          )}
          {run && (
            <div className="mt-8 border-t border-[color:var(--border)] pt-6">
              <p className="text-sm uppercase tracking-[0.2em] text-[color:var(--ink)] opacity-60">
                수집 상태
              </p>
              {run.errors.length === 0 ? (
                <p className="mt-2 text-[color:var(--ink)] opacity-70">모든 소스 정상 수집</p>
              ) : (
                <ul className="mt-2 text-sm text-[color:var(--ink)] opacity-70 list-disc list-inside">
                  {run.errors.map((error) => (
                    <li key={error}>{error}</li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </section>

        <section className="section-card p-8 bg-[color:var(--surface-muted)]">
          <h2 className="text-2xl font-semibold">운영 기준</h2>
          <ul className="mt-6 space-y-4 text-[color:var(--ink)] opacity-70">
            <li>키워드 기반 수집: AI, LLM, RAG, 에이전트 등</li>
            <li>근거 문장 연결: 요약 문장마다 출처를 기록</li>
            <li>9시 KST 자동 생성: 실패 시 재시도 가능</li>
            <li>로컬 SQLite 저장: 빠르게 동작하고 이관 쉬움</li>
          </ul>
        </section>
      </main>
    </div>
  );
}
