// https://docs.expo.dev/guides/using-eslint/
const { defineConfig } = require("eslint/config");
const expoConfig = require("eslint-config-expo/flat");

module.exports = defineConfig([
  expoConfig,
  {
    ignores: ["dist/*"],
    rules: {
      "object-shorthand": "error",
      "no-console": ["error", { allow: ["warn", "error", "info"] }],
    },
  },
]);
