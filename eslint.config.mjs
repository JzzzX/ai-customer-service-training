import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTypescript from "eslint-config-next/typescript";

export default defineConfig([
  ...nextVitals,
  ...nextTypescript,
  globalIgnores([
    ".next/**",
    ".vercel/**",
    "coverage/**",
    "playwright-report/**",
    "test-results/**",
    "backend/.venv/**",
    "backend/**/__pycache__/**",
    "frontend/dist/**",
    "frontend/node_modules/**",
  ]),
]);
