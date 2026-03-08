'use client';

import type { SupabaseClient, User } from '@supabase/supabase-js';

export type SyncedProfile = {
  id: string;
  username: string;
  avatar_url: string | null;
  total_score: number;
  games_played: number;
  wins: number;
};

function sanitizeUsername(input: string) {
  const cleaned = input
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_]/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_+|_+$/g, '');

  if (!cleaned) return 'player';
  return cleaned.slice(0, 24);
}

function defaultUsernameFromUser(user: User) {
  const metadataUsername =
    typeof user.user_metadata?.username === 'string' ? user.user_metadata.username : '';
  const emailPrefix = user.email?.split('@')[0] ?? '';
  return sanitizeUsername(metadataUsername || emailPrefix || 'player');
}

function isUniqueViolation(error: { code?: string; message?: string } | null) {
  if (!error) return false;
  return (
    error.code === '23505' ||
    (typeof error.message === 'string' && error.message.toLowerCase().includes('duplicate key'))
  );
}

async function tryInsertProfile(
  supabase: SupabaseClient,
  user: User,
  username: string
): Promise<SyncedProfile | null> {
  const { data, error } = await supabase
    .from('profiles')
    .insert({
      id: user.id,
      username,
      avatar_url: null
    })
    .select('id, username, avatar_url, total_score, games_played, wins')
    .single();

  if (error) {
    if (isUniqueViolation(error)) return null;
    throw error;
  }
  return data as SyncedProfile;
}

export async function ensureUserProfile(
  supabase: SupabaseClient,
  user: User,
  preferredUsername?: string
): Promise<SyncedProfile> {
  const { data: existing, error: existingError } = await supabase
    .from('profiles')
    .select('id, username, avatar_url, total_score, games_played, wins')
    .eq('id', user.id)
    .maybeSingle();

  if (existingError) {
    throw existingError;
  }

  if (existing) {
    const desired = sanitizeUsername(preferredUsername || defaultUsernameFromUser(user));
    if (desired && desired !== existing.username) {
      const { data: updated, error: updateError } = await supabase
        .from('profiles')
        .update({ username: desired })
        .eq('id', user.id)
        .select('id, username, avatar_url, total_score, games_played, wins')
        .single();

      if (!updateError && updated) {
        return updated as SyncedProfile;
      }
      if (updateError && !isUniqueViolation(updateError)) {
        throw updateError;
      }
    }
    return existing as SyncedProfile;
  }

  const base = sanitizeUsername(preferredUsername || defaultUsernameFromUser(user));
  const suffix = user.id.replace(/-/g, '').slice(0, 6).toLowerCase();
  const candidates = [base, `${base}_${suffix}`.slice(0, 24), `${base}_${Date.now().toString(36)}`.slice(0, 24)];

  for (const candidate of candidates) {
    const created = await tryInsertProfile(supabase, user, candidate);
    if (created) return created;
  }

  const { data: finalData, error: finalError } = await supabase
    .from('profiles')
    .select('id, username, avatar_url, total_score, games_played, wins')
    .eq('id', user.id)
    .single();

  if (finalError || !finalData) {
    throw finalError ?? new Error('Failed to sync profile.');
  }

  return finalData as SyncedProfile;
}
