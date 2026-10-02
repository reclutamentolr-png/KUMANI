'use server'

import { createClient } from '@/lib/supabase/server'
import { hasActiveToolAccess } from '@/lib/subscriptionGate'
import type { JobFilters, JobResult } from '@/lib/jobs/types'

// Trova Lavoro: annunci preferiti e ricerche salvate dell'utente.

type Result<T = null> = { success: true; data: T } | { success: false; message: string }

async function gate() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { supabase, user: null, allowed: false }
  return { supabase, user, allowed: await hasActiveToolAccess(supabase, user.id, 'trova-lavoro') }
}

// Solo i campi mostrati, con lunghezze limitate
function cleanJob(job: JobResult) {
  const s = (v: unknown, max: number) => String(v ?? '').slice(0, max)
  return {
    key: s(job.key, 400),
    title: s(job.title, 300),
    company: s(job.company, 200),
    location: s(job.location, 200),
    salaryText: s(job.salaryText, 120),
    salaryMonthly: typeof job.salaryMonthly === 'number' ? job.salaryMonthly : null,
    date: job.date ? s(job.date, 40) : null,
    snippet: s(job.snippet, 600),
    url: /^https:\/\//.test(String(job.url)) ? s(job.url, 1000) : '',
    remote: job.remote === true,
    flags: Array.isArray(job.flags) ? job.flags.slice(0, 6).map((f) => s(f, 30)) : [],
    matched: [],
    score: 0,
  }
}

export async function saveJobFavorite(job: JobResult): Promise<Result> {
  const { supabase, user, allowed } = await gate()
  if (!user || !allowed) return { success: false, message: 'forbidden' }
  const data = cleanJob(job)
  if (!data.key || !data.url) return { success: false, message: 'invalid' }
  const { error } = await supabase.from('job_favorites').upsert({ user_id: user.id, job_key: data.key, data }, { onConflict: 'user_id,job_key' })
  if (error) return { success: false, message: error.message.includes('limit') ? 'favoritesLimit' : 'saveError' }
  return { success: true, data: null }
}

export async function removeJobFavorite(key: string): Promise<Result> {
  const { supabase, user } = await gate()
  if (!user) return { success: false, message: 'forbidden' }
  await supabase.from('job_favorites').delete().eq('user_id', user.id).eq('job_key', key)
  return { success: true, data: null }
}

export async function listJobFavorites(): Promise<JobResult[]> {
  const { supabase, user } = await gate()
  if (!user) return []
  const { data } = await supabase.from('job_favorites').select('data').eq('user_id', user.id).order('created_at', { ascending: false }).limit(300)
  return (data ?? []).map((row) => row.data as JobResult)
}

export async function saveJobSearch(name: string, filters: JobFilters): Promise<Result<{ id: string }>> {
  const { supabase, user, allowed } = await gate()
  if (!user || !allowed) return { success: false, message: 'forbidden' }
  const clean = String(name ?? '').trim().slice(0, 80)
  if (!clean) return { success: false, message: 'invalid' }
  const { data, error } = await supabase.from('job_searches').insert({ user_id: user.id, name: clean, filters }).select('id').single()
  if (error || !data) return { success: false, message: error?.message.includes('limit') ? 'searchesLimit' : 'saveError' }
  return { success: true, data: { id: data.id } }
}

export async function removeJobSearch(id: string): Promise<Result> {
  const { supabase, user } = await gate()
  if (!user) return { success: false, message: 'forbidden' }
  await supabase.from('job_searches').delete().eq('user_id', user.id).eq('id', id)
  return { success: true, data: null }
}

export async function listJobSearches(): Promise<{ id: string; name: string; filters: JobFilters }[]> {
  const { supabase, user } = await gate()
  if (!user) return []
  const { data } = await supabase.from('job_searches').select('id, name, filters').eq('user_id', user.id).order('created_at', { ascending: false }).limit(30)
  return (data ?? []) as { id: string; name: string; filters: JobFilters }[]
}
