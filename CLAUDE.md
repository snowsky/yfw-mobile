# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Workspace layout

npm workspaces monorepo intended to host multiple independently shippable Expo apps:

- `apps/expenses` — `@yfw-mobile/expenses`, the only real app today. Expo Router 5 / React Native 0.81 / React 19 / Expo SDK 54.
- `packages/mobile-core` — `@yfw-mobile/mobile-core`. Placeholder for shared helpers across future apps; currently exports only a name constant.
- Workspace root `app/` and `App.tsx` are **re-export shims** that mirror `apps/expenses/app/*`. They exist so `expo run:ios|android` works from the workspace root; do not add screens there — edit `apps/expenses/app/*` and add a matching shim if a new file is needed.

## Common commands

Run from the workspace root:

```bash
npm install
npm run dev:expenses          # expo start (Metro + QR)
npm run ios:expenses          # native iOS build via expo run:ios
npm run android:expenses      # native Android build
npm run web:expenses          # web build (Expo web)
```

The `:bound` variants point the app at a local YFW backend (`http://localhost:8000/api/v1`) with `EXPO_PUBLIC_EXPENSE_APP_ID=yfw-expense-demo`. Use them when developing against the main YFW repo's expense service — e.g. `npm run dev:expenses:bound`, `npm run ios:expenses:bound`.

Override the backend ad-hoc with `EXPO_PUBLIC_API_URL=...` and/or `EXPO_PUBLIC_EXPENSE_APP_ID=...` (see `apps/expenses/src/lib/config.ts`). When testing on a physical phone, `localhost` will not resolve — use the host machine's LAN IP.

No lint, test, or typecheck scripts are wired up. Run `npx tsc --noEmit` from `apps/expenses` if you need to check types.

## Architecture

### Backend contract

The app talks to the YFW backend's "standalone mobile expense service". Every request goes through `apiRequest` in `apps/expenses/src/lib/api.ts`, which automatically attaches three headers:

- `Authorization: Bearer <token>` from SecureStore (unless `skipAuth`)
- `X-Mobile-Expense-App-ID: <EXPENSE_APP_ID>` — tells the backend which mobile-bound org config to use
- `X-Tenant-ID: <user.tenant_id>` — from the cached user (unless `skipTenant`)

All response bodies are parsed through Zod schemas defined inline; when changing an endpoint's shape, update the schema alongside the call. Multipart uploads (`transcribeAudio`, `uploadReceipt`) bypass `apiRequest` and build headers manually — keep those in sync.

`EXPENSE_APP_ID` is the join key with the backend: in YFW, configure it under `Settings -> Expenses -> Standalone Mobile Expense Service`; here it comes from `EXPO_PUBLIC_EXPENSE_APP_ID`.

### Auth and session

`src/providers/AuthProvider.tsx` owns the session. On mount it loads token + user from `expo-secure-store`, then calls `authApi.me()` to verify; failure clears the session. SecureStore keys are scoped per `EXPENSE_APP_ID` (`yfw.expenses.<app_id>.accessToken|user`) so multiple bound builds can coexist on one device.

`app/(tabs)/_layout.tsx` is the auth gate — if `accessToken` is absent it redirects to `/login`. `app/index.tsx` picks `/capture` vs `/login` after bootstrap.

### Google SSO deep link

Google SSO runs entirely in the **backend's** browser flow. The backend redirects to the `yfw-expenses://oauth-callback?token=...&user=<base64-json>&next=...` deep link (scheme set in `app.json`). `app/oauth-callback.tsx` base64-decodes the user, stores token + user, calls `refreshMe`, then navigates to `next`. If you change session storage shape, update both `AuthProvider` and the oauth-callback decoder.

### Screens

`apps/expenses/app/` follows expo-router file conventions. Tabs live in `app/(tabs)/`: `capture` (voice + camera intake), `inbox`, `timeline`, `insights`, `settings`. Each screen is self-contained — there are no shared UI primitives yet, so styles are duplicated locally. The brand color is teal/emerald (`#059669` / `#10b981`); the Outfit font family is loaded in `_layout.tsx` and referenced as `Outfit_400Regular` etc. throughout.

### Data layer

`@tanstack/react-query` is set up at the root with a default `QueryClient`. There is no central key registry — each screen defines its own `queryKey`. When adding mutations that should invalidate lists, target the matching keys used in `inbox`/`timeline`/`insights`.

## When adding shared code

Today `packages/mobile-core` is a stub. The intended pattern: extract anything that two apps would share (auth helpers, API client, design tokens, types) into `packages/mobile-core/src` and import as `@yfw-mobile/mobile-core`. Until a second app exists, prefer keeping new code in `apps/expenses/src/` to avoid premature abstraction.
