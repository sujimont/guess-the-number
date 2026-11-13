const test = require('node:test');
const assert = require('node:assert');
const http = require('http');
const express = require('express');
const { Server } = require('socket.io');
const ioClient = require('socket.io-client');
const { validateNumber, evaluateGuess } = require('../lib/gameLogic');
const AIOpponent = require('../lib/aiOpponent');

// Set up an isolated test server instance
function createTestServer() {
  const app = express();
  const server = http.createServer(app);
  const io = new Server(server);
  const rooms = new Map();

  function generateRoomCode() {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let code = '';
    for (let i = 0; i < 6; i++) {
      code += chars[Math.floor(Math.random() * chars.length)];
    }
    return rooms.has(code) ? generateRoomCode() : code;
  }

  function advanceTurn(room) {
    if (room.state !== 'playing') return;
    if (room.currentTurnIndex === 0) {
      room.currentTurnIndex = 1;
    } else {
      room.currentTurnIndex = 0;
      room.roundNumber += 1;
    }

    io.to(room.code).emit('turn_changed', {
      currentTurnIndex: room.currentTurnIndex,
      roundNumber: room.roundNumber,
      activePlayerName: room.players[room.currentTurnIndex].name
    });
  }

  function endGame(room, outcome, reason) {
    room.state = 'gameover';
    room.winner = outcome;
    io.to(room.code).emit('game_over', {
      outcome,
      reason,
      secrets: {
        player0: { name: room.players[0].name, secret: room.players[0].secret },
        player1: { name: room.players[1].name, secret: room.players[1].secret }
      },
      totalRounds: room.roundNumber
    });
  }

  function processGuess(room, playerIndex, guess) {
    const opponentIndex = playerIndex === 0 ? 1 : 0;
    const opponentSecret = room.players[opponentIndex].secret;
    const feedback = evaluateGuess(opponentSecret, guess, room.mode);

    const guessRecord = {
      playerIndex,
      playerName: room.players[playerIndex].name,
      guess,
      feedback,
      turnNumber: room.players[playerIndex].guesses.length + 1
    };

    room.players[playerIndex].guesses.push(guessRecord);

    io.to(room.code).emit('guess_result', { guessRecord });

    if (feedback.isWin) {
      if (playerIndex === 0) {
        room.firstWinnerIndex = 0;
        io.to(room.code).emit('first_winner_notice', {
          playerIndex: 0,
          playerName: room.players[0].name,
          message: `${room.players[0].name} cracked the code! ${room.players[1].name} has one final turn!`
        });
        advanceTurn(room);
        return;
      } else {
        if (room.firstWinnerIndex === 0) {
          endGame(room, 'draw', 'Both players cracked the code in equal turns! Draw!');
          return;
        } else {
          endGame(room, 'player1', `${room.players[1].name} wins!`);
          return;
        }
      }
    }

    if (room.firstWinnerIndex === 0 && playerIndex === 1) {
      endGame(room, 'player0', `${room.players[0].name} wins!`);
      return;
    }

    advanceTurn(room);
  }

  io.on('connection', (socket) => {
    socket.on('create_room', (data, callback) => {
      const code = generateRoomCode();
      const room = {
        code,
        digitCount: data.digitCount || 4,
        mode: data.mode || 'bulls_and_cows',
        allowDuplicates: Boolean(data.allowDuplicates),
        state: data.isAiGame ? 'setup' : 'waiting',
        currentTurnIndex: 0,
        roundNumber: 1,
        firstWinnerIndex: null,
        players: [
          { id: socket.id, name: data.playerName, secret: null, isReady: false, guesses: [] }
        ]
      };
      rooms.set(code, room);
      socket.join(code);
      socket.roomCode = code;
      socket.playerIndex = 0;
      callback({ success: true, roomCode: code, playerIndex: 0 });
    });

    socket.on('join_room', (data, callback) => {
      const room = rooms.get(data.roomCode);
      if (!room || room.players.length >= 2) return callback({ success: false });

      room.players.push({ id: socket.id, name: data.playerName, secret: null, isReady: false, guesses: [] });
      room.state = 'setup';
      socket.join(data.roomCode);
      socket.roomCode = data.roomCode;
      socket.playerIndex = 1;

      callback({ success: true, roomCode: data.roomCode, playerIndex: 1 });
      io.to(data.roomCode).emit('room_ready_for_setup', { state: room.state });
    });

    socket.on('set_secret', (data, callback) => {
      const room = rooms.get(socket.roomCode);
      const pIdx = socket.playerIndex;
      room.players[pIdx].secret = data.secret;
      room.players[pIdx].isReady = true;
      callback({ success: true });

      if (room.players.length === 2 && room.players.every(p => p.isReady)) {
        room.state = 'playing';
        io.to(room.code).emit('game_started', { currentTurnIndex: 0, roundNumber: 1 });
      }
    });

    socket.on('submit_guess', (data, callback) => {
      const room = rooms.get(socket.roomCode);
      const pIdx = socket.playerIndex;
      callback({ success: true });
      processGuess(room, pIdx, data.guess);
    });
  });

  return new Promise((resolve) => {
    server.listen(0, () => {
      const port = server.address().port;
      resolve({
        port,
        close: () => new Promise(res => {
          io.close();
          server.close(res);
        })
      });
    });
  });
}

test('Full Multiplayer Flow: 5 digits, equal turn draw resolution', async () => {
  const testServer = await createTestServer();
  const url = `http://localhost:${testServer.port}`;

  const client1 = ioClient(url);
  const client2 = ioClient(url);

  await new Promise(res => client1.on('connect', res));
  await new Promise(res => client2.on('connect', res));

  // 1. Client 1 creates room
  const createRes = await new Promise(res => {
    client1.emit('create_room', {
      playerName: 'Alice',
      digitCount: 5,
      mode: 'bulls_and_cows',
      allowDuplicates: false
    }, res);
  });
  assert.strictEqual(createRes.success, true);
  const roomCode = createRes.roomCode;

  // 2. Client 2 joins room
  const joinRes = await new Promise(res => {
    client2.emit('join_room', { playerName: 'Bob', roomCode }, res);
  });
  assert.strictEqual(joinRes.success, true);

  // 3. Both lock in secret codes
  const gameStartedPromise = new Promise(res => client1.on('game_started', res));

  await new Promise(res => client1.emit('set_secret', { secret: '12345' }, res));
  await new Promise(res => client2.emit('set_secret', { secret: '54321' }, res));

  await gameStartedPromise;

  // 4. Client 1 guesses correctly on Round 1 (cracks Bob's code '54321')
  const noticePromise = new Promise(res => client2.on('first_winner_notice', res));
  await new Promise(res => client1.emit('submit_guess', { guess: '54321' }, res));
  const notice = await noticePromise;
  assert.strictEqual(notice.playerIndex, 0);

  // 5. Client 2 gets equal turn, also cracks Alice's code '12345'
  const gameOverPromise = new Promise(res => client1.on('game_over', res));
  await new Promise(res => client2.emit('submit_guess', { guess: '12345' }, res));
  const gameOverData = await gameOverPromise;

  // 6. Verify result is a Draw
  assert.strictEqual(gameOverData.outcome, 'draw');
  assert.strictEqual(gameOverData.secrets.player0.secret, '12345');
  assert.strictEqual(gameOverData.secrets.player1.secret, '54321');

  client1.disconnect();
  client2.disconnect();
  await testServer.close();
});
