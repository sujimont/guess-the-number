/**
 * AI Opponent for Solo Play in "Guess The Number & Word"
 */
const { validateNumber, evaluateGuess, generateRandomNumber, generateRandomSecret } = require('./gameLogic');
const dictionary = require('./dictionary');

class AIOpponent {
  /**
   * @param {Object} options
   * @param {number} options.digitCount
   * @param {'exact' | 'bulls_and_cows'} options.mode
   * @param {boolean} options.allowDuplicates
   * @param {'number' | 'word'} [options.gameType]
   */
  constructor(options) {
    this.name = 'RoboGuesser (AI)';
    this.digitCount = options.digitCount || 4;
    this.mode = options.mode || 'bulls_and_cows';
    this.allowDuplicates = Boolean(options.allowDuplicates);
    this.gameType = options.gameType === 'word' ? 'word' : 'number';

    this.secret = generateRandomSecret(this.digitCount, this.allowDuplicates, this.gameType);
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
    if (this.gameType === 'word') {
      return this.makeWordGuess();
    }
    return this.makeNumberGuess();
  }

  /**
   * Generates AI guess for Word mode.
   * @returns {string}
   */
  makeWordGuess() {
    const commonPool = dictionary.getCommonWords(this.digitCount, this.allowDuplicates);

    // Opening guess
    if (this.history.length === 0) {
      const starters = this.digitCount === 5 ? ['ROAST', 'SLATE', 'CRANE'] : ['LION', 'ROSE', 'PARK'];
      for (const starter of starters) {
        if (dictionary.isValidWord(starter, this.digitCount) &&
            (this.allowDuplicates || dictionary.hasUniqueLetters(starter))) {
          this.testedGuesses.add(starter);
          return starter;
        }
      }
    }

    // Shuffle common words to add variety to AI play
    const shuffled = [...commonPool];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }

    for (const candidate of shuffled) {
      if (this.testedGuesses.has(candidate)) continue;
      if (this.isConsistent(candidate)) {
        this.testedGuesses.add(candidate);
        return candidate;
      }
    }

    // Fallback: any common word not yet tested
    for (const candidate of shuffled) {
      if (!this.testedGuesses.has(candidate)) {
        this.testedGuesses.add(candidate);
        return candidate;
      }
    }

    const fallback = dictionary.getRandomSecret(this.digitCount, this.allowDuplicates);
    this.testedGuesses.add(fallback);
    return fallback;
  }

  /**
   * Generates AI guess for Number mode.
   * @returns {string}
   */
  makeNumberGuess() {
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
