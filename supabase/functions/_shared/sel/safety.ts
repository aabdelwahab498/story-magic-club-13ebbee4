// Deterministic safety pre-filter on raw story text.
// Catches the obvious trauma-reject violations before invoking the LLM judge.

import { TRAUMA_REJECT, AGE_BANDS, type AgeBand } from "./constants.ts";

export interface SafetyResult {
  passed: boolean;
  violations: { rule: string; evidence: string }[];
}

const SHAME_PATTERNS = [
  /you should be ashamed/i,
  /bad (boy|girl|child)/i,
  /\bعيب عليك\b/,
  /\bأنت سيء\b/,
];

const PREACH_PATTERNS = [
  /the (moral|lesson) (is|of this story)/i,
  /this story teaches you/i,
  /\bالدرس المستفاد\b/,
];

const FEAR_MARKETING = [
  /if you don'?t .{1,40}, (you|something bad)/i,
  /\bلو ما .{1,40}، (هـ|سوف)\b/,
];

const HOPELESS_ENDINGS = [
  /and nothing changed/i,
  /there was no hope/i,
  /\bلا أمل\b/,
];

export function deterministicSafetyCheck(
  text: string,
  ageBand: AgeBand,
): SafetyResult {
  const violations: SafetyResult["violations"] = [];
  const checks: [RegExp[], string][] = [
    [SHAME_PATTERNS, "shame-language"],
    [PREACH_PATTERNS, "preaching-moral"],
    [FEAR_MARKETING, "fear-marketing"],
    [HOPELESS_ENDINGS, "hopeless-ending"],
  ];
  for (const [patterns, rule] of checks) {
    for (const re of patterns) {
      const m = text.match(re);
      if (m) violations.push({ rule, evidence: m[0].slice(0, 120) });
    }
  }
  // Age-band avoid list (soft check via keywords)
  const band = AGE_BANDS[ageBand];
  if (band) {
    for (const term of band.avoid) {
      if (term === "violence" && /\b(kill|blood|stab|gun|shoot)\b/i.test(text)) {
        violations.push({ rule: `age-avoid:${term}`, evidence: "violent term" });
      }
    }
  }
  return { passed: violations.length === 0, violations };
}

export const TRAUMA_REJECT_LIST = TRAUMA_REJECT;
