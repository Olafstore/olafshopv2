/* Shared favorites source for Index and product pages.
   Guests use browser storage; signed-in members additionally sync to Supabase
   so their collection follows them between desktop and mobile. */
(function () {
  const guestStorageKey = "olafshop_favorite_products";
  const userStoragePrefix = "olafshop_favorite_products:user:";
  const listeners = new Set();
  let activeUserId = "";
  let ids = new Set(readIds(guestStorageKey));
  let syncRequest = null;
  let realtimeStop = null;
  let realtimeUserId = "";

  function normalizeIds(value) {
    return [...new Set((Array.isArray(value) ? value : []).map((id) => String(id || "").trim()).filter(Boolean))];
  }

  function readIds(key) {
    try {
      return normalizeIds(JSON.parse(window.localStorage.getItem(key) || "[]"));
    } catch {
      return [];
    }
  }

  function storageKeyFor(userId) {
    return userId ? `${userStoragePrefix}${userId}` : guestStorageKey;
  }

  function persist() {
    try {
      window.localStorage.setItem(storageKeyFor(activeUserId), JSON.stringify([...ids]));
    } catch {
      // Keep the in-memory selection when storage is unavailable.
    }
  }

  function publish() {
    const nextIds = [...ids];
    listeners.forEach((listener) => listener(nextIds));
    window.dispatchEvent(new CustomEvent("olaf:favorites-change", { detail: { ids: nextIds } }));
  }

  function replace(nextIds, { save = true, notify = true } = {}) {
    ids = new Set(normalizeIds(nextIds));
    if (save) persist();
    if (notify) publish();
    return [...ids];
  }

  async function getSignedInUser() {
    try {
      const readyUser = await window.OlafStore?.ready;
      return readyUser?.id ? readyUser : window.OlafStore?.currentUser?.() || null;
    } catch {
      return window.OlafStore?.currentUser?.() || null;
    }
  }

  function applyRealtimeFavoriteChange(change = {}) {
    const eventType = String(change.eventType || "").toUpperCase();
    const productId = String(change.new?.product_id || change.old?.product_id || "").trim();
    if (!productId) return;
    if (eventType === "DELETE") ids.delete(productId);
    else ids.add(productId);
    persist();
    publish();
  }

  async function startRealtime(userId) {
    if (!userId || !window.OlafSupabaseAuth?.subscribeMyFavoriteProducts) return;
    if (realtimeUserId === userId && realtimeStop) return;
    realtimeStop?.();
    realtimeStop = null;
    realtimeUserId = "";
    try {
      const stop = await window.OlafSupabaseAuth.subscribeMyFavoriteProducts(applyRealtimeFavoriteChange);
      if (activeUserId !== userId) {
        stop?.();
        return;
      }
      realtimeUserId = userId;
      realtimeStop = typeof stop === "function" ? stop : null;
    } catch (error) {
      // Initial fetch/local storage continue to work when Realtime is unavailable.
      console.warn("Favorite realtime unavailable", error);
    }
  }

  async function sync({ force = false } = {}) {
    const user = await getSignedInUser();
    const userId = String(user?.id || "").trim();
    if (!userId || !window.OlafSupabaseAuth?.fetchMyFavoriteProductIds) return [...ids];
    if (activeUserId === userId && !force) return [...ids];
    if (syncRequest) return syncRequest;

    syncRequest = (async () => {
      const localIds = activeUserId === userId ? [...ids] : readIds(storageKeyFor(userId));
      const startingIds = localIds.length ? localIds : (activeUserId ? localIds : [...ids]);
      activeUserId = userId;
      const remoteIds = await window.OlafSupabaseAuth.fetchMyFavoriteProductIds();
      const remoteSet = new Set(normalizeIds(remoteIds));
      const localOnly = normalizeIds(startingIds).filter((id) => !remoteSet.has(id));
      if (localOnly.length) {
        await Promise.all(localOnly.map((id) => window.OlafSupabaseAuth.addMyFavoriteProduct(id)));
      }
      const nextIds = replace([...remoteSet, ...localOnly]);
      await startRealtime(userId);
      return nextIds;
    })();

    try {
      return await syncRequest;
    } catch (error) {
      // The UI remains usable offline or until the table migration is installed.
      console.warn("Favorite sync unavailable; using this device only", error);
      return [...ids];
    } finally {
      syncRequest = null;
    }
  }

  async function toggle(productId) {
    const id = String(productId || "").trim();
    if (!id) return [...ids];
    const wasSaved = ids.has(id);
    if (wasSaved) ids.delete(id);
    else ids.add(id);
    persist();
    publish();

    const user = window.OlafStore?.currentUser?.() || await getSignedInUser();
    if (user?.id && window.OlafSupabaseAuth) {
      activeUserId = String(user.id);
      persist();
      startRealtime(activeUserId);
      try {
        if (wasSaved) await window.OlafSupabaseAuth.removeMyFavoriteProduct(id);
        else await window.OlafSupabaseAuth.addMyFavoriteProduct(id);
      } catch (error) {
        console.warn("Favorite cloud update unavailable; saved locally", error);
      }
    }
    return [...ids];
  }

  function subscribe(listener) {
    if (typeof listener !== "function") return () => {};
    listeners.add(listener);
    listener([...ids]);
    return () => listeners.delete(listener);
  }

  window.addEventListener("storage", (event) => {
    if (event.key !== storageKeyFor(activeUserId)) return;
    replace(readIds(event.key), { save: false });
  });

  window.OlafFavorites = {
    getIds: () => [...ids],
    subscribe,
    sync,
    toggle
  };
})();
