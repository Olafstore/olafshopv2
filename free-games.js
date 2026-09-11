(function () {
  "use strict";

  const data = window.OlafFreeGamesData || { offers: [], platforms: [] };
  const state = { filter: "all", offers: Array.isArray(data.offers) ? [...data.offers] : [], upcomingOffers: Array.isArray(data.upcomingOffers) ? [...data.upcomingOffers] : [] };
  let checking=false,lastAttempt=0,checkedAt=null,epicError=false,lastSignature='';
  const activeOffers=()=>[...new Map([...state.offers,...state.upcomingOffers].filter(isActive).map(o=>[o.id,o])).values()];
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
  const shortStartDate = (offer) => {
    const value = offer.startDateOnly ? `${offer.startsAt}T00:00:00Z` : offer.startsAt;
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "เร็ว ๆ นี้";
    return `เริ่ม ${new Intl.DateTimeFormat("th-TH", { day: "numeric", month: "short", ...(offer.startDateOnly ? { timeZone: "UTC" } : {}) }).format(date)}`;
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
  const isActive = (offer) => !offer.startDateOnly && (!offer.startsAt || new Date(offer.startsAt).getTime() <= Date.now()) && (!offer.endsAt || new Date(offer.endsAt).getTime() > Date.now());
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
          <a class="free-game-source" href="${escapeHtml(offer.sourceUrl || offer.url)}" target="_blank" rel="noopener noreferrer"><i data-lucide="badge-check"></i><span>ข่าวจาก ${escapeHtml(platform)}</span></a>
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
      <span class="home-free-game-art" data-fallback="${escapeHtml(platform.slice(0, 1))}">${getImage(offer)}<b>${escapeHtml(platform)}</b><em title="เริ่มรับ ${escapeHtml(startTime(offer))}"><span class="home-free-game-date-full">เริ่มรับ ${startTime(offer)}</span><span class="home-free-game-date-short">${shortStartDate(offer)}</span><i data-lucide="calendar-clock"></i></em></span>
      <span class="home-free-game-info"><strong title="${escapeHtml(offer.title)}">${escapeHtml(offer.title)}</strong><small>${escapeHtml(offer.typeLabel || "ข้อเสนอฟรี")} · <b data-free-home-upcoming-countdown="${escapeHtml(offer.id)}">${upcomingTiming(offer)}</b></small><small class="home-free-game-start-detail">เริ่มรับ ${startTime(offer)}</small></span>
    </a>`;
  }

  const homeScrollBindings = new WeakMap();

  function bindHomeOfferScroll(target) {
    const existing = homeScrollBindings.get(target);
    if (existing) { existing(); return; }
    const previous = document.getElementById("free-games-prev");
    const next = document.getElementById("free-games-next");
    const rail = target.parentElement;
    if (!previous || !next || !rail) return;

    const update = () => {
      // Measure without the buttons' reserved space to avoid a resize loop.
      const overflow = target.scrollWidth > rail.clientWidth + 1;
      rail.classList.toggle("has-overflow", overflow);
      previous.hidden = next.hidden = !overflow;
      previous.disabled = target.scrollLeft <= 1;
      next.disabled = target.scrollLeft >= target.scrollWidth - target.clientWidth - 1;
    };
    const move = (direction) => {
      target.scrollBy({
        left: direction * Math.max(1, target.clientWidth * .85),
        behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth"
      });
    };
    previous.addEventListener("click", () => move(-1));
    next.addEventListener("click", () => move(1));
    target.addEventListener("scroll", update, { passive: true });
    target.addEventListener("keydown", (event) => {
      if (event.target !== target || !["ArrowLeft", "ArrowRight"].includes(event.key)) return;
      event.preventDefault();
      move(event.key === "ArrowLeft" ? -1 : 1);
    });
    if (window.ResizeObserver) {
      const observer = new window.ResizeObserver(update);
      observer.observe(rail);
      observer.observe(target);
    } else {
      window.addEventListener("resize", update);
    }
    homeScrollBindings.set(target, update);
    update();
  }

  function renderHomeOffers() {
    const target = document.getElementById("index-free-games-list");
    if (!target) return;
    const currentOffers = activeOffers().sort((a,b)=>Number(b.platform==='epic')-Number(a.platform==='epic')).slice(0, 6);
    const upcomingOffers = state.upcomingOffers.filter(isUpcoming).sort((left, right) => new Date(left.startsAt) - new Date(right.startsAt)).slice(0, 4);
    const cards = [...currentOffers.map(homeOfferCard), ...upcomingOffers.map(homeUpcomingOfferCard)];
    target.innerHTML = cards.length ? cards.join("") : `<div class="home-free-games-empty"><i data-lucide="radar"></i><span>กำลังตรวจสอบเกมฟรีจากแพลตฟอร์มทางการ</span></div>`;
    bindImageFallbacks(target);
    bindHomeOfferScroll(target);
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
    const matching = activeOffers().filter((offer) => state.filter === "all" || offer.platform === state.filter);
    const liveCount = document.getElementById("free-games-live-count");
    if (liveCount) liveCount.textContent = `${activeOffers().length} รายการตามช่วงเวลาที่ประกาศ`;
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
      const offer = [...state.offers,...state.upcomingOffers].find((item) => item.id === element.dataset.freeGameCountdown);
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
    if (target) target.textContent = checkedAt ? `Epic: ยืนยันล่าสุด ${dateTime(checkedAt)} · ภูมิภาคไทย` : 'Epic: ยังไม่ได้ยืนยันข้อมูลสด';
    const status=document.getElementById('free-games-feed-status');
    if(status){status.dataset.state=checking?'loading':epicError?'error':'ready';status.textContent=checking?'กำลังตรวจข้อมูลกับ Epic Games…':epicError?'เชื่อมต่อ Epic ไม่สำเร็จ — รายการที่เห็นอาจเป็นข้อมูลเดิม โปรดตรวจหน้าทางการก่อนรับเกม':checkedAt?'เชื่อมต่อ Epic สำเร็จ · ตรวจอัตโนมัติทุก 1 นาทีขณะเปิดหน้านี้':'กำลังเตรียมตรวจข้อมูล Epic';}
    const curated=document.getElementById('free-games-curated-checked');if(curated)curated.textContent=`Steam / EA / Ubisoft: ข้อมูลข่าวที่รวบรวมไว้ ณ ${dateTime(data.updatedAt)} ไม่ใช่การตรวจสด`;
    const button=document.getElementById('free-games-refresh');if(button){button.disabled=checking;button.textContent=checking?'กำลังตรวจสอบ…':'ตรวจสอบอีกครั้ง';}
  }

  function setFilter(filter) {
    state.filter = filter;
    document.querySelectorAll("[data-free-game-filter]").forEach((button) => button.classList.toggle("is-active", button.dataset.freeGameFilter === filter));
    renderOffers();
  }

  async function refreshEpicOffers(force=false) {
    if(checking||(!force&&Date.now()-lastAttempt<10000))return;
    checking=true;lastAttempt=Date.now();setLastChecked();
    const controller=new AbortController();const timeout=setTimeout(()=>controller.abort(),12000);
    try {
      const response=await fetch('/api/free-games',{cache:'no-store',signal:controller.signal});
      if(!response.ok)throw new Error('EPIC_UNAVAILABLE');
      const result=await response.json();
      if(!Array.isArray(result.offers)||!Array.isArray(result.upcomingOffers)||!Number.isFinite(Date.parse(result.checkedAt)))throw new Error('INVALID_FEED');
      // An empty successful feed must clear old Epic offers, not leave stale games behind.
      state.offers=[...state.offers.filter(o=>o.platform!=='epic'),...result.offers];
      state.upcomingOffers=[...state.upcomingOffers.filter(o=>o.platform!=='epic'),...result.upcomingOffers];
      checkedAt=result.checkedAt;epicError=false;
    } catch { epicError=true; }
    finally { clearTimeout(timeout);checking=false;setLastChecked();renderOffers();renderUpcomingOffers(); }
  }

  function refreshTimeWindows(){
    const signature=JSON.stringify([activeOffers().map(o=>o.id),state.upcomingOffers.filter(isUpcoming).map(o=>o.id)]);
    if(signature!==lastSignature){lastSignature=signature;renderOffers();renderUpcomingOffers();}
    updateCountdowns();
  }

  document.addEventListener("DOMContentLoaded", () => {
    renderPlatforms();
    setLastChecked();
    setFilter("all");
    renderHomeOffers();
    renderUpcomingOffers();
    document.querySelectorAll("[data-free-game-filter]").forEach((button) => button.addEventListener("click", () => setFilter(button.dataset.freeGameFilter || "all")));
    document.getElementById('free-games-refresh')?.addEventListener('click',()=>refreshEpicOffers(true));
    refreshEpicOffers();
    window.setInterval(()=>{if(!document.hidden){refreshTimeWindows();refreshEpicOffers();}},60000);
    window.setInterval(()=>{if(!document.hidden)refreshTimeWindows();},10000);
    document.addEventListener('visibilitychange',()=>{if(!document.hidden){refreshTimeWindows();refreshEpicOffers();}});
    window.addEventListener('focus',()=>{refreshTimeWindows();refreshEpicOffers();});
  });
})();
