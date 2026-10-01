# Line OpenChat Access Request

A public portfolio mini-project demonstrating a Next.js (App Router) form with branch lookup, email OTP verification, canvas signature, and an admin back-office.

[Insert Screenshot Placeholder Here]

## Tech Stack
- **Framework:** Next.js (App Router), React, TypeScript
- **Styling:** Tailwind CSS
- **Database:** PostgreSQL, Drizzle ORM
- **Validation:** Zod, React Hook Form
- **Testing:** Vitest (Unit), Playwright (E2E)
- **Local Infrastructure:** Docker Compose (Postgres 16, Mailpit)

## Local Quickstart
Setup the project locally in under 5 minutes:

1. **Install dependencies:**
   ```bash
   pnpm i
   ```
2. **Start local infrastructure (DB & Mailpit):**
   ```bash
   pnpm db:up
   ```
3. **Run database migrations and seed data:**
   ```bash
   pnpm db:migrate
   pnpm db:seed
   ```
4. **Start the development server:**
   ```bash
   pnpm dev
   ```
   - App is available at: [http://localhost:3000](http://localhost:3000)
   - Mailpit (to view sent OTPs) is available at: [http://localhost:8025](http://localhost:8025)

## Demo Data
This project uses fictional data for demonstration and public portfolio purposes. All companies, people, emails, and branch codes are entirely fictional and do not correspond to any real entities. (e.g. `*.example` domains are used).

The OpenChat room URL is a placeholder, and the project is a demo, not for production use.
