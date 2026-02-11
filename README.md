# Welcome to your Expo app 👋

This is an [Expo](https://expo.dev) project created with [`create-expo-app`](https://www.npmjs.com/package/create-expo-app).

## Get started

1. Install dependencies

   ```bash
   npm install
   ```

2. Set up environment variables

   ```bash
   cp .env.example .env
   ```

   Then edit `.env` and add your Gumroad URL and OAuth client ID. You'll need to create an `OauthApplication` with scopes `mobile_api creator_api` in your Gumroad instance.

3. Start the app. Run one of:

   ```bash
   npm run android
   npm run ios
   ```

## Connecting to a local Gumroad instance

To connect to a local Gumroad instance, you will need to

1. Run the following in Rails console in your Gumroad directory:

   ```ruby
   OauthApplication.create!(name: "Gumroad Mobile", redirect_uri: "gumroadmobile://", scopes: ["mobile_api", "creator_api"])
   ```

   Add the `client_id` value to your gumroad-mobile `.env` file as `EXPO_PUBLIC_GUMROAD_CLIENT_ID`.

2. Set the `ALLOW_LOCALHOST` environment variable to `true` in your `.env` file.
3. Run `npx expo prebuild --clean` to rebuild native project directories.
4. Add the following to your `.env` file:

   ```
   EXPO_PUBLIC_GUMROAD_URL=http://localhost:3000
   EXPO_PUBLIC_GUMROAD_API_URL=http://localhost:3000
   EXPO_PUBLIC_MOBILE_TOKEN=your-local-mobile-token
   ```

5. Start your local Gumroad with `CUSTOM_DOMAIN=localhost bin/dev` so that pages can be accessed via localhost.

## Testing

### Integration tests

Integration tests use [Maestro](https://maestro.dev). To run the tests:

1. Install Maestro:

   ```bash
   curl -fsSL "https://get.maestro.mobile.dev" | bash
   ```

2. Ensure you have the app running in either an iOS simulator or Android emulator.

3. Ensure you have Gumroad running locally with the default seed data (`rails db:seed`).

4. Run a test file:

   ```bash
   npm run e2e:ios .maestro/<test>.yaml
   npm run e2e:android .maestro/<test>.yaml
   ```
