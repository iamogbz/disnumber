const APP_KEY_PROFILE = "dai-app-profile";
const ID_SIMPLE_KEYBOARD = "keyboard";
const ID_GUESSES_WRAPPER = "guesses";
const KEY_BKSPC = "Backspace";
const KEY_ENTER = "Enter";
const ALLOWED_NUMBERS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 0];
const GAME_KEYBOARD = [
  ALLOWED_NUMBERS.slice(0, Math.ceil(ALLOWED_NUMBERS.length / 2)),
  ALLOWED_NUMBERS.slice(-Math.floor(ALLOWED_NUMBERS.length / 2)),
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
  stats: Record<string, {guesses: string[], inProgress: boolean, solved: boolean}>,
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
      inProgress: true,
      solved: false,
    };
  }

  const currentGame = profile.stats[gameKey];

  // update game state
  const gameKeyboard = document.getElementById(ID_SIMPLE_KEYBOARD);
  /** @type {string[]} */ const stagedGuess = [];
  const hasStagedGuess = () => stagedGuess.length;
  const stagedGuessIsComplete = () =>
    stagedGuess.length >= numberForTheDay.length;
  const update = () => {
    const disabled = [...stagedGuess];
    if (!hasStagedGuess()) {
      disabled.push(KEY_BKSPC);
    }
    if (stagedGuessIsComplete()) {
      disabled.push(...ALLOWED_NUMBERS.map(String));
    } else {
      disabled.push(KEY_ENTER);
    }

    const isOverGuessLimit = currentGame.guesses.length >= MAX_GUESS_COUNT;
    const lastGuessWasCorrect =
      currentGame.guesses.slice(-1)[0] === numberForTheDay;
    if (isOverGuessLimit || lastGuessWasCorrect) {
      currentGame.inProgress = false;
      currentGame.solved = lastGuessWasCorrect;
      if (gameKeyboard) {
        gameKeyboard.ariaDisabled = "true";
      }
    }

    const currentGuess = stagedGuess.join("");
    const previousGuesses = [...currentGame.guesses];
    if (!currentGame.inProgress && !lastGuessWasCorrect) {
      // reveal correct number
      previousGuesses.push(numberForTheDay);
    }

    renderKeyboard(stagedGuess, disabled);
    renderGuesses(previousGuesses, numberForTheDay, currentGuess);
    saveProfile(profile);
  };

  // listen on game keyboard
  if (gameKeyboard) {
    gameKeyboard.onkeyup = (e) => {
      const isValidGuessKey = (/** @type {string} */ k) =>
        Number.isInteger(parseInt(k)) && !stagedGuess.includes(k);
      if (isValidGuessKey(e.key)) {
        stagedGuess.push(e.key);
      } else if (e.key === KEY_BKSPC) {
        stagedGuess.pop();
      } else if (e.key === KEY_ENTER && stagedGuessIsComplete()) {
        const completeGuess = stagedGuess.splice(0).join("");
        currentGame.guesses.push(completeGuess);
      }
      update();
    };
  } else {
    console.error("Game keyboard not initialised");
  }

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

  const isSolved = guesses.slice(-1)[0] === actual;

  new Array(isSolved ? guesses.length : MAX_GUESS_COUNT + 1)
    .fill("")
    .map((g, i) => {
      const useStaged = i === guesses.length;
      const guessWrapper = renderGuessEntry(
        guesses[i] ?? (useStaged ? stagedGuess : g),
        actual,
        useStaged,
        guessesContainer.children.item(i)
      );
      guessWrapper.ariaHidden = i > guesses.length ? "true" : "false";
      return guessWrapper;
    })
    .forEach((c) => moveChildInto(guessesContainer, c));

  document.body.scrollBy({
    behavior: "smooth",
    left: 0,
    top: guessesContainer.scrollHeight,
  });
}

/**
 * @param {string} guess
 * @param {string} actual
 * @param {boolean} isStaged
 * @param {Element?} recycle
 */
function renderGuessEntry(guess, actual, isStaged, recycle) {
  const guessTabIndex = 0;
  const guessDivWrapper = recycle ?? document.createElement("div");
  guessDivWrapper.className = CLS_GUESS_ENTRY;
  guessDivWrapper.setAttribute("title", guess);

  const deadCountWrapper =
    guessDivWrapper.getElementsByClassName(CLS_GUESS_COUNT_DEAD).item(0) ??
    document.createElement("span");
  deadCountWrapper.className = CLS_GUESS_COUNT_DEAD;
  deadCountWrapper.setAttribute("tab-index", `${guessTabIndex}`);
  moveChildInto(guessDivWrapper, deadCountWrapper);

  const injuredCountWrapper =
    guessDivWrapper.getElementsByClassName(CLS_GUESS_COUNT_INJURED).item(0) ??
    document.createElement("span");
  injuredCountWrapper.className = CLS_GUESS_COUNT_INJURED;
  injuredCountWrapper.setAttribute("tab-index", `${guessTabIndex}`);
  moveChildInto(guessDivWrapper, injuredCountWrapper);

  let deadCount = 0;
  let injuredCount = 0;
  actual
    .split("")
    .map((n, i) => {
      if (n === guess[i]) deadCount += 1;
      if (guess.includes(n)) injuredCount += 1;
      const digitWrapper =
        guessDivWrapper.getElementsByClassName(CLS_GUESS_DIGIT).item(i) ??
        document.createElement("span");
      digitWrapper.className = CLS_GUESS_DIGIT;
      digitWrapper.textContent = guess[i] ?? "";
      digitWrapper.setAttribute("filled", String(!!digitWrapper.textContent));
      return digitWrapper;
    })
    .forEach((c) => moveChildInto(guessDivWrapper, c));
  injuredCount -= deadCount;

  if (guess && !isStaged) {
    guessDivWrapper.ariaDisabled = "true";
    guessDivWrapper.setAttribute("tab-index", `${guessTabIndex}`);

    if (deadCount < actual.length) {
      deadCountWrapper.innerHTML = `${deadCount}`;
      deadCountWrapper.setAttribute("title", `${deadCount} dead`);

      injuredCountWrapper.innerHTML = `${injuredCount}`;
      injuredCountWrapper.setAttribute("title", `${injuredCount} injured`);
    } else {
      guessDivWrapper.classList.add(CLS_GUESS_ENTRY_SOLVED);
    }
  }

  return guessDivWrapper;
}

/**
 * @param {Element} parentElement
 * @param {Element} childElement
 */
function moveChildInto(parentElement, childElement) {
  if (childElement.parentElement === parentElement) return;
  parentElement.appendChild(childElement);
}
