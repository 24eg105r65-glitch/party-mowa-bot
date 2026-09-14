import fs from 'fs';
import path from 'path';
import https from 'https';
import http from 'http';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const INQUIRIES_FILE = path.join(__dirname, '..', 'inquiries.json');
const LEADS_CSV_FILE = path.join(__dirname, '..', 'leads.csv');
const CONFIG_FILE = path.join(__dirname, '..', 'config.json');

/**
 * Ensures the inquiries file exists and is valid JSON.
 */
function initInquiriesFile() {
  if (!fs.existsSync(INQUIRIES_FILE)) {
    fs.writeFileSync(INQUIRIES_FILE, JSON.stringify([], null, 2), 'utf-8');
  }
}

/**
 * Ensures the leads CSV spreadsheet file exists with header columns.
 */
function initLeadsCsv() {
  if (!fs.existsSync(LEADS_CSV_FILE)) {
    const headers = [
      'Timestamp',
      'Customer Name',
      'Phone Number',
      'Occasion',
      'Location',
      'Selected Theatre',
      'Guests',
      'Celebration Date',
      'Time Slot',
      'Add-ons',
      'Package Price (INR)',
      'Estimated Total (INR)',
      'Status'
    ];
    fs.writeFileSync(LEADS_CSV_FILE, headers.map(escapeCsv).join(',') + '\n', 'utf-8');
  }
}

/**
 * Escapes field values for standard CSV formatting.
 */
function escapeCsv(val) {
  if (val === null || val === undefined) return '""';
  const str = String(val).replace(/\r?\n/g, ' | ').replace(/"/g, '""');
  return `"${str}"`;
}

/**
 * Sends a lead record to a Google Sheets Webhook URL (if configured in config.json).
 */
export async function sendToGoogleSheetsWebhook(leadData) {
  try {
    let webhookUrl = '';
    if (fs.existsSync(CONFIG_FILE)) {
      const cfg = JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf-8'));
      webhookUrl = cfg.googleSheetsWebhookUrl || cfg.sheetsWebhookUrl || '';
    }

    if (!webhookUrl || !webhookUrl.startsWith('http')) {
      return false;
    }

    const payload = JSON.stringify(leadData);

    if (typeof fetch === 'function') {
      const resp = await fetch(webhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: payload,
        redirect: 'follow'
      });
      return resp.ok;
    }

    return true;
  } catch (err) {
    console.warn('⚠️ Google Sheets Webhook sync notice:', err.message);
    return false;
  }
}

/**
 * Appends a confirmed booking lead to the leads.csv spreadsheet and triggers Google Sheets sync.
 */
export function appendLeadToSpreadsheet(details) {
  try {
    initLeadsCsv();

    const timestamp = new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' });

    // Clean and normalize phone number
    let rawPhone = details.phone || details.contact || '';
    if (rawPhone.includes('@')) {
      rawPhone = rawPhone.split('@')[0].split(':')[0];
    }
    const cleanDigits = rawPhone.replace(/\D/g, '');
    let displayPhone = rawPhone;
    if (cleanDigits.length >= 10) {
      displayPhone = `+91 ${cleanDigits.slice(-10)}`;
    }

    // Single-quote text prefix for Google Sheets prevents '+91' formula parse error in Google Sheets!
    const sheetsPhone = displayPhone ? (displayPhone.startsWith("'") ? displayPhone : `'${displayPhone}`) : '';

    const row = [
      timestamp,
      details.customerName || details.name || '',
      displayPhone || '',
      details.occasion || '',
      details.location || 'Party Mowa, Madhapur',
      details.selectedTheatre || details.theatre || '',
      details.guests || '',
      details.date || '',
      details.preferredTime || details.time || '',
      details.addons || 'None',
      details.packagePrice || details.packageTotal || 2499,
      details.estimatedTotal || 2499,
      details.customerStatus || 'READY FOR TEAM CALL'
    ];

    fs.appendFileSync(LEADS_CSV_FILE, row.map(escapeCsv).join(',') + '\n', 'utf-8');

    // Trigger Google Sheets Webhook sync asynchronously
    sendToGoogleSheetsWebhook({
      timestamp,
      customerName: details.customerName || details.name || '',
      name: details.customerName || details.name || '',
      phone: sheetsPhone,
      contact: sheetsPhone,
      phoneNumber: sheetsPhone,
      rawPhone: cleanDigits.slice(-10),
      occasion: details.occasion || '',
      location: details.location || 'Party Mowa, Madhapur',
      theatre: details.selectedTheatre || details.theatre || '',
      selectedTheatre: details.selectedTheatre || details.theatre || '',
      guests: details.guests || '',
      date: details.date || '',
      eventDate: details.date || '',
      celebrationDate: details.date || '',
      timeSlot: details.preferredTime || details.time || '',
      time: details.preferredTime || details.time || '',
      preferredTime: details.preferredTime || details.time || '',
      addons: details.addons || 'None',
      packagePrice: details.packagePrice || details.packageTotal || 2499,
      estimatedTotal: details.estimatedTotal || 2499,
      status: details.customerStatus || 'READY FOR TEAM CALL'
    });
  } catch (err) {
    console.error('Error appending lead to CSV spreadsheet:', err.message);
  }
}

/**
 * Logs an inquiry or interaction to inquiries.json and appends confirmed leads to the spreadsheet.
 * @param {Object} entry - { phone, name, incomingText, actionTaken, responseType, details, timestamp }
 */
export function logInquiry(entry) {
  try {
    initInquiriesFile();
    const data = JSON.parse(fs.readFileSync(INQUIRIES_FILE, 'utf-8') || '[]');
    
    const record = {
      phone: entry.phone || 'unknown',
      name: entry.name || '',
      incomingText: entry.incomingText || '',
      actionTaken: entry.actionTaken || '',
      responseType: entry.responseType || 'text',
      details: entry.details || null,
      timestamp: new Date().toISOString(),
      formattedTime: new Date().toLocaleString()
    };

    data.push(record);
    fs.writeFileSync(INQUIRIES_FILE, JSON.stringify(data, null, 2), 'utf-8');

    // If this is a qualified booking enquiry handover or return book, append to spreadsheet
    if (entry.actionTaken === 'NEW_QUALIFIED_BOOKING_ENQUIRY_HANDOVER' && entry.details) {
      appendLeadToSpreadsheet(entry.details);
    }
  } catch (error) {
    console.error('Error logging inquiry:', error.message);
  }
}
