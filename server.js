const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');
const {
  validateNumber,
  validateInput,
  evaluateGuess,
  generateRandomNumber,
  generateRandomSecret,
  dictionary
} = require('./lib/gameLogic');
const AIOpponent = require('./lib/aiOpponent');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST']
  }
});

const PORT = process.env.PORT || 3000;

// Serve static frontend assets
app.use(express.static(path.join(__dirname, 'public')));

// Support direct SPA deep links for room invites
app.get(['/join/:code', '/r/:code'], (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// In-memory store for active rooms
const rooms = new Map();

/**
 * Generates an easily readable 6-character room code.
 */
function generateRoomCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 6; i++) {
    code += chars[Math.floor(Math.random() * chars.length)];
  }
  return rooms.has(code) ? generateRoomCode() : code;
}

/**
 * Schedules room deletion after an inactivity timeout (15 minutes).
 */
function scheduleRoomCleanup(roomCode, delayMs = 15 * 60 * 1000) {
  const room = rooms.get(roomCode);
  if (!room) return;
  if (room.cleanupTimeout) clearTimeout(room.cleanupTimeout);

  room.cleanupTimeout = setTimeout(() => {
    const currentRoom = rooms.get(roomCode);
    if (!currentRoom) return;
    const anyConnected = currentRoom.players.some(p => {
      const s = io.sockets.sockets.get(p.id);
      return s && s.connected;
    });
    if (!anyConnected) {
      clearRoomTimer(currentRoom);
      rooms.delete(roomCode);
    }
  }, delayMs);
}

/**
 * Clears room timer interval if active.
 */
function clearRoomTimer(room) {
  if (room.timerInterval) {
    clearInterval(room.timerInterval);
    room.timerInterval = null;
  }
}

/**
 * Starts or restarts the turn countdown timer.
 */
function startTurnTimer(room) {
  clearRoomTimer(room);
  if (!room.timerEnabled || room.state !== 'playing') return;

  room.turnTimeRemaining = room.timerSeconds;
  io.to(room.code).emit('timer_tick', { remaining: room.turnTimeRemaining });

  room.timerInterval = setInterval(() => {
    room.turnTimeRemaining -= 1;
    io.to(room.code).emit('timer_tick', { remaining: room.turnTimeRemaining });

    if (room.turnTimeRemaining <= 0) {
      clearRoomTimer(room);
      handleTurnTimeout(room);
    }
  }, 1000);
}

/**
 * Handles turn timeout (forfeit turn to opponent).
 */
function handleTurnTimeout(room) {
  if (room.state !== 'playing') return;

  const currentPlayer = room.players[room.currentTurnIndex];
  io.to(room.code).emit('turn_timeout', {
    playerIndex: room.currentTurnIndex,
    playerName: currentPlayer.name,
    message: `${currentPlayer.name}'s turn timed out! Turn passes to opponent.`
  });

  // If Player 1 already guessed correctly and Player 2 times out on their final equal turn
  if (room.firstWinnerIndex === 0 && room.currentTurnIndex === 1) {
    endGame(room, 'player0', `${room.players[0].name} wins! (${room.players[1].name} ran out of time on final turn)`);
    return;
  }

  // Regular turn advance
  advanceTurn(room);
}

/**
 * Advances the turn to the other player.
 */
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

  startTurnTimer(room);

  // If next turn belongs to AI
  if (room.isAiGame && room.currentTurnIndex === 1) {
    handleAiTurn(room);
  }
}

/**
 * Triggers AI's guess with a natural delay.
 */
function handleAiTurn(room) {
  if (room.state !== 'playing' || !room.aiOpponent) return;

  setTimeout(() => {
    if (room.state !== 'playing' || room.currentTurnIndex !== 1) return;

    const guess = room.aiOpponent.makeGuess();
    processGuess(room, 1, guess);
  }, 1600);
}

/**
 * Processes a guess made by playerIndex.
 */
function processGuess(room, playerIndex, guess) {
  clearRoomTimer(room);

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

  if (room.isAiGame && playerIndex === 1) {
    room.aiOpponent.recordFeedback(guess, feedback);
  }

  io.to(room.code).emit('guess_result', {
    guessRecord,
    guessesSummary: {
      player0Count: room.players[0].guesses.length,
      player1Count: room.players[1].guesses.length
    }
  });

  // Check win conditions
  if (feedback.isWin) {
    if (playerIndex === 0) {
      // Player 1 cracked code first. Give Player 2 equal matching turn!
      room.firstWinnerIndex = 0;
      io.to(room.code).emit('first_winner_notice', {
        playerIndex: 0,
        playerName: room.players[0].name,
        message: `${room.players[0].name} cracked the code! ${room.players[1].name} has one final turn to equalize!`
      });
      advanceTurn(room);
      return guessRecord;
    } else {
      // Player 2 cracked code!
      if (room.firstWinnerIndex === 0) {
        // Both cracked in equal turns -> Draw!
        endGame(room, 'draw', 'Both players cracked the code in equal turns! It is a Draw!');
        return guessRecord;
      } else {
        // Player 2 cracked it first (Player 1 already missed in this round) -> Player 2 wins!
        endGame(room, 'player1', `${room.players[1].name} wins!`);
        return guessRecord;
      }
    }
  }

  // If guess was not a win:
  if (room.firstWinnerIndex === 0 && playerIndex === 1) {
    // Player 2 failed their final equal turn -> Player 1 wins!
    endGame(room, 'player0', `${room.players[0].name} wins!`);
    return guessRecord;
  }

  // Continue to next turn
  advanceTurn(room);
  return guessRecord;
}

/**
 * Concludes the game, reveals secret numbers and broadcasts winner.
 */
function endGame(room, outcome, reason) {
  clearRoomTimer(room);
  room.state = 'gameover';
  room.winner = outcome;

  io.to(room.code).emit('game_over', {
    outcome,
    reason,
    secrets: {
      player0: {
        name: room.players[0].name,
        secret: room.players[0].secret
      },
      player1: {
        name: room.players[1].name,
        secret: room.players[1].secret
      }
    },
    totalRounds: room.roundNumber
  });
}

/**
 * Resets a room for a rematch.
 */
function resetRoomForRematch(room) {
  clearRoomTimer(room);
  room.state = 'setup';
  room.currentTurnIndex = 0;
  room.roundNumber = 1;
  room.firstWinnerIndex = null;
  room.winner = null;

  room.players.forEach(p => {
    p.secret = null;
    p.isReady = false;
    p.guesses = [];
    p.rematchRequested = false;
  });

  if (room.isAiGame) {
    room.aiOpponent = new AIOpponent({
      digitCount: room.digitCount,
      mode: room.mode,
      allowDuplicates: room.allowDuplicates,
      gameType: room.gameType
    });
    room.players[1].secret = room.aiOpponent.secret;
    room.players[1].isReady = true;
  }

  io.to(room.code).emit('rematch_started', {
    state: room.state,
    roomConfig: {
      gameType: room.gameType,
      digitCount: room.digitCount,
      mode: room.mode,
      allowDuplicates: room.allowDuplicates,
      timerEnabled: room.timerEnabled,
      timerSeconds: room.timerSeconds,
      isAiGame: room.isAiGame
    },
    players: room.players.map(p => ({ name: p.name, isReady: p.isReady }))
  });
}

// Socket.IO connection handling
io.on('connection', (socket) => {
  // Create Room
  socket.on('create_room', (data, callback) => {
    try {
      const {
        playerName,
        gameType = 'number',
        digitCount = 4,
        mode = 'bulls_and_cows',
        allowDuplicates = false,
        timerEnabled = false,
        timerSeconds = 0,
        isAiGame = false
      } = data;

      const code = generateRoomCode();
      const room = {
        code,
        hostId: socket.id,
        gameType: gameType === 'word' ? 'word' : 'number',
        digitCount: Number(digitCount) === 5 ? 5 : 4,
        mode: mode === 'exact' ? 'exact' : 'bulls_and_cows',
        allowDuplicates: Boolean(allowDuplicates),
        timerEnabled: Boolean(timerEnabled),
        timerSeconds: Number(timerSeconds) || 0,
        turnTimeRemaining: Number(timerSeconds) || 0,
        timerInterval: null,
        state: isAiGame ? 'setup' : 'waiting',
        isAiGame: Boolean(isAiGame),
        aiOpponent: null,
        currentTurnIndex: 0,
        roundNumber: 1,
        firstWinnerIndex: null,
        winner: null,
        players: [
          {
            id: socket.id,
            name: (playerName || 'Player 1').trim().slice(0, 16),
            secret: null,
            isReady: false,
            guesses: [],
            rematchRequested: false
          }
        ]
      };

      if (isAiGame) {
        room.aiOpponent = new AIOpponent({
          digitCount: room.digitCount,
          mode: room.mode,
          allowDuplicates: room.allowDuplicates,
          gameType: room.gameType
        });
        room.players.push({
          id: 'ai_bot',
          name: room.aiOpponent.name,
          secret: room.aiOpponent.secret,
          isReady: true,
          guesses: [],
          rematchRequested: false
        });
      }

      rooms.set(code, room);
      socket.join(code);
      socket.roomCode = code;
      socket.playerIndex = 0;

      callback({
        success: true,
        roomCode: code,
        roomConfig: {
          gameType: room.gameType,
          digitCount: room.digitCount,
          mode: room.mode,
          allowDuplicates: room.allowDuplicates,
          timerEnabled: room.timerEnabled,
          timerSeconds: room.timerSeconds,
          isAiGame: room.isAiGame
        },
        playerIndex: 0,
        players: room.players.map(p => ({ name: p.name, isReady: p.isReady })),
        state: room.state
      });
    } catch (err) {
      callback({ success: false, error: err.message });
    }
  });

  // Join Room
  socket.on('join_room', (data, callback) => {
    try {
      const { roomCode, playerName } = data;
      const cleanCode = (roomCode || '').trim().toUpperCase();
      const room = rooms.get(cleanCode);

      if (!room) {
        return callback({ success: false, error: 'Room not found. Check the code and try again.' });
      }

      // If room was pending cleanup due to disconnect, cancel cleanup
      if (room.cleanupTimeout) {
        clearTimeout(room.cleanupTimeout);
        room.cleanupTimeout = null;
      }

      // Check if this socket or a reconnecting player is rejoining their slot
      let playerIndexToAssign = null;
      const sameSocketIdx = room.players.findIndex(p => p.id === socket.id);
      const nameClean = (playerName || '').trim().toLowerCase();

      if (sameSocketIdx !== -1) {
        playerIndexToAssign = sameSocketIdx;
      } else if (data.playerIndex === 0 && room.players[0]) {
        // Explicit host reconnect
        playerIndexToAssign = 0;
      } else if (data.playerIndex === 1 && room.players[1]) {
        // Explicit guest reconnect
        playerIndexToAssign = 1;
      } else if (room.players.length === 1) {
        // Room currently has only Host (1 player).
        // Any new incoming connection is Player 2 (Guest)!
        // Do NOT match on name alone, as host and guest may both test with default/same name.
        playerIndexToAssign = null; // Will push Player 2
      } else if (room.players.length >= 2) {
        // Both slots exist in room - determine which slot to reconnect to
        if (nameClean && nameClean === room.players[0].name.toLowerCase()) {
          playerIndexToAssign = 0;
        } else if (nameClean && nameClean === room.players[1].name.toLowerCase()) {
          playerIndexToAssign = 1;
        } else {
          // Check disconnected sockets
          const s0 = io.sockets.sockets.get(room.players[0].id);
          const s1 = io.sockets.sockets.get(room.players[1].id);
          if (!s0 || !s0.connected) {
            playerIndexToAssign = 0;
          } else if (!s1 || !s1.connected) {
            playerIndexToAssign = 1;
          } else if (room.state === 'gameover' || room.state === 'setup') {
            playerIndexToAssign = 1;
          } else {
            return callback({ success: false, error: 'Room is already full.' });
          }
        }
      }

      // Reclaim existing slot
      if (playerIndexToAssign !== null) {
        const player = room.players[playerIndexToAssign];
        player.id = socket.id;
        if (playerName) player.name = playerName.trim().slice(0, 16);
        socket.join(cleanCode);
        socket.roomCode = cleanCode;
        socket.playerIndex = playerIndexToAssign;

        if (room.state === 'setup') {
          io.to(cleanCode).emit('room_ready_for_setup', {
            players: room.players.map(p => ({ name: p.name, isReady: p.isReady })),
            state: room.state
          });
        }

        return callback({
          success: true,
          roomCode: cleanCode,
          roomConfig: {
            gameType: room.gameType,
            digitCount: room.digitCount,
            mode: room.mode,
            allowDuplicates: room.allowDuplicates,
            timerEnabled: room.timerEnabled,
            timerSeconds: room.timerSeconds,
            isAiGame: room.isAiGame
          },
          playerIndex: playerIndexToAssign,
          players: room.players.map(p => ({ name: p.name, isReady: p.isReady })),
          state: room.state
        });
      }

      const player = {
        id: socket.id,
        name: (playerName || 'Player 2').trim().slice(0, 16),
        secret: null,
        isReady: false,
        guesses: [],
        rematchRequested: false
      };

      // Ensure Player 2 name is distinguished if identical to Player 1
      if (room.players[0] && player.name.toLowerCase() === room.players[0].name.toLowerCase()) {
        player.name = `${player.name} 2`;
      }

      room.players.push(player);
      room.state = 'setup'; // Both players present, move to secret selection!

      socket.join(cleanCode);
      socket.roomCode = cleanCode;
      socket.playerIndex = 1;

      callback({
        success: true,
        roomCode: cleanCode,
        roomConfig: {
          gameType: room.gameType,
          digitCount: room.digitCount,
          mode: room.mode,
          allowDuplicates: room.allowDuplicates,
          timerEnabled: room.timerEnabled,
          timerSeconds: room.timerSeconds,
          isAiGame: room.isAiGame
        },
        playerIndex: 1,
        players: room.players.map(p => ({ name: p.name, isReady: p.isReady })),
        state: room.state
      });

      // Notify host that guest has joined and setup phase begins
      io.to(cleanCode).emit('room_ready_for_setup', {
        players: room.players.map(p => ({ name: p.name, isReady: p.isReady })),
        state: room.state
      });
    } catch (err) {
      callback({ success: false, error: err.message });
    }
  });

  // Submit Secret Number
  socket.on('set_secret', (data, callback) => {
    try {
      const { secret } = data;
      const room = rooms.get(socket.roomCode);

      if (!room) {
        return callback({ success: false, error: 'Room not found.' });
      }

      const pIdx = socket.playerIndex;
      if (pIdx === undefined || !room.players[pIdx]) {
        return callback({ success: false, error: 'Player not recognized in this room.' });
      }

      // Validate secret against room rules
      const val = validateInput(secret, room.digitCount, room.allowDuplicates, room.gameType);
      if (!val.valid) {
        return callback({ success: false, error: val.error });
      }

      room.players[pIdx].secret = val.cleanWord || String(secret).trim().toUpperCase();
      room.players[pIdx].isReady = true;

      // Notify room about ready status without revealing secret
      io.to(room.code).emit('player_ready_update', {
        playerIndex: pIdx,
        isReady: true,
        allReady: room.players.every(p => p.isReady)
      });

      let gameStartedPayload = null;

      // If both players have locked in secret, start game!
      if (room.players.length === 2 && room.players.every(p => p.isReady)) {
        room.state = 'playing';
        room.currentTurnIndex = 0;
        room.roundNumber = 1;

        gameStartedPayload = {
          currentTurnIndex: 0,
          roundNumber: 1,
          activePlayerName: room.players[0].name,
          timerEnabled: room.timerEnabled,
          timerSeconds: room.timerSeconds
        };

        io.to(room.code).emit('game_started', gameStartedPayload);
        socket.emit('game_started', gameStartedPayload);

        startTurnTimer(room);
      }

      callback({
        success: true,
        gameStarted: Boolean(gameStartedPayload),
        gameStartedData: gameStartedPayload
      });
    } catch (err) {
      callback({ success: false, error: err.message });
    }
  });

  // Submit Guess
  socket.on('submit_guess', (data, callback) => {
    try {
      const { guess } = data;
      const room = rooms.get(socket.roomCode);

      if (!room || room.state !== 'playing') {
        return callback({ success: false, error: 'Game is not currently active.' });
      }

      const pIdx = socket.playerIndex;
      if (pIdx !== room.currentTurnIndex) {
        return callback({ success: false, error: 'It is not your turn.' });
      }

      // Guesses in number mode are never restricted to unique digits even in unique mode!
      // In word mode, guess must be a valid English word
      const val = validateInput(guess, room.digitCount, true, room.gameType);
      if (!val.valid) {
        return callback({ success: false, error: val.error });
      }

      const cleanGuess = val.cleanWord || String(guess).trim().toUpperCase();
      const guessRecord = processGuess(room, pIdx, cleanGuess);
      callback({ success: true, guessRecord });
    } catch (err) {
      callback({ success: false, error: err.message });
    }
  });

  // Request Rematch / Play Again
  socket.on('request_rematch', (data, callback) => {
    if (typeof data === 'function') {
      callback = data;
      data = {};
    }
    callback = callback || (() => {});

    try {
      const room = rooms.get(socket.roomCode);
      if (!room) return callback({ success: false, error: 'Room not found.' });

      const pIdx = socket.playerIndex;
      if (pIdx === undefined || !room.players[pIdx]) {
        return callback({ success: false, error: 'Player not recognized.' });
      }

      // If the initiating player chose updated game parameters for rematch
      if (data && data.roomConfig) {
        const { gameType, digitCount, mode, allowDuplicates, timerEnabled, timerSeconds } = data.roomConfig;
        if (gameType) room.gameType = gameType === 'word' ? 'word' : 'number';
        if (digitCount) room.digitCount = Number(digitCount) === 5 ? 5 : 4;
        if (mode) room.mode = mode === 'exact' ? 'exact' : 'bulls_and_cows';
        if (allowDuplicates !== undefined) room.allowDuplicates = Boolean(allowDuplicates);
        if (timerEnabled !== undefined) room.timerEnabled = Boolean(timerEnabled);
        if (timerSeconds !== undefined) {
          room.timerSeconds = Number(timerSeconds) || 0;
          room.turnTimeRemaining = room.timerSeconds;
        }
      }

      room.players[pIdx].rematchRequested = true;
      callback({
        success: true,
        roomConfig: {
          gameType: room.gameType,
          digitCount: room.digitCount,
          mode: room.mode,
          allowDuplicates: room.allowDuplicates,
          timerEnabled: room.timerEnabled,
          timerSeconds: room.timerSeconds,
          isAiGame: room.isAiGame
        }
      });

      if (room.isAiGame || room.players.every(p => p.rematchRequested)) {
        resetRoomForRematch(room);
      } else {
        io.to(room.code).emit('rematch_requested_notice', {
          playerIndex: pIdx,
          playerName: room.players[pIdx].name,
          roomConfig: {
            gameType: room.gameType,
            digitCount: room.digitCount,
            mode: room.mode,
            allowDuplicates: room.allowDuplicates,
            timerEnabled: room.timerEnabled,
            timerSeconds: room.timerSeconds,
            isAiGame: room.isAiGame
          }
        });
      }
    } catch (err) {
      callback({ success: false, error: err.message });
    }
  });

  // Handle Disconnect
  socket.on('disconnect', () => {
    const room = rooms.get(socket.roomCode);
    if (!room) return;

    const pIdx = socket.playerIndex;
    if (pIdx !== undefined && room.players[pIdx]) {
      const leavingPlayer = room.players[pIdx];

      // If AI game, clean up immediately
      if (room.isAiGame) {
        clearRoomTimer(room);
        rooms.delete(room.code);
        return;
      }

      // Check if any other player in this room is currently connected
      const anyOtherConnected = room.players.some(p => {
        if (p.id === socket.id) return false;
        const s = io.sockets.sockets.get(p.id);
        return s && s.connected;
      });

      if (anyOtherConnected) {
        // Notify the remaining active player that peer disconnected temporarily
        io.to(room.code).emit('player_left', {
          playerIndex: pIdx,
          playerName: leavingPlayer.name,
          message: `${leavingPlayer.name} has temporarily disconnected.`
        });
      } else {
        // Both disconnected or host in background -> schedule cleanup after 15 minutes of inactivity
        scheduleRoomCleanup(room.code, 15 * 60 * 1000);
      }
    }
  });
});

if (require.main === module) {
  server.listen(PORT, () => {
    console.log(`Guess The Number server running at http://localhost:${PORT}`);
  });
}

module.exports = { app, server, io, rooms };

