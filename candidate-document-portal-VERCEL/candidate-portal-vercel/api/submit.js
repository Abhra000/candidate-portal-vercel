// Vercel Serverless Function: emails HR two clean download links (combined PDF + ZIP).
//
// The browser uploads a merged PDF and a ZIP to Supabase, then calls this with both
// file paths. We email HR links to our own /api/download route (base64 path, no token,
// no ".zip"/".pdf" in the URL) so Gmail's outbound filter won't block the message.
//
// Environment variables (set in the Vercel dashboard → Settings → Environment Variables):
//   GMAIL_USER                 -> Gmail address that sends the mail
//   GMAIL_APP_PASSWORD         -> 16-char Gmail App Password for that SAME account
//   HR_TO                      -> primary recipient
//   HR_CC                      -> optional comma-separated CC list
//   SUPABASE_URL               -> https://xxxx.supabase.co   (used by /api/download)
//   SUPABASE_SERVICE_ROLE_KEY  -> the project's service_role key (used by /api/download)
//   SITE_URL                   -> your site's address, e.g. https://your-app.vercel.app
//                                 (recommended; otherwise Vercel's own URL is used)

const nodemailer = require("nodemailer");

module.exports = async (req, res) => {
  setCors(res);
  if (req.method === "OPTIONS") return res.status(204).end();
  if (req.method !== "POST") return res.status(405).send("Method not allowed");

  try {
    let p = req.body;
    if (!p || typeof p === "string") { try { p = JSON.parse(p || "{}"); } catch (e) { p = {}; } }

    const candidateName = String(p.name || "Candidate").slice(0, 200);
    const candidateEmail = String(p.email || "").slice(0, 200);
    const pdfPath = String(p.pdfPath || "").slice(0, 500);
    const zipPath = String(p.zipPath || "").slice(0, 500);
    const sizeMB = p.size ? (Number(p.size) / 1048576).toFixed(1) + " MB" : "unknown";

    if (!pdfPath && !zipPath) return res.status(400).send("Missing file path");

    const { GMAIL_USER, GMAIL_APP_PASSWORD, HR_TO, HR_CC } = process.env;
    if (!GMAIL_USER || !GMAIL_APP_PASSWORD) {
      console.error("Missing Gmail env vars");
      return res.status(500).send("Email is not configured on the server.");
    }

    const site = (
      process.env.SITE_URL ||
      (process.env.VERCEL_PROJECT_PRODUCTION_URL ? "https://" + process.env.VERCEL_PROJECT_PRODUCTION_URL : "") ||
      (process.env.VERCEL_URL ? "https://" + process.env.VERCEL_URL : "")
    ).replace(/\/+$/, "");

    const link = (path) => site + "/api/download?id=" + encodeURIComponent(Buffer.from(path, "utf8").toString("base64"));
    const pdfUrl = pdfPath ? link(pdfPath) : "";
    const zipUrl = zipPath ? link(zipPath) : "";

    const transporter = nodemailer.createTransport({
      service: "gmail",
      auth: { user: GMAIL_USER, pass: GMAIL_APP_PASSWORD }
    });

    const when = new Date().toLocaleString("en-IN", { timeZone: "Asia/Kolkata" });
    const btn = (url, label) =>
      '<a href="' + url + '" style="background:#17324D;color:#fff;text-decoration:none;padding:11px 20px;border-radius:8px;display:inline-block;margin:4px 8px 4px 0">' + label + "</a>";

    await transporter.sendMail({
      from: '"Document Portal" <' + GMAIL_USER + '>',
      to: HR_TO || GMAIL_USER,
      cc: HR_CC || undefined,
      replyTo: candidateEmail || undefined,
      subject: "New candidate documents - " + candidateName,
      text:
        "A candidate has submitted their pre-joining documents.\n\n" +
        "Candidate name : " + candidateName + "\n" +
        "Candidate email: " + (candidateEmail || "(not provided)") + "\n" +
        "Submitted at   : " + when + " IST\n" +
        "Package size   : " + sizeMB + "\n\n" +
        (pdfUrl ? "Combined PDF: " + pdfUrl + "\n" : "") +
        (zipUrl ? "Original files (ZIP): " + zipUrl + "\n" : "") +
        "\nThe candidate's full form details are recorded in the HR Google Sheet.\n",
      html:
        '<div style="font-family:Arial,Helvetica,sans-serif;font-size:14px;color:#1f2937;line-height:1.6">' +
        "<p>A candidate has submitted their pre-joining documents.</p>" +
        '<table style="border-collapse:collapse;font-size:14px">' +
        '<tr><td style="padding:2px 12px 2px 0;color:#6b7280">Candidate name</td><td><b>' + escapeHtml(candidateName) + "</b></td></tr>" +
        '<tr><td style="padding:2px 12px 2px 0;color:#6b7280">Candidate email</td><td>' + (escapeHtml(candidateEmail) || "(not provided)") + "</td></tr>" +
        '<tr><td style="padding:2px 12px 2px 0;color:#6b7280">Submitted at</td><td>' + when + " IST</td></tr>" +
        '<tr><td style="padding:2px 12px 2px 0;color:#6b7280">Package size</td><td>' + sizeMB + "</td></tr>" +
        "</table>" +
        '<p style="margin:18px 0">' + (pdfUrl ? btn(pdfUrl, "Download combined PDF") : "") + (zipUrl ? btn(zipUrl, "Download original files (ZIP)") : "") + "</p>" +
        '<p style="color:#6b7280;font-size:12px">The candidate\'s full form details are recorded in the HR Google Sheet.</p>' +
        "</div>"
    });

    return res.status(200).json({ ok: true });
  } catch (err) {
    console.error("submit failed:", err);
    return res.status(500).send("Send failed: " + (err && err.message ? err.message : "unknown error"));
  }
};

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, function (c) {
    return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
  });
}
function setCors(res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
}
