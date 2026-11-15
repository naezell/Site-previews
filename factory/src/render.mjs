import { escape as e, external, looks } from './model.mjs';

const colors = {
  grove: ['#183529','#f4f1df','#e5bd72','#284f3c'],
  studio: ['#282436','#fbf2e9','#edc5b2','#523f64'],
  coastal: ['#10374b','#eff8f8','#b4edeb','#17546a']
};

export function renderSite(content, { demo = true, design = '', privateDraft = false } = {}) {
  const style = Object.hasOwn(looks, content.style) ? content.style : 'grove';
  const [dark,light,accent,mid] = colors[style];
  const image = external(content.image);
  const phone = (content.phone || '').replace(/[^+0-9]/g,'');
  const services = (content.services || '').split('\n').map(line => line.trim()).filter(Boolean);
  const copy = (label,value) => value ? '<section class="block"><h2>' + e(label) + '</h2><p>' + e(value) + '</p></section>' : '';
  const description = (content.intro || [content.name,content.location].filter(Boolean).join(' · ')).slice(0,155);
  const disclosure = privateDraft ? 'Private website draft' : 'Website demonstration prepared by 7D. This concept is separate from the business.';
  return '<!doctype html><html class="' + style + '" lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">' +
    (demo || privateDraft ? '<meta name="robots" content="noindex,nofollow">' : '') +
    '<meta name="description" content="' + e(description) + '"><title>' + e(content.name) + '</title><style>' +
    `:root{--dark:${dark};--light:${light};--accent:${accent};--mid:${mid};font:17px/1.65 system-ui,sans-serif;color:var(--dark);background:var(--light)}*{box-sizing:border-box}body{margin:0}a{color:inherit;text-underline-offset:.18em}a:focus-visible{outline:3px solid currentColor;outline-offset:4px}.wrap{width:min(74rem,calc(100% - 2rem));margin:auto}header{padding:1.1rem 0;font-weight:800;border-bottom:1px solid currentColor}header .wrap,nav{display:flex;flex-wrap:wrap;justify-content:space-between;gap:.75rem 1.3rem}.notice{background:var(--accent);padding:.44rem 1rem;text-align:center;font-size:.91rem}.hero{background:var(--dark);color:var(--light);padding:clamp(2rem,7vw,6.5rem) 0}.hero-inner{display:grid;gap:clamp(1rem,4vw,3rem);align-items:center}.hero-inner.with-image{grid-template-columns:1.1fr 1fr}.hero img{width:100%;aspect-ratio:4/3;object-fit:cover;border-radius:2rem 2rem 0 0}h1,h2,p{margin:0 0 1rem}h1{font:700 clamp(2.75rem,8vw,6rem)/.98 Georgia,serif;letter-spacing:-.035em;overflow-wrap:anywhere}h2{font:700 clamp(1.9rem,5vw,3.25rem)/1.1 Georgia,serif}.location{color:var(--accent);font-weight:750}.lead{max-width:42ch;font-size:1.15rem}.button{display:inline-block;padding:.65rem 1.1rem;border-radius:8px;background:var(--accent);color:var(--dark);font-weight:800;text-decoration:none;min-height:44px}.block{padding:clamp(1.6rem,5vw,4rem) 0;border-bottom:1px solid currentColor}.block p{max-width:67ch;white-space:pre-wrap;overflow-wrap:anywhere}.services{padding:0;list-style:none;display:grid;gap:1rem;grid-template-columns:repeat(auto-fit,minmax(min(100%,14rem),1fr))}.services li{border:1px solid var(--mid);padding:1rem;background:white;font-weight:750;overflow-wrap:anywhere}.service-line{display:block;width:2rem;height:.2rem;background:var(--mid);margin-bottom:.7rem}.studio h1,.studio h2{font-family:system-ui,sans-serif;letter-spacing:-.07em}.studio .hero-inner.with-image{grid-template-columns:1fr 1.2fr}.studio .hero-inner img{grid-row:1;grid-column:1;border-radius:0}.studio .hero-inner.with-image>div{grid-column:2}.studio .services li{background:var(--accent);border:0}.coastal .hero .wrap{text-align:center}.coastal .hero-inner.with-image{grid-template-columns:1fr}.coastal .hero-inner img{aspect-ratio:3/1;border-radius:20px}.coastal .lead{margin-inline:auto}.coastal .services{grid-template-columns:1fr}.coastal .services li{border-radius:100px}.coastal .service-line{display:none}footer{margin-top:2rem;padding:1.5rem 0;background:var(--dark);color:var(--light)}@media(max-width:680px){.hero .hero-inner.with-image{grid-template-columns:1fr}.studio .hero-inner.with-image>div,.studio .hero-inner img{grid-row:auto;grid-column:auto}.coastal .hero-inner img{aspect-ratio:4/3}}` +
    '</style></head><body>' + (demo || privateDraft ? '<aside class="notice">' + e(disclosure) + '</aside>' : '') +
    '<header><div class="wrap"><a href="#top">' + e(content.name) + '</a><nav aria-label="Main navigation">' +
    (services.length ? '<a href="#services">Services</a>' : '') + '<a href="#contact">Contact</a>' +
    (design ? '<a href="' + e(design) + '">Design Now</a>' : '') + '</nav></div></header><main id="top">' +
    '<section class="hero"><div class="wrap"><div class="hero-inner' + (image ? ' with-image' : '') + '"><div>' +
    (content.location ? '<p class="location">' + e(content.location) + '</p>' : '') + '<h1>' + e(content.headline || content.name) +
    '</h1>' + (content.intro ? '<p class="lead">' + e(content.intro) + '</p>' : '') +
    '<a class="button" href="#contact">Contact ' + e(content.name) + '</a></div>' +
    (image ? '<img src="' + e(image) + '" alt="' + e(content.imageAlt) + '" width="800" height="600" decoding="async" referrerpolicy="no-referrer">' : '') +
    '</div></div></section><div class="wrap">' +
    (services.length ? '<section class="block" id="services"><h2>Services</h2><ul class="services">' +
      services.map(service => '<li><span class="service-line" aria-hidden="true"></span>' + e(service) + '</li>').join('') + '</ul></section>' : '') +
    copy('About',content.about) + copy('Business hours',content.hours) + '<section class="block" id="contact"><h2>Contact</h2>' +
    (content.contact ? '<p>' + e(content.contact) + '</p>' : '') +
    (phone ? '<p><a href="tel:' + e(phone) + '">' + e(content.phone) + '</a></p>' : '') +
    (content.email ? '<p><a href="mailto:' + e(encodeURIComponent(content.email).replace(/%40/g,'@')) + '">' + e(content.email) + '</a></p>' : '') +
    '</section></div></main><footer><div class="wrap">' + e(content.name) + '</div></footer></body></html>';
}

export function quality(content) {
  const missing = ['headline','intro','services','location'].filter(key => !content[key]?.trim());
  if (!content.phone && !content.email) missing.push('phone or email');
  if (content.image && !content.imageAlt) missing.push('image description');
  return missing;
}
