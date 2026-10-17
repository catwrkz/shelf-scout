(()=>{'use strict';
const $=id=>document.getElementById(id),img=$('shelfImage'),video=$('camera'),boxes=$('boxes'),status=$('status');
let model=null,items=[],active=null,cameraStream=null,draw=false,drawOrigin=null,imageObjectUrl=null,busy=false,scanEpoch=0;
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
  b.className='item-box'+(o.pending?' is-pending':'')+(selected?(isSelected?' is-selected':' is-dimmed'):'');
  Object.assign(b.style,{left:x/m.nw*100+'%',top:y/m.nh*100+'%',width:(right-x)/m.nw*100+'%',height:(bottom-y)/m.nh*100+'%'});
  b.setAttribute('aria-label','Inspect item '+(i+1)+': '+o.name);
  b.setAttribute('aria-pressed',String(isSelected));
  b.onclick=()=>{if(!draw)showItem(o)};
  layer.append(b);
  const marker=document.createElement('button');
  marker.type='button';marker.className='item-marker'+(o.pending?' is-pending':'')+(selected?(isSelected?' is-selected':' is-dimmed'):'');
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
function showItem(o){active=o;paint();const saved=favorites.some(f=>f.id===o.id);$('detailContent').innerHTML=`<h2>${esc(o.name)}</h2><img id="itemCrop" class="item-crop" alt="Cropped selected item"><span class="pill">${o.pending?'◌ TENTATIVE · Awaiting local validation':'● YELLOW · Evidence needed'}</span><p><strong>Resale value:</strong> Not researched<br><strong>Maker / age:</strong> Not established<br><strong>Authenticity:</strong> Not established<br><strong>Detection confidence:</strong> ${o.score===null?'Manually outlined':Math.round(o.score*100)+'% (generic object category only)'}</p><p><strong>Individual-object identification:</strong> analyze only the pixels inside this outline. Category guesses are not maker or authenticity verification.</p><div id="identityResult" class="identity-result">${o.identity?esc(o.identity.summary):o.identifying?'Automatic category identification in progress…':'Awaiting automatic identification.'}</div><section class="visual-search"><h3>Find matching items online</h3><p>Use the cropped item photo with Google Lens. Visual results open outside Shelf Scout and are clues, not verified identification or sold-price evidence.</p><div class="visual-actions"><button type="button" id="shareLens" class="primary">Share item photo</button><button type="button" id="saveCrop" class="secondary">Save cropped photo</button><button type="button" id="openLens" class="secondary">Open Google Lens</button><button type="button" id="textSearch" class="secondary">Full Google Images</button><button type="button" id="embeddedSearch" class="secondary">Embedded Google results</button></div><p id="visualHelp" class="visual-help" aria-live="polite">On iPhone: try Share item photo → Google or Chrome (if available). Otherwise save the crop, open Google Lens, and upload the saved image.</p></section><label for="itemName">Item description</label><input id="itemName" maxlength="140" value="${esc(o.name)}"><label for="itemNotes">Marks / details / notes</label><input id="itemNotes" value="${esc(o.notes||'')}" placeholder="e.g. makers mark under base"><div class="actions"><button id="identifyItem" class="primary">Identify this item</button><button id="saveFav" class="primary">${saved?'♥ Update favorite':'♡ Save favorite'}</button><button id="removeItem" class="secondary">Remove outline</button><button id="adjustItem" class="secondary">Redraw outline</button></div>`;$('detail').hidden=false;if(o.identity)renderIdentity($('identityResult'),o.identity);try{$('itemCrop').src=itemCrop(o).toDataURL('image/jpeg',.85)}catch{} $('shareLens').onclick=()=>shareItemCrop(o);$('saveCrop').onclick=()=>saveItemCrop(o);$('openLens').onclick=()=>window.open('https://lens.google.com/','_blank','noopener,noreferrer');$('textSearch').onclick=()=>{const query=[o.name,o.notes||''].filter(Boolean).join(' ').replace(/\bcandidate\b/gi,'').trim();window.open('https://www.google.com/search?tbm=isch&q='+encodeURIComponent(query),'_blank','noopener,noreferrer')};$('embeddedSearch').onclick=()=>openEmbeddedGoogle(o);$('identifyItem').onclick=()=>identify(o);$('itemName').oninput=e=>{o.name=e.target.value;paint()};$('itemNotes').oninput=e=>o.notes=e.target.value;$('saveFav').onclick=()=>{const f=favorites.findIndex(x=>x.id===o.id),record={...o,savedAt:new Date().toISOString()};if(f<0)favorites.push(record);else favorites[f]=record;try{localStorage.setItem(key,JSON.stringify(favorites));setStatus('Saved to favorites on this device.')}catch{setStatus('Unable to save favorites: browser storage is full.')}count();showItem(o)};$('removeItem').onclick=()=>{items=items.filter(x=>x!==o);$('detail').hidden=true;active=null;paint()};$('adjustItem').onclick=()=>{$('detail').hidden=true;active=null;items=items.filter(x=>x!==o);paint();toggleDraw(true);setStatus('Redraw the outline by dragging around the item.')};document.dispatchEvent(new CustomEvent('shelfscout:itemopened',{detail:{item:o}}))}


// v1.3.1: Optional official Google Programmable Search Element.
// Uses a public search-engine identifier; never scrape Google's HTML or embed google.com in an iframe.
const googlePanel=$('googleSearchPanel'),googleMessage=$('googleMessage');
let googleLoader=null,googleRendered=false,googleCxInUse='';
const cxStorage='shelf-scout-google-cx-v1';
let storedCx='';try{storedCx=localStorage.getItem(cxStorage)||''}catch{}
$('googleCx').value=storedCx;
function googleQueryFor(o){return [o.name,o.notes||''].filter(Boolean).join(' ').replace(/\bcandidate\b/gi,'').replace(/\s+/g,' ').trim()||'vintage collectible';}
function setGoogleMessage(t){googleMessage.textContent=t;}
function goExternalImageSearch(){const q=$('googleQuery').value.trim();if(q)window.open('https://www.google.com/search?udm=2&q='+encodeURIComponent(q),'_blank','noopener,noreferrer');}
function openEmbeddedGoogle(o){
  $('detail').hidden=true;googlePanel.hidden=false;
  $('googleQuery').value=googleQueryFor(o);
  $('googleSetup').open=!storedCx;
  setGoogleMessage(storedCx?'Ready to search the configured sites.':'Set up your free Google Programmable Search Engine to display results here.');
  if(storedCx)runEmbeddedGoogle();
}
$('closeGoogleSearch').onclick=()=>{googlePanel.hidden=true;};
$('externalGoogleImages').onclick=goExternalImageSearch;
$('saveGoogleCx').onclick=()=>{
 const cx=$('googleCx').value.trim();
 if(!/^[a-zA-Z0-9_:.-]{8,150}$/.test(cx)){setGoogleMessage('That does not look like a valid search engine ID. Copy the Search engine ID from your Google control panel.');return;}
 try{localStorage.setItem(cxStorage,cx)}catch{}
 storedCx=cx;googleLoader=null;
 setGoogleMessage('Search engine ID saved on this device. Tap Search configured sites.');
 if(googleRendered&&googleCxInUse!==cx){setGoogleMessage('Search engine changed. Reload this page once to activate the new engine ID.');}
 else runEmbeddedGoogle();
};
$('runGoogleSearch').onclick=runEmbeddedGoogle;
function googleSearchElement(){return window.google?.search?.cse?.element;}
async function loadEmbeddedGoogle(cx){
 if(googleRendered)return;
 if(googleLoader)return googleLoader;
 googleLoader=new Promise((resolve,reject)=>{
  const script=document.createElement('script');script.async=true;
  script.src='https://cse.google.com/cse.js?cx='+encodeURIComponent(cx);
  script.onerror=()=>reject(new Error('Google search could not load. Check content blockers and your connection.'));
  script.onload=()=>resolve();
  document.head.append(script);
 }).catch(e=>{googleLoader=null;throw e});
 await googleLoader;
 // Google's loader initializes asynchronously after the script is downloaded.
 const started=Date.now();
 while(!googleSearchElement()?.render){
  if(Date.now()-started>10000)throw new Error('Google search did not initialize. Check your search engine configuration.');
  await new Promise(r=>setTimeout(r,150));
 }
 googleSearchElement().render({div:'googleResults',tag:'search',gname:'shelfscout',attributes:{enableImageSearch:true,defaultToImageSearch:true}});
 googleRendered=true;googleCxInUse=cx;
}
async function runEmbeddedGoogle(){
 const q=$('googleQuery').value.trim();if(!q){setGoogleMessage('Enter a search phrase first.');return;}
 if(!storedCx){$('googleSetup').open=true;setGoogleMessage('First save the Search engine ID from your free Google Programmable Search Engine.');return;}
 if(googleRendered&&googleCxInUse!==storedCx){setGoogleMessage('Reload the page once to use the changed search-engine ID.');return;}
 setGoogleMessage('Loading Google-powered results…');
 try{
  await loadEmbeddedGoogle(storedCx);
  const e=googleSearchElement()?.getElement('shelfscout');
  if(!e||typeof e.execute!=='function')throw new Error('Google search widget did not expose a search control. Try its built-in search box below.');
  e.execute(q);setGoogleMessage('Showing Google results for: '+q+'. These are search matches, not authenticated items or sold-price confirmations.');
 }catch(e){setGoogleMessage(e.message+' You can still use Full Google Images.');}
}

// v1.3: user-mediated reverse image search, no uploads to Shelf Scout or paid API.
// A Google Lens website cannot be automatically supplied a canvas image through a supported public API.
async function cropFile(o){
 const c=itemCrop(o); const blob=await new Promise((resolve,reject)=>c.toBlob(b=>b?resolve(b):reject(new Error('Could not prepare cropped image.')),'image/jpeg',0.78));
 c.width=0;c.height=0;
 return new File([blob],'shelf-scout-item.jpg',{type:'image/jpeg'});
}
function visualMessage(msg){const e=$('visualHelp');if(e)e.textContent=msg;}
async function shareItemCrop(o){
 try {const file=await cropFile(o);
  if(navigator.canShare?.({files:[file]})&&navigator.share){await navigator.share({files:[file],title:'Shelf Scout item photo',text:'Visual identification reference'});visualMessage('Photo shared. Choose Google Lens or Google/Chrome image search if supported by your installed apps.');}
  else {visualMessage('Sharing files is unavailable in this browser. Use Save cropped photo, then upload it in Google Lens.');}
 }catch(e){if(e.name!=='AbortError')visualMessage('Could not share photo: '+e.message)}
}
async function saveItemCrop(o){
 try {const file=await cropFile(o);const url=URL.createObjectURL(file);const link=document.createElement('a');link.href=url;link.download='shelf-scout-item.jpg';document.body.append(link);link.click();link.remove();setTimeout(()=>URL.revokeObjectURL(url),60000);visualMessage('Cropped image prepared. Save it from Safari Downloads/Files to Photos if needed, then upload it to Google Lens.');}
 catch(e){visualMessage('Could not save crop: '+e.message)}
}
function reset(){scanEpoch++;items=[];$('detail').hidden=true;active=null;paint()};function add(name,score,x,y,w,h,pending=false){const entry={id:uid(),name,score,x,y,w,h,notes:'',pending};items.push(entry);return entry}
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
// Local categorization is not model/maker identification. Use the *item crop only*.
async function classifyCrop(o){
 const detector=await getModel(),crop=itemCrop(o);
 let raw;
 try { raw=await detector(crop.toDataURL('image/jpeg',.78),identityPrompts.map(x=>x[1]),{threshold:.04,top_k:35}); }
 finally {crop.width=0;crop.height=0}
 const scores=new Map();
 for(const hit of raw){
  const idx=identityPrompts.findIndex(p=>p[1]===hit.label);if(idx<0)continue;
  const group=identityPrompts[idx][0],score=Number(hit.score)||0;
  scores.set(group,Math.max(score,scores.get(group)||0));
 }
 const ranked=[...scores].sort((a,b)=>b[1]-a[1]);
 const best=ranked[0],runner=ranked[1];
 // Scores are zero-shot detection matches, not class probabilities.
 // Display alternative labels when the evidence doesn't clearly favor one.
 const uncertain=!best||best[1]<.15||Boolean(runner&&(
  best[1]-runner[1]<.055 || runner[1]>=best[1]*.84));
 const candidates=ranked.slice(0,3).map(([name,score])=>({name,score}));
 const summary=!best?'No usable category matches. Try a closer photo.':
   uncertain?'Category uncertain — these are the strongest visual matches, not verified identifications.':
   'Most likely visual category: '+best[0]+'. Other plausible matches are listed below.';
 return {summary,candidates,uncertain};
}
function renderIdentity(target,identity){
 target.replaceChildren();
 const message=document.createElement('p');
 message.textContent=identity.summary;target.append(message);
 if(identity.candidates&&identity.candidates.length){
  const heading=document.createElement('div');heading.className='identity-heading';
  heading.textContent=identity.uncertain?'Top plausible categories':'Visual category matches';target.append(heading);
  const list=document.createElement('ol');list.className='category-matches';
  for(const [index,c] of identity.candidates.entries()){
   const li=document.createElement('li');
   const label=document.createElement('span');label.textContent=c.name;
   const score=document.createElement('strong');score.textContent=(c.score*100).toFixed(1)+' match';
   li.append(label,score);list.append(li);
  }
  target.append(list);
  const explanation=document.createElement('small');
  explanation.textContent='Match scores rank visual similarities from this model; they are NOT percentages of certainty. Maker, age, authenticity and resale price are unverified.';
  target.append(explanation);
 }
}
async function identify(o,automatic=false){
 if(o.identifying)return;
 o.identifying=true;
 const isDisplayed=()=>active===o&&!$('detail').hidden;
 let target=isDisplayed()?$('identityResult'):null;
 let btn=isDisplayed()?$('identifyItem'):null;
 if(btn)btn.disabled=true;
 if(target)target.textContent='Analyzing only this item’s cropped image…';
 try{
  const identity=await classifyCrop(o);
  o.identity=identity;
  if(isDisplayed()){
   target=$('identityResult');target.replaceChildren();
   renderIdentity(target,identity);

  }
 }catch(e){console.warn('Local identification failed',e);if(isDisplayed())$('identityResult').textContent='Local category analysis unavailable: '+(e?.message||String(e));}
 finally{o.identifying=false;if(isDisplayed())$('identifyItem').disabled=false;}
}
// Priority is a *heuristic about distinctiveness*, not an appraisal or resale forecast.
function priority(o){
 const s=(o.name||'').toLowerCase();
 let n=Number(o.score)||0;
 if(/figurine|statue|ornament|trinket|sculpture|doll|vintage|pottery|decorative|novelty|cake/.test(s))n+=1;
 if(/vase|teapot|pitcher|jar/.test(s))n+=.5;
 return n;
}
async function identifyValidatedInBackground(validatedItems,epoch){
 const queue=validatedItems.filter(o=>items.includes(o)&&!o.pending).sort((a,b)=>priority(b)-priority(a));
 // Conserve Safari memory and battery: first six distinct candidates automatically.
 const autoQueue=queue.slice(0,6);
 for(let i=0;i<autoQueue.length;i++){
  if(epoch!==scanEpoch)return;
  const o=autoQueue[i];if(!items.includes(o))continue;
  setStatus(`Detection validated. Local category identification ${i+1}/${autoQueue.length}… Manufacturer, age and resale value are not verified.`);
  await identify(o,true);
  await new Promise(resolve=>requestAnimationFrame(()=>setTimeout(resolve,0)));
 }
 if(epoch===scanEpoch)setStatus(`Scan complete: ${validatedItems.length} validated outlines; ${autoQueue.length} items categorized locally. Tap any item for details or to analyze more. Maker, age and sold-price research not yet connected.`);
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

// v0.9: A LOCAL secondary screening pass. This is still OWL-ViT, not a true
// physical-object classifier. It uses only the cropped candidate pixels and
// conservative geometric evidence; doubtful detections are excluded.
const validationLabels=[
 'a complete three-dimensional ceramic coffee mug',
 'a complete ceramic cup with a handle',
 'a complete three-dimensional porcelain figurine',
 'a complete small ceramic statue',
 'a complete decorative vase',
 'a complete ceramic bowl',
 'a complete decorative pottery object',
 'a complete glass cup or glass vessel',
 'a complete teapot or ceramic pitcher',
 'a complete freestanding decorative houseware object',
 'a two-dimensional printed illustration or picture',
 'a printed animal character on a ceramic mug',
 'a photograph of an animal or cartoon drawing',
 'empty space between objects on a shelf',
 'a dark background gap between mugs'
];
function boxIntersectionFraction(a,b){
 const ix=Math.max(0,Math.min(a.x+a.w,b.x+b.w)-Math.max(a.x,b.x));
 const iy=Math.max(0,Math.min(a.y+a.h,b.y+b.h)-Math.max(a.y,b.y));
 return ix*iy/Math.max(1,a.w*a.h);
}
async function validateCandidate(detector,p){
 // Do not use shelf context: inspect only candidate rectangle.
 const c=makeCanvas(p.x,p.y,p.w,p.h,384);
 try {
  let raw=await detector(c.toDataURL('image/jpeg',.8),validationLabels,{threshold:.035,top_k:24});
  let positives=[],negative=[];
  for(const hit of raw){
   const i=validationLabels.indexOf(hit.label);if(i<0)continue;
   const b=hit.box||{},x=Number(b.xmin),y=Number(b.ymin),xr=Number(b.xmax),yb=Number(b.ymax);
   if(![x,y,xr,yb].every(Number.isFinite))continue;
   const area=Math.max(0,xr-x)*Math.max(0,yb-y);
   const coverage=area/(c.width*c.height);
   const centreX=(x+xr)/2/c.width,centreY=(y+yb)/2/c.height;
   // Positive evidence must cover a meaningful part of the crop and sit near centre.
   const centred=centreX>.18&&centreX<.82&&centreY>.18&&centreY<.82;
   if(i<10&&coverage>.21&&centred)positives.push(Number(hit.score)||0);
   if(i>=10&&coverage>.12)negative.push(Number(hit.score)||0);
  }
  const positive=Math.max(0,...positives),bad=Math.max(0,...negative);
  // If a model cannot confirm a complete item, err on the side of rejecting it.
  // Relative scores are ranking signals, NOT calibrated class probabilities.
  return {keep:positive>=.075 && positive>=bad*1.12,positive,bad};
 }finally{c.width=0;c.height=0}
}
function suppressContainedDuplicates(preds){
 const ranked=[...preds].sort((a,b)=>b.score-a.score),result=[];
 for(const p of ranked){
  const nested=result.some(q=>{
   const inside=boxIntersectionFraction(p,q);
   const size=(p.w*p.h)/(q.w*q.h);
   return inside>.83 && size<.57;
  });
  if(!nested)result.push(p);
 }
 return result;
}

async function scan(){
 if(busy)return;busy=true;$('scanBtn').disabled=true;
 try{
  if(!video.hidden){const c=document.createElement('canvas');c.width=video.videoWidth;c.height=video.videoHeight;c.getContext('2d').drawImage(video,0,0);img.src=c.toDataURL('image/jpeg',.85);img.hidden=false;video.hidden=true;stopCamera();await img.decode();c.width=0;c.height=0;}
  if(!img.complete||!img.naturalWidth)throw Error('Load a photograph first.');
  reset();const epoch=scanEpoch;const m=await getModel(),w=img.naturalWidth,h=img.naturalHeight;
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
  const candidates=suppressContainedDuplicates(merge(found));
  // Limit second-pass work to protect iPhone memory, battery and wait time.
  // Reject unvalidated detections rather than asserting they are real objects.
  const cap=12,checked=candidates.slice(0,cap);
  let rejected=candidates.length-checked.length,errors=0,validated=0;const accepted=[];
  // Show provisional results as soon as the first detector finishes.
  // A dotted border is validation status, NOT an estimated resale valuation.
  const pending=checked.map(p=>add(p.name,p.score,p.x,p.y,p.w,p.h,true));
  paint();
  const started=performance.now();
  setStatus(`Found ${candidates.length} initial candidates. Checking ${checked.length} locally: dotted = tentative, solid = validated. No resale data is connected.`);
  // Yield to Safari so provisional boxes have an opportunity to render.
  await new Promise(resolve=>requestAnimationFrame(()=>setTimeout(resolve,0)));
  for(let i=0;i<checked.length;i++){
   const entry=pending[i];
   try{
    const validity=await validateCandidate(m,checked[i]);
    if(validity.keep){entry.pending=false;validated++;accepted.push(entry)}
    else {items=items.filter(x=>x!==entry);rejected++;if(active===entry){active=null;$('detail').hidden=true}}
   }catch(e){console.warn('Candidate validation failed',e);errors++;rejected++;items=items.filter(x=>x!==entry);if(active===entry){active=null;$('detail').hidden=true}}
   paint();
   const remaining=checked.length-i-1;
   setStatus(`Local validation ${i+1}/${checked.length} complete: ${validated} solid, ${remaining} dotted, ${rejected} withheld. ${Math.round((performance.now()-started)/1000)}s elapsed. No sold-price data is connected.`);
   // Allow touch input and display refresh between candidates.
   await new Promise(resolve=>requestAnimationFrame(()=>setTimeout(resolve,0)));
  }
  paint();setStatus(`Validation complete: ${validated} solid outlines from ${candidates.length} candidates; withheld ${rejected}${errors?' ('+errors+' errors)':''}. Starting local item categories…`);
  // Start after rendering. The scan remains usable while item categories update.
  void identifyValidatedInBackground(accepted,epoch);
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
