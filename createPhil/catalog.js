/* Genesis PG06 artwork decoder, adapted from the published renderer/LZ4 reader.
 * Source: https://github.com/lengyeltyler/genesis-phil/tree/main/web/genesis
 * Exact live catalog SHA-256: 0a75a6f8f2c851b14a92dd363bab09aa7a1c987705c69e6badc71f16dde050b5
 * Ethereum NFT: 0x9732F84C54407cd846B3e987594417BcFA30644E.
 */
(function (root) {
  'use strict';
  const SHA256='0a75a6f8f2c851b14a92dd363bab09aa7a1c987705c69e6badc71f16dde050b5';
  const COUNT=896;
  const HEADER="<svg xmlns='http://www.w3.org/2000/svg' width='420' height='420' viewBox='109.06 15.22 420 420'>";
  const decoder=new TextDecoder('utf-8',{fatal:true});
  const ORDER=['color','nebula','stars','spiral','dust','overlay','wings','base','body','spikes','teeth','jaw','eyes','top'];
  const REQUIRED=new Set(['color','base','jaw','eyes']);
  const MULTI=new Set(['stars','overlay']);

  function decompress(data,size){
    const out=new Uint8Array(size); let p=0,q=0;
    const extension=()=>{let n=0,x;do{if(p>=data.length)throw Error('LZ4 truncated');x=data[p++];n+=x;}while(x===255);return n;};
    while(p<data.length){
      const t=data[p++];let literal=t>>4;
      if(literal===15)literal+=extension();
      if(p+literal>data.length||q+literal>size)throw Error('LZ4 bounds');
      out.set(data.subarray(p,p+literal),q);p+=literal;q+=literal;
      if(p===data.length)break;
      if(p+2>data.length)throw Error('LZ4 truncated');
      const offset=data[p]|data[p+1]<<8;p+=2;
      let match=t&15;if(match===15)match+=extension();match+=4;
      if(!offset||offset>q||q+match>size)throw Error('LZ4 match bounds');
      for(let i=0;i<match;i++)out[q+i]=out[q+i-offset];q+=match;
    }
    if(q!==size)throw Error('LZ4 length');return out;
  }
  async function verify(bytes){
    const digest=await crypto.subtle.digest('SHA-256',bytes);
    const hex=Array.from(new Uint8Array(digest),b=>b.toString(16).padStart(2,'0')).join('');
    if(hex!==SHA256)throw Error('Artwork catalog fingerprint mismatch');
  }
  function createReader(bytes){
    const blob=bytes instanceof Uint8Array?bytes:new Uint8Array(bytes);
    const view=new DataView(blob.buffer,blob.byteOffset,blob.byteLength);
    const u16=i=>view.getUint16(i),u32=i=>view.getUint32(i),u24=i=>blob[i]*65536+blob[i+1]*256+blob[i+2];
    const slice=(a,n)=>{if(a<0||n<0||a+n>blob.length)throw Error('Catalog bounds');return blob.subarray(a,a+n);};
    if(decoder.decode(slice(0,4))!=='PG06')throw Error('Unsupported artwork catalog');
    const count=u16(4),blocks=u16(6),td=u32(12),bd=u32(16),literalStart=bd+blocks*12;
    const dictionary=new Map(),cache=new Map(),labels=new Map();
    function value(token){
      if(token>=count)throw Error('Catalog token bounds');
      const at=32+token*10,offset=u24(at),length=u16(at+3);
      if(!(offset&0x800000))return decoder.decode(slice(literalStart+offset,length));
      let cursor=offset&0x7fffff,left=length;const out=new Uint8Array(length);let written=0;
      while(left){
        const id=cursor>>>16;if(id>=blocks)throw Error('Catalog dictionary bounds');
        if(!dictionary.has(id)){const a=bd+id*12;dictionary.set(id,decompress(slice(u32(a),u32(a+4)),u32(a+8)));}
        const d=dictionary.get(id),start=cursor%65536,n=Math.min(left,d.length-start);
        if(n<=0)throw Error('Catalog block bounds');
        out.set(d.subarray(start,start+n),written);written+=n;cursor+=n;left-=n;
      }
      return decoder.decode(out);
    }
    function at(index){if(!Number.isInteger(index)||index<0||index>=COUNT)throw Error('Catalog trait bounds');return td+index*40;}
    function label(index){
      if(!labels.has(index)){
        const offset=u32(at(index)+36),n=u16(offset),raw=JSON.parse(decodeURIComponent(decoder.decode(slice(offset+2,n))));
        labels.set(index,Object.freeze({id:index,category:raw.trait_type,name:raw.value}));
      }
      return labels.get(index);
    }
    function trait(index){
      if(cache.has(index))return cache.get(index);
      const a=at(index),program=decompress(slice(u32(a),u32(a+4)),u32(a+8)*2),map=slice(u32(a+28),u32(a+32));
      const p=new DataView(program.buffer),m=new DataView(map.buffer,map.byteOffset,map.byteLength),parts=[];
      const local=i=>{if(i*2+2>map.length)throw Error('Catalog reference bounds');return value(m.getUint16(i*2));};
      for(let i=0;i<program.length;i+=2){
        const word=p.getUint16(i);
        if(word&0x8000){parts.push(local(word&0x7fff));i+=2;parts.push(local(p.getUint16(i)),"'");}
        else parts.push(local(word));
      }
      const svg=parts.join('');
      if(new TextEncoder().encode(svg).length!==u32(a+12))throw Error('Catalog reconstruction length');
      cache.set(index,svg);if(cache.size>96)cache.delete(cache.keys().next().value);return svg;
    }
    const render=ids=>HEADER+ids.map(id=>"<g style='isolation:isolate'>"+trait(id)+'</g>').join('')+'</svg>';
    return Object.freeze({label,trait,render});
  }
  function validateGroups(groups){
    const ids=ORDER.flatMap(k=>groups[k]||[]);
    if(ids.length!==COUNT||new Set(ids).size!==COUNT||ids.some(id=>!Number.isInteger(id)||id<0||id>=COUNT))throw Error('Invalid Genesis trait groups');
    if(!groups.hoodie.every(id=>groups.top.includes(id))||!groups.hoodieSpikes.every(id=>groups.spikes.includes(id)))throw Error('Invalid hoodie compatibility rules');
  }
  function validSelection(groups,selection,complete=false){
    for(const key of ORDER){
      const ids=selection[key]||[];
      if(ids.length>(MULTI.has(key)?9:1)||(complete&&REQUIRED.has(key)&&ids.length!==1))return false;
      if(ids.some((id,i)=>!groups[key].includes(id)||(i>0&&id<=ids[i-1])))return false;
    }
    if(selection.nebula?.length&&selection.spiral?.length)return false;
    if(selection.top?.some(id=>groups.hoodie.includes(id))&&selection.spikes?.some(id=>!groups.hoodieSpikes.includes(id)))return false;
    return true;
  }
  // The experimental composition is not a minted Genesis NFT. Embed the
  // disclaimer in the artwork itself so it travels with every SVG export.
  function markUnofficial(svg){
    if(!svg.endsWith('</svg>'))throw Error('Invalid composition SVG');
    const badge="<g aria-label='Not 1 of 369; Not on-chain; Not verified' transform='translate(401.06 373.22)'>"+
      "<rect width='120' height='54' rx='3' fill='#10151b' stroke='#f2f0ea' stroke-width='0.7'/>"+
      "<text x='110' y='15' fill='#ffffff' font-family='Arial, Helvetica, sans-serif' font-size='11' font-weight='700' text-anchor='end'>"+
      "<tspan x='110'>Not 1 of 369</tspan><tspan x='110' dy='15'>Not on-chain</tspan><tspan x='110' dy='15'>Not Verified</tspan></text></g>";
    return svg.slice(0,-6)+badge+'</svg>';
  }
  const api={SHA256,COUNT,ORDER,REQUIRED,MULTI,verify,createReader,validateGroups,validSelection,markUnofficial};
  if(typeof module==='object'&&module.exports)module.exports=api;else root.PhilCatalog=api;
})(globalThis);
