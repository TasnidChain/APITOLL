import js from "@eslint/js";
import tsParser from "@typescript-eslint/parser";
import tsPlugin from "@typescript-eslint/eslint-plugin";

export default [
  // Base JS recommended rules
  js.configs.recommended,

  // TypeScript files
  {
    files: ["**/*.ts", "**/*.tsx"],
    languageOptions: {
      parser: tsParser,
      parserOptions: {
        ecmaVersion: "latest",
        sourceType: "module",
      },
      globals: {
        // Node.js globals
        process: "readonly",
        console: "readonly",
        setTimeout: "readonly",
        setInterval: "readonly",
        clearTimeout: "readonly",
        clearInterval: "readonly",
        Buffer: "readonly",
        __dirname: "readonly",
        __filename: "readonly",
        module: "readonly",
        require: "readonly",
        exports: "readonly",
        global: "readonly",
        // Web globals
        fetch: "readonly",
        Request: "readonly",
        Response: "readonly",
        URL: "readonly",
        URLSearchParams: "readonly",
        Headers: "readonly",
        AbortController: "readonly",
        FormData: "readonly",
        Blob: "readonly",
        // TypeScript / test
        describe: "readonly",
        it: "readonly",
        expect: "readonly",
        beforeEach: "readonly",
        afterEach: "readonly",
        vi: "readonly",
      },
    },
    plugins: {
      "@typescript-eslint": tsPlugin,
    },
    rules: {
      // ─── Type Safety ──────────────────────────────────────
      // TypeScript handles undefined variables better than ESLint
      "no-undef": "off",
      // Warn on `any` — don't block builds yet, but make it visible
      "@typescript-eslint/no-explicit-any": "warn",

      // ─── Code Quality ─────────────────────────────────────
      "no-unused-vars": "off",
      "@typescript-eslint/no-unused-vars": [
        "warn",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_" },
      ],

      // Prevent accidental console.log in production code
      "no-console": ["warn", { allow: ["warn", "error", "info"] }],

      // ─── Best Practices ───────────────────────────────────
      "no-duplicate-imports": "off", // TypeScript type imports often duplicate module sources
      "no-template-curly-in-string": "warn",
      eqeqeq: ["error", "always"],
      "no-var": "error",
      "prefer-const": "warn",
    },
  },

  // Ignore patterns
  {
    ignores: [
      "node_modules/**",
      "**/node_modules/**",
      "dist/**",
      "**/dist/**",
      ".next/**",
      "**/.next/**",
      "convex/_generated/**",
      "**/.vercel/**",
      "**/*.js",
      "**/*.mjs",
      "!eslint.config.js",
    ],
  },
];
