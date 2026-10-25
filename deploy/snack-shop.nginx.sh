#!/usr/bin/env bash
# 在 leylish.work 的 Nginx 配置里挂上 /snack/ → 127.0.0.1:3020
# 幂等：重复执行不会重复插入
set -e

SNIP=/etc/nginx/snippets/snack-shop.conf
SITE=/etc/nginx/sites-available/leylish.work

sudo mkdir -p /etc/nginx/snippets
sudo tee "$SNIP" >/dev/null <<'EOF'
# 宿舍补给站 —— 由 deploy/snack-shop.nginx.sh 生成
location = /snack {
    return 301 /snack/;
}

location /snack/ {
    # 末尾的 / 会去掉 /snack 前缀
    proxy_pass http://127.0.0.1:3020/;
    proxy_http_version 1.1;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
    proxy_read_timeout 120s;
    client_max_body_size 20m;
}
EOF

sudo python3 - "$SITE" <<'PY'
import sys
path = sys.argv[1]
src = open(path, encoding='utf-8').read()
if 'snack-shop.conf' in src:
    print('include 已存在，跳过')
    raise SystemExit(0)
marker = '    location / {'
if marker not in src:
    raise SystemExit('找不到 location / 标记，请手动编辑 ' + path)
src = src.replace(marker, '    include /etc/nginx/snippets/snack-shop.conf;\n\n' + marker, 1)
open(path, 'w', encoding='utf-8').write(src)
print('已插入 include')
PY

sudo nginx -t
sudo systemctl reload nginx
echo "Nginx 已重载：https://leylish.work/snack/"
