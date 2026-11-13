/**
 * Sound Manager using Web Audio API for zero-dependency sound effects
 */
class SoundManager {
  constructor() {
    this.enabled = localStorage.getItem('gtn_sound_enabled') !== 'false';
    this.audioCtx = null;
  }

  initContext() {
    if (!this.audioCtx) {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      if (AudioContext) {
        this.audioCtx = new AudioContext();
      }
    }
    if (this.audioCtx && this.audioCtx.state === 'suspended') {
      this.audioCtx.resume();
    }
  }

  toggle() {
    this.enabled = !this.enabled;
    localStorage.setItem('gtn_sound_enabled', this.enabled ? 'true' : 'false');
    if (this.enabled) {
      this.initContext();
      this.playTap();
    }
    return this.enabled;
  }

  playTone(freq, type = 'sine', duration = 0.08, gainVal = 0.12) {
    if (!this.enabled) return;
    try {
      this.initContext();
      if (!this.audioCtx) return;

      const osc = this.audioCtx.createOscillator();
      const gain = this.audioCtx.createGain();

      osc.type = type;
      osc.frequency.setValueAtTime(freq, this.audioCtx.currentTime);

      gain.gain.setValueAtTime(gainVal, this.audioCtx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.0001, this.audioCtx.currentTime + duration);

      osc.connect(gain);
      gain.connect(this.audioCtx.destination);

      osc.start();
      osc.stop(this.audioCtx.currentTime + duration);
    } catch (e) {
      // Audio autoplay policy catch
    }
  }

  playTap() {
    this.playTone(600, 'sine', 0.04, 0.08);
  }

  playDigit() {
    this.playTone(750, 'triangle', 0.06, 0.1);
  }

  playDelete() {
    this.playTone(320, 'sine', 0.05, 0.08);
  }

  playError() {
    if (!this.enabled) return;
    this.playTone(200, 'sawtooth', 0.12, 0.15);
  }

  playTurn() {
    if (!this.enabled) return;
    this.playTone(523.25, 'sine', 0.08, 0.12); // C5
    setTimeout(() => this.playTone(659.25, 'sine', 0.12, 0.12), 90); // E5
  }

  playSuccess() {
    if (!this.enabled) return;
    const notes = [523.25, 659.25, 783.99, 1046.50]; // C5, E5, G5, C6
    notes.forEach((freq, idx) => {
      setTimeout(() => this.playTone(freq, 'triangle', 0.15, 0.15), idx * 100);
    });
  }

  playGameOver(isWin) {
    if (!this.enabled) return;
    if (isWin) {
      this.playSuccess();
    } else {
      this.playTone(350, 'sawtooth', 0.2, 0.15);
      setTimeout(() => this.playTone(280, 'sawtooth', 0.3, 0.15), 180);
    }
  }

  playTick() {
    this.playTone(880, 'sine', 0.03, 0.06);
  }
}

window.soundManager = new SoundManager();
