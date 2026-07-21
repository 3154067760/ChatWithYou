#!/bin/bash
# ChatWithYou 一键部署（Ubuntu）
# 用法: sudo DOMAIN=leylish.work EMAIL=you@mail.com bash deploy/setup-ubuntu.sh

set -e

DOMAIN="${DOMAIN:-leylish.work}"
EMAIL="${EMAIL:-}"
APP_DIR="$(cd "$(dirname "$0")/.." && pwd)"

echo "==> 部署 ChatWithYou 到 https://${DOMAIN}"
echo "==> 项目目录: ${APP_DIR}"

if [ "$(id -u)" -ne 0 ]; then
  echo "请使用 sudo 运行此脚本"
  exit 1
fi

if [ -z "$EMAIL" ]; then
  echo "请设置邮箱: sudo DOMAIN=${DOMAIN} EMAIL=你的邮箱 bash deploy/setup-ubuntu.sh"
  exit 1
fi

echo "==> 安装依赖..."
apt-get update -qq
apt-get install -y curl git nginx certbot python3-certbot-nginx

if ! command -v node >/dev/null 2>&1 || [ "$(node -v | cut -d. -f1 | tr -d v)" -lt 22 ] 2>/dev/null; then
  curl -fsSL https://deb.nodesource.com/setup_22.x | bash -
  apt-get install -y nodejs
fi

node -e "require('node:sqlite')" 2>/dev/null || {
  echo "错误: 需要 Node.js >= 22.5（内置 node:sqlite）"
  node -v
  exit 1
}

if ! command -v pm2 >/dev/null 2>&1; then
  npm install -g pm2
fi

DEPLOY_USER="${SUDO_USER:-root}"
DEPLOY_HOME="$(getent passwd "$DEPLOY_USER" | cut -d: -f6)"

echo "==> 安装项目依赖并构建（用户: ${DEPLOY_USER}）..."
chown -R "${DEPLOY_USER}:${DEPLOY_USER}" "$APP_DIR"
sudo -u "$DEPLOY_USER" bash -c "cd '$APP_DIR' && npm run install:all && npm run build"

echo "==> 启动 PM2..."
sudo -u "$DEPLOY_USER" bash -c "cd '$APP_DIR/server' && pm2 delete chatwithyou 2>/dev/null || true; PORT=3010 pm2 start index.js --name chatwithyou"
sudo -u "$DEPLOY_USER" pm2 save
sudo -u "$DEPLOY_USER" pm2 startup systemd -u "$DEPLOY_USER" --hp "$DEPLOY_HOME" 2>/dev/null || true

echo "==> 配置 Nginx..."
sed "s/leylish.work/${DOMAIN}/g" "$APP_DIR/deploy/nginx-leylish.work.conf" \
  > "/etc/nginx/sites-available/${DOMAIN}"
ln -sf "/etc/nginx/sites-available/${DOMAIN}" "/etc/nginx/sites-enabled/${DOMAIN}"
rm -f /etc/nginx/sites-enabled/default
nginx -t
systemctl reload nginx

echo "==> 申请 HTTPS 证书..."
certbot --nginx -d "$DOMAIN" -d "www.${DOMAIN}" \
  --non-interactive --agree-tos -m "$EMAIL" --redirect

echo ""
echo "============================================"
echo "  部署完成！"
echo "  访问: https://${DOMAIN}"
echo "  管理: pm2 status / pm2 logs chatwithyou"
echo "============================================"
