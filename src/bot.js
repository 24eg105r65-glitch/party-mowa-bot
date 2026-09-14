import http from 'http';
import { makeWASocket, useMultiFileAuthState, DisconnectReason } from '@whiskeysockets/baileys';
import qrcode from 'qrcode-terminal';
import pino from 'pino';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { handleIncomingMessage, loadConfig, pauseBotForUser } from './menuHandler.js';

// Start a lightweight HTTP server so cloud hosts (Render, Railway, Koyeb) stay healthy
const PORT = process.env.PORT || 3000;
const server = http.createServer((req, res) => {
  res.writeHead(200, { 'Content-Type': 'text/plain' });
  res.end('Party Mowa Bot is active and running!\n');
});
server.listen(PORT, () => {
  console.log(`🌐 Cloud health-check server listening on port ${PORT}`);
});

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const AUTH_DIR = path.join(__dirname, '..', 'auth_info');

/**
 * Extracts plain text content from various WhatsApp message types
 */
function extractMessageText(message) {
  if (!message) return '';
  return (
    message.conversation ||
    message.extendedTextMessage?.text ||
    message.imageMessage?.caption ||
    message.videoMessage?.caption ||
    message.documentMessage?.caption ||
    ''
  );
}

/**
 * Main function to start the WhatsApp connection and bot
 */
async function startBot() {
  console.log('🤖 Starting WhatsApp Enquiry Bot...');

  // Set up multi-file auth storage so session persists
  const { state, saveCreds } = await useMultiFileAuthState(AUTH_DIR);

  const sock = makeWASocket({
    auth: state,
    logger: pino({ level: 'silent' }), // Set to 'info' for debugging socket events
    printQRInTerminal: false // We will handle QR explicitly with qrcode-terminal
  });

  // Save updated credentials whenever changed
  sock.ev.on('creds.update', saveCreds);

  // Monitor connection updates & show QR code
  sock.ev.on('connection.update', (update) => {
    const { connection, lastDisconnect, qr } = update;

    if (qr) {
      console.clear();
      console.log('\n======================================================');
      console.log('📲 SCAN THIS QR CODE WITH WHATSAPP ON YOUR PHONE:');
      console.log('   WhatsApp > Settings > Linked Devices > Link a Device');
      console.log('======================================================\n');
      qrcode.generate(qr, { small: true });
      console.log('\nWaiting for scan...');
    }

    if (connection === 'close') {
      const statusCode = lastDisconnect?.error?.output?.statusCode;
      const shouldReconnect = statusCode !== DisconnectReason.loggedOut;
      
      console.log(`⚠️ Connection closed. Reason: ${lastDisconnect?.error?.message || statusCode}`);
      
      if (shouldReconnect) {
        console.log('🔄 Reconnecting to WhatsApp in 5 seconds...');
        setTimeout(() => startBot(), 5000);
      } else {
        console.log('❌ Logged out of WhatsApp. Clear auth_info folder and restart to re-scan QR.');
      }
    } else if (connection === 'open') {
      console.log('\n======================================================');
      console.log('🎉 WHATSAPP BOT CONNECTED SUCCESSFULLY!');
      console.log(`📱 User: ${sock.user?.id || 'Connected'}`);
      console.log('⚡ Ready and listening for incoming enquiries & messages.');
      console.log('======================================================\n');
    }
  });

  // Handle incoming messages
  sock.ev.on('messages.upsert', async ({ messages, type }) => {
    if (type !== 'notify') return;

    for (const msg of messages) {
      const remoteJid = msg.key.remoteJid;
      if (!remoteJid || remoteJid === 'status@broadcast') continue;

      // 1. If message is sent from the business phone (human staff), automatically pause bot for this customer
      if (msg.key.fromMe) {
        pauseBotForUser(remoteJid);
        continue;
      }

      const config = loadConfig();

      // 3. Ignore group chats if configured
      const isGroup = remoteJid.endsWith('@g.us');
      if (isGroup && config.ignoreGroups) continue;

      // 4. Extract message text
      const incomingText = extractMessageText(msg.message);
      if (!incomingText.trim()) continue;

      const pushName = msg.pushName || 'Customer';
      console.log(`📩 Received message from ${pushName} (${remoteJid}): "${incomingText}"`);

      // 5. Get responses from menu handler
      const responses = handleIncomingMessage(remoteJid, incomingText, pushName);
      if (!responses || responses.length === 0) continue;

      // 6. Simulate typing indicator for a natural feel
      try {
        await sock.sendPresenceUpdate('composing', remoteJid);
        await new Promise((resolve) => setTimeout(resolve, 800)); // 800ms brief typing delay
      } catch (e) {
        // Non-critical, ignore
      }

      // 7. Dispatch each response
      for (const res of responses) {
        try {
          if (res.type === 'text') {
            await sock.sendMessage(remoteJid, { text: res.text }, { quoted: msg });
          } else if (res.type === 'video') {
            if (fs.existsSync(res.filePath)) {
              const fileSizeMb = (fs.statSync(res.filePath).size / (1024 * 1024)).toFixed(2);
              console.log(`🎥 Uploading video: ${path.basename(res.filePath)} (${fileSizeMb} MB)...`);
              await sock.sendMessage(
                remoteJid,
                {
                  video: fs.readFileSync(res.filePath),
                  caption: res.caption || '',
                  mimetype: 'video/mp4'
                }
              );
              await new Promise((resolve) => setTimeout(resolve, 800)); // Pace sequential video uploads
            } else {
              console.warn(`Video file not found: ${res.filePath}`);
              if (res.caption) {
                await sock.sendMessage(remoteJid, { text: res.caption });
              }
            }
          } else if (res.type === 'image') {
            if (fs.existsSync(res.filePath)) {
              await sock.sendMessage(
                remoteJid,
                {
                  image: fs.readFileSync(res.filePath),
                  caption: res.caption || ''
                },
                { quoted: msg }
              );
            } else {
              console.warn(`Image file not found: ${res.filePath}`);
              if (res.caption) {
                await sock.sendMessage(remoteJid, { text: res.caption }, { quoted: msg });
              }
            }
          } else if (res.type === 'document') {
            if (fs.existsSync(res.filePath)) {
              await sock.sendMessage(
                remoteJid,
                {
                  document: fs.readFileSync(res.filePath),
                  mimetype: 'application/pdf',
                  fileName: res.fileName || 'Catalog.pdf',
                  caption: res.caption || ''
                },
                { quoted: msg }
              );
            } else {
              console.warn(`Document file not found: ${res.filePath}`);
              if (res.caption) {
                await sock.sendMessage(remoteJid, { text: res.caption }, { quoted: msg });
              }
            }
          }
          console.log(`📤 Sent [${res.type}] reply to ${pushName}`);
        } catch (sendError) {
          console.error(`❌ Failed to send reply to ${remoteJid}:`, sendError.message);
        }
      }
    }
  });
}

// Start the bot
startBot().catch((err) => {
  console.error('Fatal error starting bot:', err);
});
