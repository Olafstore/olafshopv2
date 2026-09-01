(function () {
  const state = {
    user: null,
    settings: {},
    order: null,
    amount: 100,
    balance: 0,
    busy: false,
    slipInput: null
  };
  const dialogCloseTimers = new WeakMap();

  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => Array.from(root.querySelectorAll(selector));
  const clean = (value) => window.OlafText?.clean?.(value) ?? String(value || "").trim();

  const formatPrice = (value) =>
    new Intl.NumberFormat("th-TH", {
      style: "currency",
      currency: "THB",
      maximumFractionDigits: 0
    }).format(Number(value) || 0);

  const formatPoint = (value) =>
    new Intl.NumberFormat("th-TH", {
      maximumFractionDigits: 0
    }).format(Math.floor(Number(value) || 0));

  function formatCheckoutDateTime(value = null) {
    const date = value ? new Date(value) : new Date();
    if (Number.isNaN(date.getTime())) return "-";
    return new Intl.DateTimeFormat("th-TH", {
      dateStyle: "short",
      timeStyle: "medium"
    }).format(date);
  }

  function escapeHtml(value = "") {
    return String(value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  function createIcons() {
    window.lucide?.createIcons?.();
  }

  function withTimeout(promise, timeoutMs, fallback = null) {
    if (!promise || typeof promise.then !== "function") return Promise.resolve(fallback);
    let timer;
    return Promise.race([
      promise,
      new Promise((resolve) => {
        timer = window.setTimeout(() => resolve(fallback), timeoutMs);
      })
    ]).finally(() => window.clearTimeout(timer));
  }

  function showToast(message, type = "success", duration = 4200) {
    if (window.showToast) return window.showToast(message, type, duration);
    const toast = document.createElement("div");
    toast.className = `toast${type === "error" ? " toast-error" : ""}`;
    toast.innerHTML = `<i data-lucide="${type === "error" ? "alert-circle" : "check-circle"}"></i><span>${escapeHtml(message)}</span>`;
    document.body.appendChild(toast);
    createIcons();
    window.setTimeout(() => {
      toast.classList.add("is-leaving");
      window.setTimeout(() => toast.remove(), 300);
    }, duration);
  }

  function setStatus(message, type = "info", icon = "info") {
    const box = $("#point-topup-status");
    if (!box) return;
    box.className = `point-topup-status is-${type}`;
    box.innerHTML = `<i data-lucide="${icon}"></i><span>${escapeHtml(message)}</span>`;
    createIcons();
  }

  function setButtonBusy(button, active, label = "กำลังดำเนินการ...") {
    if (!button) return;
    button.disabled = active;
    if (active) {
      button.dataset.originalHtml ||= button.innerHTML;
      button.innerHTML = `<i data-lucide="loader-circle"></i><span>${escapeHtml(label)}</span>`;
    } else if (button.dataset.originalHtml) {
      button.innerHTML = button.dataset.originalHtml;
      delete button.dataset.originalHtml;
    }
    createIcons();
  }

  function setBusy(active, label = "กำลังดำเนินการ...") {
    state.busy = active;
    setButtonBusy($(".point-topup-submit"), active, label);
    renderAuthState();
  }

  function currentPaymentMethod() {
    return String($("input[name='paymentMethod']:checked")?.value || "promptpay").toLowerCase() === "wallet"
      ? "wallet"
      : "promptpay";
  }

  function normalizePaymentMethod(value) {
    return String(value || "").toLowerCase() === "wallet" ? "wallet" : "promptpay";
  }

  function paymentLabel(method = currentPaymentMethod()) {
    return method === "wallet" ? "TrueMoney Wallet" : "QR พร้อมเพย์";
  }

  function paymentIcon(method = currentPaymentMethod()) {
    return method === "wallet" ? "wallet" : "qr-code";
  }

  function storePayment() {
    return state.settings?.payment || state.settings?.payment_config || {};
  }

  function paymentChannels() {
    return Array.isArray(state.settings?.paymentChannels)
      ? state.settings.paymentChannels
      : Array.isArray(state.settings?.payment_channels)
        ? state.settings.payment_channels
        : [];
  }

  function paymentChannelForMethod(method) {
    const wanted = method === "wallet" ? ["wallet", "truemoney", "true_money", "true-money"] : ["promptpay", "qr", "bank"];
    return paymentChannels().find((channel) => {
      if (channel?.isActive === false) return false;
      const keys = [
        channel?.method,
        channel?.paymentMethod,
        channel?.payment_method,
        channel?.type,
        channel?.channel,
        channel?.id
      ].map((value) => String(value || "").toLowerCase());
      return keys.some((key) => wanted.includes(key));
    }) || null;
  }

  function uniqueUrls(values = []) {
    return [...new Set(values.map((value) => clean(value)).filter(Boolean))];
  }

  function paymentUrlFields(source) {
    if (!source || typeof source !== "object") return [];
    return [
      source.qrUrl,
      source.qr_url,
      source.qrCodeUrl,
      source.qr_code_url,
      source.paymentQrUrl,
      source.payment_qr_url,
      source.imageUrl,
      source.image_url,
      source.publicUrl,
      source.public_url,
      source.signedUrl,
      source.signed_url,
      source.dataUrl,
      source.data_url
    ];
  }

  function createPromptPayUrl(amount) {
    const payment = storePayment();
    const promptPayId = clean(
      payment.promptPayId ||
      payment.promptpayId ||
      state.settings?.promptPayId ||
      ""
    ).replace(/[\s-]/g, "");
    if (!promptPayId) return "";
    return `https://promptpay.io/${encodeURIComponent(promptPayId)}/${Number(amount || 0).toFixed(2)}.png`;
  }

  function qrCandidatesForOrder(order = state.order) {
    const method = normalizePaymentMethod(order?.paymentMethod || order?.payment_method || currentPaymentMethod());
    const payment = storePayment();
    const channel = paymentChannelForMethod(method);
    const total = Number(order?.total || state.amount || 0);
    const orderQrMethod = order?.paymentQrMethod || order?.payment_qr_method;
    const orderUrls = orderQrMethod && normalizePaymentMethod(orderQrMethod) === method
      ? paymentUrlFields(order)
      : [];
    if (method === "wallet") {
      return uniqueUrls([
        ...orderUrls,
        ...paymentUrlFields(channel),
        payment.trueMoneyQrUrl,
        payment.true_money_qr_url,
        payment.walletQrUrl,
        payment.wallet_qr_url
      ]);
    }
    return uniqueUrls([
      ...orderUrls,
      ...paymentUrlFields(channel),
      payment.manualQrUrl,
      payment.manual_qr_url,
      payment.qrUrl,
      payment.qr_url,
      createPromptPayUrl(total)
    ]);
  }

  function selectedAmount() {
    const input = $("#point-topup-amount");
    const value = Math.round(Number(input?.value || state.amount || 0));
    return Math.max(1, Math.min(value, 50000));
  }

  function syncPreset(value) {
    state.amount = Number(value || selectedAmount());
    const input = $("#point-topup-amount");
    if (input) input.value = String(state.amount);
    $$("[data-topup-preset]").forEach((button) => {
      button.classList.toggle("is-active", Number(button.dataset.topupPreset) === state.amount);
    });
    renderAmountPreview();
  }

  function renderAmountPreview() {
    const preview = $("[data-topup-live-preview]");
    const points = $("[data-topup-preview-points]");
    const total = $("[data-topup-preview-total]");
    const amount = Math.max(1, Math.min(Math.round(Number(state.amount || selectedAmount())), 50000));
    if (points) points.textContent = `${formatPoint(amount)} Point`;
    if (total) total.textContent = formatPrice(amount);
    if (!preview) return;
    preview.classList.remove("is-updating");
    window.requestAnimationFrame(() => preview.classList.add("is-updating"));
    window.clearTimeout(preview._topupPreviewTimer);
    preview._topupPreviewTimer = window.setTimeout(() => preview.classList.remove("is-updating"), 260);
  }

  function renderBalance() {
    $$("[data-point-topup-balance], [data-topbar-point-balance]").forEach((item) => {
      item.textContent = item.hasAttribute("data-topbar-point-balance")
        ? `${formatPoint(state.balance)} Points`
        : formatPoint(state.balance);
    });
  }

  async function loadBalance() {
    if (!window.OlafOrders?.fetchPointBalance || !state.user) return;
    try {
      const wallet = await window.OlafOrders.fetchPointBalance();
      state.balance = Number(wallet?.balance || 0);
      renderBalance();
    } catch (error) {
      console.warn("Unable to load point balance", error);
    }
  }

  function renderAuthState() {
    const loginNote = $("[data-point-topup-login]");
    const submit = $(".point-topup-submit");
    if (loginNote) loginNote.hidden = Boolean(state.user);
    if (submit) submit.disabled = !state.user || state.busy;
  }

  function setDialogOpen(dialog, open = true) {
    if (!dialog) return;
    const pendingTimer = dialogCloseTimers.get(dialog);
    if (pendingTimer) {
      window.clearTimeout(pendingTimer);
      dialogCloseTimers.delete(dialog);
    }

    if (open) {
      document.querySelectorAll("dialog.olaf-checkout-v98[open]").forEach((openDialog) => {
        if (openDialog === dialog) return;
        openDialog.classList.remove("is-visible", "is-closing");
        openDialog.close();
      });
      dialog.classList.remove("is-closing");
      if (!dialog.open) dialog.showModal();
      window.requestAnimationFrame(() => {
        window.requestAnimationFrame(() => dialog.classList.add("is-visible"));
      });
      document.documentElement.classList.add("olaf-topup-dialog-open");
      document.body.classList.add("olaf-topup-dialog-open");
      return;
    }

    if (!dialog.open) return;
    dialog.classList.remove("is-visible");
    dialog.classList.add("is-closing");
    const timer = window.setTimeout(() => {
      if (dialog.open) dialog.close();
      dialog.classList.remove("is-closing");
      dialogCloseTimers.delete(dialog);
      const hasOpenTopupDialog = Boolean(document.querySelector("dialog.point-topup-qr-dialog[open]"));
      document.documentElement.classList.toggle("olaf-topup-dialog-open", hasOpenTopupDialog);
      document.body.classList.toggle("olaf-topup-dialog-open", hasOpenTopupDialog);
    }, 300);
    dialogCloseTimers.set(dialog, timer);
  }

  function setQrLoading(visible) {
    const loading = $("[data-topup-qr-loading]");
    if (!loading) return;
    loading.hidden = !visible;
    loading.style.display = visible ? "grid" : "none";
  }

  function setQrImage(visible) {
    const image = $("[data-topup-qr-image]");
    const frame = image?.closest(".qr-image-frame");
    if (!image) return;
    image.hidden = !visible;
    image.style.display = visible ? "block" : "none";
    frame?.classList.toggle("has-qr-image", Boolean(visible));
    if (visible) setQrLoading(false);
  }

  function setQrText(selector, text) {
    const node = $(selector);
    if (node) node.textContent = text;
  }

  function keepQrTransferActionsVisible(event) {
    const details = event.target?.closest?.(".qr-manual-transfer");
    if (!details?.open) return;
    const scroller = event.currentTarget?.querySelector?.(".qr-payment-content");
    if (!scroller) return;
    window.requestAnimationFrame(() => {
      window.requestAnimationFrame(() => {
        scroller.scrollTo({
          top: Math.max(0, scroller.scrollHeight - scroller.clientHeight),
          behavior: window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches ? "auto" : "smooth"
        });
      });
    });
  }

  function accountNoteHtml(method = currentPaymentMethod()) {
    const payment = storePayment();
    const rows = [];
    if (method === "wallet") {
      if (payment.walletName) rows.push(["ทรูมันนี่วอลเล็ท", payment.walletName]);
      if (payment.trueMoneyNumber) rows.push(["เบอร์วอลเล็ท", payment.trueMoneyNumber]);
    } else {
      if (payment.bankName) rows.push(["ธนาคาร", payment.bankName]);
      if (payment.bankAccountNumber) rows.push(["เลขบัญชี", payment.bankAccountNumber]);
      if (payment.bankAccountName) rows.push(["ชื่อบัญชี", payment.bankAccountName]);
    }

    let html = "";
    if (payment.paymentNote) {
      html += `<div class="qr-note-alert"><i data-lucide="info"></i> ${escapeHtml(clean(payment.paymentNote))}</div>`;
    }
    if (rows.length) {
      html += `
        <details class="qr-manual-transfer">
          <summary>สแกน QR ไม่ได้ใช่หรือไม่? กดเพื่อดูข้อมูลโอนเงิน</summary>
          <div class="qr-manual-transfer-body">
            <div class="qr-accounts-container">
              ${rows.map(([label, value]) => `
                <div class="qr-account-box">
                  <span class="bank-name">${escapeHtml(label)}</span>
                  <span class="acc-number">${escapeHtml(clean(value))}</span>
                </div>
              `).join("")}
            </div>
          </div>
        </details>
      `;
    }
    return html;
  }

  function openQrLoadingDialog(amount, method) {
    const dialog = $("#point-topup-qr-dialog");
    if (!dialog) return;
    state.order = null;
    dialog.dataset.paymentStage = "creating";
    $("[data-topup-qr-method]").innerHTML = `<i data-lucide="loader-circle"></i> กำลังเตรียม QR`;
    setQrText("[data-topup-qr-order]", "กำลังสร้างรายการ");
    setQrText("[data-topup-qr-total]", formatPrice(amount));
    setQrText("[data-topup-qr-total-display]", formatPrice(amount));
    setQrText("[data-topup-qr-credit]", `${formatPoint(amount)} P`);
    setQrText("[data-topup-qr-created-at]", formatCheckoutDateTime());
    $("[data-topup-qr-status]").innerHTML = `<i data-lucide="loader-circle"></i> กำลังสร้างรายการเติม Point`;
    const note = $("[data-topup-qr-note]");
    if (note) {
      note.hidden = true;
      note.innerHTML = "";
    }
    const unavailable = $("[data-topup-qr-unavailable]");
    if (unavailable) unavailable.hidden = true;
    const image = $("[data-topup-qr-image]");
    if (image) {
      setQrImage(false);
      image.removeAttribute("src");
      image.onload = null;
      image.onerror = null;
    }
    const loading = $("[data-topup-qr-loading]");
    if (loading) loading.textContent = `กำลังสร้างรายการเติม ${formatPoint(amount)} Point ผ่าน ${paymentLabel(method)}...`;
    setQrLoading(true);
    setDialogOpen(dialog, true);
    createIcons();
  }

  async function showPaymentDialog(order) {
    const dialog = $("#point-topup-qr-dialog");
    if (!dialog || !order) return;
    state.order = order;
    const method = normalizePaymentMethod(order.paymentMethod || order.payment_method || currentPaymentMethod());
    const total = Number(order.total || state.amount || 0);
    let qrUrls = qrCandidatesForOrder(order);
    if (!qrUrls.length && window.OlafStoreSettings?.fetchStoreSettings) {
      const refreshedSettings = await withTimeout(
        window.OlafStoreSettings.fetchStoreSettings().catch(() => ({})),
        8000,
        {}
      );
      if (refreshedSettings && typeof refreshedSettings === "object") {
        state.settings = {
          ...state.settings,
          ...refreshedSettings,
          payment: {
            ...(state.settings?.payment || {}),
            ...(refreshedSettings.payment || {})
          },
          paymentChannels: refreshedSettings.paymentChannels || state.settings?.paymentChannels || []
        };
        qrUrls = qrCandidatesForOrder(order);
      }
    }
    const qrUrl = qrUrls[0] || "";

    dialog.dataset.paymentStage = "qr";
    $("[data-topup-qr-method]").innerHTML = `<i data-lucide="${paymentIcon(method)}"></i> ${escapeHtml(paymentLabel(method))}`;
    setQrText("[data-topup-qr-order]", order.orderNumber || order.id || "#TOPUP");
    setQrText("[data-topup-qr-total]", formatPrice(total));
    setQrText("[data-topup-qr-total-display]", formatPrice(total));
    setQrText("[data-topup-qr-credit]", `${formatPoint(total)} P`);
    setQrText("[data-topup-qr-created-at]", formatCheckoutDateTime(order.createdAt || order.created_at));
    $("[data-topup-qr-status]").innerHTML = `<i data-lucide="clock"></i> รอการชำระเงิน`;

    const note = $("[data-topup-qr-note]");
    if (note) {
      note.innerHTML = accountNoteHtml(method);
      note.hidden = note.innerHTML.trim() === "";
    }

    const unavailable = $("[data-topup-qr-unavailable]");
    if (unavailable) unavailable.hidden = true;
    const image = $("[data-topup-qr-image]");
    setQrLoading(Boolean(qrUrl));
    if (image) {
      setQrImage(false);
      image.removeAttribute("src");
      image.onload = null;
      image.onerror = null;
      if (qrUrl) {
        let index = 1;
        image.onload = () => setQrImage(true);
        image.onerror = () => {
          const next = qrUrls[index];
          index += 1;
          if (next) {
            image.src = next;
            return;
          }
          setQrLoading(false);
          setQrImage(false);
          if (unavailable) unavailable.hidden = false;
        };
        image.loading = "eager";
        image.decoding = "async";
        image.fetchPriority = "high";
        image.src = qrUrl;
        if (image.complete && image.naturalWidth > 0) setQrImage(true);
      } else {
        setQrLoading(false);
        if (unavailable) unavailable.hidden = false;
      }
    }

    setDialogOpen(dialog, true);
    createIcons();
  }

  function topupErrorMessage(error) {
    const message = String(error?.code || error?.message || error || "");
    if (message.includes("AUTH_REQUIRED")) return "กรุณาเข้าสู่ระบบก่อนเติม Point";
    if (message.includes("INVALID_POINT_TOPUP_AMOUNT")) return "จำนวน Point ไม่ถูกต้อง กรุณากรอกขั้นต่ำ 1 Point";
    if (message.includes("SLIP_QR_SCANNER_NOT_READY")) return "ระบบอ่าน QR ยังโหลดไม่เสร็จ กรุณารอสักครู่แล้วลองใหม่";
    if (message.includes("SLIP_QR_NOT_FOUND")) return "ไม่พบ QR ในรูป กรุณาใช้ภาพสลิปต้นฉบับที่เห็น QR ชัดเจน";
    if (message.includes("INVALID_SLIP_QR")) return "QR ในรูปไม่ใช่ QR ตรวจสอบสลิปที่รองรับ";
    if (message.includes("DUPLICATE_SLIP")) return "สลิปนี้ถูกใช้ไปแล้ว กรุณาใช้สลิปใหม่";
    if (message.includes("PAYMENT_METHOD_MISMATCH")) return "สลิปไม่ตรงกับช่องทางชำระเงินที่เลือก";
    if (message.includes("RECEIVER_MISMATCH")) return "ข้อมูลผู้รับเงินในสลิปไม่ตรงกับบัญชีของร้าน";
    if (message.includes("PAYMENT_TIME_MISMATCH")) return "เวลาชำระเงินในสลิปไม่ตรงกับช่วงเวลาของรายการเติม Point";
    if (message.includes("PAYMENT_AMOUNT_INSUFFICIENT")) return "ยอดชำระไม่ตรงกับรายการเติม Point กรุณาตรวจสอบยอดและลองใหม่";
    if (message.includes("RDCW_QUOTA_EXCEEDED")) return "โควต้าตรวจสลิปหมดหรือแพ็กเกจหมดอายุ กรุณาติดต่อแอดมิน";
    if (message.includes("RDCW_TEMPORARY_ERROR") || message.includes("PAYMENT_VERIFY_API_UNREACHABLE")) {
      return "ระบบตรวจสลิปขัดข้องชั่วคราว สลิปถูกเก็บไว้ให้แอดมินตรวจสอบ";
    }
    return "เติม Point ไม่สำเร็จ กรุณาลองใหม่";
  }

  async function handleCreateOrder(event) {
    event.preventDefault();
    if (!state.user) {
      showToast("กรุณาเข้าสู่ระบบก่อนเติม Point", "error");
      renderAuthState();
      return;
    }
    if (!window.OlafOrders?.createPointTopupOrder) {
      showToast("ระบบเติม Point ยังไม่พร้อม กรุณารัน SQL ล่าสุดก่อน", "error");
      return;
    }

    const amount = selectedAmount();
    const method = currentPaymentMethod();
    try {
      setBusy(true, "กำลังสร้างรายการ...");
      state.amount = amount;
      openQrLoadingDialog(amount, method);
      const order = await window.OlafOrders.createPointTopupOrder({
        amount,
        paymentMethod: method,
        customerName: state.user.displayName || state.user.username || ""
      });
      state.order = order;
      await showPaymentDialog(order);
      setStatus("สร้างรายการเติม Point แล้ว กรุณาชำระเงินและแนบสลิปจากหน้าต่าง QR", "info", "qr-code");
      showToast("สร้างรายการเติม Point สำเร็จ", "success");
    } catch (error) {
      console.error("Create point top-up order failed", error);
      setDialogOpen($("#point-topup-qr-dialog"), false);
      const message = topupErrorMessage(error);
      setStatus(message, "error", "alert-circle");
      showToast(message, "error");
    } finally {
      setBusy(false);
    }
  }

  function ensureSlipInput() {
    if (state.slipInput) return state.slipInput;
    const input = document.createElement("input");
    input.type = "file";
    input.accept = "image/png,image/jpeg,image/webp";
    input.hidden = true;
    input.dataset.pointTopupSlipInput = "true";
    input.addEventListener("change", async (event) => {
      const file = event.currentTarget.files?.[0];
      event.currentTarget.value = "";
      if (file) await uploadTopupSlip(file);
    });
    document.body.append(input);
    state.slipInput = input;
    return input;
  }

  async function uploadTopupSlip(file) {
    if (!state.order?.id) {
      showToast("กรุณาสร้างรายการเติม Point ก่อนแนบสลิป", "error");
      return;
    }
    const uploadButton = $("[data-topup-qr-upload]");
    const status = $("[data-topup-qr-status]");
    try {
      setButtonBusy(uploadButton, true, "กำลังตรวจสลิป...");
      if (status) status.innerHTML = `<i data-lucide="loader-circle"></i> กำลังตรวจสลิป`;
      createIcons();
      window.OlafOrderActivity?.showSlipCheck?.();
      if (!window.OlafOrders?.uploadPaymentSlip) throw new Error("SLIP_UPLOAD_CLIENT_NOT_READY");
      const verifiedOrder = await window.OlafOrders.uploadPaymentSlip({
        orderId: state.order.id,
        file
      });
      state.order = verifiedOrder;
      await loadBalance();
      const credited = Number(
        verifiedOrder?.pointCreditAmount ||
        verifiedOrder?.verification?.pointCreditAmount ||
        state.amount ||
        0
      );
      window.OlafOrderActivity?.success?.(
        "เติม Point สำเร็จ",
        `ได้รับ ${formatPoint(credited)} Point เข้าบัญชีแล้ว`,
        800
      );
      setStatus(`เติม Point สำเร็จ ได้รับ ${formatPoint(credited)} Point เข้าบัญชีแล้ว`, "success", "badge-check");
      showToast(`เติม Point สำเร็จ +${formatPoint(credited)} Point`, "success", 5200);
      if (status) status.innerHTML = `<i data-lucide="badge-check"></i> เติม Point สำเร็จ`;
      createIcons();
      window.setTimeout(() => {
        setDialogOpen($("#point-topup-qr-dialog"), false);
      }, 900);
    } catch (error) {
      console.error("Point top-up slip upload failed", error);
      const message = topupErrorMessage(error);
      window.OlafOrderActivity?.error?.("ตรวจสลิปไม่สำเร็จ", message);
      setStatus(message, "error", "alert-circle");
      showToast(message, "error", 5200);
      if (status) status.innerHTML = `<i data-lucide="alert-circle"></i> ตรวจสลิปไม่สำเร็จ`;
      createIcons();
    } finally {
      setButtonBusy(uploadButton, false);
      renderAuthState();
    }
  }

  function bindEvents() {
    $("#point-topup-form")?.addEventListener("submit", handleCreateOrder);
    $$("[data-topup-preset]").forEach((button) => {
      button.addEventListener("click", () => syncPreset(button.dataset.topupPreset));
    });
    $("#point-topup-amount")?.addEventListener("input", () => syncPreset(selectedAmount()));
    $$("input[name='paymentMethod']").forEach((input) => {
      input.addEventListener("change", () => {
        if (state.order) showPaymentDialog(state.order);
      });
    });

    $("[data-topup-qr-close]")?.addEventListener("click", () => setDialogOpen($("#point-topup-qr-dialog"), false));
    $("[data-topup-qr-cancel]")?.addEventListener("click", () => setDialogOpen($("#point-topup-qr-dialog"), false));
    $("[data-topup-qr-profile]")?.addEventListener("click", () => {
      window.location.href = state.order?.id
        ? `profile.html?order=${encodeURIComponent(state.order.id)}#orders`
        : "profile.html#info";
    });
    $("[data-topup-qr-upload]")?.addEventListener("click", () => {
      if (!state.order?.id) {
        showToast("กรุณารอให้ระบบสร้างรายการก่อนแนบสลิป", "warning");
        return;
      }
      ensureSlipInput().click();
    });

    $("#point-topup-qr-dialog")?.addEventListener("close", () => {
      document.documentElement.classList.remove("olaf-topup-dialog-open");
      document.body.classList.remove("olaf-topup-dialog-open");
    });
    $("#point-topup-qr-dialog")?.addEventListener("cancel", (event) => {
      event.preventDefault();
      setDialogOpen(event.currentTarget, false);
    });
    $("#point-topup-qr-dialog")?.addEventListener("toggle", keepQrTransferActionsVisible, true);
  }

  async function init() {
    createIcons();
    syncPreset(100);
    bindEvents();
    renderAuthState();
    setStatus("กำลังตรวจสอบบัญชีและเตรียมช่องทางชำระเงิน", "info", "loader-circle");

    await withTimeout(window.OlafStore?.ready?.catch?.(() => null), 1800, null);
    state.user = window.OlafStore?.currentUser?.() || await withTimeout(
      window.OlafSupabaseAuth?.getCurrentUser?.().catch(() => null),
      1800,
      null
    );
    window.OlafNavigation?.refreshAccount?.();
    renderAuthState();

    state.settings = await withTimeout(
      window.OlafStoreSettings?.fetchStoreSettings?.().catch(() => ({})),
      8000,
      {}
    ) || {};
    await loadBalance();
    setStatus("เลือกยอดที่ต้องการเติม แล้วระบบจะเปิด Popup ชำระเงินแบบเดียวกับหน้าสินค้า", "info", "sparkles");
    createIcons();
  }

  document.addEventListener("DOMContentLoaded", init);
})();
