// node tests/push.test.mjs — checks reminder timing and that push messages decrypt correctly.
import assert from 'node:assert/strict';
import { createECDH, createHmac, createDecipheriv, randomBytes, generateKeyPairSync, verify, createPublicKey } from 'node:crypto';
import { dueSlot, markSent, cleanTimes, encryptPayload, vapidAuthorization, b64u } from '../api/_push.js';

const tz = 'America/New_York'; // UTC-4 in October
const at = (iso) => new Date(iso);
const rec = (extra = {}) => ({ tz, times: ['09:00', '14:00', '19:00'], progress: null, sent: null, ...extra });

// Before 9:00 local → nothing; at 9:30 → slot 0
assert.equal(dueSlot(rec(), at('2026-10-21T12:30:00Z')), -1);           // 8:30 local
assert.equal(dueSlot(rec(), at('2026-10-21T13:30:00Z')), 0);            // 9:30 local
// Already sent slot 0 today → nothing until 14:00
const r = rec(); markSent(r, 0, at('2026-10-21T13:30:00Z'));
assert.equal(dueSlot(r, at('2026-10-21T15:00:00Z')), -1);               // 11:00 local
assert.equal(dueSlot(r, at('2026-10-21T18:10:00Z')), 1);                // 14:10 local
// Sets already done today skip the reminder
assert.equal(dueSlot(rec({ progress: { date: '2026-10-21', sets: 2 } }), at('2026-10-21T18:10:00Z')), -1);
assert.equal(dueSlot(rec({ progress: { date: '2026-10-21', sets: 2 } }), at('2026-10-21T23:30:00Z')), 2); // 19:30 local
// Yesterday's progress doesn't count today
assert.equal(dueSlot(rec({ progress: { date: '2026-10-20', sets: 3 } }), at('2026-10-21T13:30:00Z')), 0);
// More than 3 hours late → dropped (no 9:00 reminder at 13:00)
assert.equal(dueSlot(rec({ times: ['09:00', '23:00', '23:30'] }), at('2026-10-21T17:00:00Z')), -1);
// Late cron run after two slots → only the latest is sent, earlier marked handled
const r2 = rec({ times: ['09:00', '10:00', '19:00'] });
assert.equal(dueSlot(r2, at('2026-10-21T14:20:00Z')), 1);               // 10:20 local
markSent(r2, 1, at('2026-10-21T14:20:00Z'));
assert.deepEqual(r2.sent.slots, [0, 1]);
// New day resets
assert.equal(dueSlot(r2, at('2026-10-22T13:10:00Z')), 0);
// Bad times fall back to defaults
assert.deepEqual(cleanTimes(['25:00', 'x', '07:15']), ['09:00', '14:00', '07:15']);

// Encryption round-trip (RFC 8291): decrypt as the phone would
const ua = createECDH('prime256v1'); ua.generateKeys();
const auth = randomBytes(16);
const body = encryptPayload('{"title":"DryDay"}', { p256dh: b64u.enc(ua.getPublicKey()), auth: b64u.enc(auth) });
const salt = body.subarray(0, 16); const asPub = body.subarray(21, 86); const ct = body.subarray(86);
const hk = (s, k) => createHmac('sha256', s).update(k).digest();
const he = (p, info, n) => createHmac('sha256', p).update(Buffer.concat([info, Buffer.from([1])])).digest().subarray(0, n);
const shared = ua.computeSecret(asPub);
const ikm = he(hk(auth, shared), Buffer.concat([Buffer.from('WebPush: info\0'), ua.getPublicKey(), asPub]), 32);
const prk = hk(salt, ikm);
const d = createDecipheriv('aes-128-gcm', he(prk, Buffer.from('Content-Encoding: aes128gcm\0'), 16), he(prk, Buffer.from('Content-Encoding: nonce\0'), 12));
d.setAuthTag(ct.subarray(ct.length - 16));
const plain = Buffer.concat([d.update(ct.subarray(0, ct.length - 16)), d.final()]);
assert.equal(plain.subarray(0, -1).toString(), '{"title":"DryDay"}');

// VAPID signature verifies with the public key
const { privateKey } = generateKeyPairSync('ec', { namedCurve: 'prime256v1' });
const jwk = privateKey.export({ format: 'jwk' });
const pub = b64u.enc(Buffer.concat([Buffer.from([4]), b64u.dec(jwk.x), b64u.dec(jwk.y)]));
const hdr = vapidAuthorization('https://fcm.googleapis.com/fcm/send/abc', { publicKey: pub, privateKey: jwk.d, subject: 'mailto:a@b.c' });
const token = hdr.match(/t=([^,]+)/)[1]; const [h64, c64, s64] = token.split('.');
const ok = verify('sha256', Buffer.from(`${h64}.${c64}`), { key: createPublicKey({ key: { kty: 'EC', crv: 'P-256', x: jwk.x, y: jwk.y }, format: 'jwk' }), dsaEncoding: 'ieee-p1363' }, b64u.dec(s64));
assert.ok(ok);
assert.equal(JSON.parse(b64u.dec(c64)).aud, 'https://fcm.googleapis.com');

console.log('push tests: all passed');
