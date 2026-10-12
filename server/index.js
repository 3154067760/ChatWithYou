import express from 'express';
import { createServer } from 'http';
import path from 'path';
import os from 'os';
import { fileURLToPath } from 'url';

const PORT = process.env.PORT || 3010;
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

app.get('/api/health', (_req, res) => {
  res.json({ ok: true, app: 'pinyin-paradise' });
});

if (process.env.NODE_ENV !== 'development') {
  app.use(
    express.static(clientDist, {
      setHeaders(res, filePath) {
        if (filePath.endsWith('index.html')) {
          res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
        } else if (filePath.includes(`${path.sep}assets${path.sep}`)) {
          res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
        }
      },
    })
  );
  app.get('*', (_req, res) => {
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    res.sendFile(path.join(clientDist, 'index.html'));
  });
}

const httpServer = createServer(app);

httpServer.listen(PORT, '0.0.0.0', () => {
  const lanIp = getLanIp();
  console.log(`Pinyin Paradise http://localhost:${PORT}`);
  if (lanIp) {
    console.log(`手机/局域网访问: http://${lanIp}:${PORT}`);
  }
});

httpServer.on('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    console.error(`\n端口 ${PORT} 已被占用。请在项目根目录运行：npm run stop\n`);
  } else {
    console.error(err);
  }
  process.exit(1);
});
