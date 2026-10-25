# 宿舍补给站 · 部署到 leylish.work/snack/

零食小站是一个**零依赖 Node 服务**（只用 Node 内置模块），和 Pinyin Paradise 完全独立：

| 项目 | 端口 | 路径 | PM2 进程名 |
| --- | --- | --- | --- |
| Pinyin Paradise | 3010 | `/` | `pinyin-paradise` |
| **宿舍补给站** | **3020** | **`/snack/`** | **`snack-shop`** |

顾客地址：`https://leylish.work/snack/`
商家后台：`https://leylish.work/snack/admin.html`（账号见 server.js）

代码已经放在 `sites/snack-shop/`，**不需要 npm install**。

---

## 一、本地提交（Windows）

```powershell
cd C:\Users\31540\Desktop\project\study\ChatWithYou
git status
git add sites/snack-shop deploy/snack-shop.ecosystem.js deploy/nginx-snack.conf deploy/SNACK-DEPLOY.md
git commit -m "add snack shop under /snack"
git push gitee main
```

> `sites/snack-shop/data/` 已被 `sites/snack-shop/.gitignore` 忽略，订单、收款码、邮箱授权码不会进仓库。

---

## 二、服务器拉代码

```bash
cd ~/ChatWithYou
git pull
ls sites/snack-shop
```

不需要 build，也不需要 `npm install`。

---

## 三、启动服务（PM2）

```bash
cd ~/ChatWithYou
pm2 start deploy/snack-shop.ecosystem.js
pm2 save
```

或者不用配置文件：

```bash
cd ~/ChatWithYou
PORT=3020 HOST=0.0.0.0 pm2 start sites/snack-shop/server.js --name snack-shop
pm2 save
```

检查：

```bash
pm2 status
pm2 logs snack-shop --lines 30
curl -s http://127.0.0.1:3020/api/ping
# {"ok":true,"name":"宿舍补给站"}
```

---

## 四、Nginx 反向代理

把 `deploy/nginx-snack.conf` 里的两个 location 段，复制到
`/etc/nginx/sites-available/leylish.work` 的 `server { ... }` 里，
**放在现有 `location / { ... }` 之前**：

```nginx
location = /snack { return 301 /snack/; }

location /snack/ {
    proxy_pass http://127.0.0.1:3020/;   # 末尾的 / 很重要
    proxy_http_version 1.1;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
    proxy_read_timeout 120s;
    client_max_body_size 20m;
}
```

然后：

```bash
sudo nginx -t
sudo systemctl reload nginx
```

访问：

- 顾客：`https://leylish.work/snack/`
- 后台：`https://leylish.work/snack/admin.html`

> HTTPS 证书沿用主站 leylish.work 的，不用再申请。
> `config.js` 会自动识别 `/snack/` 前缀，接口请求都变成 `/snack/api/...`，不需要改前端代码。

---

## 五、上线后第一件事

1. 打开 `https://leylish.work/snack/login.html`，用 `gyq / root` 登录
2. **马上改密码**：见下面「安全」一节
3. 「收款码」页上传微信收款码
4. 「邮件通知」里填 QQ 邮箱授权码，点「发送测试邮件」
5. 「商品」页改库存、传商品照片（照片和订单都存在服务器 `sites/snack-shop/data/`）

---

## 六、安全（重要）

现在账号是 `gyq / root`，放到公网上太弱。上线前改掉：

```bash
cd ~/ChatWithYou
nano sites/snack-shop/server.js
```

第 22 行左右：

```js
const LOGIN = { username: 'gyq', password: '换成你的强密码' };
```

保存后重启：

```bash
pm2 restart snack-shop --update-env
```

其他：

- 登录失败 8 次会锁 1 分钟（已内置）
- 商家接口全部要登录，顾客只能下单
- 邮箱授权码只存在服务器 `data/settings.json`，不会出现在网页里，也不会进 git

---

## 七、更新代码

```bash
cd ~/ChatWithYou
git pull
pm2 restart snack-shop     # 只有改了 server.js 才必须重启
```

改 HTML/CSS/JS 通常刷新页面就生效；`server.js`、`mailer.js` 改动需要 restart。

---

## 八、数据与备份

服务器上的数据都在：

```
sites/snack-shop/data/
├─ orders.json      订单（含顾客手机号）
├─ products.json    商品、价格、库存
├─ settings.json    收款码标记、邮箱授权码
├─ pay-qr.bin       收款码图片
└─ images/          商品照片
```

备份：

```bash
cd ~/ChatWithYou
tar czf ~/snack-backup-$(date +%F).tar.gz sites/snack-shop/data
```

不要把这些文件提交到 git，也不要发到群里。

---

## 九、常见问题

| 现象 | 处理 |
| --- | --- |
| 502 Bad Gateway | `pm2 status` 看 `snack-shop` 是否 online；`pm2 logs snack-shop` |
| 页面能开但商品不显示 | 打开开发者工具看 `/snack/api/shop` 是否 200；多半是 nginx `proxy_pass` 少了结尾的 `/` |
| 样式/JS 404 | 访问时少了结尾斜杠，确认 `location = /snack` 的 301 生效 |
| 图片上传失败 | nginx `client_max_body_size` 要 ≥ 20m；图片本身会自动压缩 |
| 邮件发不出 | 服务器要能访问外网 465；后台设置页会显示具体错误 |
| 端口 3020 被占 | `ss -lntp | grep 3020`，改 ecosystem 里的 PORT 和 nginx 的 proxy_pass |
| 改了密码登录不上 | 确认 PM2 重启了：`pm2 restart snack-shop --update-env` |

---

## 十、可选：独立子域名

不想用 `/snack/`，可以走 `snack.leylish.work`：

1. 阿里云 DNS 加 A 记录：`snack` → ECS 公网 IP
2. Nginx 用 `deploy/nginx-snack.conf` 里注释掉的 server 块（`proxy_pass http://127.0.0.1:3020;`，**不带**结尾斜杠）
3. `sudo certbot --nginx -d snack.leylish.work`
4. `config.js` 在根路径下会自动用空前缀，不需要改代码
