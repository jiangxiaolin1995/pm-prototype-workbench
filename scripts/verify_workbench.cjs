#!/usr/bin/env node
// Verify the supplied artifact itself. No fixture replacement, source edit, or disk download.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),crypto=require('node:crypto');
const {boot,parse}=require('./test_support.cjs');
async function verify(input,{modulePath,scenario}={}){
 const source=fs.readFileSync(input,'utf8'),seed=parse(source),runs=[],checks=[],skipped=[];
 const open=html=>{const r=boot(html,undefined,modulePath);runs.push(r);return r;};
 const visible=el=>el&&!el.closest('[hidden],[inert]')&&[el,...ancestors(el)].every(p=>{const s=el.ownerDocument.defaultView.getComputedStyle(p);return s.display!=='none'&&s.visibility!=='hidden';});
 function* ancestors(el){for(let p=el.parentElement;p;p=p.parentElement)yield p;}
 const readOnlyTools=r=>assert.equal(r.d.querySelectorAll('#pick-note,#save-work,#export-html,#export-md,#note-form,[data-note-edit],[data-note-delete],[data-note-rebind],.global-document textarea').length,0,'Read-only artifact exposes authoring');
 const noteText='隔离验证文字 <script>window.unwanted=true</script>\n第二行';
 try{
  const r=open(source);assert.deepEqual(r.errors,[],'Runtime failed before verification');
  for(const selector of ['.directory','#preview-pane','.sidebar','#global-menu'])r.$(selector);
  const pageIds=[...r.d.querySelectorAll('#directory-items [data-page]')].map(b=>b.dataset.page);
  assert.ok(pageIds.length,'No business pages');assert.equal(new Set(pageIds).size,pageIds.length,'Duplicate page IDs');
  if(seed.pages)assert.deepEqual([...pageIds].sort(),Object.keys(seed.pages).sort(),'Directory does not match file page configuration');
  for(const id of pageIds){
   r.click('#nav-page-'+id);assert.ok(r.$('#page-title').textContent.trim());assert.ok(r.$('#current-product').textContent.trim());assert.ok(r.$('#current-platform').textContent.trim());
   if(seed.pages)assert.equal(r.$('#page-title').textContent,seed.pages[id].name);
   const scope=seed.navigation?.pageScopes?.[id];if(scope){assert.equal(r.$('#current-product').textContent,seed.navigation.products[scope.product].name);assert.equal(r.$('#current-platform').textContent,seed.navigation.platforms[scope.platform].name);}
   assert.ok(r.$('#scope-name').textContent.includes(r.$('#page-title').textContent));
  }
  checks.push('actual_directory_pages_and_scope_headers');
  // Optional scenario operates the real business controls, never substitutes business markup.
  for(const item of scenario||[]){
   if(item.page)r.click('#nav-page-'+item.page);
   for(const action of item.actions||[]){if(action.click)r.click(action.click);else if(action.selector)r.set(action.selector,action.value,action.event||'input');else throw new Error('Unknown scenario action');}
   for(const expectation of item.expect||[]){const el=r.$(expectation.selector);if('value'in expectation)assert.equal(el.value,expectation.value);if('text'in expectation)assert.ok(el.textContent.includes(expectation.text));if('attribute'in expectation)assert.equal(el.getAttribute(expectation.attribute),expectation.equals);}
  }
  if(scenario?.length)checks.push('provided_business_scenarios');else skipped.push('业务规则及完整业务路径未提供场景，未据此判定业务验收通过');
  if(seed.readOnly){
   readOnlyTools(r);for(const id of pageIds){r.click('#nav-page-'+id);readOnlyTools(r);}
   checks.push('readonly_boundaries_on_all_pages');
  }else{
   const starting=(await r.download('#save-work')).text;
   const startingModel=parse(starting).model;
   const hasDrafts=Object.values(startingModel.drafts||{}).some(d=>d.dirty);
   for(const id of pageIds){
    r.click('#nav-page-'+id);
    if(hasDrafts){skipped.push(id+'：原文件含未保存草稿，保留草稿，跳过新增标注');continue;}
    const root=r.$('#prototype'),candidates=[...root.querySelectorAll('button,input,textarea,select,img,p,h1,h2,h3,td,svg,[data-anchor],section')].filter(visible);
    assert.ok(candidates.length,'No selectable visible element on '+id);
    r.click('#pick-note');let target;
    for(const candidate of candidates){candidate.dispatchEvent(new r.w.MouseEvent('pointerdown',{bubbles:true,cancelable:true,button:0}));candidate.dispatchEvent(new r.w.MouseEvent('click',{bubbles:true,cancelable:true}));if(r.d.querySelector('#note-form')){target=candidate;break;}}
    assert.ok(target,'Picker did not select an actual element on '+id);assert.equal(r.$('#pick-note').getAttribute('aria-pressed'),'false');
    r.set('#note-body',noteText);r.submit('#note-form');assert.ok(target.isConnected,'Saving annotation rebuilt business DOM');
    const saved=r.cache().model.notes.find(n=>n.page===id&&n.body===noteText);assert.ok(saved,'Annotation was not persisted for '+id);
    assert.equal(r.w.unwanted,undefined);
    r.click('#note-'+saved.id+' [data-note-edit]');assert.ok(r.$('#note-'+saved.id).contains(r.$('#note-form')),'Editing did not stay inside original note');
    r.set('#note-body',noteText+' / 编辑');r.submit('#note-form');assert.ok(target.isConnected);
    r.click('#toggle-annotation-frames');r.click('#note-'+saved.id+' [data-note-locate]');
    assert.equal(r.$('#toggle-annotation-frames').getAttribute('aria-checked'),'false');assert.ok(r.$('#note-'+saved.id).classList.contains('note-selected'));
    assert.ok(r.d.querySelector('.annotation-frame.focused.peek'),'Hidden-frame locator did not reveal selected frame');r.click('#toggle-annotation-frames');
    const before=parse((await r.download('#save-work')).text).model;
    r.click('#global-menu');r.click('#nav-page-'+id);
    const after=parse((await r.download('#save-work')).text).model;
    assert.deepEqual(after.data,before.data,'Business data changed during document round-trip');
    const ignore=new Set(['scroll','notesScroll','tableScroll','canvasScrollLeft','canvasScrollTop']);
    const businessView=v=>Object.fromEntries(Object.entries(v).filter(([k])=>!ignore.has(k)));
    assert.deepEqual(businessView(after.views[id]),businessView(before.views[id]),'Business view state changed during document round-trip');
   }
   if(!hasDrafts)checks.push('actual_page_elements_one_shot_inline_edit_linked_focus_and_state_preservation');
   const documents=[['#global-menu','#global-content-input','globalContent'],['[data-prd-document="data"]','#data-requirements-input','dataRequirements'],['[data-prd-document="tracking"]','#tracking-content-input','trackingContent']];
   for(const [nav,selector,field] of documents){r.click(nav);r.set(selector,noteText+' '+field);assert.equal(r.w.unwanted,undefined);}
   const backup=await r.download('#save-work'),snapshot=parse(backup.text);
   assert.equal(snapshot.readOnly,false);assert.equal(snapshot.artifactId,seed.artifactId);assert.notEqual(snapshot.snapshotId,seed.snapshotId);
   const reopened=open(backup.text);
   for(const [nav,selector,field] of documents){reopened.click(nav);assert.equal(reopened.$(selector).value,noteText+' '+field);}
   assert.deepEqual(snapshot.model.data,r.cache().model.data);assert.deepEqual(snapshot.model.drafts,r.cache().model.drafts);
   checks.push('actual_editable_snapshot_preserves_documents_business_and_drafts');
   if(hasDrafts||snapshot.cacheReview?.pending?.length){
    const count=r.downloads.length;r.click('#export-html');assert.equal(r.downloads.length,count,'Unresolved draft or conflict should block delivery export');
    checks.push('unresolved_work_blocks_readonly_delivery');skipped.push('存在待处理草稿或内容冲突，只读导出按约定被阻止');
   }else{
    const exported=await r.download('#export-html'),viewer=open(exported.text),viewerSeed=parse(exported.text);
    assert.equal(viewerSeed.readOnly,true);assert.deepEqual(viewerSeed.model.notes,snapshot.model.notes);assert.deepEqual(viewerSeed.model.data,snapshot.model.data);
    for(const [nav,,field] of documents){viewer.click(nav);readOnlyTools(viewer);assert.equal(viewerSeed.model[field],noteText+' '+field);assert.ok(viewer.$('#preview-pane').textContent.includes(noteText+' '+field));}
    for(const id of pageIds){viewer.click('#nav-page-'+id);readOnlyTools(viewer);const note=viewer.d.querySelector('.note [data-note-locate]');if(note){note.click();assert.ok(note.closest('.note').classList.contains('note-selected'));}}
    checks.push('actual_readonly_export_reopens_with_text_notes_data_and_locator');
   }
  }
  for(const runtime of runs)assert.deepEqual(runtime.errors,[],'Runtime error in source or an actual export');
  assert.equal(fs.readFileSync(input,'utf8'),source,'Input artifact was modified');
  return {ok:true,file:path.resolve(input),sha256:crypto.createHash('sha256').update(source).digest('hex'),pages:pageIds,checks,skipped,limits:['隔离 JSDOM；几何为桩，不证明布局、触摸、iframe/Shadow DOM 内部选取或真实后端行为','导出通过实际按钮处理器捕获，仅在内存重开，未下载只读成品']};
 }finally{runs.forEach(r=>r.close());}
}
if(require.main===module){
 const args=process.argv.slice(2),input=args.shift(),options={};
 while(args.length){const flag=args.shift(),value=args.shift();if(!value)throw new Error('Missing '+flag);if(flag==='--jsdom')options.modulePath=value;else if(flag==='--scenario')options.scenario=JSON.parse(fs.readFileSync(value,'utf8'));else throw new Error('Unknown '+flag);}
 if(!input)throw new Error('Usage: node verify_workbench.cjs target.html [--jsdom path] [--scenario file.json]');
 verify(input,options).then(result=>console.log(JSON.stringify(result,null,2))).catch(error=>{console.error(JSON.stringify({ok:false,file:input,error:error.stack},null,2));process.exitCode=1;});
}
module.exports={verify};
