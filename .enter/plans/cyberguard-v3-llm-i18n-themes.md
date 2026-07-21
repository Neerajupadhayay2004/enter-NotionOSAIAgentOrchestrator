# CyberGuard AI v3 — 3-Provider LLM Fallback, 4 New Languages, Theme Toggle

## Context
Three independent additions requested: (1) fix/extend the LLM fallback chain to 3 providers since Groq's key was invalid, (2) full multi-language support beyond EN/中文, (3) UI theme switching. Convex cannot be added — this platform only runs on Enter Cloud (Supabase); no code changes will reference Convex, and the pasted Convex/Google API keys are not used anywhere (kept out of code per security policy already established in this project).

## 1. Three-provider LLM fallback (Enter Gemini → Groq → OpenRouter)
Currently `run-incident-pipeline` and `analyze-xss-submission` each have a local `callAgent()` that tries Enter's Gemini gateway then falls back to Groq. Extend both to try OpenRouter (`https://openrouter.ai/api/v1/chat/completions`, model `openai/gpt-4o-mini` — cheaper than gpt-4o and sufficient for structured JSON verdicts, using `OPENROUTER_API_KEY`) as a third attempt if both Enter and Groq fail. Since this platform's edge functions don't share imports between functions, the same fallback logic is duplicated in each function (matching the existing pattern already used for the Enter→Groq fallback).
- `provider` field in logged actions becomes `"enter" | "groq" | "openrouter"` so it stays traceable which one actually answered.
- OpenRouter requires `HTTP-Referer` and `X-Title` headers per their docs; will set these to the project's live-preview URL / "CyberGuard AI".
- Test the full chain end-to-end once deployed (regenerated Groq key should now work; OpenRouter as final safety net if both fail).

## 2. Multi-language: add Hindi, Spanish, Arabic (RTL), French
Uses the existing `enter_i18n` skill and its established pattern (already proven for EN/zh-CN in this project):
- Update `i18n.config.json` to add 4 new language entries: `hi` (Hindi, ltr), `es` (Spanish, ltr), `ar` (Arabic, **rtl**), `fr` (French, ltr). Fallback stays `en`.
- Create `public/locales/hi.json`, `es.json`, `ar.json`, `fr.json` mirroring every key currently in `en.json` (both the original budget-OS strings and the full CyberGuard v1/v2 string set — roughly 200+ keys) with fully translated values, not placeholders.
- No code changes needed beyond the config + locale files — `language-switcher.tsx`, `src/i18n/util.ts`, and the RTL `document.dir` sync are already generic and read the language list from `i18n.config.json`.
- Verify Arabic flips the page to RTL correctly (existing `getLanguageDirection` logic already handles this; just needs the config entry).
- Run `check-i18n.mjs` + `scan-i18n.mjs` after, per the skill's required workflow.

## 3. UI theme toggle (Light / Dark / System)
`next-themes` is already installed but unused.
- Wrap `App.tsx` with `ThemeProvider` from `next-themes` (`attribute="class"`, `defaultTheme="system"`, `enableSystem`), since the existing `index.css` already defines a full `.dark` token set — dark mode "just works" once the class toggles.
- New `src/components/theme-toggle.tsx`: a small dropdown/button (using existing `DropdownMenu` + `Button` primitives) with Light/Dark/System options and sun/moon icons, calling `next-themes`' `useTheme()`.
- Add the toggle next to `LanguageSwitcher` in both `CyberGuardDashboard.tsx` and the budget-OS `Index.tsx` headers, plus `HoneypotNetwork.tsx` and detail pages' headers for consistency across the whole app ("full web OS" — every section gets it, not just one page).
- No new color tokens needed — `index.css` dark palette is already complete from the original template; just confirm contrast still holds on the newer cyberguard-specific tokens (severity/verdict/agent colors) by checking they're reasonably legible in dark mode (most already use saturated colors that read fine on dark backgrounds, but I will bump a couple of foreground pairs if needed during review).

## Files
**Backend (edited):** `supabase/functions/run-incident-pipeline/index.ts`, `supabase/functions/analyze-xss-submission/index.ts` (both get the OpenRouter fallback tier)
**i18n (new):** `public/locales/hi.json`, `es.json`, `ar.json`, `fr.json`
**i18n (edited):** `i18n.config.json`
**Frontend (new):** `src/components/theme-toggle.tsx`
**Frontend (edited):** `src/App.tsx` (ThemeProvider wrap), `src/pages/CyberGuardDashboard.tsx`, `src/pages/Index.tsx`, `src/pages/HoneypotNetwork.tsx`, `src/pages/IncidentDetail.tsx`, `src/pages/RequestDetail.tsx` (add ThemeToggle to headers)

## Verification
- Re-test XSS submission and Simulate Attack; confirm at least one provider succeeds and `llmProvider` is logged correctly in `incident_actions.payload`.
- Switch language to each of the 6 total languages (en, zh-CN, hi, es, ar, fr) and spot-check the CyberGuard dashboard + Honeypot page render translated text with no missing keys.
- Confirm Arabic flips layout direction (RTL) without breaking any component.
- Toggle theme to Dark and System on both CyberGuard and Budget OS pages; confirm all badges/cards/3D scenes remain legible.
- Run `check-i18n.mjs` + `scan-i18n.mjs`, confirm both pass.
