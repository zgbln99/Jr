#!/usr/bin/env node
// Initializes / migrates the SQLite database by importing the app's db module.
// Handy as a one-shot after cloning on a fresh VPS.

import { createRequire } from "node:module";
const require = createRequire(import.meta.url);

// Require the compiled or TS file — for raw run we shell out to a tiny Node shim:
// simpler approach: just open the DB through better-sqlite3 directly using the
// same schema as lib/db.ts. Keeps this script dependency-free at runtime.

import Database from "better-sqlite3";
import { mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";

const DB_PATH = resolve(process.cwd(), process.env.DATABASE_PATH || "./data/jrjr.db");
mkdirSync(dirname(DB_PATH), { recursive: true });

const db = new Database(DB_PATH);
db.pragma("journal_mode = WAL");
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

// Post-launch additive columns — idempotent on older DBs too.
for (const ddl of [
  "ALTER TABLE ocr_regions ADD COLUMN last_amount REAL",
  "ALTER TABLE ocr_regions ADD COLUMN last_parsed_at INTEGER",
]) {
  try {
    db.exec(ddl);
  } catch {
    /* already there */
  }
}

console.log(`[db] initialized at ${DB_PATH}`);
db.close();

void require;
