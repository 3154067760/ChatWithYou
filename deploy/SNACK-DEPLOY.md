# 宿舍补给站 · 部署到 leylish.work/snack/

**已上线**：<https://leylish.work/snack/>
后台：<https://leylish.work/snack/admin.html>（账号 `gyq`，密码见 `server.js`）

| 项目 | 端口 | 路径 | PM2 进程名 |
| --- | --- | --- | --- |
| Pinyin Paradise | 3010 | `/` | `pinyin-paradise` |
| **宿舍补给站** | **3020** | **`/snack/`** | **`snack-shop`** |

零食小站是**零依赖 Node 服务**（只用内置模块），和拼音小乐园完全独立，不需要 `npm install`。

---

## 一、本地提交（Windows）

```powershell
cd C:\Users\31540\Desktop\project\study\ChatWithYou
git add sites/snack-shop deploy/SNACK-DEPLOY.md deploy/nginx-snack.conf deploy/snack-shop.nginx.sh deploy/DEPLOY.md
git commit -m "update snack shop deploy docs"
git push origin main
```

> `sites/snack-shop/data/` 已被 `sites/snack-shop/.gitignore` 忽略：
> 订单、商品、收款码、邮箱授权码都不会进仓库。

---

## 二、服务器拉代码

```bash
cd ~/ChatWithYou
git pull
ls sites/snack-shop
```

不需要 build，也不需要 `npm install`。

---

## 三、启动 / 重启服务（PM2）

```bash
cd ~/ChatWithYou
export PORT=3020 HOST=127.0.0.1
pm2 start sites/snack-shop/server.js --name snack-shop --update-env
pm2 save
```

> 不要用 `deploy/snack-shop.ecosystem.js` 那种写法：PM2 7 会把它当成普通脚本执行，
> 进程名叫 `snack-shop.ecosystem` 且不会监听端口。上面这条最稳。

检查：

```bash
pm2 status | grep snack
curl -s http://127.0.0.1:3020/api/ping
# {"ok":true,"name":"宿舍补给站"}
```

重启（改过 `server.js` / `mailer.js` 后）：

```bash
pm2 restart snack-shop --update-env
```

---

## 四、Nginx 反向代理

一条脚本搞定（写入 snippet、插入 include、检查并 reload）：

```bash
cd ~/ChatWithYou
bash deploy/snack-shop.nginx.sh
```

它做的事：

1. 写 `/etc/nginx/snippets/snack-shop.conf`
2. 在 `/etc/nginx/sites-available/leylish.work` 的 `server {}` 里、
   `location / { ... }` 之前插入 `include /etc/nginx/snippets/snack-shop.conf;`
3. `nginx -t` + `systemctl reload nginx`

手工方式（或站点配置不叫 leylish.work 时）：把 `deploy/nginx-snack.conf` 的两个 location
复制到站点配置里，放在 `location /` 之前，然后：

```bash
sudo nginx -t && sudo systemctl reload nginx
```

关键点：`proxy_pass http://127.0.0.1:3020/;` **结尾必须有 `/`**，它会把 `/snack/` 前缀去掉。

访问：

- 顾客：<https://leylish.work/snack/>
- 后台：<https://leylish.work/snack/admin.html>

> HTTPS 沿用主站证书，不用再申请。
> `config.js` 会自动识别 `/snack/` 前缀，接口请求都变成 `/snack/api/...`，前端代码不用改。

---

## 五、上线后的配置（都已在服务器完成）

1. 登录后台
2. 「收款码」上传微信收款码
3. 「邮件通知」填 QQ 邮箱授权码 → 保存 → 发送测试邮件
4. 「商品」改库存、传商品照片

数据都在服务器 `sites/snack-shop/data/`。

---

## 六、安全（重要）

公网上 `gyq / root` 太弱，建议改掉：

```bash
cd ~/ChatWithYou
nano sites/snack-shop/server.js     # 第 22 行左右
# const LOGIN = { username: 'gyq', password: '你的强密码' };
pm2 restart snack-shop --update-env
```

已内置：

- 登录失败 8 次锁 1 分钟
- 商家接口全部要登录，顾客只能下单
- 邮箱授权码只存在服务器 `data/settings.json`，网页上不回显

---

## 七、更新代码

```bash
cd ~/ChatWithYou
git pull
pm2 restart snack-shop     # 只有改了 server.js / mailer.js 才必须重启
```

改 HTML/CSS/JS 一般刷新页面就生效。

---

## 八、数据与备份

```
sites/snack-shop/data/
├─ orders.json      订单（含顾客手机号）
├─ products.json    商品、价格、库存
├─ settings.json    收款码标记、邮箱授权码
├─ pay-qr.bin       收款码图片
└─ images/          商品照片
```

```bash
cd ~/ChatWithYou
tar czf ~/snack-backup-$(date +%F).tar.gz sites/snack-shop/data
```

---

## 九、常见问题

| 现象 | 处理 |
| --- | --- |
| 502 | `pm2 status` 看 `snack-shop` 是否 online；`pm2 logs snack-shop` |
| 页面能开但不显示商品 | 开发者工具看 `/snack/api/shop` 是否 200；多半是 `proxy_pass` 少了结尾 `/` |
| 样式/JS 404 | 访问时少了结尾斜杠，确认 `/snack` 的 301 生效 |
| 图片上传失败 | nginx `client_max_body_size` ≥ 20m（脚本已带） |
| 邮件发不出 | 服务器要能访问外网 465；后台设置页会显示具体错误 |
| 端口冲突 | `ss -lntp \| grep 3020`，改 PM2 的 PORT 和 nginx 的 proxy_pass |

---

## 十、可选：独立子域名

1. 阿里云 DNS 加 A 记录：`snack` → ECS 公网 IP
2. Nginx 用 `deploy/nginx-snack.conf` 里注释掉的 server 块（`proxy_pass http://127.0.0.1:3020;`，**不带**结尾斜杠）
3. `sudo certbot --nginx -d snack.leylish.work`
4. 根路径部署时 `config.js` 自动用空前缀，代码不用改
