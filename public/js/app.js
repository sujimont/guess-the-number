/**
 * Main Client Application Coordinator for Guess The Number
 */

(function () {
  'use strict';

  // State
  const state = {
    roomCode: null,
    playerIndex: null, // 0 for Host, 1 for Guest
    playerName: localStorage.getItem('gtn_player_name') || '',
    roomConfig: {
      digitCount: 4,
      mode: 'bulls_and_cows',
      allowDuplicates: false,
      timerEnabled: true,
      timerSeconds: 90,
      isAiGame: false
    },
    gameState: 'home', // 'home' | 'waiting' | 'setup' | 'game' | 'gameover'
    secretDigits: [],
    guessDigits: [],
    isMyTurn: false,
    mySecret: null,
    guesses: {
      my: [],
      opp: []
    },
    scratchpad: null
  };

  // DOM Elements
  const screens = {
    home: document.getElementById('screen-home'),
    waiting: document.getElementById('screen-waiting'),
    setup: document.getElementById('screen-setup'),
    game: document.getElementById('screen-game'),
    gameover: document.getElementById('screen-gameover')
  };

  // Sound & Theme
  const btnThemeToggle = document.getElementById('btn-theme-toggle');
  const btnSoundToggle = document.getElementById('btn-sound-toggle');
  const themeIcon = document.getElementById('theme-icon');
  const soundIcon = document.getElementById('sound-icon');
  const metaThemeColor = document.getElementById('meta-theme-color');

  // Home Screen Elements
  const playerNameInput = document.getElementById('player-name-input');
  const btnShowCreate = document.getElementById('btn-show-create');
  const btnShowJoin = document.getElementById('btn-show-join');
  const btnPlayAi = document.getElementById('btn-play-ai');
  const modalCreate = document.getElementById('modal-create-game');
  const modalJoin = document.getElementById('modal-join-game');
  const btnConfirmCreate = document.getElementById('btn-confirm-create');
  const btnConfirmJoin = document.getElementById('btn-confirm-join');
  const joinCodeInput = document.getElementById('join-room-code-input');

  // Waiting Screen Elements
  const displayRoomCode = document.getElementById('display-room-code');
  const btnCopyCode = document.getElementById('btn-copy-code');
  const btnCopyLink = document.getElementById('btn-copy-link');
  const waitingRulesSummary = document.getElementById('waiting-rules-summary');
  const rosterName0 = document.getElementById('roster-name-0');
  const rosterName1 = document.getElementById('roster-name-1');
  const btnLeaveWaiting = document.getElementById('btn-leave-waiting');

  // Setup Screen Elements
  const setupRulesDesc = document.getElementById('setup-rules-desc');
  const secretBoxesContainer = document.getElementById('secret-boxes');
  const secretValidationMsg = document.getElementById('secret-validation-msg');
  const btnLockSecret = document.getElementById('btn-lock-secret');
  const setupNumpad = document.getElementById('setup-numpad');
  const setupOpponentStatus = document.getElementById('setup-opponent-status');

  // Game Screen Elements
  const gameCodeChip = document.getElementById('game-code-chip');
  const gameModeChip = document.getElementById('game-mode-chip');
  const gameTimerContainer = document.getElementById('game-timer-container');
  const timerText = document.getElementById('timer-text');
  const turnBanner = document.getElementById('turn-banner');
  const turnBannerIcon = document.getElementById('turn-banner-icon');
  const turnBannerText = document.getElementById('turn-banner-text');
  const specialNoticeBanner = document.getElementById('special-notice-banner');
  const tabMyBoard = document.getElementById('tab-my-board');
  const tabOppBoard = document.getElementById('tab-opp-board');
  const boardMy = document.getElementById('board-my');
  const boardOpp = document.getElementById('board-opp');
  const countMyGuesses = document.getElementById('count-my-guesses');
  const countOppGuesses = document.getElementById('count-opp-guesses');
  const myHistoryList = document.getElementById('my-history-list');
  const oppHistoryList = document.getElementById('opp-history-list');
  const guessBoxesContainer = document.getElementById('guess-boxes');
  const btnSubmitGuess = document.getElementById('btn-submit-guess');
  const gameNumpad = document.getElementById('game-numpad');
  const btnClearScratchpad = document.getElementById('btn-clear-scratchpad');

  // Game Over Screen Elements
  const gameoverTrophy = document.getElementById('gameover-trophy');
  const gameoverTitle = document.getElementById('gameover-title');
  const gameoverReason = document.getElementById('gameover-reason');
  const revealMyVal = document.getElementById('reveal-my-val');
  const revealOppVal = document.getElementById('reveal-opp-val');
  const statRounds = document.getElementById('stat-rounds');
  const statGuesses = document.getElementById('stat-guesses');
  const btnPlayAgain = document.getElementById('btn-play-again');
  const btnReturnHome = document.getElementById('btn-return-home');
  const rematchWaitingNotice = document.getElementById('rematch-waiting-notice');

  // Toast Container
  const toastContainer = document.getElementById('toast-container');

  // Hidden numeric input to summon native mobile numpad on touch
  let hiddenInput = null;

  /* ==========================================================================
     Initialization & UI Setup
     ========================================================================== */
  function init() {
    initTheme();
    initSound();
    initNameInput();
    initScratchpad();
    initSegmentedControls();
    initModals();
    initSocketHandlers();
    initMobileKeyboardBridge();
    checkUrlForRoom();
  }

  function showToast(message, type = 'info', duration = 2800) {
    const toast = document.createElement('div');
    toast.className = `toast ${type === 'success' ? 'toast-success' : type === 'error' ? 'toast-error' : ''}`;
    toast.textContent = message;
    toastContainer.appendChild(toast);

    setTimeout(() => {
      toast.style.opacity = '0';
      toast.style.transition = 'opacity 0.3s ease';
      setTimeout(() => toast.remove(), 300);
    }, duration);
  }

  function switchScreen(screenKey) {
    state.gameState = screenKey;
    Object.values(screens).forEach(s => s.classList.remove('active'));
    if (screens[screenKey]) {
      screens[screenKey].classList.add('active');
    }
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  /* ==========================================================================
     Theme & Sound Toggles
     ========================================================================== */
  function initTheme() {
    const savedTheme = localStorage.getItem('gtn_theme') || 'dark';
    applyTheme(savedTheme);

    btnThemeToggle.addEventListener('click', () => {
      const isDark = document.body.classList.contains('dark-theme');
      applyTheme(isDark ? 'light' : 'dark');
      if (window.soundManager) window.soundManager.playTap();
    });
  }

  function applyTheme(theme) {
    if (theme === 'light') {
      document.body.classList.remove('dark-theme');
      document.body.classList.add('light-theme');
      themeIcon.textContent = '☀️';
      metaThemeColor.setAttribute('content', '#f1f5f9');
    } else {
      document.body.classList.remove('light-theme');
      document.body.classList.add('dark-theme');
      themeIcon.textContent = '🌙';
      metaThemeColor.setAttribute('content', '#090d16');
    }
    localStorage.setItem('gtn_theme', theme);
  }

  function initSound() {
    updateSoundIcon();
    btnSoundToggle.addEventListener('click', () => {
      if (window.soundManager) {
        window.soundManager.toggle();
        updateSoundIcon();
      }
    });
  }

  function updateSoundIcon() {
    const enabled = window.soundManager ? window.soundManager.enabled : true;
    soundIcon.textContent = enabled ? '🔊' : '🔇';
  }

  function initNameInput() {
    if (state.playerName) {
      playerNameInput.value = state.playerName;
    }
    playerNameInput.addEventListener('input', (e) => {
      state.playerName = e.target.value.trim().slice(0, 16);
      localStorage.setItem('gtn_player_name', state.playerName);
    });
  }

  function initScratchpad() {
    state.scratchpad = new window.DigitScratchpad('scratchpad-keys');
    btnClearScratchpad.addEventListener('click', () => {
      if (state.scratchpad) {
        state.scratchpad.reset();
        if (window.soundManager) window.soundManager.playDelete();
      }
    });
  }

  /* ==========================================================================
     Keyboard & Mobile Numpad Bridge
     Handles PC physical numpad (with NumLock on/off), top number row,
     and native mobile numeric keyboards.
     ========================================================================== */
  function getDigitFromKeyboardEvent(e) {
    // 1. Regular top number row (0-9)
    if (e.key >= '0' && e.key <= '9') {
      return e.key;
    }
    // 2. PC Physical Numpad (Numpad0 - Numpad9)
    // Works whether NumLock is ON or OFF!
    if (e.code && /^Numpad([0-9])$/.test(e.code)) {
      return e.code.replace('Numpad', '');
    }
    return null;
  }

  function initMobileKeyboardBridge() {
    hiddenInput = document.createElement('input');
    hiddenInput.type = 'text';
    hiddenInput.inputMode = 'numeric';
    hiddenInput.pattern = '[0-9]*';
    hiddenInput.style.position = 'fixed';
    hiddenInput.style.bottom = '0';
    hiddenInput.style.left = '0';
    hiddenInput.style.opacity = '0';
    hiddenInput.style.pointerEvents = 'none';
    hiddenInput.style.height = '1px';
    hiddenInput.style.width = '1px';
    hiddenInput.style.zIndex = '-1';
    document.body.appendChild(hiddenInput);

    // Mobile virtual keyboard input
    hiddenInput.addEventListener('input', (e) => {
      const val = e.target.value;
      if (val && /^\d+$/.test(val)) {
        const lastChar = val[val.length - 1];
        handleDigitInput(lastChar);
      }
      hiddenInput.value = '';
    });

    hiddenInput.addEventListener('keydown', (e) => {
      if (e.key === 'Backspace') {
        handleBackspace();
      } else if (e.key === 'Enter') {
        handleEnter();
      }
    });

    // Universal Desktop & PC Keyboard Listener (Top number row + Numpad)
    window.addEventListener('keydown', (e) => {
      // Do not intercept if user is typing in name or join-code inputs
      if (document.activeElement === playerNameInput || document.activeElement === joinCodeInput) {
        return;
      }

      const digit = getDigitFromKeyboardEvent(e);
      if (digit !== null) {
        e.preventDefault(); // Prevents double-firing into hiddenInput
        handleDigitInput(digit);
        return;
      }

      if (e.key === 'Backspace' || e.code === 'Backspace' || e.key === 'Delete') {
        e.preventDefault();
        handleBackspace();
        return;
      }

      if (e.key === 'Enter' || e.code === 'Enter' || e.code === 'NumpadEnter') {
        e.preventDefault();
        handleEnter();
        return;
      }
    });
  }

  function focusMobileNumpad() {
    if (hiddenInput) {
      hiddenInput.focus();
    }
  }

  /* ==========================================================================
     Segmented Controls & Modals
     ========================================================================== */
  function initSegmentedControls() {
    setupButtonGroup('digits-selector', (btn) => {
      state.roomConfig.digitCount = parseInt(btn.dataset.digits, 10);
    });

    setupButtonGroup('mode-selector', (btn) => {
      state.roomConfig.mode = btn.dataset.mode;
    });

    setupButtonGroup('duplicates-selector', (btn) => {
      state.roomConfig.allowDuplicates = btn.dataset.duplicates === 'true';
    });

    setupButtonGroup('timer-selector', (btn) => {
      const val = parseInt(btn.dataset.timer, 10);
      state.roomConfig.timerEnabled = val > 0;
      state.roomConfig.timerSeconds = val || 90;
    });
  }

  function setupButtonGroup(containerId, onChange) {
    const container = document.getElementById(containerId);
    if (!container) return;
    const buttons = container.querySelectorAll('.segment-btn');

    buttons.forEach(btn => {
      btn.addEventListener('click', () => {
        buttons.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        if (window.soundManager) window.soundManager.playTap();
        onChange(btn);
      });
    });
  }

  function initModals() {
    // Show modals
    btnShowCreate.addEventListener('click', () => {
      modalCreate.classList.remove('hidden');
      if (window.soundManager) window.soundManager.playTap();
    });

    btnShowJoin.addEventListener('click', () => {
      modalJoin.classList.remove('hidden');
      joinCodeInput.focus();
      if (window.soundManager) window.soundManager.playTap();
    });

    btnPlayAi.addEventListener('click', () => {
      if (window.soundManager) window.soundManager.playTap();
      startAiGame();
    });

    // Close modals
    document.querySelectorAll('.modal-close').forEach(btn => {
      btn.addEventListener('click', () => {
        modalCreate.classList.add('hidden');
        modalJoin.classList.add('hidden');
      });
    });

    // Close on overlay backdrop tap
    [modalCreate, modalJoin].forEach(modal => {
      modal.addEventListener('click', (e) => {
        if (e.target === modal) {
          modal.classList.add('hidden');
        }
      });
    });

    // Confirm Create Room
    btnConfirmCreate.addEventListener('click', async () => {
      modalCreate.classList.add('hidden');
      await createRoom(false);
    });

    // Confirm Join Room
    btnConfirmJoin.addEventListener('click', async () => {
      const code = joinCodeInput.value.trim().toUpperCase();
      if (!code || code.length !== 6) {
        showToast('Please enter a valid 6-character room code', 'error');
        if (window.soundManager) window.soundManager.playError();
        return;
      }
      modalJoin.classList.add('hidden');
      await joinRoom(code);
    });

    // Auto uppercase in join code input
    joinCodeInput.addEventListener('input', (e) => {
      e.target.value = e.target.value.toUpperCase();
    });

    joinCodeInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        btnConfirmJoin.click();
      }
    });

    // Copy Code / Link buttons
    btnCopyCode.addEventListener('click', () => {
      if (state.roomCode) {
        navigator.clipboard.writeText(state.roomCode);
        showToast(`Game code ${state.roomCode} copied!`, 'success');
        if (window.soundManager) window.soundManager.playTap();
      }
    });

    btnCopyLink.addEventListener('click', () => {
      if (state.roomCode) {
        const url = `${window.location.origin}${window.location.pathname}?room=${state.roomCode}`;
        navigator.clipboard.writeText(url);
        showToast('Direct invite link copied to clipboard!', 'success');
        if (window.soundManager) window.soundManager.playTap();
      }
    });

    btnLeaveWaiting.addEventListener('click', () => {
      location.reload();
    });

    // Mobile Board Tabs
    tabMyBoard.addEventListener('click', () => {
      tabMyBoard.classList.add('active');
      tabOppBoard.classList.remove('active');
      boardMy.classList.add('active');
      boardOpp.classList.remove('active');
      if (window.soundManager) window.soundManager.playTap();
    });

    tabOppBoard.addEventListener('click', () => {
      tabOppBoard.classList.add('active');
      tabMyBoard.classList.remove('active');
      boardOpp.classList.add('active');
      boardMy.classList.remove('active');
      if (window.soundManager) window.soundManager.playTap();
    });

    // Lock in Secret Button
    btnLockSecret.addEventListener('click', () => {
      submitSecretNumber();
    });

    // Submit Guess Button
    btnSubmitGuess.addEventListener('click', () => {
      submitCurrentGuess();
    });

    // Play Again Button
    btnPlayAgain.addEventListener('click', () => {
      if (window.soundManager) window.soundManager.playTap();
      requestRematch();
    });

    btnReturnHome.addEventListener('click', () => {
      location.reload();
    });
  }

  function checkUrlForRoom() {
    const params = new URLSearchParams(window.location.search);
    const roomParam = params.get('room');
    if (roomParam && roomParam.length === 6) {
      joinCodeInput.value = roomParam.toUpperCase();
      modalJoin.classList.remove('hidden');
    }
  }

  /* ==========================================================================
     Room Lifecycle & Sockets
     ========================================================================= */
  async function createRoom(isAiGame = false) {
    const name = state.playerName || (isAiGame ? 'Player' : 'Player 1');
    const payload = {
      playerName: name,
      digitCount: state.roomConfig.digitCount,
      mode: state.roomConfig.mode,
      allowDuplicates: state.roomConfig.allowDuplicates,
      timerEnabled: state.roomConfig.timerEnabled,
      timerSeconds: state.roomConfig.timerSeconds,
      isAiGame
    };

    const res = await window.socketClient.createRoom(payload);
    if (!res.success) {
      showToast(res.error || 'Failed to create room', 'error');
      return;
    }

    state.roomCode = res.roomCode;
    state.playerIndex = res.playerIndex;
    state.roomConfig = { ...state.roomConfig, ...res.roomConfig };

    if (isAiGame) {
      startSetupPhase(res.players);
    } else {
      setupWaitingRoom(res.roomCode, res.players);
    }
  }

  function startAiGame() {
    state.roomConfig.isAiGame = true;
    createRoom(true);
  }

  async function joinRoom(code) {
    const name = state.playerName || 'Player 2';
    const res = await window.socketClient.joinRoom({ roomCode: code, playerName: name });

    if (!res.success) {
      showToast(res.error || 'Failed to join room', 'error');
      if (window.soundManager) window.soundManager.playError();
      return;
    }

    state.roomCode = res.roomCode;
    state.playerIndex = res.playerIndex;
    state.roomConfig = { ...state.roomConfig, ...res.roomConfig };

    startSetupPhase(res.players);
  }

  function setupWaitingRoom(code, players) {
    displayRoomCode.textContent = code;
    rosterName0.textContent = players[0]?.name || 'Host';
    rosterName1.textContent = 'Waiting for friend...';

    // Update rules summary chips
    waitingRulesSummary.innerHTML = `
      <span class="rule-pill">${state.roomConfig.digitCount} Digits</span>
      <span class="rule-pill">${state.roomConfig.mode === 'exact' ? 'Exact Matches' : 'Bulls & Cows'}</span>
      <span class="rule-pill">${state.roomConfig.allowDuplicates ? 'Duplicates OK' : 'Unique Digits'}</span>
      <span class="rule-pill">${state.roomConfig.timerEnabled ? state.roomConfig.timerSeconds + 's Timer' : 'No Timer'}</span>
    `;

    switchScreen('waiting');
  }

  function startSetupPhase(players) {
    state.secretDigits = [];
    state.mySecret = null;
    btnLockSecret.disabled = true;
    secretValidationMsg.textContent = '';
    secretValidationMsg.className = 'validation-msg';

    const count = state.roomConfig.digitCount;
    const dupText = state.roomConfig.allowDuplicates ? 'Duplicates allowed' : 'Must be unique digits';
    setupRulesDesc.textContent = `Pick a ${count}-digit secret code (${dupText}). Opponent will try to crack this!`;

    renderDigitBoxes(secretBoxesContainer, count, state.secretDigits);
    renderNumpad(setupNumpad);

    if (state.roomConfig.isAiGame) {
      setupOpponentStatus.innerHTML = `🤖 RoboGuesser has locked in its secret code!`;
    } else {
      setupOpponentStatus.innerHTML = `<span class="spinner-tiny"></span> Opponent is selecting their secret code...`;
    }

    switchScreen('setup');
    focusMobileNumpad();
  }

  /* ==========================================================================
     Digit Boxes & Numpad Rendering
     ========================================================================== */
  function renderDigitBoxes(container, count, digits) {
    container.innerHTML = '';
    for (let i = 0; i < count; i++) {
      const box = document.createElement('div');
      box.className = 'digit-box';
      if (i < digits.length) {
        box.textContent = digits[i];
        box.classList.add('filled');
      } else {
        box.textContent = '';
      }
      if (i === digits.length) {
        box.classList.add('active');
      }

      box.addEventListener('click', () => {
        focusMobileNumpad();
      });

      container.appendChild(box);
    }
  }

  function renderNumpad(container) {
    container.innerHTML = '';
    // Keypad Layout: 1-9, then Clear, 0, Backspace
    const keys = ['1', '2', '3', '4', '5', '6', '7', '8', '9', 'CLR', '0', '⌫'];

    keys.forEach(k => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = `keypad-btn ${k === 'CLR' || k === '⌫' ? 'keypad-btn-special' : ''}`;
      btn.textContent = k;

      btn.addEventListener('click', (e) => {
        e.preventDefault();
        if (k === 'CLR') {
          handleClear();
        } else if (k === '⌫') {
          handleBackspace();
        } else {
          handleDigitInput(k);
        }
      });

      container.appendChild(btn);
    });
  }

  /* ==========================================================================
     Input Dispatchers
     ========================================================================== */
  function handleDigitInput(digit) {
    if (state.gameState === 'setup') {
      if (state.secretDigits.length < state.roomConfig.digitCount) {
        // If duplicates not allowed, check
        if (!state.roomConfig.allowDuplicates && state.secretDigits.includes(digit)) {
          showSecretError('Duplicate digits not allowed for this room');
          if (window.soundManager) window.soundManager.playError();
          return;
        }

        state.secretDigits.push(digit);
        if (window.soundManager) window.soundManager.playDigit();
        renderDigitBoxes(secretBoxesContainer, state.roomConfig.digitCount, state.secretDigits);
        validateSecretInput();
      }
    } else if ((state.gameState === 'game' || state.gameState === 'playing') && state.isMyTurn) {
      if (state.guessDigits.length < state.roomConfig.digitCount) {
        if (!state.roomConfig.allowDuplicates && state.guessDigits.includes(digit)) {
          showToast('Duplicate digits not allowed', 'error', 1500);
          if (window.soundManager) window.soundManager.playError();
          return;
        }

        state.guessDigits.push(digit);
        if (window.soundManager) window.soundManager.playDigit();
        renderDigitBoxes(guessBoxesContainer, state.roomConfig.digitCount, state.guessDigits);
        validateGuessInput();
      }
    }
  }

  function handleBackspace() {
    if (state.gameState === 'setup') {
      if (state.secretDigits.length > 0) {
        state.secretDigits.pop();
        if (window.soundManager) window.soundManager.playDelete();
        renderDigitBoxes(secretBoxesContainer, state.roomConfig.digitCount, state.secretDigits);
        validateSecretInput();
      }
    } else if ((state.gameState === 'game' || state.gameState === 'playing') && state.isMyTurn) {
      if (state.guessDigits.length > 0) {
        state.guessDigits.pop();
        if (window.soundManager) window.soundManager.playDelete();
        renderDigitBoxes(guessBoxesContainer, state.roomConfig.digitCount, state.guessDigits);
        validateGuessInput();
      }
    }
  }

  function handleClear() {
    if (state.gameState === 'setup') {
      state.secretDigits = [];
      if (window.soundManager) window.soundManager.playDelete();
      renderDigitBoxes(secretBoxesContainer, state.roomConfig.digitCount, state.secretDigits);
      validateSecretInput();
    } else if ((state.gameState === 'game' || state.gameState === 'playing') && state.isMyTurn) {
      state.guessDigits = [];
      if (window.soundManager) window.soundManager.playDelete();
      renderDigitBoxes(guessBoxesContainer, state.roomConfig.digitCount, state.guessDigits);
      validateGuessInput();
    }
  }

  function handleEnter() {
    if (state.gameState === 'setup' && !btnLockSecret.disabled) {
      submitSecretNumber();
    } else if ((state.gameState === 'game' || state.gameState === 'playing') && state.isMyTurn && !btnSubmitGuess.disabled) {
      submitCurrentGuess();
    }
  }

  /* ==========================================================================
     Secret Validation & Submission
     ========================================================================== */
  function validateSecretInput() {
    const count = state.roomConfig.digitCount;
    if (state.secretDigits.length < count) {
      secretValidationMsg.textContent = `${count - state.secretDigits.length} digit(s) remaining...`;
      secretValidationMsg.className = 'validation-msg';
      btnLockSecret.disabled = true;
      return;
    }

    if (!state.roomConfig.allowDuplicates) {
      const set = new Set(state.secretDigits);
      if (set.size !== count) {
        showSecretError('All digits must be unique');
        btnLockSecret.disabled = true;
        return;
      }
    }

    secretValidationMsg.textContent = 'Valid secret number! Tap Lock In to proceed.';
    secretValidationMsg.className = 'validation-msg success';
    btnLockSecret.disabled = false;
  }

  function showSecretError(msg) {
    secretValidationMsg.textContent = msg;
    secretValidationMsg.className = 'validation-msg';
  }

  async function submitSecretNumber() {
    const secret = state.secretDigits.join('');
    btnLockSecret.disabled = true;

    const res = await window.socketClient.setSecret(secret);
    if (!res.success) {
      showSecretError(res.error || 'Failed to submit secret');
      btnLockSecret.disabled = false;
      return;
    }

    state.mySecret = secret;
    if (window.soundManager) window.soundManager.playSuccess();
    showToast('Secret code locked in!', 'success');
    btnLockSecret.textContent = '✅ Locked In';

    // Disable numpad in setup
    setupNumpad.querySelectorAll('button').forEach(b => b.disabled = true);
  }

  /* ==========================================================================
     Active Game Phase
     ========================================================================== */
  function startGamePhase(data) {
    state.guesses.my = [];
    state.guesses.opp = [];
    state.guessDigits = [];

    // Header info
    gameCodeChip.textContent = state.roomCode;
    gameModeChip.textContent = state.roomConfig.mode === 'exact' ? 'Exact Matches' : 'Bulls & Cows';

    if (state.roomConfig.timerEnabled) {
      gameTimerContainer.style.display = 'flex';
      timerText.textContent = data.timerSeconds || 90;
    } else {
      gameTimerContainer.style.display = 'none';
    }

    myHistoryList.innerHTML = '<div class="empty-history-placeholder">No guesses made yet. Make your first guess below!</div>';
    oppHistoryList.innerHTML = '<div class="empty-history-placeholder">Opponent hasn\'t made any guesses yet.</div>';
    countMyGuesses.textContent = '0';
    countOppGuesses.textContent = '0';

    specialNoticeBanner.classList.add('hidden');
    specialNoticeBanner.textContent = '';

    renderDigitBoxes(guessBoxesContainer, state.roomConfig.digitCount, state.guessDigits);
    renderNumpad(gameNumpad);

    if (state.scratchpad) state.scratchpad.reset();

    updateTurnUI(data.currentTurnIndex);
    switchScreen('game');
  }

  function updateTurnUI(activePlayerIndex) {
    state.isMyTurn = activePlayerIndex === state.playerIndex;
    btnSubmitGuess.disabled = !state.isMyTurn || state.guessDigits.length !== state.roomConfig.digitCount;

    // Toggle numpad button responsiveness
    gameNumpad.querySelectorAll('button').forEach(b => {
      b.disabled = !state.isMyTurn;
    });

    if (state.isMyTurn) {
      turnBanner.className = 'turn-banner my-turn';
      turnBannerIcon.textContent = '🎯';
      turnBannerText.textContent = 'Your Turn! Guess opponent\'s number';
      if (window.soundManager) window.soundManager.playTurn();
      focusMobileNumpad();
    } else {
      turnBanner.className = 'turn-banner opp-turn';
      turnBannerIcon.textContent = '⏳';
      turnBannerText.textContent = `Opponent's Turn... Thinking`;
    }
  }

  function validateGuessInput() {
    const count = state.roomConfig.digitCount;
    const isFull = state.guessDigits.length === count;
    btnSubmitGuess.disabled = !state.isMyTurn || !isFull;
  }

  async function submitCurrentGuess() {
    if (!state.isMyTurn) return;

    const guess = state.guessDigits.join('');
    btnSubmitGuess.disabled = true;

    const res = await window.socketClient.submitGuess(guess);
    if (!res.success) {
      showToast(res.error || 'Failed to submit guess', 'error');
      if (window.soundManager) window.soundManager.playError();
      btnSubmitGuess.disabled = false;
      return;
    }

    // Reset current guess input
    state.guessDigits = [];
    renderDigitBoxes(guessBoxesContainer, state.roomConfig.digitCount, state.guessDigits);
  }

  function addGuessToBoard(guessRecord) {
    const isMine = guessRecord.playerIndex === state.playerIndex;
    const targetList = isMine ? myHistoryList : oppHistoryList;
    const countBadge = isMine ? countMyGuesses : countOppGuesses;
    const listArray = isMine ? state.guesses.my : state.guesses.opp;

    listArray.push(guessRecord);
    countBadge.textContent = listArray.length;

    // Clear empty placeholder
    const placeholder = targetList.querySelector('.empty-history-placeholder');
    if (placeholder) placeholder.remove();

    const row = document.createElement('div');
    row.className = 'guess-row';

    let badgesHtml = '';
    if (guessRecord.feedback.mode === 'exact') {
      badgesHtml = `<span class="badge-feedback badge-exact">${guessRecord.feedback.exact} Exact</span>`;
    } else {
      badgesHtml = `
        <span class="badge-feedback badge-bulls">${guessRecord.feedback.bulls} Bulls</span>
        <span class="badge-feedback badge-cows">${guessRecord.feedback.cows} Cows</span>
      `;
    }

    row.innerHTML = `
      <div class="guess-meta">
        <span class="guess-index">#${guessRecord.turnNumber}</span>
        <span class="guess-digits">${guessRecord.guess}</span>
      </div>
      <div class="feedback-badges">${badgesHtml}</div>
    `;

    targetList.prepend(row);

    if (isMine) {
      if (guessRecord.feedback.isWin) {
        if (window.soundManager) window.soundManager.playSuccess();
      } else {
        if (window.soundManager) window.soundManager.playTap();
      }
    }
  }

  /* ==========================================================================
     Game Over & Rematch
     ========================================================================== */
  function showGameOverScreen(data) {
    const { outcome, reason, secrets, totalRounds } = data;
    const isPlayer0 = state.playerIndex === 0;
    const isPlayer1 = state.playerIndex === 1;

    let isWin = false;
    let title = '';

    if (outcome === 'draw') {
      isWin = true;
      gameoverTrophy.textContent = '🤝';
      title = 'It\'s a Draw!';
    } else if ((outcome === 'player0' && isPlayer0) || (outcome === 'player1' && isPlayer1)) {
      isWin = true;
      gameoverTrophy.textContent = '🏆';
      title = 'Victory!';
    } else {
      isWin = false;
      gameoverTrophy.textContent = '💥';
      title = 'Defeat';
    }

    gameoverTitle.textContent = title;
    gameoverReason.textContent = reason;

    // Reveal secrets
    revealMyVal.textContent = isPlayer0 ? secrets.player0.secret : secrets.player1.secret;
    revealOppVal.textContent = isPlayer0 ? secrets.player1.secret : secrets.player0.secret;

    statRounds.textContent = totalRounds;
    statGuesses.textContent = state.guesses.my.length;

    rematchWaitingNotice.classList.add('hidden');
    btnPlayAgain.disabled = false;
    btnPlayAgain.textContent = '🔄 Play Again (Rematch)';

    if (window.soundManager) window.soundManager.playGameOver(isWin);
    switchScreen('gameover');
  }

  async function requestRematch() {
    btnPlayAgain.disabled = true;
    btnPlayAgain.textContent = 'Waiting for opponent...';
    rematchWaitingNotice.classList.remove('hidden');

    const res = await window.socketClient.requestRematch();
    if (!res.success) {
      showToast(res.error || 'Failed to request rematch', 'error');
      btnPlayAgain.disabled = false;
    }
  }

  /* ==========================================================================
     Socket Event Handlers
     ========================================================================== */
  function initSocketHandlers() {
    window.socketClient.on('room_ready_for_setup', (data) => {
      startSetupPhase(data.players);
    });

    window.socketClient.on('player_ready_update', (data) => {
      if (data.playerIndex !== state.playerIndex && data.isReady) {
        setupOpponentStatus.innerHTML = `✅ Opponent is ready and locked in!`;
      }
    });

    window.socketClient.on('game_started', (data) => {
      startGamePhase(data);
    });

    window.socketClient.on('guess_result', (data) => {
      addGuessToBoard(data.guessRecord);
    });

    window.socketClient.on('turn_changed', (data) => {
      updateTurnUI(data.currentTurnIndex);
    });

    window.socketClient.on('timer_tick', (data) => {
      timerText.textContent = data.remaining;
      const ring = document.querySelector('.timer-ring');
      if (ring) {
        if (data.remaining <= 10) {
          ring.className = 'timer-ring urgent';
          if (data.remaining <= 5 && state.isMyTurn && window.soundManager) {
            window.soundManager.playTick();
          }
        } else if (data.remaining <= 25) {
          ring.className = 'timer-ring warning';
        } else {
          ring.className = 'timer-ring';
        }
      }
    });

    window.socketClient.on('turn_timeout', (data) => {
      showToast(data.message, 'error', 3000);
      if (window.soundManager) window.soundManager.playError();
    });

    window.socketClient.on('first_winner_notice', (data) => {
      specialNoticeBanner.classList.remove('hidden');
      specialNoticeBanner.textContent = data.message;
      showToast(data.message, 'info', 4000);
    });

    window.socketClient.on('game_over', (data) => {
      showGameOverScreen(data);
    });

    window.socketClient.on('rematch_started', (data) => {
      showToast('Rematch started! Pick your secret numbers.', 'success');
      startSetupPhase(data.players);
    });

    window.socketClient.on('rematch_requested_notice', (data) => {
      if (data.playerIndex !== state.playerIndex) {
        showToast(`${data.playerName} wants a rematch!`, 'info');
      }
    });

    window.socketClient.on('player_left', (data) => {
      showToast(data.message, 'error', 4000);
    });
  }

  // Initialize on DOM load
  document.addEventListener('DOMContentLoaded', init);
})();
