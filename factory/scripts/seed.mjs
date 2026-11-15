import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import { external, identity, verification } from '../src/model.mjs';

const stableId = key => {
  const sha = createHash('sha256').update(key).digest('hex');
  return [sha.slice(0,8),sha.slice(8,12),'4' + sha.slice(13,16),'8' + sha.slice(17,20),sha.slice(20,32)].join('-');
};
const sqlValue = value => "'" + String(value).replaceAll("'","''") + "'";
const csv = values => values.map(sqlValue).join(',');

export function makeSeed(rows) {
  const seen = new Set();
  const urls = new Set();
  const statements = [];
  for (const p of rows) {
    const key = identity(p.name,p.location);
    if (seen.has(key)) throw Error('Duplicate business identity: ' + key);
    seen.add(key);
    if (!Object.hasOwn(verification,p.verification)) throw Error('Unrecognized verification status.');
    const id = stableId('prospect:' + key);
    const stage = p.previews.length ? 'Preview generated' : 'Research needed';
    statements.push(`INSERT INTO prospects(id,identity,name,industry,location,phone,email,facebook,verification,reviewed,stage)
VALUES (${csv([id,key,p.name,p.industry,p.location,p.phone,p.email,external(p.facebook),p.verification,p.reviewed,stage])})
ON CONFLICT DO NOTHING;`);
    for (const item of p.evidence) {
      const url = external(item.url);
      if (!url) throw Error('Invalid source on ' + p.name);
      statements.push(`INSERT INTO evidence(id,prospect_id,source,url,finding,checked)
SELECT ${csv([stableId('evidence:' + id + ':' + item.source + ':' + url),id,item.source,url,item.finding,item.checked])}
WHERE EXISTS(SELECT 1 FROM prospects WHERE id=${sqlValue(id)}) ON CONFLICT DO NOTHING;`);
    }
    for (const item of p.previews) {
      const url = external(item.url);
      if (!url || urls.has(url)) throw Error('Invalid or duplicate preview URL on ' + p.name);
      urls.add(url);
      const deployment = [item.deployment,item.reference].filter(Boolean).join(' · ');
      statements.push(`INSERT INTO previews(id,prospect_id,url,label,deployment,asset_reference)
SELECT ${csv([stableId('preview:' + url),id,url,item.label,deployment,external(item.asset)])}
WHERE EXISTS(SELECT 1 FROM prospects WHERE id=${sqlValue(id)}) ON CONFLICT DO NOTHING;`);
    }
  }
  return statements.join('\n') + '\n';
}

if (process.argv[1] && new URL('./seed.mjs',import.meta.url).pathname === process.argv[1]) {
  const [, , input,output] = process.argv;
  if (!input || !output) throw Error('Usage: npm run seed -- /path/to/catalog.json /tmp/factory-seed.sql');
  const catalog = JSON.parse(readFileSync(input,'utf8'));
  writeFileSync(output,makeSeed(catalog));
  console.log(`Prepared ${catalog.length} prospect records and ${catalog.reduce((n,p)=>n+p.previews.length,0)} preview links.`);
}
