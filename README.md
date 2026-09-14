# 🤖 WhatsApp Enquiry & Catalog Auto-Reply Bot

A lightweight WhatsApp bot that automatically responds to customer enquiries with an interactive menu and delivers photos, pricing details, or catalog files based on user replies.

---

## 🚀 Quick Start Guide

### 1. Start the Bot
In your terminal, run:
```bash
npm start
```

### 2. Link WhatsApp
1. A **QR code** will appear in your terminal.
2. Open WhatsApp on your phone:
   - **Android**: Tap `⋮` (three dots) > **Linked Devices** > **Link a Device**.
   - **iPhone**: Go to **Settings** > **Linked Devices** > **Link a Device**.
3. Scan the QR code in the terminal.
4. Once connected, your session is saved locally in `auth_info/` so you won't have to scan every time!

---

## 💬 Party Mowa Chat Flow

1. **Customer sends:** `"hi"` (or `"enquiry"`, `"party"`, `"mowa"`)
2. **Bot replies:**
   > *Hi! 👋 Welcome to Party Mowa - Private Theater & Celebration Venue 🎉🍿*  
   > *1. Send photos 📸*  
   > *2. Price details & Packages 💰*  
   > *3. Celebration Catalog / Brochure 📂*  
   > *4. Location & Slots 📍*  
   > *5. Book a Slot / Talk to Host 📞*  
   > *(Reply with 1, 2, 3, 4, or 5)*

3. **Customer replies with:**
   - **`1`** (or `"photos"`): Sends private theater ambience & theme decor photos.
   - **`2`** (or `"price"`): Sends Romantic (Couple), Birthday Bash, and Grand Celebration package details.
   - **`3`** (or `"catalog"`): Sends the official Party Mowa catalog PDF.
   - **`4`** (or `"location"`): Sends Madhapur location & daily 3-hour slot timings.
   - **`5`** (or `"book"`): Collects booking requirements for fast host confirmation.

---

## ⚙️ Customization

### 1. Edit Messages & Menu Options
Open [config.json](file:///c:/Users/dines/OneDrive/Desktop/Pushkaran%20Projects/Personal/bot/config.json) to customize:
- `welcomeMessage`: The greeting and menu list.
- `options`: Each numbered choice (text, images, or PDF catalog).
- `keywords`: Custom trigger words (e.g. "pricing" -> "2", "catalog" -> "3").
- `cooldownMinutes`: Interval before re-sending the welcome greeting to an existing active chat.

### 2. Add Your Own Photos and Catalog PDF
Place your files in the [media/](file:///c:/Users/dines/OneDrive/Desktop/Pushkaran%20Projects/Personal/bot/media) folder:
- Replace `media/sample1.jpg`, `media/sample2.jpg` with your product/service photos.
- Replace `media/catalog.pdf` with your actual business catalog PDF.

---

## 📊 Viewing Inquiries & Leads
All customer interactions, phone numbers, timestamps, and chosen options are automatically saved to [inquiries.json](file:///c:/Users/dines/OneDrive/Desktop/Pushkaran%20Projects/Personal/bot/inquiries.json).

---

## 🧪 Testing Handler
To run automated tests on the menu and keyword handler:
```bash
npm test
```
