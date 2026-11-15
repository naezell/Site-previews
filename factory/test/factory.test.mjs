import assert from 'node:assert/strict';
import test from 'node:test';
import app from '../src/worker.mjs';
import { makeSeed } from '../scripts/seed.mjs';
import { sqlite } from './sqlite.mjs';
import { completion, external, identity } from '../src/model.mjs';
import { renderSite } from '../src/render.mjs';

const endpoint = 'http://127.0.0.1';
const catalog = [{
  name:'Example Pressure Washing',industry:'Pressure washing',location:'Bryan, TX',
  phone:'979-555-0120',email:'sales@example.com',facebook:'',verification:'no_website_found',reviewed:'2026-11-15',
  evidence:[{source:'Example directory',url:'https://example.com/listing',finding:'No website found in the listing.',checked:'2026-11-15'}],
  previews:[
    {url:'https://demo.example.com/original/',label:'Original',deployment:'Example',asset:'',reference:'original'},
    {url:'https://demo.example.com/alternate/',label:'Alternate',deployment:'Example',asset:'',reference:'alternate'}
  ]
}];
const png = new Uint8Array(Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jQ9sAAAAASUVORK5CYII=','base64'));
const copy = { name:'Oak & Elm', location:'Bryan, TX', headline:'Outdoor care', intro:'Seasonal yard care.',
  services:'Mowing\nCleanup', phone:'979-555-0101', hours:'Monday to Friday' };

function context(withSeed = false) {
  const { db,binding } = sqlite();
  if (withSeed) db.exec(makeSeed(catalog));
  const env = { DB:binding,LOCAL_DEV:'1' };
  const call = (path,data,options = {}) => {
    const init = data === undefined ? {} : { method:'POST', body:data instanceof FormData ? data : new URLSearchParams(data),
      headers:{ Origin:options.origin || endpoint } };
    return app.fetch(new Request((options.originHost || endpoint) + path,init),options.private === false ? { DB:binding } : env);
  };
  return { db,call };
}

async function eligible(call) {
  const added = await call('/admin/new',{ ...copy,industry:'Landscaping',verification:'unreviewed',stage:'Discovered' });
  assert.equal(added.status,303);
  const prospect = added.headers.get('location');
  assert.equal((await call(prospect + '/evidence',{ source:'Business confirmation',url:'https://example.com',checked:'2026-11-15',
    finding:'Owner confirmed no website' })).status,303);
  assert.equal((await call(prospect,{ ...copy,industry:'Landscaping',verification:'owner_confirmed_none',stage:'Qualified',
    reviewed:'2026-11-15',revision:'0' })).status,303);
  assert.equal((await call(prospect + '/generate',{ ...copy,style:'coastal' })).status,303);
}

test('seed is idempotent and preserves corrections, primary and alternate Cloudflare preview URLs', () => {
  const { db } = sqlite();
  const data = makeSeed(catalog);
  db.exec(data);
  const count = table => db.prepare('SELECT count(*) AS n FROM ' + table).get().n;
  assert.equal(count('prospects'),1);
  assert.equal(count('previews'),2);
  assert.equal(db.prepare("SELECT count(*) n FROM previews WHERE url LIKE 'https://demo.example.com/%'").get().n,2);
  const versions = db.prepare(`SELECT url FROM previews v JOIN prospects p ON p.id=v.prospect_id WHERE p.name='Example Pressure Washing'`).all();
  assert.equal(versions.length,2);
  assert.ok(versions.some(v=>v.url.endsWith('/alternate/')));
  db.exec("UPDATE prospects SET notes='keep my correction' WHERE name='Example Pressure Washing'");
  db.exec(data);
  assert.equal(count('prospects'),1);
  assert.equal(count('previews'),2);
  assert.equal(db.prepare("SELECT notes FROM prospects WHERE name='Example Pressure Washing'").get().notes,'keep my correction');
  assert.equal(db.prepare('SELECT count(*) n FROM previews WHERE approved<>0').get().n,0);
  assert.equal(db.prepare("SELECT count(*) n FROM prospects WHERE verification='owner_confirmed_none'").get().n,0);
});

test('admin access fails closed and requests require their own origin',async () => {
  const { call } = context();
  assert.equal((await call('/admin',undefined,{ private:false })).status,403);
  assert.equal((await call('/admin',undefined,{ originHost:'https://factory.example.com' })).status,403);
  assert.equal((await call('/admin/new',{}, { origin:'https://other.example' })).status,403);
});

test('previews and codes follow eligibility, approval, replacement, and revocation',async () => {
  const { call,db } = context();
  await eligible(call);
  const { id } = db.prepare('SELECT id FROM previews').get();
  const admin = '/admin/preview/' + id;
  assert.equal((await call('/showcase/' + id)).status,404);
  assert.equal((await call(admin + '/invite',{})).status,409);
  assert.equal((await call(admin + '/approval',{ mode:'approve' })).status,400);
  assert.equal((await call(admin + '/approval',{ mode:'approve',review:'yes' })).status,303);
  assert.match(await (await call('/demo/' + id)).text(),/Design Now/);
  const issue = async () => (await (await call(admin + '/invite',{})).text()).match(/<code>([^<]+)<\/code>/)[1];
  const original = await issue();
  const replacement = await issue();
  const design = '/design/' + id;
  assert.notEqual(original,replacement);
  assert.equal((await call(design,{ code:original })).status,403);
  assert.equal((await call(design,{ code:replacement })).status,200);
  assert.equal((await call(admin + '/revoke',{})).status,303);
  assert.equal((await call(design,{ code:replacement })).status,403);
  const expired = await issue();
  db.exec('UPDATE invites SET expires=0');
  assert.equal((await call(design,{ code:expired })).status,403);
});

test('submission is one-use, private, versioned, and requires release approval',async () => {
  const { call,db } = context();
  await eligible(call);
  const { id } = db.prepare('SELECT id FROM previews').get();
  const preview = '/admin/preview/' + id;
  await call(preview + '/approval',{ mode:'approve',review:'yes' });
  const code = (await (await call(preview + '/invite',{})).text()).match(/<code>([^<]+)<\/code>/)[1];
  const design = '/design/' + id;
  const form = new FormData();
  for (const [key,value] of Object.entries({ ...copy, headline:'A new headline',code,confirmed:'yes',rights:'yes',instructions:'Prefer a green palette' })) form.set(key,value);
  form.set('logo',new File(['<svg/>'],'fake.png',{ type:'image/png' }));
  assert.equal((await call(design + '/submit',form)).status,400);
  form.set('logo',new File([png],'logo.png',{ type:'image/png' }));
  assert.equal((await call(design + '/submit',form)).status,201);
  assert.equal((await call(design + '/submit',form)).status,403);
  assert.equal(db.prepare('SELECT count(*) n FROM submissions').get().n,1);
  assert.equal(db.prepare('SELECT stage FROM prospects').get().stage,'Design Now submitted');
  const s = '/admin/submission/' + db.prepare('SELECT id FROM submissions').get().id;
  const draft = '/admin/draft/' + db.prepare('SELECT id FROM drafts').get().id;
  assert.equal((await call(s + '/asset/1',undefined,{ private:false })).status,403);
  const file = await call(s + '/asset/1');
  assert.equal(file.headers.get('content-type'),'image/png');
  assert.deepEqual(new Uint8Array(await file.arrayBuffer()),png);
  const brief = await (await call(s + '/brief')).json();
  assert.deepEqual(brief.changes.map(x=>x.label),['Main headline']);
  assert.equal(brief.instructions,'Prefer a green palette');
  assert.equal((await call(draft + '/export')).status,404);
  assert.equal((await call(draft + '/approve',{ review:'yes' })).status,303);
  const release = await call(draft + '/export');
  assert.equal(release.status,200);
  assert.match(await release.text(),/A new headline/);
  await call(s + '/draft',{ ...copy,headline:'Another version' });
  assert.equal(db.prepare('SELECT count(*) n FROM drafts').get().n,2);
  assert.match(await (await call(draft + '/export')).text(),/A new headline/);
  const publicSite = await (await call('/demo/' + id)).text();
  assert.doesNotMatch(publicSite,/A new headline|Prefer a green palette/);
});

test('dashboard filters, duplicate guard, and concurrent edit checks',async () => {
  const { call } = context(true);
  const filtered = await (await call('/admin?industry=Pressure+washing&q=Example+Pressure+Washing')).text();
  assert.match(filtered,/Example Pressure Washing/);
  assert.doesNotMatch(filtered,/Oak &amp; Elm/);
  const fields = { ...copy,industry:'Test',verification:'unreviewed',stage:'Discovered' };
  const loc = (await call('/admin/new',fields)).headers.get('location');
  assert.equal((await call('/admin/new',{ ...fields,name:'oak & elm' })).status,409);
  assert.equal((await call(loc,{ ...fields,revision:'0',notes:'new' })).status,303);
  assert.equal((await call(loc,{ ...fields,revision:'0',notes:'stale' })).status,409);
});

test('generator provides safe links, metadata, disclosures and three layouts',() => {
  for (const style of ['grove','coastal','studio']) {
    const html = renderSite({ ...copy,name:'<script>no</script>',style,image:'javascript:alert(1)' });
    assert.ok(html.includes('class="' + style + '"'));
    assert.match(html,/&lt;script&gt;no&lt;\/script&gt;/);
    assert.doesNotMatch(html,/javascript:alert/);
    assert.match(html,/<meta name="description"/);
    assert.match(html,/Website demonstration/);
    for (const id of ['services','contact','top']) assert.ok(html.includes('href="#' + id + '"') && html.includes('id="' + id + '"'));
  }
  assert.equal(identity('Acme Inc.','Austin, TX'),identity('ACME INC','Austin TX'));
  assert.equal(external('https://someone:secret@example.com'),'');
  assert.ok(completion({},copy,1,true).review.length > 1);
});

test('Access authentication accepts a signed assertion for only the configured application', async t => {
  const { privateKey,publicKey } = await crypto.subtle.generateKey({
    name:'RSASSA-PKCS1-v1_5',modulusLength:2048,publicExponent:new Uint8Array([1,0,1]),hash:'SHA-256'
  },true,['sign','verify']);
  const key = await crypto.subtle.exportKey('jwk',publicKey);
  const issuer = 'https://factory-test.cloudflareaccess.com';
  const encoder = new TextEncoder();
  const part = object => Buffer.from(JSON.stringify(object)).toString('base64url');
  t.mock.method(globalThis,'fetch',async url => {
    assert.equal(url,issuer + '/cdn-cgi/access/certs');
    return Response.json({ keys:[{ ...key,kid:'test' }] });
  });
  const { binding } = sqlite();
  const call = async overrides => {
    const data = part({alg:'RS256',kid:'test'}) + '.' + part({ iss:issuer,aud:['team-aud'],exp:Math.floor(Date.now()/1000)+600,
      email:'team@example.com',...overrides });
    const signature = await crypto.subtle.sign('RSASSA-PKCS1-v1_5',privateKey,encoder.encode(data));
    const req = new Request('https://factory.example.com/admin',{headers:{ 'Cf-Access-Jwt-Assertion':data + '.' +
      Buffer.from(signature).toString('base64url') } });
    return app.fetch(req,{ DB:binding,ACCESS_ISSUER:issuer,ACCESS_AUD:'team-aud' });
  };
  assert.equal((await call({})).status,200);
  assert.equal((await call({exp:0})).status,403);
  assert.equal((await call({aud:['other-app']})).status,403);
});

test('dashboard accepts Cloudflare runtime identity and rejects identity headers alone', async () => {
  const { binding } = sqlite();
  const env = { DB:binding };
  const url = 'https://factory.example.com/admin';
  const identity = { getIdentity: async () => ({ email:'team@example.com' }) };
  assert.equal((await app.fetch(new Request(url),env,{ access:identity })).status,200);

  const header = { 'Cf-Access-Authenticated-User-Email':'team@example.com' };
  assert.equal((await app.fetch(new Request(url,{ headers:header }),env,{})).status,403);
  assert.equal((await app.fetch(new Request(url),env,{ access:{ getIdentity:async () => ({}) } })).status,403);
});
