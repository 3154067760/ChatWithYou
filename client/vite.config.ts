import os from 'os';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

function getLanIp() {
  for (const iface of Object.values(os.networkInterfaces())) {
    for (const cfg of iface ?? []) {
      if (cfg.family === 'IPv4' && !cfg.internal && !cfg.address.startsWith('127.')) {
        if (cfg.address.startsWith('192.168.') || cfg.address.startsWith('10.')) {
          return cfg.address;
        }
      }
    }
  }
  return undefined;
}

const lanIp = getLanIp();

export default defineConfig({
  plugins: [react()],
  server: {
    host: '0.0.0.0',
    port: 5173,
    strictPort: true,
    hmr: false,
    proxy: {
      '/api': 'http://127.0.0.1:3001',
      '/socket.io': {
        target: 'http://127.0.0.1:3001',
        ws: true,
      },
    },
  },
});
