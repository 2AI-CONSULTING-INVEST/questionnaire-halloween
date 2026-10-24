// Chargeur des tests unitaires (node:test, sans dépendance) : résout les imports TypeScript sans
// extension et l'alias « @/ » du projet, et remplace « server-only » par un module vide.
import { register } from "node:module";

register("./hooks.mjs", import.meta.url);
