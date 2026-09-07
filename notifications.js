(function () {
  const emptyIcon = "bell";
  const readStoragePrefix = "olafshop_read_delivery_notifications";
  let newProducts = [];

  function escapeHtml(value = "") {
    return String(value).replace(/[&<>"']/g, (char) => {
      const entities = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" };
      return entities[char];
    });
  }

  function createIconSet() {
    window.requestAnimationFrame(() => {
      if (window.OlafIcons?.refresh) {
        window.OlafIcons.refresh();
        return;
      }
      window.lucide?.createIcons?.();
    });
  }

  function cleanText(value = "") {
    return window.OlafText?.clean ? window.OlafText.clean(value) : String(value || "").trim();
  }

  function formatDate(value) {
    const date = value ? new Date(value) : null;
    if (!date || Number.isNaN(date.getTime())) return "";
    return date.toLocaleString("th-TH", { dateStyle: "medium", timeStyle: "short" });
  }

  function orderLabel(order) {
    return cleanText(order?.orderNumber || order?.id || "ออเดอร์");
  }

  function orderProductText(order) {
    const names = (order?.items || [])
      .map((item) => cleanText(item.productName || item.name || item.productId))
      .filter(Boolean);
    return names.length ? names.join(", ") : "สินค้าในออเดอร์";
  }

  function orderProductImage(order) {
    const firstItem = (order?.items || []).find((item) => item.productImageUrl || item.image);
    return firstItem?.productImageUrl || firstItem?.image || "";
  }

  function couponValueLabel(coupon = {}) {
    const value = Number(coupon.discountValue || 0).toLocaleString("th-TH");
    return coupon.discountType === "percent" ? `ลด ${value}%` : `ลด ฿${value}`;
  }

  function couponPeriodLabel(coupon = {}) {
    const start = formatDate(coupon.startsAt);
    const end = formatDate(coupon.expiresAt);
    if (start && end) return `${start} – ${end}`;
    if (end) return `ใช้ได้ถึง ${end}`;
    return start ? `เริ่ม ${start}` : "ไม่จำกัดวันหมดอายุ";
  }

  function currentUser() {
    return window.OlafStore?.currentUser?.() || null;
  }

  function readStorageKey(user) {
    return `${readStoragePrefix}:${user?.id || "guest"}`;
  }

  function readDeliveryNotificationIds(user) {
    try {
      const value = JSON.parse(localStorage.getItem(readStorageKey(user)) || "[]");
      return new Set(Array.isArray(value) ? value.map(String) : []);
    } catch (error) {
      return new Set();
    }
  }

  function writeDeliveryNotificationIds(user, ids) {
    try {
      localStorage.setItem(readStorageKey(user), JSON.stringify([...ids].slice(-300)));
    } catch (error) {
      console.warn("Unable to save notification read state", error);
    }
  }

  function setBadge(count) {
    const badge = document.querySelector("#notification-badge");
    const button = document.querySelector("#open-notifications");
    if (!badge || !button) return;
    if (count > 0) {
      badge.hidden = false;
      badge.textContent = "";
      badge.title = `${count} แจ้งเตือน`;
      button.classList.add("has-notifications");
      button.setAttribute("aria-label", `แจ้งเตือน ${count} รายการ`);
      return;
    }
    badge.hidden = true;
    badge.textContent = "";
    badge.removeAttribute("title");
    button.classList.remove("has-notifications");
    button.setAttribute("aria-label", "แจ้งเตือน");
  }

  function markDeliveryNotificationRead(orderId) {
    const user = currentUser();
    if (!user || !orderId) return;
    const readIds = readDeliveryNotificationIds(user);
    readIds.add(String(orderId));
    writeDeliveryNotificationIds(user, readIds);
    const item = [...document.querySelectorAll("[data-delivery-notification]")]
      .find((node) => node.dataset.deliveryNotification === String(orderId));
    if (item) item.classList.remove("unread");
    setBadge(document.querySelectorAll("[data-delivery-notification].unread, [data-coupon-notification].unread, [data-product-notification].unread").length);
  }

  function renderEmpty(message) {
    const list = document.querySelector("#notification-list");
    if (!list) return;
    list.innerHTML = `
      <div class="notification-empty">
        <i data-lucide="${emptyIcon}"></i>
        <p>${escapeHtml(message)}</p>
      </div>`;
    createIconSet();
  }

  function isVisibleCouponCampaign(coupon, now = Date.now()) {
    if (!coupon || coupon.expired === true) return false;
    if ([coupon.isActive, coupon.is_active, coupon.active, coupon.enabled].some(value => value === false || value === 'false' || value === 0)) return false;
    if (['expired','inactive','disabled','cancelled','canceled','revoked','closed'].includes(String(coupon.status || '').toLowerCase())) return false;
    const expiration = coupon.expiresAt || coupon.expires_at;
    if (expiration) {
      const expires = new Date(expiration).getTime();
      if (!Number.isFinite(expires) || expires <= now) return false;
    }
    return true;
  }

  let campaignExpiryTimer = null;
  function renderNotifications(orders, campaigns, user) {
    const list = document.querySelector("#notification-list");
    if (!list) return;

    const deliveredOrders = orders
      .filter((order) => order?.status === "delivered")
      .sort((a, b) => new Date(b.updatedAt || b.createdAt) - new Date(a.updatedAt || a.createdAt));
    const couponCampaigns = (campaigns || [])
      .filter(coupon => isVisibleCouponCampaign(coupon))
      .sort((a, b) => new Date(a.expiresAt || 8640000000000000) - new Date(b.expiresAt || 8640000000000000));
    clearTimeout(campaignExpiryTimer);
    const expiryTimes = couponCampaigns.map(coupon => new Date(coupon.expiresAt || coupon.expires_at || '').getTime()).filter(Number.isFinite);
    if (expiryTimes.length) {
      const delay = Math.min(2147483647, Math.max(1, Math.min(...expiryTimes) - Date.now() + 20));
      campaignExpiryTimer = setTimeout(() => renderNotifications(orders, campaigns, user), delay);
    }
    const readIds = readDeliveryNotificationIds(user);
    const recentProducts = newProducts.filter(product => {
      const age = Date.now() - new Date(product.createdAt).getTime();
      return age >= 0 && age < 7 * 86400000;
    });
    const unreadCoupons = couponCampaigns.filter((coupon) => !coupon.expired && !coupon.claimed).length;
    const unreadCount = deliveredOrders.filter((order) => !readIds.has(String(order.id))).length + unreadCoupons;
    setBadge(unreadCount + recentProducts.filter(product => !readIds.has(`product:${product.id}`)).length);

    if (!deliveredOrders.length && !couponCampaigns.length && !recentProducts.length) {
      renderEmpty(user ? "ยังไม่มีแจ้งเตือนใหม่" : "ยังไม่มีกิจกรรมในขณะนี้");
      return;
    }

    const couponHtml = couponCampaigns.map((coupon) => {
      const expired = coupon.expired === true;
      const claimed = coupon.claimed === true;
      const consumed = coupon.consumed === true;
      const tag = expired ? "หมดเวลากิจกรรม" : consumed ? "ใช้แล้ว" : claimed ? "รับแล้ว" : "กิจกรรมโค้ดฟรี";
      const codeId = coupon.id || coupon.codeId;
      return `
        <article class="notification-item notification-coupon ${expired ? "is-expired" : ""} ${!expired && !claimed ? "unread" : ""}" data-coupon-notification="${escapeHtml(codeId)}">
          <span class="notification-icon"><i data-lucide="ticket-percent"></i></span>
          <span class="notification-content">
            <span class="notification-coupon-tag ${expired ? "is-expired" : ""}">${escapeHtml(tag)}</span>
            <strong>${escapeHtml(coupon.title || "กิจกรรมรับโค้ดส่วนลด")}</strong>
            <p>${escapeHtml(coupon.message || couponValueLabel(coupon))}</p>
            <span>${escapeHtml(couponValueLabel(coupon))} · ${escapeHtml(couponPeriodLabel(coupon))}</span>
            ${!expired && !claimed ? `<button type="button" class="notification-coupon-claim" data-claim-coupon="${escapeHtml(codeId)}"><i data-lucide="gift"></i>รับคูปอง</button>` : ""}
            ${claimed ? `<a class="notification-coupon-open" href="profile.html#coupons"><i data-lucide="ticket-check"></i>ดูคูปองของฉัน</a>` : ""}
          </span>
        </article>`;
    }).join("");

    const deliveredHtml = deliveredOrders.map((order) => {
      const imageUrl = orderProductImage(order);
      const isUnread = !readIds.has(String(order.id));
      const mediaHtml = imageUrl
        ? `<span class="notification-thumb"><img src="${escapeHtml(imageUrl)}" alt="${escapeHtml(orderProductText(order))}" /></span>`
        : `<span class="notification-icon"><i data-lucide="check-circle"></i></span>`;
      const dateText = formatDate(order.updatedAt || order.createdAt);
      return `
        <a class="notification-item ${isUnread ? "unread" : ""} notification-delivered" href="profile.html?order=${encodeURIComponent(order.id)}#inventory" data-delivery-notification="${escapeHtml(order.id)}">
          ${mediaHtml}
          <span class="notification-content">
            <strong>ออเดอร์จัดส่งสำเร็จแล้ว</strong>
            <p>${escapeHtml(orderProductText(order))}</p>
            <span>${escapeHtml(orderLabel(order))}${dateText ? ` · ${escapeHtml(dateText)}` : ""}</span>
          </span>
        </a>`;
    }).join("");

    const productHtml = recentProducts.map(product => {
      const imageUrl = product.image || product.heroImage || '';
      const media = imageUrl
        ? `<span class="notification-thumb"><img src="${escapeHtml(imageUrl)}" alt="${escapeHtml(product.name)}" loading="lazy" decoding="async" width="46" height="46" /></span>`
        : '<span class="notification-icon"><i data-lucide="package-plus"></i></span>';
      const price = Number(product.price);
      const priceHtml = product.price != null && product.price !== '' && Number.isFinite(price) && price >= 0
        ? `<strong class="notification-product-price">฿${price.toLocaleString('th-TH', { maximumFractionDigits: 2 })}</strong>` : '';
      return `<a class="notification-item ${readIds.has(`product:${product.id}`) ? '' : 'unread'}" href="product.html?id=${encodeURIComponent(product.id)}" data-product-notification="${escapeHtml(product.id)}">${media}<span class="notification-content"><strong>สินค้าใหม่เข้าร้าน</strong><p>${escapeHtml(product.name)}</p>${priceHtml}<span>${escapeHtml(formatDate(product.createdAt))}</span></span></a>`;
    }).join('');
    list.innerHTML = productHtml + couponHtml + deliveredHtml;
    createIconSet();
  }

  let notificationRequest = 0;
  async function refreshDeliveryNotifications() {
    const request = ++notificationRequest;
    if (!document.querySelector("#notification-list")) return;
    await window.OlafStore?.ready;
    const user = currentUser();
    try {
      const [orders, campaigns, products] = await Promise.all([
        user && window.OlafOrders?.fetchMyOrders ? window.OlafOrders.fetchMyOrders({ summary: true }).catch(() => []) : Promise.resolve([]),
        window.OlafCoupons?.fetchCampaigns ? window.OlafCoupons.fetchCampaigns().catch(() => []) : Promise.resolve([]),
        window.OlafProducts?.fetchNewProducts ? window.OlafProducts.fetchNewProducts().catch(() => newProducts) : Promise.resolve([])
      ]);
      if (request !== notificationRequest) return;
      newProducts = Array.isArray(products) ? products : [];
      renderNotifications(Array.isArray(orders) ? orders : [], Array.isArray(campaigns) ? campaigns : [], user);
    } catch (error) {
      if (request !== notificationRequest) return;
      console.warn("Delivery notifications unavailable", error);
      setBadge(0);
      renderEmpty("โหลดแจ้งเตือนไม่สำเร็จ");
    }
  }

  document.addEventListener("DOMContentLoaded", () => {
    const loadNotifications = () => refreshDeliveryNotifications();
    if ("requestIdleCallback" in window) {
      window.requestIdleCallback(loadNotifications, { timeout: 2500 });
    } else {
      window.setTimeout(loadNotifications, 900);
    }

    document.addEventListener("click", async (event) => {
      const productLink = event.target.closest('[data-product-notification]');
      if (productLink) {
        const user = currentUser();
        const ids = readDeliveryNotificationIds(user);
        ids.add(`product:${productLink.dataset.productNotification}`);
        writeDeliveryNotificationIds(user, ids);
        productLink.classList.remove('unread');
        setBadge(document.querySelectorAll('[data-delivery-notification].unread, [data-coupon-notification].unread, [data-product-notification].unread').length);
      }
      if (event.target.closest('.notification-button')) refreshDeliveryNotifications();
      const notificationLink = event.target.closest("[data-delivery-notification]");
      if (notificationLink) markDeliveryNotificationRead(notificationLink.dataset.deliveryNotification);

      const claimButton = event.target.closest("[data-claim-coupon]");
      if (!claimButton) return;
      event.preventDefault();
      if (!currentUser()) {
        window.location.href = `login.html?return=${encodeURIComponent("profile.html#coupons")}`;
        return;
      }
      claimButton.disabled = true;
      try {
        if (!window.OlafCoupons?.claimCampaign) throw new Error("COUPON_SYSTEM_NOT_READY");
        await window.OlafCoupons.claimCampaign(claimButton.dataset.claimCoupon);
        window.showToast?.("รับคูปองแล้ว ดูได้ที่เมนูคูปองของฉัน", "success");
        await refreshDeliveryNotifications();
      } catch (error) {
        const message = String(error?.message || "");
        window.showToast?.(
          message.includes("COUPON_EXPIRED") ? "กิจกรรมนี้หมดเวลาแล้ว" : "รับคูปองไม่สำเร็จ กรุณาลองใหม่",
          "error"
        );
        claimButton.disabled = false;
        await refreshDeliveryNotifications();
      }
    });
    document.addEventListener('visibilitychange', () => {
      if (!document.hidden) refreshDeliveryNotifications();
    });
    window.setInterval(() => {
      if (!document.hidden) refreshDeliveryNotifications();
    }, 60000);
  });

  window.OlafNotifications = { refreshDeliveryNotifications };
})();
