const PUBLIC_MESSAGES = {
  AUTH_REQUIRED: "กรุณาเข้าสู่ระบบแอดมินใหม่",
  ADMIN_REQUIRED: "บัญชีนี้ไม่มีสิทธิ์แอดมิน",
  CONFIG_REQUIRED: "ยังไม่ได้ตั้งค่า Environment Variables สำหรับจัดการรหัสผ่าน",
  USER_REQUIRED: "ไม่พบ user ที่ต้องการเปลี่ยนรหัสผ่าน",
  PASSWORD_TOO_SHORT: "รหัสผ่านใหม่ต้องมีอย่างน้อย 6 ตัวอักษร",
  PASSWORD_UPDATE_FAILED: "เปลี่ยนรหัสผ่านไม่สำเร็จ"
};

class AdminApiError extends Error {
  constructor(code, status = 400, detail = "") {
    super(PUBLIC_MESSAGES[code] || code);
    this.code = code;
    this.status = status;
    this.detail = detail;
  }
}

function clean(value) {
  return String(value ?? "").trim();
}

function json(response, status, payload) {
  response.setHeader("Content-Type", "application/json; charset=utf-8");
  response.setHeader("Cache-Control", "no-store");
  response.status(status).json(payload);
}

function parseBody(request) {
  if (request.body && typeof request.body === "object") return request.body;
  if (typeof request.body === "string" && request.body.trim()) {
    try {
      return JSON.parse(request.body);
    } catch {
      return {};
    }
  }
  return {};
}

function serverConfig() {
  const supabaseUrl = clean(process.env.SUPABASE_URL).replace(/\/+$/, "");
  const serviceRoleKey = clean(process.env.SUPABASE_SERVICE_ROLE_KEY);
  const publishableKey = clean(process.env.SUPABASE_PUBLISHABLE_KEY || process.env.SUPABASE_ANON_KEY);
  if (!supabaseUrl || !serviceRoleKey || !publishableKey) {
    throw new AdminApiError("CONFIG_REQUIRED", 503);
  }
  return { supabaseUrl, serviceRoleKey, publishableKey };
}

function serviceHeaders(config, extra = {}) {
  return {
    apikey: config.serviceRoleKey,
    Authorization: `Bearer ${config.serviceRoleKey}`,
    ...extra
  };
}

async function readJson(response) {
  const text = await response.text();
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    return { message: text };
  }
}

async function authenticateUser(request, config) {
  const header = clean(request.headers?.authorization);
  const match = header.match(/^Bearer\s+(.+)$/i);
  if (!match) throw new AdminApiError("AUTH_REQUIRED", 401);

  const response = await fetch(`${config.supabaseUrl}/auth/v1/user`, {
    headers: {
      apikey: config.publishableKey,
      Authorization: `Bearer ${match[1]}`
    }
  });
  if (!response.ok) throw new AdminApiError("AUTH_REQUIRED", 401);
  const user = await response.json();
  if (!user?.id) throw new AdminApiError("AUTH_REQUIRED", 401);
  return user;
}

async function assertAdmin(userId, config) {
  const params = new URLSearchParams({
    select: "id,role,status",
    id: `eq.${userId}`,
    limit: "1"
  });
  const response = await fetch(`${config.supabaseUrl}/rest/v1/profiles?${params}`, {
    headers: serviceHeaders(config, { Accept: "application/json" })
  });
  const rows = await readJson(response);
  if (!response.ok) throw new AdminApiError("ADMIN_REQUIRED", 403);
  const profile = Array.isArray(rows) ? rows[0] : null;
  if (profile?.role !== "admin" || profile?.status !== "active") {
    throw new AdminApiError("ADMIN_REQUIRED", 403);
  }
}

async function updatePassword(userId, password, config) {
  const response = await fetch(`${config.supabaseUrl}/auth/v1/admin/users/${encodeURIComponent(userId)}`, {
    method: "PUT",
    headers: serviceHeaders(config, {
      "Content-Type": "application/json",
      Accept: "application/json"
    }),
    body: JSON.stringify({ password })
  });
  const payload = await readJson(response);
  if (!response.ok) {
    throw new AdminApiError("PASSWORD_UPDATE_FAILED", 502, clean(payload?.message || payload?.error || payload?.msg));
  }
  return payload;
}

export default async function handler(request, response) {
  if (request.method === "GET") {
    try {
      const config = serverConfig();
      return json(response, 200, {
        service: "olafshop-admin-user-password",
        status: "ready",
        configured: {
          supabaseUrl: Boolean(config.supabaseUrl),
          serviceRoleKey: Boolean(config.serviceRoleKey),
          publishableKey: Boolean(config.publishableKey)
        }
      });
    } catch (error) {
      return json(response, error.status || 500, {
        service: "olafshop-admin-user-password",
        status: "configuration_required",
        code: error.code || "CONFIG_REQUIRED",
        message: error.message
      });
    }
  }

  if (request.method !== "POST") {
    response.setHeader("Allow", "GET, POST");
    return json(response, 405, { success: false, code: "METHOD_NOT_ALLOWED", message: "Method not allowed" });
  }

  try {
    const config = serverConfig();
    const admin = await authenticateUser(request, config);
    await assertAdmin(admin.id, config);

    const body = parseBody(request);
    const userId = clean(body.userId);
    const password = String(body.password || "");
    if (!userId) throw new AdminApiError("USER_REQUIRED", 400);
    if (password.length < 6) throw new AdminApiError("PASSWORD_TOO_SHORT", 400);

    await updatePassword(userId, password, config);
    return json(response, 200, { success: true, userId });
  } catch (error) {
    const status = error.status || 500;
    return json(response, status, {
      success: false,
      code: error.code || "PASSWORD_UPDATE_FAILED",
      message: error.message || PUBLIC_MESSAGES.PASSWORD_UPDATE_FAILED,
      detail: error.detail || ""
    });
  }
}
