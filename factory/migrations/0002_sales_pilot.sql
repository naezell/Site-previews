CREATE TABLE sales_pilot_offer (
  id INTEGER PRIMARY KEY CHECK (id=1),
  setup_cents INTEGER NOT NULL,
  monthly_cents INTEGER NOT NULL,
  business_days INTEGER NOT NULL,
  revisions INTEGER NOT NULL,
  scope TEXT NOT NULL,
  sender TEXT NOT NULL,
  mailing_address TEXT NOT NULL DEFAULT '',
  revision INTEGER NOT NULL DEFAULT 0
);
INSERT INTO sales_pilot_offer
  (id, setup_cents, monthly_cents, business_days, revisions, scope, sender)
VALUES (1, 49900, 2900, 7, 1,
  'A one-page website with a project gallery, service area, tap-to-call, and a quote request form.',
  'Nate');

CREATE TABLE sales_pilot_prospects (
  prospect_id TEXT PRIMARY KEY REFERENCES prospects(id),
  wave TEXT NOT NULL DEFAULT '1' CHECK (wave IN ('1','2')),
  status TEXT NOT NULL DEFAULT 'shortlisted' CHECK (status IN (
    'shortlisted','draft','contacted','replied','quoted','paid','launched','declined','opted_out'
  )),
  follow_up TEXT NOT NULL DEFAULT '',
  notes TEXT NOT NULL DEFAULT '',
  subject TEXT NOT NULL DEFAULT '',
  body TEXT NOT NULL DEFAULT '',
  preview_id TEXT REFERENCES previews(id),
  revision INTEGER NOT NULL DEFAULT 0
);
