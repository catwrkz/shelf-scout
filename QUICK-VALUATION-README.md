# Shelf Scout — Quick Valuation prototype v0.1

This is a **separate experimental tool** for single-item resale research from iPhone screenshots. It does **not change or overwrite** the existing Shelf Scout shelf scanner.

## Deploy using your existing GitHub Pages account (no Windows installations)

1. Extract `quick-valuation-v0.1.zip` on Windows.
2. Open https://github.com/catwrkz/shelf-scout and choose **Add file → Upload files**.
3. Upload these **four** files directly to the repository root, **not** into a subfolder:
   - `quick-valuation.html`
   - `quick-valuation.css`
   - `quick-valuation.js`
   - `quick-valuation-demo.png`
4. Commit and wait for the Pages deployment to finish.
5. On your iPhone in Safari, open **https://catwrkz.github.io/shelf-scout/quick-valuation.html?v=0102**.

The existing `index.html`, `app.js`, and `styles.css` remain untouched.

## Test

1. Tap **Try sample screenshot** to test feed selection without any OCR download.
2. Select one of the sample items. Check that changing items updates the crop and the seller price.
3. Drag the bright crop box and its corner handles to reposition and resize it.
4. Change the title or asking price; check the focused marketplace search links.
5. Upload a real screenshot from Facebook Marketplace or Vinted. Wait for local OCR and check the suggested item regions and prices. **Correct any mistakes before researching.**
6. Tap **Share cropped photo to Google Lens**, select a compatible share destination, or save the crop and upload it to Google Lens yourself.

## Scope and limitations

- The OCR system uses Tesseract.js locally in the browser, downloaded from a public CDN on first run. It can fail without internet access or if Safari runs out of memory. Manual input remains possible.
- The cropped-photo suggestions are **layout heuristics**, not a trained marketplace listing detector. Price text found in the screenshot helps propose product areas; you may need to adjust the crop manually.
- The first version does not automatically recognize maker/model or authenticate items. It does not automatically retrieve Google Lens matches, sold-price records, or green/blue valuations. Marketplace links perform ordinary keyword search. A true Google Lens visual search requires a share/upload through Google's supported interface.
- Nothing in the screenshot, typed title, or cropped image is uploaded to the Shelf Scout hosting server. An optional external search or user-triggered share transmits data to the selected service.
- Avoid listing personal details in screenshots you plan to share. GitHub Pages is a public host, although files selected in your browser are processed client-side and not placed in the repository.
- The web prototype does **not** appear in the iPhone system Share Sheet as an app; that requires a separate native share extension or a Shortcuts workflow. For v0.1 open the link and choose a screenshot from Photos.
- There are no paid API calls. A network connection is needed initially for Tesseract.js and to use external search engines.

## Technical notes

Static HTML/CSS/JavaScript. Browser-side OCR (Tesseract.js 5.1.1), canvas-based crop, user-adjustable crop with pointer events, editable title and asking price, marketplace search links, share/export via Web Share API.
