import crypto from "node:crypto";
import jsQR from "jsqr";
import sharp from "sharp";
import { slipVerify, trueMoneySlipVerify } from "promptparse/validate";

const RDCW_ENDPOINT = "https://suba.rdcw.co.th/v2/inquiry";
const PAYMENT_SLIP_BUCKET = "payment-slips";
const PAYMENT_CONTACT_URL = "https://www.facebook.com/byOlafshop";
const MAX_SLIP_BYTES = 5 * 1024 * 1024;
const MAX_IMAGE_PIXELS = 25_000_000;

const PUBLIC_ERROR_MESSAGES = {
  AUTH_REQUIRED: "กรุณาเข้าสู่ระบบใหม่ก่อนตรวจสอบสลิป",
  ORDER_NOT_FOUND: "ไม่พบออเดอร์นี้",
  ORDER_NOT_VERIFIABLE: "ออเดอร์นี้ไม่อยู่ในสถานะที่ตรวจสลิปได้",
  ORDER_ALREADY_VERIFIED: "ออเดอร์นี้ตรวจสอบการชำระเงินแล้ว",
  PAYMENT_METHOD_MISMATCH: "สลิปไม่ตรงกับช่องทางชำระเงินที่เลือก",
  SLIP_QR_NOT_FOUND: "ไม่พบ QR สำหรับตรวจสอบในรูป กรุณาใช้ภาพสลิปต้นฉบับที่เห็น QR ชัดเจน",
  INVALID_SLIP_QR: "QR ในภาพไม่ใช่ QR ตรวจสอบสลิปที่รองรับ",
  SLIP_FILE_TOO_LARGE: "ไฟล์สลิปใหญ่เกิน 5MB",
  SLIP_IMAGE_INVALID: "ไม่สามารถอ่านรูปสลิปได้ กรุณาใช้ไฟล์ PNG, JPG หรือ WebP",
  DUPLICATE_SLIP: "สลิปนี้ถูกใช้กับออเดอร์อื่นแล้ว",
  VERIFICATION_IN_PROGRESS: "ระบบกำลังตรวจสลิปนี้อยู่ กรุณารอสักครู่",
  PAYMENT_AMOUNT_MISMATCH: "ยอดเงินในสลิปไม่ตรงกับยอดออเดอร์",
  PAYMENT_AMOUNT_INSUFFICIENT: "จำนวนเงินไม่เพียงพอ ระบบจะแปลงยอดที่ชำระเป็น Point ในเว็บไซต์",
  PAYMENT_TIME_MISMATCH: "เวลาชำระเงินในสลิปไม่ตรงกับช่วงเวลาของออเดอร์",
  RECEIVER_ALLOWLIST_REQUIRED: "ยังไม่ได้ตั้งค่าชื่อหรือบัญชีผู้รับเงินสำหรับตรวจสอบ",
  RECEIVER_MISMATCH: "ข้อมูลผู้รับเงินในสลิปไม่ตรงกับบัญชีของร้าน",
  RECEIVER_NOT_RETURNED: "ผู้ให้บริการไม่ได้ส่งข้อมูลผู้รับเงินกลับมา จึงยังยืนยันอัตโนมัติไม่ได้",
  RDCW_NOT_CONFIGURED: "ยังไม่ได้ตั้งค่า Slip Verify API บนเซิร์ฟเวอร์",
  RDCW_AUTH_FAILED: "การตั้งค่า Slip Verify API ไม่ถูกต้อง",
  RDCW_IP_NOT_ALLOWED: "IP ของเซิร์ฟเวอร์ยังไม่ได้รับอนุญาตใน Slip Verify",
  RDCW_QUOTA_EXCEEDED: "โควต้าตรวจสลิปหมดหรือแพ็กเกจหมดอายุ",
  RDCW_INVALID_SLIP: "ผู้ให้บริการไม่สามารถยืนยัน QR ของสลิปนี้ได้",
  RDCW_TEMPORARY_ERROR: "ระบบธนาคารหรือผู้ให้บริการตรวจสลิปขัดข้องชั่วคราว",
  PAYMENT_VERIFICATION_FAILED: "ตรวจสอบสลิปไม่สำเร็จ กรุณาลองใหม่หรือติดต่อแอดมิน",
  DATABASE_MIGRATION_REQUIRED: "ระบบฐานข้อมูลตรวจสลิปยังไม่พร้อม กรุณารัน SQL migration ล่าสุด"
};
class VerificationError extends Error {
  constructor(code, status = 400, options = {}) {
    super(PUBLIC_ERROR_MESSAGES[code] || code);
    this.name = "VerificationError";
    this.code = code;
    this.status = status;
    this.retriable = options.retriable === true;
    this.providerPayload = options.providerPayload || null;
    this.verifiedAmount = Number.isFinite(Number(options.verifiedAmount))
      ? Number(options.verifiedAmount)
      : null;
  }
}

function clean(value) {
  return String(value ?? "").trim();
}

function normalizeCompact(value) {
  return clean(value)
    .normalize("NFKC")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, "");
}

function unique(values) {
  return [...new Set(values.map(clean).filter(Boolean))];
}

function parseCsv(value) {
  return unique(String(value || "").split(/[\n,;|]+/));
}

function safeProviderPayload(value) {
  if (!value || typeof value !== "object") return {};
  return JSON.parse(JSON.stringify(value));
}

function responseJson(response, status, payload) {
  response.setHeader("Content-Type", "application/json; charset=utf-8");
  response.setHeader("Cache-Control", "no-store");
  response.status(status).json(payload);
}

function parseRequestBody(request) {
  if (request.body && typeof request.body === "object") return request.body;
  if (typeof request.body === "string" && request.body.trim()) {
    try {
      return JSON.parse(request.body);
    } catch (error) {
      throw new VerificationError("INVALID_REQUEST", 400);
    }
  }
  return {};
}

function serverConfig() {
  const supabaseUrl = clean(process.env.SUPABASE_URL);
  const serviceRoleKey = clean(process.env.SUPABASE_SERVICE_ROLE_KEY);
  const publishableKey = clean(process.env.SUPABASE_PUBLISHABLE_KEY || process.env.SUPABASE_ANON_KEY);
  const rdcwClientId = clean(process.env.RDCW_CLIENT_ID);
  const rdcwClientSecret = clean(process.env.RDCW_CLIENT_SECRET);

  if (!supabaseUrl || !serviceRoleKey || !publishableKey) {
    throw new VerificationError("DATABASE_MIGRATION_REQUIRED", 503);
  }
  if (!rdcwClientId || !rdcwClientSecret) {
    throw new VerificationError("RDCW_NOT_CONFIGURED", 503);
  }

  return {
    supabaseUrl: supabaseUrl.replace(/\/+$/, ""),
    serviceRoleKey,
    publishableKey,
    rdcwClientId,
    rdcwClientSecret,
    expectedReceiverNames: parseCsv(process.env.RDCW_ALLOWED_RECEIVER_NAMES),
    expectedReceiverAccounts: parseCsv(process.env.RDCW_ALLOWED_RECEIVER_ACCOUNTS),
    skipReceiverCheck: clean(process.env.RDCW_SKIP_RECEIVER_CHECK).toLowerCase() === "true"
  };
}

function healthStatus() {
  const required = {
    supabaseUrl: Boolean(clean(process.env.SUPABASE_URL)),
    supabasePublishableKey: Boolean(clean(process.env.SUPABASE_PUBLISHABLE_KEY || process.env.SUPABASE_ANON_KEY)),
    supabaseServiceRoleKey: Boolean(clean(process.env.SUPABASE_SERVICE_ROLE_KEY)),
    rdcwClientId: Boolean(clean(process.env.RDCW_CLIENT_ID)),
    rdcwClientSecret: Boolean(clean(process.env.RDCW_CLIENT_SECRET)),
    receiverIdentity: Boolean(
      clean(process.env.RDCW_ALLOWED_RECEIVER_NAMES) ||
      clean(process.env.RDCW_ALLOWED_RECEIVER_ACCOUNTS) ||
      clean(process.env.RDCW_SKIP_RECEIVER_CHECK).toLowerCase() === "true"
    )
  };
  return {
    service: "olafshop-slip-verify",
    status: Object.values(required).every(Boolean) ? "ready" : "configuration_required",
    configured: required
  };
}

function serviceHeaders(config, extra = {}) {
  return {
    apikey: config.serviceRoleKey,
    Authorization: `Bearer ${config.serviceRoleKey}`,
    ...extra
  };
}

async function fetchJson(url, options, errorCode = "PAYMENT_VERIFICATION_FAILED") {
  const response = await fetch(url, options);
  const text = await response.text();
  let payload = null;
  try {
    payload = text ? JSON.parse(text) : null;
  } catch (error) {
    payload = text ? { message: text } : null;
  }
  if (!response.ok) {
    const message = clean(payload?.message || payload?.error || payload?.hint);
    const knownDatabaseCode = [
      "ORDER_NOT_FOUND",
      "ORDER_NOT_VERIFIABLE",
      "ORDER_ALREADY_VERIFIED",
      "SLIP_PATH_MISMATCH",
      "PAYMENT_METHOD_MISMATCH",
      "DUPLICATE_SLIP",
      "VERIFICATION_IN_PROGRESS",
      "PAYMENT_AMOUNT_MISMATCH",
      "PAYMENT_AMOUNT_INSUFFICIENT",
      "PAYMENT_AMOUNT_INSUFFICIENT_POINTS_CREDITED",
      "VERIFICATION_ATTEMPT_NOT_FOUND",
      "VERIFICATION_ATTEMPT_NOT_PROCESSING"
    ].find((code) => message.includes(code));
    const duplicateTransaction = /payment_verifications_provider_transaction_(?:nonreusable_)?uidx|duplicate key value.*provider_transaction/i.test(message);
    const migrationMissing = response.status === 404 || /function|column|schema cache|does not exist/i.test(message);
    throw new VerificationError(
      migrationMissing
        ? "DATABASE_MIGRATION_REQUIRED"
        : duplicateTransaction
          ? "DUPLICATE_SLIP"
          : knownDatabaseCode || errorCode,
      migrationMissing ? 503 : (duplicateTransaction || knownDatabaseCode ? 409 : 502),
      {
      providerPayload: payload
      }
    );
  }
  return payload;
}

async function authenticateUser(request, config) {
  const header = clean(request.headers?.authorization);
  const match = header.match(/^Bearer\s+(.+)$/i);
  if (!match) throw new VerificationError("AUTH_REQUIRED", 401);

  const response = await fetch(`${config.supabaseUrl}/auth/v1/user`, {
    headers: {
      apikey: config.publishableKey,
      Authorization: `Bearer ${match[1]}`
    }
  });
  if (!response.ok) throw new VerificationError("AUTH_REQUIRED", 401);
  const user = await response.json();
  if (!user?.id) throw new VerificationError("AUTH_REQUIRED", 401);
  return user;
}

async function fetchOrder(orderId, userId, config) {
  const params = new URLSearchParams({
    select: "*,order_items(*)",
    id: `eq.${orderId}`,
    user_id: `eq.${userId}`,
    limit: "1"
  });
  const rows = await fetchJson(`${config.supabaseUrl}/rest/v1/orders?${params}`, {
    headers: serviceHeaders(config, { Accept: "application/json" })
  });
  const order = Array.isArray(rows) ? rows[0] : null;
  if (!order) throw new VerificationError("ORDER_NOT_FOUND", 404);
  return order;
}

async function fetchPaymentChannel(method, config) {
  const params = new URLSearchParams({
    select: "id,method,account_number,account_name,wallet_name",
    id: `eq.${method}`,
    limit: "1"
  });
  const rows = await fetchJson(`${config.supabaseUrl}/rest/v1/payment_channels?${params}`, {
    headers: serviceHeaders(config, { Accept: "application/json" })
  });
  return Array.isArray(rows) ? rows[0] || {} : {};
}

function storageObjectUrl(config, path) {
  const encodedPath = clean(path)
    .split("/")
    .map((part) => encodeURIComponent(part))
    .join("/");
  return `${config.supabaseUrl}/storage/v1/object/${PAYMENT_SLIP_BUCKET}/${encodedPath}`;
}

async function downloadSlip(path, config) {
  const response = await fetch(storageObjectUrl(config, path), {
    headers: serviceHeaders(config)
  });
  if (!response.ok) throw new VerificationError("SLIP_IMAGE_INVALID", 400);
  const length = Number(response.headers.get("content-length") || 0);
  if (length > MAX_SLIP_BYTES) throw new VerificationError("SLIP_FILE_TOO_LARGE", 413);
  const buffer = Buffer.from(await response.arrayBuffer());
  if (!buffer.length) throw new VerificationError("SLIP_IMAGE_INVALID", 400);
  if (buffer.length > MAX_SLIP_BYTES) throw new VerificationError("SLIP_FILE_TOO_LARGE", 413);
  return buffer;
}

async function removeSlip(path, config) {
  if (!path) return;
  await fetch(`${config.supabaseUrl}/storage/v1/object/${PAYMENT_SLIP_BUCKET}`, {
    method: "DELETE",
    headers: serviceHeaders(config, { "Content-Type": "application/json" }),
    body: JSON.stringify({ prefixes: [path] })
  }).catch(() => null);
}

async function callRpc(name, parameters, config) {
  return fetchJson(`${config.supabaseUrl}/rest/v1/rpc/${name}`, {
    method: "POST",
    headers: serviceHeaders(config, {
      Accept: "application/json",
      "Content-Type": "application/json"
    }),
    body: JSON.stringify(parameters)
  });
}

async function assertProviderTransactionUnused(transactionId, config) {
  const reference = clean(transactionId);
  if (!reference) return true;

  const params = new URLSearchParams({
    select: "id,order_id,status,provider_transaction_id",
    provider: "eq.rdcw",
    provider_transaction_id: `eq.${reference}`,
    status: "in.(verified,rejected)",
    limit: "1"
  });
  const rows = await fetchJson(`${config.supabaseUrl}/rest/v1/payment_verifications?${params}`, {
    headers: serviceHeaders(config, { Accept: "application/json" })
  }, "DUPLICATE_SLIP");

  if (Array.isArray(rows) && rows.length > 0) {
    throw new VerificationError("DUPLICATE_SLIP", 409, {
      retriable: false,
      providerPayload: { transactionId: reference, status: rows[0]?.status || "used" }
    });
  }
  return true;
}

export async function scanQrFromImage(buffer) {
  let image;
  try {
    image = sharp(buffer, {
      failOn: "error",
      limitInputPixels: MAX_IMAGE_PIXELS
    }).rotate();
    const metadata = await image.metadata();
    if (!metadata.width || !metadata.height) throw new Error("IMAGE_DIMENSIONS_REQUIRED");
  } catch (error) {
    throw new VerificationError("SLIP_IMAGE_INVALID", 400);
  }

  const widths = [1800, 2600];
  for (const width of widths) {
    try {
      const { data, info } = await image
        .clone()
        .resize({
          width,
          height: width,
          fit: "inside",
          withoutEnlargement: width === 1800
        })
        .ensureAlpha()
        .raw()
        .toBuffer({ resolveWithObject: true });
      const decoded = jsQR(new Uint8ClampedArray(data), info.width, info.height, {
        inversionAttempts: "attemptBoth"
      });
      if (decoded?.data) return clean(decoded.data);
    } catch (error) {
      // Try the next local decoding size without consuming the external quota.
    }
  }

  throw new VerificationError("SLIP_QR_NOT_FOUND", 422);
}

export function classifySlipPayload(payload) {
  const value = clean(payload);
  if (!value) throw new VerificationError("INVALID_SLIP_QR", 422);

  let bank = null;
  let wallet = null;
  try {
    bank = slipVerify(value, true);
  } catch (error) {
    bank = null;
  }
  try {
    wallet = trueMoneySlipVerify(value);
  } catch (error) {
    wallet = null;
  }

  if (wallet?.transactionId) {
    return {
      type: "wallet",
      transactionId: clean(wallet.transactionId),
      parsed: wallet
    };
  }
  if (bank?.transRef) {
    return {
      type: "promptpay",
      transactionId: clean(bank.transRef),
      parsed: bank
    };
  }
  throw new VerificationError("INVALID_SLIP_QR", 422);
}

function objectCandidates(raw) {
  const candidates = [];
  const queue = [raw];
  const visited = new Set();
  while (queue.length && candidates.length < 30) {
    const value = queue.shift();
    if (!value || typeof value !== "object" || visited.has(value)) continue;
    visited.add(value);
    candidates.push(value);
    for (const key of ["data", "result", "transaction", "transfer", "inquiry"]) {
      if (value[key] && typeof value[key] === "object") queue.push(value[key]);
    }
  }
  return candidates;
}

function firstKnownValue(candidates, keys) {
  for (const candidate of candidates) {
    for (const key of keys) {
      const value = candidate?.[key];
      if (value !== undefined && value !== null && value !== "") return value;
    }
  }
  return null;
}

function entityFromCandidates(candidates, keys) {
  for (const candidate of candidates) {
    for (const key of keys) {
      if (candidate?.[key] && typeof candidate[key] === "object") return candidate[key];
    }
  }
  return {};
}

function collectEntityValues(entity) {
  if (!entity || typeof entity !== "object") return [];
  const values = [];
  const queue = [entity];
  const visited = new Set();
  while (queue.length && values.length < 40) {
    const current = queue.shift();
    if (!current || typeof current !== "object" || visited.has(current)) continue;
    visited.add(current);
    for (const [key, value] of Object.entries(current)) {
      if (value && typeof value === "object") {
        queue.push(value);
      } else if (/name|account|number|value|proxy|mobile|phone|wallet|display/i.test(key)) {
        values.push(clean(value));
      }
    }
  }
  return unique(values);
}

function parseNumeric(value) {
  const normalized = clean(value).replace(/,/g, "").replace(/[^\d.-]/g, "");
  const number = Number(normalized);
  return Number.isFinite(number) ? number : null;
}

export function matchVerifiedAmount(rawAmount, expectedTotal) {
  const amount = parseNumeric(rawAmount);
  const expected = Number(expectedTotal);
  if (amount === null || !Number.isFinite(expected)) {
    throw new VerificationError("PAYMENT_AMOUNT_MISMATCH", 422);
  }
  const candidates = unique([
    amount.toFixed(2),
    (amount / 100).toFixed(2)
  ]).map(Number);
  const matched = candidates.find((candidate) => Math.abs(candidate - expected) <= 0.01);
  if (matched === undefined) {
    const closest = candidates.reduce((best, candidate) =>
      Math.abs(candidate - expected) < Math.abs(best - expected) ? candidate : best
    );
    if (closest < expected - 0.01) {
      throw new VerificationError("PAYMENT_AMOUNT_INSUFFICIENT", 422, {
        providerPayload: { amount: rawAmount },
        verifiedAmount: closest
      });
    }
    return closest;
  }
  return matched;
}

function isPointTopupOrder(order = {}) {
  const items = Array.isArray(order.order_items) ? order.order_items : [];
  return items.length > 0 && items.every((item) => clean(item.product_id) === "point-topup");
}

export function matchPointTopupAmount(rawAmount, expectedHint = 0) {
  const amount = parseNumeric(rawAmount);
  if (amount === null) throw new VerificationError("PAYMENT_AMOUNT_MISMATCH", 422);
  const candidates = unique([
    amount.toFixed(2),
    (amount / 100).toFixed(2)
  ])
    .map(Number)
    .filter((candidate) => Number.isFinite(candidate) && candidate > 0);
  if (!candidates.length) throw new VerificationError("PAYMENT_AMOUNT_MISMATCH", 422);

  const expected = Number(expectedHint || 0);
  if (Number.isFinite(expected) && expected > 0) {
    return candidates.reduce((best, candidate) =>
      Math.abs(candidate - expected) < Math.abs(best - expected) ? candidate : best
    );
  }
  return candidates[0];
}

function parseTransferredAt(candidates) {
  const direct = firstKnownValue(candidates, [
    "transferredAt",
    "transferDateTime",
    "transactionDateTime",
    "dateTime",
    "datetime",
    "timestamp"
  ]);
  if (direct) {
    const parsed = new Date(direct);
    if (!Number.isNaN(parsed.getTime())) return parsed.toISOString();
  }

  const date = clean(firstKnownValue(candidates, ["transDate", "transferDate", "date"]));
  const time = clean(firstKnownValue(candidates, ["transTime", "transferTime", "time"]) || "00:00:00");
  if (/^\d{8}$/.test(date)) {
    const yearFirst = Number(date.slice(0, 4)) > 1900;
    const year = yearFirst ? date.slice(0, 4) : date.slice(4, 8);
    const month = yearFirst ? date.slice(4, 6) : date.slice(2, 4);
    const day = yearFirst ? date.slice(6, 8) : date.slice(0, 2);
    const parsed = new Date(`${year}-${month}-${day}T${time || "00:00:00"}+07:00`);
    if (!Number.isNaN(parsed.getTime())) return parsed.toISOString();
  }
  return null;
}

function normalizeRdcwVerifiedPayload(raw, fallbackTransactionId = "") {
  const candidates = objectCandidates(raw);
  const valid = candidates.some((candidate) => candidate.valid === true || candidate.success === true);
  if (!valid) {
    throw new VerificationError("RDCW_INVALID_SLIP", 422, {
      retriable: false,
      providerPayload: raw
    });
  }

  const amountValue = firstKnownValue(candidates, [
    "amount",
    "transAmount",
    "transferAmount",
    "transactionAmount",
      "paidAmount"
  ]);
  const sender = entityFromCandidates(candidates, ["sender", "from", "payer", "sendingAccount"]);
  const receiver = entityFromCandidates(candidates, ["receiver", "to", "payee", "receivingAccount"]);
  const transactionId = clean(
    firstKnownValue(candidates, [
      "transRef",
      "transactionId",
      "transactionID",
      "reference",
      "referenceNo",
      "ref"
    ]) || fallbackTransactionId
  );

  return {
    valid: true,
    amountValue,
    transactionId,
    senderName: clean(firstKnownValue([sender], ["name", "displayName", "accountName"])),
    receiverName: clean(firstKnownValue([receiver], ["name", "displayName", "accountName"])),
    receiverValues: collectEntityValues(receiver),
    transferredAt: parseTransferredAt(candidates),
    raw: safeProviderPayload(raw)
  };
}

export function normalizeRdcwResponse(raw, expectedTotal, fallbackTransactionId = "") {
  const normalized = normalizeRdcwVerifiedPayload(raw, fallbackTransactionId);
  return {
    ...normalized,
    amount: matchVerifiedAmount(normalized.amountValue, expectedTotal)
  };
}

function identityMatches(actual, expected) {
  const actualNormalized = normalizeCompact(actual);
  const expectedNormalized = normalizeCompact(expected);
  if (!actualNormalized || !expectedNormalized) return false;
  if (actualNormalized === expectedNormalized) return true;
  if (actualNormalized.length >= 4 && expectedNormalized.length >= 4) {
    return (
      actualNormalized.endsWith(expectedNormalized) ||
      expectedNormalized.endsWith(actualNormalized) ||
      actualNormalized.includes(expectedNormalized) ||
      expectedNormalized.includes(actualNormalized)
    );
  }
  return false;
}

function accountIdentityMatches(actual, expected) {
  if (identityMatches(actual, expected)) return true;
  const actualDigits = clean(actual).replace(/\D/g, "");
  const expectedDigits = clean(expected).replace(/\D/g, "");
  if (actualDigits.length < 4 || expectedDigits.length < 4) return false;
  const visibleDigits = Math.min(actualDigits.length, expectedDigits.length, 6);
  return actualDigits.slice(-visibleDigits) === expectedDigits.slice(-visibleDigits);
}

export function verifyReceiverIdentity(normalized, channel = {}, config = {}) {
  if (config.skipReceiverCheck === true) return true;

  const expectedNames = unique([
    channel.account_name,
    channel.wallet_name,
    ...(config.expectedReceiverNames || [])
  ]);
  const expectedAccounts = unique([
    channel.account_number,
    ...(config.expectedReceiverAccounts || [])
  ]);
  if (!expectedNames.length && !expectedAccounts.length) {
    throw new VerificationError("RECEIVER_ALLOWLIST_REQUIRED", 503);
  }

  const actualValues = unique([
    normalized.receiverName,
    ...(normalized.receiverValues || [])
  ]);
  if (!actualValues.length) throw new VerificationError("RECEIVER_NOT_RETURNED", 422);

  const matchesName = expectedNames.some((expected) =>
    actualValues.some((actual) => identityMatches(actual, expected))
  );
  const matchesAccount = expectedAccounts.some((expected) =>
    actualValues.some((actual) => accountIdentityMatches(actual, expected))
  );
  if (!matchesName && !matchesAccount) throw new VerificationError("RECEIVER_MISMATCH", 422);
  return true;
}

export function validateTransferTime(transferredAt, orderCreatedAt, now = new Date()) {
  if (!transferredAt || !orderCreatedAt) return true;
  const transferred = new Date(transferredAt);
  const created = new Date(orderCreatedAt);
  const current = now instanceof Date ? now : new Date(now);
  if (
    [transferred, created, current].some((value) => Number.isNaN(value.getTime())) ||
    transferred.getTime() < created.getTime() - 15 * 60 * 1000 ||
    transferred.getTime() > current.getTime() + 10 * 60 * 1000
  ) {
    throw new VerificationError("PAYMENT_TIME_MISMATCH", 422);
  }
  return true;
}

function mapRdcwError(status, payload) {
  const code = Number(payload?.code);
  if ([1001, 1002].includes(code)) return new VerificationError("RDCW_AUTH_FAILED", 503, { providerPayload: payload });
  if (code === 1003) return new VerificationError("RDCW_IP_NOT_ALLOWED", 503, { providerPayload: payload });
  if ([1004, 1005, 1006].includes(code)) {
    return new VerificationError("RDCW_INVALID_SLIP", 422, { retriable: false, providerPayload: payload });
  }
  if ([1007, 1008].includes(code)) return new VerificationError("RDCW_QUOTA_EXCEEDED", 503, { providerPayload: payload });
  if ([2001, 2002, 2003, 2004, 2005, 2006].includes(code) || status >= 500) {
    return new VerificationError("RDCW_TEMPORARY_ERROR", 503, { retriable: true, providerPayload: payload });
  }
  return new VerificationError("RDCW_INVALID_SLIP", status >= 500 ? 503 : 422, {
    retriable: status >= 500,
    providerPayload: payload
  });
}

async function inquireRdcw(payload, config) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 18_000);
  try {
    const response = await fetch(RDCW_ENDPOINT, {
      method: "POST",
      headers: {
        Accept: "application/json",
        Authorization: `Basic ${Buffer.from(`${config.rdcwClientId}:${config.rdcwClientSecret}`).toString("base64")}`,
        "Content-Type": "application/json",
        "User-Agent": "OLAF-SHOP-SLIP-VERIFY/1.0"
      },
      body: JSON.stringify({ payload }),
      signal: controller.signal
    });
    const text = await response.text();
    let data = {};
    try {
      data = text ? JSON.parse(text) : {};
    } catch (error) {
      data = { message: text };
    }
    if (!response.ok) throw mapRdcwError(response.status, data);
    return data;
  } catch (error) {
    if (error instanceof VerificationError) throw error;
    throw new VerificationError("RDCW_TEMPORARY_ERROR", 503, {
      retriable: true
    });
  } finally {
    clearTimeout(timeout);
  }
}

async function resetRejectedSlip({ order, user, reason, config }) {
  const reset = await callRpc("server_reset_payment_slip", {
    p_order_id: order.id,
    p_user_id: user.id,
    p_slip_path: order.payment_slip_path,
    p_reason: reason
  }, config).catch(() => null);
  if (!reset) return false;
  await removeSlip(order.payment_slip_path, config);
  return true;
}

async function rejectUnderpaidOrder({
  attemptId,
  order,
  transactionId,
  verifiedAmount,
  providerPayload,
  config
}) {
  if (!attemptId || !Number.isFinite(Number(verifiedAmount))) return false;
  const rejected = await callRpc("server_reject_underpaid_order", {
    p_attempt_id: attemptId,
    p_provider_transaction_id: transactionId || null,
    p_verified_amount: Number(verifiedAmount),
    p_provider_payload: safeProviderPayload(providerPayload)
  }, config);
  if (!rejected) return false;
  await removeSlip(order.payment_slip_path, config);
  return rejected;
}

function publicOrderResult(payload) {
  const order = payload?.order || {};
  return {
    id: order.id,
    orderNumber: order.order_number || order.id,
    status: order.status,
    paymentStatus: order.payment_status,
    paymentVerifiedAt: order.payment_verified_at || "",
    paymentVerifiedProvider: order.payment_verified_provider || "",
    paymentVerificationNote: order.payment_verification_note || "",
    pointsRedeemedAmount: Number(order.points_redeemed_amount || 0),
    pointCreditAmount: Number(payload?.pointCreditAmount ?? order.point_credit_amount ?? 0),
    autoDelivered: payload?.autoDelivered === true,
    fulfillmentPending: payload?.fulfillmentPending === true
  };
}

export default async function handler(request, response) {
  if (request.method === "GET") {
    return responseJson(response, 200, healthStatus());
  }
  if (request.method !== "POST") {
    response.setHeader("Allow", "GET, POST");
    return responseJson(response, 405, { success: false, code: "METHOD_NOT_ALLOWED" });
  }

  let config;
  let user;
  let order;
  let attemptId = "";
  let slipHandled = false;
  let pointCreditAmount = 0;
  try {
    config = serverConfig();
    user = await authenticateUser(request, config);
    const body = parseRequestBody(request);
    const orderId = clean(body.orderId);
    if (!/^[0-9a-f-]{36}$/i.test(orderId)) throw new VerificationError("ORDER_NOT_FOUND", 404);

    order = await fetchOrder(orderId, user.id, config);
    if (order.payment_status === "verified") {
      return responseJson(response, 200, {
        success: true,
        alreadyVerified: true,
        order: publicOrderResult({ order })
      });
    }
    if (!order.payment_slip_path) throw new VerificationError("SLIP_IMAGE_INVALID", 400);

    const buffer = await downloadSlip(order.payment_slip_path, config);
    const slipHash = crypto.createHash("sha256").update(buffer).digest("hex");
    let qrPayload;
    try {
      qrPayload = await scanQrFromImage(buffer);
    } catch (error) {
      if (error instanceof VerificationError && ["SLIP_QR_NOT_FOUND", "SLIP_IMAGE_INVALID"].includes(error.code)) {
        slipHandled = await resetRejectedSlip({ order, user, reason: error.code, config });
      }
      throw error;
    }

    let payloadInfo;
    try {
      payloadInfo = classifySlipPayload(qrPayload);
    } catch (error) {
      if (error instanceof VerificationError && error.code === "INVALID_SLIP_QR") {
        slipHandled = await resetRejectedSlip({ order, user, reason: error.code, config });
      }
      throw error;
    }
    const orderMethod = clean(order.payment_method || "promptpay").toLowerCase() === "wallet"
      ? "wallet"
      : "promptpay";
    if (payloadInfo.type !== orderMethod) {
      slipHandled = await resetRejectedSlip({
        order,
        user,
        reason: "PAYMENT_METHOD_MISMATCH",
        config
      });
      throw new VerificationError("PAYMENT_METHOD_MISMATCH", 422);
    }

    await assertProviderTransactionUnused(payloadInfo.transactionId, config);

    const begin = await callRpc("server_begin_payment_verification", {
      p_order_id: order.id,
      p_user_id: user.id,
      p_slip_path: order.payment_slip_path,
      p_slip_sha256: slipHash,
      p_payload_type: payloadInfo.type
    }, config);
    if (begin?.alreadyVerified) {
      return responseJson(response, 200, {
        success: true,
        alreadyVerified: true,
        order: publicOrderResult(begin)
      });
    }
    attemptId = clean(begin?.attemptId);

    let providerResponse;
    try {
      providerResponse = await inquireRdcw(qrPayload, config);
    } catch (error) {
      if (attemptId) {
        await callRpc("server_finish_payment_verification_error", {
          p_attempt_id: attemptId,
          p_error_code: error.code || "RDCW_TEMPORARY_ERROR",
          p_provider_payload: safeProviderPayload(error.providerPayload),
          p_retriable: error.retriable === true
        }, config).catch(() => null);
      }
      if (error.retriable !== true) {
        slipHandled = await resetRejectedSlip({
          order,
          user,
          reason: error.code || "RDCW_INVALID_SLIP",
          config
        });
      }
      throw error;
    }

    let normalized;
    try {
      normalized = normalizeRdcwVerifiedPayload(providerResponse, payloadInfo.transactionId);
      validateTransferTime(normalized.transferredAt, order.created_at);
      const channel = await fetchPaymentChannel(orderMethod, config);
      verifyReceiverIdentity(normalized, channel, config);
      await assertProviderTransactionUnused(normalized.transactionId || payloadInfo.transactionId, config);
      normalized.amount = isPointTopupOrder(order)
        ? matchPointTopupAmount(normalized.amountValue, order.total)
        : matchVerifiedAmount(normalized.amountValue, order.total);
    } catch (error) {
      if (error?.code === "PAYMENT_AMOUNT_INSUFFICIENT") {
        const rejected = await rejectUnderpaidOrder({
          attemptId,
          order,
          transactionId: normalized?.transactionId || payloadInfo.transactionId,
          verifiedAmount: error.verifiedAmount,
          providerPayload: normalized?.raw || providerResponse,
          config
        });
        slipHandled = Boolean(rejected);
        if (Number(rejected?.pointCreditAmount || 0) > 0) {
          pointCreditAmount = Number(rejected.pointCreditAmount);
        }
        throw error;
      }
      if (attemptId) {
        await callRpc("server_finish_payment_verification_error", {
          p_attempt_id: attemptId,
          p_error_code: error.code || "PAYMENT_VERIFICATION_FAILED",
          p_provider_payload: normalized?.raw || safeProviderPayload(providerResponse),
          p_retriable: false
        }, config).catch(() => null);
      }
      slipHandled = await resetRejectedSlip({
        order,
        user,
        reason: error.code || "PAYMENT_VERIFICATION_FAILED",
        config
      });
      throw error;
    }

    const fulfilled = await callRpc(isPointTopupOrder(order)
      ? "server_verify_point_topup_order"
      : "server_verify_payment_and_fulfill_order", {
      p_attempt_id: attemptId,
      p_provider_transaction_id: normalized.transactionId,
      p_verified_amount: normalized.amount,
      p_sender_name: normalized.senderName || null,
      p_receiver_name: normalized.receiverName || null,
      p_transferred_at: normalized.transferredAt || null,
      p_provider_payload: normalized.raw
    }, config);

    return responseJson(response, 200, {
      success: true,
      alreadyVerified: fulfilled?.alreadyVerified === true,
      pointCreditAmount: Number(fulfilled?.pointCreditAmount || 0),
      pointCredited: Number(fulfilled?.pointCreditAmount || 0) > 0,
      order: publicOrderResult(fulfilled)
    });
  } catch (error) {
    const code = clean(error?.code || "PAYMENT_VERIFICATION_FAILED");
    const status = Number(error?.status || 500);
    if (
      order &&
      user &&
      config &&
      ["DUPLICATE_SLIP", "PAYMENT_AMOUNT_MISMATCH"].includes(code)
    ) {
      if (attemptId) {
        await callRpc("server_finish_payment_verification_error", {
          p_attempt_id: attemptId,
          p_error_code: code,
          p_provider_payload: safeProviderPayload(error?.providerPayload),
          p_retriable: false
        }, config).catch(() => null);
      }
      slipHandled = (await resetRejectedSlip({ order, user, reason: code, config })) || slipHandled;
    }
    return responseJson(response, status, {
      success: false,
      code,
      message: PUBLIC_ERROR_MESSAGES[code] || PUBLIC_ERROR_MESSAGES.PAYMENT_VERIFICATION_FAILED,
      retriable: error?.retriable === true,
      slipHandled,
      orderCancelled: code === "PAYMENT_AMOUNT_INSUFFICIENT" && slipHandled,
      pointCreditAmount,
      pointCredited: slipHandled && pointCreditAmount > 0,
      contactUrl: code === "PAYMENT_AMOUNT_INSUFFICIENT" ? PAYMENT_CONTACT_URL : undefined
    });
  }
}
