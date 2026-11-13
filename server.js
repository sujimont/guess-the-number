const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');
const {
  validateNumber,
  evaluateGuess,
  generateRandomNumber
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
      return;
    } else {
      // Player 2 cracked code!
      if (room.firstWinnerIndex === 0) {
        // Both cracked in equal turns -> Draw!
        endGame(room, 'draw', 'Both players cracked the code in equal turns! It is a Draw!');
        return;
      } else {
        // Player 2 cracked it first (Player 1 already missed in this round) -> Player 2 wins!
        endGame(room, 'player1', `${room.players[1].name} wins!`);
        return;
      }
    }
  }

  // If guess was not a win:
  if (room.firstWinnerIndex === 0 && playerIndex === 1) {
    // Player 2 failed their final equal turn -> Player 1 wins!
    endGame(room, 'player0', `${room.players[0].name} wins!`);
    return;
  }

  // Continue to next turn
  advanceTurn(room);
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
      allowDuplicates: room.allowDuplicates
    });
    room.players[1].secret = room.aiOpponent.secret;
    room.players[1].isReady = true;
  }

  io.to(room.code).emit('rematch_started', {
    state: room.state,
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
        digitCount = 4,
        mode = 'bulls_and_cows',
        allowDuplicates = false,
        timerEnabled = true,
        timerSeconds = 90,
        isAiGame = false
      } = data;

      const code = generateRoomCode();
      const room = {
        code,
        hostId: socket.id,
        digitCount: Number(digitCount) === 5 ? 5 : 4,
        mode: mode === 'exact' ? 'exact' : 'bulls_and_cows',
        allowDuplicates: Boolean(allowDuplicates),
        timerEnabled: Boolean(timerEnabled),
        timerSeconds: Number(timerSeconds) || 90,
        turnTimeRemaining: Number(timerSeconds) || 90,
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
          allowDuplicates: room.allowDuplicates
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

      if (room.players.length >= 2) {
        return callback({ success: false, error: 'Room is already full.' });
      }

      const player = {
        id: socket.id,
        name: (playerName || 'Player 2').trim().slice(0, 16),
        secret: null,
        isReady: false,
        guesses: [],
        rematchRequested: false
      };

      room.players.push(player);
      room.state = 'setup'; // Both players present, move to secret selection!

      socket.join(cleanCode);
      socket.roomCode = cleanCode;
      socket.playerIndex = 1;

      callback({
        success: true,
        roomCode: cleanCode,
        roomConfig: {
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
      const val = validateNumber(secret, room.digitCount, room.allowDuplicates);
      if (!val.valid) {
        return callback({ success: false, error: val.error });
      }

      room.players[pIdx].secret = secret;
      room.players[pIdx].isReady = true;

      callback({ success: true });

      // Notify room about ready status without revealing secret
      io.to(room.code).emit('player_ready_update', {
        playerIndex: pIdx,
        isReady: true,
        allReady: room.players.every(p => p.isReady)
      });

      // If both players have locked in secret, start game!
      if (room.players.length === 2 && room.players.every(p => p.isReady)) {
        room.state = 'playing';
        room.currentTurnIndex = 0;
        room.roundNumber = 1;

        io.to(room.code).emit('game_started', {
          currentTurnIndex: 0,
          roundNumber: 1,
          activePlayerName: room.players[0].name,
          timerEnabled: room.timerEnabled,
          timerSeconds: room.timerSeconds
        });

        startTurnTimer(room);
      }
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

      const val = validateNumber(guess, room.digitCount, room.allowDuplicates);
      if (!val.valid) {
        return callback({ success: false, error: val.error });
      }

      callback({ success: true });
      processGuess(room, pIdx, guess);
    } catch (err) {
      callback({ success: false, error: err.message });
    }
  });

  // Request Rematch / Play Again
  socket.on('request_rematch', (callback) => {
    try {
      const room = rooms.get(socket.roomCode);
      if (!room) return callback({ success: false, error: 'Room not found.' });

      const pIdx = socket.playerIndex;
      if (pIdx === undefined || !room.players[pIdx]) {
        return callback({ success: false, error: 'Player not recognized.' });
      }

      room.players[pIdx].rematchRequested = true;
      callback({ success: true });

      if (room.isAiGame || room.players.every(p => p.rematchRequested)) {
        resetRoomForRematch(room);
      } else {
        io.to(room.code).emit('rematch_requested_notice', {
          playerIndex: pIdx,
          playerName: room.players[pIdx].name
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

      // If in lobby waiting, remove room if host leaves
      if (room.state === 'waiting' && pIdx === 0) {
        clearRoomTimer(room);
        rooms.delete(room.code);
        return;
      }

      // Notify opponent
      io.to(room.code).emit('player_left', {
        playerIndex: pIdx,
        playerName: leavingPlayer.name,
        message: `${leavingPlayer.name} has disconnected.`
      });

      // Clean up room if both left or AI game
      if (room.isAiGame || room.players.length <= 1) {
        clearRoomTimer(room);
        rooms.delete(room.code);
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

