import "server-only";
import Papa from "papaparse";
import * as XLSX from "xlsx";
import { flagLabel } from "./risk";
import { formatFrPhone, type Decoration, type Participant, type Prize, type ResponseRow } from "./schema";

type Row = Record<string, string | number>;

/** Empêche l'injection de formules quand le fichier est ouvert dans Excel. */
function safe(v: string | null | undefined): string {
  if (!v) return "";
  return /^[=+\-@\t\r]/.test(v) ? `'${v}` : v;
}

const date = (iso: string | null) => (iso ? new Date(iso).toLocaleString("fr-FR", { timeZone: "Europe/Paris" }) : "");

export function allResponsesRows(rows: ResponseRow[], decorations: Decoration[], participants: Participant[] = []): Row[] {
  const decoName = new Map(decorations.map((d) => [d.id, d.restaurant_name]));
  const pseudo = new Map(participants.map((p) => [p.id, p.pseudo]));
  return rows.map((r) => ({
    "ID": r.id,
    "Statut": r.completed_at ? "Vote validé" : r.blocked_at ? "Bloqué" : "Incomplet",
    "Q1 - Chamas Tacos préféré": safe(r.selected_restaurant),
    "Q2 - Meilleure décoration": safe(r.selected_decoration_id ? decoName.get(r.selected_decoration_id) ?? "(supprimée)" : ""),
    "Q3 - Commentaire": safe(r.comment),
    "Q4 - Tirage au sort": r.wants_raffle == null ? "" : r.wants_raffle ? "Oui" : "Non",
    "Participant (pseudo)": safe(r.participant_id ? pseudo.get(r.participant_id) ?? "(supprimé)" : ""),
    "Jour du vote": r.vote_day ?? "",
    "Créé le": date(r.created_at),
    "Validé le": date(r.completed_at),
    "Adresse IP": r.ip_address ?? "",
    "Navigateur": safe(r.user_agent),
    "Score de risque": r.risk_score ?? 0,
    "Signaux": safe((r.risk_flags ?? []).map(flagLabel).join(" ; ")),
    "Bloqué": r.blocked_at ? "Oui" : "",
    "Exclu": r.excluded_at ? "Oui" : "",
  }));
}

/** Participants au tirage : une ligne par personne, avec le nombre de votes reliés et le lot gagné. */
export function participantsRows(participants: Participant[], responses: ResponseRow[], prizes: Prize[]): Row[] {
  const votes = new Map<string, number>();
  for (const r of responses) if (r.completed_at && r.participant_id) votes.set(r.participant_id, (votes.get(r.participant_id) ?? 0) + 1);
  const won = new Map(prizes.filter((p) => p.winner_participant_id).map((p) => [p.winner_participant_id!, p.name]));
  return participants.map((p) => ({
    "Pseudo": safe(p.pseudo),
    "Prénom": safe(p.first_name ?? ""),
    "Nom": safe(p.last_name ?? ""),
    "Email": safe(p.email),
    "Téléphone": formatFrPhone(p.phone_number),
    "Date inscription": date(p.created_at),
    "Votes": votes.get(p.id) ?? 0,
    "Lot gagné": safe(won.get(p.id)),
    "Supprimé le": date(p.deleted_at ?? null),
  }));
}

export function toCsv(rows: Row[]): string {
  // BOM UTF-8 pour qu'Excel affiche correctement les accents ; « ; » = séparateur Excel FR.
  return "﻿" + Papa.unparse(rows, { delimiter: ";" });
}

export function toXlsx(rows: Row[], sheet: string): Buffer {
  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.json_to_sheet(rows);
  const keys = Object.keys(rows[0] ?? {});
  ws["!cols"] = keys.map((k) => ({
    wch: Math.min(60, Math.max(k.length, ...rows.map((r) => String(r[k] ?? "").length)) + 2),
  }));
  XLSX.utils.book_append_sheet(wb, ws, sheet);
  return XLSX.write(wb, { type: "buffer", bookType: "xlsx" }) as Buffer;
}
