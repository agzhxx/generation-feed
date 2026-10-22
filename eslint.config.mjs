import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  {
    // Media is pre-encoded on R2 and served with <picture>/<img> (spec 4.3). Feed components
    // and the Genframe Kit's (components/ui, which also run outside Next.js) don't use next/image.
    files: ["components/feed/**", "components/detail/**", "components/ui/**"],
    rules: { "@next/next/no-img-element": "off" },
  },
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // Playwright's reports and traces: generated, and full of minified scripts.
    "test-results/**",
    "playwright-report/**",
  ]),
]);

export default eslintConfig;
