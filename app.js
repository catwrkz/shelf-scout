(()=>{'use strict';
const $=id=>document.getElementById(id),img=$('shelfImage'),video=$('camera'),boxes=$('boxes'),status=$('status');
let model=null,items=[],active=null,cameraStream=null,draw=false,drawOrigin=null,imageObjectUrl=null,busy=false;
const key='shelf-scout-favorites-v1';let favorites=[];try{favorites=JSON.parse(localStorage.getItem(key)||'[]')}catch{};
const uid=()=>Date.now().toString(36)+Math.random().toString(36).slice(2,7);const esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const setStatus=s=>status.textContent=s;const count=()=> $('favoriteCount').textContent=favorites.length;count();
function metrics(){
 if(img.hidden||!img.naturalWidth)return null;
 const outer=img.getBoundingClientRect(),parent=boxes.getBoundingClientRect();
 // image uses object-fit:contain, so its visible pixels occupy a letterboxed rectangle
 const nw=img.naturalWidth,nh=img.naturalHeight,scale=Math.min(outer.width/nw,outer.height/nh);
 const w=nw*scale,h=nh*scale;
 return {x:outer.left-parent.left+(outer.width-w)/2,y:outer.top-parent.top+(outer.height-h)/2,w,h,nw,nh};
}
function paint(){
 boxes.replaceChildren();const m=metrics();if(!m)return;
 // Put each rectangle in a clipped overlay aligned to the *visible image*, not the viewport.
 // This prevents any detector output, including out-of-bounds output, from spilling onto controls.
 const layer=document.createElement('div');layer.className='image-box-layer';
 Object.assign(layer.style,{position:'absolute',left:m.x+'px',top:m.y+'px',width:m.w+'px',height:m.h+'px',overflow:'hidden',pointerEvents:'none'});
 for(const o of items){
  let x=Math.max(0,Math.min(m.nw,Number(o.x))),y=Math.max(0,Math.min(m.nh,Number(o.y)));
  let right=Math.max(x,Math.min(m.nw,Number(o.x)+Number(o.w)));
  let bottom=Math.max(y,Math.min(m.nh,Number(o.y)+Number(o.h)));
  if(![x,y,right,bottom].every(Number.isFinite)||right-x<3||bottom-y<3)continue;
  const b=document.createElement('button');b.className='item-box';
  Object.assign(b.style,{left:x/m.nw*100+'%',top:y/m.nh*100+'%',width:(right-x)/m.nw*100+'%',height:(bottom-y)/m.nh*100+'%'});
  b.setAttribute('aria-label','Inspect item '+o.name);
  const label=document.createElement('span');label.textContent=o.name;b.append(label);
  b.onclick=()=>{if(!draw)showItem(o)};layer.append(b);
 }
 boxes.append(layer);
}
function showItem(o){active=o;const saved=favorites.some(f=>f.id===o.id);$('detailContent').innerHTML=`<h2>${esc(o.name)}</h2><span class="pill">● YELLOW · Evidence needed</span><p><strong>Resale value:</strong> Not researched<br><strong>Maker / age:</strong> Not established<br><strong>Authenticity:</strong> Not established<br><strong>Detection confidence:</strong> ${o.score===null?'Manually outlined':Math.round(o.score*100)+'% (generic object category only)'}</p><p>This version tests <strong>object localization</strong>, not specific collectible identification. No verified sold prices are connected.</p><label for="itemName">Item description</label><input id="itemName" maxlength="140" value="${esc(o.name)}"><label for="itemNotes">Marks / details / notes</label><input id="itemNotes" value="${esc(o.notes||'')}" placeholder="e.g. makers mark under base"><div class="actions"><button id="saveFav" class="primary">${saved?'♥ Update favorite':'♡ Save favorite'}</button><button id="removeItem" class="secondary">Remove outline</button><button id="adjustItem" class="secondary">Redraw outline</button></div>`;$('detail').hidden=false;$('itemName').oninput=e=>{o.name=e.target.value;paint()};$('itemNotes').oninput=e=>o.notes=e.target.value;$('saveFav').onclick=()=>{const f=favorites.findIndex(x=>x.id===o.id),record={...o,savedAt:new Date().toISOString()};if(f<0)favorites.push(record);else favorites[f]=record;try{localStorage.setItem(key,JSON.stringify(favorites));setStatus('Saved to favorites on this device.')}catch{setStatus('Unable to save favorites: browser storage is full.')}count();showItem(o)};$('removeItem').onclick=()=>{items=items.filter(x=>x!==o);$('detail').hidden=true;paint()};$('adjustItem').onclick=()=>{$('detail').hidden=true;items=items.filter(x=>x!==o);paint();toggleDraw(true);setStatus('Redraw the outline by dragging around the item.')}}
function reset(){items=[];$('detail').hidden=true;paint()};function add(name,score,x,y,w,h){items.push({id:uid(),name,score,x,y,w,h,notes:''})}
// OWL-ViT zero-shot detector. Unlike COCO-SSD, it searches our collectible-specific prompts.
let modelLoadPromise=null;
const prompts=[
 'a ceramic coffee mug','a ceramic teacup','a drinking cup','a decorative ceramic figurine',
 'a small porcelain animal figurine','a porcelain doll','a collectible ceramic statue',
 'a decorative flower vase','a pottery vessel','a glass vase','a glass drinking cup',
 'a decorative bowl','a ceramic plate','a collectible ornament','a trinket box',
 'a vintage jar','a ceramic pitcher','a candle holder','a decorative sculpture',
 'a small wooden collectible','a decorative clock','a ceramic teapot',
 'a ceramic salt and pepper shaker'
];
async function getModel(){
 if(model)return model;
 if(modelLoadPromise)return modelLoadPromise;
 setStatus('Downloading OWL-ViT collectible detector for the first time. This is a large free model and may take several minutes on Wi-Fi…');
 modelLoadPromise=(async()=>{
  const {pipeline,env}=await import('https://cdn.jsdelivr.net/npm/@huggingface/transformers@3.8.1');
  env.allowLocalModels=false;
  // Force WASM/CPU for broad iPhone Safari compatibility; quantized weights reduce memory usage.
  const loaded=await pipeline('zero-shot-object-detection','Xenova/owlvit-base-patch32',{device:'wasm',dtype:'q8'});
  model=loaded;
  return model;
 })().catch(e=>{modelLoadPromise=null;throw e});
 return modelLoadPromise;
}
function makeCanvas(sx,sy,sw,sh,maxside=768){const sc=Math.min(1,maxside/Math.max(sw,sh)),c=document.createElement('canvas');c.width=Math.max(1,Math.round(sw*sc));c.height=Math.max(1,Math.round(sh*sc));c.getContext('2d').drawImage(img,sx,sy,sw,sh,0,0,c.width,c.height);return c;}
function nameFromPrompt(label){return label.replace(/^a (small |vintage |decorative |collectible )*/,'').replace(/^an /,'').replace(/^(ceramic|porcelain|glass|pottery) /,'$1 ')+' candidate';}
function overlap(a,b){const ix=Math.max(0,Math.min(a.x+a.w,b.x+b.w)-Math.max(a.x,b.x)),iy=Math.max(0,Math.min(a.y+a.h,b.y+b.h)-Math.max(a.y,b.y));return ix*iy/(a.w*a.h+b.w*b.h-ix*iy||1)}
function merge(preds){preds.sort((a,b)=>b.score-a.score);const out=[];for(const p of preds){if(out.some(q=>overlap(p,q)>.35))continue;out.push(p)}return out.slice(0,60)}
async function detectPart(detector,sx,sy,sw,sh,maxside=768){
 const c=makeCanvas(sx,sy,sw,sh,maxside);
 try{
  // Output coordinates refer to the submitted canvas, not the original photograph.
  const raw=await detector(c.toDataURL('image/jpeg',.84),prompts,{threshold:0.085,top_k:75});
  const scalex=sw/c.width,scaley=sh/c.height,nw=img.naturalWidth,nh=img.naturalHeight;
  return raw.map(p=>{
   const bb=p.box||{},left=Number(bb.xmin),top=Number(bb.ymin),right=Number(bb.xmax),bottom=Number(bb.ymax);
   if(![left,top,right,bottom].every(Number.isFinite))return null;
   let x=Math.max(0,Math.min(nw,sx+left*scalex)),y=Math.max(0,Math.min(nh,sy+top*scaley));
   const rx=Math.max(x,Math.min(nw,sx+right*scalex)),by=Math.max(y,Math.min(nh,sy+bottom*scaley));
   const w=rx-x,h=by-y;
   if(w<14||h<14||w*h<250||w*h>nw*nh*.75)return null;
   return {name:nameFromPrompt(p.label),score:p.score,x,y,w,h};
  }).filter(Boolean);
 }finally{c.width=0;c.height=0}
}
async function scan(){
 if(busy)return;busy=true;$('scanBtn').disabled=true;
 try{
  if(!video.hidden){const c=document.createElement('canvas');c.width=video.videoWidth;c.height=video.videoHeight;c.getContext('2d').drawImage(video,0,0);img.src=c.toDataURL('image/jpeg',.85);img.hidden=false;video.hidden=true;stopCamera();await img.decode();c.width=0;c.height=0;}
  if(!img.complete||!img.naturalWidth)throw Error('Load a photograph first.');
  reset();const m=await getModel(),w=img.naturalWidth,h=img.naturalHeight;
  setStatus('Analyzing shelf with collectible-specific visual prompts…');
  let found=await detectPart(m,0,0,w,h,768);
  // A closer pass can help small objects, but cap at two broad halves to protect iPhone memory.
  if($('detailScan').checked){
   const vertical=w>=h;
   for(let i=0;i<2;i++){
    setStatus(`Closer shelf inspection ${i+1} of 2…`);
    const sx=vertical?Math.max(0,(i*.5-.05)*w):0;
    const sy=vertical?0:Math.max(0,(i*.5-.05)*h);
    const sw=vertical?Math.min(w-sx,.6*w):w;
    const sh=vertical?h:Math.min(h-sy,.6*h);
    found.push(...await detectPart(m,sx,sy,sw,sh,640));
    await new Promise(requestAnimationFrame);
   }
  }
  for(const p of merge(found))add(p.name,p.score,p.x,p.y,p.w,p.h);
  paint();setStatus(`OWL-ViT found ${items.length} tentative objects. Tap a box to inspect or redraw an inaccurate outline. No sold-price data is connected.`);
 }catch(e){console.error(e);setStatus('OWL-ViT detection failed: '+(e?.message||String(e))+'. Try disabling closer inspection, use Wi-Fi, or draw items manually.');}
 finally{busy=false;$('scanBtn').disabled=false;}
}
function stopCamera(){cameraStream?.getTracks().forEach(t=>t.stop());cameraStream=null;$('cameraBtn').textContent='Use camera'}
$('scanBtn').onclick=scan;$('upload').onchange=async e=>{const f=e.target.files?.[0];if(!f)return;stopCamera();video.hidden=true;img.hidden=false;if(imageObjectUrl)URL.revokeObjectURL(imageObjectUrl);imageObjectUrl=URL.createObjectURL(f);img.src=imageObjectUrl;try{await img.decode();reset();setStatus('Photo loaded. Tap Scan Shelf.')}catch{setStatus('Could not read photograph.')}};
$('cameraBtn').onclick=async()=>{if(cameraStream){stopCamera();video.hidden=true;img.hidden=false;setStatus('Camera closed.');return}try{cameraStream=await navigator.mediaDevices.getUserMedia({video:{facingMode:{ideal:'environment'},width:{ideal:1280},height:{ideal:720}},audio:false});video.srcObject=cameraStream;video.hidden=false;img.hidden=true;reset();await video.play();setStatus('Point at a shelf and tap Scan Shelf to capture it.');$('cameraBtn').textContent='Close camera'}catch(e){setStatus('Camera unavailable: '+e.message)}};
function toggleDraw(on){draw=on;boxes.classList.toggle('draw-mode',draw);boxes.style.pointerEvents=draw?'auto':'none';$('addBtn').textContent=draw?'Cancel drawing':'+ Add / redraw item'}
$('addBtn').onclick=()=>{if(img.hidden){setStatus('Capture or upload a photo first.');return}toggleDraw(!draw);setStatus(draw?'Drag a rectangle around an individual item.':'Drawing canceled.')};
function imagePoint(e){const m=metrics();if(!m)return null;return{x:Math.max(0,Math.min(m.nw,(e.clientX-boxes.getBoundingClientRect().left-m.x)/m.w*m.nw)),y:Math.max(0,Math.min(m.nh,(e.clientY-boxes.getBoundingClientRect().top-m.y)/m.h*m.nh))}}
boxes.addEventListener('pointerdown',e=>{if(!draw)return;e.preventDefault();drawOrigin=imagePoint(e);boxes.setPointerCapture(e.pointerId)});boxes.addEventListener('pointerup',e=>{if(!drawOrigin)return;const p=imagePoint(e);if(!p){drawOrigin=null;return}const x=Math.min(drawOrigin.x,p.x),y=Math.min(drawOrigin.y,p.y),w=Math.abs(p.x-drawOrigin.x),h=Math.abs(p.y-drawOrigin.y);drawOrigin=null;toggleDraw(false);if(w<10||h<10)return;add('Unidentified collectible',null,x,y,w,h);paint();showItem(items[items.length-1]);setStatus('Manual outline added. Edit its label in the research card.')});
$('closeDetail').onclick=()=>$('detail').hidden=true;$('help').onclick=()=>$('about').showModal();$('closeAbout').onclick=()=>$('about').close();$('favoritesBtn').onclick=()=>{if(!favorites.length){setStatus('No favorites saved.');return}alert('Favorites saved on this browser:\n\n'+favorites.map((f,i)=>`${i+1}. ${f.name}${f.notes?' — '+f.notes:''}`).join('\n'))};window.addEventListener('resize',paint);img.addEventListener('load',paint);
})();
