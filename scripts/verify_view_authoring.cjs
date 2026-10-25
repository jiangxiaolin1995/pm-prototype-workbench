#!/usr/bin/env node
// One-shot annotation from view mode. Export is intercepted in memory.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
async function main(){
 const args=process.argv.slice(2);let modulePath;
 if(args.length){assert.equal(args.shift(),'--jsdom');modulePath=args.shift();assert.equal(args.length,0);}
 const {JSDOM,VirtualConsole}=require(modulePath||require.resolve('jsdom',{paths:[process.cwd(),__dirname]}));
 const html=fs.readFileSync(path.join(__dirname,'../assets/workbench.html'),'utf8');
 const parse=s=>JSON.parse(s.match(/id="prototype-data">([\s\S]*?)<\/script>/)[1]);
 const runs=[],checks=[];
 function boot(source,cached){
  const seed=parse(source),errors=[],vc=new VirtualConsole();let blob;
  vc.on('jsdomError',e=>errors.push(e.message));
  const dom=new JSDOM(source,{url:'https://view-authoring.test/',runScripts:'dangerously',pretendToBeVisual:true,virtualConsole:vc,beforeParse(w){
   w.confirm=()=>true;w.HTMLElement.prototype.scrollIntoView=function(){};
   w.HTMLElement.prototype.getBoundingClientRect=function(){return {left:10,top:10,right:810,bottom:610,width:800,height:600};};
   w.URL.createObjectURL=value=>(blob=value,'blob:verification');w.URL.revokeObjectURL=()=>{};w.HTMLAnchorElement.prototype.click=function(){};
   if(cached)w.localStorage.setItem((seed.readOnly?'prototype-viewer:v3:':'prototype-workbench:v3:')+seed.artifactId+':'+seed.snapshotId,JSON.stringify({model:cached}));
  }});
  const w=dom.window,d=w.document,$=s=>{const el=d.querySelector(s);assert.ok(el,'Missing '+s);return el;};
  const r={w,d,$,errors,click:s=>{$(s).dispatchEvent(new w.MouseEvent('click',{bubbles:true,cancelable:true}));},
   set(s,value){$(s).value=value;$(s).dispatchEvent(new w.Event('input',{bubbles:true}));},
   state(){return JSON.parse(w.localStorage.getItem((seed.readOnly?'prototype-viewer:v3:':'prototype-workbench:v3:')+seed.artifactId+':'+seed.snapshotId)).model;},
   submit:()=>$('#note-form').dispatchEvent(new w.Event('submit',{bubbles:true,cancelable:true})),
   async exportHTML(){blob=null;this.click('#export-html');if(!blob)return null;return new Promise(resolve=>{const reader=new w.FileReader();reader.onload=()=>resolve(reader.result);reader.readAsText(blob);});}
  };runs.push(r);return r;
 }
 try{
  const r=boot(html);
  assert.equal(r.d.querySelector('[data-mode]'),null,'The separate write/view mode switch must be removed');
  assert.ok(r.$('#view-label'));
  assert.equal(r.d.querySelector('.directory [data-global-slot]'),null,'Directory keeps the global menu, not a duplicate text box');
  assert.equal(r.$('#directory-items button').id,'global-menu');
  assert.equal(r.$('#pick-note').closest('[hidden]'),null,'Picker must be visible while viewing the prototype');
  assert.equal(r.d.querySelector('#note-form'),null,'Viewing starts without an empty authoring panel');
  r.set('#search-name','未提交的筛选');const input=r.$('#search-name');
  r.click('#pick-note');assert.equal(r.$('#pick-note').getAttribute('aria-pressed'),'true');
  const target=r.$('#new-channel');
  for(const type of ['pointerdown','pointerup','click'])target.dispatchEvent(new r.w.MouseEvent(type,{bubbles:true,cancelable:true,button:0}));
  assert.equal(r.$('#pick-note').getAttribute('aria-pressed'),'false');assert.equal(r.d.querySelector('#form-panel'),null,'Picking a button must not run its business action');
  assert.equal(r.d.querySelector('[data-mode]'),null,'Quick annotation must not create a separate authoring mode');
  assert.equal(r.$('#note-body').value,'');assert.equal(r.$('#search-name'),input);
  checks.push('view_mode_offers_one_shot_picker_without_business_click_or_mode_switch');

  r.click('#new-channel');assert.ok(r.$('#form-panel'),'The next ordinary click must operate the prototype');
  r.set('#channel-name-input','保留弹窗输入');const modalInput=r.$('#channel-name-input');
  r.set('#note-body','查看模式中写的说明');r.submit();
  const note=r.state().notes.at(-1);assert.equal(note.body,'查看模式中写的说明');assert.equal(note.scene,'list');
  assert.equal(r.$('#channel-name-input'),modalInput,'Saving a note must preserve the live business DOM');
  assert.equal(r.$('#channel-name-input').value,'保留弹窗输入');assert.equal(r.d.querySelector('#note-form'),null);
  r.click('#channel-name-input');assert.equal(r.d.querySelector('#note-form'),null,'A second target needs a new picker activation');
  r.click('#pick-note');r.click('#channel-name-input');assert.ok(r.$('#note-body'));
  assert.equal(r.$('#pick-note').getAttribute('aria-pressed'),'false');r.click('#cancel-note');
  r.click('#pick-note');r.$('#channel-name-input').dispatchEvent(new r.w.KeyboardEvent('keydown',{key:'Escape',bubbles:true,cancelable:true}));
  assert.equal(r.$('#pick-note').getAttribute('aria-pressed'),'false');assert.equal(r.$('#channel-name-input').value,'保留弹窗输入');
  checks.push('normal_interaction_resumes_and_every_new_target_requires_rearming');

  r.click('#pick-note');r.click('#channel-name-input');r.set('#note-body','跨页草稿');
  r.click('#global-menu');assert.equal(r.$('#global-menu span').textContent,'全局内容');
  assert.equal(r.$('#global-content-input').value,'');assert.equal(r.$('.stage').hidden,true);
  const content='整个工作台的约定\n<标签> & 纯文本';r.set('#global-content-input',content);
  assert.equal(r.state().globalContent,content);assert.equal(r.state().activePage,'channels');
  r.click('[data-page=channels]');assert.equal(r.$('#channel-name-input').value,'保留弹窗输入');assert.equal(r.$('#note-body').value,'跨页草稿');
  r.click('#cancel-note');r.click('#global-menu');
  const reopened=boot(html,r.state());assert.equal(reopened.$('#global-content-input').value,content);
  assert.ok(reopened.$('#view-label'));
  checks.push('global_first_menu_is_directly_editable_and_preserves_business_and_drafts');

  const exported=await r.exportHTML();assert.ok(exported);const viewer=boot(exported);
  assert.equal(viewer.$('#global-content-text').textContent,content);
  assert.equal(viewer.d.querySelectorAll('#global-content-input,#pick-note,#note-form,[data-mode],#export-html').length,0);
  viewer.click('[data-page=channels]');assert.equal(viewer.$('#channel-name-input').value,'保留弹窗输入');
  viewer.set('#channel-name-input','查看者可体验业务');assert.equal(viewer.$('#channel-name-input').value,'查看者可体验业务');
  assert.equal(viewer.d.querySelector('#pick-note'),null);
  checks.push('actual_export_remains_readonly_with_interactive_business_prototype');

  const editing=boot(html);editing.click('[data-note-edit="1"]');
  editing.click('#pick-note');editing.click('[data-anchor=filters]');
  assert.equal(editing.$('#note-body').value,'','A clean hidden edit draft must not swallow a new target selection');
  assert.equal(editing.state().drafts.channels.noteId,null);assert.ok(editing.$('#view-label'));
  checks.push('clean_previous_edit_draft_does_not_block_a_new_view_annotation');
  for(const run of runs)assert.deepEqual(run.errors,[]);
  console.log(JSON.stringify({ok:true,checks,verificationOutput:null},null,2));
 }finally{await new Promise(resolve=>setImmediate(resolve));runs.forEach(r=>r.w.close());}
}
main().catch(e=>{console.error(e.stack);process.exitCode=1;});
