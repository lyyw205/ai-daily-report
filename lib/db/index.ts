import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';
import { CanonicalItem, DailyReport, RunStats, SummaryResult } from '@/lib/types';

const resolveDbPath = () => {
  const explicit = process.env.AI_DAILY_DB_PATH;
  if (explicit) return path.resolve(explicit);

  const dataDir = process.env.AI_DAILY_DATA_DIR
    ? path.resolve(process.env.AI_DAILY_DATA_DIR)
    : path.join(process.cwd(), 'data');

  return path.join(dataDir, 'ai-daily-report.db');
};

const dbPath = resolveDbPath();
let db: Database | null = null;

const ensureDbDir = () => {
  const dir = path.dirname(dbPath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
};

const migrate = (database: Database) => {
  database.exec(`
    CREATE TABLE IF NOT EXISTS items (
      id TEXT PRIMARY KEY,
      source TEXT NOT NULL,
      title TEXT NOT NULL,
      url TEXT NOT NULL,
      author TEXT,
      created_at TEXT NOT NULL,
      score INTEGER,
      comment_count INTEGER,
      content TEXT,
      keywords TEXT NOT NULL,
      raw TEXT
    );

    CREATE INDEX IF NOT EXISTS idx_items_created_at ON items(created_at);

    CREATE TABLE IF NOT EXISTS summaries (
      item_id TEXT PRIMARY KEY,
      summary TEXT NOT NULL,
      evidence TEXT,
      model TEXT,
      created_at TEXT NOT NULL,
      FOREIGN KEY(item_id) REFERENCES items(id)
    );

    CREATE TABLE IF NOT EXISTS reports (
      date TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      sections TEXT NOT NULL,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS runs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      date TEXT NOT NULL,
      stats TEXT NOT NULL,
      created_at TEXT NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_runs_date ON runs(date);

    CREATE TABLE IF NOT EXISTS item_snapshots (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      item_id TEXT NOT NULL,
      captured_at TEXT NOT NULL,
      score INTEGER,
      comment_count INTEGER,
      FOREIGN KEY(item_id) REFERENCES items(id)
    );

    CREATE INDEX IF NOT EXISTS idx_snapshots_item ON item_snapshots(item_id);
  `);
};

export const getDb = () => {
  if (db) return db;
  ensureDbDir();
  db = new Database(dbPath);
  migrate(db);
  return db;
};

export const upsertItems = (items: CanonicalItem[]) => {
  if (items.length === 0) return;
  const database = getDb();
  const stmt = database.prepare(`
    INSERT INTO items (id, source, title, url, author, created_at, score, comment_count, content, keywords, raw)
    VALUES (@id, @source, @title, @url, @author, @createdAt, @score, @commentCount, @content, @keywords, @raw)
    ON CONFLICT(id) DO UPDATE SET
      title=excluded.title,
      url=excluded.url,
      author=excluded.author,
      created_at=excluded.created_at,
      score=excluded.score,
      comment_count=excluded.comment_count,
      content=excluded.content,
      keywords=excluded.keywords,
      raw=excluded.raw
  `);

  const insertMany = database.transaction((rows: CanonicalItem[]) => {
    for (const item of rows) {
      stmt.run({
        ...item,
        keywords: JSON.stringify(item.keywords),
        raw: item.raw ? JSON.stringify(item.raw) : null,
      });
    }
  });

  insertMany(items);
};

export const upsertSummary = (summary: SummaryResult) => {
  const database = getDb();
  const stmt = database.prepare(`
    INSERT INTO summaries (item_id, summary, evidence, model, created_at)
    VALUES (@itemId, @summary, @evidence, @model, @createdAt)
    ON CONFLICT(item_id) DO UPDATE SET
      summary=excluded.summary,
      evidence=excluded.evidence,
      model=excluded.model,
      created_at=excluded.created_at
  `);

  stmt.run({
    itemId: summary.itemId,
    summary: summary.summary,
    evidence: JSON.stringify(summary.evidence),
    model: summary.model,
    createdAt: summary.createdAt,
  });
};

export const upsertReport = (report: DailyReport) => {
  const database = getDb();
  const stmt = database.prepare(`
    INSERT INTO reports (date, title, sections, created_at)
    VALUES (@date, @title, @sections, @createdAt)
    ON CONFLICT(date) DO UPDATE SET
      title=excluded.title,
      sections=excluded.sections,
      created_at=excluded.created_at
  `);

  stmt.run({
    date: report.date,
    title: report.title,
    sections: JSON.stringify(report.sections),
    createdAt: report.createdAt,
  });
};

export const getLatestReport = (): DailyReport | null => {
  const database = getDb();
  const row = database
    .prepare('SELECT date, title, sections, created_at FROM reports ORDER BY date DESC LIMIT 1')
    .get();
  if (!row) return null;
  return {
    date: row.date as string,
    title: row.title as string,
    sections: JSON.parse(row.sections as string),
    createdAt: row.created_at as string,
  };
};

export const getReportByDate = (date: string): DailyReport | null => {
  const database = getDb();
  const row = database
    .prepare('SELECT date, title, sections, created_at FROM reports WHERE date = ?')
    .get(date);
  if (!row) return null;
  return {
    date: row.date as string,
    title: row.title as string,
    sections: JSON.parse(row.sections as string),
    createdAt: row.created_at as string,
  };
};

export const insertRun = (date: string, stats: RunStats) => {
  const database = getDb();
  const stmt = database.prepare(`
    INSERT INTO runs (date, stats, created_at)
    VALUES (?, ?, ?)
  `);
  stmt.run(date, JSON.stringify(stats), new Date().toISOString());
};

export const getRunByDate = (date: string): RunStats | null => {
  const database = getDb();
  const row = database
    .prepare('SELECT stats FROM runs WHERE date = ? ORDER BY created_at DESC LIMIT 1')
    .get(date);
  if (!row) return null;
  return JSON.parse(row.stats as string) as RunStats;
};

export const getLatestRun = (): RunStats | null => {
  const database = getDb();
  const row = database.prepare('SELECT stats FROM runs ORDER BY created_at DESC LIMIT 1').get();
  if (!row) return null;
  return JSON.parse(row.stats as string) as RunStats;
};

export const insertSnapshots = (items: CanonicalItem[]) => {
  if (items.length === 0) return;
  const database = getDb();
  const stmt = database.prepare(`
    INSERT INTO item_snapshots (item_id, captured_at, score, comment_count)
    VALUES (@itemId, @capturedAt, @score, @commentCount)
  `);

  const now = new Date().toISOString();
  const insertMany = database.transaction((rows: CanonicalItem[]) => {
    for (const item of rows) {
      stmt.run({
        itemId: item.id,
        capturedAt: now,
        score: item.score ?? null,
        commentCount: item.commentCount ?? null,
      });
    }
  });

  insertMany(items);
};

export const getLatestSnapshots = (itemIds: string[]) => {
  if (itemIds.length === 0) return new Map<string, { score: number | null; capturedAt: string }>();
  const database = getDb();
  const placeholders = itemIds.map(() => '?').join(',');
  const sql = `
    SELECT s1.item_id, s1.score, s1.captured_at
    FROM item_snapshots s1
    JOIN (
      SELECT item_id, MAX(captured_at) AS max_time
      FROM item_snapshots
      WHERE item_id IN (${placeholders})
      GROUP BY item_id
    ) s2
    ON s1.item_id = s2.item_id AND s1.captured_at = s2.max_time
  `;
  const rows = database.prepare(sql).all(...itemIds);
  const map = new Map<string, { score: number | null; capturedAt: string }>();
  for (const row of rows) {
    map.set(row.item_id as string, {
      score: row.score === null ? null : Number(row.score),
      capturedAt: row.captured_at as string,
    });
  }
  return map;
};

export const listReports = (limit = 30): DailyReport[] => {
  const database = getDb();
  const rows = database
    .prepare('SELECT date, title, sections, created_at FROM reports ORDER BY date DESC LIMIT ?')
    .all(limit);
  return rows.map((row) => ({
    date: row.date as string,
    title: row.title as string,
    sections: JSON.parse(row.sections as string),
    createdAt: row.created_at as string,
  }));
};

export const getSummaryForItem = (itemId: string): SummaryResult | null => {
  const database = getDb();
  const row = database
    .prepare('SELECT item_id, summary, evidence, model, created_at FROM summaries WHERE item_id = ?')
    .get(itemId);
  if (!row) return null;
  return {
    itemId: row.item_id as string,
    summary: row.summary as string,
    evidence: JSON.parse((row.evidence as string) || '[]'),
    model: row.model as string,
    createdAt: row.created_at as string,
  };
};
