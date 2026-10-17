/* Shelf Scout v1.4 — user-provided visual matches only. No automated scraping or paid API calls. */
(()=>{'use strict';
const $=id=>document.getElementById(id);
const panel=$('matchPanel'),paste=$('matchPaste'),cards=$('matchCards'),stats=$('matchStats');
let current=null;
const sample=[
 {marketplace:'Etsy',title:'Vintage Ukrainian Clay Kitchen Set – Carpathian Mug & Salt Cellar – Early 2000s',url:'https://www.etsy.com/listing/4347297130/vintage-ukrainian-clay-kitchen-set',price:'$34.00',price_status:'asking',notes:'Two-piece set; not an exact confirmed match.'},
 {marketplace:'Etsy',title:'Same title as card 1; different photo',url:'https://www.etsy.com/listing/4347297130/vintage-ukrainian-clay-kitchen-set',price:'$34',price_status:'asking',notes:'Duplicate search card for the same Etsy listing.'},
 {marketplace:'Etsy',title:'Same title as card 1; different photo',url:'https://www.etsy.com/listing/4347297130/vintage-ukrainian-clay-kitchen-set',price:'$34',price_status:'asking'},
 {marketplace:'eBay',title:'Vintage Tiki Restaurant Cup Mug Barware Mermaid Handle Ship Stoneware Glazed',url:'https://www.ebay.com/itm/287362925681',price:'US $24.00',price_status:'asking',notes:'Buy It Now or Best Offer. Similar, not an exact confirmed match.'},
 {marketplace:'eBay',title:'Same title as card 4; different photo',url:'https://www.ebay.com/itm/287362925681',price:'$24',price_status:'asking'}
];
const workerPrompt=`Review the Google Lens visual matches for the attached Shelf Scout cropped item photo. Inspect at most 10 marketplace results, following listing links through the normal browser interface where allowed. Group different photos of the same listing as duplicates. Do not claim identical identity or authenticity without evidence. Clearly distinguish an ASKING price from a completed SOLD transaction. For SOLD claims include a sale date and a source link, otherwise use UNKNOWN. Reply with ONLY a JSON array using keys: marketplace, title, url, price, price_status (asking/sold/unknown), image_url (only if reliably visible and permitted), sale_date (if available), notes. Don't invent missing fields or scrape around restrictions. No sold-price valuations based on active listings.`;
function setMsg(text){$('matchImportStatus').textContent=text;}
function safeUrl(value){
 try{const u=new URL(String(value||'').trim());if(u.protocol!=='https:'&&u.protocol!=='http:')return '';if(!u.hostname||u.username||u.password)return '';return u.href;}catch{return '';}
}
function canonicalUrl(url){
 const good=safeUrl(url);if(!good)return '';
 const u=new URL(good),host=u.hostname.toLowerCase().replace(/^www\./,'');
 const path=u.pathname.replace(/\/+$/,'');
 let m;
 if(host.endsWith('ebay.com')&&(m=path.match(/(?:^|\/)itm\/(?:[^/]*\/)?(\d{9,15})(?:\/|$)/i)))return 'ebay:'+m[1];
 if(host.endsWith('etsy.com')&&(m=path.match(/\/listing\/(\d+)/i)))return 'etsy:'+m[1];
 if(host.endsWith('poshmark.com')&&(m=path.match(/\/listing\/([^/?]+)/i)))return 'poshmark:'+m[1].toLowerCase();
 if(host.endsWith('mercari.com')&&(m=path.match(/\/item\/(m\d+)/i)))return 'mercari:'+m[1].toLowerCase();
 return host+path.toLowerCase()+(u.searchParams.has('id')?'?id='+u.searchParams.get('id'):'');
}
function marketplaceFromUrl(url){try{const h=new URL(url).hostname.toLowerCase();if(h.endsWith('ebay.com'))return 'eBay';if(h.endsWith('etsy.com'))return 'Etsy';if(h.endsWith('poshmark.com'))return 'Poshmark';if(h.endsWith('mercari.com'))return 'Mercari';if(h.endsWith('rubylane.com'))return 'Ruby Lane';return h.replace(/^www\./,'');}catch{return 'Other source';}}
function statusFrom(raw){
 const s=String(raw??'').toLowerCase();
 if(/(not\s+(?:a\s+)?sold|no\s+confirmed\s+sale|unsold|asking|buy\s+it\s+now|best\s+offer|available\s+to\s+add\s+to\s+cart|listed)/.test(s))return 'asking';
 if(/(?:\bsold\b|completed\s+sale|sold\s+transaction)/.test(s))return 'sold';
 return 'unknown';
}
function priceFrom(raw){if(typeof raw==='number'&&Number.isFinite(raw))return raw>=0?raw:null;const s=String(raw??'');const m=s.replace(/,/g,'').match(/(?:USD|US\s*\$|\$)\s*(\d+(?:\.\d{1,2})?)/i)||s.trim().match(/^(\d+(?:\.\d{1,2})?)$/);if(!m)return null;let v=Number(m[1]);return Number.isFinite(v)&&v>=0&&v<1e9?v:null;}
function parseMarkdownLink(text){const t=String(text??'').trim();const m=t.match(/\[[^\]]+\]\((https?:\/\/[^)\s]+)\)/);return m?m[1]:t.match(/https?:\/\/[^\s)>]+/)?.[0]||'';}
function csvishRow(line){return String(line).replace(/^\|/,'').replace(/\|\s*$/,'').split(/(?<!\\)\|/).map(x=>x.replace(/\\\|/g,'|').trim());}
function parseMarkdown(text){
 const lines=text.split(/\r?\n/).filter(l=>l.trim().startsWith('|'));
 if(lines.length<3)throw Error('No valid JSON or Markdown table found. Paste the Work results table or use the sample.');
 const head=csvishRow(lines[0]).map(s=>s.toLowerCase());
 const idx=patterns=>head.findIndex(s=>patterns.some(p=>s.includes(p)));
 const cols={title:idx(['title','listing']),marketplace:idx(['marketplace','source']),price:idx(['price','amount']),status:idx(['status','type']),url:idx(['url','link','destination']),image:idx(['image','thumbnail']),date:idx(['sale date','sold date']),notes:idx(['note'])};
 if(cols.title<0||cols.url<0)throw Error('Table must include listing title and destination URL columns.');
 const result=[];
 for(const l of lines.slice(1)){
  const cells=csvishRow(l);
  if(cells.every(c=>/^:?-+:?$/.test(c.replace(/\s/g,''))))continue;
  const val=i=>i<0?'':cells[i]||'';
  const url=parseMarkdownLink(val(cols.url));if(!url)continue;
  result.push({title:val(cols.title),marketplace:val(cols.marketplace),url,price:val(cols.price),price_status:val(cols.status),image_url:parseMarkdownLink(val(cols.image)),sale_date:val(cols.date),notes:val(cols.notes)});
 }
 if(!result.length)throw Error('The table did not contain any rows with listing links.');
 return result;
}
function parseImport(text){
 const value=String(text||'').trim();if(!value)throw Error('Paste JSON or a research table first.');
 if(value.length>125000)throw Error('Research text is too long; paste up to 125 KB at a time.');
 let json=value.replace(/^```(?:json)?\s*\n?/i,'').replace(/\n?```\s*$/,'');
 if(json.trim().startsWith('{')||json.trim().startsWith('[')){
  let obj;try{obj=JSON.parse(json)}catch{throw Error('JSON could not be parsed. Make sure it uses valid double-quoted JSON syntax.');}
  const rows=Array.isArray(obj)?obj:obj.matches||obj.results||obj.listings;
  if(!Array.isArray(rows))throw Error('JSON must be an array, or an object containing a matches array.');
  return rows;
 }
 return parseMarkdown(value);
}
function normalized(row){
 if(!row||typeof row!=='object')return null;
 const url=safeUrl(row.url||row.destination_url||row.listing_url||row.link||'');
 if(!url)return null;
 const rawStatus=row.price_status??row.price_type??row.status??row.priceStatus??'';
 const price=priceFrom(row.price_usd??row.price??row.displayed_price??row.amount??null);
 const title=String(row.title||row.listing_title||row.name||'Untitled listing').trim().slice(0,300);
 const image=safeUrl(row.image_url||row.thumbnail_url||row.image||'');
 const source=marketplaceFromUrl(url);
 const date=String(row.sale_date||row.sold_at||'').slice(0,30);
 return {id:canonicalUrl(url),source,title,url,price,priceStatus:statusFrom(rawStatus),imageUrl:image,notes:String(row.notes||row.comment||'').trim().slice(0,1200),saleDate:date,duplicateCards:1,relevance:'unreviewed'};
}
function isPlaceholderTitle(s){return /^same (?:title|listing) as (?:card|row)\b/i.test(s||'');}
function combine(rows,existing=[]){
 // Count multiple photos of one listing *within this import*, but don't inflate
 // image-card counts if the same batch is pasted twice or brought back later.
 const inBatch=new Map(),all=new Map();
 const counts={received:rows.length,invalid:0,duplicates:0,added:0,alreadyKnown:0};
 for(const old of existing){if(old&&old.id)all.set(old.id,{...old});}
 for(const row of rows.slice(0,100)){
  const o=normalized(row);if(!o){counts.invalid++;continue;}
  const prior=inBatch.get(o.id);
  if(prior){counts.duplicates++;prior.duplicateCards++;
   if(isPlaceholderTitle(prior.title)&&!isPlaceholderTitle(o.title))prior.title=o.title;
   if(!prior.imageUrl&&o.imageUrl)prior.imageUrl=o.imageUrl;
   if(prior.price===null&&o.price!==null)prior.price=o.price;
   if(prior.priceStatus==='unknown'&&o.priceStatus!=='unknown')prior.priceStatus=o.priceStatus;
   if(!prior.notes&&o.notes)prior.notes=o.notes;
   if(!prior.saleDate&&o.saleDate)prior.saleDate=o.saleDate;
  }else inBatch.set(o.id,o);
 }
 for(const o of inBatch.values()){
  const prior=all.get(o.id);
  if(prior){counts.alreadyKnown++;
   prior.duplicateCards=Math.max(prior.duplicateCards||1,o.duplicateCards||1);
   if(isPlaceholderTitle(prior.title)&&!isPlaceholderTitle(o.title))prior.title=o.title;
   if(!prior.imageUrl&&o.imageUrl)prior.imageUrl=o.imageUrl;
   if(prior.price===null&&o.price!==null)prior.price=o.price;
   if(prior.priceStatus==='unknown'&&o.priceStatus!=='unknown')prior.priceStatus=o.priceStatus;
   if(!prior.notes&&o.notes)prior.notes=o.notes;
   if(!prior.saleDate&&o.saleDate)prior.saleDate=o.saleDate;
  }else{all.set(o.id,o);counts.added++;}
 }
 return {matches:[...all.values()].slice(0,100),counts};
}
function node(tag,cls,text){const el=document.createElement(tag);if(cls)el.className=cls;if(text!==undefined)el.textContent=text;return el;}
function statusLabel(o){if(o.priceStatus==='asking')return 'Asking price · NOT sold';if(o.priceStatus==='sold')return 'Reported sold · not verified';return 'Price status unknown';}
function fmt(o){return typeof o.price==='number'?'$'+o.price.toLocaleString('en-US',{minimumFractionDigits:2,maximumFractionDigits:2}):'Price unavailable';}
function safeImage(o){if(!o.imageUrl)return null;try{const u=new URL(o.imageUrl);return u.protocol==='https:'||u.protocol==='http:'?o.imageUrl:null}catch{return null;}}
function listingCard(o,mini=false){
 const card=node('article','match-card');
 const top=node('div','match-card-top');
 const src=safeImage(o);
 if(src){const image=node('img','match-thumbnail');image.src=src;image.alt='User-imported listing thumbnail';image.loading='lazy';image.referrerPolicy='no-referrer';image.onerror=()=>image.replaceWith(node('div','match-photo-fallback',o.source));top.append(image);}
 else top.append(node('div','match-photo-fallback',o.source));
 const desc=node('div','match-description');desc.append(node('div','match-source',o.source));desc.append(node('div','match-title',o.title));desc.append(node('div','match-price',fmt(o)));
 const badge=node('span','match-type '+o.priceStatus,statusLabel(o));desc.append(badge);
 top.append(desc);card.append(top);
 const foot=node('div','match-card-foot');const a=node('a','', 'Open original listing ↗');a.href=o.url;a.target='_blank';a.rel='noopener noreferrer';foot.append(a);
 if(o.duplicateCards>1)foot.append(node('span','match-small',`${o.duplicateCards} image cards merged`));card.append(foot);
 if(!mini){
  if(o.notes)card.append(node('p','',o.notes));
  if(o.saleDate)card.append(node('p','match-small','Reported sale date: '+o.saleDate+' (not independently checked)'));
  const review=node('div','match-card-foot');const label=node('label','match-small','Your visual review: ');
  const sel=document.createElement('select');sel.setAttribute('aria-label','Visual match review for '+o.title);
  for(const [value,t] of [['unreviewed','Not reviewed'],['possible','Possible match'],['likely','Looks like same item'],['not-match','Not a match']]){const opt=document.createElement('option');opt.value=value;opt.textContent=t;sel.append(opt);}
  sel.value=o.relevance||'unreviewed';sel.onchange=()=>{o.relevance=sel.value;persistSaved();renderPreview();};label.append(sel);review.append(label);
  const remove=node('button','match-delete','Remove');remove.type='button';remove.onclick=()=>{current.matches=(current.matches||[]).filter(x=>x.id!==o.id);persistSaved();renderAll();setMsg('Removed listing from this item only.');};review.append(remove);card.append(review);
 }
 return card;
}
function persistSaved(){
 if(!current)return;const key='shelf-scout-favorites-v1';try{
  let fav=JSON.parse(localStorage.getItem(key)||'[]');if(!Array.isArray(fav))return;
  const i=fav.findIndex(x=>x.id===current.id);if(i<0)return;
  fav[i].matches=current.matches||[];localStorage.setItem(key,JSON.stringify(fav));
 }catch(e){console.warn('Could not update saved favorite matches',e);}
}
function renderPreview(){
 const root=$('matchSection');if(!root||!current)return;
 const matches=current.matches||[];
 const summary=root.querySelector('.match-summary');summary.textContent=matches.length?`${matches.length} unique listing${matches.length===1?'':'s'} imported · ${matches.filter(x=>x.priceStatus==='asking').length} asking · ${matches.filter(x=>x.priceStatus==='sold').length} reported sold (unverified).`:'No matches imported yet. Search by image in Lens, then import the results from your browser research.';
 const list=root.querySelector('.match-preview-list');list.replaceChildren();for(const m of matches.slice(0,2))list.append(listingCard(m,true));
 const btn=root.querySelector('.match-cta');btn.textContent=matches.length?'View & import matches':'Import visual matches';
}
function renderAll(){
 if(!current)return;const matches=current.matches||[];
 stats.replaceChildren();for(const [number,label] of [[matches.length,'Unique listings'],[matches.reduce((n,o)=>n+(o.duplicateCards||1),0),'Source cards'],[matches.filter(x=>x.priceStatus==='asking').length,'Asking prices'],[matches.filter(x=>x.priceStatus==='sold').length,'Reported sold']]){
  const stat=node('div','match-stat');stat.append(node('b','',String(number)),node('span','',label));stats.append(stat);
 }
 cards.replaceChildren();for(const o of matches)cards.append(listingCard(o));
 if(!matches.length)cards.append(node('p','match-small','No research imported for this item yet. Use your Google Lens results or load the brown-mug sample to test the interface.'));
 renderPreview();
}
function mount(item){
 current=item;if(!Array.isArray(item.matches))item.matches=[];
 const root=$('detailContent');if(!root)return;
 const area=node('section','match-section');area.id='matchSection';
 const head=node('div','match-section-head');head.append(node('h3','','Visual matches'));
 const b=node('button','primary match-cta','Import visual matches');b.type='button';b.onclick=()=>openPanel();head.append(b);area.append(head);
 area.append(node('p','match-summary'));
 area.append(node('div','match-preview-list'));
 area.append(node('p','match-small','Images and prices are leads, not proof of identity or completed sales.'));
 root.insertBefore(area,root.querySelector('label[for="itemName"]'));
 renderPreview();
}
function openPanel(){if(!current)return;$('matchPanelItem').textContent=current.name||'Selected item';panel.hidden=false;paste.value='';setMsg('Paste JSON or the Markdown table from your browser-agent results.');renderAll();}
function closePanel(){panel.hidden=true;}
$('closeMatchPanel').onclick=closePanel;
$('clearMatchPaste').onclick=()=>{paste.value='';setMsg('Paste area cleared; imported matches are unchanged.');};
$('loadMatchDemo').onclick=()=>{paste.value=JSON.stringify(sample,null,2);setMsg('Five known Google Lens cards loaded into the paste area. Press Import & deduplicate to consolidate them into two listings. These listings have asking prices only.');};
$('copyMatchPrompt').onclick=async()=>{try{await navigator.clipboard.writeText(workerPrompt);setMsg('Research prompt copied. Paste it into ChatGPT Work with the item photo or open Lens page.');}catch{paste.value=workerPrompt;setMsg('Clipboard blocked; the research prompt is in the text box for copying.');}};
$('importMatches').onclick=()=>{
 try{
  if(!current)throw Error('Select a photographed item first.');
  const rows=parseImport(paste.value);if(!rows.length)throw Error('No listing records found.');
  const result=combine(rows,current.matches||[]);if(!result.counts.added&&!result.counts.alreadyKnown)throw Error('No valid HTTP(S) listing URLs were found.');
  current.matches=result.matches;persistSaved();renderAll();
  setMsg(`Imported ${result.counts.added} new unique listing${result.counts.added===1?'':'s'}; merged ${result.counts.duplicates} duplicate card${result.counts.duplicates===1?'':'s'}${result.counts.alreadyKnown?'; '+result.counts.alreadyKnown+' already known listing(s) left uncounted':''}${result.counts.invalid?'; skipped '+result.counts.invalid+' entries without valid links':''}. No resale values have been verified.`);
 }catch(e){setMsg('Import failed: '+(e?.message||String(e)));}
};
document.addEventListener('shelfscout:itemopened',ev=>mount(ev.detail.item));
document.addEventListener('keydown',e=>{if(e.key==='Escape'&&!panel.hidden)closePanel();});
window.ShelfScoutMatches={parseImport,combine,canonicalUrl};
})();
