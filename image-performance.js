(function () {
  const FALLBACK_IMAGE =
    "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 800 450'%3E%3Crect width='800' height='450' fill='%230f172a'/%3E%3Cpath d='M0 340h800v110H0z' fill='%23020617'/%3E%3Ccircle cx='620' cy='110' r='70' fill='%231e3a8a' opacity='.45'/%3E%3Cpath d='M120 315l150-150 105 105 70-70 180 180H120z' fill='%231e40af' opacity='.7'/%3E%3C/svg%3E";

  const preconnected = new Set();
  const preloaded = new Set();
  let hydrateQueued = false;
  let fallbackIconQueued = false;
  let nearViewportObserver = null;

  function escapeAttr(value = "") {
    return String(value).replace(/[&<>"']/g, (char) => {
      const entities = {
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#039;"
      };
      return entities[char];
    });
  }

  function idle(callback, timeout = 250) {
    if ("requestIdleCallback" in window) {
      window.requestIdleCallback(callback, { timeout });
      return;
    }
    window.setTimeout(callback, 40);
  }

  function hostFromUrl(url) {
    try {
      const parsed = new URL(url, window.location.href);
      return parsed.origin;
    } catch (error) {
      return "";
    }
  }

  function preconnect(url) {
    const origin = hostFromUrl(url);
    if (!origin || origin === window.location.origin || preconnected.has(origin)) return;
    preconnected.add(origin);
    const link = document.createElement("link");
    link.rel = "preconnect";
    link.href = origin;
    link.crossOrigin = "";
    document.head.append(link);
  }

  function preload(url, options = {}) {
    const src = String(url || "").trim();
    if (!src || preloaded.has(src)) return;
    preloaded.add(src);
    preconnect(src);
    const link = document.createElement("link");
    link.rel = "preload";
    link.as = "image";
    link.href = src;
    if (options.fetchPriority || options.priority) {
      link.fetchPriority = options.fetchPriority || "high";
    }
    document.head.append(link);
  }

  function imgAttrs(src, alt = "", options = {}) {
    const url = String(src || "").trim();
    const priority = options.priority === true;
    const loading = priority || options.loading === "eager" ? "eager" : "lazy";
    const fetchPriority = priority ? "high" : options.fetchPriority || "low";
    const className = options.className ? ` class="${escapeAttr(options.className)}"` : "";
    const sizes = options.sizes ? ` sizes="${escapeAttr(options.sizes)}"` : "";
    const srcset = options.srcset ? ` srcset="${escapeAttr(options.srcset)}"` : "";
    const width = options.width ? ` width="${escapeAttr(options.width)}"` : "";
    const height = options.height ? ` height="${escapeAttr(options.height)}"` : "";
    const fallbacks = Array.isArray(options.fallbacks)
      ? [...new Set(options.fallbacks.map((value) => String(value || "").trim()).filter(Boolean))]
      : [];
    const fallbackAttr = fallbacks.length
      ? ` data-image-fallbacks="${escapeAttr(JSON.stringify(fallbacks))}"`
      : "";
    const source = url || FALLBACK_IMAGE;
    if (priority) preload(source, { priority: true });
    else preconnect(source);
    return `${className} src="${escapeAttr(source)}" alt="${escapeAttr(alt)}" loading="${loading}" decoding="async" fetchpriority="${fetchPriority}"${width}${height}${sizes}${srcset}${fallbackAttr} data-fast-img`;
  }

  function bgAttrs(src) {
    const url = String(src || "").trim();
    if (!url) return "";
    preconnect(url);
    return `data-bg-lazy="${escapeAttr(url)}"`;
  }

  function hydrateImage(img) {
    if (!img || img.dataset.fastHydrated === "true") return;
    img.dataset.fastHydrated = "true";
    img.decoding = "async";
    if (!img.getAttribute("loading") && img.getAttribute("fetchpriority") !== "high") {
      img.loading = "lazy";
    }
    if (!img.getAttribute("fetchpriority")) {
      img.fetchPriority = img.loading === "eager" ? "high" : "low";
    }
    preconnect(img.currentSrc || img.src);
    if (img.loading === "lazy" && "IntersectionObserver" in window) {
      if (!nearViewportObserver) {
        nearViewportObserver = new IntersectionObserver(
          (entries) => {
            entries.forEach((entry) => {
              if (!entry.isIntersecting) return;
              const target = entry.target;
              nearViewportObserver.unobserve(target);
              target.fetchPriority = "high";
              target.loading = "eager";
            });
          },
          { rootMargin: "720px 0px", threshold: 0.01 }
        );
      }
      nearViewportObserver.observe(img);
    }
    if (img.complete && img.naturalWidth > 0) {
      img.classList.add("is-loaded");
    }
  }

  function hydrateBackgrounds(root) {
    const scope = root?.querySelectorAll ? root : document;
    scope.querySelectorAll("[data-bg-lazy]").forEach((element) => {
      if (element.dataset.bgLoaded === "true") return;
      const url = element.dataset.bgLazy;
      element.dataset.bgLoaded = "true";
      idle(() => {
        element.style.backgroundImage = `url("${url.replace(/"/g, "%22")}")`;
        element.classList.add("is-bg-loaded");
      }, 500);
    });
  }

  function hydrate(root = document) {
    const scope = root?.querySelectorAll ? root : document;
    scope.querySelectorAll("img").forEach(hydrateImage);
    hydrateBackgrounds(scope);
  }

  function scheduleHydrate(root = document) {
    if (hydrateQueued) return;
    hydrateQueued = true;
    idle(() => {
      hydrateQueued = false;
      hydrate(root);
    });
  }

  function lucideApi() {
    if (window.lucide?.createIcons) return window.lucide;
    try {
      if (typeof lucide !== "undefined" && lucide?.createIcons) return lucide;
    } catch (error) {
      return null;
    }
    return null;
  }

  function fallbackIconSvg(name) {
    const safeName = escapeAttr(name || "icon");
    return `
      <svg class="lucide lucide-fallback" data-lucide-fallback="${safeName}" xmlns="http://www.w3.org/2000/svg" width="24" height="24"
        viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"
        stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">
        <circle cx="12" cy="12" r="8"></circle>
        <path d="M12 8v4l3 3"></path>
      </svg>
    `;
  }

  function createFallbackIcons(root = document) {
    const scope = root?.querySelectorAll ? root : document;
    scope.querySelectorAll("i[data-lucide]").forEach((icon) => {
      const name = icon.getAttribute("data-lucide") || "icon";
      icon.insertAdjacentHTML("afterend", fallbackIconSvg(name));
      icon.remove();
    });
  }

  function refreshIcons(root = document) {
    const api = lucideApi();
    if (api?.createIcons) {
      api.createIcons();
      return;
    }
    if (fallbackIconQueued) return;
    fallbackIconQueued = true;
    idle(() => {
      fallbackIconQueued = false;
      if (lucideApi()?.createIcons) {
        lucideApi().createIcons();
        return;
      }
      createFallbackIcons(root);
    }, 1200);
  }

  document.addEventListener(
    "load",
    (event) => {
      const target = event.target;
      if (target?.tagName === "IMG") target.classList.add("is-loaded");
    },
    true
  );

  document.addEventListener(
    "error",
    (event) => {
      const target = event.target;
      if (target?.tagName !== "IMG" || target.dataset.fallbackApplied === "true") return;

      if (target.dataset.imageFallbacks) {
        try {
          const candidates = JSON.parse(target.dataset.imageFallbacks);
          const fallbackIndex = Number(target.dataset.fallbackIndex || 0);
          const nextSource = Array.isArray(candidates) ? candidates[fallbackIndex] : "";
          if (nextSource) {
            target.dataset.fallbackIndex = String(fallbackIndex + 1);
            target.src = nextSource;
            return;
          }
        } catch (error) {
          console.warn("Invalid image fallback list", error);
        }
      }

      target.dataset.fallbackApplied = "true";
      target.src = FALLBACK_IMAGE;
      target.classList.add("is-loaded");
    },
    true
  );

  if ("MutationObserver" in window) {
    const observer = new MutationObserver((records) => {
      for (const record of records) {
        for (const node of record.addedNodes) {
          if (node?.nodeType !== 1) continue;
          if (node.tagName === "IMG" || node.querySelector?.("img,[data-bg-lazy]")) {
            scheduleHydrate(node);
            return;
          }
        }
      }
    });
    document.addEventListener("DOMContentLoaded", () => {
      observer.observe(document.documentElement, { childList: true, subtree: true });
      hydrate(document);
    });
  } else {
    document.addEventListener("DOMContentLoaded", () => hydrate(document));
  }

  window.OlafImages = {
    fallbackImage: FALLBACK_IMAGE,
    attrs: imgAttrs,
    bgAttrs,
    hydrate,
    scheduleHydrate,
    preload,
    preconnect
  };

  window.OlafIcons = {
    refresh: refreshIcons,
    fallback: createFallbackIcons
  };
})();
