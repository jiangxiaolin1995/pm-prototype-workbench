#!/usr/bin/env node
// PRD authoring, migration and actual export handlers; downloads stay in memory.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
async function main(){
 const args=process.argv.slice(2);let modulePath;
 if(args.length){assert.equal(args.shift(),'--jsdom');modulePath=args.shift();assert.equal(args.length,0);}
 const {JSDOM,VirtualConsole}=require(modulePath||require.resolve('jsdom',{paths:[process.cwd(),__dirname]}));
 const source=require('./fixture.cjs')();
 const parse=s=>JSON.parse(s.match(/id="prototype-data">([\s\S]*?)<\/script>/)[1]);
 const replace=(html,seed)=>html.replace(/(id="prototype-data">)[\s\S]*?(<\/script>)/,(_,a,b)=>a+JSON.stringify(seed).replace(/</g,'\\u003c').replace(/>/g,'\\u003e').replace(/&/g,'\\u0026')+b);
 const seed=parse(source),runs=[],checks=[];
 function boot(html,cached){
  const payload=parse(html),errors=[],vc=new VirtualConsole();let blob,filename;
  vc.on('jsdomError',e=>errors.push(e.message));
  const dom=new JSDOM(html,{url:'https://prd-template.test/',runScripts:'dangerously',pretendToBeVisual:true,virtualConsole:vc,beforeParse(w){
   w.confirm=()=>true;w.HTMLElement.prototype.scrollIntoView=function(){};
   w.URL.createObjectURL=b=>(blob=b,'blob:verification');w.URL.revokeObjectURL=()=>{};
   w.HTMLAnchorElement.prototype.click=function(){filename=this.download;};
   if(cached)w.localStorage.setItem((payload.readOnly?'prototype-viewer:v3:':'prototype-workbench:v3:')+payload.artifactId+':'+payload.snapshotId,JSON.stringify({model:cached}));
  }});
  const w=dom.window,d=w.document,$=s=>{const el=d.querySelector(s);assert.ok(el,'Missing '+s);return el;};
  const rt={w,d,$,errors,click:s=>$(s).click(),set(s,value,event='input'){$(s).value=value;$(s).dispatchEvent(new w.Event(event,{bubbles:true}));},
   state(){return JSON.parse(w.localStorage.getItem((payload.readOnly?'prototype-viewer:v3:':'prototype-workbench:v3:')+payload.artifactId+':'+payload.snapshotId)).model;},
   async download(s){blob=null;filename=null;$(s).click();assert.ok(blob,'No actual download for '+s);const text=await new Promise((resolve,reject)=>{const r=new w.FileReader();r.onload=()=>resolve(r.result);r.onerror=reject;r.readAsText(blob);});return {text,filename};}
  };runs.push(rt);return rt;
 }
 try{
  const r=boot(source);
  assert.equal(r.$('#directory-items button').id,'global-menu');
  assert.deepEqual([...r.d.querySelectorAll('.requirement-docs button')].map(b=>b.textContent.trim()),['全局描述','上线后数据需求','埋点说明']);
  assert.equal(r.d.querySelectorAll('.product-group [data-page]').length,4);
  assert.equal(r.d.querySelectorAll('[data-prd-requirement],#prd-add-section,.prd-format-tools').length,0);
  r.click('#global-menu');assert.equal(r.$('#global-content-input').value,'');assert.equal(r.$('#global-content-input').placeholder,'');
  r.click('[data-prd-document="data"]');assert.equal(r.$('#data-requirements-input').value,'');
  r.click('[data-prd-document="tracking"]');assert.equal(r.$('#tracking-content-input').value,'');
  assert.equal(r.$('#business-panel').hidden,true);
  assert.equal(r.d.querySelectorAll('#requirement-panel textarea').length,1);
  assert.equal(r.d.querySelectorAll('#requirement-panel button,#requirement-panel input,#requirement-panel select').length,0);
  assert.equal(r.d.querySelectorAll('[data-page][aria-current],.product-group.is-current').length,0);
  checks.push('three_plain_text_documents_default_empty_without_extra_fields_or_chapter_controls');

  const texts={global:'# 需求背景\n由我填写\n<script>window.injected=true</script>',data:'上线后观察数据\n统计范围和时间由我填写\n| 不渲染成表格 |',tracking:'需要埋点时在这里写\n![不渲染图片](https://example.com/image.png)'};
  r.click('#global-menu');r.set('#global-content-input',texts.global);
  r.click('[data-prd-document="data"]');r.set('#data-requirements-input',texts.data);
  r.click('[data-prd-document="tracking"]');r.set('#tracking-content-input',texts.tracking);
  for(const [id,value] of Object.entries(texts)){
   r.click(id==='global'?'#global-menu':'[data-prd-document="'+id+'"]');
   assert.equal(r.$(id==='global'?'#global-content-input':id==='data'?'#data-requirements-input':'#tracking-content-input').value,value);
  }
  assert.equal(r.w.injected,undefined);
  checks.push('three_documents_are_independent_plain_text_with_persistence');

  r.click('[data-page="channels"]');r.set('#search-name','未提交筛选');r.click('#new-channel');r.set('#channel-name-input','未提交表单');
  r.click('#pick-note');r.click('[data-anchor="channel-name"] .help');r.set('#note-body','元素逻辑草稿');
  for(const nav of ['#global-menu','[data-prd-document="data"]','[data-prd-document="tracking"]'])r.click(nav);
  r.click('[data-page="channels"]');assert.equal(r.$('#channel-name-input').value,'未提交表单');assert.equal(r.$('#note-body').value,'元素逻辑草稿');
  assert.deepEqual(r.state().data,seed.model.data);assert.deepEqual(r.state().notes,seed.model.notes);
  checks.push('document_navigation_preserves_business_form_data_and_annotation_draft');

  const backup=await r.download('#save-work'),workSeed=parse(backup.text);
  assert.equal(workSeed.readOnly,false);assert.equal(workSeed.artifactId,seed.artifactId);assert.notEqual(workSeed.snapshotId,seed.snapshotId);
  const reopened=boot(backup.text);assert.equal(reopened.$('#note-body').value,'元素逻辑草稿');reopened.click('[data-prd-document="data"]');assert.equal(reopened.$('#data-requirements-input').value,texts.data);
  r.click('#cancel-note');r.click('[data-prd-document="tracking"]');
  const shipped=await r.download('#export-html'),shippedSeed=parse(shipped.text);
  const stale=JSON.parse(JSON.stringify(shippedSeed.model));stale.globalContent=stale.dataRequirements=stale.trackingContent='过期缓存';
  const viewer=boot(shipped.text,stale);
  for(const [id,value] of Object.entries(texts)){
   viewer.click(id==='global'?'#global-menu':'[data-prd-document="'+id+'"]');
   assert.equal(viewer.$(id==='global'?'#global-content-text':id==='data'?'#data-requirements-text':'#tracking-content-text').textContent,value);
  }
  assert.equal(viewer.d.querySelectorAll('#requirement-panel textarea,#requirement-panel img,#requirement-panel table,#requirement-panel input,#save-work,#export-html,#export-md,#pick-note').length,0);
  assert.equal(viewer.w.injected,undefined);viewer.click('[data-page="channels"]');viewer.set('#channel-name-input','仍可操作');assert.equal(viewer.$('#channel-name-input').value,'仍可操作');
  const markdown=await r.download('#export-md');for(const value of Object.values(texts))assert.ok(markdown.text.includes(value));
  assert.ok(markdown.text.includes('## 上线后数据需求'));assert.ok(markdown.text.includes('## 埋点说明'));assert.ok(!markdown.text.includes('## 上线安排'));
  checks.push('actual_editable_readonly_and_prd_exports_preserve_text_and_business_interaction');

  const legacy=JSON.parse(JSON.stringify(seed.model));legacy.workspaceView='requirement';legacy.globalContent='原全局';legacy.productGlobalContent={example:'原产品正文'};
  legacy.views.channels.queryDraft='原筛选';
  const image={src:'data:image/png;base64,YQ==',alt:'旧附件'};
  legacy.prdDocuments={channels:{version:'v3',owner:'用户',sections:{overview:'原背景',release:'原上线安排',tracking:'原埋点',compatibility:'隐藏过的兼容性',flow:'![旧附件](prd-image:old)'},enabled:['overview','tracking','release'],images:{old:image}},moderation:{sections:{rules:'另一需求的规则',tracking:'另一需求的埋点'}},retired:{sections:{unknown:'旧需求内容'}}};
  const old=boot(source,legacy);assert.equal(old.$('#global-content-panel').hidden,false);
  const migrated=old.$('#global-content-input').value;
  assert.equal(migrated,'原全局','Old PRD sections must not be inserted into global description');
  old.click('[data-prd-document="data"]');assert.equal(old.$('#data-requirements-input').value,'','Release schedules must not become post-launch data requirements');
  old.click('[data-prd-document="tracking"]');assert.ok(old.$('#tracking-content-input').value.includes('原埋点'));assert.ok(old.$('#tracking-content-input').value.includes('另一需求的埋点'));
  assert.deepEqual(old.state().prdDocuments,legacy.prdDocuments,'Raw legacy content and image assets remain intact');
  assert.deepEqual(old.state().notes,seed.model.notes);assert.equal(old.state().productGlobalContent.example,'原产品正文');
  const second=boot(source,old.state());second.click('#global-menu');assert.equal(second.$('#global-content-input').value,migrated);
  const automatic='REQ-01 · 渠道管理\n需求版本：v3\n\n负责人：用户\n\n需求概述\n原背景\n\n上线安排\n原上线安排\n\n兼容性要求\n隐藏过的兼容性\n\n业务流程\n![旧附件](prd-image:old)\n\nREQ-02 · 评论审核\n共用业务规则\n另一需求的规则\n\nretired\nunknown\n旧需求内容';
  const previous={...legacy,plainDocumentsMigrated:true,globalContent:automatic};
  const cleaned=boot(source,previous);assert.equal(cleaned.$('#global-content-input').value,'');
  cleaned.set('#global-content-input','用户后来亲自填写的内容');
  assert.equal(cleaned.state().globalDescriptionMigrationArchive,automatic);
  const reloaded=boot(source,cleaned.state());assert.equal(reloaded.$('#global-content-input').value,'用户后来亲自填写的内容');
  const prefixed=boot(source,{...previous,globalContent:'用户原文\n\n'+automatic});assert.equal(prefixed.$('#global-content-input').value,'用户原文');
  const edited=boot(source,{...previous,globalContent:automatic+'\n用户修改'});assert.equal(edited.$('#global-content-input').value,automatic+'\n用户修改','Do not erase text edited by the user');
  old.click('[data-page="channels"]');assert.equal(old.$('#search-name').value,'原筛选');
  checks.push('global_stays_empty_without_automatic_sections_and_known_imports_are_removed_once_without_erasing_user_text');

  const oldViewerSeed=JSON.parse(JSON.stringify(seed));oldViewerSeed.model=legacy;oldViewerSeed.readOnly=true;
  const oldViewer=boot(replace(source,oldViewerSeed),{...legacy,plainDocumentsMigrated:true,globalContent:'过期正文',dataRequirements:'错误数据',trackingContent:'错误埋点'});
  assert.equal(oldViewer.$('#global-content-text').textContent,migrated);oldViewer.click('[data-prd-document="data"]');assert.equal(oldViewer.$('#data-requirements-text').textContent,'尚未填写');
  checks.push('legacy_readonly_content_uses_file_and_ignores_stale_viewer_prose');

  const multi=parse(source);multi.navigation.products.second={name:'第二产品'};multi.navigation.pageScopes.tags.product='second';
  const cross=boot(replace(source,multi));assert.equal(cross.d.querySelectorAll('.requirement-docs button').length,3);cross.click('[data-prd-document="data"]');cross.set('#data-requirements-input','注明产品和端的数据要求');cross.click('[data-page="tags"]');assert.equal(cross.$('#current-product').textContent,'第二产品');cross.click('[data-prd-document="data"]');assert.equal(cross.$('#data-requirements-input').value,'注明产品和端的数据要求');
  checks.push('workspace_documents_are_shared_without_duplicate_product_navigation');
  for(const run of runs)assert.deepEqual(run.errors,[]);
  console.log(JSON.stringify({ok:true,checks},null,2));
 }finally{await new Promise(resolve=>setImmediate(resolve));runs.forEach(r=>r.w.close());}
}
main().catch(e=>{console.error(e.stack);process.exitCode=1;});
