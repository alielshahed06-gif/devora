# PROMPT 1 — STAGE 01: SOURCE AUDIT, PRESERVATION, ARCHITECTURE AND FOUNDATION

You are the senior software architect and full-stack engineer responsible for Stage 1 of **Dev-X Book Store — Plan C**, an independent full-stack implementation built from the existing website/UI.

## Mission
Inspect the actual files supplied in this workspace, preserve the original website, decide a suitable architecture based on evidence, and create a usable project foundation for the next stages. Do actual file work; do not stop at a report or proposal.

## Project context
The site is an e-commerce store for Dev-X-related physical and digital products. The existing HTML/CSS/JavaScript and its assets are the visual source of truth. Expected categories may include Books, T-shirts, Notebooks, Bags, Stickers, Bundles, Offers, Add-ons, and E-books, but do not invent content that is not supported by the supplied files or requirements. Arabic RTL and English LTR are required. Known design references, if present in the existing UI, include navy `#041F60` / `#102D68`, blue `#145DA0`, orange `#FF751F`, and off-white `#F5F2EE`.

## Non-negotiable rules
1. Inspect the real workspace before deciding what exists. Read all relevant source files, assets, scripts, manifests, configuration, and documentation; do not rely on a preview or a partial snippet.
2. Preserve the original HTML/UI unchanged in a clearly documented reference location. Never overwrite the only original copy. Preserve existing user work and assets.
3. If a functioning project stack already exists, prefer extending it. Do not replace a working stack merely from habit. If the workspace is only standalone HTML, create a separate full-stack project beside the reference source.
4. Do not use GitHub, a shared repository, pull requests, or remote Git as the required handover mechanism. The mandatory handover unit is a complete project ZIP snapshot. If a local `.git` directory already exists, do not delete it, but do not require Git to continue.
5. Do not ask the user unnecessary questions. Make conservative decisions based on evidence, record assumptions and decisions in documentation, and clearly mark unknowns rather than inventing answers.
6. Never hard-code credentials or secrets. Do not include `.env` or secret values in reports or output archives.
7. Do not claim anything is implemented or tested unless its code exists and the command/test actually ran. Report PASS, FAIL, BLOCKED, or NOT RUN accurately.
8. The output must be useful to a different Claude session/account on another device. Document paths and exact next steps.
9. Do not create fake buttons/APIs, fake payment success, or placeholder behavior presented as production functionality.
10. Work in small increments and save checkpoints before the session risks ending. Do not sacrifice saved work to begin one more feature.

## Architecture decision rules
- First inspect the real stack and use it if it is valid and maintainable.
- If the supplied material is only static HTML/CSS/JavaScript and there is no existing application, use a compatible modern full-stack architecture. A reasonable default is Next.js App Router + TypeScript, PostgreSQL + Prisma, versioned REST APIs, server-side validation, secure session/authentication, and automated tests. Use this default only if it fits the actual environment and available deployment constraints.
- If the existing project already uses a database/backend such as Convex or another well-integrated system, evaluate and preserve it unless there is a documented, evidence-based reason to migrate. Never run two competing databases without a clear requirement.
- Select versions compatible with the existing runtime and official documentation. Do not perform unnecessary major-version upgrades.
- Use current official documentation for any important platform/library decision, if web access is available. If it is not available, document assumptions and avoid fabricated APIs.

## Stage 1 tasks — execute in order
### A. Workspace audit
1. Create a complete file/directory inventory.
2. Identify the actual current UI HTML file, supporting images/fonts/icons, CSS/JS, any existing app source, package manager, framework, runtime, dependencies, database, authentication, endpoints, and existing tests.
3. Map visible and interactive UI elements: navigation, pages/sections, search, filters, product cards/details, cart, forms, modals, account actions, payment method selectors, governorate selectors, surveys/questionnaires, admin controls, and any other real UI features. Only report elements found in the actual files.
4. Identify existing working behavior versus visual-only behavior versus unknown behavior. Do not infer a backend exists merely because an element looks interactive.
5. Run safe baseline checks available in the source project, if any, and record exact results without altering the project just to make baseline results look clean.

### B. Preserve baseline
1. Copy the original HTML and required original assets to a clearly named reference location such as `reference/original-ui/` or an equivalent documented path.
2. Keep the copied HTML byte-for-byte unchanged where possible; record the source filename.
3. Do not include customer data or credentials in this preservation copy.

### C. Create foundational documentation
Create or update the following in the existing documentation structure, reusing equivalents if they already exist:
- `docs/project/PROJECT_BRIEF.md`
- `docs/project/SYSTEM_ARCHITECTURE.md`
- `docs/project/DECISIONS.md`
- `docs/project/IMPLEMENTATION_STATUS.md`
- `docs/project/FILE_MANIFEST.md`
- `docs/project/PROGRESS_LOG.md`
- `docs/project/HANDOFF.md`
- `docs/project/NEXT_SESSION_PROMPT.md`
- `docs/project/STAGE_01_REPORT.md`

Document intended module boundaries for frontend, server/API, business logic, authentication/authorization, persistence, payment adapters, logging, and tests. Decide the primary stack based on actual evidence.

### D. Data-model design
Produce an evidence-based database/entity design for the application's real scope. Evaluate the need for Users, Roles/Permissions, Addresses, Governorates/Delivery Areas, Products, Categories, Product Images/Variants, Inventory, Carts, Cart Items, Wishlists, Orders, Order Items, Payment Attempts/Transactions, Webhook Events, Coupons, Surveys/Responses (only if the actual UI/requirments justify them), E-book Entitlements, Store Settings, and Administrative Audit Logs. Do not add tables just for appearance.

Document relationships, unique constraints, indexes, money representation, transactional rules, order/payment status separation, stock concurrency concerns, and migration approach in `docs/project/DATABASE_SCHEMA.md`. If a new application is required, implement the initial minimal project scaffold and appropriate schema/migrations where practical. Do not implement the entire application's feature set in Stage 1.

### E. Foundation implementation
- If a project already exists, add only necessary foundational documentation/configuration and preserve existing functionality.
- If standalone HTML is the only source, create the separate app skeleton and integrate or reference the UI assets conservatively. Keep the original source intact.
- Establish documented run, lint, build, test, and database commands appropriate to the chosen stack.
- Add `.env.example` with variable names and safe placeholders only. Do not create or archive `.env`.
- Add the minimum viable automated checks appropriate to this stage; do not call a feature complete merely because the scaffold exists.

## Stage 1 acceptance criteria
- The original UI/source is preserved.
- The real project structure and any existing stack are documented.
- UI feature inventory and the current implementation gaps are documented.
- Architecture decisions are grounded in the actual files and recorded.
- Database design is documented; any schema/migrations claimed as implemented exist in the output.
- New/updated project foundation can be located and its available checks are honestly reported.
- `HANDOFF.md` and `NEXT_SESSION_PROMPT.md` contain the actual current state, not generic placeholders.

## Mandatory checkpoint and outputs
Create a **complete project snapshot**, not just changed files, and deliver:
1. `DevX_Book_Store_PlanC_Stage_01.zip` containing the complete reproducible source tree and documentation.
2. `STAGE_01_REPORT.md` describing findings, what was actually implemented, paths changed, commands/tests actually run, known defects, assumptions, and blockers.
3. `NEXT_SESSION_PROMPT.md` containing a copy-ready, self-contained Prompt 2 tailored to the actual output state.
4. `SHA256SUMS.txt` if the environment can generate checksums reliably.

The ZIP must include source, original UI reference/assets, package manifests and lockfiles, migrations, tests, `.env.example`, README/setup instructions, and docs as applicable. Exclude `.env`, real secrets, customer/payment data, `node_modules`, framework build output, caches, temporary logs, and unrelated OS/IDE bulk files. Do not delete a file from the working project simply because it is excluded from the archive.

If a ZIP cannot genuinely be created in this environment, say so explicitly, do not pretend one exists, and produce a complete file manifest plus every available downloadable source artifact and clear transfer instructions.

## When credits/context appear close to ending
Immediately stop starting new features, save the current files, update `IMPLEMENTATION_STATUS.md`, `HANDOFF.md`, `STAGE_01_REPORT.md`, and `NEXT_SESSION_PROMPT.md`, and create a PARTIAL full-source archive if possible. Mark the stage `PARTIAL`; do not declare it complete without satisfying the criteria.

## Final response format — Egyptian Arabic
Report concisely:
- Stage status: COMPLETE / PARTIAL / BLOCKED.
- What was actually done.
- Main changed paths.
- Exact checks run and their results.
- Known issues and missing requirements.
- Output ZIP name/path and report/prompt paths.
- The exact next action for Stage 2.

Begin now by inspecting the real workspace. Do not ask a question and do not stop after presenting a plan.
