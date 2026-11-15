import { escape as e, external, longFields, looks, siteFields, stages, verification } from './model.mjs';

const css = `
:root{color-scheme:light;--ink:#182823;--muted:#4d6059;--line:#d5ded8;--paper:#fff;--base:#f3f6f3;--brand:#175346;font:16px/1.55 system-ui,sans-serif}
*{box-sizing:border-box}body{margin:0;background:var(--base);color:var(--ink)}header.top{background:#142c28;color:white;padding:1rem max(1rem,calc((100% - 76rem)/2));white-space:nowrap}header.top a{color:white;text-decoration:none;font-weight:750}main{max-width:78rem;margin:auto;padding:2rem 1rem 4rem}main.narrow{max-width:46rem}h1,h2,h3,p{margin-top:0}h1{font-size:clamp(1.9rem,5vw,3rem);line-height:1.08;letter-spacing:-.045em;margin-bottom:.6rem}h2{font-size:1.35rem;letter-spacing:-.025em}h3{font-size:1rem}p{margin-bottom:1rem}.muted,small{color:var(--muted)}a{color:var(--brand);text-underline-offset:.16em}button,.button{font:inherit;font-weight:700;border:1px solid var(--brand);background:var(--brand);color:white;padding:.63rem 1rem;min-height:44px;display:inline-flex;align-items:center;text-decoration:none;border-radius:8px;cursor:pointer}.secondary{background:white;color:var(--brand)}button:focus-visible,a:focus-visible,input:focus-visible,textarea:focus-visible,select:focus-visible{outline:3px solid #b36c16;outline-offset:2px}.grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,18rem),1fr));gap:1rem}.bar,.actions{display:flex;align-items:center;gap:.65rem;flex-wrap:wrap}.bar{justify-content:space-between;margin-bottom:1rem}.card,fieldset,details{background:white;border:1px solid var(--line);border-radius:12px;padding:1.15rem;margin:0 0 1rem;min-width:0}.grid>.card{margin:0}.tag{background:#e2ede6;color:#1c4637;font-weight:650;font-size:.8rem;padding:.23rem .54rem;border-radius:99px;display:inline-block;margin-bottom:.35rem}label{display:block;font-weight:650}input,textarea,select{font:inherit;color:var(--ink);display:block;width:100%;padding:.58rem;border:1px solid #82948a;border-radius:6px;margin:.22rem 0 .85rem;background:white;min-width:0}input[type=checkbox]{display:inline-block;width:auto;margin-right:.4rem}input[type=file]{background:var(--base)}textarea{min-height:5rem;resize:vertical}summary{cursor:pointer;font-weight:700}.filter .grid{grid-template-columns:repeat(auto-fit,minmax(min(100%,10rem),1fr));gap:.65rem}.metrics{margin-bottom:1rem}.metrics strong{display:block;font-size:1.7rem}.table{overflow:auto;border:1px solid var(--line);border-radius:10px;background:white}table{border-collapse:collapse;width:100%;text-align:left}th,td{padding:.72rem .85rem;border-bottom:1px solid var(--line);vertical-align:top}th{background:#e4ece6;white-space:nowrap}td a{font-weight:700}tbody tr:last-child td{border-bottom:none}.stack{display:grid;gap:.5rem}.stack>*{margin:0}.note{padding:.8rem;background:#f2f6f3;border-radius:7px;white-space:pre-wrap;overflow-wrap:anywhere}.warn{background:#faefd9;color:#624214}.plain{list-style:none;padding:0}.plain li{padding:.65rem 0;border-bottom:1px solid var(--line)}dl{margin:0}dt{font-weight:700}dd{margin:0 0 .8rem;white-space:pre-wrap;overflow-wrap:anywhere}code{overflow-wrap:anywhere}.check{font-weight:500;margin-bottom:1rem}legend{font-weight:750;padding:0 .25rem}.review[hidden]{display:none}
@media(max-width:620px){main{padding-top:1.2rem}.table table,.table tbody,.table tr,.table td{display:block}.table thead{position:absolute;width:1px;height:1px;overflow:hidden;clip-path:inset(50%)}.table tr{padding:.7rem;border-bottom:1px solid var(--line)}.table td{border:none;padding:.22rem}.table td:empty{display:none}}
`;

export function shell(title, body, { admin = false, narrow = false, script = '' } = {}) {
  return '<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex,nofollow"><title>' + e(title) + ' | 7D Website Factory</title><style>' + css + '</style></head><body><header class="top">' +
    (admin ? '<a href="/admin">7D Website Factory</a>' : '7D Website Design') + '</header><main id="main"' +
    (narrow ? ' class="narrow"' : '') + '>' + body + '</main>' + script + '</body></html>';
}

export function select(name, label, options, value = '') {
  return '<label>' + e(label) + '<select name="' + e(name) + '">' + Object.entries(options).map(([key, text]) =>
    '<option value="' + e(key) + '"' + (value === String(key) ? ' selected' : '') + '>' + e(text) + '</option>').join('') + '</select></label>';
}
const optionList = values => Object.fromEntries(values.map(x => [x, x]));
const input = (name, label, val = '', max = 180, extra = '') => '<label>' + e(label) +
  '<input name="' + e(name) + '" value="' + e(val) + '" maxlength="' + max + '" ' + extra + '></label>';
const area = (key, label, val = '', max = 1800) => '<label>' + e(label) + '<textarea name="' + e(key) +
  '" maxlength="' + max + '">' + e(val) + '</textarea></label>';
const openLink = (url, label) => external(url) ? '<a href="' + e(external(url)) + '" target="_blank" rel="noopener noreferrer">' + e(label) + '</a>' : '';
const post = (path, inside) => '<form method="post" action="' + e(path) + '">' + inside + '</form>';
const button = (title, extra = '') => '<button ' + extra + '>' + e(title) + '</button>';
const hidden = (key, val) => '<input type="hidden" name="' + e(key) + '" value="' + e(val) + '">';
const paidReview = status => status === 'legacy' ? 'Existing Pages demo' : 'Factory preview';

export function dashboard(rows, filters, industries, salespeople, counts, page, next) {
  const query = new URLSearchParams(Object.entries(filters).filter(([, v]) => v));
  const pageLink = number => { query.set('page', number); return '/admin?' + e(query); };
  return shell('Prospects', '<div class="bar"><div><h1>Prospects</h1><p class="muted">Review businesses, demos, and customer requests.</p></div><div class="actions"><a class="button secondary" href="/admin/discover">Find businesses</a><a class="button" href="/admin/new">Add prospect</a></div></div>' +
    '<div class="grid metrics">' + [[counts.all, 'Prospects'], [counts.previews, 'Previews'], [counts.submitted, 'Prospects with submissions']].map(([c,l]) =>
      '<div class="card"><strong>' + e(c) + '</strong>' + e(l) + '</div>').join('') + '</div>' +
    '<form class="card filter" action="/admin"><div class="grid">' +
    input('q','Business search',filters.q,120,'type="search"') + input('area','Location',filters.area,120) +
    select('industry','Industry',{'':'All', ...optionList(industries)},filters.industry) +
    select('salesperson','Salesperson',{'':'All', ...optionList(salespeople)},filters.salesperson) +
    select('verification','Website status',{'':'All', ...verification},filters.verification) +
    select('stage','Sales stage',{'':'All', ...optionList(stages)},filters.stage) +
    '</div><div class="actions">' + button('Apply filters') + '<a href="/admin">Clear filters</a></div></form>' +
    (rows.length ? '<div class="table"><table><thead><tr><th>Business</th><th>Website status</th><th>Sales stage</th><th>Salesperson</th><th>Previews</th></tr></thead><tbody>' +
      rows.map(p => '<tr><td><a href="/admin/prospect/' + e(p.id) + '">' + e(p.name) + '</a><br><small>' + e([p.industry,p.location].filter(Boolean).join(' · ')) + '</small></td><td>' + e(verification[p.verification]) +
        '</td><td>' + e(p.stage) + '</td><td>' + e(p.salesperson || 'Unassigned') + '</td><td>' + e(p.preview_count) +
        (p.submission_count ? ' · ' + e(p.submission_count) + ' submitted' : '') + '</td></tr>').join('') + '</tbody></table></div>'
      : '<p class="card">No prospects match these filters.</p>') +
    '<nav class="bar" aria-label="Prospect pages">' + (page > 1 ? '<a href="' + pageLink(page - 1) + '">Previous page</a>' : '') +
    '<span>Page ' + page + '</span>' + (next ? '<a href="' + pageLink(page + 1) + '">Next page</a>' : '') + '</nav>', { admin:true });
}

function prospectInputs(p) {
  return '<div class="grid">' + input('name','Business name',p.name,180,'required') +
    input('industry','Industry',p.industry,100,'required') + input('location','City or service area',p.location) +
    input('phone','Public business phone',p.phone,35,'type="tel"') + input('email','Public business email',p.email,180,'type="email"') +
    input('facebook','Facebook page',p.facebook,1800,'type="url"') + input('website','Independent website',p.website,1800,'type="url"') +
    input('salesperson','Salesperson',p.salesperson,120) +
    select('verification','Website verification',verification,p.verification || 'unreviewed') +
    select('stage','Sales stage',optionList(stages),p.stage || 'Discovered') +
    input('reviewed','Last reviewed',p.reviewed,10,'type="date"') + '</div>' + area('notes','Prospect notes',p.notes);
}

export function newProspect(prefill = {}) {
  return shell('Add prospect','<p><a href="/admin">← Prospects</a></p><h1>Add prospect</h1><div class="card">' +
    post('/admin/new', prospectInputs(prefill) + button('Create prospect')) + '</div>',{ admin:true });
}

function contentInputs(content) {
  return Object.entries(siteFields).map(([key,label]) => longFields.includes(key) ? area(key,label,content[key]) :
    input(key,label,content[key],key === 'phone' ? 35 : 180,({ name:'required', phone:'type="tel"', email:'type="email"' })[key] || '')).join('');
}

export function prospect(p, evidence, previews, activities) {
  const path = '/admin/prospect/' + p.id;
  const previewCards = previews.map(item => {
    const base = '/admin/preview/' + item.id;
    const customer = '/showcase/' + item.id;
    const internal = item.content ? '<a href="' + base + '">Open draft</a>' : openLink(item.url, 'Open existing demo');
    const action = item.approved ? 'Remove presentation approval' : 'Approve for presentation';
    return '<div class="card"><h3>' + e(item.label) + '</h3><p class="muted">' + e(paidReview(item.url ? 'legacy' : 'generated')) +
      ' · ' + e(item.deployment || 'Served by Factory after approval') + '</p><div class="actions">' + internal +
      (item.approved ? '<a href="' + customer + '">Customer showcase</a>' : '') +
      (item.asset_reference ? openLink(item.asset_reference,'Drive asset') : '') + '</div><p>' +
      (item.approved ? 'Presentation approved' : 'Awaiting presentation review') + '</p>' +
      (!item.approved && item.content ? '<details><summary>Edit generated copy</summary>' +
        post(base + '/edit', select('style','Visual style',looks,item.content.style) + contentInputs(item.content) +
          input('image','Authorized illustration URL',item.content.image,1800,'type="url"') +
          input('imageAlt','Image description',item.content.imageAlt) + (item.content.image ? '<label class="check"><input type="checkbox" name="rights" value="yes" required>I can authorize use of this image.</label>' : '<label class="check"><input type="checkbox" name="rights" value="yes">I can authorize use of the image I add.</label>') +
          button('Save preview edits')) + '</details>' : '') +
      post(base + '/approval', hidden('mode', item.approved ? 'remove' : 'approve') +
        (!item.approved ? '<label class="check"><input type="checkbox" name="review" value="yes" required>I reviewed the business facts, imagery rights, and mobile layout.</label>' : '') +
        button(action, 'class="secondary"')) +
      (item.approved ? '<p>' + e(item.active_invite ? 'An authorization code is active.' : 'No active authorization code.') + '</p><div class="actions">' +
        post(base + '/invite',button(item.active_invite ? 'Replace code' : 'Issue 7-day code')) +
        (item.active_invite ? post(base + '/revoke',button('Revoke code','class="secondary"')) : '') + '</div>' : '') +
      (item.submissions.length ? '<ul class="plain">' + item.submissions.map(s => '<li><a href="/admin/submission/' + e(s.id) + '">Submission ' + e(s.created) + ' UTC</a></li>').join('') + '</ul>' : '') + '</div>';
  }).join('');
  return shell(p.name, '<p><a href="/admin">← Prospects</a></p><h1>' + e(p.name) + '</h1><p class="muted">' +
    e([p.industry,p.location,p.stage].filter(Boolean).join(' · ')) + '</p><div class="grid"><section><h2>Business record</h2><div class="card">' +
    post(path,hidden('revision',p.revision) + prospectInputs(p) + button('Save prospect')) + '</div><h2>Verification evidence</h2>' +
    '<ul class="plain card">' + (evidence.length ? evidence.map(x => '<li><strong>' + e(x.source) + '</strong> ' +
      openLink(x.url,'Open source') + '<br>' + e(x.finding) + '<br><small>' + e(x.checked || 'Date unavailable') + '</small></li>').join('') :
      '<li>No evidence recorded.</li>') + '</ul><details><summary>Add evidence</summary>' +
    post(path + '/evidence',input('source','Source', '', 100,'required') + input('url','Source link','',1800,'type="url" required') +
      input('checked','Date checked','',10,'type="date" required') + area('finding','What did you find?') + button('Record evidence')) +
    '<div class="actions">' + [
      ['Google Maps','https://www.google.com/maps/search/?api=1&query='],
      ['Yelp','https://www.yelp.com/search?find_desc='],
      ['Web search','https://www.google.com/search?q=']
    ].map(([label,url]) => openLink(url + encodeURIComponent([p.name,p.location].filter(Boolean).join(' ')),label)).join('') + '</div>' +
    '</details><h2>Activity</h2><div class="card">' + post(path + '/note',area('note','Interaction or follow-up') + button('Add activity')) +
    '<ul class="plain">' + activities.map(x => '<li><div class="note">' + e(x.note) + '</div><small>' + e(x.actor + ' · ' + x.created + ' UTC') + '</small></li>').join('') +
    '</ul></div></section><section><h2>Website previews</h2>' + (previewCards || '<p class="card">No previews linked.</p>') +
    '<details><summary>Link an existing preview</summary>' + post(path + '/link',input('url','Existing preview URL','',1800,'type="url" required') +
      input('asset','Drive source link','',1800,'type="url"') + input('deployment','Deployment reference','',180) + button('Link preview')) + '</details>' +
    '<details><summary>Generate a new preview</summary><p class="muted">Use copy supported by the evidence above.</p>' +
    post(path + '/generate',select('style','Visual style',looks,p.industry.toLowerCase().includes('pool') ? 'coastal' : 'grove') +
      contentInputs(p) + input('image','Authorized illustration URL','',1800,'type="url"') +
      input('imageAlt','Image description','',180) + '<label class="check"><input type="checkbox" name="rights" value="yes">I can authorize use of the image.</label>' +
      button('Create private preview')) + '</details></section></div>', { admin:true });
}

export function showcase(preview) {
  return shell(preview.name, '<p class="tag">Website concept</p><h1>' + e(preview.name) + '</h1>' +
    '<p>Review the demonstration, then tell us what to use for your website.</p><div class="actions">' +
    (preview.url ? openLink(preview.url,'Open website preview') : '<a class="button secondary" href="/demo/' + e(preview.id) + '">Open website preview</a>') +
    '<a class="button" href="/design/' + e(preview.id) + '">Design Now</a></div>', { narrow:true });
}

export function codeForm(preview) {
  return shell('Design Now', '<p><a href="/showcase/' + e(preview.id) + '">← Website preview</a></p><h1>Design Now</h1><p>' + e(preview.name) +
    '</p><div class="card"><p>Enter the authorization code from your salesperson.</p>' +
    post('/design/' + preview.id, input('code','Authorization code','',24,'required autocomplete="off" autocapitalize="none" spellcheck="false"') +
      button('Continue')) + '</div>', { narrow:true });
}

export function intake(preview, baseline, code) {
  const fields = (keys) => keys.map(key => longFields.includes(key) ? area(key,siteFields[key],baseline[key]) :
    input(key,siteFields[key],baseline[key],key === 'phone' ? 35 : 180,({ name:'required', phone:'type="tel"', email:'type="email"' })[key] || '')).join('');
  return shell('Your website details', '<h1>Your website details</h1><p>Confirm what you want visitors to see. You can leave optional sections blank.</p>' +
    '<form action="/design/' + e(preview.id) + '/submit" method="post" enctype="multipart/form-data" id="intake">' + hidden('code',code) +
    '<fieldset><legend>1. Business and contact details</legend>' + fields(['name','location','phone','email','hours']) + '</fieldset>' +
    '<fieldset><legend>2. Text and services</legend>' + fields(['headline','intro','services','about','contact']) + '</fieldset>' +
    '<fieldset><legend>3. Logo and photos</legend><p class="muted">PNG, JPEG, or WebP. Large images are resized on your device.</p><label>Logo<input type="file" name="logo" accept="image/png,image/jpeg,image/webp"></label>' +
    '<label>Up to three business photos<input type="file" name="photos" accept="image/png,image/jpeg,image/webp" multiple></label>' +
    '<label class="check"><input type="checkbox" name="rights" value="yes">I can authorize use of the files I am sharing.</label></fieldset>' +
    '<fieldset><legend>4. Additional instructions</legend>' + area('instructions','Anything else we should know?','','2400') + '</fieldset>' +
    '<fieldset class="review" hidden><legend>Review your details</legend><dl id="review-list"></dl></fieldset>' +
    '<label class="check"><input type="checkbox" name="confirmed" value="yes" required>I reviewed these details and approve using them to prepare a draft.</label>' +
    '<p id="image-status" role="status" class="muted"></p><div class="actions"><button type="button" id="review-button" class="secondary">Show review</button>' + button('Submit website details') + '</div></form>',
  { narrow:true, script:'<script src="/intake.js" defer></script>' });
}

export const intakeScript = `
const form = document.getElementById('intake');
const status = document.getElementById('image-status');
const submit = form.querySelector('button:not([type])');
let preparing = 0;
for (const input of form.querySelectorAll('input[type=file]')) {
  input.addEventListener('change', async () => {
    const original = Array.from(input.files);
    if (!original.length) return;
    submit.disabled = true;
    preparing++;
    status.textContent = 'Preparing your images…';
    try {
      const limit = input.name === 'logo' ? 1 : 3;
      if (original.length > limit) throw Error('Select up to ' + limit + ' file' + (limit === 1 ? '.' : 's.'));
      const ready = new DataTransfer();
      for (const file of original) ready.items.add(await fitImage(file, input.name === 'logo'));
      input.files = ready.files;
      status.textContent = 'Images are ready.';
    } catch (error) {
      input.value = '';
      status.textContent = error.message || 'The image could not be prepared.';
    } finally {
      preparing--;
      submit.disabled = preparing !== 0;
    }
  });
}
form.addEventListener('submit', event => { if (preparing) event.preventDefault(); });

async function fitImage(file, logo) {
  const formats = ['image/png','image/jpeg','image/webp'];
  if (!formats.includes(file.type)) throw Error('Choose a PNG, JPEG, or WebP image.');
  if (file.size <= 500000) return file;
  if (file.size > 25000000) throw Error('Choose an image smaller than 25 MB.');
  const bitmap = await createImageBitmap(file,{ resizeQuality:'high' });
  try {
    const mime = logo && file.type === 'image/png' ? 'image/png' : 'image/webp';
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    for (const edge of [1600,1200,900,650,450,320,240]) {
      const ratio = Math.min(1,edge / Math.max(bitmap.width,bitmap.height));
      canvas.width = Math.max(1,Math.round(bitmap.width * ratio));
      canvas.height = Math.max(1,Math.round(bitmap.height * ratio));
      ctx.drawImage(bitmap,0,0,canvas.width,canvas.height);
      const blob = await new Promise(resolve => canvas.toBlob(resolve,mime,0.82));
      if (blob?.size <= 500000) {
        const extension = blob.type.split('/')[1];
        return new File([blob],file.name.replace(/\\.[^.]+$/,'') + '.' + extension,{ type:blob.type });
      }
    }
    throw Error('This image could not fit. Choose a smaller image.');
  } finally {
    bitmap.close();
  }
}
document.getElementById('review-button').addEventListener('click', () => {
  const list = document.getElementById('review-list');
  list.replaceChildren();
  for (const control of form.elements) {
    if (!['text','email','tel','textarea','file'].includes(control.type)) continue;
    const label = control.labels?.[0]?.textContent;
    const value = control.type === 'file' ? Array.from(control.files, f => f.name).join(', ') : control.value;
    if (!label || !value.trim()) continue;
    const name = document.createElement('dt');
    const details = document.createElement('dd');
    name.textContent = label;
    details.textContent = value;
    list.append(name,details);
  }
  list.parentElement.hidden = false;
  list.parentElement.tabIndex = -1;
  list.parentElement.focus();
  list.parentElement.scrollIntoView({block:'start'});
});
`;

export function submission(row, assets, draft, report) {
  const base = '/admin/submission/' + row.id;
  return shell('Customer submission', '<p><a href="/admin/prospect/' + e(row.prospect_id) + '">← Prospect</a></p><h1>' + e(row.name) + '</h1>' +
    '<p>Customer submission received ' + e(row.created) + ' UTC</p><div class="grid"><section class="card"><h2>Requested changes</h2>' +
    '<dl>' + report.changes.map(c => '<dt>' + e(c.label) + '</dt><dd><strong>Preview:</strong> ' + e(c.previous || '—') +
      '<br><strong>Requested:</strong> ' + e(c.requested || '—') + '</dd>').join('') + '</dl>' +
    '<h3>Additional instructions</h3><p class="note">' + e(row.instructions || 'None supplied') + '</p></section><section class="card"><h2>Production review</h2>' +
    (report.missing.length ? '<h3>Missing information</h3><ul>' + report.missing.map(s => '<li>' + e(s) + '</li>').join('') + '</ul>' : '') +
    '<ul>' + report.review.map(s => '<li>' + e(s) + '</li>').join('') + '</ul><h3>Private uploads</h3>' +
    (assets.length ? '<ul>' + assets.map(a => '<li><a href="' + base + '/asset/' + a.number + '">Download ' +
      e(a.kind === 'logo' ? 'logo' : 'photo ' + a.number) + '</a></li>').join('') + '</ul>' : '<p>No files submitted.</p>') +
    '<div class="actions"><a class="button secondary" href="' + base + '/brief">Download work package</a></div><hr>' +
    '<h3>Draft versions</h3>' + (draft.length ? '<ul class="plain">' + draft.map(d => '<li><a href="/admin/draft/' + e(d.id) + '">' +
      e(d.created) + ' UTC</a>' + (d.approved_at ? ' · Approved · <a href="/admin/draft/' + e(d.id) + '/export">Download approved HTML</a>' :
      post('/admin/draft/' + d.id + '/approve','<label class="check"><input type="checkbox" name="review" value="yes" required>I reviewed this version and authorize preparing the release.</label>' +
        button('Approve version','class="secondary"'))) + '</li>').join('') + '</ul>' : '<p>No draft versions yet.</p>') +
    '<details><summary>Prepare another version</summary>' + post(base + '/draft',contentInputs(row.content) + button('Save private draft')) + '</details></section></div>', { admin:true });
}

export function discover(industry, areaName) {
  const query = [industry,areaName,'Texas'].filter(Boolean).join(' ');
  const results = industry && areaName ? '<section class="card"><h2>Review listings</h2><p>Check the listing, search for the business by name and phone, then record the source and result in its prospect record.</p><div class="actions">' +
    [
      ['Open Google Maps','https://www.google.com/maps/search/?api=1&query=' + encodeURIComponent(query)],
      ['Open Yelp','https://www.yelp.com/search?find_desc=' + encodeURIComponent(industry) + '&find_loc=' + encodeURIComponent(areaName + ', TX')],
      ['Open web search','https://www.google.com/search?q=' + encodeURIComponent(query)]
    ].map(([label,url]) => openLink(url,label)).join('') +
    '</div><p><a href="/admin/new?' + e(new URLSearchParams({industry,location:areaName + ', TX'})) + '">Add a candidate</a> · <a href="/admin?stage=Research+needed">Open research queue</a></p></section>' : '';
  return shell('Find businesses','<p><a href="/admin">← Prospects</a></p><h1>Find businesses</h1><p>Choose a service and a Texas city or region to open source searches.</p>' +
    '<form class="card" action="/admin/discover">' + input('industry','Service or industry',industry,100,'required') +
    input('area','City or region',areaName,120,'required') + button('Prepare searches') + '</form>' + results,{admin:true,narrow:true});
}
