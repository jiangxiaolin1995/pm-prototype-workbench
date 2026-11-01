#!/usr/bin/env node
// Same-file update versus browser edits; only isolated localStorage is used.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {parse,embed,boot}=require('./test_support.cjs');
const args=process.argv.slice(2);let modulePath;
if(args.length){assert.equal(args.shift(),'--jsdom');modulePath=args.shift();assert.ok(modulePath);assert.equal(args.length,0);}
const source=fs.readFileSync(path.join(__dirname,'../assets/workbench.html'),'utf8');
const runs=[],checks=[];
const open=(html,cache)=>{const r=boot(html,cache,modulePath);runs.push(r);return r;};
async function main(){try{
 const old=open(source);old.click('#global-menu');old.set('#global-content-input','用户手写正文');
 const current=parse(source);current.model.dataRequirements='文件中明确更新的数据要求';
 const updated=open(embed(source,current),old.cache());
 updated.click('[data-prd-document="data"]');assert.equal(updated.$('#data-requirements-input').value,'文件中明确更新的数据要求','Old cache must not replace an updated field in the same file');
 updated.click('#global-menu');assert.equal(updated.$('#global-content-input').value,'用户手写正文','Independent browser writing must survive');
 checks.push('same_identity_file_update_and_independent_user_text_both_survive');
 const conflictSeed=parse(source);conflictSeed.model.globalContent='文件明确修改后的正文';
 const conflict=open(embed(source,conflictSeed),old.cache());conflict.click('#global-menu');
 assert.equal(conflict.$('#global-content-input').value,'用户手写正文');
 assert.equal(conflict.$('#cache-review').hidden,false);assert.ok(conflict.$('#cache-review').textContent.includes('文件明确修改后的正文'));
 const downloads=conflict.downloads.length;conflict.click('#export-html');assert.equal(conflict.downloads.length,downloads);
 const pendingCopy=await conflict.download('#save-work');assert.equal(parse(pendingCopy.text).cacheReview.pending.length,1);
 const portable=open(pendingCopy.text);assert.equal(portable.$('#cache-review').hidden,false);
 conflict.click('[data-cache-side="file"]');assert.equal(conflict.$('#global-content-input').value,'文件明确修改后的正文');
 const reopened=open(embed(source,conflictSeed),conflict.cache());reopened.click('#global-menu');assert.equal(reopened.$('#global-content-input').value,'文件明确修改后的正文');assert.equal(reopened.$('#cache-review').hidden,true);
 assert.equal(reopened.cache()?.cacheReview?.pending?.length||0,0);
 assert.ok(conflict.cache().cacheReview.resolved[0].browser.value==='用户手写正文');
 checks.push('same_field_conflict_preserves_both_blocks_delivery_resolves_and_roundtrips');
 const authored=parse(source);authored.model.globalContent='原文';const cleared=open(embed(source,authored));cleared.click('#global-menu');cleared.set('#global-content-input','');
 const next=structuredClone(authored);next.model.trackingContent='明确提供的埋点';const keepClear=open(embed(source,next),cleared.cache());keepClear.click('#global-menu');assert.equal(keepClear.$('#global-content-input').value,'');
 checks.push('intentional_user_deletion_is_not_refilled');
 const base=parse(source);base.model.data={items:[{id:'a',value:1},{id:'b',value:2}]};
 const browser=structuredClone(base.model);browser.data.items[0].value=8;browser.data.items.push({id:'browser',value:3});
 const disk=structuredClone(base);disk.model.data.items[1].value=9;disk.model.data.items.push({id:'file',value:4});disk.pages['page-2']={...disk.pages['page-1'],name:'第二页'};disk.model.views['page-2']={scene:'default'};disk.navigation.pageScopes['page-2']={...disk.navigation.pageScopes['page-1']};
 const merge=open(embed(source,disk),{model:browser,baseModel:base.model});merge.click('#global-menu');merge.set('#global-content-input','保留合并结果');
 assert.deepEqual(merge.cache().model.data.items,[{id:'a',value:8},{id:'b',value:9},{id:'file',value:4},{id:'browser',value:3}]);assert.ok(merge.d.querySelector('#nav-page-page-2'));assert.equal(merge.$('#cache-review').hidden,true);
 checks.push('stable_record_ids_and_new_file_pages_merge_without_resetting_identity');
 const legacy=structuredClone(parse(source).model);legacy.globalContent='旧缓存用户文字';legacy.data={changed:'来自旧缓存'};
 const legacyFile=parse(source);legacyFile.model.data={changed:'来自文件更新'};
 const migrated=open(embed(source,legacyFile),{model:legacy});migrated.click('#global-menu');assert.equal(migrated.$('#global-content-input').value,'旧缓存用户文字');assert.equal(migrated.$('#cache-review').hidden,false);assert.ok(migrated.$('#cache-review').textContent.includes('来自旧缓存'));
 const viewerSeed={...conflictSeed,readOnly:true};const viewer=open(embed(source,viewerSeed),{model:legacy});viewer.click('#global-menu');assert.equal(viewer.$('#global-content-text').textContent,'文件明确修改后的正文');assert.equal(viewer.$('#cache-review').hidden,true);
 checks.push('legacy_without_baseline_is_not_blindly_applied_and_readonly_uses_file');
 for(const r of runs)assert.deepEqual(r.errors,[]);
 assert.deepEqual(updated.errors,[]);
 console.log(JSON.stringify({ok:true,checks},null,2));
}finally{runs.forEach(r=>r.close());}}
main().catch(error=>{console.error(error);process.exitCode=1;});
