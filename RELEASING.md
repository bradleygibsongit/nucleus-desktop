# Releasing vFactor

## One-time setup

1. Add GitHub repository secrets for publishing and code signing.
   - `GH_TOKEN` or the default `GITHUB_TOKEN` for release publishing
   - macOS signing secrets:
     - `CSC_LINK` - base64-encoded `Developer ID Application` `.p12`
     - `CSC_KEY_PASSWORD` - password for that `.p12`
   - macOS notarization secrets, preferably App Store Connect API credentials:
     - `APPLE_API_KEY` - raw `.p8` key contents
     - `APPLE_API_KEY_ID`
     - `APPLE_API_ISSUER`
   - Apple ID notarization also works as a fallback with `APPLE_ID`, `APPLE_APP_SPECIFIC_PASSWORD`, and `APPLE_TEAM_ID`.
   - Windows signing secrets if you want signed NSIS installers
   - `POSTHOG_API_KEY` if you want packaged builds to send PostHog events and captured exceptions
2. Add the optional repository variable `POSTHOG_HOST` if you use an EU or self-hosted PostHog instance.

## Optional code signing

- macOS signing and notarization are required for production auto-update support.
- GitHub Actions macOS release builds fail if the Developer ID signing certificate or notarization secrets are missing. This prevents accidentally publishing an unsigned macOS release that downloads but cannot be installed by the in-app updater.
- Windows binaries will build without code signing, but users may still see SmartScreen warnings until you add a Windows signing certificate.

## Release flow

1. Bump the version in `apps/desktop/package.json`.
2. Commit the version bump.
3. Create and push a tag like `v0.2.0`.
4. GitHub Actions builds macOS and Windows installers, writes a packaged runtime `.env` file from `POSTHOG_*`, uploads the installers to the GitHub Release, and publishes Electron update metadata (`latest.yml`, `latest-mac.yml`).

## Local release build

To test the release configuration locally:

```bash
bun run desktop:dist
```

For a trusted local macOS release-style build, make sure your shell has the same signing and notarization env vars listed above, or that the `Developer ID Application` identity is installed in your login keychain and the notarization env vars are present. For quick same-machine testing without a Developer ID identity, use:

```bash
bun run desktop:dist:local
```

If you want the packaged app to emit PostHog events locally, export `POSTHOG_API_KEY` and `POSTHOG_ENABLED=true` before running the build. The packaging step writes those keys into `Resources/.env` inside the app bundle so the Electron main process can load them after installation.

## In-app updates

- The packaged app checks GitHub Releases through `electron-updater`.
- When GitHub Releases contains a newer compatible build, vFactor shows an in-app update banner, downloads the installer, and installs it directly.
- If PostHog is configured, updater checks, download completion, blocked restarts, install attempts, and updater failures are also captured from the packaged app.
