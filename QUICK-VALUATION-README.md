# Shelf Scout • Quick Valuation v0.3

## What changed

- **Actual image-card detection**: now detects rectangular, image-rich product-photo blocks from screenshot pixels. It no longer calculates the product crop by subtracting a fixed distance from the recognized price.
- **Image and OCR are separate**: first identify photographic regions, then (for user-uploaded screenshots) OCR the text underneath to associate titles and base asking prices with those regions.
- **A clean sample**: `quick-valuation-demo.jpg` is the unannotated Vinted screenshot provided for this test. The demo runs through the same photo detector as any uploaded image. Its known caption and price values are prefilled to make the sample instantly testable, **not claimed to be OCR output**.
- **Crop corrections preserved**: drag a crop, resize from the four handles, or use the width/height and reset buttons.
- Continues to run entirely on your device, except for downloading the open-source OCR engine when needed. Cropped photos are shared only to a target you select.

## Install (no Windows software installation)

1. Extract the ZIP file.
2. Open your existing `catwrkz/shelf-scout` repository on GitHub.
3. At the **repository root**, upload/replace these FIVE app files:
   - `quick-valuation.html`
   - `quick-valuation.css`
   - `quick-valuation.js`
   - `image-cards.js` (**new; must be uploaded**)
   - `quick-valuation-demo.jpg` (**new sample file; replaces the old sample's role**)
4. Optionally upload this `QUICK-VALUATION-README.md` file as well. The previous `quick-valuation-demo.png` is not used anymore; deleting it is optional.
5. Commit, wait for GitHub Pages to deploy, and visit:
   `https://catwrkz.github.io/shelf-scout/quick-valuation.html?v=0300`
6. Tap **Try sample screenshot** to test four photographic cards. Try changing from item 1 to 4, and inspect the cropped-image preview. Then upload your own Vinted/Facebook screenshots.

## What was tested

- The supplied Vinted screenshot returned four image-card regions with boundaries that match the four photographs rather than the titles or prices.
- An older synthetic two-column screenshot also returned four distinct image cards (regression check).
- Mobile browser interaction test confirmed that the sample produces four selectable cards and selects the corresponding description and asking price without JavaScript errors.

## Limitations

- Boundary detection uses on-device pixel/rectangle analysis, **not a trained image-card segmentation model**. Very dark photographs on a dark app, unusual layouts, heavily overlapping UI, scrolling carousels, and single-listing views can still need manual crops.
- OCR on real screenshots is downloaded at first use and may misread or misassociate a title/price. **Review the extracted values**. The displayed source asking price is not a verified resale value.
- The original screenshot and images stay local to your browser until you explicitly share a crop.
- No automatic authentication, online visual match import, or verified sold-price appraisal is implemented.
