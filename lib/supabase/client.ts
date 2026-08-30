import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import {
  getPublicSupabaseKey,
  getPublicSupabaseUrl,
  getSecret,
  hasPublicSupabaseConfig,
} from '@/lib/env/server';

export const hasSupabaseConfig = hasPublicSupabaseConfig();

/** Browser client — publishable key only. */
export function getSupabaseClient(): SupabaseClient | null {
  const url = getPublicSupabaseUrl();
  const key = getPublicSupabaseKey();
  if (!url || !key) return null;
  return createClient(url, key);
}

/**
 * Server-only. Prefer the service role for pipeline-style writes; fall back to
 * the publishable key for public reads. Never import this from Client Components.
 */
export function getServerSupabaseClient(): SupabaseClient | null {
  const url = getPublicSupabaseUrl();
  const key = getSecret('SUPABASE_SERVICE_ROLE_KEY') ?? getPublicSupabaseKey();
  if (!url || !key) return null;
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}
