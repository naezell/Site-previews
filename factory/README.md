# 7D Website Factory

An internal prospect and website production workspace for the Texas service business pipeline. The app runs as one Cloudflare Worker with its own D1 database. The existing Pages demo collection, customization routes, and database are separate.

## Daily workflow

1. Use **Find businesses** to open location-specific Google Maps, Yelp, and web searches. Add promising businesses to the research queue. Save each source, date, and finding. Use **No website found** for a search result. Use **Owner confirmed no website** only after direct confirmation. A Facebook-only listing can advance once its review is recorded.
2. Open a prospect to update its stage, assign a salesperson, and log interactions. Link an existing demo or generate one from evidence-backed copy. Existing versions remain linked to their original hosts.
3. Review the pages and approve the preview for presentation. Issue a one-use, seven-day code and share the Factory showcase link with it. A replacement or revocation disables the previous code. Legacy demos retain their existing URLs and widget. The new **Design Now** entry is on the Factory showcase, and on generated demos.
4. The customer confirms details, edits website sections, enters services/hours, uploads authorized images, and reviews the information. The submission creates a private brief and an initial draft.
5. Review the diff, missing fields, and files. For older static demos, compare the brief against the linked HTML. The baseline contains business and contact fields only. Prepare a revised version as needed. Approve the exact version and download its HTML and the work package. Images from the customer are deliberately delivered as separate private files for asset review and insertion. Older approved HTML remains available for rollback. Publish the finished build through the customer's intended host after final approval and record the published stage.

## Sales pilot

Open **Sales pilot** to set the offer and sender details. From **Prospects**, add existing businesses to the shortlist and assign their outreach wave. After approving a preview for presentation, generate an email that links to its customer showcase. Review and save edits before copying the draft. The copy action includes the business mailing address from the pilot offer. Send from your email client, then log replies, follow-up dates, payments, and launches in the pilot record. The dashboard counts confirmed payments and launches from those statuses.

## Local development

Requires Node.js 24 or later. Run these commands from `factory/`.

```sh
npm test
npm run seed -- /path/to/7D_Prospect_Import.json /tmp/factory-seed.sql
npx --yes wrangler@4.162.0 d1 migrations apply DB --local
npx --yes wrangler@4.162.0 d1 execute DB --local --file /tmp/factory-seed.sql
npx --yes wrangler@4.162.0 dev --local --ip 127.0.0.1 --var LOCAL_DEV:1
```

Open `http://127.0.0.1:8787/admin`. The local flag only permits loopback hostnames. Keep it out of deployed environment variables. The seed is idempotent and preserves application edits on repeated runs. Supply the separately delivered catalog when seeding. Keep the catalog and generated SQL out of the repository. Customer submissions, code hashes, drafts, and uploaded files stay in D1.

## Cloudflare staging and release

The repository config has a placeholder database ID and no public route. Set up a separate staging deployment after approval. Use an independent Worker and D1 database for staging, and a new database for the production Factory. Use synthetic submissions in staging.

1. Enable Cloudflare Zero Trust for the account. Create a self-hosted Access application for the chosen Factory URL's `/admin` and admin subpaths. Restrict access to the approved team. Keep the design/showcase/demo paths outside that policy. This account had no active zones at audit time. A path-protected `workers.dev` hostname can be used, or add a custom hostname once a zone is available. Keep deploy preview URLs disabled. Confirm direct requests to private routes also fail without a signed Access assertion.
2. Run `npx wrangler d1 create 7d-website-factory-staging`. Copy `wrangler.toml` to `wrangler.local.toml`, set a staging Worker name and the resulting D1 name and ID, and add `ACCESS_ISSUER` (the HTTPS Access team domain without a trailing slash) and `ACCESS_AUD` (the Access application's audience tag) under `[vars]`. Enable `workers_dev` only for the path-protected staging hostname, or attach the intended custom domain.
3. Apply the migration and import to the new database. Use the same configuration for deployment. Keep the production Pages binding out of this configuration.

   ```sh
   npx wrangler d1 migrations apply DB --remote --config wrangler.local.toml
   npx wrangler d1 execute DB --remote --file /tmp/factory-seed.sql --config wrangler.local.toml
   npx wrangler deploy --config wrangler.local.toml
   ```

4. Test as an authenticated team member, an anonymous customer, and an unauthorized browser. Verify code replacement and expiration, wrong-prospect codes, image uploads and private downloads, and release approvals. Confirm that the old Pages hub and demos still resolve. Configure a retention period and access review cadence before accepting real customer uploads.
5. Provision production separately after review. Keep the previous approved HTML and assets for each published customer site. Restore a previous approved artifact in its host if needed. For the Factory itself, use a prior Worker version and compatible migrations. Recover D1 separately if data recovery is required.

## Data and limits

- The one-time Drive import reads the seven primary tracker tabs and references, and joins them to the 225 URL slugs in the existing Pages registry. It retains 11 additional Netlify links. Held/excluded tabs and unlinked GitHub folders are outside this seed.
- The catalog stores historic findings as reported. Blank verification dates remain blank, and the site stays private inside the Factory until a team user approves presentation. An import does not grant independent confirmation, presentation approval, or code issuance.
- The Factory enforces normalized name/location duplicate detection and unique preview URLs. Similar records with materially different spellings or cities require human review. Changed records are protected by a revision check.
- Up to one logo and three photos, each up to 500 KB, are stored in private D1 rows. Modern browsers resize larger photos locally when possible. Storage and the one-use submission are committed in a single D1 batch. Server rules check size, media type, and file signatures. Files are served only as authenticated downloads. Signature checks are coarse; use asset review before reuse and keep uploads out of public HTML. R2 was disabled in the audited account. Reassess storage after measuring pilot upload volume.
- Google Maps and Yelp are linked for human lookup. No scraper or paid API is enabled. A future licensed provider needs its own terms review, quotas, source/date tracking, and a decision on which fields can be persisted. The application uses no runtime AI calls.
- Live deployment health and external customer-host publication are operational steps. The Factory records references and approved exports, while Cloudflare account deployment hooks and per-customer domain automation are future work.

## Cloudflare references

- [Workers with Cloudflare Access](https://developers.cloudflare.com/workers/configuration/cloudflare-access/)
- [D1 Workers binding](https://developers.cloudflare.com/d1/worker-api/)
- [D1 limits](https://developers.cloudflare.com/d1/platform/limits/)
- [Cloudflare Pages direct uploads](https://developers.cloudflare.com/pages/get-started/direct-upload/)
