# ChefTrack build guide

The app has one Expo codebase for Android, iOS, and web. Native builds need a
reachable API server URL at build time because Android and iOS cannot use the
Replit preview proxy.

## Required build-time configuration

Set `EXPO_PUBLIC_DOMAIN` to the API's stable HTTPS hostname before building a
native app. A hostname or a full `https://` URL is accepted:

```bash
export EXPO_PUBLIC_DOMAIN=api.example.com
```

Do not use a temporary Replit development hostname for a released app. The
project is not coupled to a particular deployment hostname; use the URL of the
deployment that serves the API.

The Clerk publishable key must also be available to the build environment as
`CLERK_PUBLISHABLE_KEY`. Never commit either value to this repository.

## Release smoke test

After publishing the API, run the release smoke test against its stable URL.
Use a dedicated test workspace account rather than a personal production
account:

```bash
EXPO_PUBLIC_DOMAIN=https://your-api.replit.app \
SMOKE_JOIN_CODE=ABC123 \
SMOKE_EMAIL=release-test@example.com \
SMOKE_PASSWORD='the-test-account-password' \
  pnpm --filter @workspace/api-server run smoke:release
```

The test rejects `localhost` and `.replit.dev` hosts, then verifies the
published health endpoint, manager sign-in, and one `sync` request.

## Replit preview and static deployment

These commands are already used by the configured Replit workflow:

```bash
pnpm --filter @workspace/chef-track run dev
pnpm --filter @workspace/chef-track run build
pnpm --filter @workspace/chef-track run serve
```

The `build` command creates the Expo static deployment under `static-build/`.
It uses `EXPO_PUBLIC_DOMAIN` when provided and otherwise uses the Replit
deployment environment variables.

## Web / PC build

For a normal static web bundle:

```bash
EXPO_PUBLIC_DOMAIN=api.example.com \
  pnpm --filter @workspace/chef-track run build:web
```

The output is written to `dist/` and can be served by any static web server.
When the web bundle and API share an origin, the app can use same-origin
`/api` routing; setting `EXPO_PUBLIC_DOMAIN` is safer when they are hosted
separately.

## Android Studio

From the repository root, install dependencies once, then generate the native
project and open it in Android Studio:

```bash
pnpm install
cd artifacts/chef-track
EXPO_PUBLIC_DOMAIN=api.example.com pnpm exec expo prebuild --platform android
EXPO_PUBLIC_DOMAIN=api.example.com pnpm exec expo run:android
```

`expo run:android` is the local IDE/developer build path. For a release APK or
Play Store AAB, open the generated `android/` directory in Android Studio and
use its signed release build flow. The package name is
`com.stitchtrack.app`.

## Xcode

On macOS with Xcode installed:

```bash
pnpm install
cd artifacts/chef-track
EXPO_PUBLIC_DOMAIN=api.example.com pnpm exec expo prebuild --platform ios
EXPO_PUBLIC_DOMAIN=api.example.com pnpm exec expo run:ios
```

Open the generated `ios/` workspace in Xcode for signing, archiving, and
App Store distribution. The bundle identifier is `com.stitchtrack.app`.

## Build profile reference

`eas.json` keeps the release targets explicit for external Expo-compatible
build tooling:

- `preview`: internal Android APK and iOS simulator build
- `production`: Android app bundle (AAB) and iOS Release build

The Replit workflow itself does not require a native build service; Android
Studio, Xcode, or another approved Expo-compatible build environment can use
the same static `app.json` settings.