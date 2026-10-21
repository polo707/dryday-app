/**
 * DryDay — Main Application Controller (Phase 3 Update)
 * Adds Pattern Quiz, Red-Flag Safety Screening, and dynamic UI rendering.
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
      redFlagsDetected: false,
      currentDay: 1,
      completedDays: [],
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

  function saveState() {
    StorageHelper.set(state);
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

  function updateGreeting() {
    const greetingEl = document.getElementById('greeting-text');
    if (!greetingEl) return;
    const hour = new Date().getHours();
    if (hour < 12) {
      greetingEl.textContent = 'Good Morning,';
    } else if (hour < 18) {
      greetingEl.textContent = 'Good Afternoon,';
    } else {
      greetingEl.textContent = 'Good Evening,';
    }
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
    renderQuizStatus();
  }

  function switchTab(targetTab) {
    Object.keys(tabViews).forEach((key) => {
      const isTarget = key === targetTab;
      if (tabViews[key]) {
        tabViews[key].hidden = !isTarget;
      }
    });

    navTabs.forEach((btn) => {
      const isActive = btn.getAttribute('data-tab') === targetTab;
      btn.classList.toggle('active', isActive);
      if (isActive) {
        btn.setAttribute('aria-current', 'page');
      } else {
        btn.removeAttribute('aria-current');
      }
    });

    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function renderStats() {
    const daysDoneEl = document.getElementById('stat-days-done');
    const streakEl = document.getElementById('stat-streak');
    if (daysDoneEl) {
      daysDoneEl.textContent = `${state.completedDays.length} / 7`;
    }
    if (streakEl) {
      streakEl.textContent = `${state.streak} ${state.streak === 1 ? 'day' : 'days'}`;
    }
  }

  function renderQuizStatus() {
    const statusEl = document.getElementById('home-pattern-status');
    if (!statusEl) return;
    if (!state.quizCompleted) {
      statusEl.textContent = 'Current pattern: Balanced Default';
    } else {
      const patternNames = {
        stress: 'Stress Incontinence',
        urge: 'Urge Incontinence / OAB',
        mixed: 'Mixed Incontinence'
      };
      statusEl.textContent = `Your pattern: ${patternNames[state.pattern] || 'Customized'}`;
    }
  }

  function renderHomeDayContent() {
    const dayData = PROGRAM.weeks[0].days.find(d => d.day === state.currentDay);
    if (!dayData) return;

    const weekLabel = document.getElementById('today-week-label');
    const titleEl = document.getElementById('today-title');
    const summaryEl = document.getElementById('today-summary');
    const durationEl = document.getElementById('today-duration');
    const habitTextEl = document.getElementById('today-habit-text');
    const patternBadgeEl = document.getElementById('today-pattern-badge');

    // Keep the day pills in sync with the saved day (e.g. after reloading the page)
    document.querySelectorAll('#home-day-pills .day-pill').forEach((p) => {
      const active = parseInt(p.getAttribute('data-day'), 10) === dayData.day;
      p.classList.toggle('active', active);
      p.setAttribute('aria-selected', active ? 'true' : 'false');
    });

    if (weekLabel) weekLabel.textContent = `Week 1 · Day ${dayData.day}`;
    if (titleEl) titleEl.textContent = dayData.title;
    if (summaryEl) summaryEl.textContent = dayData.summary;
    if (durationEl) durationEl.textContent = dayData.duration;
    if (habitTextEl) habitTextEl.textContent = dayData.habit;
    if (patternBadgeEl) {
      const pName = state.quizCompleted ? state.pattern.toUpperCase() : 'TAILORED';
      patternBadgeEl.textContent = `${pName} PLAN · DAY ${dayData.day} OF 7`;
    }
  }

  // Quiz Modal Generator
  function openQuizModal() {
    let modal = document.getElementById('modal-quiz');
    if (!modal) {
      modal = document.createElement('div');
      modal.id = 'modal-quiz';
      modal.className = 'modal-backdrop';
      modal.setAttribute('role', 'dialog');
      modal.setAttribute('aria-modal', 'true');
      modal.innerHTML = `
        <div class="modal-sheet quiz-sheet">
          <div class="card-pill-tag">1-Minute Assessment</div>
          <h2 class="two-tone-heading">Find Your Bladder<br /><span>Pattern</span></h2>
          <form id="quiz-form" class="quiz-form">
            <div class="quiz-step" data-step="1">
              <label class="input-label">1. When do leaks most often happen?</label>
              <div class="quiz-options">
                <label class="radio-label"><input type="radio" name="q_leak" value="stress" required> When coughing, sneezing, laughing, or exercising</label>
                <label class="radio-label"><input type="radio" name="q_leak" value="urge"> With a sudden, overwhelming urge before reaching the bathroom</label>
                <label class="radio-label"><input type="radio" name="q_leak" value="mixed"> Both sudden urges and physical activity</label>
              </div>
            </div>

            <div class="quiz-step" data-step="2" style="margin-top:16px;">
              <label class="input-label">2. Any clinical safety red flags (pain, blood, recent childbirth < 6 weeks)?</label>
              <div class="quiz-options">
                <label class="radio-label"><input type="radio" name="q_redflag" value="yes"> Yes (pain, burning, blood in urine, or recent childbirth)</label>
                <label class="radio-label"><input type="radio" name="q_redflag" value="no" checked> No / None of these</label>
              </div>
            </div>

            <button type="submit" class="primary-btn full-width" style="margin-top:20px;">
              Get My Tailored Plan →
            </button>
          </form>
        </div>
      `;
      document.body.appendChild(modal);

      modal.querySelector('#quiz-form').addEventListener('submit', (e) => {
        e.preventDefault();
        const data = new FormData(e.target);
        const leakVal = data.get('q_leak') || 'mixed';
        const redFlagVal = data.get('q_redflag') === 'yes';

        state.quizCompleted = true;
        state.pattern = leakVal;
        state.redFlagsDetected = redFlagVal;
        saveState();

        modal.remove();
        renderQuizStatus();
        renderHomeDayContent();

        if (redFlagVal) {
          alert('Note: Based on your answers, we recommend speaking with your doctor or pelvic floor physical therapist for an evaluation. You can still use DryDay educational exercises safely.');
        }
      });
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

    const dayPills = document.querySelectorAll('#home-day-pills .day-pill');
    dayPills.forEach((pill) => {
      pill.addEventListener('click', () => {
        const selectedDay = parseInt(pill.getAttribute('data-day'), 10) || 1;
        state.currentDay = selectedDay;
        saveState();

        dayPills.forEach((p) => {
          const active = p === pill;
          p.classList.toggle('active', active);
          p.setAttribute('aria-selected', active ? 'true' : 'false');
        });

        renderHomeDayContent();
      });
    });

    // Quiz trigger buttons
    document.addEventListener('click', (e) => {
      if (e.target.closest('[data-action="open-quiz"]')) {
        openQuizModal();
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
