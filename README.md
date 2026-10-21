# DryDay — Daily Pelvic Floor & Bladder Control Program

**DryDay** is a mobile-first, evidence-based educational web application designed for women 40+ in the United States to support bladder control (stress, urge, and mixed urinary incontinence) through a guided daily exercise and habits program.

The complete program is architected for **8 weeks**, with **Week 1 (Days 1–7)** being built first and Weeks 2–8 structured for seamless expansion.

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
- **Progress Tracking & Discreet Reminders:** Streak counter, Day 1–2 vs. Day 6–7 comparison, and local reminders.
- **100% Local Privacy:** All user data stays on the device via `localStorage`.

---

## Medical Disclaimer
DryDay is an educational exercise and habits program. It is not medical advice, diagnosis, or treatment. If you have pain, blood in your urine, fever, frequent infections, a feeling of heaviness, or any concern, please talk to your doctor or a pelvic floor physical therapist.

---

## How to Open & Use DryDay

### Option 1: Live Web App (GitHub Pages)
1. Open `https://polo707.github.io/dryday-app/` in **Safari** (iPhone) or **Chrome** (Android).
2. **Add to Home Screen (Recommended):**
   - **iPhone (Safari):** Tap the **Share** button → **Add to Home Screen**.
   - **Android (Chrome):** Tap the **three-dot menu** → **Add to Home screen** / **Install app**.
3. Enter the access code on first launch: `DRYDAY2026`

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
- `program.js` — Curriculum data (`const PROGRAM = { weeks: [...] }`). Week 1 is filled in Phase 4; Weeks 2–8 later.
- `app.js` — State management (`localStorage` with try/catch), navigation, gates, and (in later phases) quiz, session player, Urge SOS, and bladder diary.
- `CONTENT_SOURCES.md` — Clinical guidelines and reference mapping for all exercise parameters and educational content.
- `PROGRESS.md` — Phase-by-phase build log and recovery checkpoint.
