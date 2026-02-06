# Gumroad Mobile

[Gumroad](https://gumroad.com) is an e-commerce platform that enables creators to sell products directly to consumers. This repository contains the source code for the Gumroad mobile app, built with [Expo](https://expo.dev).

## Get started

1. Install dependencies

   ```bash
   npm install
   ```

2. Set up environment variables

   ```bash
   cp .env.example .env
   ```

   Then edit `.env` and add your Gumroad URL and OAuth client ID. **See below for instructions on how to connect to your local Gumroad instance.**

3. Start the app. Run one of:

   ```bash
   npm run android
   npm run ios
   ```

## Connecting to a local Gumroad instance

To connect to a local Gumroad instance, you will need to:

1. Create a `.env` file containing:

   ```
   EXPO_PUBLIC_GUMROAD_URL=https://gumroad.dev
   EXPO_PUBLIC_GUMROAD_API_URL=https://api.gumroad.dev

   # Also make sure to set this in your gumroad .env file as MOBILE_TOKEN
   EXPO_PUBLIC_MOBILE_TOKEN=supersecret
   ```

2. Run the following in Rails console in your Gumroad directory:

   ```ruby
   OauthApplication.create!(name: "Gumroad Mobile", redirect_uri: "gumroadmobile://", scopes: ["mobile_api", "creator_api"])
   ```

   Add the generated `client_id` value to your gumroad-mobile `.env` file as `EXPO_PUBLIC_GUMROAD_CLIENT_ID`.

3. Run `npm run rebuild` to create native project directories.
4. Set up and start an Android or iOS simulator according to the instructions below.
5. Make sure your local Gumroad instance is running (i.e. `https://gumroad.dev` should work on your browser).
6. Run `npm run android` or `npm run ios` to start the app.

### Running on Android Emulator

1. Create a new Android Virtual Device (AVD) with a "Google APIs" system image:
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

5. Push the `mkcert` root certificate to the emulator's storage:

   ```bash
   adb push "$(mkcert -CAROOT)/rootCA.pem" /sdcard/rootCA.crt
   ```

6. Install the root certificate on the emulator:
   - Go to `Settings > Security & Privacy > More security & privacy > Encryption & credentials > Install a certificate > CA certificate`.
   - Select `rootCA.crt` in the file picker.

You should now be able to load `https://gumroad.dev` in your browser. Once that works, you can run the app on the emulator.

### Running on iOS Simulator

1. Create and start any iOS simulator device.

2. Find your `mkcert` root certificate in Finder:

   ```bash
   open "$(mkcert -CAROOT)"
   ```

3. Drag and drop `rootCA.pem` into the simulator.

You should now be able to load `https://gumroad.dev` in your browser. Once that works, you can run the app on the emulator.
