import * as SQLite from "expo-sqlite";

// Initialize as null to make it easy to type-check
let db: SQLite.SQLiteDatabase | null = null;

export async function initUploadDb() {
  // Changed DB name version to bypass any previously corrupted database states
  const instance = await SQLite.openDatabaseAsync("cloudmesh_uploads_v3.db");

  // 📜 Fix: Injected the missing 'S' to turn 'EXIST' into 'EXISTS'
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

  // Only assign to the global export AFTER tables are successfully created
  db = instance;
  console.log("🚀 SQLite database and schemas initialized successfully.");
}

export { db };
