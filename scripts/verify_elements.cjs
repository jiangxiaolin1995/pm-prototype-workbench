#!/usr/bin/env node
// Runtime checks for arbitrary element selection; captures export in memory only.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
async function main(){
 const args=process.argv.slice(2);let modulePath;
 if(args.length){assert.equal(args.shift(),'--jsdom');modulePath=args.shift();assert.equal(args.length,0);}
 const {JSDOM,VirtualConsole}=require(modulePath||require.resolve('jsdom',{paths:[process.cwd(),__dirname]}));
 const source=fs.readFileSync(path.join(__dirname,'../assets/workbench.html'),'utf8');
 const parse=s=>JSON.parse(s.match(/id="prototype-data">([\s\S]*?)<\/script>/)[1]);
 const fixture='<section id="element-fixture"><p><span class="plain-copy">没有预设锚点的文字</span></p><img id="fixture-image" alt="示意图片" src="data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 width=%2280%22 height=%2240%22%3E%3Crect width=%2280%22 height=%2240%22 fill=%22%23087f5b%22/%3E%3C/svg%3E"><button id="fixture-disabled" disabled>禁用按钮</button><input id="fixture-disabled-input" disabled value="只读值"><a id="fixture-link" href="#destination" tabindex="7" aria-label="查看详情">查看详情</a><button id="fixture-event">事件按钮</button><textarea id="fixture-textarea">多行内容</textarea><select id="fixture-select"><option>选项 A</option><option>选项 B</option></select><input id="fixture-checkbox" type="checkbox" value="a"><input id="fixture-radio" type="radio" value="b"><svg id="fixture-icon" style="pointer-events:none" width="24" height="24" aria-label="图标"><path d="M2 2h20v20H2Z" fill="green"/></svg><canvas id="fixture-canvas" width="40" height="30"></canvas><div id="fixture-contenteditable" contenteditable="true">可编辑内容</div></section>';
 const marker="+action+'</div>';}";assert.ok(source.includes(marker));
 const html=source.replace(marker,"+action+'</div>'+"+JSON.stringify(fixture)+";}");
 const runs=[],checks=[];
 function boot(text,cached){
  const seed=parse(text),errors=[],vc=new VirtualConsole();let blob;
  vc.on('jsdomError',e=>errors.push(e.message));
  const dom=new JSDOM(text,{url:'https://element-verification.test/',runScripts:'dangerously',pretendToBeVisual:true,virtualConsole:vc,beforeParse(w){
   w.confirm=()=>true;w.HTMLElement.prototype.scrollIntoView=function(){};
   w.HTMLElement.prototype.getClientRects=function(){return this.closest('[hidden],[inert]')?[]:[this.getBoundingClientRect()];};
   w.HTMLElement.prototype.getBoundingClientRect=function(){return {left:10,top:10,right:810,bottom:610,width:800,height:600};};
   w.URL.createObjectURL=b=>(blob=b,'blob:verification');w.URL.revokeObjectURL=()=>{};w.HTMLAnchorElement.prototype.click=function(){};
   if(cached)w.localStorage.setItem((seed.readOnly?'prototype-viewer:v3:':'prototype-workbench:v3:')+seed.artifactId+':'+seed.snapshotId,JSON.stringify({model:cached}));
  }});
  const w=dom.window,d=w.document,$=s=>{const el=d.querySelector(s);assert.ok(el,'Missing '+s);return el;};
  const r={w,d,$,errors,click:s=>{$(s).dispatchEvent(new w.MouseEvent('click',{bubbles:true,cancelable:true}));},
   pointer(s){const el=$(s);el.dispatchEvent(new w.MouseEvent('pointerdown',{bubbles:true,cancelable:true,button:0}));el.dispatchEvent(new w.MouseEvent('click',{bubbles:true,cancelable:true}));},
   set(s,value,event='input'){$(s).value=value;$(s).dispatchEvent(new w.Event(event,{bubbles:true}));},
   submit:s=>$(s).dispatchEvent(new w.Event('submit',{bubbles:true,cancelable:true})),
   state(){return JSON.parse(w.localStorage.getItem((seed.readOnly?'prototype-viewer:v3:':'prototype-workbench:v3:')+seed.artifactId+':'+seed.snapshotId)).model;},
   note(s,body){this.click('#pick-note');this.pointer(s);assert.equal($('#pick-note').getAttribute('aria-pressed'),'false');assert.equal($('#note-body').disabled,false);this.set('#note-body',body);this.submit('#note-form');return Number($('#locate-note').value);},
   async exportHTML(){blob=null;this.click('#export-html');if(!blob)return null;return new Promise(resolve=>{const reader=new w.FileReader();reader.onload=()=>resolve(reader.result);reader.readAsText(blob);});}
  };runs.push(r);return r;
 }
 try{
  const r=boot(html);const titleId=r.note('.content-heading h3','标题说明');
  assert.ok(r.$('.content-heading h3').classList.contains('selected-target'),'Selected heading must not become its outer page');
  assert.notEqual(r.state().notes.find(n=>n.id===titleId).anchor,'list-page');
  checks.push('unmarked_heading_is_selected_exactly');
  let pointerActions=0,clickActions=0;r.$('#fixture-event').addEventListener('pointerdown',()=>pointerActions++);r.$('#fixture-event').addEventListener('click',()=>clickActions++);
  r.click('#pick-note');r.pointer('#fixture-event');assert.equal(pointerActions,0);assert.equal(clickActions,0);
  r.set('#note-body','按钮说明');r.submit('#note-form');
  r.pointer('#fixture-event');assert.equal(pointerActions,1);assert.equal(clickActions,1,'Original business listeners survive saving a note');
  for(const s of ['.plain-copy','#fixture-image','#fixture-disabled','#fixture-disabled-input','#fixture-link','#fixture-textarea','#fixture-select','#fixture-checkbox','#fixture-radio','#fixture-icon','#fixture-icon path','#fixture-canvas','#fixture-contenteditable','#element-fixture']){r.note(s,'元素说明 '+s);assert.ok(r.$(s).classList.contains('selected-target'),'Must select '+s);}
  assert.equal(r.w.location.hash,'');assert.equal(r.$('#fixture-link').getAttribute('tabindex'),'7');assert.equal(r.$('#fixture-link').getAttribute('aria-label'),'查看详情');
  assert.equal(r.$('#fixture-checkbox').checked,false);assert.equal(r.$('#fixture-radio').checked,false);assert.equal(r.$('#fixture-select').selectedIndex,0);
  checks.push('text_image_controls_svg_canvas_and_container_select_without_business_actions');
  r.click('#pick-note');r.$('.plain-copy').dispatchEvent(new r.w.MouseEvent('mouseover',{bubbles:true}));
  r.d.dispatchEvent(new r.w.KeyboardEvent('keydown',{key:'ArrowUp',bubbles:true,cancelable:true}));
  r.d.dispatchEvent(new r.w.KeyboardEvent('keydown',{key:'Enter',bubbles:true,cancelable:true}));r.set('#note-body','外层段落说明');r.submit('#note-form');
  assert.ok(r.$('#element-fixture p').classList.contains('selected-target'));
  checks.push('keyboard_can_select_the_outer_container');
  const rowSelector='tbody tr:first-child td:first-child',rowId=r.note(rowSelector,'某条渠道的单元格');
  r.click('#new-channel');r.set('#channel-name-input','插入的新渠道');r.set('#category-input','题材','change');
  r.$('input[name=tag]').checked=true;r.$('input[name=tag]').dispatchEvent(new r.w.Event('change',{bubbles:true}));r.submit('#channel-form');
  r.click('.sidebar [data-note-locate="'+rowId+'"]');
  const selectedCell=r.$('td.selected-target');assert.ok(selectedCell.textContent.includes('CH-001'));assert.ok(!selectedCell.textContent.includes('插入的新渠道'));
  checks.push('table_cell_tracks_record_after_row_insertion');
  r.click('#new-channel');r.set('#channel-name-input','未保存输入');
  const modalId=r.note('[data-anchor=channel-name] .help','弹窗内部无锚点文字');
  r.click('#close-modal');r.click('.sidebar [data-note-locate="'+modalId+'"]');
  assert.equal(r.$('#channel-name-input').value,'未保存输入');assert.ok(r.$('[data-anchor=channel-name] .help').classList.contains('selected-target'));
  r.click('#pick-note');r.d.dispatchEvent(new r.w.KeyboardEvent('keydown',{key:'Escape',bubbles:true,cancelable:true}));assert.ok(r.$('#form-panel'));
  r.set('#category-input','题材','change');
  const checkboxId=r.note('input[name=tag][value=动作]','复选框的单独说明');
  r.set('#category-input','地区','change');
  assert.equal(r.d.querySelector('input[name=tag].selected-target'),null,'Switching category must not bind a note to the checkbox at the same index');
  r.click('.sidebar [data-note-locate="'+checkboxId+'"]');assert.equal(r.$('input[name=tag].selected-target').value,'动作');
  checks.push('checkbox_binding_does_not_move_to_another_category');
  r.click('#close-modal');r.click('[data-page=comments]');
  const authorId=r.note('.comment-item .comment-meta > span:first-child','评论作者区域说明');
  const reordered=r.state();reordered.data.comments.unshift({id:'CM-999',author:'插入的新作者',resource:'新资源',text:'新评论',status:'pending'});
  const cards=boot(html,reordered);cards.click('.sidebar [data-note-locate="'+authorId+'"]');assert.ok(cards.$('.selected-target').textContent.includes('CM-001'),'Card annotation must stay on the original record after insertion');
  checks.push('dynamic_card_annotation_tracks_its_record');
  r.click('[data-page=channels]');const reopened=boot(html,r.state());reopened.click('.sidebar [data-note-locate="'+rowId+'"]');assert.ok(reopened.$('td.selected-target').textContent.includes('CH-001'));
  const exported=await r.exportHTML();assert.ok(exported);const viewer=boot(exported);
  viewer.click('.sidebar [data-note-locate="'+titleId+'"]');assert.ok(viewer.$('.content-heading h3').classList.contains('selected-target'));
  viewer.click('.sidebar [data-note-locate="'+modalId+'"]');assert.ok(viewer.$('[data-anchor=channel-name] .help').classList.contains('selected-target'));
  assert.equal(viewer.d.querySelectorAll('[data-mode],#pick-note,#note-form,#export-html').length,0);
  checks.push('modal_cache_and_in_memory_readonly_export_keep_exact_targets');
  const deleted=parse(exported);deleted.model.data.channels=deleted.model.data.channels.filter(n=>n.id!=='CH-001');deleted.readOnly=false;
  const invalid=boot(exported.replace(/(id="prototype-data">)[\s\S]*?(<\/script>)/,(_,a,b)=>a+JSON.stringify(deleted).replace(/</g,'\\u003c')+b));
  assert.equal(await invalid.exportHTML(),null,'Deleted record must block export instead of targeting a different row');
  checks.push('missing_target_blocks_export_without_misbinding');
  for(const run of runs)assert.deepEqual(run.errors,[]);
  console.log(JSON.stringify({ok:true,checks,verificationOutput:null},null,2));
 }finally{await new Promise(resolve=>setImmediate(resolve));runs.forEach(r=>r.w.close());}
}
main().catch(e=>{console.error(e.stack);process.exitCode=1;});
