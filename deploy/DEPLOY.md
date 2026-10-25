# leylish.work 部署指南

将 **Pinyin Paradise（拼音小乐园）** 绑定到域名 **leylish.work**（Node 3010 提供静态前端）。

---

## 一、域名侧（阿里云控制台）

### 1. 完成实名认证

域名控制台 → `leylish.work` → **实名认证** → 状态变为「已实名」。

### 2. 添加 DNS 解析

| 主机记录 | 类型 | 记录值 |
|----------|------|--------|
| `@` | A | **ECS 公网 IP** |
| `www` | A | **同上** |

验证：`nslookup leylish.work` 与 ECS IP 一致。

---

## 二、ECS 安全组

入方向放行：**22**、**80**、**443**（TCP）。

---

## 三、一键部署（Ubuntu）

```bash
cd ~
git clone https://gitee.com/qq3154067760qq_com/ChatWithYou.git
cd ChatWithYou

sudo DOMAIN=leylish.work EMAIL=你的邮箱@example.com bash deploy/setup-ubuntu.sh
```

> 项目路径：`/home/admin/ChatWithYou`。服务端口 **3010**（与 File Bridge 3001 分开）。

访问：https://leylish.work

---

## 四、更新代码（重要）

每次改前端后必须在服务器 **重新 build**，否则仍会看到旧页面（例如已删除的 Pinyin Crush）：

```bash
cd ~/ChatWithYou
git pull
npm run install:all
npm run build
pm2 restart pinyin-paradise
# 若进程名仍是旧的 chatwithyou：
# pm2 delete chatwithyou 2>/dev/null; cd server && PORT=3010 pm2 start index.js --name pinyin-paradise && pm2 save
```

浏览器：**Ctrl+Shift+R** 强刷，或清除站点缓存。

本地未推送的代码 `git pull` 拉不到——需先在开发机 `git push gitee main`（或先提交再推）。

---

## 五、手动部署

```bash
cd ~/ChatWithYou
npm run install:all
npm run build
cd server && PORT=3010 pm2 start index.js --name pinyin-paradise
pm2 save
```

Nginx 配置：`deploy/nginx-leylish.work.conf`  
HTTPS：`sudo certbot --nginx -d leylish.work -d www.leylish.work`

---

## 六、常见问题

| 问题 | 处理 |
|------|------|
| 仍显示旧小游戏（Crush / Pairs 等） | 服务器是否 `npm run build`；是否强刷；`curl -s http://127.0.0.1:3010/api/health` 应为 `pinyin-paradise` |
| 域名打不开 | 实名、DNS、安全组 80/443 |
| 502 | `pm2 logs pinyin-paradise`；确认 `PORT=3010` |
| npm EACCES | `sudo chown -R admin:admin ~/ChatWithYou` 后重装依赖并 build |
| 无发音 | 运行 `npm run generate:audio` 生成 MP3；游戏中点 **Test sound** 解锁浏览器音频 |

---

## 七、目录

| 路径 | 说明 |
|------|------|
| `~/ChatWithYou` | 项目代码 |
| `client/public/audio` | 拼音与故事 MP3（可生成） |
| `client/dist` | 构建产物（`.gitignore`，部署时在服务器生成） |

---

## 八、零食小站（sites/snack-shop）

独立进程，端口 **3020**，挂在 `https://leylish.work/snack/`，和拼音小乐园互不影响。

完整步骤见 `deploy/SNACK-DEPLOY.md`，最少三步：

```bash
cd ~/ChatWithYou && git pull
pm2 start deploy/snack-shop.ecosystem.js && pm2 save
# 把 deploy/nginx-snack.conf 的 location 加到 nginx 配置，sudo nginx -t && sudo systemctl reload nginx
```

顾客：`https://leylish.work/snack/`
商家：`https://leylish.work/snack/admin.html`（账号 gyq / root，上线前务必改密码）
