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
      currentDay: 1,
      completedDays: [],
      lastCompletedDate: null,
      streak: 0,
      diary: [], // { id, day, category, detail, timeLabel, timestamp }
      practiceLog: {}, // { 'YYYY-MM-DD': number of sets done that day (guided session + short sets) }
      settings: {
        sound: true,
        vibration: true,
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
    if (!state.unlocked) {
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

  function renderStats() {
    const daysDoneEl = document.getElementById('stat-days-done');
    const streakEl = document.getElementById('stat-streak');
    if (daysDoneEl) daysDoneEl.textContent = `${state.completedDays.length} / 7`;
    if (streakEl) streakEl.textContent = `${state.streak} ${state.streak === 1 ? 'day' : 'days'}`;
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

    if (patternBadgeEl) {
      const pAdj = PROGRAM.patternAdjustments[state.pattern] || PROGRAM.patternAdjustments.mixed;
      patternBadgeEl.textContent = state.quizCompleted ? pAdj.label : 'Tailored Daily Plan';
    }

    renderPracticeCard();

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
          return `
            <button type="button" class="plan-day-item ${isDone ? 'done' : ''}" data-open-day="${d.day}">
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

        <form id="quiz-form">
          <div class="quiz-question-block">
            <span class="quiz-question-title">1. When do leaks or bladder worries usually happen?</span>
            <div class="quiz-options">
              <label class="radio-card"><input type="radio" name="leakType" value="stress" required checked /><span>When I cough, sneeze, laugh, lift, or exercise</span></label>
              <label class="radio-card"><input type="radio" name="leakType" value="urge" /><span>With a sudden, strong urge to reach the bathroom</span></label>
              <label class="radio-card"><input type="radio" name="leakType" value="mixed" /><span>Both physical effort and sudden urges</span></label>
            </div>
          </div>

          <div class="quiz-question-block">
            <span class="quiz-question-title">2. How often do leaks happen?</span>
            <div class="quiz-options">
              <label class="radio-card"><input type="radio" name="frequency" value="occasional" checked /><span>A few times a month or less</span></label>
              <label class="radio-card"><input type="radio" name="frequency" value="weekly" /><span>A few times a week</span></label>
              <label class="radio-card"><input type="radio" name="frequency" value="daily" /><span>Once a day or more</span></label>
            </div>
          </div>

          <div class="quiz-question-block">
            <span class="quiz-question-title">3. How bothersome is this in your daily life?</span>
            <div class="quiz-options">
              <label class="radio-card"><input type="radio" name="bother" value="mild" checked /><span>Mild — I want to prevent it from getting worse</span></label>
              <label class="radio-card"><input type="radio" name="bother" value="moderate" /><span>Moderate — I plan around bathrooms or pads</span></label>
              <label class="radio-card"><input type="radio" name="bother" value="high" /><span>Very bothersome — it affects my confidence daily</span></label>
            </div>
          </div>

          <div class="quiz-question-block">
            <span class="quiz-question-title">4. Your age range:</span>
            <div class="quiz-options">
              <label class="radio-card"><input type="radio" name="age" value="40-49" /><span>40–49</span></label>
              <label class="radio-card"><input type="radio" name="age" value="50-59" checked /><span>50–59</span></label>
              <label class="radio-card"><input type="radio" name="age" value="60+" /><span>60+</span></label>
            </div>
          </div>

          <div class="quiz-question-block">
            <span class="quiz-question-title">5. Menopause &amp; childbirth history:</span>
            <div class="quiz-options">
              <label class="radio-card"><input type="radio" name="lifeStage" value="peri_post" checked /><span>In perimenopause or post-menopause (no recent birth)</span></label>
              <label class="radio-card"><input type="radio" name="lifeStage" value="postpartum_over6w" /><span>Gave birth more than 6 weeks ago</span></label>
              <label class="radio-card"><input type="radio" name="lifeStage" value="postpartum_under6w" /><span>Currently pregnant or gave birth less than 6 weeks ago</span></label>
            </div>
          </div>

          <div class="quiz-question-block">
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

          <button type="submit" class="primary-btn full-width">See My Personalized Plan →</button>
        </form>
      </div>
    `;

    document.body.appendChild(modal);

    const cancelBtn = modal.querySelector('#btn-cancel-quiz');
    if (cancelBtn) {
      cancelBtn.addEventListener('click', () => modal.remove());
    }

    modal.querySelector('#quiz-form').addEventListener('submit', (e) => {
      e.preventDefault();
      const formData = new FormData(e.target);
      const leakType = formData.get('leakType') || 'mixed';
      const lifeStage = formData.get('lifeStage') || 'peri_post';
      const hasRedFlag = formData.get('redFlags') === 'yes' || lifeStage === 'postpartum_under6w';

      state.quizCompleted = true;
      state.pattern = leakType;
      state.redFlagsDetected = hasRedFlag;
      state.quizAnswers = Object.fromEntries(formData.entries());
      saveState();

      renderQuizStatus();
      renderHomeDayContent();

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
        <div class="lesson-content">
          ${dayData.lessonHtml}
        </div>
        <div class="disclaimer-box">
          <strong>${patternAdj.label}:</strong>
          <p style="margin-top:4px; font-size:0.94rem;">${patternAdj.summaryNote}</p>
        </div>
        <p class="safety-note">${dayData.safetyNote || 'Stop if you feel pain. Never hold your breath or push down. If your symptoms get worse, talk to your doctor or a pelvic floor physical therapist.'}</p>
        ${state.redFlagsDetected ? `
        <div class="redflag-alert-box" role="note">
          <strong>Safety reminder</strong>
          <p style="margin-top:6px; font-size:0.95rem;">You reported a symptom that should be checked by your doctor or a pelvic floor physical therapist before you start the exercises. You can keep reading the lessons.</p>
        </div>` : ''}
        <button type="button" id="btn-launch-player" class="primary-btn full-width">
          Start 5-Min Guided Session →
        </button>
      </div>
    `;

    document.body.appendChild(modal);

    modal.querySelector('#btn-close-session').addEventListener('click', () => {
      clearSessionTimer();
      modal.remove();
    });

    modal.querySelector('#btn-launch-player').addEventListener('click', () => {
      startInteractivePlayer(modal, dayData, patternAdj);
    });
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
        seconds: 5,
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

    modal.querySelector('.modal-sheet').innerHTML = `
      <div class="session-player-box">
        <div class="status-row">
          <span class="card-pill-tag" style="margin-bottom:0;" id="sp-block-count">Day ${dayData.day}</span>
          <button type="button" class="secondary-btn" id="sp-close">Close</button>
        </div>

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
    }

    function renderStep(announce) {
      const step = steps[stepIndex];
      el('sp-block-count').textContent = step.blockIndex === 0
        ? `Day ${dayData.day} · Starting`
        : dayData.isMiniSet
          ? `Day ${dayData.day} · Short set`
          : `Day ${dayData.day} · Set ${step.blockIndex} of ${step.totalBlocks}`;
      el('sp-position').textContent = step.position;
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
      const setsToday = addPracticeSet();
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
          <p class="card-body-text" style="margin-bottom:16px;">${setsLine}</p>
          <button type="button" id="sp-done" class="primary-btn full-width">Back to Home</button>
        `;
        modal.querySelector('#sp-done').addEventListener('click', () => {
          modal.remove();
          switchTab('home');
        });
        return;
      }

      const isLast = dayData.day >= PROGRAM.weeks[0].days.length;
      modal.querySelector('.modal-sheet').innerHTML = `
        <div class="card-pill-tag">Session Complete</div>
        <h2 class="two-tone-heading">Day ${dayData.day}<br /><span>Done. Well done!</span></h2>
        <p class="card-body-text" style="margin-bottom:12px;">
          ${isLast
            ? 'You finished Week 1. Open the Progress tab to see your week.'
            : 'Every session helps your muscles learn. Come back tomorrow for the next day.'}
        </p>
        <p class="card-body-text" style="margin-bottom:16px;"><strong>${setsLine}</strong></p>
        <div class="disclaimer-box">
          <strong>Today's small habit:</strong>
          <p style="margin-top:4px;">${dayData.habit}</p>
        </div>
        <button type="button" id="sp-done" class="primary-btn full-width">Back to Home</button>
      `;
      modal.querySelector('#sp-done').addEventListener('click', () => {
        modal.remove();
        switchTab('home');
      });
    }

    el('sp-close').addEventListener('click', () => {
      clearSessionTimer();
      modal.remove();
    });

    el('sp-pause').addEventListener('click', () => {
      paused = !paused;
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

  // =====================================================
  // DAILY PRACTICE: 3 SETS PER DAY
  // NICE NG123 1.4.5: "at least 8 contractions performed 3 times per day";
  // 1.4.4: a trial of at least 3 months. The guided session counts as set 1;
  // two short sets of 8 slow holds complete the day.
  // =====================================================
  function setsDoneToday() {
    return state.practiceLog[toDateKey(new Date())] || 0;
  }

  function addPracticeSet() {
    const key = toDateKey(new Date());
    state.practiceLog[key] = (state.practiceLog[key] || 0) + 1;
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
      btn.disabled = done >= 3;
      btn.textContent = done >= 3 ? 'All 3 done ✓' : 'Short set →';
    }
    if (text && done >= 3) {
      text.textContent = 'You did all 3 sets today. Rest now and come back tomorrow. Steady practice for at least 3 months is what builds strength.';
    } else if (text) {
      text.textContent = 'Health guidelines recommend at least 8 squeezes, 3 times a day. Your guided session is set 1. Add 2 short sets (about 2 minutes each) later in the day.';
    }
  }

  // Short set: 8 slow holds using today's slow-hold timing (never harder than the guided session)
  function openMiniSetModal() {
    clearSessionTimer();
    const week1 = PROGRAM.weeks[0];
    // If a guided session was done today, use that day's timing; otherwise the current day
    const practicedDay = state.lastCompletedDate === toDateKey(new Date()) && state.lastSessionDay ? state.lastSessionDay : state.currentDay;
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
    const today = toDateKey(new Date());
    const yesterday = toDateKey(new Date(Date.now() - 24 * 60 * 60 * 1000));
    if (state.lastCompletedDate !== today) {
      state.streak = state.lastCompletedDate === yesterday ? state.streak + 1 : 1;
      state.lastCompletedDate = today;
    }

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
    const cats = ['leak', 'urge', 'trip'];
    let max = 1;
    for (let d = 1; d <= 7; d++) {
      cats.forEach((c) => { max = Math.max(max, countFor(d, c)); });
    }
    let html = '';
    for (let d = 1; d <= 7; d++) {
      const counts = cats.map((c) => countFor(d, c));
      const label = `Day ${d}: ${counts[0]} leaks, ${counts[1]} strong urges, ${counts[2]} bathroom trips`;
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
    document.querySelectorAll('[data-reminder-slot]').forEach((input) => {
      const i = parseInt(input.getAttribute('data-reminder-slot'), 10);
      input.value = state.settings.reminderTimes[i];
    });
  }

  function checkReminder() {
    if (!state.unlocked || !state.disclaimerAccepted || !state.settings.reminderEnabled) return;
    const now = new Date();
    const today = toDateKey(now);
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
    if (bannerText) bannerText.textContent = text;
    if (banner) banner.hidden = false;
    try {
      if ('Notification' in window && Notification.permission === 'granted' && document.hidden) {
        new Notification('DryDay', { body: text });
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
      progress: { date: toDateKey(new Date()), sets: setsDoneToday() }
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
      ls.set(PUSH_SENT_KEY, JSON.stringify({ times: payload.times, progress: payload.progress }));
      reg.showNotification('Reminders turned on', {
        body: 'We’ll remind you at your 3 practice times. You can change them in More.',
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
      const json = JSON.stringify({ times: payload.times, progress: payload.progress });
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
      if (pushOn()) status.textContent = 'Phone notifications are on.';
      else if (support === 'ios-install') status.textContent = 'On iPhone, add DryDay to your Home Screen first to get notifications.';
      else if (support === 'denied') status.textContent = 'Notifications are blocked in your settings. Reminders will only show inside the app.';
      else if (support === 'unsupported') status.textContent = 'This browser can’t show notifications. Reminders will only show inside the app.';
      else status.textContent = '';
    }
  }

  function bindEvents() {
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
    bindEvents();
    renderEntryFlow();
    renderSetupCards();
    syncPush();
    checkReminder();
    setInterval(checkReminder, 30000);
    document.addEventListener('visibilitychange', () => { if (!document.hidden) checkReminder(); });
  });
})();
