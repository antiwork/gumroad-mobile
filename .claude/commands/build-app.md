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

4. Download file attachments from the same 1Password item. Find each file's attachment ID from the `files` array, then download them. Skip any file that already exists in the project root.

   - `google-services.json`
   - `upload-keystore.jks`

   ```
   op read "op://Engineering/<item-id>/<file-id>" > google-services.json
   op read "op://Engineering/<item-id>/<file-id>" > upload-keystore.jks
   ```

5. Source the env file:
   ```
   set -a && source .env.build.local && set +a
   ```

### 1b. Check build tool prerequisites

1. **Xcode**: Required for iOS builds. Verify with `xcodebuild -version`. The user must be signed into an Apple Developer account in Xcode (Settings → Accounts) with access to the team matching `$EXPO_APPLE_TEAM_ID`.

2. **JDK 17+**: Required for Android builds (Gradle 9 needs it). If `$JAVA_HOME` is not already pointing to a JDK 17 install, install it with `arch -arm64 brew install openjdk@17` and symlink:

   ```
   sudo ln -sfn /opt/homebrew/opt/openjdk@17/libexec/openjdk.jdk /Library/Java/JavaVirtualMachines/openjdk-17.jdk
   ```

   Set `JAVA_HOME` in the build command:

   ```
   export JAVA_HOME=/opt/homebrew/opt/openjdk@17/libexec/openjdk.jdk/Contents/Home
   ```

3. **Android SDK**: Required for local Android builds. Install Android Studio (`arch -arm64 brew install --cask android-studio`), open it once to complete the setup wizard, then set:
   ```
   export ANDROID_HOME=~/Library/Android/sdk
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

First, source the env file and run `npm install` then `npm run rebuild` to regenerate the native directories:

```
set -a && source .env.build.local && set +a
npm install
npm run rebuild
```

Next, determine which platforms to build based on the argument (default: both).

#### iOS

1. Generate an `ExportOptions.plist` for the archive export, replacing `$EXPO_APPLE_TEAM_ID` with the value in `.env.build.local`:

   ```
   cat > /tmp/ExportOptions.plist << EOF
   <?xml version="1.0" encoding="UTF-8"?>
   <!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
   <plist version="1.0">
   <dict>
       <key>method</key>
       <string>app-store</string>
       <key>teamID</key>
       <string>$EXPO_APPLE_TEAM_ID</string>
       <key>signingStyle</key>
       <string>automatic</string>
       <key>destination</key>
       <string>export</string>
       <key>uploadSymbols</key>
       <true/>
   </dict>
   </plist>
   EOF
   ```

2. Archive the app:

   ```
   set -a && source .env.build.local && set +a
   xcodebuild -workspace ios/Gumroad.xcworkspace \
     -scheme Gumroad \
     -configuration Release \
     -archivePath ios/build/Gumroad.xcarchive \
     archive \
     DEVELOPMENT_TEAM="$EXPO_APPLE_TEAM_ID" \
     -allowProvisioningUpdates
   ```

3. Export the archive to an `.ipa`:

   ```
   xcodebuild -exportArchive \
     -archivePath ios/build/Gumroad.xcarchive \
     -exportOptionsPlist /tmp/ExportOptions.plist \
     -exportPath ios/build/export \
     -allowProvisioningUpdates
   ```

   The `.ipa` will be at `ios/build/export/Gumroad.ipa`.

IMPORTANT: The archive step may take a while. Run it with a generous timeout (10 minutes).

#### Android

Since `npm run rebuild` regenerates the `android/` directory, the following steps must be done after the rebuild above.

1. Copy the keystore into the Android project:

   ```
   cp upload-keystore.jks android/app/upload-keystore.jks
   ```

2. Edit `android/app/build.gradle` to configure release signing. Add a `release` block inside `signingConfigs`:

   ```groovy
   release {
       storeFile file('upload-keystore.jks')
       storePassword System.env.ANDROID_KEYSTORE_PASSWORD
       keyAlias System.env.ANDROID_KEY_ALIAS
       keyPassword System.env.ANDROID_KEY_PASSWORD
   }
   ```

   Then change the `release` build type's `signingConfig` from `signingConfigs.debug` to `signingConfigs.release`.

3. Increment the `versionCode` in `android/app/build.gradle`. The rebuild always resets it to `1`, but Google Play rejects duplicate version codes.

   Set up Google Play API access (if not already done):

   a. Check if `gcloud` CLI is installed. If not: `arch -arm64 brew install google-cloud-sdk`. Have the user sign in with `! gcloud auth login` if needed.

   b. Check if `play-store-key.json` exists in the project root. If not, set one up:

      ```
      gcloud iam service-accounts list
      ```

      Find the email for "Play Console Service Account". If none exists, prompt the user to create it and give it publishing permission in Google Play Console (Setup → API access).

      ```
      gcloud iam service-accounts keys create play-store-key.json --iam-account=<SERVICE_ACCOUNT_EMAIL>
      ```

   Then query the Google Play Publishing API for the highest existing version code:

   ```
   gcloud auth activate-service-account --key-file=play-store-key.json
   ACCESS_TOKEN=$(gcloud auth print-access-token --scopes=https://www.googleapis.com/auth/androidpublisher)

   EDIT_ID=$(curl -s -X POST \
     "https://androidpublisher.googleapis.com/androidpublisher/v3/applications/$ANDROID_BUNDLE_NAME/edits" \
     -H "Authorization: Bearer $ACCESS_TOKEN" \
     -H "Content-Type: application/json" \
     -d '{}' | jq -r '.id')

   MAX_VERSION_CODE=$(curl -s \
     "https://androidpublisher.googleapis.com/androidpublisher/v3/applications/$ANDROID_BUNDLE_NAME/edits/$EDIT_ID/bundles" \
     -H "Authorization: Bearer $ACCESS_TOKEN" | jq '[.bundles[].versionCode] | max')

   curl -s -X DELETE \
     "https://androidpublisher.googleapis.com/androidpublisher/v3/applications/$ANDROID_BUNDLE_NAME/edits/$EDIT_ID" \
     -H "Authorization: Bearer $ACCESS_TOKEN"
   ```

   Edit `android/app/build.gradle` to set `versionCode` to `MAX_VERSION_CODE + 1`.

4. Build a release `.aab` (Android App Bundle):

   ```
   export JAVA_HOME=/opt/homebrew/opt/openjdk@17/libexec/openjdk.jdk/Contents/Home
   export PATH="$JAVA_HOME/bin:$PATH"
   export ANDROID_HOME=~/Library/Android/sdk
   set -a && source .env.build.local && set +a
   cd android && ./gradlew bundleRelease && cd ..
   ```

The `.aab` will be at `android/app/build/outputs/bundle/release/app-release.aab`.

IMPORTANT: This command may take a while. Run it with a generous timeout (10 minutes).

#### Parallel builds

If building both platforms, run them in parallel using a single background bash command that spawns both builds concurrently (using `&` and `wait`). Note: parallel builds are memory-intensive — the memory limit is already increased by the `gradle-memory` plugin but if an Android build fails with `OutOfMemoryError: Metaspace` you may need to increase it further.

### 5. Verify iOS build (iOS only)

After building the iOS `.ipa`:

1. Create a temporary directory
2. Unzip the `.ipa` into it
3. Run: `strings <temp-dir>/Payload/*.app/main.jsbundle | grep -o -i "<EXPO_PUBLIC_GUMROAD_URL value from .env.build.local>"`
4. If the grep finds the URL, the env vars were applied correctly. If not, stop and warn the user that the build may not have the correct env vars.
5. Clean up the temporary directory

### 6. Report results

Print the path(s) to the built artifact(s) and tell the user they can submit using `/submit-app`.
