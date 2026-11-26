(function () {
  'use strict';
  const C=window.PhilCatalog;
  const $=(selector)=>document.querySelector(selector);
  const grid=$('[data-lever-grid]'), display=$('[data-phil-display]'), idle=$('[data-display-idle]');
  const idleDisclaimer=$('[data-idle-disclaimer]');
  const status=$('[data-machine-status]'), count=$('[data-generation-count]');
  const exportButton=$('[data-export]'), resetButton=$('[data-reset-all]'), rollButton=$('[data-roll-all]');
  const selection=Object.fromEntries(C.ORDER.map(k=>[k,[]]));
  const stations=new Map();
  let groups,reader,runs=0,assembled='';
  const img=document.createElement('img');img.alt='';img.className='phil-art';img.hidden=true;display.append(img);
  const svgURI=svg=>'data:image/svg+xml;charset=utf-8,'+encodeURIComponent(svg);
  const name=id=>reader.label(id).name.replaceAll('&amp;','&');
  const randomIndex=n=>{const a=new Uint32Array(1),limit=2**32-(2**32%n);do{crypto.getRandomValues(a);}while(a[0]>=limit);return a[0]%n;};
  const choose=items=>items[randomIndex(items.length)];
  const ids=()=>C.ORDER.flatMap(k=>selection[k]);

  function buildStations(){
    for(const [i,key] of C.ORDER.entries()){
      const variants=groups[key],category=reader.label(variants[0]).category;
      const station=document.createElement('article');station.className='trait-station';station.dataset.station=key;
      const plate=document.createElement('div');plate.className='trait-plate';
      const number=document.createElement('span');number.textContent=String(i+1).padStart(2,'0');
      const title=document.createElement('strong');title.textContent=category;plate.append(number,title);
      const meta=document.createElement('p');meta.className='trait-meta';meta.textContent=`${variants.length} variants · ${C.REQUIRED.has(key)?'required':C.MULTI.has(key)?'up to 9':'optional'}`;
      const windowEl=document.createElement('div');windowEl.className='trait-window';
      const preview=document.createElement('img');preview.alt='';preview.hidden=true;
      const empty=document.createElement('span');empty.textContent='EMPTY';windowEl.append(preview,empty);
      const label=document.createElement('p');label.className='trait-name';label.textContent='No trait selected';
      const lever=document.createElement('button');lever.className='lever';lever.type='button';lever.dataset.trait=key;
      lever.setAttribute('aria-label',`Pull ${category} lever`);
      lever.innerHTML='<span class="lever-slot" aria-hidden="true"><span class="lever-arm"><span class="lever-knob"></span></span></span><span class="lever-caption">PULL</span>';
      lever.addEventListener('click',()=>{
        lever.classList.remove('pulled');void lever.offsetWidth;lever.classList.add('pulled');
        const pool=variants.filter(id=>!selection[key].includes(id));
        applyTrait(key,choose(pool.length?pool:variants));
      });
      const clear=document.createElement('button');clear.className='eject-button';clear.type='button';clear.textContent='Clear layer';clear.disabled=true;
      clear.addEventListener('click',()=>{selection[key]=[];render(`${category} cleared.`);});
      station.append(plate,meta,windowEl,label,lever,clear);grid.append(station);
      stations.set(key,{preview,empty,label,clear,category});
    }
  }

  function applyTrait(key,id){
    if(!groups[key].includes(id))return;
    const notes=[];
    if(key==='nebula'&&selection.spiral.length){selection.spiral=[];notes.push('BgSpiral cleared');}
    if(key==='spiral'&&selection.nebula.length){selection.nebula=[];notes.push('BgNebula cleared');}
    if(key==='top'&&groups.hoodie.includes(id)&&selection.spikes.some(s=>!groups.hoodieSpikes.includes(s))){selection.spikes=[];notes.push('incompatible Spikes cleared');}
    if(key==='spikes'&&!groups.hoodieSpikes.includes(id)&&selection.top.some(t=>groups.hoodie.includes(t))){selection.top=[];notes.push('incompatible hoodie cleared');}
    if(C.MULTI.has(key)){
      const next=selection[key];
      if(!next.includes(id)){
        if(next.length===9){next.splice(randomIndex(next.length),1);notes.push('replaced one of 9 layers');}
        next.push(id);next.sort((a,b)=>a-b);
      }
    }else selection[key]=[id];
    runs++;render(`${name(id)} selected${notes.length?' · '+notes.join(' · '):''}.`);
  }

  function rollAll(){
    for(const key of C.ORDER)selection[key]=[];
    for(const key of C.REQUIRED)selection[key]=[choose(groups[key])];
    const background=choose(['nebula','spiral',null]);if(background)selection[background]=[choose(groups[background])];
    for(const key of ['dust','body','teeth','top'])if(randomIndex(2))selection[key]=[choose(groups[key])];
    for(const key of C.MULTI){const pool=[...groups[key]],n=randomIndex(4);for(let i=0;i<n;i++)selection[key].push(pool.splice(randomIndex(pool.length),1)[0]);selection[key].sort((a,b)=>a-b);}
    if(randomIndex(5000)===0)selection.wings=[choose(groups.wings)];
    if(randomIndex(2)){
      const pool=selection.top.some(id=>groups.hoodie.includes(id))?groups.hoodieSpikes:groups.spikes;
      selection.spikes=[choose(pool)];
    }
    runs++;render('New complete Genesis composition.');
  }

  function render(message){
    if(!C.validSelection(groups,selection))throw Error('Invalid trait combination');
    const selected=ids();assembled=selected.length?C.markUnofficial(reader.render(selected)):'';
    img.hidden=!assembled;idle.hidden=!!assembled;idleDisclaimer.hidden=!!assembled;
    if(assembled)img.src=svgURI(assembled);else img.removeAttribute('src');
    display.setAttribute('aria-label',(selected.length?`Phil preview: ${selected.map(name).join(', ')}`:'Generated Phil preview; no traits loaded')+'. Not 1 of 369. Not on-chain. Not verified.');
    for(const [key,station] of stations){
      const current=selection[key],active=current.length>0;
      station.preview.hidden=!active;station.empty.hidden=active;station.clear.disabled=!active;
      if(active)station.preview.src=svgURI(reader.render(current));else station.preview.removeAttribute('src');
      station.label.textContent=active?current.map(name).join(' · '):'No trait selected';
      station.label.title=active?station.label.textContent:'';
    }
    exportButton.disabled=!assembled;resetButton.disabled=!selected.length;
    count.textContent=String(runs).padStart(4,'0');
    const complete=C.validSelection(groups,selection,true);
    status.textContent=`${message} ${selected.length} artwork layer${selected.length===1?'':'s'} selected${complete?' · complete composition':''}`;
  }

  exportButton.addEventListener('click',()=>{
    if(!assembled)return;
    const url=URL.createObjectURL(new Blob([assembled],{type:'image/svg+xml'}));
    const a=document.createElement('a');a.href=url;a.download='phil-unofficial-composition.svg';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
  });
  resetButton.addEventListener('click',()=>{for(const key of C.ORDER)selection[key]=[];render('Machine reset.');});
  rollButton.addEventListener('click',rollAll);

  async function boot(){
    try{
      const [art,metadata]=await Promise.all([fetch('/createPhil/catalog.bin'),fetch('/createPhil/groups.json')]);
      if(!art.ok||!metadata.ok)throw Error('Unable to load Genesis catalog');
      const bytes=await art.arrayBuffer();await C.verify(bytes);
      groups=await metadata.json();C.validateGroups(groups);reader=C.createReader(bytes);
      buildStations();rollButton.disabled=false;render('Genesis catalog verified. Pull any lever to begin.');
    }catch(error){status.textContent=`Artwork unavailable: ${error.message}. Try refreshing on HTTPS or localhost.`;console.error(error);}
  }
  boot();
})();
