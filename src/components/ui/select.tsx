"use client";
import * as React from "react";
import * as PopoverPrimitive from "@radix-ui/react-popover";
import { Check, ChevronDown, Search } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Select2-style searchable Select. Drop-in API-compatible with the previous
 * Radix Select wrapper: the same {Select, SelectGroup, SelectTrigger, SelectValue,
 * SelectContent, SelectItem} primitives are exported, so call sites do not change.
 *
 * Differences from native Radix Select:
 *  - The dropdown panel includes a search input that filters items as you type.
 *  - Keyboard: ArrowUp/ArrowDown to navigate, Enter to select, Esc to close.
 */

// ───── helpers ─────
const flattenText = (node: React.ReactNode): string => {
  if (node == null || node === false || node === true) return "";
  if (typeof node === "string" || typeof node === "number") return String(node);
  if (Array.isArray(node)) return node.map(flattenText).join("");
  if (React.isValidElement(node)) return flattenText((node.props as any).children);
  return "";
};

type Ctx = {
  value: string;
  onValueChange: (v: string) => void;
  open: boolean;
  setOpen: (v: boolean) => void;
  search: string;
  setSearch: (s: string) => void;
  labels: Map<string, string>;
  disabled?: boolean;
  visibleValuesRef: React.MutableRefObject<string[]>;
  activeIndex: number;
  setActiveIndex: (n: number) => void;
};
const SelectContext = React.createContext<Ctx | null>(null);

// ───── root ─────
export function Select({
  value,
  defaultValue,
  onValueChange,
  children,
  disabled,
  open: openProp,
  onOpenChange,
}: {
  value?: string;
  defaultValue?: string;
  onValueChange?: (v: string) => void;
  children: React.ReactNode;
  disabled?: boolean;
  required?: boolean;
  open?: boolean;
  onOpenChange?: (v: boolean) => void;
  name?: string;
}) {
  const [internalValue, setInternalValue] = React.useState(defaultValue ?? "");
  const isControlled = value !== undefined;
  const currentValue = isControlled ? (value ?? "") : internalValue;
  const handleChange = React.useCallback(
    (v: string) => {
      if (!isControlled) setInternalValue(v);
      onValueChange?.(v);
    },
    [isControlled, onValueChange],
  );

  const [internalOpen, setInternalOpen] = React.useState(false);
  const openControlled = openProp !== undefined;
  const open = openControlled ? !!openProp : internalOpen;
  const setOpen = React.useCallback(
    (v: boolean) => {
      if (!openControlled) setInternalOpen(v);
      onOpenChange?.(v);
    },
    [openControlled, onOpenChange],
  );

  const [search, setSearch] = React.useState("");
  const [activeIndex, setActiveIndex] = React.useState(0);
  React.useEffect(() => {
    if (!open) {
      setSearch("");
      setActiveIndex(0);
    }
  }, [open]);

  // Walk children to collect a value → label map (for SelectValue) at any depth
  const labels = React.useMemo(() => {
    const map = new Map<string, string>();
    const walk = (n: React.ReactNode) => {
      if (n == null || n === false || n === true) return;
      if (Array.isArray(n)) {
        n.forEach(walk);
        return;
      }
      if (!React.isValidElement(n)) return;
      const c: any = n.type;
      if (c && (c.__isSelectItem || c.displayName === "SelectItem")) {
        const v = (n.props as any).value;
        if (v != null) map.set(v, flattenText((n.props as any).children));
      }
      const k = (n.props as any).children;
      if (k) walk(k);
    };
    walk(children);
    return map;
  }, [children]);

  const visibleValuesRef = React.useRef<string[]>([]);

  return (
    <SelectContext.Provider
      value={{
        value: currentValue,
        onValueChange: handleChange,
        open,
        setOpen,
        search,
        setSearch,
        labels,
        disabled,
        visibleValuesRef,
        activeIndex,
        setActiveIndex,
      }}
    >
      <PopoverPrimitive.Root open={open && !disabled} onOpenChange={(v) => !disabled && setOpen(v)}>
        {children}
      </PopoverPrimitive.Root>
    </SelectContext.Provider>
  );
}

export const SelectGroup = ({ children }: { children: React.ReactNode }) => <>{children}</>;

// ───── trigger value display ─────
export function SelectValue({ placeholder }: { placeholder?: string }) {
  const ctx = React.useContext(SelectContext);
  if (!ctx) return null;
  const label = ctx.labels.get(ctx.value);
  return <span className={cn("truncate", !label && "text-muted-foreground")}>{label || placeholder}</span>;
}

// ───── trigger ─────
export const SelectTrigger = React.forwardRef<
  HTMLButtonElement,
  Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, "type">
>(({ className, children, disabled: triggerDisabled, ...props }, ref) => {
  const ctx = React.useContext(SelectContext);
  const isDisabled = !!(triggerDisabled ?? ctx?.disabled);
  return (
    <PopoverPrimitive.Trigger asChild>
      <button
        ref={ref}
        type="button"
        disabled={isDisabled}
        aria-haspopup="listbox"
        aria-expanded={ctx?.open}
        className={cn(
          "flex h-10 w-full items-center justify-between rounded-lg border border-input bg-background px-3 py-2 text-sm cursor-pointer hover:border-primary/40 focus:outline-none focus:ring-2 focus:ring-ring disabled:cursor-not-allowed disabled:opacity-50 [&>span]:line-clamp-1",
          className,
        )}
        {...props}
      >
        {children}
        <ChevronDown className="h-4 w-4 opacity-50 shrink-0 ml-2" />
      </button>
    </PopoverPrimitive.Trigger>
  );
});
SelectTrigger.displayName = "SelectTrigger";

// ───── content ─────
export function SelectContent({
  className,
  children,
  hideSearch,
}: {
  className?: string;
  children: React.ReactNode;
  position?: "popper" | "item-aligned";
  /** ซ่อนช่องค้นหาด้านบน — ใช้สำหรับ dropdown สั้น ๆ (เช่น page size, ปุ่ม toggle) */
  hideSearch?: boolean;
}) {
  const ctx = React.useContext(SelectContext);
  const inputRef = React.useRef<HTMLInputElement>(null);

  // When search is hidden, force-reset the search filter so all items show
  React.useEffect(() => {
    if (hideSearch && ctx?.search) ctx.setSearch("");
  }, [hideSearch, ctx?.search]); // eslint-disable-line react-hooks/exhaustive-deps

  // Reset visible-values list each render; SelectItem children push themselves in
  if (ctx) ctx.visibleValuesRef.current = [];

  const handleKey = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!ctx) return;
    const list = ctx.visibleValuesRef.current;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      ctx.setActiveIndex(Math.min(ctx.activeIndex + 1, list.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      ctx.setActiveIndex(Math.max(ctx.activeIndex - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      const v = list[ctx.activeIndex];
      if (v != null) {
        ctx.onValueChange(v);
        ctx.setOpen(false);
      }
    } else if (e.key === "Escape") {
      ctx.setOpen(false);
    }
  };

  if (!ctx) return null;

  return (
    <PopoverPrimitive.Portal>
      <PopoverPrimitive.Content
        align="start"
        sideOffset={4}
        onOpenAutoFocus={(e) => {
          e.preventDefault();
          if (!hideSearch) inputRef.current?.focus();
        }}
        className={cn(
          "z-50 max-h-96 min-w-[var(--radix-popover-trigger-width)] w-[var(--radix-popover-trigger-width)] overflow-hidden rounded-lg border bg-popover text-popover-foreground shadow-md",
          "data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0",
          className,
        )}
      >
        {!hideSearch && (
          <div className="flex items-center border-b px-2">
            <Search className="h-4 w-4 text-muted-foreground shrink-0 mr-2" />
            <input
              ref={inputRef}
              type="text"
              value={ctx.search}
              onChange={(e) => {
                ctx.setSearch(e.target.value);
                ctx.setActiveIndex(0);
              }}
              onKeyDown={handleKey}
              placeholder="ค้นหา..."
              className="flex-1 bg-transparent py-2 text-sm outline-none placeholder:text-muted-foreground"
            />
          </div>
        )}
        <div
          className="max-h-72 overflow-y-auto overscroll-contain p-1"
          role="listbox"
          onWheel={(e) => e.stopPropagation()}
        >
          {children}
          <EmptyState />
        </div>
      </PopoverPrimitive.Content>
    </PopoverPrimitive.Portal>
  );
}

function EmptyState() {
  const ctx = React.useContext(SelectContext);
  if (!ctx?.search) return null;
  // We render AFTER {children}, so SelectItems have already pushed themselves
  // into visibleValuesRef during this same render pass.
  if (ctx.visibleValuesRef.current.length > 0) return null;
  return <div className="px-2 py-6 text-center text-sm text-muted-foreground">ไม่พบรายการ</div>;
}

// ───── item ─────
type SelectItemProps = {
  value: string;
  children: React.ReactNode;
  className?: string;
  disabled?: boolean;
};

export function SelectItem({ value, children, className, disabled }: SelectItemProps) {
  // ── All hooks MUST be called unconditionally on every render ──
  const ctx = React.useContext(SelectContext);
  const label = React.useMemo(() => flattenText(children), [children]);
  const btnRef = React.useRef<HTMLButtonElement>(null);

  const matchesSearch =
    !ctx?.search || label.toLowerCase().includes(ctx.search.toLowerCase());

  // Compute indexInList (only push when this item is actually visible)
  let indexInList = -1;
  if (ctx && matchesSearch) {
    indexInList = ctx.visibleValuesRef.current.length;
    ctx.visibleValuesRef.current.push(value);
  }

  const selected = ctx?.value === value;
  const active = indexInList >= 0 && indexInList === ctx?.activeIndex;

  // Scroll keyboard-active item into view (hook always runs)
  React.useEffect(() => {
    if (active && btnRef.current) {
      btnRef.current.scrollIntoView({ block: "nearest" });
    }
  }, [active]);

  // ── Early returns only AFTER all hooks ──
  if (!ctx) return null;
  if (!matchesSearch) return null;

  return (
    <button
      ref={btnRef}
      type="button"
      role="option"
      aria-selected={selected}
      disabled={disabled}
      onClick={() => {
        if (disabled) return;
        ctx.onValueChange(value);
        ctx.setOpen(false);
      }}
      className={cn(
        "relative flex w-full cursor-pointer select-none items-center rounded-md py-1.5 pl-8 pr-2 text-sm outline-none text-left hover:bg-accent hover:text-accent-foreground disabled:opacity-50 disabled:cursor-not-allowed",
        active && "bg-accent text-accent-foreground",
        selected && !active && "bg-accent/40",
        className,
      )}
    >
      <span className="absolute left-2 flex h-3.5 w-3.5 items-center justify-center">
        {selected && <Check className="h-4 w-4" />}
      </span>
      <span className="truncate">{children}</span>
    </button>
  );
}
SelectItem.displayName = "SelectItem";
(SelectItem as any).__isSelectItem = true;
