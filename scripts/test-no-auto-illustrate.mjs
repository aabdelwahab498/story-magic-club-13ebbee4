#!/usr/bin/env node
// E2E static guard: ensures illustration generation can NOT be triggered
// automatically by story generation. Asserts the Function A / Function B split.
//
// Run: node scripts/test-no-auto-illustrate.mjs
import { readFileSync } from "node:fs";
import { execSync } from "node:child_process";

const fail = (msg) => { console.error("❌ " + msg); process.exitCode = 1; };
const ok = (msg) => console.log("✅ " + msg);

// 1. Backend: compose-story / generate-story must NOT invoke illustration functions.
for (const fn of ["supabase/functions/compose-story/index.ts", "supabase/functions/generate-story/index.ts"]) {
  const src = readFileSync(fn, "utf8");
  if (/illustrate-story|generate-classic-illustrations/.test(src)) {
    fail(`${fn} references an illustration function — Function A must not chain Function B.`);
  } else {
    ok(`${fn} contains no illustration call.`);
  }
}

// 2. Frontend lib: illustration helpers must require trigger:"user".
for (const lib of ["src/lib/selStoryApi.ts", "src/lib/aiStoryApi.ts"]) {
  const src = readFileSync(lib, "utf8");
  if (!/trigger === "user"/.test(src)) {
    fail(`${lib} does not gate illustration invokes by trigger:"user".`);
  } else {
    ok(`${lib} enforces user-triggered illustration calls.`);
  }
}

// 3. SelStoryViewer / AIStoryteller must not call illustration in a useEffect
//    that depends on the story arriving.
const viewer = readFileSync("src/components/SelStoryViewer.tsx", "utf8");
const teller = readFileSync("src/pages/AIStoryteller.tsx", "utf8");
const autoPattern = /useEffect\([^}]*runIllustrate\(/s;
if (autoPattern.test(viewer)) fail("SelStoryViewer has a useEffect that calls runIllustrate.");
else ok("SelStoryViewer does not auto-trigger illustrations.");

if (/useEffect\([^}]*generateSceneIllustrations\(/s.test(teller))
  fail("AIStoryteller has a useEffect that calls generateSceneIllustrations.");
else ok("AIStoryteller does not auto-trigger illustrations.");

// 4. ripgrep cross-check: every invoke("illustrate-story" | "generate-classic-illustrations")
//    must live inside the lib helpers (selStoryApi.ts / aiStoryApi.ts).
const grep = execSync(
  `grep -RIn --include='*.ts' --include='*.tsx' -E 'invoke\\("(illustrate-story|generate-classic-illustrations)"' src/ || true`,
  { encoding: "utf8" },
);
const offenders = grep.split("\n").filter(Boolean).filter((l) => !/src\/lib\/(selStoryApi|aiStoryApi)\.ts/.test(l));
if (offenders.length) {
  fail("Illustration edge function invoked outside lib helpers:\n" + offenders.join("\n"));
} else {
  ok("All illustration invokes go through lib helpers (single chokepoint).");
}

if (process.exitCode) {
  console.error("\n❌ E2E guard FAILED — story generation could leak into image generation.");
  process.exit(1);
}
console.log("\n✅ E2E guard PASSED — Function A (text) and Function B (images) are decoupled.");
