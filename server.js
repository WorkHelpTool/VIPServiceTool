import express from "express";
import cors from "cors";

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
const REPORTER_USER_ID_MAP = (() => {
  try {
    if (process.env.FEISHU_REPORTER_USER_ID_MAP) {
      return JSON.parse(process.env.FEISHU_REPORTER_USER_ID_MAP);
    }
  } catch (error) {
    console.warn("Invalid FEISHU_REPORTER_USER_ID_MAP JSON");
  }
  return {
    warren: "7511938969643319297",
  };
})();

const messageReporterMap = new Map();

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

if (!FEISHU_APP_ID || !FEISHU_APP_SECRET || !FEISHU_CHAT_ID) {
  console.warn("Missing FEISHU_APP_ID / FEISHU_APP_SECRET / FEISHU_CHAT_ID env vars.");
}

app.post("/api/feishu", async (req, res) => {
  try {
    const { userName, reporter, evmAddress, txLink, issue, txHash, chainId } = req.body || {};
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
    const atIdKey = FEISHU_AT_USER_ID_TYPE === "open_id"
      ? "open_id"
      : FEISHU_AT_USER_ID_TYPE === "union_id"
      ? "union_id"
      : "user_id";
    const atTagText = `<at ${atIdKey}="${FEISHU_AT_USER_ID}">${atName}</at>`;
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

    const messageId = msgData?.data?.message_id;
    if (messageId) {
      messageReporterMap.set(messageId, {
        reporter: normalizeReporterKey(reporter),
        notified: false,
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

const PORT = process.env.PORT || 8787;
app.listen(PORT, () => {
  console.log(`Feishu proxy listening on http://localhost:${PORT}`);
});
