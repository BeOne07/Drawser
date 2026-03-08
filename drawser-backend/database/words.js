/**
 * Fetch random words from Supabase, with fallback data for local dev.
 */
const { supabase } = require('./supabaseClient');

async function getRandomWords(count = 3, difficulty = 'mixed') {
    if (!supabase) {
        return pickFallback(count);
    }

    const difficultyParam = ['easy', 'medium', 'hard'].includes(difficulty)
        ? difficulty
        : null;

    const { data, error } = await supabase.rpc('get_random_words', {
        count_param: count,
        difficulty_param: difficultyParam,
    });

    if (error || !Array.isArray(data) || data.length === 0) {
        return pickFallback(count);
    }

    return data
        .map((row) => row.word)
        .filter((word) => typeof word === 'string' && word.trim())
        .slice(0, count);
}

function pickFallback(count) {
    const fallback = [
        'apple',
        'backpack',
        'bicycle',
        'bridge',
        'castle',
        'cloud',
        'drum',
        'forest',
        'guitar',
        'island',
        'rocket',
        'submarine',
    ];
    return fallback.sort(() => Math.random() - 0.5).slice(0, count);
}

module.exports = {
    getRandomWords,
};
