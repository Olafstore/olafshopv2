(function () {
  "use strict";

  const data = window.OlafFreeGamesData || { offers: [], platforms: [] };
  const state = { filter: "all", offers: Array.isArray(data.offers) ? [...data.offers] : [], upcomingOffers: Array.isArray(data.upcomingOffers) ? [...data.upcomingOffers] : [] };
  const platformNames = Object.fromEntries((data.platforms || []).map((platform) => [platform.id, platform.name]));
  const platformClasses = { steam: "is-steam", epic: "is-epic", ea: "is-ea", ubisoft: "is-ubisoft" };

  const escapeHtml = (value) => String(value || "").replace(/[&<>'"]/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" })[character]);
  const dateTime = (value) => {
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? "ตรวจสอบที่หน้ารับเกม" : new Intl.DateTimeFormat("th-TH", { dateStyle: "medium", timeStyle: "short" }).format(date);
  };
  const startTime = (offer) => offer.startDateOnly
    ? `${new Intl.DateTimeFormat("th-TH", { dateStyle: "medium" }).format(new Date(`${offer.startsAt}T00:00:00Z`))} (ยังไม่ระบุเวลา)`
    : dateTime(offer.startsAt);
  const remaining = (endAt) => {
    const milliseconds = new Date(endAt).getTime() - Date.now();
    if (Number.isNaN(milliseconds)) return "ตรวจสอบช่วงเวลาที่แพลตฟอร์ม";
    if (milliseconds <= 0) return "สิ้นสุดแล้ว";
    const minutes = Math.floor(milliseconds / 60000);
    const days = Math.floor(minutes / 1440);
    const hours = Math.floor((minutes % 1440) / 60);
    return days ? `เหลือ ${days} วัน ${hours} ชม.` : `เหลือ ${Math.max(hours, 0)} ชม. ${minutes % 60} นาที`;
  };
  const untilStart = (startsAt) => {
    const milliseconds = new Date(startsAt).getTime() - Date.now();
    if (Number.isNaN(milliseconds)) return "รอประกาศเวลาเพิ่มเติม";
    if (milliseconds <= 0) return "เริ่มเปิดรับแล้ว";
    const minutes = Math.floor(milliseconds / 60000);
    const days = Math.floor(minutes / 1440);
    const hours = Math.floor((minutes % 1440) / 60);
    return days ? `อีก ${days} วัน ${hours} ชม.` : `อีก ${Math.max(hours, 0)} ชม. ${minutes % 60} นาที`;
  };
  const upcomingTiming = (offer) => offer.startDateOnly ? "รอแพลตฟอร์มประกาศเวลา" : untilStart(offer.startsAt);
  const isActive = (offer) => !offer.endsAt || new Date(offer.endsAt).getTime() > Date.now();
  const isUpcoming = (offer) => new Date(offer.startsAt).getTime() > Date.now();
  const getImage = (offer) => offer.image
    ? `<img class="free-game-image" src="${escapeHtml(offer.image)}" alt="" loading="lazy" referrerpolicy="no-referrer" />`
    : `<span class="free-game-card-art-mark">${escapeHtml((platformNames[offer.platform] || offer.platform).slice(0, 1))}</span>`;

  function bindImageFallbacks(scope) {
    if (!scope) return;
    scope.querySelectorAll("img.free-game-image").forEach((image) => image.addEventListener("error", () => {
      const holder = image.parentElement;
      if (holder) holder.classList.add("is-image-fallback");
      image.remove();
    }, { once: true }));
  }

  function offerCard(offer) {
    const active = isActive(offer);
    const platform = platformNames[offer.platform] || offer.platformLabel || offer.platform;
    return `<article class="free-game-card ${platformClasses[offer.platform] || ""} ${active ? "" : "is-expired"}">
      <div class="free-game-card-art" data-fallback="${escapeHtml(platform.slice(0, 1))}">${getImage(offer)}<span class="free-game-platform">${escapeHtml(platform)}</span><a class="free-game-claim" href="${escapeHtml(offer.url)}" target="_blank" rel="noopener noreferrer">${active ? `รับเกมบน ${escapeHtml(platform)}` : "ดูรายละเอียด"} <i data-lucide="external-link"></i></a></div>
      <div class="free-game-card-body">
        <h2 title="${escapeHtml(offer.title)}">${escapeHtml(offer.title)}</h2>
        <div class="free-game-card-meta"><span>${escapeHtml(offer.typeLabel || "ข้อเสนอฟรี")}</span><b class="${active ? "is-live" : ""}">${active ? "กำลังรับได้" : "สิ้นสุดแล้ว"}</b></div>
        <div class="free-game-deadline"><i data-lucide="clock-3"></i><span>${offer.endsAt ? `${dateTime(offer.endsAt)} · <strong data-free-game-countdown="${escapeHtml(offer.id)}">${remaining(offer.endsAt)}</strong>` : "เล่นฟรี — ตรวจสอบเงื่อนไขบนแพลตฟอร์ม"}</span></div>
        <div class="free-game-card-actions">
          <a class="free-game-source" href="${escapeHtml(offer.sourceUrl || offer.url)}" target="_blank" rel="noopener noreferrer"><i data-lucide="badge-check"></i> ข่าวจาก ${escapeHtml(platform)}</a>
        </div>
      </div>
    </article>`;
  }

  function homeOfferCard(offer) {
    const active = isActive(offer);
    const platform = platformNames[offer.platform] || offer.platformLabel || offer.platform;
    return `<a class="home-free-game-card ${platformClasses[offer.platform] || ""}" href="${escapeHtml(offer.url)}" target="_blank" rel="noopener noreferrer">
      <span class="home-free-game-art" data-fallback="${escapeHtml(platform.slice(0, 1))}">${getImage(offer)}<b>${escapeHtml(platform)}</b><em>${active ? "รับได้วันนี้" : "ดูรายละเอียด"}<i data-lucide="arrow-up-right"></i></em></span>
      <span class="home-free-game-info"><strong title="${escapeHtml(offer.title)}">${escapeHtml(offer.title)}</strong><small>${offer.endsAt ? `รับได้ถึง ${dateTime(offer.endsAt)} · ${remaining(offer.endsAt)}` : "ตรวจสอบสิทธิ์บนแพลตฟอร์ม"}</small></span>
    </a>`;
  }

  function upcomingCard(offer) {
    const platform = platformNames[offer.platform] || offer.platformLabel || offer.platform;
    return `<article class="free-upcoming-card ${platformClasses[offer.platform] || ""}">
      <div class="free-upcoming-art" data-fallback="${escapeHtml(platform.slice(0, 1))}">${getImage(offer)}<span>${escapeHtml(platform)}</span><b>จะแจกเร็ว ๆ นี้</b></div>
      <div class="free-upcoming-body"><h3 title="${escapeHtml(offer.title)}">${escapeHtml(offer.title)}</h3><p>${escapeHtml(offer.typeLabel || "ข้อเสนอฟรี")}</p><div><i data-lucide="calendar-clock"></i><span>เริ่มรับ ${startTime(offer)} · <strong data-free-upcoming-countdown="${escapeHtml(offer.id)}">${upcomingTiming(offer)}</strong></span></div><a href="${escapeHtml(offer.url)}" target="_blank" rel="noopener noreferrer">เปิดหน้าประกาศ ${escapeHtml(platform)} <i data-lucide="arrow-up-right"></i></a></div>
    </article>`;
  }

  function homeUpcomingOfferCard(offer) {
    const platform = platformNames[offer.platform] || offer.platformLabel || offer.platform;
    return `<a class="home-free-game-card is-upcoming ${platformClasses[offer.platform] || ""}" href="${escapeHtml(offer.url)}" target="_blank" rel="noopener noreferrer">
      <span class="home-free-game-art" data-fallback="${escapeHtml(platform.slice(0, 1))}">${getImage(offer)}<b>${escapeHtml(platform)}</b><em>เริ่มรับ ${startTime(offer)}<i data-lucide="calendar-clock"></i></em></span>
      <span class="home-free-game-info"><strong title="${escapeHtml(offer.title)}">${escapeHtml(offer.title)}</strong><small>${escapeHtml(offer.typeLabel || "ข้อเสนอฟรี")} · <b data-free-home-upcoming-countdown="${escapeHtml(offer.id)}">${upcomingTiming(offer)}</b></small></span>
    </a>`;
  }

  function renderHomeOffers() {
    const target = document.getElementById("index-free-games-list");
    if (!target) return;
    const activeOffers = state.offers.filter(isActive).slice(0, 2);
    const upcomingOffers = state.upcomingOffers.filter(isUpcoming).sort((left, right) => new Date(left.startsAt) - new Date(right.startsAt)).slice(0, 4);
    const cards = [...activeOffers.map(homeOfferCard), ...upcomingOffers.map(homeUpcomingOfferCard)];
    target.innerHTML = cards.length ? cards.join("") : `<div class="home-free-games-empty"><i data-lucide="radar"></i><span>กำลังตรวจสอบเกมฟรีจากแพลตฟอร์มทางการ</span></div>`;
    bindImageFallbacks(target);
    if (window.lucide) window.lucide.createIcons();
  }

  function renderUpcomingOffers() {
    const target = document.getElementById("free-games-upcoming-grid");
    const offers = state.upcomingOffers.filter(isUpcoming).sort((left, right) => new Date(left.startsAt) - new Date(right.startsAt));
    if (target) {
      target.innerHTML = offers.length ? offers.map(upcomingCard).join("") : `<div class="free-games-empty"><i data-lucide="calendar-search"></i><h2>ยังไม่มีประกาศแจกเกมล่วงหน้าที่ระบุวันชัดเจน</h2><p>ระบบจะแสดงทันทีเมื่อ Steam หรือ Epic ประกาศเวลาเริ่มรับสิทธิ์</p></div>`;
      bindImageFallbacks(target);
    }
    renderHomeUpcomingOffers(offers);
    if (window.lucide) window.lucide.createIcons();
  }

  function renderHomeUpcomingOffers(offers) {
    renderHomeOffers();
  }

  function renderOffers() {
    const grid = document.getElementById("free-games-grid");
    if (!grid) {
      renderHomeOffers();
      return;
    }
    const matching = state.offers.filter((offer) => state.filter === "all" || offer.platform === state.filter).filter(isActive);
    const liveCount = document.getElementById("free-games-live-count");
    if (liveCount) liveCount.textContent = `${state.offers.filter(isActive).length} รายการกำลังเปิดรับ`;
    grid.innerHTML = matching.length
      ? matching.map(offerCard).join("")
      : `<div class="free-games-empty"><i data-lucide="radar"></i><h2>ยังไม่พบข้อเสนอที่กำลังรับได้</h2><p>เปิดหน้าทางการของแพลตฟอร์มเพื่อดูเกมเล่นฟรีและข่าวล่าสุด</p></div>`;
    bindImageFallbacks(grid);
    if (window.lucide) window.lucide.createIcons();
    renderHomeOffers();
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
    document.querySelectorAll("[data-free-upcoming-countdown]").forEach((element) => {
      const offer = state.upcomingOffers.find((item) => item.id === element.dataset.freeUpcomingCountdown);
      if (offer) element.textContent = upcomingTiming(offer);
    });
    document.querySelectorAll("[data-free-home-upcoming-countdown]").forEach((element) => {
      const offer = state.upcomingOffers.find((item) => item.id === element.dataset.freeHomeUpcomingCountdown);
      if (offer) element.textContent = upcomingTiming(offer);
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
          const slug = item.productSlug || item.catalogNs?.mappings?.find((mapping) => mapping.pageType === "productHome")?.pageSlug || item.urlSlug;
          return { id: `epic-${item.id}`, title: item.title, platform: "epic", platformLabel: "Epic Games", type: "keep", typeLabel: "รับเข้าคลังฟรี", startsAt: promotion.startDate, endsAt: promotion.endDate, url: slug ? `https://store.epicgames.com/en-US/p/${slug}` : "https://store.epicgames.com/free-games", sourceUrl: "https://store.epicgames.com/free-games", image: asset.url, summary: item.description || "กดรับเข้าคลังผ่านบัญชี Epic Games ก่อนหมดเวลา" };
        });
      });
      if (offers.length) {
        state.offers = [...state.offers.filter((offer) => offer.platform !== "epic"), ...offers];
        renderOffers();
      }

      const upcomingOffers = elements.flatMap((item) => {
        const promotions = item.promotions?.upcomingPromotionalOffers || [];
        return promotions.flatMap((group) => group.promotionalOffers || []).filter((promotion) => promotion.discountSetting?.discountPercentage === 0 && new Date(promotion.startDate).getTime() > now).map((promotion) => {
          const asset = (item.keyImages || []).find((image) => image.type === "OfferImageTall") || (item.keyImages || []).find((image) => image.type === "DieselStoreFrontWide") || {};
          const slug = item.productSlug || item.catalogNs?.mappings?.find((mapping) => mapping.pageType === "productHome")?.pageSlug || item.urlSlug;
          return { id: `epic-upcoming-${item.id}`, title: item.title, platform: "epic", platformLabel: "Epic Games", type: "keep", typeLabel: "รับเข้าคลังฟรี", startsAt: promotion.startDate, endsAt: promotion.endDate, url: slug ? `https://store.epicgames.com/en-US/p/${slug}` : "https://store.epicgames.com/free-games", sourceUrl: "https://store.epicgames.com/free-games", image: asset.url, summary: item.description || "Epic Games ประกาศช่วงเวลาแจกเกมล่วงหน้า" };
        });
      });
      if (upcomingOffers.length) state.upcomingOffers = [...state.upcomingOffers.filter((offer) => offer.platform !== "epic"), ...upcomingOffers];
      renderUpcomingOffers();
    } catch (_) {
      // The official page cards remain usable when a browser or region blocks the feed.
    }
  }

  document.addEventListener("DOMContentLoaded", () => {
    renderPlatforms();
    setLastChecked();
    setFilter("all");
    renderHomeOffers();
    renderUpcomingOffers();
    document.querySelectorAll("[data-free-game-filter]").forEach((button) => button.addEventListener("click", () => setFilter(button.dataset.freeGameFilter || "all")));
    refreshEpicOffers();
    window.setInterval(updateCountdowns, 30000);
  });
})();
