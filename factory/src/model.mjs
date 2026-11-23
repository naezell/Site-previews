export const stages = [
  'Discovered', 'Research needed', 'Qualified', 'Preview generated', 'Preview reviewed',
  'Ready for outreach', 'Contacted', 'Interested', 'Design Now submitted', 'In production',
  'Ready for approval', 'Published', 'Closed / Not interested'
];

export const verification = {
  unreviewed: 'Unreviewed', no_website_found: 'No website found', facebook_only: 'Facebook only',
  owner_confirmed_none: 'Owner confirmed no website', independent: 'Independent website found'
};
export const qualifying = ['no_website_found', 'facebook_only', 'owner_confirmed_none'];

export const pilotStatuses = {
  shortlisted:'Shortlisted', draft:'Draft ready', contacted:'Contacted', replied:'Replied',
  quoted:'Quoted', paid:'Paid', launched:'Launched', declined:'Declined', opted_out:'Opted out'
};
export const offerPrice = cents => new Intl.NumberFormat('en-US',{
  style:'currency', currency:'USD', minimumFractionDigits:cents % 100 ? 2 : 0
}).format(cents / 100);

export function pilotEmail(prospect, offer, preview) {
  const revisions = offer.revisions === 1 ? 'One round of revisions' : offer.revisions + ' rounds of revisions';
  const hosting = offer.monthly_cents > 0
    ? '\n\nOptional hosting and one small update per month are ' + offerPrice(offer.monthly_cents) + '/month.'
    : '';
  return {
    subject:'Website idea for ' + prospect.name,
    body:'Hi ' + prospect.name + ' team,\n\nI’m ' + offer.sender +
      ' with 7D Business Solutions. I put together a one-page website concept for your business.\n\n' +
      'Here’s the independent preview: ' + preview + '\n\n' +
      'If you like the direction, I can launch a site on a domain you own for ' + offerPrice(offer.setup_cents) +
      '. ' + offer.scope + (offer.revisions ? ' ' + revisions + ' included.' : '') +
      ' I aim to launch within ' + offer.business_days +
      ' business days after receiving your approved content and domain access.' + hosting +
      '\n\nWould you be open to a quick call to see if it would be useful for your business?\n\n' +
      offer.sender + '\n7D Business Solutions'
  };
}

export const escape = value => String(value ?? '').replace(/[&<>"']/g, character =>
  ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character]);

export function external(value) {
  try {
    const url = new URL(value);
    return url.protocol === 'https:' && !url.username && !url.password ? url.href : '';
  } catch {
    return '';
  }
}

export function identity(name, location) {
  return [name, location].map(value => value.normalize('NFKD').toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ').trim()).join('|');
}

export class Problem extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

export function field(form, name, max = 300, required = false) {
  const raw = form.get(name) ?? '';
  if (typeof raw !== 'string' || raw.length > max || (required && !raw.trim())) {
    throw new Problem(400, 'Check the required fields and their length limits.');
  }
  return raw.replace(/\r\n?/g, '\n').trim();
}

export function linkField(form, name, required = false) {
  const value = field(form, name, 1800, required);
  if (value && !external(value)) throw new Problem(400, 'Enter a complete HTTPS link.');
  return external(value);
}

export const siteFields = {
  name: 'Business name', location: 'Service area', headline: 'Main headline',
  intro: 'Intro under the headline', services: 'Services, one per line', about: 'About the business',
  hours: 'Business hours', phone: 'Business phone', email: 'Business email',
  contact: 'Contact section text'
};
export const longFields = ['intro', 'services', 'about', 'hours', 'contact'];
export const looks = { grove: 'Grove', studio: 'Studio', coastal: 'Coastal' };

export function siteContent(form, style = 'grove', image = '', imageAlt = '') {
  const content = Object.fromEntries(Object.keys(siteFields).map(key => [
    key, field(form, key, longFields.includes(key) ? 1800 : 180, key === 'name')
  ]));
  content.style = Object.hasOwn(looks, style) ? style : 'grove';
  content.image = image;
  content.imageAlt = imageAlt;
  if (content.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(content.email)) {
    throw new Problem(400, 'Enter a valid business email.');
  }
  if (content.phone && !/^\+?[0-9(). x-]{7,35}$/i.test(content.phone)) {
    throw new Problem(400, 'Enter a valid business phone number.');
  }
  return content;
}

export function completion(baseline, content, uploads, legacy) {
  const changes = Object.entries(siteFields).filter(([key]) => (baseline[key] || '') !== content[key])
    .map(([key, label]) => ({ label, previous: baseline[key] || '', requested: content[key] }));
  const missing = ['name', 'location', 'headline', 'intro', 'services', 'hours']
    .filter(key => !content[key]).map(key => siteFields[key]);
  if (!content.phone && !content.email) missing.push('Business phone or email');
  const review = ['Confirm the customer approves the final copy and public contact details.'];
  if (legacy) review.push('Compare requested copy with the original preview. Its HTML has no structured copy to diff.');
  if (uploads) review.push('Review uploaded files and approve individual assets before adding them to the final site.');
  if (content.image) review.push('Confirm image reuse rights and accessibility text.');
  return { changes, missing, review };
}

export async function images(form) {
  const assets = [];
  for (const kind of ['logo', 'photos']) {
    const files = form.getAll(kind).filter(file => file instanceof File && file.size);
    if (files.length > (kind === 'logo' ? 1 : 3)) throw new Problem(400, 'Add up to one logo and three photos.');
    for (const file of files) {
      if (file.size > 500_000) throw new Problem(400, 'Each image must be 500 KB or smaller.');
      const bytes = await file.arrayBuffer();
      const view = new Uint8Array(bytes);
      const starts = (at, signature) => signature.every((byte, index) => view[at + index] === byte);
      const mime = starts(0, [137,80,78,71,13,10,26,10]) && starts(12,[73,72,68,82])
        && starts(view.length - 8, [73,69,78,68,174,66,96,130]) ? 'image/png'
        : starts(0, [255,216,255]) && starts(view.length - 2, [255,217]) ? 'image/jpeg'
        : starts(0, [82,73,70,70]) && starts(8, [87,69,66,80,86,80,56]) && view.length >= 20
          && new DataView(bytes).getUint32(4, true) === view.length - 8 ? 'image/webp' : '';
      if (!mime || mime !== file.type) throw new Problem(400, 'Upload a PNG, JPEG, or WebP image.');
      assets.push({ kind, mime, bytes });
    }
  }
  if (assets.length && form.get('rights') !== 'yes') {
    throw new Problem(400, 'Confirm that you can authorize use of the uploaded images.');
  }
  return assets;
}
