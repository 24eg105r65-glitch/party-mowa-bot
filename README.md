# 🚀 Universal WhatsApp Sales, Enquiry & Booking Bot Framework

A powerful, customizable, open-source WhatsApp business automation and enquiry bot built with **Node.js** and **@whiskeysockets/baileys**. It features an interactive guided sales funnel, dynamic multi-tier pricing, media (video/photo/document) streaming, Google Sheets synchronization, and 24/7 cloud hosting support.

---

## 🌟 Key Features

- ⚡ **24/7 Persistent Cloud Ready:** Built-in HTTP health-check listener (`process.env.PORT`) for 1-click persistent deployment on Render, Railway, Koyeb, Fly.io, or any VPS/Docker environment.
- 📱 **No Official API / Per-Message Fees:** Connects directly via WhatsApp Web QR pairing.
- 🤖 **Guided Sales & Booking Funnel:** Natural step-by-step enquiry flow (Occasion selection, Guest count, Theatre/Service options, Add-ons selection, Dynamic pricing estimate, DD/MM/YY date and slot collection, Single-step Name & Contact capture, Summary confirmation, and Team handover).
- 🎥 **Media Streaming:** Automatic pacing and wait notices for video clips, images, and catalog PDFs.
- 💰 **Dynamic Multi-Tier Pricing:** Calculates base prices, extra guest surcharges, and selected add-ons automatically.
- 📊 **Real-Time Google Sheets & CSV Lead Logging:** Automatically writes qualified customer leads, contact numbers, and booked packages directly to your Google Sheet and local CSV.
- 🛑 **Human Agent Takeover & Auto-Pause:** Staff can pause the bot with `stop bot` (or whenever staff replies from the business phone). Customers can resume anytime with `restart`.
- ⚙️ **100% Configurable:** Customize business details, services, packages, prices, add-on catalogs, slot schedules, and webhook URLs simply by editing `config.json`.

---

## 📁 Project Structure

```
├── config.json                 # Active business configuration
├── config.example.json         # Clean configuration template for other businesses
├── google_sheets_apps_script.js # Google Sheets Webhook Script (copy-paste ready)
├── Dockerfile                  # Production Docker container setup
├── Procfile                    # Cloud process definition (Worker/Web)
├── package.json                # Dependencies and test scripts
├── media/                      # Videos, photos, and brochures
├── src/
│   ├── bot.js                  # Baileys WhatsApp client & HTTP health-check server
│   ├── menuHandler.js          # Conversational state machine & sales funnel logic
│   ├── leadLogger.js           # CSV & Google Sheets webhook logger
│   └── sheets.js               # Webhook dispatcher with retry handling
└── tests/
    └── testHandler.js          # Comprehensive test suite
```

---

## 🚀 Quick Start (Local Setup)

### 1. Prerequisites
- **Node.js 18+** installed on your machine.
- Git.

### 2. Installation
```bash
# Clone the repository
git clone https://github.com/24eg105r65-glitch/party-mowa-bot.git
cd party-mowa-bot

# Install dependencies
npm install
```

### 3. Start the Bot
```bash
npm start
```

### 4. Link WhatsApp
1. A **QR code** will be displayed in your terminal.
2. Open WhatsApp on your phone:
   - **Android**: Tap `⋮` (three dots) > **Linked Devices** > **Link a Device**.
   - **iPhone**: Go to **Settings** > **Linked Devices** > **Link a Device**.
3. Scan the QR code.
4. Your credentials will be saved in `auth_info/` so you do not need to re-scan on future restarts.

---

## ⚙️ Customizing for Your Business

Anyone can adapt this bot for any business (Private Theatres, Event Venues, Photo Studios, Salons/Spas, Banquet Halls, Rental Services, etc.) simply by modifying **`config.json`**:

```json
{
  "businessName": "Your Business Name",
  "supportPhone": "9876543210",
  "maxGuestCapacity": 15,
  "location": {
    "name": "Branch Address / Landmark",
    "mapUrl": "https://maps.google.com/?q=..."
  },
  "theatres": {
    "room_1": {
      "name": "Standard Experience",
      "basePrice": 2499,
      "baseGuests": 2,
      "extraPersonPrice": 350,
      "duration": "1.5 Hour Slot",
      "description": "Room description",
      "image": "media/room1.jpg"
    }
  },
  "addons": [
    { "id": "photo_1h", "name": "1 Hour Photography", "price": 2000 },
    { "id": "bouquet", "name": "Flower Bouquet", "price": 449 }
  ],
  "googleSheetsWebhookUrl": "https://script.google.com/macros/s/YOUR_SCRIPT_ID/exec",
  "ignoreGroups": true
}
```

---

## 📊 Google Sheets Real-Time Sync Setup

1. Create a new Google Sheet at [sheets.new](https://sheets.new).
2. Click **Extensions > Apps Script**.
3. Copy and paste the entire code from [`google_sheets_apps_script.js`](./google_sheets_apps_script.js).
4. Click **Deploy > New deployment**:
   - **Select type:** `Web app`
   - **Execute as:** `Me`
   - **Who has access:** `Anyone`
5. Click **Deploy** and copy the resulting **Web App URL**.
6. Paste the URL into `"googleSheetsWebhookUrl"` inside `config.json`.

Now every qualified enquiry is recorded into your Google Sheet in real time!

---

## ☁️ 24/7 Cloud Hosting Guide (Runs even when PC is off)

### Option A: Deploy on Render.com (Free Web Service)
1. Go to [dashboard.render.com](https://dashboard.render.com) and sign in with GitHub.
2. Click **New + > Web Service**.
3. Connect your forked / cloned GitHub repository.
4. Settings:
   - **Runtime:** `Node` or `Docker`
   - **Build Command:** `npm install`
   - **Start Command:** `npm start`
   - **Instance Type:** `Free`
5. Click **Create Web Service**.
6. Open the **Logs** tab in Render to scan the QR code with your phone once.

### Option B: Deploy on Railway.app (1-Click)
1. Go to [railway.app](https://railway.app) and sign in with GitHub.
2. Click **New Project > Deploy from GitHub repo**.
3. Select your repository.
4. Railway will automatically build and start the bot.
5. Open the deployment logs and scan the QR code.

---

## 🧪 Running Automated Tests

Run the test suite to verify the conversational state machine, pricing calculations, capacity limits, and lead logging:
```bash
npm test
```

---

## 🛡️ License & Contributing

Open-source and customizable for commercial and personal business automation. Contributions, issues, and feature requests are welcome!
