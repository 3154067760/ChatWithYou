# ChatWithYou

1v1 网页聊天：文字、语音、视频、图片/文件上传、导出全部聊天记录。无需注册登录。

## 手机 / 局域网访问

`localhost` 能开、手机 IP 不行，**99% 是 Windows 防火墙拦了局域网入站**。

### 第一步：放行防火墙（只需一次）

**右键「以管理员身份运行」：**

```
scripts\以管理员放行防火墙.bat
```

或在**管理员 PowerShell** 里：

```powershell
cd C:\Users\31540\Desktop\project\study\ChatWithYou
npm run firewall
```

### 第二步：用手机模式启动（推荐）

```powershell
npm run start:lan
```

终端会显示：

```
手机/局域网访问: http://192.168.2.17:3001
```

**手机浏览器打开：`http://192.168.2.17:3001`**（注意是 **3001**，不是 5173）

| 场景 | 命令 | 电脑地址 | 手机地址 |
|------|------|----------|----------|
| 开发调试 | `npm run dev` | http://localhost:5173 | http://192.168.2.17:5173（需防火墙） |
| 手机联调 | `npm run start:lan` | http://localhost:3001 | **http://192.168.2.17:3001** |

> `5173` 是 Vite 开发服务器；`start:lan` 把网页和后端都放在 **3001**，手机更稳定。

## 本地测试

### 1. 安装依赖

```bash
cd ChatWithYou
npm install
npm run install:all
```

### 2. 启动

```bash
npm run dev
```

`npm run dev` 会先自动释放 3001/5173/5174 端口，避免「端口被占用」报错。

若仍有问题，手动执行：

```bash
npm run stop
npm run dev
```

**注意：同一时间只运行一份 `npm run dev`。** 不要重复开多个终端启动；停止时在终端按 **Ctrl+C**。

也可分两个终端启动：

**终端 A — 后端（端口 3001）**

```bash
cd server
npm run dev
```

**终端 B — 前端（端口 5173）**

```bash
cd client
npm run dev
```

或根目录一条命令：

```bash
npm run dev
```

### 3. 使用方式

1. 浏览器打开 http://localhost:5173  
2. 填写昵称 → **创建房间** 或输入房间号加入  
3. 复制邀请链接，用**另一个浏览器窗口/无痕窗口**打开（模拟对方）  
4. 可发文字、📎 上传图片/文件、语音/视频通话、导出 TXT/JSON  

> 音视频在 `localhost` 下可直接使用摄像头/麦克风。

## 数据与文件存储

| 路径 | 说明 |
|------|------|
| `server/data/chat.db` | SQLite 聊天记录 |
| `server/uploads/{roomId}/` | 该房间上传的图片/文件 |

## 部署到阿里云（leylish.work）

完整步骤见 **[deploy/DEPLOY.md](deploy/DEPLOY.md)**。

### 快速流程

1. **域名实名** + DNS 添加 A 记录 `@` 和 `www` → ECS 公网 IP  
2. **安全组** 放行 80、443  
3. SSH 登录 ECS，执行：

```bash
cd /opt
git clone https://github.com/3154067760/ChatWithYou.git
cd ChatWithYou
sudo DOMAIN=leylish.work EMAIL=你的邮箱 bash deploy/setup-ubuntu.sh
```

4. 访问 **https://leylish.work**

> 语音/视频需要 HTTPS；证书由 Let's Encrypt 免费提供，自动续期。

## API 摘要

- `POST /api/rooms` — 创建房间  
- `GET /api/rooms/:id/messages` — 历史消息  
- `POST /api/upload` — 上传文件（form: file, roomId, senderId, senderName）  
- `GET /api/files/:messageId` — 下载/预览文件  
- `GET /api/rooms/:id/export?format=json|txt` — 导出全部历史  
