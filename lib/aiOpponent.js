/**
 * AI Opponent for Solo Play in "Guess The Number"
 */
const { validateNumber, evaluateGuess, generateRandomNumber } = require('./gameLogic');

class AIOpponent {
  /**
   * @param {Object} options
   * @param {number} options.digitCount
   * @param {'exact' | 'bulls_and_cows'} options.mode
   * @param {boolean} options.allowDuplicates
   */
  constructor(options) {
    this.name = 'RoboGuesser (AI)';
    this.digitCount = options.digitCount || 4;
    this.mode = options.mode || 'bulls_and_cows';
    this.allowDuplicates = Boolean(options.allowDuplicates);

    this.secret = generateRandomNumber(this.digitCount, this.allowDuplicates);
    this.history = []; // Array of { guess, feedback }
    this.testedGuesses = new Set();
  }

  /**
   * Checks if candidate is consistent with all previous clues in history.
   * @param {string} candidate
   * @returns {boolean}
   */
  isConsistent(candidate) {
    for (const entry of this.history) {
      const simulated = evaluateGuess(candidate, entry.guess, this.mode);
      if (this.mode === 'exact') {
        if (simulated.exact !== entry.feedback.exact) return false;
      } else {
        if (simulated.bulls !== entry.feedback.bulls || simulated.cows !== entry.feedback.cows) {
          return false;
        }
      }
    }
    return true;
  }

  /**
   * Generates the AI's next guess.
   * @returns {string}
   */
  makeGuess() {
    // Opening guess
    if (this.history.length === 0) {
      const opening = this.digitCount === 4 ? '1234' : '12345';
      const validation = validateNumber(opening, this.digitCount, this.allowDuplicates);
      if (validation.valid) {
        this.testedGuesses.add(opening);
        return opening;
      }
    }

    // Try finding a candidate that matches all previous clues
    const MAX_ATTEMPTS = 3000;
    for (let i = 0; i < MAX_ATTEMPTS; i++) {
      const candidate = generateRandomNumber(this.digitCount, this.allowDuplicates);
      if (this.testedGuesses.has(candidate)) continue;

      if (this.isConsistent(candidate)) {
        this.testedGuesses.add(candidate);
        return candidate;
      }
    }

    // Fallback if no consistent candidate found within limit
    let fallback = generateRandomNumber(this.digitCount, this.allowDuplicates);
    let guard = 0;
    while (this.testedGuesses.has(fallback) && guard < 100) {
      fallback = generateRandomNumber(this.digitCount, this.allowDuplicates);
      guard++;
    }
    this.testedGuesses.add(fallback);
    return fallback;
  }

  /**
   * Records the feedback received for the AI's guess.
   * @param {string} guess
   * @param {Object} feedback
   */
  recordFeedback(guess, feedback) {
    this.history.push({ guess, feedback });
  }
}

module.exports = AIOpponent;
