#!/usr/bin/env node
// State and coordinate conversion checks. Browser layout is verified separately.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
async function main(){
 const args=process.argv.slice(2);let modulePath;
 if(args.length){assert.equal(args.shift(),'--jsdom');modulePath=args.shift();assert.equal(args.length,0);}
 const {JSDOM,VirtualConsole}=require(modulePath||require.resolve('jsdom',{paths:[process.cwd(),__dirname]}));
 const source=fs.readFileSync(path.join(__dirname,'../assets/workbench.html'),'utf8');
 const html=source.replace("channels:{req:'channels'","channels:{canvas:{width:390,height:844},req:'channels'");
 const parse=s=>JSON.parse(s.match(/id="prototype-data">([\s\S]*?)<\/script>/)[1]);
 const runs=[],checks=[];
 function boot(text,cached){
  let blob;const errors=[],vc=new VirtualConsole(),seed=parse(text);
  const key=(seed.readOnly?'prototype-viewer:v3:':'prototype-workbench:v3:')+seed.artifactId+':'+seed.snapshotId;
  vc.on('jsdomError',e=>errors.push(e.message));
  const dom=new JSDOM(text,{url:'https://zoom.test/',runScripts:'dangerously',pretendToBeVisual:true,virtualConsole:vc,beforeParse(w){
   w.confirm=()=>true;w.HTMLElement.prototype.scrollIntoView=function(){};
   w.HTMLElement.prototype.getClientRects=function(){return this.closest('[hidden]')?[]:[this.getBoundingClientRect()];};
   w.HTMLElement.prototype.getBoundingClientRect=function(){const scale=Number(w.document.querySelector('#prototype')?.style.zoom)||1;const r=this.matches('[data-anchor="channel-name"]')?[20,40,300,60]:[0,0,390,844];return{left:r[0]*scale,top:r[1]*scale,right:(r[0]+r[2])*scale,bottom:(r[1]+r[3])*scale,width:r[2]*scale,height:r[3]*scale};};
   w.URL.createObjectURL=v=>(blob=v,'blob:memory');w.URL.revokeObjectURL=()=>{};w.HTMLAnchorElement.prototype.click=function(){};
   if(cached)w.localStorage.setItem(key,JSON.stringify({model:cached}));
  }});
  const w=dom.window,d=w.document,$=s=>{const e=d.querySelector(s);assert.ok(e,'Missing '+s);return e;};
  const r={w,d,$,errors,click:s=>$(s).click(),fill(s,value){$(s).value=value;$(s).dispatchEvent(new w.Event('input',{bubbles:true}));},zoom(value){$('#canvas-zoom').value=String(value);$('#canvas-zoom').dispatchEvent(new w.Event('change',{bubbles:true}));},async export(){blob=null;this.click('#export-html');assert.ok(blob);return new Promise(resolve=>{const reader=new w.FileReader();reader.onload=()=>resolve(reader.result);reader.readAsText(blob);});}};
  runs.push(r);return r;
 }
 try{
  const r=boot(html);
  assert.deepEqual([...r.$('#canvas-zoom').options].map(o=>o.value),['1','0.9','0.8','0.7','0.6','0.5','fit']);
  assert.equal(r.$('#canvas-zoom').value,'fit');assert.ok(r.$('#canvas-zoom option[value=fit]').textContent.startsWith('自适应'));
  r.click('#new-channel');r.fill('#channel-name-input','正在填写的表单');r.click('#note-4 [data-note-edit]');r.fill('#note-body','未保存的说明草稿');
  const input=r.$('#channel-name-input'),editor=r.$('#note-body'),viewportHeightBefore=r.$('#prototype-viewport').style.height;
  for(const value of ['1','0.9','0.8','0.7','0.6','0.5']){
   r.zoom(value);assert.equal(r.$('#prototype-viewport').style.height,viewportHeightBefore);assert.equal(r.$('#prototype').style.zoom,value);assert.equal(r.$('#prototype').style.width,'390px');assert.equal(r.$('#prototype').style.height,'844px');
   assert.equal(r.$('#channel-name-input'),input);assert.equal(r.$('#note-body'),editor);assert.equal(input.value,'正在填写的表单');assert.equal(editor.value,'未保存的说明草稿');
   const frame=r.$('[data-note-frame="4"]');for(const [key,expected] of Object.entries({left:18,top:38,width:304,height:64}))assert.ok(Math.abs(parseFloat(frame.style[key])-expected)<1e-7,'Annotation '+key+' at '+value);
  }
  checks.push('zoom_preserves_business_and_draft_dom_with_correct_annotation_coordinates');
  r.click('#cancel-note');r.zoom('0.7');r.click('[data-page=tags]');assert.equal(r.$('#canvas-zoom').value,'fit');r.zoom('0.5');r.click('[data-page=channels]');assert.equal(r.$('#canvas-zoom').value,'0.7');assert.equal(r.$('#channel-name-input').value,'正在填写的表单');r.click('#global-menu');r.click('[data-page=channels]');assert.equal(r.$('#canvas-zoom').value,'0.7');
  checks.push('zoom_choice_is_per_page_and_survives_document_navigation');
  let viewportWidth=300,viewportHeight=500;
  Object.defineProperty(r.$('#prototype-viewport'),'clientWidth',{get:()=>viewportWidth,configurable:true});
  Object.defineProperty(r.$('#prototype-viewport'),'clientHeight',{get:()=>viewportHeight,configurable:true});
  r.zoom('fit');const fit=Number(r.$('#prototype').style.zoom);assert.ok(fit>0&&fit<=1);assert.ok(390*fit<=268&&844*fit<=468);assert.equal(r.$('#canvas-zoom').value,'fit');
  assert.equal(r.$('#channel-name-input').value,'正在填写的表单');checks.push('fit_preserves_ratio_and_fits_both_available_dimensions');
  const fitInput=r.$('#channel-name-input');viewportWidth=1600;viewportHeight=1800;r.zoom('fit');
  const enlarged=Number(r.$('#prototype').style.zoom);assert.ok(enlarged>2,'Large windows should enlarge the original canvas');assert.ok(390*enlarged<=1568&&844*enlarged<=1768);
  assert.ok(1768-844*enlarged<1,'Fit should use the limiting dimension, not leave spare height');
  assert.equal(r.$('#channel-name-input'),fitInput);assert.equal(r.$('#channel-name-input').value,'正在填写的表单');
  viewportWidth=600;viewportHeight=800;r.w.dispatchEvent(new r.w.Event('resize'));await new Promise(resolve=>r.w.requestAnimationFrame(resolve));
  const resized=Number(r.$('#prototype').style.zoom);assert.ok(resized<1&&resized<enlarged);assert.equal(r.$('#channel-name-input'),fitInput);
  checks.push('fit_enlarges_on_large_windows_and_recalculates_on_resize_without_rebuilding_business');
  r.zoom('0.5');const exported=await r.export(),payload=parse(exported);assert.equal(payload.model.views.channels.canvasZoom,'0.5');
  const viewer=boot(exported);assert.equal(viewer.$('#canvas-zoom').value,'0.5');viewer.zoom('0.7');assert.equal(viewer.$('#prototype').style.zoom,'0.7');assert.equal(viewer.d.querySelector('#pick-note,#export-html,#note-form'),null);assert.equal(viewer.$('#channel-name-input').value,'正在填写的表单');
  checks.push('actual_readonly_export_keeps_zoom_controls_and_business_without_authoring');
  const legacy=parse(html).model;legacy.views.channels.canvasZoom='invalid';const old=boot(html,legacy);assert.equal(old.$('#canvas-zoom').value,'fit');
  for(const value of ['1','0.9','0.8','0.7','0.6','0.5','fit']){legacy.views.channels.canvasZoom=value;const saved=boot(html,legacy);assert.equal(saved.$('#canvas-zoom').value,value);}
  checks.push('missing_and_invalid_zoom_use_fit_while_explicit_legacy_choices_are_retained');
  for(const [previous,current] of Object.entries({'0.98':'1','0.87':'0.9','0.76':'0.8','0.75':'0.8','0.65':'0.7'})){legacy.views.channels.canvasZoom=previous;const migrated=boot(html,legacy);assert.equal(migrated.$('#canvas-zoom').value,current);assert.equal(migrated.$('#prototype').style.zoom,current);}
  checks.push('previous_zoom_presets_map_to_nearest_ten_percent_steps_without_resetting_content');
  for(const run of runs)assert.deepEqual(run.errors,[]);
  console.log(JSON.stringify({ok:true,checks,verificationOutput:null},null,2));
 }finally{runs.forEach(r=>r.w.close());}
}
main().catch(e=>{console.error(e);process.exitCode=1;});
