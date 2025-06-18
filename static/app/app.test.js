/**
 * @jest-environment jsdom
 */
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-nocheck

testing("static/app/app.js", () => {
  beforeEach(() => {
    jest.restoreAllMocks();
    jest.useRealTimers();
  });

  describe("localStorage", () => {
    beforeEach(() => {
      // reset storage
      window.localStorage.clear();
      jest.clearAllMocks();
    });

    it.each([{ a: "A" }, true, null, ""])(
      "stores value as json retrievable string",
      (testValue) => {
        const keyStr = "key-str";
        const noValueFallback = "NO_VALUE_FALLBACK";
        expect(loadValue(keyStr, noValueFallback)).toEqual(noValueFallback);
        storeValue(keyStr, testValue);
        expect(loadValue(keyStr)).toEqual(testValue);
      }
    );

    it("does not crash when storing unsupported value", () => {
      const keyStr = "key-str";
      const noValueFallback = "NO_VALUE_FALLBACK";
      expect(loadValue(keyStr, noValueFallback)).toEqual(noValueFallback);
      storeValue(keyStr, undefined);
      expect(loadValue(keyStr, noValueFallback)).toEqual(noValueFallback);
    });

    describe("profile", () => {
      it("loads empty profile", () => {
        expect(loadProfile()).toMatchObject(EMPTY_PROFILE);
      });

      it("loads stored profile", () => {
        const profile = { ...EMPTY_PROFILE };
        profile.setting.darkMode = !profile.setting.darkMode;
        saveProfile(profile);
        expect(loadProfile()).toMatchObject(profile);
      });
    });
  });

  describe("getGameDate", () => {
    it.each(["#", "", undefined, null, "2001-01-01"])(
      "loads date now when no valid location hash",
      (hashValue) => {
        // valid far in the past from possible date strings
        const mockDate = new Date("1970-01-01");
        jest.useFakeTimers().setSystemTime(mockDate);
        window.location.hash = hashValue;
        expect(getGameDate()).toEqual(mockDate);
      }
    );
    it.each(["2001-01-01", "1970-01-01"])(
      "loads valid date in the past from location hash",
      (hashDateStr) => {
        // date in the future from all test hash date strings
        const mockDate = new Date("2001-01-02");
        jest.useFakeTimers().setSystemTime(mockDate);
        window.location.hash = hashDateStr;
        expect(getGameDate()).toEqual(new Date(hashDateStr));
      }
    );
  });

  describe("getGameKey", () => {
    it.each(["2001-01-01", "1970-12-01"])(
      "returns valid date game key",
      (dateStr) => {
        const dateObj = new Date(dateStr);
        expect(getGameKey(dateObj)).toEqual(dateStr);
      }
    );
  });

  describe("getDateString", () => {
    it.each(["Mon, 01 Jan 2001", "Tue, 01 Dec 1970"])(
      "returns valid date human readable string",
      (dateStr) => {
        const dateObj = new Date(dateStr);
        expect(getDateString(dateObj)).toEqual(dateStr);
      }
    );
  });

  describe("getNumberForDate", () => {
    it.each([0, 4, 8, 12])(
      "returns correct number of digits for date",
      (numDigits) => {
        const dateObj = new Date("1970-01-01");
        const numberForDateObj = "9041283675";
        expect(getNumberForDate(numDigits, dateObj)).toEqual(
          numberForDateObj.substring(0, numDigits)
        );
      }
    );

    it("distributes numbers somewhat evenly across dates", () => {
      /**
       * Store for each digit i.e. 0..9 how many times it appears in position i.e. index 0..9
       * @type {number[][]}
       */
      const numberDist = new Array(MAX_DIGIT_COUNT)
        .fill(null)
        .map(() => new Array(MAX_DIGIT_COUNT).fill(0));
      const dateObj = new Date("1970-01-01");
      const numDays = 366;
      // variance inbetween the positions of digits on different days
      // i.e. number of times a digit appears in a position
      const varianceThreshold = Math.round(numDays / 6);
      new Array(numDays).fill(null).forEach(() => {
        dateObj.setDate(dateObj.getDate() + 1);
        const numberForDate = getNumberForDate(MAX_DIGIT_COUNT, dateObj);
        numberForDate
          .split("")
          .map(Number)
          .forEach((n, i) => {
            numberDist[n][i] += 1;
          });
      });
      const flattenedList = numberDist.flatMap((n) => n);
      expect(
        Math.max(...flattenedList) - Math.min(...flattenedList)
      ).toBeLessThanOrEqual(varianceThreshold);
    });
  });

  describe("getSuggestion", () => {
    it("returns only possible combinations based on previous guesses", () => {
      const actualNum = "0123";
      // no guesses
      expect(getSuggestion(actualNum, [], "").size).toEqual(10);
      // no guesses and already entered some numbers
      expect(getSuggestion(actualNum, [], "0").size).toEqual(9);
      expect(getSuggestion(actualNum, [], "98").size).toEqual(8);
      expect(getSuggestion(actualNum, [], "012").size).toEqual(7);
      // some guesses none correct
      expect(getSuggestion(actualNum, ["5432"], "").size).toEqual(9);
      // some guesses none correct and already entered some numbers
      expect(getSuggestion(actualNum, ["5432"], "0").size).toEqual(8);
      expect(getSuggestion(actualNum, ["5432"], "98").size).toEqual(3);
      expect(getSuggestion(actualNum, ["5432"], "012").size).toEqual(3);
      // some guesses some already eliminated
      expect(getSuggestion(actualNum, ["9876"], "").size).toEqual(6);
      // some guesses some already eliminated and entered some numbers
      expect(getSuggestion(actualNum, ["9876"], "0").size).toEqual(5);
      expect(getSuggestion(actualNum, ["9876"], "98").size).toEqual(0);
      expect(getSuggestion(actualNum, ["9876"], "012").size).toEqual(3);
      // some guesses all found
      expect(getSuggestion(actualNum, ["3012"], "").size).toEqual(3);
      // some guesses all found and already entered some numbers
      expect(getSuggestion(actualNum, ["3012"], "0").size).toEqual(3);
      expect(getSuggestion(actualNum, ["3012"], "98").size).toEqual(0);
      expect(getSuggestion(actualNum, ["3012"], "012").size).toEqual(1);
      // some guesses all eliminated
      expect(
        getSuggestion(actualNum, ["3012", "2301", "1230"], "").size
      ).toEqual(1);
      // some guesses all eliminated and already entered some numbers
      expect(
        getSuggestion(actualNum, ["3012", "2301", "1230"], "0").size
      ).toEqual(1);
      expect(
        getSuggestion(actualNum, ["3012", "2301", "1230"], "01").size
      ).toEqual(1);
      expect(
        getSuggestion(actualNum, ["3012", "2301", "1230"], "012").size
      ).toEqual(1);
    });

    it("correctly includes all possible suggestions", () => {
      const actualNum = "5097";
      const guesses = ["4321", "9876"];
      const allSuggestions = allPossible(guesses, actualNum);
      expect(allSuggestions).toContain(actualNum);
      expect(allSuggestions).toContain("8065");
    });
  });

  describe("range", () => {
    it.each([
      [2, 1],
      [9, 4],
      [8, -2],
      [10, undefined],
    ])(
      "generates range of numbers from min to max inclusive",
      (to, from = 0) => {
        const rangeList = range(to, from);
        expect(rangeList[0]).toEqual(from);
        expect(rangeList.slice(-1)[0]).toEqual(to);
        expect(rangeList).toHaveLength(to + 1 - (from ?? 0));
      }
    );

    it("does not generate negative range", () => {
      expect(range(1)).toHaveLength(2);
      expect(range(0)).toHaveLength(1);
      expect(range(-1)).toHaveLength(0);
      expect(range(0, 1)).toHaveLength(0);
    });
  });
});
