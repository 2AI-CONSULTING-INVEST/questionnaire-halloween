import { revalidatePath } from "next/cache";
import { z } from "zod";
import { CONFLICT_MESSAGES, ConflictError, getStore } from "@/lib/db";
import { requireRole } from "@/lib/guard";
import { error, json, readJson, zodError } from "@/lib/http";

export async function GET() {
  return json(await getStore().listRestaurants());
}

const restaurantSchema = z.object({
  name: z.string().trim().min(2).max(150),
  city: z.string().trim().max(100).optional().nullable(),
});

/** Admin : ajouter un restaurant à la liste de la question 2. */
export async function POST(req: Request) {
  const denied = await requireRole("admin", req);
  if (denied) return denied;
  const body = await readJson(req);
  if (body instanceof Response) return body;
  const parsed = restaurantSchema.safeParse(body);
  if (!parsed.success) return zodError(parsed.error);
  try {
    const r = await getStore().addRestaurant(parsed.data.name.toUpperCase(), parsed.data.city || null);
    revalidatePath("/");
    return json(r, 201);
  } catch (e) {
    if (e instanceof ConflictError) return error(CONFLICT_MESSAGES.restaurant, 409); // message fixe, jamais celui de la base
    throw e;
  }
}
