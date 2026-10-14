"use client";

import { create } from "zustand";
import type { ResultsData } from "./crypt";

/** État partagé entre les pages publiques et le décor 3D (qui persiste d'une page à l'autre). */
type SceneState = {
  /** Lieu demandé par le questionnaire : cimetière pendant les questions, faucheuse ensuite. */
  questionnaireScene: "graveyard" | "reaper";
  /** "ready" : le décor 3D tourne ; "unsupported" : pas de WebGL, connexion lente, etc. */
  status: "pending" | "ready" | "unsupported";
  /** Le classement est visible sur le mur de la crypte. */
  revealed: boolean;
  results: ResultsData | null;
  /** Classement ouvert en grand (clic sur le panneau de la crypte). */
  boardOpen: boolean;
  /** Fermeture du classement : le clic qui le ferme ne doit pas le rouvrir (il tombe sur le panneau). */
  boardClosedAt: number;
  setQuestionnaireScene(scene: "graveyard" | "reaper"): void;
  setStatus(status: SceneState["status"]): void;
  setRevealed(revealed: boolean): void;
  setResults(results: ResultsData): void;
  setBoardOpen(open: boolean): void;
};

export const useSceneState = create<SceneState>()((set) => ({
  questionnaireScene: "graveyard",
  status: "pending",
  revealed: false,
  results: null,
  boardOpen: false,
  boardClosedAt: 0,
  setQuestionnaireScene: (questionnaireScene) => set({ questionnaireScene }),
  setStatus: (status) => set({ status }),
  setRevealed: (revealed) => set({ revealed }),
  setResults: (results) => set({ results }),
  setBoardOpen: (boardOpen) => set(boardOpen ? { boardOpen } : { boardOpen, boardClosedAt: Date.now() }),
}));
