/**
 * Interactive Digit Deduction Scratchpad (0 through 9)
 */
class DigitScratchpad {
  constructor(containerId) {
    this.container = document.getElementById(containerId);
    this.states = new Array(10).fill('neutral'); // 0-9 states: 'neutral' | 'confirmed' | 'eliminated'
    this.render();
  }

  render() {
    if (!this.container) return;
    this.container.innerHTML = '';

    for (let digit = 0; digit <= 9; digit++) {
      const pill = document.createElement('button');
      pill.type = 'button';
      pill.className = `scratchpad-pill state-${this.states[digit]}`;
      pill.textContent = digit;
      pill.setAttribute('aria-label', `Digit ${digit}: ${this.states[digit]}`);

      pill.addEventListener('click', () => {
        this.cycleState(digit);
        if (window.soundManager) window.soundManager.playTap();
      });

      this.container.appendChild(pill);
    }
  }

  cycleState(digit) {
    const current = this.states[digit];
    if (current === 'neutral') {
      this.states[digit] = 'confirmed';
    } else if (current === 'confirmed') {
      this.states[digit] = 'eliminated';
    } else {
      this.states[digit] = 'neutral';
    }
    this.render();
  }

  reset() {
    this.states.fill('neutral');
    this.render();
  }
}

window.DigitScratchpad = DigitScratchpad;
