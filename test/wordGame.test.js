const test = require('node:test');
const assert = require('node:assert');
const dictionary = require('../lib/dictionary');
const { validateInput, evaluateGuess, generateRandomSecret } = require('../lib/gameLogic');
const AIOpponent = require('../lib/aiOpponent');
const ioClient = require('socket.io-client');
const { server, io, rooms } = require('../server');

test('Dictionary validates 4 and 5 letter words correctly', () => {
  assert.strictEqual(dictionary.isValidWord('PARK', 4), true);
  assert.strictEqual(dictionary.isValidWord('LION', 4), true);
  assert.strictEqual(dictionary.isValidWord('TRAIN', 5), true);
  assert.strictEqual(dictionary.isValidWord('WATER', 5), true);

  // Invalid words
  assert.strictEqual(dictionary.isValidWord('ZZZZ', 4), false);
  assert.strictEqual(dictionary.isValidWord('QWZX', 4), false);
  assert.strictEqual(dictionary.isValidWord('ABCDE', 5), false);
  assert.strictEqual(dictionary.isValidWord('1234', 4), false);
});

test('Dictionary random secrets respect duplicate constraint', () => {
  for (let i = 0; i < 20; i++) {
    const word4Unique = dictionary.getRandomSecret(4, false);
    assert.strictEqual(word4Unique.length, 4);
    assert.strictEqual(dictionary.hasUniqueLetters(word4Unique), true);
    assert.strictEqual(dictionary.isValidWord(word4Unique, 4), true);

    const word5Unique = dictionary.getRandomSecret(5, false);
    assert.strictEqual(word5Unique.length, 5);
    assert.strictEqual(dictionary.hasUniqueLetters(word5Unique), true);
    assert.strictEqual(dictionary.isValidWord(word5Unique, 5), true);
  }
});

test('Word validation handles errors accurately', () => {
  const v1 = dictionary.validateWord('PARK', 4, true);
  assert.strictEqual(v1.valid, true);

  const v2 = dictionary.validateWord('BOOK', 4, false); // Duplicate O not allowed in unique mode
  assert.strictEqual(v2.valid, false);
  assert.match(v2.error, /unique/i);

  const v3 = dictionary.validateWord('PAR', 4, true); // Wrong length
  assert.strictEqual(v3.valid, false);
  assert.match(v3.error, /4 letters/i);

  const v4 = dictionary.validateWord('XYZW', 4, true); // Not in dictionary
  assert.strictEqual(v4.valid, false);
  assert.match(v4.error, /word list/i);
});

test('evaluateGuess works for Word game evaluation (Jotto / Bulls & Cows)', () => {
  // Target: TRAIN, Guess: TIRED
  // T: Exact (Bull)
  // R: In word, wrong spot (Cow)
  // I: In word, wrong spot (Cow)
  // E: Absent
  // D: Absent
  // Expected: 1 Bull, 2 Cows
  const res = evaluateGuess('TRAIN', 'TIRED', 'bulls_and_cows');
  assert.strictEqual(res.bulls, 1);
  assert.strictEqual(res.cows, 2);
  assert.strictEqual(res.isWin, false);

  // Exact Match mode only
  const exactRes = evaluateGuess('TRAIN', 'TIRED', 'exact');
  assert.strictEqual(exactRes.exact, 1);
  assert.strictEqual(exactRes.isWin, false);

  // Perfect match
  const winRes = evaluateGuess('TRAIN', 'TRAIN', 'bulls_and_cows');
  assert.strictEqual(winRes.bulls, 5);
  assert.strictEqual(winRes.cows, 0);
  assert.strictEqual(winRes.isWin, true);
});

test('AI Opponent works in Word mode', () => {
  const ai = new AIOpponent({
    digitCount: 5,
    mode: 'bulls_and_cows',
    allowDuplicates: false,
    gameType: 'word'
  });

  assert.strictEqual(ai.secret.length, 5);
  assert.strictEqual(dictionary.isValidWord(ai.secret, 5), true);
  assert.strictEqual(dictionary.hasUniqueLetters(ai.secret), true);

  // Opening guess
  const guess1 = ai.makeGuess();
  assert.strictEqual(guess1.length, 5);
  assert.strictEqual(dictionary.isValidWord(guess1, 5), true);

  // Record feedback and generate second guess
  ai.recordFeedback(guess1, { bulls: 1, cows: 1, mode: 'bulls_and_cows' });
  const guess2 = ai.makeGuess();
  assert.strictEqual(guess2.length, 5);
  assert.strictEqual(dictionary.isValidWord(guess2, 5), true);
  assert.notStrictEqual(guess1, guess2);
});

test('E2E Word Game Multiplayer Flow with Sockets', async () => {
  const port = await new Promise((resolve) => {
    const s = server.listen(0, () => {
      resolve(s.address().port);
    });
  });

  const url = `http://localhost:${port}`;
  const client1 = ioClient(url);
  const client2 = ioClient(url);

  await new Promise(r => client1.on('connect', r));
  await new Promise(r => client2.on('connect', r));

  // 1. Client 1 creates a Word Game (5 Letters, Bulls & Cows, Unique Letters)
  const createRes = await new Promise(r => {
    client1.emit('create_room', {
      playerName: 'WordHost',
      gameType: 'word',
      digitCount: 5,
      mode: 'bulls_and_cows',
      allowDuplicates: false
    }, r);
  });
  assert.strictEqual(createRes.success, true);
  assert.strictEqual(createRes.roomConfig.gameType, 'word');
  assert.strictEqual(createRes.roomConfig.digitCount, 5);
  const roomCode = createRes.roomCode;

  // 2. Client 2 joins
  const joinRes = await new Promise(r => {
    client2.emit('join_room', { roomCode, playerName: 'WordGuest' }, r);
  });
  assert.strictEqual(joinRes.success, true);
  assert.strictEqual(joinRes.roomConfig.gameType, 'word');

  // 3. Reject invalid secret words (not in dictionary)
  const badSecretRes = await new Promise(r => {
    client1.emit('set_secret', { secret: 'XYQZJ' }, r);
  });
  assert.strictEqual(badSecretRes.success, false);
  assert.match(badSecretRes.error, /word list/i);

  // 4. Lock in valid secret words
  const gameStartedPromise = new Promise(r => client1.on('game_started', r));
  const set1 = await new Promise(r => client1.emit('set_secret', { secret: 'PLANT' }, r));
  assert.strictEqual(set1.success, true);

  const set2 = await new Promise(r => client2.emit('set_secret', { secret: 'CHAIR' }, r));
  assert.strictEqual(set2.success, true);

  await gameStartedPromise;

  // 5. Client 1 tries non-word guess -> rejected
  const badGuessRes = await new Promise(r => {
    client1.emit('submit_guess', { guess: 'QQQQQ' }, r);
  });
  assert.strictEqual(badGuessRes.success, false);
  assert.match(badGuessRes.error, /word list/i);

  // 6. Client 1 guesses valid word 'CRANE' against Client 2's secret 'CHAIR'
  // C: Bull (exact idx 0), A: Bull (exact idx 2), R: Cow (wrong spot) -> 2 Bulls, 1 Cow
  const guessRes = await new Promise(r => {
    client1.emit('submit_guess', { guess: 'CRANE' }, r);
  });
  assert.strictEqual(guessRes.success, true);
  assert.strictEqual(guessRes.guessRecord.feedback.bulls, 2);
  assert.strictEqual(guessRes.guessRecord.feedback.cows, 1);

  client1.disconnect();
  client2.disconnect();
  rooms.clear();
  await new Promise(r => {
    io.close(() => {
      server.close(r);
    });
  });
});
