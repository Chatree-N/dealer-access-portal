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
