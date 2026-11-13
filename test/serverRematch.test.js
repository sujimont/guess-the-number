const test = require('node:test');
const assert = require('node:assert');
const ioClient = require('socket.io-client');
const { server, io, rooms } = require('../server');

test('Server Rematch Flow with Parameter Change and Reconnection', async () => {
  const port = await new Promise((resolve) => {
    const s = server.listen(0, () => {
      resolve(s.address().port);
    });
  });

  const url = `http://localhost:${port}`;
  const client1 = ioClient(url);
  const client2 = ioClient(url);

  await new Promise(res => client1.on('connect', res));
  await new Promise(res => client2.on('connect', res));

  // 1. Create Room (4 digits, bulls_and_cows)
  const createRes = await new Promise(res => {
    client1.emit('create_room', {
      playerName: 'Player1',
      digitCount: 4,
      mode: 'bulls_and_cows',
      allowDuplicates: false
    }, res);
  });
  assert.strictEqual(createRes.success, true);
  const roomCode = createRes.roomCode;

  // 2. Client 2 joins
  const joinRes = await new Promise(res => {
    client2.emit('join_room', { roomCode, playerName: 'Player2' }, res);
  });
  assert.strictEqual(joinRes.success, true);

  // 3. Set secrets
  await new Promise(res => client1.emit('set_secret', { secret: '1234' }, res));
  await new Promise(res => client2.emit('set_secret', { secret: '5678' }, res));

  // 4. Client 1 cracks client 2's secret on Round 1
  await new Promise(res => client1.emit('submit_guess', { guess: '5678' }, res));

  // Client 2 misses on equal turn -> Game Over, Player 1 wins
  const gameOverPromise = new Promise(res => client1.on('game_over', res));
  await new Promise(res => client2.emit('submit_guess', { guess: '9999' }, res));
  const gameOver = await gameOverPromise;
  assert.strictEqual(gameOver.outcome, 'player0');

  // 5. Client 1 requests rematch with UPDATED PARAMETERS (5 digits, exact mode, duplicates allowed)
  const noticePromise = new Promise(res => client2.on('rematch_requested_notice', res));
  const rematchReqRes = await new Promise(res => {
    client1.emit('request_rematch', {
      roomConfig: {
        digitCount: 5,
        mode: 'exact',
        allowDuplicates: true
      }
    }, res);
  });
  assert.strictEqual(rematchReqRes.success, true);
  assert.strictEqual(rematchReqRes.roomConfig.digitCount, 5);
  assert.strictEqual(rematchReqRes.roomConfig.mode, 'exact');
  assert.strictEqual(rematchReqRes.roomConfig.allowDuplicates, true);

  const notice = await noticePromise;
  assert.strictEqual(notice.playerIndex, 0);
  assert.strictEqual(notice.roomConfig.digitCount, 5);
  assert.strictEqual(notice.roomConfig.mode, 'exact');
  assert.strictEqual(notice.roomConfig.allowDuplicates, true);

  // 6. Client 2 accepts rematch -> rematch_started broadcast with updated config
  const rematchStartedPromise = new Promise(res => client1.on('rematch_started', res));
  await new Promise(res => client2.emit('request_rematch', {}, res));
  const rematchStarted = await rematchStartedPromise;
  assert.strictEqual(rematchStarted.roomConfig.digitCount, 5);
  assert.strictEqual(rematchStarted.roomConfig.mode, 'exact');
  assert.strictEqual(rematchStarted.roomConfig.allowDuplicates, true);

  // 7. Test Reconnection: Client 2 reloads/rejoins with new socket
  const client2Reloaded = ioClient(url);
  await new Promise(res => client2Reloaded.on('connect', res));
  client2.disconnect();

  const rejoinRes = await new Promise(res => {
    client2Reloaded.emit('join_room', { roomCode, playerName: 'Player2' }, res);
  });
  assert.strictEqual(rejoinRes.success, true);
  assert.strictEqual(rejoinRes.playerIndex, 1);
  assert.strictEqual(rejoinRes.roomConfig.digitCount, 5);

  client1.disconnect();
  client2Reloaded.disconnect();
  rooms.clear();
  await new Promise(res => {
    io.close(() => {
      server.close(res);
    });
  });
});

test('Host background disconnect and Guest join by link flow', async () => {
  const port = await new Promise((resolve) => {
    const s = server.listen(0, () => {
      resolve(s.address().port);
    });
  });

  const url = `http://localhost:${port}`;
  const hostClient = ioClient(url);

  await new Promise(res => hostClient.on('connect', res));

  // 1. Host creates room in waiting state
  const createRes = await new Promise(res => {
    hostClient.emit('create_room', {
      playerName: 'HostAlice',
      digitCount: 4,
      mode: 'exact',
      allowDuplicates: false
    }, res);
  });
  assert.strictEqual(createRes.success, true);
  const roomCode = createRes.roomCode;

  // 2. Host simulates backgrounding to send WhatsApp message -> socket disconnects
  hostClient.disconnect();

  // Give small delay to let server process disconnect
  await new Promise(res => setTimeout(res, 50));

  // Verify room STILL exists on server (NOT prematurely deleted)
  assert.strictEqual(rooms.has(roomCode), true);

  // 3. Guest joins via invite link while Host is still in background
  const guestClient = ioClient(url);
  await new Promise(res => guestClient.on('connect', res));

  const joinRes = await new Promise(res => {
    guestClient.emit('join_room', {
      roomCode,
      playerName: 'GuestBob'
    }, res);
  });
  assert.strictEqual(joinRes.success, true);
  assert.strictEqual(joinRes.playerIndex, 1);
  assert.strictEqual(joinRes.state, 'setup');

  // 4. Host switches back to browser and reconnects
  const hostReconnected = ioClient(url);
  await new Promise(res => hostReconnected.on('connect', res));

  const hostRejoinRes = await new Promise(res => {
    hostReconnected.emit('join_room', {
      roomCode,
      playerName: 'HostAlice'
    }, res);
  });
  assert.strictEqual(hostRejoinRes.success, true);
  assert.strictEqual(hostRejoinRes.playerIndex, 0); // Preserved slot 0 for host!
  assert.strictEqual(hostRejoinRes.state, 'setup');

  guestClient.disconnect();
  hostReconnected.disconnect();
  rooms.clear();
  await new Promise(res => {
    io.close(() => {
      server.close(res);
    });
  });
});

test('Guest joining with identical default name is assigned slot 1 and advances to setup', async () => {
  const port = await new Promise((resolve) => {
    const s = server.listen(0, () => {
      resolve(s.address().port);
    });
  });

  const url = `http://localhost:${port}`;
  const hostClient = ioClient(url);
  const guestClient = ioClient(url);

  await new Promise(res => hostClient.on('connect', res));
  await new Promise(res => guestClient.on('connect', res));

  // Both have default name 'Player'
  const createRes = await new Promise(res => {
    hostClient.emit('create_room', {
      playerName: 'Player',
      digitCount: 4,
      mode: 'exact',
      allowDuplicates: false
    }, res);
  });
  assert.strictEqual(createRes.success, true);
  assert.strictEqual(createRes.playerIndex, 0);

  const roomCode = createRes.roomCode;

  // Guest joins with exact same name 'Player' (e.g. opening link in 2nd tab or both default)
  const setupPromise = new Promise(res => hostClient.on('room_ready_for_setup', res));

  const joinRes = await new Promise(res => {
    guestClient.emit('join_room', {
      roomCode,
      playerName: 'Player'
    }, res);
  });

  assert.strictEqual(joinRes.success, true);
  assert.strictEqual(joinRes.playerIndex, 1); // Slot 1 assigned!
  assert.strictEqual(joinRes.state, 'setup'); // Advanced to setup!
  assert.strictEqual(joinRes.players[1].name, 'Player 2'); // Disambiguated!

  const setupData = await setupPromise;
  assert.strictEqual(setupData.state, 'setup');
  assert.strictEqual(setupData.players.length, 2);

  hostClient.disconnect();
  guestClient.disconnect();
  rooms.clear();
  await new Promise(res => {
    io.close(() => {
      server.close(res);
    });
  });
});

test('HTTP GET /join/:code and /r/:code serve index.html', async () => {
  const port = await new Promise((resolve) => {
    const s = server.listen(0, () => {
      resolve(s.address().port);
    });
  });

  const res1 = await fetch(`http://localhost:${port}/join/ABCD12`);
  assert.strictEqual(res1.status, 200);
  const text1 = await res1.text();
  assert.match(text1, /Guess The Number/);

  const res2 = await fetch(`http://localhost:${port}/r/XYZ999`);
  assert.strictEqual(res2.status, 200);
  const text2 = await res2.text();
  assert.match(text2, /Guess The Number/);

  rooms.clear();
  await new Promise(res => {
    io.close(() => {
      server.close(res);
    });
  });
});
