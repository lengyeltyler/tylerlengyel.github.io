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

## Architecture audit (Milestone 1)

- Rendering backend: SVG DOM (not canvas). The editor renders shape elements (`rect`, `ellipse`, `path`) with direct pointer handlers.
- State model: in-memory shape array with ad-hoc shape payloads and style fields (`fill`, `stroke`, `strokeWidth`, optional `transform`, `visible`, `locked`).
- Tool handling: toolbar currently exposes `select`, `rect`, `ellipse`, `pen`, `text` modes.
- Selection model: object-level selection with shift-click multi-select. Selection visual feedback is a drop-shadow and path anchor dots for editable path points.
- Editing currently present: draw rect/ellipse, simple pen paths, anchor drag for line-path points, pan/zoom, layers list, basic z-order controls, undo/redo, SVG import/export.
- Main constraints discovered:
  - Editor route currently embeds the editor via iframe.
  - Runtime initialization failures were not previously guarded with user-visible feedback in this repo route wrapper.

## Canonical model (Milestone 2)

- Added local runtime files: `svg-editor/editor.html`, `svg-editor/illustrator-lite.css`, `svg-editor/illustrator-lite.js`.
- Canonical shape contract:
  - `id`, `type`, `zIndex`, `name`, `visible`, `locked`
  - `transform` as `{ tx, ty, sx, sy, rotation }`
  - `style` as `{ fill, stroke, strokeWidth, opacity }`
  - `geometry` payload per type (`rect`, `ellipse`, `path`)
- Added compatibility adapter:
  - `fromLegacyShape(...)` and `toLegacyShape(...)` bridge legacy shape payloads.
  - `adaptShapeArray(...)` normalizes canonical or legacy arrays to one render pipeline.
- Rendering now consumes canonical object data and serializes clean SVG from that model.
