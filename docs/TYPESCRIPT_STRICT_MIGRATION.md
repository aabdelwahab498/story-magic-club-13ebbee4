# TypeScript Strict Migration Documentation

## 1️⃣ Current TypeScript Configuration

| File | Important Flags | Value |
|------|----------------|-------|
| **tsconfig.json** (root) | `allowJs` | `true` |
| | `noImplicitAny` | `false` |
| | `noUnusedLocals` | `false` |
| | `noUnusedParameters` | `false` |
| | `skipLibCheck` | `true` |
| | `strictNullChecks` | `false` |
| **tsconfig.app.json** (frontend) | `noImplicitAny` | `false` |
| | `noUnusedLocals` | **`true`** (enabled for this migration) |
| | `noUnusedParameters` | **`true`** (enabled for this migration) |
| | `strict` | `false` |
| | `target` | `ES2020` |
| **tsconfig.node.json** (node/vite) | `strict` | `true` |
| | `noUnusedLocals` | `false` |
| | `noUnusedParameters` | `false` |

> The project previously disabled most strictness checks to allow rapid development. We have now started enabling unused‑code checks in the app config.

## 2️⃣ Current Strictness Status
- **Unused locals / parameters:** Enabled in `tsconfig.app.json`. All other configs still have them disabled.
- **Implicit `any`:** Still disabled everywhere.
- **Strict null checks & full `strict` mode:** Disabled in the app config.
- **Node config:** Already has `strict: true` but still allows implicit any and unused checks.

## 3️⃣ Existing Problems (as of now)
- **Lint/TS errors** related to **unused variables**, **unused imports**, and **unused function parameters** will appear now that the flags are on.
- **`any` usage** is still pervasive across the codebase, especially in Supabase client calls and custom hooks.
- **Unsafe type casts** (`as any`) appear in many places.
- **Missing return types** on functions/React hooks.
- **Edge functions** contain untyped request/response bodies.
- **Tailwind config** uses CommonJS `require()` which triggers lint warnings.

## 4️⃣ Migration Strategy
### Incremental Approach
1. **Enable unused checks** (completed). Resolve all lint/TS errors that surface.
2. **Enable `noImplicitAny`** next, then replace every implicit `any` with proper types.
3. **Enable `strictNullChecks`** (or full `strict`) once the previous steps are clean.
4. **Iteratively run**:
   ```bash
   npm run lint
   npx tsc --noEmit
   npm run build
   npx vitest run
   ```
   after each batch of fixes.

### Per‑Area Focus
- **Frontend (`src/`)** – hooks, components, pages, lib utilities.
- **Supabase integration** – use generated types from `src/integrations/supabase/types.ts`.
- **Edge Functions** – add request/response interfaces, use `unknown` + type guards.
- **React hooks** – validate dependency arrays, avoid stale closures.
- **Configuration files** – convert Tailwind config to ESM.

## 5️⃣ Completed Steps
- Created this migration documentation (`docs/TYPESCRIPT_STRICT_MIGRATION.md`).
- Updated `tsconfig.app.json` to enable `noUnusedLocals` and `noUnusedParameters`.
- Verified that the file change was successfully saved.

## 6️⃣ Remaining Tasks
| Phase | Action | Goal |
|-------|--------|------|
| **A** | Run lint & `tsc` to collect all *unused* warnings/errors. | Fix them across the codebase. |
| **B** | Enable `noImplicitAny` in `tsconfig.app.json`. | Replace all implicit any occurrences. |
| **C** | Harden Supabase calls with generated types. |
| **D** | Refactor edge functions for typed request/response. |
| **E** | Convert `tailwind.config.ts` to ESM import style. |
| **F** | Review React hooks for proper dependency lists and remove stale closures. |
| **G** | After each batch, run full test suite and build. |

---

*This document will be updated as we progress through the migration.*
