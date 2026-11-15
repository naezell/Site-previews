# Website Factory audit

November 15, 2026

| Surface | Observed | Implementation decision |
| --- | --- | --- |
| `naezell/Site-previews` | Main at `b319a2d`, with 18 preview directories, a static index, and robots rules. The repo does not contain the current Cloudflare application source. | Add the Factory under its own folder. Preserve the original tree and routes. |
| `naezell/local-business-one-page-template` | Separate static HTML/CSS reference for speculative and approved one-page builds. | Leave the repository intact. Follow its preview disclosure and content-review practices. |
| Cloudflare Pages | `7d-website-demos` is a direct-upload Pages project. Active production deployment `993461a7`. The public hub and legacy D1 registry each have the same 225 preview paths. | Record existing URLs verbatim. Keep the legacy application in charge of its own URLs. |
| Legacy customization | Pages exposes its existing private admin and customer widget. D1 has site registry, invite/session, file, and immutable submission tables. The registry returned zero submitted flags when checked. | Use the separate Factory showcase for new requests. Avoid migrating legacy credentials, uploads, or application rows. |
| Cloudflare account | Four existing Worker scripts were visible, with none named for this Factory. The production Pages binding is `DB`. R2 and Zero Trust Access are disabled. No active zones appeared. | Use one new Worker and dedicated D1. Require Access before staging or production intake. |
| Google Drive | Seven industry folders and trackers. The legacy link list and customization guide describe the initial 59 files. Later trackers and Pages show a larger collection. | Seed from the primary tracker tabs and reconcile against the current Pages registry. Leave Drive files and sharing untouched. |

The seed gives 235 prospects with 236 previews across landscaping, pool service, pressure washing, tree services, fencing, junk removal, and gutters. Two versions of Concrete Rescue are associated with one prospect. The public Pages hub accounts for 225 links. The other 11 are Netlify links carried forward from the landscaping tracker. All 236 URLs returned HTTP 200 with HTML at the original URL during the audit.

A single Factory Worker keeps routing and review in one place. Extending the current Pages app would require recovering and verifying the full current deployment package, including its existing private workflow. Splitting proposals into one Pages project per business would add preview and rollback administration. A dynamic Worker allows approved draft rendering without a separate host deployment per prospect and leaves the current URLs on Pages.

Production work still includes setting up Access, deploying the isolated staging Worker, confirming the organization's retention expectations, and selecting a customer publication process. Automated discovery requires an authorized provider and agreements that support the intended CRM data storage. Candidate review is currently the source of qualification decisions.
