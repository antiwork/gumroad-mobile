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

Upload the `.aab` to Google Play using the Publishing API directly.

`gcloud` and `play-store-key.json` should already be set up from `/build-app`. If not, follow the Google Play API access setup in `/build-app` step 4.3.

1. Get an OAuth2 access token from the service account:

   ```
   gcloud auth activate-service-account --key-file=play-store-key.json
   ACCESS_TOKEN=$(gcloud auth print-access-token --scopes=https://www.googleapis.com/auth/androidpublisher)
   ```

2. Create an edit:

   ```
   EDIT_ID=$(curl -s -X POST \
     "https://androidpublisher.googleapis.com/androidpublisher/v3/applications/$ANDROID_BUNDLE_NAME/edits" \
     -H "Authorization: Bearer $ACCESS_TOKEN" \
     -H "Content-Type: application/json" \
     -d '{}' | jq -r '.id')
   ```

3. Upload the `.aab`:

   ```
   curl -X POST \
     "https://androidpublisher.googleapis.com/upload/androidpublisher/v3/applications/$ANDROID_BUNDLE_NAME/edits/$EDIT_ID/bundles?uploadType=media" \
     -H "Authorization: Bearer $ACCESS_TOKEN" \
     -H "Content-Type: application/octet-stream" \
     --data-binary @<path-to-aab>
   ```

4. Assign the upload to the internal track:

   ```
   VERSION_CODE=$(curl -s \
     "https://androidpublisher.googleapis.com/androidpublisher/v3/applications/$ANDROID_BUNDLE_NAME/edits/$EDIT_ID/bundles" \
     -H "Authorization: Bearer $ACCESS_TOKEN" | jq -r '.bundles[-1].versionCode')

   curl -X PUT \
     "https://androidpublisher.googleapis.com/androidpublisher/v3/applications/$ANDROID_BUNDLE_NAME/edits/$EDIT_ID/tracks/internal" \
     -H "Authorization: Bearer $ACCESS_TOKEN" \
     -H "Content-Type: application/json" \
     -d "{\"track\":\"internal\",\"releases\":[{\"versionCodes\":[\"$VERSION_CODE\"],\"status\":\"completed\"}]}"
   ```

5. Commit the edit:
   ```
   curl -X POST \
     "https://androidpublisher.googleapis.com/androidpublisher/v3/applications/${ANDROID_BUNDLE_NAME}/edits/${EDIT_ID}:commit" \
     -H "Authorization: Bearer $ACCESS_TOKEN"
   ```

Use a generous timeout (5 minutes) for the upload step. Check each API response for errors before proceeding to the next step.

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
