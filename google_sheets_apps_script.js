/**
 * Google Apps Script Webhook Handler for WhatsApp Bot Leads
 * 
 * Instructions:
 * 1. Open your Google Sheet: https://sheets.new
 * 2. Go to Extensions > Apps Script
 * 3. Replace all code with this script
 * 4. Click Deploy > New Deployment
 * 5. Select type: Web app
 *    - Execute as: Me
 *    - Who has access: Anyone
 * 6. Copy the Web App URL and paste it into config.json ("googleSheetsWebhookUrl")
 */

function doPost(e) {
  try {
    var sheet = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();
    
    // Auto-create headers if sheet is empty
    if (sheet.getLastRow() === 0) {
      sheet.appendRow([
        "Timestamp",
        "Customer Name",
        "Phone Number",
        "Occasion",
        "Location",
        "Date of Event",
        "Time Slot",
        "Guests",
        "Selected Theatre / Package",
        "Package Price",
        "Add-ons",
        "Estimated Total",
        "Status"
      ]);
      sheet.getRange(1, 1, 1, 13).setFontWeight("bold").setBackground("#f3f4f6");
    }

    var contents = e.postData.contents;
    var data = JSON.parse(contents);

    var timestamp = new Date().toLocaleString("en-IN", { timeZone: "Asia/Kolkata" });
    var name = data.name || data.customerName || "Customer";
    var phone = data.phone || data.phoneNumber || "";
    // Prefix single quote to force plain text formatting and prevent formula errors in Google Sheets
    if (phone && !phone.toString().startsWith("'")) {
      phone = "'" + phone.toString();
    }
    
    var occasion = data.occasion || "";
    var location = data.location || "";
    var date = data.date || data.eventDate || "";
    var time = data.time || data.preferredTime || "";
    var guests = data.guests || data.guestCount || "";
    var theatre = data.theatre || data.selectedTheatre || "";
    var packagePrice = data.packagePrice || "";
    var addons = data.addons || "";
    var estimatedTotal = data.estimatedTotal || "";
    var status = data.customerStatus || data.status || "NEW ENQUIRY";

    sheet.appendRow([
      timestamp,
      name,
      phone,
      occasion,
      location,
      date,
      time,
      guests,
      theatre,
      packagePrice,
      addons,
      estimatedTotal,
      status
    ]);

    return ContentService.createTextOutput(JSON.stringify({ status: "success", row: sheet.getLastRow() }))
      .setMimeType(ContentService.MimeType.JSON);

  } catch (error) {
    return ContentService.createTextOutput(JSON.stringify({ status: "error", message: error.toString() }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

function doGet(e) {
  return ContentService.createTextOutput("WhatsApp Bot Google Sheets Webhook is active and running!");
}
