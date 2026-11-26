const SVG_NS = "http://www.w3.org/2000/svg";

const TOOLS = {
  SELECT: "select",
  RECT: "rect",
  ELLIPSE: "ellipse",
  PEN: "pen",
  DIRECT: "direct",
  LINE: "line", PENCIL: "pencil", TEXT: "text", HAND: "hand", ZOOM: "zoom", POLYGON:'polygon', STAR:'star'
};

const DEFAULT_STYLE = {
  fill: "#90caf955",
  stroke: "#1976d2",
  strokeWidth: 2,
  opacity: 1, gradient:null, strokeCap:'butt',strokeJoin:'miter',strokeDash:''
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
  },
  view:{zoom:1,cx:600,cy:400,fit:true},
  paint:deepClone(DEFAULT_STYLE),grid:{visible:false,snap:false,size:20},shapeSides:5,alignTarget:'selection',boards:[],activeBoard:0
};

let idCounter = 0;
let spaceDown=false,clipboardObjects=[],saveTimer=0,textEditing=false;
const expandedLayerGroups=new Set(),layerThumbnailCache=new Map();
const $=id=>document.getElementById(id);

function renderView(){
  const w=dom.canvas.clientWidth||1,h=dom.canvas.clientHeight||1;
  const v=state.view;
  if(v.fit){v.zoom=Math.max(.01,Math.min((w-32)/state.doc.width,(h-32)/state.doc.height));v.cx=state.doc.width/2;v.cy=state.doc.height/2;}
  const vw=w/v.zoom,vh=h/v.zoom;
  dom.canvas.setAttribute('viewBox',`${v.cx-vw/2} ${v.cy-vh/2} ${vw} ${vh}`);
  $('zoom-label').textContent=`${Math.round(v.zoom*100)}%`;
  $('artboard-size').textContent=`${state.doc.width} × ${state.doc.height} px`;
}
function fitArtboard(){state.view.fit=true;renderView();drawSelectionOutline();}
function zoomAt(factor,point={x:state.view.cx,y:state.view.cy}){
  const v=state.view,old=v.zoom,next=clamp(old*factor,.01,32);
  v.fit=false;v.cx=point.x+(v.cx-point.x)*old/next;v.cy=point.y+(v.cy-point.y)*old/next;v.zoom=next;renderView();drawSelectionOutline();
}
function syncBoards(){if(!state.boards.length)state.boards=[{name:'Artboard 1',document:state.doc,objects:state.objects}];const b=state.boards[state.activeBoard];b.document=state.doc;b.objects=state.objects;return state.boards;}
function selectBoard(index){syncBoards();if(!Number.isInteger(index)||index<0||index>=state.boards.length)return;state.activeBoard=index;const board=state.boards[index];state.doc=board.document;state.objects=board.objects;deselectAll();state.interaction.mode=null;state.view.fit=true;render();setStatus(board.name);}
function addBoard(duplicate=false){syncBoards();if(state.boards.length>=16){setStatus('Maximum 16 artboards per project');return;}pushHistory();const source=state.boards[state.activeBoard],copy=duplicate?deepClone(source.objects):[];const idClone=objects=>objects.forEach(s=>{s.id=nextId();if(s.children)idClone(s.children);});if(duplicate)idClone(copy);let n=state.boards.length+1;while(state.boards.some(b=>b.name===`Artboard ${n}`))n++;state.boards.push({name:duplicate?`${source.name} copy`:`Artboard ${n}`,document:{...source.document},objects:copy});selectBoard(state.boards.length-1);}
function renameBoard(){syncBoards();const b=state.boards[state.activeBoard],name=prompt('Artboard name',b.name);if(name?.trim()){pushHistory();b.name=name.trim().slice(0,100);render();}}
function removeBoard(){syncBoards();if(state.boards.length<=1)return;const i=state.activeBoard,b=state.boards[i];if(!confirm(`Delete ${b.name}? You can undo this.`))return;pushHistory();state.boards.splice(i,1);state.activeBoard=Math.min(i,state.boards.length-1);const next=state.boards[state.activeBoard];state.doc=next.document;state.objects=next.objects;deselectAll();state.view.fit=true;render();}
function renderBoardControls(){const boards=syncBoards(),select=$('artboard-select');select.replaceChildren();boards.forEach((b,i)=>{const opt=document.createElement('option');opt.value=i;opt.textContent=b.name;select.append(opt);});select.value=state.activeBoard;$('delete-artboard-btn').disabled=boards.length<=1;$('add-artboard-btn').disabled=boards.length>=16;$('duplicate-artboard-btn').disabled=boards.length>=16;}

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
  const result={
    ...DEFAULT_STYLE,
    ...(style || {})
  };
  result.gradient=normalizeGradient(result.gradient);
  result.strokeCap=['butt','round','square'].includes(result.strokeCap)?result.strokeCap:'butt';
  result.strokeJoin=['miter','round','bevel'].includes(result.strokeJoin)?result.strokeJoin:'miter';
  result.strokeDash=normalizeDash(result.strokeDash);
  return result;
}

function normalizeDash(value){const parts=String(value||'').trim().split(/[ ,]+/).filter(Boolean).map(Number);return parts.length<=24&&parts.every(n=>Number.isFinite(n)&&n>=0&&n<=10000)&&parts.some(n=>n>0)?parts.join(' '):'';}
function normalizeGradient(g){
  if(!g||!['linear','radial'].includes(g.type)||!Array.isArray(g.stops)||g.stops.length<2)return null;
  const defaults=g.type==='linear'?{x1:0,y1:.5,x2:1,y2:.5}:{cx:.5,cy:.5,r:.5,fx:.5,fy:.5};
  const coords=Object.fromEntries(Object.entries(defaults).map(([k,v])=>[k,Number.isFinite(Number(g.coords?.[k]))?clamp(Number(g.coords[k]),-100,100):v]));if(g.type==='radial')coords.r=Math.max(.001,coords.r);
  return {type:g.type,angle:clamp(Number(g.angle)||0,-360,360),coords,stops:g.stops.slice(0,16).map(s=>({offset:clamp(Number(s.offset)||0,0,100),color:/^#[0-9a-f]{6}$/i.test(s.color)?s.color:'#000000',opacity:clamp(Number.isFinite(Number(s.opacity))?Number(s.opacity):1,0,1)})).sort((a,b)=>a.offset-b.offset)};
}
function gradientId(shape){return 'paint-'+String(shape.id).replace(/[^a-zA-Z0-9_-]/g,'_');}
function gradientNode(shape,g){const el=createSvgElement(g.type==='radial'?'radialGradient':'linearGradient');el.setAttribute('id',gradientId(shape));for(const [k,v] of Object.entries(g.coords))el.setAttribute(k,v);if(g.angle)el.setAttribute('gradientTransform',`rotate(${g.angle} .5 .5)`);for(const s of g.stops){const stop=createSvgElement('stop');stop.setAttribute('offset',`${s.offset}%`);stop.setAttribute('stop-color',s.color);stop.setAttribute('stop-opacity',s.opacity);el.appendChild(stop);}return el;}
function gradientMarkup(shape,g){const tag=g.type==='radial'?'radialGradient':'linearGradient',attrs=Object.entries(g.coords).map(([k,v])=>`${k}="${v}"`).join(' ')+(g.angle?` gradientTransform="rotate(${g.angle} .5 .5)"`:'');return `<${tag} id="${gradientId(shape)}" ${attrs}>${g.stops.map(s=>`<stop offset="${s.offset}%" stop-color="${s.color}" stop-opacity="${s.opacity}"/>`).join('')}</${tag}>`;}

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

// Convert SVG path commands to editable cubic Bézier anchors; preserve each
// subpath independently, including holes and relative coordinates.
function parseEditableContours(d){
  const tokens=String(d).match(/[a-zA-Z]|[-+]?(?:\d*\.\d+|\d+\.?\d*)(?:[eE][-+]?\d+)?/g)||[];
  if(!tokens.length||String(d).replace(/[a-zA-Z]|[-+]?(?:\d*\.\d+|\d+\.?\d*)(?:[eE][-+]?\d+)?|[\s,]/g,'').length)throw Error('Invalid path data');
  const contours=[];let i=0,cmd=null,pos={x:0,y:0},start=null,contour=null,lastC=null,lastQ=null,prev='';
  const letter=t=>/^[a-zA-Z]$/.test(t||'');
  const read=n=>{const values=tokens.slice(i,i+n).map(Number);if(values.length!==n||values.some(v=>!Number.isFinite(v)||Math.abs(v)>1e7))throw Error('Invalid path coordinates');i+=n;return values;};
  const point=(x,y,rel)=>({x:x+(rel?pos.x:0),y:y+(rel?pos.y:0)});
  const anchor=p=>({...p,inHandle:null,outHandle:null});
  function line(p){if(!contour||contour.closed)throw Error('Missing move command');contour.anchors.push(anchor(p));pos=p;}
  function cubic(c1,c2,p){if(!contour||contour.closed)throw Error('Missing move command');contour.anchors.at(-1).outHandle=c1;contour.anchors.push({...anchor(p),inHandle:c2});pos=p;lastC=c2;}
  while(i<tokens.length){
    if(letter(tokens[i]))cmd=tokens[i++];if(!cmd)throw Error('Missing path command');const upper=cmd.toUpperCase(),rel=cmd!==upper;
    if(upper==='Z'){if(!contour||contour.closed)throw Error('Invalid close path');contour.closed=true;pos={...start};cmd=null;prev='Z';lastC=lastQ=null;continue;}
    if(upper==='M'){const [x,y]=read(2);pos=point(x,y,rel);start={...pos};contour={anchors:[anchor(pos)],closed:false};contours.push(contour);cmd=rel?'l':'L';}
    else if(upper==='L'){const [x,y]=read(2);line(point(x,y,rel));}
    else if(upper==='H'){const [x]=read(1);line({x:x+(rel?pos.x:0),y:pos.y});}
    else if(upper==='V'){const [y]=read(1);line({x:pos.x,y:y+(rel?pos.y:0)});}
    else if(upper==='C'){const [x1,y1,x2,y2,x,y]=read(6);cubic(point(x1,y1,rel),point(x2,y2,rel),point(x,y,rel));}
    else if(upper==='S'){const [x2,y2,x,y]=read(4),c1=['C','S'].includes(prev)&&lastC?{x:2*pos.x-lastC.x,y:2*pos.y-lastC.y}:{...pos};cubic(c1,point(x2,y2,rel),point(x,y,rel));}
    else if(upper==='Q'||upper==='T'){let q,p;if(upper==='Q'){const [x1,y1,x,y]=read(4);q=point(x1,y1,rel);p=point(x,y,rel);}else{const [x,y]=read(2);q=['Q','T'].includes(prev)&&lastQ?{x:2*pos.x-lastQ.x,y:2*pos.y-lastQ.y}:{...pos};p=point(x,y,rel);}cubic({x:pos.x+2*(q.x-pos.x)/3,y:pos.y+2*(q.y-pos.y)/3},{x:p.x+2*(q.x-p.x)/3,y:p.y+2*(q.y-p.y)/3},p);lastQ=q;}
    else if(upper==='A'){const [rx,ry,rotation,large,sweep,x,y]=read(7),p=point(x,y,rel);if(![0,1].includes(large)||![0,1].includes(sweep))throw Error('Invalid arc flags');const segments=arcCubics(pos,p,rx,ry,rotation,large,sweep);if(segments.length)for(const seg of segments)cubic(...seg);else if(pos.x!==p.x||pos.y!==p.y)line(p);}
    else throw Error(`Unsupported path command ${cmd}`);
    if(!['C','S'].includes(upper))lastC=null;if(!['Q','T'].includes(upper))lastQ=null;prev=upper;
    if(contours.length>1000||contour?.anchors.length>20000)throw Error('Path too complex');
  }
  return contours.filter(c=>c.anchors.length>0);
}
function arcCubics(from,to,rx,ry,rotation,large,sweep){
  rx=Math.abs(rx);ry=Math.abs(ry);if(!rx||!ry||(from.x===to.x&&from.y===to.y))return [];
  const phi=rotation*Math.PI/180,c=Math.cos(phi),s=Math.sin(phi),dx=(from.x-to.x)/2,dy=(from.y-to.y)/2,xp=c*dx+s*dy,yp=-s*dx+c*dy;
  const scale=Math.sqrt((xp/rx)**2+(yp/ry)**2);if(scale>1){rx*=scale;ry*=scale;}
  const ratio=Math.max(0,(rx*rx*ry*ry-rx*rx*yp*yp-ry*ry*xp*xp)/(rx*rx*yp*yp+ry*ry*xp*xp));const k=(large===sweep?-1:1)*Math.sqrt(ratio),cxp=k*rx*yp/ry,cyp=-k*ry*xp/rx;
  const cx=c*cxp-s*cyp+(from.x+to.x)/2,cy=s*cxp+c*cyp+(from.y+to.y)/2;
  const a=Math.atan2((yp-cyp)/ry,(xp-cxp)/rx),end=Math.atan2((-yp-cyp)/ry,(-xp-cxp)/rx);let delta=end-a;if(sweep&&delta<0)delta+=Math.PI*2;if(!sweep&&delta>0)delta-=Math.PI*2;
  const count=Math.max(1,Math.ceil(Math.abs(delta)/(Math.PI/2))),step=delta/count,out=[];
  const transform=(x,y)=>({x:cx+c*rx*x-s*ry*y,y:cy+s*rx*x+c*ry*y});
  for(let j=0;j<count;j++){const t=a+j*step,u=t+step,b=4/3*Math.tan(step/4);out.push([transform(Math.cos(t)-b*Math.sin(t),Math.sin(t)+b*Math.cos(t)),transform(Math.cos(u)+b*Math.sin(u),Math.sin(u)-b*Math.cos(u)),j===count-1?to:transform(Math.cos(u),Math.sin(u))]);}
  if(out.some(seg=>seg.some(p=>!Number.isFinite(p.x)||!Number.isFinite(p.y))))throw Error('Invalid arc geometry');return out;
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
  if(normalized.type==='text'){
    const g=normalized.geometry||{};normalized.geometry={x:Number(g.x)||0,y:Number(g.y)||0,text:String(g.text??'Type here'),fontSize:clamp(Number(g.fontSize)||36,6,500),fontFamily:String(g.fontFamily||'Arial'),fontWeight:Number(g.fontWeight)===700?700:400,fontStyle:g.fontStyle==='italic'?'italic':'normal',textAlign:['start','middle','end'].includes(g.textAlign)?g.textAlign:'start',letterSpacing:clamp(Number(g.letterSpacing)||0,-20,100),lineHeight:clamp(Number(g.lineHeight)||1.2,.5,4)};
  }
  if(normalized.type==='compound'){
    const g=normalized.geometry||{};normalized.geometry={contours:(g.contours||[]).map(c=>({anchors:(c.anchors||[]).map(a=>({x:Number(a.x)||0,y:Number(a.y)||0,inHandle:a.inHandle||null,outHandle:a.outHandle||null})),closed:c.closed===true})),fillRule:g.fillRule==='nonzero'?'nonzero':'evenodd'};
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
    selection: state.selection,
    activePathId: state.activePathId,boards:syncBoards(),activeBoard:state.activeBoard,grid:state.grid
  });
}

function restoreSnapshot(snapshot) {
  const parsed = JSON.parse(snapshot);
  const oldBoard=state.activeBoard,oldWidth=state.doc.width,oldHeight=state.doc.height;
  if(Array.isArray(parsed.boards)&&parsed.boards.length){state.boards=parsed.boards.map(b=>({name:b.name,document:b.document,objects:adaptShapeArray(b.objects)}));state.activeBoard=clamp(parsed.activeBoard||0,0,state.boards.length-1);state.doc=state.boards[state.activeBoard].document;state.objects=state.boards[state.activeBoard].objects;}else{state.doc={width:clamp(Number(parsed?.doc?.width??1200),64,10000),height:clamp(Number(parsed?.doc?.height??800),64,10000)};state.objects=adaptShapeArray(parsed?.objects||[]);state.boards=[];state.activeBoard=0;}
  if(parsed.grid)state.grid=parsed.grid;if(oldBoard!==state.activeBoard||oldWidth!==state.doc.width||oldHeight!==state.doc.height)state.view.fit=true;
  state.selection = Array.isArray(parsed?.selection) ? parsed.selection.filter(Boolean) : [];
  state.activePathId = typeof parsed?.activePathId === "string" ? parsed.activePathId : null;
  render();
}

function pushHistory() {
  state.history.undo.push(getSnapshot());
  if (state.history.undo.length > 100) {
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
    if (found && found.object.visible !== false&&!found.object.locked) {
      let target=found,blocked=false;while(target.parent){target=getObjectById(target.parent.id);if(target.object.locked||target.object.visible===false){blocked=true;break;}}if(blocked)continue;
      if(state.tool===TOOLS.SELECT)return target.object.id;
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
  node.setAttribute('stroke-linecap',style.strokeCap);node.setAttribute('stroke-linejoin',style.strokeJoin);if(style.strokeDash)node.setAttribute('stroke-dasharray',style.strokeDash);
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
  if(style.gradient){$('paint-defs').appendChild(gradientNode(shape,style.gradient));style.fill=`url(#${gradientId(shape)})`;}

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
  } else if(shape.type==='compound'){
    const node=createSvgElement('path');node.setAttribute('d',shape.geometry.contours.map(c=>buildPathD(c.anchors,c.closed)).join(' '));node.setAttribute('fill-rule',shape.geometry.fillRule||'evenodd');applyPaintAttributes(node,style);group.appendChild(node);
  } else if(shape.type==='text'){
    const g=shape.geometry,node=createSvgElement('text');
    node.setAttribute('x',g.x);node.setAttribute('y',g.y);node.setAttribute('font-size',g.fontSize);node.setAttribute('font-family',g.fontFamily);
    node.setAttribute('font-weight',g.fontWeight||400);node.setAttribute('font-style',g.fontStyle||'normal');node.setAttribute('text-anchor',g.textAlign||'start');node.setAttribute('letter-spacing',g.letterSpacing||0);
    applyPaintAttributes(node,style);
    g.text.split('\n').forEach((line,i)=>{const span=createSvgElement('tspan');span.setAttribute('x',g.x);span.setAttribute('dy',i?`${g.lineHeight||1.2}em`:'0');span.textContent=line||' ';node.appendChild(span);});
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
    group.setAttribute('opacity',String(clamp(style.opacity,0,1)));
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
  const screen = node.getScreenCTM(),canvasMatrix=dom.canvas.getScreenCTM();
  const matrix = screen&&canvasMatrix?canvasMatrix.inverse().multiply(screen):null;
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
      rotateLine.setAttribute("y2", String(round(bounds.y - 24/state.view.zoom)));
      dom.overlay.appendChild(rotateLine);

      const rotateHandle = createSvgElement("circle");
      rotateHandle.setAttribute("class", "transform-handle transform-handle-rotate");
      rotateHandle.setAttribute("cx", String(round(centerX)));
      rotateHandle.setAttribute("cy", String(round(bounds.y - 28/state.view.zoom)));
      rotateHandle.setAttribute("r", String(5/state.view.zoom));
      rotateHandle.dataset.handleType = "rotate";
      rotateHandle.style.cursor = "crosshair";
      dom.overlay.appendChild(rotateHandle);

      for (const [name, config] of Object.entries(SCALE_HANDLE_CONFIG)) {
        const x = bounds.x + bounds.width * config.x;
        const y = bounds.y + bounds.height * config.y;
        const handle = createSvgElement("rect");
        handle.setAttribute("class", "transform-handle transform-handle-scale");
        handle.setAttribute("x", String(round(x - 4/state.view.zoom)));
        handle.setAttribute("y", String(round(y - 4/state.view.zoom)));
        handle.setAttribute("width", String(8/state.view.zoom));
        handle.setAttribute("height", String(8/state.view.zoom));
        handle.setAttribute("rx", String(1/state.view.zoom));
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
      node.setAttribute("r", String((state.directSelection.pathId === path.id && state.directSelection.anchorIndex === index ? 5 : 4)/state.view.zoom));
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
        handleNode.setAttribute("r", String(4/state.view.zoom));
        handleNode.dataset.handlePathId = path.id;
        handleNode.dataset.handleAnchorIndex = String(index);
        handleNode.dataset.handleKind = spec.kind;
        dom.overlay.appendChild(handleNode);
      }
    }
  }
}

const LAYER_ICONS={eye:'<path d="M1 8s2.5-4.5 7-4.5 7 4.5 7 4.5-2.5 4.5-7 4.5S1 8 1 8Z"/><circle cx="8" cy="8" r="2"/>',hidden:'<path d="M2 8s2.5-4 6-4 6 4 6 4M2 2l12 12"/>',lock:'<rect x="3" y="7" width="10" height="7" rx="1"/><path d="M5 7V5a3 3 0 016 0v2"/>',disclose:'<path d="m6 4 4 4-4 4"/>',group:'<rect x="2" y="4" width="11" height="9"/><path d="M4 4V2h10v9"/>',rect:'<rect x="2.5" y="3" width="11" height="10"/>',ellipse:'<ellipse cx="8" cy="8" rx="5.5" ry="4.5"/>',path:'<path d="M2 12C4 1 11 14 14 4"/><rect x="1" y="11" width="2" height="2"/><rect x="13" y="3" width="2" height="2"/>',compound:'<path d="M2 2h12v12H2zM5 5h6v6H5z" fill-rule="evenodd"/>',text:'<path d="M3 3h10M8 3v10M5 13h6"/>',boolean:'<rect x="2" y="2" width="8" height="8"/><circle cx="10" cy="10" r="4"/>'};
const layerIcon=key=>`<svg viewBox="0 0 16 16" aria-hidden="true">${LAYER_ICONS[key]||LAYER_ICONS.path}</svg>`;
function layerDescendants(shape){return [shape.id,...(shape.children||[]).flatMap(layerDescendants)];}
function setAllGroupsExpanded(expanded){const walk=objects=>{for(const shape of objects)if(shape.type==='group'){if(expanded)expandedLayerGroups.add(shape.id);else expandedLayerGroups.delete(shape.id);walk(shape.children||[]);}};walk(state.objects);updateLayersPanel();}
function layerThumbnail(shape){
  const wrapper=document.createElement('span');wrapper.className='layer-thumbnail';wrapper.setAttribute('aria-hidden','true');
  try{
    const signature=JSON.stringify([shape.type,shape.geometry,shape.style,shape.children]);const cached=layerThumbnailCache.get(shape.id);
    let uri=cached?.signature===signature?cached.uri:null;
    if(!uri){const node=dom.scene.querySelector(`[data-object-id="${CSS.escape(shape.id)}"]`);if(node){const box=node.getBBox(),w=Math.max(1,box.width),h=Math.max(1,box.height),pad=Math.max(w,h)*.12;const defs=[];const gather=s=>{const g=normalizeGradient(s.style?.gradient);if(g)defs.push(gradientMarkup(s,g));(s.children||[]).forEach(gather);};gather(shape);const art=shapeToSvgString({...shape,transform:DEFAULT_TRANSFORM,visible:true},'');const svg=`<svg xmlns="http://www.w3.org/2000/svg" viewBox="${box.x-pad} ${box.y-pad} ${w+2*pad} ${h+2*pad}"><defs>${defs.join('')}</defs>${art}</svg>`;if(svg.length<100000)uri='data:image/svg+xml;charset=utf-8,'+encodeURIComponent(svg);}
      if(uri){layerThumbnailCache.set(shape.id,{signature,uri});if(layerThumbnailCache.size>256)layerThumbnailCache.delete(layerThumbnailCache.keys().next().value);}}
    if(uri){const img=document.createElement('img');img.src=uri;img.alt='';wrapper.append(img);return wrapper;}
  }catch{}
  wrapper.innerHTML=layerIcon(shape.type);return wrapper;
}

function updateLayersPanel() {
  const scroll=dom.layers.scrollTop,focused=document.activeElement?.closest?.('.layer-item')?.dataset.layerId;
  dom.layers.replaceChildren();
  const selected=new Set(state.selection),rows=[];let total=0;
  const walk=(shapes,depth,ancestorVisible=true,ancestorLocked=false)=>{
    const ordered=[...shapes].sort((a,b)=>b.zIndex-a.zIndex);
    for(const shape of ordered){const isGroup=shape.type==='group',open=expandedLayerGroups.has(shape.id),visible=ancestorVisible&&shape.visible!==false,locked=ancestorLocked||shape.locked;rows.push({shape,depth,isGroup,open,visible,locked,ancestorLocked,ancestorVisible});if(isGroup&&open)walk(shape.children||[],depth+1,visible,locked);}
  };
  const count=objects=>{for(const shape of objects){total++;if(shape.children)count(shape.children);}};count(state.objects);walk(state.objects,0);
  $('layer-count').textContent=`${total} object${total===1?'':'s'}${state.selection.length?` · ${state.selection.length} selected`:''}`;
  if(!rows.length){const empty=document.createElement('p');empty.className='layers-empty';empty.textContent='Draw an object to begin.';dom.layers.append(empty);}

  for (const row of rows) {
    const {shape,depth,isGroup,open,visible,locked,ancestorLocked,ancestorVisible}=row;
    const item = document.createElement("div");
    item.tabIndex=0;item.setAttribute('role','treeitem');item.setAttribute('aria-label',`${shape.name||shape.type} ${isGroup?'group':'layer'}`);item.setAttribute('aria-level',String(depth+1));item.setAttribute('aria-selected',String(selected.has(shape.id)));if(isGroup)item.setAttribute('aria-expanded',String(open));
    item.className = "layer-item";
    item.dataset.layerId = shape.id;
    item.classList.toggle('is-selected',selected.has(shape.id));item.classList.toggle('is-hidden-layer',!visible);item.classList.toggle('is-locked-layer',locked);item.classList.toggle('is-group',isGroup);
    const descendants=layerDescendants(shape),hasSelection=descendants.some(id=>selected.has(id));
    for(const [prop,label,icon] of [['visible','Visibility',shape.visible!==false?'eye':'hidden'],['locked','Lock',shape.locked?'lock':'']]){
      const button=document.createElement('button');button.type='button';button.className=`layer-icon layer-${prop}`;button.title=`${label}: ${shape.name}`;button.setAttribute('aria-label',button.title);button.setAttribute('aria-pressed',String(prop==='visible'?shape.visible!==false:!!shape.locked));button.innerHTML=icon?layerIcon(icon):'';button.disabled=ancestorLocked;
      button.addEventListener('click',event=>{event.stopPropagation();pushHistory();shape[prop]=prop==='visible'?shape.visible===false:!shape.locked;if(shape.locked||shape.visible===false){const ids=new Set(descendants);state.selection=state.selection.filter(id=>!ids.has(id));if(ids.has(state.activePathId))state.activePathId=null;if(ids.has(state.directSelection.pathId))state.directSelection={pathId:null,anchorIndex:null};}render();});item.append(button);
    }
    const left=document.createElement('span');left.className='layer-name-wrap';left.style.setProperty('--layer-indent',`${Math.min(depth,6)*9}px`);
    if(isGroup){const disclosure=document.createElement('button');disclosure.type='button';disclosure.className='layer-icon layer-disclosure';disclosure.title=`${open?'Collapse':'Expand'} ${shape.name}`;disclosure.setAttribute('aria-label',disclosure.title);disclosure.setAttribute('aria-expanded',String(open));disclosure.innerHTML='<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M5 2.5L13 8 5 13.5Z" fill="currentColor" stroke="none"/></svg>';disclosure.addEventListener('click',event=>{event.stopPropagation();open?expandedLayerGroups.delete(shape.id):expandedLayerGroups.add(shape.id);updateLayersPanel();});left.append(disclosure);}else{const space=document.createElement('span');space.className='layer-disclosure-spacer';left.append(space);}
    left.append(layerThumbnail(shape));const name=document.createElement('span');name.className='layer-name';name.textContent=shape.name||shape.type;name.title=shape.name||shape.type;left.append(name);item.append(left);
    const target=document.createElement('span');target.className='layer-target';target.classList.toggle('is-targeted',selected.has(shape.id));target.classList.toggle('has-selection',hasSelection);target.setAttribute('aria-hidden','true');item.append(target);
    const marker=document.createElement('span');marker.className='layer-selection-marker';marker.classList.toggle('has-selection',hasSelection);marker.setAttribute('aria-hidden','true');item.append(marker);
    if (!locked) {
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
      if(locked||!visible)return;
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
    item.addEventListener('dblclick',event=>{if(event.target.closest('button')||locked)return;event.stopPropagation();const next=prompt('Layer name',shape.name);if(next?.trim()){pushHistory();shape.name=next.trim().slice(0,100);render();}});
    item.addEventListener('keydown',event=>{if(event.target!==item)return;if(event.key==='Enter'||event.key===' '){event.preventDefault();event.stopPropagation();item.click();}else if(isGroup&&['ArrowRight','ArrowLeft'].includes(event.key)){event.preventDefault();event.stopPropagation();event.key==='ArrowRight'?expandedLayerGroups.add(shape.id):expandedLayerGroups.delete(shape.id);updateLayersPanel();}});

    dom.layers.appendChild(item);
  }

  const topLevelSelection = state.selection.filter((id) =>
    state.objects.some((shape) => shape.id === id)
  );
  const hasGroupSelection = topLevelSelection.some((id) => {
    const found = getObjectById(id);
    return found?.object.type === "group";
  });

  dom.groupBtn.disabled = topLevelSelection.length < 2;
  dom.ungroupBtn.disabled = !hasGroupSelection;
  dom.layerForwardBtn.disabled = state.selection.length === 0;
  dom.layerBackwardBtn.disabled = state.selection.length === 0;
  $('rename-layer-btn').disabled=state.selection.length!==1;$('delete-layer-btn').disabled=state.selection.length===0;
  dom.layers.scrollTop=scroll;if(focused)dom.layers.querySelector(`[data-layer-id="${CSS.escape(focused)}"]`)?.focus({preventScroll:true});
}

function render(interactive=false) {
  renderView();
  dom.canvasBackground.setAttribute("width", String(state.doc.width));
  dom.canvasBackground.setAttribute("height", String(state.doc.height));
  const grid=$('studio-grid'),pattern=$('studio-grid-pattern'),spacing=state.grid.size;
  grid.setAttribute('width',state.doc.width);grid.setAttribute('height',state.doc.height);grid.setAttribute('visibility',state.grid.visible?'visible':'hidden');pattern.setAttribute('width',spacing);pattern.setAttribute('height',spacing);$('studio-grid-path').setAttribute('d',`M ${spacing} 0 H 0 V ${spacing}`);
  $('paint-defs').replaceChildren();

  while (dom.scene.firstChild) {
    dom.scene.firstChild.remove();
  }

  const shapes = [...state.objects].sort((a, b) => a.zIndex - b.zIndex);
  for (const shape of shapes) {
    renderShape(shape, dom.scene);
  }

  drawSelectionOutline();
  if(interactive)return;
  renderBoardControls();
  updateLayersPanel();

  if (state.selection.length === 0) {
    dom.selectionSummary.textContent = "No selection";
  } else {
    dom.selectionSummary.textContent = `${state.selection.length} selected`;
  }

  const primary = getPrimarySelectedObject();
  const style = normalizeStyle(primary?.style||state.paint);
  dom.fillInput.value = colorToHex(style.fill, "#90caf9");
  dom.strokeInput.value = colorToHex(style.stroke, "#1976d2");
  dom.strokeWidthInput.value = String(round(clamp(Number(style.strokeWidth) || 0, 0, 64), 2));
  dom.opacityInput.value = String(round(clamp(Number(style.opacity), 0, 1), 2));
  renderGradientInspector(style);
  $('stroke-cap-input').value=style.strokeCap;$('stroke-join-input').value=style.strokeJoin;$('stroke-dash-input').value=style.strokeDash;
  $('grid-toggle-btn').classList.toggle('is-active',state.grid.visible);$('grid-snap-input').checked=state.grid.snap;$('grid-size-input').value=state.grid.size;
  $('corner-properties').hidden=primary?.type!=='rect'||state.selection.length!==1;if(primary?.type==='rect')$('corner-radius-input').value=primary.geometry.rx||0;
  $('fill-none-btn').classList.toggle('is-active',style.fill==='none'&&!style.gradient);
  $('stroke-none-btn').classList.toggle('is-active',style.stroke==='none');
  const text=primary?.type==='text'&&state.selection.length===1?primary:null;
  $('text-properties').hidden=!text;
  if(text){const g=text.geometry;if($('text-content-input').value!==g.text)$('text-content-input').value=g.text;$('font-size-input').value=g.fontSize;$('font-family-input').value=g.fontFamily;$('font-weight-input').value=g.fontWeight||400;$('font-style-input').value=g.fontStyle||'normal';$('text-align-input').value=g.textAlign||'start';$('letter-spacing-input').value=g.letterSpacing||0;$('line-height-input').value=g.lineHeight||1.2;}

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
  const disableArrange = selectionCount < (state.alignTarget==='artboard'?1:2);
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
  $('compound-btn').disabled=topLevelCount<2;$('release-compound-btn').disabled=primary?.type!=='compound'||state.selection.length!==1;
  dom.snapToggleBtn.classList.toggle("is-active", state.snap.enabled);

  dom.docWidth.value = String(state.doc.width);
  dom.docHeight.value = String(state.doc.height);

  clearTimeout(saveTimer);saveTimer=setTimeout(saveDocument,180);
}

function saveDocument(){try{window.localStorage.setItem('svg-editor:studio-project-v2',JSON.stringify(projectPayload()));}catch(error){console.warn('Unable to autosave document',error);setStatus('Autosave storage full; save the editable project manually');}}

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
  state.paint={...state.paint,...patch};
  if (state.selection.length === 0) {
    render();
    return;
  }

  pushHistory();
  for (const id of state.selection) {
    updateShape(id,shape=>{const apply=s=>{if(s.locked)return;if(s.type==='group')s.children.forEach(apply);else s.style={...s.style,...deepClone(patch)};};apply(shape);});
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
  if (entries.length < (state.alignTarget==='artboard'?1:2)) {
    setStatus("Select at least two objects to align");
    return;
  }

  const union = state.alignTarget==='artboard'?{x:0,y:0,width:state.doc.width,height:state.doc.height}:getBoundsForIds(entries.map((entry) => entry.id));
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
  const source=getObjectById(sourceId),target=getObjectById(targetId);
  if(!source||!target||source.parent!==target.parent||source.object.locked||target.object.locked)return;
  const siblings=source.parent?source.parent.children:state.objects;
  const fromIndex=siblings.findIndex(s=>s.id===sourceId),targetIndex=siblings.findIndex(s=>s.id===targetId);
  if (fromIndex < 0 || targetIndex < 0) {
    return;
  }

  // The panel displays topmost first, while the model is bottommost first.
  const destination = placement === "before" ? targetIndex+1 : targetIndex;
  const adjustedDestination = fromIndex < destination ? destination - 1 : destination;
  if (adjustedDestination === fromIndex) {
    return;
  }

  pushHistory();
  const [moved] = siblings.splice(fromIndex, 1);
  siblings.splice(adjustedDestination, 0, moved);
  siblings.forEach((shape,index)=>shape.zIndex=index);
  render();
}

function moveSelectionInLayer(direction) {
  const selectedIds = new Set(state.selection);
  if (selectedIds.size === 0) {
    return;
  }

  pushHistory();

  const reorder=objects=>{if(direction>0){for(let i=objects.length-2;i>=0;i--){if(selectedIds.has(objects[i].id)&&!objects[i].locked&&!selectedIds.has(objects[i+1].id))[objects[i],objects[i+1]]=[objects[i+1],objects[i]];}}else{for(let i=1;i<objects.length;i++){if(selectedIds.has(objects[i].id)&&!objects[i].locked&&!selectedIds.has(objects[i-1].id))[objects[i],objects[i-1]]=[objects[i-1],objects[i]];}}objects.forEach((shape,i)=>{shape.zIndex=i;if(shape.children&&!shape.locked)reorder(shape.children);});};reorder(state.objects);
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
  let groupNumber=1;const usedNames=new Set();const collectNames=objects=>objects.forEach(o=>{usedNames.add(o.name);if(o.children)collectNames(o.children);});collectNames(state.objects);while(usedNames.has(`Group ${groupNumber}`))groupNumber++;

  const groupObject = {
    id: groupId,
    type: "group",
    name: `Group ${groupNumber}`,
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
  state.objects.forEach((shape,index)=>shape.zIndex=index);
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
      style: deepClone(state.paint),
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
      style: deepClone(state.paint),
      geometry: {
        cx: point.x,
        cy: point.y,
        rx: 1,
        ry: 1
      }
    });
  } else if(type===TOOLS.POLYGON||type===TOOLS.STAR){
    addShape({id,type:'path',name:type===TOOLS.STAR?'Star':'Polygon',zIndex,visible:true,locked:false,transform:deepClone(DEFAULT_TRANSFORM),style:deepClone(state.paint),geometry:{anchors:radialAnchors(point,1,0,state.shapeSides,type===TOOLS.STAR),closed:true}});
  } else if(type===TOOLS.LINE||type===TOOLS.PENCIL){
    addShape({id,type:'path',name:type===TOOLS.LINE?'Line':'Pencil path',zIndex,visible:true,locked:false,transform:deepClone(DEFAULT_TRANSFORM),style:{...state.paint,gradient:null,fill:'none',stroke:state.paint.stroke==='none'?'#222222':state.paint.stroke,strokeWidth:Math.max(1,state.paint.strokeWidth)},geometry:{anchors:[{...point,inHandle:null,outHandle:null},{...point,inHandle:null,outHandle:null}],closed:false}});
  }

  state.selection = [id];
  state.interaction.mode = "creating";
  state.interaction.draftId = id;
  state.interaction.start = point;
  setStatus(`Creating ${type}`);
}

function radialAnchors(center,radius,angle,sides,star){const n=star?sides*2:sides;return Array.from({length:n},(_,i)=>{const a=angle+i*Math.PI*2/n,r=star&&i%2?radius*.45:radius;return{x:center.x+Math.cos(a)*r,y:center.y+Math.sin(a)*r,inHandle:null,outHandle:null};});}
function snapPoint(point){const g=state.grid;return g.snap?{x:Math.round(point.x/g.size)*g.size,y:Math.round(point.y/g.size)*g.size}:point;}

function continueCreateShape(point,constrain=false) {
  if (state.interaction.mode !== "creating" || !state.interaction.draftId) {
    return;
  }

  const id = state.interaction.draftId;
  const start = state.interaction.start;
  const found = getObjectById(id);
  if (!found) {
    return;
  }
  if(constrain&&(found.object.type==='rect'||found.object.type==='ellipse')){const d=Math.max(Math.abs(point.x-start.x),Math.abs(point.y-start.y));point={x:start.x+(point.x<start.x?-d:d),y:start.y+(point.y<start.y?-d:d)};}

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
    found.object.geometry.cx=(start.x+point.x)/2;found.object.geometry.cy=(start.y+point.y)/2;
    found.object.geometry.rx = Math.max(1, Math.abs(point.x - start.x)/2);
    found.object.geometry.ry = Math.max(1, Math.abs(point.y - start.y)/2);
  } else if(found.object.type==='path'){
    const anchors=found.object.geometry.anchors;
    if(state.tool===TOOLS.POLYGON||state.tool===TOOLS.STAR){const dx=point.x-start.x,dy=point.y-start.y;found.object.geometry.anchors=radialAnchors(start,Math.max(1,Math.hypot(dx,dy)),constrain?-Math.PI/2:Math.atan2(dy,dx),state.shapeSides,state.tool===TOOLS.STAR);}
    else if(state.tool===TOOLS.LINE){if(constrain){const dx=point.x-start.x,dy=point.y-start.y,a=Math.round(Math.atan2(dy,dx)/(Math.PI/4))*Math.PI/4,r=Math.hypot(dx,dy);point={x:start.x+Math.cos(a)*r,y:start.y+Math.sin(a)*r};}anchors[1]={...point,inHandle:null,outHandle:null};}
    else if(Math.hypot(point.x-anchors.at(-1).x,point.y-anchors.at(-1).y)>2/state.view.zoom){anchors.push({...point,inHandle:null,outHandle:null});}
  }
}

function finishCreateShape() {
  if (state.interaction.mode !== "creating") {
    return;
  }
  state.interaction.mode = null;
  state.interaction.draftId = null;
  state.interaction.start = null;
  state.interaction.pointerId=null;
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

  if(state.grid.snap&&!event.altKey&&state.interaction.startSelectionBounds){const b=state.interaction.startSelectionBounds,p=snapPoint({x:b.x+dx,y:b.y+dy});dx=p.x-b.x;dy=p.y-b.y;state.interaction.snapGuides=[];}
  else if (state.snap.enabled && !event.altKey) {
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
        ...deepClone(state.paint),
        fill: "none", stroke:state.paint.stroke==='none'?'#222222':state.paint.stroke, strokeWidth:Math.max(1,state.paint.strokeWidth)
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
  if(event.button===1||spaceDown||state.tool===TOOLS.HAND){if(event.button!==0&&event.button!==1)return;event.preventDefault();dom.canvas.focus();dom.canvas.setPointerCapture(event.pointerId);state.interaction.mode='panning';state.interaction.pointerId=event.pointerId;state.interaction.start={x:event.clientX,y:event.clientY,cx:state.view.cx,cy:state.view.cy};state.view.fit=false;return;}
  if (event.button !== 0) {
    return;
  }

  dom.canvas.focus();
  event.preventDefault();

  const point = svgPointFromEvent(event);
  if(state.tool===TOOLS.ZOOM){zoomAt(event.altKey?1/1.5:1.5,point);return;}
  dom.canvas.setPointerCapture(event.pointerId);
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

  if ([TOOLS.RECT,TOOLS.ELLIPSE,TOOLS.LINE,TOOLS.PENCIL,TOOLS.POLYGON,TOOLS.STAR].includes(state.tool)) {
    beginCreateShape(state.tool, snapPoint(point));
    state.interaction.pointerId=event.pointerId;
    render();
    return;
  }

  if (state.tool === TOOLS.PEN) {
    const anchor=snapPoint(point);beginOrExtendPath(anchor);
    if(state.activePathId){state.interaction.mode='pen-handle';state.interaction.pointerId=event.pointerId;state.interaction.start=anchor;}
    return;
  }
  if(state.tool===TOOLS.TEXT){pushHistory();const id=nextId();addShape({id,type:'text',name:'Text',zIndex:state.objects.length,visible:true,locked:false,transform:deepClone(DEFAULT_TRANSFORM),style:{...state.paint,fill:state.paint.fill==='none'||state.paint.fill===DEFAULT_STYLE.fill?'#222222':state.paint.fill,stroke:'none'},geometry:{x:point.x,y:point.y,text:'Type here',fontSize:36,fontFamily:'Arial'}});state.selection=[id];textEditing=false;render();$('text-content-input').focus();$('text-content-input').select();return;}

  if (state.tool === TOOLS.SELECT || state.tool === TOOLS.DIRECT) {
    if (found && !found.object.locked) {
      if (event.shiftKey) {
        if (state.selection.includes(found.object.id)) {
          state.selection = state.selection.filter((id) => id !== found.object.id);
        } else {
          state.selection = [...state.selection, found.object.id];
        }
      } else if(!state.selection.includes(found.object.id)) {
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
  if(state.interaction.mode==='panning'){const s=state.interaction.start;state.view.cx=s.cx-(event.clientX-s.x)/state.view.zoom;state.view.cy=s.cy-(event.clientY-s.y)/state.view.zoom;renderView();return;}
  const point = svgPointFromEvent(event);
  if(state.interaction.mode==='pen-handle'){
    const s=state.interaction.start,found=getObjectById(state.activePathId),a=found?.object.geometry.anchors.at(-1);
    if(a&&Math.hypot(point.x-s.x,point.y-s.y)>3/state.view.zoom){a.outHandle={...point};a.inHandle={x:2*a.x-point.x,y:2*a.y-point.y};render(true);}return;
  }

  if (state.interaction.mode === "marquee-select") {
    state.interaction.marqueeCurrent = point;
    drawSelectionOutline();
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
    render(true);
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
    render(true);
    return;
  }

  if (state.interaction.mode === "creating") {
    continueCreateShape(state.tool===TOOLS.PENCIL?point:snapPoint(point),event.shiftKey);
    render(true);
    return;
  }

  if (state.interaction.mode === "moving") {
    continueMoveSelection(point, event);
    render(true);
    return;
  }

  if (state.interaction.mode === "scaling" || state.interaction.mode === "rotating") {
    continueHandleTransform(point, event.shiftKey);
    render(true);
  }
}

function pointerUpOnCanvas() {
  if(state.interaction.mode==='panning'||state.interaction.mode==='pen-handle'){const pen=state.interaction.mode==='pen-handle';state.interaction.mode=null;state.interaction.pointerId=null;state.interaction.start=null;if(pen)render();else saveDocument();return;}
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
  const computedFill = shape.type === "path" && !shape.geometry.closed ? "none" : style.gradient?`url(#${gradientId(shape)})`:style.fill || "none";
  const computedStroke = style.stroke || "none";
  const computedStrokeWidth = round(clamp(Number(style.strokeWidth) || 0, 0, 999), 3);
  const computedOpacity = round(clamp(Number(style.opacity), 0, 1), 3);

  if (computedFill === "none") {
    styleAttributes.push(`fill="none"`);
  } else {
    styleAttributes.push(`fill="${computedFill}"`);
  }

  if (computedStroke && computedStroke !== "none" && computedStrokeWidth > 0) {
    styleAttributes.push(`stroke="${computedStroke}"`);
    styleAttributes.push(`stroke-width="${computedStrokeWidth}"`);
    if(style.strokeCap!=='butt')styleAttributes.push(`stroke-linecap="${style.strokeCap}"`);
    if(style.strokeJoin!=='miter')styleAttributes.push(`stroke-linejoin="${style.strokeJoin}"`);
    if(style.strokeDash)styleAttributes.push(`stroke-dasharray="${style.strokeDash}"`);
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
  if(shape.type==='compound')return `${indent}<path d="${shape.geometry.contours.map(c=>buildPathD(c.anchors,c.closed)).join(' ')}" fill-rule="${shape.geometry.fillRule||'evenodd'}" ${styleAttributes.join(' ')}${transformAttribute} />`;
  if(shape.type==='text'){
    const g=shape.geometry,esc=s=>String(s).replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;');
    const spans=g.text.split('\n').map((line,i)=>`<tspan x="${round(g.x)}" dy="${i?`${g.lineHeight||1.2}em`:'0'}">${esc(line||' ')}</tspan>`).join('');
    return `${indent}<text x="${round(g.x)}" y="${round(g.y)}" font-size="${round(g.fontSize)}" font-family="${esc(g.fontFamily)}" font-weight="${g.fontWeight||400}" font-style="${g.fontStyle||'normal'}" text-anchor="${g.textAlign||'start'}" letter-spacing="${g.letterSpacing||0}" ${styleAttributes.join(' ')}${transformAttribute}>${spans}</text>`;
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
    return `${indent}<g${transformAttribute}${computedOpacity!==1?` opacity="${computedOpacity}"`:''}>\n${childLines}\n${indent}</g>`;
  }

  return "";
}

function exportSvgString() {
  const ordered = [...state.objects].sort((a, b) => a.zIndex - b.zIndex);
  const defs=[];function gather(shapes){for(const shape of shapes){if(!shape.visible)continue;const g=normalizeGradient(shape.style?.gradient);if(g&&shape.type!=='group'&&!(shape.type==='path'&&!shape.geometry.closed))defs.push(gradientMarkup(shape,g));if(shape.children)gather(shape.children);}}gather(ordered);
  const lines = ordered.map((shape) => shapeToSvgString(shape, "  ")).filter(Boolean);
  return [
    "<?xml version=\"1.0\" encoding=\"UTF-8\"?>",
    `<svg xmlns=\"http://www.w3.org/2000/svg\" width=\"${round(state.doc.width)}\" height=\"${round(state.doc.height)}\" viewBox=\"0 0 ${round(state.doc.width)} ${round(state.doc.height)}\">`,
    ...(defs.length?[`  <defs>${defs.join('')}</defs>`]:[]),
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
  a.download = `${activeBoardFilename()}.svg`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(()=>URL.revokeObjectURL(url),1000);
}
function activeBoardFilename(){return (syncBoards()[state.activeBoard].name.toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'')||'art');}

async function downloadPng(){
  const w=Math.round(state.doc.width),h=Math.round(state.doc.height);if(w*h>25000000){setStatus('PNG export exceeds 25 megapixels');return;}
  const url=URL.createObjectURL(new Blob([exportSvgString()],{type:'image/svg+xml'}));
  const filename=activeBoardFilename();try{const image=new Image();await new Promise((resolve,reject)=>{image.onload=resolve;image.onerror=reject;image.src=url;});const canvas=document.createElement('canvas');canvas.width=w;canvas.height=h;canvas.getContext('2d').drawImage(image,0,0,w,h);const blob=await new Promise(resolve=>canvas.toBlob(resolve,'image/png'));if(!blob)throw Error('PNG encoding failed');const download=URL.createObjectURL(blob),a=document.createElement('a');a.href=download;a.download=`${filename}.png`;a.click();setTimeout(()=>URL.revokeObjectURL(download),1000);setStatus('PNG exported');}catch{setStatus('PNG export failed');}finally{URL.revokeObjectURL(url);}
}

function projectPayload(){return {format:'philstudio-v2',boards:syncBoards(),activeBoard:state.activeBoard,grid:state.grid};}
function saveProject(){const url=URL.createObjectURL(new Blob([JSON.stringify(projectPayload(),null,2)],{type:'application/json'}));const a=document.createElement('a');a.href=url;a.download='art.phstudio';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);setStatus('Editable project saved');}
function decodeProject(raw){
  if(raw?.format==='philstudio-v2'){
    if(!Array.isArray(raw.boards)||!raw.boards.length||raw.boards.length>16)throw Error('Invalid project artboards');
    const boards=raw.boards.map((b,i)=>{const p=decodeProject({format:'philstudio-v1',document:b.document,objects:b.objects,grid:raw.grid});return{name:String(b.name||`Artboard ${i+1}`).slice(0,100),document:p.document,objects:p.objects};});const activeBoard=clamp(Math.round(Number(raw.activeBoard)||0),0,boards.length-1),grid={visible:raw.grid?.visible===true,snap:raw.grid?.snap===true,size:clamp(Number(raw.grid?.size)||20,2,500)};return{boards,activeBoard,grid};
  }
  if(raw?.format!=='philstudio-v1'||!Array.isArray(raw.objects))throw Error('Unsupported project format');
  const num=(v,min=-1e7,max=1e7)=>{if(typeof v!=='number'||!Number.isFinite(v)||v<min||v>max)throw Error('Invalid project number');return v;};
  const color=v=>{if(typeof v==='string'&&(/^(?:#[a-fA-F0-9]{3,4}|#[a-fA-F0-9]{6}(?:[a-fA-F0-9]{2})?|none|transparent)$/.test(v)))return v;if(typeof v==='string'&&/^(?:\w+|rgba?\([\d.,%\s]+\))$/.test(v))return colorToHex(v);throw Error('Invalid project color');};
  const shapeTypes=new Set(['rect','ellipse','path','compound','text','group','boolean']);let count=0;const point=p=>({x:num(p.x),y:num(p.y)});
  function contour(c){if(!Array.isArray(c.anchors)||c.anchors.length>20000)throw Error('Invalid project anchors');return {anchors:c.anchors.map(a=>({...point(a),inHandle:a.inHandle?point(a.inHandle):null,outHandle:a.outHandle?point(a.outHandle):null})),closed:c.closed===true};}
  function read(s,z,depth){
    if(!s||!shapeTypes.has(s.type)||++count>5000||depth>32)throw Error('Unsupported or oversized project');const t=s.transform||DEFAULT_TRANSFORM,g=s.geometry||{},style=normalizeStyle(s.style);style.fill=color(style.fill);style.stroke=color(style.stroke);style.strokeWidth=num(style.strokeWidth,0,10000);style.opacity=num(style.opacity,0,1);
    const out={id:nextId(),type:s.type,name:String(s.name||s.type).slice(0,100),zIndex:z,visible:s.visible!==false,locked:s.locked===true,transform:{tx:num(t.tx),ty:num(t.ty),sx:num(t.sx,-10000,10000),sy:num(t.sy,-10000,10000),rotation:num(t.rotation)},style,geometry:{}};
    if(s.type==='rect')out.geometry={x:num(g.x),y:num(g.y),width:num(g.width,0),height:num(g.height,0),rx:num(g.rx||0,0),ry:num(g.ry||0,0)};
    else if(s.type==='ellipse')out.geometry={cx:num(g.cx),cy:num(g.cy),rx:num(g.rx,0),ry:num(g.ry,0)};
    else if(s.type==='path')out.geometry=contour(g);
    else if(s.type==='compound'){if(!Array.isArray(g.contours)||g.contours.length>1000)throw Error('Invalid compound contours');out.geometry={contours:g.contours.map(contour),fillRule:g.fillRule==='nonzero'?'nonzero':'evenodd'};}
    else if(s.type==='text')out.geometry={x:num(g.x),y:num(g.y),text:String(g.text||'').slice(0,100000),fontSize:num(g.fontSize,6,500),fontFamily:String(g.fontFamily||'Arial').slice(0,100),fontWeight:g.fontWeight===700?700:400,fontStyle:g.fontStyle==='italic'?'italic':'normal',textAlign:['start','middle','end'].includes(g.textAlign)?g.textAlign:'start',letterSpacing:num(g.letterSpacing||0,-20,100),lineHeight:num(g.lineHeight||1.2,.5,4)};
    else if(s.type==='group'){if(!Array.isArray(s.children))throw Error('Invalid group');out.children=s.children.map((child,i)=>read(child,i,depth+1));}
    else if(s.type==='boolean'){if(!['unite','subtract','intersect'].includes(g.op))throw Error('Invalid boolean operation');const path=d=>parseEditableContours(d).map(c=>buildPathD(c.anchors,c.closed)).join(' ');out.geometry={op:g.op,aPath:path(g.aPath),bPath:path(g.bPath),bounds:{x:num(g.bounds.x),y:num(g.bounds.y),width:num(g.bounds.width,0),height:num(g.bounds.height,0)}};}
    return out;
  }
  const document={width:num(raw.document?.width,1,10000),height:num(raw.document?.height,1,10000)},objects=raw.objects.map((s,i)=>read(s,i,0));return{document,objects,grid:{visible:raw.grid?.visible===true,snap:raw.grid?.snap===true,size:clamp(Number(raw.grid?.size)||20,2,500)}};
}
function installProject(p){state.boards=p.boards||[{name:'Artboard 1',document:p.document,objects:p.objects}];state.activeBoard=p.activeBoard||0;const b=state.boards[state.activeBoard];state.doc=b.document;state.objects=b.objects;state.grid=p.grid;deselectAll();state.view.fit=true;}
function openProject(source){const p=decodeProject(JSON.parse(source));pushHistory();installProject(p);render();setStatus('Editable project opened');}

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

  try{const project=window.localStorage.getItem('svg-editor:studio-project-v2');if(project){installProject(decodeProject(JSON.parse(project)));return;}}catch(error){console.warn('Unable to restore project',error);}
  try{const size=JSON.parse(window.localStorage.getItem('svg-editor:document-size')||'null');if(size){state.doc.width=clamp(Number(size.width)||1200,64,10000);state.doc.height=clamp(Number(size.height)||800,64,10000);}}catch{}
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
  const remove=objects=>objects.filter(shape=>!selected.has(shape.id)||shape.locked).map(shape=>shape.type==='group'?{...shape,children:remove(shape.children||[])}:shape);
  state.objects=remove(state.objects);
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

  setTool(button.dataset.tool);
}

function setTool(nextTool){
  if (!nextTool || !Object.values(TOOLS).includes(nextTool)) {
    return;
  }

  if (state.tool === TOOLS.PEN && nextTool !== TOOLS.PEN) {
    finishActivePathIfAny(false);
  }
  if(state.tool!==TOOLS.PEN&&nextTool===TOOLS.PEN)state.activePathId=null;

  if (state.interaction.mode === "marquee-select") {
    state.interaction.mode = null;
    state.interaction.pointerId = null;
    resetMarqueeInteractionState();
  }
  state.interaction.snapGuides = [];
  state.interaction.startSelectionBounds = null;

  state.tool = nextTool;
  applyToolButtonState();
  drawSelectionOutline();
  dom.canvas.style.cursor=nextTool===TOOLS.HAND?'grab':nextTool===TOOLS.ZOOM?'zoom-in':nextTool===TOOLS.TEXT?'text':nextTool===TOOLS.SELECT||nextTool===TOOLS.DIRECT?'default':'crosshair';
  setStatus(`Tool: ${nextTool}`);
}

function copyObjects(){clipboardObjects=deepClone(state.objects.filter(s=>state.selection.includes(s.id)&&!s.locked));setStatus(`${clipboardObjects.length} object(s) copied`);}
function pasteObjects(){if(!clipboardObjects.length)return;pushHistory();const fresh=(s)=>({...deepClone(s),id:nextId(),locked:false,...(s.children?{children:s.children.map(fresh)}:{})});const copies=clipboardObjects.map(s=>{const c=fresh(s);c.transform.tx+=12;c.transform.ty+=12;c.zIndex=state.objects.length;addShape(c);return c.id;});state.selection=copies;state.activePathId=null;render();setStatus('Objects pasted');}
function duplicateSelection(){copyObjects();pasteObjects();}
function renameSelection(){const s=getPrimarySelectedObject();if(!s||s.locked)return;const name=prompt('Layer name',s.name);if(name?.trim()){pushHistory();s.name=name.trim().slice(0,100);render();}}
function changeText(patch){const s=getPrimarySelectedObject();if(s?.type!=='text'||s.locked)return;pushHistory();Object.assign(s.geometry,patch);render();}
function makeCompound(){
  const selected=state.objects.filter(s=>state.selection.includes(s.id)&&!s.locked);if(selected.length<2)return;
  const contours=[];for(const s of selected){const path=shapeToWorldPathData(s);if(!path||!['rect','ellipse','path'].includes(s.type)||(s.type==='path'&&!s.geometry.closed)){setStatus('Compound paths require closed shapes');return;}contours.push(...parseEditableContours(path.d));}
  pushHistory();const id=nextId(),top=selected.at(-1);state.objects=state.objects.filter(s=>!selected.includes(s));addShape({id,type:'compound',name:'Compound path',zIndex:top.zIndex,visible:true,locked:false,style:deepClone(top.style),transform:deepClone(DEFAULT_TRANSFORM),geometry:{contours,fillRule:'evenodd'}});state.selection=[id];render();setStatus('Compound path created');
}
function releaseCompound(){const s=getPrimarySelectedObject();if(s?.type!=='compound'||s.locked)return;pushHistory();state.objects=state.objects.filter(o=>o.id!==s.id);state.selection=s.geometry.contours.map((c,i)=>{const id=nextId();addShape({id,type:'path',name:`Contour ${i+1}`,zIndex:s.zIndex+i,visible:true,locked:false,style:deepClone(s.style),transform:deepClone(s.transform),geometry:deepClone(c)});return id;});render();setStatus('Compound contours released');}

function currentPaint(){return normalizeStyle(getPrimarySelectedObject()?.style||state.paint);}
function defaultGradient(type='linear'){return {type,angle:0,stops:[{offset:0,color:colorToHex(currentPaint().fill,'#90caf9'),opacity:1},{offset:100,color:'#17283f',opacity:1}]};}
function updateGradient(fn){const g=deepClone(currentPaint().gradient||defaultGradient());fn(g);applyStyleToSelection({gradient:normalizeGradient(g)});}
function renderGradientInspector(style){
  const g=style.gradient;$('gradient-type-input').value=g?.type||'none';$('gradient-angle-input').value=g?.angle||0;$('gradient-angle-input').disabled=g?.type!=='linear';$('gradient-add-stop').disabled=!g||g.stops.length>=16;
  $('gradient-sample').style.background=g?`${g.type==='linear'?`linear-gradient(${90+g.angle}deg`:'radial-gradient(circle'} , ${g.stops.map(s=>`${s.color}${Math.round(s.opacity*255).toString(16).padStart(2,'0')} ${s.offset}%`).join(', ')})`:style.fill==='none'?'transparent':style.fill;
  const list=$('gradient-stops');list.replaceChildren();if(!g)return;
  g.stops.forEach((s,i)=>{const row=document.createElement('div');row.className='gradient-stop';const color=document.createElement('input');color.type='color';color.value=s.color;color.setAttribute('aria-label',`Stop ${i+1} color`);const pos=document.createElement('input');pos.type='number';pos.min=0;pos.max=100;pos.value=s.offset;pos.title='Position (%)';pos.setAttribute('aria-label',`Stop ${i+1} position`);const op=document.createElement('input');op.type='number';op.min=0;op.max=100;op.value=Math.round(s.opacity*100);op.title='Opacity (%)';op.setAttribute('aria-label',`Stop ${i+1} opacity`);const del=document.createElement('button');del.type='button';del.textContent='×';del.className='text-button';del.disabled=g.stops.length<=2;del.setAttribute('aria-label',`Remove stop ${i+1}`);color.addEventListener('change',()=>updateGradient(x=>x.stops[i].color=color.value));pos.addEventListener('change',()=>updateGradient(x=>x.stops[i].offset=Number(pos.value)));op.addEventListener('change',()=>updateGradient(x=>x.stops[i].opacity=Number(op.value)/100));del.addEventListener('click',()=>updateGradient(x=>x.stops.splice(i,1)));row.append(color,pos,op,del);list.append(row);});
}
function buildSwatches(){for(const color of ['#000000','#ffffff','#777777','#da3b42','#eaa64b','#f0dc50','#65b458','#2db8bc','#4f83db','#764cb8','#e08ab5','#9c714b']){const b=document.createElement('button');b.type='button';b.style.background=color;b.title=`Fill ${color} (Shift: stroke)`;b.setAttribute('aria-label',b.title);b.addEventListener('click',e=>applyStyleToSelection(e.shiftKey?{stroke:color}:{fill:color,gradient:null}));$('swatches').append(b);}}

// Parse only the editable SVG primitives this object model supports. Never
// insert imported markup into the page. Unsupported effects fail explicitly.
function importSvg(source){
  const parsed=new DOMParser().parseFromString(source,'image/svg+xml'),root=parsed.documentElement;
  if(root.localName!=='svg'||parsed.querySelector('parsererror'))throw Error('Invalid SVG document');
  const supported=new Set(['rect','ellipse','circle','line','polyline','polygon','path','text','g']);
  const number=(el,key,fallback=0)=>{const value=el.getAttribute(key);if(value===null)return fallback;const n=Number(value);if(!Number.isFinite(n))throw Error(`Unsupported ${key} value`);return n;};
  const paint=(value,fallback)=>{if(value===null)return fallback;if(value==='none'||value==='transparent')return value;if(/^#[0-9a-f]{3,4}$/i.test(value))return '#'+[...value.slice(1)].map(c=>c+c).join('');if(/^#[0-9a-f]{6}(?:[0-9a-f]{2})?$/i.test(value))return value;if(!/^\w+$/.test(value)&&!/^rgba?\([\d.,%\s]+\)$/i.test(value))throw Error('Unsupported paint');return colorToHex(value,fallback);};
  const fraction=(value,fallback)=>{if(value===null)return fallback;const v=value.endsWith('%')?Number(value.slice(0,-1))/100:Number(value);if(!Number.isFinite(v))throw Error('Invalid gradient coordinate');return v;};
  const gradients=new Map();for(const defs of [...root.children].filter(c=>c.localName==='defs'))for(const el of defs.children){
    if(!['linearGradient','radialGradient'].includes(el.localName))throw Error(`Unsupported definition: ${el.localName}`);
    const id=el.getAttribute('id'),type=el.localName==='linearGradient'?'linear':'radial';if(!id||gradients.has(id)||el.hasAttribute('href')||el.hasAttribute('xlink:href')||!['objectBoundingBox',null].includes(el.getAttribute('gradientUnits'))||!['pad',null].includes(el.getAttribute('spreadMethod')))throw Error('Unsupported gradient definition');
    const tx=el.getAttribute('gradientTransform');let angle=0;if(tx){const m=tx.match(/^rotate\(([-+\d.]+)[ ,]+(?:0?\.5)[ ,]+(?:0?\.5)\)$/);if(!m)throw Error('Unsupported gradient transform');angle=Number(m[1]);}
    let coords;if(type==='linear')coords={x1:fraction(el.getAttribute('x1'),0),y1:fraction(el.getAttribute('y1'),0),x2:fraction(el.getAttribute('x2'),1),y2:fraction(el.getAttribute('y2'),0)};else{const cx=fraction(el.getAttribute('cx'),.5),cy=fraction(el.getAttribute('cy'),.5);coords={cx,cy,r:fraction(el.getAttribute('r'),.5),fx:fraction(el.getAttribute('fx'),cx),fy:fraction(el.getAttribute('fy'),cy)};}
    const stops=[...el.children].map(s=>{if(s.localName!=='stop'||s.hasAttribute('style'))throw Error('Unsupported gradient stop');return{offset:fraction(s.getAttribute('offset'),0)*100,color:colorToHex(paint(s.getAttribute('stop-color'),'#000000')),opacity:number(s,'stop-opacity',1)};});if(stops.length<2||stops.length>16)throw Error('Gradient requires 2–16 stops');gradients.set(id,normalizeGradient({type,angle,coords,stops}));
  }
  function read(el,z,inherited){
    const tag=el.localName;if(!supported.has(tag))throw Error(`Unsupported SVG element: ${tag}`);
    if(el.hasAttribute('style')||el.hasAttribute('clip-path')||el.hasAttribute('mask')||el.hasAttribute('filter')||el.hasAttribute('class'))throw Error('SVG contains unsupported effects or CSS styles');
    const rawTransform=el.getAttribute('transform')||'';if(rawTransform&&!/^(?:\s*(?:translate|rotate|scale)\s*\([-+\d.eE,\s]+\)\s*)+$/.test(rawTransform))throw Error('Unsupported transform');
    const fill=el.getAttribute('fill'),ref=fill?.match(/^url\(#([\w.:-]+)\)$/);if(ref&&!gradients.has(ref[1]))throw Error('Unknown gradient reference');
    const style={fill:ref?'#000000':paint(fill,inherited.fill),gradient:ref?deepClone(gradients.get(ref[1])):fill===null?deepClone(inherited.gradient||null):null,stroke:paint(el.getAttribute('stroke'),inherited.stroke),strokeWidth:number(el,'stroke-width',inherited.strokeWidth),opacity:number(el,'opacity',1),strokeCap:el.getAttribute('stroke-linecap')||inherited.strokeCap,strokeJoin:el.getAttribute('stroke-linejoin')||inherited.strokeJoin,strokeDash:el.getAttribute('stroke-dasharray')||inherited.strokeDash};
    const shape={id:nextId(),type:tag,name:tag,zIndex:z,visible:true,locked:false,transform:parseLegacyTransform(rawTransform),style,geometry:{}};
    const anchor=(x,y)=>({x,y,inHandle:null,outHandle:null});
    if(tag==='rect')shape.geometry={x:number(el,'x'),y:number(el,'y'),width:Math.max(1,number(el,'width')),height:Math.max(1,number(el,'height')),rx:number(el,'rx'),ry:number(el,'ry')};
    else if(tag==='ellipse'||tag==='circle'){shape.type='ellipse';shape.geometry={cx:number(el,'cx'),cy:number(el,'cy'),rx:Math.max(1,number(el,tag==='circle'?'r':'rx')),ry:Math.max(1,number(el,tag==='circle'?'r':'ry'))};}
    else if(tag==='line'){shape.type='path';shape.geometry={anchors:[anchor(number(el,'x1'),number(el,'y1')),anchor(number(el,'x2'),number(el,'y2'))],closed:false};}
    else if(tag==='polygon'||tag==='polyline'){const pts=(el.getAttribute('points')||'').trim().split(/[ ,\s]+/).map(Number);if(pts.length<4||pts.length%2||pts.some(n=>!Number.isFinite(n)))throw Error('Invalid polygon points');shape.type='path';shape.geometry={anchors:pts.filter((_,i)=>i%2===0).map((x,i)=>anchor(x,pts[i*2+1])),closed:tag==='polygon'};}
    else if(tag==='path'){const contours=parseEditableContours(el.getAttribute('d')||'');if(!contours.length)throw Error('Invalid path');if(contours.length===1){shape.geometry=contours[0];}else{shape.type='compound';shape.geometry={contours,fillRule:el.getAttribute('fill-rule')==='evenodd'?'evenodd':'nonzero'};}}
    else if(tag==='text'){if([...el.children].some(c=>c.localName!=='tspan'))throw Error('Unsupported text layout');const leading=el.children[1]?.getAttribute('dy')?.match(/^([\d.]+)em$/);shape.geometry={x:number(el,'x'),y:number(el,'y'),text:el.children.length?[...el.children].map(c=>c.textContent).join('\n'):el.textContent,fontSize:number(el,'font-size',36),fontFamily:el.getAttribute('font-family')||'Arial',fontWeight:el.getAttribute('font-weight')==='bold'?700:number(el,'font-weight',400),fontStyle:el.getAttribute('font-style'),textAlign:el.getAttribute('text-anchor'),letterSpacing:number(el,'letter-spacing',0),lineHeight:leading?Number(leading[1]):1.2};}
    else {shape.type='group';shape.children=[...el.children].filter(c=>!['title','desc','metadata'].includes(c.localName)).map((c,i)=>read(c,i,style));}
    return normalizeCanonicalShape(shape,z);
  }
  const vb=(root.getAttribute('viewBox')||'').trim().split(/[ ,\s]+/).map(Number);let width,height,originX=0,originY=0;
  if(vb.length===4&&vb.every(Number.isFinite)){[originX,originY,width,height]=vb;}else{width=number(root,'width',1200);height=number(root,'height',800);}
  if(!(width>0&&height>0&&width<=10000&&height<=10000))throw Error('Unsupported SVG dimensions');
  const objects=[...root.children].filter(c=>!['title','desc','metadata','defs'].includes(c.localName)).map((c,i)=>read(c,i,{fill:paint(root.getAttribute('fill'),'#000000'),stroke:paint(root.getAttribute('stroke'),'none'),strokeWidth:number(root,'stroke-width',1),opacity:1}));
  for(const shape of objects){shape.transform.tx-=originX;shape.transform.ty-=originY;}
  pushHistory();state.doc={width,height};state.objects=objects;deselectAll();fitArtboard();render();setStatus(`Imported ${objects.length} editable object(s)`);
}

function bindEvents() {
  dom.toolGroup.addEventListener("click", handleToolGroupClick);

  dom.canvas.addEventListener("pointerdown", pointerDownOnCanvas);
  dom.canvas.addEventListener("pointermove", pointerMoveOnCanvas);
  dom.canvas.addEventListener("pointerup", pointerUpOnCanvas);
  dom.canvas.addEventListener("pointercancel", pointerUpOnCanvas);
  dom.canvas.addEventListener('wheel',event=>{event.preventDefault();if(event.shiftKey){state.view.fit=false;state.view.cx+=event.deltaY/state.view.zoom;renderView();}else zoomAt(Math.exp(-event.deltaY*.0015),svgPointFromEvent(event));},{passive:false});
  $('zoom-in-btn').addEventListener('click',()=>zoomAt(1.25));$('zoom-out-btn').addEventListener('click',()=>zoomAt(.8));$('fit-btn').addEventListener('click',fitArtboard);$('actual-size-btn').addEventListener('click',()=>zoomAt(1/state.view.zoom));
  $('fill-none-btn').addEventListener('click',()=>applyStyleToSelection({fill:'none',gradient:null}));$('stroke-none-btn').addEventListener('click',()=>applyStyleToSelection({stroke:'none'}));
  $('gradient-type-input').addEventListener('change',()=>{const type=$('gradient-type-input').value;applyStyleToSelection({gradient:type==='none'?null:{...(currentPaint().gradient||defaultGradient(type)),type}});});
  $('gradient-angle-input').addEventListener('change',()=>updateGradient(g=>g.angle=Number($('gradient-angle-input').value)));
  $('gradient-add-stop').addEventListener('click',()=>updateGradient(g=>{if(g.stops.length>=16)return;let index=0;for(let i=1;i<g.stops.length-1;i++)if(g.stops[i+1].offset-g.stops[i].offset>g.stops[index+1].offset-g.stops[index].offset)index=i;const a=g.stops[index],b=g.stops[index+1];g.stops.push({offset:Math.round((a.offset+b.offset)/2),color:a.color,opacity:(a.opacity+b.opacity)/2});}));
  $('stroke-cap-input').addEventListener('change',()=>applyStyleToSelection({strokeCap:$('stroke-cap-input').value}));$('stroke-join-input').addEventListener('change',()=>applyStyleToSelection({strokeJoin:$('stroke-join-input').value}));$('stroke-dash-input').addEventListener('change',()=>applyStyleToSelection({strokeDash:normalizeDash($('stroke-dash-input').value)}));
  $('grid-toggle-btn').addEventListener('click',()=>{state.grid.visible=!state.grid.visible;render();});$('grid-snap-input').addEventListener('change',()=>{state.grid.snap=$('grid-snap-input').checked;render();});$('grid-size-input').addEventListener('change',()=>{state.grid.size=clamp(Number($('grid-size-input').value)||20,2,500);render();});
  $('shape-sides-input').addEventListener('change',()=>{state.shapeSides=clamp(Math.round(Number($('shape-sides-input').value)||5),3,32);$('shape-sides-input').value=state.shapeSides;});
  $('corner-radius-input').addEventListener('change',()=>{const s=getPrimarySelectedObject();if(s?.type!=='rect'||s.locked)return;pushHistory();s.geometry.rx=s.geometry.ry=clamp(Number($('corner-radius-input').value)||0,0,Math.min(s.geometry.width,s.geometry.height)/2);render();});
  $('align-target-input').addEventListener('change',()=>{state.alignTarget=$('align-target-input').value;render();});$('download-png-btn').addEventListener('click',downloadPng);buildSwatches();
  $('compound-btn').addEventListener('click',makeCompound);$('release-compound-btn').addEventListener('click',releaseCompound);
  $('expand-layers-btn').addEventListener('click',()=>setAllGroupsExpanded(true));$('collapse-layers-btn').addEventListener('click',()=>setAllGroupsExpanded(false));
  $('text-content-input').addEventListener('input',()=>{const s=getPrimarySelectedObject();if(s?.type!=='text'||s.locked)return;if(!textEditing){pushHistory();textEditing=true;}s.geometry.text=$('text-content-input').value;render();});
  $('text-content-input').addEventListener('blur',()=>{textEditing=false;});
  $('font-size-input').addEventListener('change',()=>changeText({fontSize:clamp(Number($('font-size-input').value)||36,6,500)}));$('font-family-input').addEventListener('change',()=>changeText({fontFamily:$('font-family-input').value}));
  $('font-weight-input').addEventListener('change',()=>changeText({fontWeight:Number($('font-weight-input').value)}));$('font-style-input').addEventListener('change',()=>changeText({fontStyle:$('font-style-input').value}));$('text-align-input').addEventListener('change',()=>changeText({textAlign:$('text-align-input').value}));$('letter-spacing-input').addEventListener('change',()=>changeText({letterSpacing:clamp(Number($('letter-spacing-input').value)||0,-20,100)}));$('line-height-input').addEventListener('change',()=>changeText({lineHeight:clamp(Number($('line-height-input').value)||1.2,.5,4)}));
  $('duplicate-btn').addEventListener('click',duplicateSelection);$('rename-layer-btn').addEventListener('click',renameSelection);$('delete-layer-btn').addEventListener('click',deleteSelection);
  $('new-doc-btn').addEventListener('click',()=>{syncBoards();if((state.boards.length>1||state.boards.some(b=>b.objects.length))&&!confirm('Start a new project? You can undo this.'))return;pushHistory();state.objects=[];state.doc={width:1200,height:800};state.boards=[];state.activeBoard=0;deselectAll();fitArtboard();render();setStatus('New project');});
  $('artboard-select').addEventListener('change',()=>selectBoard(Number($('artboard-select').value)));$('add-artboard-btn').addEventListener('click',()=>addBoard(false));$('duplicate-artboard-btn').addEventListener('click',()=>addBoard(true));$('rename-artboard-btn').addEventListener('click',renameBoard);$('delete-artboard-btn').addEventListener('click',removeBoard);
  $('import-svg-btn').addEventListener('click',()=>$('import-svg-input').click());
  $('import-svg-input').addEventListener('change',async()=>{const file=$('import-svg-input').files[0];if(!file)return;try{if(file.size>2*1024*1024)throw Error('SVG exceeds 2 MB');importSvg(await file.text());}catch(error){setStatus('Open SVG: '+error.message);}finally{$('import-svg-input').value='';}});
  $('save-project-btn').addEventListener('click',saveProject);$('open-project-btn').addEventListener('click',()=>$('project-input').click());$('project-input').addEventListener('change',async()=>{const file=$('project-input').files[0];if(!file)return;try{if(file.size>10*1024*1024)throw Error('Project exceeds 10 MB');openProject(await file.text());}catch(error){setStatus('Open project: '+error.message);}finally{$('project-input').value='';}});
  if(window.ResizeObserver)new ResizeObserver(()=>{renderView();drawSelectionOutline();}).observe(dom.canvas);
  window.addEventListener('pagehide',saveDocument);
  window.addEventListener('keyup',event=>{if(event.code==='Space')spaceDown=false;});window.addEventListener('blur',()=>{spaceDown=false;});

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
    applyStyleToSelection({ fill: dom.fillInput.value,gradient:null });
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
    if(event.target.matches?.('input,textarea,select,[contenteditable]'))return;
    const key=event.key.toLowerCase(),mod=event.metaKey||event.ctrlKey;
    if(event.code==='Space'&&!mod){spaceDown=true;event.preventDefault();return;}
    if(mod&&key==='a'){state.selection=state.objects.filter(s=>s.visible&&!s.locked).map(s=>s.id);render();event.preventDefault();return;}
    if(mod&&key==='c'){copyObjects();event.preventDefault();return;}
    if(mod&&key==='v'){pasteObjects();event.preventDefault();return;}
    if(mod&&key==='d'){duplicateSelection();event.preventDefault();return;}
    if(mod&&key==='g'){event.shiftKey?ungroupSelection():groupSelection();event.preventDefault();return;}
    if(!mod&&!event.altKey){const shortcuts={v:TOOLS.SELECT,a:TOOLS.DIRECT,p:TOOLS.PEN,n:TOOLS.PENCIL,m:TOOLS.RECT,l:TOOLS.ELLIPSE,'\\':TOOLS.LINE,t:TOOLS.TEXT,h:TOOLS.HAND,z:TOOLS.ZOOM};if(shortcuts[key]){setTool(shortcuts[key]);event.preventDefault();return;}if(key==='0'){fitArtboard();event.preventDefault();return;}if(key==='enter'&&state.tool===TOOLS.PEN){finishActivePathIfAny(false);event.preventDefault();return;}}
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
      if(state.tool===TOOLS.PEN)finishActivePathIfAny(false);else deselectAll();
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
