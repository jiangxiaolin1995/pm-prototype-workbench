#!/usr/bin/env node
// Runtime/state checks only. Real browser geometry and scrolling must also be checked.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
async function main(){
 const args=process.argv.slice(2);let modulePath;
 if(args.length){assert.equal(args.shift(),'--jsdom');modulePath=args.shift();assert.equal(args.length,0);}
 const {JSDOM,VirtualConsole}=require(modulePath||require.resolve('jsdom',{paths:[process.cwd(),__dirname]}));
 const source=fs.readFileSync(path.join(__dirname,'../assets/workbench.html'),'utf8');
 const html=source.replace("channels:{req:'channels'","channels:{canvas:{width:390,height:844},req:'channels'");
 assert.notEqual(html,source);
 const parse=s=>JSON.parse(s.match(/id="prototype-data">([\s\S]*?)<\/script>/)[1]);
 const runs=[],checks=[];
 function boot(text,cached){
  const seed=parse(text),errors=[],vc=new VirtualConsole();let blob;
  const key=(seed.readOnly?'prototype-viewer:v3:':'prototype-workbench:v3:')+seed.artifactId+':'+seed.snapshotId;
  vc.on('jsdomError',e=>errors.push(e.message));
  const dom=new JSDOM(text,{url:'https://canvas.test/',runScripts:'dangerously',pretendToBeVisual:true,virtualConsole:vc,beforeParse(w){
   w.confirm=()=>true;w.HTMLElement.prototype.scrollIntoView=function(){};
   w.HTMLElement.prototype.getClientRects=function(){return this.closest('[hidden]')?[]:[this.getBoundingClientRect()];};
   w.HTMLElement.prototype.getBoundingClientRect=function(){return{left:0,top:0,right:390,bottom:844,width:390,height:844};};
   w.URL.createObjectURL=v=>(blob=v,'blob:verification');w.URL.revokeObjectURL=()=>{};w.HTMLAnchorElement.prototype.click=function(){};
   if(cached)w.localStorage.setItem(key,JSON.stringify({model:cached}));
  }});
  const w=dom.window,d=w.document,$=s=>{const e=d.querySelector(s);assert.ok(e,'Missing '+s);return e;};
  const r={w,d,$,errors,click:s=>$(s).click(),set(s,v){$(s).value=v;$(s).dispatchEvent(new w.Event('input',{bubbles:true}));},
   pan(left,top){const e=$('#prototype-viewport');e.scrollLeft=left;e.scrollTop=top;e.dispatchEvent(new w.Event('scroll'));},
   state:()=>JSON.parse(w.localStorage.getItem(key)).model,
   async exportHTML(){blob=null;this.click('#export-html');assert.ok(blob);return new Promise(resolve=>{const reader=new w.FileReader();reader.onload=()=>resolve(reader.result);reader.readAsText(blob);});}
  };runs.push(r);return r;
 }
 try{
  const r=boot(html);
  assert.ok(r.$('#prototype-viewport').contains(r.$('#prototype')));
  assert.equal(r.$('#prototype-viewport').getAttribute('tabindex'),'0');
  assert.equal(r.$('#prototype').style.width,'390px');assert.equal(r.$('#prototype').style.height,'844px');
  r.w.dispatchEvent(new r.w.Event('resize'));
  assert.equal(r.$('#prototype').style.width,'390px');assert.equal(r.$('#prototype').style.height,'844px');
  checks.push('design_size_remains_fixed_on_resize_inside_focusable_scroll_viewport');

  r.pan(55,280);r.set('#search-name','保留输入');r.click('[data-page=tags]');
  assert.equal(r.$('#prototype').style.width,'960px');assert.equal(r.$('#prototype').style.height,'auto');
  r.pan(120,90);r.click('[data-page=channels]');
  assert.equal(r.$('#prototype-viewport').scrollLeft,55);assert.equal(r.$('#prototype-viewport').scrollTop,280);
  assert.equal(r.$('#search-name').value,'保留输入');
  r.click('#global-menu');r.click('[data-page=channels]');
  assert.equal(r.$('#prototype-viewport').scrollLeft,55);assert.equal(r.$('#prototype-viewport').scrollTop,280);
  checks.push('each_page_restores_its_canvas_scroll_and_business_inputs_after_navigation');

  r.click('#new-channel');r.set('#channel-name-input','未提交表单');
  r.pan(45,220);r.click('#note-4 [data-note-locate]');
  assert.equal(r.$('#channel-name-input').value,'未提交表单');
  assert.ok(r.$('#note-4').classList.contains('note-selected'));
  assert.equal(r.$('#prototype-viewport').scrollLeft,45);assert.equal(r.$('#prototype-viewport').scrollTop,220);
  checks.push('note_location_preserves_live_form_and_canvas_scroll');

  const exported=await r.exportHTML(),seed=parse(exported);
  assert.equal(seed.model.views.channels.canvasScrollLeft,45);assert.equal(seed.model.views.channels.canvasScrollTop,220);
  const viewer=boot(exported);
  assert.equal(viewer.$('#prototype').style.width,'390px');assert.equal(viewer.$('#prototype').style.height,'844px');
  assert.equal(viewer.d.querySelector('#pick-note,#note-form,#export-html'),null);
  viewer.pan(30,100);viewer.click('#close-modal');viewer.click('#new-channel');
  assert.ok(viewer.$('#channel-name-input'));
  assert.deepEqual(viewer.errors,[]);
  checks.push('in_memory_readonly_export_keeps_fixed_canvas_scroll_and_business_interaction');

  const legacy=parse(html).model;delete legacy.views.channels.canvasScrollLeft;delete legacy.views.channels.canvasScrollTop;
  const reopened=boot(html,legacy);
  assert.equal(reopened.$('#prototype-viewport').scrollLeft,0);assert.equal(reopened.$('#prototype-viewport').scrollTop,0);
  assert.equal(reopened.$('#prototype').style.width,'390px');
  assert.deepEqual(r.errors,[]);assert.deepEqual(reopened.errors,[]);
  checks.push('legacy_cache_without_canvas_scroll_opens_without_resetting_business_model');
  console.log(JSON.stringify({ok:true,checks,verificationOutput:null},null,2));
 }finally{runs.forEach(r=>r.w.close());}
}
main().catch(e=>{console.error(e);process.exitCode=1;});
