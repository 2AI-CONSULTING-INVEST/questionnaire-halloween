/**
 * Podium de fin de concours (panneau du mur de la crypte) : règles pures, sans three.js, testées
 * (tests/unit/podium.test.ts). Les trois premiers restaurants ayant des votes : la 1re place au
 * centre (marche la plus haute), la 2e à gauche, la 3e à droite. Rang « sportif » : les ex æquo
 * partagent le même rang (et la même couronne).
 */

export type PodiumEntry = { id: string; restaurant_name: string; image_url: string; votes: number; share: number };

export type PodiumSlot = {
  entry: PodiumEntry;
  /** Rang sportif (1, 2 ou 3 ; ex æquo possibles). */
  rank: 1 | 2 | 3;
  /** Place sur le podium (1 = centre, 2 = gauche, 3 = droite). */
  place: 1 | 2 | 3;
};

export function podiumSlots(results: readonly PodiumEntry[]): PodiumSlot[] {
  const voted = results.filter((r) => r.votes > 0).sort((a, b) => b.votes - a.votes);
  return voted.slice(0, 3).map((entry, i) => ({
    entry,
    rank: (1 + voted.filter((o) => o.votes > entry.votes).length) as 1 | 2 | 3,
    place: (i + 1) as 1 | 2 | 3,
  }));
}

/** Ordre de la cérémonie : 3e, puis 2e, puis le gagnant. */
export const REVEAL_ORDER = [3, 2, 1] as const;

/** Rectangle en fractions du panneau (x : largeur, y : hauteur, origine en haut à gauche). */
export type Box = { x: number; y: number; w: number; h: number };
export type SlotBox = {
  place: 1 | 2 | 3;
  /** Carte (photo, nom, votes) : zone cliquable. */
  card: Box;
  photo: Box;
  /** Marche du podium, sous la carte. */
  step: Box;
  /** Pied de la couronne (centre), juste au-dessus de la carte. */
  crown: { x: number; y: number };
};

/** Hauteur des marches (fraction de la hauteur du panneau) par place. */
const STEP_H = { 1: 0.17, 2: 0.115, 3: 0.075 } as const;
const COLUMN_OF = { 2: 0, 1: 1, 3: 2 } as const;

/**
 * Disposition du podium pour un panneau de rapport hauteur / largeur `aspect`.
 * Carte : photo 3:4, puis deux lignes de nom et une ligne de votes.
 */
export function podiumLayout(aspect: number): SlotBox[] {
  const pad = 0.06;
  const gap = 0.035;
  const cw = (1 - pad * 2 - gap * 2) / 3;
  const bottom = 0.955;
  const photoW = cw * 0.86;
  const photoH = (photoW * 4) / 3 / aspect;
  const textH = 0.105;
  const inset = 0.012;
  const cardH = inset + photoH + textH;
  return ([1, 2, 3] as const).map((place) => {
    const x = pad + COLUMN_OF[place] * (cw + gap);
    const stepTop = bottom - STEP_H[place];
    const cardY = stepTop - 0.012 - cardH;
    return {
      place,
      card: { x, y: cardY, w: cw, h: cardH },
      photo: { x: x + (cw - photoW) / 2, y: cardY + inset, w: photoW, h: photoH },
      step: { x: x - gap * 0.25, y: stepTop, w: cw + gap * 0.5, h: bottom - stepTop },
      crown: { x: x + cw / 2, y: cardY - 0.004 },
    };
  });
}

const inside = (b: Box, fx: number, fy: number) => fx >= b.x && fx <= b.x + b.w && fy >= b.y && fy <= b.y + b.h;

/** Place visée (carte ou marche) au point (fx, fy) du panneau, ou null. */
export function slotAt(boxes: readonly SlotBox[], fx: number, fy: number): 1 | 2 | 3 | null {
  for (const b of boxes) if (inside(b.card, fx, fy) || inside(b.step, fx, fy)) return b.place;
  return null;
}

export const placeLabel = (rank: number) => (rank === 1 ? "1re place" : `${rank}e place`);
