// 宿舍补给站 —— PM2 配置
// 用法（在 ~/ChatWithYou 下）：
//   pm2 start deploy/snack-shop.ecosystem.js
//   pm2 save
const path = require('path');

module.exports = {
  apps: [
    {
      name: 'snack-shop',
      script: 'sites/snack-shop/server.js',
      cwd: path.join(__dirname, '..'),
      env: {
        PORT: '3020',
        HOST: '0.0.0.0',
        NODE_ENV: 'production',
      },
      max_memory_restart: '200M',
      time: true,
    },
  ],
};
