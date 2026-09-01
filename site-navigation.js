(function () {
  const ORDER_DESTINATION = "profile.html#inventory";
  const MOBILE_DRAWER_VERSION = "drawer-v68";
  const MOBILE_DRAWER_ID = "olaf-mobile-drawer";
  const MOBILE_BACKDROP_ID = "olaf-mobile-menu-backdrop";
  const USER_MENU_VERSION = "user-menu-v104";
  let activeAdminBrandLogo = "";
  const NAV_ITEMS = [
    { href: "index.html", label: "หน้าหลัก", icon: "house", match: ["index.html", ""] },
    { href: "index.html#catalog", label: "สินค้า", icon: "shopping-bag", matchHash: "#catalog" },
    { href: "more-products.html", label: "หมวดหมู่", icon: "layout-grid", match: ["more-products.html"] },
    { href: "point-topup.html", label: "เติม Point", icon: "coins", match: ["point-topup.html"] },
    { href: "free-random.html", label: "สุ่ม 1 Point", icon: "dices", match: ["free-random.html"] },
    { href: ORDER_DESTINATION, label: "คลังสินค้า", icon: "archive", match: ["profile.html"], matchHash: "#inventory" },
    { href: "https://www.facebook.com/byOlafshop", label: "ติดต่อเรา", icon: "messages-square", external: true }
  ];

  function createDisplayTextCleaner() {
    const windows1252Bytes = new Map([
      [0x20ac, 0x80], [0x201a, 0x82], [0x0192, 0x83], [0x201e, 0x84],
      [0x2026, 0x85], [0x2020, 0x86], [0x2021, 0x87], [0x02c6, 0x88],
      [0x2030, 0x89], [0x0160, 0x8a], [0x2039, 0x8b], [0x0152, 0x8c],
      [0x017d, 0x8e], [0x2018, 0x91], [0x2019, 0x92], [0x201c, 0x93],
      [0x201d, 0x94], [0x2022, 0x95], [0x2013, 0x96], [0x2014, 0x97],
      [0x02dc, 0x98], [0x2122, 0x99], [0x0161, 0x9a], [0x203a, 0x9b],
      [0x0153, 0x9c], [0x017e, 0x9e], [0x0178, 0x9f]
    ]);
    const mojibakePattern = /(?:\u00e0\u00b8|\u00e0\u00b9|\u00c3|\u00c2|\u00e2(?:\u20ac|\u201e|\u2122)|\u00e3\u20ac|\u00ef¿½)/g;
    const score = (text) => (String(text || "").match(mojibakePattern) || []).length;

    function legacyBytes(text) {
      const bytes = [];
      for (const char of Array.from(text)) {
        const code = char.codePointAt(0);
        if (code <= 0xff) bytes.push(code);
        else if (windows1252Bytes.has(code)) bytes.push(windows1252Bytes.get(code));
        else return null;
      }
      return Uint8Array.from(bytes);
    }

    return (value = "") => {
      let next = String(value || "");
      for (let attempt = 0; attempt < 3; attempt += 1) {
        const currentScore = score(next);
        if (!currentScore) break;
        try {
          const bytes = legacyBytes(next);
          if (!bytes) break;
          const decoded = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
          if (!decoded || decoded === next || score(decoded) >= currentScore) break;
          next = decoded;
        } catch (error) {
          break;
        }
      }
      return next
        .replace(/\u00c2®/g, "®")
        .replace(/\u00c2©/g, "©")
        .replace(/\u00c2/g, "")
        .replace(/\u00e2\u201e¢/g, "\u2122")
        .replace(/\u00e2\u20ac¢/g, "\u2022")
        .replace(/–/g, "–")
        .replace(/—/g, "—")
        .replace(/\u00e2\u20ac¦/g, "\u2026")
        .replace(/　/g, " ")
        .replace(/\uFFFD/g, "")
        .trim();
    };
  }

  const cleanDisplayText = window.OlafText?.clean || createDisplayTextCleaner();
  window.OlafText = {
    ...(window.OlafText || {}),
    clean: cleanDisplayText
  };

  function applyAdminBrandLogo(iconUrl) {
    const url = String(iconUrl || "").trim();
    if (!url) return;
    activeAdminBrandLogo = url;

    document.querySelectorAll(".brand-mark, .mobile-menu-brand-mark, .auth-brand-mark").forEach((mark) => {
      const current = mark.querySelector("img[data-admin-brand-logo]");
      if (current?.getAttribute("src") === url) return;
      const image = document.createElement("img");
      image.src = url;
      image.alt = "";
      image.width = 48;
      image.height = 48;
      image.loading = "eager";
      image.decoding = "async";
      image.fetchPriority = "high";
      image.dataset.adminBrandLogo = "true";
      mark.replaceChildren(image);
      mark.classList.add("has-admin-logo");
    });

    let favicon = document.querySelector("#dynamic-favicon");
    if (!favicon) {
      favicon = document.createElement("link");
      favicon.id = "dynamic-favicon";
      favicon.rel = "icon";
      document.head.appendChild(favicon);
    }
    favicon.href = url;
  }

  async function loadAdminBrandLogo() {
    try {
      const settings = await window.OlafStoreSettings?.fetchStoreSettings?.();
      applyAdminBrandLogo(settings?.siteIconUrl);
    } catch (error) {
      // Keep the local OLAF fallback mark when settings are temporarily unavailable.
    }
  }

  function currentFile() {
    return window.location.pathname.split("/").pop() || "index.html";
  }

  function inventoryUrlFromLegacyLink(link) {
    try {
      const url = new URL(link.getAttribute("href") || "", window.location.href);
      const orderId = url.searchParams.get("order");
      return orderId
        ? `profile.html?order=${encodeURIComponent(orderId)}#inventory`
        : ORDER_DESTINATION;
    } catch (error) {
      return ORDER_DESTINATION;
    }
  }

  function replaceLegacyOrderLinks() {
    document.querySelectorAll('a[href*="orders.html"], a[href="/orders"], a[href="orders"]').forEach((link) => {
      link.href = inventoryUrlFromLegacyLink(link);
      if (/ออเดอร์|คำสั่งซื้อ/i.test(link.textContent || "")) {
        const label = link.querySelector("span");
        if (label) label.textContent = "คลังสินค้า";
        else if (!link.querySelector("svg, i")) link.textContent = "คลังสินค้า";
      }
    });
  }

  function navLinkHtml(item) {
    const file = currentFile();
    const hash = window.location.hash;
    const matchesFile = item.match?.includes(file);
    const matchesHash = item.matchHash && hash === item.matchHash;
    const active = item.href === "index.html#catalog"
      ? file === "index.html" && hash === "#catalog"
      : item.href === ORDER_DESTINATION
        ? file === "profile.html" && hash === "#inventory"
        : Boolean(matchesFile && !hash);
    const external = item.external ? ' target="_blank" rel="noreferrer"' : "";
    return `<a href="${item.href}"${external}${active || matchesHash ? ' class="is-active"' : ""}><i data-lucide="${item.icon || "circle"}" aria-hidden="true"></i><span>${escapeHtml(item.label)}</span></a>`;
  }

  function currentNavUser() {
    try {
      return window.OlafStore?.currentUser?.() || null;
    } catch (error) {
      return null;
    }
  }

  function mobileReturnUrl() {
    return encodeURIComponent(`${window.location.pathname}${window.location.search}${window.location.hash}` || "index.html");
  }

  function mobileNavHeaderHtml() {
    return `
      <div class="mobile-menu-head" aria-hidden="false">
        <a class="mobile-menu-brand" href="index.html" aria-label="OLAFSHOP">
          <span class="mobile-menu-brand-mark"><i data-lucide="gamepad-2"></i></span>
          <span class="mobile-menu-brand-text">OLAF<span>SHOP</span></span>
        </a>
        <button class="mobile-menu-close" type="button" data-mobile-menu-close aria-label="ปิดเมนู">
          <i data-lucide="x"></i>
        </button>
      </div>`;
  }

  function mobileNavFooterHtml() {
    const user = currentNavUser();
    if (user) {
      return `
        <div class="mobile-menu-footer">
          <button class="mobile-menu-auth-btn mobile-menu-logout" type="button" data-mobile-nav-logout>
            <i data-lucide="log-out"></i>
            <span>ออกจากระบบ</span>
          </button>
        </div>`;
    }

    const returnUrl = mobileReturnUrl();
    return `
      <div class="mobile-menu-footer mobile-menu-auth">
        <a class="mobile-menu-auth-btn mobile-menu-login" href="login.html?return=${returnUrl}">
          <i data-lucide="log-in"></i>
          <span>เข้าสู่ระบบ</span>
        </a>
        <a class="mobile-menu-auth-btn mobile-menu-register" href="register.html?return=${returnUrl}">
          <i data-lucide="user-plus"></i>
          <span>สมัครสมาชิก</span>
        </a>
      </div>`;
  }

  function mainNavHtml() {
    return NAV_ITEMS.map(navLinkHtml).join("");
  }

  function mobileDrawerHtml() {
    return `${mobileNavHeaderHtml()}<div class="mobile-menu-list" role="menu">${NAV_ITEMS.map(navLinkHtml).join("")}</div>${mobileNavFooterHtml()}`;
  }

  function renderMainNav(nav) {
    nav.innerHTML = mainNavHtml();
    window.lucide?.createIcons?.();
  }

  function removePortalMobileMenuArtifacts() {
    document.querySelectorAll(".olaf-mobile-drawer").forEach((node) => {
      if (node.id !== MOBILE_DRAWER_ID) node.remove();
      else node.dataset.mobileMenu = MOBILE_DRAWER_VERSION;
    });
    document.querySelectorAll("[data-olaf-mobile-backdrop]").forEach((node, index) => {
      if (node.id !== MOBILE_BACKDROP_ID && index > 0) node.remove();
    });
  }

  function renderMobileDrawer(drawer) {
    drawer.innerHTML = mobileDrawerHtml();
    applyAdminBrandLogo(activeAdminBrandLogo);
    window.lucide?.createIcons?.();
  }

  function ensureMobileBackdrop() {
    document.querySelectorAll("[data-olaf-mobile-backdrop], .olaf-mobile-menu-backdrop").forEach((node) => {
      if (node.id !== MOBILE_BACKDROP_ID) node.remove();
    });
    let backdrop = document.getElementById(MOBILE_BACKDROP_ID);
    if (!backdrop) {
      backdrop = document.createElement("button");
      backdrop.type = "button";
      backdrop.className = "olaf-mobile-menu-backdrop";
      backdrop.id = MOBILE_BACKDROP_ID;
      backdrop.setAttribute("aria-label", "ปิดเมนู");
      document.body?.appendChild(backdrop);
    }
    backdrop.dataset.olafMobileBackdrop = "backdrop-v68";
    return backdrop;
  }

  function ensureMobileDrawer() {
    document.querySelectorAll(".olaf-mobile-drawer").forEach((node) => {
      if (node.id !== MOBILE_DRAWER_ID) node.remove();
    });
    let drawer = document.getElementById(MOBILE_DRAWER_ID);
    if (!drawer) {
      drawer = document.createElement("nav");
      drawer.id = MOBILE_DRAWER_ID;
      drawer.className = "olaf-mobile-drawer";
      drawer.setAttribute("aria-hidden", "true");
      document.body?.appendChild(drawer);
    }
    drawer.dataset.mobileMenu = MOBILE_DRAWER_VERSION;
    drawer.setAttribute("role", "navigation");
    drawer.setAttribute("aria-label", "เมนูหลักบนมือถือ");
    renderMobileDrawer(drawer);
    return drawer;
  }

  function isMobileNavigationViewport() {
    return window.matchMedia?.("(max-width: 768px)")?.matches ?? window.innerWidth <= 768;
  }

  function syncMobileSourceNavVisibility() {
    const shouldHide = isMobileNavigationViewport();
    document.querySelectorAll(".topbar.site-topbar-unified > .main-nav[data-mobile-menu='clean-v14']").forEach((nav) => {
      if (shouldHide) {
        nav.setAttribute("aria-hidden", "true");
        nav.setAttribute("inert", "");
        nav.style.display = "none";
        nav.style.visibility = "hidden";
        nav.style.pointerEvents = "none";
        nav.style.transform = "translate3d(-120%, 0, 0)";
        nav.style.width = "0";
        nav.style.height = "0";
        nav.style.overflow = "hidden";
        return;
      }

      nav.removeAttribute("aria-hidden");
      nav.removeAttribute("inert");
      nav.style.display = "";
      nav.style.visibility = "";
      nav.style.pointerEvents = "";
      nav.style.transform = "";
      nav.style.width = "";
      nav.style.height = "";
      nav.style.overflow = "";
    });
  }

  function setMobilePageScrollLock(shouldLock) {
    const body = document.body;
    const root = document.documentElement;
    if (!body) return;

    if (shouldLock) {
      const scrollY = window.scrollY || document.documentElement.scrollTop || 0;
      if (!root.style.getPropertyValue("--olaf-mobile-scroll-y")) {
        root.style.setProperty("--olaf-mobile-scroll-y", `${scrollY}px`);
      }
      if (!isMobileNavigationViewport()) return;
    }

    if (shouldLock && isMobileNavigationViewport()) {
      if (body.dataset.mobileNavScrollLocked === "1") return;
      const scrollY = window.scrollY || document.documentElement.scrollTop || 0;
      body.dataset.mobileNavScrollLocked = "1";
      body.dataset.mobileNavScrollY = String(scrollY);
      if (!root.style.getPropertyValue("--olaf-mobile-scroll-y")) {
        root.style.setProperty("--olaf-mobile-scroll-y", `${scrollY}px`);
      }
      root.style.overflow = "hidden";
      root.style.overscrollBehavior = "none";
      root.style.height = "100%";
      body.style.position = "fixed";
      body.style.top = `-${scrollY}px`;
      body.style.left = "0";
      body.style.right = "0";
      body.style.width = "100%";
      body.style.overflow = "hidden";
      body.style.overscrollBehavior = "none";
      body.style.height = "100%";
      return;
    }

    if (body.dataset.mobileNavScrollLocked !== "1") {
      root.style.removeProperty("--olaf-mobile-scroll-y");
      return;
    }
    const restoreScrollY = Number(body.dataset.mobileNavScrollY || "0") || 0;
    delete body.dataset.mobileNavScrollLocked;
    delete body.dataset.mobileNavScrollY;
    root.style.overflow = "";
    root.style.overscrollBehavior = "";
    root.style.height = "";
    root.style.removeProperty("--olaf-mobile-scroll-y");
    body.style.width = "";
    body.style.overflow = "";
    body.style.overscrollBehavior = "";
    body.style.height = "";
    body.style.position = "";
    body.style.top = "";
    body.style.left = "";
    body.style.right = "";
    window.scrollTo(0, restoreScrollY);
  }

  window.OlafNavigation = {
    ...(window.OlafNavigation || {}),
    ownsUserMenu: true,
    userMenuVersion: USER_MENU_VERSION,
    closeMobileMenus: () => {
      document.querySelectorAll(".topbar.is-mobile-nav-open, .topbar.site-topbar-unified.is-mobile-nav-open").forEach((header) => {
        header.classList.remove("is-mobile-nav-open");
        header.querySelector(".mobile-nav-toggle")?.setAttribute("aria-expanded", "false");
        header.querySelectorAll(".main-nav[data-mobile-menu='clean-v14']").forEach((nav) => {
          nav.style.top = "";
          nav.style.removeProperty("--olaf-mobile-scroll-y");
        });
      });
      document.querySelectorAll(".olaf-mobile-drawer").forEach((drawer) => {
        drawer.classList.remove("is-open");
        drawer.setAttribute("aria-hidden", "true");
      });
      document.querySelectorAll("[data-olaf-mobile-backdrop]").forEach((backdrop) => {
        backdrop.classList.remove("is-open");
      });
      document.documentElement.classList.remove("olaf-mobile-nav-open", "olaf-topbar-overlay-open");
      document.body?.classList.remove("olaf-mobile-nav-open", "olaf-topbar-overlay-open");
      setMobilePageScrollLock(false);
    },
    unlockMobileNavScroll: () => setMobilePageScrollLock(false),
    refreshAccount: () => document.querySelectorAll(".topbar").forEach(syncHeaderAccountState),
    refreshPointBalance: () => refreshSharedPointBalance(document.querySelector("#user-popover")),
    closeTopbarPopovers,
    positionTopbarPopover
  };

  function closeMobileNavigationOnly() {
    const hadMobileNavigationOpen = Boolean(
      document.querySelector(".olaf-mobile-drawer.is-open") ||
      document.documentElement.classList.contains("olaf-mobile-nav-open") ||
      document.body?.classList.contains("olaf-mobile-nav-open")
    );

    document.querySelectorAll(".topbar.is-mobile-nav-open, .topbar.site-topbar-unified.is-mobile-nav-open").forEach((header) => {
      header.classList.remove("is-mobile-nav-open");
      header.querySelector(".mobile-nav-toggle")?.setAttribute("aria-expanded", "false");
      header.querySelectorAll(".main-nav[data-mobile-menu='clean-v14']").forEach((nav) => {
        nav.style.top = "";
        nav.style.removeProperty("--olaf-mobile-scroll-y");
      });
    });
    document.querySelectorAll(".olaf-mobile-drawer").forEach((drawer) => {
      drawer.classList.remove("is-open");
      drawer.setAttribute("aria-hidden", "true");
    });
    document.querySelectorAll("[data-olaf-mobile-backdrop], .olaf-mobile-menu-backdrop").forEach((backdrop) => {
      backdrop.classList.remove("is-open");
    });
    document.documentElement.classList.remove("olaf-mobile-nav-open", "olaf-topbar-overlay-open");
    document.body?.classList.remove("olaf-mobile-nav-open", "olaf-topbar-overlay-open");
    if (hadMobileNavigationOpen) setMobilePageScrollLock(false);
  }

  function syncMobileUserPopoverPortal() {
    if (!document.body) return;
    const preferredWrap =
      document.querySelector(".topbar .user-popover-wrap") ||
      document.querySelector(".user-popover-wrap");
    let popover =
      preferredWrap?.querySelector("#user-popover") ||
      document.querySelector("#user-popover");

    if (preferredWrap && popover && popover.parentElement !== preferredWrap) {
      preferredWrap.appendChild(popover);
    }

    document.querySelectorAll("#user-popover").forEach((node) => {
      if (!popover || node === popover) return;
      node.hidden = true;
      node.classList.add("hidden", "olaf-user-popover-duplicate");
      node.remove();
    });

    document.querySelectorAll(".user-popover").forEach((node) => {
      if (!popover || node === popover || popover.contains(node)) return;
      node.hidden = true;
      node.classList.add("hidden", "olaf-user-popover-duplicate");
      node.remove();
    });

    if (!popover) return;
    delete popover.dataset.mobilePortal;
    popover.classList.remove("olaf-user-popover-duplicate");
    popover.classList.add("olaf-user-popover-single");
    popover.removeAttribute("aria-hidden");
    popover.style.position = "";
    popover.style.top = "";
    popover.style.right = "";
    popover.style.bottom = "";
    popover.style.left = "";
    popover.style.width = "";
    popover.style.maxWidth = "";
    popover.style.maxHeight = "";
    popover.style.transform = "";
    popover.style.opacity = "";
    popover.style.pointerEvents = "";
    if (popover.hidden) popover.style.display = "";
  }

  function hideMobileFloatingPanel(node) {
    if (!node) return;
    node.hidden = true;
    node.classList.add("hidden");
    node.classList.remove("show", "open", "is-open", "active", "is-active");
    node.style.display = "";
    node.style.opacity = "";
    node.style.pointerEvents = "";
    node.style.transform = "";
    node.setAttribute("aria-hidden", "true");
  }

  function dedupeMobileNavigationLayers() {
    document.querySelectorAll("[data-mobile-menu], [data-olaf-mobile-backdrop], .olaf-mobile-menu-backdrop, .mobile-menu-backdrop, .mobile-nav-backdrop, .mobile-drawer-backdrop").forEach((node) => {
      if (node.id === MOBILE_DRAWER_ID || node.id === MOBILE_BACKDROP_ID) return;
      if (node.matches?.(".topbar.site-topbar-unified > .main-nav[data-mobile-menu='clean-v14']")) return;
      if (node.matches?.(".olaf-mobile-drawer, .olaf-mobile-menu-backdrop, .mobile-menu-backdrop, .mobile-nav-backdrop, .mobile-drawer-backdrop")) node.remove();
    });

    const drawers = [...document.querySelectorAll(".olaf-mobile-drawer")];
    const primaryDrawer =
      drawers.find((drawer) => drawer.id === MOBILE_DRAWER_ID && drawer.dataset.mobileMenu === MOBILE_DRAWER_VERSION) ||
      drawers.find((drawer) => drawer.id === MOBILE_DRAWER_ID) ||
      drawers.find((drawer) => drawer.dataset.mobileMenu === "drawer-v54") ||
      drawers.find((drawer) => drawer.dataset.mobileMenu === "drawer-v16") ||
      drawers[0] ||
      null;
    drawers.forEach((drawer) => {
      if (drawer === primaryDrawer) return;
      drawer.classList.remove("is-open");
      drawer.setAttribute("aria-hidden", "true");
      drawer.remove();
    });
    if (primaryDrawer) primaryDrawer.dataset.mobileMenu = MOBILE_DRAWER_VERSION;

    const backdrops = [...document.querySelectorAll("[data-olaf-mobile-backdrop], .olaf-mobile-menu-backdrop")];
    const primaryBackdrop =
      backdrops.find((backdrop) => backdrop.id === MOBILE_BACKDROP_ID && backdrop.dataset.olafMobileBackdrop === "backdrop-v68") ||
      backdrops.find((backdrop) => backdrop.id === MOBILE_BACKDROP_ID) ||
      backdrops.find((backdrop) => backdrop.hasAttribute("data-olaf-mobile-backdrop")) ||
      backdrops[0] ||
      null;
    backdrops.forEach((backdrop) => {
      if (backdrop === primaryBackdrop) return;
      backdrop.classList.remove("is-open");
      backdrop.remove();
    });
    if (primaryBackdrop) primaryBackdrop.dataset.olafMobileBackdrop = "backdrop-v68";

    document.querySelectorAll(".topbar.site-topbar-unified > .main-nav[data-mobile-menu='clean-v14']").forEach((nav) => {
      nav.querySelectorAll(".mobile-menu-head, .mobile-menu-footer, [data-mobile-menu-close]").forEach((node) => node.remove());
      nav.dataset.mobileMenu = "clean-v14";
    });
    syncMobileSourceNavVisibility();

    document.querySelectorAll(".mobile-menu-backdrop, .mobile-nav-backdrop, .mobile-drawer-backdrop").forEach((node) => {
      if (!node.hasAttribute("data-olaf-mobile-backdrop")) node.remove();
    });
  }

  let activeTopbarPopover = null;
  let activeTopbarAnchor = null;
  let topbarPortalCounter = 0;
  const popoverCloseTimers = new WeakMap();

  function isTopbarPopoverOpen(popover) {
    return Boolean(popover && !popover.hidden && popover.dataset.olafPopoverState !== "closing");
  }

  function syncTopbarPopoverOpenClass() {
    const hasOpen = ["#language-popover", "#notification-popover", "#user-popover"].some((selector) => {
      const popover = document.querySelector(selector);
      return isTopbarPopoverOpen(popover);
    });
    document.documentElement.classList.toggle("olaf-mobile-popover-open", hasOpen && isMobileNavigationViewport());
    document.body?.classList.toggle("olaf-mobile-popover-open", hasOpen && isMobileNavigationViewport());
  }

  function ensureAccountButtonIcon(button = document.querySelector("#open-auth")) {
    if (!button) return;
    const isLoading = button.classList.contains("is-auth-loading") || button.getAttribute("aria-busy") === "true";
    const iconName = isLoading ? "loader-circle" : currentNavUser() ? "circle-user-round" : "log-in";
    const hasIcon = button.querySelector("[data-olaf-account-icon], svg, i");
    let needsIconRefresh = false;
    if (!hasIcon) {
      const icon = document.createElement("i");
      icon.dataset.olafAccountIcon = "true";
      icon.dataset.olafIconName = iconName;
      icon.setAttribute("data-lucide", iconName);
      button.prepend(icon);
      needsIconRefresh = true;
    } else {
      const icon = button.querySelector("[data-olaf-account-icon], svg, i");
      if (icon.tagName.toLowerCase() === "svg" && icon.dataset.olafIconName === iconName) {
        button.querySelectorAll(".free-auth-avatar").forEach((avatar) => avatar.remove());
        return;
      }
      if (icon.tagName.toLowerCase() === "svg") {
        const replacement = document.createElement("i");
        replacement.dataset.olafAccountIcon = "true";
        replacement.dataset.olafIconName = iconName;
        replacement.setAttribute("data-lucide", iconName);
        icon.replaceWith(replacement);
        needsIconRefresh = true;
      } else {
        icon.dataset.olafAccountIcon = "true";
        icon.dataset.olafIconName = iconName;
        if (icon.getAttribute("data-lucide") !== iconName) {
          icon.setAttribute("data-lucide", iconName);
          needsIconRefresh = true;
        }
      }
    }
    button.querySelectorAll(".free-auth-avatar").forEach((avatar) => avatar.remove());
    if (needsIconRefresh) window.lucide?.createIcons?.();
  }

  function syncHeaderAccountState(header) {
    if (!header) return;
    const user = currentNavUser();
    const button = header.querySelector("#open-auth");
    const label = header.querySelector("#account-label");
    const register = header.querySelector(".register-button");
    if (!button) return;

    button.classList.remove("is-auth-loading");
    button.removeAttribute("aria-busy");
    if (label) {
      label.textContent = user
        ? cleanDisplayText(user.displayName || user.username || user.email || "Member")
        : "เข้าสู่ระบบ";
    }
    const currentIcon = button.querySelector("i, svg");
    if (currentIcon) {
      const icon = document.createElement("i");
      icon.setAttribute("data-lucide", user ? "circle-user-round" : "log-in");
      currentIcon.replaceWith(icon);
    }
    if (register) register.style.display = user ? "none" : "";
    if (user) renderFallbackUserPopover(header.querySelector("#user-popover"), user);
    ensureAccountButtonIcon(button);
    window.lucide?.createIcons?.();
  }

  function setupAccountButtonIconGuard(header) {
    const button = header.querySelector("#open-auth");
    if (!button || button.dataset.olafAccountIconGuard === "true") return;
    button.dataset.olafAccountIconGuard = "true";
    ensureAccountButtonIcon(button);
    const observer = new MutationObserver(() => ensureAccountButtonIcon(button));
    observer.observe(button, { childList: true, subtree: false, attributes: true, attributeFilter: ["class"] });
  }

  let sharedPointBalanceRequest = 0;

  function updateSharedPointBalance(value, popover = document.querySelector("#user-popover")) {
    const formatted = new Intl.NumberFormat("th-TH", { maximumFractionDigits: 0 })
      .format(Math.max(0, Math.floor(Number(value) || 0)));
    const targets = popover
      ? popover.querySelectorAll("[data-topbar-point-balance]")
      : document.querySelectorAll("[data-topbar-point-balance]");
    targets.forEach((target) => {
      const valueNode = target.querySelector("[data-topbar-point-value]");
      if (valueNode) valueNode.textContent = `${formatted} Points`;
      else target.textContent = `${formatted} Points`;
      target.removeAttribute("aria-busy");
    });
  }

  async function refreshSharedPointBalance(popover = document.querySelector("#user-popover")) {
    if (!popover || !currentNavUser()) return;
    const requestId = ++sharedPointBalanceRequest;
    popover.querySelectorAll("[data-topbar-point-balance]").forEach((target) => {
      target.setAttribute("aria-busy", "true");
    });
    try {
      await window.OlafStore?.ready?.catch?.(() => null);
      if (!window.OlafOrders?.fetchPointBalance) throw new Error("Point client is not ready");
      const wallet = await window.OlafOrders.fetchPointBalance();
      if (requestId !== sharedPointBalanceRequest || !currentNavUser()) return;
      updateSharedPointBalance(wallet?.balance || 0, popover);
    } catch (error) {
      if (requestId !== sharedPointBalanceRequest) return;
      const valueNode = popover.querySelector("[data-topbar-point-value]");
      if (valueNode) valueNode.textContent = "โหลด Point ไม่สำเร็จ";
      popover.querySelector("[data-topbar-point-balance]")?.removeAttribute("aria-busy");
      console.warn("Unable to load shared User menu Point balance", error);
    }
  }

  function renderFallbackUserPopover(popover, user) {
    if (!popover || !user) return;
    const displayName = cleanDisplayText(user.displayName || user.username || user.email || "Member");
    const initial = displayName.trim().charAt(0).toUpperCase() || "U";
    const role = cleanDisplayText(user.role || "member");
    popover.dataset.olafUserMenuVersion = USER_MENU_VERSION;
    popover.innerHTML = `
      <div class="user-profile-card">
        <a class="user-popover-header user-popover-header-link" href="profile.html#info">
          <span class="user-popover-avatar">${escapeHtml(initial)}</span>
          <span class="user-popover-info">
            <strong>${escapeHtml(displayName)}</strong>
            <span>${escapeHtml(user.email || "")}</span>
          </span>
        </a>
        <div class="user-popover-badge-row">
          <span class="user-badge-role">${escapeHtml(role)}</span>
          <a class="user-badge-points" href="profile.html#info" data-topbar-point-balance aria-label="ยอด Point คงเหลือ">
            <i data-lucide="coins"></i><span data-topbar-point-value>กำลังโหลด Point...</span>
          </a>
        </div>
      </div>
      <div class="user-popover-menu">
        <div class="user-popover-menu-title">เมนูบัญชี</div>
        ${role === "admin" ? '<a href="olaf-control.html"><i data-lucide="shield"></i><span>หลังบ้าน (Admin)</span></a>' : ""}
        <a href="profile.html#info"><i data-lucide="circle-user-round"></i><span>ข้อมูลส่วนตัว</span></a>
        <a href="point-topup.html"><i data-lucide="coins"></i><span>เติม Point</span></a>
        <a href="profile.html#inventory"><i data-lucide="archive"></i><span>คลังสินค้า</span></a>
        <a href="profile.html#orders"><i data-lucide="receipt-text"></i><span>ประวัติคำสั่งซื้อ</span></a>
        <a href="profile.html#coupons"><i data-lucide="ticket-percent"></i><span>คูปองของฉัน</span></a>
        <a href="free-random.html"><i data-lucide="dices"></i><span>สุ่มเกม 1 Point</span></a>
        <div class="user-popover-divider"></div>
        <button class="danger-item" type="button" data-olaf-nav-logout><i data-lucide="log-out"></i><span>ออกจากระบบ</span></button>
      </div>
    `;
    popover.querySelector("[data-olaf-nav-logout]")?.addEventListener("click", async () => {
      await window.OlafStore?.logout?.();
      popover.hidden = true;
      closeTopbarPopovers("");
      window.location.href = "index.html";
    });
    const randomGameIcon = popover.querySelector('a[href="free-random.html"] i');
    if (randomGameIcon) randomGameIcon.setAttribute("data-lucide", "dices");
    const textWalker = document.createTreeWalker(popover, NodeFilter.SHOW_TEXT);
    let textNode = textWalker.nextNode();
    while (textNode) {
      textNode.nodeValue = cleanDisplayText(textNode.nodeValue);
      textNode = textWalker.nextNode();
    }
    window.lucide?.createIcons?.();
    refreshSharedPointBalance(popover);
  }

  function resolveNode(target) {
    if (!target) return null;
    if (typeof target === "string") return document.querySelector(target);
    return target instanceof Element ? target : null;
  }

  function clampNumber(value, min, max) {
    return Math.max(min, Math.min(max, value));
  }

  function clearTopbarPopoverPosition(popoverTarget) {
    const popover = resolveNode(popoverTarget);
    if (!popover) return;
    popover.classList.remove("topbar-popover-fixed");
    popover.style.removeProperty("--olaf-popover-top");
    popover.style.removeProperty("--olaf-popover-left");
    popover.style.removeProperty("--olaf-popover-width");
    popover.style.removeProperty("--olaf-popover-max-height");
    if (activeTopbarPopover === popover) {
      activeTopbarPopover = null;
      activeTopbarAnchor = null;
    }
  }

  function closeTopbarSearches(except = null) {
    document.querySelectorAll(".topbar.site-topbar-unified").forEach((header) => {
      const search = header.querySelector(".topbar-search-wrap, .site-global-search");
      if (!search || search === except) return;
      search.classList.remove("is-search-open");
      header.classList.remove("is-search-active");
      const toggle = search.querySelector(".topbar-search-toggle, .site-global-search-toggle");
      toggle?.setAttribute("aria-expanded", "false");
      search.querySelectorAll(".search-suggestions, .site-global-search-results").forEach((panel) => {
        panel.hidden = true;
        if (panel.classList.contains("site-global-search-results")) panel.innerHTML = "";
      });
    });
  }

  function ensureTopbarPortalId(node) {
    if (!node) return "";
    if (!node.dataset.olafTopbarPortalId) {
      topbarPortalCounter += 1;
      node.dataset.olafTopbarPortalId = `topbar-popover-parent-${topbarPortalCounter}`;
    }
    return node.dataset.olafTopbarPortalId;
  }

  function portalTopbarPopover(popover) {
    if (!popover || !document.body || popover.parentElement === document.body) return;
    const parent = popover.parentElement;
    popover.dataset.olafOriginalTopbarParent = ensureTopbarPortalId(parent);
    document.body.appendChild(popover);
  }

  function restoreTopbarPopover(popover) {
    if (!popover?.dataset?.olafOriginalTopbarParent) return;
    const parent = document.querySelector(`[data-olaf-topbar-portal-id="${popover.dataset.olafOriginalTopbarParent}"]`);
    if (parent && popover.parentElement !== parent) parent.appendChild(popover);
    delete popover.dataset.olafOriginalTopbarParent;
  }

  function positionTopbarPopover(popoverTarget, anchorTarget, options = {}) {
    const popover = resolveNode(popoverTarget);
    const anchor = resolveNode(anchorTarget);
    if (!popover || !anchor || popover.hidden) {
      clearTopbarPopoverPosition(popover);
      return;
    }

    const viewportWidth = document.documentElement.clientWidth || window.innerWidth || 360;
    const viewportHeight = Math.round(window.visualViewport?.height || window.innerHeight || document.documentElement.clientHeight || 640);
    const shouldFloat = viewportWidth <= Number(options.breakpoint || 1180);
    if (!shouldFloat) {
      clearTopbarPopoverPosition(popover);
      restoreTopbarPopover(popover);
      return;
    }

    const anchorRect = anchor.getBoundingClientRect();
    const isMobile = viewportWidth <= 768;
    const sideGap = viewportWidth <= 420 ? 10 : 12;
    const defaultMaxWidth =
      popover.id === "language-popover"
        ? (isMobile ? 260 : 336)
        : popover.id === "notification-popover"
          ? 348
          : (isMobile ? 348 : 336);
    const maxWidth = Number(options.maxWidth || defaultMaxWidth);
    const width = Math.round(Math.min(maxWidth, viewportWidth - sideGap * 2));
    const centerLeft = anchorRect.left + anchorRect.width / 2 - width / 2;
    const left = Math.round(clampNumber(centerLeft, sideGap, Math.max(sideGap, viewportWidth - width - sideGap)));
    const fallbackTop = Math.max(58, Number(options.fallbackTop || 64));
    const top = Math.round(clampNumber(anchorRect.bottom + 10, fallbackTop, Math.max(fallbackTop, viewportHeight - 96)));
    const bottomReserve = isMobile
      ? (popover.id === "notification-popover" ? 96 : popover.id === "user-popover" ? 88 : 74)
      : Math.max(12, sideGap);
    const maxHeight = Math.max(180, viewportHeight - top - bottomReserve);

    portalTopbarPopover(popover);
    popover.classList.add("topbar-popover-fixed");
    popover.classList.remove("hidden");
    popover.removeAttribute("aria-hidden");
    popover.style.setProperty("--olaf-popover-top", `${top}px`);
    popover.style.setProperty("--olaf-popover-left", `${left}px`);
    popover.style.setProperty("--olaf-popover-width", `${width}px`);
    popover.style.setProperty("--olaf-popover-max-height", `${Math.round(maxHeight)}px`);
    activeTopbarPopover = popover;
    activeTopbarAnchor = anchor;
    syncTopbarPopoverOpenClass();
  }

  function positionKnownTopbarPopover(popover) {
    if (!popover || popover.hidden) return;
    const header = popover.closest(".topbar") || document.querySelector(".topbar");
    const anchor =
      popover.id === "language-popover"
        ? header?.querySelector("#lang-toggle")
        : popover.id === "notification-popover"
          ? header?.querySelector("#open-notifications")
          : popover.id === "user-popover"
            ? header?.querySelector("#open-auth")
            : null;
    if (anchor) positionTopbarPopover(popover, anchor);
  }

  function scheduleTopbarPopoverPosition(popoverSelector, anchorSelector) {
    window.requestAnimationFrame(() => {
      const popover = document.querySelector(popoverSelector);
      const anchor = document.querySelector(anchorSelector);
      if (popover && anchor && !popover.hidden) positionTopbarPopover(popover, anchor);
    });
  }

  function clearTopbarPopoverCloseTimer(popover) {
    const timer = popover ? popoverCloseTimers.get(popover) : null;
    if (timer) {
      window.clearTimeout(timer);
      popoverCloseTimers.delete(popover);
    }
  }

  function hideTopbarPopover(popoverTarget, buttonTarget, options = {}) {
    const popover = resolveNode(popoverTarget);
    const button = resolveNode(buttonTarget);
    if (!popover) return;

    if (popover.hidden && popover.dataset.olafPopoverState !== "open" && popover.dataset.olafPopoverState !== "closing") {
      button?.classList.remove("is-active");
      button?.setAttribute("aria-expanded", "false");
      syncTopbarPopoverOpenClass();
      return;
    }

    const shouldAnimate =
      !options.immediate &&
      (!popover.hidden || popover.dataset.olafPopoverState === "open") &&
      (popover.classList.contains("topbar-popover-fixed") || popover.dataset.olafPopoverState === "open");

    clearTopbarPopoverCloseTimer(popover);
    if (shouldAnimate) popover.hidden = false;
    popover.classList.remove("is-open");
    popover.classList.add("is-closing");
    popover.dataset.olafPopoverState = "closing";
    button?.classList.remove("is-active");
    button?.setAttribute("aria-expanded", "false");

    const finish = () => {
      popover.hidden = true;
      popover.classList.remove("is-open", "is-closing");
      delete popover.dataset.olafPopoverState;
      clearTopbarPopoverPosition(popover);
      syncTopbarPopoverOpenClass();
    };

    if (shouldAnimate) {
      popoverCloseTimers.set(popover, window.setTimeout(finish, 260));
      return;
    }

    finish();
  }

  function hasOpenTopbarPopover() {
    return ["#language-popover", "#notification-popover", "#user-popover"].some((selector) => {
      const popover = document.querySelector(selector);
      return isTopbarPopoverOpen(popover);
    });
  }

  function closeTopbarPopovers(except = "") {
    [
      ["language", "#language-popover", "#lang-toggle"],
      ["notifications", "#notification-popover", "#open-notifications"],
      ["user", "#user-popover", "#open-auth"]
    ].forEach(([key, popoverSelector, buttonSelector]) => {
      if (key === except) return;
      const popover = document.querySelector(popoverSelector);
      const button = document.querySelector(buttonSelector);
      hideTopbarPopover(popover, button);
    });
  }

  function openTopbarPopover(key, popover, button) {
    if (!popover || !button) return;
    if (key === "user") syncMobileUserPopoverPortal();
    closeMobileSearch();
    closeMobileNavigationOnly();
    closeTopbarSearches();
    closeTopbarPopovers(key);
    clearTopbarPopoverCloseTimer(popover);
    popover.hidden = false;
    popover.classList.remove("is-closing", "hidden");
    popover.classList.add("is-open");
    popover.dataset.olafPopoverState = "open";
    popover.removeAttribute("aria-hidden");
    button.classList.add("is-active");
    button.setAttribute("aria-expanded", "true");
    positionTopbarPopover(popover, button);
    syncTopbarPopoverOpenClass();
  }

  function toggleTopbarPopover(key, popoverSelector, button) {
    const popover = document.querySelector(popoverSelector);
    if (!popover || !button) return;
    const shouldOpen = Boolean(popover.hidden || popover.dataset.olafPopoverState === "closing");
    if (!shouldOpen) {
      closeTopbarPopovers("");
      return;
    }
    if (key === "user") renderFallbackUserPopover(popover, currentNavUser());
    openTopbarPopover(key, popover, button);
  }

  window.OlafTopbarPopovers = {
    ...(window.OlafTopbarPopovers || {}),
    isUnified: true,
    close: closeTopbarPopovers,
    closeOne: (key) => {
      const map = {
        language: ["#language-popover", "#lang-toggle"],
        notifications: ["#notification-popover", "#open-notifications"],
        user: ["#user-popover", "#open-auth"]
      };
      const [popoverSelector, buttonSelector] = map[key] || [];
      hideTopbarPopover(document.querySelector(popoverSelector), document.querySelector(buttonSelector));
    },
    open: (key) => {
      const map = {
        language: ["#language-popover", "#lang-toggle"],
        notifications: ["#notification-popover", "#open-notifications"],
        user: ["#user-popover", "#open-auth"]
      };
      const [popoverSelector, buttonSelector] = map[key] || [];
      const popover = document.querySelector(popoverSelector);
      const button = document.querySelector(buttonSelector);
      if (key === "user") renderFallbackUserPopover(popover, currentNavUser());
      openTopbarPopover(key, popover, button);
    },
    toggle: (key) => {
      const map = {
        language: ["#language-popover", "#lang-toggle"],
        notifications: ["#notification-popover", "#open-notifications"],
        user: ["#user-popover", "#open-auth"]
      };
      const [popoverSelector, buttonSelector] = map[key] || [];
      const button = document.querySelector(buttonSelector);
      if (button) toggleTopbarPopover(key, popoverSelector, button);
    }
  };

  function setupTopbarPopoverAnchoring() {
    if (document.body?.dataset.olafTopbarPopoverAnchorBound === "true") return;
    document.body.dataset.olafTopbarPopoverAnchorBound = "true";

    const bindUnifiedControlCapture = () => {
      [
        ["#lang-toggle", "language", "#language-popover"],
        ["#open-notifications", "notifications", "#notification-popover"],
        ["#open-auth", "user", "#user-popover"]
      ].forEach(([buttonSelector, key, popoverSelector]) => {
        document.querySelectorAll(buttonSelector).forEach((button) => {
          if (button.dataset.olafUnifiedCaptureBound === "true") return;
          button.dataset.olafUnifiedCaptureBound = "true";
          button.addEventListener("click", (event) => {
            if (!isMobileNavigationViewport()) return;
            event.preventDefault();
            event.stopImmediatePropagation();
            closeTopbarSearches();
            if (key === "user") {
              syncMobileUserPopoverPortal();
              ensureAccountButtonIcon(button);
              if (button.classList.contains("is-auth-loading")) return;
              const user = currentNavUser();
              if (!user) {
                window.location.href = `login.html?return=${mobileReturnUrl()}`;
                return;
              }
              renderFallbackUserPopover(document.querySelector(popoverSelector), user);
            }
            toggleTopbarPopover(key, popoverSelector, button);
          }, true);
        });
      });

      document.querySelectorAll(".topbar-search-toggle, .site-global-search-toggle").forEach((button) => {
        if (button.dataset.olafUnifiedSearchCaptureBound === "true") return;
        button.dataset.olafUnifiedSearchCaptureBound = "true";
        button.addEventListener("click", (event) => {
          if (!isMobileNavigationViewport()) return;
          event.preventDefault();
          event.stopImmediatePropagation();
          openMobileSearch();
        }, true);
      });
    };

    bindUnifiedControlCapture();

    document.addEventListener("click", (event) => {
      const languageButton = event.target.closest("#lang-toggle");
      const notificationButton = event.target.closest("#open-notifications");
      const authButton = event.target.closest("#open-auth");
      if (languageButton) {
        event.preventDefault();
        event.stopImmediatePropagation();
        closeTopbarSearches();
        toggleTopbarPopover("language", "#language-popover", languageButton);
        return;
      }
      if (notificationButton) {
        event.preventDefault();
        event.stopImmediatePropagation();
        closeTopbarSearches();
        toggleTopbarPopover("notifications", "#notification-popover", notificationButton);
        return;
      }
      if (authButton) {
        event.preventDefault();
        event.stopImmediatePropagation();
        syncMobileUserPopoverPortal();
        ensureAccountButtonIcon(authButton);
        closeTopbarSearches();
        if (authButton.classList.contains("is-auth-loading")) return;
        const user = currentNavUser();
        if (!user) {
          window.location.href = `login.html?return=${mobileReturnUrl()}`;
          return;
        }
        toggleTopbarPopover("user", "#user-popover", authButton);
        return;
      }

      if (!event.target.closest(".topbar-popover-fixed, .language-switcher, .notification-wrap, .user-popover-wrap, .topbar-search-wrap, .site-global-search, .mobile-nav-toggle")) {
        const hadOpenPopover = hasOpenTopbarPopover();
        closeTopbarPopovers("");
        if (hadOpenPopover && isMobileNavigationViewport()) {
          event.preventDefault();
          event.stopImmediatePropagation();
        }
      }
    }, true);

    document.addEventListener("keydown", (event) => {
      if (event.key !== "Escape" || !hasOpenTopbarPopover()) return;
      closeTopbarPopovers("");
      if (isMobileNavigationViewport()) event.stopImmediatePropagation();
    }, true);

    const updateActive = () => {
      if (activeTopbarPopover && activeTopbarAnchor && !activeTopbarPopover.hidden) {
        positionTopbarPopover(activeTopbarPopover, activeTopbarAnchor);
        return;
      }
      ["#language-popover", "#notification-popover", "#user-popover"].forEach((selector) => {
        const popover = document.querySelector(selector);
        if (popover && !popover.hidden) positionKnownTopbarPopover(popover);
      });
    };
    window.addEventListener("resize", () => window.requestAnimationFrame(updateActive), { passive: true });
    window.addEventListener("scroll", () => window.requestAnimationFrame(updateActive), { passive: true });
    window.setTimeout(bindUnifiedControlCapture, 300);
  }

  function setupFallbackTopbarControls(header) {
    // Unified topbar controls own language/notification/user/search now.
    // Keep this old page-specific fallback disabled to prevent double-open mobile layers.
    return;
    if (!document.body?.classList.contains("free-random-page")) return;
    if (header.dataset.olafFallbackTopbarControls === "true") return;
    header.dataset.olafFallbackTopbarControls = "true";

    const langToggle = header.querySelector("#lang-toggle");
    const languagePopover = header.querySelector("#language-popover");
    const notificationToggle = header.querySelector("#open-notifications");
    const notificationPopover = header.querySelector("#notification-popover");

    langToggle?.addEventListener("click", (event) => {
      event.preventDefault();
      event.stopPropagation();
      const nextOpen = Boolean(languagePopover?.hidden);
      closeTopbarPopovers("language");
      if (!languagePopover) return;
      languagePopover.hidden = !nextOpen;
      langToggle.setAttribute("aria-expanded", String(nextOpen));
      if (nextOpen) positionTopbarPopover(languagePopover, langToggle);
    });

    languagePopover?.addEventListener("click", (event) => {
      event.stopPropagation();
      const button = event.target.closest("[data-lang-option]");
      if (!button) return;
      languagePopover.querySelectorAll("[data-lang-option]").forEach((item) => {
        item.classList.toggle("is-active", item === button);
      });
      languagePopover.hidden = true;
      clearTopbarPopoverPosition(languagePopover);
      langToggle?.setAttribute("aria-expanded", "false");
    });

    notificationToggle?.addEventListener("click", (event) => {
      event.preventDefault();
      event.stopPropagation();
      const nextOpen = Boolean(notificationPopover?.hidden);
      closeTopbarPopovers("notifications");
      if (!notificationPopover) return;
      notificationPopover.hidden = !nextOpen;
      notificationToggle.setAttribute("aria-expanded", String(nextOpen));
      if (nextOpen) positionTopbarPopover(notificationPopover, notificationToggle);
    });

    document.addEventListener("click", (event) => {
      if (event.target.closest(".language-switcher, .notification-wrap, .user-popover-wrap")) return;
      closeTopbarPopovers("");
    });

    document.addEventListener("keydown", (event) => {
      if (event.key === "Escape") closeTopbarPopovers("");
    });
  }

  function normalizeMainNavigation(header, index) {
    const nav = header.querySelector(".main-nav");
    if (!nav) return;
    removePortalMobileMenuArtifacts();
    const drawer = ensureMobileDrawer(index);
    const backdrop = ensureMobileBackdrop();

    const syncMobileNavState = () => {
      const isAnyOpen = Boolean(document.querySelector(".olaf-mobile-drawer.is-open"));
      document.documentElement.classList.toggle("olaf-mobile-nav-open", isAnyOpen);
      document.body?.classList.toggle("olaf-mobile-nav-open", isAnyOpen);
      document.body?.classList.toggle("olaf-topbar-overlay-open", isAnyOpen);
      setMobilePageScrollLock(isAnyOpen);
    };

    const setMobileNavOpen = (isOpen) => {
      const shouldOpen = Boolean(isOpen) && isMobileNavigationViewport();
      syncMobileSourceNavVisibility();

      if (shouldOpen) {
        closeMobileSearch();
        closeTopbarPopovers("");
        closeTopbarSearches();
        dedupeMobileNavigationLayers();
        renderMobileDrawer(drawer);
        ["#user-popover", "#notification-popover", "#language-popover", "#filter-popover"].forEach((selector) => {
          hideMobileFloatingPanel(document.querySelector(selector));
        });
        header.querySelector("#open-auth")?.classList.remove("is-active");
        header.querySelector("#lang-toggle")?.setAttribute("aria-expanded", "false");
      } else {
        nav.style.top = "";
        nav.style.removeProperty("--olaf-mobile-scroll-y");
      }
      header.classList.toggle("is-mobile-nav-open", shouldOpen);
      drawer.classList.toggle("is-open", shouldOpen);
      backdrop.classList.toggle("is-open", shouldOpen);
      drawer.setAttribute("aria-hidden", String(!shouldOpen));
      toggle?.setAttribute("aria-expanded", String(shouldOpen));
      syncMobileNavState();
      if (shouldOpen) window.requestAnimationFrame(() => window.lucide?.createIcons?.());
    };

    nav.dataset.mobileMenu = "clean-v14";
    renderMainNav(nav);
    const navId = nav.id || `main-nav-${index + 1}`;
    nav.id = navId;

    let toggle = header.querySelector(".mobile-nav-toggle");
    if (!toggle) {
      toggle = document.createElement("button");
      toggle.className = "mobile-nav-toggle";
      toggle.type = "button";
      toggle.setAttribute("aria-controls", navId);
      header.insertBefore(toggle, nav);
    }
    toggle.innerHTML = '<i data-lucide="menu"></i><span class="sr-only">เมนู</span>';
    toggle.setAttribute("aria-label", "เปิดเมนู");
    toggle.setAttribute("aria-controls", nav.id);
    toggle.setAttribute("aria-expanded", "false");

    if (toggle.dataset.mobileDrawerController !== MOBILE_DRAWER_VERSION) {
      const cleanToggle = toggle.cloneNode(true);
      cleanToggle.dataset.mobileDrawerController = MOBILE_DRAWER_VERSION;
      toggle.replaceWith(cleanToggle);
      toggle = cleanToggle;
    }
    toggle.dataset.mobileDrawerController = MOBILE_DRAWER_VERSION;

    toggle.addEventListener("click", (event) => {
      event.preventDefault();
      event.stopImmediatePropagation();
      setMobileNavOpen(!drawer.classList.contains("is-open"));
    }, true);
    const handleMobileNavClick = async (event) => {
      if (event.target.closest("[data-mobile-menu-close]")) {
        event.preventDefault();
        setMobileNavOpen(false);
        return;
      }

      const logoutButton = event.target.closest("[data-mobile-nav-logout]");
      if (logoutButton) {
        event.preventDefault();
        logoutButton.disabled = true;
        try {
          await window.OlafStore?.logout?.();
        } catch (error) {
          console.warn("Unable to sign out from mobile menu.", error);
        }
        setMobileNavOpen(false);
        window.location.href = "index.html";
        return;
      }

      if (!event.target.closest("a")) return;
      setMobileNavOpen(false);
    };
    nav.addEventListener("click", handleMobileNavClick);
    drawer.addEventListener("click", handleMobileNavClick);
    backdrop.addEventListener("click", () => setMobileNavOpen(false));

    const refreshNavForAuth = () => {
      renderMainNav(nav);
      renderMobileDrawer(drawer);
      setupAccountButtonIconGuard(header);
      syncHeaderAccountState(header);
    };
    const storeReady = window.OlafStore?.ready;
    if (storeReady && typeof storeReady.finally === "function") storeReady.finally(refreshNavForAuth);
    window.addEventListener("olaf-auth-changed", refreshNavForAuth);
    window.addEventListener("storage", refreshNavForAuth);
    setTimeout(refreshNavForAuth, 700);

    document.addEventListener("click", (event) => {
      if (!event.target.closest("#open-auth, .user-popover-wrap, #user-popover")) return;
      syncMobileUserPopoverPortal();
    }, true);

    document.addEventListener("click", (event) => {
      if (drawer.contains(event.target) || nav.contains(event.target) || toggle?.contains(event.target)) return;
      setMobileNavOpen(false);
    });

    document.addEventListener("keydown", (event) => {
      if (event.key !== "Escape") return;
      setMobileNavOpen(false);
    });
  }

  let searchableProductsPromise = null;
  let universalSearchRequest = 0;
  let mobileSearchRequest = 0;
  let mobileSearchCloseTimer = null;

  function escapeHtml(value = "") {
    return String(value || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  function normalizedSearchValue(value = "") {
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

  function productSearchHaystack(product = {}) {
    return [
      product.name,
      product.publisher,
      product.id,
      product.category,
      product.label,
      product.steamAppId,
      product.steam_app_id,
      ...(Array.isArray(product.tags) ? product.tags : [])
    ]
      .map(normalizedSearchValue)
      .filter(Boolean)
      .join(" ");
  }

  function productImage(product = {}) {
    return product.image || product.heroImage || product.image_url || product.hero_image || "";
  }

  function productPrice(product = {}) {
    const amount = Number(product.price);
    if (!Number.isFinite(amount)) return "";
    return new Intl.NumberFormat("th-TH", {
      style: "currency",
      currency: "THB",
      maximumFractionDigits: amount % 1 ? 2 : 0
    }).format(amount);
  }

  async function loadSearchableProducts() {
    if (searchableProductsPromise) return searchableProductsPromise;

    searchableProductsPromise = (async () => {
      const endpoints = [
        "api/products-index?v=20260717-live-catalog-v116",
        "assets/products-index.json?v=20260717-live-catalog-v116",
        "api/products.json?v=20260717-live-catalog-v116"
      ];
      const hostCatalogPromise = (async () => {
        for (const endpoint of endpoints) {
          try {
            const response = await fetch(endpoint, { cache: "default" });
            if (!response.ok) continue;
            const payload = await response.json();
            const products = Array.isArray(payload) ? payload : Array.isArray(payload?.products) ? payload.products : [];
            if (products.length) return products;
          } catch (error) {
            // Continue to the next compact host catalog source.
          }
        }
        return [];
      })();

      // Search is opened on demand. Refresh its compact Supabase catalog once
      // so Admin changes to name/price/stock/image are authoritative while the
      // host catalog remains a fast fallback if the live request is unavailable.
      const liveCatalogPromise = window.OlafProducts?.fetchActiveProducts
        ? window.OlafProducts.fetchActiveProducts({ forceRefresh: true }).catch((error) => {
            console.warn("Live topbar search catalog unavailable.", error);
            return [];
          })
        : Promise.resolve([]);
      const [hostProducts, liveProducts] = await Promise.all([hostCatalogPromise, liveCatalogPromise]);
      if (!Array.isArray(liveProducts) || !liveProducts.length) return hostProducts;
      const hostById = new Map(hostProducts.filter((product) => product?.id).map((product) => [String(product.id), product]));
      return liveProducts.map((product) => ({ ...(hostById.get(String(product.id)) || {}), ...product }));
    })();

    return searchableProductsPromise;
  }

  function findSearchMatches(products, query, limit = 6) {
    const keyword = normalizedSearchValue(query);
    if (!keyword) return [];
    const terms = keyword.split(" ").filter(Boolean);

    return products
      .map((product) => {
        const name = normalizedSearchValue(product?.name);
        const haystack = productSearchHaystack(product);
        if (!terms.every((term) => haystack.includes(term))) return null;
        return {
          product,
          score:
            (name === keyword ? 100 : 0) +
            (name.startsWith(keyword) ? 40 : 0) +
            (name.includes(keyword) ? 20 : 0) +
            Number(product?.sold || 0) / 10000
        };
      })
      .filter(Boolean)
      .sort((left, right) => right.score - left.score)
      .slice(0, limit)
      .map((entry) => entry.product);
  }

  function syncIndexCatalogSearch(query, updateUrl = false) {
    if (currentFile() !== "index.html") return false;
    const catalogInput = document.querySelector("#search-input");
    if (!catalogInput) return false;

    if (catalogInput.value !== query) catalogInput.value = query;
    catalogInput.dispatchEvent(new Event("input", { bubbles: true }));

    if (updateUrl) {
      const url = new URL(window.location.href);
      if (query) url.searchParams.set("search", query);
      else url.searchParams.delete("search");
      url.hash = "catalog";
      window.history.replaceState({}, "", `${url.pathname}${url.search}${url.hash}`);
    }
    return true;
  }

  function hideUniversalSearchResults(wrapper) {
    universalSearchRequest += 1;
    const panel = wrapper.querySelector(".site-global-search-results, .search-suggestions");
    if (!panel) return;
    panel.hidden = true;
    panel.innerHTML = "";
  }

  async function renderUniversalSearchResults(wrapper, query) {
    const panel = wrapper.querySelector(".site-global-search-results, .search-suggestions");
    const keyword = query.trim();
    if (!panel || !keyword) {
      hideUniversalSearchResults(wrapper);
      return;
    }

    const requestId = ++universalSearchRequest;
    const products = await loadSearchableProducts();
    if (requestId !== universalSearchRequest) return;

    const matches = findSearchMatches(products, keyword);
    if (!matches.length) {
      panel.innerHTML = `<div class="search-suggestions-empty">ไม่พบสินค้าที่ตรงกับ “${escapeHtml(keyword)}”</div>`;
      panel.hidden = false;
      return;
    }

    panel.innerHTML = matches
      .map((product) => {
        const image = productImage(product);
        const name = cleanDisplayText(product?.name || "สินค้า");
        const meta = cleanDisplayText(product?.publisher || product?.category || "");
        return `
          <a class="search-suggestion-item" href="product.html?id=${encodeURIComponent(product.id)}" role="option">
            ${image ? `<img class="suggestion-img" src="${escapeHtml(image)}" alt="" loading="lazy" />` : ""}
            <span class="suggestion-info">
              <span class="suggestion-name">${escapeHtml(name)}</span>
              <span class="suggestion-meta">${escapeHtml(meta)}</span>
            </span>
            <strong class="suggestion-price">${escapeHtml(productPrice(product))}</strong>
          </a>
        `;
      })
      .join("");
    panel.hidden = false;
  }

  function ensureMobileSearchShell() {
    document.querySelectorAll("#olaf-mobile-search-shell").forEach((node, index) => {
      if (index > 0) node.remove();
    });
    let shell = document.querySelector("#olaf-mobile-search-shell");
    if (shell) return shell;

    shell = document.createElement("section");
    shell.id = "olaf-mobile-search-shell";
    shell.className = "olaf-mobile-search-shell";
    shell.hidden = true;
    shell.setAttribute("role", "dialog");
    shell.setAttribute("aria-modal", "true");
    shell.setAttribute("aria-label", "ค้นหาสินค้า");
    shell.innerHTML = `
      <button class="olaf-mobile-search-backdrop" type="button" data-mobile-search-close aria-label="ปิดค้นหา"></button>
      <div class="olaf-mobile-search-card">
        <div class="olaf-mobile-search-head">
          <span class="olaf-mobile-search-icon"><i data-lucide="search"></i></span>
          <div>
            <strong>ค้นหาสินค้า</strong>
            <p>พิมพ์ชื่อเกม หมวดหมู่ หรือแพลตฟอร์มที่ต้องการ</p>
          </div>
          <button class="olaf-mobile-search-close" type="button" data-mobile-search-close aria-label="ปิดค้นหา">
            <i data-lucide="x"></i>
          </button>
        </div>
        <form class="olaf-mobile-search-form" data-mobile-search-form autocomplete="off" role="search">
          <i data-lucide="search" aria-hidden="true"></i>
          <input data-mobile-search-input type="search" placeholder="ค้นหาเกม..." aria-label="ค้นหาสินค้า" />
          <button type="submit">ค้นหา</button>
        </form>
        <div class="olaf-mobile-search-results" data-mobile-search-results role="listbox">
          <div class="olaf-mobile-search-empty">เริ่มพิมพ์เพื่อค้นหาสินค้าในร้าน</div>
        </div>
      </div>
    `;
    document.body?.appendChild(shell);

    shell.addEventListener("click", (event) => {
      if (event.target.closest("[data-mobile-search-close]")) {
        event.preventDefault();
        closeMobileSearch();
        return;
      }
      const productLink = event.target.closest("[data-mobile-search-product]");
      if (productLink) closeMobileSearch();
    });

    shell.querySelector("[data-mobile-search-form]")?.addEventListener("submit", (event) => {
      event.preventDefault();
      const input = shell.querySelector("[data-mobile-search-input]");
      const query = input?.value.trim() || "";
      if (!query) {
        input?.focus();
        return;
      }
      closeMobileSearch({ immediate: true });
      if (syncIndexCatalogSearch(query, true)) {
        document.querySelector("#catalog")?.scrollIntoView({ behavior: "smooth", block: "start" });
        return;
      }
      window.location.href = `index.html?search=${encodeURIComponent(query)}#catalog`;
    });

    shell.querySelector("[data-mobile-search-input]")?.addEventListener("input", (event) => {
      renderMobileSearchResults(event.target.value || "");
    });

    window.lucide?.createIcons?.();
    return shell;
  }

  async function renderMobileSearchResults(query = "") {
    const shell = ensureMobileSearchShell();
    const panel = shell.querySelector("[data-mobile-search-results]");
    const keyword = query.trim();
    const requestId = ++mobileSearchRequest;
    if (!panel) return;

    if (!keyword) {
      panel.innerHTML = `<div class="olaf-mobile-search-empty">เริ่มพิมพ์เพื่อค้นหาสินค้าในร้าน</div>`;
      return;
    }

    panel.innerHTML = `<div class="olaf-mobile-search-loading"><i data-lucide="loader-circle"></i><span>กำลังค้นหา...</span></div>`;
    window.lucide?.createIcons?.();

    const products = await loadSearchableProducts();
    if (requestId !== mobileSearchRequest) return;
    const matches = findSearchMatches(products, keyword, 8);

    if (!matches.length) {
      panel.innerHTML = `<div class="olaf-mobile-search-empty">ไม่พบสินค้าที่ตรงกับ “${escapeHtml(keyword)}”</div>`;
      return;
    }

    panel.innerHTML = matches
      .map((product) => {
        const image = productImage(product);
        const name = cleanDisplayText(product?.name || "สินค้า");
        const meta = cleanDisplayText(product?.publisher || product?.category || "");
        const price = productPrice(product);
        return `
          <a class="olaf-mobile-search-item" href="product.html?id=${encodeURIComponent(product.id)}" data-mobile-search-product role="option">
            <span class="olaf-mobile-search-thumb">
              ${image ? `<img src="${escapeHtml(image)}" alt="" loading="lazy" />` : `<i data-lucide="gamepad-2"></i>`}
            </span>
            <span class="olaf-mobile-search-info">
              <strong>${escapeHtml(name)}</strong>
              <small>${escapeHtml(meta)}</small>
            </span>
            <span class="olaf-mobile-search-price">${escapeHtml(price)}</span>
          </a>
        `;
      })
      .join("");
    window.lucide?.createIcons?.();
  }

  function openMobileSearch() {
    if (!isMobileNavigationViewport()) return false;
    const shell = ensureMobileSearchShell();
    const input = shell.querySelector("[data-mobile-search-input]");
    clearTimeout(mobileSearchCloseTimer);
    closeTopbarPopovers("");
    closeMobileNavigationOnly();
    closeTopbarSearches();
    document.querySelectorAll(".topbar").forEach((header) => {
      header.classList.remove("is-search-active");
      header.querySelectorAll(".is-search-open").forEach((node) => node.classList.remove("is-search-open"));
      header.querySelectorAll(".search-suggestions, .site-global-search-results").forEach((panel) => {
        panel.hidden = true;
      });
      header.querySelectorAll(".topbar-search-toggle, .site-global-search-toggle").forEach((button) => {
        button.setAttribute("aria-expanded", "false");
      });
    });

    shell.hidden = false;
    shell.classList.remove("is-closing");
    shell.classList.add("is-open");
    document.documentElement.classList.add("olaf-mobile-search-open");
    document.body?.classList.add("olaf-mobile-search-open");
    setMobilePageScrollLock(true);
    window.requestAnimationFrame(() => {
      input?.focus();
      window.lucide?.createIcons?.();
    });
    return true;
  }

  function closeMobileSearch(options = {}) {
    const shell = document.querySelector("#olaf-mobile-search-shell");
    if (!shell || shell.hidden) return;
    clearTimeout(mobileSearchCloseTimer);
    shell.classList.remove("is-open");
    shell.classList.add("is-closing");
    document.documentElement.classList.remove("olaf-mobile-search-open");
    document.body?.classList.remove("olaf-mobile-search-open");

    const finish = () => {
      shell.hidden = true;
      shell.classList.remove("is-closing");
      if (!document.querySelector(".olaf-mobile-drawer.is-open")) setMobilePageScrollLock(false);
    };

    if (options.immediate) {
      finish();
      return;
    }
    mobileSearchCloseTimer = window.setTimeout(finish, 520);
  }

  function setupMobileSearchController() {
    if (document.body?.dataset.olafMobileSearchBound === "true") return;
    document.body.dataset.olafMobileSearchBound = "true";

    document.addEventListener("click", (event) => {
      const searchToggle = event.target.closest(".topbar-search-toggle, .site-global-search-toggle");
      if (!searchToggle || !isMobileNavigationViewport()) return;
      event.preventDefault();
      event.stopImmediatePropagation();
      openMobileSearch();
    }, true);

    document.addEventListener("keydown", (event) => {
      if (event.key === "Escape") closeMobileSearch();
    }, true);
  }

  function setupUniversalSearch(header) {
    const legacySearch = header.querySelector(".topbar-search-wrap");
    if (legacySearch) {
      legacySearch.classList.add("site-unified-search");
      const input = legacySearch.querySelector('input[type="search"]');
      const toggle = legacySearch.querySelector(".topbar-search-toggle");
      const form = legacySearch.querySelector("form");
      if (input) {
        input.placeholder = "ค้นหาเกม...";
        input.setAttribute("aria-label", "ค้นหาสินค้า");
      }
      if (toggle) toggle.setAttribute("aria-label", "เปิดช่องค้นหาสินค้า");
      if (input && !legacySearch.dataset.universalSearchBound) {
        const update = () => {
          const query = input.value.trim();
          syncIndexCatalogSearch(query);
          renderUniversalSearchResults(legacySearch, query);
        };
        input.addEventListener("input", update);
        input.addEventListener("focus", () => renderUniversalSearchResults(legacySearch, input.value));
        form?.addEventListener("submit", (event) => {
          event.preventDefault();
          const query = input.value.trim();
          if (!query) {
            hideUniversalSearchResults(legacySearch);
            return;
          }
          if (syncIndexCatalogSearch(query, true)) {
            hideUniversalSearchResults(legacySearch);
            document.querySelector("#catalog")?.scrollIntoView({ behavior: "smooth", block: "start" });
            return;
          }
          window.location.href = `index.html?search=${encodeURIComponent(query)}#catalog`;
        });
        legacySearch.dataset.universalSearchBound = "true";
      }
      return;
    }
    if (header.querySelector(".site-global-search")) return;
    const actions = header.querySelector(".topbar-actions");
    if (!actions) return;

    const wrapper = document.createElement("form");
    wrapper.className = "site-global-search";
    wrapper.setAttribute("role", "search");
    wrapper.innerHTML = `
      <button class="site-global-search-toggle" type="button" aria-label="เปิดช่องค้นหาสินค้า">
        <i data-lucide="search"></i>
      </button>
      <input type="search" placeholder="ค้นหาเกม..." aria-label="ค้นหาสินค้า" aria-autocomplete="list" aria-controls="site-global-search-results" />
      <div class="search-suggestions site-global-search-results" id="site-global-search-results" hidden role="listbox"></div>
    `;
    const input = wrapper.querySelector('input[type="search"]');
    const toggle = wrapper.querySelector(".site-global-search-toggle");

    input?.addEventListener("input", () => {
      const query = input.value.trim();
      syncIndexCatalogSearch(query);
      renderUniversalSearchResults(wrapper, query);
    });
    input?.addEventListener("focus", () => {
      renderUniversalSearchResults(wrapper, input.value);
    });
    toggle?.addEventListener("click", () => {
      if (window.innerWidth <= 1180) return;
      if (input?.value.trim()) wrapper.requestSubmit();
      else input?.focus();
    });
    wrapper.addEventListener("submit", (event) => {
      event.preventDefault();
      const query = input?.value.trim() || "";
      if (!query) {
        hideUniversalSearchResults(wrapper);
        return;
      }

      if (syncIndexCatalogSearch(query, true)) {
        hideUniversalSearchResults(wrapper);
        document.querySelector("#catalog")?.scrollIntoView({ behavior: "smooth", block: "start" });
        return;
      }
      window.location.href = `index.html?search=${encodeURIComponent(query)}#catalog`;
    });
    document.addEventListener("click", (event) => {
      if (!wrapper.contains(event.target)) hideUniversalSearchResults(wrapper);
    });
    document.addEventListener("keydown", (event) => {
      if (event.key === "Escape") hideUniversalSearchResults(wrapper);
    });
    actions.insertBefore(wrapper, actions.firstChild);
  }

  function setupResponsiveSearch(header) {
    const search = header.querySelector(".topbar-search-wrap, .site-global-search");
    const input = search?.querySelector('input[type="search"]');
    const toggle = search?.querySelector(".topbar-search-toggle, .site-global-search-toggle");
    if (!search || !input || !toggle) return;

    const setOpen = (open, focus = false) => {
      if (open) {
        closeTopbarPopovers("");
        closeMobileNavigationOnly();
        closeTopbarSearches(search);
      }
      search.classList.toggle("is-search-open", open);
      header.classList.toggle("is-search-active", open);
      toggle.setAttribute("aria-expanded", String(open));
      if (focus) window.requestAnimationFrame(() => input.focus());
    };

    toggle.addEventListener("click", () => {
      if (window.innerWidth > 1180) return;
      const isOpen = search.classList.contains("is-search-open");
      if (isOpen && search.classList.contains("site-global-search") && input.value.trim()) {
        search.requestSubmit();
        return;
      }
      const shouldOpen = !isOpen;
      setOpen(shouldOpen, shouldOpen);
    });
    input.addEventListener("focus", () => {
      if (window.innerWidth <= 1180) setOpen(true);
    });
    document.addEventListener("click", (event) => {
      if (window.innerWidth > 1180 || search.contains(event.target)) return;
      setOpen(false);
    });
    document.addEventListener("keydown", (event) => {
      if (event.key === "Escape") setOpen(false);
    });
  }

  function setupStickyState(headers) {
    let queued = false;
    const update = () => {
      queued = false;
      const scrolled = window.scrollY > 8;
      headers.forEach((header) => header.classList.toggle("is-scrolled", scrolled));
    };
    window.addEventListener("scroll", () => {
      if (queued) return;
      queued = true;
      window.requestAnimationFrame(update);
    }, { passive: true });
    update();
  }

  function setupDialogMotion() {
    if (window.__olafDialogMotionV81 || typeof HTMLDialogElement === "undefined") return;
    window.__olafDialogMotionV81 = true;
    const nativeClose = HTMLDialogElement.prototype.close;
    HTMLDialogElement.prototype.close = function animatedDialogClose(returnValue) {
      if (!this.open || this.classList.contains("is-closing") || window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches) {
        nativeClose.call(this, returnValue);
        return;
      }
      this.classList.add("is-closing");
      window.setTimeout(() => {
        this.classList.remove("is-closing");
        if (this.open) nativeClose.call(this, returnValue);
      }, 220);
    };
    document.addEventListener("cancel", (event) => {
      const dialog = event.target;
      if (!(dialog instanceof HTMLDialogElement) || !dialog.open) return;
      event.preventDefault();
      dialog.close();
    }, true);
  }

  function setupSiteNavigation() {
    setupDialogMotion();
    replaceLegacyOrderLinks();
    syncMobileUserPopoverPortal();
    dedupeMobileNavigationLayers();
    const headers = [...document.querySelectorAll(".topbar")];
    headers.forEach((header, index) => {
      header.classList.add("site-topbar-unified");
      normalizeMainNavigation(header, index);
      setupUniversalSearch(header);
      setupResponsiveSearch(header);
      setupMobileSearchController();
      setupFallbackTopbarControls(header);
      setupAccountButtonIconGuard(header);
      syncHeaderAccountState(header);
    });
    syncMobileSourceNavVisibility();
    setupTopbarPopoverAnchoring();
    setupStickyState(headers);
    loadAdminBrandLogo();
    setTimeout(() => {
      syncMobileUserPopoverPortal();
      dedupeMobileNavigationLayers();
      headers.forEach((header) => {
        setupAccountButtonIconGuard(header);
        syncHeaderAccountState(header);
      });
    }, 600);
    window.setTimeout(() => headers.forEach(syncHeaderAccountState), 1800);

    let cleanupQueued = false;
    const queueSingleUiCleanup = () => {
      if (cleanupQueued) return;
      cleanupQueued = true;
      window.requestAnimationFrame(() => {
        cleanupQueued = false;
        syncMobileUserPopoverPortal();
        dedupeMobileNavigationLayers();
        syncMobileSourceNavVisibility();
        headers.forEach((header) => {
          ensureAccountButtonIcon(header.querySelector("#open-auth"));
          if (header.querySelector("#open-auth")?.classList.contains("is-auth-loading")) {
            syncHeaderAccountState(header);
          }
        });
      });
    };
    new MutationObserver(queueSingleUiCleanup).observe(document.body, {
      childList: true,
      subtree: true
    });

    let resizeQueued = false;
    window.addEventListener("resize", () => {
      if (resizeQueued) return;
      resizeQueued = true;
      window.requestAnimationFrame(() => {
        resizeQueued = false;
        syncMobileUserPopoverPortal();
        syncMobileSourceNavVisibility();
        headers.forEach(setupAccountButtonIconGuard);
        if (window.innerWidth > 1180) {
          closeMobileSearch({ immediate: true });
          window.OlafNavigation?.closeMobileMenus?.();
          headers.forEach((header) => {
            header.classList.remove("is-search-active");
            header.querySelector(".is-search-open")?.classList.remove("is-search-open");
          });
        }
      });
    }, { passive: true });
    window.lucide?.createIcons?.();
  }

  document.addEventListener("DOMContentLoaded", setupSiteNavigation);
})();
