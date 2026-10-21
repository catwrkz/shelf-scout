/* Quick Valuation v0.3 — image-card boundary detector.
 * Works entirely on the user's device. Uses the rectangular, image-rich
 * areas of a feed screenshot, not the vertical position of price text.
 * This is a heuristic, not an instance-segmentation or vision AI model.
 */
(function (root) {
  'use strict';
  function clamp(n,a,b){return Math.max(a,Math.min(b,n));}
  function median(a){if(!a.length)return 25;a.sort((x,y)=>x-y);return a[Math.floor(a.length/2)];}
  function smooth(a,n=9){const out=new Float32Array(a.length);let sum=0;for(let i=0;i<a.length;i++){sum+=a[i];if(i>=n)sum-=a[i-n];out[i]=sum/Math.min(i+1,n)}return out;}
  function runs(mask,minLen,maxGap){let out=[],start=-1,end=-1;for(let i=0;i<=mask.length;i++){
    if(i<mask.length&&mask[i]){if(start<0)start=i;end=i+1;}
    else if(start>=0&&i-end>maxGap){if(end-start>=minLen)out.push([start,end]);start=-1;end=-1;}
  }return out;}
  function detectFromPixels(rgba,W,H){
    if(W<90||H<150||!rgba||rgba.length<W*H*4)return [];
    const sample=[[],[],[]];
    // Most marketplace feeds have uniform side margins. Sampling both margins
    // keeps this neutral to dark/light UI modes and common screenshot colors.
    for(let y=Math.floor(H*.045);y<Math.floor(H*.93);y+=Math.max(6,Math.floor(H/145))){
      for(const x of [3,Math.max(3,W-4)]){
        const p=(y*W+x)*4;for(let c=0;c<3;c++)sample[c].push(rgba[p+c]);
      }
    }
    const bg=sample.map(median);
    const active=(x,y)=>{const p=(y*W+x)*4;return Math.abs(rgba[p]-bg[0])+Math.abs(rgba[p+1]-bg[1])+Math.abs(rgba[p+2]-bg[2])>95;};
    function fracActive(y,x0,x1,step=5){let n=0,yes=0;for(let x=x0;x<x1;x+=step){n++;if(active(x,y))yes++;}return n?yes/n:0;}
    // A genuine two-column feed has a narrow low-content gutter that persists
    // even across rows where both neighboring columns are filled with photos.
    let paired=0,gutter=0;
    for(let y=Math.floor(H*.09);y<Math.floor(H*.91);y+=5){
      const left=fracActive(y,Math.floor(W*.08),Math.floor(W*.43));
      const right=fracActive(y,Math.floor(W*.57),Math.floor(W*.92));
      if(left>.64&&right>.64){paired++;if(fracActive(y,Math.floor(W*.495),Math.ceil(W*.505),1)<.34)gutter++;}
    }
    const twoColumns=paired>Math.max(14,Math.floor(H*.06))&&gutter/paired>.55;
    const slots=twoColumns?[[.013,.492],[.508,.988]]:[[.018,.982]];
    const candidates=[];
    for(let col=0;col<slots.length;col++){
      const [left,right]=slots[col];const x0=Math.floor(left*W),x1=Math.ceil(right*W);
      const rowScore=new Float32Array(H);
      for(let y=0;y<H;y++){
        rowScore[y]=fracActive(y,x0+Math.max(4,Math.round(W*.01)),x1-Math.max(4,Math.round(W*.01)),3);
      }
      const score=smooth(rowScore,Math.max(5,Math.round(W*.013)));
      const mask=Array.from(score,(v,y)=>y>H*.052&&y<H*.947&&v>.39);
      const spans=runs(mask,Math.max(Math.round(W*.24),Math.round(H*.105)),Math.max(7,Math.round(W*.024)));
      for(const [a,b] of spans){
        if(b-a>H*.62)continue;
        // Detect horizontal edges from photo-colored content along its height.
        const xVotes=new Float32Array(W);let samples=0;
        const start=a+Math.min(18,Math.floor((b-a)*.05));
        const stop=b-Math.min(18,Math.floor((b-a)*.05));
        for(let y=start;y<stop;y+=Math.max(3,Math.floor((stop-start)/38))){samples++;
          for(let x=x0;x<x1;x+=2){if(active(x,y)){xVotes[x]++;if(x+1<W)xVotes[x+1]++;}}
        }
        const xs=[];for(let x=x0;x<x1;x++)if(xVotes[x]/Math.max(1,samples)>.43)xs.push(x);
        let lx=x0,rx=x1;
        if(xs.length>(x1-x0)*.45){lx=Math.min(...xs);rx=Math.max(...xs)+1;}
        // Preserve the small rounded border, but exclude navigation UI.
        lx=clamp(lx-1,0,W-1);rx=clamp(rx+1,lx+20,W);
        candidates.push({col,box:{x:lx/W,y:clamp(a-2,0,H)/H,w:(rx-lx)/W,h:(Math.min(H,b+2)-Math.max(0,a-2))/H},pixels:{start:a,end:b}});
      }
    }
    if(twoColumns){
      // In a two-column feed, a dark product photo can have low contrast to
      // the app background. Neighboring photo cards usually share the exact
      // same top and bottom edges; align near-identical rows rather than
      // shrinking the darker photo or including its listing text.
      for(let i=0;i<candidates.length;i++)for(let j=i+1;j<candidates.length;j++){
        const a=candidates[i],b=candidates[j];if(a.col===b.col)continue;
        if(Math.abs(a.pixels.start-b.pixels.start)>Math.max(36,W*.14))continue;
        if(Math.abs(a.pixels.end-b.pixels.end)>Math.max(90,W*.20))continue;
        const top=Math.min(a.pixels.start,b.pixels.start),bot=Math.max(a.pixels.end,b.pixels.end);
        a.box.y=b.box.y=Math.max(0,top-2)/H;a.box.h=b.box.h=(Math.min(H,bot+2)-Math.max(0,top-2))/H;
      }
    }
    const dedup=[];
    for(const entry of candidates.sort((a,b)=>a.box.y-b.box.y||a.box.x-b.box.x)){
      const rect=entry.box;
      if(rect.w<.18||rect.h<.07||rect.y> .94)continue;
      if(dedup.some(d=>{const e=d.box;return Math.abs(e.x-rect.x)<.05&&Math.abs(e.y-rect.y)<.055;}))continue;
      dedup.push(entry);
      if(dedup.length>=12)break;
    }
    return dedup.map(e=>({x:e.box.x,y:e.box.y,w:e.box.w,h:e.box.h}));
  }
  function fromImage(image){
    const maxW=510,scale=Math.min(1,maxW/image.naturalWidth);
    const c=document.createElement('canvas');c.width=Math.max(1,Math.round(image.naturalWidth*scale));c.height=Math.max(1,Math.round(image.naturalHeight*scale));
    const ctx=c.getContext('2d',{willReadFrequently:true});ctx.drawImage(image,0,0,c.width,c.height);
    return detectFromPixels(ctx.getImageData(0,0,c.width,c.height).data,c.width,c.height);
  }
  root.QVImageCards={fromImage,detectFromPixels};
  if(typeof module==='object'&&module.exports)module.exports=root.QVImageCards;
})(typeof window!=='undefined'?window:globalThis);
