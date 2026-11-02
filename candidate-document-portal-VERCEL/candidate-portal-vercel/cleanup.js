// Vercel Serverless Function: deletes candidate files older than RETENTION_DAYS.
//
// Runs automatically every day via the Vercel Cron defined in vercel.json.
// Each submission is stored in a folder whose name starts with the upload time in
// milliseconds (e.g. "1730000000000-ab12cd34"). This reads that leading timestamp,
// and anything older than the retention window is removed from the bucket — so the
// bucket only ever holds roughly the last RETENTION_DAYS of submissions and never
// hits the Supabase storage quota again.
//
// Env vars:
//   SUPABASE_URL               -> e.g. https://abcdxyz.supabase.co
//   SUPABASE_SERVICE_ROLE_KEY  -> the project's service_role key (keep secret!)
//   SUPABASE_BUCKET            -> storage bucket name (default: candidate-docs)
//   RETENTION_DAYS             -> how many days of data to keep (default: 30)
//   CRON_SECRET                -> set this in Vercel; Vercel sends it automatically
//                                 on cron calls so nobody else can trigger cleanup.

module.exports = async (req, res) => {
  try {
    // Only let Vercel Cron (or someone with the secret) run this.
    const secret = process.env.CRON_SECRET;
    if (secret) {
      const auth = req.headers["authorization"] || "";
      const qs = (req.query && req.query.secret) || "";
      if (auth !== "Bearer " + secret && qs !== secret) {
        return res.status(401).send("Unauthorized");
      }
    }

    const { SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY } = process.env;
    const BUCKET = process.env.SUPABASE_BUCKET || "candidate-docs";
    const retentionDays = Number(process.env.RETENTION_DAYS || 30);
    if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
      return res.status(500).send("Storage is not configured on the server.");
    }

    const base = SUPABASE_URL + "/storage/v1";
    const headers = {
      apikey: SUPABASE_SERVICE_ROLE_KEY,
      Authorization: "Bearer " + SUPABASE_SERVICE_ROLE_KEY,
      "Content-Type": "application/json"
    };
    const cutoff = Date.now() - retentionDays * 24 * 60 * 60 * 1000;

    // 1) List the top-level folders (one per submission), paging through all of them.
    const folders = [];
    let offset = 0;
    const pageSize = 1000;
    while (true) {
      const r = await fetch(base + "/object/list/" + BUCKET, {
        method: "POST",
        headers,
        body: JSON.stringify({
          prefix: "",
          limit: pageSize,
          offset,
          sortBy: { column: "name", order: "asc" }
        })
      });
      if (!r.ok) {
        const d = await r.text();
        return res.status(502).send("List failed: " + d);
      }
      const page = await r.json();
      if (!Array.isArray(page) || page.length === 0) break;
      page.forEach(function (item) { folders.push(item.name); });
      if (page.length < pageSize) break;
      offset += pageSize;
    }

    // 2) Decide which folders are past the retention window.
    const expired = folders.filter(function (name) {
      const ts = parseInt(String(name).split("-")[0], 10);
      return Number.isFinite(ts) && ts < cutoff;
    });

    // 3) For each expired folder, list its files and delete them.
    let deletedFiles = 0;
    for (const folder of expired) {
      const lr = await fetch(base + "/object/list/" + BUCKET, {
        method: "POST",
        headers,
        body: JSON.stringify({
          prefix: folder,
          limit: pageSize,
          offset: 0,
          sortBy: { column: "name", order: "asc" }
        })
      });
      if (!lr.ok) continue;
      const files = await lr.json();
      if (!Array.isArray(files) || files.length === 0) continue;
      const prefixes = files.map(function (f) { return folder + "/" + f.name; });
      const dr = await fetch(base + "/object/" + BUCKET, {
        method: "DELETE",
        headers,
        body: JSON.stringify({ prefixes })
      });
      if (dr.ok) deletedFiles += prefixes.length;
    }

    const summary = {
      ok: true,
      retentionDays,
      foldersScanned: folders.length,
      foldersExpired: expired.length,
      filesDeleted: deletedFiles
    };
    console.log("cleanup:", JSON.stringify(summary));
    return res.status(200).json(summary);
  } catch (e) {
    console.error("cleanup failed:", e);
    return res.status(500).send("Cleanup error: " + (e && e.message ? e.message : "unknown"));
  }
};
