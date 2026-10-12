"use client";

import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import type { Impact, VisitPeriod, VoterType } from "@/lib/schema";

export type Answers = {
  voter_type: VoterType | null;
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

/** Écrans dans l'ordre du Typeform (une question par écran). */
export const SCREENS = [
  "welcome",
  "q1",
  "q2",
  "q3",
  "q4",
  "q5",
  "q6",
  "q7a",
  "q7b",
  "q7c",
  "q7d",
  "thanks",
] as const;
export type Screen = (typeof SCREENS)[number];

/** Correspondance écran → « Étape X/7 » du cahier des charges. */
export const STEP_OF: Record<Screen, number> = {
  welcome: 0,
  q1: 1,
  q2: 2,
  q3: 2,
  q4: 3,
  q5: 4,
  q6: 5,
  q7a: 6,
  q7b: 6,
  q7c: 6,
  q7d: 6,
  thanks: 7,
};

const emptyAnswers: Answers = {
  voter_type: null,
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
      name: "chamas-halloween-2026",
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
