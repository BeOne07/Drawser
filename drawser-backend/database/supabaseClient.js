/**
 * Shared Supabase admin client and DB helper utilities.
 */
require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

const supabase = supabaseUrl && supabaseServiceKey ? createClient(supabaseUrl, supabaseServiceKey) : null;

function sanitizeUsername(input) {
    const raw = String(input || '')
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9_]/g, '_')
        .replace(/_+/g, '_')
        .replace(/^_+|_+$/g, '');
    return (raw || 'player').slice(0, 24);
}

function fallbackUsername(userId, preferredUsername) {
    const suffix = String(userId || '').replace(/-/g, '').slice(0, 6).toLowerCase();
    const base = sanitizeUsername(preferredUsername || 'player');
    return `${base}_${suffix}`.slice(0, 24);
}

async function ensureProfile(userId, preferredUsername, avatarUrl) {
    if (!supabase || !userId) return null;

    const { data: existing, error: existingError } = await supabase
        .from('profiles')
        .select('id, username, avatar_url, total_score, games_played, wins')
        .eq('id', userId)
        .maybeSingle();

    if (existingError && existingError.code !== 'PGRST116') {
        throw existingError;
    }

    if (existing) return existing;

    const username = fallbackUsername(userId, preferredUsername);
    const { data: created, error: createError } = await supabase
        .from('profiles')
        .insert({
            id: userId,
            username,
            avatar_url: avatarUrl || null,
        })
        .select('id, username, avatar_url, total_score, games_played, wins')
        .single();

    if (createError) {
        const backupUsername = fallbackUsername(userId, `player_${Date.now().toString(36)}`);
        const { data: backup, error: backupError } = await supabase
            .from('profiles')
            .upsert(
                {
                    id: userId,
                    username: backupUsername,
                    avatar_url: avatarUrl || null,
                },
                { onConflict: 'id' }
            )
            .select('id, username, avatar_url, total_score, games_played, wins')
            .single();

        if (backupError) {
            throw backupError;
        }
        return backup;
    }

    return created;
}

/**
 * Update a player's stats after a game ends.
 * Ensures a profile row exists before applying increments.
 */
async function updatePlayerStats(userId, score, isWinner, username, avatarUrl) {
    if (!supabase || !userId) return;

    const profile = await ensureProfile(userId, username, avatarUrl);
    if (!profile) return;

    await supabase
        .from('profiles')
        .update({
            total_score: Number(profile.total_score || 0) + Number(score || 0),
            games_played: Number(profile.games_played || 0) + 1,
            wins: isWinner ? Number(profile.wins || 0) + 1 : Number(profile.wins || 0),
            avatar_url: avatarUrl || profile.avatar_url || null,
        })
        .eq('id', userId);
}

async function upsertRoom(room) {
    if (!supabase || !room?.id) return;
    await supabase
        .from('rooms')
        .upsert({
            id: room.id,
            host_id: room.hostUserId,
            settings: room.settings,
            status: room.status,
        })
        .select('id');
}

async function deleteRoom(roomId) {
    if (!supabase || !roomId) return;
    await supabase.from('rooms').delete().eq('id', roomId);
}

async function updateRoomStatus(roomId, status) {
    if (!supabase || !roomId) return;
    await supabase.from('rooms').update({ status }).eq('id', roomId);
}

module.exports = {
    supabase,
    ensureProfile,
    updatePlayerStats,
    upsertRoom,
    deleteRoom,
    updateRoomStatus,
};
