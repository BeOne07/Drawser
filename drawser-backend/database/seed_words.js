/* eslint-disable no-console */
require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { supabase } = require('./supabaseClient');

const DATASET_PATH = path.join(__dirname, 'words_dataset.json');
const BATCH_SIZE = 500;

async function main() {
    if (!supabase) {
        throw new Error(
            'Supabase is not configured. Set SUPABASE_URL or NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.'
        );
    }

    const raw = fs.readFileSync(DATASET_PATH, 'utf-8');
    const parsed = JSON.parse(raw);
    const rows = normalizeRows(parsed);
    if (!rows.length) {
        throw new Error('No valid words found in words_dataset.json');
    }

    console.log(`Seeding ${rows.length} words...`);

    let inserted = 0;
    for (let i = 0; i < rows.length; i += BATCH_SIZE) {
        const batch = rows.slice(i, i + BATCH_SIZE);
        const { error } = await supabase
            .from('words')
            .upsert(batch, { onConflict: 'word', ignoreDuplicates: false });

        if (error) {
            throw new Error(`Batch ${i / BATCH_SIZE + 1} failed: ${error.message}`);
        }

        inserted += batch.length;
        console.log(`Inserted/updated ${inserted}/${rows.length}`);
    }

    console.log('Word seeding completed.');
}

function normalizeRows(data) {
    if (!Array.isArray(data)) return [];

    const seen = new Set();
    const rows = [];
    for (const entry of data) {
        const word = typeof entry === 'string' ? entry : entry?.word;
        if (typeof word !== 'string') continue;

        const normalizedWord = word.trim().toLowerCase();
        if (!normalizedWord || seen.has(normalizedWord)) continue;
        seen.add(normalizedWord);

        let difficulty = typeof entry?.difficulty === 'string' ? entry.difficulty : 'medium';
        if (!['easy', 'medium', 'hard'].includes(difficulty)) difficulty = 'medium';

        const category = typeof entry?.category === 'string' ? entry.category : 'general';

        rows.push({
            word: normalizedWord,
            difficulty,
            category,
        });
    }
    return rows;
}

main().catch((error) => {
    console.error(error.message || error);
    process.exitCode = 1;
});
