# 🎯 Guess The Number — Online Multiplayer Code Breaker

[![Deploy to Render](https://render.com/images/deploy-to-render-button.svg)](https://render.com/deploy?repo=https://github.com/sujimont/guess-the-number)

A real-time, 2-player online number-guessing web game built with Node.js, Express, and Socket.IO. Players select a secret 4- or 5-digit number and take turns cracking each other's code with automated server-side feedback.

---

## ✨ Features

- **2-Player Online Multiplayer:** Join seamlessly using a simple 6-character room code or direct invite link — **no account or signup required**.
- **Solo "Play vs Computer (AI)" Mode:** Practice your deduction skills against an intelligent computer opponent anytime.
- **Host-Configurable Game Rules:**
  - **4 or 5 Digits:** Choose between 4-digit or 5-digit code breaking.
  - **Scoring Method:**
    - *Exact Matches Only:* Shows how many digits are correct and in the right position.
    - *Bulls & Cows:* Shows **Bulls** (correct digit in correct position) and **Cows** (correct digit in wrong position).
  - **Repeated Digits:** Toggle between **Unique Digits Only** or **Duplicates Allowed**.
  - **Turn Timer:** Optional timer (defaults to **90 seconds**; forfeits turn on timeout) or untimed casual play.
- **Equal Turns & Tie-Breaking:** If Player 1 cracks the code first, Player 2 is granted their matching final turn for that round to allow for a fair **Draw**.
- **Mobile-Friendly (iOS & Android Optimized):**
  - Triggers **0–9 numeric keypads only** (`inputmode="numeric" pattern="[0-9]*"`).
  - Built-in on-screen mobile numpad for easy one-handed thumb tapping.
  - iPhone notch safe area support and touch optimization (no tap delay or unwanted zoom).
- **Interactive Digit Scratchpad (0–9):** Tap digits 0–9 to cycle through *Neutral*, *Confirmed (Green)*, and *Eliminated (Red strikethrough)*.
- **Dual Visible Guess History:** Real-time visibility into both your guesses and your opponent's guesses.
- **Dark & Light Mode:** Persisted theme preference with high-contrast, modern UI.
- **Web Audio Sound Effects:** Synthesized audio cues for clicks, valid inputs, turn notifications, timers, and game over.

---

## 🚀 Getting Started

### Prerequisites
- Node.js (v18 or higher recommended)
- npm

### Installation
1. Install dependencies:
   ```bash
   npm install
   ```

2. Start the web application:
   ```bash
   npm start
   ```

3. Open your browser:
   ```
   http://localhost:3000
   ```

---

## 🧪 Running Automated Tests

Run the full test suite (unit tests and network integration tests):
```bash
npm test
```

---

## 📱 How to Play

1. **Enter Your Name:** Type your display name on the home screen.
2. **Create or Join a Room:**
   - **Create Game:** Configure digits (4 or 5), game mode, duplicates, and timer.
   - **Invite Friend:** Share the 6-character room code or click **Copy Direct Invite Link**.
   - **Join Game:** Friend enters the code or clicks the link.
3. **Lock In Your Secret:** Both players secretly choose their number according to room rules.
4. **Crack the Code:** Take turns submitting guesses. Use the **Digit Scratchpad (0–9)** to eliminate or mark numbers!
5. **Win or Rematch:** The game announces the winner (or Draw!), reveals both secrets, and offers an instant **Play Again** rematch button!
