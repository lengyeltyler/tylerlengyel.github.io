const EPSILON = 1e-6;
const SCALE = 1000;
const MAX_TOPOLOGY_POINTS = 1400;

function getClipperLib() {
  return typeof globalThis !== "undefined" && globalThis.ClipperLib ? globalThis.ClipperLib : null;
}

function quantize(value) {
  return Math.round((Number(value) || 0) * SCALE) / SCALE;
}

function pointKey(point, precision = 2) {
  return `${Number(point.x).toFixed(precision)},${Number(point.y).toFixed(precision)}`;
}

function toClipperPath(points) {
  return cleanPolygonPoints(points).map((point) => ({
    X: Math.round(point.x * SCALE),
    Y: Math.round(point.y * SCALE)
  }));
}

function fromClipperPath(path) {
  return cleanPolygonPoints((path || []).map((point) => ({
    x: quantize(point.X / SCALE),
    y: quantize(point.Y / SCALE)
  })));
}

function clipperJoinType(join) {
  const ClipperLib = getClipperLib();
  if (!ClipperLib) {
    return null;
  }
  if (join === "round") {
    return ClipperLib.JoinType.jtRound;
  }
  if (join === "bevel" || join === "square") {
    return ClipperLib.JoinType.jtSquare;
  }
  return ClipperLib.JoinType.jtMiter;
}

function clipperClipType(operation) {
  const ClipperLib = getClipperLib();
  if (!ClipperLib) {
    return null;
  }
  if (operation === "unite") {
    return ClipperLib.ClipType.ctUnion;
  }
  if (operation === "subtract") {
    return ClipperLib.ClipType.ctDifference;
  }
  if (operation === "intersect") {
    return ClipperLib.ClipType.ctIntersection;
  }
  if (operation === "exclude") {
    return ClipperLib.ClipType.ctXor;
  }
  return null;
}

function cleanPolygonPoints(points, epsilon = 0.01) {
  const cleaned = [];
  for (const point of points || []) {
    if (!Number.isFinite(point?.x) || !Number.isFinite(point?.y)) {
      continue;
    }
    const next = { x: quantize(point.x), y: quantize(point.y) };
    const previous = cleaned[cleaned.length - 1];
    if (!previous || Math.hypot(next.x - previous.x, next.y - previous.y) > epsilon) {
      cleaned.push(next);
    }
  }
  if (cleaned.length > 1) {
    const first = cleaned[0];
    const last = cleaned[cleaned.length - 1];
    if (Math.hypot(first.x - last.x, first.y - last.y) <= epsilon) {
      cleaned.pop();
    }
  }
  return removeCollinearPoints(cleaned, epsilon);
}

function polygonArea(points) {
  let area = 0;
  for (let i = 0; i < points.length; i += 1) {
    const a = points[i];
    const b = points[(i + 1) % points.length];
    area += a.x * b.y - b.x * a.y;
  }
  return area / 2;
}

function removeCollinearPoints(points, epsilon = 0.01) {
  if (!points || points.length <= 3) {
    return points || [];
  }
  return points.filter((point, index) => {
    const previous = points[(index - 1 + points.length) % points.length];
    const next = points[(index + 1) % points.length];
    const cross = Math.abs((point.x - previous.x) * (next.y - point.y) - (point.y - previous.y) * (next.x - point.x));
    const span = Math.hypot(next.x - previous.x, next.y - previous.y);
    return span < EPSILON || cross / span > epsilon;
  });
}

function normalizeWinding(points, clockwise = false) {
  const cleaned = cleanPolygonPoints(points);
  const area = polygonArea(cleaned);
  if ((clockwise && area > 0) || (!clockwise && area < 0)) {
    return [...cleaned].reverse();
  }
  return cleaned;
}

function lineIntersection(a1, a2, b1, b2) {
  const dax = a2.x - a1.x;
  const day = a2.y - a1.y;
  const dbx = b2.x - b1.x;
  const dby = b2.y - b1.y;
  const denominator = dax * dby - day * dbx;
  if (Math.abs(denominator) < EPSILON) {
    return { x: quantize(a2.x), y: quantize(a2.y) };
  }
  const t = ((b1.x - a1.x) * dby - (b1.y - a1.y) * dbx) / denominator;
  return { x: quantize(a1.x + t * dax), y: quantize(a1.y + t * day) };
}

function onSegment(point, a, b, epsilon = 0.01) {
  const cross = Math.abs((point.y - a.y) * (b.x - a.x) - (point.x - a.x) * (b.y - a.y));
  if (cross > epsilon) {
    return false;
  }
  return (
    point.x >= Math.min(a.x, b.x) - epsilon &&
    point.x <= Math.max(a.x, b.x) + epsilon &&
    point.y >= Math.min(a.y, b.y) - epsilon &&
    point.y <= Math.max(a.y, b.y) + epsilon
  );
}

function segmentIntersectionPoint(a, b, c, d) {
  const dax = b.x - a.x;
  const day = b.y - a.y;
  const dbx = d.x - c.x;
  const dby = d.y - c.y;
  const denominator = dax * dby - day * dbx;
  if (Math.abs(denominator) < EPSILON) {
    for (const point of [a, b, c, d]) {
      if (onSegment(point, a, b) && onSegment(point, c, d)) {
        return { x: quantize(point.x), y: quantize(point.y) };
      }
    }
    return null;
  }
  const t = ((c.x - a.x) * dby - (c.y - a.y) * dbx) / denominator;
  const u = ((c.x - a.x) * day - (c.y - a.y) * dax) / denominator;
  if (t < -EPSILON || t > 1 + EPSILON || u < -EPSILON || u > 1 + EPSILON) {
    return null;
  }
  return {
    x: quantize(a.x + t * dax),
    y: quantize(a.y + t * day)
  };
}

function isInsideClipEdge(point, edgeA, edgeB, clipClockwise) {
  const cross = (edgeB.x - edgeA.x) * (point.y - edgeA.y) - (edgeB.y - edgeA.y) * (point.x - edgeA.x);
  return clipClockwise ? cross <= EPSILON : cross >= -EPSILON;
}

function clipPolygon(subjectPolygon, clipPolygonPoints) {
  let output = cleanPolygonPoints(subjectPolygon);
  const clip = cleanPolygonPoints(clipPolygonPoints);
  if (output.length < 3 || clip.length < 3) {
    return [];
  }
  const clipClockwise = polygonArea(clip) < 0;
  for (let i = 0; i < clip.length; i += 1) {
    const edgeA = clip[i];
    const edgeB = clip[(i + 1) % clip.length];
    const input = output;
    output = [];
    if (input.length === 0) {
      break;
    }
    let previous = input[input.length - 1];
    for (const current of input) {
      const currentInside = isInsideClipEdge(current, edgeA, edgeB, clipClockwise);
      const previousInside = isInsideClipEdge(previous, edgeA, edgeB, clipClockwise);
      if (currentInside) {
        if (!previousInside) {
          output.push(lineIntersection(previous, current, edgeA, edgeB));
        }
        output.push(current);
      } else if (previousInside) {
        output.push(lineIntersection(previous, current, edgeA, edgeB));
      }
      previous = current;
    }
    output = cleanPolygonPoints(output);
  }
  return repairPolygon(output);
}

function segmentsIntersect(a, b, c, d) {
  const orientation = (p, q, r) => Math.sign((q.y - p.y) * (r.x - q.x) - (q.x - p.x) * (r.y - q.y));
  const o1 = orientation(a, b, c);
  const o2 = orientation(a, b, d);
  const o3 = orientation(c, d, a);
  const o4 = orientation(c, d, b);
  if (o1 === 0 && onSegment(c, a, b)) {
    return true;
  }
  if (o2 === 0 && onSegment(d, a, b)) {
    return true;
  }
  if (o3 === 0 && onSegment(a, c, d)) {
    return true;
  }
  if (o4 === 0 && onSegment(b, c, d)) {
    return true;
  }
  return o1 !== o2 && o3 !== o4;
}

function hasSelfIntersections(points) {
  const polygon = cleanPolygonPoints(points);
  for (let i = 0; i < polygon.length; i += 1) {
    const a = polygon[i];
    const b = polygon[(i + 1) % polygon.length];
    for (let j = i + 2; j < polygon.length; j += 1) {
      if (i === 0 && j === polygon.length - 1) {
        continue;
      }
      const c = polygon[j];
      const d = polygon[(j + 1) % polygon.length];
      if (segmentsIntersect(a, b, c, d)) {
        return true;
      }
    }
  }
  return false;
}

function collectSegmentIntersections(pointsA, pointsB) {
  const a = cleanPolygonPoints(pointsA);
  const b = cleanPolygonPoints(pointsB);
  const intersections = [];
  const seen = new Set();
  for (let i = 0; i < a.length; i += 1) {
    const a1 = a[i];
    const a2 = a[(i + 1) % a.length];
    for (let j = 0; j < b.length; j += 1) {
      const b1 = b[j];
      const b2 = b[(j + 1) % b.length];
      const intersection = segmentIntersectionPoint(a1, a2, b1, b2);
      if (!intersection) {
        continue;
      }
      const key = pointKey(intersection, 3);
      if (!seen.has(key)) {
        seen.add(key);
        intersections.push(intersection);
      }
    }
  }
  return intersections;
}

function pointInPolygon(point, points) {
  const polygon = cleanPolygonPoints(points);
  if (polygon.length < 3) {
    return false;
  }
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i, i += 1) {
    const a = polygon[i];
    const b = polygon[j];
    if (onSegment(point, a, b, 0.001)) {
      return true;
    }
    const crosses = ((a.y > point.y) !== (b.y > point.y)) &&
      point.x < ((b.x - a.x) * (point.y - a.y)) / (b.y - a.y) + a.x;
    if (crosses) {
      inside = !inside;
    }
  }
  return inside;
}

function polygonCentroid(points) {
  const polygon = cleanPolygonPoints(points);
  if (polygon.length === 0) {
    return null;
  }
  const area = polygonArea(polygon);
  if (Math.abs(area) < EPSILON) {
    return {
      x: quantize(polygon.reduce((sum, point) => sum + point.x, 0) / polygon.length),
      y: quantize(polygon.reduce((sum, point) => sum + point.y, 0) / polygon.length)
    };
  }
  let cx = 0;
  let cy = 0;
  for (let i = 0; i < polygon.length; i += 1) {
    const a = polygon[i];
    const b = polygon[(i + 1) % polygon.length];
    const factor = a.x * b.y - b.x * a.y;
    cx += (a.x + b.x) * factor;
    cy += (a.y + b.y) * factor;
  }
  return { x: quantize(cx / (6 * area)), y: quantize(cy / (6 * area)) };
}

function isConvexPolygon(points) {
  const polygon = cleanPolygonPoints(points);
  if (polygon.length < 3) {
    return false;
  }
  let sign = 0;
  for (let i = 0; i < polygon.length; i += 1) {
    const a = polygon[i];
    const b = polygon[(i + 1) % polygon.length];
    const c = polygon[(i + 2) % polygon.length];
    const cross = (b.x - a.x) * (c.y - b.y) - (b.y - a.y) * (c.x - b.x);
    if (Math.abs(cross) < EPSILON) {
      continue;
    }
    const currentSign = Math.sign(cross);
    if (!sign) {
      sign = currentSign;
    } else if (sign !== currentSign) {
      return false;
    }
  }
  return true;
}

function pointInTriangle(point, a, b, c) {
  const area = (p1, p2, p3) => (p2.x - p1.x) * (p3.y - p1.y) - (p2.y - p1.y) * (p3.x - p1.x);
  const s1 = area(point, a, b);
  const s2 = area(point, b, c);
  const s3 = area(point, c, a);
  const hasNegative = s1 < -EPSILON || s2 < -EPSILON || s3 < -EPSILON;
  const hasPositive = s1 > EPSILON || s2 > EPSILON || s3 > EPSILON;
  return !(hasNegative && hasPositive);
}

function triangulatePolygon(points) {
  const polygon = normalizeWinding(points);
  if (polygon.length < 3 || polygon.length > MAX_TOPOLOGY_POINTS || hasSelfIntersections(polygon)) {
    return [];
  }
  const triangles = [];
  const remaining = polygon.map((point, index) => ({ ...point, index }));
  let guard = 0;
  while (remaining.length > 3 && guard < 2000) {
    guard += 1;
    let earIndex = -1;
    for (let i = 0; i < remaining.length; i += 1) {
      const previous = remaining[(i - 1 + remaining.length) % remaining.length];
      const current = remaining[i];
      const next = remaining[(i + 1) % remaining.length];
      const cross = (current.x - previous.x) * (next.y - current.y) - (current.y - previous.y) * (next.x - current.x);
      if (cross <= EPSILON) {
        continue;
      }
      const containsPoint = remaining.some((candidate, candidateIndex) =>
        candidateIndex !== i &&
        candidateIndex !== (i - 1 + remaining.length) % remaining.length &&
        candidateIndex !== (i + 1) % remaining.length &&
        pointInTriangle(candidate, previous, current, next)
      );
      if (!containsPoint) {
        earIndex = i;
        triangles.push([previous, current, next].map(({ x, y }) => ({ x, y })));
        break;
      }
    }
    if (earIndex === -1) {
      break;
    }
    remaining.splice(earIndex, 1);
  }
  if (remaining.length === 3) {
    triangles.push(remaining.map(({ x, y }) => ({ x, y })));
  }
  return triangles;
}

function simplifyPolyline(points, tolerance = 0.5, closed = false) {
  const source = cleanPolygonPoints(points, Math.min(0.05, Math.max(0.001, tolerance / 10)));
  if (source.length <= 2) {
    return source;
  }
  const distanceToSegment = (point, a, b) => {
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const lengthSq = dx * dx + dy * dy;
    if (lengthSq < EPSILON) {
      return Math.hypot(point.x - a.x, point.y - a.y);
    }
    const t = Math.max(0, Math.min(1, ((point.x - a.x) * dx + (point.y - a.y) * dy) / lengthSq));
    const projection = { x: a.x + t * dx, y: a.y + t * dy };
    return Math.hypot(point.x - projection.x, point.y - projection.y);
  };
  const reduce = (segment) => {
    if (segment.length <= 2) {
      return segment;
    }
    let maxDistance = 0;
    let maxIndex = 0;
    for (let i = 1; i < segment.length - 1; i += 1) {
      const distance = distanceToSegment(segment[i], segment[0], segment[segment.length - 1]);
      if (distance > maxDistance) {
        maxDistance = distance;
        maxIndex = i;
      }
    }
    if (maxDistance <= tolerance) {
      return [segment[0], segment[segment.length - 1]];
    }
    return [
      ...reduce(segment.slice(0, maxIndex + 1)).slice(0, -1),
      ...reduce(segment.slice(maxIndex))
    ];
  };
  const simplified = closed ? reduce([...source, source[0]]).slice(0, -1) : reduce(source);
  return cleanPolygonPoints(simplified, 0.01);
}

function intersectPolygonsToPieces(polygonA, polygonB) {
  const a = repairPolygon(polygonA);
  const b = repairPolygon(polygonB);
  if (a.length < 3 || b.length < 3 || hasSelfIntersections(a) || hasSelfIntersections(b)) {
    return [];
  }
  if (isConvexPolygon(a) && isConvexPolygon(b)) {
    const clipped = clipPolygon(a, b);
    return clipped.length >= 3 ? [clipped] : [];
  }
  const trianglesA = triangulatePolygon(a);
  const trianglesB = triangulatePolygon(b);
  const pieces = [];
  const seen = new Set();
  for (const triangleA of trianglesA) {
    for (const triangleB of trianglesB) {
      const clipped = clipPolygon(triangleA, triangleB);
      if (clipped.length >= 3 && Math.abs(polygonArea(clipped)) > 0.01) {
        const repaired = repairPolygon(clipped);
        const key = repaired.map((point) => pointKey(point)).join(" ");
        if (!seen.has(key)) {
          seen.add(key);
          pieces.push(repaired);
        }
      }
    }
  }
  return pieces;
}

function decomposePolygonForTopology(points, label = "region") {
  const polygon = repairPolygon(points);
  if (polygon.length < 3) {
    return [];
  }
  const triangles = triangulatePolygon(polygon);
  if (triangles.length === 0) {
    return [polygon];
  }
  return triangles
    .map((triangle) => repairPolygon(triangle, { minArea: 0.05 }))
    .filter((triangle) => triangle.length >= 3)
    .map((triangle, index) => ({ polygon: triangle, label, index }));
}

function booleanPolygonsToPieces(polygonA, polygonB, operation) {
  const a = repairPolygon(polygonA);
  const b = repairPolygon(polygonB);
  if (a.length < 3 || b.length < 3 || hasSelfIntersections(a) || hasSelfIntersections(b)) {
    return [];
  }
  const clipperPieces = clipperBooleanPolygons(a, b, operation);
  if (clipperPieces?.length || (clipperPieces && operation === "subtract")) {
    return clipperPieces;
  }
  const intersections = collectSegmentIntersections(a, b);
  const intersectionPieces = intersectPolygonsToPieces(a, b);
  if (operation === "intersect") {
    return intersectionPieces;
  }
  if (operation === "unite") {
    if (intersections.length === 0) {
      if (pointInPolygon(a[0], b)) {
        return [b];
      }
      if (pointInPolygon(b[0], a)) {
        return [a];
      }
      return [a, b];
    }
    const outsideA = decomposePolygonForTopology(a)
      .filter((piece) => !pointInPolygon(polygonCentroid(piece.polygon), b))
      .map((piece) => piece.polygon);
    const outsideB = decomposePolygonForTopology(b)
      .filter((piece) => !pointInPolygon(polygonCentroid(piece.polygon), a))
      .map((piece) => piece.polygon);
    return cleanupTopologyPieces([...outsideA, ...outsideB, ...intersectionPieces]);
  }
  if (operation === "subtract") {
    if (intersections.length === 0) {
      return pointInPolygon(a[0], b) ? [] : [a];
    }
    const outsideA = decomposePolygonForTopology(a)
      .filter((piece) => !pointInPolygon(polygonCentroid(piece.polygon), b))
      .map((piece) => piece.polygon);
    return cleanupTopologyPieces(outsideA);
  }
  if (operation === "exclude") {
    const outsideA = decomposePolygonForTopology(a)
      .filter((piece) => !pointInPolygon(polygonCentroid(piece.polygon), b))
      .map((piece) => piece.polygon);
    const outsideB = decomposePolygonForTopology(b)
      .filter((piece) => !pointInPolygon(polygonCentroid(piece.polygon), a))
      .map((piece) => piece.polygon);
    return cleanupTopologyPieces([...outsideA, ...outsideB]);
  }
  return [];
}

function dividePolygonsToRegions(polygonA, polygonB) {
  const a = repairPolygon(polygonA);
  const b = repairPolygon(polygonB);
  if (a.length < 3 || b.length < 3) {
    return { aOnly: [], bOnly: [], overlap: [] };
  }
  const clipperOverlap = clipperBooleanPolygons(a, b, "intersect");
  const clipperAOnly = clipperBooleanPolygons(a, b, "subtract");
  const clipperBOnly = clipperBooleanPolygons(b, a, "subtract");
  if (clipperOverlap && clipperAOnly && clipperBOnly) {
    return {
      aOnly: clipperAOnly,
      bOnly: clipperBOnly,
      overlap: clipperOverlap
    };
  }
  const overlap = intersectPolygonsToPieces(a, b);
  const aOnly = decomposePolygonForTopology(a)
    .filter((piece) => !pointInPolygon(polygonCentroid(piece.polygon), b))
    .map((piece) => piece.polygon);
  const bOnly = decomposePolygonForTopology(b)
    .filter((piece) => !pointInPolygon(polygonCentroid(piece.polygon), a))
    .map((piece) => piece.polygon);
  return {
    aOnly: cleanupTopologyPieces(aOnly),
    bOnly: cleanupTopologyPieces(bOnly),
    overlap: cleanupTopologyPieces(overlap)
  };
}

function cleanupTopologyPieces(pieces, { minArea = 0.05 } = {}) {
  const cleaned = [];
  const seen = new Set();
  for (const piece of pieces || []) {
    const repaired = repairPolygon(piece, { minArea });
    if (repaired.length < 3) {
      continue;
    }
    const key = repaired.map((point) => pointKey(point, 2)).join(" ");
    if (!seen.has(key)) {
      seen.add(key);
      cleaned.push(repaired);
    }
  }
  return cleaned;
}

function clipperBooleanPolygons(polygonA, polygonB, operation, { minArea = 0.05 } = {}) {
  const ClipperLib = getClipperLib();
  const clipType = clipperClipType(operation);
  if (!ClipperLib || clipType === null) {
    return null;
  }
  const subject = toClipperPath(polygonA);
  const clip = toClipperPath(polygonB);
  if (subject.length < 3 || clip.length < 3) {
    return null;
  }
  try {
    const clipper = new ClipperLib.Clipper();
    clipper.StrictlySimple = true;
    clipper.AddPath(subject, ClipperLib.PolyType.ptSubject, true);
    clipper.AddPath(clip, ClipperLib.PolyType.ptClip, true);
    const solution = typeof ClipperLib.Paths === "function" ? new ClipperLib.Paths() : [];
    const succeeded = clipper.Execute(
      clipType,
      solution,
      ClipperLib.PolyFillType.pftEvenOdd,
      ClipperLib.PolyFillType.pftEvenOdd
    );
    if (!succeeded) {
      return null;
    }
    const simplified = ClipperLib.Clipper.SimplifyPolygons(solution, ClipperLib.PolyFillType.pftEvenOdd);
    return cleanupTopologyPieces(
      simplified.map((path) => fromClipperPath(path)),
      { minArea }
    );
  } catch (error) {
    console.warn("SVG editor geometry: Clipper boolean failed; using fallback geometry", error);
    return null;
  }
}

function offsetPolygonPaths(points, amount, join = "miter", miterLimit = 4, { minArea = 0.05 } = {}) {
  const ClipperLib = getClipperLib();
  if (!ClipperLib) {
    return null;
  }
  const polygon = toClipperPath(points);
  if (polygon.length < 3) {
    return null;
  }
  try {
    const offsetter = new ClipperLib.ClipperOffset(Math.max(1, miterLimit), 0.25 * SCALE);
    offsetter.AddPath(polygon, clipperJoinType(join), ClipperLib.EndType.etClosedPolygon);
    const solution = typeof ClipperLib.Paths === "function" ? new ClipperLib.Paths() : [];
    offsetter.Execute(solution, amount * SCALE);
    return cleanupTopologyPieces(
      solution.map((path) => fromClipperPath(path)),
      { minArea }
    );
  } catch (error) {
    console.warn("SVG editor geometry: Clipper offset failed; using fallback geometry", error);
    return null;
  }
}

function outlineOpenPolylinePaths(points, width, style = {}) {
  const ClipperLib = getClipperLib();
  if (!ClipperLib) {
    return null;
  }
  const line = cleanPolygonPoints(points);
  if (line.length < 2 || width <= 0) {
    return null;
  }
  try {
    const offsetter = new ClipperLib.ClipperOffset(Math.max(1, style.strokeMiterlimit || 4), 0.25 * SCALE);
    offsetter.AddPath(
      toClipperPath(line),
      clipperJoinType(style.strokeJoin || "miter"),
      style.strokeCap === "round"
        ? ClipperLib.EndType.etOpenRound
        : style.strokeCap === "square"
          ? ClipperLib.EndType.etOpenSquare
          : ClipperLib.EndType.etOpenButt
    );
    const solution = typeof ClipperLib.Paths === "function" ? new ClipperLib.Paths() : [];
    offsetter.Execute(solution, (width / 2) * SCALE);
    return cleanupTopologyPieces(solution.map((path) => fromClipperPath(path)));
  } catch (error) {
    console.warn("SVG editor geometry: Clipper stroke outline failed; using fallback geometry", error);
    return null;
  }
}

function offsetPolygon(points, amount, join = "miter", miterLimit = 4) {
  const clipperPaths = offsetPolygonPaths(points, amount, join, miterLimit);
  if (clipperPaths?.length) {
    return clipperPaths.sort((a, b) => Math.abs(polygonArea(b)) - Math.abs(polygonArea(a)))[0];
  }
  const polygon = normalizeWinding(points);
  if (polygon.length < 3 || hasSelfIntersections(polygon)) {
    return null;
  }
  const areaSign = polygonArea(polygon) >= 0 ? 1 : -1;
  const offsetLines = [];
  for (let i = 0; i < polygon.length; i += 1) {
    const a = polygon[i];
    const b = polygon[(i + 1) % polygon.length];
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const length = Math.max(EPSILON, Math.hypot(dx, dy));
    const nx = (dy / length) * areaSign * amount;
    const ny = (-dx / length) * areaSign * amount;
    offsetLines.push({
      a: { x: a.x + nx, y: a.y + ny },
      b: { x: b.x + nx, y: b.y + ny }
    });
  }
  const result = [];
  for (let i = 0; i < offsetLines.length; i += 1) {
    const previous = offsetLines[(i - 1 + offsetLines.length) % offsetLines.length];
    const current = offsetLines[i];
    let point = lineIntersection(previous.a, previous.b, current.a, current.b);
    const original = polygon[i];
    const maxMiter = Math.abs(amount) * Math.max(1, miterLimit);
    if (join !== "miter" || Math.hypot(point.x - original.x, point.y - original.y) > maxMiter) {
      point = {
        x: quantize((previous.b.x + current.a.x) / 2),
        y: quantize((previous.b.y + current.a.y) / 2)
      };
    }
    result.push(point);
  }
  const repaired = repairPolygon(result);
  const simplified = simplifyPolyline(repaired, Math.max(0.05, Math.min(0.75, Math.abs(amount) * 0.04)), true);
  return simplified.length >= 3 && !hasSelfIntersections(simplified) ? simplified : null;
}

function offsetOpenPolyline(points, amount) {
  const line = cleanPolygonPoints(points);
  if (line.length < 2) {
    return null;
  }
  return simplifyPolyline(line.map((point, index) => {
    const previous = line[Math.max(0, index - 1)];
    const next = line[Math.min(line.length - 1, index + 1)];
    const dx = next.x - previous.x;
    const dy = next.y - previous.y;
    const length = Math.max(EPSILON, Math.hypot(dx, dy));
    return {
      x: quantize(point.x + (-dy / length) * amount),
      y: quantize(point.y + (dx / length) * amount)
    };
  }), Math.max(0.05, Math.min(0.5, Math.abs(amount) * 0.03)), false);
}

function outlinePolyline(points, width, closed = false, style = {}) {
  const line = cleanPolygonPoints(points);
  if (line.length < 2) {
    return null;
  }
  if (closed) {
    const outerPaths = offsetPolygonPaths(line, width / 2, style.strokeJoin, style.strokeMiterlimit);
    const innerPaths = offsetPolygonPaths(line, -width / 2, style.strokeJoin, style.strokeMiterlimit);
    const outer = outerPaths?.[0] || offsetPolygon(line, width / 2, style.strokeJoin, style.strokeMiterlimit);
    const inner = innerPaths?.[0] || offsetPolygon(line, -width / 2, style.strokeJoin, style.strokeMiterlimit);
    if (!outer || !inner) {
      return null;
    }
    return repairPolygon([...outer, ...inner.reverse()]);
  }
  const outlined = outlineOpenPolylinePaths(line, width, style);
  if (outlined?.length) {
    return outlined.sort((a, b) => Math.abs(polygonArea(b)) - Math.abs(polygonArea(a)))[0];
  }
  const left = [];
  const right = [];
  for (let i = 0; i < line.length; i += 1) {
    const previous = line[Math.max(0, i - 1)];
    const next = line[Math.min(line.length - 1, i + 1)];
    const dx = next.x - previous.x;
    const dy = next.y - previous.y;
    const length = Math.max(EPSILON, Math.hypot(dx, dy));
    const nx = (-dy / length) * (width / 2);
    const ny = (dx / length) * (width / 2);
    left.push({ x: quantize(line[i].x + nx), y: quantize(line[i].y + ny) });
    right.push({ x: quantize(line[i].x - nx), y: quantize(line[i].y - ny) });
  }
  const cap = style.strokeCap || "butt";
  if (cap === "square") {
    const extend = (a, b, sign) => {
      const dx = b.x - a.x;
      const dy = b.y - a.y;
      const length = Math.max(EPSILON, Math.hypot(dx, dy));
      return { x: (dx / length) * (width / 2) * sign, y: (dy / length) * (width / 2) * sign };
    };
    const start = extend(line[0], line[1], -1);
    const end = extend(line[line.length - 2], line[line.length - 1], 1);
    for (const side of [left, right]) {
      side[0].x = quantize(side[0].x + start.x);
      side[0].y = quantize(side[0].y + start.y);
      side[side.length - 1].x = quantize(side[side.length - 1].x + end.x);
      side[side.length - 1].y = quantize(side[side.length - 1].y + end.y);
    }
  }
  return repairPolygon(simplifyPolyline([...left, ...right.reverse()], Math.max(0.05, Math.min(0.5, width * 0.02)), true));
}

function parseDashArray(value) {
  const numbers = String(value || "")
    .trim()
    .split(/[\s,]+/)
    .map(Number)
    .filter((number) => Number.isFinite(number) && number > 0);
  return numbers.length % 2 === 0 ? numbers : [...numbers, ...numbers];
}

function dashedPolylineSegments(points, dashArray) {
  const line = cleanPolygonPoints(points);
  const dashes = parseDashArray(dashArray);
  if (line.length < 2 || dashes.length === 0) {
    return [line];
  }
  const segments = [];
  let dashIndex = 0;
  let dashRemaining = dashes[0];
  let drawing = true;
  let currentSegment = [];
  for (let i = 0; i < line.length - 1; i += 1) {
    let start = line[i];
    const end = line[i + 1];
    let segmentLength = Math.hypot(end.x - start.x, end.y - start.y);
    if (segmentLength < EPSILON) {
      continue;
    }
    const ux = (end.x - start.x) / segmentLength;
    const uy = (end.y - start.y) / segmentLength;
    while (segmentLength > EPSILON) {
      const step = Math.min(segmentLength, dashRemaining);
      const next = { x: quantize(start.x + ux * step), y: quantize(start.y + uy * step) };
      if (drawing) {
        if (currentSegment.length === 0) {
          currentSegment.push(start);
        }
        currentSegment.push(next);
      }
      segmentLength -= step;
      dashRemaining -= step;
      start = next;
      if (dashRemaining <= EPSILON) {
        if (drawing && currentSegment.length > 1) {
          segments.push(currentSegment);
        }
        currentSegment = [];
        dashIndex = (dashIndex + 1) % dashes.length;
        dashRemaining = dashes[dashIndex];
        drawing = !drawing;
      }
    }
  }
  if (drawing && currentSegment.length > 1) {
    segments.push(currentSegment);
  }
  return segments.length ? segments : [line];
}

function repairPolygon(points, { minArea = 0.01 } = {}) {
  const cleaned = cleanPolygonPoints(points, 0.01);
  if (cleaned.length < 3 || Math.abs(polygonArea(cleaned)) < minArea) {
    return [];
  }
  return normalizeWinding(cleaned);
}

export const SvgGeometryEngine = {
  booleanPolygonsToPieces,
  cleanPolygonPoints,
  clipperBooleanPolygons,
  clipPolygon,
  dashedPolylineSegments,
  dividePolygonsToRegions,
  hasClipperBackend: () => Boolean(getClipperLib()),
  hasSelfIntersections,
  intersectPolygonsToPieces,
  isConvexPolygon,
  normalizeWinding,
  offsetOpenPolyline,
  offsetPolygon,
  offsetPolygonPaths,
  outlinePolyline,
  outlineOpenPolylinePaths,
  pointInPolygon,
  polygonArea,
  polygonCentroid,
  repairPolygon,
  simplifyPolyline,
  triangulatePolygon
};
