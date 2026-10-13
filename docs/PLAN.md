# Implementation Plan

## Data Model (PostgreSQL + Drizzle ORM)
- `dealers`: id, name
- `branches`: id, dealer_id, dms_code (unique), name
- `openchat_rooms`: id, name, url
- `requests`: id (e.g. REQ-0001), branch_id, first_name, last_name, email, email_verified_at, consent_text_version, consent_at, signature (string URL to private storage or typed name flag), status (enum: pending_review, approved, invite_sent, rejected), rejection_reason, reviewer_id, room_id, invite_sent_at, created_at, ip_hash, user_agent
- `email_verifications`: id, email, code (hashed), expires_at, attempts, last_sent_at, resend_count, locked_until
- `audit_log`: id, actor, action, entity, before, after, created_at
- `consent_texts`: version (PK), content, active_from, active_to
- `admins_users`: id, email, role, created_at, last_login
- `drafts`: id, session_id, step, data_json (WARNING: holds PII), expires_at (needs TTL + scheduled cleanup)
- `invite_tokens`: token_hash (PK), request_id, room_id, expires_at, used_at (NEVER store raw token) [UNUSED/FUTURE]
- `dealer_email_domains`: id, dealer_id, domain (e.g., `lotustelecom.example`)
- `room_to_dealer_region`: id, room_id, dealer_id, region_name
- `rate_limits`: key (PK), window_start, count

## Architecture & Security
- **Admin Authentication:** Single admin via env vars (`ADMIN_EMAIL`, `ADMIN_PASSWORD_HASH`) using an `AuthProvider` interface. Signed session cookie.
- **Security:** Standard CSRF protection for all mutating endpoints.
- **PII & Logging Rules:** Strictly NO PII (emails, names) in application logs or APM. Only structural logs, request IDs, and masked IPs.
- **Signature Storage:** Local disk storage under `.data/` via a `StorageProvider` interface.
- **Rate Limiting & Bot Protection:** Postgres counters (`rate_limits` table) + a honeypot field.
- **Email:** Sent via SMTP to local Mailpit, abstracted behind an `EmailSender` interface. Domain matches are warning-only.
- **Invite Links:** Fixed room URLs via `FixedUrlInviteLinkBuilder` implementing an `InviteLinkBuilder` interface.

## Phases & Acceptance Criteria
1. **Repo scaffold & Base Components:** Setup Next.js, Tailwind, Drizzle, tokens. Setup a `/dev/components` page. *AC: `FloatField2`, `Button`, `Stepper` match design tokens exactly on `/dev/components`.*
2. **Public Form (Mocked):** Pages 1-4 with all 10 state scenarios + lookup states. *AC: Form logic transitions correctly; UI matches 1440px desktop screenshots.*
3. **Database & API Integration:** Drizzle schema, branch lookup, OTP flow. *AC: Rate limits work. OTP emails send. Branch lookup masks data.*
4. **Admin Back-Office:** Single admin login, Activity log, Approve/Reject flows, Bulk actions. *AC: Admin can preview emails, assign rooms, and reject with reason. Full audit trail recorded.*
5. **Hardening & Security:** E2E tests, a11y audit, CSRF, final pass. *AC: Zero WCAG AA violations. PII stripped from logs.*
6. **Local runbook + README:** Setup in under 5 minutes. *AC: README contains seed, demo script, screenshots, and easy startup instructions.*

## Demo Data
This project uses fictional data for demonstration and public portfolio purposes. All companies, people, emails, and branch codes are entirely fictional and do not correspond to any real entities.

## Resolved Decisions
- **Scope:** Mini/demo project running locally via Docker Compose (Postgres 16 + Mailpit).
- **Rate Limiting:** Postgres counters + honeypot.
- **Branch Data:** Fixed seed across fictional dealers (e.g., 1234 = "Lotus Central Nakhonsawan").
- **Invite Links:** Fixed room URLs. Link is NEVER shown on success page.
- **Email:** Local Mailpit only. Domain matches are warning-only.
- **Admin:** Single admin login, no SSO.
- **Storage:** Local disk `.data/`.

## Open TODOs for owner
1. **Legal:** Final wording for the consent text and data-retention period.
2. **Future Enhancements:** Expiry-link mode via `invite_tokens`, SSO integration, and CAPTCHA (Cloudflare Turnstile).
