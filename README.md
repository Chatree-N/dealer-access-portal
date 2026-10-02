# Dealer Access Portal

A portfolio demo of a **Line OpenChat access request** flow for dealer branch staff:
branch lookup → email OTP → consent + signature → admin approval → invite by email.
Built with Next.js, TypeScript and a violet Soft-UI design system.

> **Status: work in progress.** The public request form (Phase 2) is complete and runs on mock data.
> The database, admin back-office and real email delivery are planned (see Roadmap).
> **All data is fictional.** Companies, people, branch codes and emails are invented (`*.example` domains).
> The OpenChat room URL is a placeholder and is never sent to the browser.

## Screenshots

| Branch lookup | Your details | Consent & signature | Request submitted |
|---|---|---|---|
| ![Step 1](screenshots/phase2/step1-found.png) | ![Step 2](screenshots/phase2/step2-verified.png) | ![Step 3](screenshots/phase2/step3-signature.png) | ![Step 4](screenshots/phase2/step4-success.png) |

Mobile (375px) versions and 10 edge-case states live in `screenshots/`.

## What works today

- 4-step public form: branch lookup with masked dealer/branch names, requester details, email OTP, consent and drawn/typed signature
- OTP rules as pure, tested functions: 6 digits, 10-minute expiry, 60-second resend cooldown, max 3 attempts
- Email-domain mismatch is a warning only (never blocks)
- Honeypot field for bots
- `/dev/components` (component playground) and `/dev/scenarios?s=<id>` (10 deterministic UI states); both return 404 in production
- Bundle-leak check (`pnpm check:bundle`) that fails if the room URL or sample emails reach the client bundle
- Accessibility: axe checks on every step and scenario, WCAG AA contrast, keyboard focus handling

## Try it locally

Requires Node 22 and pnpm.

```bash
pnpm install
pnpm dev          # http://localhost:3000
```

Demo inputs:

| Input | Value |
|---|---|
| Branch code (found) | `1234` |
| Branch code (inactive / not found) | `9999`, `0000` |
| OTP code (mock) | `123456` |

## Scripts

| Command | Purpose |
|---|---|
| `pnpm lint` / `pnpm typecheck` | ESLint / TypeScript |
| `pnpm test` | Vitest unit tests |
| `pnpm e2e` | Playwright end-to-end + axe accessibility tests |
| `pnpm build` then `pnpm check:bundle` | Production build and client-bundle leak check |
| `pnpm db:*` | Reserved for Phase 3 (PostgreSQL + Drizzle); Docker Compose file included |

## Tech stack

Next.js (App Router), React, TypeScript (strict), Tailwind CSS v4, React Hook Form + Zod,
Vitest + Testing Library, Playwright + axe-core. Planned: PostgreSQL 16 + Drizzle, Mailpit.

## Design and decisions

- Design source of truth: [`design/`](design/) (exported from Claude Design), summarised in [`docs/DESIGN_SPEC.md`](docs/DESIGN_SPEC.md)
- Architecture decisions (ADR 1–13): [`docs/DECISIONS.md`](docs/DECISIONS.md)
- Plan and phases: [`docs/PLAN.md`](docs/PLAN.md)
- Interfaces keep infrastructure swappable: `EmailSender`, `InviteLinkBuilder`, `StorageProvider`, `AuthProvider`

## Roadmap

| Phase | Scope | Status |
|---|---|---|
| 1 | Scaffold, design tokens, base components | Done |
| 2 | Public request form, mock logic, scenarios, tests | Done |
| 3 | PostgreSQL schema, server-side lookup and rate limiting | Planned |
| 4 | Admin back-office (approve / reject) | Planned |
| 5 | Email delivery via Mailpit (OTP and invite) | Planned |
| 6 | Local runbook and polish | Planned |

## Notes

- Consent text is a draft placeholder (`v0-draft [Legal to confirm]`) and not legal advice.
- Built with AI-assisted tooling; see `CLAUDE.md` and `AGENTS.md` for the working rules used.
- License: not yet specified (all rights reserved). Add a `LICENSE` file if you want others to reuse the code.