'use client';

import { ReactNode } from 'react';
import { Eraser, PaintBucket, Pencil, RotateCcw, Trash2 } from 'lucide-react';

const colors = [
  '#0D1117',
  '#2D3748',
  '#4A5568',
  '#718096',
  '#E2E8F0',
  '#FFFFFF',
  '#E53E3E',
  '#DD6B20',
  '#D69E2E',
  '#38A169',
  '#319795',
  '#3182CE',
  '#5A67D8',
  '#805AD5',
  '#B83280',
  '#9B2C2C',
  '#742A2A',
  '#744210',
  '#22543D',
  '#234E52',
  '#2A4365',
  '#322659',
  '#702459',
  '#111827'
];

type ToolbarProps = {
  color: string;
  size: number;
  tool: 'brush' | 'eraser' | 'fill';
  disabled: boolean;
  onColorChange: (color: string) => void;
  onSizeChange: (size: number) => void;
  onToolChange: (tool: 'brush' | 'eraser' | 'fill') => void;
  onUndo: () => void;
  onClear: () => void;
};

export function Toolbar({
  color,
  size,
  tool,
  disabled,
  onColorChange,
  onSizeChange,
  onToolChange,
  onUndo,
  onClear
}: ToolbarProps) {
  return (
    <div className="glass rounded-2xl border border-white/10 p-3">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex items-center gap-2">
          <ToolButton
            active={tool === 'brush'}
            disabled={disabled}
            onClick={() => onToolChange('brush')}
            label="Brush"
            icon={<Pencil className="h-4 w-4" />}
          />
          <ToolButton
            active={tool === 'eraser'}
            disabled={disabled}
            onClick={() => onToolChange('eraser')}
            label="Eraser"
            icon={<Eraser className="h-4 w-4" />}
          />
          <ToolButton
            active={tool === 'fill'}
            disabled={disabled}
            onClick={() => onToolChange('fill')}
            label="Fill"
            icon={<PaintBucket className="h-4 w-4" />}
          />
          <ToolButton
            active={false}
            disabled={disabled}
            onClick={onUndo}
            label="Undo"
            icon={<RotateCcw className="h-4 w-4" />}
          />
          <ToolButton
            active={false}
            disabled={disabled}
            onClick={onClear}
            label="Clear"
            icon={<Trash2 className="h-4 w-4" />}
          />
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {colors.map((swatch) => (
            <button
              key={swatch}
              disabled={disabled}
              onClick={() => onColorChange(swatch)}
              className={`h-6 w-6 rounded-full border ${
                color === swatch ? 'border-white ring-2 ring-white/60' : 'border-white/20'
              }`}
              style={{ backgroundColor: swatch }}
              title={swatch}
            />
          ))}
        </div>

        <div className="flex min-w-[180px] items-center gap-3">
          <span className="text-xs uppercase text-white/60">Size</span>
          <input
            type="range"
            min={1}
            max={36}
            value={size}
            disabled={disabled}
            onChange={(event) => onSizeChange(Number(event.target.value))}
            className="w-full"
          />
          <span className="w-8 text-right text-xs text-white/70">{size}</span>
        </div>
      </div>
    </div>
  );
}

function ToolButton({
  active,
  disabled,
  onClick,
  label,
  icon
}: {
  active: boolean;
  disabled: boolean;
  onClick: () => void;
  label: string;
  icon: ReactNode;
}) {
  return (
    <button
      disabled={disabled}
      onClick={onClick}
      className={`inline-flex items-center gap-1 rounded-lg border px-2.5 py-1.5 text-xs transition ${
        active
          ? 'border-aqua/70 bg-aqua/20 text-aqua'
          : 'border-white/15 bg-white/5 text-white/80 hover:bg-white/10'
      } disabled:cursor-not-allowed disabled:opacity-50`}
    >
      {icon}
      {label}
    </button>
  );
}
