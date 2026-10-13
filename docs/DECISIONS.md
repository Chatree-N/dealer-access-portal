# Architecture & Technical Decisions

This file tracks significant technical and architectural decisions made throughout the project lifecycle.

## 1. Package Manager: pnpm
- **Decision:** Use `pnpm` instead of `npm` or `yarn`.
- **Rationale:** Fast, disk-space efficient (content-addressable store), and strict dependency resolution to avoid phantom dependencies.

## 2. Runtime: Node 22 LTS
- **Decision:** Standardize on Node 22 LTS (or newer LTS).
- **Rationale:** Ensures long-term support, security updates, and performance improvements over older EOL versions like Node 20.

## 3. Database ORM: Drizzle ORM
- **Decision:** Use Drizzle ORM instead of Prisma.
- **Rationale:** 
  - **SQL-like Builder:** Generates predictable and optimizable SQL queries with excellent TypeScript inference.
  - **Lightweight:** Does not require a separate heavy query engine process.
  - **Migrations:** Uses plain SQL migrations that are easy to review and run.

## 4. Scope & Architecture
- **Decision:** The project is a mini/demo application running locally only via Docker Compose.
- **Rationale:** Keeps infrastructure simple and avoids unnecessary cloud deployment complexity for a portfolio piece.

## 5. Rate Limiting
- **Decision:** Implement rate limiting using Postgres counters (`rate_limits` table) and a honeypot field.
- **Rationale:** Avoids the operational burden and vendor lock-in of Upstash/Redis while providing adequate protection for a demo. Cloudflare Turnstile remains a documented future upgrade path.

## 6. Branch Data Seeding
- **Decision:** Use a fixed seed for branch data instead of an external master list.
- **Rationale:** Simplifies setup and guarantees consistent fictional data for the demo.

## 7. Invite Links
- **Decision:** Use fixed room URLs implemented via an `InviteLinkBuilder` interface (`FixedUrlInviteLinkBuilder`). The `invite_tokens` table is included in the schema but unused.
- **Rationale:** Meets current requirements simply while documenting the future expiry mode. The link is never shown on the success page, only sent via email.

## 8. Email
- **Decision:** Use SMTP to Mailpit for local development, abstracted behind an `EmailSender` interface.
- **Rationale:** Provides reliable local testing of outbound emails (e.g., OTPs) without a real provider. Domain-match checks are warning-only and never block submission.

## 9. Admin Authentication
- **Decision:** Single admin login via email/password, hashing stored in `.env.local`, with a signed session cookie. Handled via an `AuthProvider` interface.
- **Rationale:** Avoids the complexity of Auth.js / SSO for a simple demo while keeping the architecture open for future SSO integration.

## 10. File Storage
- **Decision:** Store signature images on local disk under `.data/` (gitignored) via a `StorageProvider` interface.
- **Rationale:** Avoids external dependencies like Google Cloud Storage for local development.

## 11. Design Tokens Update (Axe Accessibility)
- **Finding:** The design token for secondary text (`#6B7280`) on `#F3F4F6` failed WCAG 2.1 AA color contrast (4.39:1 vs required 4.5:1). On `#FAFAFB` it is 4.63:1 and on `#F7F8FA` it is 4.55:1 (both pass).
- **Decision:** Modified the implementation to use `#4B5563` (a darker shade) for secondary text when placed on `#F3F4F6` or darker grey surfaces to ensure accessibility compliance.

- I added fixtures/seed-data.json (34 branches, 4 dealers, 9 rooms, sample requesters) and fixtures/branches.csv. Use seed-data.json as the single source of truth: replace the contents of fixtures/branches.ts with a typed loader over seed-data.json (no duplicated data). Treat status "inactive" as notfound (same generic response). Keep leading zeros (codes are strings). Cover these in unit tests: 0042, 9999, 6001, a dealer with no emailDomains (no warning), a dealer with two domains, uppercase email. Keep room URLs out of anything imported by client components.

## 12. Mock Logic updates (Phase 2A)
- **Decision:** Phase 2 mock lookup runs client-side; Phase 3 moves lookup and domain check to the server and returns only masked data.
- **Rule:** The masking rule is "First word + space + first letter of the second word + …", returning standard generic responses for inactive or invalid branches.

## 13. High-Fidelity Design Implementation (Phase 2B & 2C)
- **Decision:** The application UI was updated to strictly match the design specifications (`design/RequestForm2.dc.html`, `design/FloatField2.dc.html`).
- **Rationale:** Ensure the application accurately reflects the approved design tokens, spacing, typography, and specific component behaviors.
- **Approved Deviations & Standards:**
  - Wording is sanitized for real brands/people, and we exclusively use fictional `*.example` domains (e.g., `jane@example.com`, `lotustelecom.example`) for all fixtures, scenarios, and tests.
  - The use of `#B91C1C` for error text/borders (deviating from `#DC3E3E` in the design) is strictly enforced to satisfy WCAG AA contrast requirements.
  - The Stepper component exactly mirrors the design (e.g. pale green fill `#DCF5E7` with dark green `#2E7D5B` checkmark for completed steps, and violet connectors).
  - The Branch Information card layout, "Next" button label, and required field asterisks were brought to 1:1 parity with the design.
  - The OTP Resend flow perfectly matches the design layout and cooldown text ("Resend code in Ns").

## 14. Database schema (Phase 3A)
- **Status:** Approved & Implemented
- **Context:** Transitioning the application from client-side mock fixtures to a robust PostgreSQL database foundation using Drizzle ORM.
- **Tables (12 tables):**
  1. `dealers`: Dealer entity (`id` PK, `name`, `created_at`).
  2. `dealer_email_domains`: Allowed email domains for warning detection (`id` PK, `dealer_id` FK, `domain`, `created_at`).
  3. `branches`: Branch master data with `dms_code` unique constraint, dealer FK, name, province, region, `status` enum (`active`/`inactive`), and `created_at`.
  4. `openchat_rooms`: Stores OpenChat room configurations (`id` PK, `name`, `url`, `created_at`).
  5. `room_to_dealer_region`: Routing/mapping table linking dealer and region to a specific room (`id` PK, `room_id` FK, `dealer_id` FK, `region_name`, `created_at`).
  6. `consent_texts`: Versions of terms and legal consent text (`version` PK, `content`, `active_from`, `active_to`, `created_at`).
  7. `admin_users`: Administrative accounts for approval back-office (`id` PK, `email` unique, `password_hash`, `role`, `created_at`, `last_login_at`).
  8. `requests`: Public access requests (`id` PK like `REQ-0001`, `branch_id` FK, `first_name`, `last_name`, `email`, `email_verified_at`, `consent_text_version` FK, `consent_at`, `signature_kind` enum, `signature_ref`, `status` enum, `rejection_reason`, `reviewer_id` FK, `room_id` FK, `invite_sent_at`, `ip_hash`, `user_agent`, `created_at`). Composite index on `(email, status)` for duplicate-pending checks.
  9. `email_verifications`: OTP verification tracking (`id` PK, `email`, `code_hash`, `expires_at`, `attempts`, `last_sent_at`, `resend_count`, `locked_until`, `created_at`).
  10. `audit_log`: System and admin audit records (`id` PK, `actor`, `action`, `entity`, `entity_id`, `before` jsonb, `after` jsonb, `created_at`).
  11. `rate_limits`: Postgres counters for IP / request rate limiting (`key` PK, `window_start`, `count`).
  12. `invite_tokens`: Future token-based invite access table (`token_hash` PK, `request_id` FK, `room_id` FK, `expires_at`, `used_at`, `created_at`).
- **Enums:**
  - `branch_status`: `active`, `inactive`
  - `request_status`: `pending_review`, `approved`, `invite_sent`, `rejected`
  - `signature_kind`: `drawn`, `typed`
- **Key Architectural Decisions:**
  - **No `drafts` table:** A server-side drafts table would persist unverified personal identifiable information (PII such as unfinished names, emails, and signatures) prior to consent. To adhere to strict privacy-by-design and prevent unnecessary PII retention, drafts are held strictly in client component state during the session.
  - **`invite_tokens` is unused (per ADR 7):** Fixed room invite URLs are delivered directly via email upon admin approval. The `invite_tokens` table is created in the schema to ensure forward schema compatibility for future single-use token-based invite expiration, but remains unused in the current architecture.
  - **Hashed OTP codes (`code_hash`):** Raw OTP codes are never stored in plaintext in `email_verifications`. Storing one-way cryptographic hashes prevents database read leaks or exposure in logs/backups from compromising verification security.
  - **OpenChat room URL server-side only:** The `url` column in `openchat_rooms` is strictly kept on the server and never exposed to client bundles or public API responses (enforced by `check:bundle` script and `server-only` guards).

## 15. Desktop-Only Architecture
- **Decision:** Desktop-only. Target viewport 1440px. Mobile/responsive layouts are out of scope; WCAG 2.1 SC 1.4.10 Reflow is knowingly not met, all other AA checks still apply.
- **Rationale:** The application is an enterprise internal dealer web portal meant for desktop workstation environments. Dropping mobile complexity allows cleaner styling, reduced maintenance overhead, and focused accessibility on desktop screens.