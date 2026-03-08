/**
 * Room socket handlers.
 * Handles room lifecycle and in-memory player membership.
 */
const { v4: uuidv4 } = require('uuid');
const { upsertRoom, deleteRoom } = require('../database/supabaseClient');

module.exports = function registerRoomHandlers(io, socket, rooms) {
    socket.on('create_room', async ({ userId, username, avatar, settings }) => {
        if (!userId || !username) {
            socket.emit('error', { message: 'Missing user info.' });
            return;
        }

        const roomId = uuidv4().slice(0, 8).toUpperCase();
        const roomSettings = normalizeSettings(settings);
        const host = buildPlayer(socket.id, userId, username, avatar, true);

        const room = {
            id: roomId,
            hostId: socket.id,
            hostUserId: userId,
            players: new Map([[socket.id, host]]),
            settings: roomSettings,
            status: 'waiting',
            gameState: null,
        };

        rooms.set(roomId, room);
        socket.join(roomId);
        socket.data.roomId = roomId;
        socket.data.userId = userId;

        socket.emit('room_created', { roomId, room: serializeRoom(room) });
        io.to(roomId).emit('room_updated', { room: serializeRoom(room) });

        upsertRoom(room).catch((error) => {
            console.error('[rooms] create_room persist failed:', error?.message || error);
        });
    });

    socket.on('join_room', ({ roomId, userId, username, avatar }) => {
        if (!roomId || !userId || !username) {
            socket.emit('error', { message: 'Missing join parameters.' });
            return;
        }

        const normalizedRoomId = String(roomId).toUpperCase();
        const room = rooms.get(normalizedRoomId);
        if (!room) {
            socket.emit('error', { message: 'Room not found.' });
            return;
        }
        if (room.status === 'playing') {
            socket.emit('error', { message: 'Game already in progress.' });
            return;
        }
        if (room.players.size >= room.settings.maxPlayers) {
            socket.emit('error', { message: 'Room is full.' });
            return;
        }

        const existingPlayer = findPlayerByUserId(room, userId);
        if (existingPlayer) {
            const stale = room.players.get(existingPlayer.socketId);
            room.players.delete(existingPlayer.socketId);
            stale.socketId = socket.id;
            stale.username = username;
            stale.avatar = avatar || stale.avatar;
            room.players.set(socket.id, stale);
        } else {
            room.players.set(socket.id, buildPlayer(socket.id, userId, username, avatar, false));
        }

        socket.join(normalizedRoomId);
        socket.data.roomId = normalizedRoomId;
        socket.data.userId = userId;

        socket.emit('room_joined', { roomId: normalizedRoomId, room: serializeRoom(room) });
        io.to(normalizedRoomId).emit('room_updated', { room: serializeRoom(room) });

        upsertRoom(room).catch((error) => {
            console.error('[rooms] join_room persist failed:', error?.message || error);
        });
    });

    socket.on('leave_room', () => {
        handleLeave(socket, io, rooms);
    });

    socket.on('disconnect', () => {
        handleLeave(socket, io, rooms);
    });

    socket.on('get_room_info', ({ roomId }) => {
        const room = rooms.get(String(roomId || '').toUpperCase());
        if (!room) {
            socket.emit('error', { message: 'Room not found.' });
            return;
        }
        socket.emit('room_info', { room: serializeRoom(room) });
    });
};

function handleLeave(socket, io, rooms) {
    const roomId = socket.data?.roomId || findRoomIdBySocket(rooms, socket.id);
    if (!roomId) return;

    const room = rooms.get(roomId);
    if (!room) return;

    const player = room.players.get(socket.id);
    if (!player) return;

    room.players.delete(socket.id);
    socket.leave(roomId);

    if (room.players.size === 0) {
        rooms.delete(roomId);
        deleteRoom(roomId).catch((error) => {
            console.error('[rooms] delete_room persist failed:', error?.message || error);
        });
        return;
    }

    if (room.hostId === socket.id) {
        const nextHost = room.players.values().next().value;
        nextHost.isHost = true;
        room.hostId = nextHost.socketId;
        room.hostUserId = nextHost.userId;
    }

    io.to(roomId).emit('player_left', { socketId: socket.id, username: player.username });
    io.to(roomId).emit('room_updated', { room: serializeRoom(room) });

    upsertRoom(room).catch((error) => {
        console.error('[rooms] leave_room persist failed:', error?.message || error);
    });

    delete socket.data.roomId;
}

function normalizeSettings(settings) {
    const defaults = {
        maxPlayers: 8,
        rounds: 3,
        drawTime: 80,
        difficulty: 'mixed',
        hints: 2,
    };
    const next = { ...defaults, ...(settings || {}) };
    next.maxPlayers = clamp(next.maxPlayers, 2, 20);
    next.rounds = clamp(next.rounds, 1, 10);
    next.drawTime = clamp(next.drawTime, 30, 180);
    next.hints = clamp(next.hints, 0, 5);
    if (!['easy', 'medium', 'hard', 'mixed'].includes(next.difficulty)) {
        next.difficulty = 'mixed';
    }
    return next;
}

function buildPlayer(socketId, userId, username, avatar, isHost) {
    return {
        socketId,
        userId,
        username,
        avatar: avatar || 'artist',
        score: 0,
        isHost,
        hasGuessed: false,
    };
}

function findPlayerByUserId(room, userId) {
    for (const player of room.players.values()) {
        if (player.userId === userId) return player;
    }
    return null;
}

function findRoomIdBySocket(rooms, socketId) {
    for (const [roomId, room] of rooms.entries()) {
        if (room.players.has(socketId)) return roomId;
    }
    return null;
}

function clamp(value, min, max) {
    const n = Number(value);
    return Number.isNaN(n) ? min : Math.min(max, Math.max(min, n));
}

function serializeRoom(room) {
    return {
        id: room.id,
        hostId: room.hostId,
        hostUserId: room.hostUserId,
        players: Array.from(room.players.values()),
        settings: room.settings,
        status: room.status,
    };
}
