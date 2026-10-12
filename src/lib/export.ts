import "server-only";
import Papa from "papaparse";
import * as XLSX from "xlsx";
import { formatFrPhone, isRaffleEntry, LABELS, type Decoration, type ResponseRow } from "./schema";

type Row = Record<string, string | number>;

/** Empêche l'injection de formules quand le fichier est ouvert dans Excel. */
function safe(v: string | null | undefined): string {
  if (!v) return "";
  return /^[=+\-@\t\r]/.test(v) ? `'${v}` : v;
}

const date = (iso: string | null) => (iso ? new Date(iso).toLocaleString("fr-FR", { timeZone: "Europe/Paris" }) : "");

export function allResponsesRows(rows: ResponseRow[], decorations: Decoration[]): Row[] {
  const decoName = new Map(decorations.map((d) => [d.id, d.restaurant_name]));
  return rows.map((r) => ({
    "ID": r.id,
    "Statut": r.completed_at ? "Vote validé" : "Incomplet",
    "Q1 - Qui êtes-vous": r.voter_type ? LABELS.voter_type[r.voter_type] : "",
    "Q2 - Chamas Tacos préféré": safe(r.selected_restaurant),
    "Q3 - Période de visite": r.visit_period ? LABELS.visit_period[r.visit_period] : "",
    "Q4 - Meilleure décoration": safe(r.selected_decoration_id ? decoName.get(r.selected_decoration_id) ?? "(supprimée)" : ""),
    "Q5 - Influence de la décoration": r.decoration_impact ? LABELS.decoration_impact[r.decoration_impact] : "",
    "Q6 - Commentaire": safe(r.comment),
    "Q7a - Tirage au sort": r.wants_raffle == null ? "" : r.wants_raffle ? "Oui" : "Non",
    "Q7b - Nom": safe(r.participant_name),
    "Q7c - Téléphone": formatFrPhone(r.phone_number),
    "Q7d - Email": safe(r.email),
    "Gagnant": r.is_winner ? "Oui" : "",
    "Créé le": date(r.created_at),
    "Validé le": date(r.completed_at),
    "Adresse IP": r.ip_address ?? "",
    "Navigateur": safe(r.user_agent),
  }));
}

export function raffleRows(rows: ResponseRow[], decorations: Decoration[]): Row[] {
  const decoName = new Map(decorations.map((d) => [d.id, d.restaurant_name]));
  return rows.filter(isRaffleEntry).map((r) => ({
    "Nom": safe(r.participant_name),
    "Email": safe(r.email),
    "Téléphone": formatFrPhone(r.phone_number),
    "Restaurant voté": safe(r.selected_decoration_id ? decoName.get(r.selected_decoration_id) ?? "" : ""),
    "Chamas Tacos préféré": safe(r.selected_restaurant),
    "Date inscription": date(r.completed_at),
    "Gagnant": r.is_winner ? "Oui" : "",
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
