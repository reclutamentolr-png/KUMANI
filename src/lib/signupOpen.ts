// Iscrizioni aperte o chiuse: lo decide l'interruttore di Supabase
// (Authentication → «Allow new users to sign up»), che blocca davvero la
// creazione di account anche fuori dal sito. La pagina di registrazione legge
// lo stesso valore (impostazioni pubbliche di Auth, aggiornate ogni minuto):
// al lancio basta riaccendere l'interruttore. Gli account creati dal server
// (codici di prova, agenti, traduttori, Admin) non ne sono toccati.
export async function isSignupOpen(): Promise<boolean> {
  try {
    const res = await fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/auth/v1/settings`, {
      headers: { apikey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY! },
      next: { revalidate: 60 },
    })
    if (!res.ok) return true
    const settings = (await res.json()) as { disable_signup?: boolean }
    return settings.disable_signup !== true
  } catch {
    // Se il controllo non riesce si mostra il modulo, come sempre
    return true
  }
}
