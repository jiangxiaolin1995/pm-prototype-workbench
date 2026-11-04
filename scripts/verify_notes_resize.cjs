#!/usr/bin/env node
// Splitter events and persistence; real browser checks cover actual grid geometry.
const assert=require('node:assert/strict');
const {boot,parse}=require('./test_support.cjs');
async function main(){
 const args=process.argv.slice(2);let modulePath;
 if(args.length){assert.equal(args.shift(),'--jsdom');modulePath=args.shift();assert.equal(args.length,0);}
 const source=require('./fixture.cjs')(),runs=[],checks=[];
 const resize=(r,width)=>{r.w.innerWidth=width;r.w.dispatchEvent(new r.w.Event('resize'));};
 function open(html,storage){
  const r=boot(html,undefined,modulePath,{storage});runs.push(r);
  r.$('.directory').getBoundingClientRect=()=>({width:r.$('.directory').hidden?0:260});
  resize(r,1440);return r;
 }
 const width=r=>Number(r.$('#notes-resizer').getAttribute('aria-valuenow'));
 function pointer(r,type,x,id=7){
  const event=new r.w.MouseEvent(type,{clientX:x,button:0,bubbles:true,cancelable:true});
  Object.defineProperty(event,'pointerId',{value:id});
  (type==='pointerdown'?r.$('#notes-resizer'):r.d).dispatchEvent(event);
 }
 const key=(r,name)=>r.$('#notes-resizer').dispatchEvent(new r.w.KeyboardEvent('keydown',{key:name,bubbles:true,cancelable:true}));
 try{
  const r=open(source),splitter=r.$('#notes-resizer');
  assert.equal(splitter.getAttribute('role'),'separator');assert.equal(splitter.getAttribute('aria-orientation'),'vertical');assert.equal(splitter.hidden,false);
  r.click('#new-channel');r.set('#channel-name-input','调宽时保留的表单');const field=r.$('#channel-name-input');
  r.click('#pick-note');r.click('#channel-name-input');r.set('#note-body','未提交的说明草稿');const editor=r.$('#note-body');
  const before=width(r),business=JSON.stringify(r.cache().model.data),notes=JSON.stringify(r.cache().model.notes);
  pointer(r,'pointerdown',1100);pointer(r,'pointermove',900);pointer(r,'pointerup',900);
  assert.equal(width(r),before+200);assert.equal(r.$('#channel-name-input'),field);assert.equal(r.$('#note-body'),editor);
  assert.equal(field.value,'调宽时保留的表单');assert.equal(editor.value,'未提交的说明草稿');
  assert.equal(JSON.stringify(r.cache().model.data),business);assert.equal(JSON.stringify(r.cache().model.notes),notes);
  assert.equal(r.$('.workspace').classList.contains('is-resizing'),false);
  checks.push('drag_widens_notes_without_rebuilding_business_or_draft');

  key(r,'ArrowRight');assert.equal(width(r),before+176);key(r,'ArrowLeft');assert.equal(width(r),before+200);
  const saved=width(r);pointer(r,'pointerdown',900);pointer(r,'pointermove',700);key(r,'Escape');assert.equal(width(r),saved);
  assert.equal(r.$('.workspace').classList.contains('is-resizing'),false);assert.equal(r.$('#channel-name-input'),field);
  pointer(r,'pointerdown',900);pointer(r,'pointermove',800);pointer(r,'pointercancel',800);assert.equal(width(r),saved);
  key(r,'End');assert.equal(width(r),Number(splitter.getAttribute('aria-valuemax')));
  key(r,'Home');assert.equal(width(r),Number(splitter.getAttribute('aria-valuemin')));
  checks.push('keyboard_limits_escape_and_pointer_cancel_keep_input_intact');

  pointer(r,'pointerdown',1200);pointer(r,'pointermove',1000);pointer(r,'pointerup',1000);
  const preferred=width(r),storage=Object.fromEntries(Object.keys(r.w.localStorage).map(k=>[k,r.w.localStorage.getItem(k)]));
  const reload=open(source,storage);assert.equal(width(reload),preferred);assert.equal(reload.$('#note-body').value,'未提交的说明草稿');
  for(const size of [900,390,320]){resize(reload,size);if(reload.$('.sidebar').hidden)reload.click('#workspace-notes-toggle');assert.ok(width(reload)<=size-28);assert.ok(Number.isFinite(width(reload)));}
  resize(reload,1440);assert.equal(width(reload),preferred,'Narrow-screen clamping must not overwrite the desktop preference');
  checks.push('width_restores_after_reload_and_survives_narrow_screen_clamping');

  pointer(r,'pointerdown',1000);pointer(r,'pointermove',1000+preferred-60);pointer(r,'pointerup',1000+preferred-60);
  assert.equal(r.$('.sidebar').hidden,true);assert.equal(splitter.hidden,true);r.click('#workspace-notes-toggle');assert.equal(width(r),preferred);
  r.click('#workspace-directory-toggle');r.click('#workspace-notes-toggle');assert.equal(r.$('.directory').hidden,true);assert.equal(r.$('.sidebar').hidden,true);
  r.click('#workspace-notes-toggle');r.$('#notes-resizer').dispatchEvent(new r.w.MouseEvent('dblclick',{bubbles:true}));assert.equal(width(r),before);
  checks.push('drag_to_edge_collapses_reopen_restores_and_double_click_resets');

  r.click('#cancel-note');const viewer=open((await r.download('#export-html')).text);
  const viewerNotes=JSON.stringify(parse((await r.download('#export-html')).text).model.notes),vw=width(viewer);
  pointer(viewer,'pointerdown',1100);pointer(viewer,'pointermove',950);pointer(viewer,'pointerup',950);assert.equal(width(viewer),vw+150);
  assert.equal(viewer.d.querySelector('#pick-note,[data-note-edit],#export-html'),null);
  assert.equal(JSON.stringify(viewer.seed.model.notes),viewerNotes);
  checks.push('readonly_keeps_resize_without_annotation_editing');
  runs.forEach(run=>assert.deepEqual(run.errors,[]));console.log(JSON.stringify({ok:true,checks},null,2));
 }finally{runs.forEach(r=>r.close());}
}
main().catch(e=>{console.error(e.stack);process.exitCode=1;});
