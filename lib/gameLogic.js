/**
 * Game logic and evaluation engine for "Guess The Number & Word"
 */
const dictionary = require('./dictionary');

/**
 * Validates whether a number string meets the game rules.
 * @param {string} numberStr - The digit string to validate.
 * @param {number} digitCount - 4 or 5.
 * @param {boolean} allowDuplicates - Whether duplicate digits are allowed.
 * @returns {{ valid: boolean, error: string | null }}
 */
function validateNumber(numberStr, digitCount, allowDuplicates) {
  if (typeof numberStr !== 'string') {
    return { valid: false, error: 'Input must be a string of digits.' };
  }

  const trimmed = numberStr.trim();
  if (trimmed.length !== digitCount) {
    return { valid: false, error: `Number must be exactly ${digitCount} digits.` };
  }

  if (!/^\d+$/.test(trimmed)) {
    return { valid: false, error: 'Number can only contain digits 0-9.' };
  }

  if (!allowDuplicates) {
    const digitSet = new Set(trimmed);
    if (digitSet.size !== digitCount) {
      return { valid: false, error: 'All digits must be unique (no repeated digits).' };
    }
  }

  return { valid: true, error: null };
}

/**
 * Unified input validator supporting both number and word game types.
 * @param {string} inputStr
 * @param {number} length
 * @param {boolean} allowDuplicates
 * @param {'number' | 'word'} gameType
 * @returns {{ valid: boolean, error: string | null, cleanWord?: string }}
 */
function validateInput(inputStr, length, allowDuplicates, gameType = 'number') {
  if (gameType === 'word') {
    return dictionary.validateWord(inputStr, length, allowDuplicates);
  }
  return validateNumber(inputStr, length, allowDuplicates);
}

/**
 * Evaluates exact matches (correct digit in exact position).
 * @param {string} secret
 * @param {string} guess
 * @returns {{ exact: number, total: number, isWin: boolean }}
 */
function evaluateExactMatches(secret, guess) {
  let exact = 0;
  const len = secret.length;

  for (let i = 0; i < len; i++) {
    if (secret[i] === guess[i]) {
      exact++;
    }
  }

  return {
    exact,
    total: len,
    isWin: exact === len
  };
}

/**
 * Evaluates Bulls & Cows:
 * - Bulls: correct digit in correct position.
 * - Cows: correct digit in wrong position (handles duplicates accurately).
 * @param {string} secret
 * @param {string} guess
 * @returns {{ bulls: number, cows: number, total: number, isWin: boolean }}
 */
function evaluateBullsAndCows(secret, guess) {
  const len = secret.length;
  let bulls = 0;

  const secretRemaining = {};
  const guessRemaining = {};

  for (let i = 0; i < len; i++) {
    const sChar = secret[i];
    const gChar = guess[i];

    if (sChar === gChar) {
      bulls++;
    } else {
      secretRemaining[sChar] = (secretRemaining[sChar] || 0) + 1;
      guessRemaining[gChar] = (guessRemaining[gChar] || 0) + 1;
    }
  }

  let cows = 0;
  for (const digit in guessRemaining) {
    if (secretRemaining[digit]) {
      cows += Math.min(guessRemaining[digit], secretRemaining[digit]);
    }
  }

  return {
    bulls,
    cows,
    total: len,
    isWin: bulls === len
  };
}

/**
 * Unified guess evaluator based on game mode.
 * @param {string} secret
 * @param {string} guess
 * @param {'exact' | 'bulls_and_cows'} mode
 * @returns {{ mode: string, isWin: boolean, exact?: number, bulls?: number, cows?: number, summary: string }}
 */
function evaluateGuess(secret, guess, mode) {
  if (mode === 'exact') {
    const res = evaluateExactMatches(secret, guess);
    return {
      mode: 'exact',
      isWin: res.isWin,
      exact: res.exact,
      total: res.total,
      summary: `${res.exact} exact match${res.exact === 1 ? '' : 'es'}`
    };
  }

  const res = evaluateBullsAndCows(secret, guess);
  return {
    mode: 'bulls_and_cows',
    isWin: res.isWin,
    bulls: res.bulls,
    cows: res.cows,
    total: res.total,
    summary: `${res.bulls} Bull${res.bulls === 1 ? '' : 's'}, ${res.cows} Cow${res.cows === 1 ? '' : 's'}`
  };
}

/**
 * Generates a random valid secret number adhering to game settings.
 * @param {number} digitCount
 * @param {boolean} allowDuplicates
 * @returns {string}
 */
function generateRandomNumber(digitCount, allowDuplicates) {
  const digits = ['0', '1', '2', '3', '4', '5', '6', '7', '8', '9'];

  if (allowDuplicates) {
    let result = '';
    for (let i = 0; i < digitCount; i++) {
      result += digits[Math.floor(Math.random() * digits.length)];
    }
    return result;
  }

  // Shuffle digits and pick first `digitCount`
  const pool = [...digits];
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }

  return pool.slice(0, digitCount).join('');
}

/**
 * Generates a random valid secret (number or word).
 * @param {number} length
 * @param {boolean} allowDuplicates
 * @param {'number' | 'word'} gameType
 * @returns {string}
 */
function generateRandomSecret(length, allowDuplicates, gameType = 'number') {
  if (gameType === 'word') {
    return dictionary.getRandomSecret(length, allowDuplicates);
  }
  return generateRandomNumber(length, allowDuplicates);
}

module.exports = {
  validateNumber,
  validateInput,
  evaluateExactMatches,
  evaluateBullsAndCows,
  evaluateGuess,
  generateRandomNumber,
  generateRandomSecret,
  dictionary
};
