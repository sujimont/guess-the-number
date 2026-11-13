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

  emitWithAck(event, data) {
    return new Promise((resolve) => {
      const send = () => {
        let timedOut = false;
        const timer = setTimeout(() => {
          timedOut = true;
          resolve({ success: false, error: 'Connection timed out. Please check your internet connection.' });
        }, 8000);

        this.socket.emit(event, data, (response) => {
          if (!timedOut) {
            clearTimeout(timer);
            resolve(response || { success: true });
          }
        });
      };

      if (this.socket.connected) {
        send();
      } else {
        this.socket.once('connect', send);
      }
    });
  }

  createRoom(payload) {
    return this.emitWithAck('create_room', payload);
  }

  joinRoom(payload) {
    return this.emitWithAck('join_room', payload);
  }

  setSecret(secret) {
    return this.emitWithAck('set_secret', { secret });
  }

  submitGuess(guess) {
    return this.emitWithAck('submit_guess', { guess });
  }

  requestRematch(payload) {
    return this.emitWithAck('request_rematch', payload || {});
  }
}

window.socketClient = new SocketClient();
