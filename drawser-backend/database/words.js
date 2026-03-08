/**
 * Fetch random words from Supabase, with fallback data for local dev.
 */
const { supabase } = require('./supabaseClient');

async function getRandomWords(count = 3, difficulty = 'mixed', usedWords = new Set()) {
    if (!supabase) {
        return pickFallback(count, usedWords);
    }

    const difficultyParam = ['easy', 'medium', 'hard'].includes(difficulty)
        ? difficulty
        : null;

    const { data, error } = await supabase.rpc('get_random_words', {
        count_param: count * 2, // Fetch extra in case of collisions
        difficulty_param: difficultyParam,
    });

    if (error || !Array.isArray(data) || data.length === 0) {
        return pickFallback(count, usedWords);
    }

    const words = data
        .map((row) => row.word)
        .filter((word) => typeof word === 'string' && word.trim() && !usedWords.has(word.toLowerCase()))
        .slice(0, count);

    // If we didn't get enough unique words from the DB, fill with fallbacks
    if (words.length < count) {
        const fallbacks = pickFallback(count - words.length, new Set([...usedWords, ...words]));
        return [...words, ...fallbacks];
    }

    return words;
}

function pickFallback(count, usedWords = new Set()) {
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
    ].filter(w => !usedWords.has(w));

    if (fallback.length < count) {
        usedWords.clear(); // Reset if we run out of words
        return pickFallback(count, usedWords);
    }

    return fallback.sort(() => Math.random() - 0.5).slice(0, count);
}

module.exports = {
    getRandomWords,
};
