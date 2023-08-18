/* eslint-disable @typescript-eslint/no-var-requires */

Object.assign(global, {
  /**
   * @param {string} sourceFile e.g. "app.js"
   * @param {any} tests jest style test block
   */
  testing: (sourceFile, tests) => {
    eval(`${require("fs").readFileSync(sourceFile)};(${String(tests)})();`);
  },
});
