---
name: security-review
description: Review Ashvale code changes for browser-game security, dependency, save-data, payment, network, and Yandex Games SDK risks. Use when asked for a security audit, release security check, dependency review, or review of changes involving saves, URLs, postMessage, DOM, purchases, external requests, or src/yandex. Report findings only; do not automatically fix them.
---

# Ashvale Security Review

Perform a read-only review first. Do not edit files, install packages, update dependencies, or apply fixes unless the user explicitly asks after receiving the report.

## 1. Establish scope

1. Read `SECURITY.md` completely before inspecting code.
2. Read `AGENTS.md`; also read `docs/yandex-games-requirements.md` completely when the review covers `src/yandex/`, saves, ads, purchases, platform lifecycle, publishing, localization, or external hosts.
3. Identify changed files with `git status --short`, `git diff --name-only`, and `git diff --cached --name-only`.
4. Include untracked files shown by `git status`. If Git metadata is unavailable, report that limitation and review the files named by the user; if none are named, review relevant files under `src/`, `package.json`, lockfiles, Vite config, and `index.html`.

## 2. Required automated checks

Run these commands without modifying project files. Report failures verbatim enough to diagnose them.

```powershell
npm.cmd audit
npm.cmd run typecheck
npm.cmd run build
```

If a command cannot run, state why and assign a severity only when the limitation creates a concrete release risk.

## 3. Review checks

Inspect changed files first, then surrounding code needed to understand data flow.

- Search for exposed credentials and secrets: API keys, private keys, passwords, bearer tokens, access tokens, refresh tokens, and values injected through client-side Vite variables.
- Search for dangerous execution and DOM patterns: `eval`, `new Function`, `document.write`, `innerHTML`, `outerHTML`, dynamic script injection, and untrusted `href`/`src` values.
- Trace all data from save storage, JSON parsing, URL/query/hash, `postMessage`, form input, and remote responses. Confirm schema/type/range validation before the data changes game state or the DOM.
- Review every network request and external asset URL. Require an explicit HTTPS/WSS allowlist, no client-controlled endpoint, and compatibility with the Yandex Games allowed-host and CSP requirements.
- Review `package.json` and lockfiles for new or suspicious dependencies: unnecessary packages, typosquatting-like names, abandoned packages, broad version ranges for security-critical packages, and install lifecycle scripts. Use `npm audit` as one signal, not the complete assessment.
- Review `src/yandex/` and imports of Yandex SDK. SDK calls must stay isolated behind adapters; `LoadingAPI.ready()` must be timed when the game is usable; focus and fullscreen-ad lifecycle must pause/resume gameplay and audio; SDK failures must retain a safe local fallback.
- For purchases, rewards, currencies, and entitlement-like state, flag any flow that treats a local callback, save value, or browser state as final proof of payment. Require verification from a trusted Yandex/platform or server-side source when implemented.
- Inspect release configuration and `dist/` after the build. Flag source maps, debug panels, debug commands, test bypasses, secrets, or development-only code included in publishable output.

Use targeted `rg` searches before drawing conclusions. Do not report a pattern as a vulnerability without checking whether its input is trusted and how it is used.

## 4. Severity and report

Classify every finding as exactly one severity:

- **CRITICAL** — exposed secret, arbitrary code execution, payment/entitlement bypass, or a vulnerability with immediate severe user or business impact.
- **HIGH** — unvalidated untrusted input reaching a sensitive sink, unsafe external communication, a CSP/Yandex integration failure that compromises release safety, or an exploitable save/state weakness affecting valuable progression.
- **MEDIUM** — missing validation or hardening with limited impact, insecure configuration, risky dependency, source map/debug artefact in production, or incomplete platform lifecycle handling.
- **LOW** — defense-in-depth gap, maintainability issue, or review recommendation without a demonstrated exploit path.

Deliver a concise report with:

1. **Scope** — reviewed files, Git status, and any limitations.
2. **Checks** — `npm audit`, typecheck, and build outcomes.
3. **Findings** — grouped by CRITICAL / HIGH / MEDIUM / LOW; for each include file and line, evidence, impact, and a recommended remediation. Write `None` for empty groups.
4. **Yandex SDK review** — isolation, readiness, lifecycle, local fallback, hosts/CSP, and payment status.
5. **Release verdict** — `BLOCK`, `BLOCK UNTIL RESOLVED`, or `NO SECURITY BLOCKERS FOUND`, with remaining risks.

Do not modify code during this first pass. Offer to implement approved remediations only after delivering the report.
