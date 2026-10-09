# NC State Off-Campus Rental Data Collector

This small kit contains the browser-console scraper used to collect public listing data from NC State's Off-Campus Housing website.

## What's in this ZIP

- `ncsu-rental-scraper.js` — paste this into the browser Developer Tools Console while on the NC State Off-Campus Housing site.
- `README.md` — this file.

The scraper is designed to collect:

1. The unrestricted housing search results.
2. Every search-result page.
3. Every unique exact property listing returned by the search API.
4. A full detail request for each property.
5. A lossless master JSON archive containing the raw API responses.
6. Clean analysis files:
   - `ncsu-properties.csv`
   - `ncsu-floorplans.csv`
   - `ncsu-properties.geojson`

## Why this works

The NC State housing page loads structured JSON from its own backend.

The two useful endpoint patterns are:

Search:
`/bff/listing/search/combined?url=/housing...`

Property detail:
`/bff/listing/{siteId}?campus=&v=5&locale=en`

The scraper runs directly in the browser while you are already on the site, so you do not need to copy cookies, Cloudflare tokens, or browser session headers into the script.

## Important count distinction

The site can report several different counts.

For example, during testing in September 2026 the unrestricted search reported values similar to:

- `totalResults`: 527
- `totalExact`: 168
- `totalPins`: 168
- `totalPages`: 5

Do not assume these values mean the same thing.

`totalExact` and `totalPins` correspond to the exact property/listing records that can be mapped.

`totalResults` is a broader site count and may represent more rental availability than the number of unique map locations.

The scraper preserves the original metadata so the meaning can be checked later instead of guessed.

## How to run it

1. Open:
   `https://offcampus.dasa.ncsu.edu/housing`

2. Open Developer Tools.
   - Firefox: `F12`
   - Chrome/Edge: `F12`

3. Open the **Console** tab.

4. Open `ncsu-rental-scraper.js` in a text editor.

5. Copy the entire file.

6. Paste it into the browser Console and press Enter.

7. Leave the housing tab open while the script runs.

8. If the browser asks whether to allow multiple downloads, allow them.

9. Wait for:

   `====== FINISHED ======`

10. Check the console summary.

A healthy run should have:

- `failed_detail_requests: 0`
- `collected_unique_properties` matching the API's `totalExact`
- `collected_unique_pins` matching the API's `totalPins`

The exact numbers may change as listings are added or removed.

## Files the scraper downloads

### `ncsu-rentals-full-raw-and-derived.json`

This is the most important file.

Keep it as the archival source. It contains:

- scrape timestamp
- API metadata
- raw search responses
- raw property detail responses
- property records
- map pins
- derived property table
- derived floor-plan table
- GeoJSON

If you later realize you want another field, check this file before scraping again.

### `ncsu-properties.csv`

One row per unique exact property/listing.

Useful fields include:

- site ID
- property name
- address
- latitude / longitude
- displayed rent range
- bedroom range
- per-bedroom pricing flag
- shared-space flag
- sublet flag
- target campus
- API-provided campus distance
- lease term
- property type
- total units
- update date
- listing URL

### `ncsu-floorplans.csv`

One row per floor plan returned by the detail API.

Useful for checking:

- bedroom count
- bathroom count
- price range
- per-bed pricing
- square footage
- units available
- availability date
- deposits
- application/admin fees

### `ncsu-properties.geojson`

One point per unique mapped property.

This is ready to load into Leaflet, MapLibre, QGIS, or another mapping tool.

GeoJSON coordinates use:

`[longitude, latitude]`

## What the scraper does NOT do

It does not:

- use copied cookies
- store login credentials
- scrape Google Maps tiles
- geocode addresses externally
- claim that every rental in Raleigh is represented
- automatically decide what `totalResults` means

## Re-running later

The API structure could change.

If the script stops working:

1. Open Developer Tools > Network.
2. Filter to XHR/Fetch.
3. Reload the housing page.
4. Look for:
   - `combined?url=/housing`
   - `/bff/listing/{siteId}`
5. Compare those request URLs with the endpoint patterns used in the script.

If only a smaller number of properties are collected, check that the scraper is using:

`/housing`

and not a map-bounded query such as:

`/housing?bounds=...`

A bounds query only returns the map area currently being viewed.

## Reporting / methodology note

For an article, describe this dataset precisely.

Good wording:

> Listings advertised through NC State's Off-Campus Housing website, collected on [date].

Avoid claiming:

> All rentals around NC State.

Those are not the same thing.

Also keep per-bedroom and whole-unit pricing separate. A `$700 /Bedroom` listing is not directly comparable to a `$1,400` whole apartment without additional normalization.

## Privacy / security

Do not save or share copied `Cookie:` headers from Developer Tools.

The browser-console approach avoids hard-coding session tokens into the scraper.

