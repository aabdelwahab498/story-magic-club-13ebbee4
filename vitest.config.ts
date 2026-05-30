import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react-swc";
import path from "path";

export default defineConfig({
  plugins: [react()],
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: ["./src/test/setup.ts"],
    include: ["src/**/*.{test,spec}.{ts,tsx}"],
    coverage: {
      provider: "v8",
      reporter: ["text", "html", "json-summary", "lcov"],
      reportsDirectory: "./coverage",
      // Project-wide thresholds are lenient — the project has many untested
      // legacy pages. Strict thresholds are scoped per-file to the
      // illustration pipeline (Function B) so regressions in trigger
      // enforcement / readiness UI block CI immediately.
      thresholds: {
        // Per-file thresholds for illustration-related code paths.
        "src/lib/selStoryApi.ts": {
          statements: 60,
          branches: 50,
          functions: 60,
          lines: 60,
        },
        "src/lib/aiStoryApi.ts": {
          statements: 35,
          branches: 30,
          functions: 35,
          lines: 35,
        },
        "src/lib/trialStoryApi.ts": {
          statements: 30,
          branches: 25,
          functions: 30,
          lines: 30,
        },
        "src/components/SelStoryViewer.tsx": {
          statements: 55,
          branches: 45,
          functions: 50,
          lines: 55,
        },
        "src/components/IllustrateButton.tsx": {
          statements: 90,
          branches: 85,
          functions: 90,
          lines: 90,
        },
      },
      include: [
        "src/lib/selStoryApi.ts",
        "src/lib/aiStoryApi.ts",
        "src/lib/trialStoryApi.ts",
        "src/components/SelStoryViewer.tsx",
        "src/components/IllustrateButton.tsx",
      ],
    },
  },
  resolve: {
    alias: { "@": path.resolve(__dirname, "./src") },
  },
});
