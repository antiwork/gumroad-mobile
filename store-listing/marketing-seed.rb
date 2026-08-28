# frozen_string_literal: true

# Marketing-capture seed for App Store screenshots. Creates a dedicated seller with
# realistic products, today's sales, and library purchases. Does not touch the
# mobile_*_do_not_edit e2e accounts.

COVERS_DIR = ENV.fetch("COVERS_DIR")

def marketing_user(email:, name:, username:)
  user = User.find_by(email:)
  if user.nil?
    user = User.create!(
      email:, name:, username:,
      password: SecureRandom.hex(24),
      user_risk_state: "compliant",
      confirmed_at: Time.current
    )
  end
  user.password = "password"
  user.name = name
  user.save!(validate: false)
  user
end

def marketing_product(user:, name:, price_cents:, permalink:, cover:)
  product = Link.find_by(unique_permalink: permalink)
  if product.nil?
    product = Link.new(
      user_id: user.id,
      name:,
      description: "#{name} by #{user.name}.",
      filetype: "link",
      price_cents:,
      unique_permalink: permalink
    )
    product.display_product_reviews = true
    price = product.prices.build(price_cents: product.price_cents)
    price.recurrence = 0
    product.save!
  else
    product.update_columns(name:, price_cents:)
  end
  if product.asset_previews.alive.none?
    preview = product.asset_previews.new
    preview.file.attach(io: File.open(File.join(COVERS_DIR, cover)), filename: cover, content_type: "image/png")
    preview.save!
  end
  product
end

def marketing_sale(product:, email:, minutes_ago:, purchaser: nil)
  t = Time.current - minutes_ago.minutes
  purchase = Purchase.new(
    link_id: product.id,
    seller_id: product.user_id,
    price_cents: product.price_cents,
    displayed_price_cents: product.price_cents,
    tax_cents: 0,
    gumroad_tax_cents: 0,
    total_transaction_cents: product.price_cents,
    purchaser_id: purchaser&.id,
    email:,
    card_country: "US",
    ip_address: "199.241.200.176"
  )
  purchase.send(:calculate_fees)
  purchase.save!
  purchase.update_columns(purchase_state: "successful", succeeded_at: t, created_at: t)
  purchase.create_url_redirect! if purchaser
  purchase
end

seller = marketing_user(
  email: "marketing_capture_seller@gumroad.com",
  name: "Sable Studio",
  username: "sablestudio"
)

golden = marketing_user(
  email: "marketing_capture_golden@gumroad.com",
  name: "Golden Hour Studio",
  username: "goldenhourstudio"
)
if !golden.avatar.attached?
  golden.avatar.attach(io: File.open(File.join(COVERS_DIR, "avatar.png")), filename: "avatar.png", content_type: "image/png")
  golden.save!(validate: false)
end

products = {
  brushes: marketing_product(user: seller, name: "Procreate Brush Studio", price_cents: 1900, permalink: "mktbrushes", cover: "brushes.png"),
  lofi: marketing_product(user: seller, name: "Lofi Beats Vol. 2", price_cents: 1500, permalink: "mktlofi", cover: "lofi.png"),
  notes: marketing_product(user: seller, name: "The Second Brain Notes Kit", price_cents: 1200, permalink: "mktnotes", cover: "notes.png"),
  oil: marketing_product(user: seller, name: "Oil Painting Fundamentals", price_cents: 4900, permalink: "mktoil", cover: "oil.png"),
  peony: marketing_product(user: seller, name: "Watercolor Florals: Peony Pack", price_cents: 2400, permalink: "mktpeony", cover: "peony.png"),
}

library_products = {
  golden_presets: marketing_product(user: golden, name: "Golden Hour Lightroom Presets", price_cents: 2900, permalink: "mktgolden", cover: "golden.png"),
  botanical: marketing_product(user: golden, name: "Botanical Sketchbook Course", price_cents: 3500, permalink: "mktbotanical", cover: "botanical.png"),
  rainy: marketing_product(user: golden, name: "Rainy Day Ambience Pack", price_cents: 1800, permalink: "mktrainy", cover: "rainy.png"),
}

if seller.sales.successful.where("succeeded_at >= ?", Time.current.beginning_of_day).count < 10
  emails = %w[
    claire@fernandfog.com jules@midnightpress.co theo@driftwoodpaper.com
    priya@inkandarrow.studio marisol@quietcanyon.co devon@blueharbor.press
    august@paperlantern.studio noor@saltandcedar.co felix@morningtide.press
    isla@wildfernworks.com
  ]
  plan = { brushes: 14, lofi: 9, notes: 8, oil: 11, peony: 12 }
  i = 0
  plan.each do |key, count|
    count.times do |n|
      minutes = 6 + (i * 613 % 700)
      marketing_sale(product: products[key], email: emails[i % emails.size], minutes_ago: minutes)
      i += 1
    end
  end
  marketing_sale(product: products[:oil], email: "claire@fernandfog.com", minutes_ago: 2)
  marketing_sale(product: products[:brushes], email: "jules@midnightpress.co", minutes_ago: 4)
end

if seller.purchases.where(purchase_state: "successful").none?
  marketing_sale(product: library_products[:golden_presets], email: seller.email, minutes_ago: 3000, purchaser: seller)
  marketing_sale(product: library_products[:botanical], email: seller.email, minutes_ago: 5200, purchaser: seller)
  marketing_sale(product: library_products[:rainy], email: seller.email, minutes_ago: 8100, purchaser: seller)
end

today = seller.sales.successful.where("succeeded_at >= ?", Time.current.beginning_of_day)
puts "seller=#{seller.email} products=#{seller.links.alive.count} today_sales=#{today.count} today_total_cents=#{today.sum(:price_cents)} library_items=#{seller.purchases.where(purchase_state: 'successful').count}"
