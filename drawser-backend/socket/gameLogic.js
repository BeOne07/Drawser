/**
 * Core game state machine:
 * waiting -> word_selection -> drawing -> scoring -> next_round -> game_over
 */
const { getRandomWords } = require('../database/words');
const { updatePlayerStats, updateRoomStatus } = require('../database/supabaseClient');

module.exports = function registerGameHandlers(io, socket, rooms) {
    socket.on('start_game', async ({ roomId }) => {
        const room = rooms.get(String(roomId || '').toUpperCase());
        if (!room) {
            socket.emit('error', { message: 'Room not found.' });
            return;
        }
        if (room.hostId !== socket.id) {
            socket.emit('error', { message: 'Only the host can start the game.' });
            return;
        }
        if (room.players.size < 2) {
            socket.emit('error', { message: 'Need at least 2 players to start.' });
            return;
        }
        if (room.status === 'playing') return;

        room.status = 'playing';
        room.gameState = {
            phase: 'word_selection',
            currentRound: 1,
            totalRounds: room.settings.rounds,
            drawOrder: shuffle(Array.from(room.players.keys())),
            drawerIndex: 0,
            currentWord: '',
            currentHint: '',
            correctGuessers: new Set(),
            hintsGiven: 0,
            roundStartTime: null,
            roundEndsAt: null,
            roundTimer: null,
            wordPickTimeout: null,
            hintTimers: [],
            usedWords: new Set(),
        };

        io.to(room.id).emit('game_started', {
            gameState: publicGameState(room.gameState),
            players: serializeScores(room),
        });
        updateRoomStatus(room.id, 'playing').catch(() => { });
        await startRound(io, room);
    });

    socket.on('word_selected', ({ roomId, word }) => {
        const room = rooms.get(String(roomId || '').toUpperCase());
        if (!room?.gameState || room.status !== 'playing') return;

        const gs = room.gameState;
        const drawerSocketId = gs.drawOrder[gs.drawerIndex];
        if (socket.id !== drawerSocketId) return;

        if (typeof word !== 'string' || !word.trim()) return;
        clearTimeout(gs.wordPickTimeout);
        const picked = word.trim().toLowerCase();
        gs.usedWords.add(picked);
        startDrawingPhase(io, room, picked);
    });
};

async function startRound(io, room) {
    const gs = room.gameState;
    gs.phase = 'word_selection';
    gs.currentWord = '';
    gs.currentHint = '';
    gs.correctGuessers = new Set();
    gs.hintsGiven = 0;
    gs.roundStartTime = null;
    gs.roundEndsAt = null;
    clearRoundTimers(gs);

    for (const player of room.players.values()) {
        player.hasGuessed = false;
    }

    const drawerSocketId = gs.drawOrder[gs.drawerIndex];
    const drawer = room.players.get(drawerSocketId);
    if (!drawer) return;

    let words = [];
    try {
        words = await getRandomWords(3, room.settings.difficulty, gs.usedWords);
    } catch {
        words = [];
    }
    if (!words.length) {
        words = ['apple', 'castle', 'bicycle'];
    }

    io.to(room.id).emit('round_started', {
        round: gs.currentRound,
        totalRounds: gs.totalRounds,
        drawer: {
            socketId: drawer.socketId,
            username: drawer.username,
        },
    });

    io.to(drawerSocketId).emit('drawer_word_options', { words });

    gs.wordPickTimeout = setTimeout(() => {
        startDrawingPhase(io, room, words[0]);
    }, 15000);
}

function startDrawingPhase(io, room, word) {
    const gs = room.gameState;
    if (!gs || room.status !== 'playing') return;

    gs.phase = 'drawing';
    gs.currentWord = word;
    gs.currentHint = buildInitialHint(word);
    gs.hintsGiven = 0;
    gs.roundStartTime = Date.now();
    gs.roundEndsAt = gs.roundStartTime + room.settings.drawTime * 1000;

    clearTimeout(gs.wordPickTimeout);
    gs.wordPickTimeout = null;

    const drawerSocketId = gs.drawOrder[gs.drawerIndex];
    const drawer = room.players.get(drawerSocketId);

    io.to(room.id).emit('drawing_phase_started', {
        round: gs.currentRound,
        totalRounds: gs.totalRounds,
        drawer: drawer
            ? { socketId: drawer.socketId, username: drawer.username }
            : null,
        hint: gs.currentHint,
        roundTime: room.settings.drawTime,
        hints: room.settings.hints,
    });
    io.to(drawerSocketId).emit('current_word', { word });

    const hintInterval = Math.floor(room.settings.drawTime / (room.settings.hints + 1));
    gs.hintTimers = [];
    for (let i = 1; i <= room.settings.hints; i += 1) {
        const timer = setTimeout(() => {
            gs.currentHint = revealHintLetters(gs.currentHint, gs.currentWord, 2);
            gs.hintsGiven += 1;
            io.to(room.id).emit('hint_update', { hint: gs.currentHint, hintsGiven: gs.hintsGiven });
        }, hintInterval * i * 1000);
        gs.hintTimers.push(timer);
    }

    gs.roundTimer = setTimeout(() => {
        endRound(io, room);
    }, room.settings.drawTime * 1000);
}

async function endRound(io, room) {
    const gs = room.gameState;
    if (!gs || room.status !== 'playing') return;

    gs.phase = 'scoring';
    clearRoundTimers(gs);

    io.to(room.id).emit('round_ended', {
        word: gs.currentWord,
        scores: serializeScores(room),
    });

    await sleep(4000);

    gs.phase = 'next_round';
    gs.drawerIndex += 1;
    if (gs.drawerIndex >= gs.drawOrder.length) {
        gs.drawerIndex = 0;
        gs.currentRound += 1;
    }

    if (gs.currentRound > gs.totalRounds) {
        await endGame(io, room);
        return;
    }
    await startRound(io, room);
}

async function endGame(io, room) {
    const gs = room.gameState;
    if (!gs) return;

    gs.phase = 'game_over';
    clearRoundTimers(gs);
    room.status = 'ended';

    const leaderboard = Array.from(room.players.values())
        .map((player) => ({
            userId: player.userId,
            username: player.username,
            avatar: player.avatar,
            score: player.score,
        }))
        .sort((a, b) => b.score - a.score);

    io.to(room.id).emit('game_over', { leaderboard });
    updateRoomStatus(room.id, 'ended').catch(() => { });

    if (leaderboard.length) {
        const winnerId = leaderboard[0].userId;
        await Promise.allSettled(
            leaderboard.map((entry) =>
                updatePlayerStats(
                    entry.userId,
                    entry.score,
                    entry.userId === winnerId,
                    entry.username,
                    entry.avatar
                )
            )
        );
    }
}

function awardPoints(room, io, guesserSocketId, timeLeftSeconds) {
    const gs = room.gameState;
    if (!gs || gs.phase !== 'drawing') return 0;

    const drawerSocketId = gs.drawOrder[gs.drawerIndex];
    if (guesserSocketId === drawerSocketId) return 0;
    if (gs.correctGuessers.has(guesserSocketId)) return 0;

    const drawTime = room.settings.drawTime;
    const points = Math.max(50, Math.round(500 * (timeLeftSeconds / drawTime)));
    const drawerPoints = 20;

    const guesser = room.players.get(guesserSocketId);
    if (guesser) {
        guesser.score += points;
        guesser.hasGuessed = true;
    }

    const drawer = room.players.get(drawerSocketId);
    if (drawer) drawer.score += drawerPoints;

    gs.correctGuessers.add(guesserSocketId);

    const nonDrawers = Array.from(room.players.keys()).filter((id) => id !== drawerSocketId);
    const allGuessed = nonDrawers.length > 0 && nonDrawers.every((id) => gs.correctGuessers.has(id));
    if (allGuessed) {
        clearTimeout(gs.roundTimer);
        gs.roundTimer = setTimeout(() => {
            endRound(io, room);
        }, 2000);
    }

    return points;
}

function buildInitialHint(word) {
    return word
        .split('')
        .map((char) => (char === ' ' ? ' ' : '_'))
        .join('');
}

function revealHintLetters(currentHint, fullWord, maxLettersToReveal) {
    const hintChars = currentHint.split('');
    const hiddenIndices = [];
    for (let i = 0; i < hintChars.length; i += 1) {
        if (hintChars[i] === '_') hiddenIndices.push(i);
    }
    // Don't reveal the very last hidden letter ever, keep it challenging
    if (hiddenIndices.length <= 1) return currentHint;

    const lettersToReveal = Math.min(
        hiddenIndices.length - 1, // Ensure we never reveal everything
        Math.max(1, maxLettersToReveal)
    );

    const picks = sample(hiddenIndices, lettersToReveal);
    for (const idx of picks) {
        hintChars[idx] = fullWord[idx];
    }
    return hintChars.join('');
}

function clearRoundTimers(gs) {
    clearTimeout(gs.roundTimer);
    clearTimeout(gs.wordPickTimeout);
    for (const timer of gs.hintTimers || []) clearTimeout(timer);
    gs.roundTimer = null;
    gs.wordPickTimeout = null;
    gs.hintTimers = [];
}

function publicGameState(gs) {
    return {
        phase: gs.phase,
        currentRound: gs.currentRound,
        totalRounds: gs.totalRounds,
        drawerIndex: gs.drawerIndex,
        drawOrder: gs.drawOrder,
        currentHint: gs.currentHint,
    };
}

function serializeScores(room) {
    return Array.from(room.players.values()).map((player) => ({
        socketId: player.socketId,
        userId: player.userId,
        username: player.username,
        avatar: player.avatar,
        score: player.score,
        isHost: player.isHost,
        hasGuessed: Boolean(player.hasGuessed),
    }));
}

function shuffle(arr) {
    const out = [...arr];
    for (let i = out.length - 1; i > 0; i -= 1) {
        const j = Math.floor(Math.random() * (i + 1));
        [out[i], out[j]] = [out[j], out[i]];
    }
    return out;
}

function sample(arr, n) {
    return shuffle(arr).slice(0, n);
}

function sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

module.exports.awardPoints = awardPoints;
