#!/usr/bin/env bash
# 宿舍补给站 · Linux 启动脚本（PM2 用不到它，手动跑时方便）
set -e
cd "$(dirname "$0")"
export PORT="${PORT:-3020}"
echo "宿舍补给站启动，端口 $PORT"
exec node server.js
