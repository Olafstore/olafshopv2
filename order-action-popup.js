(function () {
  let root = null;
  let closeTimer = 0;
  let resolveConfirmation = null;

  function ensureRoot() {
    if (root?.isConnected) return root;

    root = document.createElement("div");
    root.className = "order-action-popup";
    root.hidden = true;
    root.innerHTML = `
      <div class="order-action-popup__backdrop"></div>
      <section class="order-action-popup__card" role="status" aria-live="polite" aria-atomic="true">
        <div class="order-action-popup__visual" aria-hidden="true">
          <span class="order-action-popup__ring"></span>
          <span class="order-action-popup__icon"></span>
        </div>
        <div class="order-action-popup__eyebrow">OLAF SHOP SECURE ORDER</div>
        <h2 class="order-action-popup__title"></h2>
        <p class="order-action-popup__message"></p>
        <div class="order-action-popup__progress" aria-hidden="true">
          <span></span><span></span><span></span>
        </div>
        <div class="order-action-popup__actions" hidden>
          <button class="order-action-popup__button is-secondary" type="button" data-order-popup-cancel>กลับ</button>
          <button class="order-action-popup__button is-danger" type="button" data-order-popup-confirm>ยืนยันยกเลิก</button>
        </div>
      </section>
    `;
    document.body.appendChild(root);

    root.querySelector("[data-order-popup-cancel]")?.addEventListener("click", () => finishConfirmation(false));
    root.querySelector("[data-order-popup-confirm]")?.addEventListener("click", () => finishConfirmation(true));
    root.querySelector(".order-action-popup__backdrop")?.addEventListener("click", () => {
      if (root?.dataset.mode === "confirm") finishConfirmation(false);
    });
    document.addEventListener("keydown", (event) => {
      if (event.key === "Escape" && root?.dataset.mode === "confirm" && !root.hidden) {
        finishConfirmation(false);
      }
    });
    return root;
  }

  function iconFor(state) {
    if (state === "success") return "✓";
    if (state === "error") return "!";
    if (state === "confirm" || state === "cancel") return "×";
    return "";
  }

  function render(options = {}) {
    const element = ensureRoot();
    window.clearTimeout(closeTimer);
    element.dataset.state = options.state || "loading";
    element.dataset.mode = options.mode || "status";
    element.querySelector(".order-action-popup__title").textContent = options.title || "";
    element.querySelector(".order-action-popup__message").textContent = options.message || "";
    element.querySelector(".order-action-popup__icon").textContent = iconFor(options.state);
    element.querySelector(".order-action-popup__actions").hidden = options.mode !== "confirm";
    element.querySelector(".order-action-popup__progress").hidden =
      !["loading", "cancel"].includes(options.state);
    element.querySelector(".order-action-popup__card").setAttribute(
      "role",
      options.mode === "confirm" ? "alertdialog" : "status"
    );
    element.hidden = false;
    document.documentElement.classList.add("has-order-action-popup");
    window.requestAnimationFrame(() => element.classList.add("is-visible"));
  }

  function hide(delay = 0) {
    window.clearTimeout(closeTimer);
    closeTimer = window.setTimeout(() => {
      if (!root) return;
      root.classList.remove("is-visible");
      window.setTimeout(() => {
        if (!root?.classList.contains("is-visible")) root.hidden = true;
        document.documentElement.classList.remove("has-order-action-popup");
      }, 280);
    }, Math.max(0, Number(delay || 0)));
  }

  function finishConfirmation(result) {
    const resolve = resolveConfirmation;
    resolveConfirmation = null;
    hide();
    resolve?.(result);
  }

  function confirmCancel(options = {}) {
    if (resolveConfirmation) finishConfirmation(false);
    render({
      mode: "confirm",
      state: "confirm",
      title: options.title || "ยกเลิกคำสั่งซื้อ?",
      message:
        options.message ||
        "ยืนยันการยกเลิกออเดอร์ ระบบจะคืนสต็อกที่จองไว้โดยอัตโนมัติ"
    });
    return new Promise((resolve) => {
      resolveConfirmation = resolve;
    });
  }

  window.OlafOrderActivity = {
    showSlipCheck() {
      render({
        state: "loading",
        title: "กรุณารอระบบตรวจสลิป",
        message: "กำลังตรวจสอบ QR ยอดชำระ ผู้รับเงิน และยืนยันออเดอร์ของคุณ"
      });
    },
    showCancel() {
      render({
        state: "cancel",
        title: "กำลังยกเลิกออเดอร์",
        message: "กรุณารอสักครู่ ระบบกำลังคืนสต็อกและอัปเดตประวัติคำสั่งซื้อ"
      });
    },
    success(title, message, delay = 900) {
      render({
        state: "success",
        title: title || "ดำเนินการสำเร็จ",
        message: message || "ระบบอัปเดตคำสั่งซื้อเรียบร้อยแล้ว"
      });
      hide(delay);
    },
    error(title, message, delay = 1400) {
      render({
        state: "error",
        title: title || "ดำเนินการไม่สำเร็จ",
        message: message || "กรุณาลองใหม่อีกครั้ง"
      });
      hide(delay);
    },
    confirmCancel,
    hide
  };
})();
