(function () {
  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => Array.from(root.querySelectorAll(selector));
  const money = (value) => `฿${Number(value || 0).toLocaleString("th-TH", { maximumFractionDigits: 0 })}`;
  const point = (value) => Number(value || 0).toLocaleString("th-TH", { maximumFractionDigits: 0 });
  const clean = (value) => window.OlafText?.clean?.(value) || String(value || "");

  const PREMIUM_TITLE = "Premium Spin 1 Point";
  const PREMIUM_SUBTITLE = "ใช้ 1 Point ต่อการสุ่ม 1 ครั้ง ลุ้นรับเกมเข้าคลังทันที Point สะสม หรือรางวัลเกลือแบบไม่จำกัดต่อวัน";

  const state = {
    config: { settings: { isActive: true, spinCostPoints: 1 }, slots: [] },
    status: { spinsUsedToday: 0, spinCostPoints: 1, unlimited: true },
    milestoneStatus: { totalSpins: 0, milestones: [] },
    pointBalance: 0,
    spinning: false,
    user: null
  };

  function escapeHtml(value = "") {
    return String(value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  function spinCost() {
    return Math.max(1, Number(state.status.spinCostPoints || state.config.settings.spinCostPoints || 1));
  }

  function premiumTitle(value) {
    const title = clean(value || "");
    if (!title || /free|ฟรี/i.test(title)) return PREMIUM_TITLE;
    return title;
  }

  function premiumSubtitle(value) {
    const subtitle = clean(value || "");
    if (!subtitle || /free|ฟรี|วันละ\s*5|จำกัดวันละ|จำนวนครั้งต่อวัน|รีเซ็ตสิทธิ์/i.test(subtitle)) return PREMIUM_SUBTITLE;
    return subtitle;
  }

  function prizeImage(slot) {
    return slot.imageUrl || "assets/placeholder.svg";
  }

  function availableSlots() {
    return state.config.slots.filter((slot) => {
      if (!slot.isActive) return false;
      const prizeType = slot.prizeType || "product";
      if (prizeType === "empty") return true;
      if (prizeType === "points") return Number(slot.pointAmount || 0) > 0;
      return slot.productId && slot.productIsActive && slot.stock > 0;
    });
  }

  function slotKind(slot) {
    return slot.prizeType || "product";
  }

  function slotIcon(slot) {
    const kind = slotKind(slot);
    if (kind === "points") return "coins";
    if (kind === "empty") return "circle-slash";
    return "gamepad-2";
  }

  function slotVisualHtml(slot) {
    const kind = slotKind(slot);
    if (kind === "points") {
      return `
        <div class="free-random-card-symbol is-points">
          <i data-lucide="coins"></i>
          <strong>${point(slot.pointAmount)}</strong>
          <span>POINT</span>
        </div>
      `;
    }
    if (kind === "empty") {
      return `
        <div class="free-random-card-symbol is-empty">
          <i data-lucide="circle-slash"></i>
          <strong>เกลือ</strong>
          <span>ลองใหม่รอบหน้า</span>
        </div>
      `;
    }
    return `
      <div class="free-random-card-image">
        <img src="${escapeHtml(prizeImage(slot))}" alt="${escapeHtml(clean(slot.label || slot.productName || "รางวัล"))}" loading="lazy" decoding="async" />
      </div>
    `;
  }

  function slotMeta(slot) {
    const kind = slotKind(slot);
    if (kind === "points") return `${point(slot.pointAmount)} Point · เข้า Wallet ทันที`;
    if (kind === "empty") return "ไม่ได้รับเกมหรือ Point";
    return `${clean(slot.category || "สินค้า")} · ${money(slot.price)}`;
  }

  function slotName(slot) {
    const kind = slotKind(slot);
    if (slot.label) return clean(slot.label);
    if (kind === "points") return `${point(slot.pointAmount)} Point`;
    if (kind === "empty") return "เกลือ";
    return clean(slot.productName || `ช่องที่ ${slot.slotNumber}`);
  }

  function cardHtml(slot, compact = false) {
    const name = slotName(slot);
    const kind = slotKind(slot);
    return `
      <article class="free-random-card is-${escapeHtml(kind)}${compact ? " is-compact" : ""}" data-slot-number="${slot.slotNumber}">
        <span class="free-random-card-chip"><i data-lucide="${slotIcon(slot)}"></i>${Number(slot.chancePercent || 0).toLocaleString("th-TH", { maximumFractionDigits: 2 })}%</span>
        ${slotVisualHtml(slot)}
        <div class="free-random-card-body">
          <span>ช่อง ${slot.slotNumber}</span>
          <h3>${escapeHtml(name)}</h3>
          <p>${escapeHtml(slotMeta(slot))}</p>
        </div>
      </article>
    `;
  }

  function renderTrack() {
    const track = $("#free-random-track");
    if (!track) return;
    const slots = state.config.slots.length ? state.config.slots : Array.from({ length: 10 }, (_, index) => ({
      slotNumber: index + 1,
      label: "รอตั้งค่ารางวัล",
      chancePercent: 0,
      stock: 0
    }));
    track.style.transition = "none";
    track.style.transform = "translate3d(0,0,0)";
    track.innerHTML = slots.map((slot) => cardHtml(slot, true)).join("");
    window.lucide?.createIcons?.();
  }

  function renderPrizeGrid() {
    const grid = $("#free-random-prizes");
    if (!grid) return;
    grid.innerHTML = state.config.slots.length
      ? state.config.slots.map((slot) => cardHtml(slot)).join("")
      : `<div class="free-random-empty">ยังไม่ได้ตั้งค่าของรางวัล</div>`;
    window.lucide?.createIcons?.();
  }

  function milestoneTitle(milestone) {
    return clean(milestone.label || milestone.productName || `โบนัสครบ ${point(milestone.threshold)} ครั้ง`);
  }

  function milestoneImage(milestone) {
    return milestone.imageUrl || "assets/placeholder.svg";
  }

  function renderMilestones() {
    const wrap = $("#free-random-milestones");
    const grid = $("#free-random-milestone-grid");
    if (!wrap || !grid) return;
    const totalSpins = Number(state.milestoneStatus.totalSpins ?? state.status.totalSpins ?? state.status.spinsUsedToday ?? 0);
    const configured = Array.isArray(state.milestoneStatus.milestones) && state.milestoneStatus.milestones.length
      ? state.milestoneStatus.milestones
      : (state.config.milestones || []);
    const milestones = configured.filter((item) => Number(item.threshold || 0) > 0);
    if (!milestones.length) {
      wrap.hidden = false;
      grid.innerHTML = `<div class="free-random-milestone-empty">รอตั้งค่าโบนัสในหน้า Admin</div>`;
      return;
    }
    wrap.hidden = false;
    grid.innerHTML = milestones.map((milestone) => {
      const threshold = Math.max(1, Number(milestone.threshold || 0));
      const claimed = milestone.claimed === true;
      const progress = Math.max(0, Math.min(100, claimed ? 100 : (totalSpins / threshold) * 100));
      const remaining = Math.max(0, threshold - totalSpins);
      const title = milestoneTitle(milestone);
      const ready = totalSpins >= threshold;
      const configured = milestone.isActive !== false && milestone.productId && milestone.productIsActive !== false && Number(milestone.stock || 0) > 0;
      const claimable = Boolean(state.user && ready && configured && !claimed);
      const statusText = claimed
        ? "รับแล้ว"
        : !configured
          ? "รอตั้งค่า"
          : ready
            ? "พร้อมรับ"
            : `เหลือ ${point(remaining)}`;
      return `
        <article class="free-random-milestone-card ${claimed ? "is-claimed" : ""}">
          <div class="free-random-milestone-image">
            <img src="${escapeHtml(milestoneImage(milestone))}" alt="${escapeHtml(title)}" loading="lazy" decoding="async" />
          </div>
          <div class="free-random-milestone-body">
            <span class="free-random-milestone-kicker"><i data-lucide="${claimed ? "badge-check" : "flag"}"></i> ครบ ${point(threshold)} ครั้ง</span>
            <h3>${escapeHtml(title)}</h3>
            <p>${escapeHtml(statusText)}${!claimed && configured && !ready ? " ครั้ง" : ""}</p>
            <div class="free-random-milestone-progress" aria-label="progress ${Math.round(progress)}%">
              <i style="width:${progress}%"></i>
            </div>
            <button class="free-random-milestone-claim" type="button" data-claim-milestone="${threshold}" ${claimable ? "" : "disabled"}>
              <i data-lucide="${claimed ? "badge-check" : "gift"}"></i>
              <span>${claimed ? "รับแล้ว" : claimable ? "รับเกม" : ready ? "ยังไม่พร้อม" : "ยังไม่ครบ"}</span>
            </button>
          </div>
        </article>
      `;
    }).join("");
    grid.querySelectorAll("[data-claim-milestone]").forEach((button) => {
      button.addEventListener("click", () => claimMilestone(Number(button.dataset.claimMilestone || 0)));
    });
    window.lucide?.createIcons?.();
  }

  function renderStatus() {
    const settings = state.config.settings || {};
    const cost = spinCost();
    const spinsUsed = Number(state.milestoneStatus.totalSpins ?? state.status.totalSpins ?? state.status.spinsUsedToday ?? 0);
    const hasUser = Boolean(window.OlafStore?.currentUser?.() || state.user);
    const hasPrize = availableSlots().length > 0;
    const canAfford = Number(state.pointBalance || 0) >= cost;

    const title = $("#free-random-title");
    const subtitle = $("#free-random-subtitle");
    const spinsUsedEl = $("#free-random-spins-used");
    const pointBalanceEl = $("#free-random-point-balance");
    const spinCostEl = $("#free-random-spin-cost");
    const spinButton = $("#free-random-spin");

    if (title) title.textContent = premiumTitle(settings.title);
    if (subtitle) subtitle.textContent = premiumSubtitle(settings.subtitle);
    if (spinsUsedEl) spinsUsedEl.textContent = point(spinsUsed);
    if (pointBalanceEl) pointBalanceEl.textContent = point(state.pointBalance);
    if (spinCostEl) spinCostEl.textContent = point(cost);
    renderMilestones();

    if (spinButton) {
      const disabled = state.spinning
        || settings.isActive === false
        || !hasPrize
        || (hasUser && !canAfford);
      spinButton.disabled = disabled;
      spinButton.classList.toggle("is-poor", hasUser && !canAfford);
      spinButton.querySelector("span").textContent = state.spinning
        ? "กำลังสุ่ม..."
        : !hasUser
          ? "เข้าสู่ระบบเพื่อสุ่ม"
          : settings.isActive === false
            ? "ระบบสุ่มปิดอยู่"
            : !hasPrize
              ? "ยังไม่มีรางวัลพร้อมสุ่ม"
              : !canAfford
                  ? "Point ไม่พอ"
                  : `สุ่ม ${point(cost)} Point`;
    }
  }

  async function loadPointBalance() {
    if (!state.user || !window.OlafOrders?.fetchPointBalance) return;
    try {
      const wallet = await window.OlafOrders.fetchPointBalance();
      state.pointBalance = Number(wallet?.balance || 0);
      document.querySelectorAll("[data-topbar-point-balance], [data-free-auth-points]").forEach((item) => {
        item.textContent = `${point(state.pointBalance)} Points`;
      });
    } catch (error) {
      console.warn("Unable to load random point balance", error);
    }
  }

  async function loadMilestoneStatus() {
    try {
      if (state.user && window.OlafFreeRandom?.fetchMilestoneStatus) {
        state.milestoneStatus = await window.OlafFreeRandom.fetchMilestoneStatus();
      } else if (window.OlafFreeRandom?.fetchMilestones) {
        const milestones = await window.OlafFreeRandom.fetchMilestones();
        state.milestoneStatus = { totalSpins: 0, milestones };
      } else {
        state.milestoneStatus = {
          totalSpins: Number(state.status.totalSpins ?? state.status.spinsUsedToday ?? 0),
          milestones: state.config.milestones || []
        };
      }
    } catch (error) {
      state.milestoneStatus = {
        totalSpins: Number(state.status.totalSpins ?? state.status.spinsUsedToday ?? 0),
        milestones: state.config.milestones || []
      };
    }
    renderMilestones();
  }

  function closeResult() {
    const panel = $("#free-random-result");
    if (!panel || panel.hidden) return;
    panel.classList.add("is-closing");
    document.body.classList.remove("free-random-result-open");
    window.setTimeout(() => {
      panel.hidden = true;
      panel.innerHTML = "";
      panel.className = "free-random-result";
    }, 190);
  }

  function showResult(result) {
    const panel = $("#free-random-result");
    if (!panel) return;
    const product = result.product || {};
    const prizeType = result.claim?.prizeType || result.slot?.prizeType || "product";
    const pointAmount = Number(result.pointCredit?.amount || result.claim?.pointAmount || result.slot?.pointAmount || 0);
    const spent = Number(result.pointDebit?.amount || result.spinCostPoints || spinCost() || 1);
    const name = prizeType === "points"
      ? `${pointAmount.toLocaleString("th-TH")} Point`
      : prizeType === "empty"
        ? "เกลือ!"
        : clean(product.name || result.slot?.label || "รางวัลของคุณ");
    const imageHtml = prizeType === "points"
      ? `<div class="free-random-result-symbol is-points"><i data-lucide="coins"></i><strong>${point(pointAmount)}</strong><span>POINT</span></div>`
      : prizeType === "empty"
        ? `<div class="free-random-result-symbol is-empty"><i data-lucide="circle-slash"></i><strong>เกลือ</strong><span>รอบนี้ยังไม่มา</span></div>`
        : `<div class="free-random-result-image"><img src="${escapeHtml(product.imageUrl || result.slot?.imageUrl || "assets/placeholder.svg")}" alt="${escapeHtml(name)}" /></div>`;
    const detail = prizeType === "points"
      ? `ใช้ ${point(spent)} Point และได้รับ ${point(pointAmount)} Point เข้าบัญชีทันที`
      : prizeType === "empty"
        ? `ใช้ ${point(spent)} Point แล้ว รอบนี้ยังไม่ได้เกมหรือ Point ถ้ายังเหลือสิทธิ์สามารถลุ้นต่อได้`
        : `ใช้ ${point(spent)} Point ระบบสร้างออเดอร์รางวัลให้แล้ว ${result.order?.status === "delivered" ? "และจัดส่งเข้าคลังเรียบร้อย" : "รอแอดมินจัดส่งตามประเภทสินค้า"}`;

    panel.hidden = false;
    panel.className = `free-random-result is-open is-${escapeHtml(prizeType)}`;
    document.body.classList.add("free-random-result-open");
    panel.innerHTML = `
      <div class="free-random-result-card is-${escapeHtml(prizeType)}">
        ${imageHtml}
        <div>
          <span class="eyebrow"><i data-lucide="${prizeType === "empty" ? "circle-slash" : "trophy"}"></i> ${prizeType === "empty" ? "TRY AGAIN" : "YOU WON"}</span>
          <h2>${escapeHtml(name)}</h2>
          <p>${escapeHtml(detail)}</p>
          <div class="free-random-result-actions">
            ${prizeType === "product" ? `<a class="primary-button" href="profile.html#inventory"><i data-lucide="archive"></i> เปิดคลังสินค้า</a>` : ""}
            ${prizeType === "points" ? `<a class="primary-button" href="profile.html#info"><i data-lucide="coins"></i> เช็ค Point</a>` : ""}
            ${prizeType === "empty" ? `<button class="primary-button" type="button" data-spin-again><i data-lucide="rotate-cw"></i> สุ่มอีกครั้ง</button>` : ""}
            ${result.order?.id ? `<a class="ghost-button free-random-order-button" href="profile.html?order=${encodeURIComponent(result.order.id)}#orders"><i data-lucide="clipboard-list"></i><span>ดูออเดอร์</span></a>` : ""}
          </div>
        </div>
      </div>
    `;
    const resultCard = panel.querySelector(".free-random-result-card");
    panel.insertAdjacentHTML("afterbegin", `<div class="free-random-result-backdrop" data-result-close></div>`);
    resultCard?.classList.add("free-random-result-dialog");
    resultCard?.setAttribute("role", "dialog");
    resultCard?.setAttribute("aria-modal", "true");
    resultCard?.insertAdjacentHTML("afterbegin", `
      <button class="free-random-result-close" type="button" data-result-close aria-label="ปิดผลการสุ่ม">
        <i data-lucide="x"></i>
      </button>
      <span class="free-random-result-glow" aria-hidden="true"></span>
      <span class="free-random-result-shine" aria-hidden="true"></span>
      <div class="free-random-result-sparks" aria-hidden="true"><i></i><i></i><i></i><i></i><i></i></div>
    `);
    panel.querySelectorAll("[data-result-close]").forEach((item) => item.addEventListener("click", closeResult));
    panel.querySelector("[data-spin-again]")?.addEventListener("click", () => {
      closeResult();
      window.setTimeout(handleSpin, 210);
    });
    window.lucide?.createIcons?.();
    window.setTimeout(() => panel.querySelector(".free-random-result-close")?.focus?.(), 80);
  }

  function showResultPopup(result) {
    const panel = $("#free-random-result");
    if (!panel) return;
    const product = result.product || {};
    const prizeType = result.claim?.prizeType || result.slot?.prizeType || "product";
    const pointAmount = Number(result.pointCredit?.amount || result.claim?.pointAmount || result.slot?.pointAmount || 0);
    const spent = Number(result.pointDebit?.amount || result.spinCostPoints || spinCost() || 1);
    const name = prizeType === "points"
      ? `${point(pointAmount)} Point`
      : prizeType === "empty"
        ? "เกลือ!"
        : clean(product.name || result.slot?.label || "รางวัลของคุณ");
    const imageHtml = prizeType === "points"
      ? `<div class="free-random-result-symbol is-points"><i data-lucide="coins"></i><strong>${point(pointAmount)}</strong><span>POINT</span></div>`
      : prizeType === "empty"
        ? `<div class="free-random-result-symbol is-empty"><i data-lucide="circle-slash"></i><strong>เกลือ</strong><span>รอบนี้ยังไม่มา</span></div>`
        : `<div class="free-random-result-image"><img src="${escapeHtml(product.imageUrl || result.slot?.imageUrl || "assets/placeholder.svg")}" alt="${escapeHtml(name)}" /></div>`;
    const detail = prizeType === "points"
      ? `ใช้ ${point(spent)} Point และได้รับ ${point(pointAmount)} Point เข้าบัญชีทันที`
      : prizeType === "empty"
        ? `ใช้ ${point(spent)} Point แล้ว รอบนี้ยังไม่ได้เกมหรือ Point ลองสุ่มต่อได้ถ้ายังมี Point`
        : `ใช้ ${point(spent)} Point ระบบสร้างออเดอร์รางวัลให้แล้ว ${result.order?.status === "delivered" ? "และจัดส่งเข้าคลังเรียบร้อย" : "รอแอดมินจัดส่งตามประเภทสินค้า"}`;
    const milestone = result.milestoneReward || null;
    const milestoneProduct = milestone?.product || {};
    const milestoneHtml = milestone && milestoneProduct.name ? `
      <div class="free-random-milestone-win">
        <div class="free-random-milestone-win-image">
          <img src="${escapeHtml(milestoneProduct.imageUrl || "assets/placeholder.svg")}" alt="${escapeHtml(clean(milestoneProduct.name))}" />
        </div>
        <div>
          <span><i data-lucide="gift"></i> โบนัสครบ ${point(milestone.threshold)} ครั้ง</span>
          <strong>${escapeHtml(clean(milestoneProduct.name))}</strong>
          <p>ระบบสร้างออเดอร์เกมฟรีให้เรียบร้อยแล้ว</p>
        </div>
      </div>
    ` : "";

    panel.hidden = false;
    panel.className = `free-random-result is-open is-${escapeHtml(prizeType)}`;
    document.body.classList.add("free-random-result-open");
    panel.innerHTML = `
      <div class="free-random-result-backdrop" data-result-close></div>
      <div class="free-random-result-card free-random-result-dialog is-${escapeHtml(prizeType)}" role="dialog" aria-modal="true">
        <button class="free-random-result-close" type="button" data-result-close aria-label="ปิดผลการสุ่ม">
          <i data-lucide="x"></i>
        </button>
        <span class="free-random-result-glow" aria-hidden="true"></span>
        ${imageHtml}
        <div>
          <span class="eyebrow"><i data-lucide="${prizeType === "empty" ? "circle-slash" : "trophy"}"></i> ${prizeType === "empty" ? "TRY AGAIN" : "YOU WON"}</span>
          <h2>${escapeHtml(name)}</h2>
          <p>${escapeHtml(detail)}</p>
          ${milestoneHtml}
          <div class="free-random-result-actions">
            <button class="primary-button free-random-spin-again" type="button" data-spin-again><i data-lucide="refresh-cw"></i><span>สุ่มอีกครั้ง</span></button>
            ${prizeType === "product" ? `<a class="primary-button" href="profile.html#inventory"><i data-lucide="archive"></i><span>เปิดคลังสินค้า</span></a>` : ""}
            ${prizeType === "points" ? `<a class="primary-button" href="profile.html#info"><i data-lucide="coins"></i><span>เช็ค Point</span></a>` : ""}
            ${milestone?.order?.id ? `<a class="ghost-button free-random-order-button" href="profile.html?order=${encodeURIComponent(milestone.order.id)}#orders"><i data-lucide="gift"></i><span>โบนัสฟรี</span></a>` : ""}
            ${result.order?.id ? `<a class="ghost-button free-random-order-button" href="profile.html?order=${encodeURIComponent(result.order.id)}#orders"><i data-lucide="clipboard-list"></i><span>ดูออเดอร์</span></a>` : ""}
          </div>
        </div>
      </div>
    `;
    panel.querySelectorAll("[data-result-close]").forEach((item) => item.addEventListener("click", closeResult));
    panel.querySelector("[data-spin-again]")?.addEventListener("click", () => {
      closeResult();
      window.setTimeout(handleSpin, 210);
    });
    window.lucide?.createIcons?.();
    window.setTimeout(() => panel.querySelector(".free-random-result-close")?.focus?.(), 80);
  }

  function showMilestoneClaimPopup(reward) {
    const product = reward?.product || {};
    showResultPopup({
      claim: { prizeType: "product" },
      product,
      order: reward?.order || null,
      slot: { label: product.name, imageUrl: product.imageUrl },
      spinCostPoints: 0,
      pointDebit: { amount: 0 },
      milestoneReward: {
        threshold: reward?.threshold || 0,
        product,
        order: reward?.order || null
      }
    });
  }

  async function claimMilestone(threshold) {
    if (!threshold || state.spinning) return;
    if (!(window.OlafStore?.currentUser?.() || state.user)) {
      window.location.href = `login.html?return=${encodeURIComponent("free-random.html")}`;
      return;
    }
    const button = document.querySelector(`[data-claim-milestone="${threshold}"]`);
    const original = button?.innerHTML || "";
    if (button) {
      button.disabled = true;
      button.innerHTML = '<i data-lucide="loader-circle"></i><span>กำลังรับ...</span>';
      window.lucide?.createIcons?.();
    }
    try {
      const reward = await window.OlafFreeRandom.claimMilestone(threshold);
      await refreshStatus();
      showMilestoneClaimPopup(reward);
    } catch (error) {
      console.error("Milestone claim failed", error);
      alert(errorMessage(error));
      await refreshStatus();
    } finally {
      if (button) {
        button.innerHTML = original;
        window.lucide?.createIcons?.();
      }
    }
  }

  async function refreshStatus() {
    try {
      state.user = window.OlafStore?.currentUser?.() || (await window.OlafSupabaseAuth?.getCurrentUser?.());
    } catch (error) {
      state.user = null;
    }

    renderAuthHeader();
    if (!state.user) {
      state.pointBalance = 0;
      state.status = {
        spinsUsedToday: 0,
        spinCostPoints: state.config.settings.spinCostPoints || 1,
        unlimited: true
      };
      renderStatus();
      await loadMilestoneStatus();
      return;
    }

    try {
      state.status = await window.OlafFreeRandom.fetchStatus();
      state.pointBalance = Number(state.status.pointBalance || state.pointBalance || 0);
    } catch (error) {
      console.warn("Unable to load premium spin status", error);
    }
    await loadPointBalance();
    await loadMilestoneStatus();
    renderStatus();
  }

  async function loadConfig() {
    try {
      state.config = await window.OlafFreeRandom.fetchConfig();
    } catch (error) {
      console.warn("Unable to load premium spin config", error);
      state.config = {
        settings: { isActive: false, spinCostPoints: 1, title: PREMIUM_TITLE, subtitle: "ยังไม่ได้ตั้งค่ารางวัล" },
        slots: []
      };
    }
    state.config.settings.spinCostPoints = Number(state.config.settings.spinCostPoints || 1);
    if (window.OlafFreeRandom?.fetchMilestones) {
      try {
        state.config.milestones = await window.OlafFreeRandom.fetchMilestones();
      } catch (error) {
        state.config.milestones = state.config.milestones || [];
      }
    }
    renderTrack();
    renderPrizeGrid();
    await refreshStatus();
    window.lucide?.createIcons?.();
  }

  function animateToWinner(result) {
    const track = $("#free-random-track");
    const winnerSlot = Number(result.slot?.slotNumber || result.claim?.slotNumber || 0);
    const baseSlots = state.config.slots.length ? state.config.slots : [];
    if (!track || !baseSlots.length || !winnerSlot) return Promise.resolve();

    const repeated = [];
    for (let loop = 0; loop < 7; loop += 1) repeated.push(...baseSlots);
    const winnerIndex = repeated.findIndex((slot, index) => index > baseSlots.length * 5 && Number(slot.slotNumber) === winnerSlot);
    track.style.transition = "none";
    track.style.transform = "translate3d(0,0,0)";
    track.innerHTML = repeated.map((slot) => cardHtml(slot, true)).join("");
    window.lucide?.createIcons?.();

    const cards = $$(".free-random-card", track);
    const targetCard = cards[winnerIndex >= 0 ? winnerIndex : cards.length - 1];
    if (!targetCard) return Promise.resolve();
    const viewport = $(".free-random-viewport");
    const viewportWidth = viewport?.clientWidth || 0;
    const left = targetCard.offsetLeft - viewportWidth / 2 + targetCard.offsetWidth / 2;
    return new Promise((resolve) => {
      requestAnimationFrame(() => {
        track.style.transition = "transform 4.6s cubic-bezier(.12,.82,.12,1)";
        track.style.transform = `translate3d(${-Math.max(left, 0)}px,0,0)`;
        window.setTimeout(resolve, 4800);
      });
    });
  }

  function errorMessage(error) {
    const message = String(error?.message || error || "");
    if (message.includes("AUTH_REQUIRED")) return "กรุณาเข้าสู่ระบบก่อนสุ่ม";
    if (message.includes("FREE_RANDOM_MILESTONE_NOT_READY")) return "ยังสุ่มไม่ครบจำนวนสำหรับรับโบนัสนี้";
    if (message.includes("FREE_RANDOM_MILESTONE_ALREADY_CLAIMED")) return "รับโบนัสนี้ไปแล้วในรอบนับปัจจุบัน";
    if (message.includes("FREE_RANDOM_MILESTONE_NOT_CONFIGURED")) return "โบนัสนี้ยังไม่ได้ตั้งค่าสินค้า หรือสต็อกหมด";
    if (message.includes("FREE_RANDOM_MILESTONE_REWARD_UNAVAILABLE")) return "สินค้าของโบนัสนี้หมดพอดี กรุณาแจ้งแอดมิน";
    if (message.includes("FREE_RANDOM_INSUFFICIENT_POINTS")) return "Point ไม่พอสำหรับสุ่มครั้งนี้";
    if (message.includes("FREE_RANDOM_NO_AVAILABLE_PRIZES")) return "ยังไม่มีรางวัลที่พร้อมแจก หรือสต็อกหมด";
    if (message.includes("INSUFFICIENT_STOCK")) return "ของรางวัลช่องนี้สต็อกหมดพอดี กรุณาลองใหม่อีกครั้ง";
    if (message.includes("FREE_RANDOM_DISABLED")) return "ระบบสุ่มปิดอยู่ชั่วคราว";
    return "สุ่มไม่สำเร็จ กรุณาลองใหม่อีกครั้ง";
  }

  function userName(user) {
    return clean(user?.displayName || user?.fullName || user?.username || user?.email?.split("@")[0] || "Member");
  }

  function userInitial(user) {
    return userName(user).trim().charAt(0).toUpperCase() || "U";
  }

  async function hydrateAuthPoint(popover) {
    const target = popover?.querySelector("[data-free-auth-points]");
    if (!target) return;
    await loadPointBalance();
    target.textContent = `${point(state.pointBalance)} Points`;
  }

  function renderAuthHeader() {
    const button = $("#open-auth");
    const label = $("#account-label");
    const popover = $("#user-popover");
    const register = $(".register-button");
    const user = window.OlafStore?.currentUser?.() || state.user || null;
    if (!button || !label) return;

    if (window.OlafNavigation?.ownsUserMenu) {
      button.onclick = null;
      if (register) register.style.display = user ? "none" : "inline-flex";
      window.OlafNavigation.refreshAccount?.();
      return;
    }

    button.classList.remove("is-auth-loading");
    button.removeAttribute("aria-busy");

    if (!user) {
      button.innerHTML = `<i data-lucide="log-in"></i><span id="account-label">เข้าสู่ระบบ</span>`;
      button.onclick = () => {
        window.location.href = `login.html?return=${encodeURIComponent("free-random.html")}`;
      };
      if (register) register.style.display = "inline-flex";
      if (popover) popover.hidden = true;
      window.lucide?.createIcons?.();
      return;
    }

    if (register) register.style.display = "none";
    button.innerHTML = `<span class="free-auth-avatar">${escapeHtml(userInitial(user))}</span><span id="account-label">${escapeHtml(userName(user))}</span>`;
    button.onclick = (event) => {
      event.stopPropagation();
      if (!popover) return;
      popover.hidden = !popover.hidden;
      if (!popover.hidden) {
        hydrateAuthPoint(popover);
        window.OlafNavigation?.positionTopbarPopover?.(popover, button);
      }
    };

    if (popover) {
      popover.innerHTML = `
        <div class="user-profile-card">
          <a class="user-popover-header user-popover-header-link" href="profile.html#info">
            <span class="user-popover-avatar">${escapeHtml(userInitial(user))}</span>
            <span class="user-popover-info">
              <strong>${escapeHtml(userName(user))}</strong>
              <span>${escapeHtml(user.email || "")}</span>
            </span>
          </a>
          <div class="user-popover-badge-row">
            <span class="user-badge-role">${escapeHtml(user.role || "member")}</span>
            <a class="user-badge-points" href="profile.html#info" data-free-auth-points data-topbar-point-balance>${point(state.pointBalance)} Points</a>
          </div>
        </div>
        <div class="user-popover-menu">
          <div class="user-popover-menu-title">เมนูบัญชี</div>
          ${user.role === "admin" ? '<a href="olaf-control.html"><i data-lucide="shield"></i><span>หลังบ้าน (Admin)</span></a>' : ""}
          <a href="profile.html#info"><i data-lucide="user"></i><span>ข้อมูลส่วนตัว</span></a>
          <a href="point-topup.html"><i data-lucide="coins"></i><span>เติม Point</span></a>
          <a href="profile.html#inventory"><i data-lucide="archive"></i><span>คลังสินค้า</span></a>
          <a href="profile.html#orders"><i data-lucide="receipt-text"></i><span>ประวัติคำสั่งซื้อ</span></a>
          <a href="free-random.html"><i data-lucide="dices"></i><span>สุ่มเกม 1 Point</span></a>
          <div class="user-popover-divider"></div>
          <button class="danger-item" type="button" data-free-auth-logout><i data-lucide="log-out"></i><span>ออกจากระบบ</span></button>
        </div>
      `;
      popover.querySelector("[data-free-auth-logout]")?.addEventListener("click", async () => {
        await window.OlafStore?.logout?.();
        state.user = null;
        state.pointBalance = 0;
        popover.hidden = true;
        window.OlafNavigation?.closeTopbarPopovers?.();
        renderAuthHeader();
        renderStatus();
      });
    }
    window.lucide?.createIcons?.();
  }

  function bindAuthHeader() {
    if (window.OlafNavigation?.ownsUserMenu) return;
    if (document.body.dataset.freeRandomAuthBound === "true") return;
    document.body.dataset.freeRandomAuthBound = "true";
    document.addEventListener("click", (event) => {
      const popover = $("#user-popover");
      if (!popover || popover.hidden) return;
      if (event.target.closest("#open-auth, #user-popover")) return;
      popover.hidden = true;
    });
    document.addEventListener("keydown", (event) => {
      if (event.key === "Escape") closeResult();
    });
  }

  async function handleSpin() {
    if (state.spinning) return;
    if (!(window.OlafStore?.currentUser?.() || state.user)) {
      window.location.href = `login.html?return=${encodeURIComponent("free-random.html")}`;
      return;
    }
    state.spinning = true;
    renderStatus();
    try {
      const result = await window.OlafFreeRandom.claimSpin();
      if (!result.milestoneReward && result.claim?.id && window.OlafFreeRandom?.fetchMilestoneForClaim) {
        try {
          result.milestoneReward = await window.OlafFreeRandom.fetchMilestoneForClaim(result.claim.id);
        } catch (error) {
          result.milestoneReward = null;
        }
      }
      state.status = {
        today: result.today,
        spinsUsedToday: result.spinsUsedToday,
        totalSpins: result.totalSpins ?? result.spinsUsedToday,
        spinCostPoints: result.spinCostPoints || spinCost(),
        pointBalance: result.pointBalance,
        unlimited: true
      };
      if (Number.isFinite(Number(result.pointBalance))) {
        state.pointBalance = Number(result.pointBalance);
      }
      await animateToWinner(result);
      showResultPopup(result);
      await loadConfig();
    } catch (error) {
      console.error("Premium spin failed", error);
      alert(errorMessage(error));
    } finally {
      state.spinning = false;
      renderStatus();
      $("#free-random-spin")?.blur();
    }
  }

  async function init() {
    await window.OlafStore?.ready?.catch?.(() => null);
    bindAuthHeader();
    renderAuthHeader();
    $("#free-random-spin")?.addEventListener("click", handleSpin);
    await loadConfig();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init, { once: true });
  } else {
    init();
  }
})();
