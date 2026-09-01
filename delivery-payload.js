(function () {
  const PLATFORM_ALIASES = new Map([
    ["STEAM", "STEAM"],
    ["EA", "EA"],
    ["UBISOFT", "UBISOFT"],
    ["WEBMAIL", "WEBMAIL"],
    ["MAIL", "WEBMAIL"],
    ["EMAIL", "WEBMAIL"],
    ["E-MAIL", "WEBMAIL"],
    ["ROCKSTAR", "ROCKSTAR"],
    ["ROCKSTAR GAMES", "ROCKSTAR"],
    ["FIVEM", "ROCKSTAR"],
    ["MICROSOFT", "MICROSOFT"],
    ["MICROSOFT ACCOUNT", "MICROSOFT"],
    ["XBOX", "MICROSOFT"]
  ]);
  const SUPPORTED_PLATFORMS = new Set(PLATFORM_ALIASES.values());
  const PLATFORM_ORDER = new Map([
    ["STEAM", 0],
    ["EA", 1],
    ["UBISOFT", 2],
    ["WEBMAIL", 3],
    ["ROCKSTAR", 4],
    ["MICROSOFT", 5]
  ]);

  function clean(value) {
    return String(value ?? "").trim();
  }

  function normalizePlatform(value) {
    const key = clean(value).replace(/[：:]+$/u, "").toUpperCase();
    return PLATFORM_ALIASES.get(key) || key;
  }

  function normalizeAccount(account) {
    const platform = normalizePlatform(account?.platform);
    const login = clean(account?.login || account?.username || account?.email);
    const id = clean(account?.id);
    const password = clean(account?.password);
    if (!SUPPORTED_PLATFORMS.has(platform) || (!login && !id) || !password) return null;
    return { platform, login, id, password };
  }

  function normalizeAccounts(accounts) {
    const uniqueAccounts = new Map();
    for (const account of accounts || []) {
      const normalized = normalizeAccount(account);
      if (!normalized || uniqueAccounts.has(normalized.platform)) continue;
      uniqueAccounts.set(normalized.platform, normalized);
    }
    return [...uniqueAccounts.values()].sort(
      (left, right) =>
        (PLATFORM_ORDER.get(left.platform) ?? 99) - (PLATFORM_ORDER.get(right.platform) ?? 99)
    );
  }

  function structuredDelivery(value) {
    if (!value || Number(value.version) !== 1 || !Array.isArray(value.accounts)) return null;
    const accounts = normalizeAccounts(value.accounts);
    if (!accounts.length) return null;
    return { version: 1, accounts };
  }

  function parseJsonDeliveries(text) {
    const deliveries = [];
    try {
      const whole = structuredDelivery(JSON.parse(text));
      if (whole) return [whole];
    } catch (error) {
      // Legacy text or newline-delimited structured payload.
    }

    for (const line of text.split(/\r?\n/)) {
      const candidate = clean(line);
      if (!candidate.startsWith("{") || !candidate.endsWith("}")) continue;
      try {
        const delivery = structuredDelivery(JSON.parse(candidate));
        if (delivery) deliveries.push(delivery);
      } catch (error) {
        // Preserve malformed/non-JSON lines as legacy text.
      }
    }
    return deliveries;
  }

  function parseLegacyAccounts(text) {
    const accounts = new Map();
    let activePlatform = "STEAM";

    for (const rawLine of text.split(/\r?\n/)) {
      const line = clean(rawLine);
      if (!line) continue;
      const platform = normalizePlatform(line);
      if (SUPPORTED_PLATFORMS.has(platform)) {
        activePlatform = platform;
        if (!accounts.has(platform)) accounts.set(platform, { platform, login: "", id: "", password: "" });
        continue;
      }

      const match = line.match(/^(login|user(?:name)?|id|passs?|password)\s*[:：=]\s*(.+)$/iu);
      if (!match) continue;
      const account = accounts.get(activePlatform) || { platform: activePlatform, login: "", id: "", password: "" };
      const field = match[1].toLowerCase();
      if (["login", "user", "username"].includes(field)) account.login = clean(match[2]);
      else if (field === "id") account.id = clean(match[2]);
      else account.password = clean(match[2]);
      accounts.set(activePlatform, account);
    }

    return [...accounts.values()]
      .filter((account) => account.login || account.id || account.password)
      .sort(
        (left, right) =>
          (PLATFORM_ORDER.get(left.platform) ?? 99) - (PLATFORM_ORDER.get(right.platform) ?? 99)
      );
  }

  function parse(value) {
    const rawText = clean(value);
    if (!rawText) {
      return { rawText: "", structured: false, deliveries: [], accounts: [], legacyText: "" };
    }

    const deliveries = parseJsonDeliveries(rawText);
    if (deliveries.length) {
      return {
        rawText,
        structured: true,
        deliveries,
        accounts: deliveries.flatMap((delivery) => delivery.accounts),
        legacyText: ""
      };
    }

    const accounts = parseLegacyAccounts(rawText);
    return {
      rawText,
      structured: false,
      deliveries: accounts.length ? [{ version: 0, accounts }] : [],
      accounts,
      legacyText: rawText
    };
  }

  function fieldValue(account, field) {
    if (!account || !["login", "id", "password"].includes(field)) return "";
    return clean(account[field]);
  }

  function formatAccount(account) {
    if (!account) return "";
    return [
      clean(account.platform),
      account.login ? `Login: ${clean(account.login)}` : "",
      account.id ? `ID: ${clean(account.id)}` : "",
      account.password ? `Pass: ${clean(account.password)}` : ""
    ].filter(Boolean).join("\n");
  }

  function formatAll(parsed) {
    if (!parsed?.deliveries?.length) return clean(parsed?.legacyText || parsed?.rawText);
    return parsed.deliveries
      .map((delivery, index) => {
        const heading = parsed.deliveries.length > 1 ? `ชุดที่ ${index + 1}` : "";
        return [heading, ...delivery.accounts.map(formatAccount)].filter(Boolean).join("\n\n");
      })
      .join("\n\n");
  }

  window.OlafDeliveryPayload = {
    parse,
    fieldValue,
    formatAccount,
    formatAll
  };
})();
