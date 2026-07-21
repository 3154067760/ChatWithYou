import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import os from 'os';
import { fileURLToPath } from 'url';
import { v4 as uuidv4 } from 'uuid';
import {
  db,
  ensureRoom,
  insertMessage,
  getMessagesByRoom,
  getMessageById,
  getRoomUploadDir,
  uploadsDir,
} from './db.js';
import { translateText, translateBatch, normalizeLang } from './translate.js';

const PORT = process.env.PORT || 3010;
const MAX_FILE_SIZE = 20 * 1024 * 1024;
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const clientDist = path.join(__dirname, '..', 'client', 'dist');

function getLanIp() {
  for (const iface of Object.values(os.networkInterfaces())) {
    for (const cfg of iface ?? []) {
      if (cfg.family === 'IPv4' && !cfg.internal && cfg.address.startsWith('192.168.')) {
        return cfg.address;
      }
    }
  }
  return null;
}

const app = express();
app.use(cors({ origin: true, credentials: true }));
app.use(express.json());

const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: { origin: true, credentials: true },
});

function messageToClient(row) {
  const base = {
    id: row.id,
    roomId: row.room_id,
    senderId: row.sender_id,
    senderName: row.sender_name,
    type: row.type,
    content: row.content,
    createdAt: row.created_at,
  };
  if (row.type === 'image' || row.type === 'file') {
    base.fileName = row.file_name;
    base.fileSize = row.file_size;
    base.fileMime = row.file_mime;
    base.fileUrl = `/api/files/${row.id}`;
  }
  return base;
}

function rowToExport(row, host) {
  const line = {
    id: row.id,
    senderName: row.sender_name,
    type: row.type,
    content: row.content,
    createdAt: row.created_at,
  };
  if (row.file_name) {
    line.fileName = row.file_name;
    line.fileSize = row.file_size;
    line.downloadUrl = host ? `${host}/api/files/${row.id}` : `/api/files/${row.id}`;
  }
  return line;
}

app.post('/api/rooms', (_req, res) => {
  const roomId = uuidv4().slice(0, 8);
  ensureRoom(roomId);
  res.json({ roomId });
});

app.get('/api/rooms/:roomId/messages', (req, res) => {
  const { roomId } = req.params;
  const room = db.prepare('SELECT id FROM rooms WHERE id = ?').get(roomId);
  if (!room) {
    return res.status(404).json({ error: '房间不存在' });
  }
  const rows = getMessagesByRoom(roomId);
  res.json(rows.map(messageToClient));
});

app.post('/api/translate', async (req, res) => {
  const { text, targetLang, sourceLang } = req.body || {};
  if (!text || !targetLang) {
    return res.status(400).json({ error: '缺少 text 或 targetLang' });
  }
  try {
    const translated = await translateText(text, normalizeLang(targetLang), sourceLang || 'auto');
    res.json({ translated, targetLang: normalizeLang(targetLang) });
  } catch (e) {
    res.status(502).json({ error: e.message || '翻译失败' });
  }
});

app.post('/api/translate/batch', async (req, res) => {
  const { items, targetLang } = req.body || {};
  if (!Array.isArray(items) || !targetLang) {
    return res.status(400).json({ error: '缺少 items 或 targetLang' });
  }
  const batch = items
    .filter((i) => i?.id && i?.text)
    .slice(0, 30)
    .map((i) => ({ id: i.id, text: String(i.text).slice(0, 500) }));
  try {
    const translations = await translateBatch(batch, normalizeLang(targetLang));
    res.json({ translations, targetLang: normalizeLang(targetLang) });
  } catch (e) {
    res.status(502).json({ error: e.message || '翻译失败' });
  }
});

const tmpUploadDir = path.join(uploadsDir, '_tmp');
if (!fs.existsSync(tmpUploadDir)) fs.mkdirSync(tmpUploadDir, { recursive: true });

const storage = multer.diskStorage({
  destination(_req, _file, cb) {
    cb(null, tmpUploadDir);
  },
  filename(_req, file, cb) {
    const ext = path.extname(file.originalname) || '';
    cb(null, `${uuidv4()}${ext}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: MAX_FILE_SIZE },
  fileFilter(_req, file, cb) {
    const blocked = ['.exe', '.bat', '.cmd', '.sh', '.msi'];
    const ext = path.extname(file.originalname).toLowerCase();
    if (blocked.includes(ext)) {
      return cb(new Error('不允许的文件类型'));
    }
    cb(null, true);
  },
});

app.post('/api/upload', (req, res) => {
  upload.single('file')(req, res, (err) => {
    if (err) {
      return res.status(400).json({ error: err.message || '上传失败' });
    }
    if (!req.file) {
      return res.status(400).json({ error: '未选择文件' });
    }

    const { senderId, senderName } = req.body;
    const roomId = req.body.roomId || req.query.roomId;
    if (!roomId || !senderId || !senderName) {
      fs.unlinkSync(req.file.path);
      return res.status(400).json({ error: '缺少 roomId / senderId / senderName' });
    }

    const room = db.prepare('SELECT id FROM rooms WHERE id = ?').get(roomId);
    if (!room) {
      fs.unlinkSync(req.file.path);
      return res.status(404).json({ error: '房间不存在' });
    }

    ensureRoom(roomId);
    const roomDir = getRoomUploadDir(roomId);
    const finalPath = path.join(roomDir, req.file.filename);
    fs.renameSync(req.file.path, finalPath);

    const isImage = req.file.mimetype.startsWith('image/');
    const id = uuidv4();
    const relativePath = path.join(roomId, req.file.filename);

    insertMessage({
      id,
      room_id: roomId,
      sender_id: senderId,
      sender_name: senderName,
      type: isImage ? 'image' : 'file',
      content: null,
      file_name: req.file.originalname,
      file_size: req.file.size,
      file_mime: req.file.mimetype,
      file_path: relativePath,
    });

    const row = getMessageById(id);
    const message = messageToClient(row);
    io.to(roomId).emit('message', message);
    res.json(message);
  });
});

app.get('/api/files/:messageId', (req, res) => {
  const row = getMessageById(req.params.messageId);
  if (!row || !row.file_path) {
    return res.status(404).json({ error: '文件不存在' });
  }
  const fullPath = path.join(uploadsDir, row.file_path);
  if (!fs.existsSync(fullPath)) {
    return res.status(404).json({ error: '文件已丢失' });
  }
  res.setHeader('Content-Type', row.file_mime || 'application/octet-stream');
  const encoded = encodeURIComponent(row.file_name);
  res.setHeader(
    'Content-Disposition',
    `inline; filename*=UTF-8''${encoded}`
  );
  fs.createReadStream(fullPath).pipe(res);
});

app.get('/api/rooms/:roomId/export', (req, res) => {
  const { roomId } = req.params;
  const format = (req.query.format || 'json').toLowerCase();
  const room = db.prepare('SELECT id FROM rooms WHERE id = ?').get(roomId);
  if (!room) {
    return res.status(404).json({ error: '房间不存在' });
  }

  const host = `${req.protocol}://${req.get('host')}`;
  const rows = getMessagesByRoom(roomId);
  const exported = rows.map((r) => rowToExport(r, host));

  if (format === 'txt') {
    const lines = exported.map((m) => {
      const time = m.createdAt;
      if (m.type === 'text' || m.type === 'system') {
        return `[${time}] ${m.senderName}: ${m.content ?? ''}`;
      }
      if (m.type === 'image') {
        return `[${time}] ${m.senderName}: [图片] ${m.fileName} (${formatSize(m.fileSize)}) ${m.downloadUrl}`;
      }
      return `[${time}] ${m.senderName}: [文件] ${m.fileName} (${formatSize(m.fileSize)}) ${m.downloadUrl}`;
    });
    const body = `房间 ${roomId}\n导出时间 ${new Date().toISOString()}\n\n${lines.join('\n')}\n`;
    res.setHeader('Content-Type', 'text/plain; charset=utf-8');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="chat-${roomId}.txt"`
    );
    return res.send(body);
  }

  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader(
    'Content-Disposition',
    `attachment; filename="chat-${roomId}.json"`
  );
  res.json({
    roomId,
    exportedAt: new Date().toISOString(),
    messageCount: exported.length,
    messages: exported,
  });
});

function formatSize(bytes) {
  if (bytes == null) return '0 B';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

io.on('connection', (socket) => {
  let currentRoom = null;
  let visitorId = null;
  let visitorName = null;

  socket.on('join', ({ roomId, senderId, senderName }) => {
    if (!roomId || !senderId || !senderName) return;

    const room = db.prepare('SELECT id FROM rooms WHERE id = ?').get(roomId);
    if (!room) {
      socket.emit('error', { message: '房间不存在，请先创建或检查房间号' });
      return;
    }

    if (currentRoom) socket.leave(currentRoom);
    currentRoom = roomId;
    visitorId = senderId;
    visitorName = senderName;
    socket.join(roomId);

    const peers = io.sockets.adapter.rooms.get(roomId);
    const peerCount = peers ? peers.size : 0;
    if (peerCount > 1) {
      socket.emit('peer-present');
    }

    socket.emit('joined', { roomId });
    socket.to(roomId).emit('peer-joined', { senderId, senderName });

    const systemId = uuidv4();
    insertMessage({
      id: systemId,
      room_id: roomId,
      sender_id: 'system',
      sender_name: '系统',
      type: 'system',
      content: `${senderName} 加入了聊天`,
      file_name: null,
      file_size: null,
      file_mime: null,
      file_path: null,
    });
    const sysMsg = messageToClient(getMessageById(systemId));
    io.to(roomId).emit('message', sysMsg);
  });

  socket.on('send-message', ({ content }) => {
    if (!currentRoom || !visitorId || !visitorName) return;
    const text = (content || '').trim();
    if (!text) return;

    const id = uuidv4();
    insertMessage({
      id,
      room_id: currentRoom,
      sender_id: visitorId,
      sender_name: visitorName,
      type: 'text',
      content: text,
      file_name: null,
      file_size: null,
      file_mime: null,
      file_path: null,
    });
    const message = messageToClient(getMessageById(id));
    io.to(currentRoom).emit('message', message);
  });

  socket.on('webrtc-signal', (payload) => {
    if (!currentRoom) return;
    socket.to(currentRoom).emit('webrtc-signal', {
      ...payload,
      from: visitorId,
      fromName: visitorName,
    });
  });

  socket.on('call-event', ({ event, callType }) => {
    if (!currentRoom || !visitorId) return;
    socket.to(currentRoom).emit('call-event', {
      event,
      callType,
      from: visitorId,
      fromName: visitorName,
    });

    if (event === 'start') {
      const id = uuidv4();
      const label = callType === 'video' ? '视频通话' : '语音通话';
      insertMessage({
        id,
        room_id: currentRoom,
        sender_id: visitorId,
        sender_name: visitorName,
        type: 'system',
        content: `${visitorName} 发起了${label}`,
        file_name: null,
        file_size: null,
        file_mime: null,
        file_path: null,
      });
      io.to(currentRoom).emit('message', messageToClient(getMessageById(id)));
    }
  });

  socket.on('disconnect', () => {
    if (currentRoom && visitorName) {
      socket.to(currentRoom).emit('peer-left', { senderId: visitorId, senderName: visitorName });
    }
  });
});

if (fs.existsSync(clientDist)) {
  app.use(express.static(clientDist));
  app.get('*', (req, res, next) => {
    if (req.path.startsWith('/api') || req.path.startsWith('/socket.io')) {
      return next();
    }
    res.sendFile(path.join(clientDist, 'index.html'));
  });
}

httpServer.listen(PORT, '0.0.0.0', () => {
  const lanIp = getLanIp();
  console.log(`ChatWithYou server http://localhost:${PORT}`);
  if (lanIp) {
    console.log(`手机/局域网访问: http://${lanIp}:${PORT}`);
  }
  if (!fs.existsSync(clientDist)) {
    console.log('提示: 手机访问请用 npm run start:lan（会构建前端并由 3010 统一提供）');
  }
});

httpServer.on('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    console.error(`\n端口 ${PORT} 已被占用。请先关闭旧的 dev 进程，或在项目根目录运行：npm run stop\n`);
    process.exit(1);
  }
  throw err;
});
