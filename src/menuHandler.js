import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { logInquiry } from './leadLogger.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// In-memory conversation state machine per customer
const userSessions = new Map();
const pausedUsers = new Set();

/**
 * Pauses automated bot responses for a user (e.g. when human agent takes over)
 */
export function pauseBotForUser(phone) {
  if (phone) pausedUsers.add(phone);
}

/**
 * Resumes automated bot responses for a user
 */
export function resumeBotForUser(phone) {
  if (phone) pausedUsers.delete(phone);
}

/**
 * Checks if a user is paused
 */
export function isUserPaused(phone) {
  return pausedUsers.has(phone);
}

/**
 * Loads config.json safely
 */
export function loadConfig() {
  const configPath = path.join(__dirname, '..', 'config.json');
  try {
    const raw = fs.readFileSync(configPath, 'utf-8');
    return JSON.parse(raw);
  } catch (err) {
    return { ignoreGroups: true };
  }
}

/**
 * Normalizes input string for easy comparison
 */
function cleanText(text) {
  if (!text) return '';
  return text.trim().toLowerCase();
}

/**
 * Extracts and formats a valid Indian 10-digit phone number
 */
export function cleanPhoneNumber(input) {
  if (!input) return '';
  const digits = input.replace(/\D/g, '');
  if (digits.length === 10 && /^[6-9]\d{9}$/.test(digits)) {
    return `+91 ${digits}`;
  } else if (digits.length === 12 && digits.startsWith('91') && /^91[6-9]\d{9}$/.test(digits)) {
    return `+91 ${digits.slice(2)}`;
  } else if (digits.length === 11 && digits.startsWith('0') && /^0[6-9]\d{9}$/.test(digits)) {
    return `+91 ${digits.slice(1)}`;
  } else if (digits.length >= 10 && digits.length <= 13) {
    const last10 = digits.slice(-10);
    if (/^[6-9]\d{9}$/.test(last10)) {
      return `+91 ${last10}`;
    }
  }
  return '';
}

/**
 * Validates if input contains a valid 10-digit Indian phone number
 */
export function isValidPhoneNumber(input) {
  return cleanPhoneNumber(input) !== '';
}

/**
 * Checks if a JID is a real phone number JID (@s.whatsapp.net) vs a companion device LID (@lid)
 */
export function extractPhoneFromJid(jid) {
  if (!jid) return '';
  const cleanJid = jid.split(':')[0].split('@')[0];
  return cleanPhoneNumber(cleanJid);
}

/**
 * Parses known add-ons from freeform text and calculates pricing
 */
export function parseAddons(text) {
  if (!text) return { items: [], total: 0, formatted: 'None' };
  const lower = text.toLowerCase();
  if (/^(no|none|no\s*add-?ons?|without\s*add-?ons?|2)$/i.test(lower.trim())) {
    return { items: [], total: 0, formatted: 'None' };
  }

  const catalog = [
    { name: 'Cinematic Entry', price: 2000, regex: /cinematic\s*entry/i },
    { name: '30 Min Photography & Videography', price: 1000, regex: /30\s*min|photography\s*&\s*videography\s*—\s*₹1,000|photography\s*30/i },
    { name: '1 Hour Photography & Videography', price: 2000, regex: /1\s*hour\s*photo|1\s*hr\s*photo|photography\s*1\s*hour/i },
    { name: 'Photo Clippings', price: 349, regex: /photo\s*clippings?|clippings?/i },
    { name: 'Bouquet', price: 449, regex: /bouquet|flower\s*bouquet/i },
    { name: 'Single Rose', price: 49, regex: /single\s*rose/i },
    { name: 'Rose Petal Heart on Table', price: 249, regex: /rose\s*petal\s*heart|heart\s*on\s*table/i },
    { name: 'Bubble Entry', price: 299, regex: /bubble\s*entry|bubble/i },
    { name: 'Candle Pathway', price: 299, regex: /candle\s*pathway|candle/i },
    { name: 'Rose Petal Pathway', price: 599, regex: /rose\s*petal\s*pathway|petal\s*pathway/i },
    { name: 'LED Number', price: 99, regex: /led\s*number|led/i },
    { name: 'Party Props', price: 199, regex: /party\s*props?|props?/i },
    { name: 'Outdoor Fog', price: 750, regex: /outdoor\s*fog/i },
    { name: 'Reel Editing', price: 800, regex: /reel\s*editing|reel/i }
  ];

  // Generic fallback if user typed "photography" without specifying 30m vs 1h
  if (/photography|videography/i.test(lower) && !/30\s*min|1\s*hour|1\s*hr/i.test(lower)) {
    catalog.unshift({ name: '30 Min Photography & Videography', price: 1000, regex: /photography|videography/i });
  }

  const matched = [];
  let total = 0;

  for (const item of catalog) {
    if (item.regex.test(lower)) {
      if (!matched.some(m => m.includes(item.name))) {
        matched.push(`📸 ${item.name} — ₹${item.price.toLocaleString()}`);
        total += item.price;
      }
    }
  }

  if (matched.length === 0) {
    return { items: [text], total: 0, formatted: text };
  }

  return {
    items: matched,
    total: total,
    formatted: matched.join('\n')
  };
}

/**
 * Extracts key fields from raw form text or multi-line natural language
 */
export function extractFormFields(text) {
  const data = {};
  if (!text) return data;

  const lines = text.split('\n');
  for (const line of lines) {
    const l = line.trim();
    if (!l) continue;

    const colonIdx = l.indexOf(':');
    if (colonIdx !== -1) {
      const val = l.slice(colonIdx + 1).trim();
      if (!val) continue;

      if (/name on cake/i.test(l)) {
        data.nameOnCake = val;
      } else if (/name to display on.*board|board name|display.*board/i.test(l)) {
        data.boardName = val;
      } else if (/selected theatre|theatre name|selected experience|theatre:/i.test(l)) {
        data.theatre = val;
      } else if (/booking person name|person name|customer name|name:/i.test(l)) {
        if (!val.toLowerCase().includes('no')) data.name = val;
      } else if (/contact number|phone|mobile|contact:/i.test(l)) {
        data.phone = cleanPhoneNumber(val);
      } else if (/event date|date of event|celebration date|preferred date|date:/i.test(l)) {
        data.date = val;
      } else if (/number of guests|guests:|people:/i.test(l)) {
        data.guests = val;
        const m = val.match(/\d+/);
        if (m) data.guestCountNum = parseInt(m[0], 10);
      } else if (/preferred time|time slot|time:/i.test(l)) {
        data.time = val;
      } else if (/required add-ons|selected add-ons|add-ons:|addons:/i.test(l)) {
        data.addons = val;
      } else if (/cake weight & flavour|cake.*flavour|cake:/i.test(l)) {
        data.cake = val;
      } else if (/photography package:/i.test(l)) {
        data.photography = val;
      } else if (/occasion:/i.test(l)) {
        data.occasion = val;
      } else if (/location:/i.test(l)) {
        data.location = val;
      }
    }
  }

  return data;
}

/**
 * Extracts entities (date, guests, occasion, time, theatre, phone) from freeform natural language
 */
export function extractNaturalEntities(text) {
  const extracted = {};
  if (!text) return extracted;
  const lower = text.toLowerCase();

  // 1. Phone number (10 digits starting with 6-9 or +91)
  const phoneMatch = text.match(/(?:\+?91[\s-]?)?([6-9]\d{9})/);
  if (phoneMatch) {
    extracted.phone = `+91 ${phoneMatch[1]}`;
  }

  // 2. Guest count
  const guestMatch = lower.match(/(\d+)\s*(?:people|persons|guests|members|pax|ppl|adults|friends)/i);
  if (guestMatch) {
    extracted.guests = guestMatch[1];
    extracted.guestCountNum = parseInt(guestMatch[1], 10);
  } else {
    const standaloneNum = lower.match(/^\s*(\d+)\s*$/);
    if (standaloneNum) {
      const num = parseInt(standaloneNum[1], 10);
      if (num >= 1 && num <= 50 && num !== 1 && num !== 2 && num !== 3) {
        extracted.guests = standaloneNum[1];
        extracted.guestCountNum = num;
      }
    }
  }

  // 3. Occasion
  if (/birthday|bday|b'day|birth day/i.test(lower)) {
    extracted.occasion = 'Birthday';
  } else if (/anniversary|anniv|anni/i.test(lower)) {
    extracted.occasion = 'Anniversary';
  } else if (/proposal|propose/i.test(lower)) {
    extracted.occasion = 'Proposal';
  } else if (/other celebration|other/i.test(lower)) {
    extracted.occasion = 'Other Celebration';
  }

  // 4. Date patterns (e.g. "20 September", "Tomorrow", "Today", "15th Oct", "31-08-2026")
  const dateRegex1 = /\b(\d{1,2}(?:st|nd|rd|th)?\s+(?:jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:tember)?|sept|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)(?:\s+(?:20\d{2}))?)\b/i;
  const dateRegex2 = /\b((?:jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:tember)?|sept|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)\s+\d{1,2}(?:st|nd|rd|th)?(?:\s+(?:20\d{2}))?)\b/i;
  const dateRegex3 = /\b(\d{1,2}[/-]\d{1,2}(?:[/-](?:20\d{2}|\d{2}))?)\b/;
  const dateRegex4 = /\b(tomorrow|today|day after tomorrow|this weekend|this sunday|this saturday|next sunday|next saturday|next week|next month)\b/i;
  const dateRegex5 = /\b(\d{1,2}(?:st|nd|rd|th))\b/i;

  const dMatch = text.match(dateRegex1) || text.match(dateRegex2) || text.match(dateRegex3) || text.match(dateRegex4) || text.match(dateRegex5);
  if (dMatch) {
    extracted.date = dMatch[1].trim();
  }

  // 5. Time patterns (e.g. "7:00 PM", "7pm", "10:30am", "4:30pm to 7:00pm", "evening")
  const timeRegex = /\b(\d{1,2}(?::\d{2})?\s*(?:am|pm|a\.m\.|p\.m\.)(?:\s*(?:to|-)\s*\d{1,2}(?::\d{2})?\s*(?:am|pm)?)?|\d{1,2}\s*(?:to|-)\s*\d{1,2}(?::\d{2})?\s*(?:am|pm)?|around\s+\d{1,2}(?::\d{2})?\s*(?:am|pm)?|evening|morning|afternoon|midnight)\b/i;
  const tMatch = text.match(timeRegex);
  if (tMatch) {
    extracted.time = tMatch[1].trim();
  }

  // 6. Theatre choice
  if (/270|celestial|magical screening/i.test(lower)) {
    extracted.theatre = '270° Magical Screening';
  } else if (/\bluna\b/i.test(lower)) {
    extracted.theatre = 'Luna';
  } else if (/\brosset\b/i.test(lower)) {
    extracted.theatre = 'Rosset';
  }

  return extracted;
}

/**
 * Calculates pricing details dynamically based on guest count and theatre
 */
export function calculatePricing(guestCountNum, theatreChoice = 'Luna') {
  const guests = guestCountNum || 4;
  const is270 = theatreChoice.includes('270') || theatreChoice.toLowerCase().includes('magical');

  const baseGuests = is270 ? 2 : 4;
  const basePrice = 2499;
  const extraGuests = Math.max(0, guests - baseGuests);
  const extraAmount = extraGuests * 350;
  const duration = is270 ? '1.5 Hour Slot' : '2.5 Hour Slot';
  const total = basePrice + extraAmount;

  return {
    theatre: theatreChoice,
    guests,
    basePrice,
    baseGuests,
    extraGuests,
    extraAmount,
    duration,
    total
  };
}

/**
 * Resets user sessions (useful for unit tests)
 */
export function resetSessions() {
  userSessions.clear();
}

/**
 * 1. WELCOME MESSAGE
 */
function getWelcomeMessage() {
  return `Hi! 👋 Welcome to PARTY MOWA ❤️\n\n` +
    `Planning a birthday, anniversary, proposal or a special celebration?\n\n` +
    `We have private cinematic celebration experiences with beautiful décor, cake and special effects. 🎬✨\n\n` +
    `I'll help you find the right experience and give you all the details.\n\n` +
    `Let's start with just a few details. ❤️\n\n` +
    `🎉 *What are you celebrating?*\n\n` +
    `1️⃣ Birthday\n` +
    `2️⃣ Anniversary\n` +
    `3️⃣ Proposal\n` +
    `4️⃣ Other Celebration\n\n` +
    `*(Reply with option number or occasion)*`;
}

/**
 * 5. SHOW THE EXPERIENCES (1st Luna, 2nd 270°, 3rd Rosset)
 */
function getShowExperiencesMessage(session) {
  const responses = [];

  // Send a wait notice first before uploading and sending the video files
  responses.push({
    type: 'text',
    text: `⏳ *Please wait a moment while our theatre videos are being sent...* 🎬✨`
  });

  const videoLuna = path.join(__dirname, '..', 'media', 'VID-20260624-WA0019.mp4');
  const video270 = path.join(__dirname, '..', 'media', 'VID-20260830-WA0005.mp4');
  const videoRosset = path.join(__dirname, '..', 'media', 'VID-20260804-WA0004.mp4');

  if (fs.existsSync(videoLuna)) {
    responses.push({
      type: 'video',
      filePath: videoLuna,
      caption: ''
    });
  }
  if (fs.existsSync(video270)) {
    responses.push({
      type: 'video',
      filePath: video270,
      caption: ''
    });
  }
  if (fs.existsSync(videoRosset)) {
    responses.push({
      type: 'video',
      filePath: videoRosset,
      caption: ''
    });
  }

  const textMsg = `Perfect! ❤️ I have your basic celebration details.\n\n` +
    `Now comes the fun part! 🎬✨\n\n` +
    `Please watch our theatre experiences and choose the one you personally like the most.\n\n` +
    `🎥 Luna Private Theatre (Up to 15 guests)\n` +
    `🎥 270° Magical Screening (Up to 5 guests)\n` +
    `🎥 Rosset Private Theatre (Up to 15 guests)\n\n` +
    `Which experience would you like to explore?\n\n` +
    `1️⃣ Luna\n` +
    `2️⃣ 270° Magical Screening\n` +
    `3️⃣ Rosset`;

  responses.push({ type: 'text', text: textMsg });
  return responses;
}

/**
 * 6. 270° MAGICAL SCREENING DETAILS
 */
function get270DetailsMessage() {
  return `Excellent choice! ❤️\n\n` +
    `🎬 *270° MAGICAL SCREENING*\n\n` +
    `A private cinematic celebration experience with an immersive 270° screen.\n\n` +
    `Package includes:\n\n` +
    `🎬 270° Private Theatre Screening\n` +
    `✨ Theatre Decoration\n` +
    `🌫️ Indoor Fog Entry\n` +
    `🎂 ½ KG Cake\n` +
    `⏱️ 1.5 Hour Slot\n\n` +
    `*Package Price*\n\n` +
    `₹2,499 for 2 people\n\n` +
    `Additional guests:\n\n` +
    `₹350/person\n\n` +
    `🎂 *Cake flavours available:*\n\n` +
    `Vanilla\n` +
    `Chocolate\n` +
    `Butterscotch\n` +
    `Pineapple\n` +
    `Black Forest\n\n` +
    `You can also add special celebration upgrades if you'd like.\n\n` +
    `Would you like to see the add-ons?\n\n` +
    `1️⃣ Yes, Show Add-ons\n` +
    `2️⃣ No, Continue`;
}

/**
 * 7. LUNA DETAILS
 */
function getLunaDetailsMessage() {
  return `Excellent choice! ❤️\n\n` +
    `🎬 *LUNA PRIVATE THEATRE*\n\n` +
    `*Package*\n\n` +
    `₹2,499 for 4 people\n\n` +
    `Additional guests after 4:\n\n` +
    `₹350/person\n\n` +
    `Package includes:\n\n` +
    `🎬 Private Theatre Experience\n` +
    `✨ Theatre Decoration\n` +
    `🌫️ Indoor Fog Entry\n` +
    `🎂 ½ KG Cake\n` +
    `⏱️ 2.5 Hour Slot\n\n` +
    `🎂 *Cake flavours available:*\n\n` +
    `Vanilla\n` +
    `Chocolate\n` +
    `Butterscotch\n` +
    `Pineapple\n` +
    `Black Forest\n\n` +
    `Would you like to see our celebration add-ons?\n\n` +
    `1️⃣ Yes, Show Add-ons\n` +
    `2️⃣ No, Continue`;
}

/**
 * 8. ROSSET DETAILS
 */
function getRossetDetailsMessage() {
  return `Excellent choice! ❤️\n\n` +
    `🎬 *ROSSET PRIVATE THEATRE*\n\n` +
    `*Package*\n\n` +
    `₹2,499 for 4 people\n\n` +
    `Additional guests after 4:\n\n` +
    `₹350/person\n\n` +
    `Package includes:\n\n` +
    `🎬 Private Theatre Experience\n` +
    `✨ Theatre Decoration\n` +
    `🌫️ Indoor Fog Entry\n` +
    `🎂 ½ KG Cake\n` +
    `⏱️ 2.5 Hour Slot\n\n` +
    `🎂 *Cake flavours available:*\n\n` +
    `Vanilla\n` +
    `Chocolate\n` +
    `Butterscotch\n` +
    `Pineapple\n` +
    `Black Forest\n\n` +
    `Would you like to see our celebration add-ons?\n\n` +
    `1️⃣ Yes, Show Add-ons\n` +
    `2️⃣ No, Continue`;
}

/**
 * 9. ADD-ONS LIST (Dispatches add-ons video + catalog)
 */
function getAddonsMessage() {
  const responses = [];
  const videoAddons = path.join(__dirname, '..', 'media', 'VID-20260624-WA0020.mp4');
  const videoAddonsNamed = path.join(__dirname, '..', 'media', 'addons.mp4');
  const finalVideo = fs.existsSync(videoAddonsNamed) ? videoAddonsNamed : (fs.existsSync(videoAddons) ? videoAddons : null);

  if (finalVideo) {
    responses.push({
      type: 'text',
      text: `⏳ *Please wait a moment while our celebration add-ons video is being sent...* 🎬✨`
    });

    responses.push({
      type: 'video',
      filePath: finalVideo,
      caption: ''
    });
  }

  const textMsg = `Of course! ❤️\n\n` +
    `Here are the available celebration upgrades:\n\n` +
    `🎥 Cinematic Entry — ₹2,000\n` +
    `📸 30 Min Photography & Videography — ₹1,000\n` +
    `📸 1 Hour Photography & Videography — ₹2,000\n` +
    `🎞️ Photo Clippings — ₹349\n` +
    `💐 Bouquet — ₹449\n` +
    `🌹 Single Rose — ₹49\n` +
    `🌹 Rose Petal Heart on Table — ₹249\n` +
    `🫧 Bubble Entry — ₹299\n` +
    `🕯️ Candle Pathway — ₹299\n` +
    `🌹 Rose Petal Pathway — ₹599\n` +
    `🔢 LED Number — ₹99\n` +
    `🎉 Party Props — ₹199\n` +
    `🌫️ Outdoor Fog — ₹750\n` +
    `🎬 Reel Editing — ₹800/reel\n\n` +
    `Which add-ons would you like to include?\n\n` +
    `*(Reply with the add-on names, or reply "No add-ons" to continue)*`;

  responses.push({ type: 'text', text: textMsg });
  return responses;
}

/**
 * 11. ESTIMATED BILLING & TIME PROMPT WITH SCHEDULE LIST
 */
function getEstimatedBillingAndDatePrompt(session) {
  const calc = calculatePricing(session.data.guestCountNum, session.data.theatre);
  const addonsParsed = parseAddons(session.data.addons);
  const estimatedTotal = calc.total + addonsParsed.total;

  session.data.estimatedTotal = estimatedTotal;
  session.data.packageTotal = calc.total;

  const responses = [];

  const billingText = `Perfect ❤️ Here is your celebration summary:\n\n` +
    `🎬 Experience: ${session.data.theatre}\n` +
    `👥 Guests: ${session.data.guestCountNum || session.data.guests}\n` +
    `🎉 Occasion: ${session.data.occasion || 'Celebration'}\n` +
    `📅 Date: ${session.data.date || 'TBD'}\n\n` +
    `*Package*\n\n` +
    `₹${calc.total.toLocaleString()}\n\n` +
    `*Add-ons*\n\n` +
    `${addonsParsed.formatted}\n\n` +
    `*ESTIMATED TOTAL*\n\n` +
    `₹${estimatedTotal.toLocaleString()}\n\n` +
    `This is an estimated billing based on your selected package and add-ons.\n\n` +
    `Final booking will be confirmed by our team after checking slot availability.`;

  const timePrompt = `Almost done! ❤️\n\n` +
    `📅 *What date and ⏰ time slot would you prefer for your celebration?*\n\n` +
    `Here are our available theatre slot timings:\n\n` +
    `*1. ROSSET THEATRE (Up to 15 People)*\n` +
    `• 10:00 AM - 12:30 PM\n` +
    `• 01:00 PM - 03:30 PM\n` +
    `• 04:00 PM - 06:30 PM\n` +
    `• 07:00 PM - 09:30 PM\n` +
    `• 10:00 PM - 12:30 AM\n\n` +
    `*2. LUNA THEATRE*\n` +
    `• 10:30 AM - 01:00 PM\n` +
    `• 01:30 PM - 04:00 PM\n` +
    `• 04:30 PM - 07:00 PM\n` +
    `• 07:30 PM - 10:00 PM\n` +
    `• 10:30 PM - 01:00 AM\n\n` +
    `*3. MAGICAL SCREEN (270° DEGREE) (Up to 5 People)*\n` +
    `• 09:00 AM - 10:30 AM\n` +
    `• 11:00 AM - 12:30 PM\n` +
    `• 01:00 PM - 02:30 PM\n` +
    `• 03:00 PM - 04:30 PM\n` +
    `• 05:30 PM - 07:00 PM\n` +
    `• 07:30 PM - 09:00 PM\n` +
    `• 09:30 PM - 11:00 PM\n` +
    `• 11:30 PM - 01:00 AM\n\n` +
    `*(Reply with your date & preferred slot timing)*`;

  responses.push({ type: 'text', text: billingText });
  responses.push({ type: 'text', text: timePrompt });

  return responses;
}

/**
 * 14. FINAL ENQUIRY SUMMARY
 */
function getFinalEnquirySummary(session) {
  const calc = calculatePricing(session.data.guestCountNum, session.data.theatre);
  const addonsParsed = parseAddons(session.data.addons);
  const estimatedTotal = calc.total + addonsParsed.total;

  return `❤️ *Your Party Mowa Enquiry*\n\n` +
    `👤 Name: ${session.data.name || 'Valued Guest'}\n` +
    `📞 Contact: ${session.data.phone || 'TBD'}\n` +
    `🎉 Occasion: ${session.data.occasion || 'Celebration'}\n` +
    `📍 Location: ${session.data.location || 'Party Mowa, Madhapur'}\n` +
    `📅 Date: ${session.data.date || 'TBD'}\n` +
    `⏰ Preferred Time: ${session.data.time || 'TBD'}\n` +
    `👥 Guests: ${session.data.guestCountNum || session.data.guests || 2}\n\n` +
    `🎬 Selected Experience: ${session.data.theatre}\n\n` +
    `*Package*\n\n` +
    `₹${calc.total.toLocaleString()}\n\n` +
    `*Add-ons*\n\n` +
    `${addonsParsed.formatted}\n\n` +
    `*Estimated Total*\n\n` +
    `₹${estimatedTotal.toLocaleString()}\n\n` +
    `Everything looks good?\n\n` +
    `1️⃣ ✅ Confirm Details\n` +
    `2️⃣ ✏️ Change Details`;
}

/**
 * 15. HANDOVER MESSAGE
 */
function getHandoverMessage() {
  return `Perfect! ❤️\n\n` +
    `I've recorded all your celebration requirements.\n\n` +
    `Your enquiry has now been forwarded to our Party Mowa team.\n\n` +
    `Our team will:\n\n` +
    `✅ Check the availability for your preferred date & time\n` +
    `✅ Confirm the final slot\n` +
    `✅ Guide you through the booking process\n` +
    `✅ Help you with the advance payment and confirmation\n\n` +
    `📞 Our team will call you shortly. Please pick the call so we can complete your booking.\n\n` +
    `🚨 *If you have an urgent requirement, please contact: 9063426658.*\n\n` +
    `⚠️ Please note: Your slot is not confirmed yet. It will be confirmed only after our team checks availability and completes the booking process.\n\n` +
    `We look forward to celebrating with you at PARTY MOWA! ❤️\n\n` +
    `📍 Location: Party Mowa Private Theatres - Madhapur (https://share.google/pWQADWZ4trvYKwIVc)\n\n` +
    `*(To stop bot chat, please send message: "stop bot")*`;
}

/**
 * Main conversational sales funnel handler for Party Mowa
 * @param {string} senderPhone - WhatsApp remote JID
 * @param {string} incomingText - message text
 * @param {string} pushName - profile name
 * @returns {Array<Object>} List of messages/media to send
 */
export function handleIncomingMessage(senderPhone, incomingText, pushName = '') {
  const text = incomingText ? incomingText.trim() : '';
  const cleaned = cleanText(text);

  // 1. Manual Pause / Stop command
  if (['stop', 'pause', 'stop bot', 'pause bot', 'mute', 'human', 'agent', '#stop'].includes(cleaned)) {
    pauseBotForUser(senderPhone);
    return [{
      type: 'text',
      text: `🤖 *Bot Paused*\n\nOur Party Mowa team will assist you directly! 😊\n\n*(Reply with 'restart' anytime to reactivate the bot)*`
    }];
  }

  // 2. Manual Resume command
  if (['start bot', 'restart bot', 'restart', 'start', 'reset', 'unpause', 'resume'].includes(cleaned)) {
    resumeBotForUser(senderPhone);
    userSessions.delete(senderPhone);
  }

  // 3. If bot is paused (e.g. human agent took over), remain completely silent
  if (isUserPaused(senderPhone)) {
    return [];
  }

  let session = userSessions.get(senderPhone);
  const initialPhone = extractPhoneFromJid(senderPhone);

  // Intent 27: Customer returns after follow-up with "BOOK"
  if (cleaned === 'book') {
    if (session && session.data.theatre) {
      session.step = 'STATUS_TEAM_HANDOVER';

      logInquiry({
        phone: session.data.phone || senderPhone,
        name: session.data.name,
        incomingText: incomingText,
        actionTaken: 'NEW_QUALIFIED_BOOKING_ENQUIRY_HANDOVER',
        responseType: 'text',
        details: {
          customerName: session.data.name,
          phone: session.data.phone || senderPhone,
          occasion: session.data.occasion,
          location: session.data.location,
          date: session.data.date,
          preferredTime: session.data.time,
          guests: session.data.guests,
          selectedTheatre: session.data.theatre,
          packagePrice: session.data.packageTotal,
          addons: session.data.addons,
          estimatedTotal: session.data.estimatedTotal,
          customerStatus: 'RETURNING CUSTOMER BOOKING HANDOVER'
        }
      });

      const returnMsg = `Welcome back! ❤️\n\n` +
        `I've already saved your details, so you don't need to repeat them.\n\n` +
        `🎬 Experience: ${session.data.theatre}\n` +
        `👥 Guests: ${session.data.guestCountNum || session.data.guests || 2}\n` +
        `📅 Date: ${session.data.date || 'TBD'}\n` +
        `⏰ Preferred Time: ${session.data.time || 'TBD'}\n` +
        `💰 Estimated Total: ₹${(session.data.estimatedTotal || 2499).toLocaleString()}\n\n` +
        `I'll now forward your enquiry to our team for availability checking.\n\n` +
        `📞 Please pick the call from our Party Mowa team.\n\n` +
        `🚨 *If you have an urgent requirement, please contact: 9063426658.*\n\n` +
        `*(To stop bot chat, please send message: "stop bot")*`;
      return [{ type: 'text', text: returnMsg }];
    }
  }

  // Intent 25: "I'll think" / hesitation
  if (/think about it|will think|i'll think|let you know|will check|message later/i.test(cleaned)) {
    const thinkMsg = `Absolutely ❤️ Take your time.\n\n` +
      `I've saved your celebration requirements so you don't have to start over.\n\n` +
      `Whenever you're ready, just reply:\n\n` +
      `*BOOK*\n\n` +
      `and I'll continue from where we stopped.`;
    return [{ type: 'text', text: thinkMsg }];
  }

  // Intent 19: Discount Question
  if (/discount|any discount|discount available|reduce price|price less/i.test(cleaned)) {
    const discMsg = `Our packages are already offered at our best promotional pricing, so we don't have additional discounts. ❤️\n\n` +
      `But I can help you choose only the add-ons you actually need and keep the celebration within your budget.\n\n` +
      `Would you like to continue with your selected package?`;
    return [{ type: 'text', text: discMsg }];
  }

  // Intent 20: Advance Question
  if (/how much advance|advance|advance payment/i.test(cleaned)) {
    const advMsg = `An advance payment is required to confirm and block the selected slot.\n\n` +
      `The exact payment amount and payment process will be guided by our team after they check the availability.\n\n` +
      `Your slot is considered confirmed only after the booking process is completed.`;
    return [{ type: 'text', text: advMsg }];
  }

  // Intent 21: Photography Question
  if (/photography available|is photography available/i.test(cleaned)) {
    const photoMsg = `Yes! ❤️\n\n` +
      `📸 30 Min Photography & Videography — ₹1,000\n` +
      `📸 1 Hour Photography & Videography — ₹2,000\n\n` +
      `Would you like to add photography to your celebration?\n\n` +
      `1️⃣ Yes\n` +
      `2️⃣ No`;
    return [{ type: 'text', text: photoMsg }];
  }

  // Intent 22 / 18: Cake flavours / Cake included
  if (/cake flavours|what cake|cake included/i.test(cleaned)) {
    const cakeMsg = `🎂 Our available cake flavours are:\n\n` +
      `Vanilla\n` +
      `Chocolate\n` +
      `Butterscotch\n` +
      `Pineapple\n` +
      `Black Forest\n\n` +
      `A ½ KG cake is included in the selected package. ❤️`;
    return [{ type: 'text', text: cakeMsg }];
  }

  // Intent 23: Customer changes guest count
  if (/actually\s+(\d+)\s*(?:members|people|guests|persons|pax)?/i.test(cleaned)) {
    const m = cleaned.match(/\d+/);
    if (m && session) {
      const g = parseInt(m[0], 10);
      if (g > 15) {
        return [{
          type: 'text',
          text: `⚠️ *Maximum Guest Capacity*\n\nOur private theatres can accommodate a maximum of up to *15 guests* only. 😊\n\nWould you like to proceed with 15 guests?`
        }];
      }
      session.data.guests = g.toString();
      session.data.guestCountNum = g;
      return [{
        type: 'text',
        text: `No problem! ❤️ I've updated your guest count to ${g}.\n\nYour package billing will be recalculated accordingly.`
      }];
    }
  }

  // Intent 24: Customer changes theatre (e.g. "Can I see Rosset again?")
  if (/see\s*(rosset|luna|270)/i.test(cleaned)) {
    const t = cleaned.includes('rosset') ? 'Rosset' : (cleaned.includes('luna') ? 'Luna' : '270° Magical Screening');
    return [{
      type: 'text',
      text: `Of course! ❤️\n\nHere's the ${t} experience again:\n🎥 ${t} Theatre Video\n\nWould you like to switch your selection to ${t}?\n\n1️⃣ Yes, Switch to ${t}\n2️⃣ Keep Current Theatre`
    }];
  }

  // Rule 28: Stop automated messages after handover & give urgent contact info
  if (session && session.step === 'STATUS_TEAM_HANDOVER') {
    if (['restart', 'reset'].includes(cleaned)) {
      session = null;
      userSessions.delete(senderPhone);
    } else {
      return [{
        type: 'text',
        text: `Our Party Mowa team has received your enquiry and will call you shortly on ${session.data.phone || 'your contact number'}! 😊\n\n🚨 *If you have an urgent requirement, please contact: 9063426658.*\n\n*(To stop bot chat, please send message: "stop bot" | Reply "restart" for fresh enquiry)*`
      }];
    }
  }

  const isResetCommand = ['hi', 'hello', 'hey', 'start', 'restart', 'reset', 'menu'].includes(cleaned);

  // 1. Initial greeting or reset
  if (!session || isResetCommand) {
    session = {
      step: 'STAGE_1_OCCASION',
      data: {
        occasion: '',
        location: 'Party Mowa, Madhapur',
        date: '',
        guests: '',
        guestCountNum: 2,
        theatre: 'Luna',
        addons: '',
        time: '',
        name: pushName || '',
        phone: initialPhone || '',
        packageTotal: 2499,
        estimatedTotal: 2499
      },
      lastInteraction: Date.now()
    };
    userSessions.set(senderPhone, session);

    logInquiry({
      phone: senderPhone,
      name: pushName,
      incomingText: incomingText,
      actionTaken: 'STAGE_1_WELCOME',
      responseType: 'text'
    });

    return [{ type: 'text', text: getWelcomeMessage() }];
  }

  session.lastInteraction = Date.now();

  // ==========================================
  // STAGE 1 — OCCASION (Transitions straight to GUESTS)
  // ==========================================
  if (session.step === 'STAGE_1_OCCASION') {
    let occasion = '';
    if (cleaned === '1' || cleaned.includes('birthday') || cleaned.includes('bday')) {
      occasion = 'Birthday';
    } else if (cleaned === '2' || cleaned.includes('anniversary')) {
      occasion = 'Anniversary';
    } else if (cleaned === '3' || cleaned.includes('proposal')) {
      occasion = 'Proposal';
    } else if (cleaned === '4' || cleaned.includes('other') || cleaned.includes('celebration')) {
      occasion = 'Other Celebration';
    } else if (text.length > 2) {
      occasion = text;
    }

    if (!occasion) {
      return [{
        type: 'text',
        text: `Please select what you are celebrating: 🎉\n\n1️⃣ Birthday\n2️⃣ Anniversary\n3️⃣ Proposal\n4️⃣ Other Celebration`
      }];
    }

    session.data.occasion = occasion;
    session.step = 'STAGE_2_GUESTS';

    return [{
      type: 'text',
      text: `Got it! 👌\n\n👥 How many people will be attending?`
    }];
  }

  // ==========================================
  // STAGE 2 — NUMBER OF GUESTS (Sends theatre videos)
  // ==========================================
  if (session.step === 'STAGE_2_GUESTS') {
    const numMatch = text.match(/\d+/);
    if (!numMatch) {
      return [{
        type: 'text',
        text: `👥 Please tell me the number of guests who will be attending (e.g. 2, 4, 8):`
      }];
    }

    const guests = parseInt(numMatch[0], 10);
    if (guests > 15) {
      return [{
        type: 'text',
        text: `⚠️ *Maximum Guest Capacity*\n\nOur private theatres can accommodate a maximum of up to *15 guests* only. 😊\n\nPlease let us know if you would like to proceed with 15 or fewer guests (e.g. 15):`
      }];
    }
    if (guests < 1) {
      return [{
        type: 'text',
        text: `👥 Please enter a valid number of guests (1 to 15):`
      }];
    }

    session.data.guests = guests.toString();
    session.data.guestCountNum = guests;
    session.step = 'STAGE_3_SHOW_EXPERIENCES';

    return getShowExperiencesMessage(session);
  }

  // ==========================================
  // STAGE 3 — CUSTOMER CHOOSES THEATRE
  // ==========================================
  if (session.step === 'STAGE_3_SHOW_EXPERIENCES') {
    let chosenTheatre = '';
    if (cleaned === '1' || cleaned.includes('luna')) {
      chosenTheatre = 'Luna';
      session.data.theatre = chosenTheatre;
      session.step = 'STAGE_4_THEATRE_DECISION';
      return [{ type: 'text', text: getLunaDetailsMessage() }];
    } else if (cleaned === '2' || cleaned.includes('270') || cleaned.includes('magical')) {
      if (session.data.guestCountNum > 5) {
        session.step = 'STAGE_270_CAPACITY_CHOICE';
        return [{
          type: 'text',
          text: `⚠️ *270° Magical Screening Capacity*\n\nThe 270° Magical Screening can accommodate a maximum of up to *5 guests* only. It is not best suitable for more than 5 members. 😊\n\nFor your group of *${session.data.guestCountNum} guests*, we recommend our *Luna* or *Rosset* Private Theatres (accommodates up to 15 guests).\n\nWhich experience would you like to choose?\n1️⃣ Luna Private Theatre\n2️⃣ Rosset Private Theatre\n3️⃣ Change guests to 5 & proceed with 270°`
        }];
      }
      chosenTheatre = '270° Magical Screening';
      session.data.theatre = chosenTheatre;
      session.step = 'STAGE_4_THEATRE_DECISION';
      return [{ type: 'text', text: get270DetailsMessage() }];
    } else if (cleaned === '3' || cleaned.includes('rosset')) {
      chosenTheatre = 'Rosset';
      session.data.theatre = chosenTheatre;
      session.step = 'STAGE_4_THEATRE_DECISION';
      return [{ type: 'text', text: getRossetDetailsMessage() }];
    } else {
      return [{
        type: 'text',
        text: `Please choose which experience you would like to explore:\n\n1️⃣ Luna Private Theatre (Up to 15 guests)\n2️⃣ 270° Magical Screening (Up to 5 guests)\n3️⃣ Rosset Private Theatre (Up to 15 guests)`
      }];
    }
  }

  // ==========================================
  // STAGE: 270 CAPACITY CHOICE (When > 5 guests chose 270)
  // ==========================================
  if (session.step === 'STAGE_270_CAPACITY_CHOICE') {
    if (cleaned === '1' || cleaned.includes('luna')) {
      session.data.theatre = 'Luna';
      session.step = 'STAGE_4_THEATRE_DECISION';
      return [{ type: 'text', text: getLunaDetailsMessage() }];
    } else if (cleaned === '2' || cleaned.includes('rosset')) {
      session.data.theatre = 'Rosset';
      session.step = 'STAGE_4_THEATRE_DECISION';
      return [{ type: 'text', text: getRossetDetailsMessage() }];
    } else if (cleaned === '3' || cleaned.includes('270') || cleaned.includes('proceed') || cleaned.includes('5')) {
      session.data.guests = '5';
      session.data.guestCountNum = 5;
      session.data.theatre = '270° Magical Screening';
      session.step = 'STAGE_4_THEATRE_DECISION';
      return [{ type: 'text', text: get270DetailsMessage() }];
    } else {
      return [{
        type: 'text',
        text: `Please select:\n1️⃣ Luna Private Theatre\n2️⃣ Rosset Private Theatre\n3️⃣ Change guests to 5 & proceed with 270°`
      }];
    }
  }

  // ==========================================
  // STAGE 4 — WOULD YOU LIKE TO SEE ADD-ONS?
  // ==========================================
  if (session.step === 'STAGE_4_THEATRE_DECISION') {
    if (cleaned === '1' || cleaned.includes('show add-ons') || cleaned.includes('show addons') || cleaned.includes('yes') || cleaned.includes('addon')) {
      session.step = 'STAGE_5_COLLECT_ADDONS';
      return getAddonsMessage();
    } else if (cleaned === '2' || cleaned.includes('no') || cleaned.includes('continue')) {
      session.data.addons = 'None';
      session.step = 'STAGE_6_COLLECT_TIME';
      const responses = [{
        type: 'text',
        text: `No problem at all! ❤️\n\nWe'll continue with your selected theatre package.`
      }];
      const billingResponses = getEstimatedBillingAndDatePrompt(session);
      return responses.concat(billingResponses);
    } else {
      return [{
        type: 'text',
        text: `Would you like to see our celebration add-ons?\n\n1️⃣ Yes, Show Add-ons\n2️⃣ No, Continue`
      }];
    }
  }

  // ==========================================
  // STAGE 5 — COLLECT ADD-ONS SELECTION
  // ==========================================
  if (session.step === 'STAGE_5_COLLECT_ADDONS') {
    const isNo = /^(no|none|no\s*add-?ons?|2)$/i.test(cleaned);
    session.data.addons = isNo ? 'None' : text;
    session.step = 'STAGE_6_COLLECT_TIME';

    return getEstimatedBillingAndDatePrompt(session);
  }

  // ==========================================
  // STAGE 6 — PREFERRED DATE & TIME
  // ==========================================
  if (session.step === 'STAGE_6_COLLECT_TIME') {
    const ent = extractNaturalEntities(text);
    if (ent.date) session.data.date = ent.date;
    if (ent.time) session.data.time = ent.time;

    if (!session.data.date || session.data.date === 'TBD') {
      session.data.date = ent.date || text;
    }
    if (!session.data.time || session.data.time === 'TBD') {
      session.data.time = ent.time || 'Flexible Slot';
    }

    // Rule 12: Must NOT say "Your slot is available."
    const timeAck = `Got it! ❤️\n\nI'll pass your preferred celebration date and time to our team for availability checking.\n\nPlease share your:\n\n👤 Name`;

    session.step = 'STAGE_7_COLLECT_NAME';
    return [{ type: 'text', text: timeAck }];
  }

  // ==========================================
  // STAGE 7 — CUSTOMER NAME & PHONE CHECK
  // ==========================================
  if (session.step === 'STAGE_7_COLLECT_NAME') {
    const ent = extractNaturalEntities(text);
    if (ent.phone) {
      session.data.phone = ent.phone;
    }
    const cleanName = text.replace(/(?:\+?91[\s-]?)?[6-9]\d{9}/g, '').replace(/[\d+]/g, '').trim();
    session.data.name = cleanName || text;

    // Rule 13: If valid 10-digit phone is already available, jump to Summary
    if (isValidPhoneNumber(session.data.phone)) {
      session.step = 'STAGE_9_FINAL_SUMMARY';
      return [{ type: 'text', text: getFinalEnquirySummary(session) }];
    } else {
      session.step = 'STAGE_8_COLLECT_PHONE';
      return [{
        type: 'text',
        text: `Thank you, ${session.data.name}! ❤️\n\nAnd what is the best 10-digit WhatsApp/contact number for our team to reach you? 📞\n\n*(e.g. 9876543210)*`
      }];
    }
  }

  // ==========================================
  // STAGE 8 — COLLECT PHONE (Strict 10-digit validation)
  // ==========================================
  if (session.step === 'STAGE_8_COLLECT_PHONE') {
    const validPhone = cleanPhoneNumber(text);
    if (!validPhone) {
      return [{
        type: 'text',
        text: `⚠️ *Please enter a valid 10-digit mobile number* (e.g. 9876543210):\n\n*(Indian 10-digit numbers starting with 6, 7, 8, or 9)*`
      }];
    }
    session.data.phone = validPhone;
    session.step = 'STAGE_9_FINAL_SUMMARY';
    return [{ type: 'text', text: getFinalEnquirySummary(session) }];
  }

  // ==========================================
  // STAGE 9 — FINAL ENQUIRY SUMMARY CONFIRMATION
  // ==========================================
  if (session.step === 'STAGE_9_FINAL_SUMMARY') {
    if (cleaned === '1' || cleaned.includes('confirm') || cleaned.includes('yes') || cleaned.includes('looks good') || cleaned.includes('ok')) {
      session.step = 'STATUS_TEAM_HANDOVER';

      // Log formal structured team notification
      logInquiry({
        phone: session.data.phone || senderPhone,
        name: session.data.name,
        incomingText: incomingText,
        actionTaken: 'NEW_QUALIFIED_BOOKING_ENQUIRY_HANDOVER',
        responseType: 'text',
        details: {
          customerName: session.data.name,
          phone: session.data.phone || senderPhone,
          occasion: session.data.occasion,
          location: session.data.location,
          date: session.data.date,
          preferredTime: session.data.time,
          guests: session.data.guests,
          selectedTheatre: session.data.theatre,
          packagePrice: session.data.packageTotal,
          addons: session.data.addons,
          estimatedTotal: session.data.estimatedTotal,
          customerStatus: 'READY FOR TEAM CALL'
        }
      });

      return [{ type: 'text', text: getHandoverMessage() }];
    } else if (cleaned === '2' || cleaned.includes('change') || cleaned.includes('edit')) {
      session.step = 'STAGE_CHANGE_DETAILS';
      return [{
        type: 'text',
        text: `What detail would you like to update? 😊\n\n1️⃣ Celebration Date\n2️⃣ Preferred Time\n3️⃣ Number of Guests\n4️⃣ Selected Theatre\n5️⃣ Add-ons\n6️⃣ Name / Contact\n\n*(Reply with option number 1-6 or type your updated detail)*`
      }];
    } else {
      return [{
        type: 'text',
        text: `Everything looks good?\n\n1️⃣ ✅ Confirm Details\n2️⃣ ✏️ Change Details`
      }];
    }
  }

  // ==========================================
  // STAGE: CHANGE DETAILS (Interactive option router)
  // ==========================================
  if (session.step === 'STAGE_CHANGE_DETAILS') {
    // Check which option number was chosen
    if (cleaned === '1' || cleaned.includes('date')) {
      session.step = 'STAGE_EDIT_DATE';
      return [{
        type: 'text',
        text: `📅 Please enter your updated celebration date (e.g. 25th October, Tomorrow):`
      }];
    } else if (cleaned === '2' || cleaned.includes('time') || cleaned.includes('slot')) {
      session.step = 'STAGE_EDIT_TIME';
      return [{
        type: 'text',
        text: `⏰ *Please enter your updated preferred time slot:*\n\n` +
          `*1. ROSSET THEATRE (Up to 15 People)*\n• 10:00 AM - 12:30 PM\n• 01:00 PM - 03:30 PM\n• 04:00 PM - 06:30 PM\n• 07:00 PM - 09:30 PM\n• 10:00 PM - 12:30 AM\n\n` +
          `*2. LUNA THEATRE*\n• 10:30 AM - 01:00 PM\n• 01:30 PM - 04:00 PM\n• 04:30 PM - 07:00 PM\n• 07:30 PM - 10:00 PM\n• 10:30 PM - 01:00 AM\n\n` +
          `*3. MAGICAL SCREEN (270° DEGREE)*\n• 09:00 AM - 10:30 AM\n• 11:00 AM - 12:30 PM\n• 01:00 PM - 02:30 PM\n• 03:00 PM - 04:30 PM\n• 05:30 PM - 07:00 PM\n• 07:30 PM - 09:00 PM\n• 09:30 PM - 11:00 PM\n• 11:30 PM - 01:00 AM\n\n` +
          `*(Reply with your updated slot timing)*`
      }];
    } else if (cleaned === '3' || cleaned.includes('guest') || cleaned.includes('member') || cleaned.includes('people')) {
      session.step = 'STAGE_EDIT_GUESTS';
      return [{
        type: 'text',
        text: `👥 Please enter the updated number of guests attending (e.g. 2, 4, 8):`
      }];
    } else if (cleaned === '4' || cleaned.includes('theatre') || cleaned.includes('experience')) {
      session.step = 'STAGE_EDIT_THEATRE';
      return [{
        type: 'text',
        text: `🎬 Which theatre experience would you like to select?\n\n1️⃣ Luna Private Theatre (Up to 15 guests)\n2️⃣ 270° Magical Screening (Up to 5 guests)\n3️⃣ Rosset Private Theatre (Up to 15 guests)`
      }];
    } else if (cleaned === '5' || cleaned.includes('addon') || cleaned.includes('add-on')) {
      session.step = 'STAGE_EDIT_ADDONS';
      return getAddonsMessage();
    } else if (cleaned === '6' || cleaned.includes('name') || cleaned.includes('contact') || cleaned.includes('phone') || cleaned.includes('number')) {
      session.step = 'STAGE_EDIT_CONTACT';
      return [{
        type: 'text',
        text: `👤 Please enter your updated Name and 10-digit Contact number:`
      }];
    }

    // Direct inline updates if user typed the value directly
    const ent = extractNaturalEntities(text);
    let updatedAny = false;
    if (ent.date) { session.data.date = ent.date; updatedAny = true; }
    if (ent.time) { session.data.time = ent.time; updatedAny = true; }
    if (ent.guests) {
      if (ent.guestCountNum > 15) {
        return [{
          type: 'text',
          text: `⚠️ *Maximum Guest Capacity*\n\nOur private theatres can accommodate a maximum of up to *15 guests* only. 😊\n\nPlease enter 15 or fewer guests:`
        }];
      }
      session.data.guests = ent.guests;
      session.data.guestCountNum = ent.guestCountNum;
      updatedAny = true;
    }
    if (ent.theatre) { session.data.theatre = ent.theatre; updatedAny = true; }
    if (ent.phone) { session.data.phone = ent.phone; updatedAny = true; }

    if (updatedAny) {
      session.step = 'STAGE_9_FINAL_SUMMARY';
      return [{ type: 'text', text: `✅ Details updated!\n\n` + getFinalEnquirySummary(session) }];
    }

    return [{
      type: 'text',
      text: `Please choose which detail to update:\n\n1️⃣ Celebration Date\n2️⃣ Preferred Time\n3️⃣ Number of Guests\n4️⃣ Selected Theatre\n5️⃣ Add-ons\n6️⃣ Name / Contact`
    }];
  }

  // ==========================================
  // EDIT SUB-STAGES
  // ==========================================
  if (session.step === 'STAGE_EDIT_DATE') {
    const ent = extractNaturalEntities(text);
    session.data.date = ent.date || text;
    session.step = 'STAGE_9_FINAL_SUMMARY';
    return [{ type: 'text', text: `✅ Celebration date updated!\n\n` + getFinalEnquirySummary(session) }];
  }

  if (session.step === 'STAGE_EDIT_TIME') {
    const ent = extractNaturalEntities(text);
    session.data.time = ent.time || text;
    session.step = 'STAGE_9_FINAL_SUMMARY';
    return [{ type: 'text', text: `✅ Preferred time updated!\n\n` + getFinalEnquirySummary(session) }];
  }

  if (session.step === 'STAGE_EDIT_GUESTS') {
    const m = text.match(/\d+/);
    if (m) {
      const g = parseInt(m[0], 10);
      if (g > 15) {
        return [{
          type: 'text',
          text: `⚠️ *Maximum Guest Capacity*\n\nOur private theatres can accommodate a maximum of up to *15 guests* only. 😊\n\nPlease enter 15 or fewer guests (e.g. 15):`
        }];
      }
      if (g < 1) {
        return [{ type: 'text', text: `👥 Please enter a valid number of guests (1 to 15):` }];
      }

      session.data.guests = g.toString();
      session.data.guestCountNum = g;

      // If theatre is 270° and new guest count > 5, switch to Luna
      if (session.data.theatre.includes('270') && g > 5) {
        session.data.theatre = 'Luna';
        session.step = 'STAGE_9_FINAL_SUMMARY';
        return [{
          type: 'text',
          text: `⚠️ *Note:* 270° Magical Screening accommodates up to 5 guests only. For your group of *${g} guests*, we have automatically upgraded your experience to *Luna Private Theatre* (up to 15 guests)! ❤️\n\n` + getFinalEnquirySummary(session)
        }];
      }

      session.step = 'STAGE_9_FINAL_SUMMARY';
      return [{ type: 'text', text: `✅ Guest count updated to ${g}!\n\n` + getFinalEnquirySummary(session) }];
    }
    return [{ type: 'text', text: `👥 Please enter a valid number of guests (e.g. 2, 4, 8):` }];
  }

  if (session.step === 'STAGE_EDIT_THEATRE') {
    if (cleaned === '1' || cleaned.includes('luna')) {
      session.data.theatre = 'Luna';
    } else if (cleaned === '2' || cleaned.includes('270') || cleaned.includes('magical')) {
      if (session.data.guestCountNum > 5) {
        return [{
          type: 'text',
          text: `⚠️ *270° Magical Screening Capacity*\n\nThe 270° Magical Screening can accommodate up to *5 guests* only and is not best for more than 5 members. 😊\n\nFor your group of *${session.data.guestCountNum} guests*, we recommend *Luna* or *Rosset* Private Theatre.\n\nPlease select:\n1️⃣ Luna Private Theatre\n2️⃣ Rosset Private Theatre`
        }];
      }
      session.data.theatre = '270° Magical Screening';
    } else if (cleaned === '3' || cleaned.includes('rosset')) {
      session.data.theatre = 'Rosset';
    } else {
      return [{
        type: 'text',
        text: `Please select a theatre:\n1️⃣ Luna (Up to 15 guests)\n2️⃣ 270° Magical Screening (Up to 5 guests)\n3️⃣ Rosset (Up to 15 guests)`
      }];
    }
    session.step = 'STAGE_9_FINAL_SUMMARY';
    return [{ type: 'text', text: `✅ Selected theatre updated to ${session.data.theatre}!\n\n` + getFinalEnquirySummary(session) }];
  }

  if (session.step === 'STAGE_EDIT_ADDONS') {
    const isNo = /^(no|none|2)$/i.test(cleaned);
    session.data.addons = isNo ? 'None' : text;
    session.step = 'STAGE_9_FINAL_SUMMARY';
    return [{ type: 'text', text: `✅ Add-ons updated!\n\n` + getFinalEnquirySummary(session) }];
  }

  if (session.step === 'STAGE_EDIT_CONTACT') {
    const validPhone = cleanPhoneNumber(text);
    if (validPhone) {
      session.data.phone = validPhone;
    }
    const cleanName = text.replace(/[\d+]/g, '').trim();
    if (cleanName.length >= 2) {
      session.data.name = cleanName;
    }
    session.step = 'STAGE_9_FINAL_SUMMARY';
    return [{ type: 'text', text: `✅ Contact details updated!\n\n` + getFinalEnquirySummary(session) }];
  }

  return [];
}
