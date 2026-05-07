const SVG_NS = "http://www.w3.org/2000/svg";

const TOOLS = {
  SELECT: "select",
  RECT: "rect",
  ELLIPSE: "ellipse",
  PEN: "pen",
  PENCIL: "pencil",
  DIRECT: "direct",
  LINE: "line",
  POLYGON: "polygon",
  TEXT: "text",
  HAND: "hand",
  ZOOM: "zoom",
  EYEDROPPER: "eyedropper"
};

const DEFAULT_STYLE = {
  fill: "#90caf955",
  stroke: "#1976d2",
  strokeWidth: 2,
  strokeJoin: "miter",
  strokeCap: "butt",
  strokeDasharray: "",
  strokeMiterlimit: 4,
  fillOpacity: 1,
  strokeOpacity: 1,
  opacity: 1
};

const SVG_IMPORT_DEFAULT_STYLE = {
  ...DEFAULT_STYLE,
  color: "#000000",
  fill: "#000000",
  stroke: "none",
  strokeWidth: 1,
  fillOpacity: 1,
  strokeOpacity: 1,
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
  pasteboard: document.getElementById("pasteboard"),
  artboardWrap: document.getElementById("artboard-wrap"),
  canvasBackground: document.getElementById("canvas-bg"),
  gridBackground: document.getElementById("grid-bg"),
  scene: document.getElementById("scene-root"),
  overlay: document.getElementById("overlay-root"),
  activeToolLabel: document.getElementById("active-tool-label"),
  layers: document.getElementById("layers-list"),
  layerForwardBtn: document.getElementById("layer-forward-btn"),
  layerBackwardBtn: document.getElementById("layer-backward-btn"),
  addLayerBtn: document.getElementById("add-layer-btn"),
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
  gridToggleBtn: document.getElementById("grid-toggle-btn"),
  rulersToggleBtn: document.getElementById("rulers-toggle-btn"),
  importSvgToolbarBtn: document.getElementById("import-svg-toolbar-btn"),
  toggleCodeToolbarBtn: document.getElementById("toggle-code-toolbar-btn"),
  zoomReadout: document.getElementById("zoom-readout"),
  zoomInBtn: document.getElementById("zoom-in-btn"),
  zoomOutBtn: document.getElementById("zoom-out-btn"),
  fitScreenBtn: document.getElementById("fit-screen-btn"),
  resetViewBtn: document.getElementById("reset-view-btn"),
  statusLeft: document.getElementById("status-left"),
  objectNameInput: document.getElementById("object-name-input"),
  docWidth: document.getElementById("doc-width-input"),
  docHeight: document.getElementById("doc-height-input"),
  fillInput: document.getElementById("fill-input"),
  strokeInput: document.getElementById("stroke-input"),
  fillModeInput: document.getElementById("fill-mode-input"),
  strokeModeInput: document.getElementById("stroke-mode-input"),
  fillGradientStartInput: document.getElementById("fill-gradient-start-input"),
  fillGradientEndInput: document.getElementById("fill-gradient-end-input"),
  fillGradientAngleInput: document.getElementById("fill-gradient-angle-input"),
  strokeGradientStartInput: document.getElementById("stroke-gradient-start-input"),
  strokeGradientEndInput: document.getElementById("stroke-gradient-end-input"),
  strokeGradientAngleInput: document.getElementById("stroke-gradient-angle-input"),
  fillOpacityInput: document.getElementById("fill-opacity-input"),
  strokeOpacityInput: document.getElementById("stroke-opacity-input"),
  strokeWidthInput: document.getElementById("stroke-width-input"),
  strokeDashInput: document.getElementById("stroke-dash-input"),
  miterLimitInput: document.getElementById("miter-limit-input"),
  strokeJoinInput: document.getElementById("stroke-join-input"),
  strokeCapInput: document.getElementById("stroke-cap-input"),
  opacityInput: document.getElementById("opacity-input"),
  transformXInput: document.getElementById("transform-x-input"),
  transformYInput: document.getElementById("transform-y-input"),
  transformWInput: document.getElementById("transform-w-input"),
  transformHInput: document.getElementById("transform-h-input"),
  transformRotateInput: document.getElementById("transform-rotate-input"),
  selectionSummary: document.getElementById("selection-summary"),
  undoBtn: document.getElementById("undo-btn"),
  redoBtn: document.getElementById("redo-btn"),
  undoToolbarBtn: document.getElementById("undo-toolbar-btn"),
  redoToolbarBtn: document.getElementById("redo-toolbar-btn"),
  duplicateBtn: document.getElementById("duplicate-btn"),
  deleteBtn: document.getElementById("delete-btn"),
  importSvgBtn: document.getElementById("import-svg-btn"),
  importSvgInput: document.getElementById("import-svg-input"),
  downloadSvgBtn: document.getElementById("download-svg-btn"),
  copySvgBtn: document.getElementById("copy-svg-btn"),
  pencilSmoothingInput: document.getElementById("pencil-smoothing-input"),
  toggleCodeBtn: document.getElementById("toggle-code-btn"),
  codeDrawer: document.getElementById("code-drawer"),
  svgCodeInput: document.getElementById("svg-code-input"),
  svgValidationMessage: document.getElementById("svg-validation-message"),
  applySvgCodeBtn: document.getElementById("apply-svg-code-btn"),
  refreshSvgCodeBtn: document.getElementById("refresh-svg-code-btn")
};

const requiredDomKeys = [
  "toolGroup",
  "canvas",
  "pasteboard",
  "artboardWrap",
  "canvasBackground",
  "gridBackground",
  "scene",
  "overlay",
  "activeToolLabel",
  "layers",
  "layerForwardBtn",
  "layerBackwardBtn",
  "addLayerBtn",
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
  "gridToggleBtn",
  "rulersToggleBtn",
  "importSvgToolbarBtn",
  "toggleCodeToolbarBtn",
  "zoomReadout",
  "zoomInBtn",
  "zoomOutBtn",
  "fitScreenBtn",
  "resetViewBtn",
  "statusLeft",
  "objectNameInput",
  "docWidth",
  "docHeight",
  "fillInput",
  "strokeInput",
  "fillModeInput",
  "strokeModeInput",
  "fillGradientStartInput",
  "fillGradientEndInput",
  "fillGradientAngleInput",
  "strokeGradientStartInput",
  "strokeGradientEndInput",
  "strokeGradientAngleInput",
  "fillOpacityInput",
  "strokeOpacityInput",
  "strokeWidthInput",
  "strokeDashInput",
  "miterLimitInput",
  "strokeJoinInput",
  "strokeCapInput",
  "opacityInput",
  "transformXInput",
  "transformYInput",
  "transformWInput",
  "transformHInput",
  "transformRotateInput",
  "selectionSummary",
  "undoBtn",
  "redoBtn",
  "undoToolbarBtn",
  "redoToolbarBtn",
  "duplicateBtn",
  "deleteBtn",
  "importSvgBtn",
  "importSvgInput",
  "downloadSvgBtn",
  "copySvgBtn",
  "pencilSmoothingInput",
  "toggleCodeBtn",
  "codeDrawer",
  "svgCodeInput",
  "svgValidationMessage",
  "applySvgCodeBtn",
  "refreshSvgCodeBtn"
];

for (const key of requiredDomKeys) {
  if (!dom[key]) {
    throw new Error(`[svg-editor] Missing required element: ${key}`);
  }
}

const state = {
  doc: {
    width: 1200,
    height: 800,
    defs: ""
  },
  tool: TOOLS.SELECT,
  objects: [],
  selection: [],
  activeLayerId: null,
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
    startSelectionBounds: null,
    pencilPoints: null,
    penDragPathId: null,
    penDragAnchorIndex: null,
    hoverAnchor: null,
    penHistoryPathId: null,
    dragStartLocal: null,
    dragAnchorSnapshot: null,
    dragHandleSnapshot: null,
    activeHandle: null,
    livePreviewPoint: null,
    rafPending: false,
    lastCursorPoint: null
  },
  history: {
    undo: [],
    redo: []
  },
  snap: {
    enabled: true,
    threshold: 6
  },
  view: {
    zoom: 0.62,
    panX: 0,
    panY: 0,
    grid: true,
    rulers: true,
    fitted: false
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

function clampNumber(value, min, max, fallback) {
  const number = Number(value);
  return Number.isFinite(number) ? clamp(number, min, max) : fallback;
}

function round(value, precision = 3) {
  const m = 10 ** precision;
  return Math.round(value * m) / m;
}

function matrixIdentity() {
  return [1, 0, 0, 1, 0, 0];
}

function matrixMultiply(left, right) {
  const [a1, b1, c1, d1, e1, f1] = left || matrixIdentity();
  const [a2, b2, c2, d2, e2, f2] = right || matrixIdentity();
  return [
    a1 * a2 + c1 * b2,
    b1 * a2 + d1 * b2,
    a1 * c2 + c1 * d2,
    b1 * c2 + d1 * d2,
    a1 * e2 + c1 * f2 + e1,
    b1 * e2 + d1 * f2 + f1
  ];
}

function matrixTranslate(x = 0, y = 0) {
  return [1, 0, 0, 1, Number(x) || 0, Number(y) || 0];
}

function matrixScale(x = 1, y = x) {
  const sx = Number.isFinite(Number(x)) ? Number(x) : 1;
  const sy = Number.isFinite(Number(y)) ? Number(y) : sx;
  return [sx, 0, 0, sy, 0, 0];
}

function matrixRotate(angle = 0, cx = 0, cy = 0) {
  const radians = ((Number(angle) || 0) * Math.PI) / 180;
  const cos = Math.cos(radians);
  const sin = Math.sin(radians);
  const rotation = [cos, sin, -sin, cos, 0, 0];
  if (!cx && !cy) {
    return rotation;
  }
  return matrixMultiply(matrixMultiply(matrixTranslate(cx, cy), rotation), matrixTranslate(-cx, -cy));
}

function matrixSkewX(angle = 0) {
  return [1, 0, Math.tan(((Number(angle) || 0) * Math.PI) / 180), 1, 0, 0];
}

function matrixSkewY(angle = 0) {
  return [1, Math.tan(((Number(angle) || 0) * Math.PI) / 180), 0, 1, 0, 0];
}

function matrixApplyPoint(matrix, point) {
  const [a, b, c, d, e, f] = matrix || matrixIdentity();
  return {
    x: point.x * a + point.y * c + e,
    y: point.x * b + point.y * d + f
  };
}

function matrixInverse(matrix) {
  const [a, b, c, d, e, f] = matrix || matrixIdentity();
  const determinant = a * d - b * c;
  if (Math.abs(determinant) < 0.0000001) {
    console.warn("SVG editor: unsupported non-invertible transform matrix", matrix);
    return matrixIdentity();
  }
  return [
    d / determinant,
    -b / determinant,
    -c / determinant,
    a / determinant,
    (c * f - d * e) / determinant,
    (b * e - a * f) / determinant
  ];
}

function matrixIsIdentity(matrix) {
  const m = matrix || matrixIdentity();
  return (
    Math.abs(m[0] - 1) < 0.000001 &&
    Math.abs(m[1]) < 0.000001 &&
    Math.abs(m[2]) < 0.000001 &&
    Math.abs(m[3] - 1) < 0.000001 &&
    Math.abs(m[4]) < 0.000001 &&
    Math.abs(m[5]) < 0.000001
  );
}

function matrixToString(matrix) {
  return `matrix(${(matrix || matrixIdentity()).map((value) => round(value, 6)).join(" ")})`;
}

function gradientId(prefix = "gradient") {
  return nextId(prefix).replace(/[^A-Za-z0-9_.:-]/g, "_");
}

function defaultGradient(kind = "linear", start = DEFAULT_STYLE.fill, end = "#7c3aed") {
  return {
    id: gradientId(kind === "radial" ? "radialGradient" : "linearGradient"),
    type: kind === "radial" ? "radial" : "linear",
    angle: 0,
    stops: [
      { offset: 0, color: colorToHex(start, "#90caf9"), opacity: 1 },
      { offset: 1, color: colorToHex(end, "#7c3aed"), opacity: 1 }
    ]
  };
}

function normalizeGradient(gradient, fallbackStart = DEFAULT_STYLE.fill, fallbackEnd = "#7c3aed") {
  if (!gradient || typeof gradient !== "object") {
    return null;
  }
  const stops = Array.isArray(gradient.stops) && gradient.stops.length >= 2
    ? gradient.stops.slice(0, 8)
    : defaultGradient(gradient.type, fallbackStart, fallbackEnd).stops;
  return {
    id: typeof gradient.id === "string" && gradient.id ? gradient.id : gradientId(gradient.type === "radial" ? "radialGradient" : "linearGradient"),
    type: gradient.type === "radial" ? "radial" : "linear",
    angle: Number.isFinite(Number(gradient.angle)) ? Number(gradient.angle) : 0,
    stops: stops.map((stop, index) => ({
      offset: clampNumber(stop.offset, 0, 1, index / Math.max(1, stops.length - 1)),
      color: stop.color || (index === 0 ? fallbackStart : fallbackEnd),
      opacity: clampNumber(stop.opacity, 0, 1, 1)
    }))
  };
}

function transformToMatrix(transform) {
  const t = normalizeTransform(transform);
  if (Array.isArray(t.matrix)) {
    return t.matrix;
  }
  return matrixMultiply(matrixMultiply(matrixTranslate(t.tx, t.ty), matrixRotate(t.rotation)), matrixScale(t.sx, t.sy));
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
  if (Array.isArray(transform?.matrix)) {
    const matrix = transform.matrix.map(Number);
    if (matrix.length === 6 && matrix.every(Number.isFinite)) {
      return {
        ...DEFAULT_TRANSFORM,
        matrix
      };
    }
  }
  return {
    ...DEFAULT_TRANSFORM,
    ...(transform || {})
  };
}

function normalizeStyle(style) {
  const next = {
    ...DEFAULT_STYLE,
    ...(style || {})
  };
  next.fillOpacity = clampNumber(next.fillOpacity, 0, 1, DEFAULT_STYLE.fillOpacity);
  next.strokeOpacity = clampNumber(next.strokeOpacity, 0, 1, DEFAULT_STYLE.strokeOpacity);
  next.opacity = clampNumber(next.opacity, 0, 1, DEFAULT_STYLE.opacity);
  if (!["miter", "round", "bevel"].includes(next.strokeJoin)) {
    next.strokeJoin = DEFAULT_STYLE.strokeJoin;
  }
  if (!["butt", "round", "square"].includes(next.strokeCap)) {
    next.strokeCap = DEFAULT_STYLE.strokeCap;
  }
  next.strokeDasharray = typeof next.strokeDasharray === "string" ? next.strokeDasharray.trim() : "";
  next.strokeMiterlimit = Math.max(1, Number(next.strokeMiterlimit) || DEFAULT_STYLE.strokeMiterlimit);
  next.fillGradient = normalizeGradient(next.fillGradient, next.fill || DEFAULT_STYLE.fill, "#7c3aed");
  next.strokeGradient = normalizeGradient(next.strokeGradient, next.stroke || DEFAULT_STYLE.stroke, "#ff7a18");
  return next;
}

function transformToString(transform) {
  const t = normalizeTransform(transform);
  if (Array.isArray(t.matrix)) {
    return matrixIsIdentity(t.matrix) ? "" : matrixToString(t.matrix);
  }
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

function parseTransformNumbers(value) {
  return String(value || "")
    .trim()
    .split(/[\s,]+/)
    .filter(Boolean)
    .map(Number)
    .filter((number) => Number.isFinite(number));
}

function parseSvgTransformMatrix(transform) {
  let matrix = matrixIdentity();
  const text = String(transform || "").trim();
  if (!text) {
    return matrix;
  }

  const transformPattern = /([a-zA-Z]+)\(([^)]*)\)/g;
  let match;
  let consumed = false;

  while ((match = transformPattern.exec(text))) {
    consumed = true;
    const type = match[1];
    const values = parseTransformNumbers(match[2]);
    let next = matrixIdentity();

    if (type === "matrix" && values.length >= 6) {
      next = values.slice(0, 6);
    } else if (type === "translate" && values.length >= 1) {
      next = matrixTranslate(values[0], values.length >= 2 ? values[1] : 0);
    } else if (type === "scale" && values.length >= 1) {
      next = matrixScale(values[0], values.length >= 2 ? values[1] : values[0]);
    } else if (type === "rotate" && values.length >= 1) {
      next = matrixRotate(values[0], values.length >= 3 ? values[1] : 0, values.length >= 3 ? values[2] : 0);
    } else if (type === "skewX" && values.length >= 1) {
      next = matrixSkewX(values[0]);
    } else if (type === "skewY" && values.length >= 1) {
      next = matrixSkewY(values[0]);
    } else {
      console.warn(`SVG editor: unsupported transform '${type}' ignored during import`);
      continue;
    }

    matrix = matrixMultiply(matrix, next);
  }

  if (!consumed && text) {
    console.warn("SVG editor: could not parse transform during import", text);
  }

  return matrix;
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

  const matrix = parseSvgTransformMatrix(transform);
  return matrixIsIdentity(matrix) ? deepClone(DEFAULT_TRANSFORM) : { ...deepClone(DEFAULT_TRANSFORM), matrix };
}

function parseLegacyPathD(pathD) {
  if (!pathD || typeof pathD !== "string") {
    return { anchors: [], closed: false, rawD: "" };
  }

  const commandTokens = pathD.match(/[AaCcHhLlMmQqSsTtVvZz]/g) || [];
  if (commandTokens.some((command) => !/[MLCZmlcz]/.test(command))) {
    console.warn("SVG editor: preserving complex path data instead of converting unsupported commands", pathD.slice(0, 120));
    return { anchors: [], closed: /[Zz]/.test(commandTokens[commandTokens.length - 1] || ""), rawD: pathD, preserved: true };
  }

  const tokens = pathD.match(/[MLCZmlcz]|[-+]?(?:\d*\.\d+|\d+\.?)(?:e[-+]?\d+)?/g);
  if (!tokens) {
    return { anchors: [], closed: false, rawD: pathD };
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

  return { anchors, closed, rawD: pathD };
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
    sourceId: typeof raw.sourceId === "string" ? raw.sourceId : null,
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
      closed: geometry.closed === true,
      rawD: typeof geometry.rawD === "string" ? geometry.rawD : ""
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
    sourceId: typeof raw?.sourceId === "string" ? raw.sourceId : null,
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

  if (type === "line") {
    return {
      ...base,
      geometry: {
        x1: Number(raw?.x1 ?? 0),
        y1: Number(raw?.y1 ?? 0),
        x2: Number(raw?.x2 ?? 1),
        y2: Number(raw?.y2 ?? 1)
      }
    };
  }

  if (type === "polygon") {
    return {
      ...base,
      geometry: {
        cx: Number(raw?.cx ?? 0),
        cy: Number(raw?.cy ?? 0),
        radius: Math.max(1, Number(raw?.radius ?? 1)),
        sides: clamp(Number(raw?.sides ?? 6), 3, 12)
      }
    };
  }

  if (type === "text") {
    return {
      ...base,
      geometry: {
        x: Number(raw?.x ?? 0),
        y: Number(raw?.y ?? 0),
        text: String(raw?.text ?? "Text"),
        fontSize: Math.max(4, Number(raw?.fontSize ?? 48)),
        fontFamily: String(raw?.fontFamily ?? "Inter, Arial, sans-serif")
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

  if (shape.type === "line") {
    return {
      id: shape.id,
      type: "line",
      name: shape.name,
      x1: shape.geometry.x1,
      y1: shape.geometry.y1,
      x2: shape.geometry.x2,
      y2: shape.geometry.y2,
      fill: { color: shape.style.fill },
      stroke: { color: shape.style.stroke, width: shape.style.strokeWidth },
      opacity: shape.style.opacity,
      transform: transformToString(shape.transform),
      visible: shape.visible,
      locked: shape.locked
    };
  }

  if (shape.type === "polygon") {
    return {
      id: shape.id,
      type: "polygon",
      name: shape.name,
      ...shape.geometry,
      fill: { color: shape.style.fill },
      stroke: { color: shape.style.stroke, width: shape.style.strokeWidth },
      opacity: shape.style.opacity,
      transform: transformToString(shape.transform),
      visible: shape.visible,
      locked: shape.locked
    };
  }

  if (shape.type === "text") {
    return {
      id: shape.id,
      type: "text",
      name: shape.name,
      ...shape.geometry,
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

  if (shape.type === "line") {
    const g = shape.geometry;
    const length = Math.hypot(g.x2 - g.x1, g.y2 - g.y1);
    if (length < 0.1) {
      return Math.hypot(local.x - g.x1, local.y - g.y1) <= 6;
    }
    const t = clamp(((local.x - g.x1) * (g.x2 - g.x1) + (local.y - g.y1) * (g.y2 - g.y1)) / (length * length), 0, 1);
    const px = g.x1 + (g.x2 - g.x1) * t;
    const py = g.y1 + (g.y2 - g.y1) * t;
    return Math.hypot(local.x - px, local.y - py) <= Math.max(6, normalizeStyle(shape.style).strokeWidth + 4);
  }

  if (shape.type === "polygon") {
    const points = polygonPoints(shape.geometry);
    let inside = false;
    for (let i = 0, j = points.length - 1; i < points.length; j = i, i += 1) {
      const pi = points[i];
      const pj = points[j];
      const intersect = pi.y > local.y !== pj.y > local.y && local.x < ((pj.x - pi.x) * (local.y - pi.y)) / (pj.y - pi.y) + pi.x;
      if (intersect) {
        inside = !inside;
      }
    }
    return inside;
  }

  if (shape.type === "text") {
    const g = shape.geometry;
    const width = Math.max(1, String(g.text || "").length * g.fontSize * 0.58);
    const height = Math.max(1, g.fontSize);
    return local.x >= g.x && local.x <= g.x + width && local.y >= g.y - height && local.y <= g.y + height * 0.25;
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
    activeLayerId: state.activeLayerId,
    activePathId: state.activePathId,
    directSelection: state.directSelection
  });
}

function restoreSnapshot(snapshot) {
  const parsed = JSON.parse(snapshot);
  state.doc.width = clamp(Number(parsed?.doc?.width ?? 1200), 64, 10000);
  state.doc.height = clamp(Number(parsed?.doc?.height ?? 800), 64, 10000);
  state.doc.defs = typeof parsed?.doc?.defs === "string" ? parsed.doc.defs : "";
  state.objects = adaptShapeArray(parsed?.objects || []);
  state.selection = Array.isArray(parsed?.selection) ? parsed.selection.filter(Boolean) : [];
  state.activeLayerId = typeof parsed?.activeLayerId === "string" ? parsed.activeLayerId : null;
  state.activePathId = typeof parsed?.activePathId === "string" ? parsed.activePathId : null;
  state.directSelection.pathId =
    typeof parsed?.directSelection?.pathId === "string" ? parsed.directSelection.pathId : null;
  state.directSelection.anchorIndex = Number.isInteger(parsed?.directSelection?.anchorIndex)
    ? parsed.directSelection.anchorIndex
    : null;
  if (!getObjectById(state.activeLayerId)) {
    state.activeLayerId = state.objects.find((shape) => shape.type === "group")?.id || null;
  }
  resetPathDragState();
  state.interaction.livePreviewPoint = null;
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
  dom.undoToolbarBtn.disabled = state.history.undo.length === 0;
  dom.redoToolbarBtn.disabled = state.history.redo.length === 0;
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

function renderSoon() {
  if (state.interaction.rafPending) {
    return;
  }
  state.interaction.rafPending = true;
  window.requestAnimationFrame(() => {
    state.interaction.rafPending = false;
    render();
  });
}

function capturePointer(event) {
  try {
    dom.canvas.setPointerCapture(event.pointerId);
  } catch (error) {
    // Pointer capture is an interaction enhancement; the global listeners still finish drags.
  }
}

function releasePointer(event) {
  try {
    if (dom.canvas.hasPointerCapture(event.pointerId)) {
      dom.canvas.releasePointerCapture(event.pointerId);
    }
  } catch (error) {
    // Ignore unsupported or already-released pointer capture states.
  }
}

function updateWorkspaceClasses() {
  document.body.classList.toggle("is-select-tool", state.tool === TOOLS.SELECT);
  document.body.classList.toggle("is-direct-tool", state.tool === TOOLS.DIRECT);
  document.body.classList.toggle("is-hand-tool", state.tool === TOOLS.HAND);
  document.body.classList.toggle("is-zoom-tool", state.tool === TOOLS.ZOOM);
  document.body.classList.toggle("is-eyedropper-tool", state.tool === TOOLS.EYEDROPPER);
  document.body.classList.toggle("is-pencil-tool", state.tool === TOOLS.PENCIL);
  document.body.classList.toggle("hide-grid", !state.view.grid);
  document.body.classList.toggle("hide-rulers", !state.view.rulers);
  document.body.classList.toggle("is-panning", state.interaction.mode === "panning");
}

function applyViewTransform() {
  dom.artboardWrap.style.width = `${state.doc.width}px`;
  dom.artboardWrap.style.height = `${state.doc.height}px`;
  dom.artboardWrap.style.transform = `translate(${round(state.view.panX, 2)}px, ${round(state.view.panY, 2)}px) scale(${round(state.view.zoom, 4)}) translate(-50%, -50%)`;
  dom.zoomReadout.textContent = `${Math.round(state.view.zoom * 100)}%`;
  dom.gridToggleBtn.classList.toggle("is-active", state.view.grid);
  dom.rulersToggleBtn.classList.toggle("is-active", state.view.rulers);
  updateWorkspaceClasses();
}

function fitArtboardToScreen() {
  const rect = dom.pasteboard.getBoundingClientRect();
  if (!rect.width || !rect.height) {
    return;
  }
  const rulerInset = state.view.rulers ? 40 : 24;
  const scaleX = Math.max(0.1, (rect.width - rulerInset * 2) / state.doc.width);
  const scaleY = Math.max(0.1, (rect.height - rulerInset * 2) / state.doc.height);
  state.view.zoom = clamp(Math.min(scaleX, scaleY), 0.08, 4);
  state.view.panX = state.view.rulers ? 12 : 0;
  state.view.panY = state.view.rulers ? 12 : 0;
  state.view.fitted = true;
  applyViewTransform();
}

function setZoom(nextZoom, anchorEvent = null) {
  const previous = state.view.zoom;
  state.view.zoom = clamp(nextZoom, 0.08, 8);
  if (anchorEvent && previous !== state.view.zoom) {
    const rect = dom.pasteboard.getBoundingClientRect();
    const cx = anchorEvent.clientX - rect.left - rect.width / 2;
    const cy = anchorEvent.clientY - rect.top - rect.height / 2;
    const ratio = state.view.zoom / previous;
    state.view.panX = cx - (cx - state.view.panX) * ratio;
    state.view.panY = cy - (cy - state.view.panY) * ratio;
  }
  state.view.fitted = false;
  applyViewTransform();
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
  if (Array.isArray(t.matrix)) {
    return matrixApplyPoint(matrixInverse(t.matrix), point);
  }
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
  if (Array.isArray(t.matrix)) {
    return matrixApplyPoint(t.matrix, point);
  }
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

function getLinePathCommands(shape) {
  const g = shape.geometry;
  return [
    { type: "M", x: g.x1, y: g.y1 },
    { type: "L", x: g.x2, y: g.y2 }
  ];
}

function polygonPoints(geometry) {
  if (Array.isArray(geometry.points) && geometry.points.length > 0) {
    return geometry.points;
  }
  const sides = clamp(Math.round(Number(geometry.sides) || 6), 3, 12);
  const radius = Math.max(1, Number(geometry.radius) || 1);
  const points = [];
  for (let i = 0; i < sides; i += 1) {
    const angle = -Math.PI / 2 + (i / sides) * Math.PI * 2;
    points.push({
      x: geometry.cx + Math.cos(angle) * radius,
      y: geometry.cy + Math.sin(angle) * radius
    });
  }
  return points;
}

function getPolygonPathCommands(shape) {
  const points = polygonPoints(shape.geometry);
  if (points.length === 0) {
    return [];
  }
  return [
    { type: "M", x: points[0].x, y: points[0].y },
    ...points.slice(1).map((point) => ({ type: "L", x: point.x, y: point.y })),
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
  if (shape.type === "line") {
    return getLinePathCommands(shape);
  }
  if (shape.type === "polygon") {
    return getPolygonPathCommands(shape);
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

function gradientPaintValue(style, paintKey) {
  const gradient = paintKey === "stroke" ? style.strokeGradient : style.fillGradient;
  return gradient ? `url(#${gradient.id})` : style[paintKey];
}

function applyPaintAttributes(node, style, fillOverride = null) {
  const fill = fillOverride ?? gradientPaintValue(style, "fill") ?? "none";
  node.setAttribute("fill", fill);
  node.setAttribute("stroke", gradientPaintValue(style, "stroke") || "none");
  node.setAttribute("stroke-width", String(round(style.strokeWidth || 0)));
  node.setAttribute("stroke-linejoin", style.strokeJoin || "miter");
  node.setAttribute("stroke-linecap", style.strokeCap || "butt");
  if (style.strokeDasharray) {
    node.setAttribute("stroke-dasharray", style.strokeDasharray);
  }
  if (style.strokeJoin === "miter") {
    node.setAttribute("stroke-miterlimit", String(round(style.strokeMiterlimit || 4)));
  }
  if (style.fillOpacity !== 1) {
    node.setAttribute("fill-opacity", String(round(style.fillOpacity)));
  }
  if (style.strokeOpacity !== 1) {
    node.setAttribute("stroke-opacity", String(round(style.strokeOpacity)));
  }
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
    node.setAttribute("d", shape.geometry.rawD || buildPathD(shape.geometry.anchors, shape.geometry.closed));
    applyPaintAttributes(node, style, shape.geometry.rawD || shape.geometry.closed ? null : "none");
    group.appendChild(node);
  } else if (shape.type === "line") {
    const node = createSvgElement("line");
    node.setAttribute("x1", String(round(shape.geometry.x1)));
    node.setAttribute("y1", String(round(shape.geometry.y1)));
    node.setAttribute("x2", String(round(shape.geometry.x2)));
    node.setAttribute("y2", String(round(shape.geometry.y2)));
    applyPaintAttributes(node, style, "none");
    group.appendChild(node);
  } else if (shape.type === "polygon") {
    const node = createSvgElement("polygon");
    node.setAttribute(
      "points",
      polygonPoints(shape.geometry)
        .map((point) => `${round(point.x)},${round(point.y)}`)
        .join(" ")
    );
    applyPaintAttributes(node, style);
    group.appendChild(node);
  } else if (shape.type === "text") {
    const node = createSvgElement("text");
    node.setAttribute("x", String(round(shape.geometry.x)));
    node.setAttribute("y", String(round(shape.geometry.y)));
    node.setAttribute("font-size", String(round(shape.geometry.fontSize)));
    node.setAttribute("font-family", shape.geometry.fontFamily || "Inter, Arial, sans-serif");
    node.textContent = shape.geometry.text || "Text";
    applyPaintAttributes(node, style, style.fill || "#111111");
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

function gradientToSvgNode(gradient) {
  const normalized = normalizeGradient(gradient);
  if (!normalized) {
    return null;
  }
  const node = createSvgElement(normalized.type === "radial" ? "radialGradient" : "linearGradient");
  node.setAttribute("id", normalized.id);
  node.setAttribute("gradientUnits", "objectBoundingBox");
  if (normalized.type === "linear") {
    const radians = ((normalized.angle || 0) * Math.PI) / 180;
    const dx = Math.cos(radians) / 2;
    const dy = Math.sin(radians) / 2;
    node.setAttribute("x1", String(round(0.5 - dx, 4)));
    node.setAttribute("y1", String(round(0.5 - dy, 4)));
    node.setAttribute("x2", String(round(0.5 + dx, 4)));
    node.setAttribute("y2", String(round(0.5 + dy, 4)));
  } else {
    node.setAttribute("cx", "0.5");
    node.setAttribute("cy", "0.5");
    node.setAttribute("r", "0.5");
  }
  for (const stop of normalized.stops) {
    const stopNode = createSvgElement("stop");
    stopNode.setAttribute("offset", `${round(stop.offset * 100, 2)}%`);
    stopNode.setAttribute("stop-color", stop.color);
    if (stop.opacity !== 1) {
      stopNode.setAttribute("stop-opacity", String(round(stop.opacity)));
    }
    node.appendChild(stopNode);
  }
  return node;
}

function collectStyleGradients(shapes = state.objects, gradients = new Map()) {
  for (const shape of shapes) {
    const style = normalizeStyle(shape.style);
    for (const gradient of [style.fillGradient, style.strokeGradient]) {
      if (gradient && !gradients.has(gradient.id)) {
        gradients.set(gradient.id, gradient);
      }
    }
    if (shape.type === "group" && Array.isArray(shape.children)) {
      collectStyleGradients(shape.children, gradients);
    }
  }
  return gradients;
}

function appendDocumentDefs(parentNode) {
  const hasImportedDefs = Boolean(state.doc.defs);
  const gradients = collectStyleGradients();
  if (!hasImportedDefs && gradients.size === 0) {
    return;
  }
  const defs = createSvgElement("defs");
  if (hasImportedDefs) {
    defs.innerHTML = state.doc.defs;
  }
  for (const gradient of gradients.values()) {
    const node = gradientToSvgNode(gradient);
    if (node) {
      defs.appendChild(node);
    }
  }
  parentNode.appendChild(defs);
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

    const isTransformTool = state.tool === TOOLS.SELECT;
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

  }

  if (state.tool === TOOLS.DIRECT || (state.tool === TOOLS.PEN && state.activePathId)) {
    drawDirectSelectionAnchors();
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
      if (state.interaction.hoverAnchor?.pathId === path.id && state.interaction.hoverAnchor?.anchorIndex === index) {
        node.classList.add("is-hovered");
      }
      if (state.tool === TOOLS.PEN && state.activePathId === path.id && index === 0 && anchors.length >= 3) {
        node.classList.add("is-close-target");
        node.setAttribute("r", "6");
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
        if (
          state.interaction.activeHandle?.pathId === path.id &&
          state.interaction.activeHandle?.anchorIndex === index &&
          state.interaction.activeHandle?.kind === spec.kind
        ) {
          handleNode.classList.add("is-active");
        }
        dom.overlay.appendChild(handleNode);
      }
    }
  }

  if (state.tool === TOOLS.PEN && state.activePathId && state.interaction.livePreviewPoint) {
    const found = getObjectById(state.activePathId);
    const anchors = found?.object?.geometry?.anchors || [];
    const last = anchors[anchors.length - 1];
    if (found?.object?.type === "path" && last) {
      const start = applyTransformToPoint(last, found.object.transform);
      const end = state.interaction.livePreviewPoint;
      const line = createSvgElement("line");
      line.setAttribute("class", "path-preview-line");
      line.setAttribute("x1", String(round(start.x)));
      line.setAttribute("y1", String(round(start.y)));
      line.setAttribute("x2", String(round(end.x)));
      line.setAttribute("y2", String(round(end.y)));
      dom.overlay.appendChild(line);
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
    if (state.activeLayerId === shape.id || getTopLevelLayerForId(shape.id)?.id === state.activeLayerId) {
      item.classList.add("is-active-layer");
    }
    item.classList.toggle("is-hidden", shape.visible === false);
    item.classList.toggle("is-locked", shape.locked === true);

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

    const visibilityBtn = document.createElement("span");
    visibilityBtn.className = "layer-mini-button";
    visibilityBtn.title = shape.visible === false ? "Show layer" : "Hide layer";
    visibilityBtn.textContent = shape.visible === false ? "○" : "●";
    visibilityBtn.addEventListener("click", (event) => {
      event.stopPropagation();
      pushHistory();
      shape.visible = shape.visible === false;
      if (shape.visible === false) {
        state.selection = state.selection.filter((id) => id !== shape.id);
      }
      render();
    });
    item.appendChild(visibilityBtn);

    const lockBtn = document.createElement("span");
    lockBtn.className = "layer-mini-button";
    lockBtn.title = shape.locked ? "Unlock layer" : "Lock layer";
    lockBtn.textContent = shape.locked ? "⌧" : "□";
    lockBtn.addEventListener("click", (event) => {
      event.stopPropagation();
      pushHistory();
      shape.locked = !shape.locked;
      if (shape.locked) {
        state.selection = state.selection.filter((id) => id !== shape.id);
      }
      render();
    });
    item.appendChild(lockBtn);

    item.addEventListener("dblclick", (event) => {
      event.stopPropagation();
      const nextName = window.prompt("Layer name", shape.name || shape.type);
      const cleanedName = sanitizeManualName(nextName);
      if (cleanedName) {
        pushHistory();
        shape.name = cleanedName;
        render();
      }
    });

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
      const layer = shape.type === "group" && depth === 0 ? shape : getTopLevelLayerForId(shape.id);
      if (layer) {
        state.activeLayerId = layer.id;
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
  dom.gridBackground.setAttribute("width", String(state.doc.width));
  dom.gridBackground.setAttribute("height", String(state.doc.height));
  applyViewTransform();

  while (dom.scene.firstChild) {
    dom.scene.firstChild.remove();
  }

  appendDocumentDefs(dom.scene);

  const shapes = [...state.objects].sort((a, b) => a.zIndex - b.zIndex);
  for (const shape of shapes) {
    renderShape(shape, dom.scene);
  }

  drawSelectionOutline();
  updateLayersPanel();

  const primary = getPrimarySelectedObject();
  const activeAnchor = getActiveAnchorSelection();
  if (activeAnchor) {
    dom.selectionSummary.textContent = `Anchor ${activeAnchor.anchorIndex + 1} on ${activeAnchor.path.name || "Path"}`;
  } else if (state.selection.length === 0) {
    const activeLayer = state.activeLayerId ? getObjectById(state.activeLayerId)?.object : null;
    dom.selectionSummary.textContent = activeLayer ? `Active layer: ${activeLayer.name}` : "No selection";
  } else if (state.selection.length === 1 && primary) {
    const layer = getTopLevelLayerForId(primary.id);
    dom.selectionSummary.textContent = layer && layer.id !== primary.id
      ? `${primary.name || primary.type} (${primary.type}) in ${layer.name}`
      : `${primary.name || primary.type} (${primary.type})`;
  } else {
    dom.selectionSummary.textContent = `${state.selection.length} selected`;
  }

  dom.objectNameInput.value = state.selection.length === 1 && primary ? primary.name || "" : "";
  dom.objectNameInput.disabled = !(state.selection.length === 1 && primary);

  const style = primary ? normalizeStyle(primary.style) : deepClone(DEFAULT_STYLE);
  dom.fillInput.value = colorToHex(style.fill, "#90caf9");
  dom.strokeInput.value = colorToHex(style.stroke, "#1976d2");
  dom.fillModeInput.value = style.fillGradient?.type || (style.fill === "none" ? "none" : "solid");
  dom.strokeModeInput.value = style.strokeGradient?.type || (style.stroke === "none" ? "none" : "solid");
  dom.fillOpacityInput.value = String(round(clampNumber(style.fillOpacity, 0, 1, 1), 2));
  dom.strokeOpacityInput.value = String(round(clampNumber(style.strokeOpacity, 0, 1, 1), 2));
  const fillGradient = style.fillGradient || defaultGradient("linear", style.fill, "#7c3aed");
  const strokeGradient = style.strokeGradient || defaultGradient("linear", style.stroke, "#ff7a18");
  dom.fillGradientStartInput.value = colorToHex(fillGradient.stops[0]?.color, "#90caf9");
  dom.fillGradientEndInput.value = colorToHex(fillGradient.stops[fillGradient.stops.length - 1]?.color, "#7c3aed");
  dom.fillGradientAngleInput.value = String(round(fillGradient.angle || 0, 1));
  dom.strokeGradientStartInput.value = colorToHex(strokeGradient.stops[0]?.color, "#1976d2");
  dom.strokeGradientEndInput.value = colorToHex(strokeGradient.stops[strokeGradient.stops.length - 1]?.color, "#ff7a18");
  dom.strokeGradientAngleInput.value = String(round(strokeGradient.angle || 0, 1));
  dom.strokeWidthInput.value = String(round(clamp(Number(style.strokeWidth) || 0, 0, 64), 2));
  dom.strokeDashInput.value = style.strokeDasharray || "";
  dom.miterLimitInput.value = String(round(style.strokeMiterlimit || 4, 2));
  dom.strokeJoinInput.value = style.strokeJoin || DEFAULT_STYLE.strokeJoin;
  dom.strokeCapInput.value = style.strokeCap || DEFAULT_STYLE.strokeCap;
  dom.opacityInput.value = String(round(clamp(Number(style.opacity) || 1, 0, 1), 2));
  dom.fillInput.disabled = false;
  dom.strokeInput.disabled = false;
  dom.fillModeInput.disabled = false;
  dom.strokeModeInput.disabled = false;
  dom.fillOpacityInput.disabled = false;
  dom.strokeOpacityInput.disabled = false;
  dom.fillGradientStartInput.disabled = dom.fillModeInput.value === "solid" || dom.fillModeInput.value === "none";
  dom.fillGradientEndInput.disabled = dom.fillGradientStartInput.disabled;
  dom.fillGradientAngleInput.disabled = dom.fillGradientStartInput.disabled;
  dom.strokeGradientStartInput.disabled = dom.strokeModeInput.value === "solid" || dom.strokeModeInput.value === "none";
  dom.strokeGradientEndInput.disabled = dom.strokeGradientStartInput.disabled;
  dom.strokeGradientAngleInput.disabled = dom.strokeGradientStartInput.disabled;
  dom.strokeWidthInput.disabled = false;
  dom.strokeDashInput.disabled = false;
  dom.miterLimitInput.disabled = false;
  dom.strokeJoinInput.disabled = false;
  dom.strokeCapInput.disabled = false;
  dom.opacityInput.disabled = false;

  const singleSelection = state.selection.length === 1 ? primary : null;
  const singleBounds = state.selection.length === 1 ? getSelectionBounds() : null;
  if (activeAnchor && (state.tool === TOOLS.DIRECT || state.tool === TOOLS.PEN)) {
    dom.transformXInput.value = String(round(activeAnchor.anchor.x, 2));
    dom.transformYInput.value = String(round(activeAnchor.anchor.y, 2));
    dom.transformWInput.value = "";
    dom.transformHInput.value = "";
    dom.transformRotateInput.value = "";
    dom.transformXInput.disabled = false;
    dom.transformYInput.disabled = false;
    dom.transformWInput.disabled = true;
    dom.transformHInput.disabled = true;
    dom.transformRotateInput.disabled = true;
  } else {
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
  }

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
  dom.activeToolLabel.textContent = getToolLabel(state.tool);

  dom.docWidth.value = String(state.doc.width);
  dom.docHeight.value = String(state.doc.height);

  const legacySnapshot = state.objects.map(toLegacyShape);
  window.localStorage.setItem(STORAGE_LEGACY_KEY, JSON.stringify(legacySnapshot));
  window.localStorage.setItem(STORAGE_CANONICAL_KEY, JSON.stringify({ doc: state.doc, objects: state.objects, activeLayerId: state.activeLayerId }));
  refreshCodePanelIfOpen();
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
  dom.activeToolLabel.textContent = getToolLabel(state.tool);
  updateWorkspaceClasses();
}

function sortAndReindexObjects() {
  state.objects = [...state.objects]
    .sort((a, b) => a.zIndex - b.zIndex)
    .map((shape, index) => ({ ...shape, zIndex: index }));
}

function layerNameExists(name) {
  return state.objects.some((shape) => shape.type === "group" && shape.name === name);
}

function nextLayerName() {
  let index = 1;
  while (layerNameExists(`Layer ${index}`)) {
    index += 1;
  }
  return `Layer ${index}`;
}

function createLayerObject(name = nextLayerName()) {
  return {
    id: nextId("layer"),
    type: "group",
    name,
    zIndex: state.objects.length,
    visible: true,
    locked: false,
    transform: deepClone(DEFAULT_TRANSFORM),
    style: {
      ...deepClone(DEFAULT_STYLE),
      fill: "none"
    },
    geometry: { x: 0, y: 0, width: 0, height: 0 },
    children: []
  };
}

function addLayer({ recordHistory = true } = {}) {
  if (recordHistory) {
    pushHistory();
  }
  const layer = createLayerObject();
  state.objects.push(layer);
  sortAndReindexObjects();
  state.activeLayerId = layer.id;
  state.selection = [layer.id];
  setStatus(`${layer.name} created`);
  render();
  return layer;
}

function getTopLevelLayerForId(id) {
  if (!id) {
    return null;
  }
  for (const top of state.objects) {
    if (top.id === id) {
      return top.type === "group" ? top : null;
    }
    if (top.type === "group" && getObjectById(id, top.children || [], top)) {
      return top;
    }
  }
  return null;
}

function getUsableActiveLayer({ createIfMissing = true } = {}) {
  let layer = state.activeLayerId ? getObjectById(state.activeLayerId)?.object : null;
  if (!layer || layer.type !== "group" || layer.locked || layer.visible === false) {
    layer = state.objects.find((shape) => shape.type === "group" && shape.visible !== false && !shape.locked) || null;
  }
  if (!layer && createIfMissing) {
    layer = createLayerObject();
    state.objects.push(layer);
    sortAndReindexObjects();
  }
  if (layer) {
    state.activeLayerId = layer.id;
  }
  return layer;
}

function addShape(shape, { useActiveLayer = true } = {}) {
  const layer = useActiveLayer ? getUsableActiveLayer({ createIfMissing: true }) : null;
  if (layer && layer.type === "group" && !layer.locked && layer.visible !== false) {
    layer.children ??= [];
    layer.children.push({ ...shape, zIndex: layer.children.length });
    layer.children = layer.children.map((child, index) => ({ ...child, zIndex: index }));
    return;
  }
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

function removeObjectsByIds(shapes, selected) {
  return shapes
    .filter((shape) => !selected.has(shape.id))
    .map((shape) => {
      if (shape.type !== "group" || !Array.isArray(shape.children)) {
        return shape;
      }
      return {
        ...shape,
        children: removeObjectsByIds(shape.children, selected).map((child, index) => ({ ...child, zIndex: index }))
      };
    });
}

function getPrimarySelectedObject() {
  if (state.selection.length === 0) {
    return null;
  }
  const found = getObjectById(state.selection[0]);
  return found ? found.object : null;
}

function getActiveAnchorSelection() {
  const pathId = state.directSelection.pathId;
  const anchorIndex = state.directSelection.anchorIndex;
  const found = pathId ? getObjectById(pathId) : null;
  if (!found || found.object.type !== "path" || !Number.isInteger(anchorIndex)) {
    return null;
  }
  const anchor = found.object.geometry.anchors?.[anchorIndex];
  if (!anchor) {
    return null;
  }
  return {
    path: found.object,
    pathId,
    anchor,
    anchorIndex
  };
}

function applyStyleToSelection(patch) {
  if (state.selection.length === 0) {
    Object.assign(DEFAULT_STYLE, normalizeStyle({ ...DEFAULT_STYLE, ...patch }));
    render();
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

function applyPaintMode(paintKey, mode) {
  const isStroke = paintKey === "stroke";
  const gradientKey = isStroke ? "strokeGradient" : "fillGradient";
  if (mode === "none") {
    applyStyleToSelection({ [paintKey]: "none", [gradientKey]: null });
    return;
  }
  if (mode === "solid") {
    const input = isStroke ? dom.strokeInput : dom.fillInput;
    applyStyleToSelection({ [paintKey]: input.value, [gradientKey]: null });
    return;
  }
  const start = isStroke ? dom.strokeGradientStartInput.value : dom.fillGradientStartInput.value;
  const end = isStroke ? dom.strokeGradientEndInput.value : dom.fillGradientEndInput.value;
  const angle = Number(isStroke ? dom.strokeGradientAngleInput.value : dom.fillGradientAngleInput.value);
  const gradient = defaultGradient(mode, start, end);
  gradient.angle = Number.isFinite(angle) ? angle : 0;
  applyStyleToSelection({ [paintKey]: `url(#${gradient.id})`, [gradientKey]: gradient });
}

function updateGradientStyle(paintKey) {
  const isStroke = paintKey === "stroke";
  const gradientKey = isStroke ? "strokeGradient" : "fillGradient";
  const mode = isStroke ? dom.strokeModeInput.value : dom.fillModeInput.value;
  if (mode !== "linear" && mode !== "radial") {
    return;
  }
  const start = isStroke ? dom.strokeGradientStartInput.value : dom.fillGradientStartInput.value;
  const end = isStroke ? dom.strokeGradientEndInput.value : dom.fillGradientEndInput.value;
  const angle = Number(isStroke ? dom.strokeGradientAngleInput.value : dom.fillGradientAngleInput.value);
  const current = getPrimarySelectedObject()?.style?.[gradientKey];
  const gradient = normalizeGradient(current, start, end) || defaultGradient(mode, start, end);
  gradient.type = mode;
  gradient.angle = Number.isFinite(angle) ? angle : 0;
  gradient.stops[0].color = start;
  gradient.stops[gradient.stops.length - 1].color = end;
  applyStyleToSelection({ [paintKey]: `url(#${gradient.id})`, [gradientKey]: gradient });
}

function commitStrokeDashEdit() {
  const value = dom.strokeDashInput.value.trim();
  applyStyleToSelection({ strokeDasharray: value.toLowerCase() === "none" ? "" : value });
}

function applyTransformInputsToSelection() {
  const activeAnchor = getActiveAnchorSelection();
  if (activeAnchor && (state.tool === TOOLS.DIRECT || state.tool === TOOLS.PEN)) {
    const nextX = Number(dom.transformXInput.value);
    const nextY = Number(dom.transformYInput.value);
    if (!Number.isFinite(nextX) && !Number.isFinite(nextY)) {
      return;
    }

    pushHistory();
    const anchor = activeAnchor.anchor;
    const dx = Number.isFinite(nextX) ? nextX - anchor.x : 0;
    const dy = Number.isFinite(nextY) ? nextY - anchor.y : 0;
    anchor.x += dx;
    anchor.y += dy;
    if (anchor.inHandle) {
      anchor.inHandle.x += dx;
      anchor.inHandle.y += dy;
    }
    if (anchor.outHandle) {
      anchor.outHandle.x += dx;
      anchor.outHandle.y += dy;
    }
    setStatus(`Anchor ${activeAnchor.anchorIndex + 1}: ${round(anchor.x, 2)}, ${round(anchor.y, 2)}`);
    render();
    return;
  }

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
  if (Array.isArray(parent.matrix) || Array.isArray(child.matrix)) {
    const matrix = matrixMultiply(transformToMatrix(parent), transformToMatrix(child));
    return matrixIsIdentity(matrix) ? deepClone(DEFAULT_TRANSFORM) : { ...deepClone(DEFAULT_TRANSFORM), matrix };
  }
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
  } else if (type === TOOLS.LINE) {
    addShape({
      id,
      type: "line",
      name: "Line",
      zIndex,
      visible: true,
      locked: false,
      transform: deepClone(DEFAULT_TRANSFORM),
      style: {
        ...deepClone(DEFAULT_STYLE),
        fill: "none"
      },
      geometry: {
        x1: point.x,
        y1: point.y,
        x2: point.x + 1,
        y2: point.y + 1
      }
    });
  } else if (type === TOOLS.POLYGON) {
    addShape({
      id,
      type: "polygon",
      name: "Polygon",
      zIndex,
      visible: true,
      locked: false,
      transform: deepClone(DEFAULT_TRANSFORM),
      style: deepClone(DEFAULT_STYLE),
      geometry: {
        cx: point.x,
        cy: point.y,
        radius: 1,
        sides: 6
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
  } else if (found.object.type === "line") {
    found.object.geometry.x2 = point.x;
    found.object.geometry.y2 = point.y;
  } else if (found.object.type === "polygon") {
    found.object.geometry.radius = Math.max(1, Math.hypot(point.x - start.x, point.y - start.y));
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

function createTextObject(point) {
  const text = window.prompt("Text", "Type");
  if (text === null) {
    return;
  }

  pushHistory();
  const id = nextId("text");
  addShape({
    id,
    type: "text",
    name: text.trim() ? `Text: ${text.trim().slice(0, 18)}` : "Text",
    zIndex: state.objects.length,
    visible: true,
    locked: false,
    transform: deepClone(DEFAULT_TRANSFORM),
    style: {
      ...deepClone(DEFAULT_STYLE),
      fill: "#111111",
      stroke: "none",
      strokeWidth: 0
    },
    geometry: {
      x: point.x,
      y: point.y,
      text: text || "Text",
      fontSize: 48,
      fontFamily: "Inter, Arial, sans-serif"
    }
  });
  state.selection = [id];
  setStatus("Text created");
  render();
}

function sampleStyleFromObject(id) {
  const found = id ? getObjectById(id) : null;
  if (!found) {
    setStatus("Eyedropper: click an object to sample");
    return;
  }
  const sampled = normalizeStyle(found.object.style);
  if (state.selection.length > 0 && !state.selection.includes(found.object.id)) {
    applyStyleToSelection(sampled);
    setStatus("Sampled appearance applied to selection");
  } else {
    DEFAULT_STYLE.fill = sampled.fill;
    DEFAULT_STYLE.stroke = sampled.stroke;
    DEFAULT_STYLE.strokeWidth = sampled.strokeWidth;
    DEFAULT_STYLE.strokeJoin = sampled.strokeJoin;
    DEFAULT_STYLE.strokeCap = sampled.strokeCap;
    DEFAULT_STYLE.strokeDasharray = sampled.strokeDasharray;
    DEFAULT_STYLE.strokeMiterlimit = sampled.strokeMiterlimit;
    DEFAULT_STYLE.fillOpacity = sampled.fillOpacity;
    DEFAULT_STYLE.strokeOpacity = sampled.strokeOpacity;
    DEFAULT_STYLE.fillGradient = sampled.fillGradient ? deepClone(sampled.fillGradient) : null;
    DEFAULT_STYLE.strokeGradient = sampled.strokeGradient ? deepClone(sampled.strokeGradient) : null;
    DEFAULT_STYLE.opacity = sampled.opacity;
    setStatus("Default appearance sampled");
    render();
  }
}

function beginPan(event) {
  state.interaction.mode = "panning";
  state.interaction.pointerId = event.pointerId;
  state.interaction.start = {
    x: event.clientX,
    y: event.clientY,
    panX: state.view.panX,
    panY: state.view.panY
  };
  updateWorkspaceClasses();
}

function continuePan(event) {
  if (state.interaction.mode !== "panning" || !state.interaction.start) {
    return;
  }
  state.view.panX = state.interaction.start.panX + event.clientX - state.interaction.start.x;
  state.view.panY = state.interaction.start.panY + event.clientY - state.interaction.start.y;
  state.view.fitted = false;
  applyViewTransform();
}

function finishPan() {
  if (state.interaction.mode !== "panning") {
    return;
  }
  state.interaction.mode = null;
  state.interaction.pointerId = null;
  state.interaction.start = null;
  updateWorkspaceClasses();
}

function getCurrentDrawingStyle({ fill = "none" } = {}) {
  return normalizeStyle({
    ...DEFAULT_STYLE,
    fill,
    fillGradient: fill === "none" ? null : DEFAULT_STYLE.fillGradient
  });
}

function simplifyPoints(points, tolerance) {
  if (!Array.isArray(points) || points.length <= 2 || tolerance <= 0) {
    return points || [];
  }

  const perpendicularDistance = (point, start, end) => {
    const dx = end.x - start.x;
    const dy = end.y - start.y;
    if (dx === 0 && dy === 0) {
      return Math.hypot(point.x - start.x, point.y - start.y);
    }
    return Math.abs(dy * point.x - dx * point.y + end.x * start.y - end.y * start.x) / Math.hypot(dx, dy);
  };

  const simplifyRange = (startIndex, endIndex, out) => {
    let maxDistance = 0;
    let maxIndex = startIndex;
    for (let i = startIndex + 1; i < endIndex; i += 1) {
      const distance = perpendicularDistance(points[i], points[startIndex], points[endIndex]);
      if (distance > maxDistance) {
        maxDistance = distance;
        maxIndex = i;
      }
    }
    if (maxDistance > tolerance) {
      simplifyRange(startIndex, maxIndex, out);
      out.pop();
      simplifyRange(maxIndex, endIndex, out);
    } else {
      out.push(points[startIndex], points[endIndex]);
    }
  };

  const simplified = [];
  simplifyRange(0, points.length - 1, simplified);
  return simplified.filter((point, index, arr) => index === 0 || point.x !== arr[index - 1].x || point.y !== arr[index - 1].y);
}

function beginPencilStroke(point, pointerId) {
  pushHistory();
  const id = nextId("pencil");
  addShape({
    id,
    type: "path",
    name: "Pencil Path",
    zIndex: state.objects.length,
    visible: true,
    locked: false,
    transform: deepClone(DEFAULT_TRANSFORM),
    style: getCurrentDrawingStyle({ fill: "none" }),
    geometry: {
      anchors: [{ x: point.x, y: point.y, inHandle: null, outHandle: null }],
      closed: false
    }
  });
  state.selection = [id];
  state.activePathId = null;
  state.directSelection.pathId = id;
  state.directSelection.anchorIndex = 0;
  state.interaction.mode = "pencil-drawing";
  state.interaction.pointerId = pointerId;
  state.interaction.draftId = id;
  state.interaction.pencilPoints = [point];
  setStatus("Drawing freehand path");
  render();
}

function continuePencilStroke(point) {
  if (state.interaction.mode !== "pencil-drawing" || !state.interaction.draftId) {
    return;
  }
  const points = state.interaction.pencilPoints || [];
  const previous = points[points.length - 1];
  if (previous && Math.hypot(point.x - previous.x, point.y - previous.y) < 2) {
    return;
  }
  points.push(point);
  state.interaction.pencilPoints = points;
  const found = getObjectById(state.interaction.draftId);
  if (!found || found.object.type !== "path") {
    return;
  }
  found.object.geometry.anchors = points.map((entry) => ({
    x: entry.x,
    y: entry.y,
    inHandle: null,
    outHandle: null
  }));
  render();
}

function finishPencilStroke() {
  if (state.interaction.mode !== "pencil-drawing") {
    return;
  }
  const id = state.interaction.draftId;
  const found = id ? getObjectById(id) : null;
  if (found && found.object.type === "path") {
    const smoothing = clamp(Number(dom.pencilSmoothingInput.value) || 0, 0, 16);
    const simplified = simplifyPoints(state.interaction.pencilPoints || [], smoothing);
    found.object.geometry.anchors = simplified.map((point) => ({
      x: point.x,
      y: point.y,
      inHandle: null,
      outHandle: null
    }));
    if (found.object.geometry.anchors.length < 2) {
      state.objects = removeObjectsByIds(state.objects, new Set([id]));
      state.selection = [];
      state.history.undo.pop();
      updateHistoryButtons();
    } else {
      state.selection = [id];
      state.directSelection.pathId = id;
      state.directSelection.anchorIndex = 0;
    }
  }
  state.interaction.mode = null;
  state.interaction.pointerId = null;
  state.interaction.draftId = null;
  state.interaction.pencilPoints = null;
  setStatus("Pencil path created");
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
    state.interaction.penHistoryPathId = id;
    state.selection = [id];
    state.directSelection.pathId = id;
    state.directSelection.anchorIndex = 0;
    setStatus("Pen: click to add points");
    render();
    return { pathId: id, anchorIndex: 0, created: true };
  }

  const found = getObjectById(state.activePathId);
  if (!found || found.object.type !== "path") {
    state.activePathId = null;
    state.interaction.penHistoryPathId = null;
    return null;
  }

  if (state.interaction.penHistoryPathId !== found.object.id) {
    pushHistory();
    state.interaction.penHistoryPathId = found.object.id;
  }

  const anchors = found.object.geometry.anchors;
  if (anchors.length >= 3) {
    const first = anchors[0];
    const dist = Math.hypot(first.x - point.x, first.y - point.y);
    if (dist < 10) {
      found.object.geometry.closed = true;
      state.activePathId = null;
      state.interaction.penHistoryPathId = null;
      state.interaction.livePreviewPoint = null;
      state.directSelection.pathId = found.object.id;
      state.directSelection.anchorIndex = 0;
      setStatus("Path closed");
      render();
      return { pathId: found.object.id, anchorIndex: 0, closed: true };
    }
  }

  anchors.push({
    x: point.x,
    y: point.y,
    inHandle: null,
    outHandle: null
  });
  state.directSelection.pathId = found.object.id;
  state.directSelection.anchorIndex = anchors.length - 1;

  render();
  return { pathId: found.object.id, anchorIndex: anchors.length - 1, created: false };
}

function continuePenDrag(point, event) {
  if (state.interaction.mode !== "pen-dragging") {
    return;
  }
  const pathId = state.interaction.penDragPathId;
  const anchorIndex = state.interaction.penDragAnchorIndex;
  const found = pathId ? getObjectById(pathId) : null;
  if (!found || found.object.type !== "path" || !Number.isInteger(anchorIndex)) {
    return;
  }

  const anchor = found.object.geometry.anchors[anchorIndex];
  const startAnchor = state.interaction.dragAnchorSnapshot;
  const startLocal = state.interaction.dragStartLocal;
  if (!anchor || !startAnchor || !startLocal) {
    return;
  }

  const local = localPointForPath(found.object, point);
  const dist = Math.hypot(local.x - startLocal.x, local.y - startLocal.y);
  if (dist < 2) {
    return;
  }

  const dx = local.x - startLocal.x;
  const dy = local.y - startLocal.y;
  anchor.outHandle = { x: startAnchor.x + dx, y: startAnchor.y + dy };
  if (!event.altKey) {
    anchor.inHandle = {
      x: startAnchor.x - dx,
      y: startAnchor.y - dy
    };
  }
}

function finishPenDrag() {
  if (state.interaction.mode !== "pen-dragging") {
    return;
  }
  state.interaction.mode = null;
  state.interaction.pointerId = null;
  state.interaction.start = null;
  state.interaction.penDragPathId = null;
  state.interaction.penDragAnchorIndex = null;
  state.interaction.dragStartLocal = null;
  state.interaction.dragAnchorSnapshot = null;
  setStatus(state.activePathId ? "Pen: click to add points" : "Ready");
  render();
}

function finishActivePath() {
  if (!state.activePathId) {
    return;
  }
  state.activePathId = null;
  state.interaction.penHistoryPathId = null;
  state.interaction.livePreviewPoint = null;
  setStatus("Path finalized");
  render();
}

function localPointForPath(path, point) {
  return applyInverseTransform(point, path.transform);
}

function beginAnchorDrag(pathId, anchorIndex, point, pointerId) {
  const foundPath = pathId ? getObjectById(pathId) : null;
  if (
    !foundPath ||
    foundPath.object.type !== "path" ||
    !Number.isInteger(anchorIndex) ||
    anchorIndex < 0 ||
    anchorIndex >= (foundPath.object.geometry.anchors || []).length
  ) {
    return false;
  }

  pushHistory();
  const anchor = foundPath.object.geometry.anchors[anchorIndex];
  state.selection = [pathId];
  state.activePathId = pathId;
  state.directSelection.pathId = pathId;
  state.directSelection.anchorIndex = anchorIndex;
  state.interaction.mode = "anchor-moving";
  state.interaction.pointerId = pointerId;
  state.interaction.start = point;
  state.interaction.dragStartLocal = localPointForPath(foundPath.object, point);
  state.interaction.dragAnchorSnapshot = deepClone(anchor);
  state.interaction.dragHandleSnapshot = null;
  state.interaction.activeHandle = null;
  setStatus(`Anchor ${anchorIndex + 1}: ${round(anchor.x, 2)}, ${round(anchor.y, 2)}`);
  return true;
}

function beginHandleDrag(pathId, anchorIndex, handleKind, point, pointerId) {
  const foundPath = pathId ? getObjectById(pathId) : null;
  if (
    !foundPath ||
    foundPath.object.type !== "path" ||
    (handleKind !== "in" && handleKind !== "out") ||
    !Number.isInteger(anchorIndex) ||
    anchorIndex < 0 ||
    anchorIndex >= (foundPath.object.geometry.anchors || []).length
  ) {
    return false;
  }

  pushHistory();
  const anchor = foundPath.object.geometry.anchors[anchorIndex];
  const key = handleKind === "in" ? "inHandle" : "outHandle";
  const startHandle = anchor[key] || { x: anchor.x, y: anchor.y };
  state.selection = [pathId];
  state.activePathId = pathId;
  state.directSelection.pathId = pathId;
  state.directSelection.anchorIndex = anchorIndex;
  state.interaction.mode = "handle-moving";
  state.interaction.pointerId = pointerId;
  state.interaction.start = point;
  state.interaction.handleKind = handleKind;
  state.interaction.dragStartLocal = localPointForPath(foundPath.object, point);
  state.interaction.dragAnchorSnapshot = deepClone(anchor);
  state.interaction.dragHandleSnapshot = deepClone(startHandle);
  state.interaction.activeHandle = { pathId, anchorIndex, kind: handleKind };
  setStatus(`Editing ${handleKind} handle`);
  return true;
}

function continueAnchorDrag(point) {
  const pathId = state.directSelection.pathId;
  const anchorIndex = state.directSelection.anchorIndex;
  const found = pathId ? getObjectById(pathId) : null;
  const startAnchor = state.interaction.dragAnchorSnapshot;
  const startLocal = state.interaction.dragStartLocal;
  if (!found || found.object.type !== "path" || !startAnchor || !startLocal || !Number.isInteger(anchorIndex)) {
    return;
  }

  const anchor = found.object.geometry.anchors[anchorIndex];
  if (!anchor) {
    return;
  }

  const local = localPointForPath(found.object, point);
  const dx = local.x - startLocal.x;
  const dy = local.y - startLocal.y;
  anchor.x = startAnchor.x + dx;
  anchor.y = startAnchor.y + dy;
  anchor.inHandle = startAnchor.inHandle
    ? { x: startAnchor.inHandle.x + dx, y: startAnchor.inHandle.y + dy }
    : null;
  anchor.outHandle = startAnchor.outHandle
    ? { x: startAnchor.outHandle.x + dx, y: startAnchor.outHandle.y + dy }
    : null;
  setStatus(`Anchor ${anchorIndex + 1}: ${round(anchor.x, 2)}, ${round(anchor.y, 2)}`);
}

function continueHandleDrag(point, event) {
  const pathId = state.directSelection.pathId;
  const anchorIndex = state.directSelection.anchorIndex;
  const found = pathId ? getObjectById(pathId) : null;
  const startAnchor = state.interaction.dragAnchorSnapshot;
  const startHandle = state.interaction.dragHandleSnapshot;
  const startLocal = state.interaction.dragStartLocal;
  if (!found || found.object.type !== "path" || !startAnchor || !startHandle || !startLocal || !Number.isInteger(anchorIndex)) {
    return;
  }

  const anchor = found.object.geometry.anchors[anchorIndex];
  if (!anchor) {
    return;
  }

  const key = state.interaction.handleKind === "in" ? "inHandle" : "outHandle";
  const oppositeKey = key === "inHandle" ? "outHandle" : "inHandle";
  const local = localPointForPath(found.object, point);
  const dx = local.x - startLocal.x;
  const dy = local.y - startLocal.y;
  const nextHandle = {
    x: startHandle.x + dx,
    y: startHandle.y + dy
  };
  anchor[key] = nextHandle;

  if (!event.altKey) {
    anchor[oppositeKey] = {
      x: anchor.x - (nextHandle.x - anchor.x),
      y: anchor.y - (nextHandle.y - anchor.y)
    };
  }
  setStatus(`${state.interaction.handleKind} handle: ${round(nextHandle.x, 2)}, ${round(nextHandle.y, 2)}`);
}

function resetPathDragState() {
  state.interaction.mode = null;
  state.interaction.pointerId = null;
  state.interaction.start = null;
  state.interaction.handleKind = null;
  state.interaction.dragStartLocal = null;
  state.interaction.dragAnchorSnapshot = null;
  state.interaction.dragHandleSnapshot = null;
  state.interaction.activeHandle = null;
}

function toggleAnchorSmooth(pathId, anchorIndex) {
  const found = pathId ? getObjectById(pathId) : null;
  if (!found || found.object.type !== "path") {
    return;
  }
  const anchor = found.object.geometry.anchors?.[anchorIndex];
  if (!anchor) {
    return;
  }

  pushHistory();
  const hasHandles = Boolean(anchor.inHandle || anchor.outHandle);
  if (hasHandles) {
    anchor.inHandle = null;
    anchor.outHandle = null;
    setStatus("Converted anchor to corner");
  } else {
    const anchors = found.object.geometry.anchors;
    const prev = anchors[anchorIndex - 1] || anchors[anchorIndex + 1] || { x: anchor.x - 32, y: anchor.y };
    const next = anchors[anchorIndex + 1] || anchors[anchorIndex - 1] || { x: anchor.x + 32, y: anchor.y };
    const vx = next.x - prev.x;
    const vy = next.y - prev.y;
    const length = Math.max(1, Math.hypot(vx, vy));
    const handleLength = Math.min(80, Math.max(24, length / 4));
    const ux = vx / length;
    const uy = vy / length;
    anchor.inHandle = {
      x: anchor.x - ux * handleLength,
      y: anchor.y - uy * handleLength
    };
    anchor.outHandle = {
      x: anchor.x + ux * handleLength,
      y: anchor.y + uy * handleLength
    };
    setStatus("Converted anchor to smooth");
  }
  state.selection = [pathId];
  state.directSelection.pathId = pathId;
  state.directSelection.anchorIndex = anchorIndex;
  render();
}

function continueOpenPathFromEndpoint(pathId, anchorIndex) {
  const found = pathId ? getObjectById(pathId) : null;
  if (!found || found.object.type !== "path" || found.object.geometry.closed) {
    return false;
  }
  const anchors = found.object.geometry.anchors || [];
  if (anchors.length === 0 || (anchorIndex !== 0 && anchorIndex !== anchors.length - 1)) {
    return false;
  }

  if (anchorIndex === 0) {
    found.object.geometry.anchors = [...anchors].reverse().map((anchor) => ({
      ...anchor,
      inHandle: anchor.outHandle ? { ...anchor.outHandle } : null,
      outHandle: anchor.inHandle ? { ...anchor.inHandle } : null
    }));
  }
  state.activePathId = pathId;
  state.interaction.penHistoryPathId = null;
  state.selection = [pathId];
  state.directSelection.pathId = pathId;
  state.directSelection.anchorIndex = found.object.geometry.anchors.length - 1;
  setStatus("Continuing open path");
  render();
  return true;
}

function removeLastActivePathAnchor() {
  if (!state.activePathId) {
    return false;
  }
  const found = getObjectById(state.activePathId);
  if (!found || found.object.type !== "path") {
    state.activePathId = null;
    state.interaction.penHistoryPathId = null;
    return false;
  }
  const anchors = found.object.geometry.anchors || [];
  pushHistory();
  anchors.pop();
  if (anchors.length === 0) {
    state.objects = removeObjectsByIds(state.objects, new Set([state.activePathId]));
    state.selection = [];
    state.activePathId = null;
    state.directSelection.pathId = null;
    state.directSelection.anchorIndex = null;
  } else {
    state.directSelection.pathId = found.object.id;
    state.directSelection.anchorIndex = anchors.length - 1;
  }
  sortAndReindexObjects();
  setStatus("Removed last pen anchor");
  render();
  return true;
}

function updatePenHoverAnchor(point) {
  if (state.tool !== TOOLS.PEN || !state.activePathId) {
    if (state.interaction.hoverAnchor) {
      state.interaction.hoverAnchor = null;
      render();
    }
    return;
  }
  const found = getObjectById(state.activePathId);
  if (!found || found.object.type !== "path") {
    return;
  }
  const anchors = found.object.geometry.anchors || [];
  let nextHover = null;
  anchors.forEach((anchor, index) => {
    const world = applyTransformToPoint(anchor, found.object.transform);
    if (Math.hypot(world.x - point.x, world.y - point.y) <= 10) {
      nextHover = { pathId: found.object.id, anchorIndex: index };
    }
  });
  const changed =
    nextHover?.pathId !== state.interaction.hoverAnchor?.pathId ||
    nextHover?.anchorIndex !== state.interaction.hoverAnchor?.anchorIndex;
  if (changed) {
    state.interaction.hoverAnchor = nextHover;
    render();
  }
}

function pointerDownOnCanvas(event) {
  if (event.button !== 0) {
    return;
  }

  dom.canvas.focus();
  event.preventDefault();
  capturePointer(event);

  const point = svgPointFromEvent(event);
  const bezierHandleNode = event.target.closest("[data-handle-path-id]");
  if ((state.tool === TOOLS.DIRECT || state.tool === TOOLS.PEN) && bezierHandleNode) {
    const pathId = bezierHandleNode.dataset.handlePathId;
    const anchorIndex = Number(bezierHandleNode.dataset.handleAnchorIndex);
    const handleKind = bezierHandleNode.dataset.handleKind;
    if (beginHandleDrag(pathId, anchorIndex, handleKind, point, event.pointerId)) {
      render();
      return;
    }
  }

  const anchorNode = event.target.closest("[data-anchor-path-id]");
  if ((state.tool === TOOLS.DIRECT || state.tool === TOOLS.PEN) && anchorNode) {
    const pathId = anchorNode.dataset.anchorPathId;
    const anchorIndex = Number(anchorNode.dataset.anchorIndex);
    const foundPath = pathId ? getObjectById(pathId) : null;
    if (event.altKey && foundPath?.object?.type === "path" && Number.isInteger(anchorIndex)) {
      toggleAnchorSmooth(pathId, anchorIndex);
      return;
    }
    if (state.tool === TOOLS.PEN && continueOpenPathFromEndpoint(pathId, anchorIndex)) {
      return;
    }
    if (beginAnchorDrag(pathId, anchorIndex, point, event.pointerId)) {
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

  if (state.tool === TOOLS.HAND) {
    beginPan(event);
    return;
  }

  if (state.tool === TOOLS.ZOOM) {
    setZoom(state.view.zoom * (event.altKey ? 0.8 : 1.25), event);
    setStatus(`Zoom ${Math.round(state.view.zoom * 100)}%`);
    return;
  }

  if (state.tool === TOOLS.EYEDROPPER) {
    sampleStyleFromObject(objectId);
    return;
  }

  if (state.tool === TOOLS.PENCIL) {
    beginPencilStroke(point, event.pointerId);
    return;
  }

  if (state.tool === TOOLS.TEXT) {
    createTextObject(point);
    return;
  }

  if (state.tool === TOOLS.RECT || state.tool === TOOLS.ELLIPSE || state.tool === TOOLS.LINE || state.tool === TOOLS.POLYGON) {
    beginCreateShape(state.tool, point);
    render();
    return;
  }

  if (state.tool === TOOLS.PEN) {
    const result = beginOrExtendPath(point);
    if (result && !result.closed) {
      const foundPath = getObjectById(result.pathId);
      state.interaction.mode = "pen-dragging";
      state.interaction.pointerId = event.pointerId;
      state.interaction.start = point;
      state.interaction.penDragPathId = result.pathId;
      state.interaction.penDragAnchorIndex = result.anchorIndex;
      state.interaction.dragStartLocal = foundPath ? localPointForPath(foundPath.object, point) : point;
      state.interaction.dragAnchorSnapshot = foundPath
        ? deepClone(foundPath.object.geometry.anchors[result.anchorIndex])
        : null;
    }
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
      const layer = getTopLevelLayerForId(found.object.id);
      if (layer) {
        state.activeLayerId = layer.id;
      }

      if (!event.shiftKey && state.tool === TOOLS.SELECT) {
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
      if (state.tool === TOOLS.DIRECT) {
        setStatus(found.object.type === "path" ? "Direct selection: edit anchors" : "Direct selection");
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
  if (
    state.interaction.pointerId !== null &&
    state.interaction.pointerId !== undefined &&
    event.pointerId !== state.interaction.pointerId
  ) {
    return;
  }

  const point = svgPointFromEvent(event);
  state.interaction.lastCursorPoint = point;

  if (state.interaction.mode === "panning") {
    continuePan(event);
    return;
  }

  if (state.interaction.mode === "pencil-drawing") {
    continuePencilStroke(point);
    return;
  }

  if (state.interaction.mode === "pen-dragging") {
    continuePenDrag(point, event);
    renderSoon();
    return;
  }

  if (state.interaction.mode === "marquee-select") {
    state.interaction.marqueeCurrent = point;
    render();
    return;
  }

  if (state.interaction.mode === "handle-moving") {
    continueHandleDrag(point, event);
    renderSoon();
    return;
  }

  if (state.interaction.mode === "anchor-moving") {
    continueAnchorDrag(point);
    renderSoon();
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
    return;
  }

  if (state.tool === TOOLS.PEN && state.activePathId && state.interaction.mode === null) {
    state.interaction.livePreviewPoint = point;
  } else if (state.interaction.livePreviewPoint) {
    state.interaction.livePreviewPoint = null;
  }

  updatePenHoverAnchor(point);
  if (state.tool === TOOLS.PEN && state.activePathId) {
    renderSoon();
  } else if (state.tool === TOOLS.SELECT || state.tool === TOOLS.DIRECT) {
    setStatus(`Cursor: ${round(point.x, 1)}, ${round(point.y, 1)}`);
  }
}

function pointerUpOnCanvas(event = {}) {
  if (event.pointerId !== undefined) {
    releasePointer(event);
  }

  if (state.interaction.mode === "panning") {
    finishPan();
    return;
  }

  if (state.interaction.mode === "pencil-drawing") {
    finishPencilStroke();
    return;
  }

  if (state.interaction.mode === "pen-dragging") {
    finishPenDrag();
    return;
  }
  if (state.interaction.mode === "marquee-select") {
    finishMarqueeSelection();
    return;
  }

  if (state.interaction.mode === "handle-moving") {
    resetPathDragState();
    setStatus("Ready");
    render();
    return;
  }

  if (state.interaction.mode === "anchor-moving") {
    resetPathDragState();
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

function escapeAttribute(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function safeExportId(value, usedIds) {
  const candidate = String(value || "").trim();
  if (!candidate || !/^[A-Za-z_][\w:.-]*$/.test(candidate) || usedIds.has(candidate)) {
    return "";
  }
  usedIds.add(candidate);
  return candidate;
}

function exportIdentityAttributes(shape, context) {
  const attrs = [];
  const name = sanitizeManualName(shape.name);
  const id = safeExportId(shape.sourceId, context.usedIds);
  if (id) {
    attrs.push(`id="${escapeAttribute(id)}"`);
  }
  if (name) {
    attrs.push(`data-name="${escapeAttribute(name)}"`);
  }
  return attrs.length ? ` ${attrs.join(" ")}` : "";
}

function shapeToSvgString(shape, indent = "  ", context = { usedIds: new Set() }) {
  if (shape.visible === false) {
    return "";
  }

  const style = normalizeStyle(shape.style);
  const styleAttributes = [];
  const computedFill = shape.type === "path" && !shape.geometry.rawD && !shape.geometry.closed ? "none" : gradientPaintValue(style, "fill") || "none";
  const computedStroke = gradientPaintValue(style, "stroke") || "none";
  const computedStrokeWidth = round(clampNumber(style.strokeWidth, 0, 999, 0), 3);
  const computedOpacity = round(clampNumber(style.opacity, 0, 1, 1), 3);
  const computedFillOpacity = round(clampNumber(style.fillOpacity, 0, 1, 1), 3);
  const computedStrokeOpacity = round(clampNumber(style.strokeOpacity, 0, 1, 1), 3);

  if (computedFill === "none") {
    styleAttributes.push(`fill="none"`);
  } else {
    styleAttributes.push(`fill="${escapeAttribute(computedFill)}"`);
  }

  if (computedStroke && computedStroke !== "none" && computedStrokeWidth > 0) {
    styleAttributes.push(`stroke="${escapeAttribute(computedStroke)}"`);
    styleAttributes.push(`stroke-width="${computedStrokeWidth}"`);
    styleAttributes.push(`stroke-linejoin="${style.strokeJoin || "miter"}"`);
    styleAttributes.push(`stroke-linecap="${style.strokeCap || "butt"}"`);
    if (style.strokeDasharray) {
      styleAttributes.push(`stroke-dasharray="${escapeAttribute(style.strokeDasharray)}"`);
    }
    if ((style.strokeJoin || "miter") === "miter") {
      styleAttributes.push(`stroke-miterlimit="${round(style.strokeMiterlimit || 4)}"`);
    }
  } else {
    styleAttributes.push(`stroke="none"`);
  }

  if (computedOpacity !== 1) {
    styleAttributes.push(`opacity="${computedOpacity}"`);
  }
  if (computedFillOpacity !== 1 && computedFill !== "none") {
    styleAttributes.push(`fill-opacity="${computedFillOpacity}"`);
  }
  if (computedStrokeOpacity !== 1 && computedStroke && computedStroke !== "none") {
    styleAttributes.push(`stroke-opacity="${computedStrokeOpacity}"`);
  }

  const transform = transformToString(shape.transform);
  const transformAttribute = transform ? ` transform="${transform}"` : "";
  const identityAttributes = exportIdentityAttributes(shape, context);

  if (shape.type === "rect") {
    const g = shape.geometry;
    const rx = g.rx ? ` rx="${round(g.rx)}"` : "";
    const ry = g.ry ? ` ry="${round(g.ry)}"` : "";
    return `${indent}<rect${identityAttributes} x="${round(g.x)}" y="${round(g.y)}" width="${round(g.width)}" height="${round(g.height)}"${rx}${ry} ${styleAttributes.join(" ")}${transformAttribute} />`;
  }

  if (shape.type === "ellipse") {
    const g = shape.geometry;
    return `${indent}<ellipse${identityAttributes} cx="${round(g.cx)}" cy="${round(g.cy)}" rx="${round(g.rx)}" ry="${round(g.ry)}" ${styleAttributes.join(" ")}${transformAttribute} />`;
  }

  if (shape.type === "path") {
    const d = shape.geometry.rawD || buildPathD(shape.geometry.anchors, shape.geometry.closed);
    if (!d) {
      return "";
    }
    return `${indent}<path${identityAttributes} d="${d}" ${styleAttributes.join(" ")}${transformAttribute} />`;
  }

  if (shape.type === "line") {
    const g = shape.geometry;
    return `${indent}<line${identityAttributes} x1="${round(g.x1)}" y1="${round(g.y1)}" x2="${round(g.x2)}" y2="${round(g.y2)}" ${styleAttributes.join(" ")}${transformAttribute} />`;
  }

  if (shape.type === "polygon") {
    const points = polygonPoints(shape.geometry)
      .map((point) => `${round(point.x)},${round(point.y)}`)
      .join(" ");
    return `${indent}<polygon${identityAttributes} points="${points}" ${styleAttributes.join(" ")}${transformAttribute} />`;
  }

  if (shape.type === "text") {
    const g = shape.geometry;
    const escaped = String(g.text || "Text")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");
    return `${indent}<text${identityAttributes} x="${round(g.x)}" y="${round(g.y)}" font-size="${round(g.fontSize)}" font-family="${escapeAttribute(g.fontFamily || "Inter, Arial, sans-serif")}" ${styleAttributes.join(" ")}${transformAttribute}>${escaped}</text>`;
  }

  if (shape.type === "boolean") {
    const op = shape.geometry?.op;
    const aPath = shape.geometry?.aPath;
    const bPath = shape.geometry?.bPath;
    if (!aPath || !bPath) {
      return "";
    }

    if (op === "unite") {
      return `${indent}<path${identityAttributes} d="${aPath} ${bPath}" ${styleAttributes.join(" ")}${transformAttribute} />`;
    }

    if (op === "intersect") {
      const clipId = `clip-${shape.id}`;
      return `${indent}<g${identityAttributes}${transformAttribute}>
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
      return `${indent}<g${identityAttributes}${transformAttribute}>
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
      .map((child) => shapeToSvgString(child, `${indent}  `, context))
      .filter(Boolean)
      .join("\n");
    if (!childLines) {
      return "";
    }
    return `${indent}<g${identityAttributes}${transformAttribute}>\n${childLines}\n${indent}</g>`;
  }

  return "";
}

function exportSvgString() {
  const ordered = [...state.objects].sort((a, b) => a.zIndex - b.zIndex);
  const context = { usedIds: new Set() };
  const lines = ordered.map((shape) => shapeToSvgString(shape, "  ", context)).filter(Boolean);
  const gradientLines = [];
  const serializer = new XMLSerializer();
  for (const gradient of collectStyleGradients().values()) {
    const node = gradientToSvgNode(gradient);
    if (node) {
      gradientLines.push(`    ${serializer.serializeToString(node)}`);
    }
  }
  const defsContent = [state.doc.defs, ...gradientLines].filter(Boolean).join("\n");
  return [
    "<?xml version=\"1.0\" encoding=\"UTF-8\"?>",
    `<svg xmlns=\"http://www.w3.org/2000/svg\" width=\"${round(state.doc.width)}\" height=\"${round(state.doc.height)}\" viewBox=\"0 0 ${round(state.doc.width)} ${round(state.doc.height)}\">`,
    defsContent ? `  <defs>\n${defsContent}\n  </defs>` : "",
    ...lines,
    "</svg>"
  ].filter(Boolean).join("\n");
}

function getToolLabel(tool) {
  const labels = {
    [TOOLS.SELECT]: "Selection Tool",
    [TOOLS.DIRECT]: "Direct Selection Tool",
    [TOOLS.PEN]: "Pen Tool",
    [TOOLS.PENCIL]: "Pencil Tool",
    [TOOLS.RECT]: "Rectangle Tool",
    [TOOLS.ELLIPSE]: "Ellipse Tool",
    [TOOLS.POLYGON]: "Polygon Tool",
    [TOOLS.LINE]: "Line Tool",
    [TOOLS.TEXT]: "Type Tool",
    [TOOLS.EYEDROPPER]: "Eyedropper Tool",
    [TOOLS.HAND]: "Hand Tool",
    [TOOLS.ZOOM]: "Zoom Tool"
  };
  return labels[tool] || "Tool";
}

function refreshCodePanelIfOpen() {
  if (!dom.codeDrawer.classList.contains("is-open")) {
    return;
  }
  dom.svgCodeInput.value = exportSvgString();
  dom.svgValidationMessage.textContent = "Valid SVG";
  dom.svgValidationMessage.classList.remove("is-error");
}

function validateSvgSource(source) {
  const parser = new DOMParser();
  const doc = parser.parseFromString(source, "image/svg+xml");
  const parseError = doc.querySelector("parsererror");
  const svg = doc.documentElement?.tagName?.toLowerCase() === "svg" ? doc.documentElement : null;
  if (parseError || !svg) {
    return {
      ok: false,
      message: parseError?.textContent?.trim().split("\n")[0] || "Input must be a valid SVG element"
    };
  }
  return { ok: true, svg };
}

function numberAttr(node, name, fallback = 0) {
  const value = Number(node.getAttribute(name));
  return Number.isFinite(value) ? value : fallback;
}

function numberLengthAttr(node, name, fallback = 0) {
  const raw = String(node.getAttribute(name) || "").trim();
  const match = raw.match(/^[-+]?(?:\d*\.\d+|\d+\.?)(?:e[-+]?\d+)?/i);
  const value = match ? Number(match[0]) : NaN;
  return Number.isFinite(value) ? value : fallback;
}

function parseSvgViewBox(svg) {
  const values = String(svg.getAttribute("viewBox") || "")
    .trim()
    .split(/[\s,]+/)
    .map(Number);
  if (values.length === 4 && values.every(Number.isFinite) && values[2] > 0 && values[3] > 0) {
    return { x: values[0], y: values[1], width: values[2], height: values[3] };
  }
  return null;
}

function svgViewportInfo(svg) {
  const viewBox = parseSvgViewBox(svg);
  const fallbackWidth = viewBox?.width || state.doc.width;
  const fallbackHeight = viewBox?.height || state.doc.height;
  const width = clamp(numberLengthAttr(svg, "width", fallbackWidth), 64, 10000);
  const height = clamp(numberLengthAttr(svg, "height", fallbackHeight), 64, 10000);
  return { width, height, viewBox };
}

function viewBoxToViewportMatrix(svg, viewport) {
  const viewBox = viewport.viewBox;
  if (!viewBox) {
    return matrixIdentity();
  }

  const preserve = String(svg.getAttribute("preserveAspectRatio") || "xMidYMid meet").trim();
  if (preserve === "none") {
    return matrixMultiply(
      matrixScale(viewport.width / viewBox.width, viewport.height / viewBox.height),
      matrixTranslate(-viewBox.x, -viewBox.y)
    );
  }

  const [align = "xMidYMid", meetOrSlice = "meet"] = preserve.split(/\s+/);
  const scaleX = viewport.width / viewBox.width;
  const scaleY = viewport.height / viewBox.height;
  const scale = meetOrSlice === "slice" ? Math.max(scaleX, scaleY) : Math.min(scaleX, scaleY);
  let translateX = 0;
  let translateY = 0;

  if (/xMid/.test(align)) {
    translateX = (viewport.width - viewBox.width * scale) / 2;
  } else if (/xMax/.test(align)) {
    translateX = viewport.width - viewBox.width * scale;
  }
  if (/YMid/.test(align)) {
    translateY = (viewport.height - viewBox.height * scale) / 2;
  } else if (/YMax/.test(align)) {
    translateY = viewport.height - viewBox.height * scale;
  }

  return matrixMultiply(matrixTranslate(translateX, translateY), matrixMultiply(matrixScale(scale), matrixTranslate(-viewBox.x, -viewBox.y)));
}

function svgStyleMap(node) {
  const styleText = node.getAttribute("style") || "";
  return new Map(
    styleText
      .split(";")
      .map((entry) => entry.split(":").map((part) => part.trim()))
      .filter((entry) => entry.length === 2 && entry[0])
  );
}

function styleObjectFromMap(map) {
  const result = {};
  for (const [key, value] of map.entries()) {
    result[key] = value;
  }
  return result;
}

function styleMapFromText(text) {
  return new Map(
    String(text || "")
      .split(";")
      .map((entry) => entry.split(":").map((part) => part.trim()))
      .filter((entry) => entry.length === 2 && entry[0])
  );
}

function svgPresentationValue(node, name, fallback = "") {
  const styleMap = svgStyleMap(node);
  return node.getAttribute(name) || styleMap.get(name) || fallback;
}

function isSvgNodeHidden(node) {
  const display = svgPresentationValue(node, "display", "").toLowerCase();
  const visibility = svgPresentationValue(node, "visibility", "").toLowerCase();
  const opacity = Number(svgPresentationValue(node, "opacity", "1"));
  return display === "none" || visibility === "hidden" || opacity === 0;
}

function isSvgNodeLocked(node) {
  const lockValues = [
    node.getAttribute("data-locked"),
    node.getAttribute("data-lock"),
    node.getAttribute("locked"),
    node.getAttribute("inkscape:locked"),
    node.getAttribute("sodipodi:insensitive")
  ]
    .filter(Boolean)
    .map((value) => String(value).toLowerCase());
  const className = node.getAttribute("class") || "";
  return lockValues.some((value) => value === "true" || value === "1" || value === "locked") || /\blocked\b/i.test(className);
}

function decodeNameValue(value) {
  const raw = String(value || "").trim();
  if (!raw) {
    return "";
  }
  try {
    return decodeURIComponent(raw);
  } catch (error) {
    return raw;
  }
}

function cleanImportedName(value, { allowGeneratedId = false } = {}) {
  let name = decodeNameValue(value)
    .replace(/[_]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  if (!name || name === "." || name === "-") {
    return "";
  }

  const generatedIdPattern = /^(?:path|rect|rectangle|ellipse|circle|g|group|layer|text|line|poly|polygon|polyline|shape|object)[\s_-]*\d+$/i;
  if (!allowGeneratedId && generatedIdPattern.test(name)) {
    return "";
  }

  return name;
}

function sanitizeManualName(value) {
  return cleanImportedName(value, { allowGeneratedId: true });
}

function commitObjectNameEdit() {
  const primary = getPrimarySelectedObject();
  const nextName = sanitizeManualName(dom.objectNameInput.value);
  if (!primary || !nextName || primary.name === nextName) {
    render();
    return;
  }
  pushHistory();
  primary.name = nextName;
  setStatus(`Renamed ${nextName}`);
  render();
}

function childText(node, tagName) {
  const child = [...node.children].find((candidate) => candidate.tagName?.toLowerCase() === tagName);
  return child?.textContent || "";
}

function fallbackImportedName(tag, counters, { layer = false } = {}) {
  const labels = {
    g: layer ? "Layer" : "Group",
    path: "Path",
    rect: "Rectangle",
    ellipse: "Ellipse",
    circle: "Ellipse",
    line: "Line",
    polygon: "Polygon",
    text: "Text"
  };
  const label = labels[tag] || "Object";
  counters[label] = (counters[label] || 0) + 1;
  return `${label} ${counters[label]}`;
}

function isLayerLikeGroup(node) {
  const groupMode = node.getAttribute("inkscape:groupmode") || "";
  const id = cleanImportedName(node.getAttribute("id"), { allowGeneratedId: true });
  const dataName = cleanImportedName(node.getAttribute("data-name"), { allowGeneratedId: true });
  const label = cleanImportedName(node.getAttribute("inkscape:label"), { allowGeneratedId: true });
  return (
    groupMode.toLowerCase() === "layer" ||
    /^(?:layer|Layer)\s*\d*$/i.test(id) ||
    /^(?:layer|Layer)\s*\d*$/i.test(dataName) ||
    /^(?:layer|Layer)\s*\d*$/i.test(label)
  );
}

function makeUniqueImportedName(name, counters) {
  const base = sanitizeManualName(name);
  if (!base) {
    return "";
  }
  const key = base.toLowerCase();
  counters.__names ??= {};
  counters.__names[key] = (counters.__names[key] || 0) + 1;
  return counters.__names[key] === 1 ? base : `${base} ${counters.__names[key]}`;
}

function getSvgNodeName(node, fallbackName, counters, kind = "object") {
  const layerLike = kind === "group" && isLayerLikeGroup(node);
  const groupCandidates = [
    { value: node.getAttribute("inkscape:label"), allowGeneratedId: true },
    { value: node.getAttribute("data-name"), allowGeneratedId: true },
    { value: node.getAttribute("aria-label"), allowGeneratedId: true },
    { value: childText(node, "title"), allowGeneratedId: true },
    { value: childText(node, "desc"), allowGeneratedId: true },
    { value: node.getAttribute("id"), allowGeneratedId: layerLike }
  ];
  const objectCandidates = [
    { value: node.getAttribute("data-name"), allowGeneratedId: true },
    { value: node.getAttribute("aria-label"), allowGeneratedId: true },
    { value: childText(node, "title"), allowGeneratedId: true },
    { value: childText(node, "desc"), allowGeneratedId: true },
    { value: node.getAttribute("id"), allowGeneratedId: false }
  ];
  const candidates = kind === "group" ? groupCandidates : objectCandidates;

  for (const candidate of candidates) {
    const name = cleanImportedName(candidate.value, { allowGeneratedId: candidate.allowGeneratedId });
    if (name) {
      return makeUniqueImportedName(name, counters);
    }
  }

  return makeUniqueImportedName(fallbackName, counters) || fallbackName;
}

function sourceIdFromNode(node) {
  const raw = decodeNameValue(node.getAttribute("id")).trim();
  if (!raw || !/^[A-Za-z_][\w:.-]*$/.test(raw)) {
    return null;
  }
  return raw;
}

function cssUnescapeIdentifier(value) {
  try {
    return CSS?.escape ? value : value;
  } catch (error) {
    return value;
  }
}

function parseCssDeclarations(text) {
  return styleObjectFromMap(styleMapFromText(text));
}

function cssSpecificity(selector) {
  if (selector.startsWith("#")) {
    return 100;
  }
  if (selector.startsWith(".")) {
    return 10;
  }
  return 1;
}

function parseEmbeddedSvgCss(svg) {
  const rules = [];
  let order = 0;
  for (const styleNode of [...svg.querySelectorAll("style")]) {
    const css = String(styleNode.textContent || "").replace(/\/\*[\s\S]*?\*\//g, "");
    const rulePattern = /([^{}@]+)\{([^{}]+)\}/g;
    let match;
    while ((match = rulePattern.exec(css))) {
      const declarations = parseCssDeclarations(match[2]);
      for (const selector of match[1].split(",").map((part) => part.trim()).filter(Boolean)) {
        if (/[\s>+~:[\]*]/.test(selector)) {
          continue;
        }
        if (!selector.startsWith(".") && !selector.startsWith("#") && !/^[a-zA-Z][\w-]*$/.test(selector)) {
          continue;
        }
        rules.push({
          selector,
          declarations,
          specificity: cssSpecificity(selector),
          order: order++
        });
      }
    }
  }
  return rules;
}

function extractImportDefs(svg) {
  const defsNodes = [...svg.children].filter((node) => (node.localName || node.tagName || "").toLowerCase() === "defs");
  if (defsNodes.length === 0) {
    return "";
  }
  const serializer = new XMLSerializer();
  return defsNodes.map((defs) => [...defs.children].map((child) => serializer.serializeToString(child)).join("\n")).join("\n");
}

function cssRuleMatchesNode(rule, node) {
  const selector = rule.selector;
  if (selector.startsWith(".")) {
    return [...node.classList].includes(cssUnescapeIdentifier(selector.slice(1)));
  }
  if (selector.startsWith("#")) {
    return node.getAttribute("id") === cssUnescapeIdentifier(selector.slice(1));
  }
  return (node.localName || node.tagName || "").toLowerCase() === selector.toLowerCase();
}

function cssStyleForNode(node, context) {
  const result = {};
  const matches = (context?.cssRules || [])
    .filter((rule) => cssRuleMatchesNode(rule, node))
    .sort((a, b) => a.specificity - b.specificity || a.order - b.order);
  for (const rule of matches) {
    Object.assign(result, rule.declarations);
  }
  return result;
}

function svgStyleFromDeclarations(declarations) {
  const read = (name) => declarations[name];
  const readNumber = (name) => {
    const match = String(read(name) || "").match(/[-+]?(?:\d*\.\d+|\d+\.?)(?:e[-+]?\d+)?/i);
    return match ? Number(match[0]) : NaN;
  };
  const style = {};
  if (read("color")) {
    style.color = read("color");
  }
  if (read("fill")) {
    style.fill = read("fill");
  }
  if (read("stroke")) {
    style.stroke = read("stroke");
  }
  if (read("stroke-width")) {
    style.strokeWidth = readNumber("stroke-width");
  }
  if (read("stroke-linejoin")) {
    style.strokeJoin = read("stroke-linejoin");
  }
  if (read("stroke-linecap")) {
    style.strokeCap = read("stroke-linecap");
  }
  if (read("stroke-dasharray")) {
    style.strokeDasharray = read("stroke-dasharray") === "none" ? "" : read("stroke-dasharray");
  }
  if (read("stroke-miterlimit")) {
    style.strokeMiterlimit = readNumber("stroke-miterlimit");
  }
  if (read("fill-opacity")) {
    style.fillOpacity = readNumber("fill-opacity");
  }
  if (read("stroke-opacity")) {
    style.strokeOpacity = readNumber("stroke-opacity");
  }
  if (read("opacity")) {
    style.opacity = readNumber("opacity");
  }
  return style;
}

function presentationStyleForNode(node) {
  const declarations = {};
  for (const name of [
    "color",
    "fill",
    "stroke",
    "stroke-width",
    "stroke-linejoin",
    "stroke-linecap",
    "stroke-dasharray",
    "stroke-miterlimit",
    "fill-opacity",
    "stroke-opacity",
    "opacity"
  ]) {
    const value = node.getAttribute(name);
    if (value !== null && value !== "") {
      declarations[name] = value;
    }
  }
  return svgStyleFromDeclarations(declarations);
}

function resolveCurrentColor(value, style) {
  if (typeof value === "string" && value.trim().toLowerCase() === "currentcolor") {
    return style.color || SVG_IMPORT_DEFAULT_STYLE.color;
  }
  return value;
}

function warnUnsupportedPaint(style, node) {
  const tag = (node.localName || node.tagName || "element").toLowerCase();
  for (const key of ["fill", "stroke"]) {
    const value = style[key];
    if (typeof value === "string" && /^url\(/i.test(value.trim())) {
      console.warn(`SVG editor: preserving ${key} paint server '${value}' on imported ${tag}`);
    }
  }
}

function mergeInheritedStyle(parentStyle, node, context = null) {
  const inlineStyle = styleObjectFromMap(svgStyleMap(node));
  const next = normalizeStyle({
    ...(parentStyle || SVG_IMPORT_DEFAULT_STYLE),
    ...svgStyleFromDeclarations(cssStyleForNode(node, context)),
    ...presentationStyleForNode(node),
    ...svgStyleFromDeclarations(inlineStyle)
  });
  next.color = inlineStyle.color || node.getAttribute("color") || next.color || parentStyle?.color || SVG_IMPORT_DEFAULT_STYLE.color;
  next.fill = resolveCurrentColor(next.fill, next);
  next.stroke = resolveCurrentColor(next.stroke, next);
  warnUnsupportedPaint(next, node);
  return next;
}

function parseSvgPoints(value) {
  const numbers = String(value || "").match(/[-+]?(?:\d*\.\d+|\d+\.?)(?:e[-+]?\d+)?/gi)?.map(Number) || [];
  const points = [];
  for (let index = 0; index + 1 < numbers.length; index += 2) {
    const x = numbers[index];
    const y = numbers[index + 1];
    if (Number.isFinite(x) && Number.isFinite(y)) {
      points.push({ x, y });
    }
  }
  return points;
}

function transformAnchor(anchor, matrix) {
  const point = matrixApplyPoint(matrix, anchor);
  return {
    x: point.x,
    y: point.y,
    inHandle: anchor.inHandle ? matrixApplyPoint(matrix, anchor.inHandle) : null,
    outHandle: anchor.outHandle ? matrixApplyPoint(matrix, anchor.outHandle) : null
  };
}

function transformForImport(parentMatrix, node) {
  const localMatrix = parseSvgTransformMatrix(node.getAttribute("transform"));
  const matrix = matrixMultiply(parentMatrix || matrixIdentity(), localMatrix);
  return matrixIsIdentity(matrix) ? deepClone(DEFAULT_TRANSFORM) : { ...deepClone(DEFAULT_TRANSFORM), matrix };
}

function transformObjectGeometryForImport(shape, matrix) {
  if (matrixIsIdentity(matrix)) {
    return shape;
  }
  if (shape.type === "path" && !shape.geometry.rawD) {
    shape.geometry.anchors = (shape.geometry.anchors || []).map((anchor) => transformAnchor(anchor, matrix));
    shape.transform = deepClone(DEFAULT_TRANSFORM);
    return shape;
  }
  if (shape.type === "polygon" && Array.isArray(shape.geometry.points)) {
    shape.geometry.points = shape.geometry.points.map((point) => matrixApplyPoint(matrix, point));
    shape.transform = deepClone(DEFAULT_TRANSFORM);
    return shape;
  }
  if (shape.type === "line") {
    const p1 = matrixApplyPoint(matrix, { x: shape.geometry.x1, y: shape.geometry.y1 });
    const p2 = matrixApplyPoint(matrix, { x: shape.geometry.x2, y: shape.geometry.y2 });
    shape.geometry.x1 = p1.x;
    shape.geometry.y1 = p1.y;
    shape.geometry.x2 = p2.x;
    shape.geometry.y2 = p2.y;
    shape.transform = deepClone(DEFAULT_TRANSFORM);
    return shape;
  }
  shape.transform = matrixIsIdentity(matrix) ? deepClone(DEFAULT_TRANSFORM) : { ...deepClone(DEFAULT_TRANSFORM), matrix };
  return shape;
}

function shapeFromSvgElement(node, zIndex, counters, parentMatrix = matrixIdentity(), parentStyle = SVG_IMPORT_DEFAULT_STYLE, context = null) {
  const tag = (node.localName || node.tagName).toLowerCase();
  const fallbackName = fallbackImportedName(tag, counters);
  const importMatrix = matrixMultiply(parentMatrix, parseSvgTransformMatrix(node.getAttribute("transform")));
  const base = {
    id: nextId(tag),
    sourceId: sourceIdFromNode(node),
    name: getSvgNodeName(node, fallbackName, counters, "object"),
    zIndex,
    visible: !isSvgNodeHidden(node),
    locked: isSvgNodeLocked(node),
    transform: deepClone(DEFAULT_TRANSFORM),
    style: mergeInheritedStyle(parentStyle, node, context)
  };

  if (tag === "rect") {
    return transformObjectGeometryForImport({
      ...base,
      type: "rect",
      geometry: {
        x: numberAttr(node, "x"),
        y: numberAttr(node, "y"),
        width: Math.max(1, numberAttr(node, "width", 1)),
        height: Math.max(1, numberAttr(node, "height", 1)),
        rx: numberAttr(node, "rx"),
        ry: numberAttr(node, "ry")
      }
    }, importMatrix);
  }
  if (tag === "ellipse" || tag === "circle") {
    const r = numberAttr(node, "r", 1);
    return transformObjectGeometryForImport({
      ...base,
      type: "ellipse",
      geometry: {
        cx: numberAttr(node, "cx"),
        cy: numberAttr(node, "cy"),
        rx: tag === "circle" ? r : Math.max(1, numberAttr(node, "rx", 1)),
        ry: tag === "circle" ? r : Math.max(1, numberAttr(node, "ry", 1))
      }
    }, importMatrix);
  }
  if (tag === "line") {
    return transformObjectGeometryForImport({
      ...base,
      type: "line",
      style: normalizeStyle({ ...base.style, fill: "none" }),
      geometry: {
        x1: numberAttr(node, "x1"),
        y1: numberAttr(node, "y1"),
        x2: numberAttr(node, "x2", 1),
        y2: numberAttr(node, "y2", 1)
      }
    }, importMatrix);
  }
  if (tag === "polygon") {
    const points = parseSvgPoints(node.getAttribute("points"));
    if (points.length >= 3) {
      const cx = points.reduce((sum, point) => sum + point.x, 0) / points.length;
      const cy = points.reduce((sum, point) => sum + point.y, 0) / points.length;
      const radius = Math.max(...points.map((point) => Math.hypot(point.x - cx, point.y - cy)));
      return transformObjectGeometryForImport({
        ...base,
        type: "polygon",
        geometry: { cx, cy, radius, sides: clamp(points.length, 3, 12), points }
      }, importMatrix);
    }
  }
  if (tag === "polyline") {
    const points = parseSvgPoints(node.getAttribute("points"));
    if (points.length >= 2) {
      return transformObjectGeometryForImport({
        ...base,
        type: "path",
        style: normalizeStyle({ ...base.style, fill: "none" }),
        geometry: {
          anchors: points.map((point) => ({ x: point.x, y: point.y, inHandle: null, outHandle: null })),
          closed: false
        }
      }, importMatrix);
    }
  }
  if (tag === "path") {
    const parsed = parseLegacyPathD(node.getAttribute("d") || "");
    return transformObjectGeometryForImport({
      ...base,
      type: "path",
      geometry: {
        anchors: parsed.anchors,
        closed: parsed.closed,
        rawD: parsed.preserved ? parsed.rawD : ""
      }
    }, importMatrix);
  }
  if (tag === "text") {
    return transformObjectGeometryForImport({
      ...base,
      type: "text",
      geometry: {
        x: numberAttr(node, "x"),
        y: numberAttr(node, "y"),
        text: node.textContent || "Text",
        fontSize: Math.max(4, numberAttr(node, "font-size", 48)),
        fontFamily: node.getAttribute("font-family") || "Inter, Arial, sans-serif"
      }
    }, importMatrix);
  }
  return null;
}

function importChildrenFromSvgNode(node, counters, parentMatrix = matrixIdentity(), parentStyle = SVG_IMPORT_DEFAULT_STYLE, context = null) {
  const ignoredTags = new Set(["defs", "style", "metadata", "script", "title", "desc", "clipPath", "mask", "pattern", "linearGradient", "radialGradient"]);
  const children = [];
  const inheritedStyle = mergeInheritedStyle(parentStyle, node, context);

  for (const child of [...node.children]) {
    const tag = (child.localName || child.tagName)?.toLowerCase();
    if (!tag || ignoredTags.has(tag)) {
      continue;
    }

    if (tag === "g" || tag === "svg") {
      const childMatrix = matrixMultiply(parentMatrix, parseSvgTransformMatrix(child.getAttribute("transform")));
      const childStyle = mergeInheritedStyle(inheritedStyle, child, context);
      const nestedChildren = importChildrenFromSvgNode(child, counters, childMatrix, childStyle, context);
      if (nestedChildren.length === 0) {
        continue;
      }
      const layerLike = isLayerLikeGroup(child);
      const fallbackName = fallbackImportedName("g", counters, { layer: layerLike });
      children.push({
        id: nextId("group"),
        type: "group",
        sourceId: sourceIdFromNode(child),
        name: getSvgNodeName(child, fallbackName, counters, "group"),
        zIndex: children.length,
        visible: !isSvgNodeHidden(child),
        locked: isSvgNodeLocked(child),
        transform: deepClone(DEFAULT_TRANSFORM),
        style: {
          ...childStyle,
          fill: "none"
        },
        geometry: {
          x: 0,
          y: 0,
          width: 0,
          height: 0
        },
        children: nestedChildren.map((shape, index) => ({ ...shape, zIndex: index }))
      });
      continue;
    }

    const shape = shapeFromSvgElement(child, children.length, counters, parentMatrix, inheritedStyle, context);
    if (shape) {
      children.push(shape);
    }
  }

  return children.map((shape, index) => ({ ...shape, zIndex: index }));
}

function parseSvgSourceToDocument(source) {
  const result = validateSvgSource(source);
  if (!result.ok) {
    return result;
  }

  const svg = result.svg;
  const counters = {};
  const viewport = svgViewportInfo(svg);
  const rootMatrix = viewBoxToViewportMatrix(svg, viewport);
  const importContext = {
    cssRules: parseEmbeddedSvgCss(svg),
    defs: extractImportDefs(svg)
  };
  const nextObjects = importChildrenFromSvgNode(svg, counters, rootMatrix, SVG_IMPORT_DEFAULT_STYLE, importContext);
  const nextDoc = {
    width: viewport.width,
    height: viewport.height,
    defs: importContext.defs
  };

  return { ok: true, svg, objects: nextObjects, doc: nextDoc };
}

function applyImportedSvgDocument(parsed, sourceLabel) {
  if (!parsed.ok) {
    dom.svgValidationMessage.textContent = parsed.message;
    dom.svgValidationMessage.classList.add("is-error");
    setStatus(parsed.message);
    return;
  }

  if (parsed.objects.length === 0) {
    const message = "No supported SVG objects found";
    dom.svgValidationMessage.textContent = message;
    dom.svgValidationMessage.classList.add("is-error");
    setStatus(message);
    return;
  }

  pushHistory();
  state.doc.width = parsed.doc.width;
  state.doc.height = parsed.doc.height;
  state.doc.defs = parsed.doc.defs || "";
  state.objects = parsed.objects;
  state.selection = [];
  state.activeLayerId = state.objects.find((shape) => shape.type === "group" && shape.visible !== false && !shape.locked)?.id || null;
  state.activePathId = null;
  state.directSelection.pathId = null;
  state.directSelection.anchorIndex = null;
  dom.svgValidationMessage.textContent = `Imported ${parsed.objects.length} top-level layer(s)`;
  dom.svgValidationMessage.classList.remove("is-error");
  setStatus(`${sourceLabel} imported`);
  render();
}

function applySvgCode() {
  applyImportedSvgDocument(parseSvgSourceToDocument(dom.svgCodeInput.value), "SVG code");
}

function importSvgFile(file) {
  if (!file) {
    return;
  }
  if (file.type && file.type !== "image/svg+xml" && !file.name.toLowerCase().endsWith(".svg")) {
    const message = "Choose a valid .svg file";
    dom.svgValidationMessage.textContent = message;
    dom.svgValidationMessage.classList.add("is-error");
    setStatus(message);
    return;
  }
  const reader = new FileReader();
  reader.addEventListener("load", () => {
    const source = String(reader.result || "");
    applyImportedSvgDocument(parseSvgSourceToDocument(source), file.name || "SVG file");
  });
  reader.addEventListener("error", () => {
    const message = "Unable to read SVG file";
    dom.svgValidationMessage.textContent = message;
    dom.svgValidationMessage.classList.add("is-error");
    setStatus(message);
  });
  reader.readAsText(file);
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
      state.objects = adaptShapeArray(Array.isArray(parsed) ? parsed : parsed.objects);
      if (!Array.isArray(parsed) && parsed.doc) {
        state.doc.width = clamp(Number(parsed.doc.width ?? state.doc.width), 64, 10000);
        state.doc.height = clamp(Number(parsed.doc.height ?? state.doc.height), 64, 10000);
        state.doc.defs = typeof parsed.doc.defs === "string" ? parsed.doc.defs : "";
        state.activeLayerId = typeof parsed.activeLayerId === "string" ? parsed.activeLayerId : null;
      }
      if (!getObjectById(state.activeLayerId)) {
        state.activeLayerId = state.objects.find((shape) => shape.type === "group")?.id || null;
      }
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
  if (deleteActiveAnchor()) {
    return;
  }

  if (state.selection.length === 0) {
    return;
  }

  pushHistory();
  const selected = new Set(state.selection);
  state.objects = removeObjectsByIds(state.objects, selected);
  sortAndReindexObjects();
  if (selected.has(state.activeLayerId)) {
    state.activeLayerId = null;
  }
  deselectAll();
  setStatus("Selection deleted");
  render();
}

function deleteActiveAnchor() {
  const activeAnchor = getActiveAnchorSelection();
  if (!activeAnchor || (state.tool !== TOOLS.DIRECT && state.tool !== TOOLS.PEN)) {
    return false;
  }

  const anchors = activeAnchor.path.geometry.anchors || [];
  if (anchors.length <= 2) {
    setStatus("Path needs at least two anchors");
    return true;
  }

  pushHistory();
  anchors.splice(activeAnchor.anchorIndex, 1);
  if (activeAnchor.path.geometry.closed && anchors.length < 3) {
    activeAnchor.path.geometry.closed = false;
  }
  state.directSelection.anchorIndex = clamp(activeAnchor.anchorIndex, 0, anchors.length - 1);
  setStatus("Anchor deleted");
  render();
  return true;
}

function duplicateSelection() {
  if (state.selection.length === 0) {
    return;
  }

  pushHistory();
  const selected = new Set(state.selection);
  const clones = state.objects
    .filter((shape) => selected.has(shape.id))
    .map((shape) => {
      const clone = deepClone(shape);
      clone.id = nextId(shape.type);
      clone.name = `${shape.name || shape.type} copy`;
      clone.transform = normalizeTransform(clone.transform);
      clone.transform.tx += 18;
      clone.transform.ty += 18;
      clone.zIndex = state.objects.length;
      return clone;
    });

  for (const clone of clones) {
    state.objects.push(clone);
  }
  sortAndReindexObjects();
  state.selection = clones.map((shape) => shape.id);
  setStatus(`Duplicated ${clones.length} object(s)`);
  render();
}

function moveSelectionBy(dx, dy) {
  const activeAnchor = getActiveAnchorSelection();
  if (activeAnchor && (state.tool === TOOLS.DIRECT || state.tool === TOOLS.PEN)) {
    pushHistory();
    const anchor = activeAnchor.anchor;
    anchor.x += dx;
    anchor.y += dy;
    if (anchor.inHandle) {
      anchor.inHandle.x += dx;
      anchor.inHandle.y += dy;
    }
    if (anchor.outHandle) {
      anchor.outHandle.x += dx;
      anchor.outHandle.y += dy;
    }
    setStatus(`Anchor ${activeAnchor.anchorIndex + 1}: ${round(anchor.x, 2)}, ${round(anchor.y, 2)}`);
    render();
    return;
  }

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
    state.interaction.penHistoryPathId = null;
    return;
  }

  if (cancel || found.object.geometry.anchors.length <= 1) {
    state.objects = removeObjectsByIds(state.objects, new Set([state.activePathId]));
    sortAndReindexObjects();
    state.selection = [];
    setStatus("Path creation cancelled");
  } else {
    setStatus("Path finalized");
  }

  state.activePathId = null;
  state.interaction.penHistoryPathId = null;
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
  dom.canvas.addEventListener("pointercancel", pointerUpOnCanvas);
  window.addEventListener("pointerup", pointerUpOnCanvas);

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

  dom.objectNameInput.addEventListener("change", commitObjectNameEdit);
  dom.objectNameInput.addEventListener("blur", commitObjectNameEdit);
  dom.objectNameInput.addEventListener("keydown", (event) => {
    if (event.key === "Enter") {
      event.preventDefault();
      commitObjectNameEdit();
    }
  });

  dom.fillInput.addEventListener("change", () => {
    applyStyleToSelection({ fill: dom.fillInput.value, fillGradient: null });
    dom.fillModeInput.value = "solid";
  });

  dom.strokeInput.addEventListener("change", () => {
    applyStyleToSelection({ stroke: dom.strokeInput.value, strokeGradient: null });
    dom.strokeModeInput.value = "solid";
  });

  dom.fillModeInput.addEventListener("change", () => applyPaintMode("fill", dom.fillModeInput.value));
  dom.strokeModeInput.addEventListener("change", () => applyPaintMode("stroke", dom.strokeModeInput.value));
  for (const input of [dom.fillGradientStartInput, dom.fillGradientEndInput, dom.fillGradientAngleInput]) {
    input.addEventListener("change", () => updateGradientStyle("fill"));
  }
  for (const input of [dom.strokeGradientStartInput, dom.strokeGradientEndInput, dom.strokeGradientAngleInput]) {
    input.addEventListener("change", () => updateGradientStyle("stroke"));
  }

  dom.fillOpacityInput.addEventListener("change", () => {
    applyStyleToSelection({ fillOpacity: clampNumber(dom.fillOpacityInput.value, 0, 1, 1) });
  });

  dom.strokeOpacityInput.addEventListener("change", () => {
    applyStyleToSelection({ strokeOpacity: clampNumber(dom.strokeOpacityInput.value, 0, 1, 1) });
  });

  dom.strokeWidthInput.addEventListener("change", () => {
    const next = clamp(Number(dom.strokeWidthInput.value), 0, 64);
    applyStyleToSelection({ strokeWidth: Number.isFinite(next) ? next : 0 });
  });

  dom.strokeDashInput.addEventListener("change", commitStrokeDashEdit);
  dom.strokeDashInput.addEventListener("blur", commitStrokeDashEdit);
  dom.strokeDashInput.addEventListener("keydown", (event) => {
    if (event.key === "Enter") {
      event.preventDefault();
      commitStrokeDashEdit();
    }
  });

  dom.miterLimitInput.addEventListener("change", () => {
    applyStyleToSelection({ strokeMiterlimit: Math.max(1, Number(dom.miterLimitInput.value) || 4) });
  });

  dom.strokeJoinInput.addEventListener("change", () => {
    applyStyleToSelection({ strokeJoin: dom.strokeJoinInput.value });
  });

  dom.strokeCapInput.addEventListener("change", () => {
    applyStyleToSelection({ strokeCap: dom.strokeCapInput.value });
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
  dom.undoToolbarBtn.addEventListener("click", undo);
  dom.redoToolbarBtn.addEventListener("click", redo);
  dom.addLayerBtn.addEventListener("click", () => addLayer());
  dom.duplicateBtn.addEventListener("click", duplicateSelection);
  dom.deleteBtn.addEventListener("click", deleteSelection);
  dom.importSvgBtn.addEventListener("click", () => dom.importSvgInput.click());
  dom.importSvgToolbarBtn.addEventListener("click", () => dom.importSvgInput.click());
  dom.importSvgInput.addEventListener("change", () => {
    const [file] = dom.importSvgInput.files || [];
    importSvgFile(file);
    dom.importSvgInput.value = "";
  });
  dom.downloadSvgBtn.addEventListener("click", downloadSvg);
  dom.copySvgBtn.addEventListener("click", copySvg);
  dom.toggleCodeBtn.addEventListener("click", () => {
    dom.codeDrawer.classList.toggle("is-open");
    refreshCodePanelIfOpen();
  });
  dom.toggleCodeToolbarBtn.addEventListener("click", () => {
    dom.codeDrawer.classList.toggle("is-open");
    refreshCodePanelIfOpen();
  });
  dom.refreshSvgCodeBtn.addEventListener("click", () => {
    dom.svgCodeInput.value = exportSvgString();
    dom.svgValidationMessage.textContent = "Valid SVG";
    dom.svgValidationMessage.classList.remove("is-error");
  });
  dom.applySvgCodeBtn.addEventListener("click", applySvgCode);
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

  dom.gridToggleBtn.addEventListener("click", () => {
    state.view.grid = !state.view.grid;
    render();
    setStatus(state.view.grid ? "Grid visible" : "Grid hidden");
  });

  dom.rulersToggleBtn.addEventListener("click", () => {
    state.view.rulers = !state.view.rulers;
    render();
    setStatus(state.view.rulers ? "Rulers visible" : "Rulers hidden");
  });

  dom.zoomInBtn.addEventListener("click", () => setZoom(state.view.zoom * 1.25));
  dom.zoomOutBtn.addEventListener("click", () => setZoom(state.view.zoom * 0.8));
  dom.fitScreenBtn.addEventListener("click", fitArtboardToScreen);
  dom.resetViewBtn.addEventListener("click", () => {
    state.view.zoom = 1;
    state.view.panX = 0;
    state.view.panY = 0;
    state.view.fitted = false;
    applyViewTransform();
  });

  dom.pasteboard.addEventListener(
    "wheel",
    (event) => {
      event.preventDefault();
      const direction = event.deltaY > 0 ? 0.9 : 1.1;
      setZoom(state.view.zoom * direction, event);
    },
    { passive: false }
  );

  window.addEventListener("keydown", (event) => {
    const activeTag = document.activeElement?.tagName;
    const isEditingField = activeTag === "INPUT" || activeTag === "TEXTAREA" || activeTag === "SELECT";

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

    if (!isEditingField && (event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "d") {
      duplicateSelection();
      event.preventDefault();
      return;
    }

    if (!isEditingField && (event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "g") {
      if (event.shiftKey) {
        ungroupSelection();
      } else {
        groupSelection();
      }
      event.preventDefault();
      return;
    }

    if (!isEditingField && !event.metaKey && !event.ctrlKey && !event.altKey) {
      const toolKey = event.key.toLowerCase();
      const keyMap = {
        v: TOOLS.SELECT,
        a: TOOLS.DIRECT,
        p: TOOLS.PEN,
        n: TOOLS.PENCIL,
        m: TOOLS.RECT,
        l: TOOLS.ELLIPSE,
        t: TOOLS.TEXT,
        h: TOOLS.HAND,
        z: TOOLS.ZOOM,
        i: TOOLS.EYEDROPPER
      };
      if (keyMap[toolKey]) {
        if (state.tool === TOOLS.PEN && keyMap[toolKey] !== TOOLS.PEN) {
          finishActivePathIfAny(false);
        }
        state.tool = keyMap[toolKey];
        applyToolButtonState();
        setStatus(`Tool: ${getToolLabel(state.tool)}`);
        event.preventDefault();
        return;
      }
    }

    if (!isEditingField && (event.key === "Delete" || event.key === "Backspace")) {
      if (removeLastActivePathAnchor()) {
        event.preventDefault();
        return;
      }
      deleteSelection();
      event.preventDefault();
      return;
    }

    if (!isEditingField && event.key === "Escape") {
      finishActivePath();
      state.interaction.mode = null;
      state.interaction.handleKind = null;
      resetMarqueeInteractionState();
      state.interaction.snapGuides = [];
      state.interaction.startSelectionBounds = null;
      setStatus("Ready");
      render();
      return;
    }

    if (!isEditingField && event.key === "Enter") {
      finishActivePath();
      event.preventDefault();
      return;
    }

    const nudge = event.altKey ? 0.1 : event.shiftKey ? 10 : 1;
    if (!isEditingField && event.key === "ArrowLeft") {
      moveSelectionBy(-nudge, 0);
      event.preventDefault();
      return;
    }

    if (!isEditingField && event.key === "ArrowRight") {
      moveSelectionBy(nudge, 0);
      event.preventDefault();
      return;
    }

    if (!isEditingField && event.key === "ArrowUp") {
      moveSelectionBy(0, -nudge);
      event.preventDefault();
      return;
    }

    if (!isEditingField && event.key === "ArrowDown") {
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
  requestAnimationFrame(fitArtboardToScreen);
  setStatus("Ready");
}

init();
