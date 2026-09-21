import {createCipheriv, createDecipheriv, randomBytes} from 'node:crypto';

function context(orderId, env) {
  if (typeof window !== 'undefined') throw new Error('SERVER_ONLY');
  if (!/^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i.test(orderId || '')) throw new Error('INVALID_DELIVERY_CONTEXT');
  const encoded = env.SUPPLIER_DELIVERY_KEY_V1 || '';
  if (!/^[A-Za-z0-9+/]{43}=$/.test(encoded)) throw new Error('DELIVERY_KEY_REQUIRED');
  const key = Buffer.from(encoded, 'base64');
  if (key.length !== 32 || key.toString('base64') !== encoded) throw new Error('DELIVERY_KEY_REQUIRED');
  return {key, aad: Buffer.from(`olaf:supplier-delivery:v1:${orderId.toLowerCase()}`)};
}

export function encryptSupplierAccount(orderId, account, env = process.env) {
  const {key, aad} = context(orderId, env);
  if (!account || !['username','password'].every(k => typeof account[k] === 'string' && account[k].length > 0 && account[k].length <= 4096)) {
    throw new Error('INVALID_SUPPLIER_ACCOUNT');
  }
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', key, iv);
  cipher.setAAD(aad);
  // Whitelist delivery fields: never persist provider payloads, API keys, or tokens.
  const bytes = Buffer.concat([cipher.update(JSON.stringify({username:account.username,password:account.password}), 'utf8'), cipher.final()]);
  return {ciphertext:['v1',iv.toString('base64url'),cipher.getAuthTag().toString('base64url'),bytes.toString('base64url')].join('.'), key_version:'v1'};
}

export function decryptSupplierAccount(orderId, envelope, env = process.env) {
  const {key, aad} = context(orderId, env);
  try {
    if (typeof envelope !== 'string' || envelope.length > 32768) throw new Error();
    const parts = envelope.split('.');
    if (parts.length !== 4 || parts[0] !== 'v1' || parts.slice(1).some(p => !/^[A-Za-z0-9_-]+$/.test(p))) throw new Error();
    const [iv,tag,bytes] = parts.slice(1).map(p => Buffer.from(p, 'base64url'));
    if (iv.length !== 12 || tag.length !== 16 || !bytes.length) throw new Error();
    const decipher = createDecipheriv('aes-256-gcm',key,iv);
    decipher.setAAD(aad);
    decipher.setAuthTag(tag);
    const account = JSON.parse(Buffer.concat([decipher.update(bytes),decipher.final()]).toString('utf8'));
    if (!['username','password'].every(k => typeof account[k] === 'string' && account[k].length > 0 && account[k].length <= 4096)) throw new Error();
    return {username:account.username,password:account.password};
  } catch {
    throw new Error('DELIVERY_DECRYPT_FAILED');
  }
}
