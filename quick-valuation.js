/* Shelf Scout Quick Valuation v0.3. Local-only screenshot processing and user-led research. */
(() => {
  'use strict';
  const $ = id => document.getElementById(id);
  const dom = Object.fromEntries(['hero','photoFile','demoBtn','changePhoto','workbench','ocrStatus','ocrSpinner','statusText','screenshot','frame','regions','selection','selectionIndex','candidateList','modeLabel','addRegion','retryOcr','result','itemCrop','itemSummary','cropSize','titleInput','priceInput','notesInput','valuationStatus','shareBtn','downloadBtn','copyQuery','cropReset','cropNarrow','cropWide','cropShort','cropTall','reviewSelected','searchPhrase','ebaySold','ebayLive','etsyLink','mercariLink','poshLink','googleLink','toast'].map(k=>[k,$(k)]));
  const s = {image:null,sourceName:'',regions:[],selected:0,ocrText:'',ocrLines:[],ocrPromise:null,toastTimeout:null,drag:null,loadedImageURL:null,demo:false};
  const clamp=(n,lo,hi)=>Math.min(hi,Math.max(lo,n));
  const frac=(n)=>clamp(n,0,1);
  const sane=(x)=>String(x??'').replace(/\s+/g,' ').trim();
  function toast(message){dom.toast.textContent=message;dom.toast.classList.add('visible');clearTimeout(s.toastTimeout);s.toastTimeout=setTimeout(()=>dom.toast.classList.remove('visible'),3200)}
  function status(message,loading=false){dom.statusText.textContent=message;dom.ocrSpinner.classList.toggle('off',!loading)}
  const money=s=>{const m=String(s||'').replace(/,/g,'').match(/(?:US\s*)?\$\s*(\d+(?:\.\d{1,2})?)|(?:USD\s*)(\d+(?:\.\d{1,2})?)/i);return m?Number(m[1]||m[2]).toFixed(2):''};
  const priceRx=/(?:US\s*)?\$\s*\d+(?:[.,]\d{1,2})?|\bUSD\s*\d+(?:[.,]\d{1,2})?/i;
  function normRect(r){let x=frac(r.x),y=frac(r.y),w=clamp(r.w,.08,1),h=clamp(r.h,.08,1);return {x:clamp(x,0,1-w),y:clamp(y,0,1-h),w,h}}
  const makeRegion=(box,price='',title='',mode='Suggested item')=>({rect:normRect(box),suggestedRect:normRect(box),price,title,notes:'',mode});
  function reset(){if(s.loadedImageURL){URL.revokeObjectURL(s.loadedImageURL);s.loadedImageURL=null}s.image=null;s.regions=[];s.selected=0;s.ocrLines=[];s.ocrText='';dom.candidateList.replaceChildren();dom.regions.replaceChildren();dom.result.classList.add('hidden');dom.workbench.classList.add('hidden');dom.selection.classList.add('hidden');}
  async function readFile(file,demo=false){if(!file)return; if(!file.type.startsWith('image/')){toast('Please select an image screenshot.');return}if(file.size>30e6){toast('Please choose a photo under 30 MB.');return}
    reset();s.demo=demo;s.sourceName=file.name||'Screenshot';const image=new Image();const u=URL.createObjectURL(file);s.loadedImageURL=u;image.src=u;
    try{await image.decode()}catch(e){toast('Could not open that image.');return}
    s.image=image;dom.screenshot.src=u;dom.hero.classList.add('hidden');dom.workbench.classList.remove('hidden');dom.result.classList.remove('hidden');status('Finding image card boundaries…',true);
    try {const cards=window.QVImageCards?.fromImage(image)||[];
      s.regions=cards.map(box=>makeRegion(box,'','','Photo card · visually located'));
    }catch(e){console.warn('Image card detection failed',e);s.regions=[];}
    if(!s.regions.length){const w=image.naturalWidth,h=image.naturalHeight;
      s.regions=[makeRegion({x:.045,y:.12,w:.91,h:clamp((w*.91)/h,.22,.63)},'','','Manual crop · no card boundary found')];
      status('No clear photo card boundaries found. Adjust the crop manually.');
    } else status(`Found ${s.regions.length} photo card${s.regions.length===1?'':'s'} from image boundaries. Reading listing details…`,true);
    dom.modeLabel.textContent=s.regions.length>1?`Feed · ${s.regions.length} image cards`:'One image card';
    s.selected=0;drawRegions();selectRegion(0,false);dom.workbench.scrollIntoView({behavior:'smooth',block:'start'});
    if(s.demo){loadDemoRegions();return;}
    await doOcr();
  }
  function loadDemoRegions(){
    // The sample runs through the SAME pixel-based boundary detector as uploads.
    // Captions/prices below are reference text from the provided sample image,
    // not claimed as OCR output or independent resale evidence.
    const known=[['Cute figurine','3.00'],['American Vintage','8.00'],['Christmas mug','2.00'],['Vintage Style Mid Century M…','9.00']];
    s.regions.forEach((r,i)=>{if(known[i]){r.title=known[i][0];r.price=known[i][1];r.mode='Image card · sample caption';}});
    dom.modeLabel.textContent=`Sample feed · ${s.regions.length} detected images`;
    status(`Detected ${s.regions.length} image cards from your Vinted sample. Sample titles and asking prices prefilled; crops are computer-detected.`);
    drawRegions();selectRegion(0,false);
  }
  async function getOcrEngine(){if(!window.Tesseract){await new Promise((resolve,reject)=>{const sc=document.createElement('script');sc.src='https://cdn.jsdelivr.net/npm/tesseract.js@5.1.1/dist/tesseract.min.js';sc.onload=resolve;sc.onerror=()=>reject(new Error('OCR library could not download'));document.head.append(sc)})}if(!s.ocrPromise){s.ocrPromise=Tesseract.createWorker('eng',1,{logger:m=>{if(m.status==='recognizing text'&&m.progress!==undefined)status(`Reading screenshot text… ${Math.round(m.progress*100)}%`,true)}}).catch(err=>{s.ocrPromise=null;throw err})}return s.ocrPromise}
  function groupWords(words){const rows=[];for(const word of words){if(!word.text?.trim()||!word.bbox)continue;const bb=word.bbox,cy=(bb.y0+bb.y1)/2;let row=rows.find(r=>Math.abs(r.cy-cy)<Math.max(14,(bb.y1-bb.y0)*.6));if(!row){row={cy,words:[]};rows.push(row)}row.words.push(word)}return rows.map(r=>{r.words.sort((a,b)=>a.bbox.x0-b.bbox.x0);return {text:r.words.map(w=>w.text).join(' '),bbox:{x0:Math.min(...r.words.map(w=>w.bbox.x0)),y0:Math.min(...r.words.map(w=>w.bbox.y0)),x1:Math.max(...r.words.map(w=>w.bbox.x1)),y1:Math.max(...r.words.map(w=>w.bbox.y1))}}})}
  async function doOcr(){if(!s.image)return;if(s.demo){loadDemoRegions();return}status('Loading local text recognition…',true);try{
    const worker=await getOcrEngine();if(!s.image)return;const img=s.image;const scale=Math.min(1,1800/Math.max(img.naturalWidth,img.naturalHeight));const canvas=document.createElement('canvas');canvas.width=Math.max(1,Math.round(img.naturalWidth*scale));canvas.height=Math.max(1,Math.round(img.naturalHeight*scale));canvas.getContext('2d',{willReadFrequently:true}).drawImage(img,0,0,canvas.width,canvas.height);
    const out=await worker.recognize(canvas);const data=out.data||{};s.ocrText=data.text||'';let lines=(data.lines?.length?data.lines:groupWords(data.words||[])).filter(l=>l.text?.trim()&&l.bbox).map(l=>({text:sane(l.text),box:{x:l.bbox.x0/canvas.width,y:l.bbox.y0/canvas.height,w:(l.bbox.x1-l.bbox.x0)/canvas.width,h:(l.bbox.y1-l.bbox.y0)/canvas.height}}));s.ocrLines=lines;const priceLines=lines.filter(l=>priceRx.test(l.text));
    attachTextToImageCards(lines);
    const found=s.regions.filter(r=>r.price).length;
    dom.modeLabel.textContent=s.regions.length>1?`Feed · ${s.regions.length} image cards`:'Single photo';
    status(`Found ${s.regions.length} image card${s.regions.length===1?'':'s'} visually; ${found} asking price${found===1?'':'s'} linked using text recognition. Check or correct details.`);
    drawRegions();selectRegion(0,false);
  }catch(err){console.warn('Local OCR unavailable',err);dom.modeLabel.textContent='Manual review';status('Automatic text reading unavailable. You can still adjust the crop and enter the price manually.');toast('OCR could not load; manual editing still works.');drawRegions();selectRegion(0,false)}}
  const cleanTitle=text=>sane(text).replace(/\b(?:\d+\s*(?:likes?|views?|saves?|mins?|hours?|days?|km|mi)\b.*)$/i,'').slice(0,100);
  const ignoredTitle=/^(?:facebook|marketplace|vinted|home|search|filter|share|save|seller|message|buy|shipping|delivery|you may also like|recommended|favorites|listings|chat|profile|more|today|yesterday|details|description|condition|like new|new with tags|see more|make offer|buy now|pickup|for you|local|sort by)$/i;
  // OCR NEVER places photo cards. It only assigns captions and prices to the
  // image blocks identified from screenshot pixels. This prevents caption and
  // price positions from pulling crop boundaries across multiple listings.
  function attachTextToImageCards(lines){
    const conditions=/^(?:very good|good|fair|new|brand new|like new|used|acceptable|new with tags|new without tags|incl\.?|buyer protection|shipping)$/i;
    const centerX=l=>l.box.x+l.box.w/2;
    const sorted=lines.slice().sort((a,b)=>a.box.y-b.box.y);
    for(const region of s.regions){
      const z=region.rect;const bottom=z.y+z.h;
      const next=s.regions.filter(r=>r!==region&&Math.abs((r.rect.x+r.rect.w/2)-(z.x+z.w/2))<.15&&r.rect.y>bottom+.02)
        .sort((a,b)=>a.rect.y-b.rect.y)[0];
      const yMax=Math.min(next?.rect.y??1,bottom+.205);
      const relevant=sorted.filter(l=>centerX(l)>z.x+.008&&centerX(l)<z.x+z.w-.008&&l.box.y>bottom-.004&&l.box.y<yMax);
      let prices=relevant.filter(l=>priceRx.test(l.text));
      prices.sort((a,b)=>a.box.y-b.box.y);
      // Source apps often show two prices: base seller asking price and
      // total including fees. The base price comes first, if available.
      const base=prices.find(l=>!/incl|ship|postage|buyer protection|total|with fees/i.test(l.text))||prices[0];
      if(base)region.price=money(base.text);
      const firstPrice=base?.box.y??yMax;
      const candidates=relevant.filter(l=>l.box.y<firstPrice-.008&&!priceRx.test(l.text)&&l.text.length>=3&&!ignoredTitle.test(l.text)&&!conditions.test(l.text));
      const title=candidates.find(l=>l.box.y<=bottom+.095)||candidates[0];
      if(title)region.title=cleanTitle(title.text);
      region.mode=base?'Image boundary + OCR price':'Image boundary · check price';
    }
  }
  function drawRegions(){if(!s.image)return;dom.regions.replaceChildren();s.regions.forEach((r,i)=>{const d=document.createElement('button');d.type='button';d.className='region'+(i===s.selected?' selected':'');d.setAttribute('aria-label',`Select item ${i+1}`);const z=r.rect;Object.assign(d.style,{left:`${z.x*100}%`,top:`${z.y*100}%`,width:`${z.w*100}%`,height:`${z.h*100}%`});const marker=document.createElement('span');marker.className='region-tag';marker.textContent=i+1;d.append(marker);d.addEventListener('click',()=>selectRegion(i,false));dom.regions.append(d)});drawSelection();drawCandidateList()}
  function drawCandidateList(){dom.candidateList.replaceChildren();s.regions.forEach((r,i)=>{const btn=document.createElement('button');btn.type='button';btn.className='candidate'+(i===s.selected?' active':'');const idx=document.createElement('b');idx.textContent=i+1;const content=document.createElement('span');const head=document.createElement('strong');head.textContent=r.title||`Item ${i+1} · needs review`;const detail=document.createElement('small');detail.textContent=[r.price?`Asking $${r.price}`:'Price unknown',r.mode].join(' · ');content.append(head,detail);const chev=document.createElement('span');chev.className='chev';chev.textContent='›';btn.append(idx,content,chev);btn.addEventListener('click',()=>selectRegion(i,false));dom.candidateList.append(btn)})}
  function selectRegion(i,scroll){if(!s.regions[i])return;s.selected=i;drawRegions();const r=s.regions[i];dom.titleInput.value=r.title;dom.priceInput.value=r.price;dom.notesInput.value=r.notes;updatePreview();updateLinks();if(scroll)dom.result.scrollIntoView({behavior:'smooth',block:'start'})}
  function drawSelection(){const r=s.regions[s.selected];if(!r){dom.selection.classList.add('hidden');return}dom.selection.classList.remove('hidden');dom.selectionIndex.textContent=s.selected+1;Object.assign(dom.selection.style,{left:`${r.rect.x*100}%`,top:`${r.rect.y*100}%`,width:`${r.rect.w*100}%`,height:`${r.rect.h*100}%`})}
  function imageCrop(maxEdge=900){const im=s.image,r=s.regions[s.selected];if(!im||!r)return null;const z=r.rect,W=im.naturalWidth,H=im.naturalHeight;const sx=Math.round(z.x*W),sy=Math.round(z.y*H),sw=Math.max(1,Math.round(z.w*W)),sh=Math.max(1,Math.round(z.h*H));const factor=Math.min(1,maxEdge/Math.max(sw,sh));const c=document.createElement('canvas');c.width=Math.max(1,Math.round(sw*factor));c.height=Math.max(1,Math.round(sh*factor));const ctx=c.getContext('2d');ctx.drawImage(im,sx,sy,sw,sh,0,0,c.width,c.height);return c}
  function updatePreview(){const c=imageCrop(850);if(!c)return;dom.itemCrop.src=c.toDataURL('image/jpeg',.74);dom.cropSize.textContent=`${Math.round(c.width)} × ${Math.round(c.height)} crop`;dom.itemSummary.textContent=s.regions[s.selected].title||`Selected item #${s.selected+1}`}
  function researchTerms(){const r=s.regions[s.selected]||{};return sane([r.title||'',r.notes||''].join(' ')).replace(/[<>"'`]/g,'').slice(0,160)}
  function updateLinks(){const r=s.regions[s.selected];if(!r)return;const term=researchTerms(),q=encodeURIComponent(term||'vintage collectible'),base='https://';dom.searchPhrase.textContent=term||'Add a title or identifying details to generate a targeted search.';
    dom.ebaySold.href=base+`www.ebay.com/sch/i.html?_nkw=${q}&LH_Sold=1&LH_Complete=1`;
    dom.ebayLive.href=base+`www.ebay.com/sch/i.html?_nkw=${q}`;
    dom.etsyLink.href=base+`www.etsy.com/search?q=${q}`;
    dom.mercariLink.href=base+`www.mercari.com/search/?keyword=${q}`;
    dom.poshLink.href=base+`poshmark.com/search?query=${q}`;
    dom.googleLink.href=base+`www.google.com/search?tbm=isch&q=${q}`;
    const val=r.price?`Seller is asking $${r.price}. This is not a verified resale value.`:'Seller asking price unknown.';
    dom.valuationStatus.textContent=`${val} No independently verified sold comparables have been retrieved.`;
  }
  function userEdit(){const r=s.regions[s.selected];if(!r)return;r.title=sane(dom.titleInput.value);r.price=dom.priceInput.value.replace(/[^0-9.]/g,'').slice(0,12);r.notes=sane(dom.notesInput.value);dom.itemSummary.textContent=r.title||`Selected item #${s.selected+1}`;drawCandidateList();updateLinks()}
  async function blobFromCanvas(canvas){return new Promise((resolve,reject)=>canvas.toBlob(blob=>blob?resolve(blob):reject(new Error('Cannot export image')),'image/jpeg',.76))}
  async function exportPhoto(share){const c=imageCrop(1200);if(!c)return;try{const blob=await blobFromCanvas(c);const file=new File([blob],'shelf-scout-item.jpg',{type:'image/jpeg'});if(share&&navigator.canShare?.({files:[file]})&&navigator.share){try{await navigator.share({files:[file],title:'Shelf Scout item photo'});return}catch(e){if(e?.name==='AbortError')return;console.warn('Share failed',e)}}if(share)toast('Share unavailable here. Download the image and upload it to Lens.');const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download='shelf-scout-item.jpg';a.click();setTimeout(()=>URL.revokeObjectURL(url),12000)}catch(e){toast('Could not prepare image.')}}
  function bindSelection(){const sel=dom.selection,frame=dom.frame;
    sel.addEventListener('pointerdown',e=>{if(!s.image)return;const current=s.regions[s.selected];if(!current)return;e.preventDefault();const el=e.target.closest('[data-grab]');s.drag={pid:e.pointerId,kind:el?.dataset.grab||'move',clientX:e.clientX,clientY:e.clientY,old:{...current.rect}};sel.setPointerCapture(e.pointerId)});
    sel.addEventListener('pointermove',e=>{if(!s.drag||s.drag.pid!==e.pointerId)return;const b=frame.getBoundingClientRect(),dx=(e.clientX-s.drag.clientX)/b.width,dy=(e.clientY-s.drag.clientY)/b.height,o=s.drag.old;let r={...o};const k=s.drag.kind;
      if(k==='move'){r.x=clamp(o.x+dx,0,1-o.w);r.y=clamp(o.y+dy,0,1-o.h)}else{
        if(k.includes('w')){const right=o.x+o.w;r.x=clamp(o.x+dx,0,right-.08);r.w=right-r.x}
        if(k.includes('e'))r.w=clamp(o.w+dx,.08,1-o.x);
        if(k.includes('n')){const bottom=o.y+o.h;r.y=clamp(o.y+dy,0,bottom-.08);r.h=bottom-r.y}
        if(k.includes('s'))r.h=clamp(o.h+dy,.08,1-o.y);
      }s.regions[s.selected].rect=r;drawSelection();});
    const end=e=>{if(!s.drag||e.pointerId!==s.drag.pid)return;s.drag=null;updatePreview()};sel.addEventListener('pointerup',end);sel.addEventListener('pointercancel',end);
    frame.addEventListener('click',e=>{if(!s.image||e.target.closest('.selection')||e.target.closest('.region'))return;const b=dom.screenshot.getBoundingClientRect(),cx=(e.clientX-b.left)/b.width,cy=(e.clientY-b.top)/b.height;const ix=s.regions.findIndex(r=>cx>=r.rect.x&&cx<=r.rect.x+r.rect.w&&cy>=r.rect.y&&cy<=r.rect.y+r.rect.h);if(ix>=0)selectRegion(ix,false);});
  }
  // One-tap adjustments make cropping possible even on smaller screens.
  function changeCrop(dx,dy){const r=s.regions[s.selected];if(!r)return;const z=r.rect,cx=z.x+z.w/2,cy=z.y+z.h/2;
    const w=clamp(z.w+dx,.12,1),h=clamp(z.h+dy,.10,1);
    r.rect=normRect({x:cx-w/2,y:cy-h/2,w,h});drawSelection();updatePreview();}
  dom.cropNarrow.addEventListener('click',()=>changeCrop(-.045,0));
  dom.cropWide.addEventListener('click',()=>changeCrop(.045,0));
  dom.cropShort.addEventListener('click',()=>changeCrop(0,-.035));
  dom.cropTall.addEventListener('click',()=>changeCrop(0,.035));
  dom.cropReset.addEventListener('click',()=>{const r=s.regions[s.selected];if(!r)return;r.rect={...r.suggestedRect};drawSelection();updatePreview();toast('Crop reset to suggested photo bounds.')});
  dom.reviewSelected.addEventListener('click',()=>dom.result.scrollIntoView({behavior:'smooth',block:'start'}));
  dom.photoFile.addEventListener('change',()=>{const file=dom.photoFile.files?.[0];if(file)readFile(file,false)});
  dom.changePhoto.addEventListener('click',()=>{reset();dom.hero.classList.remove('hidden');dom.photoFile.value='';dom.hero.scrollIntoView({behavior:'smooth'})});
  dom.demoBtn.addEventListener('click',async()=>{try{const resp=await fetch('./quick-valuation-demo.jpg?v=0300');if(!resp.ok)throw Error('missing');const file=new File([await resp.blob()],'quick-valuation-demo.jpg',{type:'image/jpeg'});readFile(file,true)}catch(err){toast('Sample photo could not load. Upload your own screenshot instead.')}});
  dom.retryOcr.addEventListener('click',()=>doOcr());
  dom.addRegion.addEventListener('click',()=>{if(!s.image)return;const ref=s.regions[s.selected]?.rect||{x:.20,y:.22,w:.6,h:.35};const r=makeRegion({x:clamp(ref.x+.04,0,.7),y:clamp(ref.y+.04,0,.7),w:ref.w,h:ref.h},'','','Manual selection');s.regions.push(r);selectRegion(s.regions.length-1,true);toast('New area created. Drag the border to the item.')});
  [dom.titleInput,dom.priceInput,dom.notesInput].forEach(inp=>inp.addEventListener('input',userEdit));
  dom.shareBtn.addEventListener('click',()=>exportPhoto(true));dom.downloadBtn.addEventListener('click',()=>exportPhoto(false));
  dom.copyQuery.addEventListener('click',async()=>{try{await navigator.clipboard.writeText(researchTerms());toast('Search phrase copied.')}catch(e){toast('Clipboard unavailable; select the phrase manually.')}});
  bindSelection();
})();
