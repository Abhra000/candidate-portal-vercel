/**
 * Google Apps Script — receives candidate form responses from the portal and
 * appends them as a row in this spreadsheet. Deploy as a Web App (see guide).
 * It writes a header row automatically on the first submission.
 */
function doPost(e) {
  var lock = LockService.getScriptLock();
  try {
    lock.waitLock(30000);
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var sheet = ss.getSheetByName("Responses") || ss.insertSheet("Responses");

    var data = JSON.parse(e.postData.contents);
    var keys = Object.keys(data);

    // First run: write header row (Timestamp + all field labels).
    if (sheet.getLastRow() === 0) {
      sheet.appendRow(["Timestamp"].concat(keys));
    }

    var headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];

    // Add any brand-new fields as extra columns so nothing is lost.
    keys.forEach(function (k) {
      if (headers.indexOf(k) === -1) {
        sheet.getRange(1, headers.length + 1).setValue(k);
        headers.push(k);
      }
    });

    var row = headers.map(function (h) {
      if (h === "Timestamp") return new Date();
      return data[h] !== undefined ? data[h] : "";
    });
    sheet.appendRow(row);

    return ContentService
      .createTextOutput(JSON.stringify({ ok: true }))
      .setMimeType(ContentService.MimeType.JSON);
  } catch (err) {
    return ContentService
      .createTextOutput(JSON.stringify({ ok: false, error: String(err) }))
      .setMimeType(ContentService.MimeType.JSON);
  } finally {
    lock.releaseLock();
  }
}

// Lets you open the web-app URL in a browser to confirm it's deployed.
function doGet() {
  return ContentService.createTextOutput("Candidate portal endpoint is live.");
}
