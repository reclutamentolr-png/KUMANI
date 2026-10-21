import { NextRequest, NextResponse } from 'next/server'
import { clientIp } from '@/lib/securityCore'

// Scudo Dati → «Cosa vede un sito di te»: restituisce a chi fa la richiesta i
// SUOI dati di rete, come li vedrebbe un link spia (IP e zona approssimativa
// dalla rete di Vercel). Nessun dato viene salvato.

const header = (request: NextRequest, name: string) => {
  const value = request.headers.get(name)
  if (!value) return null
  try {
    return decodeURIComponent(value).slice(0, 80)
  } catch {
    return value.slice(0, 80)
  }
}

export async function GET(request: NextRequest) {
  return NextResponse.json(
    {
      ip: clientIp(request.headers),
      city: header(request, 'x-vercel-ip-city'),
      region: header(request, 'x-vercel-ip-country-region'),
      country: header(request, 'x-vercel-ip-country'),
    },
    { headers: { 'Cache-Control': 'private, no-store' } }
  )
}
