const test = require('node:test');
const assert = require('node:assert');
const ioClient = require('socket.io-client');
const { server, io } = require('../server');

test('E2E against real server.js with Solo AI game', async () => {
  await new Promise((resolve) => server.listen(0, resolve));
  const port = server.address().port;

  const client = ioClient(`http://localhost:${port}`);
  await new Promise(res => client.on('connect', res));

  // 1. Create AI Game
  const resCreate = await new Promise(res => {
    client.emit('create_room', {
      playerName: 'Hero',
      digitCount: 4,
      mode: 'exact',
      allowDuplicates: false,
      timerEnabled: false,
      isAiGame: true
    }, res);
  });

  assert.strictEqual(resCreate.success, true);
  assert.strictEqual(resCreate.roomConfig.isAiGame, true);
  assert.strictEqual(resCreate.state, 'setup');

  // 2. Set secret number for player
  const gameStartedPromise = new Promise(res => client.on('game_started', res));
  const resSecret = await new Promise(res => client.emit('set_secret', { secret: '0123' }, res));
  assert.strictEqual(resSecret.success, true);

  await gameStartedPromise;

  // 3. Submit a guess
  const guessResultPromise = new Promise(res => client.on('guess_result', res));
  const resGuess = await new Promise(res => client.emit('submit_guess', { guess: '4567' }, res));
  assert.strictEqual(resGuess.success, true);

  const guessResult = await guessResultPromise;
  assert.strictEqual(guessResult.guessRecord.guess, '4567');
  assert.strictEqual(guessResult.guessRecord.feedback.mode, 'exact');

  client.disconnect();
  io.close();
  await new Promise(res => server.close(res));
});
