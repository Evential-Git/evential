# Mailing list setup

The homepage includes an optional email signup. Contacts are stored in Supabase;
only project team members can browse them in **Table Editor → mailing_contacts**.
There is no public contact-list endpoint or browser-held admin key.

## Evential deployment

Project: `myptrikcoblkypdnpekb`.
[Open the private contact list in Supabase Table Editor](https://supabase.com/dashboard/project/myptrikcoblkypdnpekb/editor),
then select `mailing_contacts`. Your Supabase project login is required.

The schema and signup function were deployed on September 28, 2026. The initial
25 contacts were imported with one unsubscribe preserved. The public site key
and endpoint are configured in `mailing-list-config.js`; the Turnstile secret
is stored in Supabase. No private contact exports or secret keys are in this repo.

The setup instructions below are for recreating the service; do not reapply the
initial schema or reimport the list into the already configured project.

## Activate

1. Create or select your Supabase project. In SQL Editor run
   `supabase/migrations/20260928000000_mailing_contacts.sql` once.
2. Import the separately supplied **contacts.csv** into `mailing_contacts` using
   Table Editor's CSV import. Import before enabling website signup. Check that
   there are 25 contacts, one with `unsubscribed = true`. Imported contacts have
   no recorded consent timestamp; the migration intentionally leaves it empty.
   The CSV is outside this repository and must stay outside the published site.
3. Create a Cloudflare Turnstile widget for `evential.co` and `www.evential.co`.
   Set `TURNSTILE_SECRET_KEY` in Supabase Edge Function secrets. Supabase provides
   `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` to the function automatically.
   Optional `ALLOWED_ORIGINS` is a comma-separated list of exact origins; defaults
   to `https://evential.co,https://www.evential.co`.
4. Deploy the function with the Supabase CLI after authenticating:
   `supabase functions deploy mailing-list --project-ref YOUR_PROJECT_REF --no-verify-jwt`.
   Both `index.ts` and `handler.mjs` are required. This is a public signup endpoint;
   it validates Turnstile on the server before inserting anything.
5. Fill in `endpoint` and the public `turnstileSiteKey` in
   `mailing-list-config.js`, then publish the static website through its normal
   deployment. Never place service-role keys or the Turnstile secret in this file.

Until both public configuration values are filled in, the homepage offers an
email-to-join link. It does not claim to save signups. A project connection and
Turnstile keys are required to activate the form.

## Manage contacts

- Use Table Editor to search, edit and export contacts. `contact_type` retains
  Event / Investor / Mentor categories; website signups use Website.
- Mark `unsubscribed = true` when an unsubscribe request arrives at
  `contact@evential.co`. Monitor this inbox. Filter exports by
  `unsubscribed = false`; retain suppressed contacts to prevent reimporting them.
- Duplicate email signups are ignored, including unsubscribed addresses. The
  public form cannot change existing contact information or restore subscriptions.
  Handle verified resubscription requests manually in the dashboard.
- Existing-list membership is preserved; imported consent is unknown. The
  website stores the time and exact opt-in statement for new signups.
- This implements collection and private management, not campaign delivery or
  email ownership verification. No emails are sent by the signup function.
  Include a working unsubscribe mechanism when setting up a sending service.
- Local CSV/SQLite copies contain personal data. Keep a secure backup outside
  the website folder; temporary files may be cleaned up by the OS.

## Verification

Run `node --test tools/mailing-list.test.mjs` for request validation, consent,
CAPTCHA, failure handling and the duplicate-preserving write contract.

After deploying, verify a new signup appears in Table Editor, duplicate signups
do not create extra rows, and a previously unsubscribed test contact stays
unsubscribed. Check that the table rejects reads and writes with both the anon
key and a normal authenticated user token. Only the server service role and
project administrators should have access. These deployment checks require a
live project; local tests do not replace them.

Implementation references: [Supabase database access controls](https://supabase.com/docs/guides/api/securing-your-api)
and [server-side Turnstile verification](https://supabase.com/docs/guides/functions/examples/cloudflare-turnstile).
