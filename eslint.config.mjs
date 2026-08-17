import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // Deploy output - never lint build artifacts.
    ".vercel/**",
    // Python virtualenv for the data scripts. It is gitignored, but ESLint's
    // flat config does not read .gitignore, so without this it lints the
    // vendored matplotlib JS inside site-packages.
    ".screen-venv/**",
  ]),
]);

export default eslintConfig;
