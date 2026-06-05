=== Shelf for WooCommerce ===
Contributors: shelf
Tags: woocommerce, analytics, buyer intelligence, demand gap, cart abandonment
Requires at least: 6.0
Tested up to: 6.5
Requires PHP: 7.4
Stable tag: 1.0.0
License: GPLv2 or later
License URI: https://www.gnu.org/licenses/gpl-2.0.html

Connect your WooCommerce store to Shelf for buyer intelligence, demand gap analysis, and real-time store health insights.

== Description ==

**Shelf for WooCommerce** is the official integration between your WooCommerce store and the [Shelf](https://shelf.io) buyer intelligence platform.

Once connected, Shelf gives you:

* **Demand Gap Analysis** — discover what shoppers search for but can't find in your catalog.
* **Search Trend Charts** — visualise how search interest shifts over time.
* **Cart Abandonment Tracking** — see which products are left in carts most often and why.
* **Conversion Funnel** — understand where shoppers drop off from browse to purchase.
* **Top Sellers** — quick view of your revenue-driving products.
* **24-Hour Traffic Heatmap** — know your peak trading hours to time promotions better.

= Privacy =

No personally identifiable information (PII) is ever sent to Shelf. All events are tied to anonymous session identifiers.

= Data synced =

* Product catalog (name, SKU, price, stock, categories) — synced hourly.
* On-site search queries and result counts — buffered and sent every 15 minutes.
* Add-to-cart, remove-from-cart, purchase, and cart-abandon events — buffered and sent every 15 minutes.
* Page views and unique visitor counts — aggregated per hour and sent hourly.

== Installation ==

1. Upload the `shelf-woocommerce` folder to `/wp-content/plugins/`.
2. Activate the plugin through the **Plugins** screen in WordPress.
3. Make sure WooCommerce is installed and active.
4. Go to **Shelf → Settings** and enter your Shelf API key.
5. Click **Save & Verify Connection**.
6. Once connected, visit **Shelf → Insights** to explore your data.

You can obtain an API key from [app.shelf.io/settings/api](https://app.shelf.io/settings/api).

== Frequently Asked Questions ==

= Does this plugin slow down my store? =

No. All data is buffered in WordPress transients and sent to Shelf via scheduled background tasks (WP-Cron). There is no synchronous API call on the critical page-render path.

= What happens if the Shelf API is unreachable? =

Events remain in the transient buffer. The next scheduled flush will attempt delivery again. If the transient expires before delivery (default TTL: 2 hours), those events are discarded gracefully.

= Can I use this without WooCommerce? =

No. This plugin requires WooCommerce to be installed and active.

= Where do I get an API key? =

Sign up or log in at [shelf.io](https://shelf.io), then visit **Settings → API** to generate a key.

= Is any PII sent to Shelf? =

No. The plugin never transmits customer names, email addresses, or any other personally identifiable information. Events are keyed on anonymous session cookies or hashed IP addresses.

== Screenshots ==

1. **Settings page** — enter your API key, store niche, and location.
2. **Demand Gaps tab** — top searches, trend chart, and gap severity alerts.
3. **Store Health tab** — conversion funnel, most-abandoned products, and top sellers.
4. **Activity tab** — 24-hour traffic heatmap and peak-hour badges.

== Changelog ==

= 1.0.0 =
* Initial release.
* Product catalog sync (hourly, batched).
* Search event buffering with 15-minute flush.
* Add-to-cart, remove, purchase, and cart-abandon tracking.
* Page view and unique visitor counters with hourly flush.
* Admin menu with Settings and Insights pages.
* Demand, store-health, and activity insight panels backed by Chart.js.

== Upgrade Notice ==

= 1.0.0 =
First public release. No upgrade steps required.
