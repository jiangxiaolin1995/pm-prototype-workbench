#!/usr/bin/env node
// Checks user-visible editing behavior; read-only export stays in memory.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
async function main(){
 const args=process.argv.slice(2);let modulePath;
 if(args.length){assert.equal(args.shift(),'--jsdom');modulePath=args.shift();assert.equal(args.length,0);}
 const {JSDOM,VirtualConsole}=require(modulePath||require.resolve('jsdom',{paths:[process.cwd(),__dirname]}));
 const html=fs.readFileSync(path.join(__dirname,'../assets/workbench.html'),'utf8');
 const parse=s=>JSON.parse(s.match(/id="prototype-data">([\s\S]*?)<\/script>/)[1]);
 const runs=[],checks=[];
 function boot(text,cached){
  const seed=parse(text),errors=[],vc=new VirtualConsole();let blob=null,confirmations=0;
  vc.on('jsdomError',e=>errors.push(e.message));
  const dom=new JSDOM(text,{url:'https://inline-edit-verification.test/',runScripts:'dangerously',pretendToBeVisual:true,virtualConsole:vc,beforeParse(w){
   w.confirm=()=>{confirmations++;return true;};w.HTMLElement.prototype.scrollIntoView=function(){};
   w.HTMLElement.prototype.getBoundingClientRect=function(){return {left:10,top:10,right:810,bottom:610,width:800,height:600};};
   w.URL.createObjectURL=b=>(blob=b,'blob:verification');w.URL.revokeObjectURL=()=>{};w.HTMLAnchorElement.prototype.click=function(){};
   if(cached)w.localStorage.setItem((seed.readOnly?'prototype-viewer:v3:':'prototype-workbench:v3:')+seed.artifactId+':'+seed.snapshotId,JSON.stringify({model:cached}));
  }});
  const w=dom.window,d=w.document,$=s=>{const el=d.querySelector(s);assert.ok(el,'Missing '+s);return el;};
  const r={w,d,$,errors,click:s=>{$(s).dispatchEvent(new w.MouseEvent('click',{bubbles:true,cancelable:true}));},
   set(s,value){$(s).value=value;$(s).dispatchEvent(new w.Event('input',{bubbles:true}));},
   submit:()=>$('#note-form').dispatchEvent(new w.Event('submit',{bubbles:true,cancelable:true})),
   state(){return JSON.parse(w.localStorage.getItem((seed.readOnly?'prototype-viewer:v3:':'prototype-workbench:v3:')+seed.artifactId+':'+seed.snapshotId)).model;},
   confirmations:()=>confirmations,
   async exportHTML(){blob=null;this.click('#export-html');if(!blob)return null;return new Promise(resolve=>{const reader=new w.FileReader();reader.onload=()=>resolve(reader.result);reader.readAsText(blob);});}
  };runs.push(r);return r;
 }
 try{
  const r=boot(html);r.set('#search-name','未提交的筛选输入');
  const input=r.$('#search-name'),before=r.state(),original=before.notes.find(n=>n.id===10);
  const oldOrder=Array.from(r.d.querySelectorAll('#notes-slot .note')).map(el=>el.id);
  r.$('#notes-scroll').scrollTop=480;r.click('[data-note-edit="10"]');
  assert.ok(r.$('#note-10').contains(r.$('#note-body')),'Editing must replace the original note content in place');
  assert.equal(r.$('#editor-slot').querySelector('textarea'),null,'Existing note must not open the top editor');
  assert.equal(r.d.querySelectorAll('#note-body').length,1);
  assert.equal(r.$('#note-body').value,original.body);assert.equal(r.$('#note-body').closest('[data-note-locate]'),null);
  assert.equal(r.$('#notes-scroll').scrollTop,480);assert.equal(r.confirmations(),0);
  assert.deepEqual(Array.from(r.d.querySelectorAll('#notes-slot .note')).map(el=>el.id),oldOrder);
  checks.push('editing_replaces_original_note_without_top_editor_or_scroll_jump');
  const text='修改后的原位说明\n保留换行 <b>纯文本</b> & "引号"';
  r.set('#note-body',text);
  const key=new r.w.KeyboardEvent('keydown',{key:' ',bubbles:true,cancelable:true});r.$('#note-body').dispatchEvent(key);
  assert.equal(key.defaultPrevented,false);assert.equal(r.d.activeElement,r.$('#note-body'));
  r.submit();const after=r.state();
  assert.equal(r.$('#note-10 .note-body').textContent,text);assert.equal(r.$('#note-10 .note-body').querySelector('b'),null);
  assert.equal(after.notes.length,before.notes.length);assert.equal(after.counters.note,before.counters.note);
  assert.deepEqual({...after.notes.find(n=>n.id===10),body:original.body},{...original,context:original.context||null});
  assert.equal(r.$('#search-name'),input,'Saving note text must not rebuild business DOM');assert.equal(input.value,'未提交的筛选输入');
  assert.equal(r.$('#notes-scroll').scrollTop,480);assert.equal(r.confirmations(),0);
  checks.push('save_preserves_note_identity_order_and_live_business_dom');
  r.click('[data-note-edit="10"]');r.set('#note-body','要取消的修改');r.click('#cancel-note');
  assert.equal(r.$('#note-10 .note-body').textContent,text);assert.equal(r.$('#note-10').querySelector('textarea'),null);
  assert.equal(r.state().drafts.channels,undefined);assert.equal(r.$('#search-name'),input);
  checks.push('cancel_restores_saved_body_in_the_original_note');
  r.click('[data-note-edit="10"]');r.set('#note-body','跨页面的编辑草稿');
  r.click('[data-page=tags]');r.click('[data-page=channels]');
  assert.ok(r.$('#note-10').contains(r.$('#note-body')));assert.equal(r.$('#note-body').value,'跨页面的编辑草稿');
  const reopened=boot(html,r.state());assert.ok(reopened.$('#note-10').contains(reopened.$('#note-body')));assert.equal(reopened.$('#note-body').value,'跨页面的编辑草稿');
  assert.equal(await r.exportHTML(),null,'Dirty inline edit must block export');
  checks.push('inline_draft_survives_switch_and_reopen_and_blocks_unsaved_export');
  r.set('#note-body',text);r.submit();
  r.click('#pick-note');r.click('.content-heading h3');
  assert.ok(r.$('#editor-slot').contains(r.$('#note-body')),'New annotation still has a blank composing field');
  assert.equal(r.$('#note-body').value,'');r.click('#cancel-note');
  const exported=await r.exportHTML();assert.ok(exported);const viewer=boot(exported);
  assert.equal(viewer.$('#note-10 .note-body').textContent,text);
  assert.equal(viewer.d.querySelectorAll('#note-form,[data-note-edit],[data-note-rebind],[data-note-delete],[data-mode],#export-html').length,0);
  checks.push('new_note_and_readonly_export_keep_existing_contract');
  for(const run of runs)assert.deepEqual(run.errors,[]);
  console.log(JSON.stringify({ok:true,checks,verificationOutput:null},null,2));
 }finally{await new Promise(resolve=>setImmediate(resolve));runs.forEach(r=>r.w.close());}
}
main().catch(e=>{console.error(e.stack);process.exitCode=1;});
