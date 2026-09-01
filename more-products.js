(function () {
  const $ = (selector) => document.querySelector(selector);

  function escapeHtml(value = "") {
    return String(value).replace(/[&<>"']/g, (char) => ({
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#039;"
    })[char]);
  }

  function refreshIcons() {
    window.lucide?.createIcons?.();
  }

  const formatPrice = (value) =>
    new Intl.NumberFormat("th-TH", {
      style: "currency",
      currency: "THB",
      maximumFractionDigits: 0
    }).format(Number(value) || 0);

  function sortProductsStockLast(products = []) {
    return [...products].sort((a, b) => {
      const stockGroup = Number(Number(a?.stock || 0) <= 0) - Number(Number(b?.stock || 0) <= 0);
      if (stockGroup !== 0) return stockGroup;
      const sortOrder = Number(a?.sortOrder || 0) - Number(b?.sortOrder || 0);
      if (sortOrder !== 0) return sortOrder;
      return String(a?.name || "").localeCompare(String(b?.name || ""), "th");
    });
  }

  function stockLabel(product) {
    const stock = Number(product?.stock || 0);
    if (String(product?.category || "") === "windows") {
      return stock > 0 ? "เปิดรับพรีออเดอร์ในเว็บ" : "รอเปิดพรีออเดอร์";
    }
    if (String(product?.category || "").startsWith("minecraft-")) {
      return stock > 0 ? "เปิดรับพรีออเดอร์" : "ปิดรับพรีออเดอร์";
    }
    if (String(product?.category || "") === "rockstar") {
      return stock > 0 ? `พร้อมส่งจากสต็อก ${stock.toLocaleString("th-TH")} ชุด` : "รอเติมสต็อกจริงใน Admin";
    }
    if (stock <= 0) return "สินค้าหมด — เติมสต็อกใน Admin";
    return `พร้อมส่ง ${stock.toLocaleString("th-TH")} ชิ้น`;
  }

  function productCard(product) {
    const isMinecraft = String(product.category || "").startsWith("minecraft-");
    const isRockstar = product.category === "rockstar";
    const gallery = Array.isArray(product.gallery) ? product.gallery.filter(Boolean) : [];
    const cover = gallery[0] || product.image || product.heroImage || "assets/placeholder.svg";
    const stock = Number(product.stock || 0);
    const disabled = stock <= 0;
    const description = String(product.description || "").split("\n")[0];
    const tags = (Array.isArray(product.tags) ? product.tags : []).slice(0, 4);
    return `
      <article class="extras-product-card ${isMinecraft ? "is-minecraft" : ""} ${isRockstar ? "is-rockstar" : ""} ${disabled ? "is-out-of-stock" : ""}">
        <a class="extras-product-cover" href="product.html?id=${encodeURIComponent(product.id)}">
          <img src="${escapeHtml(cover)}" alt="${escapeHtml(product.name)}" loading="lazy" decoding="async" />
          <span class="extras-product-label">${escapeHtml(product.label || (isMinecraft ? "PRE-ORDER" : "STOCK"))}</span>
        </a>
        <div class="extras-product-body">
          <p class="extras-product-publisher">${escapeHtml(product.publisher || "")}</p>
          <h3>${escapeHtml(product.name)}</h3>
          <p class="extras-product-description">${escapeHtml(description)}</p>
          <div class="extras-product-tags">
            ${tags.map((tag) => `<span>${escapeHtml(tag)}</span>`).join("")}
          </div>
          <div class="extras-product-footer">
            <div class="extras-product-price">
              <strong>${formatPrice(product.price)}</strong>
              ${product.compareAt && Number(product.compareAt) > Number(product.price)
                ? `<del>${formatPrice(product.compareAt)}</del>`
                : ""}
              <small class="${disabled ? "is-out" : ""}">${escapeHtml(stockLabel(product))}</small>
            </div>
            <a class="extras-product-action ${disabled ? "is-disabled" : ""}" href="product.html?id=${encodeURIComponent(product.id)}">
              <i data-lucide="${isMinecraft ? "clock-3" : "receipt-text"}"></i>
              ${isMinecraft ? "สั่งซื้อพรีออเดอร์" : disabled ? "ดูรายละเอียด" : "สั่งซื้อจากสต็อก"}
            </a>
          </div>
        </div>
      </article>
    `;
  }

  function windowsProductCard(product) {
    const stock = Number(product.stock || 0);
    const features = (Array.isArray(product.tags) ? product.tags : []).slice(0, 4);
    const gallery = Array.isArray(product.gallery) ? product.gallery.filter(Boolean) : [];
    const cover = gallery[0] || product.image || product.heroImage || "assets/placeholder.svg";
    const isHighlighted = /\bpro\b/i.test(product.name || "");
    const stockText = stock > 0
      ? `พร้อมขาย ${stock.toLocaleString("th-TH")} ชิ้น`
      : "รอแอดมินอัปเดตสต็อก";
    return `
      <article class="olaf-license-card ${isHighlighted ? "is-highlight" : ""} ${stock <= 0 ? "is-out-of-stock" : ""}">
        <a class="license-card-media" href="product.html?id=${encodeURIComponent(product.id)}" aria-label="ดูรายละเอียด ${escapeHtml(product.name)}">
          <img src="${escapeHtml(cover)}" alt="${escapeHtml(product.name)}" loading="lazy" decoding="async" />
        </a>
        <div class="license-card-top">
          <div class="license-type-badges">
            <span class="license-type-badge">${escapeHtml(product.label || "Key")}</span>
            ${isHighlighted ? '<span class="license-hot-badge">ยอดนิยม</span>' : ""}
          </div>
          <h3>${escapeHtml(product.name)}</h3>
          <p>${escapeHtml(String(product.description || "").split("\n")[0])}</p>
        </div>
        <div class="license-price">
          <strong>${formatPrice(product.price)}</strong>
          ${product.compareAt && Number(product.compareAt) > Number(product.price)
            ? `<del>${formatPrice(product.compareAt)}</del>`
            : ""}
        </div>
        <ul>
          ${features.map((feature) => `<li><i data-lucide="check"></i>${escapeHtml(feature)}</li>`).join("")}
        </ul>
        <div class="license-card-actions">
          <a class="license-card-action" href="product.html?id=${encodeURIComponent(product.id)}">
            <i data-lucide="${stock > 0 ? "shopping-cart" : "circle-help"}"></i>
            <span>${stock > 0 ? "สั่งซื้อเลย" : "ดูรายละเอียด"}</span>
          </a>
          <small class="license-ready-note ${stock <= 0 ? "is-out" : ""}">
            <i data-lucide="${stock > 0 ? "package-check" : "clock-3"}"></i>${escapeHtml(stockText)}
          </small>
        </div>
      </article>
    `;
  }

  async function loadExtraProducts() {
    const onlineProducts = window.OlafProducts?.fetchActiveProducts
      ? await window.OlafProducts.fetchActiveProducts({ forceRefresh: true }).catch((error) => {
          console.warn("Extra products from Supabase unavailable", error);
          return [];
        })
      : [];
    const products = window.OlafExtraProducts?.mergeProducts?.(onlineProducts) || [];
    const windowsProducts = sortProductsStockLast(products.filter((product) => product.category === "windows"));
    const minecraftProducts = sortProductsStockLast(products.filter((product) =>
      String(product.category || "").startsWith("minecraft-")
    ));
    const rockstarProducts = sortProductsStockLast(products.filter((product) => product.category === "rockstar"));

    const windowsGrid = $("#windows-product-grid");
    const minecraftGrid = $("#minecraft-product-grid");
    const rockstarGrid = $("#rockstar-product-grid");
    if (windowsGrid) {
      windowsGrid.innerHTML = windowsProducts.length
        ? windowsProducts.map(windowsProductCard).join("")
        : '<div class="extras-product-loading">ยังไม่มีสินค้า Windows</div>';
    }
    if (minecraftGrid) {
      minecraftGrid.innerHTML = minecraftProducts.length
        ? minecraftProducts.map(productCard).join("")
        : '<div class="extras-product-loading">ยังไม่มีสินค้า Minecraft</div>';
    }
    if (rockstarGrid) {
      rockstarGrid.innerHTML = rockstarProducts.length
        ? rockstarProducts.map(productCard).join("")
        : '<div class="extras-product-loading">ยังไม่มีสินค้า Rockstar</div>';
    }
    refreshIcons();
  }

  function setupCategoryNavigation() {
    const pills = [...document.querySelectorAll(".extras-category-pill")];
    const cards = [...document.querySelectorAll(".extras-category-card")];
    const activate = (hash) => {
      pills.forEach((pill) => pill.classList.toggle("is-active", pill.getAttribute("href") === hash));
    };
    [...pills, ...cards].forEach((link) => {
      link.addEventListener("click", () => activate(link.getAttribute("href")));
    });
    if (window.location.hash) activate(window.location.hash);
  }

  function applyStoreIcon(iconUrl) {
    const url = String(iconUrl || "").trim();
    if (!url) return;
    document.querySelectorAll(".brand-mark").forEach((mark) => {
      mark.innerHTML = `<img src="${escapeHtml(url)}" alt="OLAF SHOP" loading="eager" decoding="async" />`;
    });
    let favicon = document.querySelector("#dynamic-favicon");
    if (!favicon) {
      favicon = document.createElement("link");
      favicon.id = "dynamic-favicon";
      favicon.rel = "icon";
      document.head.append(favicon);
    }
    favicon.href = url;
  }

  function closePopovers(except = "") {
    if (window.OlafTopbarPopovers?.isUnified) {
      window.OlafTopbarPopovers.close?.(except);
      return;
    }
    if (except !== "language") {
      const language = $("#language-popover");
      if (language) language.hidden = true;
    }
    if (except !== "notifications") {
      const notifications = $("#notification-popover");
      if (notifications) notifications.hidden = true;
    }
    if (except !== "user") {
      const user = $("#user-popover");
      if (user) user.hidden = true;
    }
  }

  function renderUserPopover(user) {
    const popover = $("#user-popover");
    if (!popover || !user) return;
    popover.innerHTML = `
      <div class="user-popover-header">
        <div class="user-popover-avatar">${escapeHtml((user.displayName || user.username || "U").slice(0, 1).toUpperCase())}</div>
        <div class="user-popover-info">
          <strong>${escapeHtml(user.displayName || user.username || "สมาชิก")}</strong>
          <span>${escapeHtml(user.email || "")}</span>
        </div>
      </div>
      <div class="user-popover-menu">
        ${user.role === "admin" ? '<a href="olaf-control.html"><i data-lucide="shield"></i>หลังบ้าน (Admin)</a>' : ""}
        <a href="profile.html"><i data-lucide="user"></i>ข้อมูลส่วนตัว</a>
        <a href="point-topup.html"><i data-lucide="coins"></i>เติม Point</a>
        <a href="profile.html#orders"><i data-lucide="receipt-text"></i>ประวัติคำสั่งซื้อ</a>
        <div class="user-popover-divider"></div>
        <button type="button" class="danger-item" id="extras-logout"><i data-lucide="log-out"></i>ออกจากระบบ</button>
      </div>
    `;
    refreshIcons();

    $("#extras-logout")?.addEventListener("click", async () => {
      await window.OlafStore?.logout?.();
      window.location.reload();
    });
  }

  function updateAccountChrome() {
    const user = window.OlafStore?.currentUser?.() || null;
    const accountButton = $("#open-auth");
    if (accountButton) {
      accountButton.classList.remove("is-auth-loading");
      accountButton.removeAttribute("aria-busy");
      accountButton.classList.toggle("is-signed-in", Boolean(user));
    }
    const label = $("#account-label");
    if (label) label.textContent = user ? user.displayName || user.username : "เข้าสู่ระบบ";
    const register = document.querySelector(".register-button");
    if (register) register.style.display = user ? "none" : "";
    const authIcon = accountButton?.querySelector("svg, i");
    if (authIcon) {
      const nextIcon = user ? "user" : "log-in";
      if (authIcon.tagName.toLowerCase() === "svg") {
        const iconNode = document.createElement("i");
        iconNode.setAttribute("data-lucide", nextIcon);
        authIcon.replaceWith(iconNode);
      } else {
        authIcon.setAttribute("data-lucide", nextIcon);
      }
    }
    if (user && window.OlafNavigation?.ownsUserMenu) {
      window.OlafNavigation.refreshAccount?.();
    } else if (user) {
      renderUserPopover(user);
    }
    refreshIcons();
  }

  document.addEventListener("DOMContentLoaded", async () => {
    refreshIcons();
    await window.OlafStore?.ready?.catch(() => null);
    const storeSettings = await window.OlafStoreSettings?.fetchStoreSettings?.().catch(() => null);
    applyStoreIcon(storeSettings?.siteIconUrl);
    updateAccountChrome();
    setupCategoryNavigation();
    await loadExtraProducts();

    $("#open-auth")?.addEventListener("click", (event) => {
      if (window.OlafNavigation?.ownsUserMenu) return;
      event.stopPropagation();
      const user = window.OlafStore?.currentUser?.();
      if (!user) {
        window.location.href = `login.html?return=${encodeURIComponent("more-products.html")}`;
        return;
      }
      const popover = $("#user-popover");
      if (!popover) return;
      const nextOpen = popover.hidden;
      closePopovers("user");
      popover.hidden = !nextOpen;
    });

    $("#lang-toggle")?.addEventListener("click", (event) => {
      event.stopPropagation();
      const popover = $("#language-popover");
      if (!popover) return;
      const nextOpen = popover.hidden;
      closePopovers("language");
      popover.hidden = !nextOpen;
    });

    document.querySelectorAll("[data-lang-option]").forEach((button) => {
      button.addEventListener("click", () => {
        localStorage.setItem("olafshop_lang", button.dataset.langOption || "th");
        closePopovers();
      });
    });

    $("#open-notifications")?.addEventListener("click", (event) => {
      event.stopPropagation();
      if (window.OlafTopbarPopovers?.isUnified) {
        window.OlafTopbarPopovers.toggle?.("notifications");
        return;
      }
      const popover = $("#notification-popover");
      if (!popover) return;
      const nextOpen = popover.hidden;
      closePopovers("notifications");
      popover.hidden = !nextOpen;
    });

    document.addEventListener("click", () => closePopovers());
  });
})();
