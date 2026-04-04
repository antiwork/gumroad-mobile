---
description: Build and submit to app stores (iOS, Android, or both)
allowed-tools: Bash, Read, Glob, Grep
user-facing: true
---

Build the app for production and submit to app stores.

Argument: platform — one of "ios", "android", or "both" (default: "both")

## Steps

### 1. Check prerequisites

1. Verify `.env.build.local` exists in the project root. If it doesn't, stop and tell the user they need to create it with production env vars (EXPO_PUBLIC_GUMROAD_URL, EXPO_PUBLIC_GUMROAD_API_URL, EXPO_PUBLIC_GUMROAD_CLIENT_ID, EXPO_PUBLIC_MOBILE_TOKEN, and any other required vars).
2. Verify `google-services.json` exists in the project root. If it doesn't, stop and tell the user they need to add it (required for Android builds).
3. Read `.env.build.local` and extract the value of `EXPO_PUBLIC_GUMROAD_URL` — you'll need it later for verification.
4. Check if `.env.build.local` contains `EXPO_APPLE_ID`. If not, prompt the user for their Apple ID email and add it to the file.
5. Check if `.env.build.local` contains `EXPO_APPLE_PASSWORD`. If not, explain to the user how they can create an app-specific password for their Apple account and prompt them to enter it. Then add it to the file.
6. Source the env file so all subsequent commands have access to its variables:
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

Determine which platforms to build based on the argument (default: both).

For each platform, run the build command (the env vars from `.env.build.local` are already set from step 1, and dotenv-flow won't override existing env vars):

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

### 6. Submit to app stores

#### iOS

Upload the `.ipa` to App Store Connect using `xcrun altool`:

```
xcrun altool --upload-app -t ios -f <path-to-ipa> -u "$EXPO_APPLE_ID" -p "$EXPO_APPLE_PASSWORD"
```

Use a generous timeout (5 minutes).

#### Android

Upload the `.aab` to Google Play using `fastlane supply`.

First, check if `fastlane` is installed. If not, install it (`brew install fastlane` or `gem install fastlane`).

Next, check if a Google Play service account key JSON file exists at `play-store-key.json` in the project root. If not, set one up using `gcloud`:

1. Find the email for "Play Console Service Account". If no such service account exists, prompt the user to create it and give it publishing permission in the Google Play Console (Setup → API access).
   ```
   gcloud iam service-accounts list
   ```
2. Create and download a key file:
   ```
   gcloud iam service-accounts keys create play-store-key.json --iam-account=<SERVICE_ACCOUNT_EMAIL>
   ```

Then run:

First, upload to the internal test track:

```
fastlane supply --aab <path-to-aab> --track internal --json_key play-store-key.json --package_name <ANDROID_BUNDLE_NAME> --skip_upload_metadata --skip_upload_changelogs --skip_upload_images --skip_upload_screenshots
```

Then create a draft production release with the same AAB:

```
fastlane supply --aab <path-to-aab> --track production --release_status draft --json_key play-store-key.json --package_name <ANDROID_BUNDLE_NAME> --skip_upload_metadata --skip_upload_changelogs --skip_upload_images --skip_upload_screenshots
```

Use a generous timeout (5 minutes) for each command.

Tell the user the internal test release is live and the production release is saved as a draft in Google Play Console, ready to be reviewed and published manually.
