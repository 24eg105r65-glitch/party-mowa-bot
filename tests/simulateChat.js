import { handleIncomingMessage, resetSessions } from '../src/menuHandler.js';

function printDivider(title) {
  console.log('\n' + '='.repeat(65));
  console.log(`💬 SIMULATION: ${title}`);
  console.log('='.repeat(65) + '\n');
}

function simulateDialog(userJid, pushName, messages) {
  for (const msg of messages) {
    console.log(`👤 Customer (${pushName}): "${msg}"`);
    const replies = handleIncomingMessage(userJid, msg, pushName);
    for (const reply of replies) {
      if (reply.type === 'text') {
        console.log(`\n🤖 Bot Reply:\n${reply.text}\n`);
      } else if (reply.type === 'video') {
        console.log(`\n🎥 [BOT SENT VIDEO: ${reply.filePath}] (Caption: ${reply.caption || 'None'})`);
      } else if (reply.type === 'image') {
        console.log(`\n🖼️ [BOT SENT MEDIA: ${reply.filePath}] (Caption: ${reply.caption || 'None'})`);
      }
    }
    console.log('-'.repeat(55));
  }
}

// ----------------------------------------------------
// SCENARIO 1: Complete 8-Guest Birthday Flow for Luna with Add-ons
// ----------------------------------------------------
printDivider('Scenario 1: Complete 8-Guest Birthday Journey (Luna + 30m Photography)');
resetSessions();
const customer1 = '919876543210@s.whatsapp.net';
simulateDialog(customer1, 'Rahul', [
  'Hi',
  '1', // Birthday
  '20 September',
  '8',
  '1', // Luna (Option 1)
  '1', // Yes, Show Add-ons
  '30 Min Photography & Videography',
  '07:30 PM - 10:00 PM',
  'Rahul',
  '1', // Confirm Details -> Team Handover
  'Can I call now?' // Post-handover customer message
]);

// ----------------------------------------------------
// SCENARIO 2: Couple 270° Magical Screening Flow (No Add-ons) + LID Phone
// ----------------------------------------------------
printDivider('Scenario 2: Couple Anniversary in 270° Magical Screening (No Add-ons)');
resetSessions();
const customer2 = '119189671043272@lid';
simulateDialog(customer2, 'Pushkaran', [
  'Hi',
  'Anniversary',
  '15th October',
  '2',
  '2', // 270° Magical Screening (Option 2)
  '2', // No, Continue
  '05:30 PM - 07:00 PM',
  'Pushkaran',
  '8328261609', // Contact Number
  '1' // Confirm
]);

// ----------------------------------------------------
// SCENARIO 3: Mid-Conversation Questions & Return on "BOOK"
// ----------------------------------------------------
printDivider('Scenario 3: Mid-Conversation Inquiries (Cake, Discount) & "BOOK" Resume');
resetSessions();
const customer3 = '919876543210@s.whatsapp.net';
simulateDialog(customer3, 'Sneha', [
  'Hi',
  'Birthday',
  'Cake included aa? What cake flavours?',
  'Discount available?',
  '25 Oct',
  'Actually 10 members',
  'Can I see Rosset again?',
  'I will think about it',
  'BOOK'
]);
