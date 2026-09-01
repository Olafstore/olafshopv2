const fallbackPayload = {
  store: {
    name: "OLAF SHOP",
    siteIconUrl: "",
    promptPayId: "0812345678",
    paymentEndpoint: "",
    support: {
      line: "@olafshop",
      facebook: "OLAF SHOP",
      hours: "12:00 - 00:00"
    }
  },
  categories: [
    { id: "all", label: "ทั้งหมด" },
    { id: "steam-key", label: "คีย์ Steam" },
    { id: "steam-account", label: "ไอดียกเมล" },
    { id: "offline", label: "Steam Offline" },
    { id: "bundle", label: "แพ็กเกม" }
  ],
  products: [
    {
      id: "elden-ring",
      name: "ELDEN RING",
      publisher: "FromSoftware, Inc.",
      category: "steam-account",
      label: "ขายดี",
      price: 890,
      compareAt: 1790,
      stock: 8,
      sold: 4373,
      rating: "แง่บวกเป็นส่วนมาก",
      delivery: "รับไอดีพร้อมอีเมลทันทีหลังชำระเงิน",
      warranty: "รับประกันเข้าใช้งาน 7 วัน",
      image: "https://cdn.cloudflare.steamstatic.com/steam/apps/1245620/header.jpg",
      heroImage: "https://cdn.cloudflare.steamstatic.com/steam/apps/1245620/library_hero.jpg",
      tags: ["โซลส์ไลค์", "ท่องโลกกว้าง", "ดาร์กแฟนตาซี", "เกมสวมบทบาท"],
      description: "ไอดี Steam พร้อมเกม ELDEN RING สำหรับเล่นได้ทันที เหมาะสำหรับผู้เล่นที่ต้องการเริ่มไวและประหยัดงบ"
    },
    {
      id: "monster-hunter-wilds",
      name: "Monster Hunter Wilds",
      publisher: "CAPCOM Co., Ltd.",
      category: "steam-key",
      label: "มาแรง",
      price: 990,
      compareAt: 1990,
      stock: 12,
      sold: 2108,
      rating: "แง่บวกเป็นอย่างมาก",
      delivery: "ส่งคีย์ Steam อัตโนมัติ",
      warranty: "รับประกันคีย์ใช้งานได้ 100%",
      image: "https://cdn.cloudflare.steamstatic.com/steam/apps/2246340/header.jpg",
      heroImage: "https://cdn.cloudflare.steamstatic.com/steam/apps/2246340/library_hero.jpg",
      tags: ["แอ็กชัน", "ล่าแย้", "เล่นร่วมกัน", "ผจญภัย"],
      description: "คีย์เกมแท้สำหรับบัญชี Steam โซนไทย พร้อมตรวจสอบสต็อกก่อนสั่งซื้อ"
    },
    {
      id: "helldivers-2",
      name: "HELLDIVERS 2",
      publisher: "Arrowhead Game Studios",
      category: "offline",
      label: "ทีมเพลย์",
      price: 899,
      compareAt: 1290,
      stock: 5,
      sold: 1698,
      rating: "แง่บวกเป็นอย่างมาก",
      delivery: "รับข้อมูล Steam Offline พร้อมคู่มือเข้าเล่น",
      warranty: "ดูแลหลังการขาย 3 วัน",
      image: "https://cdn.cloudflare.steamstatic.com/steam/apps/553850/header.jpg",
      heroImage: "https://cdn.cloudflare.steamstatic.com/steam/apps/553850/library_hero.jpg",
      tags: ["ยิง", "ร่วมมือกัน", "ไซไฟ", "ออนไลน์"],
      description: "แพ็ก Steam Offline สำหรับเล่นบนเครื่องส่วนตัว พร้อมขั้นตอนติดตั้งชัดเจน"
    }
  ]
};

const appConfig = {
  productsEndpoint: ["localhost", "127.0.0.1", "::1"].includes(window.location.hostname)
    ? "assets/products-index.json?v=20260712-fast-index-v85"
    : "api/products-index?v=20260712-fast-index-v85",
  paymentEndpoint: "",
  serviceFee: 0,
  promptPayId: "0812345678",
  manualQrUrl: "",
  promoVideos: [
    { id: "v1", title: "OLAF Preview 1", src: "https://pub-cbcd4bc1bff44f548dd40f26f0b0d0cd.r2.dev/v1.mp4" },
    { id: "v2", title: "OLAF Preview 2", src: "https://pub-cbcd4bc1bff44f548dd40f26f0b0d0cd.r2.dev/v2.mp4" },
    { id: "v3", title: "OLAF Preview 3", src: "https://pub-cbcd4bc1bff44f548dd40f26f0b0d0cd.r2.dev/v3.mp4" }
  ],
  ...window.OLAF_CONFIG
};

const storageKeys = {
  lang: "olafshop_lang",
  activityPopup: "olafshop_activity_popup_hidden"
};

const i18n = {
  th: {
    navOrders: "คลังสินค้า",
    heroEyebrow: "Steam Blue Luxury Store",
    heroTitle: "ไอดีเกม Steam คีย์เกม และ Steam Offline พร้อมสต็อกจริง",
    safeOrder: "สั่งซื้อแบบปลอดภัย",
    safeOrderText: "ระบบจะเปิดชำระเงินเฉพาะเมื่อกดสั่งซื้อจากหน้ารายละเอียดสินค้า",
    details: "ดูรายละเอียด",
    orderNow: "สั่งซื้อ",
    account: "เข้าสู่ระบบ"
  },
  en: {
    navOrders: "Inventory",
    heroEyebrow: "Steam Blue Luxury Store",
    heroTitle: "Steam accounts, game keys, and offline games with live stock",
    safeOrder: "Secure checkout",
    safeOrderText: "Payment appears only after you order from a product detail page.",
    details: "Details",
    orderNow: "Order",
    account: "Sign in"
  }
};

const state = {
  store: fallbackPayload.store,
  categories: fallbackPayload.categories,
  products: [],
  selectedCategory: "all",
  query: "",
  stockOnly: false,
  priceFilter: "all",
  sortBy: "default",
  currentPage: 1,
  itemsPerPage: 52,
  cart: new Map(),
  detailQuantity: 1,
  currentUser: null,
  authReady: false,
  orders: [],
  recentPurchases: [],
  recentPurchasesLoading: true,
  recentPurchasesError: ""
};

let currentLang = localStorage.getItem(storageKeys.lang) || "th";
let promoVideoIndex = 0;
let promoVideoBound = false;
let promoVideoObserver = null;
let promoVideoViewportBound = false;
let promoVideoUserPaused = false;
let promoVideoUnlocked = false;
const promoVideoFailures = new Set();
const activityPopupDismissedKeys = new Set();
let steamSpotlightIndex = 0;
let steamActivitySlideIndex = 0;
let steamDiscoveryMode = "top";
let steamDiscoveryPreviewId = "";
let steamStorefrontTimer = null;
const steamSpotlightSessionSeed = Math.floor(Math.random() * 0x7fffffff);

const selectors = {
  apiStatus: "#api-status",
  accountLabel: "#account-label",
  authDialog: "#auth-dialog",
  authMessage: "#auth-message",
  cartCount: "#cart-count",
  cartDialog: "#cart-dialog",
  cartItems: "#cart-items",
  categoryList: "#category-list",
  categoryTabs: "#category-tabs",
  checkoutForm: "#checkout-form",
  closeCart: "#close-cart",
  closeAuth: "#close-auth",
  closeDashboard: "#close-dashboard",
  closePayment: "#close-payment",
  closeProduct: "#close-product",
  dashboardDialog: "#dashboard-dialog",
  emptyState: "#empty-state",
  featuredGrid: "#featured-grid",
  heroDeal: "#hero-deal",
  heroFeatured: "#hero-featured",
  openCart: "#open-cart",
  openCheckout: "#open-checkout",
  openAuth: "#open-auth",
  openDashboard: "#open-dashboard",
  paymentDialog: "#payment-dialog",
  paymentResult: "#payment-result",
  productDetail: "#product-detail",
  productDialog: "#product-dialog",
  productGrid: "#product-grid",
  promoVideoPlayer: "#promo-video-player",
  promoVideoPlaylist: "#promo-video-playlist",
  promoVideoStatus: "#promo-video-status",
  promoVideoTitle: "#promo-video-title",
  paginationControls: "#pagination-controls",
  priceFilter: "#price-filter",
  sortSelect: "#sort-select",
  searchInput: "#search-input",
  stockMeterFill: "#stock-meter-fill",
  stockMeterText: "#stock-meter-text",
  stockOnly: "#stock-only",
  recentPurchasesList: "#recent-purchases-list",
  recentPurchasesStatus: "#recent-purchases-status",
  summaryFee: "#summary-fee",
  summarySubtotal: "#summary-subtotal",
  summaryTotal: "#summary-total"
};

const categoryBadgeLabels = {
  "steam-key": "STEAM KEY",
  "steam-account": "ไอดียกเมล",
  offline: "OFFLINE",
  bundle: "แพ็กเกม",
  windows: "PRE-ORDER",
  "minecraft-account": "MICROSOFT ID",
  "minecraft-key": "MINECRAFT KEY",
  rockstar: "ROCKSTAR / FIVEM"
};

const categoryTagFallbacks = {
  "steam-key": ["คีย์แท้", "เปิดใช้งานบน Steam", "พร้อมใช้งาน", "เกมพีซี", "แอ็กชัน"],
  "steam-account": ["ไอดียกเมล", "พร้อมเล่น", "เข้าเล่นได้", "เกมพีซี", "คุ้มค่า"],
  offline: ["ออฟไลน์", "พร้อมใช้งาน", "ติดตั้งง่าย", "เกมพีซี", "เล่นได้ต่อเนื่อง"],
  bundle: ["แพ็กเกม", "หลายรายการ", "คุ้มราคา", "พร้อมใช้งาน", "เกมพีซี"],
  windows: ["Windows Key", "พรีออเดอร์", "สั่งซื้อเลย", "แอดมินจัดส่ง"],
  "minecraft-account": ["Minecraft", "Microsoft ID", "Java + Bedrock", "พรีออเดอร์"],
  "minecraft-key": ["Minecraft", "Redeem Key", "Java + Bedrock", "พรีออเดอร์"],
  rockstar: ["Rockstar Games", "FiveM / GTA V", "สต็อกจากระบบ", "จัดส่งหลังตรวจสลิป"]
};

function isExtraCatalogCategory(category) {
  return ["windows", "minecraft-account", "minecraft-key", "rockstar"].includes(
    String(category || "").trim().toLowerCase()
  );
}

const tagTranslations = new Map([
  ["action", "แอ็กชัน"],
  ["adventure", "ผจญภัย"],
  ["rpg", "สวมบทบาท"],
  ["strategy", "วางแผน"],
  ["simulation", "จำลองสถานการณ์"],
  ["sports", "กีฬา"],
  ["racing", "แข่งรถ"],
  ["casual", "เล่นสบาย"],
  ["indie", "อินดี้"],
  ["single-player", "เล่นคนเดียว"],
  ["singleplayer", "เล่นคนเดียว"],
  ["multi-player", "ผู้เล่นหลายคน"],
  ["multiplayer", "ผู้เล่นหลายคน"],
  ["co-op", "ร่วมมือกัน"],
  ["online co-op", "ร่วมมือออนไลน์"],
  ["online co op", "ร่วมมือออนไลน์"],
  ["local co-op", "ร่วมมือในเครื่อง"],
  ["pvp", "แข่งขัน"],
  ["online pvp", "แข่งขันออนไลน์"],
  ["open world", "โลกเปิด"],
  ["story rich", "เนื้อเรื่องเข้มข้น"],
  ["story-driven", "เนื้อเรื่องเด่น"],
  ["souls-like", "โซลส์ไลก์"],
  ["soulslike", "โซลส์ไลก์"],
  ["sandbox", "แซนด์บ็อกซ์"],
  ["survival", "เอาตัวรอด"],
  ["survival horror", "สยองขวัญเอาตัวรอด"],
  ["horror", "สยองขวัญ"],
  ["fps", "ยิงมุมมองบุคคลที่หนึ่ง"],
  ["third-person", "บุคคลที่สาม"],
  ["third person", "บุคคลที่สาม"],
  ["shooter", "ยิง"],
  ["stealth", "ลอบเร้น"],
  ["roguelike", "โร้กไลก์"],
  ["rogue-lite", "โร้กไลต์"],
  ["roguelite", "โร้กไลต์"],
  ["anime", "อนิเมะ"],
  ["fantasy", "แฟนตาซี"],
  ["sci-fi", "ไซไฟ"],
  ["sci fi", "ไซไฟ"],
  ["mmo", "ออนไลน์ขนาดใหญ่"],
  ["building", "สร้างสิ่งปลูกสร้าง"],
  ["crafting", "คราฟต์ของ"],
  ["exploration", "สำรวจ"],
  ["combat", "ต่อสู้"],
  ["turn-based", "เทิร์นเบส"],
  ["turn based", "เทิร์นเบส"],
  ["platformer", "ตะลุยด่าน"],
  ["puzzle", "ปริศนา"],
  ["mystery", "ลึกลับ"],
  ["dating sim", "จำลองความสัมพันธ์"],
  ["visual novel", "วิชวลโนเวล"],
  ["choices matter", "ตัวเลือกมีผล"],
  ["controller", "รองรับจอย"],
  ["controller support", "รองรับจอย"],
  ["cross-platform multiplayer", "เล่นข้ามแพลตฟอร์ม"],
  ["shared/split screen", "แบ่งจอร่วมกัน"],
  ["family sharing", "แชร์คลังครอบครัว"],
  ["steam achievements", "มีความสำเร็จ"],
  ["steam cloud", "บันทึกผ่านคลาวด์"]
]);

const $ = (selector) => document.querySelector(selector);
let iconRefreshQueued = false;
const formatPrice = (value) =>
  new Intl.NumberFormat("th-TH", {
    style: "currency",
    currency: "THB",
    maximumFractionDigits: 0
  }).format(value);

const formatPointAmount = (value) =>
  new Intl.NumberFormat("th-TH", { maximumFractionDigits: 0 }).format(Math.floor(Number(value) || 0));

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

function cleanDisplayText(value = "") {
  return window.OlafText?.clean?.(value) ?? String(value || "").trim();
}

function fastImg(src, alt = "", options = {}) {
  if (window.OlafImages?.attrs) return window.OlafImages.attrs(src, alt, options);
  const loading = options.priority || options.loading === "eager" ? "eager" : "lazy";
  const fetchPriority = options.priority ? "high" : options.fetchPriority || "auto";
  const className = options.className ? ` class="${escapeHtml(options.className)}"` : "";
  const width = options.width ? ` width="${escapeHtml(options.width)}"` : "";
  const height = options.height ? ` height="${escapeHtml(options.height)}"` : "";
  const sizes = options.sizes ? ` sizes="${escapeHtml(options.sizes)}"` : "";
  return `${className} src="${escapeHtml(src || "")}" alt="${escapeHtml(alt)}" loading="${loading}" decoding="async" fetchpriority="${fetchPriority}"${width}${height}${sizes}`;
}

function catalogImageOptions(index = 0, featured = false) {
  const fastLane = window.innerWidth <= 640 ? 2 : window.innerWidth <= 1180 ? 4 : 8;
  const eager = featured ? index === 0 : index < fastLane;
  return {
    loading: eager ? "eager" : "lazy",
    fetchPriority: eager ? "high" : "auto",
    width: 640,
    height: 360,
    sizes: featured
      ? "(max-width: 640px) calc(100vw - 32px), (max-width: 1180px) 50vw, 34vw"
      : "(max-width: 420px) calc(100vw - 36px), (max-width: 720px) 50vw, (max-width: 1180px) 33vw, 25vw"
  };
}

function hydrateImages() {
  if (window.OlafImages?.scheduleHydrate) {
    window.OlafImages.scheduleHydrate(document);
    return;
  }
  window.OlafImages?.hydrate?.(document);
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

function applyBrandIcon(iconUrl) {
  const url = String(iconUrl || "").trim();
  document.querySelectorAll(".brand-mark").forEach((mark) => {
    mark.innerHTML = url ? `<img ${fastImg(url, "OLAF SHOP", { priority: true })} />` : "O";
  });
}

function t(key) {
  return i18n[currentLang]?.[key] || i18n.th[key] || key;
}

function getCatalogItemsPerPage() {
  const isIpadViewport =
    window.matchMedia("(min-width: 768px) and (max-width: 1180px) and (min-height: 700px)").matches ||
    window.matchMedia("(min-width: 1024px) and (max-width: 1366px) and (orientation: landscape) and (min-height: 700px)").matches;
  return isIpadViewport ? 51 : state.itemsPerPage;
}

function applyLanguage() {
  document.documentElement.lang = currentLang === "en" ? "en" : "th";
  document.querySelectorAll("[data-i18n]").forEach((node) => {
    node.textContent = t(node.dataset.i18n);
  });
  document.querySelectorAll("[data-lang-option]").forEach((button) => {
    button.classList.toggle("is-active", button.dataset.langOption === currentLang);
  });
}

function closeLanguageMenu() {
  const popover = document.querySelector("#language-popover");
  const toggle = document.querySelector("#lang-toggle");
  if (popover) popover.hidden = true;
  if (toggle) toggle.setAttribute("aria-expanded", "false");
}

function toggleLanguageMenu() {
  const popover = document.querySelector("#language-popover");
  const toggle = document.querySelector("#lang-toggle");
  if (!popover || !toggle) return;
  const nextOpen = popover.hidden;
  if (nextOpen) closeNotificationMenu();
  popover.hidden = !nextOpen;
  toggle.setAttribute("aria-expanded", String(nextOpen));
}

function closeNotificationMenu() {
  if (window.OlafTopbarPopovers?.isUnified) {
    window.OlafTopbarPopovers.closeOne?.("notifications");
    return;
  }
  const popover = document.querySelector("#notification-popover");
  const toggle = document.querySelector("#open-notifications");
  if (popover) popover.hidden = true;
  if (toggle) toggle.setAttribute("aria-expanded", "false");
}

function toggleNotificationMenu() {
  if (window.OlafTopbarPopovers?.isUnified) {
    window.OlafTopbarPopovers.toggle?.("notifications");
    return;
  }
  const popover = document.querySelector("#notification-popover");
  const toggle = document.querySelector("#open-notifications");
  if (!popover || !toggle) return;
  const nextOpen = popover.hidden;
  closeLanguageMenu();
  closeUserPopover();
  popover.hidden = !nextOpen;
  toggle.setAttribute("aria-expanded", String(nextOpen));
}

function selectLanguage(lang) {
  if (!["th", "en"].includes(lang)) return;
  currentLang = lang;
  localStorage.setItem(storageKeys.lang, currentLang);
  closeLanguageMenu();
  renderAll();
}

function persistCurrentPayload() {
  // Legacy localStorage data remains for non-migrated modules only.
  // Product catalog source of truth is now Supabase; JSON is fallback during migration testing.
}

function refreshAccountState() {
  state.currentUser = window.OlafStore?.currentUser() ?? null;
  state.orders = [];
}

function productById(id) {
  return state.products.find((product) => product.id === id);
}

function getDiscount(product) {
  if (!product.compareAt || product.compareAt <= product.price) return 0;
  return Math.round(((product.compareAt - product.price) / product.compareAt) * 100);
}

function getStockState(stock) {
  if (stock <= 0) return { className: "out-stock", label: "สินค้าหมด" };
  if (stock <= 5) return { className: "low-stock", label: `เหลือ ${stock} ชิ้น` };
  return { className: "in-stock", label: `พร้อมส่ง ${stock} ชิ้น` };
}

function getCategoryLabel(categoryId) {
  return cleanDisplayText(state.categories.find((category) => category.id === categoryId)?.label ?? categoryId);
}

function getProductBadgeLabel(categoryId, fallbackLabel = "") {
  const categoryBadge = categoryBadgeLabels[categoryId];
  if (categoryBadge) return categoryBadge;
  return String(fallbackLabel || "STEAM").trim() || "STEAM";
}

const categoryBadgeDefaults = {
  "steam-key": [
    { label: "STEAM", tone: "steam" },
    { label: "KEY", tone: "purple" }
  ],
  "steam-account": [
    { label: "STEAM", tone: "steam" },
    { label: "ACCOUNT", tone: "blue" }
  ],
  bundle: [
    { label: "BUNDLE", tone: "purple" },
    { label: "PACK", tone: "gold" }
  ],
  windows: [
    { label: "WINDOWS", tone: "blue" },
    { label: "PRE-ORDER", tone: "orange" }
  ],
  "minecraft-account": [
    { label: "MINECRAFT", tone: "green" },
    { label: "MICROSOFT ID", tone: "blue" }
  ],
  "minecraft-key": [
    { label: "MINECRAFT", tone: "green" },
    { label: "KEY", tone: "gold" }
  ],
  rockstar: [
    { label: "ROCKSTAR", tone: "gold" },
    { label: "FIVEM", tone: "blue" }
  ]
};

function normalizeBadgeOverrides(product) {
  return (Array.isArray(product?.badgeOverrides) ? product.badgeOverrides : [])
    .map((badge) => ({
      label: cleanDisplayText(badge?.label || ""),
      tone: String(badge?.tone || "auto").trim() || "auto"
    }))
    .filter((badge) => badge.label)
    .slice(0, 2);
}

function badgeToneClass(tone, categoryId) {
  const normalized = String(tone || "auto").toLowerCase();
  if (normalized && normalized !== "auto") return `badge-tone-${normalized}`;
  return `badge-tone-${categoryId || "steam"}`;
}

function getProductBadges(product) {
  const categoryId = String(product?.category || "").toLowerCase();
  if (categoryId === "offline") {
    return [
      { label: "STEAM", className: "badge-tone-steam" },
      { label: "OFFLINE", className: "badge-tone-offline" }
    ];
  }
  const overrides = normalizeBadgeOverrides(product);
  const fallbackLabel = cleanDisplayText(product?.label || "");
  const primary = getProductBadgeLabel(categoryId, fallbackLabel);
  const fallback = overrides.length
    ? overrides
    : categoryBadgeDefaults[categoryId] || [
        { label: primary, tone: "auto" },
        ...(fallbackLabel && fallbackLabel.toUpperCase() !== primary.toUpperCase()
          ? [{ label: fallbackLabel, tone: /premium|deluxe/i.test(fallbackLabel) ? "purple" : "steam" }]
          : [])
      ];
  return fallback
    .filter((badge) => badge?.label)
    .slice(0, 2)
    .map((badge) => ({
      label: cleanDisplayText(badge.label),
      className: badgeToneClass(badge.tone, categoryId)
    }));
}

function renderBadgePills(product) {
  return `<span class="label-pill badge-tone-steam">STEAM</span>`;
}

function translateTagToThai(tag) {
  const cleanTag = cleanDisplayText(tag);
  if (!cleanTag) return "";
  if (/[\u0E00-\u0E7F]/.test(cleanTag)) return cleanTag;
  const translated = tagTranslations.get(cleanTag.toLowerCase());
  if (translated) return translated;
  return "";
}

function getDisplayTags(product, limit = 5) {
  const translated = (product?.tags || [])
    .map(translateTagToThai)
    .filter(Boolean);
  const fallback = categoryTagFallbacks[product?.category] || [];
  return [...new Set([...translated, ...fallback])].slice(0, limit);
}

function normalizeCatalogSearch(value = "") {
  return cleanDisplayText(value)
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[™®©]/g, "")
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9\u0E00-\u0E7F]+/gi, " ")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

function filteredProducts() {
  const query = normalizeCatalogSearch(state.query);
  const queryTerms = query.split(" ").filter(Boolean);
  let result = state.products.filter((product) => {
    const matchesCategory =
      state.selectedCategory === "all" || product.category === state.selectedCategory;
    const matchesStock = !state.stockOnly || product.stock > 0;

    let matchesPrice = true;
    if (state.priceFilter === "under50") matchesPrice = product.price < 50;
    else if (state.priceFilter === "50to100") matchesPrice = product.price >= 50 && product.price <= 100;
    else if (state.priceFilter === "over100") matchesPrice = product.price > 100;

    const searchable = normalizeCatalogSearch([
      product.name,
      product.publisher,
      product.id,
      product.category,
      product.label,
      product.rating,
      ...(product.tags ?? []),
      ...getDisplayTags(product, 5)
    ].join(" "));
    const matchesQuery = !queryTerms.length || queryTerms.every((term) => searchable.includes(term));
    return matchesCategory && matchesStock && matchesPrice && matchesQuery;
  });

  const originalPosition = new Map(state.products.map((product, index) => [product.id, index]));
  const selectedComparator = (a, b) => {
    if (state.sortBy === "priceAsc") return a.price - b.price;
    if (state.sortBy === "priceDesc") return b.price - a.price;
    if (state.sortBy === "nameAsc") return a.name.localeCompare(b.name, "th");
    if (state.sortBy === "nameDesc") return b.name.localeCompare(a.name, "th");
    return (originalPosition.get(a.id) ?? 0) - (originalPosition.get(b.id) ?? 0);
  };

  result.sort((a, b) => {
    const stockGroup = Number(Number(a.stock || 0) <= 0) - Number(Number(b.stock || 0) <= 0);
    if (stockGroup !== 0) return stockGroup;
    const selectedOrder = selectedComparator(a, b);
    if (selectedOrder !== 0) return selectedOrder;
    return (originalPosition.get(a.id) ?? 0) - (originalPosition.get(b.id) ?? 0);
  });

  return result;
}

async function loadProducts() {
  setApiStatus("กำลังโหลดสินค้า...");

  try {
    const jsonPayloadPromise = fetchJsonProductsPayload().catch((error) => {
      console.warn("Product JSON settings unavailable while using Supabase products", error);
      return null;
    });
    const storeSettingsPromise = fetchOnlineStoreSettings(true);
    const supabaseProducts = await fetchSupabaseProducts();
    const [jsonPayload, storeSettings] = await Promise.all([jsonPayloadPromise, storeSettingsPromise]);
    const products = mergeCatalogProducts(jsonPayload?.products, supabaseProducts);
    applyPayload({
      updatedAt: new Date().toISOString(),
      store: mergeStoreSettings(jsonPayload?.store ?? fallbackPayload.store, storeSettings),
      categories: deriveCategories(products, jsonPayload?.categories),
      products
    });
    setApiStatus("อัพเดทข้อมูลสินค้าล่าสุดแล้ว");
  } catch (error) {
    console.warn("Supabase products unavailable; using JSON fallback", error);
    try {
      const [payload, storeSettings] = await Promise.all([
        fetchJsonProductsPayload(),
        fetchOnlineStoreSettings(true)
      ]);
      applyPayload({
        ...payload,
        store: mergeStoreSettings(payload.store ?? fallbackPayload.store, storeSettings)
      });
      setApiStatus("ใช้ JSON fallback ระหว่างทดสอบ Supabase");
    } catch (fallbackError) {
      console.warn("Products JSON fallback unavailable; using inline fallback", fallbackError);
      const storeSettings = await fetchOnlineStoreSettings(true);
      applyPayload({
        ...fallbackPayload,
        store: mergeStoreSettings(fallbackPayload.store, storeSettings)
      });
      setApiStatus("ใช้ข้อมูลสำรองในหน้าเว็บ");
    }
  }
}

function mergeCatalogProducts(jsonProducts = [], supabaseProducts = []) {
  const onlineProducts = Array.isArray(supabaseProducts) ? supabaseProducts.filter(Boolean) : [];
  const fallbackProducts = Array.isArray(jsonProducts) ? jsonProducts.filter(Boolean) : [];
  const fallbackById = new Map(fallbackProducts.map((product) => [String(product?.id || ""), product]));
  const detailFields = [
    "delivery", "warranty", "description", "gallery", "platformLinks",
    "featureBlocks", "detailSections", "steamRelatedLinks",
    "systemRequirements", "sourceMetadata"
  ];
  const products = onlineProducts.length
    ? onlineProducts.map((product) => {
        const fallback = fallbackById.get(String(product?.id || ""));
        if (!fallback) return product;
        const merged = { ...fallback, ...product };
        // The live catalog intentionally excludes large detail fields. Keep
        // those fields from the host-side JSON while price/stock/status stay live.
        detailFields.forEach((field) => {
          const onlineValue = product[field];
          const isEmptyArray = Array.isArray(onlineValue) && onlineValue.length === 0;
          const isEmptyObject = onlineValue && typeof onlineValue === "object" && !Array.isArray(onlineValue)
            ? Object.values(onlineValue).every((value) => !Array.isArray(value) || value.length === 0)
            : false;
          if (onlineValue == null || onlineValue === "" || isEmptyArray || isEmptyObject) {
            merged[field] = fallback[field];
          }
        });
        return merged;
      })
    : fallbackProducts;

  return products
    .filter((product) => product?.id && product.isActive !== false)
    .sort((a, b) => {
    const sortA = Number(a.sortOrder ?? a.sort_order ?? 0);
    const sortB = Number(b.sortOrder ?? b.sort_order ?? 0);
    if (sortA !== sortB) return sortA - sortB;
    return String(a.name || "").localeCompare(String(b.name || ""), "th");
  });
}

async function fetchSupabaseProducts() {
  if (!window.OlafProducts?.fetchActiveProducts) {
    throw new Error("Supabase product client is not ready");
  }
  // One compact refresh per Index load keeps Admin-edited name, price, stock
  // and images current without fetching product descriptions or galleries.
  const products = await window.OlafProducts.fetchActiveProducts({ forceRefresh: true });
  if (!products.length) {
    throw new Error("Supabase returned no active products");
  }
  return products;
}

async function fetchJsonProductsPayload() {
  const response = await fetch(appConfig.productsEndpoint, { cache: "default" });
  if (!response.ok) {
    throw new Error(`HTTP ${response.status}`);
  }
  const payload = await response.json();
  if (Array.isArray(payload?.products)) return payload;
  if (Array.isArray(payload)) return { products: payload };
  throw new Error("Invalid products JSON payload");
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
    return await window.OlafStoreSettings.fetchStoreSettings();
  } catch (error) {
    if (!quiet) console.warn("Store settings unavailable", error);
    return {};
  }
}

async function loadRecentPurchases() {
  state.recentPurchasesLoading = true;
  state.recentPurchasesError = "";
  renderRecentPurchases();

  try {
    if (!window.OlafOrders?.fetchRecentPublicPurchases) {
      throw new Error("Recent purchase client is not ready");
    }
    state.recentPurchases = await window.OlafOrders.fetchRecentPublicPurchases(10);
  } catch (error) {
    console.warn("Recent public purchases unavailable", error);
    state.recentPurchases = [];
    state.recentPurchasesError = "รัน supabase-public-recent-purchases.sql เพื่อเปิดรายการซื้อล่าสุด";
  } finally {
    state.recentPurchasesLoading = false;
    renderRecentPurchases();
  }
}

function formatRelativePurchaseTime(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "ไม่ทราบเวลา";
  const diffMs = Date.now() - date.getTime();
  const diffSeconds = Math.max(0, Math.floor(diffMs / 1000));
  if (diffSeconds < 60) return "เมื่อสักครู่";
  const diffMinutes = Math.floor(diffSeconds / 60);
  if (diffMinutes < 60) return `${diffMinutes} นาทีที่แล้ว`;
  const diffHours = Math.floor(diffMinutes / 60);
  if (diffHours < 24) return `${diffHours} ชั่วโมงที่แล้ว`;
  const diffDays = Math.floor(diffHours / 24);
  if (diffDays < 7) return `${diffDays} วันที่แล้ว`;
  return date.toLocaleDateString("th-TH", { day: "numeric", month: "short" });
}

function formatPurchaseClock(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleString("th-TH", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit"
  });
}

function renderRecentPurchases() {
  const list = $(selectors.recentPurchasesList);
  const status = $(selectors.recentPurchasesStatus);
  if (!list) return;

  if (state.recentPurchasesLoading) {
    if (status) status.textContent = "กำลังโหลด";
    list.innerHTML = Array.from({ length: 5 })
      .map(
        () => `
          <div class="recent-purchase-row is-loading">
            <span class="recent-purchase-icon"></span>
            <div><b></b><small></small></div>
            <time></time>
          </div>
        `
      )
      .join("");
    return;
  }

  if (state.recentPurchasesError) {
    if (status) status.textContent = "ยังไม่พร้อม";
    list.innerHTML = `
      <div class="recent-purchase-empty">
        <i data-lucide="database-zap"></i>
        <span>${escapeHtml(state.recentPurchasesError)}</span>
      </div>
    `;
    createIconSet();
    return;
  }

  if (!state.recentPurchases.length) {
    if (status) status.textContent = "รอออเดอร์";
    list.innerHTML = `
      <div class="recent-purchase-empty">
        <i data-lucide="receipt-text"></i>
        <span>ยังไม่มีรายการซื้อที่แสดงได้</span>
      </div>
    `;
    createIconSet();
    return;
  }

  if (status) status.textContent = `${state.recentPurchases.length} รายการล่าสุด`;
  list.innerHTML = state.recentPurchases
    .map((purchase) => {
      const relativeTime = formatRelativePurchaseTime(purchase.createdAt);
      const clock = formatPurchaseClock(purchase.createdAt);
      const thumb = purchase.productImageUrl
        ? `<img ${fastImg(purchase.productImageUrl, purchase.productName, { className: "recent-purchase-thumb" })} />`
        : `<span class="recent-purchase-icon"><i data-lucide="shopping-bag"></i></span>`;
      return `
        <article class="recent-purchase-row">
          ${thumb}
          <div class="recent-purchase-main">
            <strong>${escapeHtml(purchase.productName || "สินค้า OLAF SHOP")}</strong>
            <small>${escapeHtml(purchase.buyerNameMasked || "ลูกค้าxxx")} · ${Number(purchase.quantity || 1).toLocaleString("th-TH")} ชิ้น</small>
          </div>
          <time datetime="${escapeHtml(purchase.createdAt || "")}">
            <b>${escapeHtml(relativeTime)}</b>
            <span>${escapeHtml(clock)}</span>
          </time>
        </article>
      `;
    })
    .join("");
  createIconSet();
  hydrateImages();
}

function promoVideos() {
  return (Array.isArray(appConfig.promoVideos) ? appConfig.promoVideos : [])
    .map((video, index) => ({
      id: String(video.id || `v${index + 1}`),
      title: String(video.title || `OLAF Preview ${index + 1}`),
      src: String(video.src || `assets/videos/v${index + 1}.mp4`)
    }))
    .filter((video) => video.src);
}

function promoVideoNeedsSafeAutoplay() {
  const ua = navigator.userAgent || "";
  const isiPadLike = navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1;
  if (/iPad|iPhone|iPod/i.test(ua) || isiPadLike) return true;
  return window.matchMedia?.("(hover: none), (pointer: coarse)").matches === true;
}

function configurePromoVideoElement(player, { forceMuted = false } = {}) {
  if (!player) return;
  const shouldMute = forceMuted || !promoVideoUnlocked;
  player.autoplay = true;
  player.playsInline = true;
  player.setAttribute("autoplay", "");
  player.setAttribute("playsinline", "");
  player.setAttribute("webkit-playsinline", "");
  player.preload = "metadata";

  if (shouldMute) {
    player.defaultMuted = true;
    player.muted = true;
    player.setAttribute("muted", "");
    return;
  }

  player.defaultMuted = false;
  player.muted = false;
  player.removeAttribute("muted");
}

function isPromoVideoVisible(target) {
  if (!target) return false;
  const rect = target.getBoundingClientRect();
  const viewportHeight = window.innerHeight || document.documentElement.clientHeight || 0;
  const visibleHeight = Math.min(rect.bottom, viewportHeight) - Math.max(rect.top, 0);
  return visibleHeight >= Math.min(rect.height * 0.35, 220);
}

function tryPlayPromoVideo({ forceMuted = promoVideoNeedsSafeAutoplay(), from = "auto" } = {}) {
  const player = $(selectors.promoVideoPlayer);
  const status = $(selectors.promoVideoStatus);
  if (!player || promoVideoUserPaused) return;

  configurePromoVideoElement(player, { forceMuted });
  const playPromise = player.play?.();
  if (!playPromise?.then) return;

  playPromise
    .then(() => {
      if (status) {
        status.textContent = from === "viewport" ? "กำลังเล่นเมื่อเลื่อนเข้าจอ" : "กำลังเล่นคลิปแนะนำ";
      }
    })
    .catch(() => {
      if (status) status.textContent = "แตะคลิปเพื่อเริ่มเล่น";
    });
}

function bindPromoVideoViewportAutoplay() {
  if (promoVideoViewportBound) return;
  const player = $(selectors.promoVideoPlayer);
  const frame = player?.closest(".promo-video-player");
  if (!player || !frame) return;
  promoVideoViewportBound = true;

  const resumeIfVisible = () => {
    if (!promoVideoUserPaused && isPromoVideoVisible(frame)) {
      tryPlayPromoVideo({ forceMuted: promoVideoNeedsSafeAutoplay(), from: "viewport" });
    }
  };

  if ("IntersectionObserver" in window) {
    promoVideoObserver = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting && entry.intersectionRatio >= 0.35) {
            resumeIfVisible();
            return;
          }

          if (promoVideoNeedsSafeAutoplay() && !player.paused) {
            player.pause();
          }
        });
      },
      { threshold: [0.2, 0.35, 0.6] }
    );
    promoVideoObserver.observe(frame);
  } else {
    window.addEventListener("scroll", resumeIfVisible, { passive: true });
  }

  document.addEventListener("visibilitychange", () => {
    if (!document.hidden) resumeIfVisible();
  });
  window.addEventListener("pageshow", resumeIfVisible);
  window.addEventListener("resize", resumeIfVisible);
  resumeIfVisible();
}

function updatePromoPlaylistState() {
  document.querySelectorAll("[data-promo-video]").forEach((button) => {
    const index = Number(button.dataset.promoVideo || 0);
    const isActive = index === promoVideoIndex;
    const video = promoVideos()[index];
    button.classList.toggle("is-active", isActive);
    button.classList.toggle("is-missing", Boolean(video && promoVideoFailures.has(video.id)));
    button.setAttribute("aria-selected", isActive ? "true" : "false");
  });
}

function setPromoVideo(index, { play = true } = {}) {
  const videos = promoVideos();
  const player = $(selectors.promoVideoPlayer);
  const title = $(selectors.promoVideoTitle);
  const status = $(selectors.promoVideoStatus);
  if (!player || !videos.length) return;

  promoVideoIndex = ((index % videos.length) + videos.length) % videos.length;
  const video = videos[promoVideoIndex];
  
  updatePromoPlaylistState();
  
  if (player.src) {
    player.style.transition = "opacity 0.3s ease";
    player.style.opacity = 0;
  }

  setTimeout(() => {
    configurePromoVideoElement(player, { forceMuted: promoVideoNeedsSafeAutoplay() });
    player.dataset.videoId = video.id;
    player.src = video.src;
    player.load();
    if (title) title.textContent = video.title;
    if (status) status.textContent = `กำลังเล่น ${video.id}.mp4`;

    if (play) {
      const playerFrame = player.closest(".promo-video-player") || player;
      const shouldAutoplayNow = !promoVideoNeedsSafeAutoplay() || isPromoVideoVisible(playerFrame);
      if (shouldAutoplayNow) {
        tryPlayPromoVideo({ forceMuted: promoVideoNeedsSafeAutoplay() });
      } else if (status) {
        status.textContent = "Scroll to the clip to start playback";
      }
      player.muted = true;
      const playPromise = shouldAutoplayNow ? player.play?.() : null;
      if (promoVideoNeedsSafeAutoplay()) {
        window.requestAnimationFrame(() => {
          if (!promoVideoUserPaused && isPromoVideoVisible(playerFrame)) {
            tryPlayPromoVideo({ forceMuted: true, from: "raf" });
          }
        });
      }
      if (playPromise?.catch) {
        playPromise.catch(() => {
          if (status) status.textContent = "แตะคลิปเพื่อเริ่มเล่น";
        });
      }
    }
    
    player.onloadeddata = () => {
      player.style.opacity = 1;
      if (!promoVideoUserPaused && isPromoVideoVisible(player.closest(".promo-video-player") || player)) {
        tryPlayPromoVideo({ forceMuted: promoVideoNeedsSafeAutoplay(), from: "loaded" });
      }
      player.onloadeddata = null;
    };
  }, player.src ? 300 : 0);
}

function playNextPromoVideo() {
  const videos = promoVideos();
  if (!videos.length) return;
  if (promoVideoFailures.size >= videos.length) {
    const status = $(selectors.promoVideoStatus);
    if (status) status.textContent = "ยังไม่พบไฟล์วิดีโอ v1.mp4, v2.mp4, v3.mp4";
    return;
  }

  let nextIndex = promoVideoIndex;
  for (let step = 0; step < videos.length; step += 1) {
    nextIndex = (nextIndex + 1) % videos.length;
    if (!promoVideoFailures.has(videos[nextIndex].id)) {
      setPromoVideo(nextIndex);
      return;
    }
  }
}

function bindPromoVideoPlayer() {
  if (promoVideoBound) return;
  const player = $(selectors.promoVideoPlayer);
  if (!player) return;
  promoVideoBound = true;

  configurePromoVideoElement(player, { forceMuted: promoVideoNeedsSafeAutoplay() });

  player.addEventListener("ended", playNextPromoVideo);
  player.addEventListener("loadedmetadata", () => {
    if (!promoVideoUserPaused && isPromoVideoVisible(player.closest(".promo-video-player") || player)) {
      tryPlayPromoVideo({ forceMuted: promoVideoNeedsSafeAutoplay(), from: "metadata" });
    }
  });
  player.addEventListener("error", () => {
    const videos = promoVideos();
    const failedId = player.dataset.videoId;
    if (failedId) promoVideoFailures.add(failedId);
    updatePromoPlaylistState();
    if (promoVideoFailures.size >= videos.length) {
      const status = $(selectors.promoVideoStatus);
      if (status) status.textContent = "ยังไม่พบไฟล์วิดีโอ กรุณาใส่ v1.mp4, v2.mp4, v3.mp4 ใน assets/videos";
      return;
    }
    window.setTimeout(playNextPromoVideo, 300);
  });
  player.addEventListener("click", () => {
    promoVideoUnlocked = true;
    if (player.paused) {
      promoVideoUserPaused = false;
      tryPlayPromoVideo({ forceMuted: false, from: "tap" });
      player.play?.().catch(() => { });
    } else {
      promoVideoUserPaused = true;
      player.pause();
    }
  });

  const muteBtn = document.getElementById("promo-mute-btn");
  if (muteBtn) {
    const updateMuteIcon = () => {
      const icon = player.muted || player.volume === 0 ? "volume-x" : "volume-2";
      muteBtn.innerHTML = `<i data-lucide="${icon}"></i>`;
      if (window.lucide) window.lucide.createIcons({ root: muteBtn });
    };
    muteBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      promoVideoUnlocked = true;
      player.muted = !player.muted;
      if (!player.muted && player.paused) {
        promoVideoUserPaused = false;
        tryPlayPromoVideo({ forceMuted: false, from: "unmute" });
        player.play?.().catch(() => { });
      }
      updateMuteIcon();
    });
    player.addEventListener("volumechange", updateMuteIcon);
    player.addEventListener("play", updateMuteIcon);
    updateMuteIcon();
  }
}

function renderPromoVideos() {
  const playlist = $(selectors.promoVideoPlaylist);
  const player = $(selectors.promoVideoPlayer);
  const videos = promoVideos();
  if (!playlist || !player || !videos.length) return;

  playlist.innerHTML = videos
    .map(
      (video, index) => `
        <button class="promo-video-item" type="button" role="tab" data-promo-video="${index}" aria-selected="${index === promoVideoIndex ? "true" : "false"}">
          <span class="promo-video-number">${index + 1}</span>
          <span>
            <strong>${escapeHtml(video.title)}</strong>
            <small>${escapeHtml(video.id)}.mp4</small>
          </span>
          <i data-lucide="play"></i>
        </button>
      `
    )
    .join("");

  bindPromoVideoPlayer();
  bindPromoVideoViewportAutoplay();
  updatePromoPlaylistState();
  if (!player.dataset.videoId) setPromoVideo(promoVideoIndex, { play: true });
  createIconSet();
}

function deriveCategories(products, fallbackCategories = fallbackPayload.categories) {
  const labels = new Map((fallbackCategories || []).map((category) => [category.id, cleanDisplayText(category.label)]));
  const categoryIds = [...new Set(products.map((product) => product.category).filter(Boolean))];
  return [
    { id: "all", label: labels.get("all") || "ทั้งหมด" },
    ...categoryIds.map((id) => ({ id, label: labels.get(id) || id }))
  ];
}

function applyPayload(payload) {
  const payloadStore = payload.store ?? {};
  state.store = {
    ...fallbackPayload.store,
    ...payloadStore,
    support: {
      ...fallbackPayload.store.support,
      ...(payloadStore.support ?? {})
    },
    payment: {
      ...(payloadStore.payment ?? {})
    }
  };
  const visibleProducts = (Array.isArray(payload.products) ? payload.products : fallbackPayload.products)
    .filter((product) => !isExtraCatalogCategory(product.category));
  state.categories = deriveCategories(
    visibleProducts,
    Array.isArray(payload.categories) ? payload.categories : fallbackPayload.categories
  );
  state.products = visibleProducts.map((product) => ({
    ...product,
    name: cleanDisplayText(product.name),
    publisher: cleanDisplayText(product.publisher),
    label: cleanDisplayText(product.label),
    rating: cleanDisplayText(product.rating),
    delivery: cleanDisplayText(product.delivery),
    warranty: cleanDisplayText(product.warranty),
    tags: Array.isArray(product.tags) ? product.tags.map(cleanDisplayText).filter(Boolean) : [],
    badgeOverrides: normalizeBadgeOverrides(product),
    price: Number(product.price) || 0,
    compareAt: Number(product.compareAt) || 0,
    stock: Number(product.stock) || 0,
    sold: Number(product.sold) || 0
  }));
  appConfig.paymentEndpoint =
    window.OLAF_CONFIG?.paymentEndpoint ??
    state.store.paymentEndpoint ??
    state.store.payment?.paymentEndpoint ??
    "";
  appConfig.promptPayId =
    window.OLAF_CONFIG?.promptPayId ??
    state.store.promptPayId ??
    state.store.payment?.promptPayId ??
    appConfig.promptPayId;
  appConfig.serviceFee = Number(
    window.OLAF_CONFIG?.serviceFee ??
    state.store.serviceFee ??
    state.store.payment?.serviceFee ??
    appConfig.serviceFee ??
    0
  );
  appConfig.manualQrUrl = state.store.payment?.manualQrUrl || "";
}

function setApiStatus(message) {
  const status = $(selectors.apiStatus);
  if (status) status.textContent = message;
}

function renderAll() {
  refreshAccountState();
  applySiteIcon(state.store.siteIconUrl);
  applyBrandIcon(state.store.siteIconUrl);
  applyLanguage();
  renderAccount();
  renderHeroDeal();
  renderStats();
  renderSteamStorefront();
  renderRecentPurchases();
  renderPromoVideos();
  renderCategories();
  renderShowcaseCategoryState();
  renderProducts();
  renderCart();
  renderWidgets();
  renderActivityPopup();
}

function activityPopupKey(activity = {}) {
  return String(activity.campaignId || activity.updatedAt || "main-activity").trim() || "main-activity";
}

function activityPopupHiddenUntil(key) {
  try {
    const saved = JSON.parse(localStorage.getItem(storageKeys.activityPopup) || "{}");
    return Number(saved?.[key] || 0);
  } catch {
    return 0;
  }
}

function saveActivityPopupHiddenUntil(key, timestamp) {
  try {
    const saved = JSON.parse(localStorage.getItem(storageKeys.activityPopup) || "{}");
    saved[key] = timestamp;
    const now = Date.now();
    Object.keys(saved).forEach((itemKey) => {
      if (Number(saved[itemKey] || 0) < now - 7 * 24 * 60 * 60 * 1000) delete saved[itemKey];
    });
    localStorage.setItem(storageKeys.activityPopup, JSON.stringify(saved));
  } catch {
    // Storage may be unavailable in private browsing; the in-memory dismissal still applies.
  }
}

function safeActivityPopupLink(value) {
  const raw = String(value || "").trim();
  if (!raw) return "";
  try {
    const url = new URL(raw, window.location.href);
    return ["http:", "https:"].includes(url.protocol) ? url.href : "";
  } catch {
    return "";
  }
}

function safeActivityPopupImage(value) {
  const raw = String(value || "").trim();
  if (!raw) return "";
  if (/^data:image\/(?:png|jpe?g|webp);base64,/i.test(raw)) return raw;
  try {
    const url = new URL(raw, window.location.href);
    return ["http:", "https:"].includes(url.protocol) ? url.href : "";
  } catch {
    return "";
  }
}

function closeActivityPopup({ hideFor24Hours = false } = {}) {
  const popup = document.querySelector("[data-activity-popup]");
  if (!popup) return;
  const key = popup.dataset.activityKey || "main-activity";
  activityPopupDismissedKeys.add(key);
  if (hideFor24Hours) saveActivityPopupHiddenUntil(key, Date.now() + 24 * 60 * 60 * 1000);
  popup.classList.add("is-closing");
  popup.classList.remove("is-visible");
  document.documentElement.classList.remove("has-activity-popup");
  document.body?.classList.remove("has-activity-popup");
  window.setTimeout(() => popup.remove(), 260);
}

function renderActivityPopup() {
  const activity = state.store?.activityPopup ?? {};
  const key = activityPopupKey(activity);
  const existing = document.querySelector("[data-activity-popup]");
  const desktopImage = safeActivityPopupImage(activity.desktopImageUrl || activity.mobileImageUrl);
  const mobileImage = safeActivityPopupImage(activity.mobileImageUrl || desktopImage);
  // Coupon campaigns are delivered through Notifications. Legacy activity
  // records may still contain discountCode, so it must never block a normal
  // activity popup and it must never be rendered publicly below.
  const shouldShow = activity.enabled === true;

  if (!shouldShow || activityPopupDismissedKeys.has(key) || activityPopupHiddenUntil(key) > Date.now()) {
    if (existing && existing.dataset.activityKey !== key) existing.remove();
    return;
  }
  if (existing?.dataset.activityKey === key) return;
  existing?.remove();

  const title = cleanDisplayText(activity.title || "กิจกรรมพิเศษจาก OLAF SHOP");
  const message = cleanDisplayText(activity.message || "");
  const discountCode = "";
  const linkUrl = safeActivityPopupLink(activity.linkUrl);
  const linkLabel = cleanDisplayText(activity.linkLabel || "ดูรายละเอียดกิจกรรม");
  const popup = document.createElement("section");
  popup.className = "activity-popup";
  popup.dataset.activityPopup = "true";
  popup.dataset.activityKey = key;
  popup.setAttribute("role", "dialog");
  popup.setAttribute("aria-modal", "true");
  popup.setAttribute("aria-labelledby", "activity-popup-title");
  popup.innerHTML = `
    <button class="activity-popup__backdrop" type="button" aria-label="ปิดกิจกรรม" data-activity-close></button>
    <article class="activity-popup__card">
      <header class="activity-popup__header">
        <span class="activity-popup__eyebrow"><i data-lucide="party-popper"></i> EVENT</span>
        <button class="activity-popup__close" type="button" aria-label="ปิด" data-activity-close><i data-lucide="x"></i></button>
      </header>
      <div class="activity-popup__scroll">
        ${(desktopImage || mobileImage) ? `<div class="activity-popup__media">
          <img class="activity-popup__image is-desktop" src="${escapeHtml(desktopImage || mobileImage)}" alt="${escapeHtml(title)}" loading="eager" decoding="async" />
          <img class="activity-popup__image is-mobile" src="${escapeHtml(mobileImage || desktopImage)}" alt="${escapeHtml(title)}" loading="eager" decoding="async" />
        </div>` : ""}
        <div class="activity-popup__content">
          <h2 id="activity-popup-title">${escapeHtml(title)}</h2>
          ${message ? `<p>${escapeHtml(message)}</p>` : ""}
          <div class="activity-popup__actions">
            ${linkUrl ? `<a class="activity-popup__primary" href="${escapeHtml(linkUrl)}" target="_blank" rel="noopener noreferrer"><span>${escapeHtml(linkLabel)}</span><i data-lucide="arrow-up-right"></i></a>` : ""}
            ${discountCode ? `<button class="activity-popup__primary" type="button" data-activity-copy-code="${escapeHtml(discountCode)}"><i data-lucide="copy"></i><span>คัดลอกโค้ด ${escapeHtml(discountCode)}</span></button>` : ""}
            <button class="activity-popup__secondary" type="button" data-activity-hide-day><i data-lucide="clock-3"></i><span>ไม่แสดง 24 ชั่วโมง</span></button>
          </div>
        </div>
      </div>
    </article>
  `;

  popup.querySelectorAll("[data-activity-close]").forEach((button) => {
    button.addEventListener("click", () => closeActivityPopup());
  });
  popup.querySelector("[data-activity-hide-day]")?.addEventListener("click", () => {
    closeActivityPopup({ hideFor24Hours: true });
  });
  popup.querySelector("[data-activity-copy-code]")?.addEventListener("click", async (event) => {
    const code = event.currentTarget.dataset.activityCopyCode || "";
    try {
      await navigator.clipboard.writeText(code);
      event.currentTarget.querySelector("span")?.replaceChildren(document.createTextNode("คัดลอกโค้ดแล้ว"));
    } catch {
      showToast("คัดลอกโค้ดไม่สำเร็จ กรุณากดค้างเพื่อคัดลอก", "warning");
    }
  });
  popup.addEventListener("keydown", (event) => {
    if (event.key === "Escape") closeActivityPopup();
  });
  document.body.append(popup);
  document.documentElement.classList.add("has-activity-popup");
  document.body.classList.add("has-activity-popup");
  window.requestAnimationFrame(() => popup.classList.add("is-visible"));
  createIconSet();
  popup.querySelector(".activity-popup__close")?.focus({ preventScroll: true });
}

function renderAccount() {
  const openAuthEl = $(selectors.openAuth);
  const labelEl = $(selectors.accountLabel);
  const registerBtn = document.querySelector(".register-button");
  const authIcon = openAuthEl?.querySelector("svg, i");

  if (!state.authReady) {
    if (labelEl) labelEl.textContent = "กำลังโหลดข้อมูล";
    if (openAuthEl) {
      openAuthEl.classList.add("is-auth-loading");
      openAuthEl.setAttribute("aria-busy", "true");
    }
    if (registerBtn) registerBtn.style.display = "none";
    if (authIcon) {
      if (authIcon.tagName.toLowerCase() === "svg") {
        const newI = document.createElement("i");
        newI.setAttribute("data-lucide", "loader-circle");
        authIcon.replaceWith(newI);
      } else {
        authIcon.setAttribute("data-lucide", "loader-circle");
      }
    }
    if (window.lucide) window.lucide.createIcons();
    return;
  }

  const label = state.currentUser ? state.currentUser.displayName || state.currentUser.username : t("account");
  if (labelEl) labelEl.textContent = label;

  if (openAuthEl) {
    openAuthEl.classList.remove("is-auth-loading");
    openAuthEl.removeAttribute("aria-busy");
    openAuthEl.classList.toggle("is-signed-in", Boolean(state.currentUser));
  }

  if (registerBtn) {
    registerBtn.style.display = state.currentUser ? "none" : "";
  }

  if (authIcon) {
    const newIcon = state.currentUser ? "user" : "log-in";
    if (authIcon.tagName.toLowerCase() === "svg") {
      const newI = document.createElement("i");
      newI.setAttribute("data-lucide", newIcon);
      authIcon.replaceWith(newI);
      if (window.lucide) window.lucide.createIcons();
    } else {
      authIcon.setAttribute("data-lucide", newIcon);
    }
  }
}

function productLink(product) {
  return `product.html?id=${encodeURIComponent(product.id)}`;
}

function productPreviewImages(product) {
  const cover = product.heroImage || product.image;
  const allImages = [...new Set([
    cover,
    ...(product.gallery || []),
    product.heroImage,
    product.image
  ].filter(Boolean))];

  if (allImages.length > 1) {
    return allImages.slice(1, 4); // skip first image (cover), take next 3
  }
  return allImages.slice(0, 3);
}

function widgetMarker(code = "") {
  const match = String(code).match(/data-olaf-widget=["']([^"']+)["']/);
  return match?.[1] || "";
}

function renderSteamShowcaseWidget() {
  const products = [...state.products]
    .sort((a, b) => Number(b.sold || 0) - Number(a.sold || 0))
    .slice(0, 9);
  if (!products.length) return "";

  const rows = products
    .map((product, index) => {
      const discount = getDiscount(product);
      const images = productPreviewImages(product);
      const tags = getDisplayTags(product, 4);
      const productName = cleanDisplayText(product.name);
      const publisher = cleanDisplayText(product.publisher);
      const rating = cleanDisplayText(product.rating) || "แนะนำ";
      return `
        <div class="olaf-steam-row">
          <a class="olaf-steam-item" href="${productLink(product)}">
            <img ${fastImg(product.image || product.heroImage, productName, { className: "olaf-steam-thumb" })} />
            <div class="olaf-steam-info">
              <strong>${escapeHtml(productName)}</strong>
              <span>${escapeHtml(tags.join(", ") || publisher || "Steam Game")}</span>
            </div>
            <div class="olaf-steam-price">
              ${discount
          ? `<span class="olaf-sale-pct">-${discount}%</span><span class="olaf-sale-price"><del>${formatPrice(product.compareAt)}</del><b>${formatPrice(product.price)}</b></span>`
          : `<b>${formatPrice(product.price)}</b>`
        }
            </div>
          </a>
          <aside class="olaf-steam-preview ${index === 0 ? "is-default" : ""}">
            <h3>${escapeHtml(productName)}</h3>
            <p>รีวิวโดยรวม <span>${escapeHtml(rating)}</span> · ขายแล้ว ${Number(product.sold || 0).toLocaleString("th-TH")} ชิ้น</p>
            <div class="olaf-preview-tags">
              ${tags.map((tag) => `<span>${escapeHtml(tag)}</span>`).join("")}
            </div>
            <div class="olaf-preview-images">
              ${images.map((image) => `<img ${fastImg(image, `${productName} preview`)} />`).join("")}
            </div>
          </aside>
        </div>
      `;
    })
    .join("");

  return `
    <section class="olaf-steam-widget">
      <div class="olaf-widget-head">
        <div>
          <p class="eyebrow">Steam Platform Widget</p>
          <h2>เกมยอดนิยมแบบ Steam Preview</h2>
        </div>
        ${renderShowcaseCategoryTabs()}
      </div>
      <div class="olaf-steam-body">
        <div class="olaf-steam-list">${rows}</div>
        <div class="olaf-steam-preview-space" aria-hidden="true"></div>
      </div>
    </section>
  `;
}

function renderShowcaseCategoryTabs() {
  const tabs = state.categories;
  return `
    <div class="olaf-widget-tabs" role="tablist" aria-label="หมวดสินค้าแนะนำ">
      ${tabs
      .map((category) => {
        const categoryId = category.id;
        const label = category.label;
        const isActive = state.selectedCategory === categoryId;
        return `
            <button
              class="olaf-widget-tab ${isActive ? "is-active" : ""}"
              type="button"
              role="tab"
              aria-selected="${isActive ? "true" : "false"}"
              data-showcase-category="${escapeHtml(categoryId)}"
            >${escapeHtml(label)}</button>
          `;
      })
      .join("")}
    </div>
  `;
}

function renderTrustCardsWidget() {
  const cards = [
    ["send", "จัดส่งหลังแอดมินยืนยัน", "แนบสลิปแล้วรอตรวจสอบ อัปเดตออเดอร์และข้อมูลจัดส่งจากหลังบ้าน"],
    ["shield-check", "ปลอดภัยและตรวจสอบได้", "เก็บสถานะออเดอร์และรีวิวไว้ในระบบร้าน"],
    ["qr-code", "ชำระเงินสะดวก", "รองรับ QR PromptPay / Wallet / โอนธนาคาร และตั้งค่า QR เองได้"]
  ];
  return `
    <section class="olaf-trust-widget">
      ${cards
      .map(
        ([icon, title, text], index) => `
            <article class="olaf-trust-card">
              <span class="olaf-trust-icon tone-${index + 1}"><i data-lucide="${icon}"></i></span>
              <h3>${title}</h3>
              <p>${text}</p>
            </article>
          `
      )
      .join("")}
    </section>
  `;
}

function renderSocialStripWidget() {
  return ``;
}

function renderLicenseCardsWidget() {
  const cards = [
    {
      name: "Windows 10 Home",
      type: "OEM",
      badge: "",
      price: "฿199",
      oldPrice: "฿4,385",
      note: "คีย์สำหรับ Windows 10 Home แท้ 100%",
      items: ["ลอคอินได้", "License Key Code", "ติดตั้งได้ 1 เครื่อง", "รับประกันคีย์แท้"],
      highlight: false
    },
    {
      name: "Windows 10 Pro",
      type: "Retail",
      badge: "ยอดนิยม",
      price: "฿199",
      oldPrice: "฿4,890",
      note: "คีย์สำหรับ Windows 10 Professional แท้ 100%",
      items: ["ลอคอินได้", "รองรับฟีเจอร์ Pro ครบ", "BitLocker Encryption", "Remote Desktop", "License Key Code", "ย้ายเครื่องได้"],
      highlight: true
    },
    {
      name: "Windows 11 Home",
      type: "OEM",
      badge: "",
      price: "฿199",
      oldPrice: "฿4,385",
      note: "คีย์สำหรับ Windows 11 Home แท้ 100%",
      items: ["ลอคอินได้", "Windows 11 ล่าสุด", "ติดตั้งได้ 1 เครื่อง", "License Key Code", "UI ใหม่สวยงาม"],
      highlight: false
    },
    {
      name: "Windows 11 Pro",
      type: "Retail",
      badge: "ยอดนิยม",
      price: "฿199",
      oldPrice: "฿4,850",
      note: "คีย์สำหรับ Windows 11 Professional แท้ 100%",
      items: ["ลอคอินได้", "Windows 11 Pro ครบฟีเจอร์", "Hyper-V Support", "Windows Sandbox", "License Key Code", "ย้ายเครื่องได้"],
      highlight: true
    }
  ];
  const promises = [
    ["shield-check", "ยืนยัน 100%", "ใช้งานได้แน่นอน"],
    ["download", "สั่งซื้อผ่านแอดมิน", "ติดต่อซื้อที่แอดมิน"],
    ["shield", "คีย์แท้ 100%", "รับประกัน 30 วัน"],
    ["life-buoy", "ซัพพอร์ต", "มีแอดมินให้คำแนะนำ"]
  ];
  return `
    <section class="olaf-license-widget">
      <div class="olaf-widget-head">
        <div>
          <p class="eyebrow">Windows Key Category</p>
          <h2>Windows 10 & 11 Keys</h2>
          <p class="olaf-license-lead">คีย์ Windows แท้ ราคาพิเศษ</p>
        </div>
      </div>
      <div class="olaf-license-promise-row">
        ${promises
          .map(
            ([icon, title, text]) => `
              <article class="olaf-license-promise">
                <span class="olaf-license-promise-icon"><i data-lucide="${icon}"></i></span>
                <div>
                  <strong>${title}</strong>
                  <small>${text}</small>
                </div>
              </article>
            `
          )
          .join("")}
      </div>
      <div class="olaf-license-grid">
        ${cards
          .map(
            (card) => `
              <article class="olaf-license-card${card.highlight ? " is-highlight" : ""}">
                <div class="license-card-top">
                  <div class="license-type-badges">
                    <span class="license-type-badge">${card.type}</span>
                    ${card.badge ? `<span class="license-hot-badge">${card.badge}</span>` : ""}
                  </div>
                  <h3>${card.name}</h3>
                  <p>${card.note}</p>
                </div>
                <div class="license-price"><strong>${card.price}</strong><del>${card.oldPrice}</del></div>
                <ul>
                  ${card.items.map((item) => `<li><i data-lucide="check"></i>${item}</li>`).join("")}
                </ul>
                <a href="https://www.facebook.com/byOlafshop" target="_blank" rel="noopener noreferrer">สั่งซื้อที่แอดมิน</a>
                <small class="license-ready-note"><i data-lucide="shield-check"></i>พร้อมส่งทันที</small>
              </article>
            `
          )
          .join("")}
      </div>
    </section>
  `;
}

function renderWidgetContent(widget) {
  const marker = widgetMarker(widget.code);
  if (marker === "steam-showcase") return renderSteamShowcaseWidget();
  if (marker === "trust-cards") return renderTrustCardsWidget();
  if (marker === "social-strip") return renderSocialStripWidget();
  if (marker === "license-cards") return renderLicenseCardsWidget();
  return widget.code;
}

function renderWidgetArticle(widget) {
  const content = renderWidgetContent(widget);
  if (!content || content.trim() === "") return "";
  return `
    <article class="store-widget ${widgetMarker(widget.code) ? "is-built-in-widget" : ""}">
      <div class="widget-title">${escapeHtml(widget.title)}</div>
      <div class="widget-code">${content}</div>
    </article>
  `;
}

function renderWidgetList(zone, widgets) {
  if (!zone) return;
  const html = widgets.map(renderWidgetArticle).join("");
  zone.hidden = html.trim() === "";
  zone.innerHTML = html;
}

function renderWidgets() {
  const zone = document.querySelector("#widget-zone");
  const steamZone = document.querySelector("#steam-preview-zone");
  const windowsZone = document.querySelector("#windows-license-zone");
  if ((!zone && !steamZone && !windowsZone) || !window.OlafStore) return;
  const widgets = window.OlafStore
    .getWidgets()
    .filter((widget) => widget.status === "active" && widget.placement === "home");

  renderWidgetList(steamZone, widgets.filter((widget) => widgetMarker(widget.code) === "steam-showcase"));
  renderWidgetList(windowsZone, widgets.filter((widget) => widgetMarker(widget.code) === "license-cards"));
  renderWidgetList(
    zone,
    widgets.filter((widget) => !["steam-showcase", "license-cards"].includes(widgetMarker(widget.code)))
  );
  createIconSet();
  hydrateImages();
}

function renderHeroDeal() {
  const deal = [...state.products]
    .filter((product) => product.stock > 0)
    .sort((a, b) => getDiscount(b) - getDiscount(a))[0];

  if (!deal) return;

  const stock = getStockState(deal.stock);
  $(selectors.heroDeal).innerHTML = `
    <article class="deal-card">
      <img ${fastImg(deal.image || deal.heroImage, deal.name, { priority: true })} />
      <div class="deal-card-body">
        <span class="label-pill badge-tone-steam">STEAM</span>
        <h2>${escapeHtml(deal.name)}</h2>
        <div class="product-meta">
          <span class="stock-pill ${stock.className}">${stock.label}</span>
          <span class="discount-pill">-${getDiscount(deal)}%</span>
        </div>
        <div class="price-row">
          <strong class="price">${formatPrice(deal.price)}</strong>
          <span class="compare-price">${formatPrice(deal.compareAt)}</span>
        </div>
        <a class="primary-button" href="product.html?id=${encodeURIComponent(deal.id)}">
          <i data-lucide="shopping-bag"></i>
          ${t("orderNow")}
        </a>
      </div>
    </article>
  `;
}

function renderStats() {
  const totalStock = state.products.reduce((sum, product) => sum + product.stock, 0);
  const totalSold = state.products.reduce((sum, product) => sum + product.sold, 0);
  const accountStock = state.products
    .filter((product) => product.category === "steam-account")
    .reduce((sum, product) => sum + product.stock, 0);

  $("#stat-products").textContent = state.products.length.toLocaleString("th-TH");
  $("#stat-stock").textContent = totalStock.toLocaleString("th-TH");
  $("#stat-sold").textContent = totalSold.toLocaleString("th-TH");
  $("#stat-accounts").textContent = accountStock.toLocaleString("th-TH");

  const capacity = Math.max(totalStock + totalSold * 0.02, totalStock, 1);
  const stockPercent = Math.min(100, Math.round((totalStock / capacity) * 100));
  $(selectors.stockMeterFill).style.width = `${stockPercent}%`;
  $(selectors.stockMeterText).textContent = `${totalStock.toLocaleString("th-TH")} ชิ้นพร้อมส่งจาก ${state.products.length} รายการ`;
}

function steamStorefrontProducts() {
  return [...state.products].sort((a, b) => {
    const stockDelta = Number(b.stock > 0) - Number(a.stock > 0);
    if (stockDelta) return stockDelta;
    return Number(b.sold || 0) - Number(a.sold || 0);
  });
}

function steamSpotlightProducts() {
  return steamStorefrontProducts()
    .filter((product) => product.stock > 0)
    .sort((a, b) => steamSpotlightRandomScore(a) - steamSpotlightRandomScore(b))
    .slice(0, 7);
}

function steamSpotlightRandomScore(product) {
  const value = `${steamSpotlightSessionSeed}:${product.id}:${product.name}`;
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function steamDealsProducts() {
  const products = steamStorefrontProducts();
  const discounted = products
    .filter((product) => product.stock > 0 && getDiscount(product) > 0)
    .sort((a, b) => getDiscount(b) - getDiscount(a) || Number(b.sold || 0) - Number(a.sold || 0));
  const fallback = products.filter((product) => product.stock > 0 && !discounted.includes(product));
  return [...discounted, ...fallback].slice(0, 12);
}

function steamDiscoveryProducts(mode = steamDiscoveryMode) {
  const products = steamStorefrontProducts();
  const sorters = {
    top: (a, b) => Number(b.sold || 0) - Number(a.sold || 0),
    new: (a, b) => String(b.createdAt || b.updatedAt || b.id).localeCompare(String(a.createdAt || a.updatedAt || a.id)),
    deals: (a, b) => getDiscount(b) - getDiscount(a) || Number(b.sold || 0) - Number(a.sold || 0),
    stock: (a, b) => Number(b.stock || 0) - Number(a.stock || 0) || Number(b.sold || 0) - Number(a.sold || 0)
  };
  let filtered = products;
  if (mode === "deals") filtered = products.filter((product) => getDiscount(product) > 0);
  if (mode === "stock") filtered = products.filter((product) => product.stock > 0);
  return [...filtered].sort(sorters[mode] || sorters.top).slice(0, 10);
}

function steamStoreDescription(product, maxLength = 150) {
  const text = cleanDisplayText(
    product.description || product.delivery || product.warranty || "สินค้าเกมพร้อมบริการจาก OLAF SHOP"
  );
  if (text.length <= maxLength) return text;
  return `${text.slice(0, maxLength).trim()}…`;
}

function steamPriceMarkup(product, className = "") {
  const discount = getDiscount(product);
  return `
    <div class="olaf-steam-price ${className}">
      ${discount > 0 ? `<span class="olaf-steam-discount">-${discount}%</span>` : ""}
      <span class="olaf-steam-price-stack">
        ${discount > 0 ? `<del>${formatPrice(product.compareAt)}</del>` : ""}
        <strong>${formatPrice(product.price)}</strong>
      </span>
    </div>
  `;
}

function steamSpotlightMarkup(product, products) {
  const productName = cleanDisplayText(product.name);
  const images = [...new Set([
    product.heroImage,
    ...(product.gallery || []),
    product.image
  ].filter(Boolean))];
  const cover = images[0] || product.image || product.heroImage || "";
  const thumbs = images.length > 1 ? images.slice(1, 5) : images.slice(0, 1);
  const tags = getDisplayTags(product, 5);
  const stock = getStockState(product.stock);
  const index = products.findIndex((item) => item.id === product.id);

  return `
    <article class="olaf-steam-spotlight">
      <a class="olaf-steam-spotlight-cover" href="${productLink(product)}" aria-label="ดูรายละเอียด ${escapeHtml(productName)}">
        <img ${fastImg(cover, productName, {
          loading: "eager",
          fetchPriority: "high",
          width: 920,
          height: 518,
          sizes: "(max-width: 980px) calc(100vw - 28px), 62vw"
        })} />
        <span class="olaf-steam-cover-glow" aria-hidden="true"></span>
      </a>
      <div class="olaf-steam-spotlight-info">
        <p class="olaf-steam-kicker">FEATURED &amp; RECOMMENDED</p>
        <h3><a href="${productLink(product)}">${escapeHtml(productName)}</a></h3>
        <p class="olaf-steam-description">${escapeHtml(steamStoreDescription(product))}</p>
        <div class="olaf-steam-shot-grid" aria-label="ภาพตัวอย่างสินค้า">
          ${thumbs.map((image, thumbIndex) => `
            <a href="${productLink(product)}" aria-label="ภาพตัวอย่าง ${thumbIndex + 1} ของ ${escapeHtml(productName)}">
              <img ${fastImg(image, `${productName} ภาพตัวอย่าง ${thumbIndex + 1}`, {
                width: 320,
                height: 180,
                sizes: "(max-width: 640px) 23vw, 160px"
              })} />
            </a>
          `).join("")}
        </div>
        <div class="olaf-steam-tags">
          ${tags.map((tag) => `<span>${escapeHtml(tag)}</span>`).join("")}
        </div>
        <div class="olaf-steam-spotlight-foot">
          <span class="olaf-steam-stock ${stock.className}">${escapeHtml(stock.label)}</span>
          ${steamPriceMarkup(product)}
        </div>
      </div>
      ${products.length > 1 ? `
        <button class="olaf-steam-arrow is-prev" type="button" data-steam-spotlight-step="-1" aria-label="สินค้าเด่นก่อนหน้า">
          <i data-lucide="chevron-left"></i>
        </button>
        <button class="olaf-steam-arrow is-next" type="button" data-steam-spotlight-step="1" aria-label="สินค้าเด่นถัดไป">
          <i data-lucide="chevron-right"></i>
        </button>
        <div class="olaf-steam-dots" role="tablist" aria-label="เลือกสินค้าเด่น">
          ${products.map((item, dotIndex) => `
            <button type="button" role="tab" aria-selected="${dotIndex === index}" class="${dotIndex === index ? "is-active" : ""}" data-steam-spotlight-dot="${dotIndex}" aria-label="${escapeHtml(cleanDisplayText(item.name))}"></button>
          `).join("")}
        </div>
      ` : ""}
    </article>
  `;
}

function renderSteamSpotlightStage() {
  const stage = document.querySelector("[data-steam-spotlight-stage]");
  if (!stage) return;
  const products = steamSpotlightProducts();
  if (!products.length) {
    stage.innerHTML = `<div class="olaf-steam-empty">ยังไม่มีสินค้าแนะนำในขณะนี้</div>`;
    return;
  }
  steamSpotlightIndex = ((steamSpotlightIndex % products.length) + products.length) % products.length;
  stage.innerHTML = steamSpotlightMarkup(products[steamSpotlightIndex], products);
  createIconSet();
  hydrateImages();
}

function steamDealCardMarkup(product) {
  const image = product.image || product.heroImage || "";
  const stock = getStockState(product.stock);
  return `
    <a class="olaf-steam-deal-card" href="${productLink(product)}">
      <span class="olaf-steam-deal-media">
        <img ${fastImg(image, cleanDisplayText(product.name), {
          width: 640,
          height: 360,
          sizes: "(max-width: 640px) 76vw, 280px"
        })} />
        <span class="olaf-steam-deal-sheen" aria-hidden="true"></span>
      </span>
      <span class="olaf-steam-deal-body">
        <span class="olaf-steam-deal-name">${escapeHtml(cleanDisplayText(product.name))}</span>
        <span class="olaf-steam-deal-meta">
          <small class="${stock.className}">${escapeHtml(stock.label)}</small>
          ${steamPriceMarkup(product, "is-compact")}
        </span>
      </span>
    </a>
  `;
}

function steamDiscoveryPreviewMarkup(product) {
  if (!product) return `<div class="olaf-steam-empty">เลือกสินค้าเพื่อดูตัวอย่าง</div>`;
  const images = [...new Set([
    product.heroImage,
    ...(product.gallery || []),
    product.image
  ].filter(Boolean))].slice(0, 4);
  const tags = getDisplayTags(product, 4);
  return `
    <div class="olaf-steam-preview-card">
      <p>กำลังดู</p>
      <h3>${escapeHtml(cleanDisplayText(product.name))}</h3>
      <span class="olaf-steam-preview-rating">ได้รับความนิยมใน OLAF SHOP</span>
      <div class="olaf-steam-preview-images">
        ${images.map((image, index) => `<img ${fastImg(image, `${cleanDisplayText(product.name)} ${index + 1}`, {
          width: 460,
          height: 258,
          sizes: "320px"
        })} />`).join("")}
      </div>
      <div class="olaf-steam-tags">${tags.map((tag) => `<span>${escapeHtml(tag)}</span>`).join("")}</div>
    </div>
  `;
}

function renderSteamDiscoveryContent() {
  const content = document.querySelector("[data-steam-discovery-content]");
  if (!content) return;
  const products = steamDiscoveryProducts();
  if (!products.length) {
    content.innerHTML = `<div class="olaf-steam-empty">ยังไม่มีสินค้าในรายการนี้</div>`;
    return;
  }

  if (!products.some((product) => product.id === steamDiscoveryPreviewId)) {
    steamDiscoveryPreviewId = products[0].id;
  }
  const previewProduct = products.find((product) => product.id === steamDiscoveryPreviewId) || products[0];
  content.innerHTML = `
    <div class="olaf-steam-discovery-list">
      ${products.map((product) => {
        const stock = getStockState(product.stock);
        const tags = getDisplayTags(product, 3);
        const image = product.image || product.heroImage || "";
        return `
          <a class="olaf-steam-discovery-row ${product.id === previewProduct.id ? "is-active" : ""}" href="${productLink(product)}" data-steam-discovery-product="${escapeHtml(product.id)}">
            <img ${fastImg(image, cleanDisplayText(product.name), {
              width: 368,
              height: 138,
              sizes: "(max-width: 640px) 112px, 184px"
            })} />
            <span class="olaf-steam-discovery-copy">
              <strong>${escapeHtml(cleanDisplayText(product.name))}</strong>
              <small>${escapeHtml(tags.join(", ") || getCategoryLabel(product.category))}</small>
              <em class="${stock.className}">${escapeHtml(stock.label)}</em>
            </span>
            ${steamPriceMarkup(product, "is-row")}
          </a>
        `;
      }).join("")}
    </div>
    <aside class="olaf-steam-discovery-preview" data-steam-discovery-preview aria-live="polite">
      ${steamDiscoveryPreviewMarkup(previewProduct)}
    </aside>
  `;
  createIconSet();
  hydrateImages();
}

function scheduleSteamStorefrontRotation() {
  window.clearInterval(steamStorefrontTimer);
  if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return;
  if (steamSpotlightProducts().length < 2) return;
  steamStorefrontTimer = window.setInterval(() => {
    const section = document.querySelector("#olaf-steam-storefront");
    if (!section || document.hidden || section.matches(":hover") || section.contains(document.activeElement)) return;
    steamSpotlightIndex += 1;
    renderSteamSpotlightStage();
  }, 6500);
}

function renderSteamStorefrontLegacyV90() {
  const section = document.querySelector("#olaf-steam-storefront");
  if (!section) return;
  const products = steamStorefrontProducts();
  if (!products.length) {
    section.innerHTML = `<div class="olaf-steam-store-loading"><span class="olaf-steam-loading-orbit" aria-hidden="true"></span><span>กำลังโหลดสินค้าจากร้าน...</span></div>`;
    return;
  }

  const navCategories = state.categories.filter((category) => category.id !== "all").slice(0, 6);
  const deals = steamDealsProducts();
  section.innerHTML = `
    <nav class="olaf-steam-subnav" aria-label="เมนูค้นพบสินค้า">
      <div class="olaf-steam-subnav-links">
        <button type="button" data-steam-category="all">ร้านค้า</button>
        ${navCategories.map((category) => `<button type="button" data-steam-category="${escapeHtml(category.id)}">${escapeHtml(cleanDisplayText(category.label))}</button>`).join("")}
      </div>
      <form class="olaf-steam-search" data-steam-store-search role="search">
        <label class="sr-only" for="olaf-steam-search-input">ค้นหาสินค้า</label>
        <input id="olaf-steam-search-input" type="search" name="search" value="${escapeHtml(state.query)}" placeholder="ค้นหาในร้าน..." autocomplete="off" />
        <button type="submit" aria-label="ค้นหา"><i data-lucide="search"></i></button>
      </form>
    </nav>

    <header class="olaf-steam-section-head">
      <div><p>OLAF STORE DISCOVERY</p><h2>สินค้าเด่นและแนะนำ</h2></div>
      <a href="#catalog">เลือกดูสินค้าทั้งหมด <i data-lucide="arrow-right"></i></a>
    </header>
    <div class="olaf-steam-spotlight-stage" data-steam-spotlight-stage></div>

    ${deals.length ? `
      <div class="olaf-steam-section-head is-deals">
        <div><p>SPECIAL OFFERS</p><h2>ดีลและสินค้าน่าสนใจ</h2></div>
        <div class="olaf-steam-track-controls">
          <button type="button" data-steam-deals-scroll="-1" aria-label="เลื่อนดีลไปทางซ้าย"><i data-lucide="chevron-left"></i></button>
          <button type="button" data-steam-deals-scroll="1" aria-label="เลื่อนดีลไปทางขวา"><i data-lucide="chevron-right"></i></button>
        </div>
      </div>
      <div class="olaf-steam-deals-track" data-steam-deals-track>
        ${deals.map(steamDealCardMarkup).join("")}
      </div>
    ` : ""}

    <section class="olaf-steam-discovery" aria-labelledby="olaf-steam-discovery-title">
      <div class="olaf-steam-section-head is-discovery">
        <div><p>DISCOVER MORE</p><h2 id="olaf-steam-discovery-title">เลือกดูสินค้าเพิ่มเติม</h2></div>
      </div>
      <div class="olaf-steam-tabs" role="tablist" aria-label="รูปแบบรายการสินค้า">
        ${[
          ["top", "สินค้าขายดี"],
          ["new", "มาใหม่"],
          ["deals", "ลดราคา"],
          ["stock", "พร้อมส่ง"]
        ].map(([mode, label]) => `<button type="button" role="tab" aria-selected="${steamDiscoveryMode === mode}" class="${steamDiscoveryMode === mode ? "is-active" : ""}" data-steam-discovery-mode="${mode}">${label}</button>`).join("")}
      </div>
      <div class="olaf-steam-discovery-content" data-steam-discovery-content></div>
    </section>
  `;

  renderSteamSpotlightStage();
  renderSteamDiscoveryContent();
  scheduleSteamStorefrontRotation();
  createIconSet();
  hydrateImages();
}

function steamEditorialSearchText(product) {
  return normalizeCatalogSearch([
    product.name,
    product.publisher,
    product.category,
    ...(product.tags || [])
  ].filter(Boolean).join(" "));
}

function steamEditorialCollectionsLegacy(products) {
  const available = products.filter((product) => product.stock > 0);
  const used = new Set();
  const pick = (pattern, count) => {
    const matched = available.filter((product) => pattern.test(steamEditorialSearchText(product)));
    const candidates = [...matched, ...available];
    const selected = [];
    for (const product of candidates) {
      if (used.has(product.id) || selected.some((item) => item.id === product.id)) continue;
      selected.push(product);
      used.add(product.id);
      if (selected.length === count) break;
    }
    return selected;
  };

  const fastGames = pick(/race|racing|speed|drive|formula|assetto|forza|f1|แข่ง|รถ/, 2);
  const actionGames = pick(/action|adventure|shooter|fps|fight|sport|football|controller|แอ็ก|ยิง|ต่อสู้|ผจญภัย|กีฬา/, 4);
  return [
    {
      title: fastGames.some((product) => /race|racing|speed|drive|formula|assetto|forza|f1|แข่ง|รถ/.test(steamEditorialSearchText(product)))
        ? "เกมแข่งขันความเร็ว"
        : "เกมยอดนิยมประจำสัปดาห์",
      subtitle: "เลือกจากสินค้ายอดนิยมและสต็อกพร้อมส่งภายในร้าน",
      layout: "feature",
      products: fastGames
    },
    {
      title: "เกมแอ็กชันและคอนโทรลเลอร์",
      subtitle: "คัดสรรเกมที่เหมาะกับการเล่นต่อเนื่องและการควบคุมที่สนุก",
      layout: "tiles",
      products: actionGames
    }
  ].filter((collection) => collection.products.length);
}

function steamEditorialRandomScore(product, salt = "editorial") {
  const value = `${steamSpotlightSessionSeed}:${salt}:${product.id}:${product.name}`;
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function steamEditorialShuffle(products, salt) {
  return [...products].sort((a, b) => (
    steamEditorialRandomScore(a, salt) - steamEditorialRandomScore(b, salt)
  ));
}

function steamEditorialPopularRandom(products, count, salt) {
  const popularPool = [...products]
    .sort((a, b) => Number(b.sold || 0) - Number(a.sold || 0))
    .slice(0, Math.max(count * 5, count));
  return steamEditorialShuffle(popularPool, salt).slice(0, count);
}

function steamEditorialCollections(products) {
  const available = products.filter((product) => Number(product.stock || 0) > 0);
  const used = new Set();
  const pickPopularRandom = (pattern, count, salt, allowFallback = true) => {
    const matched = available.filter((product) => pattern.test(steamEditorialSearchText(product)));
    const source = matched.length ? matched : (allowFallback ? available : []);
    const selected = steamEditorialPopularRandom(
      source.filter((product) => !used.has(product.id)),
      count,
      salt
    );
    selected.forEach((product) => used.add(product.id));
    return selected;
  };

  const racingPattern = /\b(race|racing|racer|speed|drive|driver|driving|car|cars|vehicle|formula|motorsport|motorcycle|motogp|moto gp|rally|offroad|wrc|nascar|kart|f1|f 1|f2|f 2|forza|assetto|dirt|grid|nfs|need for speed|the crew)\b|แข่ง|รถ|ขับ|ความเร็ว|มอเตอร์สปอร์ต|ฟอร์มูล่า/;
  const actionPattern = /\b(action|adventure|shooter|fps|fight|fighting|sport|football|controller|souls|rpg)\b|แอ็กชัน|แอ็คชัน|ยิง|ต่อสู้|ผจญภัย|กีฬา/;
  const fastGames = pickPopularRandom(racingPattern, 2, "racing", false);
  const actionGames = pickPopularRandom(actionPattern, 4, "action", true);

  return [
    {
      title: "เกมแข่งขันความเร็ว",
      subtitle: "เลือกจากสินค้ายอดนิยมและสต็อกพร้อมส่งภายในร้าน",
      layout: "feature",
      products: fastGames
    },
    {
      title: "เกมแอ็กชันและคอนโทรลเลอร์",
      subtitle: "คัดสรรเกมที่เหมาะกับการเล่นต่อเนื่องและการควบคุมที่สนุก",
      layout: "tiles",
      products: actionGames
    }
  ].filter((collection) => collection.products.length);
}

function steamEditorialCardMarkup(product, layout = "tiles") {
  const image = product.heroImage || product.image || "";
  const discount = getDiscount(product);
  return `
    <a class="olaf-steam-editorial-card is-${layout}" href="${productLink(product)}">
      <span class="olaf-steam-editorial-media">
        <img ${fastImg(image, cleanDisplayText(product.name), {
          width: layout === "feature" ? 960 : 560,
          height: layout === "feature" ? 540 : 315,
          sizes: layout === "feature"
            ? "(max-width: 640px) 84vw, 50vw"
            : "(max-width: 640px) 68vw, 25vw"
        })} />
        <span class="olaf-steam-editorial-overlay">
          <strong>${escapeHtml(cleanDisplayText(product.name))}</strong>
          <small>${escapeHtml(getCategoryLabel(product.category))}</small>
        </span>
      </span>
      <span class="olaf-steam-editorial-price">
        ${discount > 0 ? `<b>-${discount}%</b>` : ""}
        ${discount > 0 ? `<del>${formatPrice(product.compareAt)}</del>` : ""}
        <strong>${formatPrice(product.price)}</strong>
      </span>
    </a>
  `;
}

function steamEditorialCollectionsMarkup(products) {
  const collections = steamEditorialCollections(products);
  if (!collections.length) return "";
  return `
    <section class="olaf-steam-collection-shelves" aria-label="คอลเลกชันเกมแนะนำ">
      ${collections.map((collection) => `
        <article class="olaf-steam-collection-row is-${collection.layout}">
          <header>
            <h3>${escapeHtml(collection.title)}</h3>
            <p>${escapeHtml(collection.subtitle)}</p>
          </header>
          <div class="olaf-steam-collection-track">
            ${collection.products.map((product) => steamEditorialCardMarkup(product, collection.layout)).join("")}
          </div>
        </article>
      `).join("")}
    </section>
  `;
}

function steamActivitySlides(products) {
  const available = products.filter((product) => Number(product.stock || 0) > 0);
  if (!available.length) return [];

  const discounted = available
    .filter((product) => getDiscount(product) > 0)
    .sort((a, b) => getDiscount(b) - getDiscount(a) || Number(b.sold || 0) - Number(a.sold || 0));
  const regular = available
    .filter((product) => !discounted.some((deal) => deal.id === product.id))
    .sort((a, b) => Number(b.sold || 0) - Number(a.sold || 0));
  const pool = [
    ...steamEditorialShuffle(discounted.slice(0, 24), "activity-deals"),
    ...steamEditorialShuffle(regular.slice(0, 24), "activity-regular")
  ];
  const slides = [];
  for (let slideIndex = 0; slideIndex < 4; slideIndex += 1) {
    const selected = [];
    for (let offset = 0; offset < pool.length && selected.length < 4; offset += 1) {
      const product = pool[(slideIndex * 4 + offset) % pool.length];
      if (product && !selected.some((item) => item.id === product.id)) selected.push(product);
    }
    if (selected.length) slides.push(selected);
  }
  return slides;
}

function steamActivityCardMarkup(product, index) {
  const image = product.heroImage || product.image || "";
  const discount = getDiscount(product);
  const dealLabel = discount > 0
    ? (index < 2 ? "ข้อเสนอสุดสัปดาห์" : "ข้อเสนอในวันนี้")
    : "พร้อมส่งจากร้าน";
  const labelTone = discount <= 0 ? "is-today" : (index < 2 ? "is-weekend" : "is-today");
  return `
    <a class="olaf-steam-activity-card is-slot-${index + 1}" href="${productLink(product)}">
      <span class="olaf-steam-activity-media">
        <img ${fastImg(image, cleanDisplayText(product.name), {
          width: index < 2 ? 780 : 580,
          height: index < 2 ? 980 : 326,
          sizes: index < 2 ? "(max-width: 720px) 44vw, 30vw" : "(max-width: 720px) 44vw, 28vw"
        })} />
      </span>
      <span class="olaf-steam-activity-label ${labelTone}">${escapeHtml(dealLabel)}</span>
      <span class="olaf-steam-activity-info">
        <strong>${escapeHtml(cleanDisplayText(product.name))}</strong>
        <small>${escapeHtml(getCategoryLabel(product.category))}</small>
      </span>
      <span class="olaf-steam-activity-price">
        ${discount > 0 ? `<b>-${discount}%</b><del>${formatPrice(product.compareAt)}</del>` : ""}
        <strong>${formatPrice(product.price)}</strong>
      </span>
    </a>
  `;
}

function steamActivityCarouselMarkup(products) {
  const slides = steamActivitySlides(products);
  if (!slides.length) return "";
  steamActivitySlideIndex = ((steamActivitySlideIndex % slides.length) + slides.length) % slides.length;
  return `
    <article class="olaf-steam-activity-row" aria-label="ส่วนลดและกิจกรรม">
      <header class="olaf-steam-activity-head">
        <div>
          <span>OLAF EVENT PICKS</span>
          <h3>ส่วนลดและกิจกรรม</h3>
          <p>สินค้าในร้านที่พร้อมส่ง คัดใหม่และสุ่มให้ทุกครั้งที่เข้าชม</p>
        </div>
        <a href="#catalog">ดูเพิ่มเติม <i data-lucide="arrow-up-right"></i></a>
      </header>
      <div class="olaf-steam-activity-carousel" data-steam-activity-carousel>
        <button class="olaf-steam-activity-arrow is-prev" type="button" data-steam-activity-step="-1" aria-label="ดูชุดสินค้าก่อนหน้า"><i data-lucide="chevron-left"></i></button>
        <div class="olaf-steam-activity-viewport">
          <div class="olaf-steam-activity-track" data-steam-activity-track style="--activity-index:${steamActivitySlideIndex}">
            ${slides.map((slide, slideIndex) => `
              <div class="olaf-steam-activity-slide${slideIndex === steamActivitySlideIndex ? " is-active" : ""}" data-steam-activity-slide aria-hidden="${slideIndex === steamActivitySlideIndex ? "false" : "true"}">
                ${slide.map(steamActivityCardMarkup).join("")}
              </div>
            `).join("")}
          </div>
        </div>
        <button class="olaf-steam-activity-arrow is-next" type="button" data-steam-activity-step="1" aria-label="ดูชุดสินค้าถัดไป"><i data-lucide="chevron-right"></i></button>
      </div>
      <div class="olaf-steam-activity-dots" aria-label="เลือกชุดสินค้า">
        ${slides.map((_, index) => `<button type="button" class="${index === steamActivitySlideIndex ? "is-active" : ""}" data-steam-activity-dot="${index}" aria-label="ชุดสินค้า ${index + 1}" aria-current="${index === steamActivitySlideIndex ? "true" : "false"}"></button>`).join("")}
      </div>
    </article>
  `;
}

function syncSteamActivityCarousel() {
  const track = document.querySelector("[data-steam-activity-track]");
  if (!track) return;
  const slides = [...track.querySelectorAll("[data-steam-activity-slide]")];
  if (!slides.length) return;
  steamActivitySlideIndex = ((steamActivitySlideIndex % slides.length) + slides.length) % slides.length;
  track.style.setProperty("--activity-index", steamActivitySlideIndex);
  slides.forEach((slide, index) => {
    const active = index === steamActivitySlideIndex;
    slide.classList.toggle("is-active", active);
    slide.setAttribute("aria-hidden", String(!active));
  });
  document.querySelectorAll("[data-steam-activity-dot]").forEach((dot, index) => {
    const active = index === steamActivitySlideIndex;
    dot.classList.toggle("is-active", active);
    dot.setAttribute("aria-current", String(active));
  });
}

function steamEditorialImages(product, products) {
  const ownImages = [
    product.heroImage,
    ...(product.gallery || []),
    product.image
  ];
  const relatedImages = products
    .filter((item) => item.id !== product.id && item.category === product.category)
    .flatMap((item) => [item.heroImage, item.image]);
  return [...new Set([...ownImages, ...relatedImages].filter(Boolean))].slice(0, 5);
}

function steamEditorialFeatureMarkup(product, products) {
  const images = steamEditorialImages(product, products);
  const mainImage = images[0] || product.heroImage || product.image || "";
  const gallery = images.slice(1, 5);
  const stock = getStockState(product.stock);
  return `
    <article class="olaf-steam-taste-row">
      <header class="olaf-steam-taste-head">
        <div>
          <h3>${escapeHtml(cleanDisplayText(product.name))}</h3>
          <p>แนะนำจากความนิยมในหมวด ${escapeHtml(getCategoryLabel(product.category))}</p>
        </div>
        <div class="olaf-steam-taste-actions">
          <a href="${productLink(product)}">ดูรายละเอียดสินค้า</a>
          <button type="button" data-steam-category="${escapeHtml(product.category)}">ค้นหาเกมประเภทนี้</button>
        </div>
      </header>
      <div class="olaf-steam-taste-gallery">
        <a class="olaf-steam-taste-main" href="${productLink(product)}">
          <img ${fastImg(mainImage, cleanDisplayText(product.name), {
            width: 1120,
            height: 630,
            sizes: "(max-width: 640px) 88vw, 54vw"
          })} />
        </a>
        <div class="olaf-steam-taste-shots">
          ${gallery.map((image, index) => `
            <a href="${productLink(product)}" aria-label="ดู ${escapeHtml(cleanDisplayText(product.name))} ภาพที่ ${index + 2}">
              <img ${fastImg(image, `${cleanDisplayText(product.name)} ${index + 2}`, {
                width: 520,
                height: 292,
                sizes: "(max-width: 640px) 62vw, 24vw"
              })} />
            </a>
          `).join("")}
        </div>
      </div>
      <footer class="olaf-steam-taste-foot">
        <span class="${stock.className}">${escapeHtml(stock.label)}</span>
        ${steamPriceMarkup(product, "is-compact")}
      </footer>
    </article>
  `;
}

function steamEditorialFeaturesMarkupLegacy(products) {
  const featured = products
    .filter((product) => product.stock > 0)
    .sort((a, b) => Number(b.sold || 0) - Number(a.sold || 0))
    .slice(2, 4);
  if (!featured.length) return "";
  return `
    <section class="olaf-steam-taste-stack" aria-label="รายการที่คุณอาจสนใจ">
      ${featured.map((product) => steamEditorialFeatureMarkup(product, products)).join("")}
    </section>
  `;
}

function steamEditorialFeaturesMarkup(products) {
  const featurePool = products
    .filter((product) => Number(product.stock || 0) > 0)
    .filter((product) => !/\bhelldivers?\s*2\b/.test(steamEditorialSearchText(product)))
    .sort((a, b) => Number(b.sold || 0) - Number(a.sold || 0))
    .slice(0, 30);
  const randomFeature = steamEditorialShuffle(featurePool, "last-feature")[0];
  const activity = steamActivityCarouselMarkup(products);
  if (!activity && !randomFeature) return "";
  return `
    <section class="olaf-steam-taste-stack" aria-label="รายการที่คุณอาจสนใจ">
      ${activity}
      ${randomFeature ? steamEditorialFeatureMarkup(randomFeature, products) : ""}
    </section>
  `;
}

function renderSteamStorefront() {
  const section = document.querySelector("#olaf-steam-storefront");
  if (!section) return;
  const products = steamStorefrontProducts();
  if (!products.length) {
    section.innerHTML = `<div class="olaf-steam-store-loading"><span class="olaf-steam-loading-orbit" aria-hidden="true"></span><span>กำลังโหลดสินค้าจากร้าน...</span></div>`;
    return;
  }

  const deals = steamDealsProducts();
  section.innerHTML = `
    <header class="olaf-steam-section-head">
      <div><p>OLAF STORE HIGHLIGHTS</p><h2>สินค้าเด่นและแนะนำ</h2></div>
      <a href="#catalog">เลือกดูสินค้าทั้งหมด <i data-lucide="arrow-right"></i></a>
    </header>
    <div class="olaf-steam-spotlight-stage" data-steam-spotlight-stage></div>

    ${deals.length ? `
      <div class="olaf-steam-section-head is-deals">
        <div><p>SPECIAL OFFERS</p><h2>ดีลและสินค้าน่าสนใจ</h2></div>
        <div class="olaf-steam-track-controls">
          <button type="button" data-steam-deals-scroll="-1" aria-label="เลื่อนดีลไปทางซ้าย"><i data-lucide="chevron-left"></i></button>
          <button type="button" data-steam-deals-scroll="1" aria-label="เลื่อนดีลไปทางขวา"><i data-lucide="chevron-right"></i></button>
        </div>
      </div>
      <div class="olaf-steam-deals-track" data-steam-deals-track>
        ${deals.map(steamDealCardMarkup).join("")}
      </div>
    ` : ""}

    ${steamEditorialCollectionsMarkup(products)}
    ${steamEditorialFeaturesMarkup(products)}
  `;

  renderSteamSpotlightStage();
  syncSteamActivityCarousel();
  scheduleSteamStorefrontRotation();
  createIconSet();
  hydrateImages();
}

function renderCategories() {
  $(selectors.categoryTabs).innerHTML = state.categories
    .map(
      (category) => `
        <button
          class="tab-button ${state.selectedCategory === category.id ? "is-active" : ""}"
          type="button"
          role="tab"
          aria-selected="${state.selectedCategory === category.id}"
          data-category="${escapeHtml(category.id)}"
        >
          ${escapeHtml(category.label)}
        </button>
      `
    )
    .join("");

  const categoryRows = state.categories
    .filter((category) => category.id !== "all")
    .map((category) => {
      const stockCount = state.products
        .filter((product) => product.category === category.id)
        .reduce((sum, product) => sum + product.stock, 0);
      return `<li><span>${escapeHtml(category.label)}</span><strong>${stockCount.toLocaleString("th-TH")}</strong></li>`;
    })
    .join("");

  $(selectors.categoryList).innerHTML = categoryRows;
}

function renderShowcaseCategoryState() {
  document.querySelectorAll("[data-showcase-category]").forEach((button) => {
    const isActive = button.dataset.showcaseCategory === state.selectedCategory;
    button.classList.toggle("is-active", isActive);
    button.setAttribute("aria-selected", isActive ? "true" : "false");
  });
}

function selectCatalogCategory(categoryId, options = {}) {
  if (!state.categories.some((category) => category.id === categoryId)) return;
  state.selectedCategory = categoryId;
  state.currentPage = 1;
  renderCategories();
  renderShowcaseCategoryState();
  renderProducts();

  if (options.scrollToCatalog || options.scrollToProducts) {
    const target = options.scrollToProducts ? document.querySelector(".products-wrap") : $("#catalog");
    if (target) {
      window.scrollTo({
        top: Math.max(target.offsetTop - 84, 0),
        behavior: "smooth"
      });
    }
  }
}

function renderProducts() {
  const products = filteredProducts();
  const itemsPerPage = getCatalogItemsPerPage();
  const featured = [...products]
    .filter((product) => product.stock > 0)
    .sort((a, b) => b.sold - a.sold)
    .slice(0, 3);

  const totalPages = Math.ceil(products.length / itemsPerPage) || 1;
  const startIndex = (state.currentPage - 1) * itemsPerPage;
  const paginatedProducts = products.slice(startIndex, startIndex + itemsPerPage);

  $(selectors.featuredGrid).innerHTML = state.currentPage === 1
    ? featured.map((product, index) => renderFeatureCard(product, index)).join("")
    : "";
  $(selectors.productGrid).innerHTML = paginatedProducts
    .map((product, index) => renderProductCard(product, index))
    .join("");
  const emptyState = $(selectors.emptyState);
  if (emptyState) emptyState.hidden = true;

  renderPagination(totalPages);
  createIconSet();
  hydrateImages();
}

function renderPagination(totalPages) {
  const container = $(selectors.paginationControls);
  if (!container) return;

  if (totalPages <= 1) {
    container.innerHTML = "";
    return;
  }

  let html = `<div class="pagination">`;

  if (state.currentPage > 1) {
    html += `<button class="pagination-btn" type="button" data-page="${state.currentPage - 1}"><i data-lucide="chevron-left"></i> ย้อนกลับ</button>`;
  }

  html += `<span class="pagination-info">หน้า ${state.currentPage} จาก ${totalPages}</span>`;

  if (state.currentPage < totalPages) {
    html += `<button class="pagination-btn" type="button" data-page="${state.currentPage + 1}">ถัดไป <i data-lucide="chevron-right"></i></button>`;
  }

  html += `</div>`;
  container.innerHTML = html;
}


function showAuthPanel(panelName) {
  document.querySelectorAll("[data-auth-tab]").forEach((button) => {
    button.classList.toggle("is-active", button.dataset.authTab === panelName);
  });
  document.querySelectorAll("[data-auth-panel]").forEach((panel) => {
    panel.classList.toggle("is-visible", panel.dataset.authPanel === panelName);
  });
  $(selectors.authMessage).textContent = "";
}

function openAuth(panelName = "login") {
  showAuthPanel(panelName);
  $(selectors.authDialog).showModal();
  createIconSet();
}

function renderMemberDashboard() {
  refreshAccountState();
  const user = state.currentUser;
  if (!user) {
    openAuth("login");
    return;
  }

  const userOrders = state.orders.filter((order) => order.userId === user.id).slice(0, 8);
  const userReviews = state.reviews.filter((review) => review.userId === user.id).slice(0, 8);
  const orderRows = userOrders.length
    ? userOrders
      .map(
        (order) => `
            <div class="dashboard-row">
              <div>
                <strong>${escapeHtml(order.id)}</strong>
                <span>${new Date(order.createdAt).toLocaleString("th-TH")} · ${order.items.length} รายการ</span>
              </div>
              <b>${formatPrice(order.total)}</b>
            </div>
          `
      )
      .join("")
    : `<div class="dashboard-row"><span>ยังไม่มีคำสั่งซื้อ</span></div>`;
  const reviewRows = userReviews.length
    ? userReviews
      .map(
        (review) => `
            <div class="dashboard-row">
              <div>
                <strong>${"★".repeat(review.rating)} ${escapeHtml(review.productName)}</strong>
                <span>${escapeHtml(review.title || review.body)}</span>
              </div>
              <span class="stock-pill ${review.status === "published" ? "in-stock" : "low-stock"}">${escapeHtml(review.status)}</span>
            </div>
          `
      )
      .join("")
    : `<div class="dashboard-row"><span>ยังไม่มีรีวิว</span></div>`;

  $("#member-dashboard").innerHTML = `
    <section class="dashboard-hero">
      <div class="member-avatar">${escapeHtml((user.displayName || user.username || "U").slice(0, 1).toUpperCase())}</div>
      <div>
        <p class="eyebrow">Member Dashboard</p>
        <h2>${escapeHtml(user.displayName || user.username)}</h2>
        <p>${escapeHtml(user.email)} · ${escapeHtml(user.role)} · ${escapeHtml(user.position)}</p>
      </div>
      <button class="secondary-button" type="button" data-logout>
        <i data-lucide="log-out"></i>
        ออกจากระบบ
      </button>
    </section>
    <div class="dashboard-grid">
      <form class="checkout-form" id="profile-form">
        <h3>โปรไฟล์</h3>
        <label>
          ชื่อผู้ใช้
          <input name="username" type="text" value="${escapeHtml(user.username)}" required />
        </label>
        <label>
          ชื่อแสดงผล
          <input name="displayName" type="text" value="${escapeHtml(user.displayName)}" required />
        </label>
        <label>
          รหัสผ่าน
          <a class="secondary-button" href="profile.html#password">เปลี่ยนรหัสผ่าน</a>
        </label>
        <button class="primary-button" type="submit">
          <i data-lucide="save"></i>
          บันทึกโปรไฟล์
        </button>
      </form>
      <section class="dashboard-panel">
        <h3>คำสั่งซื้อของฉัน</h3>
        ${orderRows}
      </section>
      <section class="dashboard-panel">
        <h3>รีวิวของฉัน</h3>
        ${reviewRows}
      </section>
    </div>
  `;
  $(selectors.dashboardDialog).showModal();
  createIconSet();
}

function showToast(message, type = "success", duration = 3500) {
  const container = document.querySelector("#toast-container");
  if (!container) return;
  const toast = document.createElement("div");
  const iconMap = {
    success: "check-circle",
    error: "alert-circle",
    info: "info",
    warning: "alert-triangle",
    payment: "credit-card",
    order: "package",
    shipping: "truck",
    cancel: "x-circle"
  };
  const icon = iconMap[type] || "check-circle";
  toast.className = `toast toast-${type}`;
  toast.innerHTML = `<i data-lucide="${icon}"></i><span>${escapeHtml(message)}</span>`;
  container.appendChild(toast);
  createIconSet();
  setTimeout(() => { toast.classList.add("is-leaving"); setTimeout(() => toast.remove(), 350); }, duration);
  return toast;
}

function showAdminRedirectNotice() {
  const key = "olafshop_admin_notice";
  let message = "";
  try {
    message = window.sessionStorage.getItem(key) || "";
    if (message) window.sessionStorage.removeItem(key);
  } catch (error) {
    console.warn("Unable to read admin redirect notice", error);
  }
  if (message) showToast(message, "warning", 5500);
}

function renderUserPopover() {
  const popover = document.querySelector("#user-popover");
  if (!popover) return;
  refreshAccountState();
  const user = state.currentUser;
  if (!user) return;

  popover.innerHTML = `
    <div class="user-profile-card">
      <div class="user-popover-header">
        <div class="user-popover-avatar">${escapeHtml((user.displayName || user.username || "U").slice(0, 1).toUpperCase())}</div>
        <div class="user-popover-info">
          <strong>${escapeHtml(user.displayName || user.username)}</strong>
          <span>${escapeHtml(user.email)}</span>
        </div>
      </div>
      <div class="user-popover-badge-row">
        <span class="user-badge-role">${escapeHtml(user.role || 'Member')}</span>
        <a class="user-badge-points" href="profile.html#info" data-topbar-point-balance>${formatPointAmount(0)} Points</a>
      </div>
    </div>
    <div class="user-popover-menu">
      <div class="user-popover-menu-title">หน้าหลัก</div>
      <a href="profile.html"><i data-lucide="user"></i>ข้อมูลส่วนตัว</a>
      <a href="point-topup.html"><i data-lucide="coins"></i>เติม Point</a>
      <a href="profile.html#inventory"><i data-lucide="package"></i>คลังสินค้า (ID/Pass)</a>
      <a href="profile.html#orders"><i data-lucide="list"></i>ประวัติคำสั่งซื้อ</a>
      <a href="profile.html#coupons"><i data-lucide="ticket-percent"></i>คูปองของฉัน</a>
      
      <div class="user-popover-divider"></div>
      
      <button type="button" class="danger-item" id="logout-button" data-user-logout><i data-lucide="log-out"></i>ออกจากระบบ</button>
    </div>
  `;
  popover.hidden = false;
  createIconSet();
  refreshTopbarPointBalance().catch(() => null);
}

async function refreshTopbarPointBalance() {
  if (!window.OlafOrders?.fetchPointBalance) return;
  try {
    const wallet = await window.OlafOrders.fetchPointBalance();
    const label = `${formatPointAmount(wallet?.balance || 0)} Points`;
    document.querySelectorAll("[data-topbar-point-balance]").forEach((item) => {
      item.textContent = label;
    });
  } catch (error) {
    console.warn("Unable to load topbar point balance", error);
  }
}

function showUserPopoverSection(section) {
  const panel = document.querySelector("#user-popover-panel");
  if (!panel) return;
  const user = state.currentUser;

  if (section === "info") {
    panel.innerHTML = `
      <div class="password-change-section">
        <label>ชื่อผู้ใช้<input type="text" value="${escapeHtml(user.username)}" readonly /></label>
        <label>ชื่อแสดงผล<input type="text" value="${escapeHtml(user.displayName)}" readonly /></label>
        <label>อีเมล<input type="text" value="${escapeHtml(user.email)}" readonly /></label>
        <label>สถานะ<input type="text" value="${escapeHtml(user.role)} · ${escapeHtml(user.position)}" readonly /></label>
      </div>
    `;
  } else if (section === "inventory") {
    panel.innerHTML = `
      <div class="password-change-section">
        <a class="primary-button" href="profile.html#inventory">
          <i data-lucide="package"></i>
          เปิดคลังสินค้า (ID/Pass)
        </a>
      </div>
    `;
    createIconSet();
  } else if (section === "password") {
    panel.innerHTML = `
      <div class="password-change-section">
        <a class="primary-button" href="profile.html#password">
          <i data-lucide="key-round"></i>
          เปลี่ยนรหัสผ่าน
        </a>
      </div>
    `;
    createIconSet();
  } else {
    panel.innerHTML = "";
  }
}

function closeUserPopover() {
  const popover = document.querySelector("#user-popover");
  if (popover) popover.hidden = true;
}

function renderFeatureCard(product, index = 0) {
  const stock = getStockState(product.stock);
  return `
    <article class="feature-card">
      <img ${fastImg(product.image || product.heroImage, product.name, catalogImageOptions(index, true))} />
      <div class="feature-body">
        <span class="stock-pill ${stock.className}">${stock.label}</span>
        <h3>${escapeHtml(product.name)}</h3>
        <a class="mini-button" href="product.html?id=${encodeURIComponent(product.id)}">
          <i data-lucide="eye"></i>
          ${t("details")}
        </a>
      </div>
    </article>
  `;
}

function renderProductCard(product, index = 0) {
  const stock = getStockState(product.stock);
  const discount = getDiscount(product);
  const publisher = String(product.publisher || "").trim();
  const tags = getDisplayTags(product, 4)
    .map((tag) => `<span class="tag">${escapeHtml(tag)}</span>`)
    .join("");

  return `
    <article class="product-card ${product.stock <= 0 ? "is-out-of-stock" : ""}">
      <div class="product-image">
        <img ${fastImg(product.image || product.heroImage, product.name, catalogImageOptions(index))} />
        ${discount ? `<span class="discount-pill">-${discount}%</span>` : ""}
      </div>
      <div class="product-body">
        <div class="product-meta">
          <span class="badge-pill-group">${renderBadgePills(product)}</span>
          <span class="stock-pill ${stock.className}">${stock.label}</span>
        </div>
        <div>
          <h3>${escapeHtml(product.name)}</h3>
          <p class="publisher" title="${escapeHtml(publisher)}" aria-label="Publisher: ${escapeHtml(publisher)}" tabindex="0">${escapeHtml(publisher)}</p>
        </div>
        <div class="tags">${tags}</div>
        <div class="price-row">
          <strong class="price">${formatPrice(product.price)}</strong>
          ${product.compareAt ? `<span class="compare-price">${formatPrice(product.compareAt)}</span>` : ""}
        </div>
        <div class="card-actions single-action">
          <a class="primary-button" href="product.html?id=${encodeURIComponent(product.id)}">
            <i data-lucide="eye"></i>
            ${t("details")}
          </a>
        </div>
      </div>
    </article>
  `;
}

function openProduct(productId) {
  const product = productById(productId);
  if (!product) return;
  state.detailQuantity = product.stock > 0 ? 1 : 0;
  renderProductDetail(product);
  $(selectors.productDialog).showModal();
  createIconSet();
}

function renderProductDetail(product) {
  const stock = getStockState(product.stock);
  const discount = getDiscount(product);
  const tags = getDisplayTags(product, 5).map((tag) => `<span class="tag">${escapeHtml(tag)}</span>`).join("");
  const canAdd = product.stock > 0;

  $(selectors.productDetail).innerHTML = `
    <div class="detail-media">
      <img ${fastImg(product.heroImage || product.image, product.name, { priority: true })} />
    </div>
    <div class="detail-body">
      <div>
        <div class="badge-pill-group">${renderBadgePills(product)}</div>
        <h2>${escapeHtml(product.name)}</h2>
        <p>${escapeHtml(product.publisher)}</p>
      </div>
      <div class="tags">${tags}</div>
      <p>${escapeHtml(product.description)}</p>
      <div class="price-row">
        <strong class="price">${formatPrice(product.price)}</strong>
        ${product.compareAt ? `<span class="compare-price">${formatPrice(product.compareAt)}</span>` : ""}
        ${discount ? `<span class="discount-pill">-${discount}%</span>` : ""}
      </div>
      <ul class="detail-list">
        <li><span>สถานะสต็อก</span><strong>${stock.label}</strong></li>
        <li><span>คะแนนรีวิว</span><strong>${escapeHtml(product.rating)}</strong></li>
        <li><span>การจัดส่ง</span><strong>${escapeHtml(product.delivery)}</strong></li>
        <li><span>รับประกัน</span><strong>${escapeHtml(product.warranty)}</strong></li>
      </ul>
      <div class="quantity-row" aria-label="จำนวนสินค้า">
        <button class="quantity-button" type="button" data-qty="decrease" ${!canAdd ? "disabled" : ""}>
          <i data-lucide="minus"></i>
        </button>
        <span class="quantity-value" id="detail-quantity">${state.detailQuantity}</span>
        <button class="quantity-button" type="button" data-qty="increase" ${!canAdd ? "disabled" : ""}>
          <i data-lucide="plus"></i>
        </button>
      </div>
    </div>
  `;
}

function addToCart(productId, quantity = 1) {
  const product = productById(productId);
  if (!product || product.stock <= 0) return;

  const current = state.cart.get(productId) ?? 0;
  const next = Math.min(product.stock, current + quantity);
  state.cart.set(productId, next);
  renderCart();
  showToast(`เพิ่ม "${product.name}" ลงตะกร้าแล้ว`, "success");
}

function updateCartItem(productId, quantity) {
  const product = productById(productId);
  if (!product) return;
  const next = Math.max(0, Math.min(product.stock, quantity));
  if (next === 0) {
    state.cart.delete(productId);
  } else {
    state.cart.set(productId, next);
  }
  renderCart();
}

function cartEntries() {
  return [...state.cart.entries()]
    .map(([id, quantity]) => ({ product: productById(id), quantity }))
    .filter((entry) => entry.product);
}

function cartSubtotal() {
  return cartEntries().reduce((sum, entry) => sum + entry.product.price * entry.quantity, 0);
}

function renderCart() {
  return;
  const entries = cartEntries();
  const count = entries.reduce((sum, entry) => sum + entry.quantity, 0);
  const subtotal = cartSubtotal();
  const fee = subtotal > 0 ? appConfig.serviceFee : 0;
  const total = subtotal + fee;

  $(selectors.cartCount).textContent = count;
  $(selectors.summarySubtotal).textContent = formatPrice(subtotal);
  $(selectors.summaryFee).textContent = formatPrice(fee);
  $(selectors.summaryTotal).textContent = formatPrice(total);

  if (!entries.length) {
    const template = $("#cart-empty-template").content.cloneNode(true);
    $(selectors.cartItems).replaceChildren(template);
    createIconSet();
    return;
  }

  $(selectors.cartItems).innerHTML = entries
    .map(({ product, quantity }) => {
      const lineTotal = product.price * quantity;
      return `
        <article class="cart-item">
          <img ${fastImg(product.image || product.heroImage, product.name)} />
          <div>
            <h3>${escapeHtml(product.name)}</h3>
            <p>${escapeHtml(getCategoryLabel(product.category))} · ${formatPrice(product.price)} x ${quantity}</p>
            <p>เหลือในสต็อก ${product.stock.toLocaleString("th-TH")} ชิ้น</p>
          </div>
          <div class="cart-item-actions">
            <strong>${formatPrice(lineTotal)}</strong>
            <div class="quantity-row">
              <button class="quantity-button" type="button" data-cart-decrease="${escapeHtml(product.id)}">
                <i data-lucide="minus"></i>
              </button>
              <span class="quantity-value">${quantity}</span>
              <button class="quantity-button" type="button" data-cart-increase="${escapeHtml(product.id)}">
                <i data-lucide="plus"></i>
              </button>
              <button class="quantity-button" type="button" data-cart-remove="${escapeHtml(product.id)}" aria-label="ลบสินค้า">
                <i data-lucide="trash-2"></i>
              </button>
            </div>
          </div>
        </article>
      `;
    })
    .join("");
  createIconSet();
}

function buildOrder(formData) {
  const entries = cartEntries();
  const subtotal = cartSubtotal();
  const fee = subtotal > 0 ? appConfig.serviceFee : 0;
  const total = subtotal + fee;
  return {
    id: `OLAF-${new Date().toISOString().slice(0, 10).replaceAll("-", "")}-${Math.random()
      .toString(36)
      .slice(2, 7)
      .toUpperCase()}`,
    customerName: formData.get("customerName"),
    contact: formData.get("contact"),
    userId: state.currentUser?.id || null,
    username: state.currentUser?.displayName || state.currentUser?.username || formData.get("customerName"),
    paymentMethod: formData.get("paymentMethod"),
    subtotal,
    fee,
    total,
    currency: "THB",
    items: entries.map(({ product, quantity }) => ({
      id: product.id,
      name: product.name,
      category: product.category,
      quantity,
      unitPrice: product.price,
      lineTotal: product.price * quantity
    })),
    createdAt: new Date().toISOString()
  };
}

async function createPaymentIntent(order) {
  if (!appConfig.paymentEndpoint) {
    const manualQrUrl = state.store.payment?.manualQrUrl || appConfig.manualQrUrl;
    await new Promise((resolve) => window.setTimeout(resolve, 320));
    return {
      provider: manualQrUrl ? "manual-qr" : "mock",
      reference: order.id,
      amount: order.total,
      status: "pending",
      qrUrl: manualQrUrl || createPromptPayUrl(order.total)
    };
  }

  const response = await fetch(appConfig.paymentEndpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify(order)
  });

  if (!response.ok) {
    throw new Error(`Payment API ${response.status}`);
  }

  return response.json();
}

function createPromptPayUrl(amount) {
  const value = Math.max(1, Number(amount || 0)).toFixed(2);
  return `https://promptpay.io/${encodeURIComponent(appConfig.promptPayId)}/${value}.png`;
}

function renderPaymentInstructionRows() {
  const payment = state.store.payment ?? {};
  const rows = [
    payment.bankName && payment.bankAccountNumber
      ? ["บัญชีรับเงิน", `${payment.bankName} ${payment.bankAccountNumber}`]
      : null,
    payment.bankAccountName ? ["ชื่อบัญชี", payment.bankAccountName] : null,
    payment.walletName ? ["Wallet", payment.walletName] : null,
    payment.paymentNote ? ["หมายเหตุ", payment.paymentNote] : null
  ].filter(Boolean);

  return rows
    .map(([label, value]) => `<div><span>${escapeHtml(label)}</span><strong>${escapeHtml(value)}</strong></div>`)
    .join("");
}



function openPaymentResult(order, payment) {
  const methodLabel = {
    promptpay: "PromptPay QR",
    bank: "โอนธนาคาร",
    "wallet-api": "Wallet API"
  }[order.paymentMethod];

  const paymentInfo = state.store.payment ?? {};
  // Build prominent account info block
  const hasAccountInfo = paymentInfo.bankAccountName || paymentInfo.bankName || paymentInfo.bankAccountNumber;
  const accountInfoHtml = hasAccountInfo ? `
    <div class="payment-account-block">
      <div class="payment-account-header">
        <i data-lucide="building-2"></i>
        <span>โอนเงินมาที่บัญชีนี้</span>
      </div>
      ${paymentInfo.bankName ? `<div class="payment-account-row"><span>ธนาคาร</span><strong>${escapeHtml(paymentInfo.bankName)}</strong></div>` : ''}
      ${paymentInfo.bankAccountNumber ? `<div class="payment-account-row"><span>เลขบัญชี</span><strong class="account-number">${escapeHtml(paymentInfo.bankAccountNumber)}</strong></div>` : ''}
      ${paymentInfo.bankAccountName ? `<div class="payment-account-row"><span>ชื่อบัญชี</span><strong>${escapeHtml(paymentInfo.bankAccountName)}</strong></div>` : ''}
      ${paymentInfo.walletName ? `<div class="payment-account-row"><span>Wallet</span><strong>${escapeHtml(paymentInfo.walletName)}</strong></div>` : ''}
      ${paymentInfo.paymentNote ? `<div class="payment-account-note"><i data-lucide="info"></i>${escapeHtml(paymentInfo.paymentNote)}</div>` : ''}
    </div>
  ` : '';

  $(selectors.paymentResult).innerHTML = `
    <div class="payment-head">
      <div class="payment-success-icon"><i data-lucide="check-circle-2"></i></div>
      <p class="eyebrow">Payment Created</p>
      <h2>รายการชำระเงินพร้อมแล้ว</h2>
      <p>เลขอ้างอิง ${escapeHtml(payment.reference || order.id)} · ${escapeHtml(methodLabel)}</p>
    </div>
    <div class="payment-box">
      <div class="qr-box">
        <img ${fastImg(payment.qrUrl || createPromptPayUrl(order.total), "PromptPay QR", { priority: true })} />
        <div class="qr-amount-badge">${formatPrice(order.total)}</div>
      </div>
      ${accountInfoHtml}
      <div class="payment-lines">
        <div><span>ยอดชำระ</span><strong class="payment-total-highlight">${formatPrice(order.total)}</strong></div>
        <div><span>จำนวนสินค้า</span><strong>${order.items.reduce((sum, item) => sum + item.quantity, 0)} ชิ้น</strong></div>
        <div><span>สถานะ</span><strong><span class="status-waiting">⏳ รอแอดมินยืนยัน</span></strong></div>
      </div>
    </div>
    <div class="copy-row">
      <code id="order-reference">${escapeHtml(order.id)}</code>
      <button class="mini-button" type="button" data-copy-order>
        <i data-lucide="copy"></i>
        คัดลอก
      </button>
    </div>
    <div class="payment-steps">
      <div class="payment-step"><span class="step-num">1</span><span>สแกน QR หรือโอนตามข้อมูลบัญชี</span></div>
      <div class="payment-step"><span class="step-num">2</span><span>แนบสลิปในหน้าออเดอร์</span></div>
      <div class="payment-step"><span class="step-num">3</span><span>รอแอดมินยืนยันและจัดส่ง</span></div>
    </div>
    ${renderReviewPrompt(order)}
  `;

  $(selectors.cartDialog)?.close?.();
  $(selectors.paymentDialog).showModal();
  createIconSet();
  // Show action toast
  showToast("สร้างรายการชำระเงินสำเร็จ! กรุณารอแอดมินตรวจสอบ", "payment", 5000);
}

function bindEvents() {
  $(selectors.searchInput).addEventListener("input", (event) => {
    state.query = event.target.value;
    state.currentPage = 1;
    renderProducts();
  });

  $(selectors.stockOnly).addEventListener("change", (event) => {
    state.stockOnly = event.target.checked;
    state.currentPage = 1;
    renderProducts();
  });

  document.querySelectorAll('input[name="sort"]').forEach(radio => {
    radio.addEventListener("change", (event) => {
      state.sortBy = event.target.value;
      state.currentPage = 1;
      renderProducts();
    });
  });

  document.querySelectorAll('input[name="price"]').forEach(radio => {
    radio.addEventListener("change", (event) => {
      state.priceFilter = event.target.value;
      state.currentPage = 1;
      renderProducts();
    });
  });

  const openFilterBtn = $("#open-filter-btn");
  const filterPopover = $("#filter-popover");

  if (openFilterBtn && filterPopover) {
    openFilterBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      const isHidden = filterPopover.hidden;
      filterPopover.hidden = !isHidden;
      openFilterBtn.setAttribute("aria-expanded", !isHidden);
    });

    document.addEventListener("click", (e) => {
      if (!filterPopover.hidden && !filterPopover.contains(e.target) && e.target !== openFilterBtn) {
        filterPopover.hidden = true;
        openFilterBtn.setAttribute("aria-expanded", "false");
      }
    });
  }

  $(selectors.categoryTabs).addEventListener("click", (event) => {
    const button = event.target.closest("[data-category]");
    if (!button) return;
    selectCatalogCategory(button.dataset.category, { scrollToProducts: button.dataset.category === "all" });
  });

  document.body.addEventListener("click", async (event) => {
    const detailButton = event.target.closest("[data-detail]");
    const addButton = event.target.closest("[data-add]");
    const detailAddButton = event.target.closest("[data-detail-add]");
    const quantityButton = event.target.closest("[data-qty]");
    const copyOrder = event.target.closest("[data-copy-order]");
    const authFromReview = event.target.closest("[data-open-auth-from-review]");
    const logoutButton = event.target.closest("[data-logout]");
    const pageButton = event.target.closest("[data-page]");
    const showcaseCategoryButton = event.target.closest("[data-showcase-category]");
    const promoVideoButton = event.target.closest("[data-promo-video]");
    const steamCategoryButton = event.target.closest("[data-steam-category]");
    const steamSpotlightStep = event.target.closest("[data-steam-spotlight-step]");
    const steamSpotlightDot = event.target.closest("[data-steam-spotlight-dot]");
    const steamDiscoveryButton = event.target.closest("[data-steam-discovery-mode]");
    const steamDealsScroll = event.target.closest("[data-steam-deals-scroll]");
    const steamActivityStep = event.target.closest("[data-steam-activity-step]");
    const steamActivityDot = event.target.closest("[data-steam-activity-dot]");

    if (steamCategoryButton) {
      selectCatalogCategory(steamCategoryButton.dataset.steamCategory, { scrollToCatalog: true });
      return;
    }

    if (steamSpotlightStep) {
      steamSpotlightIndex += Number(steamSpotlightStep.dataset.steamSpotlightStep || 0);
      renderSteamSpotlightStage();
      scheduleSteamStorefrontRotation();
      return;
    }

    if (steamSpotlightDot) {
      steamSpotlightIndex = Number(steamSpotlightDot.dataset.steamSpotlightDot || 0);
      renderSteamSpotlightStage();
      scheduleSteamStorefrontRotation();
      return;
    }

    if (steamDiscoveryButton) {
      steamDiscoveryMode = steamDiscoveryButton.dataset.steamDiscoveryMode || "top";
      steamDiscoveryPreviewId = "";
      document.querySelectorAll("[data-steam-discovery-mode]").forEach((button) => {
        const active = button.dataset.steamDiscoveryMode === steamDiscoveryMode;
        button.classList.toggle("is-active", active);
        button.setAttribute("aria-selected", String(active));
      });
      renderSteamDiscoveryContent();
      return;
    }

    if (steamDealsScroll) {
      const track = document.querySelector("[data-steam-deals-track]");
      const direction = Number(steamDealsScroll.dataset.steamDealsScroll || 0);
      track?.scrollBy({ left: direction * Math.max(track.clientWidth * 0.8, 260), behavior: "smooth" });
      return;
    }

    if (steamActivityStep) {
      steamActivitySlideIndex += Number(steamActivityStep.dataset.steamActivityStep || 0);
      syncSteamActivityCarousel();
      return;
    }

    if (steamActivityDot) {
      steamActivitySlideIndex = Number(steamActivityDot.dataset.steamActivityDot || 0);
      syncSteamActivityCarousel();
      return;
    }

    if (promoVideoButton) {
      setPromoVideo(Number(promoVideoButton.dataset.promoVideo || 0));
      return;
    }

    if (showcaseCategoryButton) {
      selectCatalogCategory(showcaseCategoryButton.dataset.showcaseCategory, { scrollToCatalog: true });
      return;
    }

    if (pageButton) {
      state.currentPage = parseInt(pageButton.dataset.page, 10);
      renderProducts();
      const wrap = document.querySelector(".products-wrap");
      if (wrap) window.scrollTo({ top: wrap.offsetTop - 100, behavior: "smooth" });
      return;
    }

    if (detailButton) {
      openProduct(detailButton.dataset.detail);
      return;
    }

    if (addButton) {
      showToast("ระบบตะกร้าถูกปิดใช้งาน กรุณาสั่งซื้อจากหน้ารายละเอียดสินค้า", "info");
      return;
    }

    if (detailAddButton) {
      showToast("ระบบตะกร้าถูกปิดใช้งาน กรุณาสั่งซื้อจากหน้ารายละเอียดสินค้า", "info");
      return;
    }

    if (quantityButton) {
      const activeProductName = $("#product-detail h2")?.textContent;
      const product = state.products.find((item) => item.name === activeProductName);
      if (!product) return;
      const direction = quantityButton.dataset.qty;
      const next =
        direction === "increase"
          ? Math.min(product.stock, state.detailQuantity + 1)
          : Math.max(1, state.detailQuantity - 1);
      state.detailQuantity = next;
      $("#detail-quantity").textContent = next;
      return;
    }

    if (copyOrder) {
      const reference = $("#order-reference")?.textContent ?? "";
      navigator.clipboard?.writeText(reference);
      copyOrder.textContent = "คัดลอกแล้ว";
    }

    if (authFromReview) {
      openAuth("login");
      return;
    }

    if (logoutButton) {
      await window.OlafStore?.logout();
      closeUserPopover();
      renderAll();
      showToast("ออกจากระบบแล้ว", "info");
    }

    // User popover sections
    const sectionBtn = event.target.closest("[data-user-section]");
    if (sectionBtn) {
      showUserPopoverSection(sectionBtn.dataset.userSection);
      return;
    }

    const userLogout = event.target.closest("[data-user-logout]");
    if (userLogout) {
      await window.OlafStore?.logout();
      closeUserPopover();
      renderAll();
      showToast("ออกจากระบบเรียบร้อยแล้ว", "info");
      return;
    }
  });

  document.body.addEventListener("pointerover", (event) => {
    const row = event.target.closest?.("[data-steam-discovery-product]");
    if (!row || row.dataset.steamDiscoveryProduct === steamDiscoveryPreviewId) return;
    const product = productById(row.dataset.steamDiscoveryProduct);
    const preview = document.querySelector("[data-steam-discovery-preview]");
    if (!product || !preview) return;
    steamDiscoveryPreviewId = product.id;
    document.querySelectorAll("[data-steam-discovery-product]").forEach((item) => {
      item.classList.toggle("is-active", item.dataset.steamDiscoveryProduct === product.id);
    });
    preview.innerHTML = steamDiscoveryPreviewMarkup(product);
    hydrateImages();
  });

  document.body.addEventListener("submit", async (event) => {
    if (event.target.matches("[data-steam-store-search]")) {
      event.preventDefault();
      const formData = new FormData(event.target);
      state.query = String(formData.get("search") || "").trim();
      state.currentPage = 1;
      const mainSearch = $(selectors.searchInput);
      if (mainSearch) mainSearch.value = state.query;
      renderProducts();
      document.querySelector("#catalog")?.scrollIntoView({ behavior: "smooth", block: "start" });
      return;
    }

    if (event.target.matches("#profile-form")) {
      event.preventDefault();
      const formData = new FormData(event.target);
      await window.OlafStore.updateUser(state.currentUser.id, {
        username: formData.get("username"),
        displayName: formData.get("displayName")
      });
      renderAll();
      showToast("บันทึกโปรไฟล์เรียบร้อยแล้ว", "success");
    }

    if (event.target.matches("#user-password-form")) {
      event.preventDefault();
      const formData = new FormData(event.target);
      const msg = document.querySelector("#pw-change-msg");
      try {
        if (!state.currentUser) throw new Error("กรุณาเข้าสู่ระบบก่อนเปลี่ยนรหัสผ่าน");
        await window.OlafStore.changePassword(
          state.currentUser.id,
          formData.get("oldPassword") || formData.get("currentPassword"),
          formData.get("newPassword") || formData.get("password")
        );
        event.target.reset();
        if (msg) { msg.style.color = "var(--success)"; msg.textContent = "เปลี่ยนรหัสผ่านเรียบร้อยแล้ว"; }
        showToast("เปลี่ยนรหัสผ่านเรียบร้อยแล้ว", "success");
      } catch (error) {
        if (msg) { msg.style.color = "var(--danger)"; msg.textContent = error.message; }
        showToast(error.message, "error");
      }
    }
  });

  document.querySelector(".auth-tabs")?.addEventListener("click", (event) => {
    const button = event.target.closest("[data-auth-tab]");
    if (!button) return;
    showAuthPanel(button.dataset.authTab);
  });

  document.querySelector("#login-form")?.addEventListener("submit", async (event) => {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    try {
      const user = await window.OlafStore.signIn(formData.get("email"), formData.get("password"));
      $(selectors.authDialog)?.close();
      renderAll();
      showToast(`เข้าสู่ระบบสำเร็จ ${user.displayName || user.username}!`, "success");
    } catch (error) {
      if ($(selectors.authMessage)) $(selectors.authMessage).textContent = error.message;
      showToast(error.message, "error");
    }
  });

  document.querySelector("#register-form")?.addEventListener("submit", async (event) => {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    try {
      const user = await window.OlafStore.signUp({
        email: formData.get("email"),
        username: formData.get("username"),
        displayName: formData.get("displayName"),
        password: formData.get("password")
      });
      event.currentTarget.reset();
      $(selectors.authDialog)?.close();
      renderAll();
      showToast(`ยินดีต้อนรับกลับสู่ OLAF SHOP, ${user.displayName || user.username}!`, "success", 4000);
    } catch (error) {
      if ($(selectors.authMessage)) $(selectors.authMessage).textContent = error.message;
      showToast(error.message, "error");
    }
  });


  document.querySelector("#lang-toggle")?.addEventListener("click", (event) => {
    event.stopPropagation();
    toggleLanguageMenu();
  });
  document.querySelector("#language-popover")?.addEventListener("click", (event) => {
    event.stopPropagation();
    const button = event.target.closest("[data-lang-option]");
    if (button) selectLanguage(button.dataset.langOption);
  });
  document.addEventListener("click", (event) => {
    if (!event.target.closest(".language-switcher")) closeLanguageMenu();
    if (!event.target.closest(".notification-wrap")) closeNotificationMenu();
  });
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
      closeLanguageMenu();
      closeNotificationMenu();
    }
  });
  document.querySelector("#open-notifications")?.addEventListener("click", (event) => {
    event.stopPropagation();
    toggleNotificationMenu();
  });
  $(selectors.openCart)?.addEventListener("click", () => {
    showToast("ระบบตะกร้าถูกปิดใช้งาน", "info");
  });
  $(selectors.openCheckout)?.addEventListener("click", () => {
    showToast("ระบบตะกร้าถูกปิดใช้งาน", "info");
  });
  $(selectors.openAuth).addEventListener("click", (event) => {
    if (window.OlafNavigation?.ownsUserMenu) return;
    event.stopPropagation();
    closeNotificationMenu();
    if (state.currentUser) {
      const popover = document.querySelector("#user-popover");
      if (popover && !popover.hidden) {
        closeUserPopover();
      } else {
        renderUserPopover();
      }
    } else {
      // ไปหน้า login แบบเต็มโดยตรง พร้อมส่ง return URL
      window.location.href = "login.html?return=" + encodeURIComponent(window.location.pathname + window.location.search);
    }
  });
  // The unified site-navigation owner handles this on every viewport.
  document.addEventListener("click", (event) => {
    if (window.OlafNavigation?.ownsUserMenu) return;
    if (!event.target.closest(".user-popover-wrap")) closeUserPopover();
  });
  $(selectors.openDashboard)?.addEventListener("click", renderMemberDashboard);

  // Replaced contact dialog listeners
  $(selectors.heroFeatured).addEventListener("click", () => {
    const dealLink = $(selectors.heroDeal).querySelector("a[href]");
    if (dealLink) {
      window.location.href = dealLink.href;
    }
  });

  $(selectors.closeProduct).addEventListener("click", () => $(selectors.productDialog).close());
  $(selectors.closeAuth)?.addEventListener("click", () => $(selectors.authDialog)?.close());
  $(selectors.closeDashboard).addEventListener("click", () => $(selectors.dashboardDialog).close());
  $(selectors.closeCart)?.addEventListener("click", () => $(selectors.cartDialog)?.close?.());
  $(selectors.closePayment).addEventListener("click", () => $(selectors.paymentDialog).close());

  $(selectors.checkoutForm)?.addEventListener("submit", async (event) => {
    event.preventDefault();
    if (!state.cart.size) {
      showToast("กรุณาเลือกสินค้าก่อน", "warning");
      return;
    }

    const submitButton = $("#submit-order");
    const originalText = submitButton.innerHTML;
    submitButton.disabled = true;
    submitButton.innerHTML = '<i data-lucide="loader-circle"></i> กำลังเปิดหน้าสินค้า...';
    createIconSet();

    try {
      const firstProductId = state.cart.keys().next().value;
      showToast("กรุณาสั่งซื้อจากหน้ารายละเอียดสินค้า เพื่อให้ระบบตัดสต็อกผ่าน Supabase อย่างปลอดภัย", "info", 5000);
      if (firstProductId) {
        window.setTimeout(() => {
          window.location.href = productLink({ id: firstProductId });
        }, 650);
      }
    } catch (error) {
      showToast("ไม่สามารถเปิดหน้าสินค้าได้ กรุณาลองอีกครั้ง", "error");
    } finally {
      submitButton.disabled = false;
      submitButton.innerHTML = originalText;
      createIconSet();
    }
  });
}

function applySearchFromUrl() {
  const urlParams = new URLSearchParams(window.location.search);
  const searchFromUrl = urlParams.get("search");
  if (!searchFromUrl) return;

  const searchInput = document.getElementById("search-input");
  if (searchInput) {
    searchInput.value = searchFromUrl;
    state.query = searchFromUrl;
    state.currentPage = 1;
    renderProducts();
    const catalog = document.querySelector("#catalog") || document.querySelector(".products-wrap");
    if (catalog) setTimeout(() => catalog.scrollIntoView({ behavior: "smooth", block: "start" }), 200);
  }
}

document.addEventListener("DOMContentLoaded", async () => {
  const authReady = window.OlafStore?.ready?.catch((error) => {
    console.warn("Auth initialization delayed", error);
    return null;
  });

  bindEvents();
  applyPayload(fallbackPayload);
  renderAll();
  showAdminRedirectNotice();
  applySearchFromUrl();
  loadRecentPurchases();

  await loadProducts();
  renderAll();
  applySearchFromUrl();

  await authReady;
  state.authReady = true;
  refreshAccountState();
  renderAccount();
  renderCart();
  createIconSet();
  hydrateImages();
});
