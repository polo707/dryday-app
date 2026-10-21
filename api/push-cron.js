/**
 * /api/push-cron — called by Vercel cron once an hour (24 daily jobs in vercel.json).
 * Sends each phone the reminder for the set that is due in its local time (up to 3 a day),
 * skipping sets already done. Expired subscriptions (permission or app removed) are deleted.
 */
import { send, vapidFromEnv, sendPush, dueSlot, markSent, MESSAGES, blobList, blobGetJSON, blobPutJSON, blobDelete } from './_push.js';

export default async function handler(req, res) {
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers.authorization !== `Bearer ${secret}`) return send(res, 401, { error: 'unauthorized' });
  const vapid = vapidFromEnv();
  if (!vapid) return send(res, 500, { error: 'vapid' });

  const now = new Date();
  const stats = { total: 0, sent: 0, skipped: 0, removed: 0, failed: 0 };
  const expired = [];
  const blobs = await blobList('push/subs/');
  stats.total = blobs.length;

  for (const blob of blobs) {
    try {
      const record = await blobGetJSON(blob.pathname);
      const slot = record ? dueSlot(record, now) : -1;
      if (slot < 0) { stats.skipped++; continue; }
      const status = await sendPush(record.subscription, { ...MESSAGES[slot], url: '/?source=push', tag: 'dryday-daily' }, vapid);
      if (status === 404 || status === 410) { expired.push(blob.url); stats.removed++; continue; }
      if (status >= 400) { stats.failed++; console.error('push status', status); continue; }
      markSent(record, slot, now);
      await blobPutJSON(blob.pathname, record);
      stats.sent++;
    } catch (err) {
      stats.failed++;
      console.error('push-cron', err);
    }
  }
  await blobDelete(expired).catch((err) => console.error('push-cron delete', err));
  console.log('push-cron', stats);
  return send(res, 200, stats);
}
