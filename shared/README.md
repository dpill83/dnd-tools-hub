# Shared header and footer for tools

Use these for consistent navigation and branding across all hub tools.

## Usage

1. In your tool's HTML, **after** `<body>` (or after your main container opening), add:

   ```html
   <div id="hub-header-placeholder"></div>
   ```

2. **Before** `</body>`, add:

   ```html
   <div id="hub-footer-placeholder"></div>
   ```

3. Load scripts in this order (after your tool CSS, before your tool JS):

   ```html
   <script src="../../theme.js"></script>
   <script src="../../shared/header-footer.js"></script>
   ```

4. Ensure your page already links `global.css` (tools already do via `../../global.css`). The shared header and footer use its variables and the `.theme-toggle` styles.

The loader fetches `header.html` and `footer.html` from the same `shared/` folder and injects them. The header includes a link back to the hub and the theme toggle; the footer shows hub branding and a link home. If your tool has its own header with hub link and theme toggle, remove those when switching to the shared header so there is only one `#theme-toggle` on the page.

## Paths

- From a tool at `tools/<name>/index.html`, use `../../shared/header-footer.js`, `../../theme.js`, and `../../global.css`.
- From a tool at `tools/<name>/other.html` or `tools/<folder>/file.html`, the same `../..` goes to the repo root, so `../../index.html` in the fragments still points to the hub.
