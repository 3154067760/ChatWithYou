# leylish.work 部署指南

将 ChatWithYou 绑定到域名 **leylish.work**，并启用 **HTTPS**（语音/视频必需）。

---

## 一、域名侧（阿里云控制台）

### 1. 完成实名认证

域名控制台 → `leylish.work` → **实名认证** → 状态变为「已实名」。

### 2. 添加 DNS 解析

域名 → **解析设置** → **添加记录**：

| 主机记录 | 类型 | 记录值 |
|----------|------|--------|
| `@` | A | **你的 ECS 公网 IP** |
| `www` | A | **同上** |

等待 5～30 分钟，本机验证：

```bash
nslookup leylish.work
```

返回 IP 与 ECS 公网 IP 一致即可。

---

## 二、ECS 安全组

入方向放行：

| 端口 | 协议 | 说明 |
|------|------|------|
| 22 | TCP | SSH |
| 80 | TCP | HTTP（申请证书用） |
| 443 | TCP | HTTPS |

---

## 三、服务器一键部署（Ubuntu 22/24）

SSH 登录 ECS 后执行：

```bash
# 1. 克隆项目（或 git pull 更新）
sudo apt update
sudo apt install -y git curl

cd /opt
sudo git clone https://github.com/3154067760/ChatWithYou.git
cd ChatWithYou

# 2. 运行部署脚本（把邮箱改成你的）
sudo DOMAIN=leylish.work EMAIL=你的邮箱@example.com bash deploy/setup-ubuntu.sh
```

脚本会自动：

- 安装 Node.js 20、Nginx、Certbot、PM2  
- `npm install` + 构建前端  
- PM2 启动后端（端口 3001）  
- 配置 Nginx 反向代理  
- 申请 Let's Encrypt 免费 HTTPS 证书  

### 3. 访问

```
https://leylish.work
https://www.leylish.work
```

---

## 四、手动部署（可选）

若不用脚本，按顺序执行：

```bash
cd /opt/ChatWithYou
npm run install:all
npm run build
cd server && pm2 start index.js --name chatwithyou && pm2 save
```

Nginx 配置见 `deploy/nginx-leylish.work.conf`，证书：

```bash
sudo certbot --nginx -d leylish.work -d www.leylish.work
```

---

## 五、更新代码

```bash
cd /opt/ChatWithYou
git pull
npm run install:all
npm run build
pm2 restart chatwithyou
```

---

## 六、常见问题

| 问题 | 处理 |
|------|------|
| 域名打不开 | 检查实名、DNS、安全组 80/443 |
| 证书申请失败 | 确认 DNS 已生效，`nslookup leylish.work` 正确 |
| 能开网页但无语音视频 | 必须用 `https://`，不能用 `http://` |
| WebRTC 连不通 | 部署 coturn（见下方） |

### WebRTC 穿透（可选）

若两人无法建立音视频，在 ECS 安装 coturn：

```bash
sudo apt install -y coturn
# 编辑 /etc/turnserver.conf，设置 external-ip=你的公网IP
sudo systemctl enable coturn && sudo systemctl start coturn
```

安全组额外放行：**3478** TCP/UDP，**49152-65535** UDP。

---

## 七、目录与数据

| 路径 | 说明 |
|------|------|
| `/opt/ChatWithYou` | 项目代码 |
| `/opt/ChatWithYou/server/data/` | 聊天记录 |
| `/opt/ChatWithYou/server/uploads/` | 上传文件 |

建议定期备份 `server/data` 和 `server/uploads`。
