/* Lightweight model regression checks; run with node scripts/check-svg-studio.js. */
const fs = require('node:fs');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const path = require('node:path');
const root = path.join(__dirname, '..', 'svg-editor');
const html = fs.readFileSync(path.join(root, 'editor.html'), 'utf8');
const source = fs.readFileSync(path.join(root, 'illustrator-lite.js'), 'utf8');
const ids = new Set([...html.matchAll(/\bid="([^"]+)"/g)].map(m => m[1]));
for (const m of source.matchAll(/(?:getElementById\(|\$\()['"]([^'"]+)['"]\)/g)) {
  assert(ids.has(m[1]), `Missing editor control ${m[1]}`);
}
const element = () => ({classList:{toggle(){},add(){},remove(){}},style:{},dataset:{},children:[],setAttribute(){},appendChild(){},querySelectorAll(){return []},querySelector(){return null},getContext(){return {}},get firstChild(){return null}});
const elements = new Map();
const document = {getElementById(id){if(!elements.has(id))elements.set(id,element());return elements.get(id);},createElement:element,createElementNS:element};
const context = vm.createContext({document,window:{localStorage:{setItem(){},getItem(){return null},removeItem(){}},addEventListener(){}},console,structuredClone,Date,Math,setTimeout:()=>1,clearTimeout(){},CSS:{escape:s=>s},confirm:()=>true});
vm.runInContext(source.replace(/\ninit\(\);\s*$/,'\n'),context);
const run = code => vm.runInContext(code,context);
run('render=()=>{};updateHistoryButtons=()=>{};setStatus=()=>{}');
const contours = run(`parseEditableContours('M 0 0 H 100 V 100 h -100 z M 20 20 Q 40 0 60 20 T 100 20 A 20 20 0 0 1 120 40 Z')`);
assert.equal(contours.length,2);
assert.equal(contours[0].anchors.length,4);
assert.equal(contours[1].anchors.at(-1).x,120);
assert(contours[1].anchors[1].inHandle);
assert.equal(run(`parseEditableContours('M 0 0 A 10 10 0 0 1 20 0')[0].anchors.length`),3);
run('state.tool=TOOLS.STAR;beginCreateShape(TOOLS.STAR,{x:80,y:80});continueCreateShape({x:100,y:80});finishCreateShape()');
assert.equal(run('state.objects[0].geometry.anchors.length'),10);
run(`applyStyleToSelection({gradient:{type:'linear',angle:45,stops:[{offset:0,color:'#ff0000',opacity:1},{offset:100,color:'#0000ff',opacity:.5}]},strokeCap:'round',strokeDash:'4, 2'})`);
const svg = run('exportSvgString()');
assert(svg.includes('linearGradient') && svg.includes('rotate(45 .5 .5)') && svg.includes('stroke-dasharray="4 2"'));
run('state.tool=TOOLS.RECT;beginCreateShape(TOOLS.RECT,{x:10,y:10});continueCreateShape({x:120,y:120});finishCreateShape();state.selection=state.objects.map(s=>s.id);makeCompound()');
assert(run('state.objects.length===1&&state.objects[0].type==="compound"'));
assert(run(`exportSvgString().includes('fill-rule="evenodd"')`));
run('releaseCompound()');
assert.equal(run('state.objects.length'),2);
run('addBoard(true)');
assert(run('state.boards.length===2&&state.objects.length===2&&state.boards[0].objects[0].id!==state.objects[0].id'));
run('state.doc.width=700;addBoard(false)');
assert(run('state.boards.length===3&&state.objects.length===0'));
run('selectBoard(0)');
assert(run('state.objects.length===2&&state.doc.width===1200'));
run('selectBoard(1)');
assert.equal(run('state.doc.width'),700);
run('installProject(decodeProject(JSON.parse(JSON.stringify(projectPayload()))))');
assert(run('state.boards.length===3&&state.doc.width===700&&state.objects.length===2'));
run('removeBoard();undo()');
assert.equal(run('state.boards.length'),3);
run('state.selection=state.objects.map(s=>s.id);groupSelection()');
assert(run('state.objects[0].type==="group"&&state.objects[0].name==="Group 1"'));
run('let g=state.objects[0];let first=g.children[0].id,second=g.children[1].id;moveTopLevelObjectById(first,second,"before")');
assert(run('state.objects[0].children[1].id===first&&state.objects[0].children[1].zIndex===1'));
run('state.selection=[first];moveSelectionInLayer(-1)');
assert(run('state.objects[0].children[0].id===first'));
assert.deepEqual(Array.from(run(`svgDimensions({getAttribute:k=>({width:'72pt',height:'48px'})[k]||null})`)),[0,0,96,48]);
assert(run(`isEmbeddedSvg('data:image/svg+xml;base64,PHN2Zy8+')`));
assert(!run(`isEmbeddedSvg('https://example.com/image.svg')`));
assert(!run(`isEmbeddedSvg('data:image/svg+xml;base64,abc" onload="x')`));
run(`state.objects=[normalizeCanonicalShape({id:nextId(),type:'svg-image',name:'Complex SVG',zIndex:0,visible:true,locked:false,transform:DEFAULT_TRANSFORM,style:DEFAULT_STYLE,geometry:{x:0,y:0,width:200,height:100,href:'data:image/svg+xml;base64,PHN2Zy8+'}},0)]`);
assert(run(`exportSvgString().includes('<image x="0" y="0" width="200" height="100" href="data:image/svg+xml;base64,PHN2Zy8+"')`));
run('installProject(decodeProject(JSON.parse(JSON.stringify(projectPayload()))))');
assert(run(`state.objects[0].type==='svg-image'&&state.objects[0].geometry.width===200`));
// Simulate the detached SVG DOM for Illustrator's common class-based export.
function svgNode(tag,attrs={},children=[],textContent=''){
  return {localName:tag,children,textContent,getAttribute:k=>attrs[k]??null,hasAttribute:k=>Object.hasOwn(attrs,k),setAttribute:(k,v)=>attrs[k]=v,removeAttribute:k=>delete attrs[k],matches:s=>s.startsWith('.')?(attrs.class||'').split(/\s+/).includes(s.slice(1)):s.startsWith('#')?attrs.id===s.slice(1):tag===s,querySelectorAll(s){return children.flatMap(c=>[...(s==='*'||c.localName===s?[c]:[]),...c.querySelectorAll(s)]);},remove(){}};
}
const rect=svgNode('rect',{class:'st0',x:'20',y:'30',width:'100',height:'100'}),openPath=svgNode('path',{style:'fill:#48a85c',d:'M150 40 L250 40 L200 120'}),sheet=svgNode('style',{},[],'.st0{fill:#ed5024;stroke:#112233;stroke-width:2px}'),defs=svgNode('defs',[]),group=svgNode('g',{id:'Artwork'},[rect,openPath]);
// Remove the stylesheet from its parent, as the browser DOM does.
defs.children.push(sheet);sheet.remove=()=>defs.children.splice(defs.children.indexOf(sheet),1);
context.importFixture=svgNode('svg',{viewBox:'10 20 300 200'},[defs,group]);
run('fitArtboard=()=>{};importEditableSvg(importFixture)');
assert(run(`state.objects[0].name==='Artwork'&&state.objects[0].transform.tx===-10&&state.objects[0].children[0].style.fill==='#ed5024'&&state.objects[0].children[0].style.strokeWidth===2&&state.objects[0].children[1].type==='compound'`));
// Nested createPhil-like SVG: referenced user-space gradients, small details,
// isolation, strokes, original IDs, and the multi-line authenticity label.
const baseGradient=svgNode('radialGradient',{id:'base',gradientUnits:'userSpaceOnUse',cx:'240',cy:'180',r:'2',gradientTransform:'translate(-20,10),scale(2,-2)'},[svgNode('stop',{offset:'0','stop-color':'#112233'}),svgNode('stop',{offset:'1','stop-color':'#445566','stop-opacity':'.2'})]);
const linked=svgNode('radialGradient',{id:'linked',cx:'250',fx:'250','xlink:href':'#base'});
const dot=svgNode('ellipse',{id:'tiny',cx:'250',cy:'180',rx:'.23',ry:'.4',fill:'url(#linked)',stroke:'url(#base)','stroke-width':'.5',style:'isolation:isolate',transform:'translate(-13.45,20.09),rotate(-2.25)'});
const inner=svgNode('svg',{width:'543.48',height:'448.62',viewBox:'0,0,543.48,448.62'},[svgNode('defs',{},[baseGradient,linked]),dot]);
const disclaimer=svgNode('text',{x:'520',y:'411','font-size':'5.5','paint-order':'stroke fill'},[svgNode('tspan',{},[],'Not 1 of 369'),svgNode('tspan',{dy:'7.5'},[],'Not on-chain'),svgNode('tspan',{dy:'7.5'},[],'Not Verified')]);
context.nestedFixture=svgNode('svg',{viewBox:'109.06 15.22 420 420'},[svgNode('g',{style:'isolation:isolate'},[inner]),disclaimer]);
run('importEditableSvg(nestedFixture)');
assert(run(`state.objects.length===2&&state.objects[0].children[0].geometry.viewport.width===543.48&&state.objects[0].children[0].children[0].style.gradient.coords.cx===250&&state.objects[0].children[0].children[0].style.gradient.units==='userSpaceOnUse'&&state.objects[0].children[0].children[0].geometry.rx===.23&&state.objects[0].children[0].children[0].style.strokeGradient.coords.cx===240&&state.objects[1].geometry.fontSize===5.5`));
assert(run(`exportSvgString().includes('stroke-paint-')&&exportSvgString().includes('gradientUnits="userSpaceOnUse"')&&exportSvgString().includes('viewBox="0 0 543.48 448.62"')&&exportSvgString().includes('Not Verified')`));
run('installProject(decodeProject(JSON.parse(JSON.stringify(projectPayload()))))');
assert(run(`state.objects[0].children[0].geometry.viewport.width===543.48&&state.objects[0].children[0].children[0].style.strokeGradient.transform==='translate(-20,10),scale(2,-2)'&&state.objects[1].geometry.fontSize===5.5`));
console.log('SVG Studio checks passed: imports, gradients, stroke, compound paths, artboards, project restore, undo, group and nested layer order.');
