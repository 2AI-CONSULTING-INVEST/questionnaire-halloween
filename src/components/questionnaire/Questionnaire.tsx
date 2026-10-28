"use client";

import { AnimatePresence, motion } from "framer-motion";
import { X, ChevronDown, ChevronUp, Clock, CloudOff, ExternalLink, Gift, Loader2, CloudCheck } from "lucide-react";
import { Toast, ToggleGroup } from "radix-ui";
import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import {
  commentSchema,
  COMMENT_MAX,
  emailSchema,
  groupDecorations,
  normalizeFrPhone,
  NAME_MAX,
  PSEUDO_MAX,
  pseudoSchema,
  RAFFLE_FIELDS,
  type Decoration,
} from "@/lib/schema";
import { HOME, tabTitle } from "@/lib/site";
import { clientNow, syncServerClock } from "@/lib/clock";
import { markVoteDay, readVoteDaySync } from "@/lib/device-memory";
import { isPastDay, nextParisMidnight, parisDay } from "@/lib/day";
import { deviceSignals } from "@/lib/fingerprint";
import { setNextVote } from "@/lib/next-vote";
import { useSceneState } from "../scene/scene-state";
import { triggerSwarm } from "../scene/SpookyBackdrop";
import { AlreadyVoted } from "./AlreadyVoted";
import { BlockedVoteDialog } from "./BlockedVoteDialog";
import { Confetti } from "./Confetti";
import { DecorationGallery, LETTERS } from "./DecorationGallery";
import { RaffleConfirmDialog, type RaffleErrors, type RaffleValues } from "./RaffleConfirmDialog";
import { RaffleDeclineDialog, type PublicPrize } from "./RaffleDeclineDialog";
import { RestaurantCombobox } from "./RestaurantCombobox";
import { apiFetch, DEMO_RESTART_EVENT, enterDemoTab, isDemoTab, subscribeDemoTab } from "./demo";
import { createSession, discard, flush, initSaver, onSaveStatus, save } from "./saver";
import { restartDemo, SCREENS, setQuestionnaireMode, STEP_COUNT, STEP_OF, useQuestionnaire, type Answers, type Screen } from "./store";
import { Emoji, FieldError, KeyBadge, OkButton, pillClass, QuestionHeader } from "./ui";
import { ThanksActions } from "./ThanksActions";
import { withBase } from "@/lib/base-path";

/** Titre d'onglet de chaque écran (après « CHAMAS | »). */
const stepTitle = (s: Screen, label: string) => `Étape ${STEP_OF[s]}/${STEP_COUNT} : ${label}`;
const STEP_TITLE: Record<Screen, string> = {
  welcome: HOME.title,
  restaurant: stepTitle("restaurant", "Votre Chamas Tacos préféré"),
  vote: stepTitle("vote", "Votez pour la meilleure déco Halloween"),
  comment: stepTitle("comment", "Votre commentaire"),
  raffle: stepTitle("raffle", "Tirage au sort Halloween"),
  name: stepTitle("name", "Votre pseudonyme pour le tirage"),
  phone: stepTitle("phone", "Vos coordonnées pour le tirage"),
  email: stepTitle("email", "Vos coordonnées pour le tirage"),
  thanks: "Merci pour votre vote !",
};
const ALREADY_VOTED_TITLE = "Vous avez déjà voté aujourd'hui";

const VOTE_FIELDS = ["selected_restaurant", "selected_decoration_id", "comment"];

/** Champ en erreur renvoyé par l'API → écran à réafficher. */
const SCREEN_OF_FIELD: Partial<Record<string, Screen>> = {
  selected_restaurant: "restaurant",
  selected_decoration_id: "vote",
  comment: "comment",
  pseudo: "name",
  phone_number: "phone",
  email: "email",
};

/** Corps d'une réponse d'erreur de l'API (422 validation, 409 conflit / vote du jour). */
type ApiError = { error?: string; details?: Record<string, string[]> & { code?: string; nextResetAt?: string; now?: string } };

/** Attente maximale de la vérification à l'arrivée : au-delà, la page s'ouvre normalement (le serveur refusera quand même). */
const ARRIVAL_WAIT_MS = 1500;

const inputClass =
  "w-full border-b-2 border-edge-strong bg-transparent pb-2 text-xl text-fg outline-none transition-colors placeholder:text-placeholder-scene focus:border-brand sm:text-[1.75rem]";

/**
 * Formate la saisie : « 0713554467 » → « 07 13 55 44 67 », « +33713554467 » → « +33 7 13 55 44 67 »,
 * « 0033713554467 » → « +33 7 13 55 44 67 » (préfixe international « 00 » converti en « + »).
 */
function formatPhoneInput(v: string) {
  let t = v.trim();
  if (/^00\d/.test(t.replace(/\D/g, "")) && !t.startsWith("+")) t = "+" + t.replace(/\D/g, "").slice(2);
  if (t.startsWith("+")) {
    const d = t.replace(/\D/g, "").slice(0, 11);
    if (d.length <= 2) return `+${d}`;
    const rest = d.slice(2);
    return `+${d.slice(0, 2)} ${rest.slice(0, 1)} ${rest.slice(1).replace(/(\d{2})(?=\d)/g, "$1 ")}`.trim();
  }
  return t.replace(/\D/g, "").slice(0, 10).replace(/(\d{2})(?=\d)/g, "$1 ");
}

const variants = {
  enter: (dir: number) => ({ opacity: 0, y: dir > 0 ? 40 : -40 }),
  center: { opacity: 1, y: 0 },
  exit: (dir: number) => ({ opacity: 0, y: dir > 0 ? -40 : 40 }),
};

type Props = {
  restaurants: string[];
  decorations: Decoration[];
  social: { url: string | null; label: string };
  videoUrl: string | null;
  /** Lots publics (nom, description, image) : rappelés si la personne répond « Non » au tirage. */
  prizes?: PublicPrize[];
  /** Page /demo : parcours complet, mais rien n'est enregistré (voir demo.ts). Pose le drapeau de l'onglet. */
  demo?: boolean;
};

export function Questionnaire({ restaurants, decorations, social, videoUrl, prizes = [], demo: demoPage = false }: Props) {
  // Démo « collante » : la page /demo, ou tout questionnaire d'un onglet entré en démo (demo.ts).
  const demo = useSyncExternalStore(subscribeDemoTab, isDemoTab, () => false) || demoPage;
  const { sessionId, index, direction, answers, voteCompleted, raffleAlreadyRegistered, start, setAnswer, go, markVoteCompleted, markRaffleDone } =
    useQuestionnaire();
  const groups = useMemo(() => groupDecorations(decorations), [decorations]);
  const [hydrated, setHydrated] = useState(false);
  /** L'appareil a déjà voté aujourd'hui : écran dédié jusqu'à la réouverture (minuit à Paris). */
  const [alreadyVoted, setAlreadyVoted] = useState<{ nextResetAt: string } | null>(null);
  /** Refus visible du serveur (409) : modale « Votre vote est bloqué », puis écran « déjà voté ». */
  const [blocked, setBlocked] = useState<{ nextResetAt: string } | null>(null);
  /** Modale « vote bloqué » ouverte : une réponse tardive de vote-status ne la remplace pas (seul closeBlocked y mène). */
  const blockedOpen = useRef(false);
  /** Vérification à l'arrivée en cours : pas de bouton « Commencer le vote » (aucun flash), 1,5 s au plus. */
  const [arrivalPending, setArrivalPending] = useState(!demoPage);
  const [confirmOpen, setConfirmOpen] = useState(false);
  /** Confirmation du « Non » au tirage (rappel des lots). */
  const [declineOpen, setDeclineOpen] = useState(false);
  // L'erreur est rattachée à l'écran où elle a été levée : elle disparaît en changeant d'écran.
  const [errorState, setErrorState] = useState<{ index: number; message: string } | null>(null);
  const error = errorState?.index === index ? errorState.message : null;
  const setError = useCallback(
    (message: string | null) =>
      setErrorState(message ? { index: useQuestionnaire.getState().index, message } : null),
    [],
  );
  const [submitting, setSubmitting] = useState(false);
  const [saveStatus, setSaveStatus] = useState<"idle" | "saving" | "error">("idle");
  const [toastOpen, setToastOpen] = useState(false);
  const advanceTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  const screen: Screen = SCREENS[index];
  const step = STEP_OF[screen];
  // Avant le vote validé, la flèche « précédent » ramène jusqu'à l'accueil (bouton « Reprendre le vote ») ;
  // après, le tirage reste le premier écran accessible.
  const minIndex = voteCompleted ? SCREENS.indexOf("raffle") : 0;

  // Restauration de la session (localStorage) après le premier rendu.
  useEffect(() => {
    let cancelled = false;
    // Avant la restauration et avant tout appel : la démo lit et écrit sa propre session. Le
    // drapeau de l'onglet est lu ici de façon synchrone (pas l'état React, encore faux à l'hydratation).
    if (demoPage) enterDemoTab();
    const demo = demoPage || isDemoTab();
    setQuestionnaireMode(demo);
    void Promise.resolve(useQuestionnaire.persist.rehydrate()).then(() => {
      const now = clientNow();
      let s = useQuestionnaire.getState();
      // Vote d'un jour précédent (ou d'avant le vote quotidien) : nouvelle session propre.
      if (s.voteCompleted && (!s.voteDay || isPastDay(s.voteDay, now))) {
        s.resetForNewDay();
        s = useQuestionnaire.getState();
      }
      if (s.sessionId) initSaver(s.sessionId);
      // Démo terminée : on revient sur les remerciements (pas de blocage « déjà voté » en démo).
      if (s.voteCompleted && s.raffleDone && demo) s.go(SCREENS.indexOf("thanks"));
      else if (s.voteCompleted && s.raffleDone) setAlreadyVoted({ nextResetAt: nextParisMidnight(now).toISOString() });
      else if (s.voteCompleted && s.index < SCREENS.indexOf("raffle")) s.go(SCREENS.indexOf("raffle"));
      // Média supprimé entre-temps : on efface le choix.
      if (s.answers.selected_decoration_id && !decorations.some((d) => d.id === s.answers.selected_decoration_id)) {
        s.setAnswer("selected_decoration_id", null);
      }
      // Repère du jour de vote encore dans le stockage : écran « déjà voté » tout de suite, sans attendre le réseau.
      const inProgress = s.voteCompleted && !s.raffleDone; // vote du jour en cours sur cet appareil (tirage pas encore rempli) : on laisse finir
      const markerLock = !demo && !inProgress && !s.voteCompleted && readVoteDaySync() === parisDay(now);
      if (markerLock) setAlreadyVoted({ nextResetAt: nextParisMidnight(now).toISOString() });
      setHydrated(true);
      if (demo) {
        setArrivalPending(false);
        return;
      }
      // Le serveur reconnaît l'appareil (cookie, jetons du stockage, clé matérielle forte) même si le stockage
      // local a été vidé. Il reste la seule vérité : réponse lente ou en erreur, la page s'ouvre normalement.
      const timeout = setTimeout(() => !cancelled && setArrivalPending(false), ARRIVAL_WAIT_MS);
      void deviceSignals()
        .then((device) =>
          apiFetch("/api/vote-status", { method: "POST", cache: "no-store", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ device }) }),
        )
        .then((r) => (r.ok ? (r.json() as Promise<{ votedToday: boolean; today: string; nextResetAt: string; now?: string }>) : null))
        .then((status) => {
          if (cancelled || !status) return;
          syncServerClock(status.now);
          if (blockedOpen.current) return; // la fermeture de la modale mène à l'écran « déjà voté »
          const st = useQuestionnaire.getState();
          if (status.votedToday && !(st.voteCompleted && st.voteDay === status.today && !st.raffleDone)) setAlreadyVoted({ nextResetAt: status.nextResetAt });
          else if (!status.votedToday && markerLock) setAlreadyVoted(null); // le serveur ne connaît aucune tentative : il tranche
        })
        .catch(() => undefined)
        .finally(() => {
          clearTimeout(timeout);
          if (!cancelled) setArrivalPending(false);
        });
    });
    return () => {
      cancelled = true;
    };
  }, [decorations, demoPage]);

  /** Minuit est passé : le vote rouvre sans recharger la page. */
  const reopenVote = useCallback(() => {
    useQuestionnaire.getState().resetForNewDay();
    setAlreadyVoted(null);
    blockedOpen.current = false;
    setBlocked(null);
    setNextVote(null, demo);
  }, [demo]);

  /** Refus visible du serveur : repère du jour posé (tentative), modale « Votre vote est bloqué ». */
  const showBlocked = useCallback(
    (nextResetAt: string) => {
      if (!demo) markVoteDay(parisDay(clientNow()));
      blockedOpen.current = true;
      setBlocked({ nextResetAt });
    },
    [demo],
  );
  /** Fermer la modale mène à l'écran « déjà voté ». */
  const closeBlocked = useCallback(() => {
    blockedOpen.current = false;
    setBlocked((b) => {
      if (b) setAlreadyVoted({ nextResetAt: b.nextResetAt });
      return null;
    });
  }, []);

  // « Recommencer » du bandeau démo (DemoBar) : retour à l'accueil, tout vidé.
  useEffect(() => {
    if (!demo) return;
    const restart = () => {
      restartDemo();
      setNextVote(null, true);
      setAlreadyVoted(null);
      setErrorState(null);
      setConfirmOpen(false);
    };
    window.addEventListener(DEMO_RESTART_EVENT, restart);
    return () => window.removeEventListener(DEMO_RESTART_EVENT, restart);
  }, [demo]);

  // Vote du jour fait (validé, ou appareil reconnu « déjà voté ») : compte à rebours en haut à
  // droite, sur toutes les pages publiques (CornerRail).
  useEffect(() => {
    if (!hydrated) return;
    if (alreadyVoted) setNextVote(alreadyVoted.nextResetAt, demo);
    else if (voteCompleted) setNextVote(nextParisMidnight(clientNow()).toISOString(), demo);
  }, [hydrated, alreadyVoted, voteCompleted, demo]);

  useEffect(
    () =>
      onSaveStatus((st) => {
        setSaveStatus(st);
        if (st === "error") setToastOpen(true);
      }),
    [],
  );

  useEffect(() => () => clearTimeout(advanceTimer.current), [index]);

  // Titre de l'onglet : « CHAMAS | » suivi de l'étape en cours (jamais de donnée saisie).
  // Réappliqué après un court délai : le <title> des métadonnées, streamé par Next, peut arriver après l'hydratation.
  useEffect(() => {
    if (!hydrated) return;
    const apply = () => {
      const title = alreadyVoted ? ALREADY_VOTED_TITLE : STEP_TITLE[screen];
      document.title = tabTitle(demo ? `Démo : ${title}` : title);
    };
    apply();
    const id = setTimeout(apply, 1500);
    return () => clearTimeout(id);
  }, [screen, hydrated, alreadyVoted, demo]);

  // Décor 3D : cimetière pendant les questions (et sur l'écran « déjà voté »), clairière de la faucheuse au tirage au sort.
  useEffect(() => {
    const atReaper = screen === "raffle" || screen === "name" || screen === "phone" || screen === "email" || screen === "thanks";
    useSceneState.getState().setQuestionnaireScene(atReaper && !alreadyVoted ? "reaper" : "graveyard");
  }, [screen, alreadyVoted]);

  /** Mise à jour locale immédiate + enregistrement en base (debounce pour les champs texte). */
  const answer = useCallback(
    <K extends keyof Answers>(key: K, value: Answers[K], dbValue: unknown = value, debounceMs = 0) => {
      setAnswer(key, value);
      setError(null);
      if (dbValue !== undefined) save({ [key]: dbValue }, debounceMs);
    },
    [setAnswer, setError],
  );

  /** Coordonnées du tirage : gardées sur l'appareil seulement, jamais envoyées avant la confirmation. */
  const answerLocal = useCallback(
    <K extends keyof Answers>(key: K, value: Answers[K]) => {
      setAnswer(key, value);
      setError(null);
    },
    [setAnswer, setError],
  );

  const next = useCallback(() => go(index + 1), [go, index]);
  const prev = useCallback(() => {
    if (index > minIndex) go(index - 1);
  }, [go, index, minIndex]);

  const autoAdvance = useCallback(() => {
    clearTimeout(advanceTimer.current);
    advanceTimer.current = setTimeout(() => useQuestionnaire.getState().go(useQuestionnaire.getState().index + 1), 450);
  }, []);

  const begin = useCallback(() => {
    const isNew = !useQuestionnaire.getState().sessionId;
    const id = start();
    initSaver(id);
    if (isNew) {
      // Appareil qui a déjà voté aujourd'hui (stockage local vidé, cookie conservé) : pas de session.
      void createSession(id).then((r) => r && showBlocked(r.alreadyVoted));
      triggerSwarm(18);
    }
  }, [start, showBlocked]);

  // ----- Soumissions -------------------------------------------------------

  const showServerError = useCallback(
    (body: ApiError) => {
      const field = Object.keys(body.details ?? {})[0];
      const target = field ? SCREEN_OF_FIELD[field] : undefined;
      if (field && target) {
        go(SCREENS.indexOf(target));
        setTimeout(() => setError(body.details?.[field]?.[0] ?? "Réponse invalide"), 50);
      } else {
        setError(body.error ?? "Une erreur est survenue, réessayez.");
      }
    },
    [go, setError],
  );

  const submitVote = useCallback(async () => {
    if (!sessionId) return;
    if (voteCompleted) return next();
    setSubmitting(true);
    try {
      const a = useQuestionnaire.getState().answers;
      const res = await apiFetch(`/api/responses/${sessionId}/complete`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          selected_restaurant: a.selected_restaurant,
          selected_decoration_id: a.selected_decoration_id,
          comment: a.comment.trim() || null,
          device: await deviceSignals(),
        }),
      });
      if (res.ok) {
        const body = (await res.json().catch(() => ({}))) as { voteDay?: string };
        discard(VOTE_FIELDS);
        if (!demo) markVoteDay(body.voteDay ?? parisDay(clientNow()));
        markVoteCompleted(body.voteDay ?? parisDay(clientNow()));
        go(SCREENS.indexOf("raffle"));
        triggerSwarm();
        return;
      }
      const body = (await res.json().catch(() => ({}))) as ApiError;
      if (res.status === 409 && body.details?.code === "already_voted_today") {
        syncServerClock(body.details.now);
        showBlocked(body.details.nextResetAt ?? nextParisMidnight(clientNow()).toISOString());
        return;
      }
      showServerError(body);
    } catch {
      setError("Connexion perdue. Vérifiez votre réseau puis réessayez.");
    } finally {
      setSubmitting(false);
    }
  }, [sessionId, voteCompleted, next, markVoteCompleted, go, setError, showServerError, demo, showBlocked]);

  /** Réponse « Non » au tirage : enregistrée directement. */
  const declineRaffle = useCallback(async () => {
    if (!sessionId) return;
    setSubmitting(true);
    try {
      const res = await apiFetch(`/api/responses/${sessionId}/raffle`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ wants_raffle: false }),
      });
      if (res.ok) {
        discard([...RAFFLE_FIELDS]);
        markRaffleDone(false);
        setDeclineOpen(false);
        go(SCREENS.indexOf("thanks"));
        return;
      }
      showServerError((await res.json().catch(() => ({}))) as ApiError);
    } catch {
      setError("Connexion perdue. Vérifiez votre réseau puis réessayez.");
    } finally {
      setSubmitting(false);
    }
  }, [sessionId, markRaffleDone, go, setError, showServerError]);

  /**
   * Confirmation du tirage depuis la modale : les coordonnées vérifiées partent maintenant (jamais
   * avant). Les refus (pseudo / email / téléphone déjà inscrits) reviennent à la modale, par champ.
   */
  const confirmRaffle = useCallback(
    async (values: RaffleValues): Promise<RaffleErrors & { form?: string }> => {
      if (!sessionId) return { form: "Session introuvable, rechargez la page." };
      try {
        const res = await apiFetch(`/api/responses/${sessionId}/raffle`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ wants_raffle: true, ...values }),
        });
        if (res.ok) {
          const body = (await res.json().catch(() => ({}))) as { alreadyRegistered?: boolean };
          const s = useQuestionnaire.getState();
          s.setAnswer("pseudo", values.pseudo);
          s.setAnswer("first_name", values.first_name);
          s.setAnswer("last_name", values.last_name);
          s.setAnswer("phone_number", values.phone_number);
          s.setAnswer("email", values.email);
          discard([...RAFFLE_FIELDS]);
          markRaffleDone(!!body.alreadyRegistered);
          setConfirmOpen(false);
          go(SCREENS.indexOf("thanks"));
          return {};
        }
        const body = (await res.json().catch(() => ({}))) as ApiError;
        const errors: RaffleErrors & { form?: string } = {};
        for (const k of ["pseudo", "phone_number", "email"] as const) {
          const m = body.details?.[k]?.[0];
          if (m) errors[k] = m;
        }
        if (!Object.keys(errors).length) errors.form = body.error ?? "Une erreur est survenue, réessayez.";
        return errors;
      } catch {
        return { form: "Connexion perdue. Vérifiez votre réseau puis réessayez." };
      }
    },
    [sessionId, markRaffleDone, go],
  );

  // ----- Validation + action « OK » par écran ------------------------------

  const validateAndNext = useCallback(() => {
    const a = answers;
    const fail = (m: string) => setError(m);
    switch (screen) {
      case "welcome":
        return begin();
      case "restaurant":
        return a.selected_restaurant ? next() : fail("Veuillez choisir un restaurant");
      case "vote":
        if (groups.length === 0) return fail("Aucune décoration n'est encore disponible");
        return a.selected_decoration_id ? next() : fail("Veuillez choisir une décoration");
      case "comment": {
        const r = commentSchema.safeParse(a.comment);
        if (!r.success) return fail(r.error.issues[0]?.message ?? "Commentaire invalide");
        void flush();
        return void submitVote();
      }
      case "raffle":
        if (a.wants_raffle === null) return fail("Veuillez répondre Oui ou Non");
        // « Non » : on confirme d'abord, en rappelant les lots (RaffleDeclineDialog).
        return a.wants_raffle ? next() : setDeclineOpen(true);
      case "name": {
        const r = pseudoSchema.safeParse(a.pseudo);
        return r.success ? next() : fail(r.error.issues[0]?.message ?? "Pseudonyme invalide");
      }
      case "phone":
        return normalizeFrPhone(a.phone_number) ? next() : fail("Numéro de téléphone français invalide (ex. 07 13 55 44 67)");
      case "email": {
        const r = emailSchema.safeParse(a.email);
        // « Envoyer » n'envoie pas tout de suite : la modale de vérification s'ouvre.
        return r.success ? setConfirmOpen(true) : fail("Adresse email invalide");
      }
    }
  }, [answers, screen, begin, next, groups.length, submitVote, setError]);

  // ----- Clavier (comme Typeform) ------------------------------------------

  const choiceKeys = useMemo((): Record<string, () => void> => {
    const map: Record<string, () => void> = {};
    if (screen === "vote")
      groups.forEach(
        (g, i) => (map[LETTERS[i]] = () => answer("selected_decoration_id", useQuestionnaire.getState().answers.selected_decoration_id === g.id ? null : g.id)),
      );
    if (screen === "raffle") {
      map.Y = map.O = () => (answer("wants_raffle", true), autoAdvance());
      map.N = () => answer("wants_raffle", false);
    }
    return map;
  }, [screen, groups, answer, autoAdvance]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.defaultPrevented || e.altKey || e.metaKey) return;
      const t = e.target as HTMLElement;
      // Visionneuse ouverte : le clavier lui appartient.
      if (t.closest('[role="dialog"]')) return;
      const typing = t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.isContentEditable;
      if (e.key === "Enter" && !e.shiftKey) {
        // Laisse les boutons / liens réagir normalement (sauf options radio).
        if ((t.tagName === "BUTTON" && t.getAttribute("role") !== "radio") || t.closest("a")) return;
        e.preventDefault();
        validateAndNext();
        return;
      }
      if (typing || e.ctrlKey) return;
      const fn = choiceKeys[e.key.toUpperCase()];
      if (fn) {
        e.preventDefault();
        fn();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [validateAndNext, choiceKeys]);

  // ----- Rendu des écrans ----------------------------------------------------

  const qid = `q-${screen}`;

  function renderScreen() {
    switch (screen) {
      case "welcome":
        return (
          <div className="mx-auto max-w-3xl text-center">
            <h1 className="text-4xl leading-[1.15] tracking-tight text-fg [text-shadow:0_2px_24px_rgba(0,0,0,0.45)] sm:text-6xl day:[text-shadow:none]">
              <Emoji name="pumpkin" size={64} priority className="mr-3 h-[1em] w-[1em]" />
              Votez pour la meilleure décoration Halloween Chamas Tacos !
              <Emoji name="ghost" size={64} priority className="ml-3 h-[1em] w-[1em]" />
            </h1>
            <p className="mt-5 text-lg text-fg-muted sm:text-xl">
              Aidez-nous à élire le restaurant avec la meilleure atmosphère effrayante et créative !
            </p>
            {/* Vérification à l'arrivée en cours : emplacement réservé, sans bouton (aucun flash). */}
            {arrivalPending ? (
              <div aria-hidden className="mx-auto mt-10 h-12" />
            ) : (
              <button
                type="button"
                onClick={begin}
                className="mt-10 min-h-12 rounded-full bg-brand px-7 text-xl font-bold text-black shadow-[0_0_30px_rgba(250,204,21,0.35)] transition-[filter,box-shadow] hover:brightness-105 hover:shadow-[0_0_44px_rgba(250,204,21,0.5)] active:brightness-95"
              >
                {sessionId && index === 0 ? "Reprendre le vote" : "Commencer le vote"}
              </button>
            )}
            <p className="mt-4 inline-flex w-full items-center justify-center gap-1.5 text-sm text-fg-muted">
              <Clock className="h-4 w-4" aria-hidden /> Prend moins de 2 minutes
            </p>
          </div>
        );

      case "restaurant":
        return (
          <>
            <QuestionHeader
              id={qid}
              number="1"
              title="Quel est votre Chamas Tacos préféré ?"
              required
              description="Sélectionnez le restaurant Chamas Tacos que vous avez visité ou celui que vous fréquentez souvent."
            />
            <div className="pl-8">
              <RestaurantCombobox
                labelledBy={qid}
                options={restaurants}
                value={answers.selected_restaurant}
                onChange={(v) => answer("selected_restaurant", v)}
              />
            </div>
          </>
        );

      case "vote":
        return (
          <>
            {videoUrl && (
              <video
                src={videoUrl}
                controls
                playsInline
                preload="metadata"
                className="mx-auto mb-8 max-h-[70svh] w-full rounded-2xl bg-black object-contain"
              />
            )}
            <QuestionHeader
              id={qid}
              number="2"
              title="Choisissez le restaurant ayant la meilleure décoration Halloween selon vous"
              required
              description={groups.some((g) => g.items.length > 1) ? "Glissez sur une photo pour voir les autres, touchez ⤢ pour l'agrandir." : undefined}
            />
            <div className="pl-0 sm:pl-8">
              {groups.length === 0 ? (
                <p className="rounded-lg bg-surface p-6 text-fg-muted">Les photos des décorations arrivent très bientôt 🎃</p>
              ) : (
                <DecorationGallery
                  labelledBy={qid}
                  groups={groups}
                  value={answers.selected_decoration_id}
                  onChange={(id) => answer("selected_decoration_id", id)}
                />
              )}
            </div>
          </>
        );

      case "comment":
        return (
          <>
            <QuestionHeader
              id={qid}
              number="3"
              title={
                <>
                  <Emoji name="thought" size={30} className="mr-2" />
                  Un commentaire sur la décoration ?
                </>
              }
            />
            <div className="pl-8">
              <textarea
                aria-labelledby={qid}
                autoFocus
                rows={2}
                maxLength={COMMENT_MAX}
                value={answers.comment}
                placeholder="Dites-nous ce que vous en pensez ! Vos suggestions nous intéressent..."
                onChange={(e) => {
                  const v = e.target.value;
                  const ok = commentSchema.safeParse(v).success;
                  answer("comment", v, ok ? v.trim() || null : undefined, 1000);
                  e.target.style.height = "auto";
                  e.target.style.height = `${e.target.scrollHeight}px`;
                }}
                onBlur={() => void flush()}
                className={`${inputClass} resize-none max-sm:min-h-24`}
              />
              <div className="mt-2 flex justify-between text-xs text-fg-muted">
                <span className="hidden sm:inline">
                  <strong>Maj ⇧</strong> + <strong>Entrée ↵</strong> pour aller à la ligne
                </span>
                <span aria-live="polite" className={`ml-auto ${answers.comment.length >= COMMENT_MAX ? "font-bold text-danger-fg" : ""}`}>
                  {answers.comment.length}/{COMMENT_MAX}
                </span>
              </div>
            </div>
          </>
        );

      case "raffle":
        return (
          <>
            <QuestionHeader
              id={qid}
              number="a"
              title="Souhaitez-vous également participer à notre tirage au sort Halloween et tenter de gagner un de nos nombreux lots ?"
              required
            />
            <ToggleGroup.Root
              type="single"
              aria-labelledby={qid}
              value={answers.wants_raffle === null ? "" : answers.wants_raffle ? "yes" : "no"}
              onValueChange={(v) => {
                if (!v) return;
                answer("wants_raffle", v === "yes");
                if (v === "yes") autoAdvance();
              }}
              className="flex flex-col gap-3 pl-8 sm:w-fit"
            >
              {([["yes", "O", "Oui"], ["no", "N", "Non"]] as const).map(([value, key, label]) => {
                const selected = (answers.wants_raffle === true && value === "yes") || (answers.wants_raffle === false && value === "no");
                return (
                  <ToggleGroup.Item key={value} value={value} className={pillClass(selected)}>
                    <KeyBadge letter={key} active={selected} />
                    {label}
                  </ToggleGroup.Item>
                );
              })}
            </ToggleGroup.Root>
            {/* Nouvel onglet : la saisie en cours reste à l'écran. */}
            <a
              href={withBase("/participants")}
              target="_blank"
              rel="noopener"
              className="mt-5 inline-flex min-h-11 items-center gap-2 pl-8 text-base font-semibold text-fg underline decoration-brand decoration-2 underline-offset-4 hover:text-brand"
            >
              <Gift className="h-5 w-5 text-brand" aria-hidden /> Voir les lots à gagner
              <ExternalLink className="h-4 w-4 text-fg-muted" aria-hidden />
            </a>
          </>
        );

      case "name":
        return (
          <>
            <QuestionHeader
              id={qid}
              number="b"
              title="Votre pseudonyme"
              required
              description="Il sera affiché publiquement dans la liste des participants. 3 à 24 caractères."
            />
            <div className="pl-8">
              <input
                aria-labelledby={qid}
                autoFocus
                autoComplete="nickname"
                maxLength={PSEUDO_MAX}
                value={answers.pseudo}
                placeholder="Tapez votre pseudonyme ici..."
                onChange={(e) => answerLocal("pseudo", e.target.value)}
                className={inputClass}
              />
              <p className="mt-6 text-sm text-fg-muted">Prénom et nom (facultatif)</p>
              <div className="mt-2 grid grid-cols-2 gap-4">
                <input aria-label="Prénom (facultatif)" autoComplete="given-name" maxLength={NAME_MAX} value={answers.first_name} placeholder="Prénom" onChange={(e) => answerLocal("first_name", e.target.value)} className={inputClass} />
                <input aria-label="Nom (facultatif)" autoComplete="family-name" maxLength={NAME_MAX} value={answers.last_name} placeholder="Nom" onChange={(e) => answerLocal("last_name", e.target.value)} className={inputClass} />
              </div>
            </div>
          </>
        );

      case "phone":
        return (
          <>
            <QuestionHeader id={qid} number="c" title="Votre numéro de téléphone" required description="Nous contacterons les gagnants par téléphone." />
            <div className="flex items-end gap-3 pl-8">
              <span className="flex items-center border-b-2 border-edge pb-3.5 sm:pb-4" title="France" aria-hidden>
                <svg viewBox="0 0 3 2" className="h-5 w-7 rounded-sm shadow-sm">
                  <rect width="1" height="2" fill="#002395" />
                  <rect x="1" width="1" height="2" fill="#fff" />
                  <rect x="2" width="1" height="2" fill="#ED2939" />
                </svg>
              </span>
              <input
                aria-labelledby={qid}
                autoFocus
                type="tel"
                inputMode="tel"
                autoComplete="tel-national"
                value={answers.phone_number}
                placeholder="07 13 55 44 67"
                onChange={(e) => answerLocal("phone_number", formatPhoneInput(e.target.value))}
                className={inputClass}
              />
            </div>
          </>
        );

      case "email":
        return (
          <>
            <QuestionHeader id={qid} number="d" title="Votre adresse email" required />
            <div className="pl-8">
              <input
                aria-labelledby={qid}
                autoFocus
                type="email"
                inputMode="email"
                autoComplete="email"
                maxLength={255}
                value={answers.email}
                placeholder="votreemail@gmail.com"
                onChange={(e) => answerLocal("email", e.target.value)}
                className={inputClass}
              />
            </div>
          </>
        );

      case "thanks":
        return (
          <div className="mx-auto max-w-3xl text-center">
            <Confetti />
            {/* Petits écrans : textes plus petits pour aérer (rien de tronqué à 360 px). */}
            <div>
            <h1 className="text-[1.7rem] leading-[1.18] tracking-tight text-fg [text-shadow:0_2px_24px_rgba(0,0,0,0.45)] min-[400px]:text-3xl sm:text-6xl day:[text-shadow:none]">
              <Emoji name="party" size={64} className="mr-2 h-[1em] w-[1em] sm:mr-3" />
              Merci pour votre vote&nbsp;! Votre avis compte pour Chamas Tacos&nbsp;!
              <Emoji name="ghost" size={64} className="ml-2 h-[1em] w-[1em] sm:ml-3" />
            </h1>
            {raffleAlreadyRegistered && (
              <p className="mx-auto mt-6 max-w-xl rounded-xl border border-edge bg-surface/85 px-4 py-3 text-base font-semibold text-fg backdrop-blur" role="status">
                ✅ Vous êtes déjà inscrit au tirage au sort, votre participation est bien enregistrée.
              </p>
            )}
            <p className="mt-4 text-base text-fg-muted sm:mt-6 sm:text-xl">
              Vous pourrez voir le tirage au sort en direct sur{" "}
              {social.url ? (
                <a href={social.url} target="_blank" rel="noopener noreferrer" className="font-semibold text-fg underline decoration-brand decoration-4 underline-offset-4">
                  notre {social.label}
                </a>
              ) : (
                <span className="font-semibold text-fg">nos réseaux sociaux</span>
              )}
              .
            </p>
            </div>
            <ThanksActions className="mt-7 sm:mt-10" />
          </div>
        );
    }
  }

  const isRaffle = screen === "raffle" || screen === "name" || screen === "phone" || screen === "email";
  // Bandeau « vote enregistré » des écrans du tirage : part tout seul après 15 s, ou à la croix ;
  // une fois parti, il ne revient pas de la session de vote (sessionStorage).
  const [bannerGone, setBannerGone] = useState<string | null>(null);
  const bannerKey = `hw-raffle-banner-${sessionId ?? ""}`;
  const bannerStored = () => {
    try {
      return sessionStorage.getItem(bannerKey) === "1";
    } catch {
      return false;
    }
  };
  const showBanner = isRaffle && !alreadyVoted && bannerGone !== bannerKey && !bannerStored();
  const closeBanner = useCallback(() => {
    try {
      sessionStorage.setItem(bannerKey, "1");
    } catch {
      /* il reviendra au rechargement */
    }
    setBannerGone(bannerKey);
  }, [bannerKey]);
  useEffect(() => {
    if (!showBanner) return;
    const id = setTimeout(closeBanner, 15000);
    return () => clearTimeout(id);
  }, [showBanner, closeBanner]);

  // Barre d'étape et bandeau du tirage : les languettes du coin haut-droit descendent sous eux (globals.css).
  const topbar = !alreadyVoted && screen !== "welcome" && screen !== "thanks";
  useEffect(() => {
    const root = document.documentElement;
    root.toggleAttribute("data-hw-topbar", topbar);
    root.toggleAttribute("data-hw-banner", topbar && showBanner);
    return () => {
      root.removeAttribute("data-hw-topbar");
      root.removeAttribute("data-hw-banner");
    };
  }, [topbar, showBanner]);
  // Valeurs proposées dans la modale (objet stable : la modale ne se réinitialise qu'à l'ouverture).
  const raffleInitial = useMemo<RaffleValues>(
    () => ({ pseudo: answers.pseudo, first_name: answers.first_name, last_name: answers.last_name, phone_number: answers.phone_number, email: answers.email }),
    [answers.pseudo, answers.first_name, answers.last_name, answers.phone_number, answers.email],
  );
  const okProps = (() => {
    switch (screen) {
      case "comment":
        return { label: voteCompleted ? "OK" : "Valider mon vote", loading: submitting };
      case "email":
        return { label: "Envoyer", loading: submitting };
      case "raffle":
        return { label: "OK", loading: submitting };
      default:
        return { label: "OK" };
    }
  })();

  const progress = screen === "welcome" ? 0 : Math.min(1, index / (SCREENS.length - 1));

  if (alreadyVoted) return <AlreadyVoted nextResetAt={alreadyVoted.nextResetAt} onReset={reopenVote} />;
  const blockedDialog = blocked && <BlockedVoteDialog nextResetAt={blocked.nextResetAt} onClose={closeBlocked} onReopen={reopenVote} />;

  return (
    <Toast.Provider swipeDirection="right" duration={6000}>
      {blockedDialog}
      <RaffleDeclineDialog
        open={declineOpen}
        onOpenChange={setDeclineOpen}
        prizes={prizes}
        busy={submitting}
        onConfirm={() => void declineRaffle()}
        onParticipate={() => {
          // « Finalement, je participe » : Oui, puis saisie pseudo → téléphone → email → vérification.
          answer("wants_raffle", true);
          setDeclineOpen(false);
          next();
        }}
      />
      <RaffleConfirmDialog
        open={confirmOpen}
        initial={raffleInitial}
        formatPhone={formatPhoneInput}
        onOpenChange={setConfirmOpen}
        onConfirm={confirmRaffle}
      />
      <div className="relative flex min-h-dvh flex-col">

        {screen !== "welcome" && screen !== "thanks" && (
          <header className="fixed inset-x-0 top-0 z-30">
            <div
              className="h-1.5 w-full bg-edge"
              role="progressbar"
              aria-label="Progression"
              aria-valuemin={0}
              aria-valuemax={STEP_COUNT}
              aria-valuenow={step}
            >
              <motion.div className="h-full bg-brand" animate={{ width: `${progress * 100}%` }} transition={{ duration: 0.4, ease: "easeOut" }} />
            </div>
            <div className="flex justify-end px-4 pt-2 sm:px-8">
              <span className="rounded-full bg-surface/80 px-3 py-1 text-xs font-semibold text-fg-muted shadow-sm backdrop-blur">
                Étape {step}/{STEP_COUNT}
              </span>
            </div>
            <AnimatePresence>
            {showBanner && (
              // Le fond du bandeau remonte jusqu'en haut de l'écran, derrière la barre de progression
              // et l'étape (sans les cacher) ; le texte reste à sa place. Largeur limitée à 700 px,
              // centré (marges sur les côtés sur petit écran). Il part en fondu (15 s ou croix) ;
              // l'en-tête est fixe : le contenu ne bouge pas.
              <motion.div
                key="raffle-banner"
                initial={false}
                exit={{ opacity: 0, transition: { duration: 0.6 } }}
                className="relative mx-3 mt-2 py-2 pb-3.5 pl-4 pr-11 sm:mx-auto sm:max-w-[700px] sm:pl-6"
              >
                <span
                  aria-hidden
                  className="absolute inset-x-0 -top-24 bottom-0 -z-10 rounded-b-2xl border-x border-b border-edge bg-surface/90 shadow-lg shadow-black/20 backdrop-blur"
                />
                <p className="mx-auto flex max-w-[600px] items-start gap-2 text-sm text-fg-muted sm:text-base">
                  <span className="mt-0.5 inline-flex h-5 min-w-5 items-center justify-center rounded bg-brand text-[11px] font-bold text-black">4</span>
                  <span>
                    Merci beaucoup, votre vote a été enregistré ✅ Pour tenter de gagner l&apos;un de nos nombreux lots, continuez ci-dessous.
                  </span>
                </p>
                <button
                  type="button"
                  onClick={closeBanner}
                  aria-label="Fermer le message"
                  className="absolute right-0 top-0.5 flex h-11 w-11 items-center justify-center rounded-full text-fg-muted transition-colors hover:text-fg focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-brand/60"
                >
                  <X className="h-5 w-5" aria-hidden />
                </button>
              </motion.div>
            )}
            </AnimatePresence>
          </header>
        )}

        {/* En démo, marge du bas agrandie : rien ne passe sous le bandeau fixe en fin de défilement. */}
        <main className={`relative z-10 flex flex-1 items-center px-4 py-24 sm:px-6 md:px-8 ${isRaffle ? "pt-36" : screen === "thanks" ? "pt-32 sm:pt-24" : ""} ${demo ? "pb-36" : ""}`}>
          <div className={`mx-auto w-full ${screen === "vote" ? "max-w-[960px]" : screen === "welcome" || screen === "thanks" ? "max-w-3xl" : "max-w-[720px]"}`}>
            <AnimatePresence mode="wait" custom={direction} initial={false}>
              <motion.section
                key={hydrated ? screen : "ssr"}
                custom={direction}
                variants={variants}
                initial="enter"
                animate="center"
                exit="exit"
                transition={{ duration: 0.3, ease: "easeOut" }}
                aria-live="polite"
              >
                {renderScreen()}
                <div className={screen === "vote" ? "sm:pl-8" : "pl-8"}>
                  <FieldError message={error} />
                  {screen !== "welcome" && screen !== "thanks" && <OkButton onClick={validateAndNext} {...okProps} />}
                </div>
              </motion.section>
            </AnimatePresence>
          </div>
        </main>

        {screen !== "welcome" && screen !== "thanks" && (
          <nav
            aria-label="Navigation entre les questions"
            className="fixed bottom-[max(1rem,env(safe-area-inset-bottom))] right-4 z-30 flex items-center gap-2 sm:bottom-6 sm:right-6"
          >
            {/* En démo rien n'est enregistré : pas d'indicateur « Enregistré ». */}
            {!demo && <SaveIndicator status={saveStatus} />}
            <div className="flex overflow-hidden rounded-lg shadow-lg shadow-black/30">
              <button
                type="button"
                onClick={prev}
                disabled={index <= minIndex}
                aria-label="Question précédente"
                className="flex h-11 w-11 items-center justify-center bg-brand text-black transition hover:brightness-95 disabled:opacity-40"
              >
                <ChevronUp className="h-5 w-5" />
              </button>
              <span className="w-px bg-yellow-600/30" />
              <button
                type="button"
                onClick={validateAndNext}
                aria-label="Question suivante"
                className="flex h-11 w-11 items-center justify-center bg-brand text-black transition hover:brightness-95"
              >
                <ChevronDown className="h-5 w-5" />
              </button>
            </div>
          </nav>
        )}

      </div>

      <Toast.Root
        open={toastOpen}
        onOpenChange={setToastOpen}
        className="rounded-xl border border-edge bg-solid p-4 shadow-lg data-[state=open]:animate-pop"
      >
        {/* Hors ligne : souci de réseau ; en ligne : c'est le serveur qui refuse l'enregistrement. */}
        <Toast.Title className="font-semibold text-fg">
          {typeof navigator !== "undefined" && !navigator.onLine ? "Connexion instable" : "Enregistrement momentanément impossible"}
        </Toast.Title>
        <Toast.Description className="mt-1 text-sm text-fg-muted">
          Vos réponses sont conservées et seront renvoyées automatiquement.
        </Toast.Description>
        <Toast.Action altText="Réessayer maintenant" asChild>
          <button type="button" onClick={() => void flush()} className="mt-3 rounded-full bg-brand px-4 py-1.5 text-sm font-bold text-black">
            Réessayer
          </button>
        </Toast.Action>
      </Toast.Root>
      <Toast.Viewport className="fixed bottom-20 right-4 z-50 flex w-[calc(100vw-2rem)] max-w-sm flex-col gap-2 outline-none" />
    </Toast.Provider>
  );
}

function SaveIndicator({ status }: { status: "idle" | "saving" | "error" }) {
  const content = {
    idle: { icon: <CloudCheck className="h-4 w-4 text-success" aria-hidden />, text: "Enregistré" },
    saving: { icon: <Loader2 className="h-4 w-4 animate-spin" aria-hidden />, text: "Enregistrement…" },
    error: { icon: <CloudOff className="h-4 w-4 text-error" aria-hidden />, text: "Nouvel essai…" },
  }[status];
  return (
    <span role="status" className="hidden items-center gap-1.5 rounded-full bg-brand px-3 py-2 text-xs font-semibold text-black shadow-sm sm:inline-flex">
      {content.icon}
      {content.text}
    </span>
  );
}
