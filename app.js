/**
 * DryDay — Main Application Controller (Complete through Phase 5)
 * Includes:
 * - Access Code Gate (DRYDAY2026) & Medical Disclaimer
 * - 1-Minute Pattern & Safety Red-Flag Quiz
 * - Week 1 Guided Session Player (Animated circle, audio/vibration cues, pause/skip)
 * - Persistent 60-Second Urge SOS Routine on every screen
 * - 2-Tap Bladder Diary, Day View, Weekly Chart & Day 1-2 vs. Day 6-7 Comparison
 * - Discreet Local Reminders & Settings
 */

(function () {
  'use strict';

  const ACCESS_CODE_VALID = 'DRYDAY2026';
  const STORAGE_KEY = 'dryday_state_v1';

  const StorageHelper = {
    memoryFallback: {},
    get() {
      try {
        const raw = window.localStorage.getItem(STORAGE_KEY);
        if (!raw) return null;
        return JSON.parse(raw);
      } catch (err) {
        return this.memoryFallback[STORAGE_KEY] || null;
      }
    },
    set(data) {
      try {
        window.localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
      } catch (err) {
        this.memoryFallback[STORAGE_KEY] = data;
      }
    },
    clear() {
      try {
        window.localStorage.removeItem(STORAGE_KEY);
      } catch (err) {}
      delete this.memoryFallback[STORAGE_KEY];
    }
  };

  function getDefaultState() {
    return {
      unlocked: false,
      disclaimerAccepted: false,
      quizCompleted: false,
      pattern: 'mixed', // 'stress' | 'urge' | 'mixed'
      quizAnswers: {},
      redFlagsDetected: false,
      tensionFlag: false, // pelvic pain / pain with sex / trouble relaxing → PT first
      tensionCleared: false, // she confirmed a PT/doctor cleared her for squeezing exercises
      redFlagCleared: false,
      techniqueCheck: null, // { date, issues: [] }
      practiceHistory: [], // { ts, kind: 'session' | 'short', day }
      milestonesSeen: [],
      bestStreak: 0,
      comebackDismissed: null,
      currentDay: 1,
      completedDays: [],
      lastCompletedDate: null,
      streak: 0,
      diary: [], // { id, day, category, detail, timeLabel, timestamp }
      practiceLog: {}, // { 'YYYY-MM-DD': number of sets done that day (guided session + short sets) }
      settings: {
        sound: true,
        vibration: true,
        voice: false,
        discreet: true, // embarrassing topic: neutral notifications by default
        dayStart: 0,
        reminderEnabled: false,
        reminderTime: '09:00',
        reminderTimes: ['09:00', '14:00', '19:00'],
        lastReminderShownDate: null,
        remindersShown: { date: null, slots: [] }
      }
    };
  }

  const savedState = StorageHelper.get() || {};
  const savedSettings = savedState.settings || {};
  let state = Object.assign(getDefaultState(), savedState);
  state.settings = Object.assign(getDefaultState().settings, savedSettings);
  if (!savedSettings.reminderTimes && savedSettings.reminderTime) {
    // Older saves had a single reminder time: keep it as the first one
    state.settings.reminderTimes = [savedSettings.reminderTime, '14:00', '19:00'];
  }
  if (!Array.isArray(state.diary)) state.diary = [];
  if (!Array.isArray(state.completedDays)) state.completedDays = [];
  if (!state.practiceLog || typeof state.practiceLog !== 'object') state.practiceLog = {};
  if (!Array.isArray(state.settings.reminderTimes) || state.settings.reminderTimes.length !== 3) {
    state.settings.reminderTimes = ['09:00', '14:00', '19:00'];
  }
  if (!state.settings.remindersShown) state.settings.remindersShown = { date: null, slots: [] };
  if (!Array.isArray(state.practiceHistory)) state.practiceHistory = [];
  if (!Array.isArray(state.milestonesSeen)) state.milestonesSeen = [];

  function saveState() {
    StorageHelper.set(state);
  }

  // Web Audio API gentle cue tone
  let audioCtx = null;
  function playCueTone(freq = 520, durationMs = 180) {
    if (!state.settings.sound) return;
    try {
      const AudioContextClass = window.AudioContext || window.webkitAudioContext;
      if (!AudioContextClass) return;
      if (!audioCtx) audioCtx = new AudioContextClass();
      if (audioCtx.state === 'suspended') audioCtx.resume();

      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, audioCtx.currentTime);

      gain.gain.setValueAtTime(0.08, audioCtx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + durationMs / 1000);

      osc.connect(gain);
      gain.connect(audioCtx.destination);
      osc.start();
      osc.stop(audioCtx.currentTime + durationMs / 1000);
    } catch (e) {}
  }

  function triggerVibration(pattern = 80) {
    if (!state.settings.vibration) return;
    try {
      if (navigator.vibrate) navigator.vibrate(pattern);
    } catch (e) {}
  }

  // DOM Elements
  const screenWelcome = document.getElementById('screen-welcome');
  let welcomeDone = false; // the welcome screen shows once each time the app opens, until the program is unlocked
  const screenAccess = document.getElementById('screen-access');
  const screenDisclaimer = document.getElementById('screen-disclaimer');
  const appShell = document.getElementById('app-shell');

  const accessForm = document.getElementById('access-form');
  const accessInput = document.getElementById('access-code-input');
  const accessError = document.getElementById('access-error');
  const btnAcceptDisclaimer = document.getElementById('btn-accept-disclaimer');

  const navTabs = document.querySelectorAll('.nav-tab');
  const tabViews = {
    home: document.getElementById('view-home'),
    plan: document.getElementById('view-plan'),
    progress: document.getElementById('view-progress'),
    more: document.getElementById('view-more')
  };

  const modalDisclaimer = document.getElementById('modal-disclaimer');
  const btnShowDisclaimer = document.getElementById('btn-show-disclaimer');
  const btnCloseDisclaimerModal = document.getElementById('btn-close-disclaimer-modal');
  const btnResetData = document.getElementById('btn-reset-data');
  const btnStartToday = document.getElementById('btn-start-today');
  const btnUrgeSosTop = document.getElementById('btn-urge-sos-top');

  function updateGreeting() {
    const greetingEl = document.getElementById('greeting-text');
    if (!greetingEl) return;
    const hour = new Date().getHours();
    if (hour < 12) greetingEl.textContent = 'Good Morning,';
    else if (hour < 18) greetingEl.textContent = 'Good Afternoon,';
    else greetingEl.textContent = 'Good Evening,';
  }

  function renderEntryFlow() {
    if (screenWelcome) screenWelcome.hidden = true;
    if (!state.unlocked) {
      if (screenWelcome && !welcomeDone) {
        screenWelcome.hidden = false;
        screenAccess.hidden = true;
        screenDisclaimer.hidden = true;
        appShell.hidden = true;
        return;
      }
      screenAccess.hidden = false;
      screenDisclaimer.hidden = true;
      appShell.hidden = true;
      return;
    }

    if (!state.disclaimerAccepted) {
      screenAccess.hidden = true;
      screenDisclaimer.hidden = false;
      appShell.hidden = true;
      return;
    }

    screenAccess.hidden = true;
    screenDisclaimer.hidden = true;
    appShell.hidden = false;

    updateGreeting();
    renderStats();
    renderHomeDayContent();
    renderPlanList();
    renderQuizStatus();
    renderDiaryAndProgress();
    syncSettingsControls();

    if (!state.quizCompleted && !document.getElementById('modal-quiz')) {
      openQuizModal();
    }
  }

  function switchTab(targetTab) {
    Object.keys(tabViews).forEach((key) => {
      const isTarget = key === targetTab;
      if (tabViews[key]) tabViews[key].hidden = !isTarget;
    });

    navTabs.forEach((btn) => {
      const isActive = btn.getAttribute('data-tab') === targetTab;
      btn.classList.toggle('active', isActive);
      if (isActive) btn.setAttribute('aria-current', 'page');
      else btn.removeAttribute('aria-current');
    });

    if (targetTab === 'progress') {
      const selectEl = document.getElementById('diary-day-select');
      if (selectEl) selectEl.value = String(state.currentDay);
      renderDiaryAndProgress();
    }

    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  // =====================================================
  // VISUAL TRUST LAYER: position illustrations, trust card, optional photos
  // =====================================================
  const POSE_ART = {
    lying: `<svg viewBox="0 0 200 110" class="pose-svg" role="img" aria-label="Lying on your back with knees bent">
      <rect x="8" y="90" width="184" height="8" rx="4" class="pose-mat"/>
      <ellipse cx="106" cy="78" rx="18" ry="14" class="pose-glow"/>
      <circle cx="30" cy="72" r="12" class="pose-fill"/>
      <path d="M50 78 Q78 74 106 80" class="pose-body"/>
      <path d="M106 80 L134 48 L150 82" class="pose-limb"/>
      <path d="M150 84 H166" class="pose-foot"/>
      <path d="M60 86 Q80 89 98 88" class="pose-arm"/>
      <path d="M100 62 V42 M93 49 L100 42 L107 49" class="pose-arrow"/>
    </svg>`,
    sitting: `<svg viewBox="0 0 200 110" class="pose-svg" role="img" aria-label="Sitting upright on a chair">
      <path d="M30 101 H170" class="pose-floor"/>
      <g class="pose-chair"><path d="M62 74 H116"/><path d="M62 74 V26"/><path d="M66 76 V101"/><path d="M112 76 V101"/></g>
      <ellipse cx="86" cy="66" rx="16" ry="13" class="pose-glow"/>
      <circle cx="84" cy="20" r="12" class="pose-fill"/>
      <path d="M84 38 V62" class="pose-body"/>
      <path d="M86 66 H124 L126 96" class="pose-limb"/>
      <path d="M126 97 H140" class="pose-foot"/>
      <path d="M86 44 Q94 58 110 62" class="pose-arm"/>
      <path d="M152 66 V46 M145 53 L152 46 L159 53" class="pose-arrow"/>
    </svg>`,
    standing: `<svg viewBox="0 0 200 110" class="pose-svg" role="img" aria-label="Standing tall">
      <path d="M44 103 H156" class="pose-floor"/>
      <ellipse cx="100" cy="60" rx="16" ry="13" class="pose-glow"/>
      <circle cx="100" cy="15" r="11" class="pose-fill"/>
      <path d="M100 32 V56" class="pose-body"/>
      <path d="M94 60 L92 98 M106 60 L108 98" class="pose-limb"/>
      <path d="M90 36 L86 62 M110 36 L114 62" class="pose-arm"/>
      <path d="M136 66 V46 M129 53 L136 46 L143 53" class="pose-arrow"/>
    </svg>`
  };


  const POSE_CAPTIONS = {
    lying: 'Lie on your back, knees bent, feet flat. Gently lift upward and inward.',
    sitting: 'Sit tall on a firm chair, feet flat on the floor. Gently lift upward and inward.',
    standing: 'Stand tall, feet hip-width apart. Gently lift upward and inward.'
  };

  /** 'Lying Down or Sitting' → 'lying'. Returns null for 'Relaxed' / 'Transition'. */
  function poseKey(position) {
    const p = String(position || '').toLowerCase();
    const order = [['lying', p.indexOf('lying')], ['sitting', p.indexOf('sitting')], ['standing', p.indexOf('standing')]]
      .filter(([, i]) => i >= 0)
      .sort((a, b) => a[1] - b[1]);
    return order.length ? order[0][0] : null;
  }

  function dayPoseKey(dayData) {
    for (const b of dayData.blocks || []) {
      const k = poseKey(b.position);
      if (k) return k;
    }
    return 'sitting';
  }

  const icon = (name, cls = 'ico') => `<svg class="${cls}" aria-hidden="true"><use href="#i-${name}"/></svg>`;

  /*
   * PROGRAM REVIEWER — leave as null until a REAL licensed pelvic floor physical therapist
   * has reviewed the program and agreed (in writing) to be named. Never use a stock photo
   * or an invented name here. Example once you have one:
   * const REVIEWER = { name: 'Jane Smith', credentials: 'PT, DPT', role: 'Pelvic floor physical therapist', photo: 'images/reviewer.jpg' };
   */
  const REVIEWER = null;

  /* Optional lifestyle photos (files in /images). Leave '' to hide. Never present them as customers. */
  const PHOTOS = { access: '', home: '', done: '' };

  function renderTrustCards() {
    const home = document.getElementById('home-trust-card');
    const plan = document.getElementById('plan-trust-card');
    const esc = (t) => String(t).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
    if (REVIEWER && REVIEWER.name) {
      const who = `${esc(REVIEWER.name)}${REVIEWER.credentials ? ', ' + esc(REVIEWER.credentials) : ''}`;
      const avatar = REVIEWER.photo
        ? `<img class="trust-avatar" src="${esc(REVIEWER.photo)}" alt="${esc(REVIEWER.name)}" />`
        : `<span class="trust-icon">${icon('shield')}</span>`;
      const html = `${avatar}<div class="trust-text"><strong>Program reviewed by ${who}</strong><p>${esc(REVIEWER.role || '')}${REVIEWER.role ? ' · ' : ''}Based on UK NICE guideline NG123</p></div>`;
      if (home) home.innerHTML = html;
      if (plan) plan.innerHTML = html;
      return;
    }
    if (home) {
      home.innerHTML = `<span class="trust-icon">${icon('shield')}</span><div class="trust-text"><strong>Built on clinical guidelines</strong><p>Exercise amounts follow the UK NICE guideline for pelvic floor training (NG123): at least 8 squeezes, 3 times a day, for at least 3 months.</p></div>`;
    }
    if (plan) {
      plan.innerHTML = `<span class="trust-icon">${icon('book')}</span><div class="trust-text"><strong>Based on UK NICE guideline NG123</strong><p>Gentle, beginner-safe progression · Your diary stays on your phone</p></div>`;
    }
  }

  function renderPhotos() {
    const access = document.getElementById('access-photo');
    if (access && PHOTOS.access) {
      access.innerHTML = `<img src="${PHOTOS.access}" alt="" />`;
      access.hidden = false;
      access.closest('.gate-hero-card').classList.add('has-photo');
    }
    const card = document.getElementById('today-featured-card');
    if (card && PHOTOS.home && !card.querySelector('.featured-photo')) {
      card.insertAdjacentHTML('afterbegin', `<div class="featured-photo"><img src="${PHOTOS.home}" alt="" /></div>`);
      card.classList.add('has-photo');
    }
  }

  function setsDotsHtml(done) {
    return `<div class="sets-row"><span>Sets completed today</span><div class="practice-dots">${[1, 2, 3]
      .map((n) => `<span class="practice-dot ${n <= done ? 'done' : ''}">${n <= done ? '✓' : n}</span>`)
      .join('')}</div></div>`;
  }

  // =====================================================
  // SAFETY: possible overactive (too-tight) pelvic floor
  // Pain, pain with sex or trouble relaxing can mean the muscles are already tight;
  // squeezing exercises can make that worse, so we recommend a pelvic floor PT first.
  // =====================================================
  const TENSION_HTML = `
    <div class="redflag-alert-box" role="note">
      <strong>Please see a pelvic floor physical therapist first</strong>
      <p style="margin-top:6px; font-size:0.95rem;">
        Pain, pain during sex or trouble relaxing can mean your pelvic floor muscles are already too tight. For some women, squeezing exercises can make this worse. Please check with a pelvic floor physical therapist or your doctor before doing the squeezing exercises. Until then, you can read the lessons, use the bladder diary and practice slow, relaxed belly breathing.
      </p>
    </div>`;

  // =====================================================
  // VOICE COACH (optional, off by default) — uses the phone's built-in voice, works offline
  // =====================================================
  const VOICE_LINES = {
    squeeze: 'Squeeze and lift',
    relax: 'Relax completely',
    rest: 'Rest',
    inhale: 'Breathe in slowly',
    exhale: 'And breathe out'
  };
  let chosenVoice = null;

  function pickVoice() {
    try {
      const voices = window.speechSynthesis.getVoices() || [];
      const en = voices.filter((v) => /^en(-|_)/i.test(v.lang));
      const preferred = ['Samantha', 'Ava', 'Allison', 'Karen', 'Moira', 'Google US English', 'Microsoft Aria', 'Microsoft Jenny', 'female'];
      chosenVoice = preferred.map((n) => en.find((v) => v.name.toLowerCase().includes(n.toLowerCase()))).find(Boolean)
        || en.find((v) => /en-US/i.test(v.lang)) || en[0] || null;
    } catch (_) { chosenVoice = null; }
  }

  function speak(text, force) {
    if (!text || (!state.settings.voice && !force)) return;
    if (!('speechSynthesis' in window) || typeof window.SpeechSynthesisUtterance !== 'function') return;
    try {
      if (!chosenVoice) pickVoice();
      window.speechSynthesis.cancel();
      const u = new SpeechSynthesisUtterance(text);
      u.lang = 'en-US';
      u.rate = 0.92;
      u.pitch = 1;
      u.volume = 1;
      if (chosenVoice) u.voice = chosenVoice;
      window.speechSynthesis.speak(u);
    } catch (_) {}
  }

  function stopSpeaking() {
    try { if ('speechSynthesis' in window) window.speechSynthesis.cancel(); } catch (_) {}
  }

  /** iPhone only lets a page speak after a tap: say something silent from the tap. */
  function primeVoice() {
    if (!state.settings.voice || !('speechSynthesis' in window) || typeof window.SpeechSynthesisUtterance !== 'function') return;
    try {
      const u = new SpeechSynthesisUtterance(' ');
      u.volume = 0;
      window.speechSynthesis.speak(u);
    } catch (_) {}
  }
  try {
    if ('speechSynthesis' in window) window.speechSynthesis.onvoiceschanged = pickVoice;
  } catch (_) {}

  // =====================================================
  // TECHNIQUE CHECK — "Am I doing it right?"
  // =====================================================
  const TECHNIQUE_QUESTIONS = [
    {
      id: 'lift', good: 'yes',
      q: 'During the squeezes, did you feel a gentle squeeze and lift inside, as if holding in gas and urine at the same time?',
      tip: 'Try lying down with your knees bent: the muscles are easier to feel. Imagine stopping gas first, then lift gently. A faint feeling is normal at first. If you still can’t feel anything after 2 weeks, a pelvic floor physical therapist can check it with you.'
    },
    {
      id: 'soft', good: 'yes',
      q: 'Did your belly, buttocks and thighs stay soft?',
      tip: 'Use less effort: about half strength is enough. Rest one hand on your belly and one on your buttocks to notice if they tighten.'
    },
    {
      id: 'breath', good: 'yes',
      q: 'Did you keep breathing normally?',
      tip: 'Breathe out gently as you squeeze, or count out loud. Holding your breath pushes pressure down onto the pelvic floor.'
    },
    {
      id: 'release', good: 'yes',
      q: 'After each squeeze, did the muscles fully let go?',
      tip: 'Letting go is as important as squeezing. Breathe out slowly and let everything soften before the next squeeze. Take the full relax time.'
    },
    {
      id: 'push', good: 'no',
      q: 'Did you feel any pushing down, bulging or heaviness?',
      tip: 'The movement should go up and in, never down. Stop, relax completely and try a smaller, gentler squeeze. If you feel bulging or heaviness, please talk to your doctor or a pelvic floor physical therapist.'
    },
    {
      id: 'pain', good: 'no', stop: true,
      q: 'Did you feel any pain?',
      tip: 'Please stop the exercises for now and talk to your doctor or a pelvic floor physical therapist before you continue.'
    }
  ];

  function openTechniqueCheck() {
    const existing = document.getElementById('modal-technique');
    if (existing) existing.remove();
    const modal = document.createElement('div');
    modal.id = 'modal-technique';
    modal.className = 'modal-backdrop';
    modal.setAttribute('role', 'dialog');
    modal.setAttribute('aria-modal', 'true');
    modal.innerHTML = `
      <div class="modal-sheet">
        <div class="status-row">
          <span class="card-pill-tag" style="margin-bottom:0;">30-Second Check</span>
          <button type="button" class="secondary-btn" id="tech-close">Close</button>
        </div>
        <h2 class="two-tone-heading" style="margin-top:12px;">Am I Doing<br /><span>It Right?</span></h2>
        <p class="card-body-text" style="margin-bottom:14px;">Think about your last session and answer honestly. There are no wrong answers: this is how you learn.</p>
        <form id="tech-form">
          ${TECHNIQUE_QUESTIONS.map((t, i) => `
            <div class="quiz-question-block">
              <span class="quiz-question-title">${i + 1}. ${t.q}</span>
              <div class="quiz-options yesno">
                <label class="radio-card"><input type="radio" name="${t.id}" value="yes" required /><span>Yes</span></label>
                <label class="radio-card"><input type="radio" name="${t.id}" value="no" /><span>No</span></label>
              </div>
            </div>`).join('')}
          <button type="submit" class="primary-btn full-width">See my result →</button>
        </form>
      </div>`;
    document.body.appendChild(modal);
    modal.querySelector('#tech-close').addEventListener('click', () => modal.remove());
    modal.querySelector('#tech-form').addEventListener('submit', (e) => {
      e.preventDefault();
      const data = new FormData(e.target);
      const issues = TECHNIQUE_QUESTIONS.filter((t) => data.get(t.id) && data.get(t.id) !== t.good);
      state.techniqueCheck = { date: dayKey(), issues: issues.map((t) => t.id) };
      saveState();
      const stop = issues.some((t) => t.stop);
      const sheet = modal.querySelector('.modal-sheet');
      sheet.innerHTML = `
        <div class="card-pill-tag">${issues.length ? 'Your Tips' : 'Great Technique'}</div>
        <h2 class="two-tone-heading">${issues.length ? 'A few things<br /><span>to adjust</span>' : 'You’re doing<br /><span>it right!</span>'}</h2>
        ${stop ? `<div class="redflag-alert-box" role="alert"><strong>Please pause the exercises</strong><p style="margin-top:6px;">${TECHNIQUE_QUESTIONS.find((t) => t.id === 'pain').tip}</p></div>` : ''}
        ${issues.length
          ? `<ul class="tip-list">${issues.filter((t) => !t.stop).map((t) => `<li><strong>${t.q.replace(/\?$/, '')}?</strong><p>${t.tip}</p></li>`).join('')}</ul>
             <p class="card-body-text" style="margin:12px 0;">Repeat today’s lesson if it helps. Many women need a few weeks to feel the muscles clearly. A pelvic floor physical therapist can confirm your technique in one visit.</p>`
          : `<p class="card-body-text" style="margin-bottom:12px;">Gentle lift, soft belly and buttocks, normal breathing and a full release: that’s exactly the technique that builds strength. Keep going for at least 3 months.</p>`}
        <button type="button" class="primary-btn full-width" id="tech-done">Done</button>`;
      sheet.querySelector('#tech-done').addEventListener('click', () => { modal.remove(); announceMilestones(); });
      sheet.scrollTop = 0;
    });
  }

  // =====================================================
  // MILESTONES (no tricks: tied to real practice and the 3-month NICE goal)
  // =====================================================
  const practiceDaysCount = () => Object.keys(state.practiceLog).filter((k) => state.practiceLog[k] > 0).length;
  const MILESTONES = [
    { id: 'first', title: 'First session', need: 'Finish your first guided session', done: () => state.completedDays.length >= 1 },
    { id: 'three', title: 'All 3 sets in a day', need: 'Do 3 sets in one day', done: () => Object.values(state.practiceLog).some((n) => n >= 3) },
    { id: 'diary', title: 'Diary started', need: 'Log 3 diary entries', done: () => state.diary.length >= 3 },
    { id: 'streak3', title: '3 days in a row', need: 'Practice 3 days in a row', done: () => Math.max(state.bestStreak || 0, state.streak || 0) >= 3 },
    { id: 'week1', title: 'Week 1 complete', need: 'Complete Days 1–7', done: () => state.completedDays.length >= 7 },
    { id: 'days21', title: '21 days of practice', need: 'Practice on 21 different days', done: () => practiceDaysCount() >= 21 },
    { id: 'days30', title: '1 month of practice', need: 'Practice on 30 different days', done: () => practiceDaysCount() >= 30 },
    { id: 'days90', title: '3 months: the goal', need: 'Practice on 90 days, the time guidelines recommend', done: () => practiceDaysCount() >= 90 }
  ];

  function renderMilestones() {
    const grid = document.getElementById('milestone-grid');
    const count = document.getElementById('milestones-count');
    if (!grid) return;
    const done = MILESTONES.filter((m) => m.done());
    if (count) count.textContent = `${done.length} of ${MILESTONES.length}`;
    grid.innerHTML = MILESTONES.map((m) => {
      const ok = m.done();
      return `<div class="milestone ${ok ? 'unlocked' : ''}">
        <span class="milestone-icon" aria-hidden="true">${icon(ok ? 'award' : 'target')}</span>
        <strong>${m.title}</strong>
        <span class="milestone-need">${ok ? 'Unlocked' : m.need}</span>
      </div>`;
    }).join('');
  }

  function announceMilestones() {
    const fresh = MILESTONES.filter((m) => m.done() && !state.milestonesSeen.includes(m.id));
    if (!fresh.length) return;
    state.milestonesSeen.push(...fresh.map((m) => m.id));
    saveState();
    renderMilestones();
    if (typeof showToast === 'function') showToast(`Milestone unlocked: ${fresh[fresh.length - 1].title}`);
  }

  // =====================================================
  // PRACTICE HISTORY (each set with day and time)
  // =====================================================
  function formatWhen(ts) {
    const d = new Date(ts);
    return `${d.toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' })} · ${d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}`;
  }

  function renderPracticeHistory() {
    const el = document.getElementById('practice-history');
    if (!el) return;
    const items = state.practiceHistory.slice(-12).reverse();
    if (!items.length) {
      el.innerHTML = '<p class="muted-small">Your sets will appear here after your first session.</p>';
      return;
    }
    el.innerHTML = items.map((h) => `
      <div class="history-item">
        <span class="history-dot ${h.kind === 'session' ? 'session' : ''}" aria-hidden="true"></span>
        <div><strong>${h.kind === 'session' ? `Guided session · Day ${h.day}` : 'Short set (8 slow holds)'}</strong><span>${formatWhen(h.ts)}</span></div>
      </div>`).join('');
  }

  // =====================================================
  // WELCOME BACK (after missing at least one full day; no guilt)
  // =====================================================
  function renderComeback() {
    const card = document.getElementById('comeback-card');
    if (!card) return;
    const last = lastPracticeKey();
    const today = dayKey();
    const missed = last ? daysBetweenKeys(last, today) - 1 : 0;
    const show = missed >= 1 && setsDoneToday() === 0 && state.comebackDismissed !== today;
    card.hidden = !show;
    const text = document.getElementById('comeback-text');
    if (show && text) {
      text.textContent = missed === 1
        ? 'Missed yesterday? That’s completely normal. Your muscles remember: today is a fresh start. Just do today’s session.'
        : `It’s been ${missed} days. No problem at all: your muscles remember. Today is a fresh start. Just do today’s session.`;
    }
  }

  // =====================================================
  // REPORT FOR MY DOCTOR (print / save as PDF / share)
  // Everything is built on the phone; nothing is uploaded.
  // =====================================================
  const ANSWER_LABELS = {
    leakType: { label: 'Leaks happen', stress: 'With coughing, sneezing, laughing, lifting or exercise (stress)', urge: 'With a sudden strong urge (urge)', mixed: 'Both (mixed)' },
    frequency: { label: 'How often', occasional: 'A few times a month or less', weekly: 'A few times a week', daily: 'Once a day or more' },
    bother: { label: 'How bothersome', mild: 'Mild', moderate: 'Moderate', high: 'Very bothersome' },
    age: { label: 'Age range', '40-49': '40–49', '50-59': '50–59', '60+': '60+' },
    lifeStage: { label: 'Life stage', peri_post: 'Perimenopause or post-menopause', postpartum_over6w: 'Gave birth more than 6 weeks ago', postpartum_under6w: 'Pregnant or gave birth less than 6 weeks ago' },
    tried: { label: 'Tried before', none: 'Nothing structured', occasional_kegels: 'Occasional Kegels', pt_or_doctor: 'Saw a doctor or pelvic floor PT' },
    redFlags: { label: 'Safety symptoms reported', no: 'No', yes: 'Yes' },
    tension: { label: 'Pain or trouble relaxing reported', no: 'No', yes: 'Yes' }
  };

  function reportData() {
    const now = new Date();
    const last14 = [];
    for (let i = 13; i >= 0; i--) {
      const key = dayKey(new Date(now.getTime() - i * 86400000));
      last14.push({ key, sets: state.practiceLog[key] || 0 });
    }
    const byDay = [1, 2, 3, 4, 5, 6, 7].map((d) => {
      const entries = state.diary.filter((e) => e.day === d);
      const c = (cat) => entries.filter((e) => e.category === cat).length;
      return { day: d, leak: c('leak'), urge: c('urge'), trip: c('trip'), drink: c('drink'), night: entries.filter((e) => e.category === 'trip' && /night/i.test(e.detail)).length };
    });
    return { now, last14, byDay };
  }

  function openReport() {
    const { now, last14, byDay } = reportData();
    const old = document.getElementById('report-view');
    if (old) old.remove();
    const a = state.quizAnswers || {};
    const answers = Object.keys(ANSWER_LABELS)
      .filter((k) => a[k] !== undefined)
      .map((k) => `<tr><th>${ANSWER_LABELS[k].label}</th><td>${escapeHtml(ANSWER_LABELS[k][a[k]] || a[k])}</td></tr>`).join('');
    const setsTotal = last14.reduce((n, d) => n + d.sets, 0);
    const daysPracticed = last14.filter((d) => d.sets > 0).length;
    const fmtKey = (k) => new Date(`${k}T12:00:00`).toLocaleDateString([], { month: 'short', day: 'numeric' });
    const diaryRows = byDay.filter((d) => d.leak + d.urge + d.trip + d.drink > 0);
    const entries = state.diary.slice().sort((x, y) => x.timestamp - y.timestamp);
    const tech = state.techniqueCheck;
    const techText = tech
      ? (tech.issues.length
        ? `Self-check on ${fmtKey(tech.date)}: unsure about ${tech.issues.map((id) => ({ lift: 'feeling the lift', soft: 'keeping belly/buttocks soft', breath: 'breathing normally', release: 'fully relaxing', push: 'pushing down/bulging', pain: 'pain' }[id])).join(', ')}.`
        : `Self-check on ${fmtKey(tech.date)}: no problems reported.`)
      : 'Not done yet.';

    const view = document.createElement('div');
    view.id = 'report-view';
    view.setAttribute('role', 'dialog');
    view.setAttribute('aria-modal', 'true');
    view.innerHTML = `
      <div class="report-actions">
        <button type="button" class="primary-btn" id="report-print">Print / Save PDF</button>
        <button type="button" class="secondary-btn" id="report-share">Share</button>
        <button type="button" class="secondary-btn" id="report-close">Close</button>
      </div>
      <article class="report-doc">
        <header>
          <p class="report-brand">DryDay · Bladder &amp; Pelvic Floor Practice Summary</p>
          <h1>Report for my doctor or physical therapist</h1>
          <p class="report-meta">Created ${now.toLocaleDateString([], { year: 'numeric', month: 'long', day: 'numeric' })} on the patient's phone. Self-reported information from an educational program; not a medical record or diagnosis.</p>
        </header>

        <section>
          <h2>Practice (pelvic floor muscle training)</h2>
          <table class="report-table">
            <tr><th>Program</th><td>Week 1: ${state.completedDays.length} of 7 guided days completed</td></tr>
            <tr><th>Last 14 days</th><td>Practiced on ${daysPracticed} of 14 days · ${setsTotal} ${setsTotal === 1 ? 'set' : 'sets'} in total (goal: 3 sets of 8 squeezes a day, NICE NG123)</td></tr>
            <tr><th>Current streak</th><td>${state.streak} ${state.streak === 1 ? 'day' : 'days'}</td></tr>
            <tr><th>Technique</th><td>${techText}</td></tr>
          </table>
          <div class="report-bars" aria-label="Sets per day, last 14 days">
            ${last14.map((d) => `<div class="report-bar"><b>${d.sets}</b><span style="height:${Math.round(Math.min(d.sets, 3) / 3 * 64) + 2}px"></span><em>${fmtKey(d.key).replace(/\s/, '<br>')}</em></div>`).join('')}
          </div>
        </section>

        <section>
          <h2>About my symptoms (from the app questionnaire)</h2>
          ${answers ? `<table class="report-table">${answers}</table>` : '<p>Questionnaire not completed.</p>'}
        </section>

        <section>
          <h2>Bladder diary summary</h2>
          ${diaryRows.length ? `<table class="report-table grid">
            <tr><th>Program day</th><th>Leaks</th><th>Strong urges</th><th>Bathroom trips</th><th>At night</th><th>Drinks</th></tr>
            ${diaryRows.map((d) => `<tr><td>Day ${d.day}</td><td>${d.leak}</td><td>${d.urge}</td><td>${d.trip}</td><td>${d.night}</td><td>${d.drink}</td></tr>`).join('')}
          </table>` : '<p>No diary entries yet.</p>'}
        </section>

        ${entries.length ? `<section>
          <h2>Diary entries</h2>
          <table class="report-table grid small">
            <tr><th>Date</th><th>Time</th><th>What</th><th>Detail</th></tr>
            ${entries.map((e) => `<tr><td>${new Date(e.timestamp).toLocaleDateString([], { month: 'short', day: 'numeric' })}</td><td>${escapeHtml(e.timeLabel || '')}</td><td>${escapeHtml((DIARY_CATEGORIES[e.category] || {}).label || e.category)}</td><td>${escapeHtml(e.detail || '')}</td></tr>`).join('')}
          </table>
        </section>` : ''}

        <section>
          <h2>Questions I'd like to ask</h2>
          <ul class="report-questions">
            <li>Am I contracting the right muscles? Could you check my technique?</li>
            <li>Is pelvic floor training right for my type of leaks, or do I need other treatment?</li>
            <li>Should I change how often or how long I hold the squeezes?</li>
            <li>Is there anything in my bladder diary that worries you?</li>
          </ul>
        </section>
      </article>`;
    document.body.appendChild(view);
    document.body.classList.add('report-open');
    const close = () => { view.remove(); document.body.classList.remove('report-open'); };
    view.querySelector('#report-close').addEventListener('click', close);
    view.querySelector('#report-print').addEventListener('click', () => { try { window.print(); } catch (_) {} });
    view.querySelector('#report-share').addEventListener('click', async () => {
      const lines = [
        'DryDay — Bladder & pelvic floor practice summary',
        `Week 1: ${state.completedDays.length}/7 days completed. Last 14 days: practiced ${daysPracticed} days, ${setsTotal} ${setsTotal === 1 ? 'set' : 'sets'}.`,
        diaryRows.length ? 'Diary (leaks / urges / trips / drinks): ' + diaryRows.map((d) => `Day ${d.day}: ${d.leak}/${d.urge}/${d.trip}/${d.drink}`).join('; ') : 'No diary entries yet.',
        `Technique: ${techText}`,
        'Self-reported, educational program summary. Not a diagnosis.'
      ];
      const text = lines.join('\n');
      try {
        if (navigator.share) await navigator.share({ title: 'My DryDay summary', text });
        else { await navigator.clipboard.writeText(text); showToast('Summary copied. Paste it in an email or message.'); }
      } catch (_) {}
    });
  }

  // =====================================================
  // SAFETY GATE — pain / red-flag answers pause the squeezing exercises
  // until she confirms a clinician cleared her (asked every time until then).
  // =====================================================
  /** 'tension' | 'redflag' | null */
  function safetyGate() {
    if (state.tensionFlag && !state.tensionCleared) return 'tension';
    if (state.redFlagsDetected && !state.redFlagCleared) return 'redflag';
    return null;
  }

  /** Runs proceed() directly, or after she confirms she was cleared. clearOnly: just record the clearance. */
  function withSafetyGate(proceed, clearOnly) {
    const gate = safetyGate();
    if (!gate) { proceed(); return; }
    const old = document.getElementById('modal-safety');
    if (old) old.remove();
    const tension = gate === 'tension';
    const modal = document.createElement('div');
    modal.id = 'modal-safety';
    modal.className = 'modal-backdrop';
    modal.setAttribute('role', 'dialog');
    modal.setAttribute('aria-modal', 'true');
    modal.innerHTML = `
      <div class="modal-sheet">
        <div class="card-pill-tag">Safety Check</div>
        <h2 class="two-tone-heading">${tension ? 'Were you cleared by a<br /><span>physical therapist?</span>' : 'Did your doctor<br /><span>say it’s OK?</span>'}</h2>
        <p class="card-body-text" style="margin-bottom:14px;">${tension
          ? 'You told us about pelvic pain, pain during sex or trouble relaxing. Only start the squeezing exercises if a pelvic floor physical therapist or your doctor has checked you and said they are right for you.'
          : 'You told us about a symptom that should be checked first (such as blood in the urine, pain, fever, heaviness, or a recent birth). Only start if your doctor or a pelvic floor physical therapist has said the exercises are right for you.'}</p>
        <button type="button" class="primary-btn full-width" id="safety-no">${tension ? 'Not yet: do the relaxation instead' : 'Not yet'}</button>
        <button type="button" class="text-btn full-width" id="safety-yes">${tension ? 'Yes, a physical therapist or doctor cleared me' : 'Yes, my doctor or physical therapist said it’s OK'}</button>
      </div>`;
    document.body.appendChild(modal);
    modal.querySelector('#safety-no').addEventListener('click', () => {
      modal.remove();
      if (tension) {
        const lesson = document.getElementById('modal-session');
        if (lesson) lesson.remove();
        openRelaxModal();
      }
    });
    modal.querySelector('#safety-yes').addEventListener('click', () => {
      if (tension) state.tensionCleared = true; else state.redFlagCleared = true;
      saveState();
      modal.remove();
      renderSafetyCard();
      renderPracticeCard();
      if (!clearOnly && safetyGate()) { withSafetyGate(proceed); return; } // both flags: ask for the second one too
      proceed();
    });
  }

  /** Gentle down-training for a tense pelvic floor: slow belly breathing, no squeezing. Not counted as a set. */
  function openRelaxModal() {
    clearSessionTimer();
    const relaxDay = {
      day: state.currentDay,
      title: 'Relaxation',
      isMiniSet: true,
      isRelax: true,
      blocks: [{
        name: 'Relaxed Belly Breathing',
        position: 'Lying Down or Sitting',
        cue: 'Breathe in slowly and let your belly and pelvic floor soften and drop. Breathe out gently. No squeezing at all.',
        reps: 10,
        holdSeconds: 4,
        relaxSeconds: 6,
        isBreathing: true
      }]
    };
    const existing = document.getElementById('modal-session');
    if (existing) existing.remove();
    const modal = document.createElement('div');
    modal.id = 'modal-session';
    modal.className = 'modal-backdrop';
    modal.setAttribute('role', 'dialog');
    modal.setAttribute('aria-modal', 'true');
    modal.innerHTML = '<div class="modal-sheet"></div>';
    document.body.appendChild(modal);
    startInteractivePlayer(modal, relaxDay, null);
  }

  function renderSafetyCard() {
    const card = document.getElementById('safety-card');
    if (!card) return;
    const gate = safetyGate();
    card.hidden = !gate;
    if (!gate) { card.innerHTML = ''; return; }
    card.innerHTML = gate === 'tension' ? `
      <div class="white-card-header">
        <div class="soft-icon-box" aria-hidden="true">${icon('shield')}</div>
        <div class="white-card-title-wrap"><h3>See a physical therapist first</h3></div>
      </div>
      <p class="card-body-text">You told us about pain or trouble relaxing. Squeezing exercises are paused until a pelvic floor physical therapist says they are right for you. You can still use the relaxation routine, the diary and the report for your doctor.</p>
      <div class="white-card-footer">
        <button type="button" class="text-btn" data-action="clear-safety">I was cleared</button>
        <button type="button" class="inline-pill-btn" data-action="relax">Relaxation (2 min) →</button>
      </div>` : `
      <div class="white-card-header">
        <div class="soft-icon-box" aria-hidden="true">${icon('shield')}</div>
        <div class="white-card-title-wrap"><h3>Check with your doctor first</h3></div>
      </div>
      <p class="card-body-text">You told us about a symptom that should be checked before you start the exercises. You can read the lessons and use the diary and the report for your doctor in the meantime.</p>
      <div class="white-card-footer">
        <span class="muted-label">Safety first</span>
        <button type="button" class="inline-pill-btn" data-action="clear-safety">My doctor said it's OK</button>
      </div>`;
  }

  function formatTime(hhmm) {
    const [h, m] = String(hhmm || '09:00').split(':').map(Number);
    const d = new Date(2000, 0, 1, h, m);
    return d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
  }

  function renderRemindersSummary() {
    const el = document.getElementById('practice-reminders-text');
    if (!el) return;
    el.textContent = state.settings.reminderEnabled
      ? `Reminders: ${state.settings.reminderTimes.map(formatTime).join(' · ')} · Change`
      : 'Reminders: off · Set up';
  }

  // =====================================================
  // ABOUT, PRIVACY & SOURCES (same promises as the sales page)
  // =====================================================
  const SUPPORT_EMAIL = 'holauniversocanino@gmail.com';
  const OWNER = 'Pablo Vidal (Universo Perruno), Montevideo, Uruguay';
  const SOURCES = [
    ['NICE guideline NG123: Urinary incontinence and pelvic organ prolapse in women: management', 'https://www.nice.org.uk/guidance/ng123'],
    ['Cochrane review: Pelvic floor muscle training versus no treatment for urinary incontinence in women (Dumoulin et al.)', 'https://www.cochranelibrary.com/cdsr/doi/10.1002/14651858.CD005654.pub4/full'],
    ['NHS: Pelvic floor exercises', 'https://www.nhs.uk/common-health-questions/womens-health/what-are-pelvic-floor-exercises/'],
    ['AUA/SUFU guideline: Overactive bladder in adults', 'https://www.auanet.org/guidelines-and-quality/guidelines/overactive-bladder-(oab)-guideline'],
    ['ACOG: Urinary incontinence (patient FAQ)', 'https://www.acog.org/womens-health/faqs/urinary-incontinence'],
    ['NIA: Urinary incontinence in older adults', 'https://www.nia.nih.gov/health/bladder-health-and-incontinence/urinary-incontinence-older-adults'],
    ['NIDDK: Bladder control problems', 'https://www.niddk.nih.gov/health-information/urologic-diseases/bladder-control-problems'],
    ['Mayo Clinic: Kegel exercises, a how-to guide for women', 'https://www.mayoclinic.org/healthy-lifestyle/womens-health/in-depth/kegel-exercises/art-20045283']
  ];

  function openAbout() {
    const old = document.getElementById('modal-about');
    if (old) old.remove();
    const reviewed = REVIEWER && REVIEWER.name
      ? `The program was reviewed by ${escapeHtml(REVIEWER.name)}${REVIEWER.credentials ? ', ' + escapeHtml(REVIEWER.credentials) : ''}.`
      : 'It was written from the published clinical guidelines listed below; it has not been individually reviewed by a clinician.';
    const modal = document.createElement('div');
    modal.id = 'modal-about';
    modal.className = 'modal-backdrop';
    modal.setAttribute('role', 'dialog');
    modal.setAttribute('aria-modal', 'true');
    modal.innerHTML = `
      <div class="modal-sheet about-sheet">
        <div class="status-row">
          <span class="card-pill-tag" style="margin-bottom:0;">About DryDay</span>
          <button type="button" class="secondary-btn" id="about-close">Close</button>
        </div>
        <h2 class="two-tone-heading" style="margin-top:12px;">About, Privacy<br /><span>&amp; Sources</span></h2>

        <h4>Who makes DryDay</h4>
        <p>DryDay is an educational pelvic floor and bladder habits program made by ${OWNER}. ${reviewed} It does not replace your doctor or a pelvic floor physical therapist.</p>

        <h4>Where the advice comes from</h4>
        <p>Exercise amounts, hold times and the urge technique follow these sources, using the most conservative beginner option when they differ:</p>
        <ol class="source-list">${SOURCES.map(([t, u]) => `<li><a href="${u}" target="_blank" rel="noopener">${t}</a></li>`).join('')}</ol>

        <h4>Your privacy</h4>
        <ul class="about-list">
          <li><strong>On your phone only:</strong> your quiz answers, bladder diary, progress and settings. They are never sent to us.</li>
          <li><strong>Only if you turn on reminders:</strong> our reminder service stores your phone's notification address, time zone, your 3 reminder times, how many sets you did today and your discreet setting. No name, email or diary.</li>
          <li><strong>No ads and no trackers</strong> inside the app. We never sell your data.</li>
          <li><strong>Delete everything:</strong> turn off reminders (removes them from our service), then More → Reset App Data.</li>
        </ul>

        <h4>30-day money-back guarantee</h4>
        <p>If DryDay isn't right for you, email us within 30 days of your purchase and we'll refund 100%. One-time payment, no subscription.</p>

        <h4>Contact</h4>
        <p>Questions, access problems or refunds: <a href="mailto:${SUPPORT_EMAIL}?subject=DryDay">${SUPPORT_EMAIL}</a></p>
      </div>`;
    document.body.appendChild(modal);
    modal.querySelector('#about-close').addEventListener('click', () => modal.remove());
  }

  function renderStats() {
    const daysDoneEl = document.getElementById('stat-days-done');
    const streakEl = document.getElementById('stat-streak');
    if (daysDoneEl) daysDoneEl.textContent = `${state.completedDays.length} / 7`;
    if (streakEl) streakEl.textContent = `${state.streak} ${state.streak === 1 ? 'day' : 'days'}`;
    const diaryEl = document.getElementById('stat-diary');
    if (diaryEl) {
      const days = new Set(state.diary.map((e) => e.day)).size;
      diaryEl.textContent = `${state.diary.length} ${state.diary.length === 1 ? 'entry' : 'entries'}`;
      const note = document.getElementById('stat-diary-note');
      if (note) note.textContent = state.diary.length ? `Logged on ${days} of 7 days. Logging 3 or more days gives a clear picture.` : 'Every entry helps you and your doctor see patterns.';
    }
    const nightEl = document.getElementById('night-count');
    if (nightEl) nightEl.textContent = `${state.diary.filter((e) => e.category === 'trip' && /night/i.test(e.detail)).length} logged`;
    const bar = document.getElementById('stat-days-bar');
    if (bar) bar.style.width = `${Math.min(100, (state.completedDays.length / 7) * 100)}%`;
    const note = document.querySelector('.stat-note');
    if (note) note.textContent = state.streak > 0 ? 'Keep it going today' : 'Starts with your first session';
  }

  function renderQuizStatus() {
    const statusEl = document.getElementById('home-pattern-status');
    if (!statusEl) return;
    const labels = {
      stress: 'Stress Pattern',
      urge: 'Urge Pattern',
      mixed: 'Mixed Pattern'
    };
    if (!state.quizCompleted) {
      statusEl.textContent = 'Current pattern: Balanced Default';
    } else {
      statusEl.textContent = `Your pattern: ${labels[state.pattern] || 'Mixed Pattern'}`;
    }
  }

  function syncDayPills() {
    const dayPills = document.querySelectorAll('#home-day-pills .day-pill');
    dayPills.forEach((pill) => {
      const d = parseInt(pill.getAttribute('data-day'), 10);
      const isCurrent = d === state.currentDay;
      const isDone = state.completedDays.includes(d);
      pill.classList.toggle('active', isCurrent);
      pill.setAttribute('aria-selected', isCurrent ? 'true' : 'false');
      pill.textContent = isDone ? `Day ${d} ✓` : `Day ${d}`;
    });
  }

  function renderHomeDayContent() {
    if (typeof PROGRAM === 'undefined') return;
    const week1 = PROGRAM.weeks[0];
    const dayData = week1.days.find((d) => d.day === state.currentDay) || week1.days[0];

    syncDayPills();

    const weekLabel = document.getElementById('today-week-label');
    const titleEl = document.getElementById('today-title');
    const summaryEl = document.getElementById('today-summary');
    const durationEl = document.getElementById('today-duration');
    const habitTextEl = document.getElementById('today-habit-text');
    const patternBadgeEl = document.getElementById('today-pattern-badge');
    const homeDiaryCountEl = document.getElementById('home-diary-count');
    const diaryActiveDayLabel = document.getElementById('diary-active-day-label');

    const isDone = state.completedDays.includes(dayData.day);
    if (weekLabel) weekLabel.textContent = `Week 1 · Day ${dayData.day}${isDone ? ' (Completed ✓)' : ''}`;
    if (titleEl) titleEl.textContent = dayData.title;
    if (summaryEl) summaryEl.textContent = dayData.summary;
    if (durationEl) durationEl.textContent = dayData.duration;
    if (habitTextEl) habitTextEl.textContent = dayData.habit;
    const poseEl = document.getElementById('today-pose');
    if (poseEl) poseEl.innerHTML = POSE_ART[dayPoseKey(dayData)];

    if (patternBadgeEl) {
      const pAdj = PROGRAM.patternAdjustments[state.pattern] || PROGRAM.patternAdjustments.mixed;
      patternBadgeEl.textContent = state.quizCompleted ? pAdj.label : 'Tailored Daily Plan';
    }

    renderPracticeCard();
    renderComeback();
    renderSafetyCard();
    renderRemindersSummary();

    const dayEntriesCount = state.diary.filter((e) => e.day === state.currentDay).length;
    if (homeDiaryCountEl) {
      homeDiaryCountEl.textContent = `Day ${state.currentDay} entries: ${dayEntriesCount}`;
    }
    if (diaryActiveDayLabel) {
      diaryActiveDayLabel.textContent = `Logging for Day ${state.currentDay}`;
    }
  }

  function renderPlanList() {
    if (typeof PROGRAM === 'undefined') return;
    const listEl = document.getElementById('plan-week1-list');
    const futureEl = document.getElementById('plan-future-weeks');

    if (listEl) {
      const week1 = PROGRAM.weeks[0];
      listEl.innerHTML = week1.days
        .map((d) => {
          const isDone = state.completedDays.includes(d.day);
          const isCurrent = !isDone && d.day === state.currentDay;
          return `
            <button type="button" class="plan-day-item timeline ${isDone ? 'done' : ''} ${isCurrent ? 'current' : ''}" data-open-day="${d.day}">
              <span class="timeline-dot" aria-hidden="true">${isDone ? '✓' : d.day}</span>
              <span class="plan-pose" aria-hidden="true">${POSE_ART[dayPoseKey(d)]}</span>
              <div class="plan-day-left">
                <strong>Day ${d.day}: ${d.title}</strong>
                <span>${d.duration} · Lesson + Guided Exercise</span>
              </div>
              <span class="plan-day-badge">${isDone ? 'Done ✓' : 'Start →'}</span>
            </button>
          `;
        })
        .join('');
    }

    if (futureEl) {
      const futureWeeks = PROGRAM.weeks.slice(1);
      futureEl.innerHTML = futureWeeks
        .map((w) => `
          <div class="plan-day-item" style="opacity:0.85;">
            <div class="plan-day-left">
              <strong>${w.title}</strong>
              <span>${w.description}</span>
            </div>
            <span class="plan-day-badge">Week ${w.weekNumber}</span>
          </div>
        `)
        .join('');
    }
  }

  // =====================================================
  // PHASE 3: 1-MINUTE QUIZ & SAFETY SCREEN
  // =====================================================
  function openQuizModal() {
    const existing = document.getElementById('modal-quiz');
    if (existing) existing.remove();

    const modal = document.createElement('div');
    modal.id = 'modal-quiz';
    modal.className = 'modal-backdrop';
    modal.setAttribute('role', 'dialog');
    modal.setAttribute('aria-modal', 'true');
    modal.innerHTML = `
      <div class="modal-sheet">
        <div class="status-row">
          <span class="quiz-progress-text" style="margin-bottom:0;">1-Minute Personalization</span>
          ${state.quizCompleted ? '<button type="button" class="secondary-btn" id="btn-cancel-quiz">Close</button>' : ''}
        </div>
        <h2 class="two-tone-heading" style="margin-top:8px;">Personalize Your<br /><span>Week 1 Plan</span></h2>
        <p class="card-body-text" style="margin-bottom:10px;">DryDay helps with leaks when you cough, sneeze or lift, with sudden urges, or both. There are no wrong answers.</p>
        <button type="button" class="quiz-quick-btn" id="btn-quiz-quick">In a hurry? Answer only the 2 safety questions →</button>

        <form id="quiz-form">
          <div class="quiz-question-block quiz-optional">
            <span class="quiz-question-title">1. When do leaks or bladder worries usually happen?</span>
            <div class="quiz-options">
              <label class="radio-card"><input type="radio" name="leakType" value="stress" required checked /><span>When I cough, sneeze, laugh, lift, or exercise</span></label>
              <label class="radio-card"><input type="radio" name="leakType" value="urge" /><span>With a sudden, strong urge to reach the bathroom</span></label>
              <label class="radio-card"><input type="radio" name="leakType" value="mixed" /><span>Both physical effort and sudden urges</span></label>
            </div>
          </div>

          <div class="quiz-question-block quiz-optional">
            <span class="quiz-question-title">2. How often do leaks happen?</span>
            <div class="quiz-options">
              <label class="radio-card"><input type="radio" name="frequency" value="occasional" checked /><span>A few times a month or less</span></label>
              <label class="radio-card"><input type="radio" name="frequency" value="weekly" /><span>A few times a week</span></label>
              <label class="radio-card"><input type="radio" name="frequency" value="daily" /><span>Once a day or more</span></label>
            </div>
          </div>

          <div class="quiz-question-block quiz-optional">
            <span class="quiz-question-title">3. How bothersome is this in your daily life?</span>
            <div class="quiz-options">
              <label class="radio-card"><input type="radio" name="bother" value="mild" checked /><span>Mild — I want to prevent it from getting worse</span></label>
              <label class="radio-card"><input type="radio" name="bother" value="moderate" /><span>Moderate — I plan around bathrooms or pads</span></label>
              <label class="radio-card"><input type="radio" name="bother" value="high" /><span>Very bothersome — it affects my confidence daily</span></label>
            </div>
          </div>

          <div class="quiz-question-block quiz-optional">
            <span class="quiz-question-title">4. Your age range:</span>
            <div class="quiz-options">
              <label class="radio-card"><input type="radio" name="age" value="40-49" /><span>40–49</span></label>
              <label class="radio-card"><input type="radio" name="age" value="50-59" checked /><span>50–59</span></label>
              <label class="radio-card"><input type="radio" name="age" value="60+" /><span>60+</span></label>
            </div>
          </div>

          <div class="quiz-question-block quiz-optional">
            <span class="quiz-question-title">5. Menopause &amp; childbirth history:</span>
            <div class="quiz-options">
              <label class="radio-card"><input type="radio" name="lifeStage" value="peri_post" checked /><span>Around or after menopause: periods changing or stopped (no recent birth)</span></label>
              <label class="radio-card"><input type="radio" name="lifeStage" value="postpartum_over6w" /><span>Gave birth more than 6 weeks ago</span></label>
              <label class="radio-card"><input type="radio" name="lifeStage" value="postpartum_under6w" /><span>Currently pregnant or gave birth less than 6 weeks ago</span></label>
            </div>
          </div>

          <div class="quiz-question-block quiz-optional">
            <span class="quiz-question-title">6. What have you tried so far?</span>
            <div class="quiz-options">
              <label class="radio-card"><input type="radio" name="tried" value="none" checked /><span>Nothing structured yet</span></label>
              <label class="radio-card"><input type="radio" name="tried" value="occasional_kegels" /><span>Occasional Kegels on my own</span></label>
              <label class="radio-card"><input type="radio" name="tried" value="pt_or_doctor" /><span>Saw a doctor or pelvic floor physical therapist</span></label>
            </div>
          </div>

          <div class="quiz-question-block">
            <span class="quiz-question-title">7. Safety Check — Do you currently have any of these?</span>
            <p class="muted-small" style="margin-bottom:8px;">
              Blood in your urine, pain or burning when passing urine, fever, frequent urinary infections, a feeling of bulging or heaviness in the vagina, or sudden new leaks with back/leg numbness.
            </p>
            <div class="quiz-options">
              <label class="radio-card"><input type="radio" name="redFlags" value="no" checked /><span>No, none of these</span></label>
              <label class="radio-card"><input type="radio" name="redFlags" value="yes" /><span>Yes, I have one or more of these</span></label>
            </div>
          </div>

          <div class="quiz-question-block">
            <span class="quiz-question-title">8. Pain &amp; Relaxing Check — Do you often have any of these?</span>
            <p class="muted-small" style="margin-bottom:8px;">
              Pelvic or vaginal pain, pain during sex, pain when inserting a tampon, or trouble relaxing your pelvic muscles or starting to pee.
            </p>
            <div class="quiz-options">
              <label class="radio-card"><input type="radio" name="tension" value="no" checked /><span>No</span></label>
              <label class="radio-card"><input type="radio" name="tension" value="yes" /><span>Yes, one or more of these</span></label>
            </div>
          </div>

          <button type="submit" class="primary-btn full-width">See My Personalized Plan →</button>
        </form>
      </div>
    `;

    document.body.appendChild(modal);

    const quickBtn = modal.querySelector('#btn-quiz-quick');
    quickBtn.addEventListener('click', () => {
      const form = modal.querySelector('#quiz-form');
      const quick = !form.classList.contains('quick');
      form.classList.toggle('quick', quick);
      quickBtn.textContent = quick ? '← Show all 8 questions (better personalization)' : 'In a hurry? Answer only the 2 safety questions →';
    });

    const cancelBtn = modal.querySelector('#btn-cancel-quiz');
    if (cancelBtn) {
      cancelBtn.addEventListener('click', () => modal.remove());
    }

    modal.querySelector('#quiz-form').addEventListener('submit', (e) => {
      e.preventDefault();
      const formData = new FormData(e.target);
      const quick = e.target.classList.contains('quick');
      const leakType = quick ? 'mixed' : (formData.get('leakType') || 'mixed');
      const lifeStage = formData.get('lifeStage') || 'peri_post';
      const hasRedFlag = formData.get('redFlags') === 'yes' || lifeStage === 'postpartum_under6w';

      state.quizCompleted = true;
      state.pattern = leakType;
      state.redFlagsDetected = hasRedFlag;
      state.tensionFlag = formData.get('tension') === 'yes';
      state.tensionCleared = false;
      state.redFlagCleared = false;
      if (quick) formData.set('quickQuiz', 'yes');
      state.quizAnswers = Object.fromEntries(formData.entries());
      saveState();

      renderQuizStatus();
      renderHomeDayContent();
      renderSafetyCard();

      showQuizResultInModal(modal, leakType, hasRedFlag);
    });
  }

  function showQuizResultInModal(modal, pattern, hasRedFlag) {
    const pInfo = PROGRAM.patternAdjustments[pattern] || PROGRAM.patternAdjustments.mixed;
    const titleMap = {
      stress: 'Stress Pattern',
      urge: 'Urge Pattern',
      mixed: 'Mixed Pattern'
    };

    const redFlagHtml = hasRedFlag
      ? `
        <div class="redflag-alert-box" role="alert">
          <strong>Gentle Medical Check Recommended</strong>
          <p style="margin-top:6px; font-size:0.95rem;">
            Because you noted a safety symptom (such as pain, blood in urine, heaviness, neurological symptoms, pregnancy, or birth within the last 6 weeks), please check in with your doctor or a pelvic floor physical therapist before starting active exercises. You still have full access to read all educational lessons and habits inside DryDay.
          </p>
        </div>
      `
      : '';

    modal.querySelector('.modal-sheet').innerHTML = `
      <div class="card-pill-tag">Your Personalized Result</div>
      <h2 class="two-tone-heading">Your Pattern:<br /><span>${titleMap[pattern]}</span></h2>
      <p class="card-body-text" style="margin-bottom:14px;">${pInfo.summaryNote}</p>
      ${redFlagHtml}
      ${state.tensionFlag ? TENSION_HTML : ''}
      <div class="disclaimer-box">
        <strong>Your Week 1 Focus:</strong>
        <p style="margin-top:4px;">Days 1–7 combine a 1-minute lesson, a 5-minute guided pelvic floor session tailored to your ${titleMap[pattern].toLowerCase()}, and one small daily habit.</p>
      </div>
      <button type="button" id="btn-finish-quiz" class="primary-btn full-width">Go to Week 1 · Day ${state.currentDay} →</button>
    `;

    modal.querySelector('#btn-finish-quiz').addEventListener('click', () => {
      modal.remove();
    });
  }

  // =====================================================
  // PHASE 4: LESSON & GUIDED SESSION PLAYER
  // =====================================================
  let sessionTimer = null;

  function clearSessionTimer() {
    if (sessionTimer) {
      clearInterval(sessionTimer);
      sessionTimer = null;
    }
  }

  function openDaySessionModal(dayNumber) {
    clearSessionTimer();
    const week1 = PROGRAM.weeks[0];
    const dayData = week1.days.find((d) => d.day === dayNumber) || week1.days[0];
    const patternAdj = PROGRAM.patternAdjustments[state.pattern] || PROGRAM.patternAdjustments.mixed;

    const existing = document.getElementById('modal-session');
    if (existing) existing.remove();

    const modal = document.createElement('div');
    modal.id = 'modal-session';
    modal.className = 'modal-backdrop';
    modal.setAttribute('role', 'dialog');
    modal.setAttribute('aria-modal', 'true');

    // Step 1: Lesson View
    modal.innerHTML = `
      <div class="modal-sheet">
        <div class="status-row">
          <span class="card-pill-tag" style="margin-bottom:0;">Week 1 · Day ${dayData.day} Lesson</span>
          <button type="button" class="secondary-btn" id="btn-close-session">Close</button>
        </div>
        <h2 class="two-tone-heading" style="margin-top:12px;">${dayData.title}</h2>
        ${state.tensionFlag && !state.tensionCleared ? TENSION_HTML : ''}
        ${state.redFlagsDetected && !state.redFlagCleared ? `
        <div class="redflag-alert-box" role="note">
          <strong>Safety reminder</strong>
          <p style="margin-top:6px; font-size:0.95rem;">You reported a symptom that should be checked by your doctor or a pelvic floor physical therapist before you start the exercises. You can keep reading the lessons.</p>
        </div>` : ''}
        <figure class="pose-panel">
          ${POSE_ART[dayPoseKey(dayData)]}
          <figcaption>${POSE_CAPTIONS[dayPoseKey(dayData)]}</figcaption>
        </figure>
        ${safetyGate() === 'tension' ? `
        <details class="lesson-later">
          <summary>Exercise lesson (for after a physical therapist clears you)</summary>
          <div class="lesson-content">${dayData.lessonHtml}</div>
        </details>` : `
        <div class="lesson-content">
          ${dayData.lessonHtml}
        </div>`}
        <div class="disclaimer-box">
          <strong>${patternAdj.label}:</strong>
          <p style="margin-top:4px; font-size:0.94rem;">${patternAdj.summaryNote}</p>
        </div>
        <p class="safety-note">${dayData.safetyNote || 'Stop if you feel pain. Never hold your breath or push down. If your symptoms get worse, talk to your doctor or a pelvic floor physical therapist.'}</p>
        ${safetyGate() === 'tension' ? `
        <button type="button" id="btn-lesson-relax" class="primary-btn full-width">Do the 2-minute relaxation instead →</button>
        <button type="button" id="btn-launch-player" class="text-btn full-width">A physical therapist cleared me: start the exercises</button>` : safetyGate() === 'redflag' ? `
        <button type="button" id="btn-launch-player" class="secondary-btn full-width">My doctor said it's OK: start the session</button>` : `
        <button type="button" id="btn-launch-player" class="primary-btn full-width">
          Start 5-Min Guided Session →
        </button>`}
      </div>
    `;

    document.body.appendChild(modal);

    modal.querySelector('#btn-close-session').addEventListener('click', () => {
      clearSessionTimer();
      modal.remove();
    });

    modal.querySelector('#btn-launch-player').addEventListener('click', () => {
      primeVoice();
      withSafetyGate(() => startInteractivePlayer(modal, dayData, patternAdj));
    });
    const relaxBtn = modal.querySelector('#btn-lesson-relax');
    if (relaxBtn) relaxBtn.addEventListener('click', () => { modal.remove(); openRelaxModal(); });
  }

  /**
   * Turns the day's blocks (plus the pattern bonus on Days 2–7) into a flat list
   * of timed steps: squeeze / relax for exercises, inhale / exhale for breathing
   * blocks, and rest for rest blocks.
   */
  function buildSessionTimeline(dayData, patternAdj) {
    const blocks = [...dayData.blocks];
    // Add pattern-tailored bonus block on Days 2–7
    if (!dayData.isMiniSet && dayData.day >= 2 && patternAdj && patternAdj.bonusBlock) {
      blocks.push({
        name: 'Brief Rest Before Pattern Bonus',
        position: 'Relaxed',
        cue: 'Take a slow breath before your personalized pattern bonus set.',
        isRest: true,
        restSeconds: 12
      });
      blocks.push(patternAdj.bonusBlock);
    }

    const totalBlocks = blocks.length;
    const steps = [
      {
        blockName: 'Get Ready',
        position: dayData.blocks[0].position,
        cue: 'Settle into a comfortable position. Breathe normally and keep your belly, buttocks and thighs relaxed.',
        phase: 'rest',
        seconds: 10,
        blockIndex: 0,
        totalBlocks
      }
    ];

    blocks.forEach((b, i) => {
      const base = {
        blockName: b.name,
        position: b.position,
        cue: b.cue,
        blockIndex: i + 1,
        totalBlocks
      };

      if (b.isRest) {
        steps.push(Object.assign({}, base, { phase: 'rest', seconds: b.restSeconds }));
        return;
      }

      for (let rep = 1; rep <= b.reps; rep++) {
        steps.push(Object.assign({}, base, {
          phase: b.isBreathing ? 'inhale' : 'squeeze',
          seconds: b.holdSeconds,
          rep,
          reps: b.reps
        }));
        steps.push(Object.assign({}, base, {
          phase: b.isBreathing ? 'exhale' : 'relax',
          seconds: b.relaxSeconds,
          rep,
          reps: b.reps
        }));
      }
    });

    return steps;
  }

  const PHASE_LABELS = {
    squeeze: 'Squeeze & Lift',
    relax: 'Relax Completely',
    rest: 'Rest',
    inhale: 'Breathe In',
    exhale: 'Breathe Out'
  };

  // CSS class used by the animated circle for each phase
  const PHASE_CLASSES = {
    squeeze: 'phase-squeeze',
    inhale: 'phase-squeeze',
    relax: 'phase-relax',
    exhale: 'phase-relax',
    rest: 'phase-rest'
  };

  function startInteractivePlayer(modal, dayData, patternAdj) {
    clearSessionTimer();
    const steps = buildSessionTimeline(dayData, patternAdj);
    const totalSeconds = steps.reduce((sum, s) => sum + s.seconds, 0);

    let stepIndex = 0;
    let remaining = steps[0].seconds;
    let elapsed = 0;
    let paused = false;
    let currentPose = dayPoseKey(dayData);

    modal.querySelector('.modal-sheet').innerHTML = `
      <div class="session-player-box">
        <div class="status-row">
          <span class="card-pill-tag" style="margin-bottom:0;" id="sp-block-count">Day ${dayData.day}</span>
          <button type="button" class="secondary-btn" id="sp-close">Close</button>
        </div>

        <div class="sp-pose" id="sp-pose" aria-hidden="true"></div>

        <div class="session-block-header">
          <span class="session-position-pill" id="sp-position"></span>
          <h3 id="sp-block-name"></h3>
          <p class="session-cue-text" id="sp-cue"></p>
        </div>

        <div class="circle-stage">
          <div class="breathing-circle" id="sp-circle">
            <span class="circle-phase-label" id="sp-phase"></span>
            <span class="circle-timer-num" id="sp-timer" aria-hidden="true"></span>
          </div>
        </div>

        <div class="session-rep-counter" id="sp-rep"></div>
        <p class="sr-only" id="sp-live" aria-live="polite"></p>

        <div class="session-progress-bar" aria-hidden="true">
          <div class="session-progress-fill" id="sp-progress"></div>
        </div>

        <div class="session-controls-row">
          <button type="button" class="primary-btn" id="sp-pause">Pause</button>
          <button type="button" class="danger-outline-btn" id="sp-skip">Skip Set</button>
        </div>

        <div class="session-toggles-row">
          <button type="button" class="chip-toggle-btn" id="sp-sound" aria-pressed="false">Sound</button>
          <button type="button" class="chip-toggle-btn" id="sp-vibe" aria-pressed="false">Vibration</button>
          <button type="button" class="chip-toggle-btn" id="sp-voice" aria-pressed="false">Voice</button>
        </div>
      </div>
    `;

    const el = (id) => modal.querySelector('#' + id);

    function renderToggles() {
      const s = el('sp-sound');
      const v = el('sp-vibe');
      s.classList.toggle('active', state.settings.sound);
      s.setAttribute('aria-pressed', String(state.settings.sound));
      s.textContent = state.settings.sound ? 'Sound On' : 'Sound Off';
      v.classList.toggle('active', state.settings.vibration);
      v.setAttribute('aria-pressed', String(state.settings.vibration));
      v.textContent = state.settings.vibration ? 'Vibration On' : 'Vibration Off';
      const vc = el('sp-voice');
      vc.classList.toggle('active', !!state.settings.voice);
      vc.setAttribute('aria-pressed', String(!!state.settings.voice));
      vc.textContent = state.settings.voice ? 'Voice On' : 'Voice Off';
    }

    function renderStep(announce) {
      const step = steps[stepIndex];
      el('sp-block-count').textContent = step.blockIndex === 0
        ? (dayData.isRelax ? 'Relaxation · get ready' : `Day ${dayData.day} · Starting`)
        : dayData.isRelax
          ? 'Relaxation · no squeezing'
          : dayData.isMiniSet
          ? `Day ${dayData.day} · Short set`
          : `Day ${dayData.day} · Part ${step.blockIndex} of ${step.totalBlocks}`;
      el('sp-position').textContent = step.position;
      const pk = poseKey(step.position) || currentPose;
      if (pk !== currentPose || !el('sp-pose').innerHTML) {
        currentPose = pk;
        el('sp-pose').innerHTML = POSE_ART[currentPose];
      }
      el('sp-block-name').textContent = step.blockName;
      el('sp-cue').textContent = step.cue;
      el('sp-phase').textContent = PHASE_LABELS[step.phase];
      el('sp-timer').textContent = remaining;
      el('sp-rep').textContent = step.rep ? `Rep ${step.rep} of ${step.reps}` : '';

      const circle = el('sp-circle');
      circle.classList.remove('phase-squeeze', 'phase-relax', 'phase-rest');
      circle.classList.add(PHASE_CLASSES[step.phase]);

      el('sp-progress').style.width = `${Math.min(100, (elapsed / totalSeconds) * 100)}%`;

      if (announce) {
        el('sp-live').textContent = `${PHASE_LABELS[step.phase]}, ${step.seconds} seconds`;
        speak(step.blockIndex === 0 ? 'Get comfortable, and breathe normally.' : VOICE_LINES[step.phase]);
        if (step.phase === 'squeeze' || step.phase === 'inhale') {
          playCueTone(620, 200);
          triggerVibration(120);
        } else if (step.phase === 'relax' || step.phase === 'exhale') {
          playCueTone(420, 260);
          triggerVibration([40, 60, 40]);
        }
      }
    }

    function goToStep(index) {
      if (index >= steps.length) {
        finishSession();
        return;
      }
      stepIndex = index;
      remaining = steps[stepIndex].seconds;
      renderStep(true);
    }

    function tick() {
      if (paused) return;
      remaining -= 1;
      elapsed += 1;
      if (remaining <= 0) {
        goToStep(stepIndex + 1);
      } else {
        el('sp-timer').textContent = remaining;
        el('sp-progress').style.width = `${Math.min(100, (elapsed / totalSeconds) * 100)}%`;
      }
    }

    function finishSession() {
      clearSessionTimer();
      if (dayData.isRelax) {
        speak('Well done. Relaxation complete.');
        modal.querySelector('.modal-sheet').innerHTML = `
          <div class="card-pill-tag">Relaxation Complete</div>
          <h2 class="two-tone-heading">Nicely done.<br /><span>Stay soft.</span></h2>
          <p class="card-body-text" style="margin-bottom:14px;">Slow belly breathing helps tense pelvic muscles let go. You can repeat it any time, especially when you feel tension or pain building.</p>
          <div class="disclaimer-box"><strong>Next step:</strong><p style="margin-top:4px;">Book a visit with a pelvic floor physical therapist. Your <strong>Report for My Doctor</strong> (Progress tab) can help you explain what's going on.</p></div>
          <button type="button" id="sp-done" class="primary-btn full-width">Back to Home</button>`;
        modal.querySelector('#sp-done').addEventListener('click', () => { modal.remove(); switchTab('home'); });
        return;
      }
      const setsToday = addPracticeSet(dayData.isMiniSet ? 'short' : 'session', dayData.day);
      speak('Well done. Session complete.');
      if (!dayData.isMiniSet) markDayComplete(dayData.day);
      playCueTone(700, 400);
      triggerVibration([80, 80, 160]);

      const setsLine = setsToday >= 3
        ? 'That makes 3 sets today. Great job — that is the daily amount health guidelines recommend.'
        : `That makes ${setsToday} of 3 sets today. Do ${3 - setsToday === 1 ? '1 more short set' : '2 more short sets'} later today (about 2 minutes each) from the Home screen.`;

      if (dayData.isMiniSet) {
        modal.querySelector('.modal-sheet').innerHTML = `
          <div class="card-pill-tag">Short Set Complete</div>
          <h2 class="two-tone-heading">Set done.<br /><span>Well done!</span></h2>
          ${setsDotsHtml(setsToday)}
          <p class="card-body-text" style="margin-bottom:16px;">${setsLine}</p>
          <button type="button" id="sp-done" class="primary-btn full-width">Back to Home</button>
        `;
        modal.querySelector('#sp-done').addEventListener('click', () => {
          modal.remove();
          switchTab('home');
          announceMilestones();
        });
        return;
      }

      const isLast = dayData.day >= PROGRAM.weeks[0].days.length;
      modal.querySelector('.modal-sheet').innerHTML = `
        <div class="card-pill-tag">Session Complete</div>
        <h2 class="two-tone-heading">Day ${dayData.day}<br /><span>Done. Well done!</span></h2>
        ${PHOTOS.done ? `<div class="done-photo"><img src="${PHOTOS.done}" alt="" /></div>` : ''}
        ${setsDotsHtml(setsToday)}
        <p class="card-body-text" style="margin-bottom:12px;">
          ${isLast
            ? 'You finished Week 1. Open the Progress tab to see your week.'
            : 'Every session helps your muscles learn. Come back tomorrow for the next day.'}
        </p>
        <p class="card-body-text" style="margin-bottom:16px;"><strong>${setsLine}</strong></p>
        <div class="disclaimer-box habit-box">
          <strong>${icon('sparkle')} Today's small habit:</strong>
          <p style="margin-top:4px;">${dayData.habit}</p>
        </div>
        ${!state.techniqueCheck ? `
        <div class="technique-offer">
          <strong>Am I doing it right?</strong>
          <p>Take the 30-second technique check while the session is fresh.</p>
          <button type="button" class="secondary-btn" id="sp-technique">Check my technique →</button>
        </div>` : ''}
        <button type="button" id="sp-done" class="primary-btn full-width">Back to Home</button>
      `;
      modal.querySelector('#sp-done').addEventListener('click', () => {
        modal.remove();
        switchTab('home');
        announceMilestones();
      });
      const techBtn = modal.querySelector('#sp-technique');
      if (techBtn) {
        techBtn.addEventListener('click', () => {
          modal.remove();
          switchTab('home');
          openTechniqueCheck();
        });
      }
    }

    el('sp-close').addEventListener('click', () => {
      clearSessionTimer();
      stopSpeaking();
      modal.remove();
    });

    el('sp-voice').addEventListener('click', () => {
      state.settings.voice = !state.settings.voice;
      saveState();
      renderToggles();
      syncSettingsControls();
      if (state.settings.voice) speak('Voice coach on.', true); else stopSpeaking();
    });

    el('sp-pause').addEventListener('click', () => {
      paused = !paused;
      if (paused) stopSpeaking();
      el('sp-pause').textContent = paused ? 'Resume' : 'Pause';
      el('sp-live').textContent = paused ? 'Paused' : 'Resumed';
    });

    el('sp-skip').addEventListener('click', () => {
      // Jump to the first step of the next set
      const currentBlock = steps[stepIndex].blockIndex;
      let next = stepIndex + 1;
      while (next < steps.length && steps[next].blockIndex === currentBlock) {
        elapsed += steps[next].seconds;
        next += 1;
      }
      elapsed += remaining;
      goToStep(next);
    });

    el('sp-sound').addEventListener('click', () => {
      state.settings.sound = !state.settings.sound;
      saveState();
      renderToggles();
      if (state.settings.sound) playCueTone(520, 150);
      syncSettingsControls();
    });

    el('sp-vibe').addEventListener('click', () => {
      state.settings.vibration = !state.settings.vibration;
      saveState();
      renderToggles();
      triggerVibration(60);
      syncSettingsControls();
    });

    renderToggles();
    renderStep(false);
    sessionTimer = setInterval(tick, 1000);
  }

  function toDateKey(date) {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }

  /** The "app day": with "My day starts at 2 AM", 01:30 still counts as the day before. */
  function dayKey(date = new Date()) {
    const shift = Math.min(Math.max(Number(state.settings.dayStart) || 0, 0), 4);
    return toDateKey(new Date(date.getTime() - shift * 3600000));
  }

  const daysBetweenKeys = (a, b) => Math.round((Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`)) / 86400000);

  function lastPracticeKey() {
    const keys = Object.keys(state.practiceLog).filter((k) => state.practiceLog[k] > 0).sort();
    return keys.length ? keys[keys.length - 1] : null;
  }

  // =====================================================
  // DAILY PRACTICE: 3 SETS PER DAY
  // NICE NG123 1.4.5: "at least 8 contractions performed 3 times per day";
  // 1.4.4: a trial of at least 3 months. The guided session counts as set 1;
  // two short sets of 8 slow holds complete the day.
  // =====================================================
  function setsDoneToday() {
    return state.practiceLog[dayKey()] || 0;
  }

  function addPracticeSet(kind = 'short', day = state.currentDay) {
    const key = dayKey();
    state.practiceLog[key] = (state.practiceLog[key] || 0) + 1;
    state.practiceHistory.push({ ts: Date.now(), kind, day });
    if (state.practiceHistory.length > 400) state.practiceHistory = state.practiceHistory.slice(-400);
    saveState();
    renderPracticeCard();
    if (typeof syncPush === 'function') syncPush();
    return state.practiceLog[key];
  }

  function renderPracticeCard() {
    const done = setsDoneToday();
    const badge = document.getElementById('practice-count-badge');
    const btn = document.getElementById('btn-start-mini-set');
    const text = document.getElementById('practice-text');
    if (badge) badge.textContent = `${Math.min(done, 3)} of 3 sets`;
    document.querySelectorAll('#practice-dots .practice-dot').forEach((dot, i) => {
      dot.classList.toggle('done', i < done);
    });
    if (btn) {
      const relax = typeof safetyGate === 'function' && safetyGate() === 'tension';
      btn.disabled = !relax && done >= 3;
      btn.textContent = relax ? 'Relaxation →' : done >= 3 ? 'All 3 done ✓' : 'Short set →';
    }
    const footLabel = document.getElementById('practice-foot-label');
    if (footLabel) footLabel.textContent = typeof safetyGate === 'function' && safetyGate() === 'tension' ? 'Relaxation is safe every day' : 'Keep going for at least 3 months';
    if (text && typeof safetyGate === 'function' && safetyGate() === 'tension') {
      text.textContent = 'Squeezing exercises are paused until a pelvic floor physical therapist says they are right for you. Meanwhile, the 2-minute relaxation routine is safe to do every day.';
      return;
    }
    if (text && done >= 3) {
      text.textContent = 'You did all 3 sets today. Rest now and come back tomorrow. Steady practice for at least 3 months is what builds strength.';
    } else if (text) {
      text.textContent = 'Health guidelines recommend at least 8 squeezes, 3 times a day. Your guided session is set 1. Add 2 short sets (about 2 minutes each) later in the day.';
    }
  }

  // Short set: 8 slow holds using today's slow-hold timing (never harder than the guided session)
  function openMiniSetModal() {
    if (safetyGate() === 'tension') { openRelaxModal(); return; }
    if (safetyGate()) { withSafetyGate(openMiniSetModal); return; }
    clearSessionTimer();
    const week1 = PROGRAM.weeks[0];
    // If a guided session was done today, use that day's timing; otherwise the current day
    const practicedDay = state.lastCompletedDate === dayKey() && state.lastSessionDay ? state.lastSessionDay : state.currentDay;
    const dayData = week1.days.find((d) => d.day === practicedDay) || week1.days[0];
    const firstHold = dayData.blocks.find((b) => !b.isRest && !b.isBreathing && b.holdSeconds >= 3) || { holdSeconds: 3, relaxSeconds: 6, position: 'Sitting or Lying Down' };

    const miniDay = {
      day: dayData.day,
      title: 'Short Set',
      habit: dayData.habit,
      isMiniSet: true,
      blocks: [
        {
          name: 'Short Set: 8 Slow Holds',
          position: firstHold.position,
          cue: `Squeeze and lift for ${firstHold.holdSeconds} seconds, then relax completely for ${firstHold.relaxSeconds} seconds. Breathe normally.`,
          reps: 8,
          holdSeconds: firstHold.holdSeconds,
          relaxSeconds: firstHold.relaxSeconds
        }
      ]
    };

    const existing = document.getElementById('modal-session');
    if (existing) existing.remove();
    const modal = document.createElement('div');
    modal.id = 'modal-session';
    modal.className = 'modal-backdrop';
    modal.setAttribute('role', 'dialog');
    modal.setAttribute('aria-modal', 'true');
    modal.innerHTML = '<div class="modal-sheet"></div>';
    document.body.appendChild(modal);
    startInteractivePlayer(modal, miniDay, null);
  }

  function markDayComplete(dayNumber) {
    state.lastSessionDay = dayNumber;
    if (!state.completedDays.includes(dayNumber)) {
      state.completedDays.push(dayNumber);
      state.completedDays.sort((a, b) => a - b);
    }

    // Streak: consecutive calendar days with at least one completed session
    const today = dayKey();
    const yesterday = dayKey(new Date(Date.now() - 24 * 60 * 60 * 1000));
    if (state.lastCompletedDate !== today) {
      state.streak = state.lastCompletedDate === yesterday ? state.streak + 1 : 1;
      state.lastCompletedDate = today;
    }
    state.bestStreak = Math.max(state.bestStreak || 0, state.streak);

    // Move "today" to the next day that is not done yet
    const days = PROGRAM.weeks[0].days.map((d) => d.day);
    const nextOpen = days.find((d) => d > dayNumber && !state.completedDays.includes(d));
    if (nextOpen) state.currentDay = nextOpen;

    saveState();
    renderStats();
    renderHomeDayContent();
    renderPlanList();
    renderDiaryAndProgress();
  }

  // =====================================================
  // PHASE 5: 60-SECOND URGE SOS
  // Stop & stay still → 5 quick squeezes → slow belly breathing (4 in / 6 out)
  // → distraction, then walk calmly (see CONTENT_SOURCES.md).
  // =====================================================
  let sosTimer = null;

  function clearSosTimer() {
    if (sosTimer) {
      clearInterval(sosTimer);
      sosTimer = null;
    }
  }

  const SOS_STAGES = [
    {
      title: 'Stop and stay still',
      text: "Don't rush to the bathroom. Stand still, or sit down if a chair is close. Relax your shoulders."
    },
    {
      title: '5 quick squeezes',
      text: 'Squeeze and lift quickly for 1 second, then let go for 2 seconds. This helps calm your bladder muscle.'
    },
    {
      title: 'Slow belly breathing',
      text: 'Breathe in gently for 4 seconds, and out slowly for 6 seconds. Let the wave pass.'
    },
    {
      title: 'Distract your mind',
      text: 'Count backward from 100 by 7s: 100, 93, 86, 79… When the urge fades, walk calmly to the bathroom if you still need to.'
    }
  ];

  // What the circle shows for each second (0–59) of the routine
  function sosCueForSecond(t) {
    const stage = Math.floor(t / 15);
    const s = t % 15;
    if (stage === 1) {
      const squeeze = s % 3 === 0;
      return { stage, label: squeeze ? 'Squeeze' : 'Relax', cls: squeeze ? 'phase-squeeze' : 'phase-relax', tone: squeeze ? 620 : null };
    }
    if (stage === 2) {
      const inhale = s % 10 < 4;
      const startOfPhase = s % 10 === 0 || s % 10 === 4;
      return { stage, label: inhale ? 'Breathe In' : 'Breathe Out', cls: inhale ? 'phase-squeeze' : 'phase-relax', tone: startOfPhase ? (inhale ? 520 : 420) : null };
    }
    return { stage, label: stage === 0 ? 'Stay Still' : 'Count Back', cls: 'phase-rest', tone: s === 0 ? 480 : null };
  }

  function openUrgeSosModal() {
    clearSosTimer();
    const existing = document.getElementById('modal-sos');
    if (existing) existing.remove();

    const modal = document.createElement('div');
    modal.id = 'modal-sos';
    modal.className = 'modal-backdrop';
    modal.setAttribute('role', 'dialog');
    modal.setAttribute('aria-modal', 'true');
    modal.setAttribute('aria-labelledby', 'sos-title');
    document.body.appendChild(modal);

    function close() {
      clearSosTimer();
      modal.remove();
    }

    function runRoutine() {
      clearSosTimer();
      let t = 0;
      modal.innerHTML = `
        <div class="modal-sheet">
          <div class="status-row">
            <span class="card-pill-tag" style="margin-bottom:0;">60-Second Urge SOS</span>
            <button type="button" class="secondary-btn" id="sos-close">Close</button>
          </div>
          <h2 class="two-tone-heading" id="sos-title" style="margin-top:12px;">Breathe. The wave<br /><span>will pass.</span></h2>
          <div class="sos-step-card">
            <strong id="sos-step-title"></strong>
            <span id="sos-step-text"></span>
          </div>
          <div class="session-player-box">
            <div class="circle-stage">
              <div class="breathing-circle phase-rest" id="sos-circle">
                <span class="circle-phase-label" id="sos-phase"></span>
                <span class="circle-timer-num" id="sos-timer" aria-hidden="true">60</span>
              </div>
            </div>
            <div class="session-rep-counter" id="sos-stage-count"></div>
            <div class="session-progress-bar" aria-hidden="true"><div class="session-progress-fill" id="sos-progress"></div></div>
            <p class="sr-only" id="sos-live" aria-live="polite"></p>
          </div>
        </div>
      `;
      modal.querySelector('#sos-close').addEventListener('click', close);

      let lastStage = -1;
      function render() {
        const cue = sosCueForSecond(t);
        if (cue.stage !== lastStage) {
          lastStage = cue.stage;
          modal.querySelector('#sos-step-title').textContent = SOS_STAGES[cue.stage].title;
          modal.querySelector('#sos-step-text').textContent = SOS_STAGES[cue.stage].text;
          modal.querySelector('#sos-stage-count').textContent = `Step ${cue.stage + 1} of 4`;
          modal.querySelector('#sos-live').textContent = SOS_STAGES[cue.stage].title;
          triggerVibration(80);
        }
        const circle = modal.querySelector('#sos-circle');
        circle.classList.remove('phase-squeeze', 'phase-relax', 'phase-rest');
        circle.classList.add(cue.cls);
        modal.querySelector('#sos-phase').textContent = cue.label;
        modal.querySelector('#sos-timer').textContent = 60 - t;
        modal.querySelector('#sos-progress').style.width = `${(t / 60) * 100}%`;
        if (cue.tone) playCueTone(cue.tone, 160);
      }

      render();
      sosTimer = setInterval(() => {
        t += 1;
        if (t >= 60) {
          finish();
        } else {
          render();
        }
      }, 1000);
    }

    function finish() {
      clearSosTimer();
      playCueTone(700, 350);
      modal.innerHTML = `
        <div class="modal-sheet">
          <div class="card-pill-tag">Well done</div>
          <h2 class="two-tone-heading">You stayed<br /><span>in control.</span></h2>
          <p class="card-body-text" style="margin-bottom:16px;">
            If you still need the bathroom, walk there calmly now. If the urge comes back, you can repeat the routine.
          </p>
          <div class="session-controls-row">
            <button type="button" class="secondary-btn" id="sos-repeat">Repeat</button>
            <button type="button" class="primary-btn" id="sos-log">Log this urge</button>
          </div>
          <button type="button" class="danger-outline-btn full-width" id="sos-done">Close</button>
        </div>
      `;
      modal.querySelector('#sos-repeat').addEventListener('click', runRoutine);
      modal.querySelector('#sos-done').addEventListener('click', close);
      modal.querySelector('#sos-log').addEventListener('click', () => {
        addDiaryEntry('urge', 'Calmed with Urge SOS');
        close();
      });
    }

    runRoutine();
  }

  // =====================================================
  // PHASE 5: 2-TAP BLADDER DIARY
  // =====================================================
  const DIARY_CATEGORIES = {
    leak: {
      label: 'Leak',
      question: 'How big was the leak?',
      options: ['Small (a few drops)', 'Medium (damp)', 'Large (soaked)']
    },
    urge: {
      label: 'Strong Urge',
      question: 'How did it go?',
      options: ['Strong, but I waited', 'Very strong, I had to rush']
    },
    trip: {
      label: 'Bathroom Trip',
      question: 'What kind of trip?',
      options: ['I really needed to go', 'Just in case', 'At night']
    },
    drink: {
      label: 'Drink',
      question: 'What did you drink?',
      options: ['Water', 'Coffee or Tea', 'Soda or Juice', 'Alcohol', 'Other']
    }
  };

  function escapeHtml(text) {
    return String(text).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  }

  function addDiaryEntry(category, detail) {
    const now = new Date();
    const entry = {
      id: `${now.getTime()}-${Math.random().toString(36).slice(2, 7)}`,
      day: state.currentDay,
      category,
      detail,
      timeLabel: now.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }),
      timestamp: now.getTime()
    };
    state.diary.push(entry);
    saveState();

    const feedback = document.getElementById('diary-feedback');
    if (feedback) {
      feedback.textContent = `Saved: ${DIARY_CATEGORIES[category].label} · ${detail} at ${entry.timeLabel} (Day ${entry.day})`;
      feedback.hidden = false;
    }
    const selectEl = document.getElementById('diary-day-select');
    if (selectEl) selectEl.value = String(entry.day);
    renderDiaryAndProgress();
    renderHomeDayContent();
    triggerVibration(40);
    announceMilestones();
  }

  function showDiaryOptions(category) {
    const box = document.getElementById('diary-suboptions');
    if (!box) return;
    document.querySelectorAll('.diary-cat-btn').forEach((b) => {
      b.classList.toggle('active', b.getAttribute('data-diary-cat') === category);
    });
    const cat = DIARY_CATEGORIES[category];
    box.innerHTML = `
      <span class="diary-suboptions-title">${cat.question}</span>
      <div class="diary-sub-grid">
        ${cat.options.map((o) => `<button type="button" class="diary-sub-btn" data-diary-save="${category}" data-diary-detail="${escapeHtml(o)}">${escapeHtml(o)}</button>`).join('')}
      </div>
    `;
    box.hidden = false;
    const feedback = document.getElementById('diary-feedback');
    if (feedback) feedback.hidden = true;
    try { box.scrollIntoView({ behavior: 'smooth', block: 'center' }); } catch (_) {}
  }

  function hideDiaryOptions() {
    const box = document.getElementById('diary-suboptions');
    if (box) box.hidden = true;
    document.querySelectorAll('.diary-cat-btn').forEach((b) => b.classList.remove('active'));
  }

  function countFor(day, category) {
    return state.diary.filter((e) => e.day === day && e.category === category).length;
  }

  function renderDiaryEntries() {
    const listEl = document.getElementById('diary-day-entries');
    const selectEl = document.getElementById('diary-day-select');
    if (!listEl || !selectEl) return;
    const day = parseInt(selectEl.value, 10) || state.currentDay;
    const entries = state.diary
      .filter((e) => e.day === day)
      .sort((a, b) => a.timestamp - b.timestamp);

    if (!entries.length) {
      listEl.innerHTML = `<p class="muted-small">No entries for Day ${day} yet.</p>`;
      return;
    }

    listEl.innerHTML = entries
      .map((e) => `
        <div class="diary-entry-row">
          <span><strong>${escapeHtml(e.timeLabel)}</strong> · ${DIARY_CATEGORIES[e.category] ? DIARY_CATEGORIES[e.category].label : ''} · ${escapeHtml(e.detail)}</span>
          <button type="button" class="diary-entry-delete" data-diary-delete="${escapeHtml(e.id)}" aria-label="Delete this entry">Delete</button>
        </div>
      `)
      .join('');
  }

  function renderWeeklyChart() {
    const chartEl = document.getElementById('weekly-chart');
    if (!chartEl) return;
    const cats = ['leak', 'urge', 'trip', 'drink'];
    let max = 1;
    for (let d = 1; d <= 7; d++) {
      cats.forEach((c) => { max = Math.max(max, countFor(d, c)); });
    }
    let html = '';
    for (let d = 1; d <= 7; d++) {
      const counts = cats.map((c) => countFor(d, c));
      const label = `Day ${d}: ${counts[0]} leaks, ${counts[1]} strong urges, ${counts[2]} bathroom trips, ${counts[3]} drinks`;
      html += `
        <div class="chart-day-col" role="img" aria-label="${label}">
          <div class="chart-bars-wrap">
            ${cats.map((c, i) => `<span class="chart-bar ${c}-bar" style="height:${Math.round((counts[i] / max) * 100)}%"></span>`).join('')}
          </div>
          <span class="chart-day-label">D${d}</span>
        </div>
      `;
    }
    chartEl.innerHTML = html;
  }

  function renderComparison() {
    const box = document.getElementById('week1-comparison-box');
    if (!box) return;
    const early = [1, 2];
    const late = [6, 7];
    const hasEarly = state.diary.some((e) => early.includes(e.day));
    const hasLate = state.diary.some((e) => late.includes(e.day));

    if (!hasEarly || !hasLate) {
      box.innerHTML = `<p class="card-body-text">Log in your diary on Days 1–2 and again on Days 6–7 to see your comparison here.</p>`;
      return;
    }

    const avg = (days, cat) => (days.reduce((sum, d) => sum + countFor(d, cat), 0) / days.length).toFixed(1);
    const rows = [
      ['leak', 'Leaks per day'],
      ['urge', 'Strong urges per day'],
      ['trip', 'Bathroom trips per day']
    ];
    box.innerHTML = `
      <table class="comparison-table">
        <thead><tr><th scope="col">Average</th><th scope="col">Days 1–2</th><th scope="col">Days 6–7</th></tr></thead>
        <tbody>
          ${rows.map(([cat, label]) => `<tr><td>${label}</td><td>${avg(early, cat)}</td><td>${avg(late, cat)}</td></tr>`).join('')}
        </tbody>
      </table>
      <p class="muted-small">Small changes are normal in Week 1. Muscle strength builds over several weeks of steady practice.</p>
    `;
  }

  function renderDiaryAndProgress() {
    renderStats();
    renderMilestones();
    renderPracticeHistory();
    renderDiaryEntries();
    renderWeeklyChart();
    renderComparison();
    const diaryActiveDayLabel = document.getElementById('diary-active-day-label');
    if (diaryActiveDayLabel) diaryActiveDayLabel.textContent = `Logging for Day ${state.currentDay}`;
  }

  // =====================================================
  // PHASE 5: DISCREET REMINDERS & SETTINGS
  // Reminders only work while the app is open (or open in the background
  // from the home screen). No server, no background push notifications.
  // =====================================================
  const REMINDER_TEXTS = ['Your 5-minute routine is ready', 'Your 2-minute set is ready', 'Your 2-minute set is ready'];

  function syncSettingsControls() {
    const sound = document.getElementById('setting-sound-toggle');
    const vibe = document.getElementById('setting-vibration-toggle');
    const remOn = document.getElementById('setting-reminder-enabled');
    if (sound) sound.checked = !!state.settings.sound;
    if (vibe) vibe.checked = !!state.settings.vibration;
    if (remOn) remOn.checked = !!state.settings.reminderEnabled;
    const voiceT = document.getElementById('setting-voice-toggle');
    if (voiceT) voiceT.checked = !!state.settings.voice;
    const discreetT = document.getElementById('setting-discreet-toggle');
    if (discreetT) discreetT.checked = !!state.settings.discreet;
    const dayStartSel = document.getElementById('setting-day-start');
    if (dayStartSel) dayStartSel.value = String(Number(state.settings.dayStart) || 0);
    if (typeof renderRemindersSummary === 'function') renderRemindersSummary();
    document.querySelectorAll('[data-reminder-slot]').forEach((input) => {
      const i = parseInt(input.getAttribute('data-reminder-slot'), 10);
      input.value = state.settings.reminderTimes[i];
    });
  }

  function checkReminder() {
    if (!state.unlocked || !state.disclaimerAccepted || !state.settings.reminderEnabled) return;
    const now = new Date();
    const today = dayKey(now);
    const shown = state.settings.remindersShown;
    if (shown.date !== today) {
      shown.date = today;
      shown.slots = [];
    }
    const done = setsDoneToday();

    // Show the latest due reminder whose set is not done yet (once per slot per day)
    let slotToShow = -1;
    state.settings.reminderTimes.forEach((time, i) => {
      const [h, m] = (time || '09:00').split(':').map(Number);
      const due = new Date(now);
      due.setHours(h, m, 0, 0);
      if (now >= due && done <= i && !shown.slots.includes(i)) slotToShow = i;
    });
    if (slotToShow < 0) return;

    // Mark this and earlier slots as shown so we don't stack old reminders
    for (let i = 0; i <= slotToShow; i++) if (!shown.slots.includes(i)) shown.slots.push(i);
    saveState();

    const text = REMINDER_TEXTS[done === 0 ? 0 : 1];
    const banner = document.getElementById('reminder-banner');
    const bannerText = document.getElementById('reminder-banner-text');
    const bannerTitle = document.getElementById('reminder-banner-title');
    if (bannerTitle) bannerTitle.textContent = state.settings.discreet ? 'Daily reminder' : 'DryDay reminder';
    if (bannerText) bannerText.textContent = state.settings.discreet ? 'Time for your routine' : text;
    if (banner) banner.hidden = false;
    try {
      if ('Notification' in window && Notification.permission === 'granted' && document.hidden) {
        new Notification(state.settings.discreet ? 'Daily reminder' : 'DryDay', { body: state.settings.discreet ? 'Time for your routine' : text });
      }
    } catch (e) {}
  }

  // =====================================================
  // INSTALL AS AN APP (PWA) + HOME SCREEN TUTORIALS
  // Android/Chrome: our own "Install" button (beforeinstallprompt), or step-by-step help.
  // iPhone/iPad: Apple has no install button, so we explain Share → Add to Home Screen,
  // adapted to Safari, Chrome/Firefox/Edge, or the in-app browser of Instagram/Facebook.
  // =====================================================
  const PUSH_PUBLIC_KEY = 'BHZZzjACARtjkl6pI-F3BDdLWes_zGu_8CJFV0DLNtOVswxtVvH3QucPfcK88A5veCtpUYezZEJYv4dABAi1Ba0';
  const INSTALL_DISMISS_KEY = 'dryday:install-dismissed';
  const PUSH_DISMISS_KEY = 'dryday:push-dismissed';
  const PUSH_ON_KEY = 'dryday:push-on';
  const PUSH_SENT_KEY = 'dryday:push-sent';
  let deferredInstall = null;

  const ls = {
    get: (k) => { try { return window.localStorage.getItem(k); } catch (_) { return null; } },
    set: (k, v) => { try { window.localStorage.setItem(k, v); } catch (_) {} },
    del: (k) => { try { window.localStorage.removeItem(k); } catch (_) {} }
  };

  const isStandalone = () =>
    (typeof window.matchMedia === 'function' && window.matchMedia('(display-mode: standalone)').matches) ||
    window.navigator.standalone === true;

  const isIOS = () => {
    const ua = window.navigator.userAgent || '';
    return /iPhone|iPad|iPod/.test(ua) || (/Macintosh/.test(ua) && window.navigator.maxTouchPoints > 1);
  };

  const isAndroid = () => /Android/i.test(window.navigator.userAgent || '');

  /** 'safari' | 'browser' (Chrome, Firefox, Edge on iOS) | 'inapp' (Instagram, Facebook, TikTok…) */
  function iosBrowser() {
    const ua = window.navigator.userAgent || '';
    if (/Instagram|FBAN|FBAV|FB_IAB|FBIOS|Messenger|TikTok|musical_ly|BytedanceWebview|Snapchat|Twitter|LinkedInApp|Pinterest|Line\/|GSA\//.test(ua)) return 'inapp';
    if (/CriOS|FxiOS|EdgiOS|OPiOS|DuckDuckGo/.test(ua)) return 'browser';
    return 'safari';
  }

  const isInAppBrowser = () => /Instagram|FBAN|FBAV|FB_IAB|FBIOS|Messenger|TikTok|musical_ly|BytedanceWebview|Snapchat/.test(window.navigator.userAgent || '');

  function canUseServiceWorker() {
    if (!('serviceWorker' in window.navigator)) return false;
    const { protocol, hostname } = window.location;
    const secure = protocol === 'https:' || hostname === 'localhost' || hostname === '127.0.0.1';
    let framed = true;
    try { framed = window.self !== window.top; } catch (_) { framed = true; }
    return secure && !framed;
  }

  function showToast(text) {
    const old = document.querySelector('.app-toast');
    if (old) old.remove();
    const t = document.createElement('div');
    t.className = 'app-toast';
    t.setAttribute('role', 'status');
    t.textContent = text;
    document.body.appendChild(t);
    setTimeout(() => t.remove(), 4200);
  }

  function setupInstall() {
    if (canUseServiceWorker()) {
      const register = () => window.navigator.serviceWorker.register('sw.js').catch(() => {});
      if (document.readyState === 'complete') register();
      else window.addEventListener('load', register);
    }
    window.addEventListener('beforeinstallprompt', (e) => {
      e.preventDefault(); // we show our own button instead of the automatic banner
      deferredInstall = e;
      renderSetupCards();
    });
    window.addEventListener('appinstalled', () => {
      deferredInstall = null;
      showToast('DryDay was added to your phone');
      renderSetupCards();
    });
  }

  const ICONS = {
    share: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3v13"/><path d="m7 8 5-5 5 5"/><rect x="4" y="11" width="16" height="10" rx="2"/></svg>',
    add: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="4"/><path d="M12 8v8M8 12h8"/></svg>',
    dots: '<svg viewBox="0 0 24 24" fill="currentColor"><circle cx="12" cy="5" r="2"/><circle cx="12" cy="12" r="2"/><circle cx="12" cy="19" r="2"/></svg>',
    more: '<svg viewBox="0 0 24 24" fill="currentColor"><circle cx="5" cy="12" r="2"/><circle cx="12" cy="12" r="2"/><circle cx="19" cy="12" r="2"/></svg>'
  };
  const ic = (name) => `<span class="howto-icon" aria-hidden="true">${ICONS[name]}</span>`;
  const step = (n, html) => `<li class="howto-step"><span class="howto-num" aria-hidden="true">${n}</span><p>${html}</p></li>`;

  function openInstallSheet(note) {
    const existing = document.getElementById('modal-install');
    if (existing) existing.remove();
    const appUrl = new URL('./', window.location.href).href;
    let body = '';

    if (isIOS()) {
      const browser = iosBrowser();
      body = `
        <span class="card-pill-tag">iPhone &amp; iPad</span>
        <h2 class="two-tone-heading">Add DryDay to your<br /><span>Home Screen</span></h2>
        ${note ? `<div class="howto-note"><p>${note}</p></div>` : ''}
        <p class="card-body-text">You'll have DryDay on your Home Screen with its own icon. It opens full screen, just like an app.</p>
        ${browser === 'inapp' ? `
          <div class="howto-note">
            <p><strong>Open it in Safari first.</strong> You're inside another app (like Instagram or Facebook), and it can't be added from here. Copy the link, open Safari and paste it into the address bar.</p>
            <button type="button" class="secondary-btn" id="install-copy">Copy link</button>
          </div>` : ''}
        <ol class="howto">
          ${browser === 'browser'
            ? step(1, `Tap ${ic('share')} <strong>Share</strong> at the top right, next to the page address.`)
            : step(1, `Tap ${ic('share')} <strong>Share</strong> in the Safari toolbar at the bottom. If you don't see it, first tap ${ic('more')} (More) or scroll up a little.`)}
          ${step(2, `Scroll down and tap ${ic('add')} <strong>"Add to Home Screen"</strong>.`)}
          ${step(3, `Tap <strong>"Add"</strong>. If you see "Open as Web App", leave it turned on.`)}
          ${step(4, `Open DryDay from its new icon on your Home Screen. Then turn on reminders in <strong>More</strong>.`)}
        </ol>`;
    } else if (isAndroid()) {
      body = `
        <span class="card-pill-tag">Android</span>
        <h2 class="two-tone-heading">Add DryDay to your<br /><span>Home Screen</span></h2>
        ${note ? `<div class="howto-note"><p>${note}</p></div>` : ''}
        <p class="card-body-text">You'll have DryDay on your Home Screen with its own icon. It opens full screen, just like an app.</p>
        ${isInAppBrowser() ? `
          <div class="howto-note">
            <p><strong>Open it in Chrome first.</strong> You're inside another app (like Instagram or Facebook). Tap ${ic('dots')} and choose <strong>"Open in Chrome"</strong> (or copy the link and paste it into Chrome).</p>
            <button type="button" class="secondary-btn" id="install-copy">Copy link</button>
          </div>` : ''}
        <ol class="howto">
          ${step(1, `In Chrome, tap ${ic('dots')} <strong>Menu</strong> at the top right.`)}
          ${step(2, `Tap <strong>"Install app"</strong> or <strong>"Add to Home screen"</strong>.`)}
          ${step(3, `Tap <strong>"Install"</strong> (or "Add") to confirm.`)}
          ${step(4, `Open DryDay from its new icon. Then turn on reminders in <strong>More</strong>.`)}
        </ol>`;
    } else {
      body = `
        <span class="card-pill-tag">On your phone</span>
        <h2 class="two-tone-heading">Use DryDay on<br /><span>your phone</span></h2>
        <p class="card-body-text">DryDay is made for your phone. Open this link on your phone, then follow the steps to add it to your Home Screen:</p>
        <div class="howto-note"><p><strong>${appUrl}</strong></p><button type="button" class="secondary-btn" id="install-copy">Copy link</button></div>`;
    }

    const modal = document.createElement('div');
    modal.id = 'modal-install';
    modal.className = 'modal-backdrop';
    modal.setAttribute('role', 'dialog');
    modal.setAttribute('aria-modal', 'true');
    modal.innerHTML = `<div class="modal-sheet">${body}<button type="button" class="primary-btn full-width" id="install-done">Got it</button></div>`;
    document.body.appendChild(modal);
    modal.querySelector('#install-done').addEventListener('click', () => modal.remove());
    const copy = modal.querySelector('#install-copy');
    if (copy) {
      copy.addEventListener('click', async () => {
        try {
          await navigator.clipboard.writeText(appUrl);
          showToast('Link copied');
        } catch (_) {
          showToast(`Copy this link: ${appUrl}`);
        }
      });
    }
  }

  async function startInstall() {
    if (deferredInstall) {
      const e = deferredInstall;
      deferredInstall = null;
      e.prompt();
      const choice = await e.userChoice.catch(() => null);
      if (!choice || choice.outcome !== 'accepted') openInstallSheet();
      renderSetupCards();
      return;
    }
    openInstallSheet();
  }

  // =====================================================
  // DAILY REMINDERS (WEB PUSH)
  // The phone subscribes; the server (/api/push + hourly cron) sends up to 3 reminders a day
  // at the chosen local times, skipping sets already done. Works with the app closed.
  // Android: Chrome. iPhone/iPad: only when added to the Home Screen (iOS 16.4+).
  // =====================================================
  function pushSupport() {
    // iPhone/iPad: Apple only allows web notifications for apps opened from the Home Screen
    if (isIOS() && !isStandalone()) return 'ios-install';
    const hasApi = 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;
    if (!hasApi) return isIOS() && !isStandalone() ? 'ios-install' : 'unsupported';
    if (!canUseServiceWorker()) return 'unsupported';
    if (Notification.permission === 'denied') return 'denied';
    return 'ok';
  }

  const pushOn = () => ls.get(PUSH_ON_KEY) === '1' && 'Notification' in window && Notification.permission === 'granted';

  function keyBytes(b64) {
    const s = b64.replace(/-/g, '+').replace(/_/g, '/');
    const raw = atob(s + '='.repeat((4 - (s.length % 4)) % 4));
    return Uint8Array.from(raw, (c) => c.charCodeAt(0));
  }

  function pushPayload(sub) {
    return {
      subscription: sub.toJSON(),
      tz: Intl.DateTimeFormat().resolvedOptions().timeZone,
      times: state.settings.reminderTimes,
      progress: { date: dayKey(), sets: setsDoneToday(), last: lastPracticeKey() },
      discreet: !!state.settings.discreet,
      dayStart: Number(state.settings.dayStart) || 0
    };
  }

  async function postPush(method, body) {
    const res = await fetch('api/push', { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    if (!res.ok) throw new Error(`push ${res.status}`);
  }

  /** Must run from a tap (the browser asks for permission). */
  async function enablePush() {
    const support = pushSupport();
    if (support !== 'ok') return support;
    try {
      const permission = await Notification.requestPermission();
      if (permission !== 'granted') return 'denied';
      const reg = await navigator.serviceWorker.ready;
      const sub = (await reg.pushManager.getSubscription())
        || await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: keyBytes(PUSH_PUBLIC_KEY) });
      const payload = pushPayload(sub);
      await postPush('POST', payload);
      ls.set(PUSH_ON_KEY, '1');
      ls.set(PUSH_SENT_KEY, JSON.stringify({ times: payload.times, progress: payload.progress, discreet: payload.discreet, dayStart: payload.dayStart }));
      reg.showNotification(state.settings.discreet ? 'Reminders on' : 'Reminders turned on', {
        body: 'We\u2019ll remind you at your 3 times. You can change them in More.',
        icon: 'icons/icon-192.png',
        tag: 'dryday-welcome'
      }).catch(() => {});
      return 'enabled';
    } catch (err) {
      console.warn('[reminders]', err);
      return 'error';
    }
  }

  async function disablePush() {
    ls.del(PUSH_ON_KEY);
    ls.del(PUSH_SENT_KEY);
    try {
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.getSubscription();
      if (sub) {
        await postPush('DELETE', { endpoint: sub.endpoint }).catch(() => {});
        await sub.unsubscribe();
      }
    } catch (_) {}
  }

  /** Sends new times / today's sets to the server (only if reminders are on and something changed). */
  async function syncPush() {
    if (!pushOn()) return;
    try {
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.getSubscription();
      if (!sub) { ls.del(PUSH_ON_KEY); return; }
      const payload = pushPayload(sub);
      const json = JSON.stringify({ times: payload.times, progress: payload.progress, discreet: payload.discreet, dayStart: payload.dayStart });
      if (ls.get(PUSH_SENT_KEY) === json) return;
      await postPush('POST', payload);
      ls.set(PUSH_SENT_KEY, json);
    } catch (_) { /* offline: retried next time */ }
  }

  async function turnOnReminders() {
    const result = await enablePush();
    if (result === 'enabled') {
      state.settings.reminderEnabled = true;
      saveState();
      showToast('Reminders turned on');
    } else if (result === 'ios-install') {
      openInstallSheet('On iPhone, Apple only allows notifications from apps on your Home Screen. Add DryDay, open it from its icon, and turn on reminders there.');
    } else if (result === 'denied') {
      showToast('Notifications are blocked. Turn them on in your phone or browser settings.');
    } else if (result === 'unsupported') {
      showToast('This browser can’t show notifications. Open DryDay in Chrome (Android) or add it to your Home Screen (iPhone).');
    } else {
      showToast('Couldn’t turn reminders on. Check your connection and try again.');
    }
    syncSettingsControls();
    renderSetupCards();
    return result;
  }

  function renderSetupCards() {
    const installCard = document.getElementById('install-card');
    const pushCard = document.getElementById('push-card');
    const installBtn = document.getElementById('install-card-btn');
    const installHint = document.getElementById('install-card-hint');
    const settingText = document.getElementById('install-setting-text');
    const settingBtn = document.getElementById('install-setting-btn');
    const standalone = isStandalone();

    const showInstall = !standalone && ls.get(INSTALL_DISMISS_KEY) !== '1' && (isIOS() || isAndroid() || !!deferredInstall);
    if (installCard) installCard.hidden = !showInstall;
    if (installBtn) installBtn.textContent = deferredInstall ? 'Install app →' : 'Show me how →';
    if (installHint) installHint.textContent = isIOS() ? 'iPhone & iPad · 20 seconds' : 'Takes 20 seconds';

    if (settingText) settingText.textContent = standalone ? 'DryDay is already on your Home Screen.' : 'Get DryDay on your phone with its own icon, like an app.';
    if (settingBtn) {
      settingBtn.hidden = standalone;
      settingBtn.textContent = deferredInstall ? 'Install' : 'How to';
    }

    const support = pushSupport();
    const showPush = !showInstall && !pushOn() && support === 'ok' && ls.get(PUSH_DISMISS_KEY) !== '1';
    if (pushCard) pushCard.hidden = !showPush;

    const status = document.getElementById('reminder-status');
    if (status) {
      if (pushOn()) status.textContent = `On: phone notifications at ${state.settings.reminderTimes.map(formatTime).join(', ')}.`;
      else if (state.settings.reminderEnabled && support === 'ok') status.textContent = `On inside the app at ${state.settings.reminderTimes.map(formatTime).join(', ')}. Phone notifications aren\u2019t on yet.`;
      else if (support === 'ios-install') status.textContent = 'On iPhone, add DryDay to your Home Screen first to get notifications.';
      else if (support === 'denied') status.textContent = isIOS()
        ? 'Notifications are blocked. To allow them: iPhone Settings → Notifications → DryDay → Allow Notifications. Until then, reminders only show inside the app.'
        : 'Notifications are blocked. To allow them: tap the icon left of the web address (or Chrome menu ⋮ → Site settings) → Notifications → Allow. Until then, reminders only show inside the app.';
      else if (support === 'unsupported') status.textContent = 'This browser can’t show notifications. Reminders will only show inside the app.';
      else status.textContent = '';
    }
  }

  function bindEvents() {
    ['btn-welcome-start', 'btn-welcome-heart'].forEach((id) => {
      const btn = document.getElementById(id);
      if (!btn) return;
      btn.addEventListener('click', () => {
        welcomeDone = true;
        renderEntryFlow();
        window.scrollTo(0, 0);
      });
    });

    if (accessForm) {
      accessForm.addEventListener('submit', (e) => {
        e.preventDefault();
        const entered = (accessInput.value || '').trim().toUpperCase();
        if (entered === ACCESS_CODE_VALID) {
          accessError.hidden = true;
          state.unlocked = true;
          saveState();
          renderEntryFlow();
        } else {
          accessError.hidden = false;
          accessInput.focus();
        }
      });
    }

    if (btnAcceptDisclaimer) {
      btnAcceptDisclaimer.addEventListener('click', () => {
        state.disclaimerAccepted = true;
        saveState();
        renderEntryFlow();
      });
    }

    navTabs.forEach((btn) => {
      btn.addEventListener('click', () => {
        const target = btn.getAttribute('data-tab');
        if (target) switchTab(target);
      });
    });

    document.querySelectorAll('#home-day-pills .day-pill').forEach((pill) => {
      pill.addEventListener('click', () => {
        state.currentDay = parseInt(pill.getAttribute('data-day'), 10) || 1;
        saveState();
        renderHomeDayContent();
        renderDiaryAndProgress();
      });
    });

    if (btnStartToday) {
      btnStartToday.addEventListener('click', () => openDaySessionModal(state.currentDay));
    }

    if (btnUrgeSosTop) {
      btnUrgeSosTop.addEventListener('click', openUrgeSosModal);
    }

    // Delegated clicks: quiz, Plan rows, diary taps, diary delete, go-to-diary
    document.addEventListener('click', (e) => {
      if (e.target.closest('[data-action="open-quiz"]')) {
        openQuizModal();
        return;
      }
      if (e.target.closest('[data-action="go-diary"]')) {
        switchTab('progress');
        return;
      }
      if (e.target.closest('[data-action="open-about"]')) {
        openAbout();
        return;
      }
      if (e.target.closest('[data-action="go-reminders"]')) {
        switchTab('more');
        setTimeout(() => {
          const card = document.getElementById('reminders-card');
          if (card) card.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }, 50);
        return;
      }
      if (e.target.closest('[data-action="relax"]')) {
        openRelaxModal();
        return;
      }
      if (e.target.closest('[data-action="clear-safety"]')) {
        withSafetyGate(() => { renderSafetyCard(); showToast('Thanks. The exercises are unlocked.'); }, true);
        return;
      }
      if (e.target.closest('[data-action="technique-check"]')) {
        openTechniqueCheck();
        return;
      }
      if (e.target.closest('[data-action="open-report"]')) {
        openReport();
        return;
      }
      if (e.target.closest('[data-action="dismiss-comeback"]')) {
        state.comebackDismissed = dayKey();
        saveState();
        renderComeback();
        return;
      }
      if (e.target.closest('[data-action="install"]')) {
        startInstall();
        return;
      }
      if (e.target.closest('[data-action="dismiss-install"]')) {
        ls.set(INSTALL_DISMISS_KEY, '1');
        renderSetupCards();
        return;
      }
      if (e.target.closest('[data-action="enable-push"]')) {
        turnOnReminders();
        return;
      }
      if (e.target.closest('[data-action="dismiss-push"]')) {
        ls.set(PUSH_DISMISS_KEY, '1');
        renderSetupCards();
        return;
      }
      const dayRow = e.target.closest('[data-open-day]');
      if (dayRow) {
        const day = parseInt(dayRow.getAttribute('data-open-day'), 10) || 1;
        state.currentDay = day;
        saveState();
        renderHomeDayContent();
        openDaySessionModal(day);
        return;
      }
      const catBtn = e.target.closest('[data-diary-cat]');
      if (catBtn) {
        showDiaryOptions(catBtn.getAttribute('data-diary-cat'));
        return;
      }
      const saveBtn = e.target.closest('[data-diary-save]');
      if (saveBtn) {
        addDiaryEntry(saveBtn.getAttribute('data-diary-save'), saveBtn.getAttribute('data-diary-detail'));
        hideDiaryOptions();
        return;
      }
      const delBtn = e.target.closest('[data-diary-delete]');
      if (delBtn) {
        const id = delBtn.getAttribute('data-diary-delete');
        state.diary = state.diary.filter((entry) => entry.id !== id);
        saveState();
        const feedback = document.getElementById('diary-feedback');
        if (feedback) feedback.hidden = true;
        renderDiaryAndProgress();
        renderHomeDayContent();
      }
    });

    const daySelect = document.getElementById('diary-day-select');
    if (daySelect) daySelect.addEventListener('change', renderDiaryEntries);

    // Settings
    const sound = document.getElementById('setting-sound-toggle');
    if (sound) sound.addEventListener('change', () => { state.settings.sound = sound.checked; saveState(); });

    const vibe = document.getElementById('setting-vibration-toggle');
    if (vibe) vibe.addEventListener('change', () => { state.settings.vibration = vibe.checked; saveState(); triggerVibration(60); });
    const voiceT = document.getElementById('setting-voice-toggle');
    if (voiceT) voiceT.addEventListener('change', () => {
      state.settings.voice = voiceT.checked;
      saveState();
      if (voiceT.checked) { primeVoice(); speak('Voice coach on. Squeeze and lift. Relax completely.', true); } else stopSpeaking();
    });
    const discreetT = document.getElementById('setting-discreet-toggle');
    if (discreetT) discreetT.addEventListener('change', () => {
      state.settings.discreet = discreetT.checked;
      saveState();
      syncPush();
      showToast(discreetT.checked ? 'Saved: reminders will only say "Daily reminder"' : 'Saved: reminders will mention DryDay');
    });
    const dayStartSel = document.getElementById('setting-day-start');
    if (dayStartSel) dayStartSel.addEventListener('change', () => {
      state.settings.dayStart = Number(dayStartSel.value) || 0;
      saveState();
      renderPracticeCard();
      renderComeback();
      syncPush();
    });

    const remOn = document.getElementById('setting-reminder-enabled');
    if (remOn) {
      remOn.addEventListener('change', async () => {
        state.settings.reminderEnabled = remOn.checked;
        saveState();
        if (remOn.checked) {
          await turnOnReminders();
          // In-app reminders stay on even if phone notifications aren't possible here
          state.settings.reminderEnabled = true;
          saveState();
          syncSettingsControls();
        } else {
          await disablePush();
          showToast('Reminders turned off');
          renderSetupCards();
        }
      });
    }

    document.querySelectorAll('[data-reminder-slot]').forEach((input) => {
      input.addEventListener('change', () => {
        const i = parseInt(input.getAttribute('data-reminder-slot'), 10);
        state.settings.reminderTimes[i] = input.value || ['09:00', '14:00', '19:00'][i];
        state.settings.remindersShown.slots = state.settings.remindersShown.slots.filter((s) => s !== i);
        saveState();
        syncPush();
        renderRemindersSummary();
        showToast(`Saved: reminder ${i + 1} at ${formatTime(state.settings.reminderTimes[i])}${state.settings.reminderEnabled ? '' : '. Turn on Enable Reminders to get it.'}`);
      });
    });

    const btnMiniSet = document.getElementById('btn-start-mini-set');
    if (btnMiniSet) btnMiniSet.addEventListener('click', openMiniSetModal);

    const banner = document.getElementById('reminder-banner');
    const bannerStart = document.getElementById('btn-reminder-start');
    const bannerDismiss = document.getElementById('btn-reminder-dismiss');
    if (bannerStart) {
      bannerStart.addEventListener('click', () => {
        banner.hidden = true;
        if (setsDoneToday() === 0) openDaySessionModal(state.currentDay);
        else openMiniSetModal();
      });
    }
    if (bannerDismiss) bannerDismiss.addEventListener('click', () => { banner.hidden = true; });

    if (btnShowDisclaimer && modalDisclaimer) {
      btnShowDisclaimer.addEventListener('click', () => { modalDisclaimer.hidden = false; });
    }
    if (btnCloseDisclaimerModal && modalDisclaimer) {
      btnCloseDisclaimerModal.addEventListener('click', () => { modalDisclaimer.hidden = true; });
    }

    if (btnResetData) {
      btnResetData.addEventListener('click', () => {
        const confirmed = window.confirm(
          'Are you sure you want to reset your DryDay progress and diary entries on this device?'
        );
        if (confirmed) {
          clearSessionTimer();
          clearSosTimer();
          disablePush();
          StorageHelper.clear();
          state = getDefaultState();
          renderEntryFlow();
        }
      });
    }
  }

  document.addEventListener('DOMContentLoaded', () => {
    setupInstall();
    renderTrustCards();
    renderPhotos();
    bindEvents();
    renderEntryFlow();
    renderSetupCards();
    syncPush();
    checkReminder();
    setInterval(checkReminder, 30000);
    document.addEventListener('visibilitychange', () => { if (!document.hidden) checkReminder(); });
  });
})();
