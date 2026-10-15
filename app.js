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
// v0.6: item rectangles are clipped to the photo, but numbered markers live in
// a separate overlay so they can extend into the surrounding letterbox area.
function paint(){
 boxes.replaceChildren();const m=metrics();if(!m)return;
 const layer=document.createElement('div');layer.className='image-box-layer';
 Object.assign(layer.style,{position:'absolute',left:m.x+'px',top:m.y+'px',width:m.w+'px',height:m.h+'px',overflow:'hidden',pointerEvents:'none'});
 const markerLayer=document.createElement('div');markerLayer.className='marker-layer';
 const selected=active&&items.includes(active)?active:null;
 const viewportWidth=boxes.clientWidth,viewportHeight=boxes.clientHeight;
 for(let i=0;i<items.length;i++){
  const o=items[i];
  let x=Math.max(0,Math.min(m.nw,Number(o.x))),y=Math.max(0,Math.min(m.nh,Number(o.y)));
  let right=Math.max(x,Math.min(m.nw,Number(o.x)+Number(o.w)));
  let bottom=Math.max(y,Math.min(m.nh,Number(o.y)+Number(o.h)));
  if(![x,y,right,bottom].every(Number.isFinite)||right-x<3||bottom-y<3)continue;
  const isSelected=selected===o;
  const b=document.createElement('button');
  b.className='item-box'+(selected?(isSelected?' is-selected':' is-dimmed'):'');
  Object.assign(b.style,{left:x/m.nw*100+'%',top:y/m.nh*100+'%',width:(right-x)/m.nw*100+'%',height:(bottom-y)/m.nh*100+'%'});
  b.setAttribute('aria-label','Inspect item '+(i+1)+': '+o.name);
  b.setAttribute('aria-pressed',String(isSelected));
  b.onclick=()=>{if(!draw)showItem(o)};
  layer.append(b);
  const marker=document.createElement('button');
  marker.type='button';marker.className='item-marker'+(selected?(isSelected?' is-selected':' is-dimmed'):'');
  marker.textContent=String(i+1);marker.title=o.name;
  marker.setAttribute('aria-label','Inspect item '+(i+1)+': '+o.name);
  marker.setAttribute('aria-pressed',String(isSelected));
  // Place the number above the object, even if that means outside the photo.
  // Clamp only to the viewer, never to the image rectangle.
  const left=Math.max(3,Math.min(viewportWidth-37,m.x+x/m.nw*m.w));
  const preferredTop=m.y+y/m.nh*m.h-26;
  const top=Math.max(4,Math.min(viewportHeight-25,preferredTop));
  Object.assign(marker.style,{left:left+'px',top:top+'px'});
  marker.onclick=()=>{if(!draw)showItem(o)};
  markerLayer.append(marker);
 }
 boxes.append(layer,markerLayer);
}
function showItem(o){active=o;paint();const saved=favorites.some(f=>f.id===o.id);$('detailContent').innerHTML=`<h2>${esc(o.name)}</h2><img id="itemCrop" class="item-crop" alt="Cropped selected item"><span class="pill">● YELLOW · Evidence needed</span><p><strong>Resale value:</strong> Not researched<br><strong>Maker / age:</strong> Not established<br><strong>Authenticity:</strong> Not established<br><strong>Detection confidence:</strong> ${o.score===null?'Manually outlined':Math.round(o.score*100)+'% (generic object category only)'}</p><p><strong>Individual-object identification:</strong> analyze only the pixels inside this outline. Category guesses are not maker or authenticity verification.</p><div id="identityResult" class="identity-result">${o.identity?esc(o.identity.summary):'Not analyzed yet.'}</div><label for="itemName">Item description</label><input id="itemName" maxlength="140" value="${esc(o.name)}"><label for="itemNotes">Marks / details / notes</label><input id="itemNotes" value="${esc(o.notes||'')}" placeholder="e.g. makers mark under base"><div class="actions"><button id="identifyItem" class="primary">Identify this item</button><button id="saveFav" class="primary">${saved?'♥ Update favorite':'♡ Save favorite'}</button><button id="removeItem" class="secondary">Remove outline</button><button id="adjustItem" class="secondary">Redraw outline</button></div>`;$('detail').hidden=false;try{$('itemCrop').src=itemCrop(o).toDataURL('image/jpeg',.85)}catch{} $('identifyItem').onclick=()=>identify(o);$('itemName').oninput=e=>{o.name=e.target.value;paint()};$('itemNotes').oninput=e=>o.notes=e.target.value;$('saveFav').onclick=()=>{const f=favorites.findIndex(x=>x.id===o.id),record={...o,savedAt:new Date().toISOString()};if(f<0)favorites.push(record);else favorites[f]=record;try{localStorage.setItem(key,JSON.stringify(favorites));setStatus('Saved to favorites on this device.')}catch{setStatus('Unable to save favorites: browser storage is full.')}count();showItem(o)};$('removeItem').onclick=()=>{items=items.filter(x=>x!==o);$('detail').hidden=true;active=null;paint()};$('adjustItem').onclick=()=>{$('detail').hidden=true;active=null;items=items.filter(x=>x!==o);paint();toggleDraw(true);setStatus('Redraw the outline by dragging around the item.')}}
function reset(){items=[];$('detail').hidden=true;active=null;paint()};function add(name,score,x,y,w,h){items.push({id:uid(),name,score,x,y,w,h,notes:''})}
// OWL-ViT zero-shot detector. Unlike COCO-SSD, it searches our collectible-specific prompts.
let modelLoadPromise=null;
const prompts=[
 'a novelty ceramic coffee mug shaped like a cake','a whimsical cake-shaped ceramic mug','a ceramic mug with a handle','a mug shaped like a food item',
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
// Analyze only pixels inside the selected object's rectangle. No shelf context or padding.
function itemCrop(o){
 const w=img.naturalWidth,h=img.naturalHeight;
 const x=Math.max(0,Math.min(w-1,Math.floor(o.x))),y=Math.max(0,Math.min(h-1,Math.floor(o.y)));
 const cw=Math.max(1,Math.min(w-x,Math.ceil(o.w))),ch=Math.max(1,Math.min(h-y,Math.ceil(o.h)));
 return makeCanvas(x,y,cw,ch,512);
}
const identityPrompts=[
 ['Novelty mug','a novelty ceramic mug shaped like a cake or dessert'],
 ['Mug','a ceramic coffee mug with a handle'],
 ['Teacup','a porcelain teacup with a handle'],
 ['Cup','a drinking cup'],
 ['Bowl','a ceramic bowl'],
 ['Vase','a decorative ceramic vase'],
 ['Glassware','a glass drinking vessel'],
 ['Figurine','a ceramic animal figurine'],
 ['Figurine','a small porcelain decorative figurine'],
 ['Doll','a collectible doll'],
 ['Statue','a decorative statue or sculpture'],
 ['Pottery','a piece of decorative pottery'],
 ['Jar','a ceramic jar with a lid'],
 ['Trinket box','a small decorative trinket box'],
 ['Teapot','a ceramic teapot'],
 ['Pitcher','a ceramic pitcher with a handle'],
 ['Ornament','a decorative ornament'],
 ['Other houseware','a household decoration']
];
async function identify(o){
 const target=$('identityResult'),btn=$('identifyItem');btn.disabled=true;
 target.textContent='Analyzing only this item’s cropped image…';
 try{
  const detector=await getModel(),crop=itemCrop(o);
  let raw;
  try{raw=await detector(crop.toDataURL('image/jpeg',.86),identityPrompts.map(x=>x[1]),{threshold:.04,top_k:45})}
  finally{crop.width=0;crop.height=0}
  // Keep candidate matches that substantially overlap the selected item crop.
  const scores=new Map();
  for(const hit of raw){
   const idx=identityPrompts.findIndex(p=>p[1]===hit.label);if(idx<0)continue;
   const group=identityPrompts[idx][0],score=Number(hit.score)||0;
   scores.set(group,Math.max(score,scores.get(group)||0));
  }
  const ranked=[...scores].sort((a,b)=>b[1]-a[1]);
  const best=ranked[0],runner=ranked[1];
  // Weak/no matches are explicitly uncertain. These are relative visual matches,
  // NOT calibrated probabilities of correct identity.
  const uncertain=!best||best[1]<.10||(runner&&best[1]-runner[1]<.025);
  const summary=uncertain?'Uncertain visual category. Take a closer photo or correct the description.':
   'Likely visual category: '+best[0]+'. This is a tentative visual match, not a verified identification.';
  o.identity={summary,candidates:ranked.slice(0,3).map(([name,score])=>({name,score})),uncertain};
  // Do not overwrite manual edits; keep the original detection name to preserve evidence.
  target.replaceChildren();
  const message=document.createElement('p');message.textContent=summary;target.append(message);
  if(ranked.length){const small=document.createElement('small');small.textContent='Other visual matches: '+ranked.slice(0,3).map(([name,score])=>name+' ('+Math.round(score*100)+' match score)').join(' · ')+'. Scores are not certainty percentages.';target.append(small)}
 }catch(e){console.error(e);target.textContent='Item-only analysis unavailable: '+(e?.message||String(e))}
 finally{btn.disabled=false}
}
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
$('closeDetail').onclick=()=>{active=null;$('detail').hidden=true;paint()};$('help').onclick=()=>$('about').showModal();$('closeAbout').onclick=()=>$('about').close();$('favoritesBtn').onclick=()=>{if(!favorites.length){setStatus('No favorites saved.');return}alert('Favorites saved on this browser:\n\n'+favorites.map((f,i)=>`${i+1}. ${f.name}${f.notes?' — '+f.notes:''}`).join('\n'))};window.addEventListener('resize',paint);img.addEventListener('load',paint);
})();
