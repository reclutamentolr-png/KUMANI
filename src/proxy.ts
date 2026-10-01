import createMiddleware from 'next-intl/middleware';
import { createServerClient } from '@supabase/ssr';
import type { User } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';
import { NextRequest } from 'next/server';
import { readProxySettings } from './lib/enabledLocalesCore';
import { locales, defaultLocale } from '../i18n';

const intlMiddleware = createMiddleware({
  locales,
  defaultLocale,
  localePrefix: 'as-needed'
});

// Strumenti che, spenti in Admin, restano aperti in sola lettura.
const READ_ONLY_WHEN_OFF = ['convivio', 'listings', 'chat', 'timebank', 'mosaic', 'fabula'];

// Strumenti a pagamento: se il controllo del piano (can_use_tool) non riesce
// per un errore momentaneo, l'accesso viene negato (meglio "riprova" che
// aprire uno strumento Pro a chi ha il Base). La regola vera è nel database.
const PAID_TOOLS = [
  'link-in-bio',
  'memolife',
  'neurobalance',
  'svat',
  'offermaker',
  'qr-code-pro',
  'life-calendar',
  'findo',
  'digital-receipt',
  'aureya',
  'spendly',
  'fidelity',
  'menu',
  'preventivi',
  'kumani-cv',
  'spotlight',
  'verifoto',
  'checkmail',
  'magazzino',
  'documento-sicuro',
  'firma-email',
  'calcolatrici',
];

// Pagine consentite agli agenti venditori e servizi della community esclusi
const AGENT_ALLOWED = /^\/(agente|marketplace|login|auth|forgot-password|reset-password|maintenance)(\/|$)/;
const AGENT_BLOCKED_TOOLS = /^\/marketplace\/(listings|chat|convivio|timebank|affinity|spotlight|mosaic|fabula|veritas)(\/|$)/;

// Pagine consentite ai traduttori (tutto il resto riporta all'Area Traduttori)
const TRANSLATOR_ALLOWED = /^\/(traduzioni|login|auth|forgot-password|reset-password|maintenance)(\/|$)/;

// Pagine sempre raggiungibili durante la manutenzione (accesso dello Staff).
const MAINTENANCE_EXEMPT = /^\/(admin|auth|login|forgot-password|reset-password|maintenance)(\/|$)/;

// Extracts the tool name from a path like /marketplace/memolife/new or
// /en/marketplace/memolife/new, after stripping an optional locale prefix.
function extractToolName(pathname: string): string | null {
  const segments = pathname.split('/').filter(Boolean);
  if (segments[0] && locales.includes(segments[0])) {
    segments.shift();
  }
  if (segments[0] === 'marketplace' && segments[1]) {
    return segments[1];
  }
  return null;
}

// Lingue attive (Admin → Lingue del sito) e manutenzione accesa/spenta: in
// memoria 30 secondi in questo processo, così non si legge il database a
// ogni pagina. Una modifica dall'Admin vale entro 30 secondi.
type ProxySettings = { locales: string[]; maintenanceOn: boolean };
let settingsCache: { at: number; value: ProxySettings } | null = null;
async function proxySettings(): Promise<ProxySettings> {
  if (settingsCache && Date.now() - settingsCache.at < 30_000) return settingsCache.value;
  try {
    const value = await readProxySettings();
    settingsCache = { at: Date.now(), value };
    return value;
  } catch {
    // Database non raggiungibile: si controlla la manutenzione come prima
    return settingsCache?.value ?? { locales: [...locales], maintenanceOn: true };
  }
}

const LOCALE_COOKIE = { path: '/', maxAge: 60 * 60 * 24 * 365, sameSite: 'lax' as const };

// Anteprima delle lingue spente: traduttori (ruolo nell'account) e Staff.
// Si controlla solo quando si apre una lingua spenta (caso raro).
async function canPreviewHiddenLocales(
  supabase: ReturnType<typeof createServerClient>,
  user: User | null
): Promise<boolean> {
  if (!user) return false;
  if ((user.app_metadata as { role?: string } | undefined)?.role === 'translator') return true;
  const [{ data: profile }, { data: staff }] = await Promise.all([
    supabase.from('profiles').select('is_admin').eq('id', user.id).maybeSingle(),
    supabase.from('admin_users').select('user_id').eq('user_id', user.id).maybeSingle(),
  ]);
  return profile?.is_admin === true || !!staff;
}

export async function proxy(request: NextRequest) {
  const { locales: enabledLocales, maintenanceOn } = await proxySettings();
  const urlSegments = request.nextUrl.pathname.split('/').filter(Boolean);
  const urlLocale = urlSegments[0] && locales.includes(urlSegments[0]) ? urlSegments[0] : null;

  let response = intlMiddleware(request);

  // Lingua scelta in automatico (lingua del telefono o cookie di una visita
  // precedente) ma spenta dall'Admin: si resta in italiano
  const location = response.headers.get('location');
  if (!urlLocale && location) {
    const target = new URL(location, request.url).pathname.split('/').filter(Boolean)[0];
    if (target && locales.includes(target) && !enabledLocales.includes(target)) {
      const headers = new Headers(request.headers);
      headers.set('accept-language', defaultLocale);
      const otherCookies = request.cookies.getAll().filter((c) => c.name !== 'NEXT_LOCALE').map((c) => `${c.name}=${c.value}`);
      headers.set('cookie', [...otherCookies, `NEXT_LOCALE=${defaultLocale}`].join('; '));
      response = intlMiddleware(new NextRequest(request.url, { headers }));
      response.cookies.set('NEXT_LOCALE', defaultLocale, LOCALE_COOKIE);
    }
  }

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Lingua spenta dall'Admin nell'indirizzo (/de/...): stessa pagina in
  // italiano. Lo Staff e i traduttori la vedono lo stesso (anteprima).
  if (urlLocale && !enabledLocales.includes(urlLocale) && !(await canPreviewHiddenLocales(supabase, user))) {
    const url = request.nextUrl.clone();
    url.pathname = '/' + urlSegments.slice(1).join('/');
    const redirect = NextResponse.redirect(url);
    redirect.cookies.set('NEXT_LOCALE', defaultLocale, LOCALE_COOKIE);
    return redirect;
  }

  // Traduttori (account creati dall'Admin, ruolo scritto dal server
  // nell'account): vedono solo l'Area Traduttori, niente dashboard né
  // servizi. Nessuna lettura in più: il ruolo arriva con l'utente.
  if (user && (user.app_metadata as { role?: string } | undefined)?.role === 'translator') {
    const segments = request.nextUrl.pathname.split('/').filter(Boolean);
    const hasLocale = !!segments[0] && locales.includes(segments[0]);
    const localePrefix = hasLocale ? `/${segments[0]}` : '';
    const barePath = '/' + (hasLocale ? segments.slice(1) : segments).join('/');
    if (!TRANSLATOR_ALLOWED.test(barePath)) {
      return NextResponse.redirect(new URL(`${localePrefix}/traduzioni`, request.url));
    }
  }

  // Agenti venditori: la loro area e i servizi (piano Pro incluso), niente
  // dashboard, rete o servizi della community (nessun contatto con i Kumani)
  if (user && (user.app_metadata as { role?: string } | undefined)?.role === 'agent') {
    const segments = request.nextUrl.pathname.split('/').filter(Boolean);
    const hasLocale = !!segments[0] && locales.includes(segments[0]);
    const localePrefix = hasLocale ? `/${segments[0]}` : '';
    const barePath = '/' + (hasLocale ? segments.slice(1) : segments).join('/');
    if (!AGENT_ALLOWED.test(barePath) || AGENT_BLOCKED_TOOLS.test(barePath)) {
      return NextResponse.redirect(new URL(`${localePrefix}/agente`, request.url));
    }
  }

  // Controllo del piano per gli strumenti (vedi sotto): parte subito, in
  // parallelo al controllo della manutenzione, invece che dopo.
  const toolName = extractToolName(request.nextUrl.pathname);

  // Gli strumenti sono solo per chi ha fatto l'accesso: prima alcune pagine
  // (es. CheckMail, VeriFoto, OXYGEN) si aprivano anche senza login, perché
  // il controllo del piano qui sotto scatta solo per gli utenti collegati.
  // Il Manuale Anti-Truffa porta invece alla sua anteprima pubblica.
  if (!user && toolName) {
    const segments = request.nextUrl.pathname.split('/').filter(Boolean);
    const localePrefix = segments[0] && locales.includes(segments[0]) ? `/${segments[0]}` : '';
    // Dopo l'accesso si torna qui (?next=, senza lingua: la aggiunge il login)
    const barePath = '/' + (localePrefix ? segments.slice(1) : segments).join('/');
    const next = encodeURIComponent(barePath + request.nextUrl.search);
    const target = toolName === 'antitruffa' ? `${localePrefix}/manuale-antitruffa` : `${localePrefix}/login?next=${next}`;
    return NextResponse.redirect(new URL(target, request.url));
  }
  const accessCheck =
    user && toolName
      ? supabase.rpc('can_use_tool', { p_tool: toolName }).maybeSingle<{ allowed: boolean; required_plan: string; known: boolean }>()
      : null;

  // Manutenzione (Admin → Impostazioni): vale davvero, non solo a schermo.
  // Chi non è Staff viene portato alla pagina di manutenzione e i salvataggi
  // (server action / POST) sono rifiutati. I webhook Stripe (/api) passano.
  {
    const segments = request.nextUrl.pathname.split('/').filter(Boolean);
    const hasLocale = !!segments[0] && locales.includes(segments[0]);
    const localePrefix = hasLocale ? `/${segments[0]}` : '';
    const barePath = '/' + (hasLocale ? segments.slice(1) : segments).join('/');
    // Solo a manutenzione accesa si chiede al database se l'utente è Staff
    if (maintenanceOn && !MAINTENANCE_EXEMPT.test(barePath)) {
      const { data: maintenance, error: maintenanceError } = await supabase.rpc('maintenance_status');
      const state = maintenance as { enabled?: boolean; staff?: boolean } | null;
      if (!maintenanceError && state?.enabled && !state.staff) {
        if (request.method !== 'GET' || request.headers.has('next-action')) {
          return new NextResponse('KUMANI è in manutenzione. Riprova tra poco.', { status: 503 });
        }
        return NextResponse.redirect(new URL(`${localePrefix}/maintenance`, request.url));
      }
    }
  }

  // Server-side enforcement of the subscription-required tools: every UI
  // entry point (marketplace grid, dashboard tool list) is supposed to
  // hide/disable these for a non-active user, but that's presentation
  // only — someone who navigates straight to the URL (bookmark, typed,
  // shared link) bypassed all of it before this check existed. This is
  // the actual access-control boundary; the UI-level hiding is just a
  // courtesy on top of it. Free/unauthenticated visitors are bounced to
  // /dashboard, where both "Abbonati ora" and "Attiva tramite Voucher"
  // are one click away.
  if (user && toolName && accessCheck) {
    const segments = request.nextUrl.pathname.split('/').filter(Boolean);
    const localePrefix = segments[0] && locales.includes(segments[0]) ? `/${segments[0]}` : '';
    const { data: access, error: accessError } = await accessCheck;

    if (!accessError && access) {
      // Solo gli strumenti censiti (le altre pagine del marketplace, es.
      // bacheca o categorie, non passano da qui). Strumento Pro senza piano
      // Pro → pagina "Passa a Pro"; altrimenti dashboard con "Abbonati ora".
      if (access.known && !access.allowed) {
        // Kordata, Bacheca e chat spente dallo Staff restano consultabili in
        // sola lettura (la pagina mostra il banner "sospeso", le scritture
        // sono bloccate dal database): si passa se il motivo è solo lo spegnimento.
        if (READ_ONLY_WHEN_OFF.includes(toolName) && access.required_plan === 'free') {
          const { data: online } = await supabase.rpc('tool_online', { p_tool: toolName });
          if (online === false) return response;
        }
        const target = access.required_plan === 'pro' ? `${localePrefix}/pro?tool=${toolName}` : `${localePrefix}/dashboard`;
        return NextResponse.redirect(new URL(target, request.url));
      }
      return response;
    }
  }
  // Controllo del piano non riuscito: strumenti a pagamento chiusi (si torna
  // alla dashboard e si riprova), mai aperti a tutti.
  if (user && toolName && PAID_TOOLS.includes(toolName)) {
    const segments = request.nextUrl.pathname.split('/').filter(Boolean);
    const localePrefix = segments[0] && locales.includes(segments[0]) ? `/${segments[0]}` : '';
    return NextResponse.redirect(new URL(`${localePrefix}/dashboard`, request.url));
  }

  return response;
}

export const config = {
  // Ignora: api, short link /o/* e /q/*, /billing (pagina non localizzata,
  // fuori da [locale] — senza questa esclusione next-intl la riscrive come
  // /it/billing, che non esiste, causando 404 anche sulla pagina di
  // successo pagamento Stripe), _next, favicon.ico e file con estensioni di
  // immagini/asset
  matcher: [
    '/((?!api|o/|q/|billing|_next/static|_next/image|favicon.ico|.*\\..*).*)'
  ]
};
