/**
 * auth.js — Autenticazione Google OAuth via Supabase
 */
import { supabase } from './config.js';

export async function signInWithGoogle() {
  const { error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: { redirectTo: window.location.origin }
  });
  if (error) alert(error.message);
}

export async function signOut() {
  const { error } = await supabase.auth.signOut();
  if (error) alert(error.message);
}

export async function getSession() {
  const { data, error } = await supabase.auth.getSession();
  if (error) console.warn(error);
  return data.session;
}

export function onAuthStateChange(cb) {
  return supabase.auth.onAuthStateChange((_event, session) => cb(session));
}

export async function getMyProfile() {
  const { data, error } = await supabase
    .from('profiles')
    .select('email,is_admin')
    .single();
  if (error) return null;
  return data;
}
