# Candidate Document Portal — Vercel Deployment

Same portal as before, now on Vercel. Structure:

```
index.html            the portal page (posts to /api/submit)
thankyou.html         confirmation page
logo.png              company logo (also embedded in index.html)
api/submit.js         Vercel function: emails HR the two download links
api/download.js       Vercel function: mints a fresh Supabase link and redirects
package.json          declares nodemailer
google-sheet/Code.gs  Apps Script for the Google Sheet (paste into Apps Script, NOT deployed here)
```

Vercel auto-detects: static files are served from the root, and every file in `api/`
becomes a serverless function at `/api/<name>`. No vercel.json needed.

---

## Step 1 — Push this project to GitHub
Put these files in a repo (you can reuse your existing repo — just make sure it now has
the `api/` folder and NO `netlify/` folder / `netlify.toml`, to avoid confusion).

## Step 2 — Import into Vercel
1. Go to https://vercel.com and sign up / log in (use "Continue with GitHub").
2. **Add New… → Project → Import** your GitHub repo.
3. Framework preset: **Other** (it's a static site + functions). Leave build command empty
   and output directory default. Click **Deploy**. Wait ~1 min for the first deploy.
4. Note your production URL, e.g. `https://your-app.vercel.app`.

## Step 3 — Environment variables (Vercel → Project → Settings → Environment Variables)
Add each of these (Environment: Production, Preview, Development — tick all):

| Key | Value |
|-----|-------|
| `GMAIL_USER` | `ideal01@gmail.com` (the sending Gmail) |
| `GMAIL_APP_PASSWORD` | 16-char App Password made on that SAME Gmail account |
| `HR_TO` | `hr.training@idealinsurance.in` |
| `HR_CC` | `ta@idealinsurance.in` |
| `SUPABASE_URL` | `https://mokgrqaecgjtchndkpvs.supabase.co` |
| `SUPABASE_SERVICE_ROLE_KEY` | your Supabase **service_role** secret key |
| `SUPABASE_BUCKET` | `candidate-docs` (optional) |
| `SITE_URL` | your Vercel URL, e.g. `https://your-app.vercel.app` (recommended) |

`SITE_URL` is what the email links are built from. If you skip it, the code falls back to
Vercel's own URL, but setting it explicitly avoids preview-URL surprises.

After adding/changing variables, **redeploy**: Deployments → latest → ••• → **Redeploy**.

## Step 4 — Test
Open your Vercel URL, fill Name + Personal email, attach a file, submit. You should land on
the thank-you page, a row should appear in the Google Sheet, and HR should get an email with
**Download combined PDF** and **Download original files (ZIP)** buttons.

Logs for debugging: Vercel → your project → **Deployments → (latest) → Functions**, or the
**Logs** tab. `submit` errors show there.

---

## Notes
- The portal's `index.html` already contains your Supabase URL + anon key and the Google
  Apps Script URL — nothing to edit.
- Supabase storage, the upload policy, and the Google Sheet are unchanged from the Netlify
  setup; only hosting + the two functions moved.
- If you keep the old Netlify site, you can delete it once Vercel is verified.
