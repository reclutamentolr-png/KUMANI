import { notifyUser, pushDb } from '@/lib/push'

// Avvisi allo Staff (Centro avvisi + notifica sul telefono) per le cose da
// controllare. Li ricevono gli amministratori con tutti i permessi e quelli
// del ruolo con il permesso indicato (es. listings.write per la Bacheca).
async function staffIds(permission: string): Promise<string[]> {
  const db = pushDb()
  const [{ data: admins }, { data: staff }] = await Promise.all([
    db.from('profiles').select('id').eq('is_admin', true),
    db.from('admin_users').select('user_id, admin_roles(permissions)'),
  ])
  const ids = new Set<string>((admins ?? []).map((a) => a.id as string))
  for (const row of staff ?? []) {
    const roles = row.admin_roles as { permissions?: string[] } | { permissions?: string[] }[] | null
    const perms = Array.isArray(roles) ? (roles[0]?.permissions ?? []) : (roles?.permissions ?? [])
    if (perms.includes('*') || perms.includes(permission)) ids.add(row.user_id as string)
  }
  return [...ids]
}

// Nuovo annuncio in Bacheca da approvare o rifiutare. Mai bloccante.
export async function notifyStaffOfListing(listing: { id: string; title?: string | null }, authorId: string) {
  try {
    const db = pushDb()
    const [ids, { data: author }] = await Promise.all([staffIds('listings.write'), db.from('profiles').select('first_name, last_name').eq('id', authorId).maybeSingle()])
    const name = [author?.first_name, author?.last_name].filter(Boolean).join(' ').trim() || '—'
    const title = String(listing.title ?? '').slice(0, 80)
    for (const id of ids) {
      if (id === authorId) continue
      await notifyUser(
        id,
        'staff',
        (t) => ({
          title: t('adminListingTitle'),
          body: t('adminListingBody', { name, title }),
          url: '/admin?section=listingReports',
          tag: `admin-listing-${listing.id}`,
        }),
        { kind: 'admin_listing', ref: listing.id }
      )
    }
  } catch (error) {
    console.error('[avvisi] avviso annuncio allo Staff non inviato:', error instanceof Error ? error.message : error)
  }
}

// Nuova segnalazione nella Rete Anti-Truffa: solo agli amministratori (non ai
// ruoli dello Staff), con nome e città di chi segnala, per controllarla subito.
// Mai bloccante.
export async function notifyAdminsOfScamReport(report: { id: string; value: string; confirmed: boolean }, reporterId: string) {
  try {
    const db = pushDb()
    const [{ data: admins }, { data: reporter }] = await Promise.all([
      db.from('profiles').select('id').eq('is_admin', true),
      db.from('profiles').select('first_name, last_name, city').eq('id', reporterId).maybeSingle(),
    ])
    const name = [reporter?.first_name, reporter?.last_name].filter(Boolean).join(' ').trim() || '—'
    const who = reporter?.city ? `${name} (${reporter.city})` : name
    const value = report.value.slice(0, 80)
    for (const admin of admins ?? []) {
      if (admin.id === reporterId) continue
      await notifyUser(
        admin.id as string,
        'staff',
        (t) => ({
          title: t('adminScamTitle'),
          body: t(report.confirmed ? 'adminScamBodyKnown' : 'adminScamBody', { name: who, value }),
          url: '/admin?section=antitruffa',
          tag: `admin-scam-${report.id}`,
        }),
        { kind: 'admin_scam_report', ref: report.id }
      )
    }
  } catch (error) {
    console.error('[avvisi] avviso segnalazione anti-truffa non inviato:', error instanceof Error ? error.message : error)
  }
}
