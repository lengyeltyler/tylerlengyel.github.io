# SVG Editor Plan

## DEV NOTE

- Route: `/svg-editor/`
- Entry HTML: `svg-editor/index.html`
- Current editor implementation is shipped as a prebuilt JS bundle: `svg-editor/assets/index-B-BPY9Va.js`
- Current site local run command: `python3 -m http.server 8080`

## Refactor intent

Upgrade the editor toward an Illustrator-like workflow while preserving route stability and existing pages.

## Milestone strategy

- Keep changes small and reversible.
- Maintain a working editor at each checkpoint.
- Introduce a clearer object model and selection/transform/path-editing pipeline.
- Improve layer operations and export cleanliness without adding heavy dependencies.
