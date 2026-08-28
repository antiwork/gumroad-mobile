# Backend issues found while capturing these screenshots

Capturing the frames meant running the app against a local `antiwork/gumroad` backend. Two real
problems surfaced, both confirmed present on `antiwork/gumroad` `main`. Neither is fixed in this
repository — they are a follow-up PR against `antiwork/gumroad`.

## 1. `thumbnail_url` is always `nil` in the mobile products API

`Api::Mobile::ProductsController#product_json` reads the thumbnail as:

```ruby
thumbnail_url: props.dig("thumbnail", "url"),
```

`props["thumbnail"]` comes from `DashboardProductsPagePresenter#product_base_data`, which sets it
to `product.thumbnail&.alive&.as_json`. `Thumbnail#as_json` returns **symbol** keys:

```ruby
def as_json(*)
  { url:,
    guid:
  }
end
```

So digging with the string `"url"` always misses, and `thumbnail_url` is always `nil`. Every row
in the app's Products tab renders the placeholder box icon instead of the product's cover.

The test suite cannot catch this: `spec/controllers/api/mobile/products_controller_spec.rb` never
asserts `thumbnail_url`, and `spec/support/schemas/api/mobile/product.json` declares it as
`["string", "null"]`, so `nil` validates.

Working around it locally is what made frame 01 show real cover art.

## 2. `PROTOCOL` cannot be overridden, so local WebViews render blank

`config/domain.rb` hardcodes the development protocol:

```ruby
PROTOCOL = config[:protocol]   # "http" in development
```

The mobile app's `.env` points at `https://gumroad.dev`. Setting `CUSTOM_DOMAIN=gumroad.dev`
changes the host but not the scheme, so Rails still emits asset URLs like
`http://app.localhost:3000/vite-dev/entrypoints/base.ts`. Inside the app's HTTPS WebView those
are unreachable, and every embedded page — sign-in, create product, settings — renders blank with
no error in the app and no error in the Rails log. The failure is silent and takes a while to
diagnose.

`CUSTOM_DOMAIN` alone is therefore not enough to run the mobile app against a local backend, even
though the mobile repo's README implies it is. The follow-up adds a `CUSTOM_PROTOCOL` override.
