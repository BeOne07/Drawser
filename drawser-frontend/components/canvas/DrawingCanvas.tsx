'use client';

import {
  ForwardedRef,
  forwardRef,
  useEffect,
  useImperativeHandle,
  useRef
} from 'react';
import { getSocket } from '@/lib/socket';

type Tool = 'brush' | 'eraser' | 'fill';

export type DrawingCanvasRef = {
  clearCanvas: () => void;
  undoStroke: () => void;
};

type DrawPayload = {
  roomId: string;
  x: number;
  y: number;
  prevX?: number;
  prevY?: number;
  color: string;
  size: number;
  tool: Tool;
  type: 'start' | 'move' | 'end' | 'fill';
};

type DrawingCanvasProps = {
  roomId: string;
  isDrawer: boolean;
  color: string;
  size: number;
  tool: Tool;
};

export const DrawingCanvas = forwardRef(function DrawingCanvas(
  { roomId, isDrawer, color, size, tool }: DrawingCanvasProps,
  ref: ForwardedRef<DrawingCanvasRef>
) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const wrapperRef = useRef<HTMLDivElement | null>(null);
  const drawingRef = useRef(false);
  const pointRef = useRef<{ x: number; y: number } | null>(null);
  const snapshotsRef = useRef<ImageData[]>([]);
  const lastMoveEmitAtRef = useRef(0);

  useImperativeHandle(
    ref,
    () => ({
      clearCanvas: () => {
        clearLocalCanvas();
      },
      undoStroke: () => {
        undoLocalStroke();
      }
    }),
    []
  );

  useEffect(() => {
    const canvas = canvasRef.current;
    const wrapper = wrapperRef.current;
    if (!canvas || !wrapper) return;
    const canvasEl = canvas;
    const wrapperEl = wrapper;

    function resizeCanvas() {
      const nextWidth = wrapperEl.clientWidth;
      const nextHeight = Math.max(320, Math.round(nextWidth * 0.58));
      if (canvasEl.width === nextWidth && canvasEl.height === nextHeight) return;

      const old = document.createElement('canvas');
      old.width = canvasEl.width;
      old.height = canvasEl.height;
      const oldCtx = old.getContext('2d');
      const ctx = canvasEl.getContext('2d');
      if (!oldCtx || !ctx) return;

      oldCtx.drawImage(canvasEl, 0, 0);
      canvasEl.width = nextWidth;
      canvasEl.height = nextHeight;
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, canvasEl.width, canvasEl.height);
      ctx.drawImage(old, 0, 0, old.width, old.height, 0, 0, canvasEl.width, canvasEl.height);
    }

    resizeCanvas();
    window.addEventListener('resize', resizeCanvas);
    return () => window.removeEventListener('resize', resizeCanvas);
  }, []);

  useEffect(() => {
    const socket = getSocket();

    const onRemoteDraw = (payload: Omit<DrawPayload, 'roomId'>) => {
      const canvas = canvasRef.current;
      const ctx = canvas?.getContext('2d');
      if (!canvas || !ctx) return;

      if (payload.type === 'fill') {
        floodFill(ctx, Math.round(payload.x), Math.round(payload.y), payload.color, canvas);
        return;
      }

      drawSegment(ctx, payload, payload.color, payload.size, payload.tool);
    };

    const onClear = () => clearLocalCanvas();
    const onUndo = () => undoLocalStroke();

    socket.on('draw_event', onRemoteDraw);
    socket.on('canvas_cleared', onClear);
    socket.on('stroke_undone', onUndo);
    return () => {
      socket.off('draw_event', onRemoteDraw);
      socket.off('canvas_cleared', onClear);
      socket.off('stroke_undone', onUndo);
    };
  }, []);

  function beginDraw(event: React.PointerEvent<HTMLCanvasElement>) {
    if (!isDrawer) return;

    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;

    const point = getCanvasPoint(canvas, event.clientX, event.clientY);
    if (!point) return;

    event.currentTarget.setPointerCapture(event.pointerId);
    saveSnapshot(ctx, canvas);

    if (tool === 'fill') {
      floodFill(ctx, Math.round(point.x), Math.round(point.y), color, canvas);
      const socket = getSocket();
      socket.emit('draw_event', {
        roomId,
        x: point.x,
        y: point.y,
        color,
        size,
        tool: 'fill',
        type: 'fill'
      });
      return;
    }

    drawingRef.current = true;
    pointRef.current = point;

    const payload: DrawPayload = {
      roomId,
      x: point.x,
      y: point.y,
      prevX: point.x,
      prevY: point.y,
      color,
      size,
      tool,
      type: 'start'
    };
    drawSegment(ctx, payload, color, size, tool);
    getSocket().emit('draw_event', payload);
  }

  function moveDraw(event: React.PointerEvent<HTMLCanvasElement>) {
    if (!isDrawer || !drawingRef.current) return;

    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    const prev = pointRef.current;
    if (!canvas || !ctx || !prev) return;

    const point = getCanvasPoint(canvas, event.clientX, event.clientY);
    if (!point) return;

    const payload: DrawPayload = {
      roomId,
      x: point.x,
      y: point.y,
      prevX: prev.x,
      prevY: prev.y,
      color,
      size,
      tool,
      type: 'move'
    };

    drawSegment(ctx, payload, color, size, tool);
    pointRef.current = point;

    const now = Date.now();
    if (now - lastMoveEmitAtRef.current > 16) {
      getSocket().emit('draw_event', payload);
      lastMoveEmitAtRef.current = now;
    }
  }

  function endDraw(event: React.PointerEvent<HTMLCanvasElement>) {
    if (!isDrawer || !drawingRef.current) return;

    const canvas = canvasRef.current;
    const point = pointRef.current;
    if (!canvas || !point) return;

    drawingRef.current = false;
    pointRef.current = null;
    event.currentTarget.releasePointerCapture(event.pointerId);

    getSocket().emit('draw_event', {
      roomId,
      x: point.x,
      y: point.y,
      prevX: point.x,
      prevY: point.y,
      color,
      size,
      tool,
      type: 'end'
    });
  }

  function clearLocalCanvas() {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;

    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    snapshotsRef.current = [];
  }

  function undoLocalStroke() {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;

    const prev = snapshotsRef.current.pop();
    if (!prev) return;
    ctx.putImageData(prev, 0, 0);
  }

  return (
    <div ref={wrapperRef} className="glass rounded-2xl border border-white/10 p-2">
      <canvas
        ref={canvasRef}
        onPointerDown={beginDraw}
        onPointerMove={moveDraw}
        onPointerUp={endDraw}
        onPointerLeave={endDraw}
        className={`h-auto w-full rounded-xl border border-white/20 bg-white touch-none ${
          isDrawer ? 'cursor-crosshair' : 'cursor-default'
        }`}
      />
    </div>
  );

  function saveSnapshot(ctx: CanvasRenderingContext2D, canvas: HTMLCanvasElement) {
    snapshotsRef.current.push(ctx.getImageData(0, 0, canvas.width, canvas.height));
    if (snapshotsRef.current.length > 80) {
      snapshotsRef.current.shift();
    }
  }
});

function drawSegment(
  ctx: CanvasRenderingContext2D,
  payload: {
    x: number;
    y: number;
    prevX?: number;
    prevY?: number;
    type: 'start' | 'move' | 'end' | 'fill';
    tool: Tool;
  },
  color: string,
  size: number,
  tool: Tool
) {
  if (payload.type === 'fill') return;

  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.strokeStyle = color;
  ctx.lineWidth = size;
  ctx.globalCompositeOperation = tool === 'eraser' ? 'destination-out' : 'source-over';

  const fromX = payload.prevX ?? payload.x;
  const fromY = payload.prevY ?? payload.y;

  ctx.beginPath();
  ctx.moveTo(fromX, fromY);
  ctx.lineTo(payload.x, payload.y);
  ctx.stroke();
}

function getCanvasPoint(canvas: HTMLCanvasElement, clientX: number, clientY: number) {
  const rect = canvas.getBoundingClientRect();
  if (!rect.width || !rect.height) return null;
  return {
    x: ((clientX - rect.left) / rect.width) * canvas.width,
    y: ((clientY - rect.top) / rect.height) * canvas.height
  };
}

function floodFill(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  fillColorHex: string,
  canvas: HTMLCanvasElement
) {
  const image = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const data = image.data;
  const w = canvas.width;
  const h = canvas.height;

  if (x < 0 || y < 0 || x >= w || y >= h) return;

  const target = getPixel(data, x, y, w);
  const replacement = hexToRgba(fillColorHex);
  if (!replacement) return;

  if (
    target[0] === replacement[0] &&
    target[1] === replacement[1] &&
    target[2] === replacement[2] &&
    target[3] === replacement[3]
  ) {
    return;
  }

  const stack: Array<[number, number]> = [[x, y]];
  while (stack.length) {
    const [px, py] = stack.pop() as [number, number];
    if (px < 0 || py < 0 || px >= w || py >= h) continue;
    const current = getPixel(data, px, py, w);
    if (
      current[0] !== target[0] ||
      current[1] !== target[1] ||
      current[2] !== target[2] ||
      current[3] !== target[3]
    ) {
      continue;
    }

    setPixel(data, px, py, w, replacement);
    stack.push([px + 1, py], [px - 1, py], [px, py + 1], [px, py - 1]);
  }

  ctx.putImageData(image, 0, 0);
}

function getPixel(data: Uint8ClampedArray, x: number, y: number, width: number) {
  const idx = (y * width + x) * 4;
  return [data[idx], data[idx + 1], data[idx + 2], data[idx + 3]] as const;
}

function setPixel(
  data: Uint8ClampedArray,
  x: number,
  y: number,
  width: number,
  rgba: [number, number, number, number]
) {
  const idx = (y * width + x) * 4;
  data[idx] = rgba[0];
  data[idx + 1] = rgba[1];
  data[idx + 2] = rgba[2];
  data[idx + 3] = rgba[3];
}

function hexToRgba(hex: string): [number, number, number, number] | null {
  const normalized = hex.replace('#', '');
  if (!/^[0-9a-fA-F]{6}$/.test(normalized)) return null;
  const num = parseInt(normalized, 16);
  return [(num >> 16) & 255, (num >> 8) & 255, num & 255, 255];
}
