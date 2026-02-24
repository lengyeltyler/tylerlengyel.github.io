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

## Selection + hit testing (Milestone 3)

- Selection behavior:
  - click selects topmost hit object
  - shift-click toggles multi-selection
  - selection bounds are rendered in an overlay layer
- Hit testing:
  - primary path uses `elementsFromPoint(...)` for topmost DOM hit
  - geometry fallback added for common shapes (rect/ellipse/path bounding checks)

## Transform handles (Milestone 4)

- Added transform overlay handles for current selection:
  - move via object drag
  - scale via corner handles
  - rotate via top-center rotate handle
- Transform writes go through canonical object `transform` values (`tx`, `ty`, `sx`, `sy`, `rotation`) instead of direct DOM mutation.
- Keyboard nudge is wired to transform translation on selected objects.

## Layers + grouping v1 (Milestone 5)

- Layers panel now includes:
  - z-order listing
  - object selection from layers
  - buttons for `Bring forward` and `Send backward`
- Grouping v1:
  - `Group` wraps selected top-level objects in a container object (`type: group`)
  - `Ungroup` promotes children back to top-level and propagates parent transform to each child

## Direct selection foundation (Milestone 6)

- Added `direct` mode anchor rendering for selected path objects.
- Direct selection behavior:
  - shows path anchors in overlay
  - click anchor to select
  - drag anchor to edit straight-segment geometry
- Existing non-path objects continue to use object-level selection and transforms unchanged.

## Pen tool v1 (Milestone 7)

- Pen flow implemented on canonical path objects:
  - click to create anchors
  - click near first anchor to close path
  - `Escape` cancels active path creation draft
- New paths are persisted/rendered through object model and included in SVG export.

## Bézier handles v1 (Milestone 8)

- Direct mode now renders Bézier in/out handles for the active anchor.
- Handle dragging updates canonical anchor `inHandle` / `outHandle` coordinates and path `d` output.
- Mirrored-handle behavior is default (smooth curve), with `Alt` drag allowing independent handle edits.

## Style inspector (Milestone 9)

- Added inspector controls for selected object style:
  - fill color
  - stroke color
  - stroke width
  - opacity
- Style changes are applied through canonical object model updates for current selection.

## Undo/redo (Milestone 10)

- History stack covers:
  - object create/delete
  - move/scale/rotate transforms
  - path edits (anchor move, handle move, pen anchor add, close path)
  - style inspector changes
- Keyboard shortcuts:
  - `Cmd/Ctrl+Z` undo
  - `Shift+Cmd/Ctrl+Z` and `Cmd/Ctrl+Y` redo
