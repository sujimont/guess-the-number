const test = require('node:test');
const assert = require('node:assert');
const {
  validateNumber,
  evaluateExactMatches,
  evaluateBullsAndCows,
  evaluateGuess,
  generateRandomNumber
} = require('../lib/gameLogic');
const AIOpponent = require('../lib/aiOpponent');

test('validateNumber correctly validates input strings', () => {
  // Valid 4-digit unique
  assert.deepStrictEqual(validateNumber('0123', 4, false), { valid: true, error: null });
  assert.deepStrictEqual(validateNumber('9876', 4, false), { valid: true, error: null });

  // Valid 5-digit unique
  assert.deepStrictEqual(validateNumber('01234', 5, false), { valid: true, error: null });

  // Invalid length
  assert.strictEqual(validateNumber('123', 4, false).valid, false);
  assert.strictEqual(validateNumber('12345', 4, false).valid, false);

  // Non-digit characters
  assert.strictEqual(validateNumber('12a4', 4, false).valid, false);
  assert.strictEqual(validateNumber('12 4', 4, false).valid, false);

  // Duplicates when disallowed
  assert.strictEqual(validateNumber('1123', 4, false).valid, false);
  assert.strictEqual(validateNumber('1223', 4, false).valid, false);

  // Duplicates when allowed
  assert.deepStrictEqual(validateNumber('1123', 4, true), { valid: true, error: null });
  assert.deepStrictEqual(validateNumber('9999', 4, true), { valid: true, error: null });
});

test('evaluateExactMatches scores correctly', () => {
  const win = evaluateExactMatches('1234', '1234');
  assert.strictEqual(win.exact, 4);
  assert.strictEqual(win.isWin, true);

  const none = evaluateExactMatches('1234', '4321');
  assert.strictEqual(none.exact, 0);
  assert.strictEqual(none.isWin, false);

  const partial = evaluateExactMatches('1234', '1938');
  assert.strictEqual(partial.exact, 2);
  assert.strictEqual(partial.isWin, false);

  const fiveDigit = evaluateExactMatches('01234', '01934');
  assert.strictEqual(fiveDigit.exact, 4);
  assert.strictEqual(fiveDigit.total, 5);
});

test('evaluateBullsAndCows scores correctly without duplicates', () => {
  const allBulls = evaluateBullsAndCows('1234', '1234');
  assert.strictEqual(allBulls.bulls, 4);
  assert.strictEqual(allBulls.cows, 0);
  assert.strictEqual(allBulls.isWin, true);

  const allCows = evaluateBullsAndCows('1234', '4321');
  assert.strictEqual(allCows.bulls, 0);
  assert.strictEqual(allCows.cows, 4);
  assert.strictEqual(allCows.isWin, false);

  const mixed = evaluateBullsAndCows('1234', '1324');
  assert.strictEqual(mixed.bulls, 2); // 1 and 4 are exact
  assert.strictEqual(mixed.cows, 2);  // 2 and 3 are swapped
  assert.strictEqual(mixed.isWin, false);
});

test('evaluateBullsAndCows scores correctly WITH duplicates', () => {
  // Secret: 1123, Guess: 0111
  // Pos 1 has '1' == '1' (1 Bull).
  // Remaining secret has [1, 2, 3]. Remaining guess has [0, 1, 1].
  // Only one '1' matches -> 1 Cow.
  const dup1 = evaluateBullsAndCows('1123', '0111');
  assert.strictEqual(dup1.bulls, 1);
  assert.strictEqual(dup1.cows, 1);

  // Secret: 1122, Guess: 2211
  const dup2 = evaluateBullsAndCows('1122', '2211');
  assert.strictEqual(dup2.bulls, 0);
  assert.strictEqual(dup2.cows, 4);
});

test('evaluateGuess formats unified output', () => {
  const exactRes = evaluateGuess('1234', '1200', 'exact');
  assert.strictEqual(exactRes.exact, 2);
  assert.strictEqual(exactRes.summary, '2 exact matches');

  const bcRes = evaluateGuess('1234', '1324', 'bulls_and_cows');
  assert.strictEqual(bcRes.bulls, 2);
  assert.strictEqual(bcRes.cows, 2);
  assert.strictEqual(bcRes.summary, '2 Bulls, 2 Cows');
});

test('generateRandomNumber produces valid numbers', () => {
  for (let i = 0; i < 20; i++) {
    const num4Unique = generateRandomNumber(4, false);
    assert.strictEqual(validateNumber(num4Unique, 4, false).valid, true);

    const num5Unique = generateRandomNumber(5, false);
    assert.strictEqual(validateNumber(num5Unique, 5, false).valid, true);

    const num4Dup = generateRandomNumber(4, true);
    assert.strictEqual(validateNumber(num4Dup, 4, true).valid, true);
  }
});

test('AIOpponent generates valid initial guess and updates with feedback', () => {
  const ai = new AIOpponent({ digitCount: 4, mode: 'bulls_and_cows', allowDuplicates: false });
  assert.strictEqual(ai.secret.length, 4);
  assert.strictEqual(validateNumber(ai.secret, 4, false).valid, true);

  const firstGuess = ai.makeGuess();
  assert.strictEqual(validateNumber(firstGuess, 4, false).valid, true);

  const feedback = evaluateGuess(ai.secret, firstGuess, 'bulls_and_cows');
  ai.recordFeedback(firstGuess, feedback);

  const secondGuess = ai.makeGuess();
  assert.strictEqual(validateNumber(secondGuess, 4, false).valid, true);
  assert.notStrictEqual(secondGuess, firstGuess);
});
