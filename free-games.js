(function () {
  "use strict";

  const data = window.OlafFreeGamesData || { offers: [], platforms: [] };
  const state = { filter: "all", offers: Array.isArray(data.offers) ? [...data.offers] : [] };
  const platformNames = Object.fromEntries((data.platforms || []).map((platform) => [platform.id, platform.name]));
  const platformClasses = { steam: "is-steam", epic: "is-epic", ea: "is-ea", ubisoft: "is-ubisoft" };

  const escapeHtml = (value) => String(value || "").replace(/[&<>'"]/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" })[character]);
  const dateTime = (value) => {
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? "ตรวจสอบที่หน้ารับเกม" : new Intl.DateTimeFormat("th-TH", { dateStyle: "medium", timeStyle: "short" }).format(date);
  };
  const remaining = (endAt) => {
    const milliseconds = new Date(endAt).getTime() - Date.now();
    if (Number.isNaN(milliseconds)) return "ตรวจสอบช่วงเวลาที่แพลตฟอร์ม";
    if (milliseconds <= 0) return "สิ้นสุดแล้ว";
    const minutes = Math.floor(milliseconds / 60000);
    const days = Math.floor(minutes / 1440);
    const hours = Math.floor((minutes % 1440) / 60);
    return days ? `เหลือ ${days} วัน ${hours} ชม.` : `เหลือ ${Math.max(hours, 0)} ชม. ${minutes % 60} นาที`;
  };
  const isActive = (offer) => !offer.endsAt || new Date(offer.endsAt).getTime() > Date.now();
  const getImage = (offer) => offer.image
    ? `<img src="${escapeHtml(offer.image)}" alt="" loading="lazy" referrerpolicy="no-referrer" />`
    : `<span class="free-game-card-art-mark">${escapeHtml((platformNames[offer.platform] || offer.platform).slice(0, 1))}</span>`;

  function offerCard(offer) {
    const active = isActive(offer);
    const platform = platformNames[offer.platform] || offer.platformLabel || offer.platform;
    return `<article class="free-game-card ${platformClasses[offer.platform] || ""} ${active ? "" : "is-expired"}">
      <div class="free-game-card-art">${getImage(offer)}<span class="free-game-platform">${escapeHtml(platform)}</span></div>
      <div class="free-game-card-body">
        <div class="free-game-card-meta"><span>${escapeHtml(offer.typeLabel || "ข้อเสนอฟรี")}</span><b class="${active ? "is-live" : ""}">${active ? "กำลังรับได้" : "สิ้นสุดแล้ว"}</b></div>
        <h2 title="${escapeHtml(offer.title)}">${escapeHtml(offer.title)}</h2>
        <p>${escapeHtml(offer.summary || "กดปุ่มเพื่อเปิดหน้ารับสิทธิ์จากแพลตฟอร์มทางการ")}</p>
        <div class="free-game-deadline"><i data-lucide="clock-3"></i><span>${offer.endsAt ? `รับได้ถึง ${dateTime(offer.endsAt)} · <strong data-free-game-countdown="${escapeHtml(offer.id)}">${remaining(offer.endsAt)}</strong>` : "ตรวจสอบเงื่อนไขและช่วงเวลาบนแพลตฟอร์ม"}</span></div>
        <div class="free-game-card-actions">
          <a class="free-game-claim" href="${escapeHtml(offer.url)}" target="_blank" rel="noopener noreferrer">รับเกมบน ${escapeHtml(platform)} <i data-lucide="external-link"></i></a>
          <a class="free-game-source" href="${escapeHtml(offer.sourceUrl || offer.url)}" target="_blank" rel="noopener noreferrer" aria-label="แหล่งข่าวทางการ"><i data-lucide="badge-check"></i></a>
        </div>
      </div>
    </article>`;
  }

  function renderOffers() {
    const grid = document.getElementById("free-games-grid");
    if (!grid) return;
    const matching = state.offers.filter((offer) => state.filter === "all" || offer.platform === state.filter).filter(isActive);
    const liveCount = document.getElementById("free-games-live-count");
    if (liveCount) liveCount.textContent = `${state.offers.filter(isActive).length} รายการกำลังเปิดรับ`;
    grid.innerHTML = matching.length
      ? matching.map(offerCard).join("")
      : `<div class="free-games-empty"><i data-lucide="radar"></i><h2>ยังไม่พบข้อเสนอที่กำลังรับได้</h2><p>เปิดหน้าทางการของแพลตฟอร์มเพื่อดูเกมเล่นฟรีและข่าวล่าสุด</p></div>`;
    if (window.lucide) window.lucide.createIcons();
  }

  function renderPlatforms() {
    const target = document.getElementById("free-games-platforms");
    if (!target) return;
    target.innerHTML = (data.platforms || []).map((platform) => `<a class="free-platform-card ${platformClasses[platform.id] || ""}" href="${escapeHtml(platform.url)}" target="_blank" rel="noopener noreferrer">
      <span class="free-platform-icon"><i data-lucide="${escapeHtml(platform.icon || "circle")}"></i></span><span><strong>${escapeHtml(platform.name)}</strong><small>${escapeHtml(platform.description)}</small></span><i class="free-platform-arrow" data-lucide="arrow-up-right"></i></a>`).join("");
    if (window.lucide) window.lucide.createIcons();
  }

  function updateCountdowns() {
    document.querySelectorAll("[data-free-game-countdown]").forEach((element) => {
      const offer = state.offers.find((item) => item.id === element.dataset.freeGameCountdown);
      if (!offer) return;
      element.textContent = remaining(offer.endsAt);
    });
  }

  function setLastChecked() {
    const target = document.getElementById("free-games-last-checked");
    if (target) target.textContent = `ตรวจข้อมูลล่าสุด ${dateTime(data.updatedAt)}`;
  }

  function setFilter(filter) {
    state.filter = filter;
    document.querySelectorAll("[data-free-game-filter]").forEach((button) => button.classList.toggle("is-active", button.dataset.freeGameFilter === filter));
    renderOffers();
  }

  async function refreshEpicOffers() {
    const endpoint = "https://store-site-backend-static.ak.epicgames.com/freeGamesPromotions?locale=en-US&country=US&allowCountries=US";
    try {
      const response = await fetch(endpoint, { cache: "no-store" });
      if (!response.ok) throw new Error("Epic promotion feed unavailable");
      const elements = (await response.json())?.data?.Catalog?.searchStore?.elements || [];
      const now = Date.now();
      const offers = elements.flatMap((item) => {
        const promotions = item.promotions?.promotionalOffers || [];
        return promotions.flatMap((group) => group.promotionalOffers || []).filter((promotion) => promotion.discountSetting?.discountPercentage === 0 && new Date(promotion.startDate).getTime() <= now && new Date(promotion.endDate).getTime() > now).map((promotion) => {
          const asset = (item.keyImages || []).find((image) => image.type === "OfferImageTall") || (item.keyImages || []).find((image) => image.type === "DieselStoreFrontWide") || {};
          const slug = item.productSlug || item.urlSlug || item.catalogNs?.mappings?.[0]?.pageSlug;
          return { id: `epic-${item.id}`, title: item.title, platform: "epic", platformLabel: "Epic Games", type: "keep", typeLabel: "รับเข้าคลังฟรี", startsAt: promotion.startDate, endsAt: promotion.endDate, url: slug ? `https://store.epicgames.com/en-US/p/${slug}` : "https://store.epicgames.com/free-games", sourceUrl: "https://store.epicgames.com/free-games", image: asset.url, summary: item.description || "กดรับเข้าคลังผ่านบัญชี Epic Games ก่อนหมดเวลา" };
        });
      });
      if (!offers.length) return;
      state.offers = [...state.offers.filter((offer) => offer.platform !== "epic"), ...offers];
      renderOffers();
    } catch (_) {
      // The official page cards remain usable when a browser or region blocks the feed.
    }
  }

  document.addEventListener("DOMContentLoaded", () => {
    renderPlatforms();
    setLastChecked();
    setFilter("all");
    document.querySelectorAll("[data-free-game-filter]").forEach((button) => button.addEventListener("click", () => setFilter(button.dataset.freeGameFilter || "all")));
    refreshEpicOffers();
    window.setInterval(updateCountdowns, 30000);
  });
})();
