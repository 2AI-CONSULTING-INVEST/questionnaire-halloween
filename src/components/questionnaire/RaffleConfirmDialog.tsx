"use client";

import { Loader2 } from "lucide-react";
import Image from "next/image";
import { Dialog } from "radix-ui";
import { useId, useState } from "react";
import { Lantern } from "@/components/ui/Lantern";
import { withBase } from "@/lib/base-path";
import { emailSchema, NAME_MAX, normalizeFrPhone, PSEUDO_MAX, pseudoSchema } from "@/lib/schema";

export type RaffleValues = { pseudo: string; first_name: string; last_name: string; phone_number: string; email: string };
export type RaffleField = keyof RaffleValues;
export type RaffleErrors = Partial<Record<RaffleField, string>>;

/** Validation locale (même règles que le serveur) ; message par champ invalide. */
export function validateRaffle(v: RaffleValues): RaffleErrors {
  const errors: RaffleErrors = {};
  const p = pseudoSchema.safeParse(v.pseudo);
  if (!p.success) errors.pseudo = p.error.issues[0]?.message ?? "Pseudonyme invalide";
  if (!normalizeFrPhone(v.phone_number)) errors.phone_number = "Numéro de téléphone français invalide (ex. 07 13 55 44 67)";
  if (!emailSchema.safeParse(v.email).success) errors.email = "Adresse email invalide";
  return errors;
}

const FIELDS: { key: RaffleField; label: string; type: string; autoComplete: string; inputMode?: "tel" | "email"; maxLength: number; placeholder: string; half?: true }[] = [
  { key: "pseudo", label: "Pseudonyme (affiché publiquement)", type: "text", autoComplete: "nickname", maxLength: PSEUDO_MAX, placeholder: "Votre pseudonyme" },
  { key: "first_name", label: "Prénom (facultatif)", type: "text", autoComplete: "given-name", maxLength: NAME_MAX, placeholder: "Prénom", half: true },
  { key: "last_name", label: "Nom (facultatif)", type: "text", autoComplete: "family-name", maxLength: NAME_MAX, placeholder: "Nom", half: true },
  { key: "phone_number", label: "Numéro de téléphone", type: "tel", autoComplete: "tel-national", inputMode: "tel", maxLength: 20, placeholder: "07 13 55 44 67" },
  { key: "email", label: "Adresse email", type: "email", autoComplete: "email", inputMode: "email", maxLength: 255, placeholder: "votreemail@gmail.com" },
];

/**
 * Modale de vérification avant l'inscription au tirage au sort : les trois coordonnées restent
 * modifiables, validées en direct ; les refus du serveur (pseudo / email / téléphone déjà
 * inscrits) s'affichent sous le champ concerné sans fermer la modale.
 *
 * Décor (rendus KayKit en PNG, scripts/3d/raffle-props et modal-props) : le poteau-lanterne de la
 * modale du classement, derrière le bord droit du panneau, sa lanterne pendue au-dessus du coin
 * haut-droit ; une petite motte (pierre tombale, main squelette qui sort de la terre) sous le
 * panneau ; une toile d'araignée dans le coin haut-gauche ; dans l'avertissement, un squelette
 * paniqué devant un panneau « attention ». Rien ne recouvre champs ni boutons : le décor reste
 * au-dessus, en dessous ou derrière le panneau.
 */
type FormProps = {
  initial: RaffleValues;
  formatPhone: (v: string) => string;
  /** Envoie ; renvoie les erreurs par champ (vide = succès, la modale se ferme). */
  onConfirm: (values: RaffleValues) => Promise<RaffleErrors & { form?: string }>;
  onBusy: (busy: boolean) => void;
};

export function RaffleConfirmDialog({
  open,
  onOpenChange,
  ...form
}: Omit<FormProps, "onBusy"> & { open: boolean; onOpenChange: (open: boolean) => void }) {
  const [busy, setBusy] = useState(false);
  return (
    <Dialog.Root open={open} onOpenChange={(o) => !busy && onOpenChange(o)}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm data-[state=open]:animate-[fade-in_200ms_ease-out]" />
        <Dialog.Content className="fixed left-1/2 top-1/2 z-50 w-[calc(100vw-2rem)] max-w-md -translate-x-1/2 -translate-y-1/2 outline-none data-[state=open]:animate-pop">
          <LanternPost />
          <div className="relative flex max-h-[calc(100dvh-2rem)] flex-col overflow-hidden rounded-3xl border border-edge bg-solid shadow-2xl shadow-black/60">
            <Cobweb />
            {/* Démonté à la fermeture : chaque ouverture repart des valeurs saisies, sans erreur affichée. */}
            {open && <RaffleForm {...form} onBusy={setBusy} />}
          </div>
          {/* La lanterne passe devant le panneau, son poteau reste derrière. */}
          <LanternPost lampOnly />
          {/* Motte : sous le panneau (elle n'en mord que la marge du bas, 8 px), à droite ; sur grand
              écran, centrée sous le mât, dont elle cache le pied (le poteau y est planté). */}
          <Image
            src={withBase("/decor/raffle-mound.png")}
            alt=""
            width={1212}
            height={657}
            unoptimized
            aria-hidden
            className="pointer-events-none absolute right-2 top-full -mt-2 w-[180px] max-w-none select-none drop-shadow-[0_8px_16px_rgba(0,0,0,0.55)] md:-right-[130px] md:w-[300px]"
          />
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

/** Toile d'araignée dans le coin haut-gauche du panneau (traits fins, discrète). Reprise par la modale des lots. */
export function Cobweb({ className = "left-0 top-0 h-[68px] w-[68px] sm:h-20 sm:w-20" }: { className?: string }) {
  const radii = [14, 28, 44, 62];
  const angles = [0, 18, 36, 54, 72, 90];
  return (
    <svg aria-hidden viewBox="0 0 70 70" className={`pointer-events-none absolute text-fg/35 ${className}`}>
      <g fill="none" stroke="currentColor" strokeWidth="0.8" strokeLinecap="round">
        {angles.map((a) => {
          const r = (a * Math.PI) / 180;
          return <line key={a} x1="0" y1="0" x2={Math.cos(r) * 68} y2={Math.sin(r) * 68} />;
        })}
        {radii.map((rad) =>
          angles.slice(0, -1).map((a, i) => {
            const a1 = (a * Math.PI) / 180;
            const a2 = (angles[i + 1] * Math.PI) / 180;
            const sag = rad * 0.88;
            const mx = Math.cos((a1 + a2) / 2) * sag;
            const my = Math.sin((a1 + a2) / 2) * sag;
            return <path key={`${rad}-${a}`} d={`M${Math.cos(a1) * rad} ${Math.sin(a1) * rad} Q${mx} ${my} ${Math.cos(a2) * rad} ${Math.sin(a2) * rad}`} />;
          }),
        )}
      </g>
    </svg>
  );
}

/**
 * Poteau-lanterne KayKit (modal-post.png, lanterne à part qui se balance : voir Lantern), derrière
 * le panneau ; la lanterne pend au-dessus du coin haut-droit (elle ne mord que la marge du haut).
 * Le cadre de la lanterne est à 2,6 %–20,2 % de la hauteur de l'image, le mât à 83 % de sa largeur.
 * - Téléphone : hauteur fixe (460 px, lanterne d'environ 45 px de large), mât caché derrière le
 *   bord droit ; le pied finit derrière le panneau.
 * - Grand écran (md) : du dessus du panneau jusque dans la motte (142 px au-dessus, 95 px
 *   dessous), mât à 39 px à droite du panneau.
 */
/** Position par défaut : à droite du panneau (modale des coordonnées). */
const LANTERN_POST_RIGHT =
  "-top-[86px] right-0 h-[460px] translate-x-[calc(17%-12px)] md:-bottom-[95px] md:-top-[142px] md:h-auto md:translate-x-[calc(17%+39px)]";

export function LanternPost({ lampOnly = false, className = LANTERN_POST_RIGHT }: { lampOnly?: boolean; className?: string }) {
  return (
    <div aria-hidden className={`pointer-events-none absolute ${className}`}>
      {/* Rendu deux fois au même endroit : le poteau avant le panneau (derrière), la lanterne après
          (devant). Dans la seconde copie, le poteau invisible donne seulement ses dimensions. */}
      <Image
        src={withBase("/decor/modal-post.png")}
        alt=""
        unoptimized
        width={695}
        height={3581}
        className={`h-full w-auto max-w-none select-none drop-shadow-[0_8px_18px_rgba(0,0,0,0.55)] ${lampOnly ? "invisible" : ""}`}
      />
      {lampOnly && <Lantern />}
    </div>
  );
}

function RaffleForm({ initial, formatPhone, onConfirm, onBusy }: FormProps) {
  const id = useId();
  const [values, setValues] = useState(initial);
  const [touched, setTouched] = useState<Partial<Record<RaffleField, boolean>>>({});
  const [serverErrors, setServerErrors] = useState<RaffleErrors & { form?: string }>({});
  const [busy, setBusyState] = useState(false);
  const setBusy = (b: boolean) => {
    setBusyState(b);
    onBusy(b);
  };

  const local = validateRaffle(values);
  const errorOf = (k: RaffleField) => serverErrors[k] ?? (touched[k] ? local[k] : undefined);
  const valid = Object.keys(local).length === 0;

  const change = (k: RaffleField, v: string) => {
    setValues((s) => ({ ...s, [k]: k === "phone_number" ? formatPhone(v) : v }));
    setServerErrors((e) => (e[k] || e.form ? { ...e, [k]: undefined, form: undefined } : e));
  };

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (busy) return;
    setTouched({ pseudo: true, phone_number: true, email: true });
    if (!valid) return;
    setBusy(true);
    try {
      const errors = await onConfirm({
        pseudo: values.pseudo.trim(),
        first_name: values.first_name.trim(),
        last_name: values.last_name.trim(),
        phone_number: values.phone_number,
        email: values.email.trim(),
      });
      if (Object.keys(errors).length) setServerErrors(errors);
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} noValidate className="flex min-h-0 flex-col">
      <div className="min-h-0 overflow-y-auto px-5 pt-5 sm:px-6 sm:pt-6">
        {/* Même police et même graisse que les titres des questions (QuestionHeader). */}
        <Dialog.Title className="relative text-xl leading-snug text-fg sm:text-2xl">Vérifiez vos coordonnées</Dialog.Title>
        <Dialog.Description asChild>
          <div className="relative mt-4 flex items-end gap-1.5 rounded-2xl bg-accent-soft py-3 pl-3.5 pr-1.5 text-[13px] leading-snug text-fg sm:gap-2 sm:text-sm">
            <p className="min-w-0 flex-1 self-center">
              {/* Espaces insécables avant « : » (typographie française : jamais de « : » en début de ligne). */}
              <strong>Attention&nbsp;:</strong> le tirage au sort sera effectué à partir de ce numéro de téléphone et de cette adresse email.
              Vérifiez qu&apos;ils sont exacts&nbsp;: c&apos;est par ce biais que nous contacterons le gagnant.
            </p>
            {/* Squelette paniqué devant un panneau « attention » (rendu KayKit). */}
            <Image
              src={withBase("/decor/raffle-inspector.png")}
              alt=""
              width={860}
              height={852}
              unoptimized
              aria-hidden
              className="-mb-3 -mt-6 h-[96px] w-auto shrink-0 select-none drop-shadow-[0_6px_10px_rgba(0,0,0,0.4)] sm:-mt-7 sm:h-[116px]"
            />
          </div>
        </Dialog.Description>

        <p className="mt-3 text-xs text-fg-muted">
          Ces coordonnées servent uniquement au tirage au sort et ne sont jamais publiées. En confirmant votre participation, vous acceptez nos{" "}
          <a href={withBase("/conditions")} target="_blank" rel="noopener" className="underline underline-offset-2 hover:text-fg">
            conditions d&apos;utilisation
          </a>{" "}
          et notre{" "}
          <a href={withBase("/confidentialite")} target="_blank" rel="noopener" className="underline underline-offset-2 hover:text-fg">
            politique de confidentialité
          </a>
          .
        </p>
        <div className="mt-4 grid grid-cols-2 gap-3.5">
          {FIELDS.map((f) => {
            const err = errorOf(f.key);
            return (
              <div key={f.key} className={`flex flex-col gap-1 ${f.half ? "" : "col-span-2"}`}>
                <label htmlFor={`${id}-${f.key}`} className="text-xs font-semibold uppercase tracking-wide text-fg-muted">
                  {f.label}
                </label>
                <input
                  id={`${id}-${f.key}`}
                  type={f.type}
                  inputMode={f.inputMode}
                  autoComplete={f.autoComplete}
                  maxLength={f.maxLength}
                  placeholder={f.placeholder}
                  value={values[f.key]}
                  onChange={(e) => change(f.key, e.target.value)}
                  onBlur={() => setTouched((t) => ({ ...t, [f.key]: true }))}
                  aria-invalid={!!err}
                  aria-describedby={err ? `${id}-${f.key}-error` : undefined}
                  className={`min-h-11 w-full rounded-xl border bg-surface px-3.5 text-base text-fg outline-none transition-colors placeholder:text-placeholder focus:border-brand focus:ring-2 focus:ring-brand/40 ${
                    err ? "border-danger-fg" : "border-edge-strong"
                  }`}
                />
                {err && (
                  <p id={`${id}-${f.key}-error`} role="alert" className="flex items-center gap-1.5 text-sm font-medium text-danger-fg">
                    <span aria-hidden>⚠️</span> {err}
                  </p>
                )}
              </div>
            );
          })}
          {serverErrors.form && (
            <p role="alert" className="col-span-2 rounded-md bg-danger-bg px-3 py-1.5 text-sm font-medium text-danger-fg">
              {serverErrors.form}
            </p>
          )}
        </div>
      </div>
      <div className="flex flex-col-reverse gap-2 px-5 pb-5 pt-4 sm:flex-row sm:justify-end sm:px-6 sm:pb-6">
        <Dialog.Close asChild>
          <button
            type="button"
            disabled={busy}
            className="inline-flex min-h-11 items-center justify-center rounded-full border border-edge-strong px-5 text-base font-semibold text-fg transition-colors hover:bg-surface-2 disabled:opacity-60"
          >
            Retour
          </button>
        </Dialog.Close>
        <button
          type="submit"
          disabled={busy}
          className="inline-flex min-h-11 items-center justify-center gap-2 rounded-full bg-brand px-5 text-base font-bold text-black shadow-[0_0_24px_rgba(250,204,21,0.25)] transition-[filter] hover:brightness-105 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {busy && <Loader2 className="h-4 w-4 animate-spin" aria-hidden />}
          Confirmer ma participation
        </button>
      </div>
    </form>
  );
}
