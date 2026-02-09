const loadBtn = document.getElementById("loadBtn");
const statusEl = document.getElementById("status");
const txListBody = document.getElementById("txListBody");
const txFilterInput = document.getElementById("txFilterInput");
const previewFrame = document.getElementById("previewFrame");
const openNewTab = document.getElementById("openNewTab");
const emptyPreview = document.getElementById("emptyPreview");
const basicInfoGrid = document.getElementById("basicInfoGrid");
const tradeStats = document.getElementById("tradeStats");
const redPacketStats = document.getElementById("redPacketStats");
const inviteStats = document.getElementById("inviteStats");
const inviteChart = document.getElementById("inviteChart");
const txCount = document.getElementById("txCount");
const queryInput = document.getElementById("queryInput");
const queryLabel = document.getElementById("queryLabel");
const langButtons = document.querySelectorAll(".lang-btn");
const titleText = document.getElementById("titleText");
const subtitleText = document.getElementById("subtitleText");
const queryTitle = document.getElementById("queryTitle");
const querySubtitle = document.getElementById("querySubtitle");
const queryHint = document.getElementById("queryHint");
const overviewTitle = document.getElementById("overviewTitle");
const overviewSubtitle = document.getElementById("overviewSubtitle");
const tradeTitle = document.getElementById("tradeTitle");
const inviteTitle = document.getElementById("inviteTitle");
const inviteChartTitle = document.getElementById("inviteChartTitle");
const redPacketTitle = document.getElementById("redPacketTitle");
const txTitle = document.getElementById("txTitle");
const txFilterLabel = document.getElementById("txFilterLabel");
const txHeaderIndex = document.getElementById("txHeaderIndex");
const txHeaderId = document.getElementById("txHeaderId");
const txHeaderLink = document.getElementById("txHeaderLink");
const previewTitle = document.getElementById("previewTitle");
const createTicketBtn = document.getElementById("createTicketBtn");
const ticketModal = document.getElementById("ticketModal");
const ticketModalBackdrop = document.getElementById("ticketModalBackdrop");
const ticketCloseBtn = document.getElementById("ticketCloseBtn");
const ticketSubmitBtn = document.getElementById("ticketSubmitBtn");
const ticketUserName = document.getElementById("ticketUserName");
const ticketReporter = document.getElementById("ticketReporter");
const ticketEvmAddress = document.getElementById("ticketEvmAddress");
const ticketTxLink = document.getElementById("ticketTxLink");
const ticketType = document.getElementById("ticketType");
const ticketIssue = document.getElementById("ticketIssue");
const ticketTitle = document.getElementById("ticketTitle");
const ticketUserLabel = document.getElementById("ticketUserLabel");
const ticketReporterLabel = document.getElementById("ticketReporterLabel");
const ticketEvmLabel = document.getElementById("ticketEvmLabel");
const ticketTxLabel = document.getElementById("ticketTxLabel");
const ticketTypeLabel = document.getElementById("ticketTypeLabel");
const ticketIssueLabel = document.getElementById("ticketIssueLabel");
const ticketHint = document.getElementById("ticketHint");
const appRoot = document.getElementById("app");
const adminLogo = document.getElementById("adminLogo");
const adminWatermark = document.getElementById("adminWatermark");
const adminName = document.getElementById("adminName");
const logoutBtn = document.getElementById("logoutBtn");
const loginOverlay = document.getElementById("loginOverlay");
const loginUser = document.getElementById("loginUser");
const loginPass = document.getElementById("loginPass");
const loginBtn = document.getElementById("loginBtn");
const loginError = document.getElementById("loginError");
const loginTitle = document.getElementById("loginTitle");
const loginSubtitle = document.getElementById("loginSubtitle");
const loginUserLabel = document.getElementById("loginUserLabel");
const loginPassLabel = document.getElementById("loginPassLabel");

let fullTxs = [];
let activeRowId = null;
let activeQueryType = "evm";
let activeLang = "zh";
let currentEvmAddress = "";
let currentTxLink = "";
let currentTxHash = "";
let currentTxChainId = "";
let canCreateTicket = false;
const FEISHU_API_URL = "/api/feishu";
let currentAdmin = null;
const TX_DETAIL_API_URL =
  "https://universal-rpc-proxy.particle.network/?method=universal_getTransaction&mode=mainnet&device_id=aae80668-67eb-4fc7-a97c-d963e19e9053";
const txDetailCache = new Map();

const ADMIN_ACCOUNTS = {
  warren: { password: "admin123", logo: "Admin/Warren.jpg", role: "super" },
  alian: { password: "admin123", logo: "Admin/Alian.jpg", role: "admin" },
  bryan: { password: "admin123", logo: "Admin/Bryan.jpg", role: "admin" },
  ethan: { password: "admin123", logo: "Admin/Ethan.png", role: "admin" },
  jethro: { password: "admin123", logo: "Admin/Jethro.jpg", role: "admin" },
  peter: { password: "admin123", logo: "Admin/Peter.jpg", role: "admin" },
};

const API_BASE = "https://universal-app-api-staging.particle.network/user_activity";
const QUERY_CONFIG = {
  evm: {
    param: "evmAddress",
    sample: "0x181Baa78e7Dbb1159e01dbb6A7d15533f92a810C",
  },
  solana: {
    param: "solanaAddress",
    sample: "99DHXUbx1MnVbCSkpPSNx52otU13oEy82Puy7MkoNTLw",
  },
  invite: {
    param: "inviteCode",
    sample: "YV82EN",
  },
};

const I18N = {
  zh: {
    title: "VIP服务工具",
    subtitle: "集中展示用户画像、交易分析与 tx 详情",
    queryTitle: "查询用户",
    querySubtitle: "通过地址或邀请码快速检索",
    queryHint: "支持自动识别：EVM / Solana / 邀请码",
    queryButton: "查询",
    queryLabel: {
      evm: "EVM 地址",
      solana: "Solana 地址",
      invite: "邀请码",
    },
    queryPlaceholder: {
      evm: "请输入地址或邀请码",
      solana: "请输入地址或邀请码",
      invite: "请输入地址或邀请码",
    },
    overviewTitle: "用户概览",
    overviewSubtitle: "基础信息与关键画像",
    tradeTitle: "交易分析",
    inviteTitle: "邀新分析",
    inviteChartTitle: "近 30 天佣金走势",
    redPacketTitle: "红包统计",
    txTitle: "交易可视化",
    txCount: (count) => (count ? `共 ${count} 条 tx` : "暂无交易"),
    txFilterLabel: "筛选",
    txFilterPlaceholder: "按 tx id / 代币名 / 合约筛选",
    txHeaderIndex: "序号",
    txHeaderId: "TxID",
    txHeaderLink: "Token Change",
    previewTitle: "详情预览",
    openNewTab: "新标签页打开",
    emptyPreview: "点击左侧某条记录以预览",
    createTicket: "一键生成工单",
    ticketTitle: "生成工单",
    ticketUserLabel: "用户名",
    ticketUserPlaceholder: "请输入用户名",
    ticketReporterLabel: "反馈人",
    ticketReporterPlaceholder: "请输入反馈人",
    ticketEvmLabel: "UX EVM 地址",
    ticketTxLabel: "TX 链接",
    ticketTypeLabel: "问题类型",
    ticketTypeFrontend: "前端问题",
    ticketTypeBackend: "后端问题",
    ticketIssueLabel: "问题描述",
    ticketIssuePlaceholder: "请输入问题描述",
    ticketHint: "工单将接入飞书（等待配置 appid）",
    ticketSubmit: "提交工单",
    loginTitle: "管理员登录",
    loginSubtitle: "仅授权管理员可访问",
    loginUserLabel: "用户名",
    loginUserPlaceholder: "请输入用户名",
    loginPassLabel: "密码",
    loginPassPlaceholder: "请输入密码",
    loginButton: "登录",
    logout: "退出",
    loginError: "用户名或密码错误",
    statusReady: "准备就绪",
    statusLoading: "加载中...",
    statusMissingQuery: "请输入查询条件",
    statusLoaded: (count) => `已加载 ${count} 条交易记录`,
    statusFailed: (msg) => `加载失败: ${msg}`,
    listEmpty: "暂无数据",
    listNoTx: "暂无 Token Change",
    listTokenLoading: "加载中...",
    listFetchFail: "无法获取数据，请检查链接或网络",
    metrics: {
      evmAddress: "EVM 地址",
      solanaAddress: "Solana 地址",
      owner: "Owner",
      loginType: "登录类型",
      createdAt: "创建时间",
      tradingVolume: "交易量",
      tradingDays: "交易天数",
      tradingFees: "交易手续费",
      totalTradeCount: "总交易笔数",
      firstTradeAt: "首笔交易",
      lastTradeAt: "最新交易",
      cashReward: "奖励",
      sendRedPacketCount: "发送红包",
      receiveRedPacketCount: "收到红包",
      inviteCode: "邀请码",
      totalInviteeCount: "邀请人数",
      validInviteeCount: "有效邀请",
      totalInviteRewards: "总奖励",
    },
  },
  en: {
    title: "VIP Service Tool",
    subtitle: "User profile, trading analytics, and tx details in one place",
    queryTitle: "Query User",
    querySubtitle: "Search by address or invite code",
    queryHint: "Auto-detects EVM / Solana / Invite code",
    queryButton: "Search",
    queryLabel: {
      evm: "EVM Address",
      solana: "Solana Address",
      invite: "Invite Code",
    },
    queryPlaceholder: {
      evm: "Enter address or invite code",
      solana: "Enter address or invite code",
      invite: "Enter address or invite code",
    },
    overviewTitle: "User Overview",
    overviewSubtitle: "Key profile and identity",
    tradeTitle: "Trading Analysis",
    inviteTitle: "Invite Analysis",
    inviteChartTitle: "30-day Commission Trend",
    redPacketTitle: "Red Packet",
    txTitle: "Transactions",
    txCount: (count) => (count ? `${count} txs` : "No transactions"),
    txFilterLabel: "Filter",
    txFilterPlaceholder: "Filter by tx id / token / contract",
    txHeaderIndex: "No.",
    txHeaderId: "TxID",
    txHeaderLink: "Token Change",
    previewTitle: "Preview",
    openNewTab: "Open in new tab",
    emptyPreview: "Select a row to preview",
    createTicket: "Create Ticket",
    ticketTitle: "Create Ticket",
    ticketUserLabel: "User Name",
    ticketUserPlaceholder: "Enter user name",
    ticketReporterLabel: "Reporter",
    ticketReporterPlaceholder: "Enter reporter",
    ticketEvmLabel: "UX EVM Address",
    ticketTxLabel: "TX Link",
    ticketTypeLabel: "Issue Type",
    ticketTypeFrontend: "Frontend Issue",
    ticketTypeBackend: "Backend Issue",
    ticketIssueLabel: "Issue",
    ticketIssuePlaceholder: "Describe the issue",
    ticketHint: "Ticket will be sent to Feishu (awaiting appid config)",
    ticketSubmit: "Submit",
    loginTitle: "Admin Sign-in",
    loginSubtitle: "Authorized admins only",
    loginUserLabel: "Username",
    loginUserPlaceholder: "Enter username",
    loginPassLabel: "Password",
    loginPassPlaceholder: "Enter password",
    loginButton: "Sign in",
    logout: "Logout",
    loginError: "Invalid username or password",
    statusReady: "Ready",
    statusLoading: "Loading...",
    statusMissingQuery: "Please enter a query",
    statusLoaded: (count) => `Loaded ${count} tx records`,
    statusFailed: (msg) => `Load failed: ${msg}`,
    listEmpty: "No data",
    listNoTx: "No token change",
    listTokenLoading: "Loading...",
    listFetchFail: "Unable to fetch data. Check the query or network.",
    metrics: {
      evmAddress: "EVM Address",
      solanaAddress: "Solana Address",
      owner: "Owner",
      loginType: "Login Type",
      createdAt: "Created At",
      tradingVolume: "Trading Volume",
      tradingDays: "Trading Days",
      tradingFees: "Trading Fees",
      totalTradeCount: "Total Trades",
      firstTradeAt: "First Trade",
      lastTradeAt: "Last Trade",
      cashReward: "Rewards",
      sendRedPacketCount: "Red Packets Sent",
      receiveRedPacketCount: "Red Packets Received",
      inviteCode: "Invite Code",
      totalInviteeCount: "Invitees",
      validInviteeCount: "Valid Invitees",
      totalInviteRewards: "Total Rewards",
    },
  },
};

const setStatus = (text, isError = false) => {
  statusEl.textContent = text;
  statusEl.style.color = isError ? "#f87171" : "#94a3b8";
};

const detectQueryType = (value) => {
  const input = value.trim();
  if (!input) return "evm";
  if (/^0x[a-fA-F0-9]{40}$/.test(input)) return "evm";
  if (/^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(input)) return "solana";
  return "invite";
};

const t = (key) => {
  const dict = I18N[activeLang];
  return dict[key] || key;
};

const applyLanguage = () => {
  const dict = I18N[activeLang];
  const setText = (el, text) => {
    if (el) el.textContent = text;
  };

  setText(titleText, dict.title);
  setText(subtitleText, dict.subtitle);
  setText(queryTitle, dict.queryTitle);
  setText(querySubtitle, dict.querySubtitle);
  setText(queryHint, dict.queryHint);
  setText(overviewTitle, dict.overviewTitle);
  setText(overviewSubtitle, dict.overviewSubtitle);
  setText(tradeTitle, dict.tradeTitle);
  setText(inviteTitle, dict.inviteTitle);
  setText(inviteChartTitle, dict.inviteChartTitle);
  setText(redPacketTitle, dict.redPacketTitle);
  setText(txTitle, dict.txTitle);
  setText(txFilterLabel, dict.txFilterLabel);
  setText(txHeaderIndex, dict.txHeaderIndex);
  setText(txHeaderId, dict.txHeaderId);
  setText(txHeaderLink, dict.txHeaderLink);
  setText(previewTitle, dict.previewTitle);
  setText(openNewTab, dict.openNewTab);
  setText(emptyPreview, dict.emptyPreview);
  setText(loadBtn, dict.queryButton);
  setText(createTicketBtn, dict.createTicket);
  setText(ticketTitle, dict.ticketTitle);
  setText(ticketUserLabel, dict.ticketUserLabel);
  setText(ticketReporterLabel, dict.ticketReporterLabel);
  setText(ticketEvmLabel, dict.ticketEvmLabel);
  setText(ticketTxLabel, dict.ticketTxLabel);
  setText(ticketTypeLabel, dict.ticketTypeLabel);
  setText(ticketIssueLabel, dict.ticketIssueLabel);
  setText(ticketHint, dict.ticketHint);
  setText(ticketSubmitBtn, dict.ticketSubmit);
  setText(loginTitle, dict.loginTitle);
  setText(loginSubtitle, dict.loginSubtitle);
  setText(loginUserLabel, dict.loginUserLabel);
  setText(loginPassLabel, dict.loginPassLabel);
  setText(loginBtn, dict.loginButton);
  setText(logoutBtn, dict.logout);

  const config = QUERY_CONFIG[activeQueryType];
  setText(queryLabel, dict.queryLabel[activeQueryType]);
  if (queryInput) {
    queryInput.placeholder = dict.queryPlaceholder[activeQueryType];
    queryInput.value = queryInput.value || config.sample;
  }
  if (ticketUserName) ticketUserName.placeholder = dict.ticketUserPlaceholder;
  if (ticketReporter) ticketReporter.placeholder = dict.ticketReporterPlaceholder;
  if (ticketIssue) ticketIssue.placeholder = dict.ticketIssuePlaceholder;
  if (ticketType) {
    const options = ticketType.querySelectorAll("option");
    if (options[0]) options[0].textContent = dict.ticketTypeFrontend;
    if (options[1]) options[1].textContent = dict.ticketTypeBackend;
  }
  if (loginUser) loginUser.placeholder = dict.loginUserPlaceholder;
  if (loginPass) loginPass.placeholder = dict.loginPassPlaceholder;
  if (txFilterInput) {
    txFilterInput.placeholder = dict.txFilterPlaceholder;
  }
  setText(txCount, dict.txCount(fullTxs.length));
  setStatus(dict.statusReady);
};

const buildApiUrl = () => {
  const value = queryInput.value.trim();
  activeQueryType = detectQueryType(value);
  const config = QUERY_CONFIG[activeQueryType];
  if (!config || !value) return null;
  const params = new URLSearchParams({ [config.param]: value });
  return `${API_BASE}?${params.toString()}`;
};

const updateQueryHint = () => {
  const type = detectQueryType(queryInput.value);
  activeQueryType = type;
  queryLabel.textContent = I18N[activeLang].queryLabel[type];
};

const openTicketModal = () => {
  ticketEvmAddress.value = currentEvmAddress || "";
  ticketTxLink.value = currentTxLink || "";
  if (ticketReporter) {
    ticketReporter.value = currentAdmin
      ? currentAdmin.charAt(0).toUpperCase() + currentAdmin.slice(1)
      : "";
  }
  ticketModal.classList.add("show");
  ticketModal.setAttribute("aria-hidden", "false");
};

const closeTicketModal = () => {
  ticketModal.classList.remove("show");
  ticketModal.setAttribute("aria-hidden", "true");
};

const setLoggedInState = (adminKey) => {
  const admin = ADMIN_ACCOUNTS[adminKey];
  if (!admin) return;
  currentAdmin = adminKey;
  if (adminName) {
    adminName.textContent = adminKey.charAt(0).toUpperCase() + adminKey.slice(1);
  }
  if (appRoot) appRoot.classList.remove("app-hidden");
  if (loginOverlay) loginOverlay.style.display = "none";
  if (ticketReporter) {
    ticketReporter.value = adminKey.charAt(0).toUpperCase() + adminKey.slice(1);
  }
  localStorage.setItem("adminUser", adminKey);
};

const setLoggedOutState = () => {
  currentAdmin = null;
  localStorage.removeItem("adminUser");
  if (appRoot) appRoot.classList.add("app-hidden");
  if (loginOverlay) loginOverlay.style.display = "flex";
};

const formatTime = (value) => {
  if (!value) return "-";
  if (typeof value === "number") {
    const ms = value > 1e12 ? value : value * 1000;
    return new Date(ms).toLocaleString();
  }
  if (typeof value === "string") {
    const num = Number(value);
    if (!Number.isNaN(num)) {
      const ms = num > 1e12 ? num : num * 1000;
      return new Date(ms).toLocaleString();
    }
    const parsed = Date.parse(value);
    if (!Number.isNaN(parsed)) {
      return new Date(parsed).toLocaleString();
    }
  }
  return String(value);
};

const formatAmount = (value) => {
  if (value === undefined || value === null || value === "") return "-";
  if (typeof value === "number") return value.toLocaleString();
  return String(value);
};

const formatNumber = (value) => {
  if (value === undefined || value === null || value === "") return "-";
  if (typeof value === "number") return value.toLocaleString();
  const num = Number(value);
  return Number.isNaN(num) ? String(value) : num.toLocaleString();
};

const pickField = (record, keys) => {
  for (const key of keys) {
    if (record && record[key] !== undefined && record[key] !== null && record[key] !== "") {
      return record[key];
    }
  }
  return undefined;
};

const buildTxView = (txUrl, index) => {
  const txId = (() => {
    try {
      const parsed = new URL(txUrl);
      return parsed.searchParams.get("id") || parsed.pathname.split("/").pop() || "-";
    } catch (error) {
      return "-";
    }
  })();

  return {
    id: `${index}-${txUrl}`,
    index: index + 1,
    txUrl,
    txId,
    tokenChangeLabel: "",
    tokenChangeTooltip: "",
    tokenKeywords: "",
    tokenChangeFetched: false,
    lendingTxHash: "",
    lendingChainId: "",
  };
};

const normalizeTokenChange = (change) => {
  const token = change?.token || change?.tokenInfo || change?.asset || {};
  const symbol =
    change?.symbol ||
    change?.tokenSymbol ||
    change?.tokenName ||
    token?.symbol ||
    token?.name ||
    "-";
  const address =
    change?.contractAddress ||
    change?.tokenAddress ||
    token?.contractAddress ||
    token?.address ||
    token?.tokenAddress ||
    change?.address ||
    "-";
  const direction = String(change?.type || change?.changeType || change?.action || "").toLowerCase();
  return { symbol, address, direction };
};

const resolveTokenPair = (changes) => {
  let decr = null;
  let incr = null;
  changes.forEach((item) => {
    if (!decr && /decr|decrease|out/.test(item.direction)) decr = item;
    if (!incr && /incr|increase|in/.test(item.direction)) incr = item;
  });
  if (!decr && changes[0]) decr = changes[0];
  if (!incr && changes[1]) incr = changes[1];
  return { decr, incr };
};

const buildTokenMeta = (tokenChanges) => {
  const normalized = tokenChanges.map(normalizeTokenChange);
  const { decr, incr } = resolveTokenPair(normalized);
  const token1 = decr?.symbol || "-";
  const token2 = incr?.symbol || "-";
  const label = `$${token1}-->$${token2}`;
  const tooltip = `${token1} CA: ${decr?.address || "-"}\n${token2} CA: ${incr?.address || "-"}`;
  const keywords = [token1, token2, decr?.address, incr?.address]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
  return { label, tooltip, keywords };
};

const extractTokenChanges = (result) => {
  const raw = result?.tokenChanges;
  if (Array.isArray(raw)) return raw;
  const decr = Array.isArray(raw?.decr) ? raw.decr.map((item) => ({ ...item, changeType: "decr" })) : [];
  const incr = Array.isArray(raw?.incr) ? raw.incr.map((item) => ({ ...item, changeType: "incr" })) : [];
  return [...decr, ...incr];
};

const fetchTransactionDetail = async (txId) => {
  if (!txId) return null;
  if (txDetailCache.has(txId)) return txDetailCache.get(txId);
  const request = fetch(TX_DETAIL_API_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      id: Date.now(),
      method: "universal_getTransaction",
      params: [txId, {}],
      jsonrpc: "2.0",
    }),
  })
    .then((res) => res.json())
    .catch(() => null);
  txDetailCache.set(txId, request);
  return request;
};

const updateRowTokenCell = (item, row) => {
  if (!row) return;
  const cell = row.querySelector(".tx-change");
  if (!cell) return;
  const label = item.tokenChangeLabel || (item.tokenChangeFetched
    ? I18N[activeLang].listNoTx
    : I18N[activeLang].listTokenLoading);
  cell.textContent = label;
  cell.dataset.tooltip = item.tokenChangeTooltip || "";
  cell.style.color = item.tokenChangeLabel ? "" : "#9ca3af";
};

const ensureTxDetails = async (item) => {
  if (!item?.txId) return;
  const detail = await fetchTransactionDetail(item.txId);
  const result = detail?.result || detail?.data?.result || detail?.data || detail;
  const tokenChanges = extractTokenChanges(result);
  if (tokenChanges.length > 0) {
    const meta = buildTokenMeta(tokenChanges);
    item.tokenChangeLabel = meta.label;
    item.tokenChangeTooltip = meta.tooltip;
    item.tokenKeywords = meta.keywords;
  }
  item.tokenChangeFetched = true;
  const lendingOps = Array.isArray(result?.lendingUserOperations)
    ? result.lendingUserOperations
    : [];
  const lendingOp = lendingOps.find((op) => op?.txHash) || null;
  const txHash = lendingOp?.txHash || "";
  if (txHash) item.lendingTxHash = txHash;
  if (lendingOp?.chainId) item.lendingChainId = String(lendingOp.chainId);

  const row = txListBody.querySelector(`[data-row-id="${item.id}"]`);
  updateRowTokenCell(item, row);
  if (activeRowId === item.id) {
    currentTxHash = item.lendingTxHash || "";
  }
};

const prefetchTxDetails = async (items) => {
  const queue = [...items];
  const limit = 3;
  let active = 0;
  return new Promise((resolve) => {
    const next = () => {
      if (queue.length === 0 && active === 0) {
        resolve();
        return;
      }
      while (active < limit && queue.length) {
        const item = queue.shift();
        active += 1;
        ensureTxDetails(item)
          .catch(() => null)
          .finally(() => {
            active -= 1;
            next();
          });
      }
    };
    next();
  });
};

const renderTxList = (records) => {
  txListBody.innerHTML = "";
  if (records.length === 0) {
    txListBody.innerHTML = `<div class=\"empty\">${I18N[activeLang].listEmpty}</div>`;
    return;
  }

  records.forEach((item) => {
    const row = document.createElement("div");
    row.className = "list-row";
    row.dataset.rowId = item.id;

    const indexCell = document.createElement("div");
    indexCell.textContent = item.index;

    const idCell = document.createElement("div");
    idCell.textContent = item.txId;
    idCell.className = "tx-id";

    const linkCell = document.createElement("div");
    linkCell.className = "tx-change";
    linkCell.textContent = item.tokenChangeLabel || (item.tokenChangeFetched
      ? I18N[activeLang].listNoTx
      : I18N[activeLang].listTokenLoading);
    linkCell.dataset.tooltip = item.tokenChangeTooltip || "";
    if (!item.tokenChangeLabel) {
      linkCell.style.color = "#9ca3af";
    }

    row.append(indexCell, idCell, linkCell);

    row.addEventListener("click", () => {
      selectRow(item, row);
    });

    txListBody.appendChild(row);
  });
};

const selectRow = (item, row) => {
  const previous = txListBody.querySelector(".list-row.active");
  if (previous) previous.classList.remove("active");
  if (row) row.classList.add("active");
  activeRowId = item.id;
  currentTxLink = item.txUrl || "";
  currentTxHash = item.lendingTxHash || "";
  currentTxChainId = item.lendingChainId || "";
  canCreateTicket = Boolean(currentTxLink);
  createTicketBtn.disabled = !canCreateTicket;

  if (item.txUrl) {
    previewFrame.src = item.txUrl;
    openNewTab.href = item.txUrl;
    emptyPreview.style.display = "none";
  } else {
    previewFrame.removeAttribute("src");
    openNewTab.href = "#";
    emptyPreview.style.display = "block";
  }

  ensureTxDetails(item).catch(() => null);
};

const renderBasicInfo = (basicInfo) => {
  basicInfoGrid.innerHTML = "";
  if (!basicInfo) return;

  currentEvmAddress = basicInfo.evmAddress || "";

  const items = [
    { label: I18N[activeLang].metrics.evmAddress, value: basicInfo.evmAddress },
    { label: I18N[activeLang].metrics.solanaAddress, value: basicInfo.solanaAddress },
    { label: I18N[activeLang].metrics.owner, value: basicInfo.owner },
    { label: I18N[activeLang].metrics.loginType, value: basicInfo.loginType },
    { label: I18N[activeLang].metrics.createdAt, value: formatTime(basicInfo.createdAt) },
  ];

  items.forEach((item) => {
    const card = document.createElement("div");
    card.className = "card";
    card.innerHTML = `<div class="label">${item.label}</div><div class="value">${item.value || "-"}</div>`;
    basicInfoGrid.appendChild(card);
  });
};

const renderTradeAnalysis = (tradeAnalysis) => {
  tradeStats.innerHTML = "";
  if (!tradeAnalysis) return;

  const items = [
    { label: I18N[activeLang].metrics.tradingVolume, value: formatNumber(tradeAnalysis.tradingVolume) },
    { label: I18N[activeLang].metrics.tradingDays, value: formatNumber(tradeAnalysis.tradingDays) },
    { label: I18N[activeLang].metrics.tradingFees, value: formatNumber(tradeAnalysis.tradingFees) },
    { label: I18N[activeLang].metrics.totalTradeCount, value: formatNumber(tradeAnalysis.totalTradeCount) },
    { label: I18N[activeLang].metrics.firstTradeAt, value: formatTime(tradeAnalysis.firstTradeAt) },
    { label: I18N[activeLang].metrics.lastTradeAt, value: formatTime(tradeAnalysis.lastTradeAt) },
    { label: I18N[activeLang].metrics.cashReward, value: formatNumber(tradeAnalysis.cashReward) },
  ];

  items.forEach((item) => {
    const card = document.createElement("div");
    card.className = "metric-card";
    card.innerHTML = `<div class="metric-label">${item.label}</div><div class="metric-value">${item.value}</div>`;
    tradeStats.appendChild(card);
  });
};

const renderRedPacket = (redPacketAnalysis) => {
  redPacketStats.innerHTML = "";
  if (!redPacketAnalysis) return;
  const items = [
    { label: I18N[activeLang].metrics.sendRedPacketCount, value: formatNumber(redPacketAnalysis.sendRedPacketCount) },
    { label: I18N[activeLang].metrics.receiveRedPacketCount, value: formatNumber(redPacketAnalysis.receiveRedPacketCount) },
  ];

  items.forEach((item) => {
    const card = document.createElement("div");
    card.className = "metric-card";
    card.innerHTML = `<div class="metric-label">${item.label}</div><div class="metric-value">${item.value}</div>`;
    redPacketStats.appendChild(card);
  });
};

const renderInvite = (inviteAnalysis) => {
  inviteStats.innerHTML = "";
  inviteChart.innerHTML = "";
  if (!inviteAnalysis || !inviteAnalysis.overview) return;

  const overview = inviteAnalysis.overview;
  const items = [
    { label: I18N[activeLang].metrics.inviteCode, value: overview.inviteCode },
    { label: I18N[activeLang].metrics.totalInviteeCount, value: formatNumber(overview.totalInviteeCount) },
    { label: I18N[activeLang].metrics.validInviteeCount, value: formatNumber(overview.validInviteeCount) },
    { label: I18N[activeLang].metrics.totalInviteRewards, value: formatNumber(overview.totalInviteRewards) },
  ];

  items.forEach((item) => {
    const card = document.createElement("div");
    card.className = "metric-card";
    card.innerHTML = `<div class="metric-label">${item.label}</div><div class="metric-value">${item.value || "-"}</div>`;
    inviteStats.appendChild(card);
  });

  const stats = Array.isArray(inviteAnalysis.last30dStats)
    ? inviteAnalysis.last30dStats
    : [];
  const recent = stats.slice(-15);
  const max = Math.max(1, ...recent.map((item) => item.commission || 0));
  recent.forEach((item, idx) => {
    const bar = document.createElement("div");
    bar.className = "bar";
    if (idx % 2 === 0) bar.classList.add("muted");
    const height = Math.max(4, Math.round((item.commission || 0) / max * 80));
    bar.style.height = `${height}px`;
    bar.title = `${item.date} : ${formatNumber(item.commission)}`;
    inviteChart.appendChild(bar);
  });
};

const applyFilter = () => {
  const keyword = txFilterInput.value.trim().toLowerCase();
  if (!keyword) {
    renderTxList(fullTxs);
    return;
  }
  const filtered = fullTxs.filter((item) => {
    return (
      item.txId.toLowerCase().includes(keyword) ||
      (item.txUrl ? item.txUrl.toLowerCase().includes(keyword) : false) ||
      (item.tokenChangeLabel ? item.tokenChangeLabel.toLowerCase().includes(keyword) : false) ||
      (item.tokenKeywords ? item.tokenKeywords.includes(keyword) : false)
    );
  });
  renderTxList(filtered);
};

const loadData = async () => {
  const url = buildApiUrl();
  if (!url) {
    setStatus(I18N[activeLang].statusMissingQuery, true);
    return;
  }

  loadBtn.disabled = true;
  setStatus(I18N[activeLang].statusLoading);
  createTicketBtn.disabled = true;
  canCreateTicket = false;
  currentTxLink = "";
  currentTxHash = "";
  currentTxChainId = "";

  try {
    const response = await fetch(url, { cache: "no-store" });
    if (!response.ok) {
      throw new Error(`请求失败: ${response.status}`);
    }
    const payload = await response.json();
    lastPayload = payload;
    renderBasicInfo(payload.basicInfo);
    renderTradeAnalysis(payload.tradeAnalysis);
    renderRedPacket(payload.redPacketAnalysis);
    renderInvite(payload.inviteAnalysis);

    const txs = Array.isArray(payload.txs) ? payload.txs : [];
    fullTxs = txs.map(buildTxView);
    renderTxList(fullTxs);
    prefetchTxDetails(fullTxs).catch(() => null);
    txCount.textContent = I18N[activeLang].txCount(fullTxs.length);
    setStatus(I18N[activeLang].statusLoaded(fullTxs.length));
  } catch (error) {
    console.error(error);
    setStatus(I18N[activeLang].statusFailed(error.message), true);
    txListBody.innerHTML = `<div class=\"empty\">${I18N[activeLang].listFetchFail}</div>`;
  } finally {
    loadBtn.disabled = false;
  }
};

loadBtn.addEventListener("click", loadData);
txFilterInput.addEventListener("input", applyFilter);
queryInput.addEventListener("input", updateQueryHint);
langButtons.forEach((btn) => {
  btn.addEventListener("click", () => {
    activeLang = btn.dataset.lang;
    langButtons.forEach((b) => b.classList.toggle("active", b.dataset.lang === activeLang));
    applyLanguage();
    updateQueryHint();
    renderBasicInfo(lastPayload?.basicInfo);
    renderTradeAnalysis(lastPayload?.tradeAnalysis);
    renderRedPacket(lastPayload?.redPacketAnalysis);
    renderInvite(lastPayload?.inviteAnalysis);
    renderTxList(fullTxs);
  });
});

loginBtn.addEventListener("click", () => {
  const user = loginUser.value.trim().toLowerCase();
  const pass = loginPass.value.trim();
  const admin = ADMIN_ACCOUNTS[user];
  if (!admin || admin.password !== pass) {
    loginError.textContent = I18N[activeLang].loginError;
    return;
  }
  loginError.textContent = "";
  setLoggedInState(user);
});

loginPass.addEventListener("keydown", (event) => {
  if (event.key === "Enter") {
    loginBtn.click();
  }
});

logoutBtn.addEventListener("click", () => {
  setLoggedOutState();
});

createTicketBtn.addEventListener("click", () => {
  if (!canCreateTicket) {
    return;
  }
  openTicketModal();
});

ticketCloseBtn.addEventListener("click", closeTicketModal);
ticketModalBackdrop.addEventListener("click", closeTicketModal);

ticketSubmitBtn.addEventListener("click", () => {
  const name = ticketUserName.value.trim();
  const reporter = ticketReporter.value.trim();
  const type = ticketType.value;
  const issue = ticketIssue.value.trim();
  if (!name) {
    ticketUserName.focus();
    return;
  }
  if (!reporter) {
    return;
  }
  if (!issue) {
    ticketIssue.focus();
    return;
  }
  const payload = {
    userName: name,
    reporter,
    evmAddress: ticketEvmAddress.value.trim(),
    txLink: ticketTxLink.value.trim(),
    txHash: currentTxHash,
    chainId: currentTxChainId,
    issue,
  };
  ticketSubmitBtn.disabled = true;
  fetch(FEISHU_API_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  })
    .then(async (res) => {
      if (!res.ok) {
        const text = await res.text();
        throw new Error(text || `HTTP ${res.status}`);
      }
      return res.json();
    })
    .then(() => {
      alert("工单已提交到飞书");
      closeTicketModal();
      ticketUserName.value = "";
      ticketIssue.value = "";
    })
    .catch((err) => {
      console.error(err);
      alert("提交失败，请检查飞书配置或服务端日志");
    })
    .finally(() => {
      ticketSubmitBtn.disabled = false;
    });
});

let lastPayload = null;

window.addEventListener("load", () => {
  updateQueryHint();
  applyLanguage();
  const savedAdmin = localStorage.getItem("adminUser");
  if (savedAdmin && ADMIN_ACCOUNTS[savedAdmin]) {
    setLoggedInState(savedAdmin);
  } else {
    setLoggedOutState();
  }
  loadData();
});
