# How to recapture the App Store frames

The five frames in `iphone-67/` are 1290x2796 PNG files for the App Store 6.7" slot.
Each frame is a flat Gumroad brand color, one headline in ABC Favorit Bold, and a real
iOS Simulator capture in a black bezel that bleeds off the bottom edge.

## What each frame shows

| Frame | Screen | Headline | Color |
|---|---|---|---|
| `01-create-product.png` | Products tab | Create a product from your phone. | `#FF90E8` pink |
| `02-name-price.png` | Create product WebView | Name it, price it, go live. | `#FFC900` yellow |
| `03-today.png` | Dashboard, top | See today before you open a laptop. | `#23A094` green |
| `04-sales.png` | Dashboard, sale rows | Every sale, as it lands. | `#90A8ED` purple |
| `05-library.png` | Library tab | Everything you bought, in one place. | `#F4F4F0` cream |

## Prerequisites

1. Run the Gumroad web app locally with `CUSTOM_DOMAIN=gumroad.dev`, `CUSTOM_PROTOCOL=https`,
   and `ASSET_DOMAIN=gumroad.dev`. The mobile app reads `https://gumroad.dev`, so Rails must
   build its own URLs with the same host and scheme. Without `CUSTOM_PROTOCOL`, page assets
   point at `http://app.localhost:3000` and every WebView renders blank.
2. Put an HTTPS reverse proxy on port 443 that forwards to Rails on port 3000. Generate the
   certificate with `mkcert gumroad.dev api.gumroad.dev app.gumroad.dev`, then trust the mkcert
   root CA inside the Simulator:
   `xcrun simctl keychain <udid> add-root-cert "$HOME/Library/Application Support/mkcert/rootCA.pem"`
3. Seed the marketing data. Do not use the `mobile_*_do_not_edit` e2e accounts — their product
   names ("Mobile Test Product 1") and buyer emails must never reach a store listing.

## Seeding

The capture account is `marketing_capture_seller@gumroad.com` ("Sable Studio"), password
`password`. Two-factor accepts `000000` in development.

The seed creates:

- 5 products with cover art and thumbnails, priced $12 to $49
- 56 sales today totalling $1,392, and 119 sales across the past week
- Invented buyer emails on plausible studio domains
- 3 Library purchases from a second creator, "Golden Hour Studio", with an avatar

Product thumbnails must be square and at least 600px, or `Thumbnail` validation rejects them.
Upload each blob with `ActiveStorage::Blob.create_and_upload!` and call `blob.analyze` before
attaching, otherwise validation reads no dimensions and fails.

After changing any sale, reindex Elasticsearch (`Purchase.import(force: true)`) and regenerate
the analytics cache (`CreatorAnalytics::CachingProxy#overwrite_cache`) for each affected date.
The Dashboard reads Elasticsearch, not MySQL.

## Capturing

Build the app in Release configuration so no dev-menu bubble appears in the captures:

```bash
LANG=en_US.UTF-8 LC_ALL=en_US.UTF-8 npx expo run:ios --configuration Release --device <udid>
```

The `LANG` export matters: CocoaPods crashes on a non-UTF-8 terminal, and `expo run:ios` runs
`pod install` itself.

Then sign in as the capture account and take one screenshot per screen:

```bash
xcrun simctl io <udid> screenshot simulator-raw/products.png
```

Save them as `simulator-raw/products.png`, `simulator-raw/create.png`,
`simulator-raw/dashboard.png`, `simulator-raw/sales.png`, and `simulator-raw/library.png`.

On the create-product screen, dismiss the "create your product using AI" banner before
capturing, and fill in the Name field. The banner dismissal persists, but the "Name is
required" validation message does not clear until the screen reloads — so dismiss the banner,
close the screen, reopen it, then type the name.

## Rendering

```bash
./render.sh
```

The script drives headless Chrome over `frame.html` and writes the five PNG files.
`frame.html` holds every headline and color, so copy edits happen there.
