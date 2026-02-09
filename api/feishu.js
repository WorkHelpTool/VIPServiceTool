import { messageReporterMap, normalizeReporterKey } from "./_store.js";

const FEISHU_APP_ID = process.env.FEISHU_APP_ID;
const FEISHU_APP_SECRET = process.env.FEISHU_APP_SECRET;
const FEISHU_CHAT_ID = process.env.FEISHU_CHAT_ID;
const FEISHU_AT_USER_ID = process.env.FEISHU_AT_USER_ID || "7511938969643319297";
const FEISHU_AT_USER_ID_TYPE = (process.env.FEISHU_AT_USER_ID_TYPE || "user_id").toLowerCase();
const FEISHU_AT_USER_NAME = process.env.FEISHU_AT_USER_NAME;
const DEBUG_RPC_BASE = "https://rpc-debug.particle.network/evm-chain/public";

const getJsonBody = async (req) => {
  if (req.body && typeof req.body === "object") return req.body;
  let raw = "";
  for await (const chunk of req) raw += chunk;
  if (!raw) return {};
  try {
    return JSON.parse(raw);
  } catch (error) {
    return {};
  }
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

const fetchDebugError = async (txHash, chainId) => {
  try {
    const chain = chainId || 8453;
    const resp = await fetch(`${DEBUG_RPC_BASE}?chainId=${chain}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          jsonrpc: "2.0",
          method: "debug_traceTransaction",
          params: [txHash, { tracer: "callTracer" }],
          id: 1,
        }),
      }
    );
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

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.status(405).json({ message: "Method not allowed" });
    return;
  }

  try {
    const { userName, reporter, evmAddress, txLink, issue, txHash, chainId } = await getJsonBody(req);
    if (!userName || !reporter || !issue) {
      res.status(400).json({ message: "userName, reporter and issue are required" });
      return;
    }

    if (!FEISHU_APP_ID || !FEISHU_APP_SECRET || !FEISHU_CHAT_ID) {
      res.status(500).json({ message: "Feishu env vars not configured" });
      return;
    }

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

    const token = await getTenantToken();
    const msgData = await sendFeishuText({
      token,
      receiveIdType: "chat_id",
      receiveId: FEISHU_CHAT_ID,
      text: lines.join("\n"),
    });

    const messageId = msgData?.data?.message_id;
    if (messageId) {
      messageReporterMap.set(messageId, {
        reporter: normalizeReporterKey(reporter),
        notified: false,
      });
    }

    res.json({ ok: true });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Server error", detail: String(error) });
  }
}
