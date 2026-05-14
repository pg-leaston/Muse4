"use client";

import { Slider } from "@base-ui/react/slider";

import { cn } from "@/lib/utils";

type SliderProps = {
  className?: string;
  min?: number;
  max?: number;
  step?: number;
  value: number;
  onValueChange: (value: number) => void;
  onValueCommitted?: () => void;
  disabled?: boolean;
};

function SliderField({
  className,
  min = 0,
  max = 100,
  step = 0.25,
  value,
  onValueChange,
  onValueCommitted,
  disabled,
}: SliderProps) {
  const safeMax = max > min ? max : min + 0.001;
  return (
    <Slider.Root
      className={cn(
        "flex w-full touch-none flex-col gap-1 select-none",
        className,
      )}
      min={min}
      max={safeMax}
      step={step}
      value={[value]}
      onValueChange={(v) => {
        const n = Array.isArray(v) ? v[0]! : v;
        onValueChange(n);
      }}
      onValueCommitted={() => onValueCommitted?.()}
      disabled={disabled}
    >
      <Slider.Control className="relative flex w-full items-center py-1.5">
        <Slider.Track className="relative h-1.5 w-full grow overflow-hidden rounded-full bg-muted">
          <Slider.Indicator className="absolute h-full rounded-full bg-primary" />
          <Slider.Thumb className="block size-4 rounded-full border border-border bg-background shadow-sm outline-none focus-visible:ring-3 focus-visible:ring-ring/50" />
        </Slider.Track>
      </Slider.Control>
    </Slider.Root>
  );
}

export { SliderField as Slider };
