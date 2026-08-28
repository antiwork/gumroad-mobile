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

1. Create a product from your phone
2. Change a live product from your phone
3. Name it, price it, go live
4. See today before you open a laptop
5. Sell, and keep everything you own

Source: `screenshots/frame.html`. Re-render with `screenshots/render.sh` (headless Chrome at 1290×2796, `frame.html?n=1` through `n=5`).

These are marketing frames, not device captures. Upload to App Store Connect (iPhone 6.7") and Play Console (phone). Play also wants 7" / 10" tablets — not in this folder.

## Not in this PR

Receipt / “your download is ready” copy that points at the app. That lives in `antiwork/gumroad` mailers, not this repo.
