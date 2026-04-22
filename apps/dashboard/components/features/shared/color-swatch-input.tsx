"use client";

import { HugeiconsIcon } from "@hugeicons/react";
import { Delete02Icon } from "@hugeicons/core-free-icons";
import { useLocale } from "@/components/locale-provider";

interface ColorSwatchInputProps {
  id?: string;
  value: string | null | undefined;
  onChange: (value: string) => void;
  onClear?: () => void;
  showHex?: boolean;
  defaultColor?: string;
}

export function ColorSwatchInput({
  id,
  value,
  onChange,
  onClear,
  showHex = false,
  defaultColor = "#354FD8",
}: ColorSwatchInputProps) {
  const { t } = useLocale()
  return (
    <div className="flex items-center gap-3">
      <div className="relative h-9 w-9 shrink-0">
        {/* overflow-hidden + rounded-full must be on the same element as relative for clip to work */}
        <div className="relative h-9 w-9 overflow-hidden rounded-full border border-border shadow-sm">
          <input
            id={id}
            type="color"
            value={value ?? defaultColor}
            onChange={(e) => onChange(e.target.value)}
            className="absolute inset-[-4px] h-[calc(100%+8px)] w-[calc(100%+8px)] cursor-pointer border-none bg-transparent"
          />
        </div>
        {/* Trash icon badge on the edge */}
        {onClear && value && (
          <button
            type="button"
            onClick={onClear}
            className="absolute -end-1.5 -top-1.5 flex h-4 w-4 items-center justify-center rounded-full bg-error text-white shadow-sm hover:bg-error/80 transition-colors"
            aria-label={t("common.removeColor")}
          >
            <HugeiconsIcon icon={Delete02Icon} size={10} color="currentColor" />
          </button>
        )}
      </div>
      {showHex && (
        <span className="text-xs tabular-nums text-muted-foreground">
          {value ?? "—"}
        </span>
      )}
    </div>
  );
}
