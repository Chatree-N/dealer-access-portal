# Design Specification

> **Source of Truth:** Files in `./design/` (v2 English-only)

## 1. Design Tokens
- **Typography:** `Inter` (UI), `JetBrains Mono` (codes, monospace). NO Noto Sans Thai.
- **Colors:**
  - **Brand:** `#6D3FE0`, Hover: `#5B2FCB`
  - **Success:** `#2E7D5B` / `#DCF5E7`
  - **Warning:** `#B45309` / `#FEF3C7` / `#FFFBEB`
  - **Danger:** `#DC3E3E` / `#FEE2E2`
  - **Info:** `#2F5BE0` / `#DBE6FF`
  - **Text:** `#0F1220`, `#111827`, `#374151`, `#6B7280`, `#9CA3AF`
  - **Surfaces/Borders:** `#FFFFFF`, `#FAFAFB`, `#F7F8FA`, `#F3F4F6`, `#E5E7EB`
- **Spacing Scale:** `2px, 4px, 6px, 8px, 10px, 12px, 14px, 16px, 18px, 20px, 24px, 28px, 32px, 40px, 48px`
- **Border Radius:** `6px`, `8px`, `9px`, `10px` (buttons/inputs), `12px` (cards), `16px` (wrappers)
- **Shadows:**
  - Focus Ring: `0 0 0 2px rgba(109,63,224,.3)` or `rgba(220,62,62,.3)`
  - Primary Button: `0 1px 2px rgba(15,18,32,.08), 0 4px 12px rgba(109,63,224,.22)`
- **Viewport:** Desktop-only target 1440px (per ADR 15; mobile layout dropped).
- **Z-Index:** Header `30`, Admin Drawer `20`, Pins/Badges `4`.

## 2. Copy Deck (English Only)
*(No phone number mentions anywhere)*
- **Header:** "Line OpenChat Access Request", "For dealer branch coordinators"
- **Page 1:** "Enter your branch code", "Used to verify your eligibility to join the Line OpenChat group."
- **Page 2:** "Your details", "Tell us who should receive the invite."
- **Page 2 (Verify):** "Verify your email", "Enter the 6-digit code we sent to [email]."
- **Page 3:** "Consent & signature", "Review the terms, confirm, and sign to submit."
- **Page 4 (Success):** "Request submitted", "We'll review your details and email the Line OpenChat invite link to [email]." (Invite link is NEVER shown here).
- **Admin Statuses:** "Pending review", "Approved", "Invite sent", "Rejected"
- **Inputs:** "Branch code", "First name", "Last name", "Email address", "Verification code", "Signature (typed)"

## 3. FloatField2 Props & States
- **Props:** `label`, `required`, `placeholder`, `helper`, `error`, `warning`, `success`, `locked`, `disabled`, `loading`, `forceFocus`, `mono`, `icon` (search, user, mail, key, pen, calendar), `value`, `options`.
- **States:** Default, Focus, Filled, Error, Warning, Success, Loading, Locked, Disabled, Verification Code (wide mono), Select, Select Focus.

## 4. RequestForm2 Scenarios & Lookup States

### Form Scenarios (10)
1. **network:** Shows "Connection problem. We couldn't reach the server." alert with Retry button.
2. **errors:** Displays inline validation errors for inputs (e.g., invalid email).
3. **domain:** Displays warning "This email isn't on [domain], your dealer's domain. Approval may take longer."
4. **dupe:** Alert "A request for this email is already pending" with Request ID and "Use a different email".
5. **verify-sent:** Prompts user to enter 6-digit OTP sent to their email; shows countdown.
6. **verify-wrong:** OTP error state inline ("That code doesn't match...").
7. **verify-ok:** Displays "Email verified" success banner.
8. **typed-sig:** Fallback typed name signature input instead of drawn canvas.
9. **incomplete:** Step 3 terms shown, but signature/consent incomplete, submit button disabled.
10. **expired:** Session expired banner "We saved your draft. Resume to pick up where you left off."

### Branch Lookup States
- **idle:** Waiting for branch code input.
- **loading:** Checking branch code ("Verifying…").
- **found:** Branch found banner with masked preview (`Lotus… / LOTUS…`).
- **notfound:** Branch not found error inline.

## 5. Admin Board
- **List/Filters:** Status filters (All, Pending, Approved, Sent, Rejected), Search bar, Export CSV.
- **Badges:** SLA ("Waiting X hours/days"), "Link expires in X days", "Link expired".
- **Bulk Actions:** Select all, "Approve & send invites", "Reject…", "Export selected", "Clear".
- **Drawer (Approve):** Room assignment, email preview, send invite.
- **Drawer (Reject):** Reject reason required, optional note.
- **Resend Invite:** "Resend invite" button for already sent requests.
- **Audit Trail:** "Activity" tab logs every action (lookup, verification, consent, approval, rejection, resend) with who, when, and what.

## 6. Design Principles
1. **Ask only what we can't already know:** Branch data is auto-filled and locked. The requester types only first name, last name, and email. No more than 3–4 inputs per screen.
2. **One purpose per step, progress always visible:** Vertical stepper on desktop. Below 900px it becomes a compact "Step X of 3" bar.
3. **Persistent labels with a visible example:** Labels sit on the border and never disappear. The example placeholder stays visible on focus.
4. **Concise microcopy under fields:** One line, only where it prevents a mistake. No paragraphs inside the form.
5. **Buttons name the action:** "Verify branch code", "Verify email", "Submit request" instead of a generic "Next".
6. **Inline errors that say how to fix:** Errors replace the helper text, use an icon and the "Error:" prefix, and give the correct format or a next step.
7. **Accessible by default:** Contrast of 4.5:1 or higher, including placeholders. Visible focus rings, 44–48px targets, labels tied to inputs, numeric/email keyboards, aria-live lookup results, and a typed-name option instead of drawing a signature.
8. **Trust cues near consent:** The PDPA statement and Privacy Policy link sit right next to the checkbox, with a clear purpose for the data.
9. **Verify before we send:** Invites go only to an email proven with a 6-digit code: resend countdown, limited attempts, clear wrong-code errors.
10. **Don't leak what you protect:** The lookup shows a masked preview (Lotus… / LOTUS…), is rate-limited, and returns the same generic message for unknown codes.
11. **Everything is auditable:** Every lookup, verification, consent, approval, rejection, and resend is logged with who, when, and what.
