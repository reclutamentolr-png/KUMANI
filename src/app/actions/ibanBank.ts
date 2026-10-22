'use server'

import banks from '@/data/banks-it.json'
import branches from '@/data/bank-branches-it.json'

// Verifica IBAN: banca e sportello di un IBAN italiano dal registro pubblico
// della Banca d'Italia (scripts/bank-registry.mjs). Arrivano solo ABI e CAB,
// mai il numero di conto; niente viene salvato.

export type IbanBankKind = 'bank' | 'ip' | 'imel' | 'poste'
export type IbanBankInfo = {
  bank: { name: string; kind: IbanBankKind } | null
  branch: { address: string; cap: string; city: string } | null
}

const BANKS = banks as unknown as Record<string, [string, IbanBankKind]>
const BRANCHES = branches as Record<string, string>

export async function lookupIbanBank(abi: string, cab: string): Promise<IbanBankInfo> {
  if (!/^\d{5}$/.test(abi) || !/^\d{5}$/.test(cab)) return { bank: null, branch: null }
  const bank = BANKS[abi]
  const raw = BRANCHES[`${abi}-${cab}`]
  const [address = '', cap = '', city = ''] = raw ? raw.split('|') : []
  return {
    bank: bank ? { name: bank[0], kind: bank[1] } : null,
    branch: raw ? { address, cap, city } : null,
  }
}
