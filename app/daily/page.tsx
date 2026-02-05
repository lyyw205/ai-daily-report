import Link from 'next/link';
import { listReports } from '@/lib/db';
import { formatDisplayDate } from '@/lib/utils/time';

export const dynamic = 'force-dynamic';

export default function DailyListPage() {
  const reports = listReports(30);

  return (
    <div className="min-h-screen max-w-5xl mx-auto px-6 py-12">
      <header className="mb-10">
        <div className="flex items-center gap-3 mb-4">
          <span className="badge">Archive</span>
          <span className="text-sm uppercase tracking-[0.24em] text-[color:var(--ink)] opacity-70">
            최근 30일
          </span>
        </div>
        <h1 className="text-4xl md:text-5xl font-semibold">AI 데일리 리포트 아카이브</h1>
        <p className="mt-4 text-[color:var(--ink)] opacity-70">
          날짜별로 생성된 리포트를 확인할 수 있습니다.
        </p>
      </header>

      {reports.length === 0 ? (
        <div className="section-card p-8 text-[color:var(--ink)] opacity-70">
          아직 리포트가 없습니다. `npm run daily`로 첫 리포트를 생성해 주세요.
        </div>
      ) : (
        <div className="grid gap-6">
          {reports.map((report) => (
            <Link
              key={report.date}
              href={`/daily/${report.date}`}
              className="section-card p-6 hover:shadow-[0_20px_60px_var(--shadow)] transition"
            >
              <p className="text-sm uppercase tracking-[0.2em] text-[color:var(--ink)] opacity-60">
                {formatDisplayDate(report.date)}
              </p>
              <h2 className="text-2xl font-semibold mt-2">{report.title}</h2>
              <div className="mt-4 flex flex-wrap gap-4 text-sm text-[color:var(--ink)] opacity-70">
                {report.sections.map((section) => (
                  <span key={section.title}>
                    {section.title} · {section.items.length}건
                  </span>
                ))}
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
