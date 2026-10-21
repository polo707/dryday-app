# DryDay — Daily Pelvic Floor & Bladder Control Program

**DryDay** is a mobile-first, evidence-based educational web application designed for women 40+ in the United States to support bladder control (stress, urge, and mixed urinary incontinence) through a guided daily exercise and habits program.

The complete program is architected for **8 weeks**, with **Week 1 (Days 1–7)** fully implemented and Weeks 2–8 structured for seamless expansion.

---

## Features (Week 1 Release)
- **First-Launch Access Gate & Medical Disclaimer:** Protected access (`DRYDAY2026`) and clear safety guidance.
- **1-Minute Pattern & Safety Quiz:** Identifies Stress, Urge, or Mixed patterns, screens for clinical red flags, and tailors the Week 1 daily plan.
- **Week 1 Guided Program (Days 1–7):**
  - Short daily educational lessons (1–2 min read, plain 6th–8th grade English).
  - Interactive guided pelvic floor exercise session player (~5 min) with visual contraction circle, countdowns, rep counter, and optional audio/haptic cues.
  - One practical daily habit tailored to the user's pattern.
- **Urge SOS (60-Second Routine):** Accessible from every screen.
- **2-Tap Bladder Diary:** Fast logging for leaks, strong urges, bathroom trips, and fluid intake, with daily views and a weekly summary chart.
- **Progress Tracking & Discreet Reminders:** Streak counter, Day 1–2 vs. Day 6–7 comparison, and in-app reminders ("Your 5-minute routine is ready") that work while the app is open.
- **100% Local Privacy:** All user data stays on the device via `localStorage`.

---

## Medical Disclaimer
DryDay is an educational exercise and habits program. It is not medical advice, diagnosis, or treatment. If you have pain, blood in your urine, fever, frequent infections, a feeling of heaviness, or any concern, please talk to your doctor or a pelvic floor physical therapist.

---

## How to Open & Use DryDay

### Option 1: Vercel (recommended — needed for daily notifications)
The app is a static site plus three small serverless functions in `api/` for push reminders.

1. In Vercel: **Add New → Project → Import** `polo707/dryday-app` (Framework preset: **Other**, no build command).
2. **Storage → Create → Blob** and connect it to the project (this adds `BLOB_READ_WRITE_TOKEN`; it keeps the push subscriptions, privately).
3. **Settings → Environment Variables:**
   - `VAPID_PUBLIC_KEY` — must match `PUSH_PUBLIC_KEY` in `app.js`
   - `VAPID_PRIVATE_KEY` — secret, never commit it
   - `VAPID_SUBJECT` — `mailto:` + a support email
   - `CRON_SECRET` — any long random string (Vercel sends it to the cron job)
4. **Redeploy.** `vercel.json` registers 24 daily cron jobs (one per hour, the Hobby-plan limit is once a day per job) that call `/api/push-cron`.

### Option 2: GitHub Pages (no notifications)
`https://polo707.github.io/dryday-app/` works for everything except phone notifications (GitHub Pages can't run `api/`). In-app reminder banners still work.

### Install on the phone
The app shows its own step-by-step tutorial (Home card and **More → Add to Home Screen**), adapted to the phone:
- **Android (Chrome):** one-tap **Install app** button when Chrome offers it; otherwise Menu ⋮ → Install app / Add to Home screen.
- **iPhone (Safari):** Share → Add to Home Screen → Add. Chrome/Firefox/Edge on iPhone: Share at the top right. Inside Instagram/Facebook: copy the link and open it in Safari first.
- Access code on first launch: `DRYDAY2026`

### Daily notifications (Web Push)
- Turned on from the Home card or **More → Enable Reminders**. Up to 3 per day at her chosen times (default 09:00 / 14:00 / 19:00, her own time zone). A reminder is skipped if she already did that set.
- Android: Chrome. iPhone/iPad: only after adding to the Home Screen and opening from the icon (iOS 16.4+) — the app explains this.
- On the Vercel Hobby plan the cron runs once an hour, so a reminder can arrive up to ~1 hour after the chosen time.
- The server only stores: the push address, time zone, the 3 times and today's number of sets. No name, email or health data.
- Tests: `node tests/push.test.mjs` (timing, encryption, VAPID signature).

### Option 2: Run Locally
No build tools or dependencies are required.

```bash
git clone https://github.com/polo707/dryday-app.git
cd dryday-app
python3 -m http.server 8000
# then open http://localhost:8000
```

---

## Project Architecture
- `index.html` — App shell, semantic views, and mobile meta tags.
- `styles.css` — Mobile-first design system (`#7A1F3D` primary dark, `#C2557A` accent, `#F2A7C0` soft accent, `#FBF1F3` background, Fraunces & Inter typography).
- `program.js` — Curriculum data (`const PROGRAM = { weeks: [...] }`): full Week 1, pattern bonus blocks, and Weeks 2–8 placeholders.
- `app.js` — State management (`localStorage` with try/catch), navigation, gates, quiz, guided session player, Urge SOS, bladder diary, progress, reminders, and settings.
- `manifest.webmanifest`, `icons/`, `sw.js` — Installable app (PWA): icon, full-screen launch, offline copy, notification display.
- `api/push.js`, `api/push-cron.js`, `api/_push.js` — Save/remove a phone's push subscription; hourly job that sends due reminders (VAPID + aes128gcm, no dependencies).
- `vercel.json` — No-cache headers for app files and the 24 hourly cron jobs.
- `CONTENT_SOURCES.md` — Clinical guidelines and reference mapping for all exercise parameters and educational content.
- `PROGRESS.md` — Phase-by-phase build log and recovery checkpoint.

---

## Adding Weeks 2–8
Fill the `days` array of the matching week in `program.js` using the same shape as Week 1 (`day`, `title`, `duration`, `summary`, `lessonHtml`, `habit`, `blocks`). Every new parameter must be added to `CONTENT_SOURCES.md` first. The Home day pills, Plan list and progress counters currently assume Week 1 (7 days) and will need a small update to show the current week.
