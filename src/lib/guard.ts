import "server-only";
import { currentRole, type Role } from "./auth";
import { error } from "./http";

/** Renvoie une réponse d'erreur si l'utilisateur n'a pas le rôle requis, sinon null. */
export async function requireRole(min: Role) {
  const role = await currentRole();
  if (!role) return error("Non authentifié", 401);
  if (min === "admin" && role !== "admin") return error("Accès en lecture seule", 403);
  return null;
}
