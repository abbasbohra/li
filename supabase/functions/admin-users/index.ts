// Admin-only API for managing users. It is the ONLY place that uses the service-role key,
// and it first checks that the caller is a logged-in, active admin.
// Deploy: supabase functions deploy admin-users
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const cors = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "*" };
const json = (b: unknown, s = 200) =>
  new Response(JSON.stringify(b), { status: s, headers: { ...cors, "Content-Type": "application/json" } });
const ROLES = ["admin", "sales", "store", "delivery"];

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  try {
    const db = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, {
      auth: { persistSession: false },
    });
    const jwt = (req.headers.get("Authorization") ?? "").replace("Bearer ", "");
    const { data: who, error: authErr } = await db.auth.getUser(jwt);
    if (authErr || !who.user) return json({ error: "Not logged in" }, 401);
    const { data: me } = await db.from("profiles").select("role,active").eq("id", who.user.id).single();
    if (me?.role !== "admin" || !me.active) return json({ error: "Admins only" }, 403);

    const b = await req.json();

    if (b.action === "list") {
      const { data: list, error } = await db.auth.admin.listUsers({ page: 1, perPage: 200 });
      if (error) throw error;
      const { data: profs } = await db.from("profiles").select("id,role,full_name,phone,active");
      const byId = new Map((profs ?? []).map((p) => [p.id, p]));
      const users = list.users.map((u) => ({
        id: u.id, email: u.email,
        ...(byId.get(u.id) ?? { role: "sales", full_name: null, phone: null, active: true }),
      }));
      return json({ users });
    }

    if (b.action === "create") {
      const { email, password, role, full_name, phone } = b;
      if (!email || !password || String(password).length < 6) return json({ error: "Email and a password of 6+ characters are required" }, 400);
      if (!ROLES.includes(role)) return json({ error: "Invalid role" }, 400);
      const { data, error } = await db.auth.admin.createUser({
        email: String(email).trim(), password, email_confirm: true, user_metadata: { full_name },
      });
      if (error) return json({ error: error.message }, 400);
      const { error: pe } = await db.from("profiles")
        .upsert({ id: data.user.id, role, full_name: full_name ?? null, phone: phone ?? null, active: true });
      if (pe) return json({ error: pe.message }, 500);
      return json({ id: data.user.id });
    }

    if (b.action === "update") {
      const { id, role, full_name, phone, active, password } = b;
      if (!id) return json({ error: "User id missing" }, 400);
      if (role && !ROLES.includes(role)) return json({ error: "Invalid role" }, 400);
      if (id === who.user.id && ((role && role !== "admin") || active === false))
        return json({ error: "You cannot remove your own admin access" }, 400);
      const patch: Record<string, unknown> = {};
      if (role) patch.role = role;
      if (full_name !== undefined) patch.full_name = full_name;
      if (phone !== undefined) patch.phone = phone;
      if (active !== undefined) patch.active = active;
      if (Object.keys(patch).length) {
        const { error } = await db.from("profiles").update(patch).eq("id", id);
        if (error) return json({ error: error.message }, 500);
      }
      const authPatch: Record<string, unknown> = {};
      if (password) {
        if (String(password).length < 6) return json({ error: "Password needs 6+ characters" }, 400);
        authPatch.password = password;
      }
      if (active !== undefined) authPatch.ban_duration = active ? "none" : "876000h";
      if (Object.keys(authPatch).length) {
        const { error } = await db.auth.admin.updateUserById(id, authPatch);
        if (error) return json({ error: error.message }, 400);
      }
      return json({ ok: true });
    }

    return json({ error: "Unknown action" }, 400);
  } catch (e) {
    return json({ error: String(e) }, 500);
  }
});
