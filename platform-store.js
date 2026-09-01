(function () {
  const keys = {
    reviews: "olafshop_reviews",
    widgets: "olafshop_widgets",
    widgetSeeded: "olafshop_widgets_seeded_v3",
    userCache: "olafshop_user_cache_v1"
  };

  const legacyAuthKeys = ["olafshop_users", "olafshop_session"];
  const legacyOrderKeys = ["olafshop_orders"];

  const defaultWidgets = [
    {
      id: "preset-steam-showcase",
      title: "Steam Showcase",
      placement: "home",
      status: "active",
      code: '<div class="olaf-widget" data-olaf-widget="steam-showcase"></div>'
    },
    {
      id: "preset-trust-cards",
      title: "Service Glass Cards",
      placement: "home",
      status: "active",
      code: '<div class="olaf-widget" data-olaf-widget="trust-cards"></div>'
    },
    {
      id: "preset-social-strip",
      title: "Social Community",
      placement: "home",
      status: "active",
      code: '<div class="olaf-widget" data-olaf-widget="social-strip"></div>'
    },
    {
      id: "preset-license-cards",
      title: "Windows License Cards",
      placement: "home",
      status: "active",
      code: '<div class="olaf-widget" data-olaf-widget="license-cards"></div>'
    }
  ];

  let cachedUser = readCachedUser();

  function clone(value) {
    return JSON.parse(JSON.stringify(value));
  }

  function uid(prefix) {
    const random =
      typeof crypto !== "undefined" && crypto.randomUUID
        ? crypto.randomUUID().slice(0, 8)
        : Math.random().toString(36).slice(2, 10);
    return `${prefix}-${Date.now().toString(36)}-${random}`;
  }

  function read(key, fallback) {
    try {
      const stored = localStorage.getItem(key);
      return stored ? JSON.parse(stored) : fallback;
    } catch (error) {
      return fallback;
    }
  }

  function write(key, value) {
    localStorage.setItem(key, JSON.stringify(value));
  }

  function readCachedUser() {
    try {
      const raw = sessionStorage.getItem(keys.userCache);
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      if (!parsed?.id || !parsed?.email) return null;
      return parsed;
    } catch (error) {
      return null;
    }
  }

  function writeCachedUser(user) {
    try {
      if (user?.id) sessionStorage.setItem(keys.userCache, JSON.stringify(user));
      else sessionStorage.removeItem(keys.userCache);
    } catch (error) {
      console.warn("Unable to persist user cache", error);
    }
  }

  function clearLegacyCustomerAuth() {
    legacyAuthKeys.forEach((key) => localStorage.removeItem(key));
  }

  function clearLegacyOrders() {
    // Orders are now stored in Supabase only. Do not migrate local test orders.
    legacyOrderKeys.forEach((key) => localStorage.removeItem(key));
  }

  function ensureAuthAvailable() {
    if (!window.OlafSupabaseAuth?.isConfigured) {
      throw new Error("ยังไม่ได้ตั้งค่า Supabase สำหรับระบบสมาชิก");
    }
  }

  async function refreshCurrentUser() {
    clearLegacyCustomerAuth();
    clearLegacyOrders();
    if (!window.OlafSupabaseAuth?.isConfigured) {
      cachedUser = null;
      return null;
    }
    cachedUser = await window.OlafSupabaseAuth.getCurrentUser();
    writeCachedUser(cachedUser);
    return cachedUser;
  }

  const ready = refreshCurrentUser().catch((error) => {
    console.warn("Supabase auth initialization failed", error);
    return cachedUser;
  });

  function currentUser() {
    return cachedUser;
  }

  async function signUp(input) {
    ensureAuthAvailable();
    const fullName = String(input.fullName || input.displayName || input.username || "").trim();
    cachedUser = await window.OlafSupabaseAuth.signUp({
      email: String(input.email || "").trim().toLowerCase(),
      password: String(input.password || ""),
      fullName
    });
    writeCachedUser(cachedUser);
    return cachedUser;
  }

  async function signIn(email, password) {
    ensureAuthAvailable();
    cachedUser = await window.OlafSupabaseAuth.signIn({
      email: String(email || "").trim().toLowerCase(),
      password: String(password || "")
    });
    writeCachedUser(cachedUser);
    return cachedUser;
  }

  async function signInWithGoogle(options = {}) {
    ensureAuthAvailable();
    if (!window.OlafSupabaseAuth?.signInWithGoogle) {
      throw new Error("ระบบเข้าสู่ระบบด้วย Google ยังไม่พร้อมใช้งาน");
    }
    return window.OlafSupabaseAuth.signInWithGoogle(options);
  }

  async function logout(options = {}) {
    if (!options.skipRemoteSignOut && window.OlafSupabaseAuth?.isConfigured) {
      await window.OlafSupabaseAuth.signOut();
    }
    cachedUser = null;
    writeCachedUser(null);
    clearLegacyCustomerAuth();
  }

  async function updateUser(id, patch) {
    if (!cachedUser || cachedUser.id !== id) throw new Error("กรุณาเข้าสู่ระบบก่อนแก้ไขโปรไฟล์");
    ensureAuthAvailable();
    cachedUser = await window.OlafSupabaseAuth.updateProfile({
      username: patch.username || cachedUser.username,
      fullName: patch.fullName || patch.displayName || patch.username || cachedUser.displayName
    });
    writeCachedUser(cachedUser);
    return cachedUser;
  }

  function ensureAdminUsersAvailable() {
    if (!window.OlafAdminUsers?.fetchAdminUsers) {
      throw new Error("Supabase admin user API is not ready");
    }
  }

  async function getAdminUsers() {
    ensureAuthAvailable();
    ensureAdminUsersAvailable();
    return window.OlafAdminUsers.fetchAdminUsers();
  }

  async function createAdminUser(input) {
    ensureAuthAvailable();
    ensureAdminUsersAvailable();
    return window.OlafAdminUsers.saveAdminUser(input);
  }

  async function updateAdminUser(id, patch) {
    ensureAuthAvailable();
    ensureAdminUsersAvailable();
    return window.OlafAdminUsers.saveAdminUser({ ...patch, id });
  }

  async function deleteAdminUser(id) {
    ensureAuthAvailable();
    ensureAdminUsersAvailable();
    return window.OlafAdminUsers.disableAdminUser(id);
  }

  async function changePassword(id, oldPassword, newPassword) {
    if (!cachedUser || cachedUser.id !== id) throw new Error("กรุณาเข้าสู่ระบบก่อนเปลี่ยนรหัสผ่าน");
    ensureAuthAvailable();
    if (!window.OlafSupabaseAuth?.updatePassword) {
      throw new Error("ระบบเปลี่ยนรหัสผ่านยังไม่พร้อมใช้งาน");
    }
    cachedUser = await window.OlafSupabaseAuth.updatePassword({
      email: cachedUser.email,
      oldPassword,
      newPassword
    });
    writeCachedUser(cachedUser);
    return cachedUser;
  }

  // Legacy localStorage kept only for non-migrated reviews/widgets.
  function getReviews() {
    return read(keys.reviews, []);
  }

  function saveReviews(reviews) {
    write(keys.reviews, reviews);
  }

  function createReview(input) {
    const reviews = getReviews();
    const review = {
      id: input.id || uid("rev"),
      orderId: input.orderId || "",
      productId: input.productId || "",
      productName: input.productName || "",
      userId: input.userId || null,
      username: input.username || "Guest",
      rating: Math.max(1, Math.min(5, Number(input.rating) || 5)),
      title: String(input.title || "").trim(),
      body: String(input.body || "").trim(),
      status: input.status || "published",
      createdAt: input.createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    reviews.unshift(review);
    saveReviews(reviews);
    return review;
  }

  function updateReview(id, patch) {
    const reviews = getReviews();
    const index = reviews.findIndex((review) => review.id === id);
    if (index < 0) throw new Error("ไม่พบรีวิว");
    reviews[index] = {
      ...reviews[index],
      ...patch,
      rating: Math.max(1, Math.min(5, Number(patch.rating ?? reviews[index].rating) || 5)),
      updatedAt: new Date().toISOString()
    };
    saveReviews(reviews);
    return reviews[index];
  }

  function deleteReview(id) {
    saveReviews(getReviews().filter((review) => review.id !== id));
  }

  function getWidgets() {
    const widgets = read(keys.widgets, []);
    if (!localStorage.getItem(keys.widgetSeeded)) {
      const existing = (Array.isArray(widgets) ? widgets : []).map((widget) => {
        const defaultWidget = defaultWidgets.find((item) => item.id === widget.id);
        return defaultWidget
          ? {
              ...widget,
              status: defaultWidget.status,
              code: defaultWidget.code,
              updatedAt: new Date().toISOString()
            }
          : widget;
      });
      const missingDefaults = defaultWidgets
        .filter((defaultWidget) => !existing.some((widget) => widget.id === defaultWidget.id))
        .map((widget) => ({
          ...clone(widget),
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        }));
      const seededWidgets = [...missingDefaults, ...existing];
      saveWidgets(seededWidgets);
      localStorage.setItem(keys.widgetSeeded, "1");
      return seededWidgets;
    }
    return Array.isArray(widgets) ? widgets : [];
  }

  function saveWidgets(widgets) {
    write(keys.widgets, widgets);
  }

  function createWidget(input) {
    const widgets = getWidgets();
    const widget = {
      id: input.id || uid("wdg"),
      title: input.title || "Widget",
      placement: input.placement || "home",
      code: input.code || "",
      status: input.status || "active",
      createdAt: input.createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    widgets.unshift(widget);
    saveWidgets(widgets);
    return widget;
  }

  function updateWidget(id, patch) {
    const widgets = getWidgets();
    const index = widgets.findIndex((widget) => widget.id === id);
    if (index < 0) throw new Error("ไม่พบ widget");
    widgets[index] = {
      ...widgets[index],
      ...patch,
      updatedAt: new Date().toISOString()
    };
    saveWidgets(widgets);
    return widgets[index];
  }

  function deleteWidget(id) {
    saveWidgets(getWidgets().filter((widget) => widget.id !== id));
  }

  window.OlafStore = {
    keys,
    ready,
    uid,
    refreshCurrentUser,
    currentUser,
    signUp,
    signIn,
    signInWithGoogle,
    logout,
    updateUser,
    changePassword,
    getUsers: getAdminUsers,
    saveUsers: getAdminUsers,
    createUser: createAdminUser,
    deleteUser: deleteAdminUser,
    login: signIn,
    getSession: () => (cachedUser ? { userId: cachedUser.id } : null),
    getReviews,
    saveReviews,
    createReview,
    updateReview,
    deleteReview,
    getWidgets,
    saveWidgets,
    createWidget,
    updateWidget,
    deleteWidget
  };
})();
