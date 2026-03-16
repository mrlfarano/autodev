'use client';

import { InputHTMLAttributes } from 'react';

interface SliderProps
  extends Omit<InputHTMLAttributes<HTMLInputElement>, 'onChange'> {
  label?: string;
  value: number;
  min?: number;
  max?: number;
  step?: number;
  onChange: (value: number) => void;
  displayValue?: string;
}

export default function Slider({
  label,
  value,
  min = 0,
  max = 100,
  step = 1,
  onChange,
  displayValue,
  className = '',
  ...rest
}: SliderProps) {
  const pct = ((value - min) / (max - min)) * 100;

  return (
    <div className={`flex flex-col gap-2 ${className}`}>
      {(label || displayValue) && (
        <div className="flex items-center justify-between">
          {label && (
            <span className="text-sm font-medium text-zinc-400">{label}</span>
          )}
          {displayValue && (
            <span className="text-sm font-mono text-emerald-400">
              {displayValue}
            </span>
          )}
        </div>
      )}
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full h-1.5 rounded-full appearance-none cursor-pointer
          [&::-webkit-slider-thumb]:appearance-none
          [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:h-4
          [&::-webkit-slider-thumb]:rounded-full
          [&::-webkit-slider-thumb]:bg-emerald-500
          [&::-webkit-slider-thumb]:shadow-md
          [&::-webkit-slider-thumb]:cursor-pointer
          [&::-moz-range-thumb]:w-4 [&::-moz-range-thumb]:h-4
          [&::-moz-range-thumb]:rounded-full
          [&::-moz-range-thumb]:bg-emerald-500
          [&::-moz-range-thumb]:border-0
          [&::-moz-range-thumb]:cursor-pointer"
        style={{
          background: `linear-gradient(to right, #10b981 0%, #10b981 ${pct}%, #3f3f46 ${pct}%, #3f3f46 100%)`,
        }}
        {...rest}
      />
    </div>
  );
}
