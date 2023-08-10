const APP_KEY_PROFILE = "dai-app-profile";
const ID_SIMPLE_KEYBOARD = "keyboard";
const ID_GUESSES_WRAPPER = "guesses";
const KEY_BKSPC = "Backspace";
const KEY_ENTER = "Enter";
const GAME_KEYBOARD = [
  [1, 2, 3, 4, 5],
  [6, 7, 8, 9, 0],
  [KEY_BKSPC, "", KEY_ENTER],
];
const CLS_GUESS_ENTRY = "guess-entry";
const CLS_GUESS_ENTRY_SOLVED = "guess-correct";
const CLS_GUESS_DIGIT = "guess-digit";
const CLS_GUESS_COUNT_DEAD = "guess-dead";
const CLS_GUESS_COUNT_INJURED = "guess-injured";
const MAX_GUESS_COUNT = 9;
const MAX_DIGIT_COUNT = 10;
/** @type {{
  setting: {
    digits: number,
    hints: {
      disableImpossible: boolean,
      enableBestGuesses: boolean,
    },
  },
  stats: Record<string, {guesses: string[], solved: boolean}>,
}} */
const EMPTY_PROFILE = Object.freeze({
  setting: {
    digits: 4,
    hints: {
      disableImpossible: false,
      enableBestGuesses: false,
    },
  },
  stats: {},
});

(function init() {
  const profile = loadProfile();
  // TODO: support loading previous date puzzle but not future
  const today = new Date();
  const gameKey = getGameKey(today);
  const numberForTheDay = getNumberForDate(profile.setting.digits, today);
  if (!profile.stats[gameKey]) {
    profile.stats[gameKey] = {
      guesses: [],
      solved: false,
    };
  }

  const currentGame = profile.stats[gameKey];
  // if (
  //   currentGame.guesses.length &&
  //   currentGame.guesses.slice(-1)[0] === numberForTheDay
  // ) {
  //   currentGame.solved = true;
  // }
  // saveProfile(profile);

  // update game state
  const gameKeyboard = document.getElementById(ID_SIMPLE_KEYBOARD);
  /** @type {string[]} */ const stagedGuess = [];
  const hasStagedGuess = () => stagedGuess.length;
  const stagedGuessIsComplete = () =>
    stagedGuess.length === numberForTheDay.length;
  const update = () => {
    const disabled = [...stagedGuess];
    if (!hasStagedGuess()) {
      disabled.push(KEY_BKSPC);
    }
    if (!stagedGuessIsComplete()) {
      disabled.push(KEY_ENTER);
    }

    const gameOver =
      currentGame.solved || currentGame.guesses.length >= MAX_GUESS_COUNT;
    if (gameOver && gameKeyboard) {
      gameKeyboard.ariaDisabled = "true";
    }

    renderKeyboard(stagedGuess, disabled);
    renderGuesses(currentGame.guesses, numberForTheDay, stagedGuess.join(""));
  };

  // listen on game keyboard
  if (gameKeyboard) {
    gameKeyboard.onkeyup = (e) => {
      const num = parseInt(e.key);
      if (Number.isInteger(num) && !stagedGuess.includes(e.key)) {
        stagedGuess.push(e.key);
      } else if (e.key === KEY_BKSPC) {
        stagedGuess.pop();
      } else if (e.key === KEY_ENTER && stagedGuessIsComplete()) {
        const completeGuess = stagedGuess.splice(0).join("");
        currentGame.guesses.push(completeGuess);
        if (completeGuess === numberForTheDay) {
          currentGame.solved = true;
        }
      }
      saveProfile(profile);
      update();
    };
  } else {
    console.error("Game keyboard not initialised");
  }

  saveProfile(profile);
  update();
})();

function loadProfile() {
  return { ...loadValue(APP_KEY_PROFILE, EMPTY_PROFILE) };
}

/**
 * @template T
 * @param {string} key
 * @param {T} fallback
 * @returns {T}
 */
function loadValue(key, fallback) {
  try {
    const storedValue = window.localStorage.getItem(key);
    if (!storedValue) return fallback;
    return JSON.parse(storedValue);
  } catch (e) {
    console.error(e);
    return fallback;
  }
}

/**
 * @template T
 * @param {T} profile
 */
function saveProfile(profile) {
  storeValue(APP_KEY_PROFILE, profile);
}

/**
 * @template T
 * @param {string} key
 * @param {T} value
 */
function storeValue(key, value) {
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch (e) {
    console.error(e);
  }
}

/**
 * Convert date object to string e.g. `2023-09-01` for 1st Sep 2023
 * @param {Date} dateObj
 */
function getGameKey(dateObj) {
  return [
    dateObj.getUTCFullYear(),
    dateObj.getUTCMonth() + 1,
    dateObj.getUTCDate(),
  ]
    .map((v) => `${v < 10 ? "0" : ""}${v}`)
    .join("-");
}

/**
 * @param {number} numDigits
 * @param {Date} dateObj
 */
function getNumberForDate(numDigits, dateObj) {
  const digitPool = new Array(10).fill(null).map((_, i) => i);
  const selectFrom = `${Math.sin(getSeed(dateObj)) * Math.pow(10, 16)}`
    .split("")
    .map(Number);
  /** @type {number[]} */ const generatedNumber = [];
  while (
    generatedNumber.length < Math.min(numDigits, MAX_DIGIT_COUNT) &&
    digitPool.length > 0
  ) {
    generatedNumber.push(
      ...digitPool.splice((selectFrom.pop() ?? 0) % digitPool.length, 1)
    );
  }
  return generatedNumber.join("");
}

/**
 * Get consistent seed from date object
 * @param {Date} dateObj
 */
function getSeed(dateObj) {
  const maxYearDayCount = 366;
  const maxMonthDayCount = 31;
  return (
    dateObj.getUTCFullYear() * maxYearDayCount +
    dateObj.getUTCMonth() * maxMonthDayCount +
    dateObj.getUTCDate()
  );
}

/**
 * @param {string[]} [active]
 * @param {string[]} [disabled]
 */
function renderKeyboard(active, disabled) {
  const simpleKeyboard = document.getElementById(ID_SIMPLE_KEYBOARD);
  simpleKeyboard?.setAttribute(
    "keys",
    window.btoa(JSON.stringify(GAME_KEYBOARD))
  );
  simpleKeyboard?.setAttribute(`data-keyname-${KEY_BKSPC.toLowerCase()}`, "🔙");
  simpleKeyboard?.setAttribute(
    "keys-active",
    window.btoa(JSON.stringify(active ?? []))
  );
  simpleKeyboard?.setAttribute(
    "keys-disabled",
    window.btoa(JSON.stringify(disabled ?? []))
  );
}

/**
 * @param {string[]} guesses
 * @param {string} actual
 * @param {string} stagedGuess
 */
function renderGuesses(guesses, actual, stagedGuess) {
  const guessesContainer = document.getElementById(ID_GUESSES_WRAPPER);
  if (!guessesContainer) return;

  guessesContainer.innerHTML = "";
  const isSolved = guesses.slice(-1)[0] === actual;

  new Array(isSolved ? guesses.length : MAX_GUESS_COUNT)
    .fill("")
    .forEach((g, i) => {
      const useStaged = i === guesses.length;
      const guessWrapper = getGuessDiv(
        guesses[i] ?? (useStaged ? stagedGuess : g),
        actual,
        useStaged
      );
      if (i > guesses.length) {
        guessWrapper.ariaHidden = "true";
      }
      guessesContainer.appendChild(guessWrapper);
    });

  document.body.scrollBy(0, guessesContainer.scrollHeight);
}

/**
 * @param {string} guess
 * @param {string} actual
 * @param {boolean} isStaged
 */
function getGuessDiv(guess, actual, isStaged) {
  const guessTabIndex = 0;
  const guessDivWrapper = document.createElement("div");
  guessDivWrapper.className = CLS_GUESS_ENTRY;
  guessDivWrapper.title = guess;

  let deadCount = 0;
  let injuredCount = 0;
  actual.split("").forEach((n, i) => {
    if (n === guess[i]) deadCount += 1;
    if (guess.includes(n)) injuredCount += 1;
    const digitWrapper = document.createElement("span");
    digitWrapper.className = CLS_GUESS_DIGIT;
    guessDivWrapper.appendChild(digitWrapper);
    digitWrapper.innerHTML = guess[i] ?? "";
  });
  injuredCount -= deadCount;

  if (guess && !isStaged) {
    guessDivWrapper.ariaDisabled = "true";
    guessDivWrapper.tabIndex = guessTabIndex;

    if (deadCount < actual.length) {
      const deadCountWrapper = document.createElement("span");
      deadCountWrapper.className = CLS_GUESS_COUNT_DEAD;
      deadCountWrapper.tabIndex = guessTabIndex;
      guessDivWrapper.appendChild(deadCountWrapper);

      const injuredCountWrapper = document.createElement("span");
      injuredCountWrapper.className = CLS_GUESS_COUNT_INJURED;
      injuredCountWrapper.tabIndex = guessTabIndex;
      guessDivWrapper.appendChild(injuredCountWrapper);

      deadCountWrapper.innerHTML = `${deadCount}`;
      deadCountWrapper.title = `${deadCount} dead`;

      injuredCountWrapper.innerHTML = `${injuredCount}`;
      injuredCountWrapper.title = `${injuredCount} injured`;
    } else {
      guessDivWrapper.classList.add(CLS_GUESS_ENTRY_SOLVED);
    }
  }

  return guessDivWrapper;
}
