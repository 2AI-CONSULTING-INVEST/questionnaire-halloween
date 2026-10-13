"use client";

import { Check, ChevronDown, Search, X } from "lucide-react";
import { Popover } from "radix-ui";
import { useId, useMemo, useRef, useState } from "react";

const normalize = (s: string) =>
  s.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase();

/** Liste déroulante avec recherche (style Typeform), construite sur Radix Popover. */
export function RestaurantCombobox({
  options,
  value,
  onChange,
  labelledBy,
}: {
  options: string[];
  value: string | null;
  onChange: (v: string | null) => void;
  labelledBy: string;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listId = useId();

  const filtered = useMemo(() => {
    const q = normalize(query.trim());
    return q ? options.filter((o) => normalize(o).includes(q)) : options;
  }, [options, query]);

  const pick = (v: string) => {
    onChange(v);
    setQuery("");
    setOpen(false);
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setOpen(true);
      setActive((i) => Math.min(filtered.length - 1, i + 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((i) => Math.max(0, i - 1));
    } else if (e.key === "Enter" && open && filtered[active]) {
      e.preventDefault();
      e.stopPropagation();
      pick(filtered[active]);
    } else if (e.key === "Escape") {
      setOpen(false);
    }
  };

  return (
    <Popover.Root open={open} onOpenChange={setOpen}>
      <Popover.Anchor asChild>
        <div className="relative flex items-center border-b-2 border-edge-strong pb-2 transition-colors focus-within:border-brand">
          <input
            ref={inputRef}
            role="combobox"
            aria-expanded={open}
            aria-controls={listId}
            aria-labelledby={labelledBy}
            aria-autocomplete="list"
            aria-activedescendant={open && filtered[active] ? `${listId}-${active}` : undefined}
            value={open ? query : value ?? ""}
            placeholder="Choisissez votre restaurant..."
            onChange={(e) => {
              setQuery(e.target.value);
              setActive(0);
              setOpen(true);
            }}
            onFocus={() => setOpen(true)}
            onClick={() => setOpen(true)}
            onKeyDown={onKeyDown}
            className="w-full bg-transparent pr-16 text-xl text-fg outline-none placeholder:text-placeholder sm:text-[1.75rem]"
          />
          {value && !open && (
            <button
              type="button"
              aria-label="Effacer la sélection"
              onClick={() => {
                onChange(null);
                inputRef.current?.focus();
              }}
              className="absolute right-9 rounded p-1 text-fg-muted hover:text-fg"
            >
              <X className="h-5 w-5" />
            </button>
          )}
          <button
            type="button"
            tabIndex={-1}
            aria-label={open ? "Fermer la liste" : "Ouvrir la liste"}
            onClick={() => {
              setOpen((o) => !o);
              inputRef.current?.focus();
            }}
            className="absolute right-0 rounded p-1 text-fg-muted hover:text-fg"
          >
            {open ? <Search className="h-5 w-5" /> : <ChevronDown className="h-6 w-6" />}
          </button>
        </div>
      </Popover.Anchor>
      <Popover.Portal>
        <Popover.Content
          align="start"
          sideOffset={8}
          onOpenAutoFocus={(e) => e.preventDefault()}
          onInteractOutside={(e) => {
            if (inputRef.current?.parentElement?.contains(e.target as Node)) e.preventDefault();
          }}
          className="z-50 max-h-[min(22rem,var(--radix-popover-content-available-height))] w-[var(--radix-popper-anchor-width)] overflow-y-auto rounded-2xl border border-edge bg-solid p-2 shadow-2xl shadow-black/40"
        >
          <ul id={listId} role="listbox" aria-labelledby={labelledBy} className="flex flex-col gap-2">
            {filtered.length === 0 && <li className="px-4 py-3 text-fg-muted">Aucun restaurant trouvé</li>}
            {filtered.map((o, i) => {
              const selected = o === value;
              return (
                <li
                  key={o}
                  id={`${listId}-${i}`}
                  role="option"
                  aria-selected={selected}
                  onMouseEnter={() => setActive(i)}
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => pick(o)}
                  className={`flex cursor-pointer items-center justify-between rounded-full border px-5 py-3 text-base transition-colors ${
                    selected
                      ? "border-brand bg-accent-soft text-fg"
                      : i === active
                        ? "border-edge-strong bg-surface-2 text-fg"
                        : "border-edge bg-surface text-fg-muted"
                  }`}
                >
                  {o}
                  {selected && <Check className="h-5 w-5 text-success" aria-hidden />}
                </li>
              );
            })}
          </ul>
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}
