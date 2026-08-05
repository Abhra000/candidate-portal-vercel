// Vercel Serverless Function: emails HR two clean download links (combined PDF + ZIP)
// via Microsoft 365 SMTP, sending FROM your own @idealinsurance.in mailbox.
//
// Sending from your own domain to your own colleagues means the mail is internal and
// won't be spam-filtered/quarantined the way a personal Gmail sender was.
//
// Environment variables (Vercel → Settings → Environment Variables):
//   SMTP_USER                  -> hr.training@idealinsurance.in  (the sending mailbox)
//   SMTP_PASS                  -> that mailbox's password (or an app password)
//   SMTP_HOST                  -> optional, default smtp.office365.com
//   SMTP_PORT                  -> optional, default 587
//   HR_TO                      -> primary recipient
//   HR_CC                      -> optional comma-separated CC list
//   SUPABASE_URL               -> https://xxxx.supabase.co   (used by /api/download)
//   SUPABASE_SERVICE_ROLE_KEY  -> Supabase service_role key   (used by /api/download)
//   SITE_URL                   -> your site, e.g. https://candidateportal.vercel.app

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

    const { SMTP_USER, SMTP_PASS, HR_TO, HR_CC } = process.env;
    if (!SMTP_USER || !SMTP_PASS) {
      console.error("Missing SMTP env vars");
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
      host: process.env.SMTP_HOST || "smtp.office365.com",
      port: Number(process.env.SMTP_PORT || 587),
      secure: false,          // STARTTLS is negotiated on 587
      requireTLS: true,
      auth: { user: SMTP_USER, pass: SMTP_PASS },
      tls: { ciphers: "TLSv1.2" }
    });

    const when = new Date().toLocaleString("en-IN", { timeZone: "Asia/Kolkata" });
    const btn = (url, label) =>
      '<a href="' + url + '" style="background:#17324D;color:#fff;text-decoration:none;padding:11px 20px;border-radius:8px;display:inline-block;margin:4px 8px 4px 0">' + label + "</a>";

    await transporter.sendMail({
      from: '"Ideal Insurance HR" <' + SMTP_USER + '>',   // must match the authenticated mailbox
      to: HR_TO || SMTP_USER,
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
