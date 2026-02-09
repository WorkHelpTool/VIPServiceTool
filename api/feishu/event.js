import { messageReporterMap } from "../_store.js";

const FEISHU_APP_ID = process.env.FEISHU_APP_ID;
const FEISHU_APP_SECRET = process.env.FEISHU_APP_SECRET;
const FEISHU_CHAT_ID = process.env.FEISHU_CHAT_ID;
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

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.status(405).json({ message: "Method not allowed" });
    return;
  }

  const body = await getJsonBody(req);
  if (body.type === "url_verification") {
    res.json({ challenge: body.challenge });
    return;
  }

  if (body.type !== "event_callback") {
    res.json({ ok: true });
    return;
  }

  const event = body.event || {};
  const message = event.message || {};
  const chatId = message.chat_id;
  if (chatId && FEISHU_CHAT_ID && chatId !== FEISHU_CHAT_ID) {
    res.json({ ok: true });
    return;
  }

  if (event.sender?.sender_type === "app") {
    res.json({ ok: true });
    return;
  }

  const rootId = message.root_id || message.parent_id;
  if (!rootId) {
    res.json({ ok: true });
    return;
  }

  const record = messageReporterMap.get(rootId);
  if (!record || record.notified) {
    res.json({ ok: true });
    return;
  }

  const reporterUserId = REPORTER_USER_ID_MAP[record.reporter];
  if (!reporterUserId) {
    res.json({ ok: true });
    return;
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

  res.json({ ok: true });
}
