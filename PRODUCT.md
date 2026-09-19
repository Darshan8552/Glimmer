# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

General AI-chat users doing everyday jobs: quick questions, writing help, coding help, brainstorming. Single-user sessions behind email + Google sign-in. (Delegated: owner is building this as a resume project and left the audience to us; a genuinely usable chat serves both the user and the portfolio.)

## Product Purpose

Glimmer is a working AI chat app that answers questions through branded model tiers (Glimmer 4, Glimmer 4 Turbo, Glimmer 3.5). Success means a visitor can sign up, get a useful streamed answer in seconds, find the conversation later in the sidebar, and never think about providers. Secondarily, the codebase demonstrates production habits: validated input, explicit errors, per-user persistence, provider abstraction.

## Positioning

A chat app whose branded tiers route to free-tier providers (NVIDIA NIM today; Groq, Gemini, OpenRouter planned) behind one registry with verified working models. A neighboring product could copy the chat UI but not truthfully copy the verified free-model routing, because the model list was earned by live testing, not marketing copy.

## Operating Context

Desktop and mobile browsers, light and dark themes (dark-mode parity is a standing requirement). Conversations persist per user; sidebar lists recent chats; auth via Better Auth (email OTP + Google). AI replies stream token-by-token over `/api/chat`.

## Capabilities and Constraints

Confirmed: three NIM-backed tiers with tested model IDs (`ai/models.ts`); server-side identity prompt answering as Glimmer; conversation CRUD (no rename/share); retry-last-reply and edit-any-message via truncate + resend; file-attach UI is label-only (models are text-only). Constraints: free-tier rate limits; only `nvidia/nemotron-*` models serve on the current NIM key; no localStorage history cache (server is source of truth). Undecided: positioning claim beyond the router; rename/share; user-level custom instructions (designed, not built).

## Brand Commitments

Name "Glimmer" stays. Nothing else pinned: the G mark, palette, and type may evolve. Voice: direct, no superlatives, no emojis unless asked.

## Evidence on Hand

No testimonials, customers, benchmarks, or press. Do not fabricate any. Real assets: the `G` monogram (inline styled div, no file); Geist sans/mono via `next/font`. Live model verification logs live in `docs/agent-notes/`.

## Product Principles

1. Server truth, optimistic face: history lives in Postgres; the UI never waits for it to feel instant.
2. Honest branding: tiers are named Glimmer models; underlying providers are documented in `docs/ai.md`, never in user-facing copy.
3. Free-tier discipline: every provider claim is verified by a live call before it ships.
4. Quiet craft: the interface recedes; streaming, states, and errors are the experience.
5. Small diffs: reuse helpers, tokens, and patterns already in the repo before inventing new ones.
