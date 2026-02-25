const SVG_NS = "http://www.w3.org/2000/svg";

const TOOLS = {
  SELECT: "select",
  RECT: "rect",
  ELLIPSE: "ellipse",
  PEN: "pen",
  DIRECT: "direct"
};

const DEFAULT_STYLE = {
  fill: "#90caf955",
  stroke: "#1976d2",
  strokeWidth: 2,
  opacity: 1
};

const DEFAULT_TRANSFORM = {
  tx: 0,
  ty: 0,
  sx: 1,
  sy: 1,
  rotation: 0
};

const STORAGE_LEGACY_KEY = "svg-editor:legacy-shapes:v2";
const STORAGE_CANONICAL_KEY = "svg-editor:canonical-shapes:v2";

const dom = {
  toolGroup: document.getElementById("tool-group"),
  canvas: document.getElementById("editor-canvas"),
  canvasBackground: document.getElementById("canvas-bg"),
  scene: document.getElementById("scene-root"),
  overlay: document.getElementById("overlay-root"),
  layers: document.getElementById("layers-list"),
  layerForwardBtn: document.getElementById("layer-forward-btn"),
  layerBackwardBtn: document.getElementById("layer-backward-btn"),
  groupBtn: document.getElementById("group-btn"),
  ungroupBtn: document.getElementById("ungroup-btn"),
  alignLeftBtn: document.getElementById("align-left-btn"),
  alignHCenterBtn: document.getElementById("align-hcenter-btn"),
  alignRightBtn: document.getElementById("align-right-btn"),
  alignTopBtn: document.getElementById("align-top-btn"),
  alignVCenterBtn: document.getElementById("align-vcenter-btn"),
  alignBottomBtn: document.getElementById("align-bottom-btn"),
  distributeHBtn: document.getElementById("distribute-h-btn"),
  distributeVBtn: document.getElementById("distribute-v-btn"),
  booleanUniteBtn: document.getElementById("boolean-unite-btn"),
  booleanSubtractBtn: document.getElementById("boolean-subtract-btn"),
  booleanIntersectBtn: document.getElementById("boolean-intersect-btn"),
  snapToggleBtn: document.getElementById("snap-toggle-btn"),
  statusLeft: document.getElementById("status-left"),
  docWidth: document.getElementById("doc-width-input"),
  docHeight: document.getElementById("doc-height-input"),
  fillInput: document.getElementById("fill-input"),
  strokeInput: document.getElementById("stroke-input"),
  strokeWidthInput: document.getElementById("stroke-width-input"),
  opacityInput: document.getElementById("opacity-input"),
  transformXInput: document.getElementById("transform-x-input"),
  transformYInput: document.getElementById("transform-y-input"),
  transformWInput: document.getElementById("transform-w-input"),
  transformHInput: document.getElementById("transform-h-input"),
  transformRotateInput: document.getElementById("transform-rotate-input"),
  selectionSummary: document.getElementById("selection-summary"),
  undoBtn: document.getElementById("undo-btn"),
  redoBtn: document.getElementById("redo-btn"),
  downloadSvgBtn: document.getElementById("download-svg-btn"),
  copySvgBtn: document.getElementById("copy-svg-btn")
};

const requiredDomKeys = [
  "toolGroup",
  "canvas",
  "canvasBackground",
  "scene",
  "overlay",
  "layers",
  "layerForwardBtn",
  "layerBackwardBtn",
  "groupBtn",
  "ungroupBtn",
  "alignLeftBtn",
  "alignHCenterBtn",
  "alignRightBtn",
  "alignTopBtn",
  "alignVCenterBtn",
  "alignBottomBtn",
  "distributeHBtn",
  "distributeVBtn",
  "booleanUniteBtn",
  "booleanSubtractBtn",
  "booleanIntersectBtn",
  "snapToggleBtn",
  "statusLeft",
  "docWidth",
  "docHeight",
  "fillInput",
  "strokeInput",
  "strokeWidthInput",
  "opacityInput",
  "transformXInput",
  "transformYInput",
  "transformWInput",
  "transformHInput",
  "transformRotateInput",
  "selectionSummary",
  "undoBtn",
  "redoBtn",
  "downloadSvgBtn",
  "copySvgBtn"
];

for (const key of requiredDomKeys) {
  if (!dom[key]) {
    throw new Error(`[svg-editor] Missing required element: ${key}`);
  }
}

const state = {
  doc: {
    width: 1200,
    height: 800
  },
  tool: TOOLS.SELECT,
  objects: [],
  selection: [],
  activePathId: null,
  directSelection: {
    pathId: null,
    anchorIndex: null
  },
  interaction: {
    mode: null,
    pointerId: null,
    start: null,
    draftId: null,
    startTransforms: null,
    handleKind: null,
    marqueeStart: null,
    marqueeCurrent: null,
    marqueeAdditive: false,
    snapGuides: [],
    startSelectionBounds: null
  },
  history: {
    undo: [],
    redo: []
  },
  snap: {
    enabled: true,
    threshold: 6
  }
};

let idCounter = 0;

const SCALE_HANDLE_CONFIG = {
  nw: { x: 0, y: 0, cursor: "nwse-resize" },
  ne: { x: 1, y: 0, cursor: "nesw-resize" },
  se: { x: 1, y: 1, cursor: "nwse-resize" },
  sw: { x: 0, y: 1, cursor: "nesw-resize" }
};

function nextId(prefix = "obj") {
  idCounter += 1;
  return `${prefix}_${Date.now().toString(36)}_${idCounter.toString(36)}`;
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function round(value, precision = 3) {
  const m = 10 ** precision;
  return Math.round(value * m) / m;
}

const colorCanvas = document.createElement("canvas");
const colorContext = colorCanvas.getContext("2d");

function colorToHex(value, fallback = "#000000") {
  if (typeof value !== "string" || value === "" || value === "none" || value === "transparent") {
    return fallback;
  }

  const hexMatch = value.trim().match(/^#([0-9a-f]{3,4}|[0-9a-f]{6}|[0-9a-f]{8})$/i);
  if (hexMatch) {
    const raw = hexMatch[1].toLowerCase();
    if (raw.length === 3) {
      return `#${raw[0]}${raw[0]}${raw[1]}${raw[1]}${raw[2]}${raw[2]}`;
    }
    if (raw.length === 4) {
      return `#${raw[0]}${raw[0]}${raw[1]}${raw[1]}${raw[2]}${raw[2]}`;
    }
    if (raw.length === 8) {
      return `#${raw.slice(0, 6)}`;
    }
    return `#${raw}`;
  }

  if (!colorContext) {
    return fallback;
  }

  try {
    colorContext.fillStyle = "#000000";
    colorContext.fillStyle = value;
    const normalized = colorContext.fillStyle;
    if (typeof normalized === "string") {
      return colorToHex(normalized, fallback);
    }
  } catch (error) {
    return fallback;
  }

  return fallback;
}

function deepClone(value) {
  if (typeof structuredClone === "function") {
    return structuredClone(value);
  }
  return JSON.parse(JSON.stringify(value));
}

function normalizeTransform(transform) {
  return {
    ...DEFAULT_TRANSFORM,
    ...(transform || {})
  };
}

function normalizeStyle(style) {
  return {
    ...DEFAULT_STYLE,
    ...(style || {})
  };
}

function transformToString(transform) {
  const t = normalizeTransform(transform);
  const parts = [];
  if (t.tx || t.ty) {
    parts.push(`translate(${round(t.tx)} ${round(t.ty)})`);
  }
  if (t.rotation) {
    parts.push(`rotate(${round(t.rotation)})`);
  }
  if (t.sx !== 1 || t.sy !== 1) {
    parts.push(`scale(${round(t.sx)} ${round(t.sy)})`);
  }
  return parts.join(" ");
}

function buildPathD(anchors, closed) {
  if (!anchors || anchors.length === 0) {
    return "";
  }

  const first = anchors[0];
  const commands = [`M ${round(first.x)} ${round(first.y)}`];

  for (let i = 1; i < anchors.length; i += 1) {
    const prev = anchors[i - 1];
    const current = anchors[i];
    const c1 = prev.outHandle;
    const c2 = current.inHandle;
    if (c1 || c2) {
      const c1x = c1 ? c1.x : prev.x;
      const c1y = c1 ? c1.y : prev.y;
      const c2x = c2 ? c2.x : current.x;
      const c2y = c2 ? c2.y : current.y;
      commands.push(
        `C ${round(c1x)} ${round(c1y)} ${round(c2x)} ${round(c2y)} ${round(current.x)} ${round(current.y)}`
      );
    } else {
      commands.push(`L ${round(current.x)} ${round(current.y)}`);
    }
  }

  if (closed && anchors.length > 1) {
    const last = anchors[anchors.length - 1];
    const start = anchors[0];
    const c1 = last.outHandle;
    const c2 = start.inHandle;
    if (c1 || c2) {
      const c1x = c1 ? c1.x : last.x;
      const c1y = c1 ? c1.y : last.y;
      const c2x = c2 ? c2.x : start.x;
      const c2y = c2 ? c2.y : start.y;
      commands.push(
        `C ${round(c1x)} ${round(c1y)} ${round(c2x)} ${round(c2y)} ${round(start.x)} ${round(start.y)}`
      );
      commands.push("Z");
    } else {
      commands.push("Z");
    }
  }

  return commands.join(" ");
}

function parseLegacyTransform(transform) {
  if (!transform || typeof transform !== "string") {
    return deepClone(DEFAULT_TRANSFORM);
  }

  const result = deepClone(DEFAULT_TRANSFORM);
  const translateMatch = transform.match(/translate\(([-\d.]+)[\s,]+([-\d.]+)\)/);
  if (translateMatch) {
    result.tx = Number(translateMatch[1]) || 0;
    result.ty = Number(translateMatch[2]) || 0;
  }

  const rotateMatch = transform.match(/rotate\(([-\d.]+)/);
  if (rotateMatch) {
    result.rotation = Number(rotateMatch[1]) || 0;
  }

  const scaleMatch = transform.match(/scale\(([-\d.]+)(?:[\s,]+([-\d.]+))?\)/);
  if (scaleMatch) {
    const sx = Number(scaleMatch[1]);
    const sy = Number(scaleMatch[2]);
    result.sx = Number.isFinite(sx) ? sx : 1;
    result.sy = Number.isFinite(sy) ? sy : result.sx;
  }

  return result;
}

function parseLegacyPathD(pathD) {
  if (!pathD || typeof pathD !== "string") {
    return { anchors: [], closed: false };
  }

  const tokens = pathD.match(/[MLCZmlcz]|-?\d*\.?\d+(?:e[-+]?\d+)?/g);
  if (!tokens) {
    return { anchors: [], closed: false };
  }

  const anchors = [];
  let cursor = { x: 0, y: 0 };
  let command = "M";
  let i = 0;
  let closed = false;

  while (i < tokens.length) {
    const token = tokens[i];
    if (/^[MLCZmlcz]$/.test(token)) {
      command = token;
      i += 1;
      if (command === "Z" || command === "z") {
        closed = true;
      }
      continue;
    }

    if (command === "M" || command === "L") {
      const x = Number(tokens[i]);
      const y = Number(tokens[i + 1]);
      if (Number.isFinite(x) && Number.isFinite(y)) {
        cursor = { x, y };
        anchors.push({ x, y, inHandle: null, outHandle: null });
      }
      i += 2;
      continue;
    }

    if (command === "m" || command === "l") {
      const dx = Number(tokens[i]);
      const dy = Number(tokens[i + 1]);
      if (Number.isFinite(dx) && Number.isFinite(dy)) {
        cursor = { x: cursor.x + dx, y: cursor.y + dy };
        anchors.push({ x: cursor.x, y: cursor.y, inHandle: null, outHandle: null });
      }
      i += 2;
      continue;
    }

    if (command === "C" || command === "c") {
      const values = tokens.slice(i, i + 6).map(Number);
      if (values.every((value) => Number.isFinite(value)) && anchors.length > 0) {
        const [x1, y1, x2, y2, x, y] = values;
        const absolute = command === "C";
        const prev = anchors[anchors.length - 1];
        prev.outHandle = {
          x: absolute ? x1 : prev.x + x1,
          y: absolute ? y1 : prev.y + y1
        };

        const anchorX = absolute ? x : prev.x + x;
        const anchorY = absolute ? y : prev.y + y;

        anchors.push({
          x: anchorX,
          y: anchorY,
          inHandle: {
            x: absolute ? x2 : prev.x + x2,
            y: absolute ? y2 : prev.y + y2
          },
          outHandle: null
        });
        cursor = { x: anchorX, y: anchorY };
      }
      i += 6;
      continue;
    }

    i += 1;
  }

  return { anchors, closed };
}

function isCanonicalShape(raw) {
  return Boolean(
    raw &&
      typeof raw === "object" &&
      raw.id &&
      raw.type &&
      raw.style &&
      raw.transform &&
      raw.geometry
  );
}

function normalizeCanonicalShape(raw, fallbackZ) {
  const normalized = {
    id: raw.id || nextId(),
    type: raw.type,
    name: raw.name || raw.type,
    zIndex: Number.isFinite(raw.zIndex) ? raw.zIndex : fallbackZ,
    visible: raw.visible !== false,
    locked: raw.locked === true,
    transform: normalizeTransform(raw.transform),
    style: normalizeStyle(raw.style),
    geometry: deepClone(raw.geometry)
  };

  if (normalized.type === "group") {
    const children = Array.isArray(raw.children) ? raw.children : [];
    normalized.children = children.map((child, index) =>
      isCanonicalShape(child) ? normalizeCanonicalShape(child, index) : fromLegacyShape(child, index)
    );
  }

  if (normalized.type === "path") {
    const geometry = normalized.geometry || {};
    const anchors = Array.isArray(geometry.anchors) ? geometry.anchors : [];
    normalized.geometry = {
      anchors: anchors.map((anchor) => ({
        x: Number(anchor.x) || 0,
        y: Number(anchor.y) || 0,
        inHandle:
          anchor.inHandle && Number.isFinite(anchor.inHandle.x) && Number.isFinite(anchor.inHandle.y)
            ? { x: Number(anchor.inHandle.x), y: Number(anchor.inHandle.y) }
            : null,
        outHandle:
          anchor.outHandle && Number.isFinite(anchor.outHandle.x) && Number.isFinite(anchor.outHandle.y)
            ? { x: Number(anchor.outHandle.x), y: Number(anchor.outHandle.y) }
            : null
      })),
      closed: geometry.closed === true
    };
  }

  if (normalized.type === "boolean") {
    const geometry = normalized.geometry || {};
    normalized.geometry = {
      op:
        geometry.op === "subtract" || geometry.op === "intersect" || geometry.op === "unite"
          ? geometry.op
          : "unite",
      aPath: typeof geometry.aPath === "string" ? geometry.aPath : "",
      bPath: typeof geometry.bPath === "string" ? geometry.bPath : "",
      bounds: geometry.bounds
        ? {
            x: Number(geometry.bounds.x) || 0,
            y: Number(geometry.bounds.y) || 0,
            width: Math.max(1, Number(geometry.bounds.width) || 1),
            height: Math.max(1, Number(geometry.bounds.height) || 1)
          }
        : { x: 0, y: 0, width: 1, height: 1 }
    };
  }

  return normalized;
}

function fromLegacyShape(raw, fallbackZ) {
  const type = raw?.type || "rect";
  const style = normalizeStyle({
    fill: raw?.fill?.color || raw?.fill || DEFAULT_STYLE.fill,
    stroke: raw?.stroke?.color || raw?.stroke || DEFAULT_STYLE.stroke,
    strokeWidth: Number(raw?.stroke?.width ?? raw?.strokeWidth ?? DEFAULT_STYLE.strokeWidth),
    opacity: Number(raw?.opacity ?? DEFAULT_STYLE.opacity)
  });

  const base = {
    id: raw?.id || nextId(),
    type,
    name: raw?.name || type,
    zIndex: Number.isFinite(raw?.zIndex) ? raw.zIndex : fallbackZ,
    visible: raw?.visible !== false,
    locked: raw?.locked === true,
    transform: raw?.transform && typeof raw.transform === "object" ? normalizeTransform(raw.transform) : parseLegacyTransform(raw?.transform),
    style
  };

  if (type === "ellipse") {
    return {
      ...base,
      geometry: {
        cx: Number(raw?.cx ?? raw?.x ?? 0),
        cy: Number(raw?.cy ?? raw?.y ?? 0),
        rx: Math.max(1, Number(raw?.rx ?? raw?.width ?? 1)),
        ry: Math.max(1, Number(raw?.ry ?? raw?.height ?? 1))
      }
    };
  }

  if (type === "path") {
    if (Array.isArray(raw?.cmds) && raw.cmds.length > 0) {
      const anchors = raw.cmds
        .map((cmd) => {
          if (!Number.isFinite(cmd?.x) || !Number.isFinite(cmd?.y)) {
            return null;
          }
          return {
            x: Number(cmd.x),
            y: Number(cmd.y),
            inHandle: null,
            outHandle: null
          };
        })
        .filter(Boolean);
      return {
        ...base,
        geometry: {
          anchors,
          closed: false
        }
      };
    }

    const parsed = parseLegacyPathD(raw?.d || "");
    return {
      ...base,
      geometry: {
        anchors: parsed.anchors,
        closed: parsed.closed
      }
    };
  }

  if (type === "boolean") {
    const geometry = raw?.geometry || {};
    return {
      ...base,
      type: "boolean",
      geometry: {
        op:
          geometry.op === "subtract" || geometry.op === "intersect" || geometry.op === "unite"
            ? geometry.op
            : "unite",
        aPath: typeof geometry.aPath === "string" ? geometry.aPath : "",
        bPath: typeof geometry.bPath === "string" ? geometry.bPath : "",
        bounds: geometry.bounds
          ? {
              x: Number(geometry.bounds.x) || 0,
              y: Number(geometry.bounds.y) || 0,
              width: Math.max(1, Number(geometry.bounds.width) || 1),
              height: Math.max(1, Number(geometry.bounds.height) || 1)
            }
          : { x: 0, y: 0, width: 1, height: 1 }
      }
    };
  }

  if (type === "group") {
    const children = Array.isArray(raw?.children) ? raw.children : [];
    return {
      ...base,
      children: children.map((child, index) =>
        isCanonicalShape(child) ? normalizeCanonicalShape(child, index) : fromLegacyShape(child, index)
      ),
      geometry: {
        x: 0,
        y: 0,
        width: 0,
        height: 0
      }
    };
  }

  return {
    ...base,
    type: "rect",
    geometry: {
      x: Number(raw?.x ?? 0),
      y: Number(raw?.y ?? 0),
      width: Math.max(1, Number(raw?.width ?? 1)),
      height: Math.max(1, Number(raw?.height ?? 1)),
      rx: Number(raw?.rx ?? 0),
      ry: Number(raw?.ry ?? 0)
    }
  };
}

function adaptShapeArray(input) {
  const arr = Array.isArray(input) ? input : [];
  const adapted = arr.map((raw, index) =>
    isCanonicalShape(raw) ? normalizeCanonicalShape(raw, index) : fromLegacyShape(raw, index)
  );
  return adapted
    .sort((a, b) => a.zIndex - b.zIndex)
    .map((shape, index) => ({ ...shape, zIndex: index }));
}

function toLegacyShape(shape) {
  if (shape.type === "ellipse") {
    return {
      id: shape.id,
      type: "ellipse",
      name: shape.name,
      cx: shape.geometry.cx,
      cy: shape.geometry.cy,
      rx: shape.geometry.rx,
      ry: shape.geometry.ry,
      fill: { color: shape.style.fill },
      stroke: { color: shape.style.stroke, width: shape.style.strokeWidth },
      opacity: shape.style.opacity,
      transform: transformToString(shape.transform),
      visible: shape.visible,
      locked: shape.locked
    };
  }

  if (shape.type === "path") {
    return {
      id: shape.id,
      type: "path",
      name: shape.name,
      d: buildPathD(shape.geometry.anchors, shape.geometry.closed),
      fill: { color: shape.style.fill },
      stroke: { color: shape.style.stroke, width: shape.style.strokeWidth },
      opacity: shape.style.opacity,
      transform: transformToString(shape.transform),
      visible: shape.visible,
      locked: shape.locked
    };
  }

  if (shape.type === "group") {
    return {
      id: shape.id,
      type: "group",
      name: shape.name,
      children: (shape.children || []).map(toLegacyShape),
      transform: transformToString(shape.transform),
      visible: shape.visible,
      locked: shape.locked
    };
  }

  if (shape.type === "boolean") {
    return {
      id: shape.id,
      type: "boolean",
      name: shape.name,
      geometry: deepClone(shape.geometry),
      fill: { color: shape.style.fill },
      stroke: { color: shape.style.stroke, width: shape.style.strokeWidth },
      opacity: shape.style.opacity,
      transform: transformToString(shape.transform),
      visible: shape.visible,
      locked: shape.locked
    };
  }

  return {
    id: shape.id,
    type: "rect",
    name: shape.name,
    x: shape.geometry.x,
    y: shape.geometry.y,
    width: shape.geometry.width,
    height: shape.geometry.height,
    rx: shape.geometry.rx,
    ry: shape.geometry.ry,
    fill: { color: shape.style.fill },
    stroke: { color: shape.style.stroke, width: shape.style.strokeWidth },
    opacity: shape.style.opacity,
    transform: transformToString(shape.transform),
    visible: shape.visible,
    locked: shape.locked
  };
}

function getSnapshot() {
  return JSON.stringify({
    doc: state.doc,
    objects: state.objects,
    selection: state.selection,
    activePathId: state.activePathId
  });
}

function restoreSnapshot(snapshot) {
  const parsed = JSON.parse(snapshot);
  state.doc.width = clamp(Number(parsed?.doc?.width ?? 1200), 64, 10000);
  state.doc.height = clamp(Number(parsed?.doc?.height ?? 800), 64, 10000);
  state.objects = adaptShapeArray(parsed?.objects || []);
  state.selection = Array.isArray(parsed?.selection) ? parsed.selection.filter(Boolean) : [];
  state.activePathId = typeof parsed?.activePathId === "string" ? parsed.activePathId : null;
  render();
}

function pushHistory() {
  state.history.undo.push(getSnapshot());
  if (state.history.undo.length > 200) {
    state.history.undo.shift();
  }
  state.history.redo = [];
  updateHistoryButtons();
}

function undo() {
  if (state.history.undo.length === 0) {
    return;
  }
  const current = getSnapshot();
  const previous = state.history.undo.pop();
  state.history.redo.push(current);
  restoreSnapshot(previous);
  updateHistoryButtons();
}

function redo() {
  if (state.history.redo.length === 0) {
    return;
  }
  const current = getSnapshot();
  const next = state.history.redo.pop();
  state.history.undo.push(current);
  restoreSnapshot(next);
  updateHistoryButtons();
}

function updateHistoryButtons() {
  dom.undoBtn.disabled = state.history.undo.length === 0;
  dom.redoBtn.disabled = state.history.redo.length === 0;
}

function getObjectById(id, objects = state.objects, parent = null) {
  for (let i = 0; i < objects.length; i += 1) {
    const object = objects[i];
    if (object.id === id) {
      return { object, parent, index: i };
    }
    if (object.type === "group" && Array.isArray(object.children)) {
      const nested = getObjectById(id, object.children, object);
      if (nested) {
        return nested;
      }
    }
  }
  return null;
}

function setStatus(message) {
  dom.statusLeft.textContent = message;
}

function svgPointFromEvent(event) {
  const point = dom.canvas.createSVGPoint();
  point.x = event.clientX;
  point.y = event.clientY;
  const matrix = dom.canvas.getScreenCTM();
  if (!matrix) {
    return { x: 0, y: 0 };
  }
  const transformed = point.matrixTransform(matrix.inverse());
  return { x: transformed.x, y: transformed.y };
}

function applyInverseTransform(point, transform) {
  const t = normalizeTransform(transform);
  let x = point.x - t.tx;
  let y = point.y - t.ty;

  if (t.rotation) {
    const radians = (-t.rotation * Math.PI) / 180;
    const cos = Math.cos(radians);
    const sin = Math.sin(radians);
    const rx = x * cos - y * sin;
    const ry = x * sin + y * cos;
    x = rx;
    y = ry;
  }

  x /= t.sx || 1;
  y /= t.sy || 1;

  return { x, y };
}

function applyTransformToPoint(point, transform) {
  const t = normalizeTransform(transform);
  const sx = point.x * (t.sx || 1);
  const sy = point.y * (t.sy || 1);
  const radians = (t.rotation * Math.PI) / 180;
  const cos = Math.cos(radians);
  const sin = Math.sin(radians);
  return {
    x: sx * cos - sy * sin + t.tx,
    y: sx * sin + sy * cos + t.ty
  };
}

function pathCommandsToD(commands) {
  return commands
    .map((command) => {
      if (command.type === "M") {
        return `M ${round(command.x)} ${round(command.y)}`;
      }
      if (command.type === "L") {
        return `L ${round(command.x)} ${round(command.y)}`;
      }
      if (command.type === "C") {
        return `C ${round(command.x1)} ${round(command.y1)} ${round(command.x2)} ${round(command.y2)} ${round(command.x)} ${round(command.y)}`;
      }
      if (command.type === "Z") {
        return "Z";
      }
      return "";
    })
    .filter(Boolean)
    .join(" ");
}

function getRectPathCommands(shape) {
  const g = shape.geometry;
  return [
    { type: "M", x: g.x, y: g.y },
    { type: "L", x: g.x + g.width, y: g.y },
    { type: "L", x: g.x + g.width, y: g.y + g.height },
    { type: "L", x: g.x, y: g.y + g.height },
    { type: "Z" }
  ];
}

function getEllipsePathCommands(shape) {
  const g = shape.geometry;
  const k = 0.5522847498307936;
  const ox = g.rx * k;
  const oy = g.ry * k;
  return [
    { type: "M", x: g.cx + g.rx, y: g.cy },
    { type: "C", x1: g.cx + g.rx, y1: g.cy + oy, x2: g.cx + ox, y2: g.cy + g.ry, x: g.cx, y: g.cy + g.ry },
    { type: "C", x1: g.cx - ox, y1: g.cy + g.ry, x2: g.cx - g.rx, y2: g.cy + oy, x: g.cx - g.rx, y: g.cy },
    { type: "C", x1: g.cx - g.rx, y1: g.cy - oy, x2: g.cx - ox, y2: g.cy - g.ry, x: g.cx, y: g.cy - g.ry },
    { type: "C", x1: g.cx + ox, y1: g.cy - g.ry, x2: g.cx + g.rx, y2: g.cy - oy, x: g.cx + g.rx, y: g.cy },
    { type: "Z" }
  ];
}

function getPathShapeCommands(shape) {
  const anchors = shape.geometry.anchors || [];
  if (anchors.length === 0) {
    return [];
  }

  const commands = [{ type: "M", x: anchors[0].x, y: anchors[0].y }];
  for (let i = 1; i < anchors.length; i += 1) {
    const prev = anchors[i - 1];
    const current = anchors[i];
    if (prev.outHandle || current.inHandle) {
      commands.push({
        type: "C",
        x1: prev.outHandle ? prev.outHandle.x : prev.x,
        y1: prev.outHandle ? prev.outHandle.y : prev.y,
        x2: current.inHandle ? current.inHandle.x : current.x,
        y2: current.inHandle ? current.inHandle.y : current.y,
        x: current.x,
        y: current.y
      });
    } else {
      commands.push({ type: "L", x: current.x, y: current.y });
    }
  }

  if (shape.geometry.closed && anchors.length > 1) {
    const last = anchors[anchors.length - 1];
    const first = anchors[0];
    if (last.outHandle || first.inHandle) {
      commands.push({
        type: "C",
        x1: last.outHandle ? last.outHandle.x : last.x,
        y1: last.outHandle ? last.outHandle.y : last.y,
        x2: first.inHandle ? first.inHandle.x : first.x,
        y2: first.inHandle ? first.inHandle.y : first.y,
        x: first.x,
        y: first.y
      });
    }
    commands.push({ type: "Z" });
  }

  return commands;
}

function shapeToPathCommands(shape) {
  if (shape.type === "rect") {
    return getRectPathCommands(shape);
  }
  if (shape.type === "ellipse") {
    return getEllipsePathCommands(shape);
  }
  if (shape.type === "path") {
    return getPathShapeCommands(shape);
  }
  return null;
}

function transformPathCommands(commands, transform) {
  return commands.map((command) => {
    if (command.type === "Z") {
      return { type: "Z" };
    }
    if (command.type === "C") {
      const p1 = applyTransformToPoint({ x: command.x1, y: command.y1 }, transform);
      const p2 = applyTransformToPoint({ x: command.x2, y: command.y2 }, transform);
      const p = applyTransformToPoint({ x: command.x, y: command.y }, transform);
      return {
        type: "C",
        x1: p1.x,
        y1: p1.y,
        x2: p2.x,
        y2: p2.y,
        x: p.x,
        y: p.y
      };
    }
    const p = applyTransformToPoint({ x: command.x, y: command.y }, transform);
    return { type: command.type, x: p.x, y: p.y };
  });
}

function getCommandsBounds(commands) {
  const points = [];
  for (const command of commands) {
    if (command.type === "Z") {
      continue;
    }
    if (command.type === "C") {
      points.push({ x: command.x1, y: command.y1 });
      points.push({ x: command.x2, y: command.y2 });
    }
    points.push({ x: command.x, y: command.y });
  }
  if (points.length === 0) {
    return null;
  }
  const xs = points.map((point) => point.x);
  const ys = points.map((point) => point.y);
  return {
    x: Math.min(...xs),
    y: Math.min(...ys),
    width: Math.max(...xs) - Math.min(...xs),
    height: Math.max(...ys) - Math.min(...ys)
  };
}

function shapeToWorldPathData(shape) {
  if (shape.type === "boolean") {
    if (shape.geometry?.op === "unite") {
      const d = `${shape.geometry.aPath || ""} ${shape.geometry.bPath || ""}`.trim();
      if (!d) {
        return null;
      }
      return {
        d,
        bounds: shape.geometry?.bounds || null
      };
    }
    return null;
  }

  const commands = shapeToPathCommands(shape);
  if (!commands || commands.length === 0) {
    return null;
  }
  const worldCommands = transformPathCommands(commands, shape.transform);
  const d = pathCommandsToD(worldCommands);
  if (!d) {
    return null;
  }
  return {
    d,
    bounds: getCommandsBounds(worldCommands)
  };
}

function collectObjectIds(shapes = state.objects, out = []) {
  for (const shape of shapes) {
    out.push(shape.id);
    if (shape.type === "group" && Array.isArray(shape.children)) {
      collectObjectIds(shape.children, out);
    }
  }
  return out;
}

function collectSnapCandidates(excludedIds) {
  const xCandidates = [
    { value: 0, spanStart: 0, spanEnd: state.doc.height, source: "artboard" },
    { value: state.doc.width / 2, spanStart: 0, spanEnd: state.doc.height, source: "artboard" },
    { value: state.doc.width, spanStart: 0, spanEnd: state.doc.height, source: "artboard" }
  ];
  const yCandidates = [
    { value: 0, spanStart: 0, spanEnd: state.doc.width, source: "artboard" },
    { value: state.doc.height / 2, spanStart: 0, spanEnd: state.doc.width, source: "artboard" },
    { value: state.doc.height, spanStart: 0, spanEnd: state.doc.width, source: "artboard" }
  ];

  for (const id of collectObjectIds()) {
    if (excludedIds.has(id)) {
      continue;
    }
    const bounds = getObjectWorldBoundsById(id);
    if (!bounds) {
      continue;
    }

    xCandidates.push({
      value: bounds.x,
      spanStart: bounds.y,
      spanEnd: bounds.y + bounds.height,
      source: id
    });
    xCandidates.push({
      value: bounds.x + bounds.width / 2,
      spanStart: bounds.y,
      spanEnd: bounds.y + bounds.height,
      source: id
    });
    xCandidates.push({
      value: bounds.x + bounds.width,
      spanStart: bounds.y,
      spanEnd: bounds.y + bounds.height,
      source: id
    });

    yCandidates.push({
      value: bounds.y,
      spanStart: bounds.x,
      spanEnd: bounds.x + bounds.width,
      source: id
    });
    yCandidates.push({
      value: bounds.y + bounds.height / 2,
      spanStart: bounds.x,
      spanEnd: bounds.x + bounds.width,
      source: id
    });
    yCandidates.push({
      value: bounds.y + bounds.height,
      spanStart: bounds.x,
      spanEnd: bounds.x + bounds.width,
      source: id
    });
  }

  return { xCandidates, yCandidates };
}

function computeSnapAdjustment(startBounds, rawDx, rawDy, excludedIds) {
  if (!startBounds) {
    return { dx: rawDx, dy: rawDy, guides: [] };
  }

  const moved = {
    x: startBounds.x + rawDx,
    y: startBounds.y + rawDy,
    width: startBounds.width,
    height: startBounds.height
  };

  const edgesX = [
    { key: "left", value: moved.x },
    { key: "center", value: moved.x + moved.width / 2 },
    { key: "right", value: moved.x + moved.width }
  ];
  const edgesY = [
    { key: "top", value: moved.y },
    { key: "center", value: moved.y + moved.height / 2 },
    { key: "bottom", value: moved.y + moved.height }
  ];

  const { xCandidates, yCandidates } = collectSnapCandidates(excludedIds);
  let bestX = null;
  for (const edge of edgesX) {
    for (const candidate of xCandidates) {
      const diff = candidate.value - edge.value;
      const abs = Math.abs(diff);
      if (abs <= state.snap.threshold && (!bestX || abs < bestX.abs)) {
        bestX = { abs, diff, edge, candidate };
      }
    }
  }

  let bestY = null;
  for (const edge of edgesY) {
    for (const candidate of yCandidates) {
      const diff = candidate.value - edge.value;
      const abs = Math.abs(diff);
      if (abs <= state.snap.threshold && (!bestY || abs < bestY.abs)) {
        bestY = { abs, diff, edge, candidate };
      }
    }
  }

  const guides = [];
  const snappedDx = rawDx + (bestX ? bestX.diff : 0);
  const snappedDy = rawDy + (bestY ? bestY.diff : 0);

  if (bestX) {
    const y1 = Math.min(moved.y, bestX.candidate.spanStart) - 24;
    const y2 = Math.max(moved.y + moved.height, bestX.candidate.spanEnd) + 24;
    guides.push({
      orientation: "vertical",
      position: bestX.candidate.value,
      start: y1,
      end: y2
    });
  }
  if (bestY) {
    const x1 = Math.min(moved.x, bestY.candidate.spanStart) - 24;
    const x2 = Math.max(moved.x + moved.width, bestY.candidate.spanEnd) + 24;
    guides.push({
      orientation: "horizontal",
      position: bestY.candidate.value,
      start: x1,
      end: x2
    });
  }

  return {
    dx: snappedDx,
    dy: snappedDy,
    guides
  };
}

function pointHitsShapeGeometry(shape, point) {
  const local = applyInverseTransform(point, shape.transform);

  if (shape.type === "rect") {
    const g = shape.geometry;
    return (
      local.x >= g.x &&
      local.x <= g.x + g.width &&
      local.y >= g.y &&
      local.y <= g.y + g.height
    );
  }

  if (shape.type === "ellipse") {
    const g = shape.geometry;
    if (!g.rx || !g.ry) {
      return false;
    }
    const nx = (local.x - g.cx) / g.rx;
    const ny = (local.y - g.cy) / g.ry;
    return nx * nx + ny * ny <= 1;
  }

  if (shape.type === "path") {
    const anchors = shape.geometry.anchors || [];
    if (anchors.length === 0) {
      return false;
    }
    const xs = anchors.map((anchor) => anchor.x);
    const ys = anchors.map((anchor) => anchor.y);
    const minX = Math.min(...xs);
    const maxX = Math.max(...xs);
    const minY = Math.min(...ys);
    const maxY = Math.max(...ys);
    return local.x >= minX && local.x <= maxX && local.y >= minY && local.y <= maxY;
  }

  if (shape.type === "boolean") {
    const b = shape.geometry?.bounds;
    if (!b) {
      return false;
    }
    return (
      local.x >= b.x &&
      local.x <= b.x + b.width &&
      local.y >= b.y &&
      local.y <= b.y + b.height
    );
  }

  return false;
}

function geometryHitTest(point, shapes = state.objects) {
  const ordered = [...shapes].sort((a, b) => b.zIndex - a.zIndex);
  for (const shape of ordered) {
    if (shape.visible === false || shape.locked) {
      continue;
    }
    if (shape.type === "group") {
      const nested = geometryHitTest(point, shape.children || []);
      if (nested) {
        return nested;
      }
      continue;
    }
    if (pointHitsShapeGeometry(shape, point)) {
      return shape.id;
    }
  }
  return null;
}

function hitTestTopObject(event, point) {
  const elements = document.elementsFromPoint(event.clientX, event.clientY);
  const seen = new Set();

  for (const element of elements) {
    if (!dom.canvas.contains(element)) {
      continue;
    }

    if (element === dom.canvasBackground || element.id === "canvas-bg") {
      break;
    }

    const objectNode = element.closest("[data-object-id]");
    if (!objectNode) {
      continue;
    }

    const objectId = objectNode.dataset.objectId;
    if (!objectId || seen.has(objectId)) {
      continue;
    }
    seen.add(objectId);

    const found = getObjectById(objectId);
    if (found && found.object.visible !== false) {
      return objectId;
    }
  }

  return geometryHitTest(point);
}

function createSvgElement(tagName) {
  return document.createElementNS(SVG_NS, tagName);
}

function applyPaintAttributes(node, style, fillOverride = null) {
  const fill = fillOverride ?? style.fill ?? "none";
  node.setAttribute("fill", fill);
  node.setAttribute("stroke", style.stroke || "none");
  node.setAttribute("stroke-width", String(round(style.strokeWidth || 0)));
  node.setAttribute("opacity", String(clamp(style.opacity, 0, 1)));
}

function renderShape(shape, parentNode) {
  if (shape.visible === false) {
    return;
  }

  const group = createSvgElement("g");
  group.setAttribute("class", "scene-object");
  group.dataset.objectId = shape.id;
  group.dataset.objectType = shape.type;
  group.dataset.selected = String(state.selection.includes(shape.id));
  if (shape.locked) {
    group.dataset.locked = "true";
  }

  const transformValue = transformToString(shape.transform);
  if (transformValue) {
    group.setAttribute("transform", transformValue);
  }

  const style = normalizeStyle(shape.style);

  if (shape.type === "rect") {
    const node = createSvgElement("rect");
    node.setAttribute("x", String(round(shape.geometry.x)));
    node.setAttribute("y", String(round(shape.geometry.y)));
    node.setAttribute("width", String(round(Math.max(1, shape.geometry.width))));
    node.setAttribute("height", String(round(Math.max(1, shape.geometry.height))));
    if (shape.geometry.rx) {
      node.setAttribute("rx", String(round(shape.geometry.rx)));
    }
    if (shape.geometry.ry) {
      node.setAttribute("ry", String(round(shape.geometry.ry)));
    }
    applyPaintAttributes(node, style);
    group.appendChild(node);
  } else if (shape.type === "ellipse") {
    const node = createSvgElement("ellipse");
    node.setAttribute("cx", String(round(shape.geometry.cx)));
    node.setAttribute("cy", String(round(shape.geometry.cy)));
    node.setAttribute("rx", String(round(Math.max(1, shape.geometry.rx))));
    node.setAttribute("ry", String(round(Math.max(1, shape.geometry.ry))));
    applyPaintAttributes(node, style);
    group.appendChild(node);
  } else if (shape.type === "path") {
    const node = createSvgElement("path");
    node.setAttribute("d", buildPathD(shape.geometry.anchors, shape.geometry.closed));
    applyPaintAttributes(node, style, shape.geometry.closed ? style.fill || "none" : "none");
    group.appendChild(node);
  } else if (shape.type === "boolean") {
    const op = shape.geometry?.op;
    const aPath = shape.geometry?.aPath;
    const bPath = shape.geometry?.bPath;
    if (typeof aPath !== "string" || typeof bPath !== "string") {
      parentNode.appendChild(group);
      return;
    }

    if (op === "unite") {
      const node = createSvgElement("path");
      node.setAttribute("d", `${aPath} ${bPath}`);
      applyPaintAttributes(node, style, style.fill || "none");
      group.appendChild(node);
    } else if (op === "intersect") {
      const clipId = `clip-${shape.id}`;
      const defs = createSvgElement("defs");
      const clipPath = createSvgElement("clipPath");
      clipPath.setAttribute("id", clipId);
      clipPath.setAttribute("clipPathUnits", "userSpaceOnUse");
      const clipPathNode = createSvgElement("path");
      clipPathNode.setAttribute("d", bPath);
      clipPath.appendChild(clipPathNode);
      defs.appendChild(clipPath);
      group.appendChild(defs);

      const node = createSvgElement("path");
      node.setAttribute("d", aPath);
      node.setAttribute("clip-path", `url(#${clipId})`);
      applyPaintAttributes(node, style, style.fill || "none");
      group.appendChild(node);
    } else if (op === "subtract") {
      const bounds = shape.geometry?.bounds || {
        x: 0,
        y: 0,
        width: state.doc.width,
        height: state.doc.height
      };
      const maskId = `mask-${shape.id}`;
      const defs = createSvgElement("defs");
      const mask = createSvgElement("mask");
      mask.setAttribute("id", maskId);
      mask.setAttribute("maskUnits", "userSpaceOnUse");
      mask.setAttribute("x", String(round(bounds.x - 4)));
      mask.setAttribute("y", String(round(bounds.y - 4)));
      mask.setAttribute("width", String(round(bounds.width + 8)));
      mask.setAttribute("height", String(round(bounds.height + 8)));

      const white = createSvgElement("rect");
      white.setAttribute("x", String(round(bounds.x - 4)));
      white.setAttribute("y", String(round(bounds.y - 4)));
      white.setAttribute("width", String(round(bounds.width + 8)));
      white.setAttribute("height", String(round(bounds.height + 8)));
      white.setAttribute("fill", "#ffffff");

      const black = createSvgElement("path");
      black.setAttribute("d", bPath);
      black.setAttribute("fill", "#000000");

      mask.appendChild(white);
      mask.appendChild(black);
      defs.appendChild(mask);
      group.appendChild(defs);

      const node = createSvgElement("path");
      node.setAttribute("d", aPath);
      node.setAttribute("mask", `url(#${maskId})`);
      applyPaintAttributes(node, style, style.fill || "none");
      group.appendChild(node);
    }
  } else if (shape.type === "group") {
    for (const child of shape.children || []) {
      renderShape(child, group);
    }
  }

  parentNode.appendChild(group);
}

function rectFromPoints(start, end) {
  return {
    x: Math.min(start.x, end.x),
    y: Math.min(start.y, end.y),
    width: Math.abs(end.x - start.x),
    height: Math.abs(end.y - start.y)
  };
}

function rectsIntersect(a, b) {
  return !(
    a.x + a.width < b.x ||
    b.x + b.width < a.x ||
    a.y + a.height < b.y ||
    b.y + b.height < a.y
  );
}

function getNodeWorldBounds(node) {
  if (!node || typeof node.getBBox !== "function") {
    return null;
  }

  const bbox = node.getBBox();
  const matrix = node.getCTM();
  if (!matrix) {
    return null;
  }

  const points = [
    new DOMPoint(bbox.x, bbox.y),
    new DOMPoint(bbox.x + bbox.width, bbox.y),
    new DOMPoint(bbox.x + bbox.width, bbox.y + bbox.height),
    new DOMPoint(bbox.x, bbox.y + bbox.height)
  ].map((point) => point.matrixTransform(matrix));

  const xs = points.map((point) => point.x);
  const ys = points.map((point) => point.y);
  return {
    x: Math.min(...xs),
    y: Math.min(...ys),
    width: Math.max(...xs) - Math.min(...xs),
    height: Math.max(...ys) - Math.min(...ys)
  };
}

function getObjectWorldBoundsById(id) {
  const node = dom.scene.querySelector(`[data-object-id="${CSS.escape(id)}"]`);
  return getNodeWorldBounds(node);
}

function getBoundsForIds(ids) {
  const boxes = ids
    .map((id) => getObjectWorldBoundsById(id))
    .filter(Boolean);

  if (boxes.length === 0) {
    return null;
  }

  const minX = Math.min(...boxes.map((box) => box.x));
  const minY = Math.min(...boxes.map((box) => box.y));
  const maxX = Math.max(...boxes.map((box) => box.x + box.width));
  const maxY = Math.max(...boxes.map((box) => box.y + box.height));

  return {
    x: minX,
    y: minY,
    width: Math.max(1, maxX - minX),
    height: Math.max(1, maxY - minY)
  };
}

function getSelectionBounds() {
  return getBoundsForIds(state.selection);
}

function drawSelectionOutline() {
  while (dom.overlay.firstChild) {
    dom.overlay.firstChild.remove();
  }

  const bounds = getSelectionBounds();
  if (bounds) {
    const rect = createSvgElement("rect");
    rect.setAttribute("class", "selection-outline");
    rect.setAttribute("x", String(round(bounds.x)));
    rect.setAttribute("y", String(round(bounds.y)));
    rect.setAttribute("width", String(round(bounds.width)));
    rect.setAttribute("height", String(round(bounds.height)));
    dom.overlay.appendChild(rect);

    const isTransformTool = state.tool === TOOLS.SELECT || state.tool === TOOLS.DIRECT;
    if (isTransformTool) {
      const centerX = bounds.x + bounds.width / 2;

      const rotateLine = createSvgElement("line");
      rotateLine.setAttribute("class", "rotate-guide-line");
      rotateLine.setAttribute("x1", String(round(centerX)));
      rotateLine.setAttribute("y1", String(round(bounds.y)));
      rotateLine.setAttribute("x2", String(round(centerX)));
      rotateLine.setAttribute("y2", String(round(bounds.y - 24)));
      dom.overlay.appendChild(rotateLine);

      const rotateHandle = createSvgElement("circle");
      rotateHandle.setAttribute("class", "transform-handle transform-handle-rotate");
      rotateHandle.setAttribute("cx", String(round(centerX)));
      rotateHandle.setAttribute("cy", String(round(bounds.y - 28)));
      rotateHandle.setAttribute("r", "6");
      rotateHandle.dataset.handleType = "rotate";
      rotateHandle.style.cursor = "crosshair";
      dom.overlay.appendChild(rotateHandle);

      for (const [name, config] of Object.entries(SCALE_HANDLE_CONFIG)) {
        const x = bounds.x + bounds.width * config.x;
        const y = bounds.y + bounds.height * config.y;
        const handle = createSvgElement("rect");
        handle.setAttribute("class", "transform-handle transform-handle-scale");
        handle.setAttribute("x", String(round(x - 4.5)));
        handle.setAttribute("y", String(round(y - 4.5)));
        handle.setAttribute("width", "9");
        handle.setAttribute("height", "9");
        handle.setAttribute("rx", "1.5");
        handle.dataset.handleType = name;
        handle.style.cursor = config.cursor;
        dom.overlay.appendChild(handle);
      }
    }

    if (state.tool === TOOLS.DIRECT) {
      drawDirectSelectionAnchors();
    }
  }

  if (Array.isArray(state.interaction.snapGuides) && state.interaction.snapGuides.length > 0) {
    for (const guide of state.interaction.snapGuides) {
      const line = createSvgElement("line");
      line.setAttribute("class", "smart-guide");
      if (guide.orientation === "vertical") {
        line.setAttribute("x1", String(round(guide.position)));
        line.setAttribute("x2", String(round(guide.position)));
        line.setAttribute("y1", String(round(guide.start)));
        line.setAttribute("y2", String(round(guide.end)));
      } else {
        line.setAttribute("x1", String(round(guide.start)));
        line.setAttribute("x2", String(round(guide.end)));
        line.setAttribute("y1", String(round(guide.position)));
        line.setAttribute("y2", String(round(guide.position)));
      }
      dom.overlay.appendChild(line);
    }
  }

  if (state.interaction.mode === "marquee-select" && state.interaction.marqueeStart && state.interaction.marqueeCurrent) {
    const marquee = rectFromPoints(state.interaction.marqueeStart, state.interaction.marqueeCurrent);
    const marqueeRect = createSvgElement("rect");
    marqueeRect.setAttribute("class", "marquee-rect");
    marqueeRect.setAttribute("x", String(round(marquee.x)));
    marqueeRect.setAttribute("y", String(round(marquee.y)));
    marqueeRect.setAttribute("width", String(round(Math.max(1, marquee.width))));
    marqueeRect.setAttribute("height", String(round(Math.max(1, marquee.height))));
    dom.overlay.appendChild(marqueeRect);
  }
}

function drawDirectSelectionAnchors() {
  for (const id of state.selection) {
    const found = getObjectById(id);
    if (!found || found.object.type !== "path") {
      continue;
    }

    const path = found.object;
    const anchors = path.geometry.anchors || [];
    for (let index = 0; index < anchors.length; index += 1) {
      const anchor = anchors[index];
      const world = applyTransformToPoint(anchor, path.transform);
      const node = createSvgElement("circle");
      node.setAttribute("class", "path-anchor-handle");
      node.setAttribute("cx", String(round(world.x)));
      node.setAttribute("cy", String(round(world.y)));
      node.setAttribute("r", state.directSelection.pathId === path.id && state.directSelection.anchorIndex === index ? "5.5" : "4.5");
      node.dataset.anchorPathId = path.id;
      node.dataset.anchorIndex = String(index);
      if (state.directSelection.pathId === path.id && state.directSelection.anchorIndex === index) {
        node.classList.add("is-active");
      }
      dom.overlay.appendChild(node);

      const isActiveAnchor =
        state.directSelection.pathId === path.id && state.directSelection.anchorIndex === index;
      if (!isActiveAnchor) {
        continue;
      }

      const handleSpecs = [
        { kind: "in", value: anchor.inHandle },
        { kind: "out", value: anchor.outHandle }
      ];

      for (const spec of handleSpecs) {
        const localHandle = spec.value || { x: anchor.x, y: anchor.y };
        const worldHandle = applyTransformToPoint(localHandle, path.transform);
        const hasDistance = Math.hypot(localHandle.x - anchor.x, localHandle.y - anchor.y) > 0.25;

        if (hasDistance) {
          const line = createSvgElement("line");
          line.setAttribute("class", "path-bezier-line");
          line.setAttribute("x1", String(round(world.x)));
          line.setAttribute("y1", String(round(world.y)));
          line.setAttribute("x2", String(round(worldHandle.x)));
          line.setAttribute("y2", String(round(worldHandle.y)));
          dom.overlay.appendChild(line);
        }

        const handleNode = createSvgElement("circle");
        handleNode.setAttribute("class", "path-bezier-handle");
        handleNode.setAttribute("cx", String(round(worldHandle.x)));
        handleNode.setAttribute("cy", String(round(worldHandle.y)));
        handleNode.setAttribute("r", "4");
        handleNode.dataset.handlePathId = path.id;
        handleNode.dataset.handleAnchorIndex = String(index);
        handleNode.dataset.handleKind = spec.kind;
        dom.overlay.appendChild(handleNode);
      }
    }
  }
}

function updateLayersPanel() {
  dom.layers.innerHTML = "";

  const rows = [];
  const walk = (shapes, depth) => {
    const ordered = [...shapes].sort((a, b) => b.zIndex - a.zIndex);
    for (const shape of ordered) {
      rows.push({ shape, depth });
      if (shape.type === "group" && Array.isArray(shape.children) && shape.children.length > 0) {
        walk(shape.children, depth + 1);
      }
    }
  };
  walk(state.objects, 0);

  for (const row of rows) {
    const { shape, depth } = row;
    const item = document.createElement("button");
    item.type = "button";
    item.className = "layer-item";
    item.dataset.layerId = shape.id;
    item.style.paddingLeft = `${8 + depth * 14}px`;
    if (state.selection.includes(shape.id)) {
      item.classList.add("is-selected");
    }

    const left = document.createElement("span");
    left.className = "layer-name-wrap";

    const name = document.createElement("span");
    name.className = "layer-name";
    name.textContent = shape.name || shape.type;

    const type = document.createElement("span");
    type.className = "layer-type";
    type.textContent = shape.type;

    left.appendChild(name);
    left.appendChild(type);
    item.appendChild(left);

    if (depth === 0) {
      item.draggable = true;
      item.addEventListener("dragstart", (event) => {
        event.dataTransfer.effectAllowed = "move";
        event.dataTransfer.setData("text/plain", shape.id);
        item.classList.add("is-dragging");
      });
      item.addEventListener("dragend", () => {
        item.classList.remove("is-dragging");
        for (const candidate of dom.layers.querySelectorAll(".layer-item")) {
          candidate.classList.remove("drop-before", "drop-after");
        }
      });
      item.addEventListener("dragover", (event) => {
        event.preventDefault();
        const rect = item.getBoundingClientRect();
        const before = event.clientY < rect.top + rect.height / 2;
        item.classList.toggle("drop-before", before);
        item.classList.toggle("drop-after", !before);
      });
      item.addEventListener("dragleave", () => {
        item.classList.remove("drop-before", "drop-after");
      });
      item.addEventListener("drop", (event) => {
        event.preventDefault();
        item.classList.remove("drop-before", "drop-after");
        const sourceId = event.dataTransfer.getData("text/plain");
        if (!sourceId || sourceId === shape.id) {
          return;
        }
        const rect = item.getBoundingClientRect();
        const before = event.clientY < rect.top + rect.height / 2;
        moveTopLevelObjectById(sourceId, shape.id, before ? "before" : "after");
      });
    }

    item.addEventListener("click", (event) => {
      if (event.shiftKey) {
        if (state.selection.includes(shape.id)) {
          state.selection = state.selection.filter((id) => id !== shape.id);
        } else {
          state.selection = [...state.selection, shape.id];
        }
      } else {
        state.selection = [shape.id];
      }
      state.activePathId = shape.type === "path" ? shape.id : null;
      if (state.tool === TOOLS.DIRECT && shape.type === "path") {
        state.directSelection.pathId = shape.id;
        state.directSelection.anchorIndex = 0;
      } else if (!state.selection.includes(state.directSelection.pathId)) {
        state.directSelection.pathId = null;
        state.directSelection.anchorIndex = null;
      }
      render();
    });

    dom.layers.appendChild(item);
  }

  const topLevelSelection = state.selection.filter((id) =>
    state.objects.some((shape) => shape.id === id)
  );
  const hasGroupSelection = state.selection.some((id) => {
    const found = getObjectById(id);
    return found?.object.type === "group";
  });

  dom.groupBtn.disabled = topLevelSelection.length < 2;
  dom.ungroupBtn.disabled = !hasGroupSelection;
  dom.layerForwardBtn.disabled = topLevelSelection.length === 0;
  dom.layerBackwardBtn.disabled = topLevelSelection.length === 0;
}

function render() {
  dom.canvas.setAttribute("viewBox", `0 0 ${state.doc.width} ${state.doc.height}`);
  dom.canvasBackground.setAttribute("width", String(state.doc.width));
  dom.canvasBackground.setAttribute("height", String(state.doc.height));

  while (dom.scene.firstChild) {
    dom.scene.firstChild.remove();
  }

  const shapes = [...state.objects].sort((a, b) => a.zIndex - b.zIndex);
  for (const shape of shapes) {
    renderShape(shape, dom.scene);
  }

  drawSelectionOutline();
  updateLayersPanel();

  if (state.selection.length === 0) {
    dom.selectionSummary.textContent = "No selection";
  } else {
    dom.selectionSummary.textContent = `${state.selection.length} selected`;
  }

  const primary = getPrimarySelectedObject();
  const style = primary ? normalizeStyle(primary.style) : deepClone(DEFAULT_STYLE);
  dom.fillInput.value = colorToHex(style.fill, "#90caf9");
  dom.strokeInput.value = colorToHex(style.stroke, "#1976d2");
  dom.strokeWidthInput.value = String(round(clamp(Number(style.strokeWidth) || 0, 0, 64), 2));
  dom.opacityInput.value = String(round(clamp(Number(style.opacity) || 1, 0, 1), 2));
  dom.fillInput.disabled = state.selection.length === 0;
  dom.strokeInput.disabled = state.selection.length === 0;
  dom.strokeWidthInput.disabled = state.selection.length === 0;
  dom.opacityInput.disabled = state.selection.length === 0;

  const singleSelection = state.selection.length === 1 ? primary : null;
  const singleBounds = state.selection.length === 1 ? getSelectionBounds() : null;
  dom.transformXInput.value = String(round(singleBounds?.x ?? 0, 2));
  dom.transformYInput.value = String(round(singleBounds?.y ?? 0, 2));
  dom.transformWInput.value = String(round(Math.max(1, singleBounds?.width ?? 1), 2));
  dom.transformHInput.value = String(round(Math.max(1, singleBounds?.height ?? 1), 2));
  dom.transformRotateInput.value = String(round(singleSelection?.transform?.rotation ?? 0, 2));
  const disableTransform = !singleSelection;
  dom.transformXInput.disabled = disableTransform;
  dom.transformYInput.disabled = disableTransform;
  dom.transformWInput.disabled = disableTransform;
  dom.transformHInput.disabled = disableTransform;
  dom.transformRotateInput.disabled = disableTransform;

  const selectionCount = state.selection.length;
  const disableArrange = selectionCount < 2;
  dom.alignLeftBtn.disabled = disableArrange;
  dom.alignHCenterBtn.disabled = disableArrange;
  dom.alignRightBtn.disabled = disableArrange;
  dom.alignTopBtn.disabled = disableArrange;
  dom.alignVCenterBtn.disabled = disableArrange;
  dom.alignBottomBtn.disabled = disableArrange;
  dom.distributeHBtn.disabled = selectionCount < 3;
  dom.distributeVBtn.disabled = selectionCount < 3;
  const topLevelCount = getTopLevelSelectionIds().length;
  const disableBoolean = topLevelCount !== 2;
  dom.booleanUniteBtn.disabled = disableBoolean;
  dom.booleanSubtractBtn.disabled = disableBoolean;
  dom.booleanIntersectBtn.disabled = disableBoolean;
  dom.snapToggleBtn.classList.toggle("is-active", state.snap.enabled);

  dom.docWidth.value = String(state.doc.width);
  dom.docHeight.value = String(state.doc.height);

  const legacySnapshot = state.objects.map(toLegacyShape);
  window.localStorage.setItem(STORAGE_LEGACY_KEY, JSON.stringify(legacySnapshot));
  window.localStorage.setItem(STORAGE_CANONICAL_KEY, JSON.stringify(state.objects));
}

function deselectAll() {
  state.selection = [];
  state.activePathId = null;
  state.directSelection.pathId = null;
  state.directSelection.anchorIndex = null;
}

function applyToolButtonState() {
  for (const node of dom.toolGroup.querySelectorAll("[data-tool]")) {
    const isActive = node.dataset.tool === state.tool;
    node.classList.toggle("is-active", isActive);
  }
}

function sortAndReindexObjects() {
  state.objects = [...state.objects]
    .sort((a, b) => a.zIndex - b.zIndex)
    .map((shape, index) => ({ ...shape, zIndex: index }));
}

function addShape(shape) {
  state.objects.push(shape);
  sortAndReindexObjects();
}

function updateShape(id, updater) {
  const found = getObjectById(id);
  if (!found) {
    return;
  }
  updater(found.object);
}

function getPrimarySelectedObject() {
  if (state.selection.length === 0) {
    return null;
  }
  const found = getObjectById(state.selection[0]);
  return found ? found.object : null;
}

function applyStyleToSelection(patch) {
  if (state.selection.length === 0) {
    return;
  }

  pushHistory();
  for (const id of state.selection) {
    updateShape(id, (shape) => {
      shape.style = {
        ...shape.style,
        ...patch
      };
    });
  }
  render();
}

function applyTransformInputsToSelection() {
  const primary = getPrimarySelectedObject();
  if (!primary || state.selection.length !== 1) {
    return;
  }

  const currentBounds = getSelectionBounds();
  if (!currentBounds) {
    return;
  }

  const nextX = Number(dom.transformXInput.value);
  const nextY = Number(dom.transformYInput.value);
  const nextW = Number(dom.transformWInput.value);
  const nextH = Number(dom.transformHInput.value);
  const nextRotate = Number(dom.transformRotateInput.value);

  const hasX = Number.isFinite(nextX);
  const hasY = Number.isFinite(nextY);
  const hasW = Number.isFinite(nextW) && nextW > 0;
  const hasH = Number.isFinite(nextH) && nextH > 0;
  const hasRotate = Number.isFinite(nextRotate);
  if (!hasX && !hasY && !hasW && !hasH && !hasRotate) {
    return;
  }

  pushHistory();
  const id = state.selection[0];
  const center = {
    x: currentBounds.x + currentBounds.width / 2,
    y: currentBounds.y + currentBounds.height / 2
  };

  updateShape(id, (shape) => {
    const transform = shape.transform;
    if (hasRotate) {
      transform.rotation = nextRotate;
    }

    const widthFactor = hasW ? clamp(nextW / Math.max(1e-4, currentBounds.width), 0.01, 100) : 1;
    const heightFactor = hasH ? clamp(nextH / Math.max(1e-4, currentBounds.height), 0.01, 100) : 1;
    if (hasW || hasH) {
      transform.sx *= widthFactor;
      transform.sy *= heightFactor;
      transform.tx = center.x + (transform.tx - center.x) * widthFactor;
      transform.ty = center.y + (transform.ty - center.y) * heightFactor;
    }
  });

  render();

  const adjustedBounds = getSelectionBounds();
  if (adjustedBounds && (hasX || hasY)) {
    const dx = hasX ? nextX - adjustedBounds.x : 0;
    const dy = hasY ? nextY - adjustedBounds.y : 0;
    updateShape(id, (shape) => {
      shape.transform.tx += dx;
      shape.transform.ty += dy;
    });
  }

  render();
}

function getSelectionBoundsEntries() {
  return state.selection
    .map((id) => ({ id, bounds: getObjectWorldBoundsById(id) }))
    .filter((entry) => entry.bounds);
}

function alignSelection(mode) {
  const entries = getSelectionBoundsEntries();
  if (entries.length < 2) {
    setStatus("Select at least two objects to align");
    return;
  }

  const union = getBoundsForIds(entries.map((entry) => entry.id));
  if (!union) {
    return;
  }

  pushHistory();
  for (const entry of entries) {
    let dx = 0;
    let dy = 0;
    const b = entry.bounds;
    if (mode === "left") {
      dx = union.x - b.x;
    } else if (mode === "hcenter") {
      dx = union.x + union.width / 2 - (b.x + b.width / 2);
    } else if (mode === "right") {
      dx = union.x + union.width - (b.x + b.width);
    } else if (mode === "top") {
      dy = union.y - b.y;
    } else if (mode === "vcenter") {
      dy = union.y + union.height / 2 - (b.y + b.height / 2);
    } else if (mode === "bottom") {
      dy = union.y + union.height - (b.y + b.height);
    }

    if (dx || dy) {
      updateShape(entry.id, (shape) => {
        shape.transform.tx += dx;
        shape.transform.ty += dy;
      });
    }
  }

  setStatus("Aligned selection");
  render();
}

function distributeSelection(axis) {
  const entries = getSelectionBoundsEntries();
  if (entries.length < 3) {
    setStatus("Select at least three objects to distribute");
    return;
  }

  const ordered = [...entries].sort((a, b) =>
    axis === "x"
      ? a.bounds.x + a.bounds.width / 2 - (b.bounds.x + b.bounds.width / 2)
      : a.bounds.y + a.bounds.height / 2 - (b.bounds.y + b.bounds.height / 2)
  );
  const firstCenter =
    axis === "x"
      ? ordered[0].bounds.x + ordered[0].bounds.width / 2
      : ordered[0].bounds.y + ordered[0].bounds.height / 2;
  const lastCenter =
    axis === "x"
      ? ordered[ordered.length - 1].bounds.x + ordered[ordered.length - 1].bounds.width / 2
      : ordered[ordered.length - 1].bounds.y + ordered[ordered.length - 1].bounds.height / 2;
  const step = (lastCenter - firstCenter) / (ordered.length - 1);

  pushHistory();
  for (let i = 1; i < ordered.length - 1; i += 1) {
    const current = ordered[i];
    const currentCenter =
      axis === "x"
        ? current.bounds.x + current.bounds.width / 2
        : current.bounds.y + current.bounds.height / 2;
    const target = firstCenter + step * i;
    const delta = target - currentCenter;
    if (!delta) {
      continue;
    }
    updateShape(current.id, (shape) => {
      if (axis === "x") {
        shape.transform.tx += delta;
      } else {
        shape.transform.ty += delta;
      }
    });
  }

  setStatus(axis === "x" ? "Distributed horizontally" : "Distributed vertically");
  render();
}

function applyBooleanOperation(operation) {
  const selectedIds = getTopLevelSelectionIds();
  if (selectedIds.length !== 2) {
    setStatus("Select exactly two top-level objects for boolean operations");
    return;
  }

  const sourceA = getObjectById(selectedIds[0])?.object;
  const sourceB = getObjectById(selectedIds[1])?.object;
  if (!sourceA || !sourceB) {
    return;
  }

  if (sourceA.type === "group" || sourceB.type === "group") {
    setStatus("Ungroup before running boolean operations");
    return;
  }
  if (
    (sourceA.type === "path" && sourceA.geometry?.closed !== true) ||
    (sourceB.type === "path" && sourceB.geometry?.closed !== true)
  ) {
    setStatus("Close paths before running boolean operations");
    return;
  }

  const aData = shapeToWorldPathData(sourceA);
  const bData = shapeToWorldPathData(sourceB);
  if (!aData || !bData) {
    setStatus("Boolean operations currently support rect, ellipse, path, and unite results");
    return;
  }

  const unionBounds = getBoundsForIds(selectedIds);
  if (!unionBounds) {
    return;
  }

  const newId = nextId("bool");
  const minIndex = Math.min(
    state.objects.findIndex((shape) => shape.id === selectedIds[0]),
    state.objects.findIndex((shape) => shape.id === selectedIds[1])
  );

  pushHistory();

  state.objects = state.objects.filter((shape) => !selectedIds.includes(shape.id));
  state.objects.splice(
    clamp(minIndex, 0, state.objects.length),
    0,
    {
      id: newId,
      type: "boolean",
      name:
        operation === "unite"
          ? "Unite"
          : operation === "subtract"
            ? "Subtract"
            : "Intersect",
      zIndex: minIndex,
      visible: true,
      locked: false,
      transform: deepClone(DEFAULT_TRANSFORM),
      style: normalizeStyle(sourceA.style),
      geometry: {
        op: operation,
        aPath: aData.d,
        bPath: bData.d,
        bounds: {
          x: unionBounds.x,
          y: unionBounds.y,
          width: Math.max(1, unionBounds.width),
          height: Math.max(1, unionBounds.height)
        }
      }
    }
  );

  sortAndReindexObjects();
  state.selection = [newId];
  state.activePathId = null;
  state.directSelection.pathId = null;
  state.directSelection.anchorIndex = null;
  setStatus(`Boolean ${operation} applied`);
  render();
}

function resetMarqueeInteractionState() {
  state.interaction.marqueeStart = null;
  state.interaction.marqueeCurrent = null;
  state.interaction.marqueeAdditive = false;
}

function beginMarqueeSelection(point, pointerId, additive) {
  state.interaction.mode = "marquee-select";
  state.interaction.pointerId = pointerId;
  state.interaction.marqueeStart = point;
  state.interaction.marqueeCurrent = point;
  state.interaction.marqueeAdditive = additive;
  state.interaction.snapGuides = [];
  setStatus("Marquee select");
}

function getMarqueeSelectionIds(start, end) {
  const rect = rectFromPoints(start, end);
  if (rect.width < 1 && rect.height < 1) {
    return [];
  }

  const candidates = state.objects
    .filter((shape) => shape.visible !== false && shape.locked !== true)
    .map((shape) => shape.id);

  return candidates.filter((id) => {
    const bounds = getObjectWorldBoundsById(id);
    return bounds ? rectsIntersect(bounds, rect) : false;
  });
}

function finishMarqueeSelection() {
  const start = state.interaction.marqueeStart;
  const current = state.interaction.marqueeCurrent;
  const additive = state.interaction.marqueeAdditive;
  if (!start || !current) {
    state.interaction.mode = null;
    state.interaction.pointerId = null;
    resetMarqueeInteractionState();
    setStatus("Ready");
    render();
    return;
  }

  const pickedIds = getMarqueeSelectionIds(start, current);
  if (additive) {
    const merged = new Set([...state.selection, ...pickedIds]);
    state.selection = Array.from(merged);
  } else {
    state.selection = pickedIds;
  }

  if (state.selection.length === 1) {
    const found = getObjectById(state.selection[0]);
    state.activePathId = found?.object?.type === "path" ? found.object.id : null;
  } else {
    state.activePathId = null;
  }

  if (state.activePathId && state.tool === TOOLS.DIRECT) {
    state.directSelection.pathId = state.activePathId;
    state.directSelection.anchorIndex = 0;
  } else if (!state.selection.includes(state.directSelection.pathId)) {
    state.directSelection.pathId = null;
    state.directSelection.anchorIndex = null;
  }

  state.interaction.mode = null;
  state.interaction.pointerId = null;
  resetMarqueeInteractionState();
  state.interaction.snapGuides = [];
  setStatus("Ready");
  render();
}

function getTopLevelSelectionIds() {
  return state.selection.filter((id) => state.objects.some((shape) => shape.id === id));
}

function moveTopLevelObjectById(sourceId, targetId, placement) {
  const fromIndex = state.objects.findIndex((shape) => shape.id === sourceId);
  const targetIndex = state.objects.findIndex((shape) => shape.id === targetId);
  if (fromIndex < 0 || targetIndex < 0) {
    return;
  }

  const destination = placement === "before" ? targetIndex : targetIndex + 1;
  const adjustedDestination = fromIndex < destination ? destination - 1 : destination;
  if (adjustedDestination === fromIndex) {
    return;
  }

  pushHistory();
  const [moved] = state.objects.splice(fromIndex, 1);
  state.objects.splice(adjustedDestination, 0, moved);
  sortAndReindexObjects();
  render();
}

function moveSelectionInLayer(direction) {
  const selectedIds = new Set(getTopLevelSelectionIds());
  if (selectedIds.size === 0) {
    return;
  }

  pushHistory();

  if (direction > 0) {
    for (let i = state.objects.length - 2; i >= 0; i -= 1) {
      const current = state.objects[i];
      const next = state.objects[i + 1];
      if (selectedIds.has(current.id) && !selectedIds.has(next.id)) {
        state.objects[i] = next;
        state.objects[i + 1] = current;
      }
    }
  } else {
    for (let i = 1; i < state.objects.length; i += 1) {
      const current = state.objects[i];
      const previous = state.objects[i - 1];
      if (selectedIds.has(current.id) && !selectedIds.has(previous.id)) {
        state.objects[i] = previous;
        state.objects[i - 1] = current;
      }
    }
  }

  sortAndReindexObjects();
  render();
}

function composeTransforms(parentTransform, childTransform) {
  const parent = normalizeTransform(parentTransform);
  const child = normalizeTransform(childTransform);
  return {
    tx: parent.tx + child.tx,
    ty: parent.ty + child.ty,
    sx: parent.sx * child.sx,
    sy: parent.sy * child.sy,
    rotation: parent.rotation + child.rotation
  };
}

function groupSelection() {
  const topLevelSelection = getTopLevelSelectionIds();
  if (topLevelSelection.length < 2) {
    return;
  }

  const selectedSet = new Set(topLevelSelection);
  const selected = state.objects.filter((shape) => selectedSet.has(shape.id));
  if (selected.length < 2) {
    return;
  }

  pushHistory();

  const minIndex = state.objects.findIndex((shape) => selectedSet.has(shape.id));
  const remaining = state.objects.filter((shape) => !selectedSet.has(shape.id));
  const groupId = nextId("group");

  const groupObject = {
    id: groupId,
    type: "group",
    name: `Group ${groupId.slice(-4)}`,
    zIndex: minIndex,
    visible: true,
    locked: false,
    transform: deepClone(DEFAULT_TRANSFORM),
    style: {
      ...deepClone(DEFAULT_STYLE),
      fill: "none"
    },
    geometry: {
      x: 0,
      y: 0,
      width: 0,
      height: 0
    },
    children: selected
      .sort((a, b) => a.zIndex - b.zIndex)
      .map((shape, index) => ({
        ...shape,
        zIndex: index
      }))
  };

  remaining.splice(minIndex, 0, groupObject);
  state.objects = remaining;
  sortAndReindexObjects();
  state.selection = [groupId];
  setStatus(`Grouped ${selected.length} objects`);
  render();
}

function ungroupSelection() {
  const topLevelSelection = getTopLevelSelectionIds();
  if (topLevelSelection.length === 0) {
    return;
  }

  const selectedSet = new Set(topLevelSelection);
  const nextObjects = [];
  const nextSelection = [];
  let didUngroup = false;

  pushHistory();

  for (const shape of state.objects) {
    if (selectedSet.has(shape.id) && shape.type === "group") {
      didUngroup = true;
      const children = Array.isArray(shape.children) ? shape.children : [];
      for (const child of children) {
        const nextChild = deepClone(child);
        nextChild.transform = composeTransforms(shape.transform, nextChild.transform);
        nextObjects.push(nextChild);
        nextSelection.push(nextChild.id);
      }
    } else {
      nextObjects.push(shape);
    }
  }

  if (!didUngroup) {
    state.history.undo.pop();
    updateHistoryButtons();
    return;
  }

  state.objects = nextObjects;
  sortAndReindexObjects();
  state.selection = nextSelection;
  setStatus("Ungrouped selection");
  render();
}

function beginCreateShape(type, point) {
  pushHistory();

  const id = nextId();
  const zIndex = state.objects.length;

  if (type === TOOLS.RECT) {
    addShape({
      id,
      type: "rect",
      name: "Rectangle",
      zIndex,
      visible: true,
      locked: false,
      transform: deepClone(DEFAULT_TRANSFORM),
      style: deepClone(DEFAULT_STYLE),
      geometry: {
        x: point.x,
        y: point.y,
        width: 1,
        height: 1,
        rx: 0,
        ry: 0
      }
    });
  } else if (type === TOOLS.ELLIPSE) {
    addShape({
      id,
      type: "ellipse",
      name: "Ellipse",
      zIndex,
      visible: true,
      locked: false,
      transform: deepClone(DEFAULT_TRANSFORM),
      style: deepClone(DEFAULT_STYLE),
      geometry: {
        cx: point.x,
        cy: point.y,
        rx: 1,
        ry: 1
      }
    });
  }

  state.selection = [id];
  state.interaction.mode = "creating";
  state.interaction.draftId = id;
  state.interaction.start = point;
  setStatus(`Creating ${type}`);
}

function continueCreateShape(point) {
  if (state.interaction.mode !== "creating" || !state.interaction.draftId) {
    return;
  }

  const id = state.interaction.draftId;
  const start = state.interaction.start;
  const found = getObjectById(id);
  if (!found) {
    return;
  }

  if (found.object.type === "rect") {
    const x = Math.min(start.x, point.x);
    const y = Math.min(start.y, point.y);
    const width = Math.max(1, Math.abs(point.x - start.x));
    const height = Math.max(1, Math.abs(point.y - start.y));
    found.object.geometry.x = x;
    found.object.geometry.y = y;
    found.object.geometry.width = width;
    found.object.geometry.height = height;
  } else if (found.object.type === "ellipse") {
    found.object.geometry.rx = Math.max(1, Math.abs(point.x - start.x));
    found.object.geometry.ry = Math.max(1, Math.abs(point.y - start.y));
  }
}

function finishCreateShape() {
  if (state.interaction.mode !== "creating") {
    return;
  }
  state.interaction.mode = null;
  state.interaction.draftId = null;
  state.interaction.start = null;
  setStatus("Ready");
  render();
}

function beginMoveSelection(point, pointerId) {
  if (state.selection.length === 0) {
    return;
  }

  const startTransforms = new Map();
  for (const id of state.selection) {
    const found = getObjectById(id);
    if (!found || found.object.locked) {
      continue;
    }
    startTransforms.set(id, deepClone(found.object.transform));
  }

  if (startTransforms.size === 0) {
    return;
  }

  pushHistory();
  state.interaction.mode = "moving";
  state.interaction.pointerId = pointerId;
  state.interaction.start = point;
  state.interaction.startTransforms = startTransforms;
  state.interaction.startSelectionBounds = getSelectionBounds();
  state.interaction.snapGuides = [];
  setStatus(`Moving ${startTransforms.size} object(s)`);
}

function continueMoveSelection(point, event) {
  if (state.interaction.mode !== "moving" || !state.interaction.startTransforms) {
    return;
  }

  const start = state.interaction.start;
  const rawDx = point.x - start.x;
  const rawDy = point.y - start.y;
  let dx = rawDx;
  let dy = rawDy;

  if (state.snap.enabled && !event.altKey) {
    const snapped = computeSnapAdjustment(
      state.interaction.startSelectionBounds,
      rawDx,
      rawDy,
      new Set(state.selection)
    );
    dx = snapped.dx;
    dy = snapped.dy;
    state.interaction.snapGuides = snapped.guides;
  } else {
    state.interaction.snapGuides = [];
  }

  for (const [id, transform] of state.interaction.startTransforms.entries()) {
    updateShape(id, (shape) => {
      shape.transform.tx = transform.tx + dx;
      shape.transform.ty = transform.ty + dy;
    });
  }
}

function finishMoveSelection() {
  if (state.interaction.mode !== "moving") {
    return;
  }
  state.interaction.mode = null;
  state.interaction.pointerId = null;
  state.interaction.start = null;
  state.interaction.startTransforms = null;
  state.interaction.startSelectionBounds = null;
  state.interaction.snapGuides = [];
  setStatus("Ready");
  render();
}

function beginHandleTransform(handleType, point, pointerId) {
  if (!handleType || state.selection.length === 0) {
    return false;
  }

  const bounds = getSelectionBounds();
  if (!bounds) {
    return false;
  }

  const startTransforms = new Map();
  for (const id of state.selection) {
    const found = getObjectById(id);
    if (!found || found.object.locked) {
      continue;
    }
    startTransforms.set(id, deepClone(found.object.transform));
  }

  if (startTransforms.size === 0) {
    return false;
  }

  pushHistory();
  const center = {
    x: bounds.x + bounds.width / 2,
    y: bounds.y + bounds.height / 2
  };

  state.interaction.mode = handleType === "rotate" ? "rotating" : "scaling";
  state.interaction.pointerId = pointerId;
  state.interaction.start = point;
  state.interaction.startTransforms = startTransforms;
  state.interaction.handleType = handleType;
  state.interaction.bounds = bounds;
  state.interaction.center = center;
  state.interaction.startAngle = Math.atan2(point.y - center.y, point.x - center.x);
  state.interaction.startVector = {
    x: point.x - center.x,
    y: point.y - center.y
  };
  setStatus(handleType === "rotate" ? "Rotating selection" : "Scaling selection");
  return true;
}

function continueHandleTransform(point, maintainRatio = false) {
  const mode = state.interaction.mode;
  if (!state.interaction.startTransforms || (mode !== "scaling" && mode !== "rotating")) {
    return;
  }

  const center = state.interaction.center;

  if (mode === "rotating") {
    const currentAngle = Math.atan2(point.y - center.y, point.x - center.x);
    const deltaRadians = currentAngle - state.interaction.startAngle;
    const deltaDegrees = (deltaRadians * 180) / Math.PI;
    const cos = Math.cos(deltaRadians);
    const sin = Math.sin(deltaRadians);

    for (const [id, startTransform] of state.interaction.startTransforms.entries()) {
      updateShape(id, (shape) => {
        const vx = startTransform.tx - center.x;
        const vy = startTransform.ty - center.y;
        shape.transform.rotation = startTransform.rotation + deltaDegrees;
        shape.transform.tx = center.x + vx * cos - vy * sin;
        shape.transform.ty = center.y + vx * sin + vy * cos;
      });
    }
    return;
  }

  const startVector = state.interaction.startVector;
  let scaleX = startVector.x === 0 ? 1 : (point.x - center.x) / startVector.x;
  let scaleY = startVector.y === 0 ? 1 : (point.y - center.y) / startVector.y;

  if (!Number.isFinite(scaleX)) {
    scaleX = 1;
  }
  if (!Number.isFinite(scaleY)) {
    scaleY = 1;
  }

  if (maintainRatio) {
    const unified = Math.abs(scaleX) > Math.abs(scaleY) ? scaleX : scaleY;
    scaleX = unified;
    scaleY = unified;
  }

  const minimum = 0.05;
  scaleX = Math.sign(scaleX || 1) * Math.max(minimum, Math.abs(scaleX));
  scaleY = Math.sign(scaleY || 1) * Math.max(minimum, Math.abs(scaleY));

  for (const [id, startTransform] of state.interaction.startTransforms.entries()) {
    updateShape(id, (shape) => {
      shape.transform.sx = startTransform.sx * scaleX;
      shape.transform.sy = startTransform.sy * scaleY;
      shape.transform.tx = center.x + (startTransform.tx - center.x) * scaleX;
      shape.transform.ty = center.y + (startTransform.ty - center.y) * scaleY;
    });
  }
}

function finishHandleTransform() {
  if (state.interaction.mode !== "scaling" && state.interaction.mode !== "rotating") {
    return;
  }

  state.interaction.mode = null;
  state.interaction.pointerId = null;
  state.interaction.start = null;
  state.interaction.startTransforms = null;
  state.interaction.handleType = null;
  state.interaction.bounds = null;
  state.interaction.center = null;
  state.interaction.startAngle = null;
  state.interaction.startVector = null;
  setStatus("Ready");
  render();
}

function beginOrExtendPath(point) {
  if (!state.activePathId) {
    pushHistory();
    const id = nextId();
    addShape({
      id,
      type: "path",
      name: "Path",
      zIndex: state.objects.length,
      visible: true,
      locked: false,
      transform: deepClone(DEFAULT_TRANSFORM),
      style: {
        ...deepClone(DEFAULT_STYLE),
        fill: "none"
      },
      geometry: {
        anchors: [
          {
            x: point.x,
            y: point.y,
            inHandle: null,
            outHandle: null
          }
        ],
        closed: false
      }
    });
    state.activePathId = id;
    state.selection = [id];
    setStatus("Pen: click to add points");
    render();
    return;
  }

  const found = getObjectById(state.activePathId);
  if (!found || found.object.type !== "path") {
    state.activePathId = null;
    return;
  }

  const anchors = found.object.geometry.anchors;
  if (anchors.length >= 3) {
    const first = anchors[0];
    const dist = Math.hypot(first.x - point.x, first.y - point.y);
    if (dist < 10) {
      pushHistory();
      found.object.geometry.closed = true;
      state.activePathId = null;
      setStatus("Path closed");
      render();
      return;
    }
  }

  pushHistory();
  anchors.push({
    x: point.x,
    y: point.y,
    inHandle: null,
    outHandle: null
  });

  render();
}

function pointerDownOnCanvas(event) {
  if (event.button !== 0) {
    return;
  }

  dom.canvas.focus();
  event.preventDefault();

  const point = svgPointFromEvent(event);
  const bezierHandleNode = event.target.closest("[data-handle-path-id]");
  if (state.tool === TOOLS.DIRECT && bezierHandleNode) {
    const pathId = bezierHandleNode.dataset.handlePathId;
    const anchorIndex = Number(bezierHandleNode.dataset.handleAnchorIndex);
    const handleKind = bezierHandleNode.dataset.handleKind;
    const foundPath = pathId ? getObjectById(pathId) : null;
    if (
      foundPath &&
      foundPath.object.type === "path" &&
      (handleKind === "in" || handleKind === "out") &&
      Number.isInteger(anchorIndex) &&
      anchorIndex >= 0 &&
      anchorIndex < (foundPath.object.geometry.anchors || []).length
    ) {
      pushHistory();
      state.selection = [pathId];
      state.activePathId = pathId;
      state.directSelection.pathId = pathId;
      state.directSelection.anchorIndex = anchorIndex;
      state.interaction.mode = "handle-moving";
      state.interaction.pointerId = event.pointerId;
      state.interaction.start = point;
      state.interaction.handleKind = handleKind;
      setStatus("Editing bezier handle");
      render();
      return;
    }
  }

  const anchorNode = event.target.closest("[data-anchor-path-id]");
  if (state.tool === TOOLS.DIRECT && anchorNode) {
    const pathId = anchorNode.dataset.anchorPathId;
    const anchorIndex = Number(anchorNode.dataset.anchorIndex);
    const foundPath = pathId ? getObjectById(pathId) : null;
    if (
      foundPath &&
      foundPath.object.type === "path" &&
      Number.isInteger(anchorIndex) &&
      anchorIndex >= 0 &&
      anchorIndex < (foundPath.object.geometry.anchors || []).length
    ) {
      pushHistory();
      state.selection = [pathId];
      state.activePathId = pathId;
      state.directSelection.pathId = pathId;
      state.directSelection.anchorIndex = anchorIndex;
      state.interaction.mode = "anchor-moving";
      state.interaction.pointerId = event.pointerId;
      state.interaction.start = point;
      setStatus("Editing path anchor");
      render();
      return;
    }
  }

  const handleNode = event.target.closest("[data-handle-type]");
  if (
    handleNode &&
    (state.tool === TOOLS.SELECT || state.tool === TOOLS.DIRECT) &&
    beginHandleTransform(handleNode.dataset.handleType, point, event.pointerId)
  ) {
    render();
    return;
  }

  const objectId = hitTestTopObject(event, point);
  const found = objectId ? getObjectById(objectId) : null;

  if (state.tool === TOOLS.RECT || state.tool === TOOLS.ELLIPSE) {
    beginCreateShape(state.tool, point);
    render();
    return;
  }

  if (state.tool === TOOLS.PEN) {
    beginOrExtendPath(point);
    return;
  }

  if (state.tool === TOOLS.SELECT || state.tool === TOOLS.DIRECT) {
    if (found && !found.object.locked) {
      if (event.shiftKey) {
        if (state.selection.includes(found.object.id)) {
          state.selection = state.selection.filter((id) => id !== found.object.id);
        } else {
          state.selection = [...state.selection, found.object.id];
        }
      } else {
        state.selection = [found.object.id];
      }

      if (!event.shiftKey) {
        beginMoveSelection(point, event.pointerId);
      }

      if (found.object.type === "path") {
        state.activePathId = found.object.id;
        if (state.tool === TOOLS.DIRECT) {
          state.directSelection.pathId = found.object.id;
          state.directSelection.anchorIndex = 0;
        }
      } else {
        state.directSelection.pathId = null;
        state.directSelection.anchorIndex = null;
      }
    } else {
      const canMarquee = state.tool === TOOLS.SELECT || state.tool === TOOLS.DIRECT;
      if (canMarquee) {
        if (!event.shiftKey) {
          deselectAll();
        }
        beginMarqueeSelection(point, event.pointerId, event.shiftKey);
      } else {
        deselectAll();
        setStatus("Ready");
      }
    }

    render();
  }
}

function pointerMoveOnCanvas(event) {
  const point = svgPointFromEvent(event);

  if (state.interaction.mode === "marquee-select") {
    state.interaction.marqueeCurrent = point;
    render();
    return;
  }

  if (state.interaction.mode === "handle-moving") {
    const pathId = state.directSelection.pathId;
    const anchorIndex = state.directSelection.anchorIndex;
    const found = pathId ? getObjectById(pathId) : null;
    if (found && found.object.type === "path" && Number.isInteger(anchorIndex)) {
      const local = applyInverseTransform(point, found.object.transform);
      const anchor = found.object.geometry.anchors[anchorIndex];
      if (anchor) {
        const kind = state.interaction.handleKind === "in" ? "inHandle" : "outHandle";
        const oppositeKind = kind === "inHandle" ? "outHandle" : "inHandle";
        anchor[kind] = { x: local.x, y: local.y };
        if (!event.altKey) {
          anchor[oppositeKind] = {
            x: anchor.x - (local.x - anchor.x),
            y: anchor.y - (local.y - anchor.y)
          };
        }
      }
    }
    render();
    return;
  }

  if (state.interaction.mode === "anchor-moving") {
    const pathId = state.directSelection.pathId;
    const anchorIndex = state.directSelection.anchorIndex;
    const found = pathId ? getObjectById(pathId) : null;
    if (found && found.object.type === "path" && Number.isInteger(anchorIndex)) {
      const local = applyInverseTransform(point, found.object.transform);
      const anchor = found.object.geometry.anchors[anchorIndex];
      if (anchor) {
        const dx = local.x - anchor.x;
        const dy = local.y - anchor.y;
        anchor.x = local.x;
        anchor.y = local.y;
        if (anchor.inHandle) {
          anchor.inHandle.x += dx;
          anchor.inHandle.y += dy;
        }
        if (anchor.outHandle) {
          anchor.outHandle.x += dx;
          anchor.outHandle.y += dy;
        }
      }
    }
    render();
    return;
  }

  if (state.interaction.mode === "creating") {
    continueCreateShape(point);
    render();
    return;
  }

  if (state.interaction.mode === "moving") {
    continueMoveSelection(point, event);
    render();
    return;
  }

  if (state.interaction.mode === "scaling" || state.interaction.mode === "rotating") {
    continueHandleTransform(point, event.shiftKey);
    render();
  }
}

function pointerUpOnCanvas() {
  if (state.interaction.mode === "marquee-select") {
    finishMarqueeSelection();
    return;
  }

  if (state.interaction.mode === "handle-moving") {
    state.interaction.mode = null;
    state.interaction.pointerId = null;
    state.interaction.start = null;
    state.interaction.handleKind = null;
    setStatus("Ready");
    render();
    return;
  }

  if (state.interaction.mode === "anchor-moving") {
    state.interaction.mode = null;
    state.interaction.pointerId = null;
    state.interaction.start = null;
    setStatus("Ready");
    render();
    return;
  }

  if (state.interaction.mode === "creating") {
    finishCreateShape();
    return;
  }

  if (state.interaction.mode === "moving") {
    finishMoveSelection();
    return;
  }

  if (state.interaction.mode === "scaling" || state.interaction.mode === "rotating") {
    finishHandleTransform();
  }
}

function shapeToSvgString(shape, indent = "  ") {
  if (shape.visible === false) {
    return "";
  }

  const style = normalizeStyle(shape.style);
  const styleAttributes = [];
  const computedFill = shape.type === "path" && !shape.geometry.closed ? "none" : style.fill || "none";
  const computedStroke = style.stroke || "none";
  const computedStrokeWidth = round(clamp(Number(style.strokeWidth) || 0, 0, 999), 3);
  const computedOpacity = round(clamp(Number(style.opacity) || 1, 0, 1), 3);

  if (computedFill === "none") {
    styleAttributes.push(`fill="none"`);
  } else {
    styleAttributes.push(`fill="${computedFill}"`);
  }

  if (computedStroke && computedStroke !== "none" && computedStrokeWidth > 0) {
    styleAttributes.push(`stroke="${computedStroke}"`);
    styleAttributes.push(`stroke-width="${computedStrokeWidth}"`);
  } else {
    styleAttributes.push(`stroke="none"`);
  }

  if (computedOpacity !== 1) {
    styleAttributes.push(`opacity="${computedOpacity}"`);
  }

  const transform = transformToString(shape.transform);
  const transformAttribute = transform ? ` transform="${transform}"` : "";

  if (shape.type === "rect") {
    const g = shape.geometry;
    const rx = g.rx ? ` rx="${round(g.rx)}"` : "";
    const ry = g.ry ? ` ry="${round(g.ry)}"` : "";
    return `${indent}<rect x="${round(g.x)}" y="${round(g.y)}" width="${round(g.width)}" height="${round(g.height)}"${rx}${ry} ${styleAttributes.join(" ")}${transformAttribute} />`;
  }

  if (shape.type === "ellipse") {
    const g = shape.geometry;
    return `${indent}<ellipse cx="${round(g.cx)}" cy="${round(g.cy)}" rx="${round(g.rx)}" ry="${round(g.ry)}" ${styleAttributes.join(" ")}${transformAttribute} />`;
  }

  if (shape.type === "path") {
    const d = buildPathD(shape.geometry.anchors, shape.geometry.closed);
    if (!d) {
      return "";
    }
    return `${indent}<path d="${d}" ${styleAttributes.join(" ")}${transformAttribute} />`;
  }

  if (shape.type === "boolean") {
    const op = shape.geometry?.op;
    const aPath = shape.geometry?.aPath;
    const bPath = shape.geometry?.bPath;
    if (!aPath || !bPath) {
      return "";
    }

    if (op === "unite") {
      return `${indent}<path d="${aPath} ${bPath}" ${styleAttributes.join(" ")}${transformAttribute} />`;
    }

    if (op === "intersect") {
      const clipId = `clip-${shape.id}`;
      return `${indent}<g${transformAttribute}>
${indent}  <defs>
${indent}    <clipPath id="${clipId}" clipPathUnits="userSpaceOnUse">
${indent}      <path d="${bPath}" />
${indent}    </clipPath>
${indent}  </defs>
${indent}  <path d="${aPath}" clip-path="url(#${clipId})" ${styleAttributes.join(" ")} />
${indent}</g>`;
    }

    if (op === "subtract") {
      const b = shape.geometry?.bounds || {
        x: 0,
        y: 0,
        width: state.doc.width,
        height: state.doc.height
      };
      const maskId = `mask-${shape.id}`;
      return `${indent}<g${transformAttribute}>
${indent}  <defs>
${indent}    <mask id="${maskId}" maskUnits="userSpaceOnUse" x="${round(b.x - 4)}" y="${round(b.y - 4)}" width="${round(b.width + 8)}" height="${round(b.height + 8)}">
${indent}      <rect x="${round(b.x - 4)}" y="${round(b.y - 4)}" width="${round(b.width + 8)}" height="${round(b.height + 8)}" fill="#fff" />
${indent}      <path d="${bPath}" fill="#000" />
${indent}    </mask>
${indent}  </defs>
${indent}  <path d="${aPath}" mask="url(#${maskId})" ${styleAttributes.join(" ")} />
${indent}</g>`;
    }
  }

  if (shape.type === "group") {
    const childLines = [...(shape.children || [])]
      .sort((a, b) => a.zIndex - b.zIndex)
      .map((child) => shapeToSvgString(child, `${indent}  `))
      .filter(Boolean)
      .join("\n");
    if (!childLines) {
      return "";
    }
    return `${indent}<g${transformAttribute}>\n${childLines}\n${indent}</g>`;
  }

  return "";
}

function exportSvgString() {
  const ordered = [...state.objects].sort((a, b) => a.zIndex - b.zIndex);
  const lines = ordered.map((shape) => shapeToSvgString(shape, "  ")).filter(Boolean);
  return [
    "<?xml version=\"1.0\" encoding=\"UTF-8\"?>",
    `<svg xmlns=\"http://www.w3.org/2000/svg\" width=\"${round(state.doc.width)}\" height=\"${round(state.doc.height)}\" viewBox=\"0 0 ${round(state.doc.width)} ${round(state.doc.height)}\">`,
    ...lines,
    "</svg>"
  ].join("\n");
}

function downloadSvg() {
  const source = exportSvgString();
  const blob = new Blob([source], { type: "image/svg+xml;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "art.svg";
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

async function copySvg() {
  const source = exportSvgString();
  try {
    await navigator.clipboard.writeText(source);
    setStatus("SVG copied to clipboard");
  } catch (error) {
    console.error("[svg-editor] Failed to copy SVG", error);
    setStatus("Clipboard copy failed");
  }
}

function loadInitialDocument() {
  // Reset persisted snapshots from earlier runtime versions.
  window.localStorage.removeItem("svg-editor:canonical-shapes");
  window.localStorage.removeItem("svg-editor:legacy-shapes");

  const canonicalRaw = window.localStorage.getItem(STORAGE_CANONICAL_KEY);
  if (canonicalRaw) {
    try {
      const parsed = JSON.parse(canonicalRaw);
      state.objects = adaptShapeArray(parsed);
      return;
    } catch (error) {
      console.warn("[svg-editor] Failed to parse canonical snapshot", error);
    }
  }

  const legacyRaw = window.localStorage.getItem(STORAGE_LEGACY_KEY);
  if (legacyRaw) {
    try {
      const parsed = JSON.parse(legacyRaw);
      state.objects = adaptShapeArray(parsed);
      return;
    } catch (error) {
      console.warn("[svg-editor] Failed to parse legacy snapshot", error);
    }
  }

  state.objects = [];
}

function deleteSelection() {
  if (state.selection.length === 0) {
    return;
  }

  pushHistory();
  const selected = new Set(state.selection);
  state.objects = state.objects.filter((shape) => !selected.has(shape.id));
  sortAndReindexObjects();
  deselectAll();
  setStatus("Selection deleted");
  render();
}

function moveSelectionBy(dx, dy) {
  if (state.selection.length === 0) {
    return;
  }

  pushHistory();
  for (const id of state.selection) {
    updateShape(id, (shape) => {
      if (shape.locked) {
        return;
      }
      shape.transform.tx += dx;
      shape.transform.ty += dy;
    });
  }
  render();
}

function finishActivePathIfAny(cancel = false) {
  if (!state.activePathId) {
    return;
  }

  const found = getObjectById(state.activePathId);
  if (!found || found.object.type !== "path") {
    state.activePathId = null;
    return;
  }

  if (cancel || found.object.geometry.anchors.length <= 1) {
    state.objects = state.objects.filter((shape) => shape.id !== state.activePathId);
    sortAndReindexObjects();
    state.selection = [];
    setStatus("Path creation cancelled");
  } else {
    setStatus("Path finalized");
  }

  state.activePathId = null;
  render();
}

function handleToolGroupClick(event) {
  const button = event.target.closest("[data-tool]");
  if (!button) {
    return;
  }

  const nextTool = button.dataset.tool;
  if (!nextTool || !Object.values(TOOLS).includes(nextTool)) {
    return;
  }

  if (state.tool === TOOLS.PEN && nextTool !== TOOLS.PEN) {
    finishActivePathIfAny(false);
  }

  if (state.interaction.mode === "marquee-select") {
    state.interaction.mode = null;
    state.interaction.pointerId = null;
    resetMarqueeInteractionState();
  }
  state.interaction.snapGuides = [];
  state.interaction.startSelectionBounds = null;

  state.tool = nextTool;
  applyToolButtonState();
  setStatus(`Tool: ${nextTool}`);
}

function bindEvents() {
  dom.toolGroup.addEventListener("click", handleToolGroupClick);

  dom.canvas.addEventListener("pointerdown", pointerDownOnCanvas);
  dom.canvas.addEventListener("pointermove", pointerMoveOnCanvas);
  dom.canvas.addEventListener("pointerup", pointerUpOnCanvas);
  dom.canvas.addEventListener("pointerleave", pointerUpOnCanvas);

  dom.docWidth.addEventListener("change", () => {
    pushHistory();
    state.doc.width = clamp(Number(dom.docWidth.value), 64, 10000);
    render();
  });

  dom.docHeight.addEventListener("change", () => {
    pushHistory();
    state.doc.height = clamp(Number(dom.docHeight.value), 64, 10000);
    render();
  });

  dom.fillInput.addEventListener("change", () => {
    applyStyleToSelection({ fill: dom.fillInput.value });
  });

  dom.strokeInput.addEventListener("change", () => {
    applyStyleToSelection({ stroke: dom.strokeInput.value });
  });

  dom.strokeWidthInput.addEventListener("change", () => {
    const next = clamp(Number(dom.strokeWidthInput.value), 0, 64);
    applyStyleToSelection({ strokeWidth: Number.isFinite(next) ? next : 0 });
  });

  dom.opacityInput.addEventListener("change", () => {
    const next = clamp(Number(dom.opacityInput.value), 0, 1);
    applyStyleToSelection({ opacity: Number.isFinite(next) ? next : 1 });
  });

  for (const input of [
    dom.transformXInput,
    dom.transformYInput,
    dom.transformWInput,
    dom.transformHInput,
    dom.transformRotateInput
  ]) {
    input.addEventListener("change", applyTransformInputsToSelection);
  }

  dom.undoBtn.addEventListener("click", undo);
  dom.redoBtn.addEventListener("click", redo);
  dom.downloadSvgBtn.addEventListener("click", downloadSvg);
  dom.copySvgBtn.addEventListener("click", copySvg);
  dom.layerForwardBtn.addEventListener("click", () => moveSelectionInLayer(1));
  dom.layerBackwardBtn.addEventListener("click", () => moveSelectionInLayer(-1));
  dom.groupBtn.addEventListener("click", groupSelection);
  dom.ungroupBtn.addEventListener("click", ungroupSelection);
  dom.alignLeftBtn.addEventListener("click", () => alignSelection("left"));
  dom.alignHCenterBtn.addEventListener("click", () => alignSelection("hcenter"));
  dom.alignRightBtn.addEventListener("click", () => alignSelection("right"));
  dom.alignTopBtn.addEventListener("click", () => alignSelection("top"));
  dom.alignVCenterBtn.addEventListener("click", () => alignSelection("vcenter"));
  dom.alignBottomBtn.addEventListener("click", () => alignSelection("bottom"));
  dom.distributeHBtn.addEventListener("click", () => distributeSelection("x"));
  dom.distributeVBtn.addEventListener("click", () => distributeSelection("y"));
  dom.booleanUniteBtn.addEventListener("click", () => applyBooleanOperation("unite"));
  dom.booleanSubtractBtn.addEventListener("click", () => applyBooleanOperation("subtract"));
  dom.booleanIntersectBtn.addEventListener("click", () => applyBooleanOperation("intersect"));
  dom.snapToggleBtn.addEventListener("click", () => {
    state.snap.enabled = !state.snap.enabled;
    if (!state.snap.enabled) {
      state.interaction.snapGuides = [];
    }
    render();
    setStatus(state.snap.enabled ? "Snapping enabled" : "Snapping disabled");
  });

  window.addEventListener("keydown", (event) => {
    if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "z") {
      if (event.shiftKey) {
        redo();
      } else {
        undo();
      }
      event.preventDefault();
      return;
    }

    if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "y") {
      redo();
      event.preventDefault();
      return;
    }

    if (event.key === "Delete" || event.key === "Backspace") {
      deleteSelection();
      event.preventDefault();
      return;
    }

    if (event.key === "Escape") {
      finishActivePathIfAny(true);
      state.interaction.mode = null;
      state.interaction.handleKind = null;
      resetMarqueeInteractionState();
      state.interaction.snapGuides = [];
      state.interaction.startSelectionBounds = null;
      setStatus("Ready");
      render();
      return;
    }

    const nudge = event.shiftKey ? 10 : 1;
    if (event.key === "ArrowLeft") {
      moveSelectionBy(-nudge, 0);
      event.preventDefault();
      return;
    }

    if (event.key === "ArrowRight") {
      moveSelectionBy(nudge, 0);
      event.preventDefault();
      return;
    }

    if (event.key === "ArrowUp") {
      moveSelectionBy(0, -nudge);
      event.preventDefault();
      return;
    }

    if (event.key === "ArrowDown") {
      moveSelectionBy(0, nudge);
      event.preventDefault();
      return;
    }
  });
}

function init() {
  loadInitialDocument();
  applyToolButtonState();
  bindEvents();
  updateHistoryButtons();
  render();
  setStatus("Ready");
}

init();
