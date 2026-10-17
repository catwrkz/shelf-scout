# Shelf Scout v1.4 — Visual Matches Research Hub

This build extends the working v1.3.1 GitHub Pages scanner. It **does not change the local OWL-ViT detection, progressive validation, Google Lens share flow, or Google Programmable Search integration**. It adds a research card Visual Matches section and a mobile-friendly import panel. **No paid APIs, browser scraping, or Google sign-in are required.**

## Publish without installing Windows software

1. Download and extract `shelf-scout-prototype-v1.4.zip`.
2. Open `https://github.com/catwrkz/shelf-scout` in a browser.
3. Upload and replace the **six files** in the repository root: `index.html`, `app.js`, `matches.js`, `styles.css`, `demo-shelf.png`, `README.md`. The new `matches.js` file is essential.
4. Commit your changes, then wait for the GitHub Pages deployment to finish under Actions.
5. Open `https://catwrkz.github.io/shelf-scout/?v=140` in iPhone Safari and verify **v1.4** is shown.

## Try the new feature

1. Scan a shelf photo and tap a numbered object.
2. Scroll to the **Visual matches** section in its item research card. Tap **Import visual matches**.
3. For a fast demonstration, tap **Load brown-mug test data**, then **Import & deduplicate**.
4. Five visual result cards consolidate to **two unique links**: one Etsy listing with a $34 asking price for a set, and one eBay listing with a $24 asking price. Neither is a verified exact match or completed sale.
5. For real research, tap **Copy research prompt** and use ChatGPT Work with a Google Lens results page and the item photo. Paste its JSON array or Markdown results table directly into the Shelf Scout importer.
6. Tap source links to inspect original listings. Use **Your visual review** to record possible / likely / not-a-match, or remove a listing.

## Accepted input formats

- **JSON array**, or an object with a `matches` array. Recommended fields: `marketplace`, `title`, `url`, `price` (e.g. "$24"), `price_status` (`asking`, `sold`, or `unknown`), `image_url` (optional), `sale_date` (optional), `notes` (optional).
- **Markdown tables**, including the exact style of ChatGPT Work's earlier response, with columns for `Listing title`, `Marketplace`, `Displayed price`, `Price status`, and `Destination URL` containing Markdown links.
- `image_url` is optional because Work's normal result table may not expose thumbnail URLs. Without one, the app shows a marketplace placeholder, not an invented image.
- Imported results are deduplicated by canonical destination identifiers (eBay item ID, Etsy listing ID, Poshmark and Mercari listing IDs, or normalized website URL) and show how many search-result cards belong to one listing.

## Evidence and privacy rules

- **Asking prices ≠ sold prices.** Imported `sold` results display as **Reported sold · not verified** until source evidence is independently checked. Shelf Scout never automatically colors an object green or blue from imported links.
- A visually similar product can be a different item. The Etsy $34 example is a **set**, not a single mug.
- Imported research stays in browser memory for the current scan. It persists to local device storage **only if you explicitly save the item as a Favorite**. Favorites are not synchronized across devices.
- Thumbnail URLs (when supplied) are fetched by Safari from the source, potentially sharing ordinary browser metadata. Avoid private or untrusted image sources.
- Do not paste passwords, login cookies, or API keys into the importer.
- Import and display of user-provided research data does not grant rights to reproduce third-party images or content elsewhere.
- Google Programmable Search uses text searches; Google Lens reverse-image search still opens outside Shelf Scout and results must be imported by the user.

## Limitations

The initial model download is large. Detection and category identification remain experimental and may be slow on an iPhone 14 Pro. The matches panel does not execute a browser agent, scrape marketplaces, verify maker/authenticity, or retrieve historical sold transactions automatically. It establishes a structured, auditable UI for research results while preserving the zero-paid-API prototype architecture.
