# 部署说明 (CustomerServiceTool)

## 你需要准备的内容

### 1. 服务器

- **一台可 SSH 的 Linux 服务器**（如 AWS EC2、阿里云 ECS、腾讯云等）
- 若用 EC2：需要 **公网 IP**、**SSH 密钥**（你已有 `warren.pem`）
- 建议：至少 1 核 1G，开放端口 **80**（HTTP）、**443**（HTTPS）、**8787**（若直接暴露应用端口）

### 2. MySQL 数据库

任选其一：

- 在**同一台服务器**上安装 MySQL，或  
- 使用**云数据库**（如 AWS RDS、阿里云 RDS），并拿到连接信息  

需要准备：

| 变量名 | 说明 | 示例 |
|--------|------|------|
| `DB_HOST` | 数据库主机 | `127.0.0.1` 或 RDS 地址 |
| `DB_PORT` | 端口 | `3306` |
| `DB_USER` | 用户名 | `vip_user` |
| `DB_PASSWORD` | 密码 | 自设 |
| `DB_NAME` | 库名 | `vipservicetool` |

首次运行时代码会自动建表、插入默认管理员（密码默认 `admin123`，上线后请修改）。

### 3. 飞书应用配置

在 [飞书开放平台](https://open.feishu.cn/) 创建应用并拿到：

| 变量名 | 说明 |
|--------|------|
| `FEISHU_APP_ID` | 应用 App ID |
| `FEISHU_APP_SECRET` | 应用 App Secret |
| `FEISHU_CHAT_ID` | 接收工单的群聊 Chat ID |

可选（用于 @ 指定人、通知等）：

| 变量名 | 说明 |
|--------|------|
| `FEISHU_AT_USER_ID` | 被 @ 的用户 ID |
| `FEISHU_AT_USER_NAME` | 被 @ 的显示名（如 "汪南 Warren"） |
| `FEISHU_AT_USER_ID_TYPE` | `user_id` / `open_id` / `union_id` |
| `FEISHU_FORCE_AT_DEFAULT` | 是否始终 @ 默认用户，`true`/`false` |
| `FEISHU_REPORTER_USER_ID_MAP` | JSON：反馈人(小写) -> 飞书 user_id，用于回复工单后私聊对应用户。默认：ethan/alain/alian/bryan/jethro/warren 已映射 |
| `FEISHU_REPORTER_OPEN_ID_MAP` | JSON：反馈人(小写) -> 飞书 open_id；若配置则优先用 open_id 发私信（可避免 contact 权限） |

**飞书事件订阅（必须配置，否则回复工单后无法触发「私聊对应用户」）：**

1. **请求地址**：填 **`https://amwarren.com/api/feishu/event`**（必须 HTTPS）。  
   [飞书开放平台](https://open.feishu.cn/) → 你的应用 → **事件订阅** → 请求地址 → 保存（会发 url_verification，服务端已支持）。

2. **订阅事件**：在「事件订阅」里点击 **「添加事件」**，勾选 **「接收消息」**（`im.message.receive_v1`），保存并**发布版本**。  
   这样用户在群内回复工单时，飞书才会把消息事件推到你的服务器，服务端才能识别「被 @ 的人回复了」并给反馈人发私信。

3. **权限**：应用需具备「获取与发送单聊、群组消息」等权限；机器人要加入接收工单的群聊。

### 4. 环境变量汇总

部署时在服务器上配置一份环境变量（见下方「部署步骤」），至少需要：

```bash
# 数据库（必填）
DB_HOST=127.0.0.1
DB_PORT=3306
DB_USER=vip_user
DB_PASSWORD=你的数据库密码
DB_NAME=vipservicetool

# 飞书（必填）
FEISHU_APP_ID=你的AppID
FEISHU_APP_SECRET=你的AppSecret
FEISHU_CHAT_ID=群聊ChatID

# 可选
PORT=8787
FEISHU_AT_USER_ID=7511938969643319297
FEISHU_AT_USER_NAME=汪南 Warren
```

---

## 部署步骤（以 Ubuntu 为例）

### 1. 登录服务器

```bash
chmod 600 warren.pem
ssh -i warren.pem ubuntu@你的服务器公网IP
```

### 2. 安装 Node.js 与 MySQL（若数据库在本机）

```bash
# Node 20
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs

# MySQL（仅当数据库放在本机时）
sudo apt-get update
sudo apt-get install -y mysql-server
sudo mysql_secure_installation
```

创建数据库和用户（本机 MySQL 时）：

```bash
sudo mysql -e "
  CREATE DATABASE IF NOT EXISTS vipservicetool;
  CREATE USER IF NOT EXISTS 'vip_user'@'localhost' IDENTIFIED BY '你的DB密码';
  GRANT ALL ON vipservicetool.* TO 'vip_user'@'localhost';
  FLUSH PRIVILEGES;
"
```

### 3. 上传代码并安装依赖

在**你本机**项目目录执行：

```bash
rsync -avz --exclude node_modules --exclude .git -e "ssh -i warren.pem" \
  . ubuntu@你的服务器IP:~/CustomerServiceTool/
```

登录服务器后：

```bash
cd ~/CustomerServiceTool
npm install --production
```

### 4. 配置环境变量

```bash
nano ~/CustomerServiceTool/.env
```

写入上面「环境变量汇总」中的变量（按你的实际值改），保存。

### 5. 用 PM2 跑服务并开机自启

```bash
sudo npm install -g pm2
cd ~/CustomerServiceTool
pm2 start server.js --name customer-service-tool
pm2 save
pm2 startup   # 按提示执行它输出的命令
```

### 6. 用 Nginx 做反向代理（可选，推荐）

安装 Nginx：

```bash
sudo apt-get install -y nginx
```

新建站点配置（替换 `你的域名` 或直接用 IP）：

```bash
sudo nano /etc/nginx/sites-available/customer-service-tool
```

内容示例：

```nginx
server {
    listen 80;
    server_name 你的域名或IP;
    location / {
        proxy_pass http://127.0.0.1:8787;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

启用并重载：

```bash
sudo ln -s /etc/nginx/sites-available/customer-service-tool /etc/nginx/sites-enabled/
sudo nginx -t && sudo systemctl reload nginx
```

### 7. 飞书事件回调 URL

若使用飞书「事件订阅」：

- 事件请求 URL 填：`https://你的域名/api/feishu/event`
- 确保该域名可从外网访问且 Nginx 已把 `/api/feishu/event` 代理到本机 8787。

---

## 部署前检查清单

- [ ] 服务器可 SSH（且有 `warren.pem` 或对应密钥）
- [ ] MySQL 已安装或已有 RDS，并创建好 `DB_NAME`、`DB_USER`、`DB_PASSWORD`
- [ ] 飞书应用已创建，并拿到 `FEISHU_APP_ID`、`FEISHU_APP_SECRET`、`FEISHU_CHAT_ID`
- [ ] 本机已配置好 `.env` 或准备在服务器上创建 `~/CustomerServiceTool/.env`
- [ ] 安全组/防火墙已放行 80、443（若用 Nginx）或 8787（若直连应用）

---

## 你需要「提供」给我的信息（若由我帮你写部署脚本）

若你希望我根据你的环境写出具体命令或脚本，请提供（可脱敏）：

1. **服务器**：系统（如 Ubuntu 22.04）、是否有 root/sudo、是否已装 Node/MySQL。
2. **数据库**：是否用本机 MySQL 还是云 RDS；若 RDS，提供 `DB_HOST`（可打码部分）。
3. **飞书**：是否已在开放平台创建应用并拿到 App ID / App Secret / 群聊 Chat ID（可只说明「已准备好」）。
4. **访问方式**：用 IP 访问还是已有域名；若用域名，是否已解析到该服务器。

提供以上信息后，我可以为你写一份「一键部署脚本」或逐条命令。
