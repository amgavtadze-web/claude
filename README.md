# ალფა სახლი — ლენდინგ გვერდი (Google Ads ლიდები)

სტატიკური, სწრაფი ლენდინგი Google რეკლამიდან ლიდების მისაღებად. არ საჭიროებს build-ს — ატვირთეთ ნებისმიერ ჰოსტინგზე (Netlify, Vercel, GitHub Pages, cPanel).

## ფაილები

| ფაილი | დანიშნულება |
|---|---|
| `index.html` | მთავარი ლენდინგი (hero ფორმა, უპირატესობები, ბინები, განვადების კალკულატორი, მდებარეობა, FAQ, ქვედა ფორმა) |
| `thank-you.html` | მადლობის გვერდი ფორმის გაგზავნის შემდეგ |
| `privacy.html` | კონფიდენციალურობის პოლიტიკის შაბლონი (Google Ads-ისთვის საჭიროა) |
| `assets/config.js` | **ყველა პარამეტრი ერთ ადგილას** — ტელეფონი, WhatsApp, მისამართი, Ads ID, ლიდების endpoint |
| `assets/gtag.js` | Google tag-ის ჩატვირთვა config-დან |
| `assets/main.js` | ფორმები, ვალიდაცია, gclid/UTM შენახვა, კონვერსიები, კალკულატორი |
| `assets/styles.css` | სტილები (მობილურზე ოპტიმიზებული, sticky „დარეკვა / WhatsApp“ ზოლით) |

## გაშვებამდე

1. **`assets/config.js`** — შეავსეთ:
   - `phone`, `phoneDisplay`, `whatsapp` — რეალური ნომრები;
   - `address`, `mapQuery` — მისამართი და რუკის ძიება;
   - `adsConversionSendTo` — Google Ads → Goals → Conversions → ახალი „Submit lead form“ კონვერსია → Tag setup → `send_to` (მაგ. `AW-123456789/AbC-dEfGhIj`);
   - `adsCallConversionSendTo` (სურვილისამებრ) — ზარზე დაჭერის კონვერსია;
   - `ga4Id` (სურვილისამებრ);
   - `leadEndpoint` — სადაც გაიგზავნება ლიდები (იხ. ქვემოთ).
2. გადაამოწმეთ ტექსტები `index.html`-ში (ფართობები, განვადების ვადა, უპირატესობები) — ჩასვით რეალური მონაცემები და ფოტოები.
3. `index.html`-ში შეცვალეთ `canonical` მისამართი რეალური დომენით.
4. `privacy.html` — შეავსეთ კომპანიის რეკვიზიტები.

## ლიდების მიღება — Google Sheets (უფასო ვარიანტი)

1. შექმენით Google Sheet → Extensions → Apps Script და ჩასვით:

   ```js
   function doPost(e) {
     var data = JSON.parse(e.postData.contents);
     var sheet = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();
     var cols = ['submitted_at','name','phone','apartment','form_id','utm_source','utm_medium','utm_campaign','utm_term','utm_content','gclid','page','referrer'];
     if (sheet.getLastRow() === 0) sheet.appendRow(cols);
     sheet.appendRow(cols.map(function (c) { return data[c] || ''; }));
     return ContentService.createTextOutput('ok');
   }
   ```
2. Deploy → New deployment → Web app → Execute as: Me, Who has access: Anyone.
3. მიღებული URL ჩასვით `leadEndpoint`-ში.

ასევე მუშაობს ნებისმიერ webhook-თან (Make, Zapier, n8n, CRM), რომელიც იღებს JSON-ს POST-ით.

## რა იზომება

- `generate_lead` + Google Ads `conversion` — ფორმის წარმატებით გაგზავნისას (შემდეგ გადამისამართება `thank-you.html`-ზე);
- `form_start` — ფორმის შევსების დაწყება;
- `phone_click`, `whatsapp_click` — ზარის/WhatsApp-ის ღილაკები;
- `select_apartment` — ბინის ტიპის არჩევა.

`gclid` და UTM პარამეტრები ინახება ბრაუზერში და იგზავნება ყოველ ლიდთან ერთად, რათა გაიგოთ, რომელმა კამპანიამ/საკვანძო სიტყვამ მოიტანა ლიდი (ასევე გამოსადეგია Offline Conversion Import-ისთვის).

## ლოკალური ნახვა

```bash
python3 -m http.server 8000
# გახსენით http://localhost:8000
```
