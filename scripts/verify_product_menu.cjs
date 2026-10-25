#!/usr/bin/env node
// Product groups with second-level global/page menus; exports stay in memory.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
async function main(){
 const args=process.argv.slice(2);let modulePath;
 if(args.length){assert.equal(args.shift(),'--jsdom');modulePath=args.shift();assert.equal(args.length,0);}
 const {JSDOM,VirtualConsole}=require(modulePath||require.resolve('jsdom',{paths:[process.cwd(),__dirname]}));
 let html=fs.readFileSync(path.join(__dirname,'../assets/workbench.html'),'utf8');
 const parse=s=>JSON.parse(s.match(/id="prototype-data">([\s\S]*?)<\/script>/)[1]);
 const seed=parse(html),runs=[],checks=[];
 seed.navigation={products:{a:{name:'A 产品'},b:{name:'B 产品'}},platforms:{cms:{name:'CMS'},front:{name:'前台'}},pageScopes:{channels:{product:'a',platform:'cms'},tags:{product:'a',platform:'cms'},comments:{product:'b',platform:'cms'},words:{product:'a',platform:'front'}}};
 html=html.replace(/(id="prototype-data">)[\s\S]*?(<\/script>)/,(_,a,b)=>a+JSON.stringify(seed)+b);
 function boot(source,cached){
  const payload=parse(source),errors=[],vc=new VirtualConsole();let blob;
  const key=(payload.readOnly?'prototype-viewer:v3:':'prototype-workbench:v3:')+payload.artifactId+':'+payload.snapshotId;
  vc.on('jsdomError',e=>errors.push(e.message));
  const dom=new JSDOM(source,{url:'https://product-menu.test/',runScripts:'dangerously',pretendToBeVisual:true,virtualConsole:vc,beforeParse(w){
   w.confirm=()=>true;w.HTMLElement.prototype.scrollIntoView=function(){};
   w.HTMLElement.prototype.getBoundingClientRect=function(){return {left:10,top:10,right:810,bottom:610,width:800,height:600};};
   w.URL.createObjectURL=v=>(blob=v,'blob:verification');w.URL.revokeObjectURL=()=>{};w.HTMLAnchorElement.prototype.click=function(){};
   if(cached)w.localStorage.setItem(key,JSON.stringify({model:cached}));
  }});
  const w=dom.window,d=w.document,$=s=>{const el=d.querySelector(s);assert.ok(el,'Missing '+s);return el;};
  const r={w,d,$,errors,click:s=>$(s).click(),set(s,value){$(s).value=value;$(s).dispatchEvent(new w.Event('input',{bubbles:true}));},
   state:()=>JSON.parse(w.localStorage.getItem(key)).model,
   async exportHTML(){blob=null;this.click('#export-html');assert.ok(blob);return new Promise(resolve=>{const reader=new w.FileReader();reader.onload=()=>resolve(reader.result);reader.readAsText(blob);});}
  };runs.push(r);return r;
 }
 try{
  const r=boot(html);
  assert.equal(r.$('#directory-items button').id,'global-menu');
  assert.equal(r.d.querySelectorAll('.product-group').length,2);
  assert.equal(r.d.querySelectorAll('.product-group > .product-children > [data-page]').length,4);
  assert.equal(r.d.querySelectorAll('.product-group > .product-children > [data-product-global]').length,2);
  assert.equal(r.d.querySelector('#page-tabs,[role=tab]'),null,'Navigation must stay on the left');
  assert.equal(r.$('.product-group[data-product=a] .product-children button').dataset.productGlobal,'a');
  assert.ok(r.$('[data-page=words]').textContent.includes('前台'));
  assert.ok(r.$('[data-page=channels]').textContent.includes('CMS'));
  assert.equal(r.$('#sidebar-title').textContent,'研发说明');
  for(const e of r.d.querySelectorAll('#directory-items button'))assert.ok(r.d.getElementById(e.getAttribute('aria-controls')));
  checks.push('products_have_second_level_global_and_page_menus_without_center_tabs');

  const a='A 产品共用文字\n<标签> & </script><script>window.injected=true</script>',b='B 产品独立文字';
  r.click('[data-product-global=a]');assert.equal(r.$('#product-global-input').value,'');r.set('#product-global-input',a);
  assert.equal(r.$('#sidebar-title').textContent,'研发说明');assert.equal(r.$('.stage').hidden,true);
  r.click('[data-product-global=b]');assert.equal(r.$('#product-global-input').value,'');r.set('#product-global-input',b);
  r.click('[data-page=words]');assert.equal(r.$('#current-product').textContent,'A 产品');assert.equal(r.$('#current-platform').textContent,'前台');
  r.click('[data-product-global=a]');assert.equal(r.$('#product-global-input').value,a);
  r.click('#global-menu');r.set('#global-content-input','工作台共用文字');
  r.click('[data-product-global=a]');assert.equal(r.$('#product-global-input').value,a);
  assert.equal(r.state().globalContent,'工作台共用文字');
  checks.push('product_text_is_shared_across_its_surfaces_and_separate_from_other_products');

  r.click('[data-page=channels]');r.set('#search-name','未提交筛选');r.click('#new-channel');r.set('#channel-name-input','弹窗保留');
  r.click('#pick-note');r.click('#channel-name-input');r.set('#note-body','未保存说明');
  r.$('#preview-pane').scrollTop=150;r.$('#notes-scroll').scrollTop=75;
  r.click('[data-product-global=a]');assert.equal(r.state().views.channels.scroll,150);assert.equal(r.state().views.channels.notesScroll,75);
  r.click('[data-page=comments]');r.set('#search-name','B 产品输入');r.click('[data-page=channels]');
  assert.equal(r.$('#search-name').value,'未提交筛选');assert.equal(r.$('#channel-name-input').value,'弹窗保留');assert.equal(r.$('#note-body').value,'未保存说明');
  assert.equal(r.$('#sidebar-title').textContent,'研发说明');assert.ok(r.$('#notes-slot').textContent.includes(seed.model.notes[0].body));
  assert.deepEqual(r.state().notes,seed.model.notes);assert.deepEqual(r.state().counters,seed.model.counters);
  r.click('#cancel-note');r.click('[data-product-global=a]');
  checks.push('navigation_preserves_business_inputs_modal_draft_scroll_and_original_notes');

  const reopened=boot(html,r.state());assert.equal(reopened.$('#product-global-input').value,a);
  const legacy=JSON.parse(JSON.stringify(seed.model));legacy.workspaceView='menu';legacy.menuGlobalContent={'channels/a/cms':'原渠道菜单正文','moderation/a/front':'原前台菜单正文','moderation/b/cms':'B 原菜单正文'};
  legacy.globalNotes={directory:'旧目录',prototype:'旧原型正文',notes:'旧研发正文'};legacy.views.channels.queryDraft='旧筛选';
  const old=boot(html,legacy);assert.equal(old.$('#product-global-input').value,'');
  assert.equal(old.$('[data-legacy-menu="channels/a/cms"]').value,'原渠道菜单正文');
  assert.equal(old.d.querySelector('[data-legacy-menu="moderation/b/cms"]'),null);
  old.set('[data-legacy-menu="channels/a/cms"]','保留并编辑原菜单正文');old.click('[data-page=channels]');assert.equal(old.$('#search-name').value,'旧筛选');
  old.click('#global-menu');assert.equal(old.$('[data-global-note=prototype]').value,'旧原型正文');assert.equal(old.state().globalNotes.directory,'旧目录');
  old.click('[data-product-global=a]');assert.equal(old.$('[data-legacy-menu="channels/a/cms"]').value,'保留并编辑原菜单正文');
  const oldExport=await old.exportHTML(),oldViewer=boot(oldExport);assert.ok(oldViewer.$('#product-global-panel').textContent.includes('保留并编辑原菜单正文'));assert.equal(oldViewer.d.querySelector('textarea'),null);
  checks.push('old_menu_text_remains_accessible_by_original_scope_and_is_not_silently_merged');

  const exported=await r.exportHTML(),shipped=parse(exported),stale=JSON.parse(JSON.stringify(shipped.model));
  stale.productGlobalContent={a:'旧缓存',b:'旧缓存'};
  const viewer=boot(exported,stale);assert.equal(viewer.$('#product-global-text').textContent,a);assert.equal(viewer.w.injected,undefined);
  assert.equal(viewer.d.querySelectorAll('#product-global-input,#global-content-input,#pick-note,#note-form,.note-controls,#export-html').length,0);
  viewer.click('[data-product-global=b]');assert.equal(viewer.$('#product-global-text').textContent,b);
  viewer.click('[data-page=comments]');assert.equal(viewer.$('#search-name').value,'B 产品输入');viewer.set('#search-name','查看者体验');
  viewer.click('#global-menu');assert.equal(viewer.$('#global-content-text').textContent,'工作台共用文字');
  assert.deepEqual(shipped.model.notes,seed.model.notes);assert.deepEqual(shipped.model.data,seed.model.data);
  checks.push('actual_readonly_export_preserves_left_navigation_text_and_business_interaction');

  const renamed=JSON.parse(JSON.stringify(shipped));renamed.readOnly=false;renamed.navigation.products.a.name='A 改名产品';
  const renamedHTML=exported.replace(/(id="prototype-data">)[\s\S]*?(<\/script>)/,(_,start,end)=>start+JSON.stringify(renamed).replace(/</g,'\\u003c')+end);
  const renameView=boot(renamedHTML);assert.equal(renameView.$('#product-global-input').value,a);assert.equal(renameView.$('#current-product').textContent,'A 改名产品');
  checks.push('product_display_name_changes_do_not_break_saved_content');
  for(const run of runs)assert.deepEqual(run.errors,[]);
  console.log(JSON.stringify({ok:true,checks,verificationOutput:null},null,2));
 }finally{await new Promise(resolve=>setImmediate(resolve));runs.forEach(r=>r.w.close());}
}
main().catch(e=>{console.error(e.stack);process.exitCode=1;});
