# Store listing

Copy and 6.7" iPhone marketing screenshots for App Store / Play.

The live listing still reads like a 2015 library player (Utilities, “watch what you buy”). The app now creates, edits, and publishes products. These files are the replacement.

## Copy (`en-US/`)

| File | Limit | Notes |
|---|---|---|
| `subtitle.txt` | 30 chars (App Store) | “Create and sell on mobile” |
| `promotional_text.txt` | 170 chars | Shown above the fold |
| `description.txt` | 4000 | Leads with product creation. Fee line is 10% + 50¢. |
| `keywords.txt` | 100 chars | App Store only |

Also move the iOS category from **Utilities** to **Business** in App Store Connect. That is not in git.

## Screenshots

`screenshots/iphone-67/` — 1290×2796 PNG, App Store 6.7" slot.

Each frame is a real iOS Simulator capture (iPhone 17 Pro, store build `com.GRD.Gumroad`) on a black 6.7" canvas with a headline. The UI inside the phone is the live app, not a mock.

1. Products — Create a product from your phone (two live $5 products + New)
2. Products — same catalogue still (create/edit WebView not recaptured)
3. Dashboard — See today before you open a laptop ($10 from 2 sales)
4. Dashboard — Your numbers, on your phone
5. Library — Watch what you bought (seeded purchase)

Captured while signed in as the local seeded seller `mobile_seller1_do_not_edit@gumroad.com`. Dashboard sale rows show that seed buyer email.

Raw captures: `screenshots/simulator-raw/`. Upload the 1290×2796 frames to App Store Connect (iPhone 6.7") and Play Console (phone). Play also wants 7" / 10" tablets — not in this folder.

## Not in this PR

Receipt / “your download is ready” copy that points at the app. That lives in `antiwork/gumroad` mailers, not this repo.
