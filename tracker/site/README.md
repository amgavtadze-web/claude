# მოსწავლეების აღრიცხვა — Netlify-ის ვერსია (ავტომატური SMS, UBill)

მონაცემები ინახება Netlify Blobs-ში, ყოველდღე თავისით იგზავნება SMS გადახდის წინა დღეს.

## გაშვება (ერთხელ, კომპიუტერიდან)
1. Netlify → საიტი → **Site configuration → Build & deploy → Continuous deployment → Link repository**
   - GitHub რეპო: `amgavtadze-web/claude`, ბრენჩი: `ccr-3b1cb4c0-88bfrh` (ან main, როცა შეერწყმება)
   - **Base directory:** `tracker/site`
   - **Build command:** ცარიელი · **Publish directory:** `public` · **Functions directory:** `netlify/functions`
2. **Site configuration → Environment variables**:
   - `APP_PIN` — PIN, რომელსაც აპი ითხოვს
   - `UBILL_KEY` — UBill-ის API გასაღები
   - (არასავალდებულო) `UBILL_BRAND_NAME` — სათაური, ნაგულისხმევი `BeroFitness`; `UBILL_BRAND_ID` — თუ სახელით ვერ პოულობს
   - ტესტისთვის SMS-ის გარეშე: `SMS_PROVIDER=log`
3. Deploy. გახსენი საიტი, შეიყვანე PIN. თუ ამავე ტელეფონში ძველი მონაცემებია, აპი შემოგთავაზებს სერვერზე გადატანას.
4. „ტესტ SMS" ღილაკით გააგზავნე სატესტო SMS საკუთარ ნომერზე.

## როგორ მუშაობს
- `netlify/functions/remind.mjs` — ყოველდღე 10:00, 12:00 და 14:00 (თბილისი). თითო გადახდაზე SMS იგზავნება ერთხელ, დანარჩენი გაშვებები წარუმატებლების გასამეორებლადაა.
- `netlify/functions/api.mjs` — აპის API (PIN-ით დაცული).
- UBill: `POST https://api.ubill.dev/v1/sms/send`, სათაური `key`, ტანი `{brandID, numbers, text, stopList}`.
