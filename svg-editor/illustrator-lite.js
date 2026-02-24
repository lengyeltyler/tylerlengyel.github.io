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
  statusLeft: document.getElementById("status-left"),
  docWidth: document.getElementById("doc-width-input"),
  docHeight: document.getElementById("doc-height-input"),
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
  "statusLeft",
  "docWidth",
  "docHeight",
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
    startTransforms: null
  },
  history: {
    undo: [],
    redo: []
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
    node.setAttribute("fill", style.fill || "none");
    node.setAttribute("stroke", style.stroke || "none");
    node.setAttribute("stroke-width", String(round(style.strokeWidth || 0)));
    node.setAttribute("opacity", String(clamp(style.opacity, 0, 1)));
    group.appendChild(node);
  } else if (shape.type === "ellipse") {
    const node = createSvgElement("ellipse");
    node.setAttribute("cx", String(round(shape.geometry.cx)));
    node.setAttribute("cy", String(round(shape.geometry.cy)));
    node.setAttribute("rx", String(round(Math.max(1, shape.geometry.rx))));
    node.setAttribute("ry", String(round(Math.max(1, shape.geometry.ry))));
    node.setAttribute("fill", style.fill || "none");
    node.setAttribute("stroke", style.stroke || "none");
    node.setAttribute("stroke-width", String(round(style.strokeWidth || 0)));
    node.setAttribute("opacity", String(clamp(style.opacity, 0, 1)));
    group.appendChild(node);
  } else if (shape.type === "path") {
    const node = createSvgElement("path");
    node.setAttribute("d", buildPathD(shape.geometry.anchors, shape.geometry.closed));
    node.setAttribute("fill", shape.geometry.closed ? style.fill || "none" : "none");
    node.setAttribute("stroke", style.stroke || "none");
    node.setAttribute("stroke-width", String(round(style.strokeWidth || 0)));
    node.setAttribute("opacity", String(clamp(style.opacity, 0, 1)));
    group.appendChild(node);
  } else if (shape.type === "group") {
    for (const child of shape.children || []) {
      renderShape(child, group);
    }
  }

  parentNode.appendChild(group);
}

function getSelectionBounds() {
  const boxes = [];
  for (const id of state.selection) {
    const node = dom.scene.querySelector(`[data-object-id="${CSS.escape(id)}"]`);
    if (!node || typeof node.getBBox !== "function") {
      continue;
    }
    const bbox = node.getBBox();
    const matrix = node.getCTM();
    if (!matrix) {
      continue;
    }

    const points = [
      new DOMPoint(bbox.x, bbox.y),
      new DOMPoint(bbox.x + bbox.width, bbox.y),
      new DOMPoint(bbox.x + bbox.width, bbox.y + bbox.height),
      new DOMPoint(bbox.x, bbox.y + bbox.height)
    ].map((point) => point.matrixTransform(matrix));

    const xs = points.map((point) => point.x);
    const ys = points.map((point) => point.y);
    boxes.push({
      x: Math.min(...xs),
      y: Math.min(...ys),
      width: Math.max(...xs) - Math.min(...xs),
      height: Math.max(...ys) - Math.min(...ys)
    });
  }

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

function drawSelectionOutline() {
  while (dom.overlay.firstChild) {
    dom.overlay.firstChild.remove();
  }

  const bounds = getSelectionBounds();
  if (!bounds) {
    return;
  }

  const rect = createSvgElement("rect");
  rect.setAttribute("class", "selection-outline");
  rect.setAttribute("x", String(round(bounds.x)));
  rect.setAttribute("y", String(round(bounds.y)));
  rect.setAttribute("width", String(round(bounds.width)));
  rect.setAttribute("height", String(round(bounds.height)));
  dom.overlay.appendChild(rect);

  const isTransformTool = state.tool === TOOLS.SELECT || state.tool === TOOLS.DIRECT;
  if (!isTransformTool) {
    return;
  }

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

  if (state.tool === TOOLS.DIRECT) {
    drawDirectSelectionAnchors();
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

  dom.docWidth.value = String(state.doc.width);
  dom.docHeight.value = String(state.doc.height);

  const legacySnapshot = state.objects.map(toLegacyShape);
  window.localStorage.setItem("svg-editor:legacy-shapes", JSON.stringify(legacySnapshot));
  window.localStorage.setItem("svg-editor:canonical-shapes", JSON.stringify(state.objects));
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

function getTopLevelSelectionIds() {
  return state.selection.filter((id) => state.objects.some((shape) => shape.id === id));
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
  setStatus(`Moving ${startTransforms.size} object(s)`);
}

function continueMoveSelection(point) {
  if (state.interaction.mode !== "moving" || !state.interaction.startTransforms) {
    return;
  }

  const start = state.interaction.start;
  const dx = point.x - start.x;
  const dy = point.y - start.y;

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
      found.object.geometry.closed = true;
      state.activePathId = null;
      setStatus("Path closed");
      render();
      return;
    }
  }

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
      deselectAll();
      setStatus("Ready");
    }

    render();
  }
}

function pointerMoveOnCanvas(event) {
  const point = svgPointFromEvent(event);

  if (state.interaction.mode === "anchor-moving") {
    const pathId = state.directSelection.pathId;
    const anchorIndex = state.directSelection.anchorIndex;
    const found = pathId ? getObjectById(pathId) : null;
    if (found && found.object.type === "path" && Number.isInteger(anchorIndex)) {
      const local = applyInverseTransform(point, found.object.transform);
      const anchor = found.object.geometry.anchors[anchorIndex];
      if (anchor) {
        anchor.x = local.x;
        anchor.y = local.y;
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
    continueMoveSelection(point);
    render();
    return;
  }

  if (state.interaction.mode === "scaling" || state.interaction.mode === "rotating") {
    continueHandleTransform(point, event.shiftKey);
    render();
  }
}

function pointerUpOnCanvas() {
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
  const styleAttributes = [
    `fill="${shape.type === "path" && !shape.geometry.closed ? "none" : style.fill || "none"}"`,
    `stroke="${style.stroke || "none"}"`,
    `stroke-width="${round(style.strokeWidth || 0)}"`,
    `opacity="${round(clamp(style.opacity, 0, 1))}"`
  ];

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
    return `${indent}<path d="${d}" ${styleAttributes.join(" ")}${transformAttribute} />`;
  }

  if (shape.type === "group") {
    const childLines = (shape.children || [])
      .map((child) => shapeToSvgString(child, `${indent}  `))
      .filter(Boolean)
      .join("\n");
    return `${indent}<g id="${shape.id}"${transformAttribute}>\n${childLines}\n${indent}</g>`;
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
  const canonicalRaw = window.localStorage.getItem("svg-editor:canonical-shapes");
  if (canonicalRaw) {
    try {
      const parsed = JSON.parse(canonicalRaw);
      state.objects = adaptShapeArray(parsed);
      return;
    } catch (error) {
      console.warn("[svg-editor] Failed to parse canonical snapshot", error);
    }
  }

  const legacyRaw = window.localStorage.getItem("svg-editor:legacy-shapes");
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

function finishActivePathIfAny() {
  if (!state.activePathId) {
    return;
  }

  const found = getObjectById(state.activePathId);
  if (!found || found.object.type !== "path") {
    state.activePathId = null;
    return;
  }

  if (found.object.geometry.anchors.length <= 1) {
    state.objects = state.objects.filter((shape) => shape.id !== state.activePathId);
    sortAndReindexObjects();
    state.selection = [];
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
    finishActivePathIfAny();
  }

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

  dom.undoBtn.addEventListener("click", undo);
  dom.redoBtn.addEventListener("click", redo);
  dom.downloadSvgBtn.addEventListener("click", downloadSvg);
  dom.copySvgBtn.addEventListener("click", copySvg);
  dom.layerForwardBtn.addEventListener("click", () => moveSelectionInLayer(1));
  dom.layerBackwardBtn.addEventListener("click", () => moveSelectionInLayer(-1));
  dom.groupBtn.addEventListener("click", groupSelection);
  dom.ungroupBtn.addEventListener("click", ungroupSelection);

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
      finishActivePathIfAny();
      state.interaction.mode = null;
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
