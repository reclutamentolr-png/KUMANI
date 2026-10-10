import createMiddleware from 'next-intl/middleware';
import { createServerClient } from '@supabase/ssr';
import { NextResponse } from 'next/server';
import { NextRequest } from 'next/server';
import type { NextFetchEvent } from 'next/server';
import { readProxySettings } from './lib/enabledLocalesCore';
import { blockedIps, clientIp, PROBE_PATH, recordSecurityEvent } from './lib/securityCore';
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
  'garage',
  'casa',
  'findo',
  'digital-receipt',
  'aureya',
  'spendly',
  'fidelity',
  'menu',
  'landing-page',
  'shop',
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
const AGENT_ALLOWED = /^\/(agente|codici-prova|marketplace|login|auth|forgot-password|reset-password|maintenance)(\/|$)/;
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

// Utente letto dal token della sessione (id e ruolo scritto dal server in
// app_metadata, che è dentro il token firmato).
type SessionUser = { id: string; app_metadata?: { role?: string; trial_tool?: string; trial_until?: string } };

const LOCALE_COOKIE = { path: '/', maxAge: 60 * 60 * 24 * 365, sameSite: 'lax' as const };

// Anteprima delle lingue spente: traduttori (ruolo nell'account) e Staff.
// Si controlla solo quando si apre una lingua spenta (caso raro).
async function canPreviewHiddenLocales(
  supabase: ReturnType<typeof createServerClient>,
  user: SessionUser | null
): Promise<boolean> {
  if (!user) return false;
  if (user.app_metadata?.role === 'translator') return true;
  const [{ data: profile }, { data: staff }] = await Promise.all([
    supabase.from('profiles').select('is_admin').eq('id', user.id).maybeSingle(),
    supabase.from('admin_users').select('user_id').eq('user_id', user.id).maybeSingle(),
  ]);
  return profile?.is_admin === true || !!staff;
}

export async function proxy(request: NextRequest, event: NextFetchEvent) {
  // Sicurezza: IP bloccati dall'Admin (Admin → Sicurezza) e indirizzi da
  // hacker (WordPress, phpMyAdmin…), che su KUMANI non esistono: si
  // registra il tentativo e si risponde «non trovato» senza aprire il sito.
  const ip = clientIp(request.headers);
  if (ip && (await blockedIps()).has(ip)) {
    return new NextResponse('Accesso bloccato / Access blocked', { status: 403 });
  }
  if (PROBE_PATH.test(request.nextUrl.pathname)) {
    event.waitUntil(
      recordSecurityEvent({
        kind: 'probe',
        severity: 'low',
        ip,
        path: request.nextUrl.pathname,
        userAgent: request.headers.get('user-agent'),
      })
    );
    return new NextResponse('Not found', { status: 404 });
  }

  const { locales: enabledLocales, maintenanceOn } = await proxySettings();
  const urlSegments = request.nextUrl.pathname.split('/').filter(Boolean);
  const urlLocale = urlSegments[0] && locales.includes(urlSegments[0]) ? urlSegments[0] : null;

  // Sessione: si rinnova PRIMA di tutto il resto. Il token nuovo va nella
  // richiesta (così la pagina e le azioni del server lo usano subito, senza
  // rinnovarlo una seconda volta con il vecchio: era il ciclo dashboard →
  // login → dashboard a sessione scaduta) e nella risposta per il browser.
  let response: NextResponse | null = null;
  const refreshedCookies: { name: string; value: string; options?: Parameters<NextResponse['cookies']['set']>[2] }[] = [];
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
          cookiesToSet.forEach((cookie) => {
            refreshedCookies.push(cookie);
            response?.cookies.set(cookie.name, cookie.value, cookie.options);
          });
        },
      },
    }
  );

  // getClaims verifica il token in locale (chiavi di firma asimmetriche) e,
  // come getUser, rinnova la sessione scaduta scrivendo i cookie; con chiavi
  // simmetriche ricade da solo sulla chiamata a Supabase Auth. Senza alcun
  // cookie di Supabase (sb-…) non c'è sessione: si salta del tutto.
  let user: SessionUser | null = null;
  if (request.cookies.getAll().some((c) => c.name.startsWith('sb-'))) {
    try {
      const { data } = await supabase.auth.getClaims();
      const claims = data?.claims;
      if (claims?.sub) {
        user = { id: claims.sub, app_metadata: claims.app_metadata as SessionUser['app_metadata'] };
      }
    } catch {
      user = null;
    }
  }

  response = intlMiddleware(request);
  refreshedCookies.forEach((cookie) => response!.cookies.set(cookie.name, cookie.value, cookie.options));

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
      refreshedCookies.forEach((cookie) => response!.cookies.set(cookie.name, cookie.value, cookie.options));
    }
  }

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
  if (user && user.app_metadata?.role === 'translator') {
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
  if (user && user.app_metadata?.role === 'agent') {
    const segments = request.nextUrl.pathname.split('/').filter(Boolean);
    const hasLocale = !!segments[0] && locales.includes(segments[0]);
    const localePrefix = hasLocale ? `/${segments[0]}` : '';
    const barePath = '/' + (hasLocale ? segments.slice(1) : segments).join('/');
    if (!AGENT_ALLOWED.test(barePath) || AGENT_BLOCKED_TOOLS.test(barePath)) {
      return NextResponse.redirect(new URL(`${localePrefix}/agente`, request.url));
    }
  }

  // Ospiti in prova (codice di prova, ruolo scritto dal server nell'account):
  // solo il servizio della prova, fino alla scadenza; poi la pagina di fine
  // prova. Niente dashboard, rete, Wallet, community né altri servizi.
  if (user && user.app_metadata?.role === 'guest') {
    const segments = request.nextUrl.pathname.split('/').filter(Boolean);
    const hasLocale = !!segments[0] && locales.includes(segments[0]);
    const localePrefix = hasLocale ? `/${segments[0]}` : '';
    const barePath = '/' + (hasLocale ? segments.slice(1) : segments).join('/');
    const tool = user.app_metadata.trial_tool ?? '';
    const until = Date.parse(user.app_metadata.trial_until ?? '');
    const active = Number.isFinite(until) && until > Date.now();
    if (!active) {
      if (!/^\/(prova|auth|terms|privacy|register)(\/|$)/.test(barePath)) {
        return NextResponse.redirect(new URL(`${localePrefix}/prova/fine`, request.url));
      }
    } else {
      const toolPath = new RegExp(`^/marketplace/${tool.replace(/[^a-z0-9-]/g, '')}(/|$)`);
      if (!toolPath.test(barePath) && !/^\/(prova|auth|terms|privacy|maintenance)(\/|$)/.test(barePath)) {
        return NextResponse.redirect(new URL(`${localePrefix}/marketplace/${tool}`, request.url));
      }
    }
  }

  // Già collegato e sulla pagina di accesso (link «Accedi» della homepage,
  // segnalibro…): niente nuovo login, si entra direttamente. Con ?next= si
  // torna lì (solo indirizzi interni); gli ospiti in prova restano dove sono.
  if (user && user.app_metadata?.role !== 'guest') {
    const segments = request.nextUrl.pathname.split('/').filter(Boolean);
    const hasLocale = !!segments[0] && locales.includes(segments[0]);
    const localePrefix = hasLocale ? `/${segments[0]}` : '';
    const barePath = '/' + (hasLocale ? segments.slice(1) : segments).join('/');
    if (barePath === '/login') {
      const role = user.app_metadata?.role;
      const next = request.nextUrl.searchParams.get('next') ?? '';
      const home = role === 'agent' ? '/agente' : role === 'translator' ? '/traduzioni' : '/dashboard';
      const target = !role && next.startsWith('/') && !next.startsWith('//') && !next.startsWith('/\\') ? next : home;
      return NextResponse.redirect(new URL(`${localePrefix}${target}`, request.url));
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
      ? supabase
          .rpc('can_use_tool', { p_tool: toolName })
          .maybeSingle<{ allowed: boolean; required_plan: string; known: boolean }>()
          // .then fa partire davvero la richiesta adesso (le query di
          // Supabase partono solo quando vengono attese)
          .then((r) => r)
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
        // Ospite con la prova chiusa in anticipo (codice cancellato): fine prova
        if (user.app_metadata?.role === 'guest') {
          return NextResponse.redirect(new URL(`${localePrefix}/prova/fine`, request.url));
        }
        // Kordata, Bacheca e chat spente dallo Staff restano consultabili in
        // sola lettura (la pagina mostra il banner "sospeso", le scritture
        // sono bloccate dal database): si passa se il motivo è solo lo spegnimento.
        // Le due letture qui sotto sono alternative (piano 'free' oppure
        // no), quindi al più una: non c'è nulla da mettere in parallelo.
        if (READ_ONLY_WHEN_OFF.includes(toolName) && access.required_plan === 'free') {
          const { data: online } = await supabase.rpc('tool_online', { p_tool: toolName });
          if (online === false) return response;
        }
        // Servizio acquistabile anche da solo (pass): pagina del pass, che
        // propone pass, codice o abbonamento.
        if (access.required_plan !== 'free') {
          const { data: passSetting } = await supabase
            .from('marketplace_settings')
            .select('pass_enabled')
            .eq('tool_name', toolName)
            .maybeSingle<{ pass_enabled: boolean | null }>();
          if (passSetting?.pass_enabled) {
            return NextResponse.redirect(new URL(`${localePrefix}/pass/${toolName}`, request.url));
          }
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
