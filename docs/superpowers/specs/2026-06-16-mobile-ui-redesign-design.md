# Mobile UI Redesign — Match invoice_app Feel — Design Spec

**Date:** 2026-06-16
**Status:** Awaiting user review
**Scope:** Whole-app visual redesign of `@yfw-mobile/expenses` to match the *feel* and token structure of the YFW web UI (`invoice_app/ui`), introducing a design-token system, a shared component library, and light/dark theming with an in-app picker.

## Goal

The web app (`invoice_app/ui`) is a polished fintech UI built on Tailwind + shadcn:
Inter font, a deep brand color on a warm-paper off-white background, deep-ink
text, soft shadows, an 8px radius scale, and a full semantic design-token system
with multiple themes. The mobile app (`apps/expenses`) is functional but ad-hoc:
`StyleSheet.create` duplicated per screen, hardcoded hex everywhere, **no design
tokens and no shared components**.

Bring the mobile app up to the web app's level of polish and structure by:
1. Adopting the reference's **layout patterns, spacing rhythm, shadows, radii,
   typography scale, and card/badge/button styling**.
2. Introducing a proper **design-token system + shared component library**.
3. Supporting **light + dark themes** with an **in-app theme picker**.

The mobile **brand stays teal/emerald** (`#059669` / `#10b981`) and the **font
stays Outfit** — we match the reference's *feel*, not its exact brand identity.

## Non-goals

- No change to app behavior, data flow, API calls, navigation routes, or the
  capture/voice/receipt/review state machines. This is a **visual + structural**
  redesign only.
- No new shared package. Per `CLAUDE.md`, `packages/mobile-core` stays a stub
  until a second app exists; all new code lives in `apps/expenses/src/`.
- No NativeWind / Tailwind build tooling. Decided: plain Theme context + typed
  tokens + `StyleSheet`.
- No new test framework (none is wired today). Verification is `tsc --noEmit`
  + manual light/dark passes — see Verification.

## Decisions (from brainstorming)

| Question | Decision |
|---|---|
| Fidelity | Match *feel* + token structure; keep teal brand + Outfit font |
| Screen scope | **All** screens |
| Theming | Light + dark + in-app picker |
| Styling tech | Theme context + typed tokens + `StyleSheet` (no NativeWind) |
| Light/dark surface direction | Warm-paper light, warm-ink (charcoal) dark, teal accent |
| Theme-preference persistence | `@react-native-async-storage/async-storage` |

## Architecture

New code under `apps/expenses/src/`:

```
src/theme/
  tokens.ts          # mode-independent primitives: spacing, radii, typography
                     # scale (Outfit), shadows, durations
  themes.ts          # semantic color tokens per theme: lightTheme, darkTheme
                     # (background, surface, surfaceMuted, border, text,
                     #  textMuted, textSubtle, primary, primaryMuted, onPrimary,
                     #  success, warning, danger, info, category colors)
  types.ts           # Theme, ThemeMode, ThemeTokens type definitions
  ThemeProvider.tsx  # context: resolved tokens + mode ('system'|'light'|'dark');
                     # reads/writes AsyncStorage; follows useColorScheme() when
                     # mode === 'system'
  useTheme.ts        # useTheme() -> { tokens, mode, setMode, scheme }
                     # useThemedStyles(makeStyles) -> memoized StyleSheet

src/components/ui/
  Text.tsx           # typography variants -> Outfit weight + size + color token
  Button.tsx         # primary | secondary | outline | ghost | destructive;
                     #   sizes sm|md|lg; loading; leftIcon/rightIcon; press scale
  Card.tsx           # default | elevated | gradient; padding prop
  Input.tsx          # label, focus ring, error state
  Badge.tsx          # StatusBadge: success|warning|danger|info|neutral
                     #   × solid|soft|outline
  SegmentedControl.tsx
  PageHeader.tsx     # title, subtitle, actions
  EmptyState.tsx     # icon, title, description, action
  MetricCard.tsx     # insights metric tile (value/label/change)
  FilterChip.tsx     # timeline filter pills
  Screen.tsx         # SafeArea + themed background wrapper
  Avatar.tsx         # initials avatar (settings)
  Divider.tsx
  index.ts           # barrel export
```

### Theming mechanism

`useThemedStyles(makeStyles)` is the core pattern: `makeStyles(tokens)` returns
`StyleSheet.create({...})`, memoized per resolved theme so we keep static-
StyleSheet performance while reacting to theme switches. Components read all
colors/spacing/typography from `tokens` — **never** hardcoded hex.

`ThemeProvider` resolves the active theme from `mode`:
- `'system'` → follow `useColorScheme()` (re-resolves on OS change)
- `'light'` / `'dark'` → forced
The chosen `mode` is persisted to AsyncStorage and restored on launch. Provider
wraps the tree in `app/_layout.tsx` (inside the existing font/query providers).

## Tokens (the "feel" layer)

Adapted from the reference, brand swapped to teal.

- **Spacing (4px base):** `xs 4, sm 8, md 12, lg 16, xl 24, 2xl 32, 3xl 48`.
- **Radii:** `sm 6, md 8, lg 12, xl 16, 2xl 24, full 999`.
- **Typography (Outfit):** scale adapted from the reference —
  `display`, `headingXl/Lg/Md/Sm`, `bodyLg/Md/Sm`, `caption`; tighter heading
  letter-spacing; money/amount style uses aligned digits where supported.
  Weights: `Outfit_400Regular`, `Outfit_500Medium`(if available, else 600),
  `Outfit_600SemiBold`, `Outfit_700Bold`.
- **Shadows:** `soft / medium / strong` mapped to RN
  `shadowColor/Opacity/Radius/Offset` + Android `elevation`. Dark theme uses
  heavier opacity per the reference.
- **Semantic colors:**
  - **Light (warm-paper):** background warm off-white (≈`#FAF9F7`), surface white,
    surfaceMuted warm gray, border light warm gray, text deep ink, primary
    `#059669`, semantic success/warning/danger/info, 6 category colors carried
    over from `timeline.tsx`.
  - **Dark (warm-ink):** background warm charcoal (not cold blue), surface
    slightly lighter charcoal, text cream, brightened teal primary (≈`#34d399`),
    brightened semantic colors.

## Shared components

Variants mirror the reference via a small variant→style map (CVA-style), all
token-driven:

- **Button** — `primary | secondary | outline | ghost | destructive`; `sm|md|lg`;
  `loading` spinner; `leftIcon`/`rightIcon`; subtle active press scale.
- **Card** — `default | elevated | gradient`; `padding` prop.
- **Input** — label, themed focus ring, error state.
- **Badge/StatusBadge** — replaces the per-screen status pills in inbox/timeline.
- **SegmentedControl** — capture mode switch + settings digest control.
- **PageHeader, EmptyState, MetricCard, FilterChip, Screen, Avatar, Divider, Text.**
- Existing **SwipeableRow, SwipeCard, UndoToast** are re-skinned to consume
  tokens; gesture/animation behavior is unchanged.

## Screen migration

All screens move to tokens + shared components, preserving layout intent and all
behavior:
- Tabs: `capture`, `inbox`, `timeline`, `insights`, `settings`
- Settings gains the **theme picker** (System / Light / Dark segmented control).
- Auth: `login`, `oauth-callback`
- Detail: `expense/[id]`, `review`

A migrated screen contains **no hardcoded hex** (grep gate per phase).

## Build sequence (phases)

1. **Foundation** — `tokens.ts`, `themes.ts`, `types.ts`, `ThemeProvider`,
   `useTheme`/`useThemedStyles`; core primitives (Text, Button, Card, Input,
   Badge, Screen). Add AsyncStorage dep. Wire `ThemeProvider` into `_layout.tsx`.
2. **Proof + tab bar** — restyle the tab bar and **timeline + insights** to
   validate tokens end-to-end in light & dark. Build remaining primitives needed
   (MetricCard, FilterChip, PageHeader, EmptyState) here.
3. **Remaining tabs** — `capture`, `inbox`, `settings` + the **theme picker**.
4. **Auth & detail** — `login`, `oauth-callback`, `expense/[id]`, `review`
   (+ re-skin SwipeableRow/SwipeCard/UndoToast).

## Verification

No test infra is wired, so per phase:
1. `npx tsc --noEmit` (from `apps/expenses`) → clean.
2. Manual run on simulator in **both light and dark**, checking each migrated
   screen renders and theme switching works.
3. **Grep gate:** migrated screens contain no raw hex color literals (all colors
   come from tokens).

## Risks / open points

- **Outfit_500Medium** may not be in the currently loaded weights — confirm in
  `_layout.tsx`; if absent, either add the weight or map "medium" → 600.
- `useColorScheme()` re-render correctness when `mode === 'system'` and the OS
  theme flips mid-session — verify in Phase 1.
- Gradient cards/buttons use `expo-linear-gradient` (already used in login/hero) —
  reuse, don't add a new dep.
