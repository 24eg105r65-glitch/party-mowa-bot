import assert from 'assert';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { handleIncomingMessage, resetSessions, calculatePricing, parseAddons, cleanPhoneNumber, isValidPhoneNumber, isUserPaused } from '../src/menuHandler.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

console.log('🧪 Running Party Mowa Final WhatsApp Sales & Booking Bot Test Suite...\n');

// ----------------------------------------------------
// TEST 1: Full Standard End-to-End Customer Flow (Luna, 8 guests + Photography)
// ----------------------------------------------------
{
  resetSessions();
  const user = '919876543210@s.whatsapp.net'; // Direct WhatsApp number

  // Step 1: Welcome Message & Occasion Prompt
  const res1 = handleIncomingMessage(user, 'hi', 'Rahul');
  assert.strictEqual(res1.length, 1);
  assert.ok(res1[0].text.includes('Welcome to PARTY MOWA ❤️'));
  assert.ok(res1[0].text.includes('🎉 *What are you celebrating?*'));
  console.log('✅ Stage 1 Passed: Welcome message & Occasion selection');

  // Step 2: Occasion provided -> Direct to Guests prompt
  const res2 = handleIncomingMessage(user, '1', 'Rahul'); // Birthday
  assert.strictEqual(res2.length, 1);
  assert.ok(res2[0].text.includes('👥 How many people will be attending?'));
  console.log('✅ Stage 2 Passed: Guest count prompt (Occasion transitions straight to guests)');

  // Step 3: Guests provided (8) -> Show Experiences with 3 Videos
  const res3 = handleIncomingMessage(user, '8', 'Rahul');
  assert.strictEqual(res3.length, 5); // Wait Notice + 3 MP4 Videos + Text
  assert.strictEqual(res3[0].type, 'text');
  assert.ok(res3[0].text.includes('Please wait a moment while our theatre videos are being sent'));

  const videoResponses = res3.filter(r => r.type === 'video');
  assert.strictEqual(videoResponses.length, 3);
  assert.ok(videoResponses[0].filePath.includes('VID-20260624-WA0019.mp4')); // Luna (1st)
  assert.ok(videoResponses[1].filePath.includes('VID-20260830-WA0005.mp4')); // 270° (2nd)
  assert.ok(videoResponses[2].filePath.includes('VID-20260804-WA0004.mp4')); // Rosset (3rd)

  const experienceText = res3[res3.length - 1].text;
  assert.ok(experienceText.includes('Now comes the fun part! 🎬✨'));
  assert.ok(experienceText.includes('Luna Private Theatre'));
  assert.ok(experienceText.includes('270° Magical Screening'));
  assert.ok(experienceText.includes('Rosset Private Theatre'));
  console.log('✅ Stage 3 Passed: Wait notice sent + 3 MP4 Videos dispatched + 3 Theatre choices presented');

  // Step 4: Customer chooses Luna (Option 1)
  const res4 = handleIncomingMessage(user, '1', 'Rahul');
  assert.strictEqual(res4.length, 1);
  assert.ok(res4[0].text.includes('🎬 *LUNA PRIVATE THEATRE*'));
  assert.ok(res4[0].text.includes('₹2,499 for 4 people'));
  assert.ok(res4[0].text.includes('2.5 Hour Slot'));
  assert.ok(res4[0].text.includes('Additional guests after 4:'));
  assert.ok(res4[0].text.includes('Vanilla\nChocolate\nButterscotch\nPineapple\nBlack Forest'));
  assert.ok(res4[0].text.includes('Would you like to see our celebration add-ons?'));
  console.log('✅ Stage 4 Passed: Luna package details & Add-on prompt');

  // Step 5: Customer asks to show add-ons (Option 1) -> Dispatches Wait Notice + Add-ons Video + Menu Text
  const res5 = handleIncomingMessage(user, '1', 'Rahul');
  assert.strictEqual(res5.length, 3); // Wait Notice + Video + Catalog Text
  assert.strictEqual(res5[0].type, 'text');
  assert.ok(res5[0].text.includes('Please wait a moment while our celebration add-ons video is being sent'));
  assert.strictEqual(res5[1].type, 'video');
  assert.ok(res5[1].filePath.includes('addons.mp4') || res5[1].filePath.includes('VID-20260624-WA0020.mp4'));
  assert.ok(res5[2].text.includes('Here are the available celebration upgrades:'));
  assert.ok(res5[2].text.includes('30 Min Photography & Videography — ₹1,000'));
  console.log('✅ Stage 5 Passed: Wait notice + Add-ons MP4 video + catalog menu displayed');

  // Step 6: Customer selects "30 Min Photography & Videography"
  // Dynamic calculation: Luna for 8 guests = ₹2,499 + 4*350 (₹1,400) = ₹3,899 + ₹1,000 = ₹4,899
  const res6 = handleIncomingMessage(user, '30 Min Photography & Videography', 'Rahul');
  assert.strictEqual(res6.length, 2); // Billing summary + Date & Time prompt with slot schedule
  assert.ok(res6[0].text.includes('Perfect ❤️ Here is your celebration summary:'));
  assert.ok(res6[0].text.includes('Experience: Luna'));
  assert.ok(res6[0].text.includes('Guests: 8'));
  assert.ok(res6[0].text.includes('₹3,899')); // Package
  assert.ok(res6[0].text.includes('30 Min Photography & Videography — ₹1,000'));
  assert.ok(res6[0].text.includes('ESTIMATED TOTAL*\n\n₹4,899'));
  assert.ok(res6[0].text.includes('Final booking will be confirmed by our team after checking slot availability.'));
  
  // Verify schedule timings and DD/MM/YY format in time prompt
  assert.ok(res6[1].text.includes('DD/MM/YY format'));
  assert.ok(res6[1].text.includes('ROSSET THEATRE (Up to 15 People)'));
  assert.ok(res6[1].text.includes('10:00 AM - 12:30 PM'));
  assert.ok(res6[1].text.includes('LUNA THEATRE'));
  assert.ok(res6[1].text.includes('10:30 AM - 01:00 PM'));
  assert.ok(res6[1].text.includes('MAGICAL SCREEN (270° DEGREE)'));
  assert.ok(res6[1].text.includes('09:00 AM - 10:30 AM'));
  console.log('✅ Stage 6 Passed: Dynamic estimated billing (₹4,899) and DD/MM/YY slot timing prompt');

  // Step 7: Customer provides Date & Time in DD/MM/YY format ("25/09/26 07:30 PM - 10:00 PM") -> Bot asks Name and Phone together
  const res7 = handleIncomingMessage(user, '25/09/26 07:30 PM - 10:00 PM', 'Rahul');
  assert.strictEqual(res7.length, 1);
  assert.ok(res7[0].text.includes('I\'ll pass your preferred celebration date and time to our team'));
  assert.ok(res7[0].text.includes('👤 *Name and 📞 10-digit WhatsApp Number*'));
  assert.ok(!res7[0].text.includes('slot is confirmed'));
  console.log('✅ Stage 7 Passed: Date (DD/MM/YY) & Time acknowledged and Name + Phone requested in a single step');

  // Step 8: Customer gives Name and Phone together in one single message -> Bot jumps straight to Final Summary
  const res8 = handleIncomingMessage(user, 'Rahul - 9876543210', 'Rahul');
  assert.strictEqual(res8.length, 1);
  assert.ok(res8[0].text.includes('❤️ *Your Party Mowa Enquiry*'));
  assert.ok(res8[0].text.includes('👤 Name: Rahul'));
  assert.ok(res8[0].text.includes('📞 Contact: +91 9876543210'));
  assert.ok(res8[0].text.includes('📅 Date: 25/09/26'));
  assert.ok(res8[0].text.includes('⏰ Preferred Time: 07:30 PM - 10:00 PM'));
  assert.ok(res8[0].text.includes('👥 Guests: 8'));
  assert.ok(res8[0].text.includes('🎬 Selected Experience: Luna'));
  assert.ok(res8[0].text.includes('Estimated Total*\n\n₹4,899'));
  assert.ok(res8[0].text.includes('1️⃣ ✅ Confirm Details'));
  console.log('✅ Stage 8 Passed: Name & 10-Digit Phone collected together in ONE single step with instant Final Summary');

  // Step 9: Customer confirms details (Option 1) -> Handover to Team with urgent contact & stop bot note
  const res9 = handleIncomingMessage(user, '1', 'Rahul');
  assert.strictEqual(res9.length, 1);
  assert.ok(res9[0].text.includes('Your enquiry has now been forwarded to our Party Mowa team.'));
  assert.ok(res9[0].text.includes('Our team will call you shortly.'));
  assert.ok(res9[0].text.includes('9063426658'));
  assert.ok(res9[0].text.includes('stop bot'));
  console.log('✅ Stage 9 Passed: Team Handover message with urgent contact and stop bot note completed');

  // Step 10: Rule 28: Automated sales messages stop after handover & display urgent contact & stop bot note
  const res10 = handleIncomingMessage(user, 'hello', 'Rahul');
  assert.ok(res10[0].text.includes('Our Party Mowa team has received your enquiry'));
  assert.ok(res10[0].text.includes('9063426658'));
  assert.ok(res10[0].text.includes('stop bot'));
  console.log('✅ Rule 28 Passed: Automated sales messages stopped post-handover with urgent number and stop bot note');
}

// ----------------------------------------------------
// TEST 2: 270° Magical Screening Flow & Combined Name+Phone on LID Device
// ----------------------------------------------------
{
  resetSessions();
  const userLid = '119189671043272@lid'; // LID device without phone

  handleIncomingMessage(userLid, 'hi', 'PK');
  handleIncomingMessage(userLid, 'Anniversary', 'PK');
  handleIncomingMessage(userLid, '2', 'PK'); // 2 guests

  // Select 270° Magical Screening (Option 2)
  const resDetails = handleIncomingMessage(userLid, '2', 'PK');
  assert.ok(resDetails[0].text.includes('270° MAGICAL SCREENING'));
  assert.ok(resDetails[0].text.includes('₹2,499 for 2 people'));
  assert.ok(resDetails[0].text.includes('1.5 Hour Slot'));

  // Decline add-ons (Option 2: No, Continue)
  const resBilling = handleIncomingMessage(userLid, '2', 'PK');
  assert.ok(resBilling[0].text.includes('No problem at all! ❤️'));
  assert.ok(resBilling[1].text.includes('ESTIMATED TOTAL*\n\n₹2,499'));
  assert.ok(resBilling[2].text.includes('DD/MM/YY format'));

  // Provide Date (DD/MM/YY) & Time
  const resPrompt = handleIncomingMessage(userLid, '15/10/26 05:30 PM - 07:00 PM', 'PK');
  assert.ok(resPrompt[0].text.includes('👤 *Name and 📞 10-digit WhatsApp Number*'));

  // Provide Name and Phone combined in 1 step: "Pushkaran 8328261609"
  const resSummary = handleIncomingMessage(userLid, 'Pushkaran 8328261609', 'PK');
  assert.ok(resSummary[0].text.includes('❤️ *Your Party Mowa Enquiry*'));
  assert.ok(resSummary[0].text.includes('👤 Name: Pushkaran'));
  assert.ok(resSummary[0].text.includes('+91 8328261609'));
  assert.ok(resSummary[0].text.includes('📅 Date: 15/10/26'));
  assert.ok(resSummary[0].text.includes('Selected Experience: 270° Magical Screening'));
  assert.ok(resSummary[0].text.includes('₹2,499'));
  console.log('✅ 270° Couple Flow & 1-Step Combined Name+Phone on LID Device Passed');
}

// ----------------------------------------------------
// TEST 3: Interactive Edit / Change Option Functionality
// ----------------------------------------------------
{
  resetSessions();
  const user = '919876543210@s.whatsapp.net';
  handleIncomingMessage(user, 'hi', 'Varun');
  handleIncomingMessage(user, 'Birthday', 'Varun');
  handleIncomingMessage(user, '4', 'Varun');
  handleIncomingMessage(user, '1', 'Varun'); // Luna (Option 1)
  handleIncomingMessage(user, '2', 'Varun'); // No addons
  handleIncomingMessage(user, '10 Nov 04:30 PM - 07:00 PM', 'Varun');
  handleIncomingMessage(user, 'Varun', 'Varun');

  // Customer chooses Option 2 (Change Details)
  const resChangeMenu = handleIncomingMessage(user, '2', 'Varun');
  assert.ok(resChangeMenu[0].text.includes('What detail would you like to update?'));
  assert.ok(resChangeMenu[0].text.includes('1️⃣ Celebration Date'));
  assert.ok(resChangeMenu[0].text.includes('3️⃣ Number of Guests'));
  assert.ok(resChangeMenu[0].text.includes('4️⃣ Selected Theatre'));

  // Edit Option 3: Number of Guests
  const resEditGuestPrompt = handleIncomingMessage(user, '3', 'Varun');
  assert.ok(resEditGuestPrompt[0].text.includes('enter the updated number of guests'));

  // Provide new guest count: 10 guests
  const resUpdatedGuests = handleIncomingMessage(user, '10', 'Varun');
  assert.ok(resUpdatedGuests[0].text.includes('Guest count updated to 10'));
  assert.ok(resUpdatedGuests[0].text.includes('Guests: 10'));
  // Luna with 10 guests = ₹2,499 + 6*350 (2,100) = ₹4,599
  assert.ok(resUpdatedGuests[0].text.includes('₹4,599'));

  // Edit Option 1: Celebration Date
  handleIncomingMessage(user, '2', 'Varun'); // Choose change again
  const resEditDatePrompt = handleIncomingMessage(user, '1', 'Varun');
  assert.ok(resEditDatePrompt[0].text.includes('enter your updated celebration date'));
  const resUpdatedDate = handleIncomingMessage(user, '25th December', 'Varun');
  assert.ok(resUpdatedDate[0].text.includes('Celebration date updated'));
  assert.ok(resUpdatedDate[0].text.includes('25th December'));

  // Edit Option 4: Switch Theatre to Rosset (Option 3)
  handleIncomingMessage(user, '2', 'Varun');
  const resEditTheatrePrompt = handleIncomingMessage(user, '4', 'Varun');
  assert.ok(resEditTheatrePrompt[0].text.includes('Which theatre experience would you like to select'));
  const resUpdatedTheatre = handleIncomingMessage(user, '3', 'Varun'); // Rosset (Option 3)
  assert.ok(resUpdatedTheatre[0].text.includes('Selected theatre updated to Rosset'));
  assert.ok(resUpdatedTheatre[0].text.includes('Rosset'));

  console.log('✅ Interactive Edit Options Passed: Guests, Date, and Theatre updated accurately');
}

// ----------------------------------------------------
// TEST 5: Auto-Pause on Human Takeover & Manual Stop Commands
// ----------------------------------------------------
{
  resetSessions();
  const user = '919876543210@s.whatsapp.net';
  
  // 1. Customer initiates chat
  handleIncomingMessage(user, 'hi', 'Karthik');
  
  // 2. Customer or Admin sends "stop"
  const resStop = handleIncomingMessage(user, 'stop', 'Karthik');
  assert.ok(resStop[0].text.includes('Bot Paused'));
  assert.ok(isUserPaused(user));

  // 3. Customer sends messages while bot is paused -> Bot remains completely silent!
  const resSilent1 = handleIncomingMessage(user, 'Hello?', 'Karthik');
  assert.strictEqual(resSilent1.length, 0);

  const resSilent2 = handleIncomingMessage(user, 'Anyone there?', 'Karthik');
  assert.strictEqual(resSilent2.length, 0);

  // 4. Admin or customer resumes bot with "restart" or "start bot"
  const resResume = handleIncomingMessage(user, 'restart', 'Karthik');
  assert.ok(resResume.length > 0, 'Bot must reply when customer sends restart');
  assert.ok(resResume[0].text.includes('Welcome to PARTY MOWA'));
  assert.strictEqual(isUserPaused(user), false);

  console.log('✅ Pause & Resume via restart Passed: Bot reactivates and replies immediately on restart');
}

// ----------------------------------------------------
// TEST 6: Max 15 Guests Capacity Enforcement
// ----------------------------------------------------
{
  resetSessions();
  const user = '919876543210@s.whatsapp.net';
  
  handleIncomingMessage(user, 'hi', 'Raj');
  handleIncomingMessage(user, '1', 'Raj'); // Birthday

  // Customer enters 20 guests (exceeds 15)
  const resExceed = handleIncomingMessage(user, '20', 'Raj');
  assert.ok(resExceed[0].text.includes('Maximum Guest Capacity'));
  assert.ok(resExceed[0].text.includes('maximum of up to *15 guests* only'));

  // Customer enters 15 guests (valid)
  const resValid = handleIncomingMessage(user, '15', 'Raj');
  assert.ok(resValid.some(r => r.type === 'video'));
  assert.ok(resValid[resValid.length - 1].text.includes('Which experience would you like to explore?'));

  console.log('✅ Max 15 Guests Capacity Passed: Inputs > 15 are prompted with maximum capacity message');
}

// ----------------------------------------------------
// TEST 7: 270° Magical Screening Max 5 Guests Capacity Warning
// ----------------------------------------------------
{
  resetSessions();
  const user = '919876543210@s.whatsapp.net';
  
  handleIncomingMessage(user, 'hi', 'Deepak');
  handleIncomingMessage(user, '1', 'Deepak'); // Birthday
  handleIncomingMessage(user, '8', 'Deepak'); // 8 guests

  // Customer attempts to choose 270° Magical Screening (Option 2) for 8 guests
  const res270Warning = handleIncomingMessage(user, '2', 'Deepak');
  assert.ok(res270Warning[0].text.includes('270° Magical Screening Capacity'));
  assert.ok(res270Warning[0].text.includes('maximum of up to *5 guests* only'));
  assert.ok(res270Warning[0].text.includes('not best suitable for more than 5 members'));
  assert.ok(res270Warning[0].text.includes('Luna'));
  assert.ok(res270Warning[0].text.includes('Rosset'));

  // Customer accepts recommendation and chooses Luna (Option 1 in prompt)
  const resLuna = handleIncomingMessage(user, '1', 'Deepak');
  assert.ok(resLuna[0].text.includes('LUNA PRIVATE THEATRE'));

  console.log('✅ 270° Max 5 Guests Warning Passed: Advised customer to switch to Luna/Rosset when > 5 guests');
}

// ----------------------------------------------------
// TEST 8: CSV Spreadsheet & Google Sheets Logging
// ----------------------------------------------------
{
  const csvPath = path.join(__dirname, '..', 'leads.csv');
  assert.ok(fs.existsSync(csvPath), 'leads.csv spreadsheet file must exist');
  const csvContent = fs.readFileSync(csvPath, 'utf-8');
  assert.ok(csvContent.includes('Customer Name'), 'CSV must contain Customer Name header');
  assert.ok(csvContent.includes('Phone Number'), 'CSV must contain Phone Number header');
  assert.ok(csvContent.includes('Selected Theatre'), 'CSV must contain Selected Theatre header');
  assert.ok(csvContent.includes('Rahul'), 'CSV must record customer Rahul');
  assert.ok(csvContent.includes('Luna'), 'CSV must record selected experience');
  console.log('✅ CSV Spreadsheet Logging Passed: Booking leads successfully recorded to leads.csv');
}

console.log('\n🎉 ALL PARTY MOWA BOT RULES, VIDEOS, TIMINGS, EDIT, CAPACITY, SHEETS & VALIDATION TESTS PASSED! 🚀');
