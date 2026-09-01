// Products, stock, and orders are managed online through Supabase/RLS/RPC.
// Legacy localStorage remains only for non-migrated reviews/widgets and old cleanup helpers.

const state = {
  basePayload: null,
  payload: null,
  selectedProductId: null,
  search: "",
  stockLog: [],
  pendingQrDataUrl: null,
  pendingQrFile: null,
  pendingQrPreviewUrl: null,
  qrCleared: false,
  pendingTrueMoneyQrDataUrl: null,
  pendingTrueMoneyQrFile: null,
  pendingTrueMoneyQrPreviewUrl: null,
  tmQrCleared: false,
  pendingSiteIconDataUrl: null,
  siteIconCleared: false,
  pendingActivityDesktopFile: null,
  pendingActivityDesktopPreviewUrl: null,
  pendingActivityMobileFile: null,
  pendingActivityMobilePreviewUrl: null,
  activityDesktopCleared: false,
  activityMobileCleared: false,
  users: [],
  userSearch: "",
  reviews: [],
  orders: [],
  widgets: [],
  productPackages: {},
  offlineStockItems: {},
  inventorySummaries: {},
  finance: {
    wallets: [],
    pointTransactions: [],
    paymentVerifications: [],
    summary: {}
  },
  financeSearch: "",
  financeOrderSearch: "",
  financeTypeFilter: "all",
  financeOrderPeriod: "all",
  financeActivePage: "wallets",
  financePagination: {
    wallets: { page: 1, pageSize: 20 },
    transactions: { page: 1, pageSize: 20 },
    orders: { page: 1, pageSize: 20 },
    verifications: { page: 1, pageSize: 20 }
  },
  freeRandom: {
    settings: { isActive: true, unlimited: true },
    slots: [],
    claims: []
  },
  discountCodes: [],
  selectedUserId: null,
  selectedReviewId: null,
  selectedOrderId: null,
  selectedWidgetId: null,
  productCategoryFilter: "all",
  stockCategoryFilter: "all",
  stockSearch: "",
  stockStateFilter: "all",
  stockActiveOnly: false
};

let adminSessionUser = null;
let packageDraftCounter = 0;
let iconRefreshQueued = false;
let managedStockDraftAccounts = [];
const packageLoadingProductIds = new Set();
const offlineStockLoadingProductIds = new Set();
const ADMIN_NOTICE_KEY = "olafshop_admin_notice";
const EXTRA_CATALOG_PRODUCT_IDS = [
  "windows-10-home",
  "windows-10-pro",
  "windows-11-home",
  "windows-11-pro",
  "minecraft-microsoft-account",
  "minecraft-java-bedrock-key",
  "rockstar-fivem-account",
  "rockstar-gta-v-download"
];

const emptyPayload = {
  updatedAt: new Date().toISOString(),
  store: {
    name: "OLAF SHOP",
    siteIconUrl: "",
    promptPayId: "",
    paymentEndpoint: "",
    support: {
      line: "",
      facebook: "",
      hours: ""
    },
    payment: {
      promptPayId: "",
      serviceFee: 0,
      paymentEndpoint: "",
      bankName: "",
      bankAccountNumber: "",
      bankAccountName: "",
      walletName: "",
      paymentNote: "",
      manualQrUrl: "",
      manualQrPath: "",
      trueMoneyQrUrl: "",
      trueMoneyQrPath: ""
    },
    activityPopup: {
      enabled: false,
      campaignId: "",
      title: "กิจกรรมพิเศษจาก OLAF SHOP",
      message: "ติดตามกิจกรรมและโปรโมชันล่าสุดของร้าน",
      desktopImageUrl: "",
      desktopImagePath: "",
      mobileImageUrl: "",
      mobileImagePath: "",
      linkUrl: "",
      linkLabel: "ดูรายละเอียดกิจกรรม",
      updatedAt: ""
    }
  },
  categories: [
    { id: "all", label: "ทั้งหมด" },
    { id: "steam-key", label: "คีย์ Steam" },
    { id: "steam-account", label: "ไอดียกเมล" },
    { id: "offline", label: "Steam Offline" },
    { id: "bundle", label: "แพ็กเกม" },
    { id: "windows", label: "คีย์ Windows" },
    { id: "minecraft-account", label: "Minecraft — Microsoft ID" },
    { id: "minecraft-key", label: "Minecraft — Key" },
    { id: "rockstar", label: "Rockstar / FiveM" }
  ],
  products: []
};

const widgetPresets = {
  "steam-showcase": {
    title: "Steam Showcase",
    code: '<div class="olaf-widget" data-olaf-widget="steam-showcase"></div>'
  },
  "trust-cards": {
    title: "Service Glass Cards",
    code: '<div class="olaf-widget" data-olaf-widget="trust-cards"></div>'
  },
  "social-strip": {
    title: "Social Community",
    code: '<div class="olaf-widget" data-olaf-widget="social-strip"></div>'
  },
  "license-cards": {
    title: "Windows License Cards",
    code: '<div class="olaf-widget" data-olaf-widget="license-cards"></div>'
  }
};

const $ = (selector) => document.querySelector(selector);
const $$ = (selector) => [...document.querySelectorAll(selector)];

const formatPrice = (value) =>
  new Intl.NumberFormat("th-TH", {
    style: "currency",
    currency: "THB",
    maximumFractionDigits: 0
  }).format(Number(value) || 0);

const formatPointAmount = (value) =>
  new Intl.NumberFormat("th-TH", {
    maximumFractionDigits: 2
  }).format(Number(value) || 0);

const formatAdminDateTime = (value) => {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleString("th-TH", {
    dateStyle: "medium",
    timeStyle: "short"
  });
};

function animateAdminNumber(selector, targetValue, formatter = (value) => value.toLocaleString("th-TH"), duration = 850) {
  const element = typeof selector === "string" ? $(selector) : selector;
  if (!element) return;
  const target = Number(targetValue || 0);
  const safeTarget = Number.isFinite(target) ? target : 0;
  const formattedFinal = formatter(safeTarget);
  const prefersReducedMotion = window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches;
  if (prefersReducedMotion || duration <= 0) {
    element.textContent = formattedFinal;
    element.dataset.adminCountValue = String(safeTarget);
    return;
  }
  const previousTarget = Number(element.dataset.adminCountValue);
  const start = Number.isFinite(previousTarget) && previousTarget !== safeTarget ? previousTarget : 0;
  const startedAt = performance.now();
  element.dataset.adminCountValue = String(safeTarget);
  element.classList.add("is-counting");

  const tick = (now) => {
    const progress = Math.min(1, (now - startedAt) / duration);
    const eased = 1 - Math.pow(1 - progress, 3);
    const current = start + (safeTarget - start) * eased;
    element.textContent = formatter(current);
    if (progress < 1) {
      requestAnimationFrame(tick);
    } else {
      element.textContent = formattedFinal;
      element.classList.remove("is-counting");
    }
  };
  requestAnimationFrame(tick);
}

function setTextSafe(selector, value) {
  const element = $(selector);
  if (element) element.textContent = value;
}

function ratingValue(value) {
  return Math.max(0, Math.min(5, Number(value) || 0));
}

function ratingStars(value) {
  const rating = ratingValue(value);
  return `${"★".repeat(rating)}${"☆".repeat(5 - rating)}`;
}

function escapeHtml(value = "") {
  return String(value).replace(/[&<>"']/g, (char) => {
    const entities = {
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#039;"
    };
    return entities[char];
  });
}

function adminDeliveryPreviewHtml(order) {
  const raw = String(order?.deliveredPayload || order?.deliveryNote || "").trim();
  const parsed = window.OlafDeliveryPayload?.parse?.(raw);
  if (!parsed?.deliveries?.length || !parsed.accounts?.length) return "";

  return parsed.deliveries.map((delivery, deliveryIndex) => `
    <section class="admin-delivery-set">
      ${parsed.deliveries.length > 1 ? `<h4>ชุดที่ ${deliveryIndex + 1}</h4>` : ""}
      ${delivery.accounts.map((account, accountIndex) => `
        <article class="admin-account-card admin-account-${escapeHtml(String(account.platform || "").toLowerCase())}">
          <h5>${escapeHtml(account.platform || "ACCOUNT")}</h5>
          ${["login", "id", "password"].map((field) => {
            const value = String(account[field] || "").trim();
            if (!value) return "";
            const label = field === "login" ? "Login" : field === "id" ? "ID" : "Password";
            return `
              <div class="admin-account-field">
                <span>${label}</span>
                <code>${escapeHtml(value)}</code>
                <button class="mini-button" type="button" data-admin-copy-delivery="${deliveryIndex}" data-admin-copy-account="${accountIndex}" data-admin-copy-field="${field}" aria-label="คัดลอก ${escapeHtml(account.platform || "บัญชี")} ${label}">
                  <i data-lucide="copy"></i>
                </button>
              </div>
            `;
          }).join("")}
        </article>
      `).join("")}
    </section>
  `).join("");
}

function renderAdminDeliveryPreview(order) {
  const preview = $("#admin-delivery-preview");
  if (!preview) return;
  const html = adminDeliveryPreviewHtml(order);
  preview.innerHTML = html;
  preview.hidden = !html;
}

async function copyAdminText(value) {
  const text = String(value || "").trim();
  if (!text) throw new Error("ไม่พบข้อมูลที่ต้องการคัดลอก");
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(text);
    return;
  }
  const textarea = document.createElement("textarea");
  textarea.value = text;
  textarea.setAttribute("readonly", "");
  textarea.style.position = "fixed";
  textarea.style.opacity = "0";
  document.body.appendChild(textarea);
  textarea.select();
  document.execCommand("copy");
  textarea.remove();
}

function fastImg(src, alt = "", options = {}) {
  if (window.OlafImages?.attrs) return window.OlafImages.attrs(src, alt, options);
  const loading = options.priority ? "eager" : "lazy";
  const fetchPriority = options.priority ? "high" : "low";
  const className = options.className ? ` class="${escapeHtml(options.className)}"` : "";
  return `${className} src="${escapeHtml(src || "")}" alt="${escapeHtml(alt)}" loading="${loading}" decoding="async" fetchpriority="${fetchPriority}"`;
}

function createIconSet() {
  if (iconRefreshQueued) return;
  iconRefreshQueued = true;
  window.requestAnimationFrame(() => {
    iconRefreshQueued = false;
    if (window.OlafIcons?.refresh) {
      window.OlafIcons.refresh();
      return;
    }
    window.lucide?.createIcons?.();
  });
}

function revokePreviewUrl(url) {
  if (url && String(url).startsWith("blob:")) {
    URL.revokeObjectURL(url);
  }
}

function isInlinePreviewUrl(url) {
  const value = String(url || "");
  return value.startsWith("blob:") || value.startsWith("data:");
}

function setPendingQrPreview(kind, file) {
  if (kind === "wallet") {
    revokePreviewUrl(state.pendingTrueMoneyQrPreviewUrl);
    state.pendingTrueMoneyQrFile = file || null;
    state.pendingTrueMoneyQrPreviewUrl = file ? URL.createObjectURL(file) : null;
    state.pendingTrueMoneyQrDataUrl = state.pendingTrueMoneyQrPreviewUrl || null;
    state.tmQrCleared = false;
    return state.pendingTrueMoneyQrPreviewUrl;
  }

  revokePreviewUrl(state.pendingQrPreviewUrl);
  state.pendingQrFile = file || null;
  state.pendingQrPreviewUrl = file ? URL.createObjectURL(file) : null;
  state.pendingQrDataUrl = state.pendingQrPreviewUrl || null;
  state.qrCleared = false;
  return state.pendingQrPreviewUrl;
}

function setPendingActivityPreview(kind, file) {
  const isMobile = kind === "mobile";
  const previewKey = isMobile ? "pendingActivityMobilePreviewUrl" : "pendingActivityDesktopPreviewUrl";
  const fileKey = isMobile ? "pendingActivityMobileFile" : "pendingActivityDesktopFile";
  revokePreviewUrl(state[previewKey]);
  state[fileKey] = file || null;
  state[previewKey] = file ? URL.createObjectURL(file) : null;
  if (isMobile) state.activityMobileCleared = false;
  else state.activityDesktopCleared = false;
  return state[previewKey];
}

function applySiteIcon(iconUrl) {
  const url = String(iconUrl || "").trim();
  if (!url) {
    document.querySelector("#dynamic-favicon")?.remove();
    return;
  }
  let link = document.querySelector("#dynamic-favicon");
  if (!link) {
    link = document.createElement("link");
    link.id = "dynamic-favicon";
    link.rel = "icon";
    document.head.append(link);
  }
  link.href = url;
}

function applyAdminBrandIcon(iconUrl) {
  const url = String(iconUrl || "").trim();
  document.querySelectorAll(".admin-brand-mark, .admin-brand span").forEach((mark) => {
    mark.innerHTML = url ? `<img ${fastImg(url, "OLAF SHOP", { priority: true })} />` : "O";
  });
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function compactLines(value) {
  const source = Array.isArray(value) ? value.join("\n") : value;
  return String(source || "")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
}

function uniqueList(values) {
  return [...new Set(values.map((value) => String(value || "").trim()).filter(Boolean))];
}

function normalizeGallery(product) {
  return uniqueList([
    ...(Array.isArray(product.gallery) ? product.gallery : []),
    product.heroImage,
    product.image
  ]).slice(0, 6);
}

function normalizePlatformLinks(product) {
  const rows = Array.isArray(product.platformLinks) ? product.platformLinks : [];
  return rows
    .map((link) => {
      if (typeof link === "string") {
        const [label = "", url = "", icon = "external-link"] = link.split("|").map((part) => part.trim());
        return { label, url, icon: icon || "external-link" };
      }
      return {
        label: String(link?.label || "").trim(),
        url: String(link?.url || "").trim(),
        icon: String(link?.icon || "external-link").trim() || "external-link"
      };
    })
    .filter((link) => link.label && link.url);
}

function normalizeFeatureBlocks(product) {
  const rows = Array.isArray(product.featureBlocks) ? product.featureBlocks : [];
  return rows
    .map((feature) => {
      if (typeof feature === "string") {
        const [icon = "sparkles", title = "", text = ""] = feature.split("|").map((part) => part.trim());
        return { icon: icon || "sparkles", title, text };
      }
      return {
        icon: String(feature?.icon || "sparkles").trim() || "sparkles",
        title: String(feature?.title || "").trim(),
        text: String(feature?.text || "").trim()
      };
    })
    .filter((feature) => feature.title || feature.text);
}

function normalizeDetailSections(product) {
  const rows = Array.isArray(product.detailSections) ? product.detailSections : [];
  return rows
    .map((section) => {
      if (typeof section === "string") {
        const [title = "", ...bodyParts] = section.split("|").map((part) => part.trim());
        return { title, body: bodyParts.join(" | ") };
      }
      return {
        title: String(section?.title || "").trim(),
        body: String(section?.body || "").trim()
      };
    })
    .filter((section) => section.title || section.body);
}

function normalizeSystemRequirements(product) {
  const req = product.systemRequirements;
  if (Array.isArray(req)) {
    return { minimum: compactLines(req), recommended: [] };
  }
  return {
    minimum: compactLines(req?.minimum || []),
    recommended: compactLines(req?.recommended || [])
  };
}

function parsePipeRows(value, fields, defaults = {}) {
  return compactLines(value)
    .map((line) => {
      const parts = line.split("|").map((part) => part.trim());
      return fields.reduce(
        (item, field, index) => ({
          ...item,
          [field]:
            index === fields.length - 1
              ? parts.slice(index).join(" | ") || defaults[field] || ""
              : parts[index] || defaults[field] || ""
        }),
        {}
      );
    })
    .filter((item) => Object.values(item).some(Boolean));
}

function serializePipeRows(rows, fields) {
  return (rows || [])
    .map((row) => fields.map((field) => row?.[field] || "").join("|"))
    .filter((line) => line.replace(/\|/g, "").trim())
    .join("\n");
}

function normalizeBadgeOverrides(value) {
  return (Array.isArray(value) ? value : [])
    .map((badge) => ({
      label: String(badge?.label || "").trim(),
      tone: String(badge?.tone || "auto").trim() || "auto"
    }))
    .filter((badge) => badge.label)
    .slice(0, 2);
}

function badgeToneOptions(selected = "auto") {
  const tones = [
    ["auto", "Auto / ตามหมวด"],
    ["steam", "Steam Blue"],
    ["blue", "Blue"],
    ["purple", "Purple"],
    ["gold", "Gold"],
    ["orange", "Orange"],
    ["green", "Green"],
    ["red", "Red"],
    ["gray", "Gray"]
  ];
  return tones
    .map(([value, label]) => `<option value="${escapeHtml(value)}" ${value === selected ? "selected" : ""}>${escapeHtml(label)}</option>`)
    .join("");
}

function normalizePayload(payload) {
  const source = payload && typeof payload === "object" ? payload : emptyPayload;
  const store = source.store ?? {};
  const payment = store.payment ?? {};
  return {
    updatedAt: source.updatedAt || new Date().toISOString(),
    store: {
      ...emptyPayload.store,
      ...store,
      support: {
        ...emptyPayload.store.support,
        ...(store.support ?? {})
      },
      payment: {
        ...emptyPayload.store.payment,
        promptPayId: payment.promptPayId ?? store.promptPayId ?? "",
        paymentEndpoint: payment.paymentEndpoint ?? store.paymentEndpoint ?? "",
        ...payment,
        serviceFee: Number(payment.serviceFee ?? store.serviceFee ?? 0) || 0
      }
    },
    categories: Array.isArray(source.categories) ? source.categories : clone(emptyPayload.categories),
    products: Array.isArray(source.products)
      ? source.products.map((product) => ({
          id: String(product.id || slugify(product.name || "product")),
          name: product.name || "Untitled Product",
          publisher: product.publisher || "",
          category: product.category || "steam-key",
          label: product.label || "",
          price: Number(product.price) || 0,
          compareAt: Number(product.compareAt) || 0,
          stock: Number(product.stock) || 0,
          sold: Number(product.sold) || 0,
          rating: product.rating || "",
          delivery: product.delivery || "",
          warranty: product.warranty || "",
          image: product.image || "",
          heroImage: product.heroImage || product.image || "",
          tags: Array.isArray(product.tags) ? product.tags : [],
          description: product.description || "",
          gallery: normalizeGallery(product),
          platformLinks: normalizePlatformLinks(product),
          featureBlocks: normalizeFeatureBlocks(product),
          detailSections: normalizeDetailSections(product),
          steamRelatedLinks: Array.isArray(product.steamRelatedLinks) ? product.steamRelatedLinks : [],
          systemRequirements: normalizeSystemRequirements(product),
          steamAppId: product.steamAppId ?? null,
          sourceMetadata: product.sourceMetadata && typeof product.sourceMetadata === "object" ? product.sourceMetadata : {},
          badgeOverrides: normalizeBadgeOverrides(product.badgeOverrides),
          isActive: product.isActive !== false,
          sortOrder: Number(product.sortOrder || 0)
        }))
      : []
  };
}

function slugify(value) {
  const slug = String(value)
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return slug || `product-${Date.now()}`;
}

function setStatus(message) {
  $("#save-state").textContent = message;
}

function currentAdmin() {
  return adminSessionUser;
}

function adminRelativePath() {
  const fileName = window.location.pathname.split("/").pop() || "olaf-control.html";
  return `${fileName}${window.location.search}${window.location.hash}`;
}

function redirectToAdminLogin() {
  const loginUrl = new URL("login.html", window.location.href);
  loginUrl.searchParams.set("return", adminRelativePath());
  window.location.replace(loginUrl.toString());
}

function redirectToStoreWithNotice(message) {
  try {
    window.sessionStorage.setItem(ADMIN_NOTICE_KEY, message);
  } catch (error) {
    console.warn("Unable to store admin redirect notice", error);
  }
  window.location.replace(new URL("index.html", window.location.href).toString());
}

function adminDeniedMessage(reason) {
  if (reason === "NO_SESSION") return "กรุณาเข้าสู่ระบบด้วยบัญชีแอดมิน";
  if (reason === "PROFILE_MISSING") return "ไม่พบโปรไฟล์ที่ตรงกับบัญชี Auth นี้ กรุณารัน SQL ซ่อมสิทธิ์แอดมิน";
  if (reason === "ADMIN_INACTIVE") return "บัญชีแอดมินนี้ไม่ได้อยู่ในสถานะ active";
  if (reason === "NOT_ADMIN") return "บัญชีนี้ยังไม่ได้กำหนด role เป็น admin";
  if (reason === "ROLE_LOAD_FAILED") return "ไม่สามารถตรวจสอบสิทธิ์แอดมินได้ กรุณาลองเข้าสู่ระบบใหม่";
  if (reason === "INVALID_SESSION") return "Session หมดอายุ กรุณาเข้าสู่ระบบใหม่";
  return "บัญชีนี้ไม่มีสิทธิ์เข้าถึงระบบหลังบ้าน";
}

function showAdminShell() {
  $("#admin-login-screen").hidden = true;
  $("#admin-shell").hidden = false;
  document.body.dataset.adminPanel = "dashboard";
}

function showAdminLogin(message = "") {
  $("#admin-shell").hidden = true;
  $("#admin-login-screen").hidden = false;
  $("#admin-login-message").textContent = message;
}

function requireSupabaseAdminClient() {
  if (!window.olafSupabase) {
    throw new Error("ยังไม่ได้ตั้งค่า Supabase สำหรับระบบหลังบ้าน");
  }
  return window.olafSupabase;
}

async function checkAdminAccess(options = {}) {
  const client = requireSupabaseAdminClient();
  let access = null;

  if (window.OlafSupabaseAuth?.getAdminAccess) {
    access = await window.OlafSupabaseAuth.getAdminAccess();
  } else {
    const { data: userData, error: userError } = await client.auth.getUser();
    if (userError || !userData?.user) {
      access = { isAdmin: false, reason: "NO_SESSION", authUser: null };
    } else {
      let profile = null;
      let profileError = null;
      try {
        const profileResult = await client
          .from("profiles")
          .select("role, status")
          .eq("id", userData.user.id)
          .maybeSingle();
        profile = profileResult.data || null;
        profileError = profileResult.error || null;
      } catch (error) {
        profileError = error;
      }

        const role = String(profile?.role || "").toLowerCase();
        const status = String(profile?.status || "active").toLowerCase();
        const isProfileAdmin = role === "admin" && status === "active";
        let rpcAllowsAdmin = false;
        let rpcError = null;
        try {
          const { data, error } = await client.rpc("is_admin");
          if (error) throw error;
          rpcAllowsAdmin = data === true;
        } catch (error) {
          rpcError = error;
        }

        const isAdmin = isProfileAdmin || rpcAllowsAdmin;
        access = {
          isAdmin,
          reason: isAdmin
            ? (rpcAllowsAdmin ? "ADMIN" : "ADMIN_PROFILE_FALLBACK")
            : (profileError || rpcError ? "ROLE_LOAD_FAILED" : "NOT_ADMIN"),
          authUser: userData.user,
          profile,
          role,
          status,
          error: profileError || rpcError
        };
    }
  }

  checkAdminAccess.lastAccess = access;

  if (access?.isAdmin) {
    adminSessionUser = access.authUser || access.user;
    return adminSessionUser;
  }

  adminSessionUser = null;
  if (options.redirect) {
    if (access?.reason === "NO_SESSION" || access?.reason === "INVALID_SESSION") {
      redirectToAdminLogin();
    } else {
      redirectToStoreWithNotice(adminDeniedMessage(access?.reason));
    }
  }
  return null;
}

function adminAuthErrorMessage(error) {
  const message = String(error?.message || "");
  if (message.toLowerCase().includes("invalid login")) return "อีเมลหรือรหัสผ่านไม่ถูกต้อง";
  if (message.includes("is_admin")) return "ยังไม่ได้ติดตั้งฟังก์ชัน is_admin ใน Supabase";
  return message || "เข้าสู่ระบบหลังบ้านไม่สำเร็จ";
}

async function handleAdminLogin(event) {
  event.preventDefault();
  const form = event.currentTarget;
  const submitButton = form.querySelector("button[type='submit']");
  const originalText = submitButton.innerHTML;
  submitButton.disabled = true;
  submitButton.innerHTML = '<i data-lucide="loader-circle"></i> กำลังตรวจสิทธิ์';
  createIconSet();
  showAdminLogin("กำลังเข้าสู่ระบบและตรวจสิทธิ์แอดมิน...");

  try {
    const client = requireSupabaseAdminClient();
    const email = String(form.elements.email.value || "").trim().toLowerCase();
    const password = String(form.elements.password.value || "");
    const { error } = await client.auth.signInWithPassword({ email, password });
    if (error) throw error;

    const admin = await checkAdminAccess();
    if (!admin) {
      const reason = checkAdminAccess.lastAccess?.reason || "NOT_ADMIN";
      await client.auth.signOut().catch(() => {});
      showAdminLogin(adminDeniedMessage(reason));
      return;
    }

    showAdminShell();
    try {
      await loadData();
      showAdminToast("เข้าสู่ระบบหลังบ้านสำเร็จ", "success");
    } catch (loadError) {
      console.error("Admin authenticated but dashboard data failed to load", loadError);
      setStatus("เข้าสู่ระบบแล้ว แต่โหลดข้อมูลหลังบ้านไม่สำเร็จ");
      showAdminToast(
        `เข้าสู่ระบบสำเร็จ แต่โหลดข้อมูลไม่สำเร็จ: ${adminDataErrorMessage(loadError)}`,
        "error",
        8000
      );
    }
  } catch (error) {
    showAdminLogin(adminAuthErrorMessage(error));
  } finally {
    submitButton.disabled = false;
    submitButton.innerHTML = originalText;
    createIconSet();
  }
}

function savePayload(message = "บันทึกแล้ว") {
  state.payload.updatedAt = new Date().toISOString();
  setStatus(`${message} ${new Date().toLocaleTimeString("th-TH", { hour: "2-digit", minute: "2-digit" })}`);
}

async function fetchAdminProductsFromSupabase() {
  const { data, error } = await requireSupabaseAdminClient()
    .from("products")
    .select("*")
    .order("sort_order", { ascending: true });
  if (error) throw error;
  return (Array.isArray(data) ? data : []).map(mapSupabaseProductRow).filter(Boolean);
}

async function fetchAdminJsonProductsFallback() {
  try {
    const response = await fetch("api/products.json?v=20260711-admin-fallback", { cache: "default" });
    if (!response.ok) return [];
    const payload = await response.json();
    return Array.isArray(payload?.products) ? payload.products : Array.isArray(payload) ? payload : [];
  } catch (error) {
    console.warn("Admin JSON products fallback unavailable", error);
    return [];
  }
}

function mergeAdminProducts(jsonProducts = [], supabaseProducts = []) {
  const onlineProducts = Array.isArray(supabaseProducts) ? supabaseProducts.filter(Boolean) : [];
  const fallbackProducts = Array.isArray(jsonProducts) ? jsonProducts.filter(Boolean) : [];
  const products = onlineProducts.length ? onlineProducts : fallbackProducts;
  return products.filter((product) => product?.id).sort((a, b) => {
    const sortA = Number(a.sortOrder ?? a.sort_order ?? 0);
    const sortB = Number(b.sortOrder ?? b.sort_order ?? 0);
    if (sortA !== sortB) return sortA - sortB;
    return String(a.name || "").localeCompare(String(b.name || ""), "th");
  });
}

async function fetchAdminUsersFromSupabase() {
  if (!window.OlafAdminUsers?.fetchAdminUsers) {
    throw new Error("Supabase admin user API is not ready");
  }
  return window.OlafAdminUsers.fetchAdminUsers();
}

async function fetchAdminFinanceFromSupabase() {
  if (!window.OlafAdminFinance?.fetchAdminFinanceOverview) {
    return {
      wallets: [],
      pointTransactions: [],
      paymentVerifications: [],
      summary: {}
    };
  }
  return window.OlafAdminFinance.fetchAdminFinanceOverview();
}

async function fetchAdminFreeRandomFromSupabase() {
  if (!window.OlafFreeRandom?.adminFetchSettings) {
    return {
      settings: { isActive: true, unlimited: true },
      slots: [],
      milestones: [],
      claims: []
    };
  }
  const [config, milestones, claims] = await Promise.all([
    window.OlafFreeRandom.adminFetchSettings(),
    window.OlafFreeRandom.adminFetchMilestones ? window.OlafFreeRandom.adminFetchMilestones().catch(() => []) : Promise.resolve([]),
    window.OlafFreeRandom.adminFetchClaims ? window.OlafFreeRandom.adminFetchClaims(100).catch(() => []) : Promise.resolve([])
  ]);
  return {
    settings: config.settings || { isActive: true, unlimited: true },
    slots: Array.isArray(config.slots) ? config.slots : [],
    milestones: Array.isArray(milestones) && milestones.length ? milestones : (Array.isArray(config.milestones) ? config.milestones : []),
    claims: Array.isArray(claims) ? claims : []
  };
}

function normalizeFinanceOverview(overview = {}) {
  return {
    wallets: Array.isArray(overview.wallets) ? overview.wallets : [],
    pointTransactions: Array.isArray(overview.pointTransactions) ? overview.pointTransactions : [],
    paymentVerifications: Array.isArray(overview.paymentVerifications) ? overview.paymentVerifications : [],
    summary: overview.summary && typeof overview.summary === "object" ? overview.summary : {}
  };
}

function mapSupabaseProductRow(row) {
  const product = window.OlafProducts?.mapProductRow
    ? window.OlafProducts.mapProductRow(row)
    : {
        id: row.id,
        name: row.name,
        publisher: row.publisher || "",
        category: row.category || "steam-key",
        label: row.label || "",
        price: Number(row.price || 0),
        compareAt: row.compare_at == null ? null : Number(row.compare_at),
        stock: Number(row.stock || 0),
        sold: Number(row.sold || 0),
        rating: row.rating || "",
        delivery: row.delivery || "",
        warranty: row.warranty || "",
        image: row.image_url || "",
        heroImage: row.hero_image_url || row.image_url || "",
        tags: Array.isArray(row.tags) ? row.tags : [],
        description: row.description || "",
        gallery: Array.isArray(row.gallery) ? row.gallery : [],
        platformLinks: Array.isArray(row.platform_links) ? row.platform_links : [],
        featureBlocks: Array.isArray(row.feature_blocks) ? row.feature_blocks : [],
        detailSections: Array.isArray(row.detail_sections) ? row.detail_sections : [],
        steamRelatedLinks: Array.isArray(row.steam_related_links) ? row.steam_related_links : [],
        systemRequirements: row.system_requirements || { minimum: [], recommended: [] },
        steamAppId: row.steam_app_id == null ? null : Number(row.steam_app_id),
        sourceMetadata: row.source_metadata && typeof row.source_metadata === "object" ? row.source_metadata : {},
        badgeOverrides: normalizeBadgeOverrides(row.badge_overrides),
        isActive: row.is_active !== false,
        sortOrder: Number(row.sort_order || 0)
      };
  if (!product) return null;
  return {
    ...product,
    createdAt: row.created_at || product.createdAt || "",
    updatedAt: row.updated_at || product.updatedAt || ""
  };
}

function categoriesForAdminProducts(adminProducts) {
  const categories = [];
  const existing = new Set();
  emptyPayload.categories.forEach((category) => {
    if (!category?.id || existing.has(category.id)) return;
    existing.add(category.id);
    categories.push(category);
  });
  adminProducts.forEach((product) => {
    if (product.category && !existing.has(product.category)) {
      existing.add(product.category);
      categories.push({ id: product.category, label: product.category });
    }
  });
  return categories;
}

function mergeStoreSettings(baseStore = {}, onlineSettings = {}) {
  const settings = onlineSettings && typeof onlineSettings === "object" ? { ...onlineSettings } : {};
  delete settings.updatedAt;
  return {
    ...(baseStore ?? {}),
    ...settings,
    support: {
      ...(baseStore?.support ?? {}),
      ...(settings.support ?? {})
    },
    payment: {
      ...(baseStore?.payment ?? {}),
      ...(settings.payment ?? {})
    }
  };
}

async function fetchOnlineStoreSettings(quiet = false) {
  if (!window.OlafStoreSettings?.fetchStoreSettings) return {};
  try {
    return await window.OlafStoreSettings.fetchStoreSettings({ forceRefresh: true });
  } catch (error) {
    if (!quiet) console.warn("Store settings unavailable", error);
    return {};
  }
}

async function saveOnlineStoreSettings(storeSettings) {
  if (!window.OlafStoreSettings?.saveStoreSettings) {
    throw new Error("Store settings client is not ready");
  }
  return window.OlafStoreSettings.saveStoreSettings(storeSettings);
}

async function loadData() {
  setStatus("กำลังโหลดข้อมูล");
  const [jsonProducts, supabaseProducts] = await Promise.all([
    fetchAdminJsonProductsFallback(),
    fetchAdminProductsFromSupabase()
  ]);
  const adminProducts = mergeAdminProducts(jsonProducts, supabaseProducts);
  const adminUsers = await fetchAdminUsersFromSupabase().catch((error) => {
    console.warn("Admin users unavailable while loading admin data", {
      code: error?.code,
      message: error?.message
    });
    return [];
  });
  const storeSettings = await fetchOnlineStoreSettings(true);
  state.basePayload = normalizePayload(emptyPayload);
  state.payload = normalizePayload({
    ...state.basePayload,
    store: mergeStoreSettings(state.basePayload.store, storeSettings),
    categories: categoriesForAdminProducts(adminProducts),
    products: adminProducts
  });
  state.users = adminUsers;
  state.reviews = window.OlafStore?.getReviews() ?? [];
  state.widgets = window.OlafStore?.getWidgets() ?? [];
  const [adminOrders, inventorySummaries, financeOverview, freeRandomOverview, discountCodes] = await Promise.all([
    window.OlafOrders.fetchAdminOrders().catch((error) => {
      console.warn("Admin orders unavailable while loading products", {
        code: error?.code,
        message: error?.message
      });
      return [];
    }),
    window.OlafProducts?.adminFetchInventorySummary
      ? window.OlafProducts.adminFetchInventorySummary().catch((error) => {
          console.warn("Admin inventory summary unavailable", {
            code: error?.code,
            message: error?.message
          });
          return [];
        })
      : Promise.resolve([]),
    fetchAdminFinanceFromSupabase().catch((error) => {
      console.warn("Admin finance overview unavailable", {
        code: error?.code,
        message: error?.message
      });
      return {
        wallets: [],
        pointTransactions: [],
        paymentVerifications: [],
        summary: {}
      };
    }),
    fetchAdminFreeRandomFromSupabase().catch((error) => {
      console.warn("Premium spin settings unavailable", {
        code: error?.code,
        message: error?.message
      });
      return {
        settings: { isActive: true, unlimited: true },
        slots: [],
        claims: []
      };
    }),
    window.OlafCoupons?.fetchAdmin
      ? window.OlafCoupons.fetchAdmin().catch((error) => {
          console.warn("Discount codes unavailable", { code: error?.code, message: error?.message });
          return [];
        })
      : Promise.resolve([])
  ]);
  state.orders = adminOrders;
  state.finance = normalizeFinanceOverview(financeOverview);
  state.freeRandom = freeRandomOverview;
  state.discountCodes = Array.isArray(discountCodes) ? discountCodes : [];
  setInventorySummaries(inventorySummaries);
  const productNames = new Map(state.payload.products.map((product) => [product.id, product.name]));
  state.stockLog = (await window.OlafOrders.fetchStockMovements().catch(() => [])).map((movement) => ({
    id: movement.id,
    name: productNames.get(movement.productId) || movement.productId || "ไม่พบสินค้า",
    action: movement.note || movement.movementType || "ปรับสต็อก",
    delta: movement.quantityChange,
    previous: "",
    next: "",
    createdAt: movement.createdAt
  }));
  state.selectedProductId = state.payload.products[0]?.id ?? null;
  state.selectedUserId = state.users[0]?.id ?? null;
  state.selectedReviewId = state.reviews[0]?.id ?? null;
  state.selectedOrderId = state.orders[0]?.id ?? null;
  state.selectedWidgetId = state.widgets[0]?.id ?? null;
  revokePreviewUrl(state.pendingQrPreviewUrl);
  revokePreviewUrl(state.pendingTrueMoneyQrPreviewUrl);
  state.pendingQrDataUrl = null;
  state.pendingQrFile = null;
  state.pendingQrPreviewUrl = null;
  state.qrCleared = false;
  state.pendingTrueMoneyQrDataUrl = null;
  state.pendingTrueMoneyQrFile = null;
  state.pendingTrueMoneyQrPreviewUrl = null;
  state.tmQrCleared = false;
  state.pendingSiteIconDataUrl = null;
  state.siteIconCleared = false;
  const renderErrors = renderAll();
  const missingExtraProducts = EXTRA_CATALOG_PRODUCT_IDS.filter(
    (productId) => !state.payload.products.some((product) => product.id === productId)
  );
  if (renderErrors.length) {
    const names = renderErrors.map((item) => item.name).join(", ");
    setStatus(`โหลดข้อมูลสินค้าแล้ว แต่บางส่วนแสดงผลไม่สำเร็จ: ${names}`);
    showAdminToast(`ข้อมูลสินค้าพร้อมแก้ไข แต่บางส่วนของ Dashboard มีปัญหา: ${names}`, "warning", 7000);
  } else if (missingExtraProducts.length) {
    setStatus("โหลดข้อมูลแล้ว แต่สินค้าเพิ่มเติมยังไม่ครบใน Supabase");
    showAdminToast(
      `ไม่พบสินค้าเพิ่มเติม ${missingExtraProducts.length} รายการ กรุณารัน supabase-extra-products.sql`,
      "warning",
      8000
    );
  } else {
    setStatus("เชื่อมต่อ Supabase หลังบ้านแล้ว");
  }
}

function adminDataErrorMessage(error) {
  const code = String(error?.code || "").trim();
  const message = String(error?.message || error || "").trim();
  if (code === "42501" || /permission denied|row-level security/i.test(message)) {
    return "สิทธิ์ RLS ของข้อมูลหลังบ้านยังไม่ครบ กรุณารัน supabase-fix-admin-access.sql เวอร์ชันล่าสุด";
  }
  if (/failed to fetch|network/i.test(message)) {
    return "เชื่อมต่อ Supabase ไม่สำเร็จ กรุณาตรวจอินเทอร์เน็ตแล้วกดโหลดข้อมูลใหม่";
  }
  return [code, message].filter(Boolean).join(" - ") || "ไม่ทราบสาเหตุ";
}

function products() {
  return state.payload.products;
}

function freeRandomSlots() {
  const existing = new Map((state.freeRandom?.slots || []).map((slot) => [Number(slot.slotNumber), slot]));
  return Array.from({ length: 10 }, (_, index) => {
    const slotNumber = index + 1;
    return {
      slotNumber,
      prizeType: "product",
      pointAmount: 0,
      productId: "",
      chancePercent: 0,
      isActive: false,
      label: "",
      imageUrl: "",
      productName: "",
      stock: 0,
      productIsActive: false,
      ...(existing.get(slotNumber) || {})
    };
  });
}

function freeRandomMilestones() {
  const defaults = [50, 100, 150, 200];
  const existing = new Map((state.freeRandom?.milestones || []).map((item) => [Number(item.threshold), item]));
  return defaults.map((threshold) => ({
    threshold,
    productId: "",
    isActive: false,
    label: "",
    imageUrl: "",
    productName: "",
    stock: 0,
    productIsActive: false,
    ...(existing.get(threshold) || {})
  }));
}

function freeRandomProductOptions(selectedId = "") {
  const selected = String(selectedId || "");
  const sorted = [...products()].sort((a, b) => {
    const categoryCompare = String(a.category || "").localeCompare(String(b.category || ""), "th");
    if (categoryCompare) return categoryCompare;
    return String(a.name || "").localeCompare(String(b.name || ""), "th");
  });
  return [
    `<option value="">-- เลือกสินค้า --</option>`,
    ...sorted.map((product) => {
      const label = `${product.name} · ${product.category || "all"} · stock ${Number(product.stock || 0)}`;
      return `<option value="${escapeHtml(product.id)}"${product.id === selected ? " selected" : ""}>${escapeHtml(label)}</option>`;
    })
  ].join("");
}

function renderFreeRandomPanel() {
  const form = $("#free-random-form");
  const grid = $("#free-random-slot-grid");
  const milestoneGrid = $("#free-random-milestone-grid");
  const summary = $("#free-random-admin-summary");
  const table = $("#free-random-history-table");
  if (!form || !grid || !summary || !table) return;

  const settings = state.freeRandom?.settings || { isActive: true, unlimited: true };
  if (form.elements.isActive) form.elements.isActive.value = settings.isActive === false ? "false" : "true";

  const slots = freeRandomSlots();
  const totalChance = slots.reduce((sum, slot) => sum + Number(slot.chancePercent || 0), 0);
  const activeSlots = slots.filter((slot) => slot.isActive).length;
  const readySlots = slots.filter((slot) => {
    if (!slot.isActive) return false;
    if ((slot.prizeType || "product") === "empty") return true;
    if (slot.prizeType === "points") return Number(slot.pointAmount || 0) > 0;
    return slot.productId && slot.productIsActive !== false && Number(slot.stock || 0) > 0;
  }).length;
  summary.innerHTML = `
    <div class="free-random-admin-stat">
      <span>ช่องที่เปิด</span>
      <strong>${activeSlots}/10</strong>
    </div>
    <div class="free-random-admin-stat">
      <span>พร้อมสุ่ม</span>
      <strong>${readySlots}</strong>
    </div>
    <div class="free-random-admin-stat ${Math.abs(totalChance - 100) <= 0.01 ? "ok" : "warn"}">
      <span>รวมเปอร์เซ็นต์</span>
      <strong>${totalChance.toLocaleString("th-TH", { maximumFractionDigits: 2 })}%</strong>
    </div>
    <p>ระบบจะ normalize น้ำหนักให้อัตโนมัติ แม้รวมไม่ครบ 100% แต่แนะนำให้ตั้งรวม 100 เพื่ออ่านง่าย</p>
  `;

  if (milestoneGrid) {
    const milestones = freeRandomMilestones();
    milestoneGrid.innerHTML = milestones.map((milestone) => {
      const product = products().find((item) => item.id === milestone.productId);
      const stock = Number(product?.stock ?? milestone.stock ?? 0);
      const ready = Boolean(milestone.isActive && milestone.productId && product?.isActive !== false && stock > 0);
      return `
        <article class="free-random-slot-card free-random-milestone-admin-card" data-free-random-milestone="${milestone.threshold}">
          <div class="free-random-slot-head">
            <strong>ครบ ${Number(milestone.threshold).toLocaleString("th-TH")} ครั้ง</strong>
            <span class="status-pill ${ready ? "ok" : milestone.isActive ? "warn" : ""}">${ready ? "พร้อมแจก" : milestone.isActive ? "เช็กสินค้า" : "ปิด"}</span>
          </div>
          <label>
            เกมฟรีที่จะรับ
            <select name="productId">${freeRandomProductOptions(milestone.productId)}</select>
          </label>
          <div class="form-row">
            <label>
              สถานะ
              <select name="isActive">
                <option value="true"${milestone.isActive ? " selected" : ""}>เปิด</option>
                <option value="false"${!milestone.isActive ? " selected" : ""}>ปิด</option>
              </select>
            </label>
            <label>
              ชื่อแสดงผล
              <input name="label" type="text" value="${escapeHtml(milestone.label || "")}" placeholder="เว้นว่าง = ใช้ชื่อสินค้า" />
            </label>
          </div>
          <label>
            รูปเฉพาะโบนัส (ไม่บังคับ)
            <input name="imageUrl" type="url" value="${escapeHtml(milestone.imageUrl || "")}" placeholder="https://..." />
          </label>
          <small>สินค้า: ${escapeHtml(product?.name || milestone.productName || "ยังไม่เลือก")} · Stock ${stock.toLocaleString("th-TH")}</small>
        </article>
      `;
    }).join("");
  }

  grid.innerHTML = slots.map((slot) => {
    const product = products().find((item) => item.id === slot.productId);
    const stock = Number(product?.stock ?? slot.stock ?? 0);
    const prizeType = slot.prizeType || "product";
    const isReady = Boolean(slot.isActive && (
      prizeType === "empty" ||
      (prizeType === "points" && Number(slot.pointAmount || 0) > 0) ||
      (slot.productId && product?.isActive !== false && stock > 0)
    ));
    const typeLabel = prizeType === "points" ? "Point" : prizeType === "empty" ? "เกลือ" : "สินค้า";
    return `
      <article class="free-random-slot-card" data-free-random-slot="${slot.slotNumber}">
        <div class="free-random-slot-head">
          <strong>ช่อง ${slot.slotNumber} · ${typeLabel}</strong>
          <span class="status-pill ${isReady ? "ok" : slot.isActive ? "warn" : ""}">${isReady ? "พร้อมสุ่ม" : slot.isActive ? "ตรวจสต็อก" : "ปิด"}</span>
        </div>
        <label>
          ประเภทรางวัล
          <select name="prizeType">
            <option value="product"${prizeType === "product" ? " selected" : ""}>สินค้า / เกมจริง</option>
            <option value="points"${prizeType === "points" ? " selected" : ""}>Point เข้าบัญชีทันที</option>
            <option value="empty"${prizeType === "empty" ? " selected" : ""}>เกลือ / ไม่ได้รับรางวัล</option>
          </select>
        </label>
        <label>
          สินค้า (ใช้เฉพาะประเภทรางวัลสินค้า)
          <select name="productId">${freeRandomProductOptions(slot.productId)}</select>
        </label>
        <div class="form-row">
          <label>
            %
            <input name="chancePercent" type="number" min="0" max="100" step="0.01" value="${Number(slot.chancePercent || 0)}" />
          </label>
          <label>
            Point
            <input name="pointAmount" type="number" min="0" step="1" value="${Number(slot.pointAmount || 0)}" />
          </label>
          <label>
            สถานะ
            <select name="isActive">
              <option value="true"${slot.isActive ? " selected" : ""}>เปิด</option>
              <option value="false"${!slot.isActive ? " selected" : ""}>ปิด</option>
            </select>
          </label>
        </div>
        <label>
          ชื่อแสดงผล (เว้นว่าง = ใช้ชื่อสินค้า)
          <input name="label" type="text" value="${escapeHtml(slot.label || "")}" placeholder="เช่น Jackpot / Rare Prize" />
        </label>
        <label>
          รูปเฉพาะช่อง (ไม่บังคับ)
          <input name="imageUrl" type="url" value="${escapeHtml(slot.imageUrl || "")}" placeholder="https://..." />
        </label>
        <small>${prizeType === "points" ? `เติม ${Number(slot.pointAmount || 0).toLocaleString("th-TH")} Point ให้ลูกค้าทันที` : prizeType === "empty" ? "รอบนี้ไม่ได้รับเกมหรือ Point แต่จะนับจำนวนครั้งสุ่ม" : `สินค้า: ${escapeHtml(product?.name || slot.productName || "ยังไม่เลือก")} · Stock ${stock.toLocaleString("th-TH")}`}</small>
      </article>
    `;
  }).join("");

  const claims = Array.isArray(state.freeRandom?.claims) ? state.freeRandom.claims : [];
  table.innerHTML = claims.length
    ? claims.slice(0, 100).map((claim) => `
        <tr>
          <td>${claim.createdAt ? new Date(claim.createdAt).toLocaleString("th-TH") : "-"}</td>
          <td>
            <strong>${escapeHtml(claim.username || claim.userEmail || claim.userId || "-")}</strong>
            <small>${escapeHtml(claim.userEmail || "")}</small>
          </td>
          <td>${escapeHtml(claim.prizeType === "points" ? `${Number(claim.pointAmount || 0)} Point` : claim.prizeType === "empty" ? "เกลือ / ไม่ได้รับรางวัล" : claim.productName || claim.prizeSnapshot?.productName || claim.productId || "-")}</td>
          <td>${Number(claim.slotNumber || 0)} / ${Number(claim.chancePercent || 0).toLocaleString("th-TH", { maximumFractionDigits: 2 })}%</td>
          <td>${escapeHtml(claim.orderNumber || claim.orderId || "-")}</td>
        </tr>
      `).join("")
    : `<tr><td colspan="5">ยังไม่มีประวัติการสุ่ม</td></tr>`;
}

function readFreeRandomFormSlots() {
  return $$("#free-random-slot-grid [data-free-random-slot]").map((card) => ({
    slotNumber: Number(card.dataset.freeRandomSlot || 0),
    prizeType: card.querySelector('[name="prizeType"]')?.value || "product",
    pointAmount: Number(card.querySelector('[name="pointAmount"]')?.value || 0),
    productId: card.querySelector('[name="productId"]')?.value || "",
    chancePercent: Number(card.querySelector('[name="chancePercent"]')?.value || 0),
    isActive: card.querySelector('[name="isActive"]')?.value === "true",
    label: card.querySelector('[name="label"]')?.value?.trim() || "",
    imageUrl: card.querySelector('[name="imageUrl"]')?.value?.trim() || ""
  }));
}

function readFreeRandomMilestones() {
  return $$("#free-random-milestone-grid [data-free-random-milestone]").map((card) => ({
    threshold: Number(card.dataset.freeRandomMilestone || 0),
    productId: card.querySelector('[name="productId"]')?.value || "",
    isActive: card.querySelector('[name="isActive"]')?.value === "true",
    label: card.querySelector('[name="label"]')?.value?.trim() || "",
    imageUrl: card.querySelector('[name="imageUrl"]')?.value?.trim() || ""
  }));
}

async function refreshFreeRandomPanel() {
  state.freeRandom = await fetchAdminFreeRandomFromSupabase();
  renderFreeRandomPanel();
  createIconSet();
}

async function saveFreeRandomSettings(event) {
  event.preventDefault();
  if (!window.OlafFreeRandom?.adminSaveSettings) {
    showAdminToast("ยังไม่พบ RPC ระบบสุ่ม 1 Point กรุณารัน SQL ระบบสุ่มก่อน", "error", 8000);
    return;
  }
  const form = event.currentTarget;
  const button = form.querySelector('button[type="submit"]');
  const originalText = button?.innerHTML || "";
  if (button) {
    button.disabled = true;
    button.innerHTML = '<i data-lucide="loader-circle"></i> กำลังบันทึก';
    createIconSet();
  }
  try {
    const saved = await window.OlafFreeRandom.adminSaveSettings({
      isActive: form.elements.isActive?.value !== "false",
      slots: readFreeRandomFormSlots()
    });
    let milestones = state.freeRandom.milestones || [];
    if (window.OlafFreeRandom.adminSaveMilestones) {
      milestones = await window.OlafFreeRandom.adminSaveMilestones(readFreeRandomMilestones());
    }
    const claims = window.OlafFreeRandom.adminFetchClaims ? await window.OlafFreeRandom.adminFetchClaims(100).catch(() => state.freeRandom.claims || []) : [];
    state.freeRandom = {
      settings: saved.settings,
      slots: saved.slots,
      milestones,
      claims
    };
    renderFreeRandomPanel();
    showAdminToast("บันทึกระบบสุ่ม 1 Point เรียบร้อยแล้ว", "success");
  } catch (error) {
    showAdminToast(error.message || "บันทึกระบบสุ่ม 1 Point ไม่สำเร็จ", "error", 9000);
  } finally {
    if (button) {
      button.disabled = false;
      button.innerHTML = originalText;
      createIconSet();
    }
  }
}

async function resetFreeRandomSpinCounts() {
  if (!window.OlafFreeRandom?.adminResetSpinCounts) {
    showAdminToast("ยังไม่พบ RPC รีจำนวนสุ่ม กรุณารัน SQL milestone เวอร์ชันล่าสุดก่อน", "error", 8000);
    return;
  }
  const confirmed = await adminConfirm(
    "จำนวนสุ่มสะสมสำหรับโบนัสของผู้ใช้ทุกคนจะเริ่มใหม่ที่ 0 ทันที โดยระบบจะไม่ลบประวัติการสุ่ม ออเดอร์ รางวัลที่รับไปแล้ว หรือ Point เดิม",
    "ยืนยันรีเซ็ตจำนวนสุ่มเป็น 0"
  );
  if (!confirmed) return;

  const button = $("#free-random-reset-counts");
  const originalText = button?.innerHTML || "";
  let resetCompleted = false;
  if (button) {
    button.disabled = true;
    button.innerHTML = '<i data-lucide="loader-circle"></i> กำลังรีเซ็ต';
    createIconSet();
  }
  try {
    await window.OlafFreeRandom.adminResetSpinCounts("Reset from admin Premium Spin panel");
    await refreshFreeRandomPanel();
    resetCompleted = true;
    showAdminToast("รีจำนวนสุ่มทั้งหมดเรียบร้อยแล้ว เริ่มนับโบนัสรอบใหม่โดยไม่ลบประวัติเดิม", "success", 8000);
  } catch (error) {
    showAdminToast(error.message || "รีจำนวนสุ่มไม่สำเร็จ", "error", 9000);
  } finally {
    if (button) {
      button.disabled = false;
      button.innerHTML = originalText;
      createIconSet();
    }
  }
  if (resetCompleted) {
    await adminAlert(
      "จำนวนสุ่มสะสมสำหรับโบนัสถูกตั้งเป็น 0 แล้ว ลูกค้าจะเริ่มนับรอบกิจกรรมใหม่จากการสุ่มครั้งถัดไป ส่วนประวัติ ออเดอร์ รางวัล และ Point เดิมยังอยู่ครบ",
      "รีเซ็ตจำนวนสุ่มสำเร็จ"
    );
  }
}

function setInventorySummaries(rows = []) {
  state.inventorySummaries = Object.fromEntries(
    (rows || [])
      .filter((row) => row?.productId)
      .map((row) => [row.productId, row])
  );
}

function inventorySummaryFor(productOrId) {
  const product = typeof productOrId === "string"
    ? products().find((item) => item.id === productOrId)
    : productOrId;
  if (!product) {
    return {
      productId: "",
      availableCount: 0,
      reservedCount: 0,
      deliveredCount: 0,
      voidCount: 0,
      soldCount: 0,
      isActive: false,
      orderCount: 0,
      orderQuantity: 0,
      deliveredOrderQuantity: 0,
      cancelledOrderQuantity: 0,
      lastOrderAt: "",
      stockMatches: true
    };
  }
  return state.inventorySummaries[product.id] || {
    productId: product.id,
    managedStock: isOfflineProductCategory(product.category),
    availableCount: Number(product.stock || 0),
    reservedCount: 0,
    deliveredCount: 0,
    voidCount: 0,
    soldCount: Number(product.sold || 0),
    isActive: product.isActive !== false,
    orderCount: 0,
    orderQuantity: Number(product.sold || 0),
    deliveredOrderQuantity: 0,
    cancelledOrderQuantity: 0,
    lastOrderAt: "",
    stockMatches: true
  };
}

async function refreshInventorySummaries() {
  if (!window.OlafProducts?.adminFetchInventorySummary) {
    setInventorySummaries([]);
    return [];
  }
  const summaries = await window.OlafProducts.adminFetchInventorySummary();
  setInventorySummaries(summaries);
  return summaries;
}

function productOrderHistory(productId, limit = 3) {
  return state.orders
    .flatMap((order) =>
      (order.items || [])
        .filter((item) => item.productId === productId)
        .map((item) => ({
          orderId: order.id,
          orderNumber: order.orderNumber || order.id,
          status: order.status || "",
          quantity: Number(item.quantity || 0),
          createdAt: order.createdAt || ""
        }))
    )
    .sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0))
    .slice(0, limit);
}

function selectedProduct() {
  return products().find((product) => product.id === state.selectedProductId) ?? null;
}

function packageCacheKey(productId) {
  return productId ? String(productId) : "__new__";
}

function getCachedProductPackages(productId) {
  return state.productPackages[packageCacheKey(productId)] ?? null;
}

function setCachedProductPackages(productId, packages) {
  state.productPackages[packageCacheKey(productId)] = Array.isArray(packages) ? packages : [];
}

function normalizeAdminPackage(pkg = {}, index = 0) {
  return {
    id: pkg.id || "",
    title: pkg.title || "",
    subtitle: pkg.subtitle || "",
    description: pkg.description || "",
    price: Number(pkg.price || 0),
    compareAt: pkg.compareAt == null ? null : Number(pkg.compareAt),
    stock: Number(pkg.stock || 0),
    sold: Number(pkg.sold || 0),
    status: pkg.status || "active",
    sortOrder: Number(pkg.sortOrder ?? index),
    badge: pkg.badge || "",
    metadata: pkg.metadata && typeof pkg.metadata === "object" ? pkg.metadata : {}
  };
}

async function loadProductPackages(productId, { force = false } = {}) {
  const key = packageCacheKey(productId);
  if (!productId) {
    if (!state.productPackages[key]) state.productPackages[key] = [];
    return state.productPackages[key];
  }
  if (!force && Array.isArray(state.productPackages[key])) return state.productPackages[key];
  if (!window.OlafProducts?.adminFetchProductPackages) {
    throw new Error("Product package client is not ready");
  }
  const packages = await window.OlafProducts.adminFetchProductPackages(productId);
  setCachedProductPackages(productId, packages.map(normalizeAdminPackage));
  return state.productPackages[key];
}

function productPackageDraft(productId) {
  const existing = getCachedProductPackages(productId) || [];
  return {
    id: `draft-${Date.now()}-${++packageDraftCounter}`,
    title: `Package ${existing.length + 1}`,
    subtitle: "",
    description: "",
    price: 0,
    compareAt: null,
    stock: 0,
    sold: 0,
    status: "active",
    sortOrder: existing.length,
    badge: "",
    metadata: {}
  };
}

function packageInputValue(value) {
  return value == null ? "" : escapeHtml(value);
}

function renderPackageEditorCard(pkg, index) {
  const value = normalizeAdminPackage(pkg, index);
  const isDraft = String(value.id || "").startsWith("draft-");
  return `
    <article class="package-editor-card" data-package-card data-package-id="${escapeHtml(value.id)}">
      <div class="package-card-head">
        <div>
          <span class="eyebrow">Package ${index + 1}</span>
          <strong>${escapeHtml(value.title || "แพ็คเกจใหม่")}</strong>
        </div>
        <button class="danger-button" type="button" data-package-delete>
          <i data-lucide="trash-2"></i>
          ลบ
        </button>
      </div>
      <div class="package-field-grid">
        <label>
          ชื่อแพ็ค
          <input data-package-field="title" type="text" value="${packageInputValue(value.title)}" placeholder="Deluxe Edition (1)" required />
        </label>
        <label>
          หัวข้อ/คำอธิบายสั้น
          <input data-package-field="subtitle" type="text" value="${packageInputValue(value.subtitle)}" placeholder="พร้อมเล่น / ได้ครบ" />
        </label>
        <label>
          ราคา
          <input data-package-field="price" type="number" min="0" step="1" value="${Number(value.price || 0)}" required />
        </label>
        <label>
          ราคาเต็ม
          <input data-package-field="compareAt" type="number" min="0" step="1" value="${value.compareAt == null ? "" : Number(value.compareAt)}" />
        </label>
        <label>
          สต็อก
          <input data-package-field="stock" type="number" min="0" step="1" value="${Number(value.stock || 0)}" required />
        </label>
        <label>
          ขายแล้ว
          <input data-package-field="sold" type="number" min="0" step="1" value="${Number(value.sold || 0)}" />
        </label>
        <label>
          สถานะ
          <select data-package-field="status">
            <option value="active" ${value.status === "active" ? "selected" : ""}>เปิดขาย</option>
            <option value="inactive" ${value.status === "inactive" ? "selected" : ""}>ปิดชั่วคราว</option>
            <option value="archived" ${value.status === "archived" ? "selected" : ""}>เก็บถาวร</option>
          </select>
        </label>
        <label>
          ลำดับ
          <input data-package-field="sortOrder" type="number" min="0" step="1" value="${Number(value.sortOrder || 0)}" />
        </label>
        <label>
          Badge
          <input data-package-field="badge" type="text" value="${packageInputValue(value.badge)}" placeholder="ขายดี" />
        </label>
      </div>
      <label class="package-description-field">
        รายละเอียดแพ็ค
        <textarea data-package-field="description" rows="3" placeholder="รายละเอียดที่จะแสดงในหน้าสินค้า">${escapeHtml(value.description || "")}</textarea>
      </label>
      <input data-package-field="id" type="hidden" value="${escapeHtml(isDraft ? "" : value.id)}" />
    </article>
  `;
}

function renderProductPackagesEditor(product) {
  const list = $("#product-package-list");
  const addButton = $("#add-product-package");
  if (!list || !addButton) return;

  const key = packageCacheKey(product?.id);
  const packages = getCachedProductPackages(product?.id);
  addButton.disabled = false;

  if (product?.id && packages === null) {
    addButton.disabled = true;
    list.innerHTML = `<div class="package-editor-empty">กำลังโหลดแพ็คเกจสินค้า...</div>`;
    if (!packageLoadingProductIds.has(key)) {
      packageLoadingProductIds.add(key);
      loadProductPackages(product.id)
        .then(() => {
          if (selectedProduct()?.id === product.id) {
            renderProductPackagesEditor(selectedProduct());
          }
        })
        .catch((error) => {
          console.warn("Product packages unavailable", error);
          list.innerHTML = `<div class="package-editor-empty">โหลดแพ็คเกจไม่สำเร็จ: ${escapeHtml(adminProductErrorMessage(error))}</div>`;
        })
        .finally(() => {
          packageLoadingProductIds.delete(key);
          createIconSet();
        });
    }
    return;
  }

  const nextPackages = Array.isArray(packages) ? packages : [];
  if (!nextPackages.length) {
    list.innerHTML = `<div class="package-editor-empty">ยังไม่มีแพ็คเกจ กดเพิ่มแพ็คเกจเพื่อเริ่มตั้งราคา/สต็อกแยก</div>`;
    return;
  }
  list.innerHTML = nextPackages.map(renderPackageEditorCard).join("");
}

function packageDraftsFromEditor() {
  return $$("#product-package-list [data-package-card]").map((card, index) => {
    const field = (name) => card.querySelector(`[data-package-field="${name}"]`);
    const compareAtText = field("compareAt")?.value?.trim() || "";
    return {
      id: field("id")?.value?.trim() || "",
      title: field("title")?.value?.trim() || "",
      subtitle: field("subtitle")?.value?.trim() || "",
      description: field("description")?.value?.trim() || "",
      price: Number(field("price")?.value || 0),
      compareAt: compareAtText === "" ? null : Number(compareAtText),
      stock: Number(field("stock")?.value || 0),
      sold: Number(field("sold")?.value || 0),
      status: field("status")?.value || "active",
      sortOrder: Number(field("sortOrder")?.value || index),
      badge: field("badge")?.value?.trim() || "",
      metadata: {}
    };
  });
}

function validateAdminPackages(packages) {
  packages.forEach((pkg, index) => {
    const label = pkg.title || `Package ${index + 1}`;
    if (!pkg.title.trim()) throw new Error("กรุณากรอกชื่อแพ็คเกจให้ครบ");
    validateNonNegativeNumber(pkg.price, `ราคา ${label}`);
    if (pkg.compareAt != null) validateNonNegativeNumber(pkg.compareAt, `ราคาเต็ม ${label}`);
    validateNonNegativeInteger(pkg.stock, `สต็อก ${label}`);
    validateNonNegativeInteger(pkg.sold, `ขายแล้ว ${label}`);
    validateNonNegativeInteger(pkg.sortOrder, `ลำดับ ${label}`);
    if (!["active", "inactive", "archived"].includes(pkg.status)) {
      throw new Error(`สถานะแพ็คเกจ ${label} ไม่ถูกต้อง`);
    }
  });
}

function syncPackageCacheFromEditor(productId) {
  setCachedProductPackages(productId, packageDraftsFromEditor().map(normalizeAdminPackage));
}

function addPackageDraftToEditor() {
  const product = selectedProduct();
  syncPackageCacheFromEditor(product?.id);
  const packages = getCachedProductPackages(product?.id) || [];
  packages.push(productPackageDraft(product?.id));
  setCachedProductPackages(product?.id, packages);
  renderProductPackagesEditor(product);
  createIconSet();
}

async function deletePackageFromEditor(button) {
  const card = button.closest("[data-package-card]");
  if (!card) return;
  const product = selectedProduct();
  const packageId = card.querySelector('[data-package-field="id"]')?.value?.trim() || "";

  if (packageId) {
    if (!(await adminConfirm("ลบแพ็คเกจนี้ใช่ไหม? ออเดอร์เก่าจะยังอ่านจาก snapshot เดิมได้"))) return;
    button.disabled = true;
    try {
      if (!window.OlafProducts?.adminDeleteProductPackage) {
        throw new Error("Product package client is not ready");
      }
      await window.OlafProducts.adminDeleteProductPackage(packageId);
      await loadProductPackages(product?.id, { force: true });
      renderProductPackagesEditor(product);
      showAdminToast("ลบแพ็คเกจแล้ว", "success");
    } catch (error) {
      const message = adminProductErrorMessage(error);
      showAdminToast(message, "error");
      button.disabled = false;
    } finally {
      createIconSet();
    }
    return;
  }

  card.remove();
  syncPackageCacheFromEditor(product?.id);
  renderProductPackagesEditor(product);
  createIconSet();
}

function isOfflineProductCategory(category) {
  return ["offline", "rockstar", "rockstar-fivem", "rockstar-games", "minecraft"].includes(String(category || "").trim().toLowerCase());
}

function managedStockCategoryLabel(category) {
  const normalized = String(category || "").trim().toLowerCase();
  if (normalized === "rockstar") return "Rockstar / FiveM";
  if (normalized === "rockstar-fivem" || normalized === "rockstar-games") return "Rockstar / FiveM";
  if (normalized === "minecraft") return "Minecraft / Microsoft";
  if (normalized === "minecraft-account") return "Minecraft / Microsoft Account";
  if (normalized === "minecraft-key") return "Minecraft Key";
  return "Steam Offline";
}

function managedStockPlaceholder(category) {
  const normalized = String(category || "").trim().toLowerCase();
  if (["rockstar", "rockstar-fivem", "rockstar-games"].includes(normalized)) {
    return '{"version":1,"accounts":[{"platform":"ROCKSTAR","login":"email@example.com","id":"rockstar-id","password":"password"}]}';
  }
  if (["minecraft", "minecraft-account"].includes(normalized)) {
    return '{"version":1,"accounts":[{"platform":"MICROSOFT","login":"email@example.com","id":"minecraft-id","password":"password"},{"platform":"WEBMAIL","login":"mail@example.com","password":"mail-password"}]}';
  }
  if (normalized === "minecraft-key") {
    return '{"version":1,"accounts":[{"platform":"MICROSOFT","login":"redeem-key","id":"product-key","password":"-"}]}';
  }
  return '{"version":1,"accounts":[{"platform":"STEAM","login":"steam-login","id":"steam-id","password":"password"}]}';
}

function offlineStockCacheKey(productId) {
  return productId || "__new__";
}

function normalizeOfflineStockItem(item = {}, index = 0) {
  return {
    id: item.id || `draft-offline-${index}`,
    productId: item.productId || item.product_id || "",
    content: item.content || "",
    status: item.status || "available",
    orderId: item.orderId || item.order_id || "",
    orderItemId: item.orderItemId || item.order_item_id || "",
    reservedBy: item.reservedBy || item.reserved_by || "",
    reservedAt: item.reservedAt || item.reserved_at || "",
    deliveredAt: item.deliveredAt || item.delivered_at || "",
    createdAt: item.createdAt || item.created_at || "",
    updatedAt: item.updatedAt || item.updated_at || ""
  };
}

function getCachedOfflineStockItems(productId) {
  const key = offlineStockCacheKey(productId);
  return Object.prototype.hasOwnProperty.call(state.offlineStockItems, key)
    ? state.offlineStockItems[key]
    : null;
}

function setCachedOfflineStockItems(productId, items) {
  state.offlineStockItems[offlineStockCacheKey(productId)] = (items || []).map(normalizeOfflineStockItem);
}

function offlineStockLinesFromEditor() {
  return compactLines($("#offline-stock-lines")?.value || "");
}

function renderManagedStockDraft() {
  const preview = $("#managed-stock-draft-preview");
  if (!preview) return;
  if (!managedStockDraftAccounts.length) {
    preview.innerHTML = "<span>ยังไม่มีบัญชีในแบบร่าง</span>";
    return;
  }
  preview.innerHTML = managedStockDraftAccounts.map((account, index) => `
    <span class="stock-variable-chip">
      <strong>${escapeHtml(account.platform)}</strong>
      <span>${escapeHtml(account.login || account.id || "credential")}</span>
      <button type="button" data-remove-managed-stock-account="${index}" aria-label="ลบ ${escapeHtml(account.platform)}"><i data-lucide="x"></i></button>
    </span>
  `).join("");
  createIconSet();
}

function clearManagedStockDraft() {
  managedStockDraftAccounts = [];
  ["#managed-stock-login", "#managed-stock-id", "#managed-stock-password"].forEach((selector) => {
    const input = $(selector);
    if (input) input.value = "";
  });
  renderManagedStockDraft();
}

function readManagedStockAccountDraft() {
  const platform = String($("#managed-stock-platform")?.value || "STEAM").trim().toUpperCase();
  const login = String($("#managed-stock-login")?.value || "").trim();
  const id = String($("#managed-stock-id")?.value || "").trim();
  const password = String($("#managed-stock-password")?.value || "").trim();
  if ((!login && !id) || !password) {
    showAdminToast("กรุณากรอก Login หรือ ID และ Pass ให้ครบก่อนเพิ่มบัญชี", "warning");
    return null;
  }
  return { platform, login, id, password };
}

function addManagedStockAccountDraft() {
  const account = readManagedStockAccountDraft();
  if (!account) return;
  managedStockDraftAccounts = [
    ...managedStockDraftAccounts.filter((item) => item.platform !== account.platform),
    account
  ];
  ["#managed-stock-login", "#managed-stock-id", "#managed-stock-password"].forEach((selector) => {
    const input = $(selector);
    if (input) input.value = "";
  });
  renderManagedStockDraft();
}

function commitManagedStockUnit() {
  const textarea = $("#offline-stock-lines");
  if (!textarea) return;
  const typed = readManagedStockAccountDraft();
  if (typed) managedStockDraftAccounts = [
    ...managedStockDraftAccounts.filter((item) => item.platform !== typed.platform),
    typed
  ];
  if (!managedStockDraftAccounts.length) {
    showAdminToast("กรุณาเพิ่มบัญชีอย่างน้อย 1 แพลตฟอร์ม", "warning");
    return;
  }
  const unit = JSON.stringify({ version: 1, accounts: managedStockDraftAccounts });
  textarea.value = [textarea.value.trim(), unit].filter(Boolean).join("\n");
  textarea.dispatchEvent(new Event("input", { bubbles: true }));
  clearManagedStockDraft();
  showAdminToast("เพิ่มสต็อคตัวแปร 1 หน่วยแล้ว กดบันทึกสินค้าเพื่อยืนยัน", "success");
}

function offlineStatusCounts(items = []) {
  return items.reduce(
    (acc, item) => {
      const status = item.status || "available";
      if (status === "available") acc.available += 1;
      else if (status === "reserved") acc.reserved += 1;
      else if (status === "delivered") acc.delivered += 1;
      return acc;
    },
    { available: 0, reserved: 0, delivered: 0 }
  );
}

function renderOfflineStockMeta(items = [], availableOverride = null) {
  const counts = offlineStatusCounts(items);
  if (availableOverride != null) counts.available = Number(availableOverride) || 0;
  const countEl = $("#offline-stock-count");
  const metaEl = $("#offline-stock-meta");
  const targetInput = $("#managed-stock-target");
  if (countEl) countEl.textContent = `${counts.available.toLocaleString("th-TH")} ชิ้นพร้อมขาย`;
  if (metaEl) {
    metaEl.innerHTML = `
      <span>พร้อมขาย ${counts.available.toLocaleString("th-TH")}</span>
      <span>ถูกจอง ${counts.reserved.toLocaleString("th-TH")}</span>
      <span>ส่งแล้ว ${counts.delivered.toLocaleString("th-TH")}</span>
    `;
  }
  if (targetInput && document.activeElement !== targetInput) {
    targetInput.value = String(counts.available);
  }
}

async function loadOfflineStockItems(productId, { force = false } = {}) {
  const key = offlineStockCacheKey(productId);
  if (!productId) {
    if (!state.offlineStockItems[key]) state.offlineStockItems[key] = [];
    return state.offlineStockItems[key];
  }
  if (!force && Array.isArray(state.offlineStockItems[key])) return state.offlineStockItems[key];
  if (!window.OlafProducts?.adminFetchOfflineStockItems) {
    throw new Error("Offline stock client is not ready");
  }
  const items = await window.OlafProducts.adminFetchOfflineStockItems(productId);
  setCachedOfflineStockItems(productId, items);
  return state.offlineStockItems[key];
}

function renderOfflineStockEditor(product) {
  const section = $("#offline-stock-editor");
  const textarea = $("#offline-stock-lines");
  const form = $("#product-form");
  if (!section || !textarea || !form) return;

  const category = form.elements.category?.value || product?.category || "";
  const isOffline = isOfflineProductCategory(category);
  const stockCategoryLabel = managedStockCategoryLabel(category);
  section.hidden = !isOffline;
  form.elements.stock.readOnly = isOffline;
  form.elements.stock.title = isOffline ? `สต็อกหมวด ${stockCategoryLabel} จะนับจากรายการที่พร้อมขายด้านล่าง` : "";

  const heading = section.querySelector(".offline-stock-head h3");
  const help = section.querySelector(".offline-stock-head p");
  const fieldLabel = textarea.closest("label");
  if (heading) heading.textContent = `สต็อก ${stockCategoryLabel}`;
  if (help) {
    help.textContent = "ใส่ข้อมูลสินค้า 1 บรรทัดต่อ 1 ชิ้น ระบบจะจองรายการตอนลูกค้าสั่งซื้อ และส่งให้ลูกค้าเมื่อแอดมินกดจัดส่งเท่านั้น";
  }
  if (fieldLabel?.firstChild) fieldLabel.firstChild.textContent = "รายการที่พร้อมขาย\n";

  if (!isOffline) return;

  const key = offlineStockCacheKey(product?.id);
  const cached = getCachedOfflineStockItems(product?.id);

  if (product?.id && cached === null) {
    textarea.value = "";
    textarea.placeholder = `กำลังโหลดสต็อก ${stockCategoryLabel}...`;
    textarea.disabled = true;
    renderOfflineStockMeta([], Number(product.stock || 0));
    if (!offlineStockLoadingProductIds.has(key)) {
      offlineStockLoadingProductIds.add(key);
      loadOfflineStockItems(product.id)
        .then((items) => {
          if (selectedProduct()?.id === product.id) {
            textarea.disabled = false;
            textarea.placeholder = managedStockPlaceholder(category);
            textarea.value = items
              .filter((item) => item.status === "available")
              .map((item) => item.content)
              .join("\n");
            form.elements.stock.value = offlineStockLinesFromEditor().length;
            renderOfflineStockMeta(items, offlineStockLinesFromEditor().length);
          }
        })
        .catch((error) => {
          console.warn("Offline stock unavailable", error);
          textarea.disabled = true;
          textarea.placeholder = adminProductErrorMessage(error);
          renderOfflineStockMeta([], Number(product.stock || 0));
        })
        .finally(() => {
          offlineStockLoadingProductIds.delete(key);
        });
    }
    return;
  }

  const items = Array.isArray(cached) ? cached : [];
  textarea.disabled = false;
  textarea.placeholder = managedStockPlaceholder(category);
  textarea.value = items
    .filter((item) => item.status === "available")
    .map((item) => item.content)
    .join("\n");
  const availableLineCount = offlineStockLinesFromEditor().length;
  form.elements.stock.value = availableLineCount;
  renderOfflineStockMeta(items, availableLineCount);
}

function syncOfflineStockCacheFromEditor(productId) {
  const existing = getCachedOfflineStockItems(productId) || [];
  const lockedItems = existing.filter((item) => item.status !== "available");
  const availableItems = offlineStockLinesFromEditor().map((content, index) =>
    normalizeOfflineStockItem({
      id: `draft-offline-${index}`,
      productId,
      content,
      status: "available"
    })
  );
  setCachedOfflineStockItems(productId, [...availableItems, ...lockedItems]);
}

function validateOfflineStockLines(lines) {
  lines.forEach((line, index) => {
    if (line.length > 2000) {
      throw new Error(`ข้อมูลสต็อกบรรทัดที่ ${index + 1} ยาวเกินไป`);
    }
  });
}

function selectedUser() {
  return state.users.find((user) => user.id === state.selectedUserId) ?? null;
}

function selectedReview() {
  return state.reviews.find((review) => review.id === state.selectedReviewId) ?? null;
}

function selectedOrder() {
  return state.orders.find((order) => order.id === state.selectedOrderId) ?? null;
}

function selectedWidget() {
  return state.widgets.find((widget) => widget.id === state.selectedWidgetId) ?? null;
}

function categoryOptions(selectedId) {
  return state.payload.categories
    .filter((category) => category.id !== "all")
    .map(
      (category) =>
        `<option value="${escapeHtml(category.id)}" ${category.id === selectedId ? "selected" : ""}>${escapeHtml(
          category.label
        )}</option>`
    )
    .join("");
}

function categoryLabel(categoryId) {
  return state.payload.categories.find((category) => category.id === categoryId)?.label ?? categoryId;
}

function stockStatus(stock) {
  if (stock <= 0) return { className: "danger", label: "หมด" };
  if (stock <= 5) return { className: "warn", label: `เหลือ ${stock}` };
  return { className: "ok", label: `พร้อม ${stock}` };
}

function renderAdminSection(name, render, errors) {
  try {
    render();
  } catch (error) {
    errors.push({ name, error });
    console.error(`Admin section render failed: ${name}`, error);
  }
}

function renderAll() {
  const errors = [];
  state.reviews = window.OlafStore?.getReviews() ?? [];
  state.widgets = window.OlafStore?.getWidgets() ?? [];
  renderAdminSection("site icon", () => applySiteIcon(state.payload.store.siteIconUrl), errors);
  renderAdminSection("admin brand", () => applyAdminBrandIcon(state.payload.store.siteIconUrl), errors);
  renderAdminSection("metrics", renderMetrics, errors);
  renderAdminSection("analytics charts", renderAnalyticsCharts, errors);
  renderAdminSection("products table", renderProductsTable, errors);
  renderAdminSection("product form", renderProductForm, errors);
  renderAdminSection("users table", renderUsersTable, errors);
  renderAdminSection("user form", renderUserForm, errors);
  renderAdminSection("orders table", renderOrdersTable, errors);
  renderAdminSection("order form", renderOrderForm, errors);
  renderAdminSection("finance center", renderFinancePanel, errors);
  renderAdminSection("premium spin", renderFreeRandomPanel, errors);
  renderAdminSection("reviews table", renderReviewsTable, errors);
  renderAdminSection("review form", renderReviewForm, errors);
  renderAdminSection("widgets table", renderWidgetsTable, errors);
  renderAdminSection("widget form", renderWidgetForm, errors);
  renderAdminSection("stock board", renderStockBoard, errors);
  renderAdminSection("payment form", renderPaymentForm, errors);
  renderAdminSection("activity popup form", renderActivityPopupForm, errors);
  renderAdminSection("discount codes", renderDiscountCodesPanel, errors);
  renderAdminSection("data preview", renderDataPreview, errors);
  renderAdminSection("admin category tabs", () => renderCategoryTabs("admin-category-tabs"), errors);
  renderAdminSection("stock category tabs", () => renderCategoryTabs("stock-category-tabs"), errors);
  createIconSet();
  return errors;
}

function renderMetrics() {
  const totalStock = products().reduce((sum, product) => sum + product.stock, 0);
  const totalSold = products().reduce((sum, product) => sum + product.sold, 0);
  const lowStock = products().filter((product) => product.stock <= 5).length;
  const activeProducts = products().filter((product) => product.isActive !== false).length;
  const deliveredStock = products().reduce(
    (sum, product) => sum + Number(inventorySummaryFor(product).deliveredCount || 0),
    0
  );
  const finance = financeSummary();

  animateAdminNumber("#metric-products", products().length);
  animateAdminNumber("#metric-stock", totalStock);
  animateAdminNumber("#metric-low-stock", lowStock);
  animateAdminNumber("#metric-sold", totalSold);
  animateAdminNumber("#metric-active-products", activeProducts);
  animateAdminNumber("#metric-delivered-stock", deliveredStock);
  animateAdminNumber("#metric-revenue", finance.totalRevenue, (value) => formatPrice(value));
  animateAdminNumber("#metric-point-balance", finance.pointBalance, (value) => formatPointAmount(value));
  animateAdminNumber("#metric-orders", finance.orderCount);
  renderDashboardCommandCenter(finance, { lowStock, totalStock, deliveredStock });
  renderExecutiveDashboard();

  const alerts = products()
    .filter((product) => product.stock <= 5)
    .sort((a, b) => a.stock - b.stock);
  $("#stock-alert-count").textContent = `${alerts.length.toLocaleString("th-TH")} รายการ`;
  $("#stock-alert-list").innerHTML = alerts.length
    ? alerts.map(renderCompactStockItem).join("")
    : `<div class="compact-item"><div><h3>สต็อกปกติ</h3><p>ยังไม่มีสินค้าใกล้หมด</p></div></div>`;

  $("#stock-log-list").innerHTML = state.stockLog.length
    ? state.stockLog
        .slice(0, 8)
        .map(
          (log) => `
            <div class="compact-item">
              <div>
                <h3>${escapeHtml(log.name)}</h3>
                <p>${escapeHtml(log.action)} · ${new Date(log.createdAt).toLocaleString("th-TH")}</p>
              </div>
              <span class="status-pill ${log.delta >= 0 ? "ok" : "danger"}">${log.delta >= 0 ? "+" : ""}${log.delta}</span>
            </div>
          `
        )
        .join("")
    : `<div class="compact-item"><div><h3>ยังไม่มีประวัติ</h3><p>การเพิ่มหรือลดสต็อกจะแสดงที่นี่</p></div></div>`;
}

function renderExecutiveDashboard() {
  const date = $("#dashboard-current-date");
  if (date) {
    const now = new Date();
    date.dateTime = now.toISOString();
    date.textContent = now.toLocaleDateString("th-TH", {
      weekday: "long",
      day: "numeric",
      month: "long",
      year: "numeric"
    });
  }

  const recentOrders = [...(Array.isArray(state.orders) ? state.orders : [])]
    .sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0))
    .slice(0, 6);
  const recentOrdersContainer = $("#dashboard-recent-orders");
  if (recentOrdersContainer) {
    recentOrdersContainer.innerHTML = recentOrders.length
      ? recentOrders
          .map((order) => {
            const firstItem = order.items?.[0]?.productName || order.items?.[0]?.name || "สินค้า";
            const extraItems = Math.max(0, Number(order.items?.length || 0) - 1);
            const customer = order.customerName || order.customerEmail || "ลูกค้า";
            return `
              <button class="dashboard-order-row" type="button" data-edit-order="${escapeHtml(order.id)}">
                <span class="dashboard-order-icon"><i data-lucide="shopping-bag"></i></span>
                <span class="dashboard-order-main">
                  <strong>${escapeHtml(order.orderNumber || order.id)}</strong>
                  <small>${escapeHtml(firstItem)}${extraItems ? ` +${extraItems}` : ""}</small>
                </span>
                <span class="dashboard-order-customer">${escapeHtml(customer)}</span>
                <span class="dashboard-order-value">
                  <strong>${formatPrice(order.total || 0)}</strong>
                  <small>${formatAdminDateTime(order.createdAt)}</small>
                </span>
                <span class="status-pill ${orderStatusClass(order.status)}">${escapeHtml(order.status || "pending")}</span>
              </button>
            `;
          })
          .join("")
      : `<div class="admin-dashboard-empty"><i data-lucide="receipt"></i><span>ยังไม่มีคำสั่งซื้อในระบบ</span></div>`;
  }

  const pipeline = [
    {
      label: "รอชำระ/ตรวจสลิป",
      icon: "clock-3",
      tone: "warn",
      value: state.orders.filter((order) => ["awaiting_payment", "waiting_admin"].includes(order.status)).length
    },
    {
      label: "รอจัดส่ง",
      icon: "package-check",
      tone: "info",
      value: state.orders.filter((order) => order.status === "confirmed").length
    },
    {
      label: "ส่งมอบแล้ว",
      icon: "badge-check",
      tone: "ok",
      value: state.orders.filter((order) => order.status === "delivered").length
    },
    {
      label: "ยกเลิก",
      icon: "circle-x",
      tone: "danger",
      value: state.orders.filter((order) => ["cancelled", "expired"].includes(order.status)).length
    }
  ];
  const pipelineContainer = $("#dashboard-order-pipeline");
  if (pipelineContainer) {
    pipelineContainer.innerHTML = pipeline
      .map(
        (item) => `
          <div class="dashboard-pipeline-item ${item.tone}">
            <i data-lucide="${item.icon}"></i>
            <span>${item.label}</span>
            <strong>${Number(item.value || 0).toLocaleString("th-TH")}</strong>
          </div>
        `
      )
      .join("");
  }

  const categoryMap = new Map();
  products().forEach((product) => {
    const categoryId = product.category || "other";
    const row = categoryMap.get(categoryId) || {
      id: categoryId,
      label: categoryLabel(categoryId),
      products: 0,
      stock: 0,
      sold: 0
    };
    row.products += 1;
    row.stock += Number(inventorySummaryFor(product).availableCount || 0);
    row.sold += Number(product.sold || 0);
    categoryMap.set(categoryId, row);
  });
  const categories = [...categoryMap.values()].sort((a, b) => b.sold - a.sold || b.stock - a.stock).slice(0, 5);
  const maxCategoryValue = Math.max(1, ...categories.map((item) => item.sold + item.stock));
  const categoryContainer = $("#dashboard-category-performance");
  if (categoryContainer) {
    categoryContainer.innerHTML = categories.length
      ? `
          <div class="dashboard-section-label"><span>สินค้าแยกตามหมวด</span><small>สต็อก + ยอดขาย</small></div>
          ${categories
            .map((item) => {
              const percent = Math.max(8, Math.round(((item.sold + item.stock) / maxCategoryValue) * 100));
              return `
                <div class="dashboard-category-row">
                  <div><strong>${escapeHtml(item.label)}</strong><small>${item.products.toLocaleString("th-TH")} สินค้า</small></div>
                  <div class="dashboard-category-track"><span style="width:${percent}%"></span></div>
                  <div><strong>${item.stock.toLocaleString("th-TH")}</strong><small>พร้อมขาย</small></div>
                </div>
              `;
            })
            .join("")}
        `
      : `<div class="admin-dashboard-empty"><i data-lucide="boxes"></i><span>ยังไม่มีข้อมูลสินค้า</span></div>`;
  }
}

function renderDashboardCommandCenter(finance, stockInfo = {}) {
  const pendingSlip = state.orders.filter((order) => ["awaiting_payment", "waiting_admin"].includes(order.status)).length;
  const waitingDelivery = state.orders.filter((order) => order.status === "confirmed").length;
  const lowStock = Number(stockInfo.lowStock || 0);
  const rejectedSlip = state.finance.paymentVerifications.filter((item) => ["rejected", "provider_error"].includes(item.status)).length;
  const tasks = [
    {
      label: "รอตรวจสลิป",
      value: pendingSlip,
      detail: "ออเดอร์ที่ลูกค้าอาจแนบสลิปหรือรอระบบตรวจ",
      icon: "receipt-text",
      panel: "orders",
      tone: pendingSlip ? "warn" : "ok"
    },
    {
      label: "รอจัดส่ง",
      value: waitingDelivery,
      detail: "ออเดอร์ตรวจสลิปแล้ว แต่ยังรอแอดมินส่งสินค้า",
      icon: "package-check",
      panel: "orders",
      tone: waitingDelivery ? "warn" : "ok"
    },
    {
      label: "สต็อกใกล้หมด",
      value: lowStock,
      detail: "สินค้าที่ควรเช็คสต็อกก่อนขายต่อ",
      icon: "triangle-alert",
      panel: "stock",
      tone: lowStock ? "danger" : "ok"
    },
    {
      label: "สลิปมีปัญหา",
      value: rejectedSlip,
      detail: "รายการตรวจสลิปที่ถูกปฏิเสธหรือ provider error",
      icon: "shield-alert",
      panel: "finance",
      tone: rejectedSlip ? "danger" : "ok"
    }
  ];
  const actionable = tasks.reduce((sum, task) => sum + Number(task.value || 0), 0);
  setTextSafe("#dashboard-command-count", `${actionable.toLocaleString("th-TH")} งาน`);

  const list = $("#dashboard-command-list");
  if (list) {
    list.innerHTML = tasks
      .map(
        (task) => `
          <button class="admin-command-item ${task.tone}" type="button" data-dashboard-panel="${escapeHtml(task.panel)}">
            <span class="admin-command-icon"><i data-lucide="${escapeHtml(task.icon)}"></i></span>
            <span>
              <strong>${escapeHtml(task.label)}</strong>
              <small>${escapeHtml(task.detail)}</small>
            </span>
            <b>${Number(task.value || 0).toLocaleString("th-TH")}</b>
          </button>
        `
      )
      .join("");
  }

  const topCustomers = financeWalletRows().filter((wallet) => wallet.totalSpent > 0).slice(0, 5);
  const topList = $("#dashboard-top-customers");
  if (topList) {
    topList.innerHTML = topCustomers.length
      ? topCustomers
          .map(
            (wallet, index) => `
              <div class="admin-rank-item">
                <span>#${index + 1}</span>
                <div>
                  <strong>${escapeHtml(adminUserLabel(wallet))}</strong>
                  <small>${escapeHtml(wallet.email || wallet.username || "-")}</small>
                </div>
                <b>${formatPrice(wallet.totalSpent)}</b>
              </div>
            `
          )
          .join("")
      : `<div class="admin-rank-empty">ยังไม่มีข้อมูลยอดซื้อลูกค้า</div>`;
  }

  const verified = state.finance.paymentVerifications.filter((item) => item.status === "verified").length;
  const creditPoints = financeTransactions()
    .filter((tx) => String(tx.type || "").startsWith("credit"))
    .reduce((sum, tx) => sum + Number(tx.amount || 0), 0);
  const todayOrders = state.orders.filter((order) => orderMatchesFinancePeriod(order, "day"));
  const todayRevenue = todayOrders.filter(isRevenueOrder).reduce((sum, order) => sum + Number(order.total || 0), 0);
  const health = $("#dashboard-payment-health");
  if (health) {
    health.innerHTML = [
      ["รายได้วันนี้", formatPrice(todayRevenue), "chart-line"],
      ["สลิปผ่าน", verified.toLocaleString("th-TH"), "badge-check"],
      ["Point เครดิต", `${formatPointAmount(creditPoints)} P`, "coins"],
      ["ออเดอร์วันนี้", todayOrders.length.toLocaleString("th-TH"), "shopping-bag"]
    ]
      .map(
        ([label, value, icon]) => `
          <div class="admin-health-item">
            <i data-lucide="${icon}"></i>
            <span>${label}</span>
            <strong>${value}</strong>
          </div>
        `
      )
      .join("");
  }
}

function chartRgba(hex, alpha) {
  const value = String(hex || "").replace("#", "");
  if (value.length !== 6) return `rgba(90, 167, 255, ${alpha})`;
  const r = parseInt(value.slice(0, 2), 16);
  const g = parseInt(value.slice(2, 4), 16);
  const b = parseInt(value.slice(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

function prepareChartCanvas(canvas) {
  if (!canvas) return null;
  const rect = canvas.getBoundingClientRect();
  const width = Math.max(300, Math.round(rect.width || canvas.clientWidth || canvas.width || 560));
  const height = Math.max(220, Math.round(rect.height || canvas.clientHeight || canvas.height || 260));
  const ratio = Math.min(window.devicePixelRatio || 1, 2);
  const targetWidth = Math.round(width * ratio);
  const targetHeight = Math.round(height * ratio);
  if (canvas.width !== targetWidth || canvas.height !== targetHeight) {
    canvas.width = targetWidth;
    canvas.height = targetHeight;
  }
  const ctx = canvas.getContext("2d");
  ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
  ctx.clearRect(0, 0, width, height);
  return { ctx, width, height };
}

function chartLabel(ctx, text, maxWidth) {
  const raw = String(text || "");
  if (ctx.measureText(raw).width <= maxWidth) return raw;
  let label = raw;
  while (label.length > 2 && ctx.measureText(`${label}…`).width > maxWidth) {
    label = label.slice(0, -1);
  }
  return `${label}…`;
}

function drawChartGrid(ctx, width, height, padding) {
  const rows = 4;
  ctx.save();
  ctx.strokeStyle = "rgba(148, 163, 184, 0.13)";
  ctx.lineWidth = 1;
  for (let index = 0; index <= rows; index += 1) {
    const y = padding.top + ((height - padding.top - padding.bottom) / rows) * index;
    ctx.beginPath();
    ctx.moveTo(padding.left, y);
    ctx.lineTo(width - padding.right, y);
    ctx.stroke();
  }
  ctx.restore();
}

function drawEmptyChart(ctx, width, height) {
  ctx.save();
  ctx.fillStyle = "rgba(248, 250, 252, 0.72)";
  ctx.font = "600 14px Kanit, Segoe UI, sans-serif";
  ctx.textAlign = "center";
  ctx.fillText("ยังไม่มีข้อมูลสำหรับกราฟ", width / 2, height / 2);
  ctx.restore();
}

function drawBarChart(canvas, labels, values, color = "#5aa7ff") {
  const chart = prepareChartCanvas(canvas);
  if (!chart) return;
  const { ctx, width, height } = chart;
  const normalizedValues = (values || []).map((value) => Math.max(0, Number(value) || 0));
  if (!normalizedValues.length) {
    drawEmptyChart(ctx, width, height);
    return;
  }

  const padding = { top: 30, right: 18, bottom: 48, left: 42 };
  const chartWidth = width - padding.left - padding.right;
  const chartHeight = height - padding.top - padding.bottom;
  const max = Math.max(...normalizedValues, 1);
  const gap = Math.max(10, Math.min(18, chartWidth / Math.max(normalizedValues.length * 4, 1)));
  const barWidth = Math.max(16, (chartWidth - gap * (normalizedValues.length - 1)) / normalizedValues.length);

  drawChartGrid(ctx, width, height, padding);
  ctx.textAlign = "center";
  ctx.font = "500 11px Kanit, Segoe UI, sans-serif";

  normalizedValues.forEach((value, index) => {
    const barHeight = value > 0 ? Math.max(6, (value / max) * chartHeight) : 3;
    const x = padding.left + index * (barWidth + gap);
    const y = padding.top + chartHeight - barHeight;
    const gradient = ctx.createLinearGradient(0, y, 0, padding.top + chartHeight);
    gradient.addColorStop(0, color);
    gradient.addColorStop(1, chartRgba(color, 0.22));
    ctx.fillStyle = gradient;
    ctx.beginPath();
    if (ctx.roundRect) ctx.roundRect(x, y, barWidth, barHeight, Math.min(12, barWidth / 2));
    else ctx.rect(x, y, barWidth, barHeight);
    ctx.fill();

    ctx.fillStyle = "rgba(248, 250, 252, 0.86)";
    ctx.font = "600 11px Kanit, Segoe UI, sans-serif";
    ctx.fillText(value.toLocaleString("th-TH"), x + barWidth / 2, Math.max(16, y - 8));
    ctx.fillStyle = "rgba(182, 194, 211, 0.82)";
    ctx.font = "500 11px Kanit, Segoe UI, sans-serif";
    ctx.fillText(chartLabel(ctx, labels[index], barWidth + 18), x + barWidth / 2, height - 18);
  });
}

function drawLineChart(canvas, labels, values, color = "#34d399") {
  const chart = prepareChartCanvas(canvas);
  if (!chart) return;
  const { ctx, width, height } = chart;
  const normalizedValues = (values || []).map((value) => Math.max(0, Number(value) || 0));
  if (!normalizedValues.length) {
    drawEmptyChart(ctx, width, height);
    return;
  }

  const padding = { top: 30, right: 24, bottom: 48, left: 44 };
  const chartWidth = width - padding.left - padding.right;
  const chartHeight = height - padding.top - padding.bottom;
  const max = Math.max(...normalizedValues, 1);
  const points = normalizedValues.map((value, index) => {
    const x =
      normalizedValues.length === 1
        ? padding.left + chartWidth / 2
        : padding.left + (chartWidth / (normalizedValues.length - 1)) * index;
    const y = padding.top + chartHeight - (value / max) * chartHeight;
    return { x, y, value };
  });

  drawChartGrid(ctx, width, height, padding);
  const area = ctx.createLinearGradient(0, padding.top, 0, padding.top + chartHeight);
  area.addColorStop(0, chartRgba(color, 0.24));
  area.addColorStop(1, chartRgba(color, 0.02));

  ctx.beginPath();
  points.forEach((point, index) => {
    if (index === 0) ctx.moveTo(point.x, point.y);
    else ctx.lineTo(point.x, point.y);
  });
  ctx.lineTo(points[points.length - 1].x, padding.top + chartHeight);
  ctx.lineTo(points[0].x, padding.top + chartHeight);
  ctx.closePath();
  ctx.fillStyle = area;
  ctx.fill();

  ctx.beginPath();
  points.forEach((point, index) => {
    if (index === 0) ctx.moveTo(point.x, point.y);
    else ctx.lineTo(point.x, point.y);
  });
  ctx.strokeStyle = color;
  ctx.lineWidth = 3;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  ctx.stroke();

  ctx.textAlign = "center";
  points.forEach((point, index) => {
    ctx.beginPath();
    ctx.arc(point.x, point.y, 4.5, 0, Math.PI * 2);
    ctx.fillStyle = "#060811";
    ctx.fill();
    ctx.lineWidth = 2.5;
    ctx.strokeStyle = color;
    ctx.stroke();

    ctx.fillStyle = "rgba(182, 194, 211, 0.82)";
    ctx.font = "500 11px Kanit, Segoe UI, sans-serif";
    ctx.fillText(chartLabel(ctx, labels[index], 74), point.x, height - 18);
  });
}

function renderAnalyticsCharts() {
  const latestOrders = [...state.orders].slice(0, 7).reverse();
  drawLineChart(
    $("#revenue-chart"),
    latestOrders.map((order) => new Date(order.createdAt).toLocaleDateString("th-TH", {day:"numeric", month:"short"})),
    latestOrders.map((order) => Number(order.total) || 0),
    "#10b981"
  );
  const stockByCategory = state.payload.categories
    .filter((category) => category.id !== "all")
    .map((category) => ({
      label: category.label,
      value: state.payload.products
        .filter((product) => product.category === category.id)
        .reduce((sum, product) => sum + product.stock, 0)
    }));
  drawBarChart(
    $("#stock-chart"),
    stockByCategory.map((item) => item.label.slice(0, 8)),
    stockByCategory.map((item) => item.value),
    "#7aa2ff"
  );
}

function renderCompactStockItem(product) {
  const status = stockStatus(product.stock);
  return `
    <div class="compact-item">
      <div>
        <h3>${escapeHtml(product.name)}</h3>
        <p>${escapeHtml(categoryLabel(product.category))}</p>
      </div>
      <button class="mini-button" type="button" data-edit-product="${escapeHtml(product.id)}">
        <i data-lucide="pencil"></i>
        แก้ไข
      </button>
      <span class="status-pill ${status.className}">${status.label}</span>
    </div>
  `;
}

function filteredProducts(scope = "products") {
  let result = products();
  const categoryFilter =
    scope === "stock" ? state.stockCategoryFilter : state.productCategoryFilter;
  if (categoryFilter !== "all") {
    result = result.filter((product) => product.category === categoryFilter);
  }
  if (scope === "stock") {
    const query = state.stockSearch.trim().toLowerCase();
    if (query) {
      result = result.filter((product) =>
        [product.id, product.name, product.publisher, product.category]
          .join(" ")
          .toLowerCase()
          .includes(query)
      );
    }
    if (state.stockActiveOnly) {
      result = result.filter((product) => product.isActive !== false);
    }
    if (state.stockStateFilter !== "all") {
      result = result.filter((product) => {
        const summary = inventorySummaryFor(product);
        if (state.stockStateFilter === "in-stock") return summary.availableCount > 0;
        if (state.stockStateFilter === "out-of-stock") return summary.availableCount <= 0;
        if (state.stockStateFilter === "reserved") return summary.reservedCount > 0;
        if (state.stockStateFilter === "delivered") return summary.deliveredCount > 0;
        return true;
      });
    }
    return result;
  }

  const query = state.search.trim().toLowerCase();
  if (!query) return result;
  return result.filter((product) =>
    [product.name, product.publisher, product.category, product.label, ...(product.tags ?? [])]
      .join(" ")
      .toLowerCase()
      .includes(query)
  );
}

function renderCategoryTabs(containerId) {
  const container = document.getElementById(containerId);
  if (!container) return;
  const scope = containerId === "stock-category-tabs" ? "stock" : "products";
  const selectedCategory =
    scope === "stock" ? state.stockCategoryFilter : state.productCategoryFilter;
  const categories = [];
  const seen = new Set();
  [{ id: "all", label: "ทั้งหมด" }, ...(state.payload.categories || [])].forEach((category) => {
    if (!category?.id || seen.has(category.id)) return;
    seen.add(category.id);
    categories.push(category);
  });

  container.innerHTML = categories.map(cat => `
    <button type="button" class="category-tab ${selectedCategory === cat.id ? "is-active" : ""}" data-category-filter="${escapeHtml(cat.id)}" data-category-scope="${scope}">
      ${escapeHtml(cat.label)}
    </button>
  `).join("");
}

function renderProductsTable() {
  const visibleProducts = filteredProducts("products");
  $("#products-table").innerHTML = visibleProducts.length
    ? visibleProducts
    .map((product, index) => {
      const summary = inventorySummaryFor(product);
      const status = stockStatus(summary.availableCount);
      const isOffline = isOfflineProductCategory(product.category);
      return `
        <tr>
          <td class="product-table-index"><span style="color: var(--muted); font-weight: 500;">${index + 1}</span></td>
          <td data-label="สินค้า">
            <div class="product-cell">
              <img ${fastImg(product.image || product.heroImage, product.name)} />
              <div>
                <strong>${escapeHtml(product.name)}</strong>
                <span>${escapeHtml(product.publisher || product.id)}</span>
              </div>
            </div>
          </td>
          <td data-label="หมวด">${escapeHtml(categoryLabel(product.category))}</td>
          <td data-label="ราคา">${formatPrice(product.price)}</td>
          <td data-label="พร้อมขาย"><span class="status-pill ${status.className}">${status.label}</span></td>
          <td data-label="ขายแล้ว">${Number(summary.soldCount || product.sold || 0).toLocaleString("th-TH")}</td>
          <td data-label="สถานะ"><span class="status-pill ${product.isActive !== false ? "ok" : "danger"}">${product.isActive !== false ? "Active" : "Inactive"}</span></td>
          <td data-label="จัดการ">
            <div class="row-actions">
              ${
                isOffline
                  ? `<button class="mini-button" type="button" data-manage-offline-stock="${escapeHtml(product.id)}"><i data-lucide="list-plus"></i> รายการ</button>`
                  : `<button class="mini-button" type="button" data-stock-adjust="${escapeHtml(product.id)}" data-delta="1">+1</button>`
              }
              <button class="mini-button" type="button" data-edit-product="${escapeHtml(product.id)}">
                <i data-lucide="pencil"></i>
              </button>
            </div>
          </td>
        </tr>
      `;
    })
    .join("")
    : `
      <tr>
        <td colspan="8">
          <div class="admin-empty-state">
            <i data-lucide="package-search"></i>
            <span>ไม่พบสินค้าในหมวดหรือตัวกรองนี้</span>
          </div>
        </td>
      </tr>
    `;
}

function renderProductForm() {
  $("#category-select").innerHTML = categoryOptions(selectedProduct()?.category);
  fillProductForm(selectedProduct());
}

function renderStockViews({ refreshProductForm = false } = {}) {
  renderMetrics();
  renderAnalyticsCharts();
  renderProductsTable();
  renderStockBoard();
  renderCategoryTabs("admin-category-tabs");
  renderCategoryTabs("stock-category-tabs");
  if (refreshProductForm) renderProductForm();
  createIconSet();
}

function openOfflineStockManager(productId) {
  const product = products().find((item) => item.id === productId);
  state.selectedProductId = productId;
  switchPanel("products");
  renderProductForm();
  createIconSet();
  openProductEditorForCurrentViewport({ focusOfflineStock: true });
  requestAnimationFrame(() => {
    const editor = $("#offline-stock-editor");
    if (editor && !editor.hidden) editor.scrollIntoView({ behavior: "smooth", block: "center" });
  });
  setStatus(`เปิดช่องจัดการสต็อก ${managedStockCategoryLabel(product?.category)} แล้ว`);
}

function fillProductForm(product) {
  const form = $("#product-form");
  const isNew = !product;
  $("#product-form-title").textContent = isNew ? "เพิ่มสินค้าใหม่" : "แก้ไขสินค้า";
  $("#editing-product-id").textContent = isNew ? "สินค้าใหม่" : product.id;
  $("#delete-product").disabled = isNew;

  const value = product ?? {
    id: "",
    name: "",
    publisher: "",
    category: state.productCategoryFilter !== "all" ? state.productCategoryFilter : "steam-key",
    label: "",
    price: 0,
    compareAt: 0,
    stock: 0,
    sold: 0,
    rating: "",
    delivery: "",
    warranty: "",
    image: "",
    heroImage: "",
    tags: [],
    description: "",
    gallery: [],
    platformLinks: [],
    featureBlocks: [],
    detailSections: [],
    steamRelatedLinks: [],
    systemRequirements: { minimum: [], recommended: [] },
    steamAppId: null,
    sourceMetadata: {},
    badgeOverrides: [],
    isActive: true,
    sortOrder: products().length
  };

  form.elements.id.value = value.id;
  form.elements.name.value = value.name;
  form.elements.publisher.value = value.publisher;
  form.elements.category.value = value.category;
  form.elements.label.value = value.label;
  form.elements.price.value = value.price;
  form.elements.compareAt.value = value.compareAt;
  form.elements.stock.value = value.stock;
  form.elements.sold.value = value.sold;
  form.elements.rating.value = value.rating;
  form.elements.isActive.value = String(value.isActive !== false);
  form.elements.sortOrder.value = Number(value.sortOrder || 0);
  form.elements.delivery.value = value.delivery;
  form.elements.warranty.value = value.warranty;
  form.elements.image.value = value.image;
  form.elements.heroImage.value = value.heroImage;
  form.elements.gallery.value = (value.gallery ?? []).join("\n");
  form.elements.platformLinks.value = serializePipeRows(value.platformLinks, ["label", "url", "icon"]);
  form.elements.featureBlocks.value = serializePipeRows(value.featureBlocks, ["icon", "title", "text"]);
  form.elements.detailSections.value = serializePipeRows(value.detailSections, ["title", "body"]);
  form.elements.steamRelatedLinks.value = (value.steamRelatedLinks ?? []).join("\n");
  const badges = normalizeBadgeOverrides(value.badgeOverrides);
  form.elements.badge1Label.value = badges[0]?.label || "";
  form.elements.badge2Label.value = badges[1]?.label || "";
  form.elements.badge1Tone.innerHTML = badgeToneOptions(badges[0]?.tone || "auto");
  form.elements.badge2Tone.innerHTML = badgeToneOptions(badges[1]?.tone || "auto");
  const sysReq = value.systemRequirements;
  const isLegacy = Array.isArray(sysReq);
  form.elements.systemRequirementsMinimum.value = (isLegacy ? sysReq : (sysReq?.minimum ?? [])).join("\n");
  form.elements.systemRequirementsRecommended.value = (isLegacy ? [] : (sysReq?.recommended ?? [])).join("\n");
  form.elements.tags.value = (value.tags ?? []).join(", ");
  form.elements.description.value = value.description;
  renderProductPackagesEditor(product);
  renderOfflineStockEditor(value);
}

function isAcceptableImageUrl(value) {
  const text = String(value || "").trim();
  if (!text) return true;
  if (/\s/.test(text)) return false;
  if (text.startsWith("data:image/")) return true;
  if (text.startsWith("/") || text.startsWith("./") || text.startsWith("../")) return true;
  try {
    const parsed = new URL(text);
    return parsed.protocol === "http:" || parsed.protocol === "https:";
  } catch (error) {
    return false;
  }
}

function isSteamStoreAppUrl(value) {
  const text = String(value || "").trim();
  if (!text) return false;
  try {
    const parsed = new URL(text);
    return /(^|\.)steampowered\.com$/i.test(parsed.hostname) && /\/app\/\d+/i.test(parsed.pathname);
  } catch (error) {
    return false;
  }
}

function validateNonNegativeNumber(value, label) {
  if (!Number.isFinite(value) || value < 0) {
    throw new Error(`${label} ต้องเป็นตัวเลขตั้งแต่ 0 ขึ้นไป`);
  }
}

function validateNonNegativeInteger(value, label) {
  validateNonNegativeNumber(value, label);
  if (!Number.isInteger(value)) {
    throw new Error(`${label} ต้องเป็นจำนวนเต็ม`);
  }
}

function validateAdminProduct(product, { isNew, selectedProductId }) {
  if (!product.name.trim()) throw new Error("กรุณากรอกชื่อสินค้า");
  if (!product.id.trim()) throw new Error("กรุณากรอก Product ID");
  if (!isNew && !selectedProductId) throw new Error("ไม่พบ Product ID ของสินค้าที่กำลังแก้ไข");
  if (!isNew && product.id !== selectedProductId) {
    throw new Error("ไม่สามารถเปลี่ยน Product ID ของสินค้าที่มีอยู่แล้ว");
  }
  validateNonNegativeNumber(product.price, "ราคาขาย");
  if (product.compareAt != null) validateNonNegativeNumber(product.compareAt, "ราคาเต็ม");
  validateNonNegativeInteger(product.stock, "สต็อก");
  validateNonNegativeInteger(product.sold, "ขายแล้ว");
  validateNonNegativeInteger(product.sortOrder, "ลำดับแสดงผล");
  if (!isAcceptableImageUrl(product.image)) throw new Error("URL รูปสินค้าไม่ถูกต้อง");
  if (!isAcceptableImageUrl(product.heroImage)) throw new Error("URL รูป Hero ไม่ถูกต้อง");
  if ((product.gallery || []).some((url) => !isAcceptableImageUrl(url))) {
    throw new Error("URL ในแกลเลอรีรูปสินค้าไม่ถูกต้อง");
  }
  if ((product.steamRelatedLinks || []).some((url) => !isSteamStoreAppUrl(url))) {
    throw new Error("ลิงก์เนื้อหาเกม / DLC ต้องเป็นลิงก์ Steam รูปแบบ store.steampowered.com/app/...");
  }
}

function productToSupabaseRow(product, { includeId = false, includeStock = false } = {}) {
  const row = {
    name: product.name.trim(),
    publisher: product.publisher || null,
    category: product.category || "steam-key",
    label: product.label || null,
    price: Number(product.price || 0),
    compare_at: product.compareAt == null ? null : Number(product.compareAt),
    sold: Number(product.sold || 0),
    rating: product.rating || null,
    delivery: product.delivery || null,
    warranty: product.warranty || null,
    image_url: product.image || null,
    hero_image_url: product.heroImage || product.image || null,
    tags: Array.isArray(product.tags) ? product.tags : [],
    description: product.description || null,
    gallery: Array.isArray(product.gallery) ? product.gallery : [],
    platform_links: Array.isArray(product.platformLinks) ? product.platformLinks : [],
    feature_blocks: Array.isArray(product.featureBlocks) ? product.featureBlocks : [],
    detail_sections: Array.isArray(product.detailSections) ? product.detailSections : [],
    steam_related_links: Array.isArray(product.steamRelatedLinks) ? product.steamRelatedLinks : [],
    system_requirements: product.systemRequirements || { minimum: [], recommended: [] },
    steam_app_id: product.steamAppId == null || product.steamAppId === "" ? null : String(product.steamAppId),
    source_metadata: product.sourceMetadata && typeof product.sourceMetadata === "object" ? product.sourceMetadata : {},
    badge_overrides: normalizeBadgeOverrides(product.badgeOverrides),
    is_active: product.isActive !== false,
    sort_order: Number(product.sortOrder || 0)
  };
  if (includeId) row.id = product.id.trim();
  if (includeStock) row.stock = Number(product.stock || 0);
  return row;
}

function isMissingSteamRelatedLinksColumn(error) {
  const code = String(error?.code || "");
  const message = String(error?.message || "").toLowerCase();
  return (
    (code === "PGRST204" || code === "42703" || message.includes("schema cache")) &&
    message.includes("steam_related_links")
  );
}

function isMissingOptionalProductColumns(error) {
  const code = String(error?.code || "");
  const message = String(error?.message || "").toLowerCase();
  return (
    (code === "PGRST204" || code === "42703" || message.includes("schema cache")) &&
    (message.includes("steam_app_id") ||
      message.includes("source_metadata") ||
      message.includes("badge_overrides") ||
      message.includes("steam_related_links"))
  );
}

function stripOptionalProductColumns(row) {
  const compatibleRow = { ...row };
  delete compatibleRow.steam_related_links;
  delete compatibleRow.steam_app_id;
  delete compatibleRow.source_metadata;
  delete compatibleRow.badge_overrides;
  return compatibleRow;
}

async function writeAdminProductRow({ client, isNew, productId, row }) {
  const execute = (payload) => {
    if (isNew) {
      return client.from("products").insert([payload]).select("*").single();
    }
    return client.from("products").update(payload).eq("id", productId).select("*").single();
  };

  let result = await execute(row);
  let skippedSteamRelatedLinks = false;

  if (result.error && isMissingOptionalProductColumns(result.error)) {
    result = await execute(stripOptionalProductColumns(row));
    skippedSteamRelatedLinks = true;
  }

  return { ...result, skippedSteamRelatedLinks };
}

function replaceProductInState(product) {
  const index = products().findIndex((item) => item.id === product.id);
  if (index >= 0) {
    state.payload.products[index] = product;
  } else {
    state.payload.products.unshift(product);
  }
  state.payload.categories = categoriesForAdminProducts(state.payload.products);
  state.payload.updatedAt = product.updatedAt || new Date().toISOString();
}

function adminProductErrorMessage(error) {
  const message = String(error?.message || "");
  const code = String(error?.code || "");
  if (isMissingSteamRelatedLinksColumn(error)) {
    return "ฐานข้อมูลยังไม่มีช่องลิงก์เนื้อหาเกม/DLC กรุณารัน supabase-admin-products-repair.sql";
  }
  if (code === "PGRST116") {
    return "ไม่พบสินค้าที่แก้ไขหรือบัญชีแอดมินไม่มีสิทธิ์เห็นสินค้านี้ กรุณารัน supabase-admin-products-repair.sql";
  }
  if (code === "23505" || message.toLowerCase().includes("duplicate")) return "Product ID นี้ถูกใช้แล้ว";
  if (
    message.includes("product_packages") ||
    message.includes("admin_save_product_package") ||
    message.includes("admin_delete_product_package")
  ) {
    return "ยังไม่ได้รัน supabase-product-packages.sql หรือสิทธิ์ package ยังไม่พร้อม";
  }
  if (message.includes("IMPORTED_STOCK_REQUIRES_BATCH_IMPORT")) {
    return "สินค้านี้ใช้สต็อกจาก batch import แล้ว ต้องอัปเดตผ่าน Phase 5 importer เพื่อรักษา idempotency และประวัติสต็อก";
  }
  if (
    message.includes("offline_stock_items") ||
    message.includes("admin_fetch_offline_stock_items") ||
    message.includes("admin_replace_offline_stock_items") ||
    message.includes("Offline stock client")
  ) {
    return "ยังไม่ได้รัน supabase-offline-stock-items.sql เวอร์ชันล่าสุด หรือสิทธิ์สต็อกรายชิ้นยังไม่พร้อม";
  }
  if (message.toLowerCase().includes("permission") || message.toLowerCase().includes("rls")) {
    return "บัญชีนี้ไม่มีสิทธิ์แก้ไขสินค้า";
  }
  return message || "บันทึกสินค้าไม่สำเร็จ";
}

function adminStockErrorMessage(error) {
  const message = String(error?.message || "");
  const code = String(error?.code || "");
  const lower = message.toLowerCase();
  if (message.includes("STOCK_TEMPLATE_REQUIRED")) {
    return "สินค้านี้ยังไม่มีข้อมูลบัญชีให้ทำสำเนา กรุณาเปิด “แก้ข้อมูลบัญชีที่ Available” แล้วใส่ข้อมูลอย่างน้อย 1 รายการก่อนเพิ่มจำนวน";
  }
  if (
    message.includes("admin_resize_offline_stock") ||
    message.includes("admin_inventory_summary")
  ) {
    return "กรุณารัน supabase-admin-inventory-management.sql ใน Supabase ก่อนใช้ตัวจัดการสต็อกแบบใหม่";
  }
  if (
    code === "PGRST202" ||
    code === "42883" ||
    message.includes("admin_set_product_stock") ||
    lower.includes("schema cache")
  ) {
    return "ยังไม่ได้รัน supabase-orders-admin.sql หรือ RPC admin_set_product_stock ยังไม่พร้อม";
  }
  if (message.includes("ADMIN_REQUIRED")) return "บัญชีนี้ไม่มีสิทธิ์แอดมินสำหรับแก้สต็อก";
  if (message.includes("OFFLINE_STOCK_REQUIRES_ITEMS")) {
    return "สินค้าหมวดนี้ต้องจัดการสต็อกแบบ 1 บรรทัดต่อ 1 ชิ้นในฟอร์มสินค้า";
  }
  if (message.includes("PRODUCT_NOT_FOUND")) return "ไม่พบสินค้านี้ในฐานข้อมูล";
  if (message.includes("INVALID_STOCK")) return "จำนวนสต็อกไม่ถูกต้อง";
  if (lower.includes("permission") || lower.includes("rls")) {
    return "บัญชีนี้ไม่มีสิทธิ์แก้ไขสต็อกสินค้าใน Supabase";
  }
  return message || "อัปเดตสต็อกไม่สำเร็จ";
}

function adminUserErrorMessage(error) {
  const message = String(error?.message || "");
  if (message.includes("PASSWORD_TOO_SHORT")) return "รหัสผ่านใหม่ต้องมีอย่างน้อย 6 ตัวอักษร";
  if (message.includes("CONFIG_REQUIRED")) return "ยังไม่ได้ตั้งค่า Environment Variables สำหรับ API เปลี่ยนรหัสผ่าน";
  if (message.includes("PASSWORD_UPDATE_FAILED")) return "บันทึกข้อมูล user แล้ว แต่เปลี่ยนรหัสผ่านไม่สำเร็จ";
  if (message.includes("PASSWORD_MANAGED_IN_SUPABASE_AUTH")) {
    return "รหัสผ่านของ Auth user ต้องเปลี่ยนใน Supabase Dashboard > Authentication > Users";
  }
  if (message.includes("AUTH_USER_NOT_FOUND")) {
    return "ไม่พบ Auth user อีเมลนี้ ให้สมัครสมาชิกหรือสร้าง user ใน Supabase Authentication ก่อน";
  }
  if (message.includes("ADMIN_REQUIRED")) return "บัญชีนี้ไม่มีสิทธิ์จัดการ user";
  if (message.includes("admin_list_profiles") || message.includes("admin_save_profile")) {
    return "ยังไม่ได้รัน supabase-admin-users.sql ใน Supabase";
  }
  if (message.toLowerCase().includes("permission") || message.toLowerCase().includes("rls")) {
    return "บัญชีนี้ไม่มีสิทธิ์แก้ไข user ใน Supabase";
  }
  return message || "บันทึก user ไม่สำเร็จ";
}

function adminPointAdjustErrorMessage(error) {
  const code = String(error?.code || "");
  const message = String(error?.message || "");
  const details = String(error?.details || "");
  const hint = String(error?.hint || "");
  const combined = `${code} ${message} ${details} ${hint}`;
  const lower = combined.toLowerCase();

  if (combined.includes("POINT_BALANCE_WOULD_BE_NEGATIVE")) {
    return "Point คงเหลือไม่พอสำหรับการลดจำนวนนี้";
  }
  if (combined.includes("POINT_AMOUNT_REQUIRED")) {
    return "กรุณาใส่จำนวน Point ที่ต้องการปรับ เช่น 50 หรือ -20";
  }
  if (combined.includes("USER_REQUIRED")) {
    return "กรุณาเลือกลูกค้าก่อนปรับ Point";
  }
  if (combined.includes("ADMIN_REQUIRED")) {
    return "บัญชีนี้ยังไม่มีสิทธิ์แอดมินสำหรับปรับ Point";
  }
  if (
    code === "PGRST202" ||
    code === "42883" ||
    lower.includes("admin_adjust_user_points") ||
    lower.includes("schema cache")
  ) {
    return "ยังไม่ได้รัน supabase-admin-point-adjust-fix.sql หรือ RPC admin_adjust_user_points ยังไม่พร้อมใน Supabase";
  }
  if (lower.includes("point_transactions_type_check")) {
    return "ชนข้อจำกัดประวัติ Point กรุณารัน supabase-admin-point-adjust-fix.sql อีกครั้ง";
  }
  if (lower.includes("permission") || lower.includes("rls")) {
    return "บัญชีนี้ไม่มีสิทธิ์ปรับ Point ใน Supabase";
  }
  return message || "ปรับ Point ไม่สำเร็จ";
}

function productFromForm(form) {
  const previousProduct = selectedProduct();
  const name = form.elements.name.value.trim();
  const id = form.elements.id.value.trim() || slugify(name);
  const image = form.elements.image.value.trim();
  const heroImage = form.elements.heroImage.value.trim() || image;
  const gallery = uniqueList(compactLines(form.elements.gallery.value)).slice(0, 6);
  const compareAtValue = form.elements.compareAt.value.trim();
  
  const category = form.elements.category.value;
  const stock = isOfflineProductCategory(category)
    ? offlineStockLinesFromEditor().length
    : Number(form.elements.stock.value) || 0;

  return {
    id,
    name,
    publisher: form.elements.publisher.value.trim(),
    category,
    label: form.elements.label.value.trim(),
    price: Number(form.elements.price.value) || 0,
    compareAt: compareAtValue === "" ? null : Number(compareAtValue),
    stock,
    sold: Number(form.elements.sold.value) || 0,
    rating: form.elements.rating.value.trim(),
    isActive: form.elements.isActive.value !== "false",
    sortOrder: Number(form.elements.sortOrder.value) || 0,
    delivery: form.elements.delivery.value.trim(),
    warranty: form.elements.warranty.value.trim(),
    image,
    heroImage,
    gallery,
    platformLinks: parsePipeRows(form.elements.platformLinks.value, ["label", "url", "icon"], {
      icon: "external-link"
    }).filter((link) => link.label && link.url),
    featureBlocks: parsePipeRows(form.elements.featureBlocks.value, ["icon", "title", "text"], {
      icon: "sparkles"
    }).filter((feature) => feature.title || feature.text),
    detailSections: parsePipeRows(form.elements.detailSections.value, ["title", "body"]).filter(
      (section) => section.title || section.body
    ),
    steamRelatedLinks: uniqueList(compactLines(form.elements.steamRelatedLinks.value)),
    steamAppId: previousProduct?.steamAppId ?? null,
    sourceMetadata:
      previousProduct?.sourceMetadata && typeof previousProduct.sourceMetadata === "object"
        ? previousProduct.sourceMetadata
        : {},
    badgeOverrides: normalizeBadgeOverrides([
      {
        label: form.elements.badge1Label?.value,
        tone: form.elements.badge1Tone?.value
      },
      {
        label: form.elements.badge2Label?.value,
        tone: form.elements.badge2Tone?.value
      }
    ]),
    systemRequirements: {
      minimum: compactLines(form.elements.systemRequirementsMinimum.value),
      recommended: compactLines(form.elements.systemRequirementsRecommended.value)
    },
    tags: form.elements.tags.value
      .split(",")
      .map((tag) => tag.trim())
      .filter(Boolean),
    description: form.elements.description.value.trim()
  };
}

async function saveProductFromForm(event) {
  event.preventDefault();
  const form = event.currentTarget;
  const product = productFromForm(event.currentTarget);
  const packageDrafts = packageDraftsFromEditor();
  const isOfflineProduct = isOfflineProductCategory(product.category);
  const offlineStockLines = isOfflineProduct ? offlineStockLinesFromEditor() : [];
  const isNew = !state.selectedProductId;
  const previous = isNew ? null : selectedProduct();

  const submitButton = form.querySelector("button[type='submit']");
  const originalText = submitButton.innerHTML;
  submitButton.disabled = true;
  submitButton.innerHTML = '<i data-lucide="loader-circle"></i> กำลังบันทึก';
  createIconSet();

  try {
    validateAdminProduct(product, { isNew, selectedProductId: state.selectedProductId });
    validateAdminPackages(packageDrafts);
    if (isOfflineProduct) validateOfflineStockLines(offlineStockLines);
    if (isNew && products().some((item) => item.id === product.id)) {
      throw new Error("Product ID นี้ถูกใช้แล้ว");
    }

    const client = requireSupabaseAdminClient();
    const requestedStock = isOfflineProduct ? offlineStockLines.length : Number(product.stock || 0);
    let savedProduct;
    let skippedSteamRelatedLinks = false;

    if (isNew) {
      const insertRow = {
        ...productToSupabaseRow(product, { includeId: true }),
        stock: 0
      };
      const result = await writeAdminProductRow({
        client,
        isNew: true,
        productId: product.id,
        row: insertRow
      });
      const { data, error } = result;
      if (error) throw error;
      skippedSteamRelatedLinks = result.skippedSteamRelatedLinks;
      savedProduct = mapSupabaseProductRow(data);
    } else {
      const result = await writeAdminProductRow({
        client,
        isNew: false,
        productId: state.selectedProductId,
        row: productToSupabaseRow(product)
      });
      const { data, error } = result;
      if (error) throw error;
      skippedSteamRelatedLinks = result.skippedSteamRelatedLinks;
      savedProduct = mapSupabaseProductRow(data);
    }

    if (!isOfflineProduct && Number(savedProduct.stock || 0) !== requestedStock) {
      const adjustedProduct = await window.OlafProducts.setAdminProductStock({
        productId: savedProduct.id,
        stock: requestedStock,
        note: previous ? "แก้ยอดคงเหลือจากฟอร์มสินค้า" : "ตั้งค่าสต็อกสินค้าใหม่"
      });
      savedProduct = adjustedProduct || savedProduct;
    }

    if (isOfflineProduct) {
      if (!window.OlafProducts?.adminReplaceOfflineStockItems) {
        throw new Error("Offline stock client is not ready");
      }
      const offlineResult = await window.OlafProducts.adminReplaceOfflineStockItems(savedProduct.id, offlineStockLines);
      if (offlineResult.product) savedProduct = offlineResult.product;
      setCachedOfflineStockItems(savedProduct.id, offlineResult.items || []);
      delete state.offlineStockItems.__new__;
    }

    if (packageDrafts.length) {
      if (!window.OlafProducts?.adminSaveProductPackages) {
        throw new Error("Product package client is not ready");
      }
      const savedPackages = await window.OlafProducts.adminSaveProductPackages(savedProduct.id, packageDrafts);
      setCachedProductPackages(savedProduct.id, savedPackages.map(normalizeAdminPackage));
      delete state.productPackages.__new__;
    } else {
      setCachedProductPackages(savedProduct.id, []);
      delete state.productPackages.__new__;
    }

    replaceProductInState(savedProduct);
    await refreshInventorySummaries();
    state.selectedProductId = savedProduct.id;
    renderAll();
    const updatedAt = savedProduct.updatedAt
      ? new Date(savedProduct.updatedAt).toLocaleString("th-TH")
      : new Date().toLocaleString("th-TH");
    setStatus(`บันทึกข้อมูลสินค้าเรียบร้อยแล้ว ${updatedAt}`);
    if (skippedSteamRelatedLinks) {
      showAdminToast(
        "บันทึกสินค้าแล้ว แต่ยังไม่บันทึกลิงก์ DLC กรุณารัน supabase-admin-products-repair.sql",
        "warning",
        7000
      );
    } else if (savedProduct?._stockFallback) {
      showAdminToast("บันทึกสินค้าแล้ว แต่ stock log ต้องรัน supabase-orders-admin.sql เพิ่ม", "warning");
    } else {
      showAdminToast("บันทึกข้อมูลสินค้าเรียบร้อยแล้ว", "success");
    }
    if (isAdminMobileViewport()) closeMobileProductEditor();
  } catch (error) {
    console.error("Supabase product save failed", {
      code: error?.code,
      message: error?.message,
      details: error?.details,
      hint: error?.hint
    });
    const message = adminProductErrorMessage(error);
    setStatus(message);
    showAdminToast(message, "error");
  } finally {
    submitButton.disabled = false;
    submitButton.innerHTML = originalText;
    createIconSet();
  }
}

async function deleteSelectedProduct() {
  const product = selectedProduct();
  if (!product) return;
  if (!(await adminConfirm(`ปิดการขายสินค้า ${product.name} ใช่ไหม? สินค้าจะไม่แสดงหน้าร้าน แต่ข้อมูลยังอยู่ใน Supabase`))) return;

  try {
    const { data, error } = await requireSupabaseAdminClient()
      .from("products")
      .update({ is_active: false })
      .eq("id", product.id)
      .select("*")
      .single();
    if (error) throw error;
    const updatedProduct = mapSupabaseProductRow(data);
    replaceProductInState(updatedProduct);
    state.selectedProductId = updatedProduct.id;
    renderAll();
    setStatus("ปิดการขายสินค้าแล้ว");
    showAdminToast("ปิดการขายสินค้าเรียบร้อยแล้ว", "success");
  } catch (error) {
    console.error("Supabase product deactivate failed", {
      code: error?.code,
      message: error?.message,
      details: error?.details,
      hint: error?.hint
    });
    const message = adminProductErrorMessage(error);
    setStatus(message);
    showAdminToast(message, "error");
  }
}

function renderUsersTable() {
  const walletRows = new Map(financeWalletRows().map((row) => [row.userId, row]));
  const term = String(state.userSearch || "").trim().toLowerCase();
  const rows = state.users.filter((user) => !term || [
    user.id,
    user.email,
    user.username,
    user.displayName,
    user.fullName,
    user.role,
    user.position,
    user.partnerLevel,
    user.status
  ].some((value) => String(value || "").toLowerCase().includes(term)));
  setTextSafe("#users-count", term
    ? `${rows.length.toLocaleString("th-TH")} จาก ${state.users.length.toLocaleString("th-TH")} users`
    : `${state.users.length.toLocaleString("th-TH")} users`);
  $("#users-table").innerHTML = rows.length
    ? rows
        .map(
          (user) => {
            const wallet = walletRows.get(user.id) || {};
            return `
            <tr>
              <td>
                <div class="user-cell">
                  <span class="user-avatar">${escapeHtml((user.displayName || user.username || "U").slice(0, 1).toUpperCase())}</span>
                  <div>
                    <strong>${escapeHtml(user.displayName || user.username)}</strong>
                    <span>${escapeHtml(user.email)}</span>
                  </div>
                </div>
              </td>
              <td><span class="status-pill ${user.role === "admin" ? "warn" : "ok"}">${escapeHtml(user.role)}</span></td>
              <td>${escapeHtml(user.position || "-")}</td>
              <td class="numeric"><strong>${formatPointAmount(wallet.balance || 0)}</strong></td>
              <td class="numeric">${Number(wallet.orderCount || 0).toLocaleString("th-TH")}</td>
              <td class="numeric">${formatPrice(wallet.totalSpent || 0)}</td>
              <td><span class="status-pill ${user.status === "active" ? "ok" : "danger"}">${escapeHtml(user.status)}</span></td>
              <td>
                <div class="row-actions">
                  <button class="mini-button" type="button" data-edit-user="${escapeHtml(user.id)}">
                    <i data-lucide="pencil"></i>
                  </button>
                  <button class="mini-button" type="button" data-reset-pw="${escapeHtml(user.id)}" title="เปลี่ยนรหัสผ่าน">
                    <i data-lucide="key-round"></i>
                  </button>
                </div>
              </td>
            </tr>
          `;
          }
        )
        .join("")
    : `<tr><td colspan="8">${term ? "ไม่พบ user ที่ตรงกับคำค้นหา" : "ยังไม่มี user"}</td></tr>`;
}

function userFromForm(form) {
  return {
    id: state.selectedUserId || null,
    email: form.elements.email.value.trim().toLowerCase(),
    username: form.elements.username.value.trim(),
    displayName: form.elements.displayName.value.trim(),
    fullName: form.elements.displayName.value.trim(),
    password: form.elements.password.value,
    role: form.elements.role.value,
    position: form.elements.position.value.trim() || "Member",
    partnerLevel: form.elements.partnerLevel.value,
    status: form.elements.status.value
  };
}

function replaceUserInState(user) {
  const index = state.users.findIndex((item) => item.id === user.id);
  if (index >= 0) {
    state.users[index] = user;
  } else {
    state.users.unshift(user);
  }
}

function renderUserForm() {
  fillUserForm(selectedUser());
}

function walletRowForUser(userId) {
  return financeWalletRows().find((row) => row.userId === userId) || null;
}

function fillUserForm(user) {
  const form = $("#user-form");
  const isNew = !user;
  $("#user-form-title").textContent = isNew ? "เพิ่ม user ใหม่" : "แก้ไข user";
  $("#editing-user-id").textContent = isNew ? "user ใหม่" : user.id;
  $("#delete-user").disabled = isNew;
  const value = user ?? {
    email: "",
    username: "",
    displayName: "",
    role: "customer",
    position: "Member",
    partnerLevel: "none",
    status: "active"
  };
  form.elements.email.value = value.email;
  form.elements.username.value = value.username;
  form.elements.displayName.value = value.displayName;
  form.elements.password.value = "";
  form.elements.role.value = value.role;
  form.elements.position.value = value.position;
  form.elements.partnerLevel.value = value.partnerLevel;
  form.elements.status.value = value.status;
  if (form.elements.pointAdjustAmount) form.elements.pointAdjustAmount.value = "";
  if (form.elements.pointAdjustNote) form.elements.pointAdjustNote.value = "";
  const wallet = user?.id ? walletRowForUser(user.id) : null;
  const pointLabel = $("#user-current-point");
  if (pointLabel) pointLabel.textContent = `${formatPointAmount(wallet?.balance || 0)} Points`;
  const pointButton = $("#adjust-user-point");
  if (pointButton) pointButton.disabled = isNew;
}

async function saveUserFromForm(event) {
  event.preventDefault();
  const form = event.currentTarget;
  const submitButton = form.querySelector("button[type='submit']");
  const originalText = submitButton.innerHTML;
  submitButton.disabled = true;
  submitButton.innerHTML = '<i data-lucide="loader-circle"></i> กำลังบันทึก user';
  createIconSet();

  try {
    const savedUser = await window.OlafAdminUsers.saveAdminUser(userFromForm(form));
    replaceUserInState(savedUser);
    state.selectedUserId = savedUser.id;
    renderUsersTable();
    renderUserForm();
    createIconSet();
    setStatus(`บันทึก user ${savedUser.email} แล้ว`);
    showAdminToast("บันทึก user ไปที่ Supabase แล้ว", "success");
    closeMobileAdminEditor();
  } catch (error) {
    console.error("Supabase admin user save failed", {
      code: error?.code,
      message: error?.message,
      details: error?.details,
      hint: error?.hint
    });
    const message = adminUserErrorMessage(error);
    setStatus(message);
    showAdminToast(message, "error");
  } finally {
    submitButton.disabled = false;
    submitButton.innerHTML = originalText;
    createIconSet();
  }
}

async function adjustSelectedUserPoints() {
  const user = selectedUser();
  const form = $("#user-form");
  if (!user || !form) return;
  const amount = Number(form.elements.pointAdjustAmount?.value || 0);
  const note = String(form.elements.pointAdjustNote?.value || "").trim();
  if (!Number.isFinite(amount) || amount === 0) {
    showAdminToast("กรุณาใส่จำนวน Point ที่ต้องการปรับ เช่น 50 หรือ -20", "warning");
    return;
  }
  if (!(await adminConfirm(`ปรับ Point ของ ${user.email || user.username} จำนวน ${amount > 0 ? "+" : ""}${formatPointAmount(amount)} ใช่ไหม?`))) return;

  const button = $("#adjust-user-point");
  const originalText = button?.innerHTML || "";
  if (button) {
    button.disabled = true;
    button.innerHTML = '<i data-lucide="loader-circle"></i> กำลังปรับ Point';
    createIconSet();
  }

  try {
    const overview = await window.OlafAdminFinance.adminAdjustUserPoints({
      userId: user.id,
      amount,
      note
    });
    state.finance = normalizeFinanceOverview(overview);
    renderUsersTable();
    renderUserForm();
    renderFinancePanel();
    renderMetrics();
    createIconSet();
    showAdminToast("ปรับ Point ลูกค้าเรียบร้อยแล้ว", "success");
    setStatus(`ปรับ Point ${user.email || user.username} แล้ว`);
  } catch (error) {
    console.error("Supabase admin point adjustment failed", {
      code: error?.code,
      message: error?.message,
      details: error?.details,
      hint: error?.hint
    });
    const message = adminPointAdjustErrorMessage(error);
    showAdminToast(message, "error");
    setStatus(message);
  } finally {
    if (button) {
      button.disabled = false;
      button.innerHTML = originalText;
      createIconSet();
    }
  }
}

async function deleteSelectedUser() {
  const user = selectedUser();
  if (!user) return;
  if (!(await adminConfirm(`ระงับ user ${user.email} ใช่ไหม? Auth account จะยังอยู่ใน Supabase แต่ status จะเปลี่ยนเป็น banned`))) return;

  try {
    const updatedUser = await window.OlafAdminUsers.disableAdminUser(user.id);
    replaceUserInState(updatedUser);
    state.selectedUserId = updatedUser.id;
    renderUsersTable();
    renderUserForm();
    createIconSet();
    setStatus(`ระงับ user ${updatedUser.email} แล้ว`);
    showAdminToast("เปลี่ยนสถานะ user เป็น banned แล้ว", "success");
    closeMobileAdminEditor();
  } catch (error) {
    console.error("Supabase admin user disable failed", {
      code: error?.code,
      message: error?.message,
      details: error?.details,
      hint: error?.hint
    });
    const message = adminUserErrorMessage(error);
    setStatus(message);
    showAdminToast(message, "error");
  }
}

function adminResetPassword(userId) {
  const user = state.users.find((item) => item.id === userId);
  if (!user) return;
  state.selectedUserId = user.id;
  switchPanel("users");
  renderUserForm();
  openAdminEditorForCurrentViewport("user");
  requestAnimationFrame(() => $("#user-form")?.elements?.password?.focus({ preventScroll: true }));
  setStatus(`กรอกรหัสผ่านใหม่สำหรับ ${user.email || user.username} แล้วกดบันทึก user`);
  showAdminToast("กรอกรหัสผ่านใหม่ในฟอร์ม แล้วกดบันทึก user เพื่อเปลี่ยนผ่าน server-side API", "success", 6500);
}

function isRevenueOrder(order) {
  return order && !["cancelled", "expired"].includes(String(order.status || "").toLowerCase());
}

function startOfLocalDay(date = new Date()) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function orderMatchesFinancePeriod(order, period = state.financeOrderPeriod) {
  if (!order?.createdAt || period === "all") return true;
  const orderDate = new Date(order.createdAt);
  if (Number.isNaN(orderDate.getTime())) return true;
  const now = new Date();
  if (period === "day") return orderDate >= startOfLocalDay(now);
  if (period === "week") {
    const weekStart = startOfLocalDay(now);
    weekStart.setDate(weekStart.getDate() - 6);
    return orderDate >= weekStart;
  }
  if (period === "year") {
    const yearStart = new Date(now.getFullYear(), 0, 1);
    return orderDate >= yearStart;
  }
  return true;
}

function financePeriodLabel(period = state.financeOrderPeriod) {
  return {
    all: "ทั้งหมด",
    day: "รายวัน",
    week: "รายสัปดาห์",
    year: "รายปี"
  }[period] || "ทั้งหมด";
}

function adminUserLabel(user = {}) {
  return user.displayName || user.fullName || user.username || user.customerName || user.email || "Customer";
}

function financeUserMap() {
  const map = new Map();
  state.users.forEach((user) => {
    if (!user?.id) return;
    map.set(user.id, {
      userId: user.id,
      email: user.email || "",
      username: user.username || "",
      displayName: user.displayName || user.fullName || user.username || user.email || "Customer",
      fullName: user.fullName || user.displayName || "",
      role: user.role || "customer",
      status: user.status || "active"
    });
  });
  state.finance.wallets.forEach((wallet) => {
    if (!wallet?.userId) return;
    map.set(wallet.userId, {
      ...(map.get(wallet.userId) || {}),
      ...wallet,
      displayName: wallet.displayName || wallet.fullName || wallet.username || wallet.email || map.get(wallet.userId)?.displayName || "Customer"
    });
  });
  state.orders.forEach((order) => {
    if (!order?.userId || map.has(order.userId)) return;
    map.set(order.userId, {
      userId: order.userId,
      email: order.customerEmail || "",
      username: order.customerName || "",
      displayName: order.customerName || order.customerEmail || "Customer",
      fullName: order.customerName || "",
      role: "customer",
      status: "active"
    });
  });
  return map;
}

function financeWalletMap() {
  return new Map(state.finance.wallets.filter((wallet) => wallet?.userId).map((wallet) => [wallet.userId, wallet]));
}

function ordersForUser(userId) {
  return state.orders.filter((order) => order.userId && order.userId === userId);
}

function financeWalletRows() {
  const users = financeUserMap();
  const wallets = financeWalletMap();
  return [...users.values()]
    .map((user) => {
      const wallet = wallets.get(user.userId) || {};
      const userOrders = ordersForUser(user.userId);
      const revenueOrders = userOrders.filter(isRevenueOrder);
      const totalSpent = revenueOrders.reduce((sum, order) => sum + Number(order.total || 0), 0);
      const lastOrderAt =
        userOrders
          .map((order) => order.createdAt)
          .filter(Boolean)
          .sort()
          .at(-1) || "";
      return {
        ...user,
        balance: Number(wallet.balance || 0),
        lifetimeEarned: Number(wallet.lifetimeEarned || wallet.lifetime_earned || 0),
        lifetimeSpent: Number(wallet.lifetimeSpent || wallet.lifetime_spent || 0),
        orderCount: userOrders.length,
        totalSpent,
        lastOrderAt
      };
    })
    .sort((a, b) => b.totalSpent - a.totalSpent || b.balance - a.balance || b.orderCount - a.orderCount);
}

function financeSummary() {
  const wallets = financeWalletRows();
  const revenueOrders = state.orders.filter(isRevenueOrder);
  const totalRevenue = revenueOrders.reduce((sum, order) => sum + Number(order.total || 0), 0);
  const pointBalance = wallets.reduce((sum, wallet) => sum + Number(wallet.balance || 0), 0);
  const pointEarned = wallets.reduce((sum, wallet) => sum + Number(wallet.lifetimeEarned || 0), 0);
  const pointSpent = wallets.reduce((sum, wallet) => sum + Number(wallet.lifetimeSpent || 0), 0);
  return {
    totalRevenue,
    pointBalance,
    pointEarned,
    pointSpent,
    orderCount: state.orders.length,
    revenueOrderCount: revenueOrders.length
  };
}

function financeSearchValue() {
  return String(state.financeSearch || "").trim().toLowerCase();
}

function financeMatches(values) {
  const term = financeSearchValue();
  if (!term) return true;
  return values.some((value) => String(value || "").toLowerCase().includes(term));
}

function financePager(key) {
  if (!state.financePagination[key]) state.financePagination[key] = { page: 1, pageSize: 20 };
  const pager = state.financePagination[key];
  const safeSize = [20, 50, 100].includes(Number(pager.pageSize)) ? Number(pager.pageSize) : 20;
  pager.pageSize = safeSize;
  pager.page = Math.max(1, Number(pager.page || 1));
  return pager;
}

function resetFinancePage(key = null) {
  if (key) {
    financePager(key).page = 1;
    return;
  }
  Object.keys(state.financePagination).forEach((name) => {
    financePager(name).page = 1;
  });
}

function paginateRows(key, rows) {
  const pager = financePager(key);
  const total = rows.length;
  const totalPages = Math.max(1, Math.ceil(total / pager.pageSize));
  pager.page = Math.min(Math.max(1, pager.page), totalPages);
  const start = (pager.page - 1) * pager.pageSize;
  return {
    rows: rows.slice(start, start + pager.pageSize),
    total,
    totalPages,
    page: pager.page,
    pageSize: pager.pageSize,
    start,
    end: Math.min(start + pager.pageSize, total)
  };
}

function renderFinancePagination(key, total, page, totalPages, start, end) {
  const table = $(`#finance-${key === "wallets" ? "wallets" : key === "transactions" ? "transactions" : key === "orders" ? "orders" : "verifications"}-table`);
  const wrap = table?.closest(".table-wrap");
  if (!wrap) return;
  let controls = wrap.nextElementSibling;
  if (!controls?.classList?.contains("finance-pagination")) {
    controls = document.createElement("div");
    controls.className = "finance-pagination";
    wrap.insertAdjacentElement("afterend", controls);
  }
  const pager = financePager(key);
  controls.innerHTML = `
    <div class="finance-page-info">
      <strong>${total ? `${(start + 1).toLocaleString("th-TH")} - ${end.toLocaleString("th-TH")}` : "0"}</strong>
      <span>จาก ${total.toLocaleString("th-TH")} รายการ</span>
    </div>
    <label class="finance-page-size">
      <span>แถวต่อหน้า</span>
      <select data-finance-page-size="${escapeHtml(key)}">
        ${[20, 50, 100].map((size) => `<option value="${size}" ${pager.pageSize === size ? "selected" : ""}>${size}</option>`).join("")}
      </select>
    </label>
    <div class="finance-page-buttons">
      <button class="mini-button" type="button" data-finance-page-move="${escapeHtml(key)}" data-direction="-1" ${page <= 1 ? "disabled" : ""}>
        <i data-lucide="chevron-left"></i>
        ก่อนหน้า
      </button>
      <span>หน้า ${page.toLocaleString("th-TH")} / ${totalPages.toLocaleString("th-TH")}</span>
      <button class="mini-button" type="button" data-finance-page-move="${escapeHtml(key)}" data-direction="1" ${page >= totalPages ? "disabled" : ""}>
        ถัดไป
        <i data-lucide="chevron-right"></i>
      </button>
    </div>
  `;
}

function syncFinanceSubpages() {
  const active = state.financeActivePage || "wallets";
  $$(".finance-subnav button[data-finance-page]").forEach((button) => {
    const selected = button.dataset.financePage === active;
    button.classList.toggle("is-active", selected);
    button.setAttribute("aria-selected", String(selected));
  });
  $$("[data-finance-panel]").forEach((panel) => {
    panel.classList.toggle("is-active", panel.dataset.financePanel === active);
  });
}

function userForOrder(order, users = financeUserMap()) {
  const user = users.get(order?.userId || "") || {};
  return {
    ...user,
    displayName: user.displayName || order?.customerName || order?.customerEmail || "Customer",
    email: user.email || order?.customerEmail || ""
  };
}

function pointTypeLabel(type) {
  const labels = {
    credit_overpayment: "เงินเกินเข้า Point",
    credit_underpayment: "ยอดไม่พอเข้า Point",
    credit_topup: "เติม Point",
    debit_order_discount: "ใช้ Point ลดราคา",
    debit_free_random_spin: "ใช้ Point สุ่มเกม",
    refund_order_points: "คืน Point",
    admin_adjustment: "แอดมินปรับยอด"
  };
  return labels[type] || type || "Point";
}

function pointTypeClass(type) {
  if (String(type || "").startsWith("credit") || type === "refund_order_points") return "ok";
  if (String(type || "").startsWith("debit")) return "warn";
  return "neutral";
}

function financeTransactions() {
  const users = financeUserMap();
  let rows = state.finance.pointTransactions.map((tx) => {
    const user = users.get(tx.userId || "") || {};
    const order = state.orders.find((item) => item.id === tx.orderId) || {};
    return {
      ...tx,
      orderNumber: tx.orderNumber || order.orderNumber || "",
      userName: tx.userName || user.displayName || user.username || user.email || "Customer",
      email: tx.email || user.email || "",
      createdAt: tx.createdAt || ""
    };
  });

  if (!rows.length) {
    state.orders.forEach((order) => {
      const user = userForOrder(order, users);
      if (Number(order.pointCreditAmount || 0) > 0) {
        rows.push({
          id: `${order.id}-credit`,
          userId: order.userId,
          orderId: order.id,
          orderNumber: order.orderNumber,
          type: Number(order.paymentVerifiedAmount || 0) >= Number(order.total || 0) ? "credit_overpayment" : "credit_underpayment",
          amount: Number(order.pointCreditAmount || 0),
          balanceAfter: null,
          note: order.paymentVerificationNote || "",
          userName: adminUserLabel(user),
          email: user.email || "",
          createdAt: order.paymentVerifiedAt || order.updatedAt || order.createdAt
        });
      }
      if (Number(order.pointsRedeemedAmount || 0) > 0) {
        rows.push({
          id: `${order.id}-debit`,
          userId: order.userId,
          orderId: order.id,
          orderNumber: order.orderNumber,
          type: "debit_order_discount",
          amount: Number(order.pointsRedeemedAmount || 0),
          balanceAfter: null,
          note: "ใช้ Point ลดราคาออเดอร์",
          userName: adminUserLabel(user),
          email: user.email || "",
          createdAt: order.createdAt
        });
      }
    });
  }

  const typeFilter = state.financeTypeFilter || "all";
  rows = rows.filter((row) => {
    if (typeFilter === "credit") return String(row.type || "").startsWith("credit") || row.type === "refund_order_points";
    if (typeFilter === "debit") return String(row.type || "").startsWith("debit");
    if (typeFilter === "admin_adjustment") return row.type === "admin_adjustment";
    return true;
  });

  return rows
    .filter((row) => financeMatches([row.userName, row.email, row.type, row.orderNumber, row.note, row.amount]))
    .sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));
}

function renderFinancePanel() {
  const summary = financeSummary();
  animateAdminNumber("#finance-total-revenue", summary.totalRevenue, (value) => formatPrice(value));
  animateAdminNumber("#finance-point-balance", summary.pointBalance, (value) => `${formatPointAmount(value)} Points`);
  animateAdminNumber("#finance-point-earned", summary.pointEarned, (value) => `${formatPointAmount(value)} Points`);
  animateAdminNumber("#finance-point-spent", summary.pointSpent, (value) => `${formatPointAmount(value)} Points`);
  renderFinanceInsights();
  ensureFinanceAuditCard();
  renderFinanceWalletsTable();
  renderFinanceTransactionsTable();
  renderFinanceOrdersTable();
  renderFinanceVerificationTable();
  syncFinanceSubpages();
}

function renderFinanceInsights() {
  const todayOrders = state.orders.filter((order) => orderMatchesFinancePeriod(order, "day"));
  const todayRevenue = todayOrders.filter(isRevenueOrder).reduce((sum, order) => sum + Number(order.total || 0), 0);
  const pendingOrders = state.orders.filter((order) => ["awaiting_payment", "waiting_admin", "confirmed"].includes(order.status)).length;
  const verifiedSlips = state.finance.paymentVerifications.filter((item) => item.status === "verified").length;
  const creditPoints = financeTransactions()
    .filter((tx) => String(tx.type || "").startsWith("credit"))
    .reduce((sum, tx) => sum + Number(tx.amount || 0), 0);

  animateAdminNumber("#finance-today-revenue", todayRevenue, (value) => formatPrice(value));
  setTextSafe("#finance-today-orders", `${todayOrders.length.toLocaleString("th-TH")} ออเดอร์วันนี้`);
  animateAdminNumber("#finance-pending-orders", pendingOrders);
  animateAdminNumber("#finance-verified-slips", verifiedSlips);
  animateAdminNumber("#finance-credit-points", creditPoints, (value) => `${formatPointAmount(value)} P`);
}

function ensureFinanceAuditCard() {
  if ($("#finance-verifications-table")) return;
  const grid = $(".finance-grid");
  if (!grid) return;
  grid.insertAdjacentHTML(
    "beforeend",
    `
      <section class="admin-card finance-audit-card" data-finance-panel="verifications">
        <div class="card-heading">
          <div>
            <h2>Slip Verification Audit</h2>
            <span id="finance-verifications-count">0 รายการ</span>
          </div>
        </div>
        <div class="table-wrap">
          <table class="admin-table finance-table compact-finance-table">
            <thead>
              <tr>
                <th>เวลา</th>
                <th>Order</th>
                <th>ช่องทาง</th>
                <th>ยอดตรวจ</th>
                <th>สถานะ</th>
                <th>Ref / Error</th>
              </tr>
            </thead>
            <tbody id="finance-verifications-table"></tbody>
          </table>
        </div>
      </section>
    `
  );
}

function renderFinanceWalletsTable() {
  const rows = financeWalletRows().filter((wallet) =>
    financeMatches([wallet.displayName, wallet.username, wallet.email, wallet.role, wallet.status])
  );
  const page = paginateRows("wallets", rows);
  const table = $("#finance-wallets-table");
  if (!table) return;
  const count = $("#finance-wallet-count");
  if (count) count.textContent = `${rows.length.toLocaleString("th-TH")} users`;
  table.innerHTML = page.rows.length
    ? page.rows
        .map(
          (wallet) => `
            <tr>
              <td>
                <div class="finance-user-chip">
                  <span>${escapeHtml(adminUserLabel(wallet).slice(0, 1).toUpperCase())}</span>
                  <div>
                    <strong>${escapeHtml(adminUserLabel(wallet))}</strong>
                    <small>${escapeHtml(wallet.email || wallet.username || "-")}</small>
                  </div>
                </div>
              </td>
              <td class="numeric"><strong>${formatPointAmount(wallet.balance)}</strong></td>
              <td class="numeric money-positive">${formatPointAmount(wallet.lifetimeEarned)}</td>
              <td class="numeric">${formatPointAmount(wallet.lifetimeSpent)}</td>
              <td class="numeric">${Number(wallet.orderCount || 0).toLocaleString("th-TH")}</td>
              <td class="numeric">${formatPrice(wallet.totalSpent)}</td>
              <td><span>${formatAdminDateTime(wallet.lastOrderAt)}</span></td>
            </tr>
          `
        )
        .join("")
    : `<tr><td colspan="7">ยังไม่พบข้อมูลลูกค้าหรือ Point</td></tr>`;
  renderFinancePagination("wallets", page.total, page.page, page.totalPages, page.start, page.end);
}

function renderFinanceTransactionsTableLegacy() {
  const rows = financeTransactions();
  const table = $("#finance-transactions-table");
  if (!table) return;
  const count = $("#finance-activity-count");
  if (count) count.textContent = `${rows.length.toLocaleString("th-TH")} รายการ`;
  table.innerHTML = rows.length
    ? rows
        .slice(0, 160)
        .map(
          (tx) => `
            <tr>
              <td>
                <strong>${escapeHtml(pointTypeLabel(tx.type))}</strong>
                <span>${escapeHtml(tx.orderNumber || tx.orderId || "-")} · ${formatAdminDateTime(tx.createdAt)}</span>
              </td>
              <td>
                <div class="finance-mini-user">
                  <strong>${escapeHtml(tx.userName || "Customer")}</strong>
                  <span>${escapeHtml(tx.email || tx.userId || "-")}</span>
                </div>
              </td>
              <td><span class="status-pill ${pointTypeClass(tx.type)}">${formatPointAmount(tx.amount)} P</span></td>
              <td class="numeric">${tx.balanceAfter == null ? "-" : `${formatPointAmount(tx.balanceAfter)} P`}</td>
            </tr>
          `
        )
        .join("")
    : `<tr><td colspan="4">ยังไม่มีประวัติ Point ตามเงื่อนไขที่เลือก</td></tr>`;
}

function renderFinanceOrdersTableLegacy() {
  const users = financeUserMap();
  const rows = state.orders
    .filter((order) => orderMatchesFinancePeriod(order))
    .map((order) => ({
      ...order,
      user: userForOrder(order, users),
      firstItem: order.items?.[0]?.productName || order.items?.[0]?.name || "-"
    }))
    .filter((order) =>
      financeMatches([
        order.orderNumber,
        order.id,
        order.user.displayName,
        order.user.email,
        order.customerName,
        order.firstItem,
        order.status,
        order.paymentMethod
      ])
    )
    .sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));
  const table = $("#finance-orders-table");
  if (!table) return;
  const count = $("#finance-orders-count");
  const periodRevenue = rows.filter(isRevenueOrder).reduce((sum, order) => sum + Number(order.total || 0), 0);
  if (count) count.textContent = `${rows.length.toLocaleString("th-TH")} ออเดอร์ · ${financePeriodLabel()} · ${formatPrice(periodRevenue)}`;
  table.innerHTML = rows.length
    ? rows
        .slice(0, 160)
        .map(
          (order) => `
            <tr>
              <td>
                <strong>${escapeHtml(order.orderNumber || order.id)}</strong>
                <span>${formatAdminDateTime(order.createdAt)}</span>
              </td>
              <td>
                <div class="finance-mini-user">
                  <strong>${escapeHtml(adminUserLabel(order.user))}</strong>
                  <span>${escapeHtml(order.user.email || order.customerEmail || "-")}</span>
                </div>
              </td>
              <td>
                <strong>${escapeHtml(order.firstItem)}</strong>
                <span>${Number(order.items?.length || 0).toLocaleString("th-TH")} รายการ · ${escapeHtml(order.paymentMethod || "-")}</span>
              </td>
              <td>
                <strong>${formatPrice(order.total)}</strong>
                <span class="status-pill ${orderStatusClass(order.status)}">${escapeHtml(order.status || "-")}</span>
              </td>
            </tr>
          `
        )
        .join("")
    : `<tr><td colspan="4">ยังไม่มีประวัติซื้อสินค้าตามคำค้นหา</td></tr>`;
}

function financeOrderItemSummary(order) {
  const items = Array.isArray(order?.items) ? order.items : [];
  if (!items.length) return { title: "-", detail: "0 รายการ", categories: "-", searchText: "" };
  const productsById = new Map(products().map((product) => [String(product.id || ""), product]));
  const itemRows = items.map((item) => {
    const currentProduct = productsById.get(String(item.productId || "")) || {};
    const name = item.productName || item.name || currentProduct.name || item.productId || "สินค้า";
    const category = currentProduct.category ? categoryLabel(currentProduct.category) : "ไม่ระบุหมวด";
    return { item, currentProduct, name, category };
  });
  const title = items
    .slice(0, 3)
    .map((item, index) => `${itemRows[index].name}${Number(item.quantity || 0) > 1 ? ` x${item.quantity}` : ""}`)
    .join(", ");
  const more = items.length > 3 ? ` +${items.length - 3} รายการ` : "";
  const categories = [...new Set(itemRows.map((row) => row.category).filter(Boolean))].join(", ") || "-";
  return {
    title: `${title}${more}`,
    detail: `${items.length.toLocaleString("th-TH")} รายการ`,
    categories,
    searchText: itemRows.map((row) => [row.name, row.category, row.item.productId].join(" ")).join(" ")
  };
}

function financeOrderSearchValue() {
  return String(state.financeOrderSearch || "").trim().toLowerCase();
}

function financeOrderMatches(values) {
  const term = financeOrderSearchValue();
  if (!term) return true;
  return values.some((value) => String(value || "").toLowerCase().includes(term));
}

function adminPaymentMethodLabel(order = {}) {
  const labels = {
    promptpay: "PromptPay QR",
    qr: "PromptPay QR",
    truemoney: "TrueMoney Wallet",
    wallet: "TrueMoney Wallet",
    points: "Point"
  };
  const method = String(order.paymentMethod || "").trim().toLowerCase();
  const base = labels[method] || order.paymentMethod || "ไม่ระบุ";
  const usedPoints = Number(order.pointsRedeemedAmount || 0);
  if (usedPoints > 0 && Number(order.total || 0) > 0 && method !== "points") return `${base} + Point`;
  if (usedPoints > 0 && Number(order.total || 0) <= 0) return "Point";
  return base;
}

function adminDeliveryHistoryHtml(order = {}) {
  const raw = String(order.deliveredPayload || order.deliveryNote || "").trim();
  if (!raw) return '<span class="admin-history-empty">ยังไม่มีข้อมูลจัดส่ง</span>';
  const parsed = window.OlafDeliveryPayload?.parse?.(raw);
  let body = "";
  if (parsed?.deliveries?.length) {
    body = parsed.deliveries.map((delivery, deliveryIndex) => `
      <div class="admin-history-delivery-set">
        ${parsed.deliveries.length > 1 ? `<strong>ชุดที่ ${deliveryIndex + 1}</strong>` : ""}
        ${(delivery.accounts || []).map((account) => `
          <div class="admin-history-account">
            <b>${escapeHtml(account.platform || "ACCOUNT")}</b>
            ${["login", "id", "password"].map((field) => {
              const value = String(account[field] || "").trim();
              if (!value) return "";
              const label = field === "password" ? "Password" : field === "login" ? "Login" : "ID";
              return `<span><em>${label}</em><code>${escapeHtml(value)}</code></span>`;
            }).join("")}
          </div>
        `).join("")}
      </div>
    `).join("");
  } else {
    body = `<pre>${escapeHtml(raw)}</pre>`;
  }
  return `<details class="admin-history-delivery"><summary><i data-lucide="package-check"></i> ดูข้อมูลจัดส่ง</summary><div>${body}</div></details>`;
}

function paymentStatusClass(status) {
  if (status === "verified") return "ok";
  if (status === "failed" || status === "rejected") return "danger";
  return "warn";
}

function renderFinanceTransactionsTable() {
  const rows = financeTransactions();
  const page = paginateRows("transactions", rows);
  const table = $("#finance-transactions-table");
  if (!table) return;
  const head = table.closest("table")?.querySelector("thead");
  if (head) {
    head.innerHTML = `
      <tr>
        <th>วันที่</th>
        <th>รายการ</th>
        <th>User</th>
        <th>Order</th>
        <th>ยอด Point</th>
        <th>คงเหลือ</th>
        <th>หมายเหตุ</th>
      </tr>
    `;
  }
  const count = $("#finance-activity-count");
  if (count) count.textContent = `${rows.length.toLocaleString("th-TH")} รายการ`;
  table.innerHTML = page.rows.length
    ? page.rows
        .map(
          (tx) => `
            <tr class="finance-detail-row">
              <td>
                <strong>${formatAdminDateTime(tx.createdAt)}</strong>
                <span>${escapeHtml(tx.id || "-")}</span>
              </td>
              <td>
                <span class="status-pill ${pointTypeClass(tx.type)}">${escapeHtml(pointTypeLabel(tx.type))}</span>
                <span>${escapeHtml(tx.paymentVerificationId || "")}</span>
              </td>
              <td>
                <div class="finance-mini-user">
                  <strong>${escapeHtml(tx.userName || "Customer")}</strong>
                  <span>${escapeHtml(tx.email || tx.userId || "-")}</span>
                </div>
              </td>
              <td>
                ${
                  tx.orderId
                    ? `<button class="mini-button finance-link-button" type="button" data-edit-order="${escapeHtml(tx.orderId)}">${escapeHtml(tx.orderNumber || tx.orderId)}</button>`
                    : `<span>-</span>`
                }
              </td>
              <td class="numeric"><strong>${formatPointAmount(tx.amount)} P</strong></td>
              <td class="numeric">${tx.balanceAfter == null ? "-" : `${formatPointAmount(tx.balanceAfter)} P`}</td>
              <td><span>${escapeHtml(tx.note || tx.metadata?.source || "-")}</span></td>
            </tr>
          `
        )
        .join("")
    : `<tr><td colspan="7">ยังไม่มีประวัติ Point ตามเงื่อนไขที่เลือก</td></tr>`;
  renderFinancePagination("transactions", page.total, page.page, page.totalPages, page.start, page.end);
}

function renderFinanceOrdersTable() {
  const users = financeUserMap();
  const rows = state.orders
    .filter((order) => orderMatchesFinancePeriod(order))
    .map((order) => ({
      ...order,
      user: userForOrder(order, users),
      itemSummary: financeOrderItemSummary(order)
    }))
    .filter((order) =>
      financeOrderMatches([
        order.orderNumber,
        order.id,
        order.user.displayName,
        order.user.email,
        order.customerName,
        order.itemSummary.title,
        order.itemSummary.categories,
        order.itemSummary.searchText,
        order.status,
        order.paymentStatus,
        order.paymentMethod,
        adminPaymentMethodLabel(order),
        order.deliveredPayload,
        order.deliveryNote
      ])
    )
    .sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));
  const page = paginateRows("orders", rows);
  const table = $("#finance-orders-table");
  if (!table) return;
  const head = table.closest("table")?.querySelector("thead");
  if (head) {
    head.innerHTML = `
      <tr>
        <th>เกม / หมวดหมู่</th>
        <th>User ผู้ซื้อ</th>
        <th>ราคา</th>
        <th>ชำระด้วย</th>
        <th>เวลาสั่งซื้อ</th>
        <th>ข้อมูลสินค้าที่จัดส่ง</th>
        <th>สถานะ / จัดการ</th>
      </tr>
    `;
  }
  const count = $("#finance-orders-count");
  const periodRevenue = rows.filter(isRevenueOrder).reduce((sum, order) => sum + Number(order.total || 0), 0);
  if (count) count.textContent = `${rows.length.toLocaleString("th-TH")} ออเดอร์ · ${financePeriodLabel()} · ${formatPrice(periodRevenue)}`;
  table.innerHTML = page.rows.length
    ? page.rows
        .map(
          (order) => `
            <tr class="finance-detail-row">
              <td>
                <strong>${escapeHtml(order.itemSummary.title)}</strong>
                <span>${escapeHtml(order.itemSummary.categories)}</span>
                <small>${escapeHtml(order.orderNumber || order.id)}</small>
              </td>
              <td>
                <div class="finance-mini-user">
                  <strong>${escapeHtml(adminUserLabel(order.user))}</strong>
                  <span>${escapeHtml(order.user.email || order.customerEmail || "-")}</span>
                </div>
              </td>
              <td>
                <strong>${formatPrice(order.total)}</strong>
                ${Number(order.discountAmount || 0) > 0 ? `<span>ส่วนลด ${formatPrice(order.discountAmount)}</span>` : ""}
              </td>
              <td>
                <strong>${escapeHtml(adminPaymentMethodLabel(order))}</strong>
                ${Number(order.pointsRedeemedAmount || 0) > 0 ? `<span>ใช้ ${formatPointAmount(order.pointsRedeemedAmount)} P</span>` : ""}
              </td>
              <td>
                <strong>${formatAdminDateTime(order.createdAt)}</strong>
                ${order.paymentVerifiedAt ? `<span>ตรวจชำระ ${formatAdminDateTime(order.paymentVerifiedAt)}</span>` : ""}
              </td>
              <td>
                ${adminDeliveryHistoryHtml(order)}
              </td>
              <td>
                <span class="status-pill ${paymentStatusClass(order.paymentStatus)}">${escapeHtml(order.paymentStatus || "pending")}</span>
                <span class="status-pill ${orderStatusClass(order.status)}">${escapeHtml(order.status || "-")}</span>
                <button class="mini-button finance-link-button" type="button" data-edit-order="${escapeHtml(order.id)}">
                  <i data-lucide="pencil"></i>
                  จัดการ
                </button>
              </td>
            </tr>
          `
        )
        .join("")
    : `<tr><td colspan="7">ยังไม่มีประวัติซื้อสินค้าตามคำค้นหา</td></tr>`;
  renderFinancePagination("orders", page.total, page.page, page.totalPages, page.start, page.end);
}

function renderFinanceVerificationTable() {
  const table = $("#finance-verifications-table");
  if (!table) return;
  const rows = [...state.finance.paymentVerifications]
    .filter((row) =>
      financeMatches([
        row.orderNumber,
        row.orderId,
        row.userId,
        row.email,
        row.customerName,
        row.status,
        row.provider,
        row.providerTransactionId,
        row.errorCode
      ])
    )
    .sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));
  const page = paginateRows("verifications", rows);
  setTextSafe("#finance-verifications-count", `${rows.length.toLocaleString("th-TH")} รายการ`);
  table.innerHTML = page.rows.length
    ? page.rows
        .map(
          (row) => `
            <tr class="finance-detail-row">
              <td>
                <strong>${formatAdminDateTime(row.createdAt)}</strong>
                <span>${row.transferredAt ? `โอน ${formatAdminDateTime(row.transferredAt)}` : "-"}</span>
              </td>
              <td>
                ${
                  row.orderId
                    ? `<button class="mini-button finance-link-button" type="button" data-edit-order="${escapeHtml(row.orderId)}">${escapeHtml(row.orderNumber || row.orderId)}</button>`
                    : `<span>-</span>`
                }
              </td>
              <td>
                <strong>${escapeHtml(row.payloadType || "-")}</strong>
                <span>${escapeHtml(row.provider || "-")}</span>
              </td>
              <td class="numeric">${row.verifiedAmount == null ? "-" : formatPrice(row.verifiedAmount)}</td>
              <td><span class="status-pill ${row.status === "verified" ? "ok" : row.status === "rejected" ? "danger" : "warn"}">${escapeHtml(row.status || "-")}</span></td>
              <td>
                <strong>${escapeHtml(row.providerTransactionId || row.errorCode || "-")}</strong>
                <span>${escapeHtml(row.receiverName || row.email || "")}</span>
              </td>
            </tr>
          `
        )
        .join("")
    : `<tr><td colspan="6">ยังไม่มีประวัติตรวจสลิปตามคำค้นหา</td></tr>`;
  renderFinancePagination("verifications", page.total, page.page, page.totalPages, page.start, page.end);
}

function renderReviewsTable() {
  $("#reviews-count").textContent = `${state.reviews.length.toLocaleString("th-TH")} รีวิว`;
  $("#reviews-table").innerHTML = state.reviews.length
    ? state.reviews
        .map(
          (review) => `
            <tr>
              <td>
                <div class="review-table-cell">
                  <strong>${escapeHtml(review.title || "ไม่มีหัวข้อ")}</strong>
                  <span>${escapeHtml(review.username)} · ${new Date(review.createdAt).toLocaleString("th-TH")}</span>
                </div>
              </td>
              <td>${escapeHtml(review.productName)}</td>
              <td><span class="rating-stars rating-frame">${ratingStars(review.rating)}</span></td>
              <td><span class="status-pill ${review.status === "published" ? "ok" : "warn"}">${escapeHtml(review.status)}</span></td>
              <td>
                <div class="row-actions">
                  <button class="mini-button" type="button" data-edit-review="${escapeHtml(review.id)}">
                    <i data-lucide="pencil"></i>
                  </button>
                </div>
              </td>
            </tr>
          `
        )
        .join("")
    : `<tr><td colspan="5">ยังไม่มีรีวิว</td></tr>`;
}

function renderReviewForm() {
  fillReviewForm(selectedReview());
}

function fillReviewForm(review) {
  const form = $("#review-form");
  const isEmpty = !review;
  $("#review-form-title").textContent = isEmpty ? "ยังไม่มีรีวิวให้แก้ไข" : "แก้ไขรีวิว";
  $("#editing-review-id").textContent = isEmpty ? "ยังไม่ได้เลือก" : review.id;
  $("#delete-review").disabled = isEmpty;
  const value = review ?? {
    title: "",
    productId: "",
    productName: "",
    username: "",
    rating: 5,
    status: "published",
    body: ""
  };
  form.elements.title.value = value.title;
  form.elements.productId.value = value.productId;
  form.elements.productName.value = value.productName;
  form.elements.username.value = value.username;
  form.elements.rating.value = String(value.rating);
  form.elements.status.value = value.status;
  form.elements.body.value = value.body;
}

function saveReviewFromForm(event) {
  event.preventDefault();
  if (!state.selectedReviewId) return;
  const form = event.currentTarget;
  window.OlafStore.updateReview(state.selectedReviewId, {
    title: form.elements.title.value,
    productId: form.elements.productId.value,
    productName: form.elements.productName.value,
    username: form.elements.username.value,
    rating: form.elements.rating.value,
    status: form.elements.status.value,
    body: form.elements.body.value
  });
  setStatus("บันทึกรีวิวแล้ว");
  renderAll();
  showAdminToast("บันทึกรีวิวเรียบร้อยแล้ว", "success");
}

async function deleteSelectedReview() {
  if (!state.selectedReviewId) return;
  if (!(await adminConfirm("ลบรีวิวนี้ใช่ไหม?"))) return;
  window.OlafStore.deleteReview(state.selectedReviewId);
  state.selectedReviewId = null;
  setStatus("ลบรีวิวแล้ว");
  renderAll();
}

function orderStatusClass(status) {
  if (status === "delivered" || status === "confirmed") return "ok";
  if (status === "cancelled") return "danger";
  return "warn";
}

function renderOrdersTable() {
  $("#orders-count").textContent = `${state.orders.length.toLocaleString("th-TH")} ออเดอร์`;
  const users = financeUserMap();
  $("#orders-table").innerHTML = state.orders.length
    ? state.orders
        .map(
          (order) => {
            const user = userForOrder(order, users);
            const pointInfo =
              Number(order.pointsRedeemedAmount || 0) > 0 || Number(order.pointCreditAmount || 0) > 0
                ? `ใช้ ${formatPointAmount(order.pointsRedeemedAmount || 0)}P / เครดิต ${formatPointAmount(order.pointCreditAmount || 0)}P`
                : "-";
            return `
            <tr>
              <td><strong>${escapeHtml(order.orderNumber || order.id)}</strong><br><span>${formatAdminDateTime(order.createdAt)}</span></td>
              <td>
                <div class="finance-mini-user">
                  <strong>${escapeHtml(adminUserLabel(user))}</strong>
                  <span>${escapeHtml(user.email || order.customerEmail || "-")}</span>
                </div>
              </td>
              <td>${formatPrice(order.total)}<br><span>${escapeHtml(order.paymentMethod || "-")}</span></td>
              <td>${escapeHtml(pointInfo)}</td>
              <td><span class="status-pill ${order.paymentStatus === "verified" ? "ok" : "warn"}">${escapeHtml(order.paymentStatus || "pending")}</span></td>
              <td><span class="status-pill ${orderStatusClass(order.status)}">${escapeHtml(order.status)}</span></td>
              <td><div class="row-actions"><button class="mini-button" type="button" data-edit-order="${escapeHtml(order.id)}"><i data-lucide="pencil"></i></button></div></td>
            </tr>
          `;
          }
        )
        .join("")
    : `<tr><td colspan="7">ยังไม่มีคำสั่งซื้อ</td></tr>`;
}

function renderOrderForm() {
  const order = selectedOrder();
  const form = $("#order-form");
  $("#order-form-title").textContent = order ? "จัดการออเดอร์" : "ยังไม่ได้เลือกออเดอร์";
  $("#editing-order-id").textContent = order?.orderNumber || order?.id || "ยังไม่ได้เลือก";
  $("#delete-order").disabled = !order;
  form.elements.status.value = order?.status || "waiting_admin";
  form.elements.deliveryNote.value = order?.deliveryNote || "";
  renderAdminDeliveryPreview(order);
  const items = order?.items?.length
    ? `
      <h3>รายการสินค้า</h3>
      ${order.items
        .map((item) => {
          const packageTitle = item.packageTitle || item.packageSnapshot?.title || "";
          const packageSubtitle = item.packageSubtitle || item.packageSnapshot?.subtitle || "";
          return `
            <p>
              <strong>${escapeHtml(item.productName || item.name)}</strong>
              ${packageTitle ? `<br><span class="admin-order-package">แพ็คเกจ: ${escapeHtml(packageTitle)}</span>` : ""}
              ${packageSubtitle ? `<br><span class="admin-order-package muted">${escapeHtml(packageSubtitle)}</span>` : ""}
              <br>${Number(item.quantity || 0).toLocaleString("th-TH")} x ${formatPrice(item.unitPrice)} = ${formatPrice(item.lineTotal)}
            </p>
          `;
        })
        .join("")}
    `
    : "";
  const slipHtml = order?.paymentSlipUrl
    ? `<h3>สลิปที่ลูกค้าแนบ</h3><img ${fastImg(order.paymentSlipUrl, "Payment slip")} /><p>${escapeHtml(order.paymentSlipPath)}</p>`
    : order?.paymentSlipPath
      ? `<h3>Storage path สลิป</h3><p>${escapeHtml(order.paymentSlipPath)}</p><p>ยังสร้าง signed URL ไม่ได้ กรุณาตรวจ policy ของ bucket payment-slips</p>`
      : `<p>ยังไม่มีสลิปแนบสำหรับออเดอร์นี้</p>`;
  $("#slip-preview").innerHTML = `${slipHtml}${items}`;
  return;
  $("#slip-preview").innerHTML = order?.paymentSlipPath
    ? `<h3>Storage path สลิป</h3><p>${escapeHtml(order.paymentSlipPath)}</p>${items}`
    : `<p>ระบบแนบสลิปผ่าน Supabase Storage ยังไม่เปิดใช้งาน</p>${items}`;
}

async function saveOrderFromForm(event) {
  event.preventDefault();
  if (!state.selectedOrderId) return;
  const form = event.currentTarget;
  const orderId = state.selectedOrderId;

  try {
    await window.OlafOrders.adminUpdateOrder({
      orderId,
      status: form.elements.status.value,
      deliveryNote: form.elements.deliveryNote.value,
      deliveredPayload: form.elements.deliveryNote.value
    });
    await loadData();
    state.selectedOrderId = orderId;
    renderAll();
    setStatus("บันทึกสถานะออเดอร์ออนไลน์แล้ว");
    showAdminToast("บันทึกออเดอร์ใน Supabase เรียบร้อยแล้ว", "success");
    closeMobileAdminEditor();
  } catch (error) {
    setStatus(error.message || "บันทึกออเดอร์ไม่สำเร็จ");
    showAdminToast(error.message || "บันทึกออเดอร์ไม่สำเร็จ", "error");
  }
}

async function deleteSelectedOrder() {
  if (!state.selectedOrderId) return;
  const orderId = state.selectedOrderId;
  if (!(await adminConfirm("ยกเลิกออเดอร์นี้ใช่ไหม? ระบบจะคืนสต็อกถ้าออเดอร์ยังไม่เคยถูกยกเลิก"))) return;

  try {
    await window.OlafOrders.adminUpdateOrder({
      orderId,
      status: "cancelled",
      deliveryNote: selectedOrder()?.deliveryNote || "",
      deliveredPayload: selectedOrder()?.deliveredPayload || ""
    });
    await loadData();
    state.selectedOrderId = state.orders[0]?.id ?? null;
    renderAll();
    setStatus("ยกเลิกออเดอร์แล้ว");
    showAdminToast("ยกเลิกออเดอร์เรียบร้อยแล้ว", "success");
    closeMobileAdminEditor();
  } catch (error) {
    setStatus(error.message || "ยกเลิกออเดอร์ไม่สำเร็จ");
    showAdminToast(error.message || "ยกเลิกออเดอร์ไม่สำเร็จ", "error");
  }
}

function renderWidgetsTable() {
  $("#widgets-table").innerHTML = state.widgets.length
    ? state.widgets
        .map(
          (widget) => `
            <tr>
              <td><strong>${escapeHtml(widget.title)}</strong><br><span>${escapeHtml(widget.id)}</span></td>
              <td>${escapeHtml(widget.placement)}</td>
              <td><span class="status-pill ${widget.status === "active" ? "ok" : "warn"}">${escapeHtml(widget.status)}</span></td>
              <td><div class="row-actions"><button class="mini-button" type="button" data-edit-widget="${escapeHtml(widget.id)}"><i data-lucide="pencil"></i></button></div></td>
            </tr>
          `
        )
        .join("")
    : `<tr><td colspan="4">ยังไม่มี widget</td></tr>`;
}

function renderWidgetForm() {
  const widget = selectedWidget();
  const form = $("#widget-form");
  $("#widget-form-title").textContent = widget ? "แก้ไข Widget" : "เพิ่ม Widget";
  $("#editing-widget-id").textContent = widget?.id || "Widget ใหม่";
  $("#delete-widget").disabled = !widget;
  form.elements.title.value = widget?.title || "";
  form.elements.placement.value = widget?.placement || "home";
  form.elements.status.value = widget?.status || "active";
  form.elements.code.value = widget?.code || "";
  $("#widget-preset-select").value = "";
}

function applyWidgetPreset() {
  const preset = widgetPresets[$("#widget-preset-select").value];
  if (!preset) {
    setStatus("เลือก preset widget ก่อน");
    return;
  }
  const form = $("#widget-form");
  if (!form.elements.title.value.trim()) form.elements.title.value = preset.title;
  form.elements.code.value = preset.code;
  form.elements.placement.value = "home";
  form.elements.status.value = "active";
  setStatus(`เติม preset ${preset.title} แล้ว`);
}

function saveWidgetFromForm(event) {
  event.preventDefault();
  const form = event.currentTarget;
  const payload = {
    title: form.elements.title.value,
    placement: form.elements.placement.value,
    status: form.elements.status.value,
    code: form.elements.code.value
  };
  const widget = state.selectedWidgetId
    ? window.OlafStore.updateWidget(state.selectedWidgetId, payload)
    : window.OlafStore.createWidget(payload);
  state.selectedWidgetId = widget.id;
  setStatus("บันทึก Widget แล้ว");
  renderAll();
  showAdminToast("บันทึก Widget เรียบร้อยแล้ว", "success");
}

async function deleteSelectedWidget() {
  if (!state.selectedWidgetId) return;
  if (!(await adminConfirm("ลบ Widget นี้ใช่ไหม?"))) return;
  window.OlafStore.deleteWidget(state.selectedWidgetId);
  state.selectedWidgetId = null;
  setStatus("ลบ Widget แล้ว");
  renderAll();
}

function renderStockBoard() {
  const visibleProducts = filteredProducts("stock");
  $("#stock-board").innerHTML = visibleProducts.length
    ? visibleProducts
        .map((product) => {
          const summary = inventorySummaryFor(product);
          const available = Number(summary.availableCount || 0);
          const status = stockStatus(available);
          const isOffline = isOfflineProductCategory(product.category);
          const stockCategoryLabel = managedStockCategoryLabel(product.category);
          const history = productOrderHistory(product.id);
          return `
            <article class="stock-card ${available <= 0 ? "is-out-of-stock" : ""}">
              <div class="stock-head">
                <img ${fastImg(product.image || product.heroImage, product.name, { className: "stock-thumb" })} />
                <div>
                  <h3 title="${escapeHtml(product.name)}">${escapeHtml(product.name)}</h3>
                  <p>${escapeHtml(categoryLabel(product.category))} · ${escapeHtml(product.id)}</p>
                  <div class="stock-card-badges">
                    <span class="status-pill ${status.className}">${status.label}</span>
                    <span class="status-pill ${product.isActive !== false ? "ok" : "danger"}">${product.isActive !== false ? "Active" : "Inactive"}</span>
                    ${summary.stockMatches === false ? '<span class="status-pill danger">Counter mismatch</span>' : ""}
                  </div>
                </div>
              </div>

              <div class="stock-summary-grid">
                <span><small>พร้อมขาย</small><strong>${available.toLocaleString("th-TH")}</strong></span>
                <span><small>Reserved</small><strong>${Number(summary.reservedCount || 0).toLocaleString("th-TH")}</strong></span>
                <span><small>Delivered</small><strong>${Number(summary.deliveredCount || 0).toLocaleString("th-TH")}</strong></span>
                <span><small>Sold</small><strong>${Number(summary.soldCount || product.sold || 0).toLocaleString("th-TH")}</strong></span>
                <span><small>Orders</small><strong>${Number(summary.orderCount || 0).toLocaleString("th-TH")}</strong></span>
              </div>

              <div class="stock-buttons">
                <button class="mini-button" type="button" data-stock-adjust="${escapeHtml(product.id)}" data-delta="1">+1</button>
                <button class="mini-button" type="button" data-stock-adjust="${escapeHtml(product.id)}" data-delta="5">+5</button>
                <button class="mini-button" type="button" data-stock-adjust="${escapeHtml(product.id)}" data-delta="10">+10</button>
                <button class="mini-button" type="button" data-stock-zero="${escapeHtml(product.id)}">หมด</button>
              </div>
              <div class="stock-set">
                <input type="number" min="0" max="10000" step="1" value="${available}" data-stock-input="${escapeHtml(product.id)}" aria-label="จำนวนพร้อมขาย ${escapeHtml(product.name)}" />
                <button class="primary-button" type="button" data-stock-set="${escapeHtml(product.id)}">ตั้งสต็อก</button>
              </div>

              ${
                isOffline
                  ? `
                    <div class="offline-stock-card-note">
                      ${escapeHtml(stockCategoryLabel)} ใช้ stock row จริง การเพิ่มจะทำสำเนาบัญชีล่าสุด ส่วน Reserved/Delivered จะไม่ถูกแก้ไข
                    </div>
                    <button class="ghost-button" type="button" data-manage-offline-stock="${escapeHtml(product.id)}">
                      <i data-lucide="list-plus"></i>
                      แก้ข้อมูลบัญชีที่ Available
                    </button>
                  `
                  : ""
              }

              <div class="stock-order-history">
                <strong>ประวัติออเดอร์ล่าสุด</strong>
                ${
                  history.length
                    ? history.map((entry) => `
                        <button type="button" data-edit-order="${escapeHtml(entry.orderId)}">
                          <span>${escapeHtml(entry.orderNumber)}</span>
                          <small>${Number(entry.quantity || 0).toLocaleString("th-TH")} ชิ้น · ${escapeHtml(entry.status)} · ${new Date(entry.createdAt).toLocaleDateString("th-TH")}</small>
                        </button>
                      `).join("")
                    : "<small>ยังไม่มีประวัติออเดอร์สินค้านี้</small>"
                }
              </div>
            </article>
          `;
        })
        .join("")
    : `
      <article class="stock-card stock-card-empty">
        <i data-lucide="package-search"></i>
        <strong>ไม่พบสินค้าในหมวดนี้</strong>
        <span>เลือก “ทั้งหมด” เพื่อดูสต็อกสินค้าทุกหมวด</span>
      </article>
    `;
}

async function changeStock(productId, nextStock, action) {
  const product = products().find((item) => item.id === productId);
  if (!product) return;
  const stock = Math.max(0, Number(nextStock) || 0);
  try {
    validateNonNegativeInteger(stock, "สต็อก");
    const previousStock = Number(inventorySummaryFor(product).availableCount || 0);
    let updatedProduct;

    if (isOfflineProductCategory(product.category)) {
      if (!window.OlafProducts?.adminResizeOfflineStock) {
        throw new Error("admin_resize_offline_stock is not ready");
      }
      const cachedItems = getCachedOfflineStockItems(productId) || [];
      const templateContent =
        cachedItems.find((item) => item.status === "available")?.content ||
        cachedItems.find((item) => ["reserved", "delivered"].includes(item.status))?.content ||
        "";
      const result = await window.OlafProducts.adminResizeOfflineStock({
        productId,
        stock,
        templateContent,
        note: action
      });
      updatedProduct = result.product || product;
      setCachedOfflineStockItems(productId, result.items || []);
    } else {
      updatedProduct = await window.OlafProducts.setAdminProductStock({
        productId,
        stock,
        note: action
      });
    }

    if (updatedProduct) replaceProductInState(updatedProduct);
    await refreshInventorySummaries();
    state.stockLog.unshift({
      id: `${productId}-${Date.now()}`,
      name: updatedProduct?.name || product.name,
      action,
      delta: stock - previousStock,
      previous: previousStock,
      next: stock,
      createdAt: new Date().toISOString()
    });
    state.stockLog = state.stockLog.slice(0, 40);
    state.selectedProductId = productId;
    renderStockViews({ refreshProductForm: document.body.dataset.adminPanel === "products" });
    if (updatedProduct?._stockFallback) {
      setStatus("อัปเดตสต็อกแล้ว แต่ยังไม่ได้บันทึกประวัติ stock movement เพราะ RPC ยังไม่พร้อม");
      showAdminToast("อัปเดตสต็อกแล้ว กรุณารัน supabase-orders-admin.sql เพื่อเปิด stock log", "warning");
    } else {
      setStatus("อัปเดตสต็อกออนไลน์แล้ว");
      showAdminToast(
        isOfflineProductCategory(product.category)
          ? "อัปเดต stock rows จริงใน Supabase แล้ว"
          : "อัปเดตสต็อกใน Supabase แล้ว",
        "success"
      );
    }
  } catch (error) {
    console.error("Supabase stock adjustment failed", {
      code: error?.code,
      message: error?.message,
      details: error?.details,
      hint: error?.hint
    });
    const message = adminStockErrorMessage(error);
    setStatus(message);
    showAdminToast(message, "error");
  }
}

function discountDateTimeLocal(value) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const offset = date.getTimezoneOffset() * 60000;
  return new Date(date.getTime() - offset).toISOString().slice(0, 16);
}

function resetDiscountCodeForm() {
  const form = $("#discount-code-form");
  if (!form) return;
  form.reset();
  form.elements.id.value = "";
  form.elements.discountType.value = "fixed";
  form.elements.isActive.value = "true";
  form.elements.freeCampaign.checked = true;
  form.elements.startsAt.value = discountDateTimeLocal(new Date().toISOString());
}

function renderDiscountCodesPanel() {
  const list = $("#discount-code-list");
  if (!list) return;
  const codes = Array.isArray(state.discountCodes) ? state.discountCodes : [];
  if (!codes.length) {
    list.innerHTML = '<div class="empty-state">ยังไม่มีโค้ดส่วนลด กรอกแบบฟอร์มเพื่อสร้างโค้ดแรก</div>';
    return;
  }
  list.innerHTML = codes.map((item) => {
    const type = item.discountType || item.discount_type || "fixed";
    const value = Number(item.discountValue ?? item.discount_value ?? 0);
    const expiresAt = item.expiresAt || item.expires_at || "";
    const usageLimit = item.usageLimit ?? item.usage_limit;
    const usedCount = Number(item.usedCount ?? item.used_count ?? 0);
    const isActive = item.isActive !== false && item.is_active !== false;
    return `
      <article class="coupon-admin-card ${isActive ? "" : "is-inactive"}">
        <div>
          <div class="coupon-admin-code"><i data-lucide="ticket-percent"></i><strong>${escapeHtml(item.code || "-")}</strong><span class="status-pill ${isActive ? "success" : "danger"}">${isActive ? "เปิดใช้" : "ปิดใช้"}</span></div>
          <p>${type === "percent" ? `ลด ${value.toLocaleString("th-TH", { maximumFractionDigits: 2 })}%` : `ลด ${formatPrice(value)}`} · ใช้แล้ว ${usedCount.toLocaleString("th-TH")}${usageLimit ? ` / ${Number(usageLimit).toLocaleString("th-TH")}` : " / ไม่จำกัด"}</p>
          <p>${expiresAt ? `หมดอายุ ${formatAdminDateTime(expiresAt)}` : "ไม่มีวันหมดอายุ"}${item.freeCampaign || item.free_campaign ? " · กิจกรรมแจกฟรี" : ""}</p>
        </div>
        <div class="coupon-admin-card-actions">
          <button class="ghost-button" type="button" data-edit-discount-code="${escapeHtml(item.id)}"><i data-lucide="pencil"></i> แก้ไข</button>
          ${isActive ? `<button class="danger-button" type="button" data-disable-discount-code="${escapeHtml(item.id)}"><i data-lucide="ban"></i> ปิด</button>` : ""}
        </div>
      </article>`;
  }).join("");
}

function editDiscountCode(id) {
  const item = state.discountCodes.find((entry) => entry.id === id);
  const form = $("#discount-code-form");
  if (!item || !form) return;
  form.elements.id.value = item.id || "";
  form.elements.code.value = item.code || "";
  form.elements.discountType.value = item.discountType || item.discount_type || "fixed";
  form.elements.discountValue.value = Number(item.discountValue ?? item.discount_value ?? 0) || "";
  form.elements.usageLimit.value = item.usageLimit ?? item.usage_limit ?? "";
  form.elements.startsAt.value = discountDateTimeLocal(item.startsAt || item.starts_at);
  form.elements.expiresAt.value = discountDateTimeLocal(item.expiresAt || item.expires_at);
  form.elements.isActive.value = item.isActive !== false && item.is_active !== false ? "true" : "false";
  form.elements.freeCampaign.checked = item.freeCampaign === true || item.free_campaign === true;
  form.elements.notificationTitle.value = item.notificationTitle || item.notification_title || "";
  form.elements.notificationMessage.value = item.notificationMessage || item.notification_message || "";
  form.elements.notificationLinkUrl.value = item.notificationLinkUrl || item.notification_link_url || "";
  form.scrollIntoView({ behavior: "smooth", block: "start" });
}

async function refreshDiscountCodes() {
  if (!window.OlafCoupons?.fetchAdmin) throw new Error("DISCOUNT_CODE_MIGRATION_REQUIRED");
  state.discountCodes = await window.OlafCoupons.fetchAdmin();
  renderDiscountCodesPanel();
  createIconSet();
}

async function saveDiscountCodeSettings(event) {
  event.preventDefault();
  const form = event.currentTarget;
  const button = form.querySelector('button[type="submit"]');
  const original = button?.innerHTML || "";
  if (button) { button.disabled = true; button.innerHTML = '<i data-lucide="loader-circle"></i> กำลังบันทึก'; createIconSet(); }
  try {
    const saved = await window.OlafCoupons.saveAdmin({
      id: form.elements.id.value || null,
      code: form.elements.code.value.trim(),
      discountType: form.elements.discountType.value,
      discountValue: Number(form.elements.discountValue.value || 0),
      usageLimit: form.elements.usageLimit.value || null,
      startsAt: form.elements.startsAt.value ? new Date(form.elements.startsAt.value).toISOString() : null,
      expiresAt: form.elements.expiresAt.value ? new Date(form.elements.expiresAt.value).toISOString() : null,
      isActive: form.elements.isActive.value === "true",
      freeCampaign: form.elements.freeCampaign.checked,
      notificationTitle: form.elements.notificationTitle.value.trim(),
      notificationMessage: form.elements.notificationMessage.value.trim(),
      notificationLinkUrl: form.elements.notificationLinkUrl.value.trim()
    });
    await refreshDiscountCodes();
    if (saved?.free_campaign === true) {
      const settings = await fetchOnlineStoreSettings(true);
      state.payload.store = mergeStoreSettings(state.payload.store, settings);
      renderActivityPopupForm();
    }
    resetDiscountCodeForm();
    showAdminToast("บันทึกโค้ดส่วนลดแล้ว", "success");
  } catch (error) {
    showAdminToast(error.message || "บันทึกโค้ดส่วนลดไม่สำเร็จ", "error", 7000);
  } finally {
    if (button) { button.disabled = false; button.innerHTML = original; createIconSet(); }
  }
}

async function deactivateDiscountCode(id) {
  if (!id || !window.confirm("ปิดใช้งานโค้ดนี้ใช่หรือไม่? ประวัติการใช้จะไม่ถูกลบ")) return;
  try {
    await window.OlafCoupons.deactivateAdmin(id);
    await refreshDiscountCodes();
    showAdminToast("ปิดใช้งานโค้ดแล้ว", "success");
  } catch (error) {
    showAdminToast(error.message || "ปิดโค้ดไม่สำเร็จ", "error");
  }
}

function renderActivityPopupForm() {
  const form = $("#activity-popup-form");
  if (!form) return;
  const activity = state.payload.store.activityPopup ?? {};
  const desktopUrl = state.pendingActivityDesktopPreviewUrl ?? activity.desktopImageUrl ?? "";
  const mobileUrl = state.pendingActivityMobilePreviewUrl ?? activity.mobileImageUrl ?? desktopUrl;

  form.elements.enabled.value = activity.enabled === true ? "true" : "false";
  form.elements.campaignId.value = activity.campaignId || "";
  form.elements.title.value = activity.title || "";
  form.elements.message.value = activity.message || "";
  form.elements.desktopImageUrl.value = isInlinePreviewUrl(desktopUrl) ? "" : (activity.desktopImagePath ? "" : desktopUrl);
  form.elements.mobileImageUrl.value = isInlinePreviewUrl(mobileUrl) ? "" : (activity.mobileImagePath ? "" : (activity.mobileImageUrl || ""));
  form.elements.linkUrl.value = activity.linkUrl || "";
  form.elements.linkLabel.value = activity.linkLabel || "ดูรายละเอียดกิจกรรม";

  renderActivityAdminPreview("#activity-desktop-preview", desktopUrl, "monitor-up", "รูป Desktop 1080 × 1920");
  renderActivityAdminPreview("#activity-mobile-preview", mobileUrl, "smartphone", "รูป Mobile 1:1");
}

function renderActivityAdminPreview(selector, imageUrl, icon, placeholder) {
  const preview = $(selector);
  if (!preview) return;
  const caption = selector.includes("mobile") ? "Mobile" : "Desktop";
  preview.innerHTML = imageUrl
    ? `<img src="${escapeHtml(imageUrl)}" alt="ตัวอย่าง ${caption}" loading="eager" decoding="async" /><figcaption>${caption}</figcaption>`
    : `<div class="activity-admin-placeholder"><i data-lucide="${icon}"></i><span>${placeholder}</span></div><figcaption>${caption}</figcaption>`;
  createIconSet();
}

async function saveActivityPopupSettings(event) {
  event.preventDefault();
  const form = event.currentTarget;
  const button = form.querySelector('button[type="submit"]');
  const originalHtml = button?.innerHTML || "";
  const existing = state.payload.store.activityPopup ?? {};
  const { discountCode: _legacyDiscountCode, ...safeExisting } = existing;
  const typedDesktopUrl = form.elements.desktopImageUrl.value.trim();
  const typedMobileUrl = form.elements.mobileImageUrl.value.trim();

  let desktopImagePath = state.activityDesktopCleared ? "" : (existing.desktopImagePath || "");
  let desktopImageUrl = state.activityDesktopCleared ? "" : (desktopImagePath ? "" : (typedDesktopUrl || existing.desktopImageUrl || ""));
  let mobileImagePath = state.activityMobileCleared ? "" : (existing.mobileImagePath || "");
  let mobileImageUrl = state.activityMobileCleared ? "" : (mobileImagePath ? "" : (typedMobileUrl || existing.mobileImageUrl || ""));

  if (typedDesktopUrl) {
    desktopImagePath = "";
    desktopImageUrl = typedDesktopUrl;
  }
  if (typedMobileUrl) {
    mobileImagePath = "";
    mobileImageUrl = typedMobileUrl;
  }

  if (button) {
    button.disabled = true;
    button.innerHTML = '<i data-lucide="loader-circle"></i> กำลังบันทึกกิจกรรม';
    createIconSet();
  }

  try {
    if (state.pendingActivityDesktopFile) {
      if (!window.OlafStoreSettings?.uploadStoreAsset) throw new Error("STORE_ASSET_UPLOAD_NOT_READY");
      const uploaded = await window.OlafStoreSettings.uploadStoreAsset({
        assetType: "activity-desktop",
        file: state.pendingActivityDesktopFile
      });
      desktopImagePath = uploaded.path;
      desktopImageUrl = "";
    }
    if (state.pendingActivityMobileFile) {
      if (!window.OlafStoreSettings?.uploadStoreAsset) throw new Error("STORE_ASSET_UPLOAD_NOT_READY");
      const uploaded = await window.OlafStoreSettings.uploadStoreAsset({
        assetType: "activity-mobile",
        file: state.pendingActivityMobileFile
      });
      mobileImagePath = uploaded.path;
      mobileImageUrl = "";
    }

    state.payload.store.activityPopup = {
      ...safeExisting,
      enabled: form.elements.enabled.value === "true",
      campaignId: form.elements.campaignId.value.trim() || existing.campaignId || "main-activity",
      title: form.elements.title.value.trim() || "กิจกรรมพิเศษจาก OLAF SHOP",
      message: form.elements.message.value.trim(),
      desktopImageUrl,
      desktopImagePath,
      mobileImageUrl,
      mobileImagePath,
      linkUrl: form.elements.linkUrl.value.trim(),
      linkLabel: form.elements.linkLabel.value.trim() || "ดูรายละเอียดกิจกรรม",
      updatedAt: new Date().toISOString()
    };

    await saveOnlineStoreSettings(state.payload.store);
    const refreshedSettings = await fetchOnlineStoreSettings(true);
    state.payload.store = mergeStoreSettings(state.payload.store, refreshedSettings);

    revokePreviewUrl(state.pendingActivityDesktopPreviewUrl);
    revokePreviewUrl(state.pendingActivityMobilePreviewUrl);
    state.pendingActivityDesktopFile = null;
    state.pendingActivityDesktopPreviewUrl = null;
    state.pendingActivityMobileFile = null;
    state.pendingActivityMobilePreviewUrl = null;
    state.activityDesktopCleared = false;
    state.activityMobileCleared = false;
    savePayload("บันทึกกิจกรรมหน้าเว็บแล้ว");
    renderActivityPopupForm();
    renderDataPreview();
    showAdminToast("บันทึก Popup กิจกรรมเรียบร้อยแล้ว", "success");
  } catch (error) {
    console.error("Activity popup settings save failed", error);
    const message = String(error?.message || "บันทึกกิจกรรมไม่สำเร็จ");
    showAdminToast(
      message.includes("STORE_ASSET") ? "อัปโหลดรูปกิจกรรมไม่สำเร็จ กรุณาตรวจขนาดไฟล์และ Storage" : message,
      "error",
      8000
    );
  } finally {
    if (button) {
      button.disabled = false;
      button.innerHTML = originalHtml;
      createIconSet();
    }
  }
}

function handleActivityImageUpload(kind, event) {
  const file = event.target.files?.[0];
  if (!file) return;
  if (!String(file.type || "").startsWith("image/")) {
    showAdminToast("กรุณาเลือกไฟล์รูปภาพ", "error");
    event.target.value = "";
    return;
  }
  if (Number(file.size || 0) > 5 * 1024 * 1024) {
    showAdminToast("รูปกิจกรรมต้องมีขนาดไม่เกิน 5 MB", "error");
    event.target.value = "";
    return;
  }
  setPendingActivityPreview(kind, file);
  renderActivityPopupForm();
  setStatus(`เลือกรูปกิจกรรม ${kind === "mobile" ? "Mobile" : "Desktop"} แล้ว กดบันทึกเพื่อใช้งาน`);
}

function renderPaymentForm() {
  const form = $("#payment-form");
  const payment = state.payload.store.payment ?? {};
  const qrUrl = state.pendingQrPreviewUrl ?? state.pendingQrDataUrl ?? payment.manualQrUrl ?? "";
  const trueMoneyQrUrl = state.pendingTrueMoneyQrPreviewUrl ?? state.pendingTrueMoneyQrDataUrl ?? payment.trueMoneyQrUrl ?? "";
  const siteIconUrl = state.pendingSiteIconDataUrl ?? state.payload.store.siteIconUrl ?? "";

  form.elements.promptPayId.value = payment.promptPayId || state.payload.store.promptPayId || "";
  form.elements.serviceFee.value = payment.serviceFee || 0;
  form.elements.paymentEndpoint.value = payment.paymentEndpoint || state.payload.store.paymentEndpoint || "";
  form.elements.bankName.value = payment.bankName || "";
  form.elements.bankAccountNumber.value = payment.bankAccountNumber || "";
  form.elements.bankAccountName.value = payment.bankAccountName || "";
  form.elements.walletName.value = payment.walletName || "";
  form.elements.paymentNote.value = payment.paymentNote || "";
  form.elements.manualQrUrl.value = isInlinePreviewUrl(qrUrl) ? "" : qrUrl;
  form.elements.trueMoneyQrUrl.value = isInlinePreviewUrl(trueMoneyQrUrl) ? "" : trueMoneyQrUrl;
  form.elements.siteIconUrl.value = isInlinePreviewUrl(siteIconUrl) ? "" : siteIconUrl;
  renderQrPreview(qrUrl, trueMoneyQrUrl);
  renderSiteIconPreview(siteIconUrl);
}

function renderQrPreview(qrUrl, trueMoneyQrUrl) {
  const preview = $("#qr-preview");
  const qrIsLocalPreview = String(qrUrl || "").startsWith("blob:");
  const tmQrIsLocalPreview = String(trueMoneyQrUrl || "").startsWith("blob:");
  $("#qr-source-label").textContent = qrUrl
    ? qrIsLocalPreview
      ? "รูปที่อัปโหลดเอง"
      : "URL รูป QR"
    : "ยังไม่ได้ตั้งค่า";

  preview.innerHTML = qrUrl
    ? `<img ${fastImg(qrUrl, "QR Code พร้อมเพย์", { priority: true })} />`
    : `<i data-lucide="qr-code"></i><p>อัปโหลดรูป QR หรือใส่ URL เพื่อแสดงในหน้าชำระเงิน</p>`;

  const tmPreview = $("#truemoney-qr-preview");
  if (tmPreview) {
    $("#truemoney-qr-source-label").textContent = trueMoneyQrUrl
      ? tmQrIsLocalPreview
        ? "รูปที่อัปโหลดเอง"
        : "URL รูป QR"
      : "ยังไม่ได้ตั้งค่า";
    tmPreview.innerHTML = trueMoneyQrUrl
      ? `<img ${fastImg(trueMoneyQrUrl, "QR Code ทรูมันนี่", { priority: true })} />`
      : `<i data-lucide="qr-code"></i><p>อัปโหลดรูป QR หรือใส่ URL ทรูมันนี่</p>`;
  }
  createIconSet();
}

function renderSiteIconPreview(iconUrl) {
  const preview = $("#site-icon-preview");
  const label = $("#site-icon-source-label");
  if (!preview || !label) return;
  label.textContent = iconUrl
    ? iconUrl.startsWith("data:")
      ? "รูปที่อัปโหลดเอง"
      : "URL ไอคอน"
    : "ยังไม่ได้ตั้งค่า";

  preview.innerHTML = iconUrl
    ? `<img ${fastImg(iconUrl, "ไอคอนหน้าเว็บ", { priority: true })} />`
    : `<i data-lucide="badge"></i><p>อัปโหลดหรือใส่ URL เพื่อเปลี่ยนไอคอนหน้าเว็บ</p>`;
  createIconSet();
}

async function savePaymentSettings(event) {
  event.preventDefault();
  const form = event.currentTarget;
  const existingQr = state.payload.store.payment?.manualQrUrl || "";
  const existingQrPath = state.payload.store.payment?.manualQrPath || "";
  const typedQr = form.elements.manualQrUrl.value.trim();
  let manualQrUrl = state.qrCleared ? "" : typedQr || existingQr;
  let manualQrPath = state.qrCleared ? "" : existingQrPath;
  
  const existingTmQr = state.payload.store.payment?.trueMoneyQrUrl || "";
  const existingTmQrPath = state.payload.store.payment?.trueMoneyQrPath || "";
  const typedTmQr = form.elements.trueMoneyQrUrl.value.trim();
  let trueMoneyQrUrl = state.tmQrCleared ? "" : typedTmQr || existingTmQr;
  let trueMoneyQrPath = state.tmQrCleared ? "" : existingTmQrPath;
  
  const existingIcon = state.payload.store.siteIconUrl || "";
  const typedIcon = form.elements.siteIconUrl.value.trim();
  const siteIconUrl = state.siteIconCleared ? "" : state.pendingSiteIconDataUrl || typedIcon || existingIcon;

  try {
    if (state.pendingQrFile) {
      if (!window.OlafStoreSettings?.uploadPaymentQr) throw new Error("PAYMENT_QR_UPLOAD_NOT_READY");
      const uploadedQr = await window.OlafStoreSettings.uploadPaymentQr({
        channelId: "promptpay",
        file: state.pendingQrFile
      });
      manualQrPath = uploadedQr.path;
      manualQrUrl = uploadedQr.signedUrl || "";
    }

    if (state.pendingTrueMoneyQrFile) {
      if (!window.OlafStoreSettings?.uploadPaymentQr) throw new Error("PAYMENT_QR_UPLOAD_NOT_READY");
      const uploadedTmQr = await window.OlafStoreSettings.uploadPaymentQr({
        channelId: "wallet",
        file: state.pendingTrueMoneyQrFile
      });
      trueMoneyQrPath = uploadedTmQr.path;
      trueMoneyQrUrl = uploadedTmQr.signedUrl || "";
    }
  } catch (error) {
    console.error("Payment QR upload failed", error);
    setStatus(error.message || "QR upload failed");
    showAdminToast("QR upload failed. Run supabase-payment-channels.sql first.", "error");
    return;
  }

  state.payload.store.promptPayId = form.elements.promptPayId.value.trim();
  state.payload.store.paymentEndpoint = form.elements.paymentEndpoint.value.trim();
  state.payload.store.serviceFee = Number(form.elements.serviceFee.value) || 0;
  state.payload.store.siteIconUrl = siteIconUrl;
  state.payload.store.payment = {
    promptPayId: form.elements.promptPayId.value.trim(),
    serviceFee: Number(form.elements.serviceFee.value) || 0,
    paymentEndpoint: form.elements.paymentEndpoint.value.trim(),
    bankName: form.elements.bankName.value.trim(),
    bankAccountNumber: form.elements.bankAccountNumber.value.trim(),
    bankAccountName: form.elements.bankAccountName.value.trim(),
    walletName: form.elements.walletName.value.trim(),
    paymentNote: form.elements.paymentNote.value.trim(),
    manualQrUrl,
    manualQrPath,
    trueMoneyQrUrl,
    trueMoneyQrPath
  };

  try {
    const channels = [
      {
        id: "promptpay",
        label: "PromptPay QR",
        method: "promptpay",
        isActive: Boolean(manualQrPath || manualQrUrl || form.elements.promptPayId.value.trim()),
        sortOrder: 10,
        bankName: form.elements.bankName.value.trim(),
        accountNumber: form.elements.bankAccountNumber.value.trim(),
        accountName: form.elements.bankAccountName.value.trim(),
        note: form.elements.paymentNote.value.trim(),
        qrPath: manualQrPath,
        qrUrl: manualQrPath ? "" : manualQrUrl
      },
      {
        id: "wallet",
        label: "Wallet / TrueMoney QR",
        method: "wallet",
        isActive: Boolean(trueMoneyQrPath || trueMoneyQrUrl || form.elements.walletName.value.trim()),
        sortOrder: 20,
        walletName: form.elements.walletName.value.trim(),
        note: form.elements.paymentNote.value.trim(),
        qrPath: trueMoneyQrPath,
        qrUrl: trueMoneyQrPath ? "" : trueMoneyQrUrl
      }
    ];
    const savedChannels = window.OlafStoreSettings?.savePaymentChannels
      ? await window.OlafStoreSettings.savePaymentChannels(channels)
      : [];
    const promptpayChannel = savedChannels.find((channel) => channel.id === "promptpay");
    const walletChannel = savedChannels.find((channel) => channel.id === "wallet");
    if (promptpayChannel?.qrUrl) state.payload.store.payment.manualQrUrl = promptpayChannel.qrUrl;
    if (walletChannel?.qrUrl) state.payload.store.payment.trueMoneyQrUrl = walletChannel.qrUrl;
    await saveOnlineStoreSettings(state.payload.store);
  } catch (error) {
    console.error("Store settings save failed", error);
    setStatus(error.message || "บันทึกการตั้งค่าหน้าร้านไม่สำเร็จ");
    showAdminToast("Save failed. Run supabase-payment-channels.sql first.", "error");
    return;
  }

  revokePreviewUrl(state.pendingQrPreviewUrl);
  revokePreviewUrl(state.pendingTrueMoneyQrPreviewUrl);
  state.pendingQrDataUrl = null;
  state.pendingQrFile = null;
  state.pendingQrPreviewUrl = null;
  state.qrCleared = false;
  state.pendingTrueMoneyQrDataUrl = null;
  state.pendingTrueMoneyQrFile = null;
  state.pendingTrueMoneyQrPreviewUrl = null;
  state.tmQrCleared = false;
  state.pendingSiteIconDataUrl = null;
  state.siteIconCleared = false;
  applySiteIcon(siteIconUrl);
  applyAdminBrandIcon(siteIconUrl);
  savePayload("บันทึกการชำระเงินแล้ว");
  renderPaymentForm();
  renderDataPreview();
  showAdminToast("บันทึกการตั้งค่าชำระเงินเรียบร้อยแล้ว", "success");
}

function handleQrUpload(event) {
  const file = event.target.files?.[0];
  if (!file) return;
  const previewUrl = setPendingQrPreview("promptpay", file);
  renderQrPreview(previewUrl, state.pendingTrueMoneyQrPreviewUrl || state.payload.store.payment?.trueMoneyQrUrl || "");
  setStatus("QR selected. Save to upload it to Supabase Storage.");
}

function handleTrueMoneyQrUpload(event) {
  const file = event.target.files?.[0];
  if (!file) return;
  const previewUrl = setPendingQrPreview("wallet", file);
  renderQrPreview(state.pendingQrPreviewUrl || state.payload.store.payment?.manualQrUrl || "", previewUrl);
  setStatus("Wallet QR selected. Save to upload it to Supabase Storage.");
}

function handleSiteIconUpload(event) {
  const file = event.target.files?.[0];
  if (!file) return;
  const reader = new FileReader();
  reader.addEventListener("load", () => {
    state.pendingSiteIconDataUrl = String(reader.result || "");
    state.siteIconCleared = false;
    renderSiteIconPreview(state.pendingSiteIconDataUrl);
    setStatus("เลือกไอคอนเว็บแล้ว กดบันทึกเพื่อใช้งาน");
  });
  reader.readAsDataURL(file);
}

function renderDataPreview() {
  $("#data-updated").textContent = state.payload.updatedAt
    ? new Date(state.payload.updatedAt).toLocaleString("th-TH")
    : "-";
  $("#json-preview").textContent = JSON.stringify(state.payload, null, 2);
}

function exportJson() {
  const blob = new Blob([JSON.stringify(state.payload, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `olafshop-products-${new Date().toISOString().slice(0, 10)}.json`;
  link.click();
  URL.revokeObjectURL(url);
}

function importJson(event) {
  const file = event.target.files?.[0];
  if (!file) return;
  event.target.value = "";
  setStatus("ปิดการนำเข้า JSON แล้ว กรุณาเพิ่มสินค้าออนไลน์ผ่านฟอร์มหลังบ้าน");
  showAdminToast("การนำเข้า JSON ถูกปิดเพื่อป้องกันข้อมูลทับ Supabase", "warning");
}

async function resetData() {
  revokePreviewUrl(state.pendingQrPreviewUrl);
  revokePreviewUrl(state.pendingTrueMoneyQrPreviewUrl);
  state.pendingQrDataUrl = null;
  state.pendingQrFile = null;
  state.pendingQrPreviewUrl = null;
  state.qrCleared = false;
  state.pendingTrueMoneyQrDataUrl = null;
  state.pendingTrueMoneyQrFile = null;
  state.pendingTrueMoneyQrPreviewUrl = null;
  state.tmQrCleared = false;
  await loadData();
  setStatus("โหลดข้อมูลจาก Supabase ใหม่แล้ว");
}

const ADMIN_PANEL_META = {
  dashboard: ["ภาพรวมธุรกิจ", "Admin Console"],
  products: ["จัดการสินค้า", "Commerce / Products"],
  stock: ["คลังและสต็อกสินค้า", "Commerce / Inventory"],
  orders: ["คำสั่งซื้อ", "Commerce / Orders"],
  finance: ["การเงินลูกค้า", "Finance Center"],
  "free-random": ["OLAF Premium Spin", "Campaign / Rewards"],
  users: ["สมาชิกและลูกค้า", "Customer Management"],
  reviews: ["รีวิวจากลูกค้า", "Customer Experience"],
  widgets: ["ส่วนประกอบหน้าร้าน", "Storefront / Widgets"],
  payment: ["ตั้งค่าการชำระเงิน", "System / Payment"],
  activity: ["กิจกรรมหน้าเว็บ", "System / Campaign"],
  coupons: ["โค้ดส่วนลด", "Commerce / Promotions"],
  data: ["ข้อมูลระบบ", "System / Data"],
};

function isAdminMobileViewport() {
  return window.matchMedia("(max-width: 900px)").matches;
}

function setAdminSidebarOpen(open) {
  const sidebar = $("#admin-sidebar");
  const backdrop = $("#admin-shell-backdrop");
  const trigger = $("#admin-mobile-menu");
  if (!sidebar || !backdrop) return;
  const shouldOpen = Boolean(open) && isAdminMobileViewport();
  sidebar.classList.toggle("is-open", shouldOpen);
  document.body.classList.toggle("admin-sidebar-open", shouldOpen);
  backdrop.hidden = !shouldOpen;
  trigger?.setAttribute("aria-expanded", String(shouldOpen));
}

function adminEditorElement(kind) {
  const editorByKind = {
    product: "#admin-product-editor",
    user: "#admin-user-editor",
    order: "#admin-order-editor"
  };
  return $(editorByKind[kind] || "");
}

function closeMobileAdminEditor() {
  ["product", "user", "order"].forEach((kind) => {
    const editor = adminEditorElement(kind);
    editor?.classList.remove("is-open");
    editor?.setAttribute("aria-modal", "false");
    document.body.classList.remove(`admin-${kind}-editor-open`);
  });
  const backdrop = $("#admin-product-editor-backdrop");
  if (backdrop) backdrop.hidden = true;
}

function openMobileAdminEditor(kind) {
  const editor = adminEditorElement(kind);
  const backdrop = $("#admin-product-editor-backdrop");
  if (!editor || !backdrop || !isAdminMobileViewport()) return;
  closeMobileAdminEditor();
  editor.classList.add("is-open");
  editor.setAttribute("aria-modal", "true");
  backdrop.hidden = false;
  document.body.classList.add(`admin-${kind}-editor-open`);
  requestAnimationFrame(() => editor.querySelector("input, select, textarea, button")?.focus({ preventScroll: true }));
}

function openMobileProductEditor() {
  openMobileAdminEditor("product");
}

function closeMobileProductEditor() {
  closeMobileAdminEditor();
}

function openProductEditorForCurrentViewport({ focusOfflineStock = false } = {}) {
  const editor = $("#admin-product-editor");
  if (!editor) return;
  if (isAdminMobileViewport()) {
    openMobileProductEditor();
    requestAnimationFrame(() => {
      const target = focusOfflineStock ? $("#offline-stock-editor") : editor.querySelector("#product-form");
      target?.scrollIntoView({ block: "start" });
    });
  } else {
    editor.scrollIntoView({ behavior: "smooth", block: "start" });
  }
}

function openAdminEditorForCurrentViewport(kind) {
  const editor = adminEditorElement(kind);
  if (!editor) return;
  if (isAdminMobileViewport()) openMobileAdminEditor(kind);
  else editor.scrollIntoView({ behavior: "smooth", block: "start" });
}

function switchPanel(panelName) {
  document.body.dataset.adminPanel = panelName;
  $$(".admin-nav button").forEach((button) => {
    button.classList.toggle("is-active", button.dataset.panelTarget === panelName);
  });
  $$(".admin-panel").forEach((panel) => {
    panel.classList.toggle("is-visible", panel.dataset.panel === panelName);
  });
  const [title, eyebrow] = ADMIN_PANEL_META[panelName] || ["ระบบหลังบ้าน", "Admin Console"];
  setTextSafe("#admin-panel-title", title);
  setTextSafe("#admin-panel-eyebrow", eyebrow);
  setAdminSidebarOpen(false);
  closeMobileAdminEditor();
  if (panelName === "dashboard") {
    requestAnimationFrame(() => {
      renderAnalyticsCharts();
      renderExecutiveDashboard();
      createIconSet();
    });
  }
}

function bindEvents() {
  $("#admin-login-form").addEventListener("submit", handleAdminLogin);

  $("#admin-mobile-menu")?.addEventListener("click", () => setAdminSidebarOpen(true));
  $("#admin-sidebar-close")?.addEventListener("click", () => setAdminSidebarOpen(false));
  $("#admin-shell-backdrop")?.addEventListener("click", () => setAdminSidebarOpen(false));
  $("#close-product-editor")?.addEventListener("click", closeMobileAdminEditor);
  $("#admin-product-editor-backdrop")?.addEventListener("click", closeMobileAdminEditor);

  $(".admin-nav").addEventListener("click", (event) => {
    const button = event.target.closest("[data-panel-target]");
    if (!button) return;
    switchPanel(button.dataset.panelTarget);
  });

  document.body.addEventListener("click", async (event) => {
    const closeAdminEditorButton = event.target.closest("[data-close-admin-editor]");
    if (closeAdminEditorButton) {
      closeMobileAdminEditor();
      return;
    }
    const removeManagedStockAccount = event.target.closest("[data-remove-managed-stock-account]");
    if (removeManagedStockAccount) {
      managedStockDraftAccounts.splice(Number(removeManagedStockAccount.dataset.removeManagedStockAccount), 1);
      renderManagedStockDraft();
      return;
    }
    const adminCopyButton = event.target.closest("[data-admin-copy-field]");
    if (adminCopyButton) {
      const order = selectedOrder();
      const raw = String(order?.deliveredPayload || order?.deliveryNote || "").trim();
      const parsed = window.OlafDeliveryPayload?.parse?.(raw);
      const deliveryIndex = Number(adminCopyButton.dataset.adminCopyDelivery);
      const accountIndex = Number(adminCopyButton.dataset.adminCopyAccount);
      const field = adminCopyButton.dataset.adminCopyField;
      const account = parsed?.deliveries?.[deliveryIndex]?.accounts?.[accountIndex];
      const value = window.OlafDeliveryPayload?.fieldValue?.(account, field) || "";
      try {
        await copyAdminText(value);
        showAdminToast(field === "password" ? "คัดลอกรหัสผ่านแล้ว" : field === "login" ? "คัดลอก Login แล้ว" : "คัดลอก ID แล้ว", "success");
      } catch (error) {
        showAdminToast(error.message || "คัดลอกไม่สำเร็จ", "error");
      }
      return;
    }

    const editButton = event.target.closest("[data-edit-product]");
    const manageOfflineStockButton = event.target.closest("[data-manage-offline-stock]");
    const stockAdjustButton = event.target.closest("[data-stock-adjust]");
    const stockZeroButton = event.target.closest("[data-stock-zero]");
    const stockSetButton = event.target.closest("[data-stock-set]");
    const editUserButton = event.target.closest("[data-edit-user]");
    const resetPasswordButton = event.target.closest("[data-reset-pw]");
    const editReviewButton = event.target.closest("[data-edit-review]");
    const editOrderButton = event.target.closest("[data-edit-order]");
    const dashboardPanelButton = event.target.closest("[data-dashboard-panel]");
    const financePageButton = event.target.closest("[data-finance-page]");
    const financePageMoveButton = event.target.closest("[data-finance-page-move]");
    const editWidgetButton = event.target.closest("[data-edit-widget]");
    const editDiscountCodeButton = event.target.closest("[data-edit-discount-code]");
    const disableDiscountCodeButton = event.target.closest("[data-disable-discount-code]");
    const addPackageButton = event.target.closest("#add-product-package");
    const deletePackageButton = event.target.closest("[data-package-delete]");
    const categoryTab = event.target.closest(".category-tab");

    if (addPackageButton) {
      addPackageDraftToEditor();
      return;
    }

    if (dashboardPanelButton) {
      switchPanel(dashboardPanelButton.dataset.dashboardPanel || "dashboard");
      createIconSet();
      return;
    }

    if (financePageButton) {
      state.financeActivePage = financePageButton.dataset.financePage || "wallets";
      syncFinanceSubpages();
      createIconSet();
      return;
    }

    if (financePageMoveButton) {
      const key = financePageMoveButton.dataset.financePageMove;
      const direction = Number(financePageMoveButton.dataset.direction || 0);
      financePager(key).page += direction;
      renderFinancePanel();
      createIconSet();
      return;
    }

    if (deletePackageButton) {
      await deletePackageFromEditor(deletePackageButton);
      return;
    }

    if (categoryTab) {
      const scope = categoryTab.dataset.categoryScope === "stock" ? "stock" : "products";
      if (scope === "stock") {
        state.stockCategoryFilter = categoryTab.dataset.categoryFilter || "all";
        renderCategoryTabs("stock-category-tabs");
        renderStockBoard();
      } else {
        state.productCategoryFilter = categoryTab.dataset.categoryFilter || "all";
        renderCategoryTabs("admin-category-tabs");
        renderProductsTable();
      }
      createIconSet();
      return;
    }

    if (manageOfflineStockButton) {
      openOfflineStockManager(manageOfflineStockButton.dataset.manageOfflineStock);
      return;
    }

    if (editButton) {
      state.selectedProductId = editButton.dataset.editProduct;
      switchPanel("products");
      renderProductForm();
      createIconSet();
      openProductEditorForCurrentViewport();
      return;
    }

    if (stockAdjustButton) {
      const id = stockAdjustButton.dataset.stockAdjust;
      const product = products().find((item) => item.id === id);
      const delta = Number(stockAdjustButton.dataset.delta) || 0;
      if (product) {
        const currentAvailable = Number(inventorySummaryFor(product).availableCount || 0);
        await changeStock(id, currentAvailable + delta, "เพิ่มสต็อก");
      }
      return;
    }

    if (stockZeroButton) {
      await changeStock(stockZeroButton.dataset.stockZero, 0, "ตั้งค่าสินค้าหมด");
      return;
    }

    if (stockSetButton) {
      const id = stockSetButton.dataset.stockSet;
      const input = document.querySelector(`[data-stock-input="${CSS.escape(id)}"]`);
      await changeStock(id, Number(input?.value) || 0, "กำหนดสต็อกเอง");
      return;
    }

    if (editUserButton) {
      state.selectedUserId = editUserButton.dataset.editUser;
      switchPanel("users");
      renderUserForm();
      createIconSet();
      openAdminEditorForCurrentViewport("user");
      return;
    }

    if (resetPasswordButton) {
      adminResetPassword(resetPasswordButton.dataset.resetPw);
      return;
    }

    if (editReviewButton) {
      state.selectedReviewId = editReviewButton.dataset.editReview;
      switchPanel("reviews");
      renderReviewForm();
      createIconSet();
      return;
    }

    if (editOrderButton) {
      state.selectedOrderId = editOrderButton.dataset.editOrder;
      const selectedOrder = state.orders.find((order) => order.id === state.selectedOrderId);
      if (selectedOrder?.paymentSlipPath && !selectedOrder.paymentSlipUrl && window.OlafOrders?.fetchOrderById) {
        try {
          const freshOrder = await window.OlafOrders.fetchOrderById(state.selectedOrderId);
          const orderIndex = state.orders.findIndex((order) => order.id === state.selectedOrderId);
          if (freshOrder && orderIndex >= 0) state.orders[orderIndex] = freshOrder;
        } catch (error) {
          console.warn("Unable to load selected payment slip preview", error);
        }
      }
      switchPanel("orders");
      renderOrderForm();
      createIconSet();
      openAdminEditorForCurrentViewport("order");
      return;
    }

    if (editWidgetButton) {
      state.selectedWidgetId = editWidgetButton.dataset.editWidget;
      switchPanel("widgets");
      renderWidgetForm();
      createIconSet();
      return;
    }

    if (editDiscountCodeButton) {
      editDiscountCode(editDiscountCodeButton.dataset.editDiscountCode);
      return;
    }

    if (disableDiscountCodeButton) {
      await deactivateDiscountCode(disableDiscountCodeButton.dataset.disableDiscountCode);
      return;
    }
  });

  document.body.addEventListener("change", (event) => {
    const pageSizeSelect = event.target.closest("[data-finance-page-size]");
    if (!pageSizeSelect) return;
    const key = pageSizeSelect.dataset.financePageSize;
    const nextSize = Number(pageSizeSelect.value || 20);
    financePager(key).pageSize = [20, 50, 100].includes(nextSize) ? nextSize : 20;
    resetFinancePage(key);
    renderFinancePanel();
    createIconSet();
  });

  $("#admin-search").addEventListener("input", (event) => {
    state.search = event.target.value;
    renderProductsTable();
    createIconSet();
  });

  $("#stock-search")?.addEventListener("input", (event) => {
    state.stockSearch = event.target.value;
    renderStockBoard();
    createIconSet();
  });

  $("#stock-state-filter")?.addEventListener("change", (event) => {
    state.stockStateFilter = event.target.value || "all";
    renderStockBoard();
    createIconSet();
  });

  $("#stock-active-only")?.addEventListener("change", (event) => {
    state.stockActiveOnly = event.target.checked === true;
    renderStockBoard();
    createIconSet();
  });

  $("#finance-search")?.addEventListener("input", (event) => {
    state.financeSearch = event.target.value;
    resetFinancePage();
    renderFinancePanel();
    createIconSet();
  });

  $("#users-search")?.addEventListener("input", (event) => {
    state.userSearch = event.target.value;
    renderUsersTable();
    createIconSet();
  });

  $("#finance-orders-search")?.addEventListener("input", (event) => {
    state.financeOrderSearch = event.target.value;
    resetFinancePage("orders");
    renderFinancePanel();
    createIconSet();
  });

  $("#finance-type-filter")?.addEventListener("change", (event) => {
    state.financeTypeFilter = event.target.value || "all";
    resetFinancePage("transactions");
    renderFinancePanel();
    createIconSet();
  });

  $("#finance-order-period")?.addEventListener("change", (event) => {
    state.financeOrderPeriod = event.target.value || "all";
    resetFinancePage("orders");
    renderFinancePanel();
    createIconSet();
  });

  $("#adjust-user-point")?.addEventListener("click", adjustSelectedUserPoints);

  $("#finance-refresh")?.addEventListener("click", async () => {
    const button = $("#finance-refresh");
    const originalText = button?.innerHTML || "";
    if (button) {
      button.disabled = true;
      button.innerHTML = '<i data-lucide="loader-circle"></i> กำลังโหลด';
      createIconSet();
    }
    try {
      state.finance = normalizeFinanceOverview(await fetchAdminFinanceFromSupabase());
      const orders = await window.OlafOrders.fetchAdminOrders().catch(() => state.orders);
      state.orders = Array.isArray(orders) ? orders : state.orders;
      renderAll();
      showAdminToast("โหลดประวัติการเงินลูกค้าใหม่แล้ว", "success");
    } catch (error) {
      showAdminToast(error.message || "โหลดประวัติการเงินไม่สำเร็จ", "error");
    } finally {
      if (button) {
        button.disabled = false;
        button.innerHTML = originalText;
        createIconSet();
      }
    }
  });

  $("#resize-managed-stock")?.addEventListener("click", async () => {
    const product = selectedProduct();
    if (!product || !isOfflineProductCategory(product.category)) return;
    const target = Number($("#managed-stock-target")?.value || 0);
    await changeStock(product.id, target, "ปรับจำนวนพร้อมขายจากหน้าจัดการสินค้า");
  });

  $("#category-select")?.addEventListener("change", () => {
    const form = $("#product-form");
    const product = {
      ...(selectedProduct() || {}),
      id: state.selectedProductId ? form.elements.id.value.trim() : "",
      category: form.elements.category.value,
      stock: Number(form.elements.stock.value || 0)
    };
    renderOfflineStockEditor(product);
  });

  $("#add-managed-stock-account")?.addEventListener("click", addManagedStockAccountDraft);
  $("#commit-managed-stock-unit")?.addEventListener("click", commitManagedStockUnit);
  $("#clear-managed-stock-draft")?.addEventListener("click", clearManagedStockDraft);

  $("#offline-stock-lines")?.addEventListener("input", () => {
    const product = selectedProduct();
    syncOfflineStockCacheFromEditor(product?.id);
    const lines = offlineStockLinesFromEditor();
    const form = $("#product-form");
    if (form?.elements?.stock && isOfflineProductCategory(form.elements.category.value)) {
      form.elements.stock.value = lines.length;
    }
    renderOfflineStockMeta(getCachedOfflineStockItems(product?.id) || [], lines.length);
  });

  $("#new-product").addEventListener("click", () => {
    state.selectedProductId = null;
    delete state.productPackages.__new__;
    delete state.offlineStockItems.__new__;
    fillProductForm(null);
    openProductEditorForCurrentViewport();
  });

  $("#new-user").addEventListener("click", () => {
    state.selectedUserId = null;
    fillUserForm(null);
    openAdminEditorForCurrentViewport("user");
  });

  $("#new-widget").addEventListener("click", () => {
    state.selectedWidgetId = null;
    renderWidgetForm();
  });

  $("#product-form").addEventListener("submit", saveProductFromForm);
  $("#user-form").addEventListener("submit", saveUserFromForm);
  $("#review-form").addEventListener("submit", saveReviewFromForm);
  $("#order-form").addEventListener("submit", saveOrderFromForm);
  $("#widget-form").addEventListener("submit", saveWidgetFromForm);
  $("#free-random-form")?.addEventListener("submit", saveFreeRandomSettings);
  $("#free-random-reset-counts")?.addEventListener("click", resetFreeRandomSpinCounts);
  $("#free-random-refresh")?.addEventListener("click", async () => {
    const button = $("#free-random-refresh");
    const originalText = button?.innerHTML || "";
    if (button) {
      button.disabled = true;
      button.innerHTML = '<i data-lucide="loader-circle"></i> กำลังโหลด';
      createIconSet();
    }
    try {
      await refreshFreeRandomPanel();
      showAdminToast("โหลดข้อมูลสุ่ม 1 Point ใหม่แล้ว", "success");
    } catch (error) {
      showAdminToast(error.message || "โหลดข้อมูลสุ่ม 1 Point ไม่สำเร็จ", "error");
    } finally {
      if (button) {
        button.disabled = false;
        button.innerHTML = originalText;
        createIconSet();
      }
    }
  });

  document.querySelectorAll(".dialog-close").forEach((btn) => {
    btn.addEventListener("click", () => btn.closest("dialog")?.close());
  });

  $("#apply-widget-preset").addEventListener("click", applyWidgetPreset);
  $("#delete-product").addEventListener("click", deleteSelectedProduct);
  $("#delete-user").addEventListener("click", deleteSelectedUser);
  $("#delete-review").addEventListener("click", deleteSelectedReview);
  $("#delete-order").addEventListener("click", deleteSelectedOrder);
  $("#delete-widget").addEventListener("click", deleteSelectedWidget);
  $("#admin-logout").addEventListener("click", async () => {
    await requireSupabaseAdminClient().auth.signOut();
    await window.OlafStore?.logout({ skipRemoteSignOut: true });
    adminSessionUser = null;
    showAdminLogin("ออกจากระบบแล้ว");
  });
  $("#payment-form").addEventListener("submit", savePaymentSettings);
  $("#activity-popup-form")?.addEventListener("submit", saveActivityPopupSettings);
  $("#discount-code-form")?.addEventListener("submit", saveDiscountCodeSettings);
  $("#clear-discount-code-form")?.addEventListener("click", resetDiscountCodeForm);
  resetDiscountCodeForm();
  $("#refresh-discount-codes")?.addEventListener("click", async () => {
    try { await refreshDiscountCodes(); showAdminToast("โหลดโค้ดส่วนลดแล้ว", "success"); }
    catch (error) { showAdminToast(error.message || "โหลดโค้ดส่วนลดไม่สำเร็จ", "error"); }
  });
  $("#activity-desktop-upload")?.addEventListener("change", (event) => handleActivityImageUpload("desktop", event));
  $("#activity-mobile-upload")?.addEventListener("change", (event) => handleActivityImageUpload("mobile", event));
  $("#clear-activity-images")?.addEventListener("click", () => {
    revokePreviewUrl(state.pendingActivityDesktopPreviewUrl);
    revokePreviewUrl(state.pendingActivityMobilePreviewUrl);
    state.pendingActivityDesktopFile = null;
    state.pendingActivityDesktopPreviewUrl = null;
    state.pendingActivityMobileFile = null;
    state.pendingActivityMobilePreviewUrl = null;
    state.activityDesktopCleared = true;
    state.activityMobileCleared = true;
    if (state.payload.store.activityPopup) {
      state.payload.store.activityPopup.desktopImageUrl = "";
      state.payload.store.activityPopup.desktopImagePath = "";
      state.payload.store.activityPopup.mobileImageUrl = "";
      state.payload.store.activityPopup.mobileImagePath = "";
    }
    renderActivityPopupForm();
    setStatus("ล้างรูปกิจกรรมแล้ว กดบันทึกกิจกรรมเพื่อยืนยัน");
  });
  $("#qr-upload").addEventListener("change", handleQrUpload);
  $("#truemoney-qr-upload").addEventListener("change", handleTrueMoneyQrUpload);
  $("#site-icon-upload").addEventListener("change", handleSiteIconUpload);
  $("#clear-custom-qr").addEventListener("click", () => {
    revokePreviewUrl(state.pendingQrPreviewUrl);
    revokePreviewUrl(state.pendingTrueMoneyQrPreviewUrl);
    state.qrCleared = true;
    state.tmQrCleared = true;
    state.pendingQrFile = null;
    state.pendingQrPreviewUrl = null;
    state.pendingTrueMoneyQrFile = null;
    state.pendingTrueMoneyQrPreviewUrl = null;
    state.pendingQrDataUrl = "";
    state.pendingTrueMoneyQrDataUrl = "";
    state.payload.store.payment.manualQrUrl = "";
    state.payload.store.payment.manualQrPath = "";
    state.payload.store.payment.trueMoneyQrUrl = "";
    state.payload.store.payment.trueMoneyQrPath = "";
    savePayload("ล้าง QR เองแล้ว");
    renderPaymentForm();
  });
  $("#clear-site-icon").addEventListener("click", () => {
    state.siteIconCleared = true;
    state.pendingSiteIconDataUrl = "";
    state.payload.store.siteIconUrl = "";
    applySiteIcon("");
    applyAdminBrandIcon("");
    savePayload("ล้างไอคอนเว็บแล้ว");
    renderPaymentForm();
  });
  $("#clear-stock-log").addEventListener("click", () => {
    state.stockLog = [];
    renderMetrics();
    createIconSet();
    setStatus("ล้างประวัติในหน้าจอแล้ว ประวัติจริงยังอยู่ใน Supabase");
  });
  $("#export-json").addEventListener("click", exportJson);
  $("#import-json").addEventListener("change", importJson);
  $("#reset-data").addEventListener("click", resetData);
  $("#reload-data").addEventListener("click", loadData);

  let chartResizeTimer = null;
  window.addEventListener("resize", () => {
    if (!isAdminMobileViewport()) {
      setAdminSidebarOpen(false);
      closeMobileAdminEditor();
    }
    clearTimeout(chartResizeTimer);
    chartResizeTimer = setTimeout(() => {
      if (document.body.dataset.adminPanel === "dashboard") renderAnalyticsCharts();
    }, 140);
  });

  document.addEventListener("keydown", (event) => {
    if (event.key !== "Escape") return;
    if (["product", "user", "order"].some((kind) => document.body.classList.contains(`admin-${kind}-editor-open`))) {
      closeMobileAdminEditor();
      return;
    }
    if (document.body.classList.contains("admin-sidebar-open")) setAdminSidebarOpen(false);
  });
}

document.addEventListener("DOMContentLoaded", async () => {
  await window.OlafStore?.ready;
  bindEvents();
  showAdminLogin("กำลังตรวจสอบสิทธิ์แอดมิน...");
  let admin = null;

  try {
    admin = await checkAdminAccess();
  } catch (error) {
    console.error("Admin access guard failed", error);
    showAdminLogin(adminDeniedMessage("ROLE_LOAD_FAILED"));
    createIconSet();
    return;
  }

  if (!admin) {
    const access = checkAdminAccess.lastAccess || {};
    const reason = access.reason || "NO_SESSION";

    if (reason === "NOT_ADMIN") {
      await requireSupabaseAdminClient().auth.signOut().catch(() => {});
    }

    showAdminLogin(adminDeniedMessage(reason));
    createIconSet();
    return;
  }

  showAdminShell();
  try {
    await loadData();
  } catch (error) {
    console.error("Admin authenticated but dashboard data failed to load", error);
    setStatus("เข้าสู่ระบบแล้ว แต่โหลดข้อมูลหลังบ้านไม่สำเร็จ");
    showAdminToast(
      `โหลดข้อมูลหลังบ้านไม่สำเร็จ: ${adminDataErrorMessage(error)}`,
      "error",
      8000
    );
  }
  createIconSet();
});

function adminAlert(message, title = "ข้อความจากระบบ") {
  return new Promise((resolve) => {
    const dialog = document.getElementById("admin-alert-dialog");
    if (!dialog) { alert(message); return resolve(); }
    document.getElementById("admin-alert-message").textContent = message;
    document.getElementById("admin-alert-title").textContent = title;
    const okBtn = document.getElementById("admin-alert-ok");
    
    const closeHandler = () => {
      dialog.close();
      okBtn.removeEventListener("click", closeHandler);
      resolve();
    };
    
    okBtn.addEventListener("click", closeHandler);
    dialog.showModal();
    if (typeof createIconSet === "function") createIconSet();
  });
}

function adminConfirm(message, title = "ยืนยันการทำรายการ") {
  return new Promise((resolve) => {
    const dialog = document.getElementById("admin-confirm-dialog");
    if (!dialog) { return resolve(confirm(message)); }
    document.getElementById("admin-confirm-message").textContent = message;
    document.getElementById("admin-confirm-title").textContent = title;
    
    const okBtn = document.getElementById("admin-confirm-ok");
    const cancelBtn = document.getElementById("admin-confirm-cancel");
    
    const cleanup = () => {
      dialog.close();
      okBtn.removeEventListener("click", okHandler);
      cancelBtn.removeEventListener("click", cancelHandler);
    };
    
    const okHandler = () => { cleanup(); resolve(true); };
    const cancelHandler = () => { cleanup(); resolve(false); };
    
    okBtn.addEventListener("click", okHandler);
    cancelBtn.addEventListener("click", cancelHandler);
    
    dialog.showModal();
    if (typeof createIconSet === "function") createIconSet();
  });
}


function showAdminToast(message, type = "success", duration = 3000) {
  let container = document.getElementById("toast-container");
  if (!container) {
    container = document.createElement("div");
    container.id = "toast-container";
    container.className = "toast-container";
    document.body.appendChild(container);
  }
  
  const toast = document.createElement("div");
  toast.className = "toast " + type;
  toast.innerHTML = `<i data-lucide="${type === 'success' ? 'check-circle' : 'info'}"></i> <span>${message}</span>`;
  container.appendChild(toast);
  if (typeof createIconSet === "function") createIconSet();
  
  requestAnimationFrame(() => toast.classList.add("is-visible"));
  
  setTimeout(() => {
    toast.classList.remove("is-visible");
    setTimeout(() => toast.remove(), 400);
  }, duration);
}

