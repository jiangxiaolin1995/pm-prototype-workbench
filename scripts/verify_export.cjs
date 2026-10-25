#!/usr/bin/env node
// Runs the work page's actual export handler in isolated DOMs; never edits the input HTML.
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const {pathToFileURL} = require('node:url');

async function main() {
  const args = process.argv.slice(2);
  const input = args.shift();
  let jsdomPath, output;
  while (args.length) {
    const flag = args.shift(), value = args.shift();
    if (!value) throw new Error('Missing value for ' + flag);
    if (flag === '--jsdom') jsdomPath = path.resolve(value);
    else if (flag === '--output') output = path.resolve(value);
    else throw new Error('Unknown option: ' + flag);
  }
  if (!input) throw new Error('Usage: node verify_export.cjs working.html [--jsdom module-path] [--output verification.html]');
  if (output && fs.existsSync(output)) throw new Error('Verification output already exists; choose a new path.');
  let modulePath;
  try { modulePath = jsdomPath || require.resolve('jsdom', {paths: [process.cwd(), __dirname]}); }
  catch { throw new Error('jsdom is needed only for verification; pass --jsdom with an existing installed module path.'); }
  const {JSDOM, VirtualConsole} = require(modulePath);
  const source = fs.readFileSync(input, 'utf8');
  const parseSeed = markup => {
    const match = markup.match(/id="prototype-data">([\s\S]*?)<\/script>/);
    assert.ok(match, 'Missing embedded prototype-data');
    return JSON.parse(match[1]);
  };
  const seed = parseSeed(source), runtimes = [], checks = [];
  const clone = value => JSON.parse(JSON.stringify(value));
  function boot(markup, cache = {}, url = 'https://prototype-verification.test/') {
    const errors = [], vc = new VirtualConsole();
    vc.on('jsdomError', error => errors.push(error.message));
    let blob;
    const dom = new JSDOM(markup, {url, runScripts: 'dangerously', pretendToBeVisual: true, virtualConsole: vc, beforeParse(w) {
      w.confirm = () => true;
      w.HTMLElement.prototype.scrollIntoView = function () {};
      // Geometry stub lets floating marker logic run; this is not a layout test.
      w.HTMLElement.prototype.getClientRects = function () { return this.closest('[hidden]') ? [] : [this.getBoundingClientRect()]; };
      w.HTMLElement.prototype.getBoundingClientRect = function () { return {left:0,top:0,right:800,bottom:600,width:800,height:600,x:0,y:0}; };
      w.URL.createObjectURL = value => (blob = value, 'blob:verification');
      w.URL.revokeObjectURL = () => {};
      w.HTMLAnchorElement.prototype.click = function () {};
      for (const [key, value] of Object.entries(cache)) w.localStorage.setItem(key, value);
    }});
    const w = dom.window, d = w.document;
    const $ = selector => { const node = d.querySelector(selector); assert.ok(node, 'Missing ' + selector); return node; };
    const click = selector => {$(selector).click();};
    const set = (selector, value, event = 'input') => { $(selector).value = value; $(selector).dispatchEvent(new w.Event(event, {bubbles: true})); };
    const submit = selector => $(selector).dispatchEvent(new w.Event('submit', {bubbles: true, cancelable: true}));
    const runtime = {w, d, $, click, set, submit, errors, async exportHTML() {
      blob = undefined; click('#export-html'); assert.ok(blob, 'Export did not create a file');
      return new Promise((resolve, reject) => { const reader = new w.FileReader(); reader.onload = () => resolve(reader.result); reader.onerror = reject; reader.readAsText(blob); });
    }};
    runtimes.push(runtime);
    return runtime;
  }
  const checkReadOnly = runtime => {
    assert.ok(runtime.d.querySelector('#readonly-badge'));
    assert.equal(runtime.d.querySelectorAll('[data-mode=annotate],#pick-note,[data-global-note],#export-html,#export-md,#note-form,.note-controls').length, 0);
    assert.equal(runtime.d.querySelectorAll('.sidebar button,.sidebar input,.sidebar textarea,.sidebar select,.sidebar a,.sidebar details,.sidebar [contenteditable=true]').length, 0);
  };
  function checkHierarchyBadges(runtime) {
    assert.equal(runtime.d.querySelectorAll('#hidden-notes,#hidden-note-links').length,0,'Hidden notes belong to their opening button');
    for (const badge of runtime.d.querySelectorAll('[data-note-entry]')) {
      const ids=badge.dataset.noteChildren.split(',').map(Number);
      assert.equal(new Set(ids).size,ids.length);
      assert.equal(badge.textContent,String(ids.length),'Descendant badge is a count, not a new note ID');
      const shipped=JSON.parse(runtime.$('#prototype-data').textContent).model.notes;
      assert.ok(ids.every(id=>shipped.some(n=>n.id===id)));
      assert.ok([...runtime.d.querySelectorAll('#prototype [data-anchor]')].some(el=>el.dataset.anchor===badge.dataset.noteEntry));
      assert.ok(badge.getAttribute('aria-label')&&badge.title,'Explain count on hover and to assistive technology');
    }
  }
  function checkHighlights(runtime) {
    const candidates = seed.model.notes.filter(n => n.page === seed.model.activePage && runtime.d.querySelector('#prototype [data-anchor="' + n.anchor + '"]'));
    assert.ok(candidates.length >= 2, 'Need two initially visible notes to verify linked highlights');
    const [first, second] = candidates;
    const fields = () => ({fields:[...runtime.d.querySelectorAll('#prototype input,#prototype textarea,#prototype select')].map(n => [n.id,n.value,n.checked,n.disabled]),dialogs:[...runtime.d.querySelectorAll('#prototype [role=dialog]')].map(n=>[n.id,!!n.closest('[hidden]')])});
    const field = [...runtime.d.querySelectorAll('#prototype input:not(:disabled):not([type=checkbox])')].find(n => !n.closest('[hidden]'));
    const previous = field?.value;
    if (field) runtime.set('#' + field.id, '尚未提交的输入');
    const before = fields();
    const selected = n => {
      assert.equal(runtime.$('#locate-note').value, String(n.id));
      assert.ok(runtime.$('#note-' + n.id).classList.contains('note-selected'), 'Right note not highlighted');
      assert.equal(runtime.$('#prototype .selected-target').dataset.anchor, n.anchor, 'Wrong prototype position');
    };
    runtime.click('#note-' + second.id + ' .note-body'); selected(second);
    runtime.click('#prototype [data-note-locate="' + first.id + '"]'); selected(first);
    runtime.$('#note-' + second.id + ' [data-note-locate]').dispatchEvent(new runtime.w.KeyboardEvent('keydown', {key:'Enter',bubbles:true,cancelable:true})); selected(second);
    runtime.$('#prototype [data-note-locate="' + first.id + '"]').dispatchEvent(new runtime.w.KeyboardEvent('keydown', {key:' ',bubbles:true,cancelable:true})); selected(first);
    assert.deepEqual(fields(), before, 'Highlight navigation changed business fields');
    if (field) runtime.set('#' + field.id, previous);
  }
  function checkFrameActivation(runtime) {
    const candidates=seed.model.notes.filter(n=>n.page===seed.model.activePage&&runtime.d.querySelector('[data-note-frame="'+n.id+'"]'));
    const first=candidates.find(n=>runtime.d.querySelector('#prototype [data-anchor="'+n.anchor+'"] input:not(:disabled):not([type=checkbox])'));
    assert.ok(first,'Need a marked region containing an input');
    const second=candidates.find(n=>n.id!==first.id);
    const fields=()=>[...runtime.d.querySelectorAll('#prototype input,#prototype textarea,#prototype select')].map(el=>[el.id,el.value,el.checked]);
    const dialogs=()=>[...runtime.d.querySelectorAll('#prototype [role=dialog]')].map(el=>[el.id,!!el.closest('[hidden]')]);
    const before=fields(),beforeDialogs=dialogs();
    runtime.click('[data-note-frame="'+second.id+'"] [data-note-frame-hit]');
    assert.ok(runtime.$('#note-'+second.id).classList.contains('note-selected'),'Clicking a frame edge must highlight its note');
    assert.deepEqual(dialogs(),beforeDialogs,'Frame edge accidentally activated its business control');
    const region=runtime.$('#prototype [data-anchor="'+first.anchor+'"]');
    region.dispatchEvent(new runtime.w.MouseEvent('click',{bubbles:true,cancelable:true}));
    assert.ok(runtime.$('#note-'+first.id).classList.contains('note-selected'),'Clicking a marked region must highlight its closest matching note');
    const input=region.querySelector('input:not(:disabled):not([type=checkbox])');
    input.focus();let delivered=0;input.addEventListener('click',()=>delivered++,{once:true});
    const event=new runtime.w.MouseEvent('click',{bubbles:true,cancelable:true});input.dispatchEvent(event);
    assert.equal(delivered,1,'Region highlighting swallowed the input click');
    assert.equal(event.defaultPrevented,false,'Region highlighting blocked a business event');
    assert.equal(runtime.d.activeElement,input,'Region highlighting changed input focus');
    assert.equal(runtime.d.getElementById(input.id),input,'Region highlighting rebuilt the input');
    assert.deepEqual(fields(),before,'Region highlighting changed field values');
    runtime.click('#prototype [data-note-locate="'+second.id+'"]');
    runtime.click('#toggle-annotation-frames');
    region.dispatchEvent(new runtime.w.MouseEvent('click',{bubbles:true,cancelable:true}));
    assert.ok(runtime.$('#note-'+second.id).classList.contains('note-selected'),'Hidden frames should not leave invisible annotation hit areas');
    runtime.click('#toggle-annotation-frames');
  }
  function checkFrames(runtime) {
    const toggle=runtime.$('#toggle-annotation-frames');
    assert.equal(toggle.getAttribute('aria-checked'),'true','Annotation frames must be on when a file opens');
    const frames=[...runtime.d.querySelectorAll('[data-note-frame]')];
    assert.ok(frames.length>=2,'Visible annotations need default frames');
    const colors=frames.map(frame=>{
      const id=frame.dataset.noteFrame,color=frame.style.getPropertyValue('--note-color');
      assert.ok(color,'Frame has no annotation color');
      assert.equal(runtime.$('#note-'+id).style.getPropertyValue('--note-color'),color,'Right number color differs');
      assert.equal(runtime.$('#prototype [data-note-locate="'+id+'"]').style.getPropertyValue('--note-color'),color,'Pin color differs');
      return color;
    });
    assert.equal(new Set(colors).size,colors.length,'Different annotation IDs reuse a color');
    const before=[...runtime.d.querySelectorAll('#prototype input,#prototype textarea,#prototype select')].map(el=>[el.id,el.value,el.checked]);
    const text=runtime.$('#notes-slot').textContent;
    runtime.click('#toggle-annotation-frames');
    assert.equal(toggle.getAttribute('aria-checked'),'false');
    assert.ok(runtime.$('#prototype').classList.contains('annotation-frames-hidden'));
    assert.ok([...runtime.d.querySelectorAll('[data-note-frame]')].every(el=>runtime.w.getComputedStyle(el).display==='none'));
    assert.equal(runtime.$('#notes-slot').textContent,text,'Hiding frames changed the notes');
    assert.deepEqual([...runtime.d.querySelectorAll('#prototype input,#prototype textarea,#prototype select')].map(el=>[el.id,el.value,el.checked]),before,'Frame toggle changed business fields');
    for(const frame of frames){const pin=runtime.$('#prototype [data-note-locate="'+frame.dataset.noteFrame+'"]');assert.notEqual(runtime.w.getComputedStyle(pin).display,'none');}
    runtime.click('#note-'+frames[0].dataset.noteFrame+' .note-body');
    assert.ok(runtime.$('#prototype').classList.contains('annotation-frames-hidden'),'Locating a note turned frames back on');
    const visibleFrames=()=>[...runtime.d.querySelectorAll('[data-note-frame]')].filter(el=>runtime.w.getComputedStyle(el).display!=='none').map(el=>el.dataset.noteFrame);
    assert.deepEqual(visibleFrames(),[frames[0].dataset.noteFrame],'Hidden mode must reveal only the located note frame');
    runtime.click('#prototype [data-note-locate="'+frames[1].dataset.noteFrame+'"]');
    assert.ok(runtime.$('#note-'+frames[1].dataset.noteFrame).classList.contains('note-selected'));
    assert.deepEqual(visibleFrames(),[frames[1].dataset.noteFrame],'Clicking a different number must replace the temporary frame');
    assert.equal(toggle.getAttribute('aria-checked'),'false','Revealing one frame changed the global switch');
    runtime.$('#prototype [data-note-locate="'+frames[0].dataset.noteFrame+'"]').dispatchEvent(new runtime.w.KeyboardEvent('keydown',{key:'Enter',bubbles:true,cancelable:true}));
    assert.deepEqual(visibleFrames(),[frames[0].dataset.noteFrame],'Keyboard location must reveal its frame too');
    assert.deepEqual([...runtime.d.querySelectorAll('#prototype input,#prototype textarea,#prototype select')].map(el=>[el.id,el.value,el.checked]),before,'Temporary frame changed business inputs');
    runtime.click('#toggle-annotation-frames');
    assert.equal(toggle.getAttribute('aria-checked'),'true');
    assert.ok([...runtime.d.querySelectorAll('[data-note-frame]')].every(el=>runtime.w.getComputedStyle(el).display!=='none'));
    runtime.click('#toggle-annotation-frames');
    assert.deepEqual(visibleFrames(),[],'Turning frames off must hide the previous temporary selection');
  }
  try {
    assert.equal(seed.readOnly, false, 'Input must be the editable working file');
    assert.ok(seed.projectTitle, 'Missing projectTitle; initialize with this skill or preserve project metadata');
    const work = boot(source);
    assert.ok(work.d.querySelector('.directory'));
    assert.ok(work.d.querySelector('#prototype'));
    assert.ok(work.d.querySelector('.sidebar'));
    assert.equal(work.d.querySelectorAll('script[src],link[rel=stylesheet][href],iframe[src]').length, 0, 'External document/script/styles are not standalone');
    const pageIds = [...work.d.querySelectorAll('#directory-items [data-page]')].map(node=>node.dataset.page);
    assert.ok(pageIds.length, 'No requirement pages');
    const activePage = seed.model.activePage;
    checkHierarchyBadges(work); checks.push('work_uses_parent_button_badges_for_descendants');
    checkHighlights(work); checks.push('work_marker_and_text_click_keyboard_preserve_inputs');
    checkFrameActivation(work); checks.push('work_frame_edge_and_region_click_preserve_business_events');
    checkFrames(work); checks.push('work_colored_frames_default_toggle_and_number_matching');
    const productId=work.$('[data-page="'+activePage+'"]').closest('[data-product]').dataset.product;
    const globalText = {product:'本菜单全局文字\n第二行',workspace:'全局 </script><script>window.__skillInjected=true</script> & "'};
    assert.equal(work.d.querySelectorAll('.preview-header [data-global-slot],.sidebar [data-global-slot]').length,0);
    work.click('[data-product-global="'+productId+'"]');work.set('#product-global-input',globalText.product);
    work.click('#global-menu');work.set('#global-content-input',globalText.workspace);
    for (const pageId of pageIds) work.click('[data-page="'+pageId+'"]');
    work.click('[data-page="'+activePage+'"]');work.click('[data-product-global="'+productId+'"]');
    assert.equal(work.$('#product-global-input').value,globalText.product);
    work.click('#global-menu');assert.equal(work.$('#global-content-input').value,globalText.workspace);
    work.click('[data-page="'+activePage+'"]');
    checks.push('product_and_workspace_text_survive_all_page_changes');
    const anchor = [...work.d.querySelectorAll('#prototype [data-anchor]')].find(node => !node.querySelector('[data-anchor]'));
    assert.ok(anchor, 'No precise annotation targets'); work.click('#pick-note'); anchor.click();
    assert.equal(work.$('#pick-note').getAttribute('aria-pressed'),'false','Target picking must end after one click');
    assert.equal(work.d.querySelectorAll('#note-form input,#note-form textarea,#note-form select').length, 1);
    const noteText = '验证说明：保留完整文字 </script><script>window.__skillInjected=true</script> & "';
    work.set('#note-body', noteText); work.submit('#note-form');
    const noteId = work.$('#locate-note').value;
    assert.ok(noteId, 'Saved note has no stable ID');
    checks.push('three_panes_and_one_field_annotation');
    assert.equal(work.d.querySelector('[data-mode]'),null);
    assert.ok(work.$('[data-note-edit="'+noteId+'"]'));
    assert.equal(work.d.querySelector('[data-global-slot=directory]'),null);
    const exported = await work.exportHTML(), payload = parseSeed(exported);
    assert.equal(payload.readOnly, true);
    assert.equal(payload.projectTitle, seed.projectTitle, 'Export lost project identity');
    assert.equal(payload.artifactId, seed.artifactId);
    assert.notEqual(payload.snapshotId, seed.snapshotId);
    if (seed.navigation) {
      assert.deepEqual(payload.navigation, seed.navigation, 'Export lost product/platform identity');
      checks.push('export_preserves_product_platform_page_mapping');
    }
    assert.deepEqual(payload.model.drafts, {});
    assert.deepEqual(payload.model.data, seed.model.data, 'Annotation changed or omitted business data');
    assert.ok(payload.model.notes.some(note => String(note.id) === noteId && note.body === noteText));
    checks.push('actual_export_includes_project_data_and_notes');
    assert.equal(payload.model.productGlobalContent[productId],globalText.product);assert.equal(payload.model.globalContent,globalText.workspace);
    assert.equal(payload.model.globalNotes.directory,seed.model.globalNotes?.directory||'','Legacy directory text is retained in the model');
    const viewer = boot(exported); checkReadOnly(viewer);
    viewer.click('[data-product-global="'+productId+'"]');assert.equal(viewer.$('#product-global-text').textContent,globalText.product);
    viewer.click('#global-menu');assert.equal(viewer.$('#global-content-text').textContent,globalText.workspace);
    assert.equal(viewer.w.__skillInjected,undefined);
    viewer.click('[data-page="'+activePage+'"]');
    checks.push('export_global_text_is_read_only_and_escaped');
    checkHierarchyBadges(viewer); checks.push('export_keeps_parent_button_hierarchy_badges');
    checkHighlights(viewer); checks.push('export_marker_and_text_click_keyboard_preserve_inputs');
    checkFrameActivation(viewer); checks.push('export_frame_edge_and_region_click_preserve_business_events');
    checkFrames(viewer); checks.push('export_frames_default_on_with_matching_colors_and_view_toggle');
    assert.ok(viewer.d.title.includes(seed.projectTitle), 'Export document title lost project name');
    for (const pageId of pageIds) {
      viewer.click('[data-page="' + pageId + '"]'); checkReadOnly(viewer);
      const states = [...viewer.d.querySelectorAll('[data-scene]')].map(node => node.dataset.scene);
      for (const scene of states) { viewer.click('[data-scene="' + scene + '"]'); checkReadOnly(viewer); }
    }
    checks.push('all_pages_and_scenes_read_only');
    viewer.click('[data-page="' + activePage + '"]');
    viewer.set('#locate-note', noteId, 'change');
    assert.ok(viewer.d.querySelector('#prototype .selected-target'), 'Export cannot locate saved note');
    assert.equal(viewer.$('#note-' + noteId + ' .note-body').textContent, noteText);
    assert.equal(viewer.w.__skillInjected, undefined);
    assert.equal(viewer.d.querySelectorAll('script').length, work.d.querySelectorAll('script').length);
    checks.push('exported_note_location_and_literal_text');
    work.click('[data-note-edit="' + noteId + '"]');
    work.set('#note-body', '导出后工作网页仍可继续编辑'); work.submit('#note-form');
    assert.equal(work.$('#note-' + noteId + ' .note-body').textContent, '导出后工作网页仍可继续编辑');
    checks.push('author_remains_editable_after_export');
    const oldModel = clone(payload.model);
    oldModel.notes[0].body = '过期缓存内容';
    oldModel.globalNotes = {directory:'旧目录',prototype:'旧原型',notes:'旧说明'};oldModel.globalContent='过期全局';oldModel.productGlobalContent[productId]='过期菜单正文';
    oldModel.drafts[activePage] = {dirty: true, values: {body: '过期草稿'}};
    const cacheKey = 'prototype-viewer:v3:' + payload.artifactId + ':' + payload.snapshotId;
    const reopened = boot(exported, {[cacheKey]: JSON.stringify({model: oldModel})});
    reopened.click('[data-page="' + payload.model.notes[0].page + '"]');
    assert.equal(reopened.$('#note-' + payload.model.notes[0].id + ' .note-body').textContent, payload.model.notes[0].body);
    reopened.click('[data-page="'+activePage+'"]');reopened.click('[data-product-global="'+productId+'"]');assert.equal(reopened.$('#product-global-text').textContent,globalText.product);reopened.click('#global-menu');assert.equal(reopened.$('#global-content-text').textContent,globalText.workspace);
    checkReadOnly(reopened); checks.push('reopen_uses_shipped_notes_without_edit_drafts');
    const local = boot(exported, {}, pathToFileURL(path.resolve(input)).href);
    checkReadOnly(local); checks.push('file_url_script_without_local_storage');
    for (const runtime of runtimes) assert.deepEqual(runtime.errors, [], 'Runtime errors');
    if (output) { fs.mkdirSync(path.dirname(output), {recursive: true}); fs.writeFileSync(output, exported, {flag: 'wx'}); }
    console.log(JSON.stringify({ok: true, pages: pageIds.length, checks, verificationOutput: output || null}, null, 2));
  } finally {
    await new Promise(resolve => setImmediate(resolve));
    for (const runtime of runtimes) runtime.w.close();
  }
}
main().catch(error => { console.error(error.message); process.exitCode = 1; });
