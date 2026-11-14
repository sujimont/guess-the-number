const fs = require('fs');
const path = require('path');

async function buildDictionary() {
  console.log('Fetching word lists...');

  // 1. Fetch common 4-letter words
  const res4 = await fetch('https://raw.githubusercontent.com/first20hours/google-10000-english/master/google-10000-english-no-swears.txt');
  const t4 = await res4.text();
  const common4 = [...new Set(t4.split(/[\s\r\n]+/).map(w => w.trim().toUpperCase()).filter(w => w.length === 4 && /^[A-Z]+$/.test(w)))].sort();

  // 2. Fetch common 5-letter words
  const res5 = await fetch('https://gist.githubusercontent.com/cfreshman/a03ef2cba789d8cf00c08f767e0fad7b/raw/');
  const t5 = await res5.text();
  const common5 = [...new Set(t5.split(/[\s\r\n]+/).map(w => w.trim().toUpperCase()).filter(w => w.length === 5 && /^[A-Z]+$/.test(w)))].sort();

  // 3. Fetch Scrabble words for extended valid guess vocabulary
  const resScrabble = await fetch('https://raw.githubusercontent.com/raun/Scrabble/master/words.txt');
  const tScrabble = await resScrabble.text();
  const allScrabble = tScrabble.split(/[\s\r\n]+/).map(w => w.trim().toUpperCase()).filter(w => /^[A-Z]+$/.test(w));

  const valid4 = [...new Set([...common4, ...allScrabble.filter(w => w.length === 4)])].sort();
  const valid5 = [...new Set([...common5, ...allScrabble.filter(w => w.length === 5)])].sort();

  console.log(`Common 4: ${common4.length}, Valid 4: ${valid4.length}`);
  console.log(`Common 5: ${common5.length}, Valid 5: ${valid5.length}`);

  const header = `/**
 * Game Dictionary for Guess The Word (Code Breaker)
 * Universal Module Definition (Node.js + Browser)
 */
(function(root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.GameDictionary = factory();
  }
})(typeof self !== 'undefined' ? self : this, function() {
`;

  const body = `  const common4 = ${JSON.stringify(common4)};
  const common5 = ${JSON.stringify(common5)};
  const valid4 = ${JSON.stringify(valid4)};
  const valid5 = ${JSON.stringify(valid5)};

  const setCommon4 = new Set(common4);
  const setCommon5 = new Set(common5);
  const setValid4 = new Set(valid4);
  const setValid5 = new Set(valid5);

  function hasUniqueLetters(word) {
    return new Set(word).size === word.length;
  }

  function isValidWord(word, length = 4) {
    if (!word || typeof word !== 'string') return false;
    const clean = word.trim().toUpperCase();
    if (clean.length !== length) return false;
    return length === 5 ? setValid5.has(clean) : setValid4.has(clean);
  }

  function isCommonWord(word, length = 4) {
    if (!word || typeof word !== 'string') return false;
    const clean = word.trim().toUpperCase();
    if (clean.length !== length) return false;
    return length === 5 ? setCommon5.has(clean) : setCommon4.has(clean);
  }

  function getCommonWords(length = 4, allowDuplicates = true) {
    const list = length === 5 ? common5 : common4;
    if (allowDuplicates) return list;
    return list.filter(hasUniqueLetters);
  }

  function getRandomSecret(length = 4, allowDuplicates = true) {
    const pool = getCommonWords(length, allowDuplicates);
    if (!pool || pool.length === 0) return length === 5 ? 'ROAST' : 'LION';
    return pool[Math.floor(Math.random() * pool.length)];
  }

  function validateWord(word, length = 4, allowDuplicates = true) {
    if (!word || typeof word !== 'string') {
      return { valid: false, error: 'Word cannot be empty' };
    }
    const clean = word.trim().toUpperCase();
    if (clean.length !== length) {
      return { valid: false, error: 'Word must be exactly ' + length + ' letters' };
    }
    if (!/^[A-Z]+$/.test(clean)) {
      return { valid: false, error: 'Word must contain letters only (A-Z)' };
    }
    if (!allowDuplicates && !hasUniqueLetters(clean)) {
      return { valid: false, error: 'All letters must be unique' };
    }
    if (!isValidWord(clean, length)) {
      return { valid: false, error: 'Not in word list' };
    }
    return { valid: true, cleanWord: clean };
  }

  return {
    common4,
    common5,
    valid4,
    valid5,
    hasUniqueLetters,
    isValidWord,
    isCommonWord,
    getCommonWords,
    getRandomSecret,
    validateWord
  };
});
`;

  const content = header + body;
  fs.writeFileSync(path.join(__dirname, '..', 'lib', 'dictionary.js'), content, 'utf8');
  fs.writeFileSync(path.join(__dirname, '..', 'public', 'js', 'dictionary.js'), content, 'utf8');
  console.log('Successfully generated lib/dictionary.js and public/js/dictionary.js!');
}

buildDictionary().catch(err => {
  console.error('Build error:', err);
  process.exit(1);
});
