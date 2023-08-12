const APP_KEY_PROFILE = "dai-app-profile";
const ID_SIMPLE_KEYBOARD = "keyboard";
const ID_GUESSES_WRAPPER = "guesses";
const ID_LINK_PREV_DAY = "link-prev-day";
const ID_LINK_NEXT_DAY = "link-next-day";
const ID_CURRENT_DAY_TAG = "current-day";
const KEY_BKSPC = "Backspace";
const KEY_ENTER = "Enter";
const ALLOWED_NUMBERS = range(9);
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
const CLS_STATS_DETAILS_GROUP = "stats-details-group";
const CLS_STATS_DETAILS_LINE = "stats-details-line";
const CLS_STATS_DIST_LINE_BAR = "stats-dist-line-bar";
const CLS_STATS_LINK_SOLVED_PUZZLE = "stats-link-unsolved";
const MAX_GUESS_COUNT = 9;
const MAX_DIGIT_COUNT = 10;
/** @type {{
  setting: {
    darkMode: boolean,
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
    darkMode: false,
    digits: 4,
    hints: {
      disableImpossible: true,
      enableBestGuesses: true,
    },
  },
  stats: {},
});

const countDeadAndInjured = simpleMemo(_countDeadAndInjured);
const getSuggestion = simpleMemo(_getSuggestion);
const allPossible = simpleMemo(_allPossible);

(function init() {
  const initApp = () => initWith(loadProfile());
  window.addEventListener("hashchange", initApp);
  initApp();
})();

/**
 * @param {ReturnType<typeof loadProfile>} profile
 */
function initWith(profile) {
  // controls
  initThemeControl(profile);
  initDigitControl(profile);
  initHintControl(profile);
  const gameDate = getGameDate();
  const gameKey = getGameKey(gameDate);
  initGameDayControl(gameDate, gameKey);

  // show help on first load
  if (!Object.values(profile.stats).some((k) => k.solved))
    setTimeout(() => showDialog("dialogHelp"));

  // ensure game stats for current game exists
  if (!profile.stats[gameKey]) {
    profile.stats[gameKey] = {
      guesses: [],
      inProgress: true,
      solved: false,
    };
  }

  // initialise constants
  const currentGame = profile.stats[gameKey];
  const numDigits = currentGame.guesses[0]?.length || profile.setting.digits;
  const numberForTheDay = getNumberForDate(numDigits, gameDate);

  /** @type {string[]} */ const stagedGuess = [];
  const hasStagedGuess = () => stagedGuess.length;
  const stagedGuessIsComplete = () =>
    stagedGuess.length >= numberForTheDay.length;

  // update game state when anything changes
  const update = () => {
    const currentGuess = stagedGuess.join("");
    // disable any already included digit
    const disabledKeys = [...stagedGuess];
    // disabled backspace if current guess is empty
    if (!hasStagedGuess()) {
      disabledKeys.push(KEY_BKSPC);
    }
    // disabled all numbers if guess is full otherwise disabled enter button
    if (stagedGuessIsComplete()) {
      disabledKeys.push(...ALLOWED_NUMBERS.map(String));
    } else {
      disabledKeys.push(KEY_ENTER);
    }
    // highlight keys leading to correct guesses
    const activeKeys = profile.setting.hints.enableBestGuesses
      ? Array.from(
          getSuggestion(numberForTheDay, currentGame.guesses, currentGuess)
        ).map(String)
      : [];
    activeKeys.push(...stagedGuess);

    const isOverGuessLimit = currentGame.guesses.length >= MAX_GUESS_COUNT;
    const lastGuessWasCorrect =
      currentGame.guesses.slice(-1)[0] === numberForTheDay;
    // mark game as solved or failed
    if (isOverGuessLimit || lastGuessWasCorrect) {
      if (currentGame.inProgress && lastGuessWasCorrect) {
        // show stats dialog for just solved game
        setTimeout(() => showDialog("dialogStats"), 300);
      }
      currentGame.inProgress = false;
      currentGame.solved = lastGuessWasCorrect;
    }

    const guessesToRender = [...currentGame.guesses];
    if (!currentGame.inProgress && !lastGuessWasCorrect) {
      // reveal correct number
      guessesToRender.push(numberForTheDay);
    }

    renderKeyboard(activeKeys, disabledKeys, currentGame.inProgress);
    renderGuesses(guessesToRender, numberForTheDay, currentGuess);
    renderStatistics(profile, gameKey);
    saveProfile(profile);
  };

  // listen on game keyboard
  const gameKeyboard = document.getElementById(ID_SIMPLE_KEYBOARD);
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

  // start up
  update();
}

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
 * Get game date, clamping to current date but allowing previous days
 */
function getGameDate() {
  const now = new Date();
  const hashDate = new Date(window.location.hash.split("#").pop() ?? now);
  if (Number.isNaN(hashDate.getTime())) return now;
  return new Date(Math.min(now.getTime(), hashDate.getTime()));
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
 * Convert date object to string e.g. `Fri, 01 Sep 2023` for 2023-09-01
 * @param {Date} dateObj
 */
function getDateString(dateObj) {
  return dateObj.toUTCString().slice(0, 16);
}

/**
 * @param {number} numDigits
 * @param {Date} dateObj
 */
function getNumberForDate(numDigits, dateObj) {
  const digitPool = [...ALLOWED_NUMBERS];
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
 * Returns an array with each index being the possible numbers at the position
 * @param {string} actualNumber
 * @param {string[]} submittedGuesses
 * @param {string} stagedGuess
 */
function _getSuggestion(actualNumber, submittedGuesses, stagedGuess) {
  const possible = allPossible(submittedGuesses, actualNumber).filter((p) =>
    p.startsWith(stagedGuess)
  );

  return new Set(possible.map((p) => Number(p.charAt(stagedGuess.length))));
}

/**
 * Get all reasonably possible based on already submitted guesses
 * @param {string} actualNumber
 * @param {string[]} submittedGuesses
 * @returns {string[]}
 */
function _allPossible(submittedGuesses, actualNumber) {
  const isValid = (/** @type {string} */ guess) =>
    new Set(guess).size === guess.length;

  if (submittedGuesses.length) {
    const [latestSubmitted] = submittedGuesses.slice(-1);
    return allPossible(submittedGuesses.slice(0, -1), actualNumber).filter(
      (guess) => {
        const countActual = countDeadAndInjured(actualNumber, latestSubmitted);
        const countGuess = countDeadAndInjured(guess, latestSubmitted);
        return JSON.stringify(countActual) === JSON.stringify(countGuess);
      }
    );
  } else {
    return range(
      Math.pow(10, actualNumber.length) - 1,
      Math.pow(10, Math.max(actualNumber.length - 2, 0))
    )
      .map(String)
      .map((g) => `${g.length < actualNumber.length ? 0 : ""}${g}`)
      .filter(isValid);
  }
}

/**
 * @param {string} actual
 * @param {string} guess
 * @returns {readonly [number, number]}
 */
function _countDeadAndInjured(actual, guess) {
  let deadCount = 0;
  let injuredCount = 0;
  actual.split("").map((n, i) => {
    if (n === guess[i]) deadCount += 1;
    if (guess.includes(n)) injuredCount += 1;
  });
  injuredCount -= deadCount;
  return Object.freeze([deadCount, injuredCount]);
}

/**
 * @param {ReturnType<typeof loadProfile>} profile
 */
function initThemeControl(profile) {
  // theme
  const themes = ["light", "dark"];
  const updateTheme = () =>
    document.body.parentElement?.setAttribute(
      "theme",
      themes[Number(profile.setting.darkMode)]
    );
  themes.forEach((t) => {
    document
      .getElementById(`btn-theme-${t}`)
      ?.addEventListener("click", (e) => {
        e.preventDefault();
        profile.setting.darkMode = !!themes.indexOf(t);
        saveProfile(profile);
        updateTheme();
      });
  });
  updateTheme();
}

/**
 * @param {ReturnType<typeof loadProfile>} profile
 */
function initDigitControl(profile) {
  // digit count
  const digitCountOptMin = 3,
    digitCountOptMax = 7;
  // eslint-disable-next-line @typescript-eslint/ban-ts-comment
  // @ts-expect-error typescript can not handle it
  /** @type {HTMLSelectElement} */ const optWrapper =
    document.getElementById("opt-digits");
  optWrapper && (optWrapper.innerHTML = "");
  optWrapper?.addEventListener("change", () => {
    const newValue = Number(optWrapper.value);
    if (Number.isNaN(newValue)) return;
    profile.setting.digits = Math.max(
      Math.min(newValue, digitCountOptMax),
      digitCountOptMin
    );
    saveProfile(profile);
  });
  range(digitCountOptMax, digitCountOptMin).forEach((value) => {
    const selectOpt = document.createElement("option");
    selectOpt.selected = value === profile.setting.digits;
    selectOpt.value = String(value);
    selectOpt.innerText = selectOpt.value;
    optWrapper?.appendChild(selectOpt);
  });
}

/**
 * @param {ReturnType<typeof loadProfile>} profile
 */
function initHintControl(profile) {
  const toggleButton = document.getElementById("btn-hint-toggle");
  const setEnabled = (/** @type {boolean} */ enabled) => {
    profile.setting.hints.disableImpossible = enabled;
    profile.setting.hints.enableBestGuesses = enabled;
  };
  const isEnabled = () =>
    profile.setting.hints.disableImpossible &&
    profile.setting.hints.enableBestGuesses;
  const updateControlToggle = () =>
    toggleButton &&
    (toggleButton.innerText = isEnabled() ? "Disable" : "Enable");

  toggleButton?.addEventListener("click", (e) => {
    e.preventDefault();
    setEnabled(!isEnabled());
    saveProfile(profile);
    updateControlToggle();
  });

  updateControlToggle();
}

/**
 * @param {Date} gameDate
 * @param {String} gameKey
 */
function initGameDayControl(gameDate, gameKey) {
  // prev day
  const prevGameDate = new Date(gameDate.getTime());
  prevGameDate.setDate(prevGameDate.getDate() - 1);
  const prevDayGameKey = getGameKey(prevGameDate);
  const linkToPreviousDay = document.getElementById(ID_LINK_PREV_DAY);
  linkToPreviousDay?.setAttribute("href", `#${prevDayGameKey}`);
  linkToPreviousDay?.setAttribute(
    "title",
    `Go to game for ${getDateString(prevGameDate)}`
  );

  // next day
  const nextGameDate = new Date(gameDate.getTime());
  const linkToNextDay = document.getElementById(ID_LINK_NEXT_DAY);
  nextGameDate.setDate(nextGameDate.getDate() + 1);
  if (nextGameDate.getTime() < Date.now()) {
    const nextGameDateKey = getGameKey(nextGameDate);
    linkToNextDay?.setAttribute("href", `#${nextGameDateKey}`);
    linkToNextDay?.setAttribute(
      "title",
      `Go to game for ${getDateString(nextGameDate)}`
    );
  } else {
    linkToNextDay?.setAttribute("href", "#");
    linkToNextDay?.setAttribute("title", "Come back tomorrow for a new puzzle");
  }

  // curr day
  const currentDayLabel = document.getElementById(ID_CURRENT_DAY_TAG);
  currentDayLabel?.setAttribute("href", `#${gameKey}`);
  currentDayLabel?.setAttribute(
    "title",
    `Link to current game ${getDateString(gameDate)}`
  );
}

/**
 * @param {string} id
 */
function showDialog(id) {
  // eslint-disable-next-line @typescript-eslint/ban-ts-comment
  // @ts-expect-error
  document.getElementById(id)?.showModal?.();
}

/**
 * @param {string[]} [active]
 * @param {string[]} [disabled]
 * @param {boolean} [inProgress]
 */
function renderKeyboard(active, disabled, inProgress) {
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
  // highlight guide digits
  setTimeout(() => {
    active?.forEach((k) => {
      simpleKeyboard?.shadowRoot
        ?.querySelector(`[data-key="${k}"]:not([aria-disabled])`)
        ?.setAttribute(
          "style",
          "box-shadow: inset var(--color-injured) 0 0 0 0.1em"
        );
    });
  });
  simpleKeyboard?.setAttribute("aria-disabled", String(Boolean(!inProgress)));
}

/**
 * @param {ReturnType<typeof loadProfile>} profile
 * @param {string} gameKey
 */
function renderStatistics(profile, gameKey) {
  // statistics
  const playedGames = Object.entries(profile.stats).filter(
    ([, v]) => v.guesses.length
  );
  /** @type {typeof playedGames} */ const finishedGames = [];
  /** @type {Record<string, string[]>} */ const finishedGamesByLength = {};
  /** @type {Record<string, string[]>} */ const unfinishedGamesByLength = {};

  playedGames.forEach(([gameDateKey, gameState]) => {
    const digitCount = gameState.guesses[0].length;
    let _gamesByLength = unfinishedGamesByLength;
    if (gameState.solved) {
      finishedGames.push([gameDateKey, gameState]);
      _gamesByLength = finishedGamesByLength;
    }
    if (!_gamesByLength[digitCount]) {
      _gamesByLength[digitCount] = [];
    }
    _gamesByLength[digitCount].push(gameDateKey);
  });

  // set the summary tiles
  const playCountWrapper = document.getElementById("stat-play-count");
  playCountWrapper && (playCountWrapper.innerText = `${finishedGames.length}`);
  const statSolveWrapper = document.getElementById("stat-solve-percent");
  const statSolvePercent = playedGames.length
    ? Math.round((100 * finishedGames.length) / playedGames.length)
    : 0;
  statSolveWrapper && (statSolveWrapper.innerText = `${statSolvePercent}`);

  // set the stat details
  const statDetailsWrapper = document.getElementById("stat-details");
  statDetailsWrapper && (statDetailsWrapper.innerHTML = "");
  Object.entries(finishedGamesByLength).forEach(
    ([puzzleLength, puzzleGameKeys]) => {
      const detailsElement = document.createElement("details");
      detailsElement.className = CLS_STATS_DETAILS_GROUP;
      const summaryElement = document.createElement("summary");
      summaryElement.innerText = `Puzzle length ${puzzleLength}`;
      detailsElement.appendChild(summaryElement);
      /** @type {Record<number, number>} */ const solveFreqByGuessCount = {};
      puzzleGameKeys.forEach((key) => {
        const solveGuessCount = profile.stats[key].guesses.length;
        solveFreqByGuessCount[solveGuessCount] =
          (solveFreqByGuessCount[solveGuessCount] ?? 0) + 1;
      });
      const distributionWrapper = document.createElement("div");
      const mostFrequentBucket = Math.max(
        ...Object.values(solveFreqByGuessCount)
      );
      Object.keys(solveFreqByGuessCount)
        .map(Number)
        .sort()
        .forEach((guessCount) => {
          const distributionLine = document.createElement("div");
          distributionLine.className = CLS_STATS_DETAILS_LINE;
          const solveCount = solveFreqByGuessCount[guessCount];
          const percentWidth = Math.round(
            (100 * solveCount) / mostFrequentBucket
          );
          distributionLine.setAttribute(
            "aria-current",
            String(
              Number(puzzleLength) ===
                profile.stats[gameKey].guesses[0].length &&
                guessCount === profile.stats[gameKey].guesses.length
            )
          );
          distributionLine.innerHTML = `<span>${guessCount}</span>
          <span class="${CLS_STATS_DIST_LINE_BAR}" style="width: calc(${percentWidth}%)">${solveCount}</span>`;
          distributionWrapper.appendChild(distributionLine);
        });
      detailsElement.appendChild(distributionWrapper);
      statDetailsWrapper?.appendChild(detailsElement);
    }
  );
  if (!statDetailsWrapper?.innerHTML) {
    statDetailsWrapper?.appendChild(new Text("No solved games"));
  }

  // set the unfinished game links
  const statUnsolvedWrapper = document.getElementById("stat-unsolved");
  statUnsolvedWrapper && (statUnsolvedWrapper.innerHTML = "");
  Object.entries(unfinishedGamesByLength).forEach(
    ([puzzleLength, puzzleGameKeys]) => {
      const detailsElement = document.createElement("details");
      detailsElement.className = CLS_STATS_DETAILS_GROUP;
      const summaryElement = document.createElement("summary");
      summaryElement.innerText = `Puzzle length ${puzzleLength}`;
      detailsElement.appendChild(summaryElement);
      const linksWrapper = document.createElement("div");
      puzzleGameKeys.sort().forEach((key) => {
        const link = document.createElement("a");
        const dateString = getDateString(new Date(key));
        link.title = `Continue puzzle from ${dateString}`;
        link.className = CLS_STATS_LINK_SOLVED_PUZZLE;
        link.href = `#${key}`;
        link.innerHTML = `<span>${dateString}</span><span>${profile.stats[key].guesses.length} attempts</span>`;
        linksWrapper.appendChild(link);
      });
      detailsElement.appendChild(linksWrapper);
      statUnsolvedWrapper?.appendChild(detailsElement);
    }
  );
  if (!statUnsolvedWrapper?.innerHTML) {
    statUnsolvedWrapper?.appendChild(new Text("No unsolved games"));
  }
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

  range(MAX_GUESS_COUNT)
    .map((i) => {
      const useStaged = i === guesses.length;
      const guessWrapper = renderGuessEntry(
        guesses[i] ?? (useStaged ? stagedGuess : ""),
        actual,
        useStaged,
        guessesContainer.children.item(i)
      );
      guessWrapper.setAttribute(
        "hidden",
        String(i > guesses.length || (i === guesses.length && isSolved))
      );
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

  const digitWrappers = guessDivWrapper.getElementsByClassName(CLS_GUESS_DIGIT);
  actual
    .split("")
    .map((_, i) => {
      const digitWrapper =
        digitWrappers.item(i) ?? document.createElement("span");
      digitWrapper.className = CLS_GUESS_DIGIT;
      digitWrapper.textContent = guess[i] ?? "";
      digitWrapper.setAttribute("filled", String(!!digitWrapper.textContent));
      return digitWrapper;
    })
    .forEach((c) => moveChildInto(guessDivWrapper, c));
  // clear out left over elements
  Array.from(digitWrappers)
    .slice(actual.length)
    .forEach((w) => {
      guessDivWrapper.removeChild(w);
    });
  const [deadCount, injuredCount] = countDeadAndInjured(actual, guess);

  if (guess && !isStaged) {
    guessDivWrapper.setAttribute("disabled", "true");
    guessDivWrapper.setAttribute("tab-index", `${guessTabIndex}`);

    if (deadCount < actual.length) {
      deadCountWrapper.innerHTML = `${deadCount}`;
      deadCountWrapper.setAttribute("title", `${deadCount} dead`);

      injuredCountWrapper.innerHTML = `${injuredCount}`;
      injuredCountWrapper.setAttribute("title", `${injuredCount} injured`);
    } else {
      guessDivWrapper.classList.add(CLS_GUESS_ENTRY_SOLVED);
    }
  } else {
    guessDivWrapper.setAttribute("disabled", "false");
  }

  return guessDivWrapper;
}

/**
 * @param {number} to
 * @param {number} [from]
 */
function range(to, from = 0) {
  return new Array(to - from + 1).fill(null).map((_, i) => from + i);
}

/**
 * @template T
 * @param {T extends (...args: any[]) => any ? T : never} fn
 */
function simpleMemo(fn) {
  /** @type {Record<string, ReturnType<typeof fn>>} */
  const argResultMap = {};
  return function memoisedFn(/** @type {Parameters<typeof fn>} */ ...args) {
    const key = JSON.stringify(args);
    if (!(key in argResultMap)) {
      argResultMap[key] = fn(...args);
    }
    return argResultMap[key];
  };
}

/**
 * @param {Element} parentElement
 * @param {Element} childElement
 */
function moveChildInto(parentElement, childElement) {
  if (childElement.parentElement === parentElement) return;
  parentElement.appendChild(childElement);
}

// register pwa
window.addEventListener("load", () => {
  if ("serviceWorker" in navigator) {
    navigator.serviceWorker.register("service-worker.js");
  }
});
