# Releasing Nucleus Desktop

## One-time setup

1. Add GitHub repository secrets for publishing and code signing.
   - `KEYGEN_TOKEN` for publishing desktop artifacts to Keygen
   - macOS signing/notarization secrets if you want trusted macOS installers
   - Windows signing secrets if you want signed NSIS installers
2. Configure the Keygen product used by Nucleus.
   - For internal testing, prefer an `OPEN` distribution strategy so testers can install and update without license auth.
   - When you later move to paid or gated access, switch distribution to licensed access and provide an authorization header to the updater.

## Optional code signing

- macOS signing and notarization are strongly recommended for a smoother install flow and production auto-update support.
- If you want trusted macOS builds, add Apple signing secrets and certificate import steps before running `electron-builder`.
- Windows binaries will build without code signing, but users may still see SmartScreen warnings until you add a Windows signing certificate.

## Release flow

1. Bump the version in `apps/desktop/package.json`.
2. Commit the version bump.
3. Create and push a tag like `v0.2.0`.
4. GitHub Actions builds macOS and Windows installers, uploads them to Keygen, and publishes Electron update metadata (`latest.yml`, `latest-mac.yml`) to the configured Keygen channel.

## Local release build

To test the release configuration locally:

```bash
bun run desktop:dist
```

## In-app updates

- The packaged app checks Keygen through `electron-updater`.
- Internal builds can override the update channel with `NUCLEUS_UPDATE_CHANNEL`.
- If distribution is gated later, set `NUCLEUS_UPDATE_AUTH_HEADER` in the packaged app directory or user data `.env` file so the updater can authenticate its requests.
