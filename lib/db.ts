import Database from "better-sqlite3";
import { mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";

declare global {
  // eslint-disable-next-line no-var
  var __jrjrDb: Database.Database | undefined;
}

const DB_PATH = resolve(process.cwd(), process.env.DATABASE_PATH || "./data/jrjr.db");

function openDb(): Database.Database {
  mkdirSync(dirname(DB_PATH), { recursive: true });
  const db = new Database(DB_PATH);
  db.pragma("journal_mode = WAL");
  db.pragma("foreign_keys = ON");
  migrate(db);
  return db;
}

function migrate(db: Database.Database) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL,
      updated_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS counter_readings (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      amount_pln REAL NOT NULL,
      source TEXT NOT NULL CHECK(source IN ('ocr','manual')),
      note TEXT,
      created_at INTEGER NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_counter_readings_created_at
      ON counter_readings (created_at DESC);

    CREATE TABLE IF NOT EXISTS guests (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      handle TEXT,
      instagram TEXT,
      appearance_date TEXT,
      status TEXT NOT NULL DEFAULT 'past' CHECK(status IN ('past','upcoming')),
      photo_url TEXT,
      sort_order INTEGER NOT NULL DEFAULT 0,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_guests_status_sort
      ON guests (status, sort_order, appearance_date);

    CREATE TABLE IF NOT EXISTS media_mentions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      outlet TEXT NOT NULL,
      url TEXT NOT NULL,
      image_url TEXT,
      published_at TEXT,
      sort_order INTEGER NOT NULL DEFAULT 0,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_media_mentions_sort
      ON media_mentions (sort_order, published_at DESC, id DESC);

    CREATE TABLE IF NOT EXISTS ocr_regions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT,
      x REAL NOT NULL,
      y REAL NOT NULL,
      width REAL NOT NULL,
      height REAL NOT NULL,
      enabled INTEGER NOT NULL DEFAULT 1,
      sort_order INTEGER NOT NULL DEFAULT 0,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_ocr_regions_sort
      ON ocr_regions (enabled DESC, sort_order ASC, id ASC);
  `);

  // Per-region "last successfully parsed" memory. Added after launch, so
  // we guard each ALTER with try/catch for idempotency on old DBs.
  for (const ddl of [
    "ALTER TABLE ocr_regions ADD COLUMN last_amount REAL",
    "ALTER TABLE ocr_regions ADD COLUMN last_parsed_at INTEGER",
  ]) {
    try {
      db.exec(ddl);
    } catch {
      /* already added — fine */
    }
  }

  // Lightweight first-party analytics. One row per public-page SSR
  // render. IP is hashed with a per-day salt so "uniques per day" makes
  // sense without persisting raw IPs.
  db.exec(`
    CREATE TABLE IF NOT EXISTS page_views (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      path TEXT NOT NULL,
      referrer TEXT,
      user_agent TEXT,
      ip_hash TEXT,
      ts INTEGER NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_page_views_ts ON page_views (ts DESC);
    CREATE INDEX IF NOT EXISTS idx_page_views_path_ts
      ON page_views (path, ts DESC);
    CREATE INDEX IF NOT EXISTS idx_page_views_iphash_ts
      ON page_views (ip_hash, ts DESC);
  `);

  const seedSetting = db.prepare(`
    INSERT OR IGNORE INTO settings (key, value, updated_at)
    VALUES (?, ?, ?)
  `);

  const now = Date.now();
  const defaults: Record<string, string> = {
    donation_url_1: "https://tipply.pl/@latwogang",
    donation_url_2: "https://www.siepomaga.pl/latwogang",
    donation_label_1: "Tipply",
    donation_label_2: "Siepomaga",
    // Stream ends Sunday 26 April 2026, 16:00 Europe/Warsaw.
    stream_end_iso: "2026-04-26T16:00",
    about_text:
      "Łatwogang postanowił zrobić coś, czego nikt jeszcze nie robił — przez dziewięć dni non-stop słuchać na streamie jednego utworu: Mai i Bedoesa. Pomysł wziął się z TikToka, gdzie każde polubienie miało oznaczać sekundę transmisji. Sekund nazbierało się tyle, że wyszło równe dziewięć dni. Zamiast odpuścić, Łatwogang zamienił to w akcję charytatywną na rzecz dzieci chorych na raka.",
    initiators_text:
      "Inicjatorami akcji są Łatwogang i Bedoes. Do transmisji dołączają kolejni influencerzy — golą głowy w geście solidarności z pacjentami onkologicznymi, robią sobie tatuaże, licytują przedmioty. Widzowie zachęcani są do wpłat na rzecz Fundacji Cancer Fighters.",
    foundation_text:
      "Fundacja Cancer Fighters od lat wspiera dzieci chore na nowotwory oraz ich rodziny. Środki zebrane podczas transmisji trafiają bezpośrednio na konto fundacji i finansują leczenie, rehabilitację oraz codzienne potrzeby podopiecznych.",
    foundation_url: "https://cancerfighters.pl",
    latwogang_ig: "",
    bedoes_ig: "",
    cancerfighters_ig: "",
  };

  for (const [k, v] of Object.entries(defaults)) {
    seedSetting.run(k, v, now);
  }
}

export function getDb(): Database.Database {
  if (!globalThis.__jrjrDb) {
    globalThis.__jrjrDb = openDb();
  }
  return globalThis.__jrjrDb;
}

// ---- Settings ----

export function getSetting(key: string): string {
  const row = getDb()
    .prepare<string>("SELECT value FROM settings WHERE key = ?")
    .get(key) as { value: string } | undefined;
  return row?.value ?? "";
}

export function getAllSettings(): Record<string, string> {
  const rows = getDb()
    .prepare("SELECT key, value FROM settings")
    .all() as Array<{ key: string; value: string }>;
  return Object.fromEntries(rows.map((r) => [r.key, r.value]));
}

export function setSetting(key: string, value: string) {
  getDb()
    .prepare(
      `INSERT INTO settings (key, value, updated_at)
       VALUES (?, ?, ?)
       ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at`,
    )
    .run(key, value, Date.now());
}

// ---- Counter ----

export type CounterReading = {
  id: number;
  amount_pln: number;
  source: "ocr" | "manual";
  note: string | null;
  created_at: number;
};

export function insertCounter(
  amount: number,
  source: "ocr" | "manual",
  note?: string,
): CounterReading {
  const stmt = getDb().prepare(
    `INSERT INTO counter_readings (amount_pln, source, note, created_at)
     VALUES (?, ?, ?, ?)`,
  );
  const created_at = Date.now();
  const info = stmt.run(amount, source, note ?? null, created_at);
  return {
    id: Number(info.lastInsertRowid),
    amount_pln: amount,
    source,
    note: note ?? null,
    created_at,
  };
}

export function getLatestCounter(): CounterReading | null {
  const row = getDb()
    .prepare(
      `SELECT id, amount_pln, source, note, created_at
       FROM counter_readings
       ORDER BY created_at DESC
       LIMIT 1`,
    )
    .get() as CounterReading | undefined;
  return row ?? null;
}

export function getLatestOcrCounter(): CounterReading | null {
  const row = getDb()
    .prepare(
      `SELECT id, amount_pln, source, note, created_at
       FROM counter_readings
       WHERE source = 'ocr'
       ORDER BY created_at DESC
       LIMIT 1`,
    )
    .get() as CounterReading | undefined;
  return row ?? null;
}

// ---- Guests ----

export type Guest = {
  id: number;
  name: string;
  handle: string | null;
  instagram: string | null;
  appearance_date: string | null;
  status: "past" | "upcoming";
  photo_url: string | null;
  sort_order: number;
  created_at: number;
  updated_at: number;
};

export function listGuests(): Guest[] {
  return getDb()
    .prepare(
      `SELECT * FROM guests
       ORDER BY
         CASE status WHEN 'upcoming' THEN 0 ELSE 1 END,
         sort_order ASC,
         COALESCE(appearance_date, '9999') ASC,
         id ASC`,
    )
    .all() as Guest[];
}

export function createGuest(input: Omit<Guest, "id" | "created_at" | "updated_at">): Guest {
  const now = Date.now();
  const info = getDb()
    .prepare(
      `INSERT INTO guests (name, handle, instagram, appearance_date, status, photo_url, sort_order, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .run(
      input.name,
      input.handle,
      input.instagram,
      input.appearance_date,
      input.status,
      input.photo_url,
      input.sort_order,
      now,
      now,
    );
  return { id: Number(info.lastInsertRowid), ...input, created_at: now, updated_at: now };
}

export function updateGuest(id: number, patch: Partial<Omit<Guest, "id" | "created_at">>) {
  const current = getDb().prepare("SELECT * FROM guests WHERE id = ?").get(id) as Guest | undefined;
  if (!current) return null;
  const next: Guest = { ...current, ...patch, updated_at: Date.now() };
  getDb()
    .prepare(
      `UPDATE guests SET name = ?, handle = ?, instagram = ?, appearance_date = ?, status = ?, photo_url = ?, sort_order = ?, updated_at = ?
       WHERE id = ?`,
    )
    .run(
      next.name,
      next.handle,
      next.instagram,
      next.appearance_date,
      next.status,
      next.photo_url,
      next.sort_order,
      next.updated_at,
      id,
    );
  return next;
}

export function deleteGuest(id: number) {
  getDb().prepare("DELETE FROM guests WHERE id = ?").run(id);
}

// ---- Media mentions ----

export type MediaMention = {
  id: number;
  title: string;
  outlet: string;
  url: string;
  image_url: string | null;
  published_at: string | null;
  sort_order: number;
  created_at: number;
  updated_at: number;
};

export function listMedia(): MediaMention[] {
  return getDb()
    .prepare(
      `SELECT * FROM media_mentions
       ORDER BY sort_order ASC,
                COALESCE(published_at, '0000') DESC,
                id DESC`,
    )
    .all() as MediaMention[];
}

export function createMedia(
  input: Omit<MediaMention, "id" | "created_at" | "updated_at">,
): MediaMention {
  const now = Date.now();
  const info = getDb()
    .prepare(
      `INSERT INTO media_mentions (title, outlet, url, image_url, published_at, sort_order, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .run(
      input.title,
      input.outlet,
      input.url,
      input.image_url,
      input.published_at,
      input.sort_order,
      now,
      now,
    );
  return { id: Number(info.lastInsertRowid), ...input, created_at: now, updated_at: now };
}

export function updateMedia(
  id: number,
  patch: Partial<Omit<MediaMention, "id" | "created_at">>,
) {
  const current = getDb()
    .prepare("SELECT * FROM media_mentions WHERE id = ?")
    .get(id) as MediaMention | undefined;
  if (!current) return null;
  const next: MediaMention = { ...current, ...patch, updated_at: Date.now() };
  getDb()
    .prepare(
      `UPDATE media_mentions SET title = ?, outlet = ?, url = ?, image_url = ?, published_at = ?, sort_order = ?, updated_at = ?
       WHERE id = ?`,
    )
    .run(
      next.title,
      next.outlet,
      next.url,
      next.image_url,
      next.published_at,
      next.sort_order,
      next.updated_at,
      id,
    );
  return next;
}

export function deleteMedia(id: number) {
  getDb().prepare("DELETE FROM media_mentions WHERE id = ?").run(id);
}

// ---- OCR regions ----

export type OcrRegion = {
  id: number;
  name: string | null;
  x: number;
  y: number;
  width: number;
  height: number;
  enabled: 0 | 1;
  sort_order: number;
  // "last successfully parsed" value + timestamp. Null until the first
  // successful OCR pass. When a tick fails to parse anything from this
  // region, we fall back to this instead of contributing 0 to the sum.
  last_amount: number | null;
  last_parsed_at: number | null;
  created_at: number;
  updated_at: number;
};

export function listRegions(): OcrRegion[] {
  return getDb()
    .prepare(
      `SELECT * FROM ocr_regions
       ORDER BY enabled DESC, sort_order ASC, id ASC`,
    )
    .all() as OcrRegion[];
}

export function listEnabledRegions(): OcrRegion[] {
  return getDb()
    .prepare(
      `SELECT * FROM ocr_regions
       WHERE enabled = 1
       ORDER BY sort_order ASC, id ASC`,
    )
    .all() as OcrRegion[];
}

export function createRegion(
  input: Omit<
    OcrRegion,
    "id" | "created_at" | "updated_at" | "last_amount" | "last_parsed_at"
  > &
    Partial<Pick<OcrRegion, "last_amount" | "last_parsed_at">>,
): OcrRegion {
  const now = Date.now();
  const info = getDb()
    .prepare(
      `INSERT INTO ocr_regions (name, x, y, width, height, enabled, sort_order, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .run(
      input.name,
      input.x,
      input.y,
      input.width,
      input.height,
      input.enabled,
      input.sort_order,
      now,
      now,
    );
  return {
    id: Number(info.lastInsertRowid),
    name: input.name,
    x: input.x,
    y: input.y,
    width: input.width,
    height: input.height,
    enabled: input.enabled,
    sort_order: input.sort_order,
    last_amount: input.last_amount ?? null,
    last_parsed_at: input.last_parsed_at ?? null,
    created_at: now,
    updated_at: now,
  };
}

export function updateRegion(
  id: number,
  patch: Partial<Omit<OcrRegion, "id" | "created_at">>,
) {
  const current = getDb()
    .prepare("SELECT * FROM ocr_regions WHERE id = ?")
    .get(id) as OcrRegion | undefined;
  if (!current) return null;
  const next: OcrRegion = { ...current, ...patch, updated_at: Date.now() };
  getDb()
    .prepare(
      `UPDATE ocr_regions SET name = ?, x = ?, y = ?, width = ?, height = ?, enabled = ?, sort_order = ?, updated_at = ?
       WHERE id = ?`,
    )
    .run(
      next.name,
      next.x,
      next.y,
      next.width,
      next.height,
      next.enabled,
      next.sort_order,
      next.updated_at,
      id,
    );
  return next;
}

export function deleteRegion(id: number) {
  getDb().prepare("DELETE FROM ocr_regions WHERE id = ?").run(id);
}

// Call this each time a region OCR pass yielded a usable amount. Keeps
// a per-region "last known good" value so subsequent failed OCR ticks
// can fall back to it instead of zeroing the region out.
export function setRegionLastAmount(id: number, amount: number) {
  getDb()
    .prepare(
      `UPDATE ocr_regions SET last_amount = ?, last_parsed_at = ? WHERE id = ?`,
    )
    .run(amount, Date.now(), id);
}

// ---- Analytics ----

export type PageView = {
  id: number;
  path: string;
  referrer: string | null;
  user_agent: string | null;
  ip_hash: string | null;
  ts: number;
};

export function insertPageView(row: {
  path: string;
  referrer: string | null;
  userAgent: string | null;
  ipHash: string | null;
}) {
  getDb()
    .prepare(
      `INSERT INTO page_views (path, referrer, user_agent, ip_hash, ts)
       VALUES (?, ?, ?, ?, ?)`,
    )
    .run(row.path, row.referrer, row.userAgent, row.ipHash, Date.now());
}

export type StatsBucket = { total: number; uniques: number };

export function statsSince(sinceMs: number, path?: string): StatsBucket {
  const where = path
    ? `WHERE ts >= ? AND path = ?`
    : `WHERE ts >= ?`;
  const args: Array<number | string> = path ? [sinceMs, path] : [sinceMs];
  const row = getDb()
    .prepare(
      `SELECT COUNT(*) AS total, COUNT(DISTINCT ip_hash) AS uniques
       FROM page_views ${where}`,
    )
    .get(...args) as { total: number; uniques: number };
  return { total: row.total, uniques: row.uniques };
}

export function pathBreakdown(
  sinceMs: number,
  limit = 20,
): Array<{ path: string; views: number; uniques: number }> {
  return getDb()
    .prepare(
      `SELECT path,
              COUNT(*) AS views,
              COUNT(DISTINCT ip_hash) AS uniques
       FROM page_views
       WHERE ts >= ?
       GROUP BY path
       ORDER BY views DESC
       LIMIT ?`,
    )
    .all(sinceMs, limit) as Array<{ path: string; views: number; uniques: number }>;
}

export function topReferrers(
  sinceMs: number,
  limit = 10,
): Array<{ referrer: string; views: number }> {
  return getDb()
    .prepare(
      `SELECT COALESCE(NULLIF(referrer, ''), '(bezpośrednio)') AS referrer,
              COUNT(*) AS views
       FROM page_views
       WHERE ts >= ?
       GROUP BY referrer
       ORDER BY views DESC
       LIMIT ?`,
    )
    .all(sinceMs, limit) as Array<{ referrer: string; views: number }>;
}

export function hourlyTimeline(
  hoursBack: number,
): Array<{ hourBucket: number; views: number; uniques: number }> {
  const sinceMs = Date.now() - hoursBack * 3600_000;
  return getDb()
    .prepare(
      `SELECT (ts / 3600000) AS hourBucket,
              COUNT(*) AS views,
              COUNT(DISTINCT ip_hash) AS uniques
       FROM page_views
       WHERE ts >= ?
       GROUP BY hourBucket
       ORDER BY hourBucket ASC`,
    )
    .all(sinceMs) as Array<{ hourBucket: number; views: number; uniques: number }>;
}

export function recentPageViews(limit = 30): PageView[] {
  return getDb()
    .prepare(
      `SELECT id, path, referrer, user_agent, ip_hash, ts
       FROM page_views
       ORDER BY ts DESC
       LIMIT ?`,
    )
    .all(limit) as PageView[];
}
