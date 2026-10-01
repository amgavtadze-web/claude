/*
 * ალფა სახლი — ლენდინგის პარამეტრები.
 * გაშვებამდე შეავსეთ ქვემოთ მოცემული ველები.
 */
window.ALPHA_CONFIG = {
  // საკონტაქტო ნომერი (ციფრებით, ქვეყნის კოდით, "+"-ის გარეშე)
  phone: '995500000000',
  // როგორ გამოჩნდეს ნომერი გვერდზე
  phoneDisplay: '+995 500 00 00 00',
  // WhatsApp ნომერი (ციფრებით). ცარიელი — დამალავს ღილაკს
  whatsapp: '995500000000',

  // მისამართი და რუკა
  address: 'თბილისი (ზუსტ მისამართს გაცნობებთ კონსულტაციისას)',
  mapQuery: 'Tbilisi',

  // განვადების პირობები
  downPaymentMinPercent: 20,
  maxInstallmentMonths: 24,

  // სად გაიგზავნოს ლიდი (POST JSON). მაგ: Google Apps Script Web App URL,
  // Make/Zapier webhook, Formspree ან თქვენი CRM-ის endpoint.
  // ცარიელის შემთხვევაში ლიდი მხოლოდ კონსოლში დაიწერება (ტესტირებისთვის).
  leadEndpoint: '',

  // Google Ads კონვერსია: 'AW-XXXXXXXXXX/YYYYYYYYYYYY'
  // (Google Ads → Goals → Conversions → Tag setup → send_to)
  adsConversionSendTo: 'AW-XXXXXXXXXX/YYYYYYYYYYYY',
  // Google Analytics 4 Measurement ID (არასავალდებულო), მაგ: 'G-XXXXXXXXXX'
  ga4Id: '',
  // სატელეფონო ზარზე დაჭერის კონვერსია (არასავალდებულო)
  adsCallConversionSendTo: '',

  // მადლობის გვერდი (კონვერსია იქაც ფიქსირდება)
  thankYouUrl: 'thank-you.html'
};
