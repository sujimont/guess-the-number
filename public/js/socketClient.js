/**
 * Socket.IO Client Wrapper
 */
class SocketClient {
  constructor() {
    this.socket = io();
    this.handlers = {};

    this.bindEvents();
  }

  bindEvents() {
    const events = [
      'connect',
      'disconnect',
      'room_ready_for_setup',
      'player_ready_update',
      'game_started',
      'guess_result',
      'turn_changed',
      'timer_tick',
      'turn_timeout',
      'first_winner_notice',
      'game_over',
      'rematch_started',
      'rematch_requested_notice',
      'player_left'
    ];

    events.forEach(evt => {
      this.socket.on(evt, (data) => {
        if (this.handlers[evt]) {
          this.handlers[evt](data);
        }
      });
    });
  }

  on(event, callback) {
    this.handlers[event] = callback;
  }

  createRoom(payload) {
    return new Promise((resolve) => {
      this.socket.emit('create_room', payload, resolve);
    });
  }

  joinRoom(payload) {
    return new Promise((resolve) => {
      this.socket.emit('join_room', payload, resolve);
    });
  }

  setSecret(secret) {
    return new Promise((resolve) => {
      this.socket.emit('set_secret', { secret }, resolve);
    });
  }

  submitGuess(guess) {
    return new Promise((resolve) => {
      this.socket.emit('submit_guess', { guess }, resolve);
    });
  }

  requestRematch() {
    return new Promise((resolve) => {
      this.socket.emit('request_rematch', resolve);
    });
  }
}

window.socketClient = new SocketClient();
