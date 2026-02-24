# tylerlengyel.com

Static site for `tylerlengyel.com`.

## Local preview

```bash
python3 -m http.server 8080
```

Then open `http://localhost:8080/`.

## Homepage

- `/index.html` is the terminal-style landing page.
- Terminal project links and project cards are rendered from the `projects` array in the inline script near the bottom of `index.html`.
- Notes/updates are plain HTML list items in `index.html` for easy editing.

## Routes

- Canonical Linear A page: `/linearA/index.html`
- Alias for terminal copy: `/linear-a` (redirects via `/linear-a/index.html`)
- Canonical createPhil page: `/createPhil/`
- Alias for terminal copy: `/createphil` (redirects in `404.html`)
- SVG editor: `/svg-editor/`
