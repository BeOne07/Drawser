/**
 * Drawser Backend – Drawing Socket Handler
 *
 * Relays drawing events from the active drawer to all other players in the room.
 * Rate-limited to prevent canvas spam.
 *
 * Events received:
 *  - draw_event    { roomId, x, y, prevX, prevY, color, size, tool, type }
 *  - clear_canvas  { roomId }
 *  - undo_stroke   { roomId }
 *
 * Events emitted:
 *  - draw_event    (broadcast to room, excluding sender)
 *  - canvas_cleared
 *  - stroke_undone
 */
const { RateLimiterMemory } = require('rate-limiter-flexible');

// 60 draw events per second per socket
const drawLimiter = new RateLimiterMemory({ points: 60, duration: 1 });

module.exports = function registerDrawingHandlers(io, socket, rooms) {

    // ── draw_event ───────────────────────────────────────────────────────────────
    socket.on('draw_event', async (data) => {
        const { roomId } = data;
        if (!isActiveDrawer(socket, roomId, rooms)) return;

        try {
            await drawLimiter.consume(socket.id);
        } catch {
            return; // silently drop — client already throttles at 60fps
        }

        // Validate payload minimally
        if (typeof data.x !== 'number' || typeof data.y !== 'number') return;

        // Broadcast to everyone else in the room
        socket.to(roomId).emit('draw_event', {
            x: data.x,
            y: data.y,
            prevX: data.prevX,
            prevY: data.prevY,
            color: sanitizeColor(data.color),
            size: clamp(data.size, 1, 50),
            tool: ['brush', 'eraser', 'fill'].includes(data.tool) ? data.tool : 'brush',
            type: data.type, // 'start' | 'move' | 'end'
        });
    });

    // ── clear_canvas ─────────────────────────────────────────────────────────────
    socket.on('clear_canvas', ({ roomId }) => {
        if (!isActiveDrawer(socket, roomId, rooms)) return;
        io.to(roomId).emit('canvas_cleared');
    });

    // ── undo_stroke ──────────────────────────────────────────────────────────────
    socket.on('undo_stroke', ({ roomId }) => {
        if (!isActiveDrawer(socket, roomId, rooms)) return;
        io.to(roomId).emit('stroke_undone');
    });
};

// ── Helpers ───────────────────────────────────────────────────────────────────
function isActiveDrawer(socket, roomId, rooms) {
    const room = rooms.get(roomId);
    if (!room || room.status !== 'playing' || !room.gameState) return false;
    const drawerSocketId = room.gameState.drawOrder[room.gameState.drawerIndex];
    return socket.id === drawerSocketId;
}

function sanitizeColor(color) {
    // Only allow valid hex colors
    if (typeof color === 'string' && /^#[0-9A-Fa-f]{6}$/.test(color)) return color;
    return '#000000';
}

function clamp(val, min, max) {
    const n = Number(val);
    return isNaN(n) ? min : Math.min(max, Math.max(min, n));
}
