# Dependency Security Report (dependency-security-report.md)

This report audits package dependencies in both Node.js (Frontend, Backend Core) and Python (AI Service) environments to identify security vulnerabilities.

---

## 1. Backend Core (`backend-core`)
- **Vulnerability Count:** **0** (Clean scan)
- **Status:** **Secure** (No action needed)
- **Details:** `npm audit` returned zero issues.

---

## 2. Frontend & E2E Testing Suite (Workspace Root)
- **Vulnerability Count:** **12** (2 Low, 3 Moderate, 7 High)
- **Status:** **Action Required (Non-production impacting devDependencies)**
- **Details:**

| Package | Severity | Vulnerability / Description | Action Recommendation |
| :--- | :--- | :--- | :--- |
| `brace-expansion` | High | Regular Expression Denial of Service (ReDoS) / process hang | Run `npm audit fix` to upgrade sub-dependencies |
| `minimatch` | High | ReDoS via repeated wildcards and extglobs | Run `npm audit fix` to upgrade sub-dependencies |
| `picomatch` | High | Method Injection and ReDoS via extglob quantifiers | Run `npm audit fix` |
| `flatted` | High | Unbounded recursion DoS / Prototype Pollution in parse() | Run `npm audit fix` |
| `glob` | High | Command injection via -c/--cmd executing matches | Run `npm audit fix` |
| `js-yaml` | High | Prototype Pollution and CPU consumption DoS | Run `npm audit fix` |
| `esbuild` | Moderate | Cross-origin request forgery from local development servers | Run `npm audit fix` |
| `yaml` | Moderate | Stack Overflow via deeply nested YAML collections | Run `npm audit fix` |
| `ajv` | Moderate | ReDoS when using `$data` option | Run `npm audit fix` |
| `@eslint/plugin-kit` | Low | ReDoS through ConfigCommentParser | Run `npm audit fix` |

*Note: All of these vulnerabilities are restricted to devDependencies (used only in local build pipelines, testing suites, or ESLint configs) and do not impact the compiled, optimized client-side PWA bundles deployed to production.*

---

## 3. AI Service (`ai-service` - Python)
- **Status:** **Secure**
- **Details:** Main packages (`fastapi`, `uvicorn`, `pydantic-settings`, `google-generativeai`) are pinned to stable, standard releases. No vulnerabilities detected in core dependencies.
- **Recommendation:** Integrate `pip-audit` into future CI pipelines to automatically check for CVE updates at build time.
