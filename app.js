/**
 * DryDay — Main Application Controller (Phase 2 Shell)
 * Includes safe localStorage wrapper, first-launch gates (Access Code + Disclaimer),
 * and bottom pill navigation (Home, Plan, Progress, More).
 */

(function () {
  'use strict';

  const ACCESS_CODE_VALID = 'DRYDAY2026';
  const STORAGE_KEY = 'dryday_state_v1';

  // Safe localStorage wrapper with in-memory fallback
  const StorageHelper = {
    memoryFallback: {},
    get() {
      try {
        const raw = window.localStorage.getItem(STORAGE_KEY);
        if (!raw) return null;
        return JSON.parse(raw);
      } catch (err) {
        console.warn('localStorage read unavailable, using memory fallback.', err);
        return this.memoryFallback[STORAGE_KEY] || null;
      }
    },
    set(data) {
      try {
        window.localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
      } catch (err) {
        console.warn('localStorage write unavailable, using memory fallback.', err);
        this.memoryFallback[STORAGE_KEY] = data;
      }
    },
    clear() {
      try {
        window.localStorage.removeItem(STORAGE_KEY);
      } catch (err) {
        console.warn('localStorage clear unavailable.', err);
      }
      delete this.memoryFallback[STORAGE_KEY];
    }
  };

  // Default state
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

  // Greeting based on time of day
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

  // Route between First-Launch Gates and Main Shell
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
  }

  // Switch between Bottom Navigation Tabs (Home, Plan, Progress, More)
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

  // Event Listeners
  function bindEvents() {
    // 1. Access Code Gate
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

    // 2. First-Launch Disclaimer Acceptance
    if (btnAcceptDisclaimer) {
      btnAcceptDisclaimer.addEventListener('click', () => {
        state.disclaimerAccepted = true;
        saveState();
        renderEntryFlow();
      });
    }

    // 3. Bottom Pill Navigation
    navTabs.forEach((btn) => {
      btn.addEventListener('click', () => {
        const target = btn.getAttribute('data-tab');
        if (target) switchTab(target);
      });
    });

    // 4. Day Selector Pills on Home Screen
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

        const weekLabel = document.getElementById('today-week-label');
        if (weekLabel) {
          weekLabel.textContent = `Week 1 · Day ${selectedDay}`;
        }
      });
    });

    // 5. Settings: Open & Close Disclaimer Modal
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

    // 6. Settings: Reset Data
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

  // Initialize App
  document.addEventListener('DOMContentLoaded', () => {
    bindEvents();
    renderEntryFlow();
  });
})();
