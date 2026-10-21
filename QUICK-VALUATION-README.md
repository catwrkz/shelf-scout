# Shelf Scout — Quick Valuation v0.2

This is a standalone screenshot-analysis prototype hosted alongside (not replacing) your existing Shelf Scout scanner.

## Deploy from Windows, entirely in the browser

1. Extract `quick-valuation-prototype-v0.2.zip`.
2. Open https://github.com/catwrkz/shelf-scout and choose **Add file → Upload files**.
3. Replace these FOUR files in the repository **root**:
   - `quick-valuation.html`
   - `quick-valuation.css`
   - `quick-valuation.js`
   - `quick-valuation-demo.png`
4. Commit and wait for GitHub Pages deployment to complete.
5. Open https://catwrkz.github.io/shelf-scout/quick-valuation.html?v=0200 in Safari. The version beside the logo should read `0.2`.

Do not remove or replace `index.html`, `app.js`, or `styles.css` (your separate Shelf Scout camera scanner).

## What changed in v0.2

- For two-column scrolling feeds, infer photo boundaries from title/price locations instead of subtracting a fixed height from the price.
- Combine a seller's asking price and the fee-inclusive total into one listing instead of treating them as two different products.
- Better distinguish left and right columns and keep each crop in its own column.
- Crop handles are 30px wide to make resizing easier on mobile.
- New **Reset crop**, **± Width**, and **± Height** buttons below the screenshot. You can still drag the selection and its four corners.
- Tapping a detected item no longer automatically scrolls away from your screenshot. Use **Review selected item** when you're ready to inspect its title, price, and cropped photo.
- Version-specific JavaScript and stylesheet URLs reduce Safari cache confusion.

## Test with a real Vinted or Facebook screenshot

1. Choose screenshot and wait for the local text scan.
2. Check that the suggested boxes cover **only** product photographs, not listing text or the app header.
3. Tap the desired listing, then adjust its crop as needed using corner handles or the controls below the screenshot.
4. Tap **Review selected item** to check/correct the asking price and item description.
5. Optionally share the cropped photo to Google Lens.

## Important scope limits

- This version uses Tesseract.js OCR to infer where listing photographs sit. **It is not an AI-trained marketplace-layout detector**; results depend on OCR accuracy, how the source app displays listings, and screenshot crops. Manual adjustments remain available.
- The app still does not automatically research Google Lens results, verify maker/authenticity, or retrieve verified sold-price comparisons.
- OCR executes locally in the browser, but downloads its model on first use; internet access is needed for the external research handoff.
- No paid APIs. Nothing about your photo is uploaded to the Shelf Scout GitHub site by the app itself. Sharing and clicking external services send data only when you choose those actions.
- The website does not yet act as an iOS Share Sheet extension; you upload the screenshot through the browser for now.
