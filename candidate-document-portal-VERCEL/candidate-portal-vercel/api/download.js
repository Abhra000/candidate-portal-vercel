// Vercel Serverless Function: turns a clean link into a fresh Supabase download.
// Email links point here (…/api/download?id=<base64 path>); on each click this mints
// a short-lived signed URL and redirects the browser to it.
//
// Env vars: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, SUPABASE_BUCKET (optional).

module.exports = async (req, res) => {
  try {
    const id = (req.query && req.query.id) || "";
    if (!id) return res.status(400).send("Missing id");

    const filePath = Buffer.from(String(id), "base64").toString("utf8");
    const { SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY } = process.env;
    const BUCKET = process.env.SUPABASE_BUCKET || "candidate-docs";
    if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
      return res.status(500).send("Storage is not configured on the server.");
    }

    const filename = filePath.split("/").pop() || "Documents";
    const r = await fetch(
      SUPABASE_URL + "/storage/v1/object/sign/" + BUCKET + "/" + encodeURI(filePath),
      {
        method: "POST",
        headers: {
          apikey: SUPABASE_SERVICE_ROLE_KEY,
          Authorization: "Bearer " + SUPABASE_SERVICE_ROLE_KEY,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ expiresIn: 300 })
      }
    );
    if (!r.ok) {
      const d = await r.text();
      return res.status(502).send("Could not create download link. " + d);
    }
    const j = await r.json();
    const signed = SUPABASE_URL + "/storage/v1" + j.signedURL + "&download=" + encodeURIComponent(filename);
    res.setHeader("Location", signed);
    return res.status(302).end();
  } catch (e) {
    return res.status(500).send("Error: " + (e && e.message ? e.message : "unknown"));
  }
};
