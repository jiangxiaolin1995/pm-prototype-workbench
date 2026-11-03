#!/usr/bin/env node
// Responsive shell behavior on a fresh shared-template fixture, not a copied product HTML.
const assert=require('node:assert/strict');
const {boot,parse}=require('./test_support.cjs');
async function main(){
 const args=process.argv.slice(2);let modulePath;
 if(args.length){assert.equal(args.shift(),'--jsdom');modulePath=args.shift();assert.ok(modulePath);assert.equal(args.length,0);}
 const source=require('./fixture.cjs')(),runs=[],checks=[];
 const open=html=>{const r=boot(html,undefined,modulePath);runs.push(r);return r;};
 const resize=(r,width)=>{r.w.innerWidth=width;r.w.dispatchEvent(new r.w.Event('resize'));};
 try{
  const r=open(source);assert.deepEqual(r.errors,[]);
  resize(r,1280);assert.equal(r.$('.workspace').dataset.layout,'wide');assert.equal(r.$('.directory').hidden,false);assert.equal(r.$('.sidebar').hidden,false);
  resize(r,1279);assert.equal(r.$('.workspace').dataset.layout,'middle');assert.equal(r.$('.directory').hidden,true);assert.equal(r.$('.sidebar').hidden,false);
  resize(r,900);assert.equal(r.$('.workspace').dataset.layout,'middle');
  resize(r,899);assert.equal(r.$('.workspace').dataset.layout,'compact');assert.equal(r.$('.directory').hidden,true);assert.equal(r.$('.sidebar').hidden,true);
  checks.push('three_columns_middle_notes_compact_drawers_at_both_boundaries');

  r.set('#search-name','保留筛选');r.click('#new-channel');r.set('#channel-name-input','保留表单');const field=r.$('#channel-name-input');
  r.click('#workspace-directory-toggle');assert.equal(r.$('.directory').dataset.overlay,'true');assert.equal(r.$('#preview-pane').inert,true);
  r.click('#workspace-notes-toggle');assert.equal(r.$('.directory').hidden,true);assert.equal(r.$('.sidebar').dataset.overlay,'true');
  r.d.dispatchEvent(new r.w.KeyboardEvent('keydown',{key:'Escape',bubbles:true,cancelable:true}));
  assert.equal(r.$('.sidebar').hidden,true);assert.equal(r.$('#preview-pane').inert,false);assert.equal(r.d.activeElement.id,'workspace-notes-toggle');
  for(const width of [1440,1100,390])resize(r,width);
  assert.equal(r.$('#channel-name-input'),field);assert.equal(field.value,'保留表单');assert.equal(r.$('#search-name').value,'保留筛选');
  checks.push('drawer_switch_escape_and_resize_preserve_business_dom_and_inputs');

  r.click('#workspace-directory-toggle');r.click('#global-menu');await Promise.resolve();
  assert.equal(r.$('.directory').hidden,true);assert.equal(r.$('#preview-pane').inert,false);assert.ok(r.$('#preview-pane').classList.contains('workspace-document'));
  r.click('#workspace-directory-toggle');r.click('#nav-page-channels');await Promise.resolve();
  assert.equal(r.$('.directory').hidden,true);assert.equal(r.$('#channel-name-input').value,'保留表单');
  checks.push('directory_selection_closes_overlay_and_restores_document_or_prototype');

  r.click('#pick-note');const target=r.$('#channel-name-input');
  target.dispatchEvent(new r.w.MouseEvent('pointerdown',{button:0,bubbles:true,cancelable:true}));target.dispatchEvent(new r.w.MouseEvent('click',{bubbles:true,cancelable:true}));
  assert.equal(r.$('#pick-note').getAttribute('aria-pressed'),'false');assert.equal(r.$('.sidebar').hidden,false);assert.equal(r.$('.sidebar').dataset.overlay,'true');assert.equal(r.d.activeElement.id,'note-body');
  r.set('#note-body','跨窗口草稿');r.click('.sidebar .workspace-panel-close');resize(r,1440);resize(r,390);r.click('#workspace-notes-toggle');
  assert.equal(r.$('#note-body').value,'跨窗口草稿');assert.equal(r.$('#channel-name-input'),target);
  r.submit('#note-form');const id=r.cache().model.notes.at(-1).id;assert.equal(r.$('#channel-name-input'),target);
  checks.push('one_shot_picker_reveals_editor_and_preserves_draft_across_sizes');

  r.click('.sidebar [data-note-locate="'+id+'"]');assert.equal(r.$('.sidebar').hidden,true);assert.equal(r.$('#preview-pane').inert,false);assert.ok(r.$('#note-'+id).classList.contains('note-selected'));assert.equal(r.$('#channel-name-input'),target);
  r.click('#prototype [data-note-locate="'+id+'"]');assert.equal(r.$('.sidebar').hidden,false);
  r.click('[data-note-edit="'+id+'"]');assert.ok(r.$('#note-'+id).contains(r.$('#note-form')));r.set('#note-body','原位编辑');r.submit('#note-form');assert.equal(r.$('#channel-name-input'),target);
  r.click('[data-note-rebind="'+id+'"]');assert.equal(r.$('.sidebar').hidden,true);assert.equal(r.$('#pick-note').getAttribute('aria-pressed'),'true');r.click('#pick-note');
  checks.push('bidirectional_locator_inline_edit_and_rebind_work_with_drawers');

  const editable=parse((await r.download('#save-work')).text);assert.equal(editable.artifactId,parse(source).artifactId);assert.equal(editable.model.notes.at(-1).body,'原位编辑');
  const viewer=open((await r.download('#export-html')).text);resize(viewer,390);assert.equal(viewer.$('.workspace').dataset.layout,'compact');assert.equal(viewer.d.querySelector('#pick-note'),null);assert.equal(viewer.d.querySelector('#save-work,#export-html,#export-md'),null);
  viewer.click('#workspace-notes-toggle');assert.equal(viewer.$('.sidebar').hidden,false);viewer.click('.sidebar [data-note-locate="'+id+'"]');assert.equal(viewer.$('.sidebar').hidden,true);assert.equal(viewer.$('#channel-name-input').value,'保留表单');
  checks.push('real_editable_and_readonly_exports_reopen_with_responsive_panels');
  for(const run of runs)assert.deepEqual(run.errors,[]);
  console.log(JSON.stringify({ok:true,checks,limits:['Synthetic geometry; real browser checks must cover layout and pointer hit testing']},null,2));
 }finally{await Promise.resolve();runs.forEach(r=>r.close());}
}
main().catch(error=>{console.error(error.stack);process.exitCode=1;});
