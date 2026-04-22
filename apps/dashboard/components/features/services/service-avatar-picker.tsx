"use client"

import { useRef, useState, useMemo } from "react"
import * as HugeIcons from "@hugeicons/core-free-icons"
import { HugeiconsIcon } from "@hugeicons/react"
import { Add01Icon, Cancel01Icon } from "@hugeicons/core-free-icons"
import { Popover, PopoverContent, PopoverTrigger } from "@carekit/ui"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@carekit/ui"
import { Input } from "@carekit/ui"
import { Button } from "@carekit/ui"
import { ServiceAvatar } from "./service-avatar"
import { cn } from "@/lib/utils"

/* ─── Icon list ─── */
const ALL_ICON_NAMES: string[] = Object.keys(HugeIcons).filter(
  (k) => k.endsWith("Icon") && Array.isArray((HugeIcons as Record<string, unknown>)[k])
)

/* ─── Color palette ─── */
const BG_COLORS = [
  "#354FD8", "#82CC17", "#E04040", "#E07A10",
  "#9B59B6", "#1ABC9C", "#2980B9", "#F39C12",
  "#16A085", "#8E44AD", "#C0392B", "#27AE60",
]

/* ─── Props ─── */
interface ServiceAvatarPickerProps {
  iconName?: string | null
  iconBgColor?: string | null
  imageUrl?: string | null
  serviceName?: string
  onIconChange: (iconName: string, iconBgColor: string) => void
  onImageChange: (file: File) => void
  onClear: () => void
}

/* ─── Component ─── */
export function ServiceAvatarPicker({
  iconName,
  iconBgColor,
  imageUrl,
  serviceName,
  onIconChange,
  onImageChange,
  onClear,
}: ServiceAvatarPickerProps) {
  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState("")
  const [selectedIcon, setSelectedIcon] = useState<string | null>(iconName ?? null)
  const [selectedColor, setSelectedColor] = useState<string>(iconBgColor ?? BG_COLORS[0])
  const [previewUrl, setPreviewUrl] = useState<string | undefined>(imageUrl ?? undefined)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const colorPickerRef = useRef<HTMLInputElement>(null)

  const hasValue = !!(imageUrl || previewUrl || iconName || selectedIcon)

  const filtered = useMemo(() => {
    if (!search.trim()) return ALL_ICON_NAMES
    const q = search.toLowerCase()
    return ALL_ICON_NAMES.filter((n) => n.toLowerCase().includes(q))
  }, [search])

  const handleIconSelect = (name: string) => {
    setSelectedIcon(name)
    onIconChange(name, selectedColor)
  }

  const handleColorSelect = (color: string) => {
    setSelectedColor(color)
    if (selectedIcon) onIconChange(selectedIcon, color)
  }

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    const url = URL.createObjectURL(file)
    setPreviewUrl(url)
    setSelectedIcon(null)
    onImageChange(file)
    setOpen(false)
    if (fileInputRef.current) fileInputRef.current.value = ""
  }

  const handleClear = (e: React.MouseEvent) => {
    e.stopPropagation()
    setSelectedIcon(null)
    setPreviewUrl(undefined)
    onClear()
  }

  const displayImageUrl = previewUrl ?? imageUrl ?? undefined
  const displayIconName = selectedIcon ?? iconName ?? undefined
  const displayBgColor = selectedColor ?? iconBgColor ?? undefined

  return (
    <div className="relative h-20 w-20 shrink-0">
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <button
            type="button"
            className="group h-20 w-20 cursor-pointer rounded-full border-2 border-dashed border-border bg-surface-muted overflow-hidden flex items-center justify-center"
          >
            <ServiceAvatar
              iconName={displayIconName}
              iconBgColor={displayBgColor}
              imageUrl={displayImageUrl}
              name={serviceName}
              size="lg"
            />
          </button>
        </PopoverTrigger>

        <PopoverContent className="w-80 p-0" align="start">
          <Tabs defaultValue="icon">
            <TabsList className="w-full rounded-none border-b border-border">
              <TabsTrigger value="icon" className="flex-1">أيقونة</TabsTrigger>
              <TabsTrigger value="image" className="flex-1">صورة</TabsTrigger>
            </TabsList>

            {/* ── Icon Tab ── */}
            <TabsContent value="icon" className="p-3 space-y-3">
              <Input
                placeholder="ابحث عن أيقونة..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="h-8 text-sm"
              />

              {/* Icon Grid */}
              <div className="h-48 overflow-y-auto">
                <div className="grid grid-cols-6 gap-1">
                  {filtered.slice(0, 200).map((name) => {
                    const icon = (HugeIcons as Record<string, unknown>)[name]
                    const isSelected = selectedIcon === name
                    return (
                      <button
                        key={name}
                        type="button"
                        title={name.replace("Icon", "")}
                        onClick={() => handleIconSelect(name)}
                        className={cn(
                          "flex h-9 w-9 items-center justify-center rounded-md transition-colors",
                          isSelected
                            ? "bg-primary text-primary-foreground"
                            : "hover:bg-muted text-muted-foreground hover:text-foreground"
                        )}
                      >
                        <HugeiconsIcon
                          icon={icon as Parameters<typeof HugeiconsIcon>[0]["icon"]}
                          size={18}
                          color="currentColor"
                        />
                      </button>
                    )
                  })}
                </div>
              </div>

              {/* Color Swatches */}
              {selectedIcon && (
                <div className="space-y-1.5">
                  <p className="text-xs text-muted-foreground">لون الخلفية</p>
                  <div className="flex flex-wrap gap-1.5">
                    {BG_COLORS.map((color) => (
                      <button
                        key={color}
                        type="button"
                        onClick={() => handleColorSelect(color)}
                        className={cn(
                          "h-6 w-6 rounded-full border-2 transition-all",
                          selectedColor === color
                            ? "border-foreground scale-110"
                            : "border-transparent hover:scale-105"
                        )}
                        style={{ backgroundColor: color }}
                        aria-label={color}
                      />
                    ))}
                    {/* Custom color picker */}
                    <div className="relative h-6 w-6">
                      <button
                        type="button"
                        onClick={() => colorPickerRef.current?.click()}
                        className={cn(
                          "h-6 w-6 rounded-full border-2 transition-all flex items-center justify-center",
                          !BG_COLORS.includes(selectedColor)
                            ? "border-foreground scale-110"
                            : "border-dashed border-muted-foreground/40 hover:scale-105 hover:border-muted-foreground"
                        )}
                        style={!BG_COLORS.includes(selectedColor) ? { backgroundColor: selectedColor } : undefined}
                        aria-label="لون مخصص"
                      >
                        {BG_COLORS.includes(selectedColor) && (
                          <span className="text-[10px] font-bold text-muted-foreground leading-none">+</span>
                        )}
                      </button>
                      <input
                        ref={colorPickerRef}
                        type="color"
                        value={selectedColor}
                        onChange={(e) => handleColorSelect(e.target.value)}
                        className="absolute inset-0 opacity-0 pointer-events-none w-0 h-0"
                        aria-hidden="true"
                      />
                    </div>
                  </div>
                </div>
              )}

              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="w-full text-destructive hover:text-destructive hover:bg-destructive/10"
                onClick={() => { onClear(); setSelectedIcon(null); setPreviewUrl(undefined); setOpen(false) }}
              >
                مسح الأفاتار
              </Button>
            </TabsContent>

            {/* ── Image Tab ── */}
            <TabsContent value="image" className="p-3 space-y-3">
              {displayImageUrl ? (
                <div className="space-y-2">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={displayImageUrl}
                    alt="preview"
                    className="h-24 w-24 mx-auto rounded-full object-cover border border-border"
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="w-full text-destructive hover:text-destructive hover:bg-destructive/10"
                    onClick={() => { setPreviewUrl(undefined); onClear(); setOpen(false) }}
                  >
                    حذف الصورة
                  </Button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="flex h-24 w-full flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed border-border text-muted-foreground hover:border-primary/50 hover:text-primary transition-colors"
                >
                  <span className="text-sm">اضغط لرفع صورة</span>
                  <span className="text-xs opacity-60">PNG, JPG, WebP — حتى 5MB</span>
                </button>
              )}
              <input
                ref={fileInputRef}
                type="file"
                accept="image/png,image/jpeg,image/webp"
                className="hidden"
                onChange={handleFile}
              />
            </TabsContent>
          </Tabs>
        </PopoverContent>
      </Popover>

      {/* Badge button */}
      {hasValue ? (
        <button
          type="button"
          onClick={handleClear}
          className="absolute bottom-0 end-0 flex h-6 w-6 items-center justify-center rounded-full bg-destructive text-white shadow-md ring-2 ring-background hover:bg-destructive/80 transition-colors"
        >
          <HugeiconsIcon icon={Cancel01Icon} className="h-3 w-3" />
        </button>
      ) : (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="absolute bottom-0 end-0 flex h-6 w-6 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-md ring-2 ring-background hover:bg-primary/80 transition-colors"
        >
          <HugeiconsIcon icon={Add01Icon} className="h-3 w-3" />
        </button>
      )}
    </div>
  )
}
