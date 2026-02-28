/**
 * config.js — Costanti e Supabase client
 */
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

// ── Costanti ──────────────────────────────────────────────
export const RARITY_RANK = { SEC: 0, SP: 1, SR: 2, L: 3, R: 4, C: 5 };

export const COLOR_MAP = {
  Red: '#dc2626',
  Green: '#16a34a',
  Blue: '#2563eb',
  Purple: '#9333ea',
  Black: '#64748b',
  Yellow: '#ca8a04'
};

export const CDN_BASE = 'https://tcgplayer-cdn.tcgplayer.com/product';

// ── Supabase ──────────────────────────────────────────────
// Queste sono chiavi pubbliche (anon key). La sicurezza è nell'RLS lato DB.
const SUPABASE_URL = 'https://jqrqxasfbmusxtwnwwgo.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpxcnF4YXNmYm11c3h0d253d2dvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzIyMzAxMTYsImV4cCI6MjA4NzgwNjExNn0.dbcjo-_Ai5xw_am-F0pKY23dO8bKOwbLuW3u_gxXJHU';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
