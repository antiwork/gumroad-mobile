---
description: Submit built app artifacts to app stores (iOS, Android, or both)
allowed-tools: Bash, Read, Glob, Grep, Edit, Write
user-facing: true
---

Submit previously built app artifacts to app stores. Run `/build-app` first if you haven't built yet.

Argument: platform — one of "ios", "android", or "both" (default: "both")

## Steps

### 1. Locate build artifacts

Look for the most recent `.ipa` (iOS) and `.aab` (Android) files in the project root or `build/` directory. If not found, tell the user to run `/build-app` first.

### 2. Load env vars

1. Check if `.env.build.local` exists. If not, fetch it from 1Password (see step 1 in `/build-app`).
2. Source the env file:
   ```
   set -a && source .env.build.local && set +a
   ```

### 3. Check Apple credentials (iOS only)

1. Check if `.env.build.local` contains `EXPO_APPLE_ID`. If not, prompt the user for their Apple ID email and add it to the file.
2. Check if `.env.build.local` contains `EXPO_APPLE_PASSWORD`. If not, explain how to create an app-specific password at appleid.apple.com → Sign-In and Security → App-Specific Passwords → Generate. Prompt the user to enter it, then add it to the file.

### 4. Submit to app stores

#### iOS

Upload the `.ipa` to App Store Connect using `xcrun altool`:

```
xcrun altool --upload-app -t ios -f <path-to-ipa> -u "$EXPO_APPLE_ID" -p "$EXPO_APPLE_PASSWORD"
```

Use a generous timeout (5 minutes).

#### Android

Upload the `.aab` to Google Play using `fastlane supply`.

1. Check if `fastlane` is installed. If not, install it (`brew install fastlane`).
2. Check if `gcloud` CLI is installed. If not, install it (`arch -arm64 brew install google-cloud-sdk`). Have the user sign in with `! gcloud auth login` if needed.
3. Check if `play-store-key.json` exists in the project root. If not, set one up using `gcloud`:

   ```
   gcloud iam service-accounts list
   ```

   Find the email for "Play Console Service Account". If none exists, prompt the user to create it and give it publishing permission in Google Play Console (Setup → API access).

   ```
   gcloud iam service-accounts keys create play-store-key.json --iam-account=<SERVICE_ACCOUNT_EMAIL>
   ```

4. Upload to the internal test track:
   ```
   fastlane supply --aab <path-to-aab> --track internal --json_key play-store-key.json --package_name $ANDROID_BUNDLE_NAME --skip_upload_metadata --skip_upload_changelogs --skip_upload_images --skip_upload_screenshots
   ```

Use a generous timeout (5 minutes) for each command.

Tell the user the internal test release is live and how to promote it to production in Google Play Console.

### 5. Suggest release notes

1. Find the most recent "Bump version" commit before the current one:
   ```
   git log --oneline --all --grep="Bump version" -n 2
   ```
   Use the second result (the previous version bump) as the starting point.
2. Collect all commit subjects since that commit:
   ```
   git log --oneline <previous-bump-commit>..HEAD
   ```
3. Draft a single sentence for the release notes highlighting the one or two most impactful changes, e.g. "PDF viewer improvements and bug fixes."
4. Print the suggested release notes for the user to copy into App Store Connect and/or Google Play Console.
