import express from "express";
import cors from "cors";
import mysql from "mysql2/promise";
import bcrypt from "bcryptjs";
import crypto from "crypto";

const app = express();
app.use(cors());
app.use(express.json());

const FEISHU_APP_ID = process.env.FEISHU_APP_ID;
const FEISHU_APP_SECRET = process.env.FEISHU_APP_SECRET;
const FEISHU_CHAT_ID = process.env.FEISHU_CHAT_ID;
const FEISHU_AT_USER_ID = process.env.FEISHU_AT_USER_ID || "7511938969643319297";
const FEISHU_AT_USER_ID_TYPE = (process.env.FEISHU_AT_USER_ID_TYPE || "user_id").toLowerCase();
const FEISHU_AT_USER_NAME = process.env.FEISHU_AT_USER_NAME;
const DEBUG_RPC_BASE = "https://rpc-debug.particle.network/evm-chain/public";
const FEISHU_FORCE_AT_DEFAULT = process.env.FEISHU_FORCE_AT_DEFAULT !== "false";
const ISSUE_TYPE_AT_MAP = {
  frontend: "6711497216441188612",
  backend: "6709707367363117315",
};
const REPORTER_USER_ID_MAP = (() => {
  try {
    if (process.env.FEISHU_REPORTER_USER_ID_MAP) {
      return JSON.parse(process.env.FEISHU_REPORTER_USER_ID_MAP);
    }
  } catch (error) {
    console.warn("Invalid FEISHU_REPORTER_USER_ID_MAP JSON");
  }
  return {
    ethan: "7516762733551861788",
    alian: "7550950007357505537",
    bryan: "7550950262271082499",
    jethro: "7523147092764786707",
    warren: "7511938969643319297",
  };
})();
const messageReporterMap = new Map();
const sessionTokens = new Map();
let dbPool = null;

const initDb = async () => {
  if (dbPool) return dbPool;
  const {
    DB_HOST = "127.0.0.1",
    DB_PORT = "3306",
    DB_USER = "vip_user",
    DB_PASSWORD = "vip_pass",
    DB_NAME = "vipservicetool",
  } = process.env;

  dbPool = await mysql.createPool({
    host: DB_HOST,
    port: Number(DB_PORT),
    user: DB_USER,
    password: DB_PASSWORD,
    database: DB_NAME,
    connectionLimit: 5,
  });

  await dbPool.query(`
    CREATE TABLE IF NOT EXISTS admins (
      id INT AUTO_INCREMENT PRIMARY KEY,
      username VARCHAR(64) UNIQUE NOT NULL,
      password_hash VARCHAR(255) NOT NULL,
      avatar_url VARCHAR(255),
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    )
  `);

  await dbPool.query(`
    CREATE TABLE IF NOT EXISTS tickets (
      id BIGINT AUTO_INCREMENT PRIMARY KEY,
      user_name VARCHAR(120),
      reporter VARCHAR(120),
      evm_address VARCHAR(120),
      tx_link TEXT,
      issue TEXT,
      error_info TEXT,
      tx_hash VARCHAR(120),
      chain_id VARCHAR(50),
      issue_type VARCHAR(50),
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);

  const [rows] = await dbPool.query("SELECT COUNT(*) as count FROM admins");
  if (rows?.[0]?.count === 0) {
    const defaultHash = await bcrypt.hash("admin123", 10);
    await dbPool.query(
      "INSERT INTO admins (username, password_hash, avatar_url) VALUES (?, ?, ?)",
      ["warren", defaultHash, "Admin/Warren.jpg"]
    );
  }

  return dbPool;
};

const fetchDebugError = async (txHash, chainId) => {
  try {
    const chain = chainId || 8453;
    const resp = await fetch(`${DEBUG_RPC_BASE}?chainId=${chain}` , {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        jsonrpc: "2.0",
        method: "debug_traceTransaction",
        params: [txHash, { tracer: "callTracer" }],
        id: 1,
      }),
    });
    const data = await resp.json();
    if (data?.error?.message) return data.error.message;
    if (typeof data?.result?.error === "string") return data.result.error;
    const text = JSON.stringify(data);
    if (text.includes("execution reverted")) return "execution reverted";
  } catch (error) {
    console.warn("debug_traceTransaction failed", error);
  }
  return null;
};

const getTenantToken = async () => {
  const tokenResp = await fetch("https://open.feishu.cn/open-apis/auth/v3/tenant_access_token/internal/", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      app_id: FEISHU_APP_ID,
      app_secret: FEISHU_APP_SECRET,
    }),
  });
  const tokenData = await tokenResp.json();
  if (tokenData.code !== 0) {
    throw new Error(`Failed to get token: ${JSON.stringify(tokenData)}`);
  }
  return tokenData.tenant_access_token;
};

const sendFeishuText = async ({ token, receiveIdType, receiveId, text }) => {
  const msgResp = await fetch(
    `https://open.feishu.cn/open-apis/im/v1/messages?receive_id_type=${receiveIdType}`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        receive_id: receiveId,
        msg_type: "text",
        content: JSON.stringify({ text }),
      }),
    }
  );
  const msgData = await msgResp.json();
  if (msgData.code !== 0) {
    throw new Error(`Failed to send message: ${JSON.stringify(msgData)}`);
  }
  return msgData;
};

const normalizeReporterKey = (reporter) =>
  String(reporter || "")
    .trim()
    .toLowerCase();

const getAtUserId = (issueType) => {
  if (FEISHU_FORCE_AT_DEFAULT) return FEISHU_AT_USER_ID;
  const key = String(issueType || "").toLowerCase();
  return ISSUE_TYPE_AT_MAP[key] || FEISHU_AT_USER_ID;
};

const getSenderUserId = (sender) =>
  sender?.sender_id?.user_id || sender?.sender_id?.open_id || sender?.sender_id?.union_id || "";

if (!FEISHU_APP_ID || !FEISHU_APP_SECRET || !FEISHU_CHAT_ID) {
  console.warn("Missing FEISHU_APP_ID / FEISHU_APP_SECRET / FEISHU_CHAT_ID env vars.");
}

app.post("/api/feishu", async (req, res) => {
  try {
    const { userName, reporter, evmAddress, txLink, issue, txHash, chainId, issueType } = req.body || {};
    if (!userName || !reporter || !issue) {
      return res.status(400).json({ message: "userName, reporter and issue are required" });
    }

    if (!FEISHU_APP_ID || !FEISHU_APP_SECRET || !FEISHU_CHAT_ID) {
      return res.status(500).json({ message: "Feishu env vars not configured" });
    }

    const token = await getTenantToken();

    const cleanedIssue = String(issue)
      .replace(/\s*@\s*config\s*\(env\)\s*/gi, " ")
      .replace(/\s+/g, " ")
      .trim();
    const errorInfo = txHash ? await fetchDebugError(txHash, chainId) : null;
    const atName = FEISHU_AT_USER_NAME || "汪南 Warren";
    const atUserId = getAtUserId(issueType);
    const atIdKey = FEISHU_AT_USER_ID_TYPE === "open_id"
      ? "open_id"
      : FEISHU_AT_USER_ID_TYPE === "union_id"
      ? "union_id"
      : "user_id";
    const atTagText = `<at ${atIdKey}="${atUserId}">${atName}</at>`;
    const lines = [
      "【客户工单】",
      `${atTagText} 请及时处理`,
      `反馈人：${reporter}`,
      `用户名：${userName}`,
      `UX EVM 地址：${evmAddress || "-"}`,
      `TX 链接：${txLink || "-"}`,
    ];
    if (errorInfo) {
      lines.push(`错误查询：${errorInfo}`);
    }
    lines.push(`问题描述：${cleanedIssue || "-"}`);
    const textContent = lines.join("\n");

    const msgData = await sendFeishuText({
      token,
      receiveIdType: "chat_id",
      receiveId: FEISHU_CHAT_ID,
      text: textContent,
    });

    const pool = await initDb();
    await pool.query(
      "INSERT INTO tickets (user_name, reporter, evm_address, tx_link, issue, error_info, tx_hash, chain_id, issue_type) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
      [
        userName,
        reporter,
        evmAddress || "",
        txLink || "",
        cleanedIssue || "",
        errorInfo || "",
        txHash || "",
        chainId || "",
        issueType || "",
      ]
    );

    const messageId = msgData?.data?.message_id;
    if (messageId) {
      messageReporterMap.set(messageId, {
        reporter: normalizeReporterKey(reporter),
        notified: false,
        atUserId,
      });
    }

    return res.json({ ok: true });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: "Server error", detail: String(error) });
  }
});

app.post("/api/feishu/event", async (req, res) => {
  const body = req.body || {};
  if (body.type === "url_verification") {
    return res.json({ challenge: body.challenge });
  }

  if (body.type !== "event_callback") {
    return res.json({ ok: true });
  }

  const event = body.event || {};
  const message = event.message || {};
  const chatId = message.chat_id;
  if (chatId && FEISHU_CHAT_ID && chatId !== FEISHU_CHAT_ID) {
    return res.json({ ok: true });
  }

  if (event.sender?.sender_type === "app") {
    return res.json({ ok: true });
  }

  const rootId = message.root_id || message.parent_id;
  if (!rootId) {
    return res.json({ ok: true });
  }

  const record = messageReporterMap.get(rootId);
  if (!record || record.notified) {
    return res.json({ ok: true });
  }

  const senderUserId = getSenderUserId(event.sender);
  if (record.atUserId && senderUserId && senderUserId !== record.atUserId) {
    return res.json({ ok: true });
  }

  const reporterKey = record.reporter;
  const reporterUserId = REPORTER_USER_ID_MAP[reporterKey];
  if (!reporterUserId) {
    return res.json({ ok: true });
  }

  try {
    const token = await getTenantToken();
    await sendFeishuText({
      token,
      receiveIdType: "user_id",
      receiveId: reporterUserId,
      text: "工单已处理，请查看 User Support 群聊信息。",
    });
    record.notified = true;
  } catch (error) {
    console.error(error);
  }

  return res.json({ ok: true });
});

app.post("/api/admin/login", async (req, res) => {
  try {
    const { username, password } = req.body || {};
    if (!username || !password) {
      return res.status(400).json({ message: "username and password required" });
    }
    const pool = await initDb();
    const [rows] = await pool.query("SELECT * FROM admins WHERE username = ? LIMIT 1", [username]);
    const admin = rows?.[0];
    if (!admin) return res.status(401).json({ message: "Invalid credentials" });
    const ok = await bcrypt.compare(password, admin.password_hash);
    if (!ok) return res.status(401).json({ message: "Invalid credentials" });
    const token = crypto.randomUUID();
    sessionTokens.set(token, admin.id);
    return res.json({
      token,
      admin: {
        id: admin.id,
        username: admin.username,
        avatarUrl: admin.avatar_url || "",
      },
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: "Server error", detail: String(error) });
  }
});

app.put("/api/admin/profile", async (req, res) => {
  try {
    const { token, avatarUrl, password } = req.body || {};
    if (!token) return res.status(401).json({ message: "Unauthorized" });
    const adminId = sessionTokens.get(token);
    if (!adminId) return res.status(401).json({ message: "Unauthorized" });
    const pool = await initDb();
    const updates = [];
    const values = [];
    if (avatarUrl !== undefined) {
      updates.push("avatar_url = ?");
      values.push(avatarUrl || "");
    }
    if (password) {
      const hash = await bcrypt.hash(password, 10);
      updates.push("password_hash = ?");
      values.push(hash);
    }
    if (updates.length === 0) {
      return res.json({ ok: true });
    }
    values.push(adminId);
    await pool.query(`UPDATE admins SET ${updates.join(", ")} WHERE id = ?`, values);
    return res.json({ ok: true });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: "Server error", detail: String(error) });
  }
});

app.get("/api/tickets", async (req, res) => {
  try {
    const limit = Math.min(Number(req.query.limit) || 50, 200);
    const pool = await initDb();
    const [rows] = await pool.query(
      "SELECT id, user_name, reporter, issue, created_at FROM tickets ORDER BY id DESC LIMIT ?",
      [limit]
    );
    return res.json({ data: rows || [] });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: "Server error", detail: String(error) });
  }
});

const PORT = process.env.PORT || 8787;
app.listen(PORT, () => {
  console.log(`Feishu proxy listening on http://localhost:${PORT}`);
});
