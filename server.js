import "dotenv/config";
import express from "express";
import cors from "cors";
import mysql from "mysql2/promise";
import bcrypt from "bcryptjs";
import crypto from "crypto";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";

const app = express();
app.use(cors());
app.use(express.json());

const __dirname = path.dirname(fileURLToPath(import.meta.url));
app.use(express.static(__dirname));

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
    alain: "7550950007357505537",
    alian: "7550950007357505537",
    bryan: "7550950262271082499",
    jethro: "7523147092764786707",
    warren: "7511938969643319297",
  };
})();
const REPORTER_OPEN_ID_MAP = (() => {
  try {
    if (process.env.FEISHU_REPORTER_OPEN_ID_MAP) {
      return JSON.parse(process.env.FEISHU_REPORTER_OPEN_ID_MAP);
    }
  } catch (error) {
    console.warn("Invalid FEISHU_REPORTER_OPEN_ID_MAP JSON");
  }
  return {};
})();
const messageReporterMap = new Map();
const sessionTokens = new Map();
let dbPool = null;

const SEED_ADMINS = [
  { username: "warren", avatarUrl: "Admin/Warren.jpg", isSuper: 1 },
  { username: "ethan", avatarUrl: "Admin/Ethan.png", isSuper: 0 },
  { username: "alian", avatarUrl: "Admin/Alian.jpg", isSuper: 0 },
  { username: "bryan", avatarUrl: "Admin/Bryan.jpg", isSuper: 0 },
  { username: "jethro", avatarUrl: "Admin/Jethro.jpg", isSuper: 0 },
  { username: "peter", avatarUrl: "Admin/Peter.jpg", isSuper: 0 },
];

const initDb = async () => {
  if (dbPool) {
    const dbName = process.env.DB_NAME || "vipservicetool";
    const [rows] = await dbPool.query(
      "SELECT COUNT(*) as count FROM information_schema.columns WHERE table_schema = ? AND table_name = 'admins' AND column_name = 'feishu_id'",
      [dbName]
    );
    if (rows?.[0]?.count === 0) {
      await dbPool.query("ALTER TABLE admins ADD COLUMN feishu_id VARCHAR(120) DEFAULT NULL");
    }
    const [tr] = await dbPool.query(
      "SELECT COUNT(*) as count FROM information_schema.columns WHERE table_schema = ? AND table_name = 'tickets' AND column_name = 'resolved'",
      [dbName]
    );
    if (tr?.[0]?.count === 0) {
      await dbPool.query("ALTER TABLE tickets ADD COLUMN resolved TINYINT(1) DEFAULT 0");
    }
    return dbPool;
  }
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
      is_super TINYINT(1) DEFAULT 0,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    )
  `);

  const [columnRows] = await dbPool.query(
    "SELECT COUNT(*) as count FROM information_schema.columns WHERE table_schema = ? AND table_name = 'admins' AND column_name = 'is_super'",
    [DB_NAME]
  );
  if (columnRows?.[0]?.count === 0) {
    await dbPool.query("ALTER TABLE admins ADD COLUMN is_super TINYINT(1) DEFAULT 0");
  }

  await ensureColumn("admins", "feishu_id", "VARCHAR(120) DEFAULT NULL");

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
      message_id VARCHAR(120),
      at_user_id VARCHAR(120),
      reporter_key VARCHAR(120),
      dm_notified TINYINT(1) DEFAULT 0,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);

  const ensureColumn = async (table, column, definition) => {
    const [rows] = await dbPool.query(
      "SELECT COUNT(*) as count FROM information_schema.columns WHERE table_schema = ? AND table_name = ? AND column_name = ?",
      [DB_NAME, table, column]
    );
    if (rows?.[0]?.count === 0) {
      await dbPool.query(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`);
    }
  };

  await ensureColumn("tickets", "message_id", "VARCHAR(120)");
  await ensureColumn("tickets", "at_user_id", "VARCHAR(120)");
  await ensureColumn("tickets", "reporter_key", "VARCHAR(120)");
  await ensureColumn("tickets", "dm_notified", "TINYINT(1) DEFAULT 0");
  await ensureColumn("tickets", "resolved", "TINYINT(1) DEFAULT 0");

  const defaultHash = await bcrypt.hash("admin123", 10);
  for (const admin of SEED_ADMINS) {
    const [existing] = await dbPool.query("SELECT id FROM admins WHERE username = ? LIMIT 1", [admin.username]);
    if (!existing?.[0]) {
      await dbPool.query(
        "INSERT INTO admins (username, password_hash, avatar_url, is_super) VALUES (?, ?, ?, ?)",
        [admin.username, defaultHash, admin.avatarUrl, admin.isSuper]
      );
    }
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
    const reporterKey = normalizeReporterKey(reporter);
    await pool.query(
      "INSERT INTO tickets (user_name, reporter, evm_address, tx_link, issue, error_info, tx_hash, chain_id, issue_type, message_id, at_user_id, reporter_key, dm_notified) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0)",
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
        msgData?.data?.message_id || "",
        atUserId || "",
        reporterKey || "",
      ]
    );

    const messageId = msgData?.data?.message_id;
    if (messageId) {
      messageReporterMap.set(messageId, {
        reporter: reporterKey,
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
  console.log("Feishu event", {
    type: body.type,
    eventType: body.event?.type,
    messageId: body.event?.message?.message_id,
    rootId: body.event?.message?.root_id,
    parentId: body.event?.message?.parent_id,
    chatId: body.event?.message?.chat_id,
    senderType: body.event?.sender?.sender_type,
    senderId: body.event?.sender?.sender_id?.user_id || body.event?.sender?.sender_id?.open_id,
  });
  if (body.type === "url_verification") {
    return res.json({ challenge: body.challenge });
  }

  const isEventCallback = body.type === "event_callback" ||
    (body.event?.message && (body.event.message.root_id || body.event.message.parent_id));
  if (!isEventCallback) {
    return res.json({ ok: true });
  }

  const event = body.event || {};
  const message = event.message || {};
  const chatId = message.chat_id;
  if (chatId && FEISHU_CHAT_ID && chatId !== FEISHU_CHAT_ID) {
    console.log("Feishu event: skip, chat_id mismatch", { chatId, FEISHU_CHAT_ID });
    return res.json({ ok: true });
  }

  if (event.sender?.sender_type === "app") {
    return res.json({ ok: true });
  }

  const rootId = message.root_id || message.parent_id;
  if (!rootId) {
    console.log("Feishu event: skip, not a reply (no root_id/parent_id)");
    return res.json({ ok: true });
  }

  const senderUserId = getSenderUserId(event.sender);
  let record = messageReporterMap.get(rootId);
  let reporterKey = record?.reporter || "";
  let atUserId = record?.atUserId || "";
  let alreadyNotified = record?.notified || false;

  if (!record || alreadyNotified) {
    try {
      const pool = await initDb();
      const [rows] = await pool.query(
        "SELECT reporter_key, at_user_id, dm_notified FROM tickets WHERE message_id = ? ORDER BY id DESC LIMIT 1",
        [rootId]
      );
      const dbRecord = rows?.[0];
      if (!dbRecord || dbRecord.dm_notified) {
        console.log("Feishu event: skip DM, no ticket or already notified", { rootId, hasRecord: !!dbRecord, dmNotified: dbRecord?.dm_notified });
        return res.json({ ok: true });
      }
      reporterKey = dbRecord.reporter_key || "";
      atUserId = dbRecord.at_user_id || "";
    } catch (error) {
      console.error(error);
      return res.json({ ok: true });
    }
  }

  const atOpenId = process.env.FEISHU_AT_OPEN_ID || "";
  const isFromAtUser =
    !senderUserId ? false
    : senderUserId === atUserId
    ? true
    : atOpenId && senderUserId === atOpenId;
  if (atUserId && senderUserId && !isFromAtUser) {
    console.log("Feishu event: skip DM, reply not from at_user", { senderUserId, atUserId, atOpenId });
    return res.json({ ok: true });
  }

  let receiveIdType = "user_id";
  let receiveId = null;
  try {
    const pool = await initDb();
    const [adminRows] = await pool.query(
      "SELECT feishu_id FROM admins WHERE LOWER(username) = ? LIMIT 1",
      [reporterKey]
    );
    const feishuId = adminRows?.[0]?.feishu_id && String(adminRows[0].feishu_id).trim();
    if (feishuId) {
      receiveId = feishuId;
      receiveIdType = feishuId.startsWith("ou_") ? "open_id" : "user_id";
    }
  } catch (e) {
    console.warn("Lookup feishu_id from admins failed", e);
  }
  if (!receiveId) {
    const reporterOpenId = REPORTER_OPEN_ID_MAP[reporterKey];
    const reporterUserId = REPORTER_USER_ID_MAP[reporterKey];
    const useOpenId = reporterOpenId && reporterOpenId.startsWith("ou_");
    receiveIdType = useOpenId ? "open_id" : "user_id";
    receiveId = useOpenId ? reporterOpenId : reporterUserId;
  }
  if (!receiveId) {
    console.log("Feishu event: skip DM, reporter not in map and no feishu_id", { reporterKey });
    return res.json({ ok: true });
  }

  console.log("Feishu event: sending DM to reporter", { reporterKey, receiveIdType, receiveId });
  try {
    const token = await getTenantToken();
    await sendFeishuText({
      token,
      receiveIdType,
      receiveId,
      text: "工单已处理，请查看 User Support 群聊信息。",
    });
    if (record) {
      record.notified = true;
    }
    try {
      const pool = await initDb();
      await pool.query("UPDATE tickets SET dm_notified = 1 WHERE message_id = ?", [rootId]);
    } catch (error) {
      console.error(error);
    }
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
        isSuper: Boolean(admin.is_super),
      },
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: "Server error", detail: String(error) });
  }
});

app.put("/api/admin/profile", async (req, res) => {
  try {
    const { token, password } = req.body || {};
    if (!token) return res.status(401).json({ message: "Unauthorized" });
    const adminId = sessionTokens.get(token);
    if (!adminId) return res.status(401).json({ message: "Unauthorized" });
    const pool = await initDb();
    const updates = [];
    const values = [];
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
      "SELECT id, user_name, reporter, issue, created_at, resolved FROM tickets ORDER BY id DESC LIMIT ?",
      [limit]
    );
    return res.json({ data: rows || [] });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: "Server error", detail: String(error) });
  }
});

app.put("/api/tickets/:id/resolved", async (req, res) => {
  try {
    const token = req.body?.token || req.query.token;
    if (!token) return res.status(401).json({ message: "Unauthorized" });
    const adminId = sessionTokens.get(String(token));
    if (!adminId) return res.status(401).json({ message: "Unauthorized" });
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id < 1) return res.status(400).json({ message: "Invalid id" });
    const resolved = req.body?.resolved != null ? (req.body.resolved ? 1 : 0) : null;
    if (resolved === null) return res.status(400).json({ message: "resolved required (0 or 1)" });
    const pool = await initDb();
    await pool.query("UPDATE tickets SET resolved = ? WHERE id = ?", [resolved, id]);
    return res.json({ ok: true });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: "Server error", detail: String(error) });
  }
});

app.get("/api/tickets/export", async (req, res) => {
  try {
    const token = req.query.token;
    if (!token) return res.status(401).json({ message: "Unauthorized" });
    const adminId = sessionTokens.get(String(token));
    if (!adminId) return res.status(401).json({ message: "Unauthorized" });
    const pool = await initDb();
    const [rows] = await pool.query(
      "SELECT id, user_name, reporter, evm_address, tx_link, issue, issue_type, created_at, resolved FROM tickets ORDER BY id DESC LIMIT 2000"
    );
    const header = "ID,用户名,反馈人,EVM地址,TX链接,问题,问题类型,创建时间,是否完成\n";
    const escapeCsv = (v) => {
      const s = v == null ? "" : String(v);
      return s.includes(",") || s.includes('"') || s.includes("\n") ? `"${s.replace(/"/g, '""')}"` : s;
    };
    const lines = (rows || []).map(
      (r) =>
        [r.id, r.user_name, r.reporter, r.evm_address, r.tx_link, r.issue, r.issue_type, formatExportTime(r.created_at), r.resolved ? "是" : "否"].map(escapeCsv).join(",")
    );
    const csv = "\uFEFF" + header + lines.join("\n");
    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader("Content-Disposition", "attachment; filename=tickets.csv");
    return res.send(csv);
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: "Server error", detail: String(error) });
  }
});

function formatExportTime(v) {
  if (v == null) return "";
  const d = typeof v === "number" ? new Date(v > 1e12 ? v : v * 1000) : new Date(v);
  return isNaN(d.getTime()) ? String(v) : d.toISOString().replace("T", " ").slice(0, 19);
}

app.get("/api/admins", async (req, res) => {
  try {
    const token = req.query.token;
    if (!token) return res.status(401).json({ message: "Unauthorized" });
    const adminId = sessionTokens.get(String(token));
    if (!adminId) return res.status(401).json({ message: "Unauthorized" });
    const pool = await initDb();
    const [rows] = await pool.query(
      "SELECT id, username, avatar_url, is_super, feishu_id, created_at FROM admins ORDER BY id ASC"
    );
    return res.json({ data: rows || [] });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: "Server error", detail: String(error) });
  }
});

app.put("/api/admins/feishu_id", async (req, res) => {
  try {
    const { token, username, feishu_id } = req.body || {};
    if (!token) return res.status(401).json({ message: "Unauthorized" });
    const adminId = sessionTokens.get(String(token));
    if (!adminId) return res.status(401).json({ message: "Unauthorized" });
    if (!username) return res.status(400).json({ message: "username required" });
    const pool = await initDb();
    const [adminRows] = await pool.query("SELECT is_super, username FROM admins WHERE id = ? LIMIT 1", [adminId]);
    const admin = adminRows?.[0];
    if (!admin || (!admin.is_super && admin.username !== "warren")) {
      return res.status(403).json({ message: "Forbidden" });
    }
    const value = feishu_id != null ? String(feishu_id).trim() : "";
    await pool.query("UPDATE admins SET feishu_id = ? WHERE LOWER(username) = ?", [value || null, username.toLowerCase()]);
    return res.json({ ok: true });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: "Server error", detail: String(error) });
  }
});

app.post("/api/admins", async (req, res) => {
  try {
    const { token, username, password, avatarUrl, feishu_id } = req.body || {};
    if (!token) return res.status(401).json({ message: "Unauthorized" });
    const adminId = sessionTokens.get(String(token));
    if (!adminId) return res.status(401).json({ message: "Unauthorized" });
    if (!username) {
      return res.status(400).json({ message: "username required" });
    }
    const pool = await initDb();
    const [adminRows] = await pool.query("SELECT is_super, username FROM admins WHERE id = ? LIMIT 1", [adminId]);
    const admin = adminRows?.[0];
    if (!admin || (!admin.is_super && admin.username !== "warren")) {
      return res.status(403).json({ message: "Forbidden" });
    }
    const [existing] = await pool.query("SELECT id FROM admins WHERE username = ? LIMIT 1", [username]);
    if (existing?.[0]) {
      return res.status(409).json({ message: "User exists" });
    }
    const finalPassword = password && String(password).trim() ? String(password).trim() : "admin123";
    const hash = await bcrypt.hash(finalPassword, 10);
    let storedAvatar = "";
    const rawAvatar = (avatarUrl && String(avatarUrl).trim()) || "";
    if (rawAvatar.startsWith("data:") && rawAvatar.includes("base64,")) {
      try {
        const match = rawAvatar.match(/^data:([^;]+);base64,(.+)$/);
        const ext = match && match[1] && match[1].includes("png") ? "png" : "jpg";
        const base64 = match ? match[2] : "";
        const dir = path.join(__dirname, "Admin");
        if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
        const filename = `${username}.${ext}`;
        const filepath = path.join(dir, filename);
        fs.writeFileSync(filepath, Buffer.from(base64, "base64"));
        storedAvatar = `Admin/${filename}`;
      } catch (e) {
        console.warn("Avatar save failed", e);
      }
    } else if (rawAvatar.length > 0 && rawAvatar.length <= 255) {
      storedAvatar = rawAvatar;
    }
    const feishuIdVal = feishu_id != null ? String(feishu_id).trim() || null : null;
    await pool.query(
      "INSERT INTO admins (username, password_hash, avatar_url, is_super, feishu_id) VALUES (?, ?, ?, 0, ?)",
      [username, hash, storedAvatar, feishuIdVal]
    );
    return res.json({ ok: true });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: "Server error", detail: String(error) });
  }
});

const PORT = process.env.PORT || 8787;
app.listen(PORT, () => {
  console.log(`Feishu proxy listening on http://localhost:${PORT}`);
});
