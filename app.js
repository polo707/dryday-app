/**
 * DryDay — Main Application Controller (Up to Phase 4)
 * Features:
 * - Safe localStorage wrapper with try/catch
 * - First-launch Access Gate (DRYDAY2026) & Medical Disclaimer
 * - Complete 1-Minute Pattern & Red-Flag Safety Quiz
 * - Week 1 (Days 1–7) Content, Lesson Viewer & Interactive Guided Session Player
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
      diary: [],
      settings: {
        sound: true,
        vibration: true,
        reminderTime: '09:00'
      }
    };
  }

  let state = Object.assign(getDefaultState(), StorageHelper.get() || {});
  state.settings = Object.assign(getDefaultState().settings, (state.settings || {}));

  function saveState() {
    StorageHelper.set(state);
  }

  // Gentle Web Audio API chime (no external audio files required)
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
    } catch (e) {
      // Ignore audio errors if blocked by browser autoplay policy
    }
  }

  function triggerVibration(pattern = 80) {
    if (!state.settings.vibration) return;
    try {
      if (navigator.vibrate) {
        navigator.vibrate(pattern);
      }
    } catch (e) {}
  }

  // DOM References
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

    // Prompt quiz automatically right after first disclaimer acceptance
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

    const isDone = state.completedDays.includes(dayData.day);
    if (weekLabel) {
      weekLabel.textContent = `Week 1 · Day ${dayData.day}${isDone ? ' (Completed ✓)' : ''}`;
    }
    if (titleEl) titleEl.textContent = dayData.title;
    if (summaryEl) summaryEl.textContent = dayData.summary;
    if (durationEl) durationEl.textContent = dayData.duration;
    if (habitTextEl) habitTextEl.textContent = dayData.habit;

    if (patternBadgeEl) {
      const pAdj = PROGRAM.patternAdjustments[state.pattern] || PROGRAM.patternAdjustments.mixed;
      patternBadgeEl.textContent = state.quizCompleted ? pAdj.label : 'Tailored Daily Plan';
    }
  }

  function renderPlanList() {
    if (typeof PROGRAM === 'undefined') return;
    const listEl = document.getElementById('plan-week1-list');
    if (!listEl) return;

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
        <div class="quiz-progress-text">1-Minute Personalization &amp; Safety Check</div>
        <h2 class="two-tone-heading">Personalize Your<br /><span>Week 1 Plan</span></h2>

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
    if (dayData.day >= 2 && patternAdj && patternAdj.bonusBlock) {
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
      markDayComplete(dayData.day);
      playCueTone(700, 400);
      triggerVibration([80, 80, 160]);

      const isLast = dayData.day >= PROGRAM.weeks[0].days.length;
      modal.querySelector('.modal-sheet').innerHTML = `
        <div class="card-pill-tag">Session Complete</div>
        <h2 class="two-tone-heading">Day ${dayData.day}<br /><span>Done. Well done!</span></h2>
        <p class="card-body-text" style="margin-bottom:16px;">
          ${isLast
            ? 'You finished Week 1. Open the Progress tab to see your week.'
            : 'Every short session helps your muscles learn. Come back tomorrow for the next day.'}
        </p>
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
    });

    el('sp-vibe').addEventListener('click', () => {
      state.settings.vibration = !state.settings.vibration;
      saveState();
      renderToggles();
      triggerVibration(60);
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

  function markDayComplete(dayNumber) {
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
      });
    });

    if (btnStartToday) {
      btnStartToday.addEventListener('click', () => openDaySessionModal(state.currentDay));
    }

    // Delegated clicks: quiz buttons and Plan tab day rows
    document.addEventListener('click', (e) => {
      if (e.target.closest('[data-action="open-quiz"]')) {
        openQuizModal();
        return;
      }
      const dayRow = e.target.closest('[data-open-day]');
      if (dayRow) {
        const day = parseInt(dayRow.getAttribute('data-open-day'), 10) || 1;
        state.currentDay = day;
        saveState();
        renderHomeDayContent();
        openDaySessionModal(day);
      }
    });

    if (btnShowDisclaimer && modalDisclaimer) {
      btnShowDisclaimer.addEventListener('click', () => {
        modalDisclaimer.hidden = false;
      });
    }

    if (btnCloseDisclaimerModal && modalDisclaimer) {
      btnCloseDisclaimerModal.addEventListener('click', () => {
        modalDisclaimer.hidden = true;
      });
    }

    if (btnResetData) {
      btnResetData.addEventListener('click', () => {
        const confirmed = window.confirm(
          'Are you sure you want to reset your DryDay progress and diary entries on this device?'
        );
        if (confirmed) {
          clearSessionTimer();
          StorageHelper.clear();
          state = getDefaultState();
          renderEntryFlow();
        }
      });
    }
  }

  document.addEventListener('DOMContentLoaded', () => {
    bindEvents();
    renderEntryFlow();
  });
})();
