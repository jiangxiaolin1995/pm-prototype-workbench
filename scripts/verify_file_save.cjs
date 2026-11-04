#!/usr/bin/env node
// Real HTML handlers -> local HTTP helper -> temporary HTML -> independent browser stores.
const fs=require('node:fs'),path=require('node:path'),os=require('node:os'),assert=require('node:assert/strict');
const {spawn}=require('node:child_process'),{once}=require('node:events');
const {boot,parse}=require('./test_support.cjs');
const root=path.join(__dirname,'..'),source=fs.readFileSync(path.join(root,'assets/workbench.html'),'utf8');
const args=process.argv.slice(2),modulePath=args[0]==='--jsdom'?args[1]:undefined;
const runs=[],checks=[],directory=fs.mkdtempSync(path.join(os.tmpdir(),'workbench-no-picker-'));
const filename=path.join(directory,'中文 工作文件.html');fs.writeFileSync(filename,source);
let child,state,stderr='';
const open=(html=source,cached,options)=>{const r=boot(html,cached,modulePath,options);runs.push(r);return r;};
const wait=async predicate=>{for(let n=0;n<160;n++){if(predicate())return;await new Promise(r=>setTimeout(r,25));}assert.ok(predicate(),'Timed out waiting for confirmed disk save');};
const disk=()=>parse(fs.readFileSync(filename,'utf8'));
const saved=r=>r.$('#file-save-indicator').textContent.includes('已自动保存');
async function stop(){if(!child||child.exitCode!==null||child.signalCode)return;const ended=once(child,'exit');child.kill('SIGTERM');await ended;}
async function browser(){
 const response=await fetch(state.url);assert.equal(response.status,200);
 const r=open(await response.text(),undefined,{url:state.url});
 r.w.showOpenFilePicker=()=>{throw new Error('An author must never choose a file');};
 r.w.fetch=(url,options={})=>fetch(new URL(url,state.url),{...options,headers:{...options.headers,Origin:new URL(state.url).origin}});
 return r;
}
function selectElement(run,body){
 run.click('#directory-items [data-page]');run.click('#pick-note');const el=run.$('#prototype [data-anchor]');
 el.dispatchEvent(new run.w.MouseEvent('pointerdown',{bubbles:true,cancelable:true,button:0}));
 el.dispatchEvent(new run.w.MouseEvent('click',{bubbles:true,cancelable:true}));run.set('#note-body',body);
}
(async()=>{try{
 child=spawn('python3',[path.join(__dirname,'serve_workbench.py'),'--serve',filename,'--idle-seconds','30'],{stdio:['ignore','pipe','pipe']});
 child.stderr.on('data',chunk=>stderr+=chunk);
 state=await new Promise((resolve,reject)=>{let output='';const timer=setTimeout(()=>reject(new Error('Helper startup timed out: '+stderr)),10000);child.once('error',reject);child.stdout.on('data',chunk=>{output+=chunk;if(output.includes('\n')){clearTimeout(timer);try{resolve(JSON.parse(output.split('\n')[0]));}catch(error){reject(error);}}});});
 const first=await browser();first.click('#global-menu');first.set('#global-content-input','自动写入 HTML <script>纯文字</script>\n第二行');
 await wait(()=>saved(first)&&disk().model.globalContent===first.$('#global-content-input').value);
 assert.equal(first.downloads.length,0);assert.equal(first.$('#save-html').hidden,true);
 const second=await browser();second.click('#global-menu');assert.equal(second.$('#global-content-input').value,disk().model.globalContent);
 assert.equal(second.cache()?.cacheReview.pending.length||0,0);
 checks.push('real_file_write_and_independent_browser_reopen_without_cached_state');

 selectElement(second,'刷新后继续填写的说明草稿');
 await wait(()=>saved(second)&&JSON.stringify(disk().model.drafts).includes('刷新后继续填写的说明草稿'));
 const refreshed=await browser();assert.equal(refreshed.$('#note-body').value,'刷新后继续填写的说明草稿');
 refreshed.submit('#note-form');
 assert.ok(!/连接工作文件|选择.*文件|启用自动保存/.test(refreshed.$('#toast').textContent));
 await wait(()=>saved(refreshed)&&disk().model.notes.some(n=>n.body==='刷新后继续填写的说明草稿'));
 const note=disk().model.notes.find(n=>n.body==='刷新后继续填写的说明草稿');
 const other=await browser();assert.ok(other.$('#note-'+note.id).textContent.includes(note.body));
 other.click('#note-'+note.id+' [data-note-edit]');other.set('#note-body','换浏览器后原位编辑');other.submit('#note-form');
 await wait(()=>saved(other)&&disk().model.notes.find(n=>n.id===note.id)?.body==='换浏览器后原位编辑');
 const final=await browser();assert.ok(final.$('#note-'+note.id).textContent.includes('换浏览器后原位编辑'));
 assert.equal(disk().artifactId,parse(source).artifactId);assert.equal(disk().snapshotId,parse(source).snapshotId);
 const withoutData=html=>html.replace(/(<script\b[^>]*\bid="prototype-data"[^>]*>)[\s\S]*?(<\/script>)/,'$1$2');
 assert.equal(withoutData(fs.readFileSync(filename,'utf8')),withoutData(source));
 checks.push('draft_refresh_annotation_submit_inline_edit_and_browser_switch_preserve_source');

 const exported=(await final.download('#export-html')).text,viewer=open(exported);
 assert.equal(parse(exported).readOnly,true);assert.equal(viewer.d.querySelector('#save-html'),null);
 assert.ok(!exported.includes('id="workbench-local-save"'));assert.ok(viewer.d.body.textContent.includes('换浏览器后原位编辑'));
 assert.equal(viewer.d.querySelector('[data-note-edit]'),null);
 checks.push('manual_readonly_export_contains_latest_text_without_save_connection');

 const before=fs.readFileSync(filename,'utf8');first.set('#global-content-input','旧窗口未提交的新文字');
 await wait(()=>first.$('#file-save-indicator').textContent.includes('保存失败'));
 assert.equal(fs.readFileSync(filename,'utf8'),before);
 assert.equal(parse((await first.download('#save-work')).text).model.globalContent,'旧窗口未提交的新文字');
 checks.push('stale_browser_keeps_edits_and_cannot_overwrite_newer_file');

 const offline=open(source);let choices=0;offline.w.showOpenFilePicker=async()=>{choices++;throw new Error('No file picker');};
 assert.equal(offline.d.querySelector('#save-html'),null);
 offline.w.dispatchEvent(new offline.w.KeyboardEvent('keydown',{key:'s',ctrlKey:true,bubbles:true,cancelable:true}));
 assert.equal(choices,0);assert.equal(offline.downloads.length,0);assert.equal(offline.d.querySelector('#choose-work-file'),null);
 assert.ok(offline.$('#file-save-indicator').textContent.includes('未写入'));
 checks.push('offline_path_never_opens_a_picker_or_claims_disk_save');

 const a=open(),b=open();a.click('#global-menu');b.click('#global-menu');a.set('#global-content-input','窗口 A 新正文');
 for(let i=0;i<a.w.localStorage.length;i++){const key=a.w.localStorage.key(i);b.w.localStorage.setItem(key,a.w.localStorage.getItem(key));}
 b.click('[data-prd-document="tracking"]');b.set('#tracking-content-input','窗口 B 新埋点');
 assert.equal(b.cache().model.globalContent,'窗口 A 新正文');assert.equal(b.cache().model.trackingContent,'窗口 B 新埋点');
 const same=open();same.click('#global-menu');same.set('#global-content-input','冲突前');
 const rival=structuredClone(same.cache());rival.model.globalContent='另一个窗口的版本';rival.writer='other-window';same.w.localStorage.setItem(same.key,JSON.stringify(rival));
 same.set('#global-content-input','本窗口的版本');assert.ok(same.cache().cacheReview.pending.length>0);assert.ok(JSON.stringify(same.cache().cacheReview).includes('另一个窗口的版本'));
 checks.push('stale_tab_merges_independent_text_and_preserves_conflicting_versions');
 const tabA=open(),tabB=open();selectElement(tabB,'窗口 B 同时新增的说明');selectElement(tabA,'窗口 A 同时新增的说明');tabA.submit('#note-form');
 tabB.w.localStorage.setItem(tabB.key,tabA.w.localStorage.getItem(tabA.key));tabB.submit('#note-form');
 const simultaneous=tabB.cache().model.notes;assert.ok(simultaneous.some(n=>n.body==='窗口 A 同时新增的说明'));assert.ok(simultaneous.some(n=>n.body==='窗口 B 同时新增的说明'));
 assert.equal(new Set(simultaneous.map(n=>n.id)).size,simultaneous.length);
 checks.push('concurrent_new_note_ids_keep_both_annotations');

 await stop();final.click('#global-menu');final.set('#global-content-input','保存服务断开后保留此文字');
 await wait(()=>final.$('#file-save-indicator').textContent.includes('保存失败'));
 assert.equal(final.$('#global-content-input').value,'保存服务断开后保留此文字');assert.notEqual(disk().model.globalContent,final.$('#global-content-input').value);
 const leave=new final.w.Event('beforeunload',{cancelable:true});final.w.dispatchEvent(leave);assert.equal(leave.defaultPrevented,true);
 checks.push('service_failure_preserves_input_and_warns_before_close');
 for(const run of runs)assert.deepEqual(run.errors,[]);
 console.log(JSON.stringify({ok:true,checks,limits:['Real HTTP and disk; isolated JSDOM stores represent separate browsers. Visual browser verification is separate.']},null,2));
}finally{runs.forEach(r=>r.close());await stop();fs.rmSync(directory,{recursive:true,force:true});}})().catch(error=>{console.error(error.stack);process.exitCode=1;});
