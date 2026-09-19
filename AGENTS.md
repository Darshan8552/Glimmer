# AGENTS.md

Instructions for AI coding agents working in this repository. Read this file fully before changing anything.

Claude Code loads this file through `@AGENTS.md` in `CLAUDE.md`. Claude-specific instructions go in `CLAUDE.md` **below** the import, not here.

> **Default skills:** At the start of every session, load and follow `ponytail` and `using-superpowers` skills unless explicitly told otherwise.

---

## 0. Bootstrap — fill the placeholders

Sections tagged `<!-- UNFILLED -->` are project facts that nobody has recorded yet.

**Trigger this procedure when placeholders remain and any of the following happens:**

- The user describes what this project is, its stack, or its structure.
- The user asks for the first code change of a session in this repo.
- The user says "init", "onboard", "set up agents", or "update AGENTS.md".

**Procedure:**

1. Gather evidence from the repo, never from memory: `package.json` (scripts, dependencies, `packageManager`, `engines`), the lockfile, framework / TypeScript / lint / test config files, `.env.example`, and the top two levels of the directory tree.
2. Draft a replacement for each unfilled section. Anything you cannot verify from a file → write `UNKNOWN — ask user`. Do not invent versions, commands, or paths.
3. Show the draft to the user and ask for confirmation.
4. On approval, edit this file in place: replace only the placeholder blocks, leave every other line untouched, and delete the `<!-- UNFILLED -->` marker from each section you filled.
5. Keep this file under 200 lines. If a section outgrows that, move it to `docs/` or `.claude/rules/` and link to it from here.

**Maintenance:** when a change alters commands, dependencies, structure, or environment variables, update the matching section in the same change. A stale AGENTS.md is worse than a short one.

---

## 1. Project overview

- **What it is:** Glimmer — a fast AI chat app with three model tiers (Glimmer 4, Glimmer 4 Turbo, Glimmer 3.5), streaming replies, and conversation persistence per account. Built on Next.js 16 with the Vercel AI SDK, using NVIDIA NIM models via OpenAI-compatible API.
- **Who uses it:** End users who sign up via email/password or Google OAuth, then chat with tiered models. Conversations saved to their account.
- **Stage:** active development
- **Non-obvious context an agent would get wrong:**
  - NIM only supports Chat Completions API, not Responses API — the code uses `.chat()` not default factory (see `ai/models.ts:60-63`)
  - Better Auth handles email OTP verification + Google OAuth; sessions via `nextCookies()` plugin
  - Database is Neon (PostgreSQL) via Drizzle ORM; schema in `lib/db/schema.ts`
  - Three tiers map to specific NIM models defined in `ai/models.ts:5-21`
  - Auth routes at `app/api/auth/[...all]/route.ts` (catch-all)

---

## 2. Stack and versions

| Layer | Choice | Version | Source of truth |
| --- | --- | --- | --- |
| Runtime (Node) | Node.js | 20+ | `package.json` (`@types/node`) |
| Language | TypeScript | 5.x | `package.json` |
| Framework | Next.js | 16.3.5 | `package.json` |
| Styling / UI | Tailwind CSS v4 + next-themes | 4.x / 0.4.6 | `package.json` |
| Data layer (DB, ORM, client) | Drizzle ORM + Neon (PostgreSQL) | 0.45.2 / 1.1.0 | `package.json` |
| Auth | Better Auth | 1.7.5 | `package.json` |
| Testing | *none configured* | — | — |
| Lint / format | ESLint 9 (eslint-config-next) | 9.x | `package.json` |
| Deploy target | Vercel (implied by Next.js) | — | — |

**Rule:** versions come from `package.json` and the lockfile, not from memory. Before using any library API, confirm it against the docs for the **installed major version**. Avoid deprecated, removed, or unstable APIs. If installed and latest differ in a way that matters, say so instead of silently coding to either.

---

## 3. Repository layout

```text
.
├── app/                    # Next.js App Router pages & API routes
│   ├── (auth)/             # Auth pages (signin, signup, verify-otp)
│   ├── (main)/             # Protected pages (chat, settings)
│   └── api/                # API routes (auth, chat, conversations)
├── components/             # React components (theme, glimmer-mark)
├── lib/                    # Shared utilities
│   ├── auth.ts             # Better Auth config
│   ├── auth-client.ts      # Client auth helpers
│   ├── api-auth.ts         # requireUserId helper
│   ├── db/                 # Drizzle DB setup
│   │   ├── index.ts        # DB client
│   │   ├── schema.ts       # Tables (user, session, account, verification, conversation, message)
│   │   └── migrations/     # Drizzle migrations
│   └── email.ts            # Brevo email sender
├── ai/
│   └── models.ts           # Model registry (3 NIM tiers), getModel, system prompts
├── .agents/skills/         # Installed opencode skills
├── docs/agent-notes/       # Session notes
├── public/                 # Static assets
├── .env.local              # Environment variables (secrets — do not commit)
└── configuration files     # package.json, tsconfig.json, next.config.ts, eslint.config.mjs, drizzle.config.ts
```

- **App entry point:** `app/page.tsx` (redirects to `/chat` if authenticated)
- **New feature code goes in:** `app/(main)/` for pages, `app/api/` for routes, `lib/` for shared logic
- **Shared utilities go in:** `lib/`
- **Tests live in:** *none configured*

---

## 4. Commands

Use **pnpm** for everything. Never npm, never yarn.

| Purpose | Command |
| --- | --- |
| Install | `pnpm install` |
| Dev server | `pnpm dev` |
| Build | `pnpm build` |
| Start (prod) | `pnpm start` |
| Lint | `pnpm lint` |
| Typecheck | `tsc --noEmit` (not in scripts; run manually) |
| Test (all) | *none configured* |
| Test (single file) | *none configured* |
| Format | *none configured* (ESLint handles via `pnpm lint`) |
| DB migrate / generate | `pnpm db:migrate` / `pnpm db:generate` |

If a script is not in `package.json` → do not run it, do not guess an equivalent. Check `scripts` first, then ask.

---

## 5. Environment and configuration

- **Env files:** `.env.local` (local development)
- **Example file:** *missing — create `.env.example` with dummy placeholders*
- **How config is loaded / validated:** Next.js built-in dotenv; validated at runtime in `ai/models.ts:41-44` (throws if `NVIDIA_NIM_API_KEY` missing)
- **Required variable names:**
  - `GROQ_API_KEY` (unused currently)
  - `BREVO_API_KEY`, `BREVO_SENDER_EMAIL`, `BREVO_SENDER_NAME` (email OTP)
  - `DATABASE_URL` (Neon PostgreSQL)
  - `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` (OAuth)
  - `BETTER_AUTH_URL`, `BETTER_AUTH_SECRET` (auth)
  - `NVIDIA_NIM_API_KEY` (model API)

**Always:** never hardcode secrets, tokens, keys, or connection strings. Never print or echo a secret value, even for debugging. When adding a variable, add it to the example file with a dummy placeholder and mention it in your summary.

---

## 6. Code conventions

- **Naming:** camelCase for variables/functions, PascalCase for components/types, kebab-case for files
- **Exports:** named exports preferred (`export const`, `export function`); default only for page/layout
- **Import alias:** `@/*` maps to `./*` (tsconfig.json paths)
- **Component / module pattern:** Server components by default; client components marked `'use client'` (e.g., `theme-toggle.tsx`)
- **Error shape / logging pattern:** `{ error: string }` with appropriate HTTP status; errors logged but not thrown in streaming callbacks
- **Comments:** no comments in new code, except `TODO` where work is knowingly deferred (forward-only; existing comments stay)

**Always, regardless of what's above:**

**Always, regardless of what's above:**

- Strict TypeScript. Fix type errors at the source; `any` requires a one-line `TODO` justifying it, and `@ts-ignore` is not a fix.
- Validate all external input at the boundary: API handlers, form submissions, env vars, third-party responses.
- Handle errors explicitly with enough context to debug. No silent catches, no empty catch blocks.
- Cover the unhappy paths: empty, null, loading, network failure, unauthorized, and duplicate/concurrent cases.
- Match the surrounding code's style before introducing a new pattern. If a new pattern is genuinely better, propose it rather than mixing both.

---

## 7. Do not touch without an explicit request

- Lockfile (except as the result of an approved pnpm command)
- Migrations that have already been applied
- Git history: no amend, rebase, force-push, or reset
- CI config, system files, global config
- `.env*` files
- Generated output: `.next/`, `node_modules/`

Deleting files, dropping data, and rewriting large sections all need confirmation first.

---

## 8. Dependencies

- Ask before adding any dependency. State what it's for, and whether the project already has something that does the job.
- Detect the package manager from the lockfile. This project pins `packageManager: "pnpm@11.9.0"` in `package.json` — do not change that field as a side effect of another task. (pnpm 12 is a Rust rewrite; upgrading is its own deliberate task.)
- Use `pnpm dlx`, never `npx`. Use `pnpm add -D` for dev dependencies. In a workspace, target packages with `pnpm --filter <pkg>`.
- pnpm blocks dependency build scripts by default. If install reports ignored build scripts, surface it and resolve with `pnpm approve-builds` or `onlyBuiltDependencies` — never by switching package managers or disabling the protection wholesale.

---

## 9. Working style

- Small, focused, reviewable changes. Prefer editing existing files over creating new ones.
- Read the related files and neighboring patterns before writing code.
- For bugs: reproduce and isolate the root cause before patching. No speculative fixes.
- For anything multi-step: write a short checklist first, do one item at a time, verify it, then move on. The checklist is a plan, not placeholder code.
- If the task is ambiguous, ask before starting rather than guessing and rewriting later.
- Ship complete code. No TODOs, stubs, or "implementation left as an exercise" unless the user asked for a scaffold.
- Keep replies short. Lead with the diff and a brief summary, not an essay.
- Use simple words in replies. Plain, everyday language; no fancy or hard words.
- Before any change, state in one line what existing behavior could break.

---

## 10. Definition of done

A task is done only when:

1. Typecheck passes.
2. Lint passes.
3. Relevant tests pass — and tests are added or updated when behavior changes.
4. Build passes, if build config or dependencies were touched.
5. Docs/README updated, if setup, commands, or behavior changed.
6. A summary of changed files is given.

Run the commands. Do not claim success from reading the code alone. If a command can't be run in this environment, say so explicitly and list what remains unverified.

---

## 11. Git

- Do not commit unless asked. Never push, force-push, or rewrite history unless asked.
- Commit messages: short, imperative, one line ("fix duplicate submit on checkout form").
- Never commit generated files, secrets, or local config.

---

## 12. Session notes

After a task that changed files, write `docs/agent-notes/YYYY-MM-DD-short-topic.md`. This is the one deliberate exception to "prefer editing over creating files."

Include: task summary, files changed, commands run and their results, and remaining follow-ups. No secrets or environment values. Skip the note entirely for read-only sessions where nothing changed.

---

## 13. Skills and rules (Claude Code)

- Personal skills: `%USERPROFILE%\.claude\skills\<name>\SKILL.md`. Project skills: `.claude\skills\<name>\SKILL.md`.
- Skills activate on their own from their description — they don't need to be listed or invoked by name here.
- Where things belong: repeatable multi-step procedures → a skill. Instructions that only apply to certain paths → `.claude/rules/*.md` with `paths:` frontmatter. Hard enforcement (blocked commands, protected paths) → hooks and `permissions.deny` in `.claude/settings.json`, because this file is guidance, not a guardrail.
- **Default skills for every session:** Always load and follow `ponytail` and `using-superpowers` at the start of every session, unless explicitly told otherwise.
- **Installed plugin skills relied on by this repo:** ponytail, using-superpowers, agent-browser, ai-sdk, better-auth-best-practices, better-auth-security-best-practices, brainstorming, create-auth, customize-opencode, dispatching-parallel-agents, email-and-password-best-practices, executing-plans, find-skills, finishing-a-development-branch, grill-me, impeccable, organization-best-practices, receiving-code-review, requesting-code-review, subagent-driven-development, systematic-debugging, test-driven-development, two-factor-authentication-best-practices, using-git-worktrees, verification-before-completion, writing-plans, writing-skills