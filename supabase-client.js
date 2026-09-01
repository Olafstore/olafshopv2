(function () {
  const SUPABASE_URL = "https://wtvfgwacodfrzxapwoxj.supabase.co";
  const SUPABASE_PUBLISHABLE_KEY = "sb_publishable_Y35cKy0qv4wC077QO21nXQ_MpIjaB5P";
  const PAYMENT_SLIP_BUCKET = "payment-slips";
  const PAYMENT_QR_BUCKET = "payment-qr";
  const MAX_PAYMENT_SLIP_SIZE = 5 * 1024 * 1024;
  const MAX_PAYMENT_QR_SIZE = 5 * 1024 * 1024;
  const CATALOG_CACHE_KEY = "olafshop:catalog:v110";
  const STORE_SETTINGS_CACHE_KEY = "olafshop:store-settings:v110";
  const CATALOG_CACHE_TTL_MS = 5 * 60 * 1000;
  const STORE_SETTINGS_CACHE_TTL_MS = 10 * 60 * 1000;
  let activeProductsRequest = null;
  let storeSettingsRequest = null;

  const isConfigured =
    SUPABASE_URL &&
    SUPABASE_PUBLISHABLE_KEY &&
    !SUPABASE_URL.includes("PASTE_") &&
    !SUPABASE_PUBLISHABLE_KEY.includes("PASTE_");

  const client =
    isConfigured && window.supabase?.createClient
      ? window.supabase.createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
          auth: {
            persistSession: true,
            autoRefreshToken: true,
            detectSessionInUrl: true
          }
        })
      : null;

  function requireClient() {
    if (!client) {
      throw new Error("กรุณาตั้งค่า Supabase Project URL และ Publishable key ใน supabase-client.js ก่อนใช้งานระบบสมาชิก");
    }
    return client;
  }

  function readSessionCache(key, maxAgeMs) {
    try {
      const raw = window.sessionStorage.getItem(key);
      if (!raw) return null;
      const envelope = JSON.parse(raw);
      if (!envelope || Date.now() - Number(envelope.savedAt || 0) > maxAgeMs) {
        window.sessionStorage.removeItem(key);
        return null;
      }
      return envelope.value;
    } catch (error) {
      return null;
    }
  }

  function writeSessionCache(key, value) {
    try {
      window.sessionStorage.setItem(key, JSON.stringify({ savedAt: Date.now(), value }));
    } catch (error) {
      // Storage can be unavailable in private mode; the in-flight cache still applies.
    }
  }

  function clearSessionCache(key) {
    try {
      window.sessionStorage.removeItem(key);
    } catch (error) {
      // Ignore unavailable browser storage.
    }
  }

  function invalidateProductCatalogCache() {
    activeProductsRequest = null;
    clearSessionCache(CATALOG_CACHE_KEY);
  }

  function invalidateStoreSettingsCache() {
    storeSettingsRequest = null;
    clearSessionCache(STORE_SETTINGS_CACHE_KEY);
  }

  const OAUTH_RETURN_KEY = "olafshop_oauth_return_to";

  function normalizeReturnPath(value, fallback = "index.html") {
    const raw = String(value || "").trim();
    if (!raw) return fallback;
    try {
      const url = new URL(raw, window.location.origin);
      if (url.origin !== window.location.origin) return fallback;
      return `${url.pathname.replace(/^\//, "")}${url.search}${url.hash}` || fallback;
    } catch (error) {
      return fallback;
    }
  }

  function saveOAuthReturnTo(returnTo) {
    const safeReturnTo = normalizeReturnPath(returnTo, "index.html");
    try {
      window.sessionStorage.setItem(OAUTH_RETURN_KEY, safeReturnTo);
    } catch (error) {
      console.warn("Unable to store OAuth return path", error);
    }
    return safeReturnTo;
  }

  function getOAuthReturnTo(fallback = "index.html") {
    try {
      const saved = window.sessionStorage.getItem(OAUTH_RETURN_KEY);
      if (saved) {
        window.sessionStorage.removeItem(OAUTH_RETURN_KEY);
        return normalizeReturnPath(saved, fallback);
      }
    } catch (error) {
      console.warn("Unable to read OAuth return path", error);
    }
    const urlReturn = new URLSearchParams(window.location.search).get("return");
    return normalizeReturnPath(urlReturn, fallback);
  }

  function buildOAuthRedirectUrl({ returnTo = "index.html" } = {}) {
    if (!/^https?:$/.test(window.location.protocol)) {
      throw new Error("GOOGLE_OAUTH_REQUIRES_HTTP");
    }
    saveOAuthReturnTo(returnTo);
    const redirectUrl = new URL("login.html", window.location.href);
    redirectUrl.search = "";
    redirectUrl.hash = "";
    return redirectUrl.toString();
  }

  function publicUserFrom(user, profile = {}) {
    if (!user) return null;
    const metadataName = user.user_metadata?.full_name || user.user_metadata?.name;
    const profileEmail = profile.email || user.email || "";
    const username = profile.username || profileEmail?.split("@")[0] || user.email?.split("@")[0] || "member";
    const fullName = profile.full_name || profile.fullName || profile.displayName || metadataName || username || "Member";
    return {
      id: user.id,
      email: profileEmail,
      username,
      displayName: fullName,
      fullName,
      role: profile.role || "customer",
      position: profile.position || "Member",
      partnerLevel: profile.partner_level || profile.partnerLevel || "none",
      status: profile.status || "active",
      provider: "supabase",
      updatedAt: profile.updated_at || user.updated_at || ""
    };
  }

  function getAdminProfileState(profile = {}) {
    const role = String(profile?.role || "").toLowerCase();
    const status = String(profile?.status || "active").toLowerCase();
    return {
      role,
      status,
      isActiveAdmin: role === "admin" && status === "active"
    };
  }

  function wait(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  async function getProfile(user, retries = 0) {
    if (!user) return null;
    for (let attempt = 0; attempt <= retries; attempt += 1) {
      const { data, error } = await requireClient()
        .from("profiles")
        .select("id, email, username, full_name, role, position, partner_level, status, updated_at")
        .eq("id", user.id)
        .maybeSingle();
      if (error) throw error;
      if (data || attempt === retries) return data;
      await wait(300 * (attempt + 1));
    }
    return null;
  }

  async function getCurrentUser() {
    const auth = requireClient().auth;
    const { data: sessionData, error: sessionError } = await auth.getSession();
    if (sessionError) return null;
    const sessionUser = sessionData.session?.user || null;
    const { data, error } = await auth.getUser();
    if (error && !sessionUser) return null;
    const user = data?.user || sessionUser;
    if (!user) return null;
    const profile = await getProfile(user, 2).catch(() => null);
    return publicUserFrom(user, profile || {});
  }

  async function getAdminAccess() {
    const auth = requireClient().auth;
    const { data: sessionData, error: sessionError } = await auth.getSession();
    if (sessionError) throw sessionError;

    const sessionUser = sessionData.session?.user || null;
    if (!sessionUser) {
      return {
        isAdmin: false,
        reason: "NO_SESSION",
        user: null,
        authUser: null,
        profile: null,
        role: "",
        status: ""
      };
    }

    const { data: userData, error: userError } = await auth.getUser();
    if (userError || !userData?.user) {
      return {
        isAdmin: false,
        reason: "INVALID_SESSION",
        user: null,
        authUser: null,
        profile: null,
        role: "",
        status: "",
        error: userError || null
      };
    }

    const authUser = userData.user;
    let profile = null;
    let profileError = null;
    try {
      profile = await getProfile(authUser, 1);
    } catch (error) {
      profileError = error;
    }

    let profileState = getAdminProfileState(profile || {});
    let roleRpcData = null;
    let roleRpcError = null;
    if (!profileState.isActiveAdmin) {
      try {
        const { data, error } = await requireClient().rpc("get_my_role");
        if (error) throw error;
        if (data && typeof data === "object") {
          roleRpcData = data;
          const roleRpcState = getAdminProfileState(data);
          if (roleRpcState.role || roleRpcState.status) {
            profileState = roleRpcState;
          }
        }
      } catch (error) {
        roleRpcError = error;
      }
    }

    let rpcAllowsAdmin = false;
    let rpcError = null;
    try {
      const { data, error } = await requireClient().rpc("is_admin");
      if (error) throw error;
      rpcAllowsAdmin = data === true;
    } catch (error) {
      rpcError = error;
    }

    const isAdmin = profileState.isActiveAdmin || rpcAllowsAdmin;
    let reason = "NOT_ADMIN";
    if (isAdmin) {
      reason = rpcAllowsAdmin ? "ADMIN" : "ADMIN_PROFILE_FALLBACK";
    } else if (profileState.status === "missing_profile") {
      reason = "PROFILE_MISSING";
    } else if (profileState.role === "admin" && profileState.status !== "active") {
      reason = "ADMIN_INACTIVE";
    } else if (!profile && !roleRpcData && (profileError || (rpcError && roleRpcError))) {
      reason = "ROLE_LOAD_FAILED";
    }

    return {
      isAdmin,
      reason,
      user: publicUserFrom(authUser, profile || {}),
      authUser,
      profile,
      role: profileState.role,
      status: profileState.status,
      error: profileError || rpcError || roleRpcError || null
    };
  }

  async function signUp({ email, password, fullName }) {
    const { data, error } = await requireClient().auth.signUp({
      email,
      password,
      options: {
        data: {
          full_name: fullName
        }
      }
    });
    if (error) throw error;
    const user = data.user || data.session?.user || null;
    const profile = user ? await getProfile(user, 2).catch(() => null) : null;
    return publicUserFrom(user, profile || { full_name: fullName, email });
  }

  async function signIn({ email, password }) {
    const { data, error } = await requireClient().auth.signInWithPassword({ email, password });
    if (error) throw error;
    const profile = data.user ? await getProfile(data.user, 2).catch(() => null) : null;
    return publicUserFrom(data.user, profile || {});
  }

  async function signInWithGoogle({ returnTo = "index.html" } = {}) {
    const redirectTo = buildOAuthRedirectUrl({ returnTo });
    const { data, error } = await requireClient().auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo
      }
    });
    if (error) throw error;
    return data;
  }

  async function signOut() {
    const { error } = await requireClient().auth.signOut();
    if (error) throw error;
  }

  async function updateProfile({ username, fullName }) {
    const { data: userData, error: userError } = await requireClient().auth.getUser();
    if (userError) throw userError;
    const user = userData.user;
    if (!user) throw new Error("กรุณาเข้าสู่ระบบก่อนแก้ไขโปรไฟล์");

    const normalizedUsername = String(username || user.email?.split("@")[0] || "").trim();
    const normalizedFullName = String(fullName || normalizedUsername).trim();
    if (normalizedUsername.length < 2 || normalizedUsername.length > 50) {
      throw new Error("ชื่อผู้ใช้ต้องมีความยาว 2–50 ตัวอักษร");
    }
    if (!normalizedFullName || normalizedFullName.length > 100) {
      throw new Error("ชื่อแสดงผลต้องมีความยาว 1–100 ตัวอักษร");
    }

    const client = requireClient();
    const rpcResult = await client.rpc("update_my_profile", {
      p_username: normalizedUsername,
      p_full_name: normalizedFullName
    });
    if (!rpcResult.error) {
      return publicUserFrom(user, rpcResult.data || {});
    }

    const rpcMessage = String(rpcResult.error?.message || "");
    const missingRpc =
      rpcResult.error?.code === "PGRST202" ||
      rpcResult.error?.code === "42883" ||
      rpcMessage.includes("update_my_profile") ||
      rpcMessage.toLowerCase().includes("schema cache");
    if (!missingRpc) throw rpcResult.error;

    const { data, error } = await client
      .from("profiles")
      .update({
        username: normalizedUsername,
        full_name: normalizedFullName
      })
      .eq("id", user.id)
      .select("id, email, username, full_name, role, position, partner_level, status, updated_at")
      .single();
    if (error) throw error;
    return publicUserFrom(user, data);
  }

  function mapProfilePayload(row = {}) {
    const email = row.email || row.authEmail || "";
    const username = row.username || email.split("@")[0] || "member";
    const fullName = row.fullName || row.displayName || row.full_name || username || "Member";
    return {
      id: row.id || "",
      email,
      authEmail: row.authEmail || "",
      username,
      displayName: fullName,
      fullName,
      role: row.role || "customer",
      position: row.position || "Member",
      partnerLevel: row.partnerLevel || row.partner_level || "none",
      status: row.status || "active",
      provider: row.provider || "supabase",
      isAdminAccount: row.isAdminAccount === true || row.is_admin_account === true,
      createdAt: row.createdAt || row.created_at || "",
      updatedAt: row.updatedAt || row.updated_at || ""
    };
  }

  async function fetchAdminUsers() {
    const { data, error } = await requireClient().rpc("admin_list_profiles");
    if (error) throw error;
    return normalizeArray(data).map(mapProfilePayload).filter((user) => user.id);
  }

  async function saveAdminUser(user) {
    const { data, error } = await requireClient().rpc("admin_save_profile", {
      p_id: user.id || null,
      p_email: user.email || "",
      p_username: user.username || "",
      p_full_name: user.fullName || user.displayName || "",
      p_role: user.role || "customer",
      p_position: user.position || "Member",
      p_partner_level: user.partnerLevel || "none",
      p_status: user.status || "active"
    });
    if (error) throw error;
    const savedUser = mapProfilePayload(data);
    const nextPassword = String(user.password || "").trim();
    if (nextPassword) {
      await adminSetUserPassword({
        userId: savedUser.id || user.id,
        password: nextPassword
      });
    }
    return savedUser;
  }

  async function adminSetUserPassword({ userId, password }) {
    const targetUserId = String(userId || "").trim();
    const nextPassword = String(password || "");
    if (!targetUserId) throw new Error("USER_REQUIRED");
    if (nextPassword.length < 6) throw new Error("PASSWORD_TOO_SHORT");

    const { data: sessionData, error: sessionError } = await requireClient().auth.getSession();
    if (sessionError) throw sessionError;
    const accessToken = sessionData?.session?.access_token;
    if (!accessToken) throw new Error("AUTH_REQUIRED");

    const response = await fetch("/api/admin-user-password", {
      method: "POST",
      headers: {
        Accept: "application/json",
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        userId: targetUserId,
        password: nextPassword
      })
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok || payload?.success !== true) {
      const error = new Error(payload?.message || payload?.code || "ADMIN_PASSWORD_UPDATE_FAILED");
      error.code = payload?.code || "ADMIN_PASSWORD_UPDATE_FAILED";
      throw error;
    }
    return payload;
  }

  async function disableAdminUser(userId) {
    const { data, error } = await requireClient().rpc("admin_set_profile_status", {
      p_id: userId,
      p_status: "banned"
    });
    if (error) throw error;
    return mapProfilePayload(data);
  }

  async function updatePassword({ email, oldPassword, newPassword }) {
    const auth = requireClient().auth;
    const normalizedEmail = String(email || "").trim().toLowerCase();
    const currentPassword = String(oldPassword || "");
    const nextPassword = String(newPassword || "");

    if (!normalizedEmail) throw new Error("กรุณาเข้าสู่ระบบอีกครั้งก่อนเปลี่ยนรหัสผ่าน");
    if (!currentPassword) throw new Error("กรุณากรอกรหัสผ่านเดิม");
    if (nextPassword.length < 6) throw new Error("รหัสผ่านใหม่ต้องมีอย่างน้อย 6 ตัวอักษร");

    const { error: verifyError } = await auth.signInWithPassword({
      email: normalizedEmail,
      password: currentPassword
    });
    if (verifyError) throw new Error("รหัสผ่านเดิมไม่ถูกต้อง");

    const { data, error } = await auth.updateUser({ password: nextPassword });
    if (error) throw error;

    const user = data.user;
    const profile = user ? await getProfile(user, 2).catch(() => null) : null;
    return publicUserFrom(user, profile || {});
  }

  function normalizeArray(value) {
    return Array.isArray(value) ? value : [];
  }

  function normalizeObject(value) {
    return value && typeof value === "object" && !Array.isArray(value) ? value : {};
  }

  function mergePaymentChannelsIntoSettings(settings, channels = []) {
    const next = normalizeObject(settings);
    const payment = {
      ...normalizeObject(next.payment)
    };
    const normalizedChannels = normalizeArray(channels);
    const promptpay = normalizedChannels.find((channel) => channel.id === "promptpay" || channel.method === "promptpay");
    const wallet = normalizedChannels.find((channel) => channel.id === "wallet" || channel.method === "wallet");

    if (promptpay) {
      payment.manualQrUrl = promptpay.qrUrl || payment.manualQrUrl || "";
      payment.manualQrPath = promptpay.qrPath || payment.manualQrPath || "";
      payment.bankName = promptpay.bankName || payment.bankName || "";
      payment.bankAccountNumber = promptpay.accountNumber || payment.bankAccountNumber || "";
      payment.bankAccountName = promptpay.accountName || payment.bankAccountName || "";
      payment.paymentNote = promptpay.note || payment.paymentNote || "";
    }

    if (wallet) {
      payment.trueMoneyQrUrl = wallet.qrUrl || payment.trueMoneyQrUrl || "";
      payment.trueMoneyQrPath = wallet.qrPath || payment.trueMoneyQrPath || "";
      payment.walletName = wallet.walletName || payment.walletName || "";
      if (!payment.paymentNote && wallet.note) payment.paymentNote = wallet.note;
    }

    return {
      ...next,
      payment,
      paymentChannels: normalizedChannels
    };
  }

  async function fetchStoreSettings(options = {}) {
    const forceRefresh = options === true || options?.forceRefresh === true;
    if (!forceRefresh) {
      const cached = readSessionCache(STORE_SETTINGS_CACHE_KEY, STORE_SETTINGS_CACHE_TTL_MS);
      if (cached) return cached;
      if (storeSettingsRequest) return storeSettingsRequest;
    }

    storeSettingsRequest = (async () => {
      const { data, error } = await requireClient()
        .from("store_settings")
        .select("settings, updated_at")
        .eq("id", "main")
        .maybeSingle();
      if (error) throw error;
      const settings = {
        ...normalizeObject(data?.settings),
        updatedAt: data?.updated_at || ""
      };
      const channels = await fetchPaymentChannels({ activeOnly: false }).catch((channelError) => {
        console.warn("Payment channels unavailable", channelError);
        return [];
      });
      const resolved = await resolveStoreAssetUrls(mergePaymentChannelsIntoSettings(settings, channels));
      writeSessionCache(STORE_SETTINGS_CACHE_KEY, resolved);
      return resolved;
    })();

    try {
      return await storeSettingsRequest;
    } finally {
      storeSettingsRequest = null;
    }
  }

  async function saveStoreSettings(settings) {
    const { data, error } = await requireClient().rpc("admin_save_store_settings", {
      p_settings: normalizeObject(settings)
    });
    if (error) throw error;
    invalidateStoreSettingsCache();
    return normalizeObject(data);
  }

  function mapProductRow(row) {
    if (!row) return null;
    return {
      id: row.id,
      name: row.name,
      publisher: row.publisher,
      category: row.category || "all",
      label: row.label || "",
      price: Number(row.price || 0),
      compareAt: row.compare_at == null ? null : Number(row.compare_at),
      stock: Number(row.stock || 0),
      sold: Number(row.sold || 0),
      rating: row.rating || "",
      delivery: row.delivery || "",
      warranty: row.warranty || "",
      image: row.image_url || "",
      heroImage: row.hero_image_url || row.image_url || "",
      tags: normalizeArray(row.tags),
      description: row.description || "",
      gallery: normalizeArray(row.gallery),
      platformLinks: normalizeArray(row.platform_links),
      featureBlocks: normalizeArray(row.feature_blocks),
      detailSections: normalizeArray(row.detail_sections),
      steamRelatedLinks: normalizeArray(row.steam_related_links),
      systemRequirements: row.system_requirements || { minimum: [], recommended: [] },
      steamAppId: row.steam_app_id == null ? null : Number(row.steam_app_id),
      sourceMetadata: normalizeObject(row.source_metadata),
      badgeOverrides: normalizeArray(row.badge_overrides),
      isActive: row.is_active !== false,
      sortOrder: Number(row.sort_order || 0),
      createdAt: row.created_at || "",
      updatedAt: row.updated_at || ""
    };
  }

  function mapProductPackageRow(row) {
    if (!row) return null;
    return {
      id: row.id,
      productId: row.product_id || row.productId || "",
      title: row.title || "",
      subtitle: row.subtitle || "",
      description: row.description || "",
      price: Number(row.price || 0),
      compareAt: row.compare_at == null ? null : Number(row.compare_at),
      stock: Number(row.stock || 0),
      sold: Number(row.sold || 0),
      status: row.status || "active",
      sortOrder: Number(row.sort_order || 0),
      badge: row.badge || "",
      metadata: normalizeObject(row.metadata),
      createdAt: row.created_at || "",
      updatedAt: row.updated_at || ""
    };
  }

  function mapOfflineStockItemRow(row) {
    if (!row) return null;
    return {
      id: row.id || "",
      productId: row.product_id || row.productId || "",
      content: row.content || "",
      status: row.status || "available",
      orderId: row.order_id || "",
      orderItemId: row.order_item_id || "",
      reservedBy: row.reserved_by || "",
      reservedAt: row.reserved_at || "",
      deliveredAt: row.delivered_at || "",
      createdBy: row.created_by || "",
      updatedBy: row.updated_by || "",
      createdAt: row.created_at || "",
      updatedAt: row.updated_at || ""
    };
  }

  function mapInventorySummaryRow(row) {
    if (!row) return null;
    return {
      productId: row.productId || row.product_id || "",
      managedStock: row.managedStock === true || row.managed_stock === true,
      availableCount: Number(row.availableCount ?? row.available_count ?? 0),
      reservedCount: Number(row.reservedCount ?? row.reserved_count ?? 0),
      deliveredCount: Number(row.deliveredCount ?? row.delivered_count ?? 0),
      voidCount: Number(row.voidCount ?? row.void_count ?? 0),
      soldCount: Number(row.soldCount ?? row.sold_count ?? 0),
      isActive: row.isActive !== false && row.is_active !== false,
      orderCount: Number(row.orderCount ?? row.order_count ?? 0),
      orderQuantity: Number(row.orderQuantity ?? row.order_quantity ?? 0),
      deliveredOrderQuantity: Number(row.deliveredOrderQuantity ?? row.delivered_order_quantity ?? 0),
      cancelledOrderQuantity: Number(row.cancelledOrderQuantity ?? row.cancelled_order_quantity ?? 0),
      lastOrderAt: row.lastOrderAt || row.last_order_at || "",
      stockMatches: row.stockMatches !== false && row.stock_matches !== false
    };
  }

  function packageToRpcPayload(productId, pkg = {}) {
    const normalizedProductId = String(productId || pkg.productId || "").trim();
    const title = String(pkg.title || "").trim();
    if (!normalizedProductId) throw new Error("PRODUCT_REQUIRED");
    if (!title) throw new Error("PACKAGE_TITLE_REQUIRED");

    const price = Number(pkg.price || 0);
    const compareAt = pkg.compareAt === "" || pkg.compareAt == null ? null : Number(pkg.compareAt);
    const stock = Number(pkg.stock || 0);
    const sold = Number(pkg.sold || 0);
    const sortOrder = Number(pkg.sortOrder || 0);

    if (!Number.isFinite(price) || price < 0) throw new Error("INVALID_PACKAGE_PRICE");
    if (compareAt != null && (!Number.isFinite(compareAt) || compareAt < 0)) throw new Error("INVALID_PACKAGE_COMPARE_AT");
    if (!Number.isInteger(stock) || stock < 0) throw new Error("INVALID_PACKAGE_STOCK");
    if (!Number.isInteger(sold) || sold < 0) throw new Error("INVALID_PACKAGE_SOLD");
    if (!Number.isInteger(sortOrder) || sortOrder < 0) throw new Error("INVALID_PACKAGE_SORT_ORDER");

    return {
      p_product_id: normalizedProductId,
      p_id: pkg.id || null,
      p_title: title,
      p_subtitle: pkg.subtitle || null,
      p_description: pkg.description || null,
      p_price: price,
      p_compare_at: compareAt,
      p_stock: stock,
      p_sold: sold,
      p_status: pkg.status || "active",
      p_sort_order: sortOrder,
      p_badge: pkg.badge || null,
      p_metadata: normalizeObject(pkg.metadata)
    };
  }

  function productToRow(product) {
    return {
      id: String(product.id || "").trim(),
      name: String(product.name || "").trim(),
      publisher: product.publisher || null,
      category: product.category || "all",
      label: product.label || null,
      price: Number(product.price || 0),
      compare_at: product.compareAt == null ? null : Number(product.compareAt || 0),
      stock: Number(product.stock || 0),
      sold: Number(product.sold || 0),
      rating: product.rating || null,
      delivery: product.delivery || null,
      warranty: product.warranty || null,
      image_url: product.image || null,
      hero_image_url: product.heroImage || product.image || null,
      tags: normalizeArray(product.tags),
      description: product.description || null,
      gallery: normalizeArray(product.gallery),
      platform_links: normalizeArray(product.platformLinks),
      feature_blocks: normalizeArray(product.featureBlocks),
      detail_sections: normalizeArray(product.detailSections),
      steam_related_links: normalizeArray(product.steamRelatedLinks),
      system_requirements: product.systemRequirements || { minimum: [], recommended: [] },
      steam_app_id: product.steamAppId == null || product.steamAppId === "" ? null : String(product.steamAppId),
      source_metadata: normalizeObject(product.sourceMetadata),
      badge_overrides: normalizeArray(product.badgeOverrides),
      is_active: product.isActive !== false,
      sort_order: Number(product.sortOrder || 0)
    };
  }

  async function fetchActiveProducts(options = {}) {
    const forceRefresh = options === true || options?.forceRefresh === true;
    if (!forceRefresh) {
      const cached = readSessionCache(CATALOG_CACHE_KEY, CATALOG_CACHE_TTL_MS);
      if (Array.isArray(cached) && cached.length) return cached;
      if (activeProductsRequest) return activeProductsRequest;
    }

    // Public listing pages only need card/search fields. Product descriptions,
    // galleries and requirements are fetched as one row on the detail page.
    const catalogColumns = [
      "id", "name", "publisher", "category", "label", "price", "compare_at",
      "stock", "sold", "rating", "image_url", "hero_image_url", "tags",
      "steam_app_id", "badge_overrides", "is_active", "sort_order", "updated_at"
    ].join(",");

    activeProductsRequest = (async () => {
      const { data, error } = await requireClient()
        .from("products")
        .select(catalogColumns)
        .eq("is_active", true)
        .order("sort_order", { ascending: true });
      if (error) throw error;
      const products = normalizeArray(data).map(mapProductRow).filter(Boolean);
      writeSessionCache(CATALOG_CACHE_KEY, products);
      return products;
    })();

    try {
      return await activeProductsRequest;
    } finally {
      activeProductsRequest = null;
    }
  }

  async function fetchProductById(productId) {
    const { data, error } = await requireClient()
      .from("products")
      .select("*")
      .eq("id", productId)
      .eq("is_active", true)
      .maybeSingle();
    if (error) throw error;
    return mapProductRow(data);
  }

  async function fetchRelatedProducts(productId, category, limit = 8) {
    const normalizedProductId = String(productId || "").trim();
    const normalizedCategory = String(category || "").trim();
    const safeLimit = Math.min(Math.max(Number.parseInt(limit, 10) || 8, 1), 12);
    const columns = [
      "id",
      "name",
      "publisher",
      "category",
      "label",
      "price",
      "compare_at",
      "stock",
      "sold",
      "image_url",
      "hero_image_url",
      "is_active",
      "sort_order",
      "updated_at"
    ].join(",");

    const buildQuery = (categoryOnly = false) => {
      let query = requireClient()
        .from("products")
        .select(columns)
        .eq("is_active", true);
      if (normalizedProductId) query = query.neq("id", normalizedProductId);
      if (categoryOnly && normalizedCategory) query = query.eq("category", normalizedCategory);
      return query
        .order("sold", { ascending: false })
        .order("sort_order", { ascending: true })
        .limit(categoryOnly ? safeLimit : safeLimit * 2);
    };

    const [sameCategoryResult, fallbackResult] = await Promise.all([
      normalizedCategory ? buildQuery(true) : Promise.resolve({ data: [], error: null }),
      buildQuery(false)
    ]);

    if (sameCategoryResult.error && fallbackResult.error) {
      throw sameCategoryResult.error;
    }

    const productsById = new Map();
    [sameCategoryResult.data, fallbackResult.data].forEach((rows) => {
      normalizeArray(rows).forEach((row) => {
        const product = mapProductRow(row);
        if (!product?.id || product.id === normalizedProductId || productsById.has(product.id)) return;
        productsById.set(product.id, product);
      });
    });

    return [...productsById.values()].slice(0, safeLimit);
  }

  async function fetchAdminProducts() {
    const { data, error } = await requireClient()
      .from("products")
      .select("*")
      .order("sort_order", { ascending: true });
    if (error) throw error;
    return normalizeArray(data).map(mapProductRow).filter(Boolean);
  }

  async function upsertAdminProduct(product) {
    const row = productToRow(product);
    if (!row.id || !row.name) throw new Error("กรุณากรอก Product ID และชื่อสินค้า");
    delete row.stock;
    const { data, error } = await requireClient()
      .from("products")
      .upsert(row, { onConflict: "id" })
      .select("*")
      .single();
    if (error) throw error;
    invalidateProductCatalogCache();
    return mapProductRow(data);
  }

  async function deactivateAdminProduct(productId) {
    const { data, error } = await requireClient()
      .from("products")
      .update({ is_active: false })
      .eq("id", productId)
      .select("*")
      .single();
    if (error) throw error;
    invalidateProductCatalogCache();
    return mapProductRow(data);
  }

  async function setAdminProductStock({ productId, stock, note }) {
    const normalizedProductId = String(productId || "").trim();
    const normalizedStock = Number(stock);
    if (!normalizedProductId) throw new Error("PRODUCT_REQUIRED");
    if (!Number.isInteger(normalizedStock) || normalizedStock < 0) throw new Error("INVALID_STOCK");
    const client = requireClient();
    const { data, error } = await client.rpc("admin_set_product_stock", {
      p_product_id: normalizedProductId,
      p_stock: normalizedStock,
      p_note: note || "Admin stock adjustment"
    });
    if (!error) {
      invalidateProductCatalogCache();
      return mapProductRow(data);
    }

    const message = String(error.message || "");
    const missingRpc =
      error.code === "PGRST202" ||
      error.code === "42883" ||
      message.includes("admin_set_product_stock") ||
      message.toLowerCase().includes("schema cache");
    if (!missingRpc) throw error;

    const { data: fallbackData, error: fallbackError } = await client
      .from("products")
      .update({ stock: normalizedStock })
      .eq("id", normalizedProductId)
      .select("*")
      .single();
    if (fallbackError) throw fallbackError;
    invalidateProductCatalogCache();
    const mapped = mapProductRow(fallbackData);
    if (mapped) mapped._stockFallback = true;
    return mapped;
  }

  async function fetchProductPackages(productId) {
    const normalizedProductId = String(productId || "").trim();
    if (!normalizedProductId) throw new Error("PRODUCT_REQUIRED");
    const { data, error } = await requireClient()
      .from("product_packages")
      .select("*")
      .eq("product_id", normalizedProductId)
      .order("sort_order", { ascending: true })
      .order("created_at", { ascending: true });
    if (error) throw error;
    return normalizeArray(data).map(mapProductPackageRow).filter(Boolean);
  }

  async function fetchActiveProductPackages(productId) {
    const normalizedProductId = String(productId || "").trim();
    if (!normalizedProductId) throw new Error("PRODUCT_REQUIRED");
    const { data, error } = await requireClient()
      .from("product_packages")
      .select("*")
      .eq("product_id", normalizedProductId)
      .eq("status", "active")
      .order("sort_order", { ascending: true })
      .order("created_at", { ascending: true });
    if (error) throw error;
    return normalizeArray(data).map(mapProductPackageRow).filter(Boolean);
  }

  async function adminFetchProductPackages(productId) {
    return fetchProductPackages(productId);
  }

  async function adminSaveProductPackages(productId, packages = []) {
    const normalizedProductId = String(productId || "").trim();
    if (!normalizedProductId) throw new Error("PRODUCT_REQUIRED");
    if (!Array.isArray(packages)) throw new Error("INVALID_PACKAGES_PAYLOAD");

    const saved = [];
    for (const pkg of packages) {
      if (pkg?._delete || pkg?.deleted) {
        if (pkg.id) await adminDeleteProductPackage(pkg.id);
        continue;
      }
      const payload = packageToRpcPayload(normalizedProductId, pkg);
      const { data, error } = await requireClient().rpc("admin_save_product_package", payload);
      if (error) throw error;
      const mapped = mapProductPackageRow(data);
      if (mapped) saved.push(mapped);
    }
    return saved.sort((a, b) => Number(a.sortOrder || 0) - Number(b.sortOrder || 0));
  }

  async function adminDeleteProductPackage(packageId) {
    const normalizedPackageId = String(packageId || "").trim();
    if (!normalizedPackageId) throw new Error("PACKAGE_REQUIRED");
    const { data, error } = await requireClient().rpc("admin_delete_product_package", {
      p_package_id: normalizedPackageId
    });
    if (error) throw error;
    return normalizeObject(data);
  }

  async function adminFetchOfflineStockItems(productId) {
    const normalizedProductId = String(productId || "").trim();
    if (!normalizedProductId) throw new Error("PRODUCT_REQUIRED");
    const { data, error } = await requireClient().rpc("admin_fetch_variable_stock_items", {
      p_product_id: normalizedProductId
    });
    if (error) {
      const legacy = await requireClient().rpc("admin_fetch_offline_stock_items", { p_product_id: normalizedProductId });
      if (legacy.error) throw error;
      return normalizeArray(legacy.data).map(mapOfflineStockItemRow).filter(Boolean);
    }
    return normalizeArray(data).map(mapOfflineStockItemRow).filter(Boolean);
  }

  async function adminReplaceOfflineStockItems(productId, lines = []) {
    const normalizedProductId = String(productId || "").trim();
    if (!normalizedProductId) throw new Error("PRODUCT_REQUIRED");
    const items = normalizeArray(lines)
      .map((line) => String(line || "").trim())
      .filter(Boolean);
    const { data, error } = await requireClient().rpc("admin_replace_variable_stock_items", {
      p_product_id: normalizedProductId,
      p_items: items
    });
    if (error) {
      const legacy = await requireClient().rpc("admin_replace_offline_stock_items", {
        p_product_id: normalizedProductId,
        p_items: items
      });
      if (legacy.error) throw error;
      const legacyPayload = normalizeObject(legacy.data);
      return {
        product: mapProductRow(legacyPayload.product),
        items: normalizeArray(legacyPayload.items).map(mapOfflineStockItemRow).filter(Boolean),
        availableCount: Number(legacyPayload.availableCount || legacyPayload.available_count || 0)
      };
    }
    const payload = normalizeObject(data);
    return {
      product: mapProductRow(payload.product),
      items: normalizeArray(payload.items).map(mapOfflineStockItemRow).filter(Boolean),
      availableCount: Number(payload.availableCount || payload.available_count || 0)
    };
  }

  async function adminFetchInventorySummary() {
    const { data, error } = await requireClient().rpc("admin_inventory_summary_variable");
    if (!error) return normalizeArray(data).map(mapInventorySummaryRow).filter((item) => item?.productId);
    const legacy = await requireClient().rpc("admin_inventory_summary");
    if (legacy.error) throw error;
    return normalizeArray(legacy.data).map(mapInventorySummaryRow).filter((item) => item?.productId);
  }

  async function adminResizeOfflineStock({ productId, stock, templateContent = "", note = "" }) {
    const normalizedProductId = String(productId || "").trim();
    const normalizedStock = Number(stock);
    if (!normalizedProductId) throw new Error("PRODUCT_REQUIRED");
    if (!Number.isInteger(normalizedStock) || normalizedStock < 0 || normalizedStock > 10000) {
      throw new Error("INVALID_STOCK");
    }
    const { data, error } = await requireClient().rpc("admin_resize_variable_stock", {
      p_product_id: normalizedProductId,
      p_stock: normalizedStock,
      p_template_content: String(templateContent || "").trim() || null,
      p_note: String(note || "").trim() || "Admin resized managed stock"
    });
    if (error) {
      const legacy = await requireClient().rpc("admin_resize_offline_stock", {
        p_product_id: normalizedProductId,
        p_stock: normalizedStock,
        p_template_content: String(templateContent || "").trim() || null,
        p_note: String(note || "").trim() || "Admin resized managed stock"
      });
      if (legacy.error) throw error;
      const legacyPayload = normalizeObject(legacy.data);
      return {
        product: mapProductRow(legacyPayload.product),
        items: normalizeArray(legacyPayload.items).map(mapOfflineStockItemRow).filter(Boolean),
        availableCount: Number(legacyPayload.availableCount || legacyPayload.available_count || 0)
      };
    }
    const payload = normalizeObject(data);
    return {
      product: mapProductRow(payload.product),
      items: normalizeArray(payload.items).map(mapOfflineStockItemRow).filter(Boolean),
      availableCount: Number(payload.availableCount || payload.available_count || 0)
    };
  }

  function mapOrderItemRow(row) {
    return {
      id: row.id,
      orderId: row.order_id,
      productId: row.product_id,
      productName: row.product_name,
      productImageUrl: row.product_image_url || "",
      name: row.product_name,
      image: row.product_image_url || "",
      unitPrice: Number(row.unit_price || 0),
      quantity: Number(row.quantity || 0),
      lineTotal: Number(row.line_total || 0),
      packageId: row.package_id || "",
      packageTitle: row.package_title || "",
      packageSubtitle: row.package_subtitle || "",
      packagePrice: row.package_price == null ? null : Number(row.package_price),
      packageSnapshot: normalizeObject(row.package_snapshot),
      createdAt: row.created_at || ""
    };
  }

  function mapOrderRow(row) {
    if (!row) return null;
    const items = normalizeArray(row.order_items || row.items).map(mapOrderItemRow);
    return {
      id: row.id,
      orderNumber: row.order_number || row.id,
      userId: row.user_id || "",
      customerName: row.customer_name || "",
      customerEmail: row.customer_email || "",
      contact: row.customer_email || "",
      status: row.status || "waiting_admin",
      subtotal: Number(row.subtotal || 0),
      fee: Number(row.fee || 0),
      total: Number(row.total || 0),
      currency: row.currency || "THB",
      paymentMethod: row.payment_method || "promptpay",
      paymentStatus: row.payment_status || "pending",
      paymentReference: row.payment_reference || "",
      paymentVerifiedAt: row.payment_verified_at || "",
      paymentVerifiedProvider: row.payment_verified_provider || "",
      paymentVerifiedReference: row.payment_verified_reference || "",
      paymentVerifiedAmount: row.payment_verified_amount == null ? null : Number(row.payment_verified_amount),
      paymentVerificationNote: row.payment_verification_note || "",
      pointsRedeemedAmount: Number(row.points_redeemed_amount || 0),
      pointCreditAmount: Number(row.point_credit_amount || 0),
      discountCodeId: row.discount_code_id || "",
      discountCode: row.discount_code || "",
      discountAmount: Number(row.discount_amount || 0),
      paymentSlipPath: row.payment_slip_path || "",
      paymentSlipUrl: row.payment_slip_url || "",
      expiresAt: row.expires_at || "",
      stockReleased: row.stock_released === true,
      deliveryNote: row.delivery_note || "",
      deliveredPayload: row.delivered_payload || "",
      createdAt: row.created_at || "",
      updatedAt: row.updated_at || "",
      items
    };
  }

  function mapRecentPurchaseRow(row) {
    if (!row) return null;
    return {
      orderNumber: row.orderNumber || row.order_number || "",
      buyerNameMasked: row.buyerNameMasked || row.buyer_name_masked || "ลูกค้าxxx",
      productName: row.productName || row.product_name || "",
      productImageUrl: row.productImageUrl || row.product_image_url || "",
      quantity: Number(row.quantity || 1),
      status: row.status || "",
      createdAt: row.createdAt || row.created_at || ""
    };
  }

  function mapOrderRpcPayload(payload) {
    const value = payload && typeof payload === "string" ? JSON.parse(payload) : payload;
    if (value?.order) {
      return mapOrderRow({
        ...value.order,
        order_items: value.items || []
      });
    }
    return mapOrderRow(value);
  }

  async function createPaymentSlipSignedUrl(path) {
    const slipPath = String(path || "").trim();
    if (!slipPath) return "";
    const { data, error } = await requireClient()
      .storage
      .from(PAYMENT_SLIP_BUCKET)
      .createSignedUrl(slipPath, 60 * 30);
    if (error) {
      console.warn("Unable to create payment slip signed URL", error);
      return "";
    }
    return data?.signedUrl || "";
  }

  async function withPaymentSlipUrl(order) {
    if (!order) return null;
    if (!order.paymentSlipPath || order.paymentSlipUrl) return order;
    return {
      ...order,
      paymentSlipUrl: await createPaymentSlipSignedUrl(order.paymentSlipPath)
    };
  }

  async function withPaymentSlipUrls(orders) {
    return Promise.all(normalizeArray(orders).map(withPaymentSlipUrl));
  }

  function mapPaymentChannelRow(row) {
    if (!row) return null;
    return {
      id: row.id || "",
      method: row.method || row.id || "",
      label: row.label || row.id || "",
      isActive: row.is_active !== false,
      sortOrder: Number(row.sort_order || 0),
      bankName: row.bank_name || "",
      accountNumber: row.account_number || "",
      accountName: row.account_name || "",
      walletName: row.wallet_name || "",
      note: row.note || "",
      qrPath: row.qr_path || "",
      qrUrl: row.qr_url || "",
      updatedAt: row.updated_at || ""
    };
  }

  async function createPaymentQrSignedUrl(path) {
    const qrPath = String(path || "").trim();
    if (!qrPath) return "";
    const { data, error } = await requireClient()
      .storage
      .from(PAYMENT_QR_BUCKET)
      .createSignedUrl(qrPath, 60 * 60);
    if (error) {
      console.warn("Unable to create payment QR signed URL", error);
      return "";
    }
    return data?.signedUrl || "";
  }

  async function resolveStoreAssetUrls(settings) {
    const next = normalizeObject(settings);
    const payment = {
      ...normalizeObject(next.payment)
    };
    const activityPopup = {
      ...normalizeObject(next.activityPopup)
    };

    if (activityPopup.desktopImagePath) {
      activityPopup.desktopImageUrl = await createPaymentQrSignedUrl(activityPopup.desktopImagePath);
    }
    if (activityPopup.mobileImagePath) {
      activityPopup.mobileImageUrl = await createPaymentQrSignedUrl(activityPopup.mobileImagePath);
    }

    // Older Admin records may keep the payment QR as a private Storage path
    // instead of a public/signed URL. Resolve those paths here so every
    // checkout surface (product and Point top-up) receives a usable image URL.
    if (payment.manualQrPath && !payment.manualQrUrl) {
      payment.manualQrUrl = await createPaymentQrSignedUrl(payment.manualQrPath);
    }
    if (payment.trueMoneyQrPath && !payment.trueMoneyQrUrl) {
      payment.trueMoneyQrUrl = await createPaymentQrSignedUrl(payment.trueMoneyQrPath);
    }

    return {
      ...next,
      payment,
      activityPopup
    };
  }

  async function withPaymentQrUrl(channel) {
    if (!channel) return null;
    if (!channel.qrPath || channel.qrUrl) return channel;
    return {
      ...channel,
      qrUrl: await createPaymentQrSignedUrl(channel.qrPath)
    };
  }

  async function withPaymentQrUrls(channels) {
    return Promise.all(normalizeArray(channels).map(withPaymentQrUrl));
  }

  async function fetchPaymentChannels({ activeOnly = true } = {}) {
    let query = requireClient()
      .from("payment_channels")
      .select("*")
      .order("sort_order", { ascending: true });

    if (activeOnly) {
      query = query.eq("is_active", true);
    }

    const { data, error } = await query;
    if (error) throw error;
    return withPaymentQrUrls(normalizeArray(data).map(mapPaymentChannelRow).filter(Boolean));
  }

  function paymentChannelPayload(channel) {
    return {
      id: channel.id,
      label: channel.label,
      method: channel.method || channel.id,
      isActive: channel.isActive !== false,
      sortOrder: Number(channel.sortOrder || 0),
      bankName: channel.bankName || "",
      accountNumber: channel.accountNumber || "",
      accountName: channel.accountName || "",
      walletName: channel.walletName || "",
      note: channel.note || "",
      qrPath: channel.qrPath || "",
      qrUrl: channel.qrUrl || ""
    };
  }

  async function savePaymentChannels(channels) {
    const payload = normalizeArray(channels).map(paymentChannelPayload);
    const { data, error } = await requireClient().rpc("admin_save_payment_channels", {
      p_channels: payload
    });
    if (error) throw error;
    invalidateStoreSettingsCache();
    return withPaymentQrUrls(normalizeArray(data).map(mapPaymentChannelRow).filter(Boolean));
  }

  async function uploadPaymentQr({ channelId, file }) {
    const normalizedChannel = String(channelId || "").trim().toLowerCase();
    if (!["promptpay", "wallet"].includes(normalizedChannel)) throw new Error("PAYMENT_CHANNEL_REQUIRED");
    if (!file) throw new Error("QR_FILE_REQUIRED");
    if (!String(file.type || "").startsWith("image/")) throw new Error("QR_FILE_MUST_BE_IMAGE");
    if (Number(file.size || 0) > MAX_PAYMENT_QR_SIZE) throw new Error("QR_FILE_TOO_LARGE");

    const path = `${normalizedChannel}/${Date.now()}-${safeStorageFileName(file, "payment-qr.jpg")}`;
    const { error } = await requireClient()
      .storage
      .from(PAYMENT_QR_BUCKET)
      .upload(path, file, {
        cacheControl: "3600",
        contentType: file.type || "image/jpeg",
        upsert: false
      });
    if (error) throw error;

    return {
      path,
      signedUrl: await createPaymentQrSignedUrl(path)
    };
  }

  async function uploadStoreAsset({ assetType, file }) {
    const normalizedType = String(assetType || "").trim().toLowerCase();
    if (!["activity-desktop", "activity-mobile"].includes(normalizedType)) {
      throw new Error("STORE_ASSET_TYPE_REQUIRED");
    }
    if (!file) throw new Error("STORE_ASSET_FILE_REQUIRED");
    if (!String(file.type || "").startsWith("image/")) throw new Error("STORE_ASSET_MUST_BE_IMAGE");
    if (Number(file.size || 0) > MAX_PAYMENT_QR_SIZE) throw new Error("STORE_ASSET_TOO_LARGE");

    const path = `store-assets/${normalizedType}/${Date.now()}-${safeStorageFileName(file, "activity-image.jpg")}`;
    const { error } = await requireClient()
      .storage
      .from(PAYMENT_QR_BUCKET)
      .upload(path, file, {
        cacheControl: "3600",
        contentType: file.type || "image/jpeg",
        upsert: false
      });
    if (error) throw error;

    return {
      path,
      signedUrl: await createPaymentQrSignedUrl(path)
    };
  }

  function safeStorageFileName(file, fallback = "payment-slip.jpg") {
    const source = String(file?.name || fallback).toLowerCase();
    const cleaned = source.replace(/[^a-z0-9._-]+/g, "-").replace(/^-+|-+$/g, "");
    return (cleaned || fallback).slice(0, 90);
  }

  async function uploadPaymentSlip({ orderId, file }) {
    if (!orderId) throw new Error("ORDER_REQUIRED");
    if (!file) throw new Error("SLIP_FILE_REQUIRED");
    if (!String(file.type || "").startsWith("image/")) throw new Error("SLIP_FILE_MUST_BE_IMAGE");
    if (Number(file.size || 0) > MAX_PAYMENT_SLIP_SIZE) throw new Error("SLIP_FILE_TOO_LARGE");
    if (!window.OlafSlipQr?.scanFile) throw new Error("SLIP_QR_SCANNER_NOT_READY");

    const qrScan = await window.OlafSlipQr.scanFile(file);
    if (!qrScan?.payload) throw new Error("SLIP_QR_NOT_FOUND");

    const auth = requireClient().auth;
    const { data: userData, error: userError } = await auth.getUser();
    if (userError) throw userError;
    const user = userData?.user;
    if (!user) throw new Error("AUTH_REQUIRED");

    const path = `${user.id}/${orderId}/${Date.now()}-${safeStorageFileName(file)}`;
    let verificationAccepted = false;
    const { error: uploadError } = await requireClient()
      .storage
      .from(PAYMENT_SLIP_BUCKET)
      .upload(path, file, {
        cacheControl: "3600",
        contentType: file.type || "image/jpeg",
        upsert: false
      });
    if (uploadError) throw uploadError;

    try {
      const { data, error } = await requireClient().rpc("attach_payment_slip", {
        p_order_id: orderId,
        p_slip_path: path
      });
      if (error) throw error;
      const attachedOrder = await withPaymentSlipUrl(mapOrderRpcPayload(data));
      try {
        const verification = await verifyPaymentSlip({
          orderId
        });
        verificationAccepted = true;
        const refreshedOrder = await fetchOrderById(orderId).catch(() => attachedOrder);
        return {
          ...refreshedOrder,
          verification
        };
      } catch (verificationError) {
        if (verificationError?.retriable === true) {
          return {
            ...attachedOrder,
            verificationPending: true,
            verificationError: verificationError.code || "PAYMENT_VERIFICATION_FAILED"
          };
        }
        throw verificationError;
      }
    } catch (error) {
      if (!verificationAccepted && !error?.slipHandledByServer) {
        await requireClient().storage.from(PAYMENT_SLIP_BUCKET).remove([path]).catch(() => {});
      }
      throw error;
    }
  }

  async function verifyPaymentSlip({ orderId }) {
    if (!orderId) throw new Error("ORDER_REQUIRED");
    const { data: sessionData, error: sessionError } = await requireClient().auth.getSession();
    if (sessionError) throw sessionError;
    const accessToken = sessionData?.session?.access_token;
    if (!accessToken) throw new Error("AUTH_REQUIRED");

    let response;
    try {
      response = await fetch("/api/verify-slip", {
        method: "POST",
        headers: {
          Accept: "application/json",
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ orderId })
      });
    } catch (cause) {
      const error = new Error("PAYMENT_VERIFY_API_UNREACHABLE", { cause });
      error.code = "PAYMENT_VERIFY_API_UNREACHABLE";
      error.retriable = true;
      error.slipHandledByServer = false;
      throw error;
    }
    const payload = await response.json().catch(() => ({}));
    if (!response.ok || payload?.success !== true) {
      const error = new Error(payload?.message || "PAYMENT_VERIFICATION_FAILED");
      error.code = payload?.code || "PAYMENT_VERIFICATION_FAILED";
      error.slipHandledByServer = payload?.slipHandled === true;
      error.retriable = payload?.retriable === true || !error.slipHandledByServer;
      error.orderCancelled = payload?.orderCancelled === true;
      error.contactUrl = String(payload?.contactUrl || "");
      error.pointCreditAmount = Number(payload?.pointCreditAmount || 0);
      error.pointCredited = payload?.pointCredited === true;
      throw error;
    }
    return payload;
  }

  async function fetchPointBalance() {
    const { data, error } = await requireClient().rpc("get_my_point_balance");
    if (error) throw error;
    return {
      balance: Number(data?.balance || 0),
      lifetimeEarned: Number(data?.lifetimeEarned ?? data?.lifetime_earned ?? 0),
      lifetimeSpent: Number(data?.lifetimeSpent ?? data?.lifetime_spent ?? 0)
    };
  }

  function mapFreeRandomSlot(row = {}) {
    return {
      slotNumber: Number(row.slotNumber ?? row.slot_number ?? 0),
      prizeType: row.prizeType || row.prize_type || "product",
      pointAmount: Number(row.pointAmount ?? row.point_amount ?? 0),
      productId: row.productId || row.product_id || "",
      chancePercent: Number(row.chancePercent ?? row.chance_percent ?? 0),
      isActive: row.isActive === true || row.is_active === true,
      label: row.label || row.productName || row.product_name || "",
      imageUrl: row.imageUrl || row.image_url || "",
      productName: row.productName || row.product_name || "",
      price: Number(row.price || 0),
      category: row.category || "",
      stock: Number(row.stock || 0),
      productIsActive: row.productIsActive !== false && row.product_is_active !== false
    };
  }

  function mapFreeRandomMilestone(row = {}) {
    const product = normalizeObject(row.product || row.product_snapshot || row.productSnapshot);
    const claim = normalizeObject(row.claim || row.claim_snapshot || row.claimSnapshot);
    return {
      threshold: Number(row.threshold ?? row.spinThreshold ?? row.spin_threshold ?? 0),
      productId: row.productId || row.product_id || product.id || "",
      productName: row.productName || row.product_name || product.name || "",
      imageUrl: row.imageUrl || row.image_url || product.imageUrl || product.image_url || "",
      category: row.category || product.category || "",
      price: Number(row.price ?? product.price ?? 0),
      stock: Number(row.stock ?? product.stock ?? 0),
      productIsActive: row.productIsActive !== false && row.product_is_active !== false,
      isActive: row.isActive === true || row.is_active === true,
      label: row.label || "",
      claimed: row.claimed === true || Boolean(claim.id || row.claimId || row.claim_id),
      claimId: row.claimId || row.claim_id || claim.id || "",
      orderId: row.orderId || row.order_id || claim.orderId || claim.order_id || "",
      orderNumber: row.orderNumber || row.order_number || claim.orderNumber || claim.order_number || "",
      claimedAt: row.claimedAt || row.claimed_at || claim.createdAt || claim.created_at || "",
      resetAt: row.resetAt || row.reset_at || "",
      remaining: Number(row.remaining ?? 0),
      progress: Number(row.progress ?? 0)
    };
  }

  function mapFreeRandomMilestoneReward(payload = {}) {
    if (!payload || typeof payload !== "object") return null;
    const milestone = normalizeObject(payload.milestone || payload);
    const product = normalizeObject(payload.product);
    const orderPayload = payload.order ? mapOrderRpcPayload({ order: payload.order, items: payload.items || [] }) : null;
    const threshold = Number(milestone.threshold ?? milestone.spinThreshold ?? milestone.spin_threshold ?? payload.threshold ?? 0);
    if (!threshold && !product.id && !payload.order) return null;
    return {
      threshold,
      claimId: payload.claimId || payload.claim_id || milestone.claimId || milestone.claim_id || "",
      freeRandomClaimId: payload.freeRandomClaimId || payload.free_random_claim_id || milestone.freeRandomClaimId || milestone.free_random_claim_id || "",
      resetAt: payload.resetAt || payload.reset_at || milestone.resetAt || milestone.reset_at || "",
      totalSpins: Number(payload.totalSpins ?? payload.total_spins ?? milestone.totalSpins ?? milestone.total_spins ?? 0),
      product: {
        id: product.id || milestone.productId || milestone.product_id || "",
        name: product.name || milestone.productName || milestone.product_name || milestone.label || "",
        imageUrl: product.imageUrl || product.image_url || milestone.imageUrl || milestone.image_url || "",
        category: product.category || milestone.category || "",
        price: Number(product.price ?? milestone.price ?? 0),
        stock: Number(product.stock ?? milestone.stock ?? 0)
      },
      order: orderPayload,
      items: orderPayload?.items || normalizeArray(payload.items)
    };
  }

  function normalizeFreeRandomConfig(payload = {}) {
    const settings = normalizeObject(payload.settings);
    return {
      settings: {
        dailyLimit: settings.dailyLimit ?? settings.daily_limit ?? null,
        unlimited: settings.unlimited !== false && settings.isUnlimited !== false,
        isActive: settings.isActive !== false && settings.is_active !== false,
        spinCostPoints: Number(settings.spinCostPoints ?? settings.spin_cost_points ?? 1),
        title: settings.title || "OLAF Premium Spin",
        subtitle: settings.subtitle || "สุ่มครั้งละ 1 Point แบบไม่จำกัดต่อวัน ลุ้นเกม, Point และรางวัลเกลือ"
      },
      slots: normalizeArray(payload.slots).map(mapFreeRandomSlot).sort((a, b) => a.slotNumber - b.slotNumber),
      milestones: normalizeArray(payload.milestones).map(mapFreeRandomMilestone).sort((a, b) => a.threshold - b.threshold)
    };
  }

  function normalizeFreeRandomStatus(payload = {}) {
    return {
      today: payload.today || "",
      dailyLimit: payload.dailyLimit ?? payload.daily_limit ?? null,
      unlimited: payload.unlimited !== false && payload.isUnlimited !== false,
      spinsUsedToday: Number(payload.spinsUsedToday ?? payload.spins_used_today ?? 0),
      spinsRemaining: Number(payload.spinsRemaining ?? payload.spins_remaining ?? Number.MAX_SAFE_INTEGER),
      totalSpins: Number(payload.totalSpins ?? payload.total_spins ?? payload.spinsUsedTotal ?? payload.spins_used_total ?? payload.spinsUsedToday ?? payload.spins_used_today ?? 0),
      spinCostPoints: Number(payload.spinCostPoints ?? payload.spin_cost_points ?? 1),
      pointBalance: Number(payload.pointBalance ?? payload.point_balance ?? 0),
      canAffordSpin: payload.canAffordSpin === true || payload.can_afford_spin === true,
      milestones: normalizeArray(payload.milestones).map(mapFreeRandomMilestone).sort((a, b) => a.threshold - b.threshold),
      nextMilestone: mapFreeRandomMilestone(normalizeObject(payload.nextMilestone || payload.next_milestone))
    };
  }

  function mapFreeRandomClaim(row = {}) {
    return {
      id: row.id || "",
      userId: row.userId || row.user_id || "",
      userEmail: row.userEmail || row.user_email || "",
      username: row.username || "",
      spinDate: row.spinDate || row.spin_date || "",
      slotNumber: Number(row.slotNumber ?? row.slot_number ?? 0),
      prizeType: row.prizeType || row.prize_type || row.prizeSnapshot?.prizeType || row.prize_snapshot?.prizeType || "product",
      pointAmount: Number(row.pointAmount ?? row.point_amount ?? row.prizeSnapshot?.pointAmount ?? row.prize_snapshot?.pointAmount ?? 0),
      pointTransactionId: row.pointTransactionId || row.point_transaction_id || "",
      pointDebitTransactionId: row.pointDebitTransactionId || row.point_debit_transaction_id || "",
      spinCostPoints: Number(row.spinCostPoints ?? row.spin_cost_points ?? row.prizeSnapshot?.spinCostPoints ?? row.prize_snapshot?.spinCostPoints ?? 0),
      productId: row.productId || row.product_id || "",
      productName: row.productName || row.product_name || "",
      orderId: row.orderId || row.order_id || "",
      orderNumber: row.orderNumber || row.order_number || "",
      chancePercent: Number(row.chancePercent ?? row.chance_percent ?? 0),
      roll: Number(row.roll || 0),
      prizeSnapshot: normalizeObject(row.prizeSnapshot || row.prize_snapshot),
      createdAt: row.createdAt || row.created_at || ""
    };
  }

  async function fetchFreeRandomConfig() {
    const { data, error } = await requireClient().rpc("get_free_random_config");
    if (error) throw error;
    return normalizeFreeRandomConfig(data || {});
  }

  async function fetchMyFreeRandomStatus() {
    const { data, error } = await requireClient().rpc("get_my_free_random_status");
    if (error) throw error;
    return normalizeFreeRandomStatus(data || {});
  }

  async function claimFreeRandomSpin() {
    const { data, error } = await requireClient().rpc("claim_free_random_spin");
    if (error) throw error;
    const payload = data || {};
    return {
      claim: mapFreeRandomClaim(payload.claim || {}),
      slot: mapFreeRandomSlot(payload.slot || {}),
      product: {
        id: payload.product?.id || "",
        name: payload.product?.name || "",
        imageUrl: payload.product?.imageUrl || payload.product?.image_url || "",
        category: payload.product?.category || "",
        price: Number(payload.product?.price || 0),
        stock: Number(payload.product?.stock || 0)
      },
      order: payload.order ? mapOrderRpcPayload({ order: payload.order, items: payload.items || [] }) : null,
      pointCredit: payload.pointCredit || payload.point_credit || null,
      pointDebit: payload.pointDebit || payload.point_debit || null,
      pointBalance: Number(payload.pointBalance ?? payload.point_balance ?? 0),
      spinCostPoints: Number(payload.spinCostPoints ?? payload.spin_cost_points ?? 1),
      emptyPrize: payload.emptyPrize === true || payload.empty_prize === true,
      milestoneReward: mapFreeRandomMilestoneReward(payload.milestoneReward || payload.milestone_reward),
      ...normalizeFreeRandomStatus(payload)
    };
  }

  async function fetchFreeRandomMilestones() {
    const { data, error } = await requireClient().rpc("get_free_random_milestones");
    if (error) throw error;
    return normalizeArray(data).map(mapFreeRandomMilestone).sort((a, b) => a.threshold - b.threshold);
  }

  async function fetchMyFreeRandomMilestoneStatus() {
    const { data, error } = await requireClient().rpc("get_my_free_random_milestone_status");
    if (error) throw error;
    return normalizeFreeRandomStatus(data || {});
  }

  async function fetchFreeRandomMilestoneForClaim(claimId) {
    if (!claimId) return null;
    const { data, error } = await requireClient().rpc("get_free_random_milestone_for_claim", {
      p_claim_id: claimId
    });
    if (error) throw error;
    return mapFreeRandomMilestoneReward(data || {});
  }

  async function claimFreeRandomMilestone(threshold) {
    const { data, error } = await requireClient().rpc("claim_free_random_milestone", {
      p_threshold: Number(threshold || 0)
    });
    if (error) throw error;
    return mapFreeRandomMilestoneReward(data || {});
  }

  async function adminFetchFreeRandomSettings() {
    const { data, error } = await requireClient().rpc("admin_free_random_settings");
    if (error) throw error;
    return normalizeFreeRandomConfig(data || {});
  }

  async function adminSaveFreeRandomSettings({ isActive = true, slots = [] } = {}) {
    const { data, error } = await requireClient().rpc("admin_save_free_random_settings", {
      p_daily_limit: 2147483647,
      p_is_active: isActive !== false,
      p_slots: normalizeArray(slots).map((slot, index) => ({
        slotNumber: Number(slot.slotNumber || index + 1),
        prizeType: slot.prizeType || "product",
        pointAmount: Number(slot.pointAmount || 0),
        productId: slot.productId || null,
        chancePercent: Number(slot.chancePercent || 0),
        isActive: slot.isActive === true,
        label: slot.label || null,
        imageUrl: slot.imageUrl || null
      }))
    });
    if (error) throw error;
    return normalizeFreeRandomConfig(data || {});
  }

  async function adminFetchFreeRandomMilestones() {
    const { data, error } = await requireClient().rpc("admin_free_random_milestones");
    if (error) throw error;
    return normalizeArray(data).map(mapFreeRandomMilestone).sort((a, b) => a.threshold - b.threshold);
  }

  async function adminSaveFreeRandomMilestones(milestones = []) {
    const { data, error } = await requireClient().rpc("admin_save_free_random_milestones", {
      p_milestones: normalizeArray(milestones).map((milestone) => ({
        threshold: Number(milestone.threshold || 0),
        productId: milestone.productId || null,
        isActive: milestone.isActive === true,
        label: milestone.label || null,
        imageUrl: milestone.imageUrl || null
      }))
    });
    if (error) throw error;
    return normalizeArray(data).map(mapFreeRandomMilestone).sort((a, b) => a.threshold - b.threshold);
  }

  async function adminResetFreeRandomSpinCounts(note = "") {
    const { data, error } = await requireClient().rpc("admin_reset_free_random_spin_counts", {
      p_note: note || null
    });
    if (error) throw error;
    const payload = normalizeObject(data || {});
    return {
      resetAt: payload.resetAt || payload.reset_at || "",
      milestones: normalizeArray(payload.milestones).map(mapFreeRandomMilestone).sort((a, b) => a.threshold - b.threshold)
    };
  }

  async function adminFetchFreeRandomClaims(limit = 100) {
    const { data, error } = await requireClient().rpc("admin_free_random_recent_claims", {
      p_limit: Math.max(1, Math.min(Number(limit || 100), 500))
    });
    if (error) throw error;
    return normalizeArray(data).map(mapFreeRandomClaim);
  }

  async function redeemDiscountCode({ code, subtotal = 0 }) {
    const normalizedCode = String(code || "").trim();
    if (!normalizedCode) throw new Error("COUPON_REQUIRED");
    const { data, error } = await requireClient().rpc("redeem_discount_code", {
      p_code: normalizedCode,
      p_subtotal: Number(subtotal || 0)
    });
    if (error) throw error;
    const value = normalizeObject(data);
    return {
      ...value,
      discountAmount: Number(value.discountAmount ?? value.discount_amount ?? 0),
      discountValue: Number(value.discountValue ?? value.discount_value ?? 0),
      expiresAt: value.expiresAt || value.expires_at || ""
    };
  }

  async function previewDiscountCode({ code, subtotal = 0 }) {
    const normalizedCode = String(code || "").trim();
    if (!normalizedCode) throw new Error("COUPON_REQUIRED");
    const { data, error } = await requireClient().rpc("preview_discount_code", {
      p_code: normalizedCode,
      p_subtotal: Number(subtotal || 0)
    });
    if (error) throw error;
    const value = normalizeObject(data);
    return {
      ...value,
      discountAmount: Number(value.discountAmount ?? value.discount_amount ?? 0),
      discountValue: Number(value.discountValue ?? value.discount_value ?? 0)
    };
  }

  function mapDiscountCoupon(row = {}) {
    const value = normalizeObject(row);
    return {
      ...value,
      id: value.id || value.codeId || value.code_id || "",
      claimId: value.claimId || value.claim_id || "",
      codeId: value.codeId || value.code_id || value.id || "",
      code: String(value.code || "").toUpperCase(),
      discountType: value.discountType || value.discount_type || "fixed",
      discountValue: Number(value.discountValue ?? value.discount_value ?? 0),
      startsAt: value.startsAt || value.starts_at || "",
      expiresAt: value.expiresAt || value.expires_at || "",
      claimedAt: value.claimedAt || value.claimed_at || "",
      consumedAt: value.consumedAt || value.consumed_at || "",
      orderId: value.orderId || value.order_id || "",
      status: value.status || (value.claimed ? "claimed" : "available"),
      claimed: value.claimed === true || ["claimed", "pending", "consumed"].includes(value.status),
      consumed: value.consumed === true || value.status === "consumed",
      expired: value.expired === true,
      title: value.title || value.notificationTitle || value.notification_title || "กิจกรรมรับโค้ดส่วนลด",
      message: value.message || value.notificationMessage || value.notification_message || "",
      linkUrl: value.linkUrl || value.link_url || value.notificationLinkUrl || ""
    };
  }

  async function fetchDiscountCampaigns() {
    const { data, error } = await requireClient().rpc("list_discount_campaigns");
    if (error) throw error;
    const payload = normalizeArray(data);
    // Campaigns intentionally omit the real code until the signed-in owner
    // claims them. Keep rows by id so Profile can render a locked card.
    return payload.map(mapDiscountCoupon).filter((item) => item.codeId || item.id);
  }

  async function claimDiscountCampaign(codeId) {
    const id = String(codeId || "").trim();
    if (!id) throw new Error("COUPON_CAMPAIGN_REQUIRED");
    const { data, error } = await requireClient().rpc("claim_discount_campaign", { p_code_id: id });
    if (error) throw error;
    return mapDiscountCoupon(normalizeObject(data));
  }

  async function fetchMyDiscountCoupons() {
    const { data, error } = await requireClient().rpc("list_my_discount_coupons");
    if (error) throw error;
    return normalizeArray(data).map(mapDiscountCoupon).filter((item) => item.code);
  }

  async function fetchAdminDiscountCodes() {
    const { data, error } = await requireClient().rpc("admin_list_discount_codes");
    if (error) throw error;
    return normalizeArray(data).map((row) => ({
      ...normalizeObject(row),
      id: row.id || "",
      code: row.code || "",
      discountType: row.discount_type || row.discountType || "fixed",
      discountValue: Number(row.discount_value ?? row.discountValue ?? 0),
      startsAt: row.starts_at || row.startsAt || "",
      expiresAt: row.expires_at || row.expiresAt || "",
      usageLimit: row.usage_limit == null ? null : Number(row.usage_limit),
      usedCount: Number(row.used_count || 0),
      isActive: row.is_active !== false,
      freeCampaign: row.free_campaign === true
    }));
  }

  async function saveAdminDiscountCode(code = {}) {
    const { data, error } = await requireClient().rpc("admin_save_discount_code", {
      p_id: code.id || null,
      p_code: code.code || "",
      p_discount_type: code.discountType || code.discount_type || "fixed",
      p_discount_value: Number(code.discountValue ?? code.discount_value ?? 0),
      p_starts_at: code.startsAt || code.starts_at || null,
      p_expires_at: code.expiresAt || code.expires_at || null,
      p_usage_limit: code.usageLimit == null || code.usageLimit === "" ? null : Number(code.usageLimit),
      p_is_active: code.isActive !== false,
      p_free_campaign: code.freeCampaign === true,
      p_notification_title: code.notificationTitle || code.notification_title || null,
      p_notification_message: code.notificationMessage || code.notification_message || null,
      p_notification_link_url: code.notificationLinkUrl || code.notification_link_url || null
    });
    if (error) throw error;
    return normalizeObject(data);
  }

  async function deactivateAdminDiscountCode(id) {
    const { data, error } = await requireClient().rpc("admin_deactivate_discount_code", { p_id: id });
    if (error) throw error;
    return normalizeObject(data);
  }

  async function createOrder({ productId, quantity, paymentMethod, customerName, packageId, pointsToUse = 0, couponCode = "", couponSubtotal = 0 }) {
    const normalizedCouponCode = String(couponCode || "").trim();
    const payload = {
      p_product_id: productId,
      p_quantity: Number(quantity || 1),
      p_payment_method: paymentMethod || "promptpay",
      p_customer_name: customerName || ""
    };
    if (packageId) payload.p_package_id = packageId;
    const normalizedPoints = Number(pointsToUse || 0);
    if (Number.isFinite(normalizedPoints) && normalizedPoints > 0) {
      payload.p_points_to_use = normalizedPoints;
    }

    if (normalizedCouponCode) {
      payload.p_discount_code = normalizedCouponCode;
      payload.p_coupon_subtotal = Number(couponSubtotal || 0);
    }
    const rpcName = normalizedCouponCode ? "create_order_with_discount" : "create_order";
    const { data, error } = await requireClient().rpc(rpcName, payload);
    if (error) throw error;
    return withPaymentSlipUrl(mapOrderRpcPayload(data));
  }

  async function createCartOrder({ items, paymentMethod, customerName, pointsToUse = 0, couponCode = "", couponSubtotal = 0 }) {
    const normalizedItems = normalizeArray(items)
      .map((item) => ({
        product_id: item.productId || item.product_id || item.id || "",
        quantity: Math.max(1, Number(item.quantity || 1)),
        package_id: item.packageId || item.package_id || null
      }))
      .filter((item) => item.product_id);

    if (!normalizedItems.length) throw new Error("CART_ITEMS_REQUIRED");

    const normalizedCouponCode = String(couponCode || "").trim();

    const payload = {
      p_items: normalizedItems,
      p_payment_method: paymentMethod || "promptpay",
      p_customer_name: customerName || ""
    };
    const normalizedPoints = Number(pointsToUse || 0);
    if (Number.isFinite(normalizedPoints) && normalizedPoints > 0) {
      payload.p_points_to_use = normalizedPoints;
    }

    if (normalizedCouponCode) {
      payload.p_discount_code = normalizedCouponCode;
      payload.p_coupon_subtotal = Number(couponSubtotal || 0);
    }
    const rpcName = normalizedCouponCode ? "create_cart_order_with_discount" : "create_cart_order";
    const { data, error } = await requireClient().rpc(rpcName, payload);
    if (error) throw error;
    return withPaymentSlipUrl(mapOrderRpcPayload(data));
  }

  async function createPointTopupOrder({ amount, paymentMethod, customerName }) {
    const normalizedAmount = Number(amount || 0);
    if (!Number.isFinite(normalizedAmount) || normalizedAmount < 1) {
      throw new Error("INVALID_POINT_TOPUP_AMOUNT");
    }

    const { data, error } = await requireClient().rpc("create_point_topup_order", {
      p_amount: normalizedAmount,
      p_payment_method: paymentMethod || "promptpay",
      p_customer_name: customerName || ""
    });
    if (error) throw error;
    return withPaymentSlipUrl(mapOrderRpcPayload(data));
  }

  async function fetchMyOrders(options = {}) {
    const includeSlipUrls = options === true || options?.includeSlipUrls === true;
    const summaryOnly = options?.summary === true;
    const columns = summaryOnly
      ? [
          "id", "order_number", "status", "payment_status", "payment_method",
          "subtotal", "discount_amount", "total", "points_redeemed_amount", "point_credit_amount",
          "expires_at", "created_at", "updated_at",
          "order_items(id,order_id,product_id,product_name,product_image_url,quantity,created_at)"
        ].join(",")
      : "*, order_items(*)";
    const { data, error } = await requireClient()
      .from("orders")
      .select(columns)
      .order("created_at", { ascending: false });
    if (error) throw error;
    const orders = normalizeArray(data).map(mapOrderRow).filter(Boolean);
    return includeSlipUrls ? withPaymentSlipUrls(orders) : orders;
  }

  async function fetchRecentPublicPurchases(limit = 10) {
    const safeLimit = Math.max(1, Math.min(20, Number(limit || 10)));
    const { data, error } = await requireClient().rpc("fetch_recent_public_purchases", {
      p_limit: safeLimit
    });
    if (error) throw error;
    return normalizeArray(data).map(mapRecentPurchaseRow).filter(Boolean);
  }

  async function fetchOrderById(orderId) {
    const { data, error } = await requireClient()
      .from("orders")
      .select("*, order_items(*)")
      .eq("id", orderId)
      .maybeSingle();
    if (error) throw error;
    return withPaymentSlipUrl(mapOrderRow(data));
  }

  async function cancelMyOrder(orderId) {
    const { data, error } = await requireClient().rpc("cancel_my_order", {
      p_order_id: orderId
    });
    if (error) throw error;
    const payload = data && typeof data === "string" ? JSON.parse(data) : data;
    const order = await withPaymentSlipUrl(mapOrderRpcPayload(payload));
    if (!order) return order;
    return {
      ...order,
      pointRefundAmount: Number(payload?.pointRefundAmount ?? payload?.point_refund_amount ?? 0),
      pointRefunded: payload?.pointRefunded === true || payload?.point_refunded === true
    };
  }

  async function fetchAdminOrders(options = {}) {
    const includeSlipUrls = options === true || options?.includeSlipUrls === true;
    const { data, error } = await requireClient()
      .from("orders")
      .select("*, order_items(*)")
      .order("created_at", { ascending: false });
    if (error) throw error;
    const orders = normalizeArray(data).map(mapOrderRow).filter(Boolean);
    return includeSlipUrls ? withPaymentSlipUrls(orders) : orders;
  }

  function mapAdminFinanceWalletRow(row = {}) {
    return {
      userId: row.userId || row.user_id || "",
      email: row.email || "",
      username: row.username || "",
      displayName: row.displayName || row.display_name || row.fullName || row.full_name || row.username || row.email || "",
      fullName: row.fullName || row.full_name || "",
      role: row.role || "customer",
      status: row.status || "active",
      balance: Number(row.balance || 0),
      lifetimeEarned: Number(row.lifetimeEarned ?? row.lifetime_earned ?? 0),
      lifetimeSpent: Number(row.lifetimeSpent ?? row.lifetime_spent ?? 0),
      updatedAt: row.updatedAt || row.updated_at || ""
    };
  }

  function mapAdminPointTransactionRow(row = {}) {
    return {
      id: row.id || "",
      userId: row.userId || row.user_id || "",
      orderId: row.orderId || row.order_id || "",
      orderNumber: row.orderNumber || row.order_number || "",
      paymentVerificationId: row.paymentVerificationId || row.payment_verification_id || "",
      type: row.type || "",
      amount: Number(row.amount || 0),
      balanceAfter: row.balanceAfter == null && row.balance_after == null ? null : Number(row.balanceAfter ?? row.balance_after ?? 0),
      note: row.note || "",
      metadata: normalizeObject(row.metadata),
      userName: row.userName || row.user_name || row.displayName || row.display_name || row.fullName || row.full_name || row.username || row.email || "",
      email: row.email || "",
      createdAt: row.createdAt || row.created_at || ""
    };
  }

  function mapAdminPaymentVerificationRow(row = {}) {
    return {
      id: row.id || "",
      orderId: row.orderId || row.order_id || "",
      orderNumber: row.orderNumber || row.order_number || "",
      userId: row.userId || row.user_id || "",
      email: row.email || "",
      customerName: row.customerName || row.customer_name || "",
      provider: row.provider || "",
      status: row.status || "",
      payloadType: row.payloadType || row.payload_type || "",
      providerTransactionId: row.providerTransactionId || row.provider_transaction_id || "",
      verifiedAmount: row.verifiedAmount == null && row.verified_amount == null ? null : Number(row.verifiedAmount ?? row.verified_amount ?? 0),
      receiverName: row.receiverName || row.receiver_name || "",
      transferredAt: row.transferredAt || row.transferred_at || "",
      errorCode: row.errorCode || row.error_code || "",
      attemptCount: Number(row.attemptCount || row.attempt_count || 0),
      createdAt: row.createdAt || row.created_at || "",
      updatedAt: row.updatedAt || row.updated_at || ""
    };
  }

  function normalizeAdminFinancePayload(payload = {}) {
    return {
      wallets: normalizeArray(payload.wallets).map(mapAdminFinanceWalletRow).filter((row) => row.userId),
      pointTransactions: normalizeArray(payload.pointTransactions || payload.point_transactions)
        .map(mapAdminPointTransactionRow)
        .filter((row) => row.id || row.userId),
      paymentVerifications: normalizeArray(payload.paymentVerifications || payload.payment_verifications)
        .map(mapAdminPaymentVerificationRow)
        .filter((row) => row.id),
      summary: normalizeObject(payload.summary)
    };
  }

  async function fetchAdminFinanceOverview() {
    const client = requireClient();
    const rpcResult = await client.rpc("admin_finance_overview");
    if (!rpcResult.error) return normalizeAdminFinancePayload(rpcResult.data || {});

    const rpcMessage = String(rpcResult.error?.message || "");
    const missingRpc =
      rpcResult.error?.code === "PGRST202" ||
      rpcResult.error?.code === "42883" ||
      rpcMessage.includes("admin_finance_overview") ||
      rpcMessage.toLowerCase().includes("schema cache");
    if (!missingRpc) throw rpcResult.error;

    const [walletResult, txResult, verificationResult] = await Promise.all([
      client.from("user_points").select("*").order("updated_at", { ascending: false }).limit(500),
      client.from("point_transactions").select("*").order("created_at", { ascending: false }).limit(300),
      client
        .from("payment_verifications")
        .select("id, order_id, user_id, payload_type, provider, status, provider_transaction_id, verified_amount, receiver_name, transferred_at, error_code, attempt_count, created_at, updated_at")
        .order("created_at", { ascending: false })
        .limit(300)
    ]);

    if (walletResult.error) throw walletResult.error;
    if (txResult.error) throw txResult.error;
    if (verificationResult.error) throw verificationResult.error;

    return normalizeAdminFinancePayload({
      wallets: normalizeArray(walletResult.data),
      pointTransactions: normalizeArray(txResult.data),
      paymentVerifications: normalizeArray(verificationResult.data)
    });
  }

  async function adminAdjustUserPoints({ userId, amount, note }) {
    const targetUserId = String(userId || "").trim();
    const normalizedAmount = Number(amount || 0);
    if (!targetUserId) throw new Error("USER_REQUIRED");
    if (!Number.isFinite(normalizedAmount) || normalizedAmount === 0) throw new Error("POINT_AMOUNT_REQUIRED");

    const { data, error } = await requireClient().rpc("admin_adjust_user_points", {
      p_user_id: targetUserId,
      p_amount: normalizedAmount,
      p_note: note || null
    });
    if (error) throw error;
    return normalizeAdminFinancePayload(data || {});
  }

  async function adminUpdateOrder({ orderId, status, deliveryNote, deliveredPayload }) {
    const { data, error } = await requireClient().rpc("admin_update_order", {
      p_order_id: orderId,
      p_status: status || null,
      p_delivery_note: deliveryNote ?? null,
      p_delivered_payload: deliveredPayload ?? null
    });
    if (error) throw error;
    return withPaymentSlipUrl(mapOrderRpcPayload(data));
  }

  async function fetchStockMovements() {
    const { data, error } = await requireClient()
      .from("stock_movements")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(40);
    if (error) throw error;
    return normalizeArray(data).map((row) => ({
      id: row.id,
      productId: row.product_id,
      packageId: row.package_id || "",
      orderId: row.order_id,
      movementType: row.movement_type,
      quantityChange: Number(row.quantity_change || 0),
      note: row.note || "",
      createdBy: row.created_by || "",
      createdAt: row.created_at || ""
    }));
  }

  window.olafSupabase = client;
  window.OlafSupabaseAuth = {
    isConfigured,
    getCurrentUser,
    getAdminAccess,
    normalizeReturnPath,
    signUp,
    signIn,
    signInWithGoogle,
    signOut,
    updateProfile,
    updatePassword,
    buildOAuthRedirectUrl,
    getOAuthReturnTo
  };
  window.OlafProducts = {
    mapProductRow,
    mapProductPackageRow,
    mapOfflineStockItemRow,
    mapInventorySummaryRow,
    fetchActiveProducts,
    fetchProductById,
    fetchRelatedProducts,
    fetchAdminProducts,
    upsertAdminProduct,
    deactivateAdminProduct,
    setAdminProductStock,
    fetchProductPackages,
    fetchActiveProductPackages,
    adminFetchProductPackages,
    adminSaveProductPackages,
    adminDeleteProductPackage,
    adminFetchOfflineStockItems,
    adminReplaceOfflineStockItems,
    adminFetchInventorySummary,
    adminResizeOfflineStock,
    invalidateProductCatalogCache
  };
  window.OlafAdminUsers = {
    fetchAdminUsers,
    saveAdminUser,
    disableAdminUser,
    adminSetUserPassword
  };
  window.OlafAdminFinance = {
    fetchAdminFinanceOverview,
    adminAdjustUserPoints
  };
  window.OlafFreeRandom = {
    fetchConfig: fetchFreeRandomConfig,
    fetchStatus: fetchMyFreeRandomStatus,
    claimSpin: claimFreeRandomSpin,
    fetchMilestones: fetchFreeRandomMilestones,
    fetchMilestoneStatus: fetchMyFreeRandomMilestoneStatus,
    fetchMilestoneForClaim: fetchFreeRandomMilestoneForClaim,
    claimMilestone: claimFreeRandomMilestone,
    adminFetchSettings: adminFetchFreeRandomSettings,
    adminSaveSettings: adminSaveFreeRandomSettings,
    adminFetchMilestones: adminFetchFreeRandomMilestones,
    adminSaveMilestones: adminSaveFreeRandomMilestones,
    adminResetSpinCounts: adminResetFreeRandomSpinCounts,
    adminFetchClaims: adminFetchFreeRandomClaims
  };
  window.OlafStoreSettings = {
    fetchStoreSettings,
    saveStoreSettings,
    fetchPaymentChannels,
    savePaymentChannels,
    uploadPaymentQr,
    uploadStoreAsset,
    createPaymentQrSignedUrl,
    invalidateStoreSettingsCache
  };
  window.OlafCoupons = {
    redeem: redeemDiscountCode,
    preview: previewDiscountCode,
    fetchCampaigns: fetchDiscountCampaigns,
    claimCampaign: claimDiscountCampaign,
    fetchMine: fetchMyDiscountCoupons,
    fetchAdmin: fetchAdminDiscountCodes,
    saveAdmin: saveAdminDiscountCode,
    deactivateAdmin: deactivateAdminDiscountCode
  };
  window.OlafOrders = {
    mapOrderRow,
    createOrder,
    createCartOrder,
    createPointTopupOrder,
    fetchMyOrders,
    fetchOrderById,
    cancelMyOrder,
    fetchRecentPublicPurchases,
    fetchAdminOrders,
    adminUpdateOrder,
    uploadPaymentSlip,
    verifyPaymentSlip,
    createPaymentSlipSignedUrl,
    fetchStockMovements,
    fetchPointBalance
  };
})();
