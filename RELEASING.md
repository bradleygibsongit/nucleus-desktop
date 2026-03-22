# Releasing Nucleus Desktop

## One-time setup

1. Generate the updater signing key once.
   - Private key: `~/.tauri/nucleus-desktop.key`
   - Public key: `src-tauri/updater-public-key.txt`
2. Add these GitHub repository secrets:
   - `TAURI_SIGNING_PRIVATE_KEY`: contents of `~/.tauri/nucleus-desktop.key`
   - `TAURI_SIGNING_PRIVATE_KEY_PASSWORD`: the password used when generating `~/.tauri/nucleus-desktop.key`

## Optional code signing

- macOS signing and notarization are still optional but recommended for a smoother install flow.
- If you want trusted macOS builds, also add Apple signing secrets and certificate import steps before the Tauri action.
- Windows binaries will build without code signing, but users may still see SmartScreen warnings until you add a Windows signing certificate.

## Release flow

1. Bump the version in `package.json`, `src-tauri/tauri.conf.json`, and `src-tauri/Cargo.toml`.
2. Commit the version bump.
3. Create and push a tag like `v0.2.0`.
4. GitHub Actions builds macOS and Windows bundles, uploads them to the GitHub Release, and publishes `latest.json` for in-app updates.

## Local release build

To test the release configuration locally:

```bash
export TAURI_SIGNING_PRIVATE_KEY="$HOME/.tauri/nucleus-desktop.key"
bun run tauri:build:release
```

## In-app updates

- The packaged app checks `https://github.com/bradleygibsongit/nucleus-desktop/releases/latest/download/latest.json`.
- When GitHub Releases contains a newer signed build, Nucleus shows an in-app update banner and can install the update directly.
