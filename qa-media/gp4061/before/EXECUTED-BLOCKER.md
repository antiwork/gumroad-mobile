# gp#4061 BEFORE-capture QA — executed blocker log

Status: **no before images captured**. All commands below were actually executed on 2026-10-29
(local time), inside the task-isolated lane. No production calls, no commits/pushes/uploads.

## Lane identity

- Server: `~/work/gp4061-base` @ `61ef47381c4ebcd8b856410f97cb0d2effbeb082`, puma pid 5060,
  `http://127.0.0.1:3016`, `RAILS_ENV=development`, `DATABASE_NAME=gumroad_gp4061qa`
- App base: `~/work/gp4061-mobile-base` detached @ `9f2e18604ecf303f2cb5f2251b543a6e0f3e5a8f`
- iOS sim: `6EEA83CB-0012-407F-96AF-1659A0C8ACB7` (iPhone 17 Pro, iOS 26.4.1, 402x874 pt, 3x)
- Synthetic member: `qa4061-owner@gumroad.test` + 8 brand admins (`qa4061-brand1..8`)
- Captures dir (empty): `~/work/gp4061-mobile/qa-media/gp4061/before/`

## Executed attempts (in order, all real)

1. Seeded-session via simulator keychain DB
   - `sqlite3 .../data/Library/Keychains/keychain-2-debug.db "select ... from genp where acct like '%gumroad%'"`
     -> **0 rows**. `keychain-2.db` is 0 bytes; the live store is `keychain-2-debug.db`.
   - SecureStore items for `gumroad_access_token` / `gumroad_refresh_token` are written by the app
     under its own keychain access group. A separate harness app cannot write that group without
     matching entitlements, i.e. it would require changing/building the app.
   - **Blocker**: no supported way to seed the saved Release build's SecureStore without modifying it.

2. Release build login (`ASWebAuthenticationSession` sheet) — repeated, bounded attempts
   - Email field: types correctly (`qa4061-owner@gumroad.test`).
   - Password field: can be focused (pink focus ring, cursor visible in screenshots) but text never
     lands: `inputText` no-op, `pressKey: TAB` types a literal tab into email, `pressKey: Enter`
     with empty password does not submit, long-press produces no context menu, no Paste node in the
     a11y tree (`PASTE_POINT=` empty).
   - Synthetic password reset to lowercase-only (`qaownersynthetic`, verified
     `valid_password? == true` in `gumroad_gp4061qa`) and attempted key-by-key tapping of the
     on-screen keyboard: page re-rendered/scrolled and keystrokes did not land in the password field.
   - **Blocker**: the sign-in sheet's password input cannot be filled headlessly here.

3. Debug build fallback (permitted "supported dev-client settings" path)
   - The expo dev-client floating dev-menu button sits at the same top-right coordinates as the
     app's `settings-button`. Tapping `94%,9%` on the **sign-in screen** (where no app gear exists)
     opened the Expo dev menu — proof the tap is hitting the dev overlay, not app UI.
   - `xcrun simctl spawn <udid> defaults read com.antiwork.gumroadmobile` -> domain does not exist;
     no supported pref surfaced to disable the gesture/button from outside the app.
   - **Blocker**: Settings sheet cannot be reached in the Debug build without touching app source.

## Source/build identity (unchanged, verified)

- Neither worktree was modified for QA: base server `61ef47381c4`, app base `9f2e18604ecf`.
- Debug and Release products built from those heads; Release has `main.jsbundle` (5,482,629 bytes)
  plus 33 exported assets embedded, ATS patched for `localhost:3016` in the built Info.plist.
- OAuth seeding that DID work (QA DB rows only, no source change): `redirect_uri=gumroadmobile://`,
  scopes `mobile_api creator_api account view_public edit_products`.

## Not attempted

- Android captures: would require a new APK build; deferred per "no new build without normal guard".
- Any publish/commit/push/merge/deploy: none performed.
## Artifact hashes

```
release_binary bb2658ca6e8cafd39fc73ec1c835ca89831df45e51864509fe227eb31e0b7941  53M
release_jsbundle 61bc302b06ec244401551c7c3984ae1c58e51aebb3845bc9df3bd5b11bda00d5
debug_binary eefd1ef8ab34c47fb0cf2ab88f6bd9b4f0ad49b3cb008ff183fb8d7aae3fbc7e
installed 1 bundle(s)
server_head 61ef47381c4ebcd8b856410f97cb0d2effbeb082
app_head 9f2e18604ecf303f2cb5f2251b543a6e0f3e5a8f
captured_at 2026-10-30T04:02:04Z
```
