/**
 * Chat and guess validation handler.
 */
const { RateLimiterMemory } = require('rate-limiter-flexible');
const { v4: uuidv4 } = require('uuid');
const { awardPoints } = require('./gameLogic');

const chatLimiter = new RateLimiterMemory({
    points: 5,
    duration: 5,
});

module.exports = function registerChatHandlers(io, socket, rooms) {
    socket.on('send_message', async ({ roomId, message }) => {
        const room = rooms.get(String(roomId || '').toUpperCase());
        if (!room) return;

        const player = room.players.get(socket.id);
        if (!player) return;

        try {
            await chatLimiter.consume(socket.id);
        } catch {
            socket.emit('error', { message: 'Slow down. Too many messages.' });
            return;
        }

        const cleanMessage = sanitizeMessage(message);
        if (!cleanMessage) return;

        const gameState = room.gameState;
        if (room.status === 'playing' && gameState?.currentWord) {
            const drawerSocketId = gameState.drawOrder[gameState.drawerIndex];
            if (socket.id !== drawerSocketId) {
                if (player.hasGuessed) {
                    socket.emit('error', { message: 'You already guessed correctly.' });
                    return;
                }

                if (cleanMessage.toLowerCase() === gameState.currentWord.toLowerCase()) {
                    const timeLeft = Math.max(0, ((gameState.roundEndsAt || Date.now()) - Date.now()) / 1000);
                    const points = awardPoints(room, io, socket.id, timeLeft);
                    io.to(room.id).emit('correct_guess', {
                        socketId: socket.id,
                        username: player.username,
                        avatar: player.avatar,
                        points,
                        scores: serializeScores(room),
                    });
                    return;
                }

                if (levenshtein(cleanMessage.toLowerCase(), gameState.currentWord.toLowerCase()) <= 1) {
                    socket.emit('close_guess', { message: "You're very close!" });
                }
            }
        }

        io.to(room.id).emit('new_message', {
            id: uuidv4(),
            socketId: socket.id,
            userId: player.userId,
            username: player.username,
            avatar: player.avatar,
            message: cleanMessage,
            type: 'chat',
            timestamp: Date.now(),
        });
    });
};

function sanitizeMessage(input) {
    if (typeof input !== 'string') return '';
    return input
        .trim()
        .slice(0, 200)
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;');
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

function levenshtein(a, b) {
    const dp = Array.from({ length: a.length + 1 }, (_, i) =>
        Array.from({ length: b.length + 1 }, (_, j) => (i === 0 ? j : j === 0 ? i : 0))
    );

    for (let i = 1; i <= a.length; i += 1) {
        for (let j = 1; j <= b.length; j += 1) {
            if (a[i - 1] === b[j - 1]) {
                dp[i][j] = dp[i - 1][j - 1];
            } else {
                dp[i][j] = 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1]);
            }
        }
    }

    return dp[a.length][b.length];
}
