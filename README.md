# Gumroad Mobile

[Gumroad](https://gumroad.com) is an e-commerce platform that enables creators to sell products directly to consumers. This repository contains the source code for the Gumroad mobile application, built with [Expo](https://expo.dev).

## Get started

### Prerequisites

#### Gumroad

In development this application is intended to connect to a local Gumroad development instance. You will need to set up and run the [Gumroad web application](https://github.com/antiwork/gumroad) locally alongside this application.

#### Node.js

- https://nodejs.org/en/download
- Install the version listed in [the .node-version file](./.node-version)

#### Android Studio and/or Xcode

The application will run on an emulator or device, which you will need to set up via Android Studio or Xcode. Download and install at least one, and follow the instructions to create at least one virtual device (Android) or simulator (iOS).

- https://developer.android.com/studio
- https://developer.apple.com/xcode/

#### Rooted Android Emulator

Since Android emulators don't forward to the host machine's `localhost`, you will need to edit the hosts file on an emulator with root access to make our `https://gumroad.dev` development domain work.

1. Create a new Android Virtual Device (AVD) with a "Google APIs" system image (NOT the default "Google Play"):
   - In Android Studio, go to `Tools > Device Manager`.
   - Click `Create Virtual Device`.
   - Select any device definition.
   - Under `System Image`, go to the `ARM Images` tab and select an image with a "Target" that looks like `Android X.X (Google APIs)`.
   - Click `Next` and then `Finish`.

2. Find your AVD's name by running `emulator -list-avds`.

3. Start the AVD with a writable file system. **You will need to run this every time you start the emulator, it won't work if Expo starts it for you.**

   ```bash
   emulator -avd your-avd-name -writable-system
   ```

4. Add entries to `hosts` so that `gumroad.dev` resolves to the host machine's IP address instead of localhost:

   ```bash
   adb root
   adb remount
   adb shell "echo '10.0.2.2 gumroad.dev' >> /etc/hosts; echo '10.0.2.2 api.gumroad.dev' >> /etc/hosts; echo '10.0.2.2 app.gumroad.dev' >> /etc/hosts; echo '10.0.2.2 minio.gumroad.dev' >> /etc/hosts"
   ```

You should now be able to load `https://gumroad.dev` in your browser. Once that works, you can run the app on the emulator.

### Running locally

1. Install dependencies

   ```bash
   npm install
   ```

2. Make sure you have Gumroad running locally with the latest seed data (`rails db:seed`).

3. Start the app. Run one of:

   ```bash
   npm run android # run this only AFTER starting the rooted emulator as described above
   npm run ios
   ```

### Configuring

The app will run without any custom credentials, but can be configured using environment variables. You can override any of the default values in `.env` with a `.env.local` file.

## Testing

### E2E tests

E2E tests use [Maestro](https://maestro.dev). To run the tests:

1. Install Maestro:

   ```bash
   curl -fsSL "https://get.maestro.mobile.dev" | bash
   ```

2. Ensure you have the app running in either an iOS simulator or Android emulator.

3. Ensure you have Gumroad running locally with the latest seed data (`rails db:seed`).

4. Run a test file:

   ```bash
   npm run e2e:ios .maestro/<test>.yaml
   npm run e2e:android .maestro/<test>.yaml
   ```

### Unit tests

Unit tests use [Jest](https://jestjs.io). To run the tests, use `npm run test`.
