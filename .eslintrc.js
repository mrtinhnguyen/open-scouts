module.exports = {
  ignorePatterns: ["supabase/functions/**"],
  extends: [
    "next/core-web-vitals",
    "next/typescript",
    "prettier", // Disables ESLint rules that conflict with Prettier
    "plugin:prettier/recommended", // Enables Prettier as an ESLint rule
  ],
  rules: {
    "react/no-unescaped-entities": "off", // allow "'" characters in strings
    "prettier/prettier": "error", // Show Prettier formatting issues as ESLint errors. This enables us to run `pnpm lint` to validate formatting in CI as well as format-on-save via eslint fix-all editor command.

    // NOAA TODO: Uncomment once we're ready to remove `"@typescript-eslint/no-unused-vars": "warn"` below
    // "@typescript-eslint/no-unused-vars": [
    //   "error", // error unless prefixed with underscore
    //   { "argsIgnorePattern": "^_", "varsIgnorePattern": "^_", "caughtErrorsIgnorePattern": "^_" }
    // ],

    "@typescript-eslint/no-unused-vars": "warn", // NOAA TODO: Temporarily suppressing errors until we can address these properly
    "@typescript-eslint/no-explicit-any": "warn", // NOAA TODO: Temporarily suppressing errors until we can address these properly
    "no-await-in-loop": "warn", // NOAA TODO: Temporarily suppressing errors until we can address these properly
    "no-promise-executor-return": "warn", // NOAA TODO: Temporarily suppressing errors until we can address these properly
    "@typescript-eslint/no-unused-expressions": "warn", // NOAA TODO: Temporarily suppressing errors until we can address these properly
    "@typescript-eslint/no-non-null-asserted-optional-chain": "warn", // NOAA TODO: Temporarily suppressing errors until we can address these properly
    "react/display-name": "warn", // NOAA TODO: Temporarily suppressing errors until we can address these properly
    "react-hooks/rules-of-hooks": "warn", // NOAA TODO: Temporarily suppressing errors until we can address these properly
    "react/jsx-no-comment-textnodes": "warn", // NOAA TODO: Temporarily suppressing errors until we can address these properly
    "react/no-children-prop": "warn", // NOAA TODO: Temporarily suppressing errors until we can address these properly
    "@typescript-eslint/ban-ts-comment": "warn", // NOAA TODO: Temporarily suppressing errors until we can address these properly
    "prefer-const": "warn", // NOAA TODO: Temporarily suppressing errors until we can address these properly
  },
  overrides: [
    {
      files: ["**/*.ts", "**/*.tsx"],
      parserOptions: {
        project: "./tsconfig.json",
      },
      rules: {
        "@typescript-eslint/no-floating-promises": "warn", // NOAA TODO: Temporarily suppressing errors until we can address these properly
      },
    },
    {
      files: ["**/*.js"],
      rules: {
        "@typescript-eslint/no-require-imports": "warn",
      },
    },
  ],
};
