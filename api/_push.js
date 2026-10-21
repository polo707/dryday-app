/**
 * DryDay — Web Push without dependencies (node:crypto only). Adapted from the CANINE app.
 *  - VAPID (RFC 8292): ES256 signature that identifies the app to the push service (Google, Apple, Mozilla…).
 *  - aes128gcm message encryption (RFC 8291 + RFC 8188): only the subscribed phone can read it.
 *  - Subscriptions stored privately in Vercel Blob, through its HTTP API.
 *
 * Environment variables (Vercel → Settings → Environment Variables):
 *   VAPID_PUBLIC_KEY       public key (also in app.js → PUSH_PUBLIC_KEY)
 *   VAPID_PRIVATE_KEY      private key ("d" component, base64url). Secret.
 *   VAPID_SUBJECT          contact for the push services (https URL or mailto:)
 *   BLOB_READ_WRITE_TOKEN  created by Vercel when you connect a Blob store to the project
 *   CRON_SECRET            Vercel sends it in cron calls (Authorization: Bearer …)
 */
import { createECDH, createHash, createHmac, createCipheriv, createPrivateKey, randomBytes, sign } from 'node:crypto';

export const b64u = {
  enc: (buf) => Buffer.from(buf).toString('base64url'),
  dec: (str) => Buffer.from(String(str), 'base64url'),
};

// ── VAPID ──────────────────────────────────────────────────────────────────
function vapidKey(publicKey, privateKey) {
  const pub = b64u.dec(publicKey); // 0x04 || x(32) || y(32)
  return createPrivateKey({
    key: { kty: 'EC', crv: 'P-256', d: privateKey, x: b64u.enc(pub.subarray(1, 33)), y: b64u.enc(pub.subarray(33, 65)) },
    format: 'jwk',
  });
}

/** Cabecera Authorization «vapid t=…, k=…» para el servicio push del endpoint. */
export function vapidAuthorization(endpoint, { publicKey, privateKey, subject }, now = Date.now()) {
  const aud = new URL(endpoint).origin;
  const header = b64u.enc(JSON.stringify({ typ: 'JWT', alg: 'ES256' }));
  const claims = b64u.enc(JSON.stringify({ aud, exp: Math.floor(now / 1000) + 12 * 3600, sub: subject }));
  const data = `${header}.${claims}`;
  const sig = sign('sha256', Buffer.from(data), { key: vapidKey(publicKey, privateKey), dsaEncoding: 'ieee-p1363' });
  return `vapid t=${data}.${b64u.enc(sig)}, k=${publicKey}`;
}

// ── Cifrado aes128gcm ──────────────────────────────────────────────────────
const hkdfExtract = (salt, ikm) => createHmac('sha256', salt).update(ikm).digest();
const hkdfExpand = (prk, info, len) => createHmac('sha256', prk).update(Buffer.concat([info, Buffer.from([1])])).digest().subarray(0, len);

/** Cifra `payload` para una suscripción { keys: { p256dh, auth } }. Devuelve el cuerpo binario a enviar. */
export function encryptPayload(payload, keys, { salt = randomBytes(16), serverKeys } = {}) {
  const uaPublic = b64u.dec(keys.p256dh);
  const authSecret = b64u.dec(keys.auth);
  const ecdh = serverKeys || createECDH('prime256v1');
  if (!serverKeys) ecdh.generateKeys();
  const asPublic = ecdh.getPublicKey();
  const shared = ecdh.computeSecret(uaPublic);

  const prkKey = hkdfExtract(authSecret, shared);
  const keyInfo = Buffer.concat([Buffer.from('WebPush: info\0'), uaPublic, asPublic]);
  const ikm = hkdfExpand(prkKey, keyInfo, 32);
  const prk = hkdfExtract(salt, ikm);
  const cek = hkdfExpand(prk, Buffer.from('Content-Encoding: aes128gcm\0'), 16);
  const nonce = hkdfExpand(prk, Buffer.from('Content-Encoding: nonce\0'), 12);

  const cipher = createCipheriv('aes-128-gcm', cek, nonce);
  const plain = Buffer.concat([Buffer.from(payload), Buffer.from([2])]); // 0x02 = último registro
  const body = Buffer.concat([cipher.update(plain), cipher.final(), cipher.getAuthTag()]);

  const header = Buffer.alloc(21);
  salt.copy(header, 0);
  header.writeUInt32BE(4096, 16); // tamaño de registro
  header[20] = asPublic.length;   // 65
  return Buffer.concat([header, asPublic, body]);
}

/** Envía una notificación. Devuelve el código HTTP del servicio push (201 = enviada; 404/410 = suscripción caducada). */
export async function sendPush(subscription, message, vapid, { ttl = 12 * 3600 } = {}) {
  const body = encryptPayload(JSON.stringify(message), subscription.keys);
  const res = await fetch(subscription.endpoint, {
    method: 'POST',
    headers: {
      Authorization: vapidAuthorization(subscription.endpoint, vapid),
      'Content-Encoding': 'aes128gcm',
      'Content-Type': 'application/octet-stream',
      TTL: String(ttl),
      Urgency: 'normal',
    },
    body,
  });
  return res.status;
}

export function vapidFromEnv() {
  const { VAPID_PUBLIC_KEY: publicKey, VAPID_PRIVATE_KEY: privateKey, VAPID_SUBJECT: subject } = process.env;
  if (!publicKey || !privateKey) return null;
  return { publicKey, privateKey, subject: subject || 'mailto:holauniversocanino@gmail.com' };
}

// ── Validation ─────────────────────────────────────────────────────────────
// Only endpoints of the browsers' push services are accepted (the server can't be used to call any URL).
const PUSH_HOSTS = [/(^|\.)fcm\.googleapis\.com$/, /(^|\.)push\.services\.mozilla\.com$/, /(^|\.)push\.apple\.com$/, /(^|\.)notify\.windows\.com$/, /(^|\.)push\.api\.chromium\.org$/];

export function validSubscription(sub) {
  try {
    const u = new URL(sub.endpoint);
    return u.protocol === 'https:' && PUSH_HOSTS.some((re) => re.test(u.hostname))
      && b64u.dec(sub.keys.p256dh).length === 65 && b64u.dec(sub.keys.auth).length === 16;
  } catch (_) {
    return false;
  }
}

export function validTimeZone(tz) {
  try { new Intl.DateTimeFormat('en-US', { timeZone: tz }); return true; } catch (_) { return false; }
}

const TIME = /^([01]\d|2[0-3]):[0-5]\d$/;
const DATE = /^\d{4}-\d{2}-\d{2}$/;
const DEFAULT_TIMES = ['09:00', '14:00', '19:00'];

/** The 3 reminder times chosen in the app (HH:MM, local time). */
export function cleanTimes(times) {
  const list = Array.isArray(times) ? times : [];
  return DEFAULT_TIMES.map((d, i) => (TIME.test(list[i]) ? list[i] : d));
}

/** How many practice sets were done on a given local date (so we don't remind for a set already done). */
export function cleanProgress(p) {
  if (!p || !DATE.test(p.date)) return null;
  return { date: p.date, sets: Math.min(Math.max(Number(p.sets) || 0, 0), 9) };
}

/** Local date (YYYY-MM-DD) and minutes since midnight in the user's time zone. */
export function localNow(tz, now = new Date()) {
  const parts = Object.fromEntries(new Intl.DateTimeFormat('en-CA', {
    timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
  }).formatToParts(now).map((p) => [p.type, p.value]));
  return { date: `${parts.year}-${parts.month}-${parts.day}`, minutes: Number(parts.hour) * 60 + Number(parts.minute) };
}

export const MESSAGES = [
  { title: 'DryDay', body: 'Your 5-minute routine is ready' },
  { title: 'DryDay', body: 'Your 2-minute set is ready' },
  { title: 'DryDay', body: 'Your 2-minute set is ready' },
];

/**
 * Which reminder to send now (0, 1 or 2), or -1 for none.
 * The cron runs once an hour (Vercel Hobby: once per day per job, 24 jobs, ±59 min).
 * A slot is due once its local time has passed; each slot is sent at most once per local day,
 * and it is skipped if the user already did that many sets today. Old slots are not stacked:
 * only the latest due slot is sent. A slot more than 3 hours late is dropped.
 */
export function dueSlot(record, now = new Date()) {
  const { date, minutes } = localNow(record.tz, now);
  const sent = record.sent && record.sent.date === date ? record.sent.slots || [] : [];
  const setsToday = record.progress && record.progress.date === date ? record.progress.sets : 0;
  let slot = -1;
  cleanTimes(record.times).forEach((t, i) => {
    const [h, m] = t.split(':').map(Number);
    const due = h * 60 + m;
    if (minutes >= due && minutes - due <= 180 && !sent.includes(i) && setsToday <= i) slot = i;
  });
  return slot;
}

/** Marks the slot (and earlier ones) as handled for today. */
export function markSent(record, slot, now = new Date()) {
  const { date } = localNow(record.tz, now);
  const prev = record.sent && record.sent.date === date ? record.sent.slots || [] : [];
  const slots = new Set(prev);
  for (let i = 0; i <= slot; i++) slots.add(i);
  record.sent = { date, slots: [...slots].sort() };
  return record;
}

export const subscriptionId = (endpoint) => createHash('sha256').update(endpoint).digest('hex').slice(0, 32);

// ── Vercel Blob (privado) ──────────────────────────────────────────────────
const BLOB_API = 'https://vercel.com/api/blob';
function blobAuth() {
  const token = (process.env.BLOB_READ_WRITE_TOKEN || '').trim();
  if (!token) throw new Error('Missing BLOB_READ_WRITE_TOKEN');
  const storeId = token.split('_')[3] || '';
  return { token, storeId, headers: { authorization: `Bearer ${token}`, 'x-api-version': '12', 'x-vercel-blob-store-id': storeId } };
}

async function blobCall(path, init) {
  const { headers } = blobAuth();
  const res = await fetch(`${BLOB_API}${path}`, { ...init, headers: { ...headers, ...(init?.headers || {}) } });
  if (!res.ok) throw new Error(`Blob ${init?.method || 'GET'} ${res.status}: ${(await res.text()).slice(0, 200)}`);
  return res;
}

export async function blobPutJSON(pathname, data) {
  await blobCall(`/?${new URLSearchParams({ pathname })}`, {
    method: 'PUT',
    headers: { 'x-vercel-blob-access': 'private', 'x-content-type': 'application/json', 'x-add-random-suffix': '0', 'x-allow-overwrite': '1', 'x-cache-control-max-age': '60' },
    body: JSON.stringify(data),
  });
}

export async function blobGetJSON(pathname) {
  const { token, storeId } = blobAuth();
  const res = await fetch(`https://${storeId}.private.blob.vercel-storage.com/${pathname}?cache=0`, { headers: { authorization: `Bearer ${token}` } });
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`Blob GET ${res.status}`);
  return res.json();
}

export async function blobList(prefix) {
  const out = [];
  let cursor;
  do {
    const q = new URLSearchParams({ prefix, limit: '1000', ...(cursor ? { cursor } : {}) });
    const data = await (await blobCall(`?${q}`, { method: 'GET' })).json();
    out.push(...data.blobs);
    cursor = data.hasMore ? data.cursor : undefined;
  } while (cursor);
  return out;
}

export async function blobDelete(urls) {
  if (!urls.length) return;
  await blobCall('/delete', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ urls }) });
}

/** Lee el cuerpo JSON de una petición de Vercel (Node), con límite de tamaño. */
export async function readJson(req, limit = 8192) {
  if (req.body && typeof req.body === 'object') return req.body;
  let raw = '';
  for await (const chunk of req) { raw += chunk; if (raw.length > limit) throw new Error('too large'); }
  return raw ? JSON.parse(raw) : {};
}

export function send(res, status, data) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Cache-Control', 'no-store');
  res.end(JSON.stringify(data));
}
