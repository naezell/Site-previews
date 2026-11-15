CREATE TABLE prospects (
  id TEXT PRIMARY KEY,
  identity TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  industry TEXT NOT NULL,
  location TEXT NOT NULL DEFAULT '',
  phone TEXT NOT NULL DEFAULT '',
  email TEXT NOT NULL DEFAULT '',
  facebook TEXT NOT NULL DEFAULT '',
  website TEXT NOT NULL DEFAULT '',
  verification TEXT NOT NULL DEFAULT 'unreviewed',
  salesperson TEXT NOT NULL DEFAULT '',
  stage TEXT NOT NULL DEFAULT 'Discovered',
  notes TEXT NOT NULL DEFAULT '',
  reviewed TEXT NOT NULL DEFAULT '',
  revision INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX prospect_filters ON prospects(industry, stage, verification);
CREATE TABLE evidence (
  id TEXT PRIMARY KEY,
  prospect_id TEXT NOT NULL REFERENCES prospects(id),
  source TEXT NOT NULL,
  url TEXT NOT NULL,
  finding TEXT NOT NULL,
  checked TEXT NOT NULL DEFAULT ''
);
CREATE INDEX evidence_prospect ON evidence(prospect_id);
CREATE TABLE previews (
  id TEXT PRIMARY KEY,
  prospect_id TEXT NOT NULL REFERENCES prospects(id),
  url TEXT UNIQUE,
  label TEXT NOT NULL,
  deployment TEXT NOT NULL DEFAULT '',
  approved INTEGER NOT NULL DEFAULT 0,
  content TEXT,
  asset_reference TEXT NOT NULL DEFAULT ''
);
CREATE INDEX previews_prospect ON previews(prospect_id);
CREATE TABLE invites (
  hash TEXT PRIMARY KEY,
  preview_id TEXT NOT NULL REFERENCES previews(id),
  expires INTEGER NOT NULL,
  revoked INTEGER NOT NULL DEFAULT 0,
  used INTEGER NOT NULL DEFAULT 0
);
CREATE UNIQUE INDEX one_active_invite ON invites(preview_id) WHERE revoked=0 AND used=0;
CREATE TABLE attempts (
  bucket TEXT PRIMARY KEY,
  hits INTEGER NOT NULL,
  expires INTEGER NOT NULL
);
CREATE INDEX attempts_expiry ON attempts(expires);
CREATE TABLE submissions (
  id TEXT PRIMARY KEY,
  preview_id TEXT NOT NULL REFERENCES previews(id),
  invite_hash TEXT NOT NULL UNIQUE REFERENCES invites(hash),
  baseline TEXT NOT NULL,
  content TEXT NOT NULL,
  created TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX submissions_preview ON submissions(preview_id, created);
CREATE TRIGGER accept_submission AFTER INSERT ON submissions BEGIN
  UPDATE invites SET used=1 WHERE hash=NEW.invite_hash;
  UPDATE prospects SET stage=CASE WHEN stage IN ('In production','Ready for approval','Published','Closed / Not interested')
    THEN stage ELSE 'Design Now submitted' END, revision=revision+1
    WHERE id=(SELECT prospect_id FROM previews WHERE id=NEW.preview_id);
END;
CREATE TABLE uploads (
  submission_id TEXT NOT NULL REFERENCES submissions(id),
  number INTEGER NOT NULL,
  kind TEXT NOT NULL,
  mime TEXT NOT NULL,
  bytes BLOB NOT NULL,
  PRIMARY KEY (submission_id, number)
);
CREATE TABLE drafts (
  id TEXT PRIMARY KEY,
  submission_id TEXT NOT NULL REFERENCES submissions(id),
  content TEXT NOT NULL,
  created TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  approved_by TEXT,
  approved_at TEXT
);
CREATE INDEX drafts_submission ON drafts(submission_id, created);
CREATE TABLE activities (
  id TEXT PRIMARY KEY,
  prospect_id TEXT NOT NULL REFERENCES prospects(id),
  actor TEXT NOT NULL,
  note TEXT NOT NULL,
  created TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX activities_prospect ON activities(prospect_id, created);
CREATE TRIGGER withdraw_ineligible_previews AFTER UPDATE OF verification, stage ON prospects
WHEN NEW.verification NOT IN ('no_website_found','facebook_only','owner_confirmed_none')
  OR NEW.stage='Closed / Not interested'
BEGIN
  UPDATE invites SET revoked=1 WHERE used=0 AND preview_id IN
    (SELECT id FROM previews WHERE prospect_id=NEW.id AND approved=1);
  UPDATE previews SET approved=0 WHERE prospect_id=NEW.id AND approved=1;
END;
