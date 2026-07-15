import * as SQLite from "expo-sqlite";

let db: SQLite.SQLiteDatabase | null = null;

export async function initUploadDb() {
  const instance = await SQLite.openDatabaseAsync("cloudmesh_uploads_v3.db");

  await instance.execAsync(`
    CREATE TABLE IF NOT EXISTS local_files (
      file_id TEXT PRIMARY KEY,
      filename TEXT NOT NULL,
      total_bytes INTEGER NOT NULL,
      status TEXT NOT NULL DEFAULT 'PENDING'
    );
  `);

  await instance.execAsync(`
    CREATE TABLE IF NOT EXISTS local_chunks (
      chunk_id TEXT PRIMARY KEY,
      file_id TEXT NOT NULL,
      upload_url TEXT NOT NULL,
      local_path TEXT NOT NULL,
      bytes_sent INTEGER DEFAULT 0,
      total_bytes INTEGER NOT NULL,
      status TEXT NOT NULL DEFAULT 'PENDING',
      checksum TEXT NOT NULL,
      FOREIGN KEY(file_id) REFERENCES local_files(file_id) ON DELETE CASCADE
    );
  `);

  // 🔧 Migration: add failure-tracking columns if they don't exist yet.
  // Wrapped individually since SQLite errors on ALTER TABLE ADD COLUMN
  // if the column already exists — safe to ignore that specific failure.
  const migrations = [
    `ALTER TABLE local_files ADD COLUMN failure_reason TEXT`,
    `ALTER TABLE local_chunks ADD COLUMN last_error TEXT`,
  ];
  for (const sql of migrations) {
    try {
      await instance.execAsync(sql);
    } catch {
      // Column already exists — expected on subsequent app launches, ignore.
    }
  }

  db = instance;
  console.log("🚀 SQLite database and schemas initialized successfully.");
}

export { db };
