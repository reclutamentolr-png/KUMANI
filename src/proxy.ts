import createMiddleware from 'next-intl/middleware';
import { createServerClient } from '@supabase/ssr';
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
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
];

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

export async function proxy(request: NextRequest) {
  const response = intlMiddleware(request);

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

  // Manutenzione (Admin → Impostazioni): vale davvero, non solo a schermo.
  // Chi non è Staff viene portato alla pagina di manutenzione e i salvataggi
  // (server action / POST) sono rifiutati. I webhook Stripe (/api) passano.
  {
    const segments = request.nextUrl.pathname.split('/').filter(Boolean);
    const hasLocale = !!segments[0] && locales.includes(segments[0]);
    const localePrefix = hasLocale ? `/${segments[0]}` : '';
    const barePath = '/' + (hasLocale ? segments.slice(1) : segments).join('/');
    if (!MAINTENANCE_EXEMPT.test(barePath)) {
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
  const toolName = extractToolName(request.nextUrl.pathname);
  if (user && toolName) {
    const segments = request.nextUrl.pathname.split('/').filter(Boolean);
    const localePrefix = segments[0] && locales.includes(segments[0]) ? `/${segments[0]}` : '';
    const { data: access, error: accessError } = await supabase
      .rpc('can_use_tool', { p_tool: toolName })
      .maybeSingle<{ allowed: boolean; required_plan: string; known: boolean }>();

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
