"use client";

import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import type { Impact, VisitPeriod } from "@/lib/schema";

export type Answers = {
  selected_restaurant: string | null;
  visit_period: VisitPeriod | null;
  selected_decoration_id: string | null;
  decoration_impact: Impact | null;
  comment: string;
  wants_raffle: boolean | null;
  participant_name: string;
  phone_number: string; // tel que saisi ; normalisé à l'envoi
  email: string;
};

/** Écrans dans l'ordre (une question par écran). */
export const SCREENS = [
  "welcome",
  "restaurant",
  "period",
  "vote",
  "impact",
  "comment",
  "raffle",
  "name",
  "phone",
  "email",
  "thanks",
] as const;
export type Screen = (typeof SCREENS)[number];

export const STEP_COUNT = 6;

/** Correspondance écran → « Étape X/6 ». */
export const STEP_OF: Record<Screen, number> = {
  welcome: 0,
  restaurant: 1,
  period: 1,
  vote: 2,
  impact: 3,
  comment: 4,
  raffle: 5,
  name: 5,
  phone: 5,
  email: 5,
  thanks: 6,
};

const emptyAnswers: Answers = {
  selected_restaurant: null,
  visit_period: null,
  selected_decoration_id: null,
  decoration_impact: null,
  comment: "",
  wants_raffle: null,
  participant_name: "",
  phone_number: "",
  email: "",
};

type State = {
  sessionId: string | null;
  index: number;
  direction: 1 | -1;
  answers: Answers;
  voteCompleted: boolean;
  raffleDone: boolean;
  start: () => string;
  setAnswer: <K extends keyof Answers>(key: K, value: Answers[K]) => void;
  go: (index: number) => void;
  markVoteCompleted: () => void;
  markRaffleDone: () => void;
};

export const useQuestionnaire = create<State>()(
  persist(
    (set, get) => ({
      sessionId: null,
      index: 0,
      direction: 1,
      answers: emptyAnswers,
      voteCompleted: false,
      raffleDone: false,
      start: () => {
        const id = get().sessionId ?? crypto.randomUUID();
        set({ sessionId: id, index: 1, direction: 1 });
        return id;
      },
      setAnswer: (key, value) => set((s) => ({ answers: { ...s.answers, [key]: value } })),
      go: (index) =>
        set((s) => ({
          index: Math.max(0, Math.min(SCREENS.length - 1, index)),
          direction: index >= s.index ? 1 : -1,
        })),
      markVoteCompleted: () => set({ voteCompleted: true }),
      markRaffleDone: () => set({ raffleDone: true }),
    }),
    {
      // v2 : la question « Qui êtes-vous ? » a été retirée (les index d'écran ont changé).
      name: "chamas-halloween-2026-v2",
      storage: createJSONStorage(() => localStorage),
      partialize: (s) => ({
        sessionId: s.sessionId,
        index: s.index,
        answers: s.answers,
        voteCompleted: s.voteCompleted,
        raffleDone: s.raffleDone,
      }),
      skipHydration: true,
    },
  ),
);
