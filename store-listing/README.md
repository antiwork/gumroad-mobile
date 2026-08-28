# Store listing

Copy and 6.7" iPhone marketing screenshots for App Store / Play.

The live listing still reads like a 2015 library player (Utilities, “watch what you buy”). The app now creates, edits, and publishes products. These files are the replacement.

The App Store holds one screenshot set per device size per locale, so uploading these **replaces** the current set rather than adding to it.

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

Each frame is a flat Gumroad brand color, one headline set in ABC Favorit Bold (the app's own
typeface, loaded from `assets/fonts/`), and a real iOS Simulator capture in a black bezel that
bleeds off the bottom edge. The UI inside the phone is the live app, not a mock.

| Frame | Screen | Headline | Color |
|---|---|---|---|
| `01-create-product.png` | Products tab | Create a product from your phone. | `#FF90E8` pink |
| `02-name-price.png` | Create product WebView | Name it, price it, go live. | `#FFC900` yellow |
| `03-today.png` | Dashboard, top | See today before you open a laptop. | `#23A094` green |
| `04-sales.png` | Dashboard, sale rows | Every sale, as it lands. | `#90A8ED` purple |
| `05-library.png` | Library tab | Everything you bought, in one place. | `#F4F4F0` cream |

Headlines end in a period, matching the voice on gumroad.com (“Place small bets.”, “Share your
work.”).

Every frame shows a different screen. Captured from a purpose-built marketing seller,
`marketing_capture_seller@gumroad.com` (“Sable Studio”): five products priced $12–$49 with real
cover art, 56 sales today totalling $1,392, 119 sales across the past week, and three Library
purchases from a second creator. Buyer emails and product names are invented.

The `mobile_*_do_not_edit` e2e accounts are deliberately **not** used — their product names
(“Mobile Test Product 1”) and buyer addresses must never reach a store listing.

Raw captures: `screenshots/simulator-raw/`. To rebuild the frames after recapturing, run
`screenshots/render.sh`; every headline and color lives in `screenshots/frame.html`.
Full procedure, including the local backend setup and the seeding, is in
`screenshots/CAPTURE.md`. `marketing-seed.rb` is the seed script it refers to.

Upload the 1290×2796 frames to App Store Connect (iPhone 6.7") and Play Console (phone). Play
also wants 7" / 10" tablets — not in this folder.

## Not in this PR

Receipt / “your download is ready” copy that points at the app. That lives in `antiwork/gumroad`
mailers, not this repo.

Two backend fixes the captures depended on are also not here — they are a follow-up PR against
`antiwork/gumroad`. See `CAPTURE-BACKEND-NOTES.md`.
