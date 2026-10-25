#!/usr/bin/env node
// Checks global authoring without replacing business page identities or state.
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
async function main() {
  const args = process.argv.slice(2), options = {};
  while (args.length) { const flag = args.shift(); assert.ok(['--jsdom','--output'].includes(flag)); options[flag] = args.shift(); assert.ok(options[flag]); }
  const {JSDOM, VirtualConsole} = require(options['--jsdom'] || require.resolve('jsdom', {paths:[process.cwd(),__dirname]}));
  const html = fs.readFileSync(path.join(__dirname,'../assets/workbench.html'),'utf8');
  const parse = text => JSON.parse(text.match(/id="prototype-data">([\s\S]*?)<\/script>/)[1]);
  const seed = parse(html), runtimes = [], checks = [];
  const content = '整个项目的说明\n第二行 <标签> & </script><script>window.injected=true</script>';
  function boot(source, cached) {
    const payload=parse(source), errors=[], vc=new VirtualConsole(); let blob;
    vc.on('jsdomError',e=>errors.push(e.message));
    const dom = new JSDOM(source,{url:'https://global-menu.test/',runScripts:'dangerously',pretendToBeVisual:true,virtualConsole:vc,beforeParse(w){
      w.confirm=()=>true; w.HTMLElement.prototype.scrollIntoView=function(){};
      w.URL.createObjectURL=value=>(blob=value,'blob:verification'); w.URL.revokeObjectURL=()=>{}; w.HTMLAnchorElement.prototype.click=function(){};
      if(cached)w.localStorage.setItem((payload.readOnly?'prototype-viewer:v3:':'prototype-workbench:v3:')+payload.artifactId+':'+payload.snapshotId,JSON.stringify({model:cached}));
    }});
    const w=dom.window,d=w.document,$=selector=>{const el=d.querySelector(selector);assert.ok(el,'Missing '+selector);return el;};
    const rt={w,d,$,errors,click:s=>{$(s).click();},set(s,value){$(s).value=value;$(s).dispatchEvent(new w.Event('input',{bubbles:true}));},
      state(){return JSON.parse(w.localStorage.getItem((payload.readOnly?'prototype-viewer:v3:':'prototype-workbench:v3:')+payload.artifactId+':'+payload.snapshotId)).model;},
      async exportHTML(){blob=null;$('#export-html').click();assert.ok(blob,'Actual export did not produce a file');return new Promise((resolve,reject)=>{const reader=new w.FileReader();reader.onload=()=>resolve(reader.result);reader.onerror=reject;reader.readAsText(blob);});}
    };runtimes.push(rt);return rt;
  }
  try {
    const work=boot(html);
    assert.equal(work.$('#directory-items button').id,'global-menu','Global content must be the first menu');
    assert.equal(work.d.querySelectorAll('#directory-items [data-page]').length,4);
    work.click('#global-menu');assert.equal(work.$('#global-menu').getAttribute('aria-current'),'page');
    assert.equal(work.d.querySelectorAll('[data-page][aria-current],.product-group.is-current').length,0);
    assert.equal(work.$('#global-content-panel').hidden,false);assert.equal(work.$('#global-content-input').value,'');
    assert.equal(work.$('#global-menu span').textContent,'全局内容');
    assert.equal(work.$('.stage').hidden,true);assert.equal(work.$('#note-count').hidden,true);
    checks.push('first_menu_empty_global_view_separate_from_business_pages');

    work.set('#global-content-input',content);
    assert.equal(work.state().globalContent,content);assert.equal(work.state().activePage,seed.model.activePage);
    work.click('[data-product-global=example]');work.set('#product-global-input','本产品正文独立保存');work.click('[data-page=channels]');work.set('#search-name','未提交的筛选');
    work.click('#new-channel');work.set('#channel-name-input','未保存的渠道');
    work.click('#pick-note');work.click('[data-anchor=channel-name]');work.set('#note-body','仍未保存的标注');
    work.click('#global-menu');assert.equal(work.$('#global-content-input').value,content);
    const pending=work.state();assert.equal(pending.drafts.channels.values.body,'仍未保存的标注');
    assert.equal(pending.views.channels.modal.name,'未保存的渠道');assert.ok(Object.values(pending.productGlobalContent).includes('本产品正文独立保存'));
    assert.deepEqual(pending.notes,seed.model.notes);assert.deepEqual(pending.counters,seed.model.counters);
    work.click('[data-page=channels]');assert.equal(work.$('#channel-name-input').value,'未保存的渠道');assert.equal(work.$('#note-body').value,'仍未保存的标注');
    work.click('#cancel-note');work.click('#global-menu');assert.equal(work.$('#global-content-input').value,content);assert.equal(work.w.injected,undefined);
    checks.push('global_text_autosaves_without_changing_form_drafts_notes_or_product_text');

    const reopened=boot(html,work.state());assert.equal(reopened.$('#global-content-input').value,content);
    const legacy=JSON.parse(JSON.stringify(seed.model));delete legacy.globalContent;delete legacy.workspaceView;
    legacy.activePage='comments';legacy.views.comments.queryDraft='旧输入';legacy.globalNotes={directory:'旧目录说明'};
    const old=boot(html,legacy);assert.equal(old.$('#search-name').value,'旧输入');old.click('#global-menu');assert.equal(old.$('#global-content-input').value,'');assert.equal(old.state().globalNotes.directory,'旧目录说明');
    checks.push('reopen_and_old_cache_preserve_existing_data');

    const exported=await work.exportHTML(),shipped=parse(exported);
    assert.equal(shipped.readOnly,true);assert.equal(shipped.model.globalContent,content);assert.equal(shipped.model.workspaceView,'global');
    assert.deepEqual(shipped.model.notes,seed.model.notes);assert.deepEqual(shipped.model.data,seed.model.data);
    const stale=JSON.parse(JSON.stringify(shipped.model));stale.globalContent='过期的查看缓存';
    const viewer=boot(exported,stale);assert.equal(viewer.$('#global-content-text').textContent,content);assert.equal(viewer.w.injected,undefined);
    assert.equal(viewer.d.querySelectorAll('#global-content-input,[data-mode],#export-html,#note-form,#pick-note').length,0);
    viewer.click('[data-page=channels]');assert.equal(viewer.$('#channel-name-input').value,'未保存的渠道');viewer.set('#channel-name-input','只读文件可体验业务');
    viewer.click('#global-menu');assert.equal(viewer.$('#global-content-text').textContent,content);
    assert.equal(work.$('#global-content-input').value,content);
    checks.push('actual_readonly_export_contains_literal_text_and_retains_business_interaction');
    for(const rt of runtimes)assert.deepEqual(rt.errors,[]);
    if(options['--output']){fs.mkdirSync(path.dirname(options['--output']),{recursive:true});fs.writeFileSync(options['--output'],exported,{flag:'wx'});}
    console.log(JSON.stringify({ok:true,checks,exportedVerification:options['--output']||null},null,2));
  } finally { await new Promise(resolve=>setImmediate(resolve));runtimes.forEach(rt=>rt.w.close()); }
}
main().catch(e=>{console.error(e.stack);process.exitCode=1;});
