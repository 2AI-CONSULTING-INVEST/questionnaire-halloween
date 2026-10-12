"use client";

import Image from "next/image";
import { motion } from "framer-motion";
import { Check } from "lucide-react";
import { RadioGroup } from "radix-ui";
import type { Decoration } from "@/lib/schema";
import { KeyBadge } from "./ui";

export const LETTERS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";

/** Q4 : galerie d'images à choix unique (Radix RadioGroup). */
export function DecorationGallery({
  decorations,
  value,
  onChange,
  labelledBy,
}: {
  decorations: Decoration[];
  value: string | null;
  onChange: (id: string) => void;
  labelledBy: string;
}) {
  return (
    <RadioGroup.Root
      value={value ?? ""}
      onValueChange={onChange}
      aria-labelledby={labelledBy}
      aria-required
      className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3"
    >
      {decorations.map((d, i) => {
        const selected = d.id === value;
        return (
          <RadioGroup.Item key={d.id} value={d.id} asChild>
            <motion.button
              type="button"
              whileHover={{ scale: 1.02 }}
              transition={{ duration: 0.2, ease: "easeOut" }}
              className={`relative flex flex-col overflow-hidden rounded-lg border bg-white text-left shadow-sm transition-[border-color,box-shadow] duration-200 hover:shadow-md ${
                selected ? "border-brand shadow-md ring-[3px] ring-brand" : "border-line"
              }`}
            >
              <div className="relative aspect-video w-full bg-gray-100">
                <Image
                  src={d.image_url}
                  alt={`Décoration Halloween — ${d.restaurant_name}`}
                  fill
                  sizes="(min-width: 1024px) 300px, (min-width: 640px) 45vw, 92vw"
                  className="object-cover"
                  loading={i < 2 ? "eager" : "lazy"}
                />
                {selected && (
                  <motion.span
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    transition={{ type: "spring", stiffness: 500, damping: 14 }}
                    className="absolute right-2 top-2 flex h-8 w-8 items-center justify-center rounded-full bg-success text-white shadow"
                  >
                    <Check className="h-5 w-5" aria-hidden />
                  </motion.span>
                )}
              </div>
              <div className="flex items-start gap-2 p-3">
                <KeyBadge letter={LETTERS[i]} active={selected} />
                <span className="text-sm uppercase text-muted">{d.restaurant_name}</span>
              </div>
            </motion.button>
          </RadioGroup.Item>
        );
      })}
    </RadioGroup.Root>
  );
}
