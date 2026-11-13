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
      mode: 'exact',
      allowDuplicates: false,
      timerEnabled: false,
      timerSeconds: 0,
      isAiGame: false
    },
    gameState: 'home', // 'home' | 'waiting' | 'setup' | 'game' | 'gameover'
    secretDigits: ['', '', '', ''],
    secretBoxIndex: 0,
    guessDigits: ['', '', '', ''],
    activeBoxIndex: 0,
    isMyTurn: false,
    mySecret: null,
    guesses: {
      my: [],
      opp: []
    },
    scratchpad: null,
    isCreatingAi: false,
    isRematchConfig: false,
    seenGuesses: new Set()
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
  const modalCreateTitle = document.getElementById('modal-create-title');
  const modalJoin = document.getElementById('modal-join-game');
  const btnConfirmCreate = document.getElementById('btn-confirm-create');
  const btnConfirmJoin = document.getElementById('btn-confirm-join');
  const joinCodeInput = document.getElementById('join-room-code-input');
  const joinPlayerNameInput = document.getElementById('join-player-name-input');

  // Waiting Screen Elements
  const displayRoomCode = document.getElementById('display-room-code');
  const btnCopyCode = document.getElementById('btn-copy-code');
  const btnCopyLink = document.getElementById('btn-copy-link');
  const inviteLinkInput = document.getElementById('invite-link-input');
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
  const headerMySecret = document.getElementById('header-my-secret');
  const colMySecret = document.getElementById('col-my-secret');
  const btnToggleScratchpad = document.getElementById('btn-toggle-scratchpad');
  const scratchpadPanel = document.getElementById('scratchpad-panel');
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

  // Match Review Breakdown Elements
  const btnTabMyReview = document.getElementById('btn-tab-my-review');
  const btnTabOppReview = document.getElementById('btn-tab-opp-review');
  const btnTabBothReview = document.getElementById('btn-tab-both-review');
  const reviewMyCount = document.getElementById('review-my-count');
  const reviewOppCount = document.getElementById('review-opp-count');
  const reviewTargetCode = document.getElementById('review-target-code');
  const reviewTargetBanner = document.getElementById('review-target-banner');
  const reviewList = document.getElementById('review-list');
  const btnViewBoard = document.getElementById('btn-view-board');

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
    initSocketHandlers();
    initModals();
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
      if (joinPlayerNameInput) joinPlayerNameInput.value = state.playerName;
    }
    playerNameInput.addEventListener('input', (e) => {
      state.playerName = e.target.value.trim().slice(0, 16);
      localStorage.setItem('gtn_player_name', state.playerName);
      if (joinPlayerNameInput) joinPlayerNameInput.value = state.playerName;
    });
    if (joinPlayerNameInput) {
      joinPlayerNameInput.addEventListener('input', (e) => {
        state.playerName = e.target.value.trim().slice(0, 16);
        localStorage.setItem('gtn_player_name', state.playerName);
        playerNameInput.value = state.playerName;
      });
    }
  }

  function initScratchpad() {
    state.scratchpad = new window.DigitScratchpad('scratchpad-keys');
    if (btnClearScratchpad) {
      btnClearScratchpad.addEventListener('click', () => {
        if (state.scratchpad) {
          state.scratchpad.reset();
          if (window.soundManager) window.soundManager.playDelete();
        }
      });
    }

    if (btnToggleScratchpad && scratchpadPanel) {
      btnToggleScratchpad.addEventListener('click', () => {
        scratchpadPanel.classList.toggle('hidden');
        const isVisible = !scratchpadPanel.classList.contains('hidden');
        btnToggleScratchpad.classList.toggle('active', isVisible);
        if (window.soundManager) window.soundManager.playTap();
      });
    }
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
    // Universal Desktop & PC Keyboard Listener (Top number row + Numpad)
    window.addEventListener('keydown', (e) => {
      // Do not intercept if user is typing in name or join-code inputs
      if (document.activeElement === playerNameInput || document.activeElement === joinCodeInput) {
        return;
      }

      const digit = getDigitFromKeyboardEvent(e);
      if (digit !== null) {
        e.preventDefault();
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
    // Intentionally no-op: prevents device software keyboard from popping up on mobile
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

    // Sync initial state from the DOM active button
    const initialActive = container.querySelector('.segment-btn.active');
    if (initialActive && onChange) {
      onChange(initialActive);
    }

    buttons.forEach(btn => {
      btn.addEventListener('click', () => {
        buttons.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        if (window.soundManager) window.soundManager.playTap();
        onChange(btn);
      });
    });
  }

  function syncSegmentedControlsFromConfig() {
    // Digits
    const digitBtns = document.querySelectorAll('#digits-selector .segment-btn');
    digitBtns.forEach(b => {
      b.classList.toggle('active', parseInt(b.dataset.digits, 10) === state.roomConfig.digitCount);
    });

    // Mode
    const modeBtns = document.querySelectorAll('#mode-selector .segment-btn');
    modeBtns.forEach(b => {
      b.classList.toggle('active', b.dataset.mode === state.roomConfig.mode);
    });

    // Duplicates
    const dupBtns = document.querySelectorAll('#duplicates-selector .segment-btn');
    dupBtns.forEach(b => {
      b.classList.toggle('active', (b.dataset.duplicates === 'true') === state.roomConfig.allowDuplicates);
    });

    // Timer
    const timerBtns = document.querySelectorAll('#timer-selector .segment-btn');
    const timerVal = state.roomConfig.timerEnabled ? state.roomConfig.timerSeconds : 0;
    timerBtns.forEach(b => {
      b.classList.toggle('active', parseInt(b.dataset.timer, 10) === timerVal);
    });
  }

  function openRematchModal() {
    state.isRematchConfig = true;
    modalCreateTitle.textContent = 'Rematch Settings';
    btnConfirmCreate.textContent = '🚀 Start Rematch';
    syncSegmentedControlsFromConfig();
    modalCreate.classList.remove('hidden');
    if (window.soundManager) window.soundManager.playTap();
  }

  async function copyTextToClipboard(text) {
    let copied = false;
    if (navigator.clipboard && window.isSecureContext) {
      try {
        await navigator.clipboard.writeText(text);
        copied = true;
      } catch (err) {
        console.warn('Clipboard write failed, attempting fallback', err);
      }
    }
    if (!copied) {
      try {
        const textArea = document.createElement('textarea');
        textArea.value = text;
        textArea.style.position = 'fixed';
        textArea.style.left = '-9999px';
        textArea.style.top = '0';
        textArea.setAttribute('readonly', '');
        document.body.appendChild(textArea);
        textArea.focus();
        textArea.select();
        copied = document.execCommand('copy');
        document.body.removeChild(textArea);
      } catch (err) {
        console.error('Fallback copy failed', err);
      }
    }
    return copied;
  }

  function initModals() {
    // Show modals
    btnShowCreate.addEventListener('click', () => {
      state.isCreatingAi = false;
      state.isRematchConfig = false;
      modalCreateTitle.textContent = 'Create Online Game';
      btnConfirmCreate.textContent = 'Start Online Room';
      syncSegmentedControlsFromConfig();
      modalCreate.classList.remove('hidden');
      if (window.soundManager) window.soundManager.playTap();
    });

    btnShowJoin.addEventListener('click', () => {
      modalJoin.classList.remove('hidden');
      const joinTitle = document.getElementById('modal-join-title');
      if (joinTitle) joinTitle.textContent = 'Join Online Game';
      if (joinPlayerNameInput) {
        joinPlayerNameInput.value = state.playerName || '';
      }
      joinCodeInput.focus();
      if (window.soundManager) window.soundManager.playTap();
    });

    btnPlayAi.addEventListener('click', () => {
      state.isCreatingAi = true;
      state.isRematchConfig = false;
      modalCreateTitle.textContent = 'Play vs Computer (AI)';
      btnConfirmCreate.textContent = 'Start Practice Match';
      syncSegmentedControlsFromConfig();
      modalCreate.classList.remove('hidden');
      if (window.soundManager) window.soundManager.playTap();
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

    // Confirm Create Game / AI Match / Rematch
    btnConfirmCreate.addEventListener('click', async () => {
      modalCreate.classList.add('hidden');
      if (state.isRematchConfig) {
        await requestRematch();
      } else {
        await createRoom(state.isCreatingAi);
      }
    });

    // Confirm Join Room
    btnConfirmJoin.addEventListener('click', async () => {
      if (joinPlayerNameInput && joinPlayerNameInput.value.trim()) {
        state.playerName = joinPlayerNameInput.value.trim().slice(0, 16);
        localStorage.setItem('gtn_player_name', state.playerName);
        if (playerNameInput) playerNameInput.value = state.playerName;
      }

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

    if (joinPlayerNameInput) {
      joinPlayerNameInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
          if (joinCodeInput.value.trim().length === 6) {
            btnConfirmJoin.click();
          } else {
            joinCodeInput.focus();
          }
        }
      });
    }

    // Copy Code / Link buttons
    btnCopyCode.addEventListener('click', async () => {
      if (state.roomCode) {
        await copyTextToClipboard(state.roomCode);
        showToast(`Game code ${state.roomCode} copied!`, 'success');
        if (window.soundManager) window.soundManager.playTap();
      }
    });

    btnCopyLink.addEventListener('click', async () => {
      if (!state.roomCode) return;
      const cleanOrigin = window.location.origin;
      const cleanPath = window.location.pathname === '/' ? '' : window.location.pathname.replace(/\/+$/, '');
      const url = `${cleanOrigin}${cleanPath}/?room=${state.roomCode}`;
      const shareText = `Play Guess The Number with me! Tap the link to join:\n${url}`;

      if (inviteLinkInput) inviteLinkInput.value = url;

      // Try native mobile share sheet (WhatsApp, Messages, AirDrop) if available
      if (navigator.share) {
        try {
          await navigator.share({
            title: 'Guess The Number',
            text: shareText,
            url: url
          });
          showToast('Invite link shared!', 'success');
          if (window.soundManager) window.soundManager.playTap();
          return;
        } catch (err) {
          if (err.name === 'AbortError') return;
        }
      }

      const success = await copyTextToClipboard(url);
      if (success) {
        showToast('Invite link copied to clipboard!', 'success');
      } else {
        if (inviteLinkInput) {
          inviteLinkInput.focus();
          inviteLinkInput.select();
        } else {
          window.prompt('Copy invite link:', url);
        }
      }
      if (window.soundManager) window.soundManager.playTap();
    });

    if (inviteLinkInput) {
      inviteLinkInput.addEventListener('click', async () => {
        inviteLinkInput.select();
        if (inviteLinkInput.value) {
          const success = await copyTextToClipboard(inviteLinkInput.value);
          if (success) showToast('Invite link copied!', 'success');
          if (window.soundManager) window.soundManager.playTap();
        }
      });
    }

    btnLeaveWaiting.addEventListener('click', () => {
      location.reload();
    });

    // Mobile Board Tabs (if present)
    if (tabMyBoard && tabOppBoard) {
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
    }

    // Lock in Secret Button
    btnLockSecret.addEventListener('click', () => {
      submitSecretNumber();
    });

    // Submit Guess Button (if present)
    if (btnSubmitGuess) {
      btnSubmitGuess.addEventListener('click', () => {
        submitCurrentGuess();
      });
    }

    // View Full Game Board Button
    if (btnViewBoard) {
      btnViewBoard.addEventListener('click', () => {
        switchScreen('game');
        if (specialNoticeBanner) {
          specialNoticeBanner.className = 'special-banner gameover-banner';
          specialNoticeBanner.innerHTML = `
            <span>🏁 Match Concluded</span>
            <button type="button" id="btn-back-to-results" class="btn btn-primary" style="padding: 2px 10px; font-size: 0.72rem; border-radius: 4px;">
              View Review & Rematch ➔
            </button>
          `;
          specialNoticeBanner.classList.remove('hidden');

          const btnBack = document.getElementById('btn-back-to-results');
          if (btnBack) {
            btnBack.addEventListener('click', () => {
              switchScreen('gameover');
            });
          }
        }
      });
    }

    // Play Again Button
    btnPlayAgain.addEventListener('click', () => {
      if (window.soundManager) window.soundManager.playTap();
      if (state.opponentRematchRequested) {
        requestRematch();
      } else {
        openRematchModal();
      }
    });

    btnReturnHome.addEventListener('click', () => {
      location.reload();
    });
  }

  function extractRoomCodeFromUrl() {
    try {
      const params = new URLSearchParams(window.location.search);
      let raw = params.get('room') || params.get('code') || params.get('r');

      if (!raw && window.location.hash) {
        const hashStr = window.location.hash.replace(/^#\/?/, '');
        const hashParams = new URLSearchParams(hashStr);
        raw = hashParams.get('room') || hashParams.get('code') || hashParams.get('r');
        if (!raw && /^[A-Za-z0-9]{6}$/.test(hashStr.trim())) {
          raw = hashStr.trim();
        }
      }

      if (!raw && window.location.search) {
        const searchStr = window.location.search.replace(/^\?/, '').trim();
        if (/^[A-Za-z0-9]{6}$/.test(searchStr)) {
          raw = searchStr;
        }
      }

      if (!raw) {
        const pathMatch = window.location.pathname.match(/\/(?:join|r|room)\/([A-Za-z0-9]{6})/i);
        if (pathMatch) raw = pathMatch[1];
      }

      if (!raw) {
        const match = window.location.href.match(/[?&#](?:room|code|r)=([A-Za-z0-9]{6})/i);
        if (match) raw = match[1];
      }

      if (raw) {
        const clean = raw.replace(/[^A-Za-z0-9]/g, '').trim().toUpperCase();
        if (clean.length === 6) {
          return clean;
        }
      }
    } catch (e) {
      console.warn('Error extracting room code from URL:', e);
    }
    return null;
  }

  async function checkUrlForRoom() {
    const code = extractRoomCodeFromUrl();
    if (!code) return;

    joinCodeInput.value = code;
    showToast(`Joining room ${code}...`, 'info', 3500);

    // Auto-join room immediately without forcing user to manually submit forms
    await joinRoom(code);

    // Clean up URL once joined successfully
    if (state.roomCode) {
      try {
        window.history.replaceState({}, document.title, window.location.pathname);
      } catch (e) {}
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
    const name = (state.playerName && state.playerName.trim()) ? state.playerName : 'Player 2';
    const res = await window.socketClient.joinRoom({ roomCode: code, playerName: name });

    if (!res.success) {
      showToast(res.error || 'Failed to join room', 'error', 4500);
      if (window.soundManager) window.soundManager.playError();
      const joinTitle = document.getElementById('modal-join-title');
      if (joinTitle) joinTitle.textContent = `Join Game (${code})`;
      modalJoin.classList.remove('hidden');
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

    const cleanOrigin = window.location.origin;
    const cleanPath = window.location.pathname === '/' ? '' : window.location.pathname.replace(/\/+$/, '');
    const url = `${cleanOrigin}${cleanPath}/?room=${code}`;
    if (inviteLinkInput) inviteLinkInput.value = url;

    // Update rules summary chips
    waitingRulesSummary.innerHTML = `
      <span class="rule-pill">${state.roomConfig.digitCount} Digits</span>
      <span class="rule-pill">${state.roomConfig.mode === 'exact' ? 'Exact Matches' : 'Bulls & Cows'}</span>
      <span class="rule-pill">${state.roomConfig.allowDuplicates ? 'Duplicates OK' : 'Unique Digits'}</span>
      <span class="rule-pill">${state.roomConfig.timerEnabled ? state.roomConfig.timerSeconds + 's Timer' : 'No Timer'}</span>
    `;

    switchScreen('waiting');
  }

  function updateSecretDisplays() {
    const secret = state.mySecret || '----';
    if (headerMySecret) headerMySecret.textContent = secret;
    if (colMySecret) colMySecret.textContent = secret;
  }

  function startSetupPhase(players) {
    const count = state.roomConfig.digitCount;
    state.secretDigits = new Array(count).fill('');
    state.secretBoxIndex = 0;
    state.mySecret = null;
    updateSecretDisplays();

    btnLockSecret.disabled = true;
    btnLockSecret.textContent = '🔒 Lock In Secret Number';
    secretValidationMsg.textContent = '';
    secretValidationMsg.className = 'validation-msg';

    const dupText = state.roomConfig.allowDuplicates ? 'Duplicates allowed' : 'Must be unique digits';
    setupRulesDesc.textContent = `Pick a ${count}-digit secret code (${dupText}). Opponent will try to crack this!`;

    renderDigitBoxes(secretBoxesContainer, count, state.secretDigits, state.secretBoxIndex, onSelectSecretBox);
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
  function onSelectSecretBox(idx) {
    state.secretBoxIndex = idx;
    renderDigitBoxes(secretBoxesContainer, state.roomConfig.digitCount, state.secretDigits, state.secretBoxIndex, onSelectSecretBox);
  }

  function onSelectGuessBox(idx) {
    state.activeBoxIndex = idx;
    renderDigitBoxes(guessBoxesContainer, state.roomConfig.digitCount, state.guessDigits, state.activeBoxIndex, onSelectGuessBox);
  }

  function renderDigitBoxes(container, count, digits, activeIndex, onSelectBox) {
    container.innerHTML = '';
    for (let i = 0; i < count; i++) {
      const box = document.createElement('div');
      box.className = 'digit-box';
      const val = digits[i] !== undefined && digits[i] !== null ? digits[i] : '';
      box.textContent = val;

      if (val !== '') {
        box.classList.add('filled');
      }
      if (i === activeIndex) {
        box.classList.add('active');
      }

      box.addEventListener('click', (e) => {
        e.stopPropagation();
        if (onSelectBox) {
          onSelectBox(i);
        }
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
      const count = state.roomConfig.digitCount;
      // If duplicates not allowed, check other boxes
      if (!state.roomConfig.allowDuplicates) {
        const existingIdx = state.secretDigits.indexOf(digit);
        if (existingIdx !== -1 && existingIdx !== state.secretBoxIndex) {
          showSecretError('Duplicate digits not allowed for this room');
          if (window.soundManager) window.soundManager.playError();
          return;
        }
      }

      state.secretDigits[state.secretBoxIndex] = digit;
      if (window.soundManager) window.soundManager.playDigit();

      // Find next unfilled slot or advance to next slot
      let nextIdx = (state.secretBoxIndex + 1) % count;
      for (let step = 1; step < count; step++) {
        const candidate = (state.secretBoxIndex + step) % count;
        if (state.secretDigits[candidate] === '') {
          nextIdx = candidate;
          break;
        }
      }
      state.secretBoxIndex = nextIdx;

      renderDigitBoxes(secretBoxesContainer, count, state.secretDigits, state.secretBoxIndex, onSelectSecretBox);
      validateSecretInput();

    } else if (state.gameState === 'game' || state.gameState === 'playing') {
      // Keying numbers allowed anytime, even during opponent's turn!
      // Guesses are never restricted to unique digits even in unique mode.
      const count = state.roomConfig.digitCount;
      state.guessDigits[state.activeBoxIndex] = digit;
      if (window.soundManager) window.soundManager.playDigit();

      // Find next unfilled slot or advance to next slot
      let nextIdx = (state.activeBoxIndex + 1) % count;
      for (let step = 1; step < count; step++) {
        const candidate = (state.activeBoxIndex + step) % count;
        if (state.guessDigits[candidate] === '') {
          nextIdx = candidate;
          break;
        }
      }
      state.activeBoxIndex = nextIdx;

      renderDigitBoxes(guessBoxesContainer, count, state.guessDigits, state.activeBoxIndex, onSelectGuessBox);
      updateSubmitButtonState();
    }
  }

  function handleBackspace() {
    if (state.gameState === 'setup') {
      const count = state.roomConfig.digitCount;
      if (state.secretDigits[state.secretBoxIndex] !== '') {
        state.secretDigits[state.secretBoxIndex] = '';
      } else {
        state.secretBoxIndex = state.secretBoxIndex > 0 ? state.secretBoxIndex - 1 : 0;
        state.secretDigits[state.secretBoxIndex] = '';
      }
      if (window.soundManager) window.soundManager.playDelete();
      renderDigitBoxes(secretBoxesContainer, count, state.secretDigits, state.secretBoxIndex, onSelectSecretBox);
      validateSecretInput();

    } else if (state.gameState === 'game' || state.gameState === 'playing') {
      const count = state.roomConfig.digitCount;
      if (state.guessDigits[state.activeBoxIndex] !== '') {
        state.guessDigits[state.activeBoxIndex] = '';
      } else {
        state.activeBoxIndex = state.activeBoxIndex > 0 ? state.activeBoxIndex - 1 : 0;
        state.guessDigits[state.activeBoxIndex] = '';
      }
      if (window.soundManager) window.soundManager.playDelete();
      renderDigitBoxes(guessBoxesContainer, count, state.guessDigits, state.activeBoxIndex, onSelectGuessBox);
      updateSubmitButtonState();
    }
  }

  function handleClear() {
    const count = state.roomConfig.digitCount;
    if (state.gameState === 'setup') {
      state.secretDigits = new Array(count).fill('');
      state.secretBoxIndex = 0;
      if (window.soundManager) window.soundManager.playDelete();
      renderDigitBoxes(secretBoxesContainer, count, state.secretDigits, state.secretBoxIndex, onSelectSecretBox);
      validateSecretInput();

    } else if (state.gameState === 'game' || state.gameState === 'playing') {
      state.guessDigits = new Array(count).fill('');
      state.activeBoxIndex = 0;
      if (window.soundManager) window.soundManager.playDelete();
      renderDigitBoxes(guessBoxesContainer, count, state.guessDigits, state.activeBoxIndex, onSelectGuessBox);
      updateSubmitButtonState();
    }
  }

  function handleEnter() {
    if (state.gameState === 'setup' && !btnLockSecret.disabled) {
      submitSecretNumber();
    } else if ((state.gameState === 'game' || state.gameState === 'playing') && state.isMyTurn && btnSubmitGuess && !btnSubmitGuess.disabled) {
      submitCurrentGuess();
    }
  }

  /* ==========================================================================
     Secret Validation & Submission
     ========================================================================== */
  function validateSecretInput() {
    const count = state.roomConfig.digitCount;
    const filledCount = state.secretDigits.filter(d => d !== '').length;
    if (filledCount < count) {
      secretValidationMsg.textContent = `${count - filledCount} digit(s) remaining...`;
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
    updateSecretDisplays();

    if (window.soundManager) window.soundManager.playSuccess();
    showToast('Secret code locked in!', 'success');
    btnLockSecret.textContent = '✅ Locked In';

    // Disable numpad in setup
    setupNumpad.querySelectorAll('button').forEach(b => b.disabled = true);

    // Instant transition if server started game (e.g. AI mode)
    if (res.gameStarted && res.gameStartedData) {
      startGamePhase(res.gameStartedData);
    }
  }

  /* ==========================================================================
     Active Game Phase
     ========================================================================== */
  function startGamePhase(data) {
    if (state.gameState === 'game') return; // Prevent double transition
    const count = state.roomConfig.digitCount;
    state.guesses.my = [];
    state.guesses.opp = [];
    state.guessDigits = new Array(count).fill('');
    state.activeBoxIndex = 0;
    state.seenGuesses = new Set();

    // Header info
    gameCodeChip.textContent = state.roomCode;
    gameModeChip.textContent = state.roomConfig.mode === 'exact' ? 'Exact' : 'Bulls & Cows';
    updateSecretDisplays();

    // Digit Tracker switched off by default
    if (scratchpadPanel) {
      scratchpadPanel.classList.add('hidden');
    }
    if (btnToggleScratchpad) {
      btnToggleScratchpad.classList.remove('active');
    }

    if (state.roomConfig.timerEnabled) {
      gameTimerContainer.style.display = 'flex';
      timerText.textContent = data.timerSeconds || 90;
    } else {
      gameTimerContainer.style.display = 'none';
    }

    myHistoryList.innerHTML = '<div class="empty-history-placeholder">No guesses yet</div>';
    oppHistoryList.innerHTML = '<div class="empty-history-placeholder">No guesses yet</div>';
    countMyGuesses.textContent = '0';
    countOppGuesses.textContent = '0';

    specialNoticeBanner.classList.add('hidden');
    specialNoticeBanner.textContent = '';

    renderDigitBoxes(guessBoxesContainer, count, state.guessDigits, state.activeBoxIndex, onSelectGuessBox);
    renderNumpad(gameNumpad);

    if (state.scratchpad) state.scratchpad.reset();

    updateTurnUI(data.currentTurnIndex);
    switchScreen('game');
  }

  function updateTurnUI(activePlayerIndex) {
    state.isMyTurn = activePlayerIndex === state.playerIndex;
    updateSubmitButtonState();

    // Numpad is ALWAYS active so the player can key in numbers anytime (even during opponent's turn)
    gameNumpad.querySelectorAll('button').forEach(b => {
      b.disabled = false;
    });

    if (state.isMyTurn) {
      turnBanner.className = 'turn-banner my-turn slim-turn-banner';
      turnBannerIcon.textContent = '🎯';
      turnBannerText.textContent = 'Your Turn! Guess opponent\'s number';
      if (window.soundManager) window.soundManager.playTurn();
    } else {
      turnBanner.className = 'turn-banner opp-turn slim-turn-banner';
      turnBannerIcon.textContent = '⏳';
      turnBannerText.textContent = `Opponent's Turn... Key in your next guess`;
    }
  }

  function updateSubmitButtonState() {
    if (!btnSubmitGuess) return;
    const count = state.roomConfig.digitCount;
    const filledCount = state.guessDigits.filter(d => d !== '').length;
    const isFull = filledCount === count;

    if (!isFull) {
      btnSubmitGuess.disabled = true;
      const remaining = count - filledCount;
      btnSubmitGuess.textContent = `Enter ${remaining} Digit${remaining > 1 ? 's' : ''}`;
    } else if (!state.isMyTurn) {
      btnSubmitGuess.disabled = true;
      btnSubmitGuess.textContent = `Opponent's Turn...`;
    } else {
      btnSubmitGuess.disabled = false;
      btnSubmitGuess.textContent = `🚀 Submit Guess`;
    }
  }

  async function submitCurrentGuess() {
    if (!state.isMyTurn) return;
    const count = state.roomConfig.digitCount;
    const filledCount = state.guessDigits.filter(d => d !== '').length;
    if (filledCount !== count) return;

    const guess = state.guessDigits.join('');
    if (btnSubmitGuess) {
      btnSubmitGuess.disabled = true;
      btnSubmitGuess.textContent = 'Submitting...';
    }

    // Immediately clear guess inputs
    state.guessDigits = new Array(count).fill('');
    state.activeBoxIndex = 0;
    renderDigitBoxes(guessBoxesContainer, count, state.guessDigits, state.activeBoxIndex, onSelectGuessBox);
    updateSubmitButtonState();

    const res = await window.socketClient.submitGuess(guess);
    if (!res.success) {
      showToast(res.error || 'Failed to submit guess', 'error');
      if (window.soundManager) window.soundManager.playError();
      updateSubmitButtonState();
      return;
    }

    // Instantly display guess on our board without waiting for broadcast
    if (res.guessRecord) {
      addGuessToBoard(res.guessRecord);
    }
  }

  function addGuessToBoard(guessRecord) {
    if (!guessRecord) return;

    // Deduplication check
    const guessKey = `${guessRecord.playerIndex}_${guessRecord.turnNumber}_${guessRecord.guess}`;
    if (!state.seenGuesses) state.seenGuesses = new Set();
    if (state.seenGuesses.has(guessKey)) {
      return;
    }
    state.seenGuesses.add(guessKey);

    const isMine = guessRecord.playerIndex === state.playerIndex;
    const targetList = isMine ? myHistoryList : oppHistoryList;
    const countBadge = isMine ? countMyGuesses : countOppGuesses;
    const listArray = isMine ? state.guesses.my : state.guesses.opp;

    listArray.push(guessRecord);
    if (countBadge) countBadge.textContent = listArray.length;

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

    // Append in chronological order and auto-scroll to latest!
    targetList.appendChild(row);
    targetList.scrollTop = targetList.scrollHeight;

    if (isMine) {
      if (guessRecord.feedback.isWin) {
        if (window.soundManager) window.soundManager.playSuccess();
      } else {
        if (window.soundManager) window.soundManager.playTap();
      }
    }
  }

  /* ==========================================================================
     Post-Game Analysis & Guess Breakdown
     ========================================================================== */
  function analyzeGuessAgainstSecret(guess, targetSecret, mode) {
    if (!targetSecret) return [];
    const result = [];
    const secretLen = targetSecret.length;

    // Remaining occurrences of each character in secret
    const secretRemaining = {};
    for (let i = 0; i < secretLen; i++) {
      const ch = targetSecret[i];
      secretRemaining[ch] = (secretRemaining[ch] || 0) + 1;
    }

    // Step 1: Mark exact matches
    const isExact = new Array(guess.length).fill(false);
    for (let i = 0; i < guess.length; i++) {
      if (i < secretLen && guess[i] === targetSecret[i]) {
        isExact[i] = true;
        secretRemaining[guess[i]]--;
      }
    }

    // Step 2: Mark remaining digits (wrong-pos vs miss)
    for (let i = 0; i < guess.length; i++) {
      const digit = guess[i];
      if (isExact[i]) {
        result.push({ digit, status: 'exact', label: 'Correct position' });
      } else if (secretRemaining[digit] > 0) {
        secretRemaining[digit]--;
        result.push({ digit, status: 'wrong-pos', label: 'In code, wrong position' });
      } else {
        result.push({ digit, status: 'miss', label: 'Not in secret code' });
      }
    }

    return result;
  }

  function renderGuessReviewItem(guessRecord, targetSecret, mode) {
    const item = document.createElement('div');
    const isWin = Boolean(guessRecord.feedback && guessRecord.feedback.isWin);
    item.className = `review-guess-item ${isWin ? 'winning-guess' : ''}`;

    const analyzedDigits = analyzeGuessAgainstSecret(guessRecord.guess, targetSecret, mode);

    let digitsHtml = '';
    analyzedDigits.forEach(d => {
      const cls = d.status === 'exact' ? 'digit-exact' : d.status === 'wrong-pos' ? 'digit-wrong-pos' : 'digit-miss';
      digitsHtml += `<span class="digit-chip ${cls}" title="${d.digit}: ${d.label}">${d.digit}</span>`;
    });

    let badgesHtml = '';
    if (guessRecord.feedback.mode === 'exact') {
      badgesHtml = `<span class="badge-feedback badge-exact">${guessRecord.feedback.exact} Exact</span>`;
    } else {
      badgesHtml = `
        <span class="badge-feedback badge-bulls">${guessRecord.feedback.bulls}B</span>
        <span class="badge-feedback badge-cows">${guessRecord.feedback.cows}C</span>
      `;
    }

    if (isWin) {
      badgesHtml += `<span class="win-badge-tag">🏆 CRACKED!</span>`;
    }

    item.innerHTML = `
      <div class="review-guess-left">
        <span class="review-turn-num">#${guessRecord.turnNumber}</span>
        <div class="review-digits-chips">${digitsHtml}</div>
      </div>
      <div class="review-feedback-badges">${badgesHtml}</div>
    `;

    return item;
  }

  function renderGameOverReview(mySecret, oppSecret) {
    if (!reviewList) return;

    let currentReviewTab = 'my';
    if (reviewMyCount) reviewMyCount.textContent = state.guesses.my.length;
    if (reviewOppCount) reviewOppCount.textContent = state.guesses.opp.length;

    function updateReviewDisplay() {
      reviewList.innerHTML = '';

      if (currentReviewTab === 'my') {
        if (reviewTargetBanner) {
          reviewTargetBanner.style.display = 'block';
          reviewTargetBanner.innerHTML = `🎯 Opponent's Secret Code to Crack: <b id="review-target-code">${oppSecret || '----'}</b>`;
        }

        if (state.guesses.my.length === 0) {
          reviewList.innerHTML = '<div class="empty-history-placeholder">No guesses were made.</div>';
          return;
        }

        state.guesses.my.forEach(g => {
          reviewList.appendChild(renderGuessReviewItem(g, oppSecret, state.roomConfig.mode));
        });
      } else if (currentReviewTab === 'opp') {
        if (reviewTargetBanner) {
          reviewTargetBanner.style.display = 'block';
          reviewTargetBanner.innerHTML = `🛡️ Your Secret Code (Attacked): <b id="review-target-code">${mySecret || '----'}</b>`;
        }

        if (state.guesses.opp.length === 0) {
          reviewList.innerHTML = '<div class="empty-history-placeholder">Opponent made no guesses.</div>';
          return;
        }

        state.guesses.opp.forEach(g => {
          reviewList.appendChild(renderGuessReviewItem(g, mySecret, state.roomConfig.mode));
        });
      } else {
        // Both side-by-side
        if (reviewTargetBanner) {
          reviewTargetBanner.style.display = 'none';
        }

        const grid = document.createElement('div');
        grid.className = 'review-both-grid';

        const colMy = document.createElement('div');
        colMy.innerHTML = `
          <div class="review-col-title">
            <span>🎯 You (${oppSecret || '----'})</span>
            <span>${state.guesses.my.length}</span>
          </div>
        `;
        const listMy = document.createElement('div');
        listMy.className = 'review-sublist';
        if (state.guesses.my.length === 0) {
          listMy.innerHTML = '<div class="empty-history-placeholder">None</div>';
        } else {
          state.guesses.my.forEach(g => listMy.appendChild(renderGuessReviewItem(g, oppSecret, state.roomConfig.mode)));
        }
        colMy.appendChild(listMy);

        const colOpp = document.createElement('div');
        colOpp.innerHTML = `
          <div class="review-col-title">
            <span>🛡️ Opponent (${mySecret || '----'})</span>
            <span>${state.guesses.opp.length}</span>
          </div>
        `;
        const listOpp = document.createElement('div');
        listOpp.className = 'review-sublist';
        if (state.guesses.opp.length === 0) {
          listOpp.innerHTML = '<div class="empty-history-placeholder">None</div>';
        } else {
          state.guesses.opp.forEach(g => listOpp.appendChild(renderGuessReviewItem(g, mySecret, state.roomConfig.mode)));
        }
        colOpp.appendChild(listOpp);

        grid.appendChild(colMy);
        grid.appendChild(colOpp);
        reviewList.appendChild(grid);
      }
    }

    if (btnTabMyReview) {
      btnTabMyReview.onclick = () => {
        currentReviewTab = 'my';
        btnTabMyReview.classList.add('active');
        if (btnTabOppReview) btnTabOppReview.classList.remove('active');
        if (btnTabBothReview) btnTabBothReview.classList.remove('active');
        updateReviewDisplay();
      };
    }

    if (btnTabOppReview) {
      btnTabOppReview.onclick = () => {
        currentReviewTab = 'opp';
        btnTabOppReview.classList.add('active');
        if (btnTabMyReview) btnTabMyReview.classList.remove('active');
        if (btnTabBothReview) btnTabBothReview.classList.remove('active');
        updateReviewDisplay();
      };
    }

    if (btnTabBothReview) {
      btnTabBothReview.onclick = () => {
        currentReviewTab = 'both';
        btnTabBothReview.classList.add('active');
        if (btnTabMyReview) btnTabMyReview.classList.remove('active');
        if (btnTabOppReview) btnTabOppReview.classList.remove('active');
        updateReviewDisplay();
      };
    }

    if (btnTabMyReview) btnTabMyReview.click();
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
    const mySecret = isPlayer0 ? secrets.player0.secret : secrets.player1.secret;
    const oppSecret = isPlayer0 ? secrets.player1.secret : secrets.player0.secret;
    revealMyVal.textContent = mySecret;
    revealOppVal.textContent = oppSecret;

    statRounds.textContent = totalRounds;
    statGuesses.textContent = state.guesses.my.length;

    state.opponentRematchRequested = false;
    rematchWaitingNotice.classList.add('hidden');
    btnPlayAgain.disabled = false;
    btnPlayAgain.classList.remove('btn-pulse');
    btnPlayAgain.textContent = '🔄 Play Again (Rematch)';

    // Populate Match Review Breakdown
    renderGameOverReview(mySecret, oppSecret);

    if (window.soundManager) window.soundManager.playGameOver(isWin);
    switchScreen('gameover');
  }

  async function requestRematch() {
    btnPlayAgain.disabled = true;
    btnPlayAgain.classList.remove('btn-pulse');
    btnPlayAgain.textContent = 'Waiting for opponent...';
    rematchWaitingNotice.classList.remove('hidden');

    const res = await window.socketClient.requestRematch({
      roomConfig: {
        digitCount: state.roomConfig.digitCount,
        mode: state.roomConfig.mode,
        allowDuplicates: state.roomConfig.allowDuplicates,
        timerEnabled: state.roomConfig.timerEnabled,
        timerSeconds: state.roomConfig.timerSeconds
      }
    });

    if (!res.success) {
      showToast(res.error || 'Failed to request rematch', 'error');
      btnPlayAgain.disabled = false;
      btnPlayAgain.textContent = '🔄 Play Again (Rematch)';
      rematchWaitingNotice.classList.add('hidden');
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
      state.opponentRematchRequested = false;
      if (data.roomConfig) {
        state.roomConfig = { ...state.roomConfig, ...data.roomConfig };
      }
      startSetupPhase(data.players);
    });

    window.socketClient.on('rematch_requested_notice', (data) => {
      if (data.playerIndex !== state.playerIndex) {
        state.opponentRematchRequested = true;
        if (data.roomConfig) {
          state.roomConfig = { ...state.roomConfig, ...data.roomConfig };
        }
        const modeLabel = state.roomConfig.mode === 'exact' ? 'Exact' : 'Bulls & Cows';
        btnPlayAgain.disabled = false;
        btnPlayAgain.innerHTML = `⚡ Accept Rematch (${data.playerName})<br><small style="font-size: 0.72rem; opacity: 0.9;">${state.roomConfig.digitCount}D • ${modeLabel}</small>`;
        btnPlayAgain.classList.add('btn-pulse');
        showToast(`${data.playerName} requested a rematch (${state.roomConfig.digitCount} Digits, ${modeLabel})! Tap Accept Rematch to start!`, 'info', 6000);
      }
    });

    window.socketClient.on('player_left', (data) => {
      showToast(data.message, 'error', 4000);
    });

    window.socketClient.on('connect', async () => {
      // Re-attach socket to existing room if reconnecting after app switch
      if (state.roomCode && state.gameState !== 'home') {
        const res = await window.socketClient.joinRoom({
          roomCode: state.roomCode,
          playerName: state.playerName,
          playerIndex: state.playerIndex
        });
        if (res && res.success) {
          if (res.state === 'setup' && state.gameState === 'waiting') {
            startSetupPhase(res.players);
          }
        }
      }
    });
  }

  // Initialize on DOM load
  document.addEventListener('DOMContentLoaded', init);
})();
