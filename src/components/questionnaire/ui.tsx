"use client";

import Image from "next/image";
import { motion } from "framer-motion";
import { Check, CornerDownLeft } from "lucide-react";
import { RadioGroup } from "radix-ui";
import type { ReactNode } from "react";

export type EmojiName =
  | "pumpkin" | "ghost" | "party" | "thought" | "calendar" | "moon" | "sun" | "fire"
  | "thumbsup" | "neutral" | "client" | "employee" | "trophy" | "stopwatch" | "bat" | "web";

/** Emoji 3D (Fluent UI, comme le rendu Typeform). */
export function Emoji({ name, size = 28, className = "", priority }: { name: EmojiName; size?: number; className?: string; priority?: boolean }) {
  return (
    <Image
      src={`/emoji/${name}.webp`}
      alt=""
      aria-hidden
      width={size}
      height={size}
      priority={priority}
      unoptimized
      className={`inline-block shrink-0 select-none align-[-0.15em] ${className}`}
    />
  );
}

export function QuestionHeader({
  number,
  title,
  required,
  description,
  id,
}: {
  number: string;
  title: ReactNode;
  required?: boolean;
  description?: ReactNode;
  id: string;
}) {
  const isLetter = /^[a-z]$/.test(number);
  return (
    <div className="mb-8">
      <h2 id={id} className="flex gap-3 text-2xl leading-snug text-fg sm:text-[1.75rem]">
        {isLetter ? (
          <span className="mt-2 shrink-0 text-sm text-fg-muted">{number}.</span>
        ) : (
          <span className="mt-2 inline-flex h-5 min-w-5 shrink-0 items-center justify-center rounded bg-brand px-1 text-[11px] font-bold text-black">
            {number}
          </span>
        )}
        <span>
          {title}
          {required && <span aria-label="obligatoire">*</span>}
        </span>
      </h2>
      {description && <p className="mt-3 pl-8 text-base text-fg-muted sm:text-lg">{description}</p>}
    </div>
  );
}

export function OkButton({
  onClick,
  label = "OK",
  hint = "appuyez sur Entrée",
  disabled,
  loading,
}: {
  onClick: () => void;
  label?: string;
  hint?: string;
  disabled?: boolean;
  loading?: boolean;
}) {
  return (
    <div className="mt-8 flex items-center gap-3">
      <button
        type="button"
        onClick={onClick}
        disabled={disabled || loading}
        className="inline-flex min-h-12 items-center gap-2 rounded-full bg-brand px-6 text-lg font-bold text-black shadow-[0_0_24px_rgba(250,204,21,0.25)] transition-[filter,box-shadow] hover:brightness-105 hover:shadow-[0_0_32px_rgba(250,204,21,0.4)] active:brightness-95 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {loading ? <span className="h-4 w-4 animate-spin rounded-full border-2 border-black/30 border-t-black" /> : null}
        {label}
        {label === "OK" && !loading ? <Check className="h-5 w-5" aria-hidden /> : null}
      </button>
      {hint && (
        <span className="hidden text-xs text-fg-muted sm:inline">
          {hint.split("Entrée")[0]}
          <strong>Entrée</strong> <CornerDownLeft className="inline h-3 w-3" aria-hidden />
        </span>
      )}
    </div>
  );
}

export function FieldError({ message }: { message?: string | null }) {
  if (!message) return null;
  return (
    <motion.p
      key={message}
      role="alert"
      initial={{ x: 0 }}
      animate={{ x: [0, -6, 6, -6, 6, 0] }}
      transition={{ duration: 0.3 }}
      className="mt-4 inline-flex items-center gap-2 rounded-md bg-danger-bg px-3 py-1.5 text-sm font-medium text-danger-fg"
    >
      <span aria-hidden>⚠️</span> {message}
    </motion.p>
  );
}

export function KeyBadge({ letter, active, className = "" }: { letter: string; active: boolean; className?: string }) {
  return (
    <span
      aria-hidden
      className={`inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full border text-[11px] font-bold transition-colors ${
        active ? "border-brand bg-brand text-black" : "border-edge-strong bg-page text-fg-muted"
      } ${className}`}
    >
      {letter}
    </span>
  );
}

/** Classes d'une option « pilule » (radio, oui / non). */
export function pillClass(selected: boolean) {
  return `flex w-full min-h-14 items-center gap-3 rounded-2xl border px-3 py-3 text-left text-lg transition-colors duration-150 sm:min-w-80 ${
    selected
      ? "border-brand bg-accent-soft text-fg ring-2 ring-brand"
      : "border-edge bg-surface/90 text-fg-muted backdrop-blur-sm hover:border-brand hover:bg-surface-2 hover:text-fg"
  }`;
}

/** Option « pilule » style Typeform, basée sur Radix RadioGroup.Item. */
export function ChoicePill({
  value,
  letter,
  emoji,
  label,
  selected,
}: {
  value: string;
  letter: string;
  emoji?: EmojiName;
  label: string;
  selected: boolean;
}) {
  return (
    <RadioGroup.Item value={value} className={pillClass(selected)}>
      <KeyBadge letter={letter} active={selected} />
      {emoji && <Emoji name={emoji} size={24} />}
      <span className="flex-1">{label}</span>
      {selected && (
        <motion.span initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: "spring", stiffness: 500, damping: 15 }}>
          <Check className="h-5 w-5 text-success" aria-hidden />
        </motion.span>
      )}
    </RadioGroup.Item>
  );
}
