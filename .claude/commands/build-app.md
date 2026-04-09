---
description: Build the app for production (iOS, Android, or both)
allowed-tools: Bash, Read, Glob, Grep, Edit, Write
user-facing: true
---

Build the app for production. Does NOT submit to app stores — use `/submit-app` for that.

Argument: platform — one of "ios", "android", or "both" (default: "both")

## Steps

### 1. Fetch build credentials from 1Password

1. Check if the `op` CLI is installed (`which op`). If not, install it:

   ```
   arch -arm64 brew install 1password-cli
   ```

   Then tell the user to enable the 1Password desktop app integration (Settings → Developer → CLI) and run `! op signin` to authenticate.

2. Fetch the build credentials from 1Password:

   ```
   op item get "gumroad-mobile .env.build.local - build credentials for Expo mobile app" --format=json
   ```

   Parse the `notesPlain` field to extract the env var block (between the triple backticks).

3. Write the env vars to `.env.build.local` in the project root (overwrite if it exists).

4. Download the `google-services.json` attachment from the same 1Password item:

   ```
   op item get "gumroad-mobile .env.build.local - build credentials for Expo mobile app" --format=json
   ```

   Find the file attachment ID from the `files` array, then download it:

   ```
   op read "op://Engineering/<item-id>/<file-id>" > google-services.json
   ```

5. Source the env file:
   ```
   set -a && source .env.build.local && set +a
   ```

### 2. Update version

Update the `version` field in `app.config.ts` to today's date in `YYYY.MM.DD` format (e.g., `2026.03.26`). If the version already matches today's date, skip this step. Otherwise:

1. If the current branch is NOT `main`, inform the user and ask whether they want to continue building from this branch.
2. Edit the `version` field in `app.config.ts` to the current date.
3. Check if the current branch is `main`. If so:
   - Stage `app.config.ts`
   - Commit with message `Bump version`
   - Push to origin

### 3. Clear build cache

Run these commands:

```
rm -rf $TMPDIR/haste-map-* $TMPDIR/metro-cache
```

### 4. Build

First, run `npm install` then `npm run rebuild` to regenerate the native directories.

Next, determine which platforms to build based on the argument (default: both).

For each platform, run the build command:

```
npm run eas -- build --platform <platform> --profile production --local --non-interactive
```

where `<platform>` is `ios` or `android`.

IMPORTANT: This command may take a while. Run it with a generous timeout (10 minutes).

The build command outputs the path to the built artifact (`.ipa` for iOS, `.aab` for Android). Capture this path from the output.

If building both platforms, build them sequentially (iOS first, then Android).

### 5. Verify iOS build (iOS only)

After building the iOS `.ipa`:

1. Create a temporary directory
2. Unzip the `.ipa` into it
3. Run: `strings <temp-dir>/Payload/*.app/main.jsbundle | grep -o -i "<EXPO_PUBLIC_GUMROAD_URL value from .env.build.local>"`
4. If the grep finds the URL, the env vars were applied correctly. If not, stop and warn the user that the build may not have the correct env vars.
5. Clean up the temporary directory

### 6. Report results

Print the path(s) to the built artifact(s) and tell the user they can submit using `/submit-app`.
