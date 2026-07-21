import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { DatabaseSync } from 'node:sqlite';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dataDir = path.join(__dirname, 'data');
const uploadsDir = path.join(__dirname, 'uploads');

if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });
if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });

const db = new DatabaseSync(path.join(dataDir, 'chat.db'));

db.exec(`
  CREATE TABLE IF NOT EXISTS rooms (
    id TEXT PRIMARY KEY,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS messages (
    id TEXT PRIMARY KEY,
    room_id TEXT NOT NULL,
    sender_id TEXT NOT NULL,
    sender_name TEXT NOT NULL,
    type TEXT NOT NULL DEFAULT 'text',
    content TEXT,
    file_name TEXT,
    file_size INTEGER,
    file_mime TEXT,
    file_path TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE INDEX IF NOT EXISTS idx_messages_room ON messages(room_id, created_at);
`);

export { db, uploadsDir, dataDir };

export function ensureRoom(roomId) {
  const row = db.prepare('SELECT id FROM rooms WHERE id = ?').get(roomId);
  if (!row) {
    db.prepare('INSERT INTO rooms (id) VALUES (?)').run(roomId);
  }
}

export function insertMessage(msg) {
  db.prepare(`
    INSERT INTO messages (id, room_id, sender_id, sender_name, type, content, file_name, file_size, file_mime, file_path)
    VALUES (@id, @room_id, @sender_id, @sender_name, @type, @content, @file_name, @file_size, @file_mime, @file_path)
  `).run(msg);
}

export function getMessagesByRoom(roomId) {
  return db
    .prepare('SELECT * FROM messages WHERE room_id = ? ORDER BY created_at ASC')
    .all(roomId);
}

export function getMessageById(id) {
  return db.prepare('SELECT * FROM messages WHERE id = ?').get(id);
}

export function getRoomUploadDir(roomId) {
  const dir = path.join(uploadsDir, roomId);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  return dir;
}
