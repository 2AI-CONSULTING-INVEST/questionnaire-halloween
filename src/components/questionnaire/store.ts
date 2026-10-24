"use client";

import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import { isDemoMode, setDemoMode } from "./demo";

export type Answers = {
  selected_restaurant: string | null;
  selected_decoration_id: string | null;
  comment: string;
  wants_raffle: boolean | null;
  /** Coordonnées du tirage : gardées sur l'appareil seulement, envoyées à la confirmation. */
  pseudo: string;
  first_name: string;
  last_name: string;
  phone_number: string; // tel que saisi ; normalisé à l'envoi
  email: string;
};

/** Écrans dans l'ordre (une question par écran). */
export const SCREENS = [
  "welcome",
  "restaurant",
  "vote",
  "comment",
  "raffle",
  "name",
  "phone",
  "email",
  "thanks",
] as const;
export type Screen = (typeof SCREENS)[number];

export const STEP_COUNT = 5;

/** Correspondance écran → « Étape X/5 ». */
export const STEP_OF: Record<Screen, number> = {
  welcome: 0,
  restaurant: 1,
  vote: 2,
  comment: 3,
  raffle: 4,
  name: 4,
  phone: 4,
  email: 4,
  thanks: 5,
};

const emptyAnswers: Answers = {
  selected_restaurant: null,
  selected_decoration_id: null,
  comment: "",
  wants_raffle: null,
  pseudo: "",
  first_name: "",
  last_name: "",
  phone_number: "",
  email: "",
};

/**
 * Stockage de la session : l'espace démo a sa propre clé, pour ne jamais mélanger ses réponses
 * avec un vrai vote (ni bloquer le vote du jour). Écritures suspendues pendant un changement de mode.
 */
let writesPaused = false;
const sessionStorageKey = (name: string) => (isDemoMode() ? `${name}-demo` : name);
const modeAwareStorage = {
  getItem: (name: string) => localStorage.getItem(sessionStorageKey(name)),
  setItem: (name: string, value: string) => {
    if (!writesPaused) localStorage.setItem(sessionStorageKey(name), value);
  },
  removeItem: (name: string) => localStorage.removeItem(sessionStorageKey(name)),
};

type State = {
  sessionId: string | null;
  index: number;
  direction: 1 | -1;
  answers: Answers;
  voteCompleted: boolean;
  /** Jour (Europe/Paris, « YYYY-MM-DD ») du vote validé : un seul vote par jour. */
  voteDay: string | null;
  raffleDone: boolean;
  /** L'inscription au tirage existait déjà (même personne, autre jour). */
  raffleAlreadyRegistered: boolean;
  start: () => string;
  setAnswer: <K extends keyof Answers>(key: K, value: Answers[K]) => void;
  go: (index: number) => void;
  markVoteCompleted: (day: string) => void;
  markRaffleDone: (alreadyRegistered: boolean) => void;
  /** Nouveau jour : nouvelle session, vote vidé, coordonnées du tirage conservées pour la ressaisie. */
  resetForNewDay: () => void;
};

export const useQuestionnaire = create<State>()(
  persist(
    (set, get) => ({
      sessionId: null,
      index: 0,
      direction: 1,
      answers: emptyAnswers,
      voteCompleted: false,
      voteDay: null,
      raffleDone: false,
      raffleAlreadyRegistered: false,
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
      markVoteCompleted: (day) => set({ voteCompleted: true, voteDay: day }),
      markRaffleDone: (alreadyRegistered) => set({ raffleDone: true, raffleAlreadyRegistered: alreadyRegistered }),
      resetForNewDay: () =>
        set((s) => ({
          sessionId: null,
          index: 0,
          direction: 1,
          answers: { ...emptyAnswers, pseudo: s.answers.pseudo, first_name: s.answers.first_name, last_name: s.answers.last_name, phone_number: s.answers.phone_number, email: s.answers.email },
          voteCompleted: false,
          voteDay: null,
          raffleDone: false,
          raffleAlreadyRegistered: false,
        })),
    }),
    {
      // v2 : la question « Qui êtes-vous ? » a été retirée (les index d'écran ont changé).
      name: "chamas-halloween-2026-v2",
      storage: createJSONStorage(() => modeAwareStorage),
      partialize: (s) => ({
        sessionId: s.sessionId,
        index: s.index,
        answers: s.answers,
        voteCompleted: s.voteCompleted,
        voteDay: s.voteDay,
        raffleDone: s.raffleDone,
        raffleAlreadyRegistered: s.raffleAlreadyRegistered,
      }),
      // Version 1 : vote quotidien (voteDay) et pseudonyme à la place du nom. Les états enregistrés
      // avant (version 0) n'ont pas de jour de vote : ils sont traités comme un jour précédent.
      // Version 2 : écrans « période » et « impact » retirés, l'index enregistré est recalé.
      // Version 3 : prénom et nom (facultatifs) ajoutés aux réponses.
      version: 3,
      migrate: (persisted, version) => {
        let s = (persisted ?? {}) as Partial<State> & { answers?: Partial<Answers> & { participant_name?: string } };
        if (version < 1) {
          const { participant_name, ...rest } = s.answers ?? {};
          s = {
            ...s,
            answers: { ...emptyAnswers, ...rest, pseudo: (participant_name ?? "").slice(0, 24) },
            voteDay: null,
            raffleAlreadyRegistered: false,
          };
        }
        if (version < 2) s = { ...s, index: [0, 1, 2, 2, 3, 3, 4, 5, 6, 7, 8][s.index ?? 0] ?? 0 };
        if (version < 3) s = { ...s, answers: { ...emptyAnswers, ...s.answers } };
        return s;
      },
      skipHydration: true,
    },
  ),
);

/** Session vierge (en mémoire), avant restauration depuis le stockage. */
const blankSession = {
  sessionId: null,
  index: 0,
  direction: 1 as const,
  answers: emptyAnswers,
  voteCompleted: false,
  voteDay: null,
  raffleDone: false,
  raffleAlreadyRegistered: false,
};

/**
 * Bascule entre le vrai vote et l'espace démo, avant la restauration de la session : l'état en
 * mémoire de l'autre mode est vidé sans écraser ce qui est enregistré pour celui-ci.
 */
export function setQuestionnaireMode(demo: boolean) {
  if (isDemoMode() === demo) return;
  setDemoMode(demo);
  writesPaused = true;
  useQuestionnaire.setState(blankSession);
  writesPaused = false;
}

/** Espace démo : recommence le parcours depuis l'accueil, tout vidé. */
export function restartDemo() {
  useQuestionnaire.setState(blankSession);
}
