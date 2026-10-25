#!/usr/bin/env node
// Exercises the bundled template with multiple products and identically named pages.
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');

async function main() {
  const args = process.argv.slice(2);
  let modulePath, output;
  while (args.length) {
    const flag = args.shift(), value = args.shift();
    if (!value) throw new Error('Missing value for ' + flag);
    if (flag === '--jsdom') modulePath = path.resolve(value);
    else if (flag === '--output') output = path.resolve(value);
    else throw new Error('Unknown option: ' + flag);
  }
  const {JSDOM, VirtualConsole} = require(modulePath || require.resolve('jsdom', {paths: [process.cwd(), __dirname]}));
  const template = fs.readFileSync(path.join(__dirname, '../assets/workbench.html'), 'utf8');
  const parse = html => JSON.parse(html.match(/id="prototype-data">([\s\S]*?)<\/script>/)[1]);
  const encode = value => JSON.stringify(value).replace(/</g, '\\u003c').replace(/>/g, '\\u003e').replace(/&/g, '\\u0026');
  const embed = (html, seed) => html.replace(/(id="prototype-data">)[\s\S]*?(<\/script>)/, (_, a, b) => a + encode(seed) + b);
  const clone = value => JSON.parse(JSON.stringify(value));
  const seed = parse(template);
  seed.projectTitle = '多产品归属验证';
  seed.navigation = {
    products: {a: {name: 'A 产品'}, b: {name: 'B 产品'}},
    platforms: {cms: {name: 'CMS'}, front: {name: '前台'}},
    pageScopes: {
      channels: {product: 'a', platform: 'cms'},
      tags: {product: 'a', platform: 'cms'},
      comments: {product: 'b', platform: 'cms'},
      words: {product: 'a', platform: 'front'}
    }
  };
  seed.model.notes.forEach(note => note.requirement = 'channels');
  // Only the verification copy changes labels and grouping; business renderers stay intact.
  let fixture = template.replace(/const requirements=\[[\s\S]*?\];/, "const requirements=[{id:'channels',name:'跨产品调整',code:'REQ-01',scope:'',boundary:''}];");
  fixture = fixture.replace("comments:{req:'moderation',name:'审核列表'", "comments:{req:'channels',name:'渠道列表'");
  fixture = fixture.replace("words:{req:'moderation',name:'违禁词配置'", "words:{req:'channels',name:'首页'");
  fixture = embed(fixture, seed);
  const runtimes = [], checks = [];
  function boot(html, cache) {
    const errors = [], vc = new VirtualConsole();
    vc.on('jsdomError', error => errors.push(error.message));
    let blob;
    const dom = new JSDOM(html, {url: 'https://scope-verification.test/', runScripts: 'dangerously', pretendToBeVisual: true, virtualConsole: vc, beforeParse(w) {
      w.confirm = () => true;
      w.HTMLElement.prototype.scrollIntoView = function () {};
      w.HTMLElement.prototype.getClientRects = function () { return this.closest('[hidden]') ? [] : [this.getBoundingClientRect()]; };
      w.HTMLElement.prototype.getBoundingClientRect = function () { return {left:0,top:0,right:800,bottom:600,width:800,height:600,x:0,y:0}; };
      w.URL.createObjectURL = value => (blob = value, 'blob:scope-verification');
      w.URL.revokeObjectURL = () => {};
      w.HTMLAnchorElement.prototype.click = function () {};
      if (cache) w.localStorage.setItem('prototype-workbench:v3:' + seed.artifactId + ':' + seed.snapshotId, JSON.stringify({model: cache}));
    }});
    const w = dom.window, d = w.document;
    const $ = selector => { const el = d.querySelector(selector); assert.ok(el, 'Missing ' + selector); return el; };
    const runtime = {w, d, $, errors,
      click: selector => {$(selector).click();},
      set(selector, value) { $(selector).value = value; $(selector).dispatchEvent(new w.Event('input', {bubbles:true})); },
      submit: selector => $(selector).dispatchEvent(new w.Event('submit', {bubbles:true,cancelable:true})),
      async exportHTML() {
        blob = undefined; $('#export-html').click(); assert.ok(blob, 'Actual export produced no file');
        return new Promise((resolve, reject) => { const reader = new w.FileReader(); reader.onload = () => resolve(reader.result); reader.onerror = reject; reader.readAsText(blob); });
      }
    };
    runtimes.push(runtime); return runtime;
  }
  function checkScope(runtime, id, expected) {
    runtime.click('[data-page="' + id + '"]');
    assert.equal(runtime.$('#current-product').textContent, expected[0]);
    assert.equal(runtime.$('#current-platform').textContent, expected[1]);
    for (const label of expected) {
      assert.ok(runtime.$('#current-context').textContent.includes(label), 'Current header loses scope');
      assert.ok(runtime.$('#scope-name').textContent.includes(label), 'Right notes lose scope');
    }
    const button = runtime.$('[data-page="' + id + '"]');
    assert.equal(button.getAttribute('aria-current'), 'page');
    for (const label of expected) assert.ok(button.getAttribute('aria-label').includes(label), 'Navigation accessible name is ambiguous');
    assert.equal(runtime.d.querySelectorAll('.product-group.is-current').length, 1);
  }
  const expected = {channels:['A 产品','CMS','渠道列表'], tags:['A 产品','CMS','标签配置'], comments:['B 产品','CMS','渠道列表'], words:['A 产品','前台','首页']};
  try {
    const work = boot(fixture);
    assert.equal(work.d.querySelectorAll('.product-group').length, 2, 'One product must have one parent group across its surfaces');
    for (const [id, labels] of Object.entries(expected)) checkScope(work, id, labels);
    for(const menu of [...work.d.querySelectorAll('[data-product-global]')]){
      const id=menu.dataset.productGlobal,expectedText=menu.getAttribute('aria-label')+' 专属说明';
      work.click('[data-product-global="'+id+'"]');assert.equal(work.$('#product-global-input').value,'');work.set('#product-global-input',expectedText);
      assert.equal(work.d.querySelector('#page-tabs'),null);
    }
    for(const menu of [...work.d.querySelectorAll('[data-product-global]')]){work.click('[data-product-global="'+menu.dataset.productGlobal+'"]');assert.equal(work.$('#product-global-input').value,menu.getAttribute('aria-label')+' 专属说明');}

    checks.push('two_products_three_surfaces_and_matching_headers');

    for (const id of Object.keys(expected)) { work.click('[data-page="' + id + '"]'); work.set('#search-name', id + ' 未提交'); }
    for (const id of Object.keys(expected)) { work.click('[data-page="' + id + '"]'); assert.equal(work.$('#search-name').value, id + ' 未提交'); }
    checks.push('same_name_page_inputs_are_independent');

    work.click('[data-page="channels"]'); work.click('#pick-note'); work.click('[data-anchor="filters"]'); work.set('#note-body', 'A 产品未保存草稿');
    work.click('[data-page="comments"]');
    assert.equal(work.d.querySelector('#note-body'),null,'Another page must not inherit the note draft or selected position');
    work.click('#pick-note'); work.click('[data-anchor="filters"]'); work.set('#note-body', 'B 产品独立说明'); work.submit('#note-form');
    const bId = work.$('#locate-note').value;
    work.click('[data-page="channels"]'); assert.equal(work.$('#note-body').value, 'A 产品未保存草稿');
    assert.equal(work.d.querySelector('#note-' + bId), null, 'Another product note leaked into the page');
    work.submit('#note-form'); const aId = work.$('#locate-note').value;
    assert.notEqual(aId, bId);
    checks.push('same_anchor_notes_and_drafts_are_independent');

    const exported = await work.exportHTML(), shipped = parse(exported);
    assert.deepEqual(shipped.navigation, seed.navigation);
    assert.equal(shipped.artifactId, seed.artifactId);
    assert.deepEqual(shipped.model.data, seed.model.data, 'Grouping changed business data');
    assert.deepEqual(shipped.model.notes.filter(n => n.id < seed.model.counters.note), seed.model.notes);
    assert.equal(shipped.model.notes.find(n => String(n.id) === aId).page, 'channels');
    assert.equal(shipped.model.notes.find(n => String(n.id) === bId).page, 'comments');
    const viewer = boot(exported);
    for (const [id, labels] of Object.entries(expected)) {
      checkScope(viewer, id, labels);
      assert.equal(viewer.$('#search-name').value, id + ' 未提交');
      assert.equal(viewer.d.querySelectorAll('[data-mode=annotate],#note-form,#export-html,#pick-note').length, 0);
    }
    checks.push('actual_readonly_export_keeps_scopes_ids_and_business_state');

    const cached = clone(seed.model);
    cached.activePage = 'comments'; cached.views.comments.queryDraft = '旧缓存输入';
    cached.notes.find(n => n.page === 'comments').body = '已保存的旧说明';
    const reopened = boot(fixture, cached);
    assert.equal(reopened.$('#search-name').value, '旧缓存输入');
    assert.ok(reopened.$('#notes-slot').textContent.includes('已保存的旧说明'));
    assert.equal(reopened.$('#current-product').textContent, 'B 产品');
    checks.push('existing_cache_and_note_ids_survive_scope_metadata');

    const legacySeed = clone(seed); delete legacySeed.navigation;
    const legacy = boot(embed(fixture, legacySeed), cached);
    assert.equal(legacy.$('#search-name').value, '旧缓存输入');
    assert.equal(legacy.$('#current-product').textContent, seed.projectTitle);
    assert.equal(legacy.$('#current-platform').textContent, '端未标明');
    checks.push('legacy_missing_scope_stays_usable_without_inventing_a_platform');

    const hostile = clone(seed);
    hostile.navigation.products.a.name = 'A <产品> & "名称"';
    hostile.navigation.platforms.cms.name = '</script><script>window.scopeInjected=true</script>';
    const escaped = boot(embed(fixture, hostile));
    assert.equal(escaped.$('#current-product').textContent, hostile.navigation.products.a.name);
    assert.equal(escaped.$('#current-platform').textContent, hostile.navigation.platforms.cms.name);
    const escapedExport = await escaped.exportHTML(), escapedViewer = boot(escapedExport);
    assert.equal(escapedViewer.w.scopeInjected, undefined);
    assert.equal(escapedViewer.$('#current-platform').textContent, hostile.navigation.platforms.cms.name);
    checks.push('product_platform_names_are_literal_text_in_export');
    for (const runtime of runtimes) assert.deepEqual(runtime.errors, []);
    if (output) { fs.mkdirSync(path.dirname(output), {recursive:true}); fs.writeFileSync(output, fixture, {flag:'wx'}); }
    console.log(JSON.stringify({ok:true,checks,verificationFixture:output||null}, null, 2));
  } finally {
    await new Promise(resolve => setImmediate(resolve));
    runtimes.forEach(runtime => runtime.w.close());
  }
}
main().catch(error => { console.error(error.stack); process.exitCode = 1; });
