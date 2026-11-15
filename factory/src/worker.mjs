import { administrator, boundedForm, digest, newCode, requireSameOrigin } from './auth.mjs';
import { completion, escape, field, identity, images, linkField, Problem, qualifying, siteContent, stages, verification } from './model.mjs';
import { quality, renderSite } from './render.mjs';
import * as view from './views.mjs';

const uuid = '[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}';
const match = (path, expression) => path.match(new RegExp('^' + expression + '$'));
const now = () => Math.floor(Date.now() / 1000);
const changed = result => result.meta.changes > 0;
const responseHeaders = {
  'Cache-Control': 'no-store',
  'X-Content-Type-Options': 'nosniff',
  'Referrer-Policy': 'same-origin',
  'X-Robots-Tag': 'noindex, nofollow',
  'Content-Security-Policy': "default-src 'none'; style-src 'unsafe-inline'; img-src https:; script-src 'self'; form-action 'self'; frame-ancestors 'none'; base-uri 'none'; object-src 'none'"
};

function send(body, status = 200, headers = {}) {
  return new Response(body, { status, headers: { ...responseHeaders, 'Content-Type':'text/html; charset=utf-8', ...headers } });
}
const redirect = location => send(null, 303, { Location:location });
const missing = () => { throw new Problem(404, 'That record could not be found.'); };
const loadJson = value => value ? JSON.parse(value) : null;
const publicKeys = ['name','location','phone','email'];
const baseline = p => loadJson(p.content) || Object.fromEntries(publicKeys.map(key => [key,p[key]]));
const prospectPath = id => '/admin/prospect/' + id;
const submitPath = id => '/admin/submission/' + id;

function database(env) {
  const statement = (sql, ...values) => env.DB.prepare(sql).bind(...values);
  return {
    statement, batch: statements => env.DB.batch(statements),
    one: (sql,...values) => statement(sql,...values).first(),
    all: async (sql,...values) => (await statement(sql,...values).all()).results,
    run: (sql,...values) => statement(sql,...values).run()
  };
}

function dateField(form,key,required = false) {
  const value = field(form,key,10,required);
  if (value && (!/^\d{4}-\d{2}-\d{2}$/.test(value) ||
      Number.isNaN(Date.parse(value)) || new Date(value).toISOString().slice(0,10) !== value)) {
    throw new Problem(400,'Enter a valid date.');
  }
  return value;
}

async function validateProspect(form, db, id) {
  const data = siteContent(form);
  const industry = field(form,'industry',100,true);
  const status = field(form,'verification',40,true);
  const stage = field(form,'stage',40,true);
  const facebook = linkField(form,'facebook');
  const website = linkField(form,'website');
  const reviewed = dateField(form,'reviewed');
  if (!Object.hasOwn(verification,status) || !stages.includes(stage)) throw new Problem(400,'Choose an available status.');
  if (status === 'independent' && !website) throw new Problem(400,'Enter the independent website URL.');
  if (facebook && !/(^|\.)facebook\.com$/.test(new URL(facebook).hostname)) throw new Problem(400,'Enter a Facebook page URL.');
  if (status === 'facebook_only' && !facebook) throw new Problem(400,'Enter the matching Facebook page.');
  if (website && status !== 'independent') throw new Problem(400,'Mark the prospect as having an independent website.');
  if (stage === 'Qualified' || ['facebook_only','owner_confirmed_none','independent'].includes(status)) {
    const evidence = id && await db.one('SELECT 1 FROM evidence WHERE prospect_id=? AND checked<>\'\' LIMIT 1',id);
    if (!evidence || !reviewed || (stage === 'Qualified' && !qualifying.includes(status))) {
      throw new Problem(400,'Save a dated evidence entry and review date before confirming website status or qualification.');
    }
  }
  const key = identity(data.name,data.location);
  if (!key.split('|')[0]) throw new Problem(400,'Enter a business name with letters or numbers.');
  return [key,data.name,industry,data.location,data.phone,data.email,facebook,website,status,
    field(form,'salesperson',120),stage,field(form,'notes',1800),reviewed];
}

async function limit(db, key, cap, seconds) {
  const t = now();
  const row = await db.one(`INSERT INTO attempts(bucket,hits,expires) VALUES (?,1,?)
    ON CONFLICT(bucket) DO UPDATE SET hits=CASE WHEN expires<=? THEN 1 ELSE min(hits+1, ?) END,
    expires=CASE WHEN expires<=? THEN excluded.expires ELSE expires END RETURNING hits`,key,t+seconds,t,cap+1,t);
  if (row.hits > cap) throw new Problem(429,'Too many attempts. Try again later.');
}

async function validInvite(db, request, preview, form) {
  const ip = request.headers.get('CF-Connecting-IP') || 'local';
  await limit(db,'design:' + await digest(ip),25,900);
  const code = field(form,'code',24);
  if (!/^[a-zA-Z0-9_-]{24}$/.test(code)) throw new Problem(403,'This authorization code is invalid or expired.');
  const hash = await digest(code);
  const active = await db.one('SELECT 1 FROM invites WHERE hash=? AND preview_id=? AND expires>? AND revoked=0 AND used=0',hash,preview.id,now());
  if (!active) throw new Problem(403,'This authorization code is invalid or expired.');
  return { code, hash };
}

async function customer(db, request, path) {
  const hit = match(path,'/(showcase|demo|design)/(' + uuid + ')(/submit)?');
  if (!hit) return missing();
  const [,surface,id,submit] = hit;
  const preview = await db.one(`SELECT v.*, p.name, p.location, p.phone, p.email FROM previews v
    JOIN prospects p ON p.id=v.prospect_id WHERE v.id=? AND v.approved=1 AND p.verification IN ('no_website_found','facebook_only','owner_confirmed_none')
    AND p.stage <> 'Closed / Not interested'`,id);
  if (!preview) return missing();
  if (request.method === 'GET' && !submit) {
    if (surface === 'showcase') return send(view.showcase(preview));
    if (surface === 'demo' && preview.content) return send(renderSite(baseline(preview),{ design:'/design/' + id }));
    if (surface === 'design') return send(view.codeForm(preview));
    return missing();
  }
  if (request.method !== 'POST' || surface !== 'design') return missing();
  const previous = baseline(preview);
  const form = await boundedForm(request,submit ? 2_080_000 : 4096);
  const { code, hash } = await validInvite(db,request,preview,form);
  if (!submit) return send(view.intake(preview,previous,code));
  if (form.get('confirmed') !== 'yes') throw new Problem(400,'Review and confirm your website details.');
  const content = siteContent(form,previous.style,previous.image,previous.imageAlt);
  const instructions = field(form,'instructions',2400);
  const files = await images(form);
  const submissionId = crypto.randomUUID();
  const draftId = crypto.randomUUID();
  const envelope = JSON.stringify({ ...content,instructions });
  const initialDraft = JSON.stringify(content);
  const operations = [
    db.statement(`INSERT INTO submissions (id,preview_id,invite_hash,baseline,content)
      SELECT ?,i.preview_id,i.hash,?,? FROM invites i JOIN previews v ON v.id=i.preview_id
      JOIN prospects p ON p.id=v.prospect_id
      WHERE i.hash=? AND i.preview_id=? AND i.expires>? AND i.revoked=0 AND i.used=0 AND v.approved=1
      AND p.verification IN ('no_website_found','facebook_only','owner_confirmed_none') AND p.stage <> 'Closed / Not interested'`,
    submissionId,JSON.stringify(previous),envelope,hash,id,now()),
    ...files.map((f,index) => db.statement(`INSERT INTO uploads(submission_id,number,kind,mime,bytes)
      SELECT id,?,?,?,? FROM submissions WHERE id=?`,index + 1,f.kind,f.mime,f.bytes,submissionId)),
    db.statement(`INSERT INTO drafts(id,submission_id,content) SELECT ?,id,? FROM submissions WHERE id=?`,draftId,initialDraft,submissionId)
  ];
  const [result] = await db.batch(operations);
  if (!changed(result)) throw new Problem(409,'The code was used, replaced, or expired. Contact your salesperson.');
  return send(view.shell('Details submitted','<h1>Details submitted</h1><p>Your website team has received your information and will review it before preparing the site.</p>',{ narrow:true }),201);
}

async function list(db,url) {
  const columns = { q:'name',area:'location',industry:'industry',salesperson:'salesperson',verification:'verification',stage:'stage' };
  const filters = Object.fromEntries(Object.keys(columns).map(key => [key,(url.searchParams.get(key) || '').trim().slice(0,120)]));
  const active = Object.entries(filters).filter(([,value]) => value);
  const clause = active.map(([key]) => (key === 'q' || key === 'area') ? 'instr(lower(p.' + columns[key] + '),lower(?))>0' : 'p.' + columns[key] + '=?');
  const page = Math.max(1, Math.min(10_000, Number.parseInt(url.searchParams.get('page'),10) || 1));
  const [rows,industries,salespeople,counts] = await Promise.all([
    db.all(`SELECT p.*,(SELECT count(*) FROM previews v WHERE v.prospect_id=p.id) AS preview_count,
      (SELECT count(*) FROM submissions s JOIN previews v ON v.id=s.preview_id WHERE v.prospect_id=p.id) AS submission_count,
      (SELECT v.url FROM previews v WHERE v.prospect_id=p.id AND v.url IS NOT NULL
        ORDER BY CASE WHEN v.url LIKE 'https://7d-website-demos.pages.dev/%' THEN 0 ELSE 1 END, v.label COLLATE NOCASE, v.id LIMIT 1) AS existing_demo
      FROM prospects p ${clause.length ? 'WHERE ' + clause.join(' AND ') : ''} ORDER BY p.name COLLATE NOCASE,p.id LIMIT 26 OFFSET ?`,
    ...active.map(([,value]) => value),(page - 1) * 25),
    db.all('SELECT DISTINCT industry FROM prospects ORDER BY industry'),
    db.all("SELECT DISTINCT salesperson FROM prospects WHERE salesperson<>'' ORDER BY salesperson"),
    db.one(`SELECT (SELECT count(*) FROM prospects) AS "all",(SELECT count(*) FROM previews) AS previews,
      (SELECT count(DISTINCT v.prospect_id) FROM submissions s JOIN previews v ON v.id=s.preview_id) AS submitted`)
  ]);
  return send(view.dashboard(rows.slice(0,25),filters,industries.map(x=>x.industry),salespeople.map(x=>x.salesperson),counts,page,rows.length>25));
}

async function manageProspect(db, request, id, action, actor) {
  const p = await db.one('SELECT * FROM prospects WHERE id=?',id);
  if (!p) return missing();
  if (request.method === 'GET' && !action) {
    const [evidence,previews,submissions,activities] = await Promise.all([
      db.all('SELECT * FROM evidence WHERE prospect_id=? ORDER BY checked DESC,id',id),
      db.all(`SELECT v.*, EXISTS(SELECT 1 FROM invites i WHERE i.preview_id=v.id AND i.expires>? AND i.used=0 AND i.revoked=0) AS active_invite
        FROM previews v WHERE v.prospect_id=? ORDER BY v.label,v.id`,now(),id),
      db.all(`SELECT s.id,s.preview_id,s.created FROM submissions s JOIN previews v ON v.id=s.preview_id
        WHERE v.prospect_id=? ORDER BY s.created DESC,s.id`,id),
      db.all('SELECT actor,note,created FROM activities WHERE prospect_id=? ORDER BY created DESC,id LIMIT 100',id)
    ]);
    for (const v of previews) {
      v.content = loadJson(v.content);
      v.submissions = submissions.filter(s => s.preview_id === v.id);
    }
    return send(view.prospect(p,evidence,previews,activities));
  }
  if (request.method !== 'POST') return missing();
  const form = await boundedForm(request);
  if (!action) {
    const values = await validateProspect(form,db,id);
    const revision = field(form,'revision',12,true);
    if (!/^\d+$/.test(revision)) throw new Problem(400,'Reload the prospect record.');
    const result = await db.run(`UPDATE prospects SET identity=?,name=?,industry=?,location=?,phone=?,email=?,facebook=?,website=?,
      verification=?,salesperson=?,stage=?,notes=?,reviewed=?,revision=revision+1 WHERE id=? AND revision=?`,...values,id,Number(revision));
    if (!changed(result)) throw new Problem(409,'This prospect changed. Reload before saving.');
  }
  if (action === 'evidence') {
    await db.run('INSERT INTO evidence VALUES (?,?,?,?,?,?)',crypto.randomUUID(),id,field(form,'source',100,true),
      linkField(form,'url',true),field(form,'finding',1800,true),dateField(form,'checked',true));
  }
  if (action === 'note') {
    await db.run('INSERT INTO activities(id,prospect_id,actor,note) VALUES (?,?,?,?)',crypto.randomUUID(),id,actor,field(form,'note',1800,true));
  }
  if (action === 'link' || action === 'generate') {
    if (action === 'generate' && !qualifying.includes(p.verification)) {
      throw new Problem(409,'Review the website evidence and confirm the prospect is eligible before generating a preview.');
    }
    const content = action === 'generate' ? generatedContent(form) : null;
    const link = content ? null : linkField(form,'url',true);
    await db.batch([
      db.statement('INSERT INTO previews(id,prospect_id,url,label,deployment,content,asset_reference) VALUES (?,?,?,?,?,?,?)',
        crypto.randomUUID(),id,link,content?.name || p.name,field(form,'deployment',180),content && JSON.stringify(content),linkField(form,'asset')),
      db.statement(`UPDATE prospects SET stage=CASE WHEN stage IN ('Discovered','Research needed','Qualified') THEN 'Preview generated' ELSE stage END,
        revision=revision+1 WHERE id=?`,id)
    ]);
  }
  return redirect(prospectPath(id));
}

function generatedContent(form) {
  const image = linkField(form,'image');
  const alt = field(form,'imageAlt',180,Boolean(image));
  if (image && form.get('rights') !== 'yes') throw new Problem(400,'Confirm your right to use the image.');
  return siteContent(form,field(form,'style',20),image,alt);
}

async function managePreview(db, request, id, action) {
  const v = await db.one(`SELECT v.*,p.verification,p.stage FROM previews v JOIN prospects p ON p.id=v.prospect_id WHERE v.id=?`,id);
  if (!v) return missing();
  const back = prospectPath(v.prospect_id);
  const content = loadJson(v.content);
  if (request.method === 'GET' && !action && content) return send(renderSite(content,{ privateDraft:true }));
  if (request.method !== 'POST' || !action) return missing();
  const form = await boundedForm(request);
  if (action === 'edit') {
    const next = generatedContent(form);
    const result = await db.run('UPDATE previews SET content=?,label=? WHERE id=? AND approved=0 AND url IS NULL',
      JSON.stringify(next),next.name,id);
    if (!changed(result)) throw new Problem(409,'Remove presentation approval before editing.');
  }
  if (action === 'approval') {
    const setting = field(form,'mode',10,true);
    if (setting === 'remove') {
      await db.batch([db.statement('UPDATE previews SET approved=0 WHERE id=?',id),
        db.statement('UPDATE invites SET revoked=1 WHERE preview_id=? AND used=0',id)]);
    } else if (setting === 'approve' && form.get('review') === 'yes') {
      if (!qualifying.includes(v.verification) || v.stage === 'Closed / Not interested') {
        throw new Problem(409,'Complete the website verification and open the prospect before approving its preview.');
      }
      const issues = content ? quality(content) : [];
      if (issues.length) throw new Problem(400,'Complete these sections: ' + issues.join(', ') + '.');
      const [result] = await db.batch([
        db.statement(`UPDATE previews SET approved=1 WHERE id=? AND content IS ? AND EXISTS
          (SELECT 1 FROM prospects p WHERE p.id=prospect_id AND p.verification IN ('no_website_found','facebook_only','owner_confirmed_none')
          AND p.stage <> 'Closed / Not interested')`,id,v.content),
        db.statement(`UPDATE prospects SET stage='Preview reviewed',revision=revision+1
          WHERE id=? AND stage='Preview generated' AND EXISTS(SELECT 1 FROM previews WHERE id=? AND approved=1)`,v.prospect_id,id)
      ]);
      if (!changed(result)) throw new Problem(409,'Preview or prospect changed. Reload and review the current version.');
    } else throw new Problem(400,'Confirm you reviewed the preview before approval.');
  }
  if (action === 'revoke') await db.run('UPDATE invites SET revoked=1 WHERE preview_id=? AND used=0',id);
  if (action === 'invite') {
    if (!v.approved || v.verification === 'independent' || v.stage === 'Closed / Not interested') {
      throw new Problem(409,'Approve an eligible preview before issuing a code.');
    }
    const code = newCode();
    const [,issued] = await db.batch([
      db.statement('UPDATE invites SET revoked=1 WHERE preview_id=? AND used=0',id),
      db.statement(`INSERT INTO invites(hash,preview_id,expires) SELECT ?,v.id,? FROM previews v JOIN prospects p ON p.id=v.prospect_id
        WHERE v.id=? AND v.approved=1 AND p.verification IN ('no_website_found','facebook_only','owner_confirmed_none') AND p.stage <> 'Closed / Not interested'`,
      await digest(code),now() + 604800,id)
    ]);
    if (!changed(issued)) throw new Problem(409,'The preview is no longer approved.');
    const url = new URL('/showcase/' + id,request.url).href;
    return send(view.shell('Authorization code','<p><a href="' + back + '">← Back to prospect</a></p><h1>Authorization code</h1>' +
      '<p>Share the showcase link and this one-use code. It expires in seven days.</p><p class="note"><code>' + code +
      '</code></p><p class="note"><a href="' + escape(url) + '">' + escape(url) + '</a></p>',{ admin:true,narrow:true }));
  }
  return redirect(back);
}

async function manageSubmission(db, request, id, action, asset) {
  const s = await db.one(`SELECT s.*,v.url,v.prospect_id,p.name FROM submissions s JOIN previews v ON v.id=s.preview_id
    JOIN prospects p ON p.id=v.prospect_id WHERE s.id=?`,id);
  if (!s) return missing();
  if (request.method === 'GET' && action === 'asset') {
    const file = await db.one('SELECT mime,bytes FROM uploads WHERE submission_id=? AND number=?',id,Number(asset));
    if (!file) return missing();
    return send(new Uint8Array(file.bytes),200,{'Content-Type':file.mime,'Content-Disposition':'attachment; filename="image-' +
      asset + '.' + file.mime.split('/')[1] + '"'});
  }
  const { instructions,...content } = loadJson(s.content);
  const previous = loadJson(s.baseline);
  const uploads = await db.all('SELECT number,kind,mime,length(bytes) AS size FROM uploads WHERE submission_id=? ORDER BY number',id);
  const report = completion(previous,content,uploads.length,Boolean(s.url));
  const drafts = await db.all('SELECT id,created,approved_by,approved_at FROM drafts WHERE submission_id=? ORDER BY created DESC,id',id);
  if (request.method === 'GET' && !action) return send(view.submission({ ...s,content,instructions },uploads,drafts,report));
  if (request.method === 'GET' && action === 'brief') {
    return send(JSON.stringify({ prospect:s.name,preview:s.url,submittedAt:s.created,instructions,baseline:previous,
      requested:content,uploads,drafts,...report },null,2),200,{'Content-Type':'application/json; charset=utf-8',
      'Content-Disposition':'attachment; filename="website-work-package.json"'});
  }
  if (request.method === 'POST' && action === 'draft') {
    const form = await boundedForm(request);
    const updated = siteContent(form,content.style,content.image,content.imageAlt);
    await db.batch([
      db.statement('INSERT INTO drafts(id,submission_id,content) VALUES (?,?,?)',crypto.randomUUID(),id,JSON.stringify(updated)),
      db.statement(`UPDATE prospects SET stage='In production',revision=revision+1 WHERE id=?
        AND stage IN ('Design Now submitted','Ready for approval')`,s.prospect_id)
    ]);
    return redirect(submitPath(id));
  }
  return missing();
}

async function manageDraft(db, request, id, action, actor) {
  const draft = await db.one(`SELECT d.*,v.prospect_id FROM drafts d JOIN submissions s ON s.id=d.submission_id
    JOIN previews v ON v.id=s.preview_id WHERE d.id=?`,id);
  if (!draft) return missing();
  const content = loadJson(draft.content);
  if (request.method === 'GET' && !action) return send(renderSite(content,{ privateDraft:true }));
  if (request.method === 'GET' && action === 'export' && draft.approved_at) {
    return send(renderSite(content,{ demo:false }),200,{'Content-Disposition':'attachment; filename="index.html"'});
  }
  if (request.method === 'POST' && action === 'approve') {
    const form = await boundedForm(request);
    if (form.get('review') !== 'yes') throw new Problem(400,'Confirm you reviewed this version.');
    const issues = quality(content);
    if (issues.length) throw new Problem(400,'Complete these sections before preparing the release: ' + issues.join(', ') + '.');
    await db.batch([
      db.statement('UPDATE drafts SET approved_by=?,approved_at=CURRENT_TIMESTAMP WHERE id=? AND approved_at IS NULL',actor,id),
      db.statement(`UPDATE prospects SET stage='Ready for approval',revision=revision+1 WHERE id=?
        AND stage IN ('Design Now submitted','In production')`,draft.prospect_id)
    ]);
    return redirect(submitPath(draft.submission_id));
  }
  return missing();
}

async function admin(db, request, url, actor) {
  const path = url.pathname;
  if (path === '/admin' && request.method === 'GET') return list(db,url);
  if (path === '/admin/discover' && request.method === 'GET') {
    return send(view.discover((url.searchParams.get('industry') || '').trim().slice(0,100),
      (url.searchParams.get('area') || '').trim().slice(0,120)));
  }
  if (path === '/admin/new' && request.method === 'GET') {
    return send(view.newProspect({ industry:(url.searchParams.get('industry') || '').slice(0,100),
      location:(url.searchParams.get('location') || '').slice(0,180) }));
  }
  if (path === '/admin/new' && request.method === 'POST') {
    const data = await validateProspect(await boundedForm(request),db);
    const id = crypto.randomUUID();
    await db.run(`INSERT INTO prospects(id,identity,name,industry,location,phone,email,facebook,website,verification,salesperson,stage,notes,reviewed)
      VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,id,...data);
    return redirect(prospectPath(id));
  }
  const prospectHit = match(path,'/admin/prospect/(' + uuid + ')(?:/(evidence|note|link|generate))?');
  if (prospectHit) return manageProspect(db,request,prospectHit[1],prospectHit[2],actor);
  const previewHit = match(path,'/admin/preview/(' + uuid + ')(?:/(edit|invite|revoke|approval))?');
  if (previewHit) return managePreview(db,request,previewHit[1],previewHit[2]);
  const submissionHit = match(path,'/admin/submission/(' + uuid + ')(?:/(brief|draft|asset)(?:/([1-4]))?)?');
  if (submissionHit) return manageSubmission(db,request,submissionHit[1],submissionHit[2],submissionHit[3]);
  const draftHit = match(path,'/admin/draft/(' + uuid + ')(?:/(approve|export))?');
  if (draftHit) return manageDraft(db,request,draftHit[1],draftHit[2],actor);
  return missing();
}

export default {
  async fetch(request,env,ctx) {
    const url = new URL(request.url);
    const path = url.pathname;
    try {
      if (!['GET','POST'].includes(request.method)) return send(null,405,{ Allow:'GET, POST' });
      if (request.method === 'POST') requireSameOrigin(request);
      if (request.method === 'GET' && path === '/') return redirect('/admin');
      if (request.method === 'GET' && path === '/intake.js') return send(view.intakeScript,200,{'Content-Type':'text/javascript; charset=utf-8'});
      const db = database(env);
      if (path === '/admin' || path.startsWith('/admin/')) return await admin(db,request,url,await administrator(request,env,ctx?.access));
      return await customer(db,request,path);
    } catch (error) {
      const duplicate = /UNIQUE constraint failed: (prospects.identity|previews.url)/.test(error.message);
      const status = error instanceof Problem ? error.status : duplicate ? 409 : 500;
      if (status === 500) console.error('Factory request failed',error.name);
      const message = error instanceof Problem ? error.message : duplicate ? 'A matching prospect or preview already exists.' : 'The request could not be completed.';
      return send(view.shell('Request unavailable','<h1>Request unavailable</h1><p>' + escape(message) + '</p>',{ narrow:true }),status);
    }
  }
};
