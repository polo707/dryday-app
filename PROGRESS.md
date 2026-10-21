# DryDay — Project Progress & Checkpoint Log

> **Recovery Instruction:** If the chat session is interrupted, give this repository (or this `PROGRESS.md` file) to a new chat session to resume from the last completed phase without restarting.

## Current Status
- **Last Completed Phase:** PHASE 6 — TEST AND FINISH (Phases 0–6 complete ✓)
- **Release state:** Week 1 release live on GitHub Pages: https://polo707.github.io/dryday-app/
- **Next step:** Weeks 2–8 content (see README → "Adding Weeks 2–8"), and replacing the shared access code with a per-purchase delivery flow.

## Phases Checklist
- [x] **Phase 0 — GitHub Setup:** `README.md` and `PROGRESS.md` created. Repository: `polo707/dryday-app`, published with GitHub Pages.
- [x] **Phase 1 — Research:** `CONTENT_SOURCES.md` and validated Week 1 clinical plan completed (NICE NG123, NHS/Squeezy, POGP, Cochrane, AUA/SUFU, ACOG, Mayo Clinic, Cleveland Clinic, NIA/NIDDK, APTA, Johns Hopkins, CFA). Conservative beginner parameters: 3 s hold (Day 1) and 4 s hold (Days 2–7) with 6 s relax; 6–8 slow reps; 5–8 quick reps (1 s squeeze / 2 s relax); Days 1–3 lying or sitting, Day 4 all three positions; Urge SOS = 5 gentle quick squeezes + slow breathing (4 s in / 6 s out) + distraction for 60 s.
- [x] **Phase 2 — App Shell and Design:** Built `index.html`, `styles.css`, and base `app.js` (palette `#7A1F3D`, `#C2557A`, `#F2A7C0`, `#FBF1F3`; Fraunces + Inter; body ≥17px; tap targets ≥48px; dark pill bottom nav; `DRYDAY2026` access gate; disclaimer screen + Settings modal; `try/catch` localStorage helper). Added placeholder `program.js` so the page loads without errors.
- [x] **Phase 3 — Quiz and Safety Screen:** 7-question quiz (leak pattern, frequency, bother, age range, menopause/childbirth, what she has tried, red-flag safety check). Opens automatically after the disclaimer. Result screen shows the pattern (Stress / Urge / Mixed) and a calm referral note if red flags, pregnancy or birth < 6 weeks are reported. Answers saved in `state.quizAnswers`.
- [x] **Phase 4 — Week 1 Content and Session Player:** `program.js` has full Week 1 (Days 1–7: lesson, habit, exercise blocks with hold/relax seconds and reps) plus `patternAdjustments` (bonus block added on Days 2–7 for Stress / Urge / Mixed) and placeholders for Weeks 2–8. "Start today" and Plan-tab rows open the lesson, then the guided player: "Get Ready" countdown, animated circle (Squeeze & Lift / Relax / Rest / Breathe In / Breathe Out), seconds countdown, "Rep X of Y", progress bar, Pause, Skip Set, Sound (Web Audio) and Vibration toggles. Finishing marks the day done, updates the streak, and moves "today" to the next open day.
  - Note: Gemini's `app.js` for Phase 4 arrived cut off mid-file; the missing part (session timeline, player, completion, streak, event binding) was completed by Claude to match Gemini's design and CSS. Also fixed: Day 6 "Calming Belly Breaths" now shows Breathe In / Breathe Out instead of Squeeze; small typos; safety reminder shown in the lesson view when red flags were reported.
  - Known gaps for later: the quiz modal has no close button (only the result screen does).
- [x] **Phase 5 — Urge SOS, Diary, Progress, Settings:**
  - 60-second Urge SOS from the header on every screen: Stop & stay still (0–15 s) → 5 quick squeezes, 1 s / 2 s (15–30 s) → slow belly breathing, 4 s in / 6 s out (30–45 s) → distraction, count back from 100 by 7s (45–60 s). End screen: Repeat, "Log this urge", Close.
  - 2-tap Bladder Diary (Leak / Strong Urge / Bathroom Trip / Drink → detail), saved to the current program day; day view with Delete; 7-day bar chart (leaks, strong urges, trips); Days 1–2 vs. Days 6–7 average comparison table.
  - Home "Quick Bladder Log" card; Plan tab lists Weeks 2–8 roadmap.
  - Discreet reminder ("Your 5-minute routine is ready") at a chosen time: in-app banner, plus a system notification only if permission was granted and the app is open in the background. Honest note in Settings that there are no server push notifications.
  - Settings: reminder on/off + time, sound and vibration toggles (synced with the session player), Retake Quiz (with Close button), disclaimer, install instructions, Reset Data.
  - Note: Gemini's `index.html` and `app.js` for Phase 5 arrived cut off at ~20,000 characters (the chat's paste limit). The missing parts (end of Settings, bottom nav, disclaimer modal, scripts; Urge SOS, diary, chart, comparison, reminders, settings logic and event binding) were completed by Claude following Gemini's description and CSS. **Tip for next phases:** send files as downloaded files, or split any file over ~18,000 characters into parts.
- [x] **Phase 6 — Test and Finish:**
  - End-to-end flow tested in a phone-sized browser at 360 px and 390 px: wrong code shows an error; code accepted with any case/spaces; disclaimer; quiz with red flag shows the referral note and the lesson safety reminder; session player (pause really pauses, skip, completion); Plan, Progress and More tabs; 60-second Urge SOS; Retake Quiz close button; no sideways scrolling; no JavaScript errors.
  - From Gemini's Phase 6 stylesheet: iPhone safe areas (notch at the top when installed on the home screen, home bar at the bottom for the nav, modals and banner), `overflow-x: hidden`, 48 px tap target and focus ring for the diary day selector. Gemini's unified `styles.css` arrived cut off at ~20,000 characters, so these changes were applied to the existing complete stylesheet instead of replacing it.
  - Contrast check: body/muted text 5.9–6.5:1, white on burgundy 10:1, rose headings 3.9:1 (large text, passes AA). The active nav label was 4.3:1, so the active tab color was deepened to `#A9426A` (5.7:1).
- [x] **Update — 3 sets per day (NICE NG123 1.4.5):** Home "Today's Practice" card (0–3 sets with dots); the guided session counts as set 1; "Short set" = 8 slow holds using the timing of the day practiced today (never harder); completion screens tell her how many sets are left; 3 reminder times in Settings (default 09:00 / 14:00 / 19:00, an older single time is kept as the first); Day 1 and Day 7 lessons explain "at least 8 squeezes, 3 times a day, for at least 3 months"; every lesson shows a safety line (stop if pain, don't hold breath or push down, see a doctor/PT if worse) or the day's `safetyNote` if present. Verified NICE quotes added to `CONTENT_SOURCES.md` section 3.
  - Known limits: reminders and the access code are client-side only; the access code `DRYDAY2026` is visible in the code and is a placeholder until a per-purchase delivery flow exists.
- [x] **Update — Installable app + daily notifications (same setup as the CANINE app):**
  - Installable PWA: `manifest.webmanifest`, burgundy app icons (`icons/`), service worker `sw.js` (offline copy, network-first; shows notifications and opens the app when tapped). Relative paths, so it works on Vercel and on GitHub Pages.
  - Home-screen tutorial: Home card + **More → Add to Home Screen**. Android: Chrome's own Install button when available, else 3 steps with the ⋮ menu. iPhone: Safari steps (Share → Add to Home Screen → Add), a variant for Chrome/Firefox/Edge on iPhone, and an "open in Safari first / Copy link" note inside Instagram/Facebook. Desktop: link to open on the phone.
  - Daily Web Push: "Turn on reminders" card on Home and the Enable Reminders toggle in More. Up to 3 reminders a day at her times and time zone; set 1 says "Your 5-minute routine is ready", sets 2–3 "Your 2-minute set is ready"; skipped if that set is already done. On iPhone, notifications require the Home Screen app (iOS 16.4+) and the app opens the tutorial instead. Clear messages if blocked or unsupported.
  - Server: `api/push.js` (save/delete subscription in private Vercel Blob), `api/push-cron.js` (24 hourly cron jobs in `vercel.json`), `api/_push.js` (VAPID + encryption with Node's crypto, no packages). Tested in `tests/push.test.mjs`; UI tested with Android, iPhone Safari, iPhone Chrome and Instagram user agents, in the root and in a subfolder.
  - Needs Vercel + env vars (`VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT`, `CRON_SECRET`, `BLOB_READ_WRITE_TOKEN`) — see README.
- [x] **Update — Visual trust redesign (from Gemini's wireframes):**
  - Consistent SVG line-icon set replaces emoji (nav, cards, diary, brand heart).
  - Position illustrations (lying, sitting, standing pictograms with a soft pelvic highlight and an "upward and inward" arrow) on the Home card, in each lesson (with a one-line caption), in the session player (changes with the block's position) and in the Plan list.
  - Trust layer: "Built on clinical guidelines" card on Home (NICE NG123 dose), compact NICE card on Plan, NICE + privacy lines on the access screen, privacy line under the diary.
  - Lessons: lists shown as clean rows; player: soft double ring around the circle; completion: "Sets completed today" dots; Progress: days-completed bar; Plan: timeline with number/check dots and the current day highlighted.
  - `REVIEWER` in `app.js` is `null` on purpose: a "Program reviewed by …, DPT" card appears only when a REAL licensed pelvic floor PT has reviewed the program and agreed to be named. No stock "doctor" images, no invented reviewers or testimonials (FTC endorsement rules).
  - `PHOTOS` in `app.js` (access, home, done) is empty: optional lifestyle photos go in `/images` and are never presented as customers.
- [x] **Update — Features from competitor review analysis** (reviews of Kegel Trainer, Leap Fitness, Amila, mEL Studio, Easy Kegel, Riafy, Squeezy/NHS; NAFC and Mumsnet):
  - **Safety:** quiz question 8 (pelvic/vaginal pain, pain during sex or tampon use, trouble relaxing or starting to pee). If yes, the result and every lesson recommend a pelvic floor PT before squeezing exercises (possible overactive pelvic floor, per NAFC guidance).
  - **"Am I doing it right?"** 6-question technique check (lift, soft belly/buttocks, breathing, full release, no pushing down, no pain) with a tip for each problem; pain → pause and see a clinician. Offered after a guided session until done once, and in More.
  - **Voice coach** (optional, off by default): phone's built-in voice says "Squeeze and lift" / "Relax completely" / breathing cues; toggle in the player and in More; works offline; primed on tap for iPhone.
  - **Discreet notifications:** push and local notifications say "Daily reminder" with no app name or health words (server `messageFor`). Session chime already follows the sound setting.
  - **Report for my doctor:** printable / Save as PDF / Share summary built on the phone: practice (last 14 days chart), questionnaire answers, diary summary by day (incl. night trips), all diary entries, technique self-check, suggested questions for the clinician.
  - **Milestones** (8, tied to real practice and the 3-month NICE goal) with a toast when unlocked; **Practice history** with date and time of each set; **Welcome back** card after a missed day and a no-guilt "fresh start" push the next morning; **My day starts at** (midnight–4 AM) for night owls, applied in the app and on the push server.
  - Tests: `tests/push.test.mjs` extended (discreet text, fresh start, night-owl day start); end-to-end browser test of every feature.
- [x] **Update — Fixes from the AI customer test** (ux-testers, 5 personas: low-tech iPhone user, busy nurse, retiree with urges, skeptical buyer, woman with pelvic pain):
  - **Safety gate:** pain / trouble-relaxing answers pause the squeezing exercises everywhere (Home safety card, lesson, short set, reminder banner) until she confirms a PT or doctor cleared her; meanwhile a 2-minute relaxed belly-breathing routine (no squeezing, not counted as a set). Red-flag answers ask "Did your doctor say it's OK?" before any session. Warnings moved to the top of lessons. Retaking the quiz resets clearances.
  - **Discreet by default:** in-app banner and notifications say "Daily reminder · Time for your routine" when discreet is on (default on); settings text matches.
  - **Reminders easier:** "Reminders: … · Set up/Change" shortcut on the Today's Practice card; toast confirmation on every saved time/toggle; status line shows the times.
  - **Quiz:** "In a hurry? Answer only the 2 safety questions" (balanced plan); safety questions always asked.
  - **Diary/Progress:** diary options scroll into view (clear of the bottom bar); Bladder Diary stat; drinks in the weekly chart; "Diary started" milestone at 3 entries; "Getting up at night?" tips card with night-trip count.
  - **About, Privacy & Sources** (More): owner, how the program was written (and reviewer status), 8 linked sources, exactly what data is stored where, 30-day money-back guarantee and support email (same as the sales page).

## Files in the Repository
1. `README.md`
2. `PROGRESS.md`
3. `CONTENT_SOURCES.md`
4. `index.html`
5. `styles.css`
6. `app.js`
7. `program.js` (Week 1 curriculum + Weeks 2–8 placeholders)

## Key Decisions
1. **Audience & accessibility:** Women 40+ (mainly 45–65) in the US. Body text ≥17px, tap targets ≥48px, 6th–8th grade reading level, warm tone, respects `prefers-reduced-motion`.
2. **Design system:** Primary dark `#7A1F3D`, accent `#C2557A`, soft accent `#F2A7C0`, background `#FBF1F3`, cards `#FFFFFF`, text `#2A1A20`, muted `#6B5960`. Fraunces (headings) + Inter (body). Floating dark pill bottom nav (Home, Plan, Progress, More) + Urge SOS button in the header.
3. **Storage:** All `localStorage` reads/writes wrapped in `try/catch` with in-memory fallback.
4. **Evidence policy:** Every hold time, rest time, rep count and instruction in `program.js` must trace to `CONTENT_SOURCES.md`, using the most conservative beginner-safe option when sources differ.
5. **Hosting:** Vercel (static files + `api/` functions for push, no build step). GitHub Pages still works without notifications.
