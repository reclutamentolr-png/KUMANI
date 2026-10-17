-- QR Code PRO: tipo «multi», una pagina con più contatti (sito, WhatsApp,
-- chiamata, SMS, email, Wi-Fi, scheda contatto) aperta da /q/<codice> → /qr/<codice>.
-- La destinazione è {title, subtitle, items: [{type, label, data}]}; la lettura
-- pubblica resta quella di get_qr_pro_destination (solo codici attivi).
ALTER TABLE qr_pro_codes DROP CONSTRAINT IF EXISTS qr_pro_codes_content_type_check;
ALTER TABLE qr_pro_codes ADD CONSTRAINT qr_pro_codes_content_type_check
  CHECK (content_type IN ('link', 'whatsapp', 'phone', 'sms', 'email', 'wifi', 'vcard', 'multi'));
