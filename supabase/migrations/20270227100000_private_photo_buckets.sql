-- Foto con dati personali (ritratti dei CV, foto degli oggetti delle ricevute):
-- spazi privati. Le pagine le mostrano con link firmati che scadono dopo
-- un'ora (src/lib/privatePhotos.ts); i vecchi indirizzi pubblici non
-- funzionano più, anche se fossero stati copiati o archiviati altrove.
update storage.buckets set public = false where id in ('cv-photos', 'receipt-photos-v2');
