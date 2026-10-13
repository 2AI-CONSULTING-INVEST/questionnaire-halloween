"use client";

import Link from "next/link";
import { AnimatePresence, motion } from "framer-motion";
import { BarChart3, ChevronDown, ChevronUp, Clock, CloudOff, Loader2, CloudCheck } from "lucide-react";
import { RadioGroup, Toast, ToggleGroup } from "radix-ui";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  commentSchema,
  COMMENT_MAX,
  emailSchema,
  groupDecorations,
  nameSchema,
  normalizeFrPhone,
  RAFFLE_FIELDS,
  type Decoration,
  type Impact,
  type VisitPeriod,
} from "@/lib/schema";
import { SpookyBackdrop, triggerSwarm } from "../scene/SpookyBackdrop";
import { Confetti } from "./Confetti";
import { DecorationGallery, LETTERS } from "./DecorationGallery";
import { RestaurantCombobox } from "./RestaurantCombobox";
import { createSession, discard, flush, initSaver, onSaveStatus, save } from "./saver";
import { SCREENS, STEP_COUNT, STEP_OF, useQuestionnaire, type Answers, type Screen } from "./store";
import { ChoicePill, Emoji, FieldError, KeyBadge, OkButton, pillClass, QuestionHeader, type EmojiName } from "./ui";
import { ShareButtons } from "./ShareButtons";

const PERIOD_OPTIONS: { value: VisitPeriod; label: string; emoji: EmojiName }[] = [
  { value: "lundi-jeudi", label: "Lundi - Jeudi", emoji: "calendar" },
  { value: "vendredi-samedi", label: "Vendredi - Samedi", emoji: "moon" },
  { value: "dimanche", label: "Dimanche", emoji: "sun" },
];
const IMPACT_OPTIONS: { value: Impact; label: string; emoji: EmojiName }[] = [
  { value: "beaucoup", label: "Beaucoup - Cela m'a vraiment marqué !", emoji: "fire" },
  { value: "un_peu", label: "Un peu - C'était sympa", emoji: "thumbsup" },
  { value: "pas_du_tout", label: "Pas du tout - Neutre pour moi", emoji: "neutral" },
];

const VOTE_FIELDS = ["selected_restaurant", "visit_period", "selected_decoration_id", "decoration_impact", "comment"];

/** Champ en erreur renvoyé par l'API → écran à réafficher. */
const SCREEN_OF_FIELD: Partial<Record<string, Screen>> = {
  selected_restaurant: "restaurant",
  visit_period: "period",
  selected_decoration_id: "vote",
  decoration_impact: "impact",
  comment: "comment",
  participant_name: "name",
  phone_number: "phone",
  email: "email",
};

const inputClass =
  "w-full border-b-2 border-edge-strong bg-transparent pb-2 text-xl text-fg outline-none transition-colors placeholder:text-placeholder focus:border-brand sm:text-[1.75rem]";

/** Formate la saisie : « 0713554467 » → « 07 13 55 44 67 », « +33713554467 » → « +33 7 13 55 44 67 ». */
function formatPhoneInput(v: string) {
  const t = v.trim();
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
};

export function Questionnaire({ restaurants, decorations, social, videoUrl }: Props) {
  const { sessionId, index, direction, answers, voteCompleted, start, setAnswer, go, markVoteCompleted, markRaffleDone } =
    useQuestionnaire();
  const groups = useMemo(() => groupDecorations(decorations), [decorations]);
  const [hydrated, setHydrated] = useState(false);
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
  const minIndex = voteCompleted ? SCREENS.indexOf("raffle") : 1;

  // Restauration de la session (localStorage) après le premier rendu.
  useEffect(() => {
    void Promise.resolve(useQuestionnaire.persist.rehydrate()).then(() => {
      const s = useQuestionnaire.getState();
      if (s.sessionId) initSaver(s.sessionId);
      if (s.raffleDone) s.go(SCREENS.indexOf("thanks"));
      else if (s.voteCompleted && s.index < SCREENS.indexOf("raffle")) s.go(SCREENS.indexOf("raffle"));
      // Média supprimé entre-temps : on efface le choix.
      if (s.answers.selected_decoration_id && !decorations.some((d) => d.id === s.answers.selected_decoration_id)) {
        s.setAnswer("selected_decoration_id", null);
      }
      setHydrated(true);
    });
  }, [decorations]);

  useEffect(
    () =>
      onSaveStatus((st) => {
        setSaveStatus(st);
        if (st === "error") setToastOpen(true);
      }),
    [],
  );

  useEffect(() => () => clearTimeout(advanceTimer.current), [index]);

  /** Mise à jour locale immédiate + enregistrement en base (debounce pour les champs texte). */
  const answer = useCallback(
    <K extends keyof Answers>(key: K, value: Answers[K], dbValue: unknown = value, debounceMs = 0) => {
      setAnswer(key, value);
      setError(null);
      if (dbValue !== undefined) save({ [key]: dbValue }, debounceMs);
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
      void createSession(id);
      triggerSwarm(18);
    }
  }, [start]);

  // ----- Soumissions -------------------------------------------------------

  const showServerError = useCallback(
    (body: { error?: string; details?: Record<string, string[]> }) => {
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
      const res = await fetch(`/api/responses/${sessionId}/complete`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          selected_restaurant: a.selected_restaurant,
          visit_period: a.visit_period,
          selected_decoration_id: a.selected_decoration_id,
          decoration_impact: a.decoration_impact,
          comment: a.comment.trim() || null,
        }),
      });
      if (res.ok) {
        discard(VOTE_FIELDS);
        markVoteCompleted();
        go(SCREENS.indexOf("raffle"));
        triggerSwarm();
        return;
      }
      showServerError(await res.json().catch(() => ({})));
    } catch {
      setError("Connexion perdue. Vérifiez votre réseau puis réessayez.");
    } finally {
      setSubmitting(false);
    }
  }, [sessionId, voteCompleted, next, markVoteCompleted, go, setError, showServerError]);

  const submitRaffle = useCallback(
    async (wants: boolean) => {
      if (!sessionId) return;
      setSubmitting(true);
      try {
        const a = useQuestionnaire.getState().answers;
        const res = await fetch(`/api/responses/${sessionId}/raffle`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(
            wants
              ? { wants_raffle: true, participant_name: a.participant_name.trim(), phone_number: a.phone_number, email: a.email.trim() }
              : { wants_raffle: false },
          ),
        });
        if (res.ok) {
          discard([...RAFFLE_FIELDS]);
          markRaffleDone();
          go(SCREENS.indexOf("thanks"));
          return;
        }
        showServerError(await res.json().catch(() => ({})));
      } catch {
        setError("Connexion perdue. Vérifiez votre réseau puis réessayez.");
      } finally {
        setSubmitting(false);
      }
    },
    [sessionId, markRaffleDone, go, setError, showServerError],
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
      case "period":
        return next();
      case "vote":
        if (groups.length === 0) return fail("Aucune décoration n'est encore disponible");
        return a.selected_decoration_id ? next() : fail("Veuillez choisir une décoration");
      case "impact":
        return a.decoration_impact ? next() : fail("Veuillez sélectionner une option");
      case "comment": {
        const r = commentSchema.safeParse(a.comment);
        if (!r.success) return fail(r.error.issues[0]?.message ?? "Commentaire invalide");
        void flush();
        return void submitVote();
      }
      case "raffle":
        if (a.wants_raffle === null) return fail("Veuillez répondre Oui ou Non");
        return a.wants_raffle ? next() : void submitRaffle(false);
      case "name": {
        const r = nameSchema.safeParse(a.participant_name);
        return r.success ? next() : fail(r.error.issues[0]?.message ?? "Nom invalide");
      }
      case "phone":
        return normalizeFrPhone(a.phone_number) ? next() : fail("Numéro de téléphone français invalide (ex. 07 13 55 44 67)");
      case "email": {
        const r = emailSchema.safeParse(a.email);
        return r.success ? void submitRaffle(true) : fail("Adresse email invalide");
      }
    }
  }, [answers, screen, begin, next, groups.length, submitVote, submitRaffle, setError]);

  // ----- Clavier (comme Typeform) ------------------------------------------

  const choiceKeys = useMemo((): Record<string, () => void> => {
    const map: Record<string, () => void> = {};
    if (screen === "period")
      PERIOD_OPTIONS.forEach((o, i) => (map[LETTERS[i]] = () => (answer("visit_period", o.value), autoAdvance())));
    if (screen === "vote") groups.forEach((g, i) => (map[LETTERS[i]] = () => answer("selected_decoration_id", g.id)));
    if (screen === "impact")
      IMPACT_OPTIONS.forEach((o, i) => (map[LETTERS[i]] = () => (answer("decoration_impact", o.value), autoAdvance())));
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
            <button
              type="button"
              onClick={begin}
              className="mt-10 min-h-12 rounded-full bg-brand px-7 text-xl font-bold text-black shadow-[0_0_30px_rgba(250,204,21,0.35)] transition-[filter,box-shadow] hover:brightness-105 hover:shadow-[0_0_44px_rgba(250,204,21,0.5)] active:brightness-95"
            >
              {sessionId && index === 0 ? "Reprendre le vote" : "Commencer le vote"}
            </button>
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

      case "period":
        return (
          <>
            <QuestionHeader id={qid} number="2" title="Quand avez-vous visité ce restaurant ?" description="Optionnel" />
            <RadioGroup.Root
              aria-labelledby={qid}
              value={answers.visit_period ?? ""}
              onValueChange={(v) => {
                answer("visit_period", v as VisitPeriod);
                autoAdvance();
              }}
              className="flex flex-col gap-3 pl-8 sm:w-fit"
            >
              {PERIOD_OPTIONS.map((o, i) => (
                <ChoicePill key={o.value} value={o.value} letter={LETTERS[i]} emoji={o.emoji} label={o.label} selected={answers.visit_period === o.value} />
              ))}
            </RadioGroup.Root>
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
              number="3"
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

      case "impact":
        return (
          <>
            <QuestionHeader id={qid} number="4" title="La décoration Halloween a-t-elle influencé votre expérience ?" required />
            <RadioGroup.Root
              aria-labelledby={qid}
              aria-required
              value={answers.decoration_impact ?? ""}
              onValueChange={(v) => {
                answer("decoration_impact", v as Impact);
                autoAdvance();
              }}
              className="flex flex-col gap-3 pl-8 sm:w-fit"
            >
              {IMPACT_OPTIONS.map((o, i) => (
                <ChoicePill key={o.value} value={o.value} letter={LETTERS[i]} emoji={o.emoji} label={o.label} selected={answers.decoration_impact === o.value} />
              ))}
            </RadioGroup.Root>
          </>
        );

      case "comment":
        return (
          <>
            <QuestionHeader
              id={qid}
              number="5"
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
          </>
        );

      case "name":
        return (
          <>
            <QuestionHeader id={qid} number="b" title="Nom et prénom du participant" required description="Ou pseudonyme si vous préférez" />
            <div className="pl-8">
              <input
                aria-labelledby={qid}
                autoFocus
                autoComplete="name"
                maxLength={50}
                value={answers.participant_name}
                placeholder="Tapez votre réponse ici..."
                onChange={(e) => {
                  const v = e.target.value;
                  answer("participant_name", v, nameSchema.safeParse(v).success ? v.trim() : undefined, 1000);
                }}
                onBlur={() => void flush()}
                className={inputClass}
              />
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
                onChange={(e) => {
                  const v = formatPhoneInput(e.target.value);
                  answer("phone_number", v, normalizeFrPhone(v) ?? undefined, 1000);
                }}
                onBlur={() => void flush()}
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
                onChange={(e) => {
                  const v = e.target.value;
                  answer("email", v, emailSchema.safeParse(v).success ? v.trim().toLowerCase() : undefined, 1000);
                }}
                onBlur={() => void flush()}
                className={inputClass}
              />
            </div>
          </>
        );

      case "thanks":
        return (
          <div className="mx-auto max-w-3xl text-center">
            <Confetti />
            <h1 className="text-4xl leading-[1.15] tracking-tight text-fg [text-shadow:0_2px_24px_rgba(0,0,0,0.45)] sm:text-6xl day:[text-shadow:none]">
              <Emoji name="party" size={64} className="mr-3 h-[1em] w-[1em]" />
              Merci pour votre vote ! Votre avis compte pour Chamas Tacos !
              <Emoji name="ghost" size={64} className="ml-3 h-[1em] w-[1em]" />
            </h1>
            <p className="mt-6 text-lg text-fg-muted sm:text-xl">
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
            <div className="mt-10 flex flex-col items-center gap-6">
              <Link
                href="/resultats"
                className="inline-flex min-h-12 items-center gap-2 rounded-full bg-brand px-7 text-lg font-bold text-black shadow-[0_0_30px_rgba(250,204,21,0.3)] transition-[filter] hover:brightness-105"
              >
                <BarChart3 className="h-5 w-5" aria-hidden /> Voir les résultats en direct
              </Link>
              <ShareButtons />
            </div>
          </div>
        );
    }
  }

  const isRaffle = screen === "raffle" || screen === "name" || screen === "phone" || screen === "email";
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

  return (
    <Toast.Provider swipeDirection="right" duration={6000}>
      <div className="relative flex min-h-dvh flex-col">
        <SpookyBackdrop />

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
            {isRaffle && (
              <div className="mt-2 border-y border-edge bg-surface/90 px-4 py-2 backdrop-blur sm:px-8">
                <p className="mx-auto flex max-w-[600px] items-start gap-2 text-sm text-fg-muted sm:text-base">
                  <span className="mt-0.5 inline-flex h-5 min-w-5 items-center justify-center rounded bg-brand text-[11px] font-bold text-black">6</span>
                  <span>
                    Merci beaucoup, votre vote a été enregistré ✅ Pour tenter de gagner l&apos;un de nos nombreux lots, continuez ci-dessous.
                  </span>
                </p>
              </div>
            )}
          </header>
        )}

        <main className={`relative z-10 flex flex-1 items-center px-4 py-24 sm:px-6 md:px-8 ${isRaffle ? "pt-36" : ""}`}>
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
            <SaveIndicator status={saveStatus} />
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
        <Toast.Title className="font-semibold text-fg">Connexion instable</Toast.Title>
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
