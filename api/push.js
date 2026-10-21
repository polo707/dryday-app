/**
 * /api/push — saves or removes a phone's reminder subscription.
 *   POST   { subscription, tz, times: ['09:00','14:00','19:00'], progress: { date, sets } } → create or update
 *   DELETE { endpoint } → remove
 * Each subscription is a private JSON file in Vercel Blob: push/subs/<id>.json
 * No health data is stored: only the push address, time zone, 3 times and the number of sets done today.
 */
import { readJson, send, validSubscription, validTimeZone, cleanTimes, cleanProgress, subscriptionId, blobGetJSON, blobPutJSON, blobList, blobDelete } from './_push.js';

const path = (endpoint) => `push/subs/${subscriptionId(endpoint)}.json`;

export default async function handler(req, res) {
  try {
    const body = await readJson(req);
    if (req.method === 'POST') {
      const sub = body.subscription;
      if (!sub || !validSubscription(sub)) return send(res, 400, { error: 'subscription' });
      const tz = validTimeZone(body.tz) ? body.tz : 'America/New_York';
      const prev = await blobGetJSON(path(sub.endpoint));
      await blobPutJSON(path(sub.endpoint), {
        subscription: { endpoint: sub.endpoint, keys: { p256dh: sub.keys.p256dh, auth: sub.keys.auth } },
        tz,
        times: cleanTimes(body.times),
        progress: cleanProgress(body.progress) || (prev && prev.progress) || null,
        sent: (prev && prev.sent) || null,
        createdAt: (prev && prev.createdAt) || new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });
      return send(res, 200, { ok: true });
    }
    if (req.method === 'DELETE') {
      if (!body.endpoint) return send(res, 400, { error: 'endpoint' });
      const found = await blobList(path(body.endpoint));
      await blobDelete(found.map((b) => b.url));
      return send(res, 200, { ok: true });
    }
    res.setHeader('Allow', 'POST, DELETE');
    return send(res, 405, { error: 'method' });
  } catch (err) {
    console.error('push', err);
    return send(res, 500, { error: 'server' });
  }
}
