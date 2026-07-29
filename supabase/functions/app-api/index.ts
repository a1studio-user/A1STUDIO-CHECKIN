import { corsHeaders, jsonResponse, noContent } from "../_shared/cors.ts";
import { adminClient } from "../_shared/client.ts";
import { AppProfile, isTeacher, requireProfile, requireRole } from "../_shared/auth.ts";

type RouteContext = {
  request: Request;
  url: URL;
  profile: AppProfile;
};

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") {
    return noContent(request);
  }

  try {
    const profile = await requireProfile(request);
    const url = new URL(request.url);
    const context = { request, url, profile };

    if (url.pathname.endsWith("/me")) return jsonResponse({ profile });
    if (url.pathname.endsWith("/students")) return studentsRoute(context);
    if (url.pathname.endsWith("/classes")) return classesRoute(context);
    if (url.pathname.endsWith("/tasks")) return tasksRoute(context);
    if (url.pathname.endsWith("/checkins")) return checkinsRoute(context);
    if (url.pathname.endsWith("/chat")) return chatRoute(context);
    if (url.pathname.endsWith("/legacy-rest")) return legacyRestRoute(context);

    return jsonResponse({ error: "Not found" }, 404);
  } catch (error) {
    if (error instanceof Response) return withCors(error);
    return jsonResponse({ error: error instanceof Error ? error.message : "Unexpected error" }, 500);
  }
});

function withCors(response: Response) {
  const headers = new Headers(response.headers);
  Object.entries(corsHeaders).forEach(([key, value]) => headers.set(key, value));
  return new Response(response.body, { status: response.status, headers });
}

async function readJson<T>(request: Request): Promise<T> {
  return (await request.json()) as T;
}

async function studentsRoute({ request, profile }: RouteContext) {
  if (request.method === "GET") {
    requireRole(profile, ["owner", "teacher"]);
    const { data, error } = await adminClient
      .from("profiles")
      .select("id, username, role, programs")
      .eq("role", "student")
      .order("username");
    if (error) throw error;
    return jsonResponse({ students: data });
  }

  if (request.method === "POST") {
    requireRole(profile, ["owner", "teacher"]);
    const body = await readJson<{ email: string; password: string; username: string; programs: unknown }>(request);
    const { data: created, error: createError } = await adminClient.auth.admin.createUser({
      email: body.email,
      password: body.password,
      email_confirm: true
    });
    if (createError || !created.user) throw createError || new Error("Failed to create auth user");

    const { error: profileError } = await adminClient.from("profiles").insert({
      id: created.user.id,
      username: body.username,
      role: "student",
      programs: body.programs || { italian: true, portfolio: false },
      created_by: profile.id
    });
    if (profileError) throw profileError;
    return jsonResponse({ id: created.user.id }, 201);
  }

  return jsonResponse({ error: "Method not allowed" }, 405);
}

async function classesRoute({ request, profile }: RouteContext) {
  requireRole(profile, ["owner", "teacher"]);

  if (request.method === "GET") {
    const { data, error } = await adminClient
      .from("classes")
      .select("id, name, class_members(student_id, profiles(username, programs))")
      .order("name");
    if (error) throw error;
    return jsonResponse({ classes: data });
  }

  if (request.method === "POST") {
    const body = await readJson<{ name: string; studentIds?: string[] }>(request);
    const { data: created, error } = await adminClient
      .from("classes")
      .insert({ name: body.name, created_by: profile.id })
      .select("id")
      .single();
    if (error) throw error;
    if (body.studentIds?.length) {
      const rows = body.studentIds.map((student_id) => ({ class_id: created.id, student_id }));
      const { error: memberError } = await adminClient.from("class_members").insert(rows);
      if (memberError) throw memberError;
    }
    return jsonResponse({ id: created.id }, 201);
  }

  return jsonResponse({ error: "Method not allowed" }, 405);
}

async function tasksRoute({ request, profile, url }: RouteContext) {
  if (request.method === "GET") {
    const date = url.searchParams.get("date");
    if (!date) return jsonResponse({ error: "date is required" }, 400);

    const query = adminClient.from("tasks").select("*").eq("task_date", date).order("updated_at", { ascending: false });
    if (profile.role === "student") {
      query.or(`student_id.eq.${profile.id},target_type.eq.default`);
    }
    const { data, error } = await query;
    if (error) throw error;
    return jsonResponse({ tasks: data });
  }

  if (request.method === "POST") {
    if (!isTeacher(profile)) throw new Response("Forbidden", { status: 403 });
    const body = await readJson<Record<string, unknown>>(request);
    const { data, error } = await adminClient
      .from("tasks")
      .upsert({ ...body, updated_by: profile.id }, { onConflict: "task_date,target_type,target_id,program" })
      .select("id")
      .single();
    if (error) throw error;
    return jsonResponse({ id: data.id });
  }

  return jsonResponse({ error: "Method not allowed" }, 405);
}

async function checkinsRoute({ request, profile }: RouteContext) {
  requireRole(profile, ["owner", "teacher"]);
  if (request.method !== "POST") return jsonResponse({ error: "Method not allowed" }, 405);
  const body = await readJson<Record<string, unknown>>(request);
  const { error } = await adminClient.from("checkins_v2").upsert({ ...body, checked_by: profile.id });
  if (error) throw error;
  return jsonResponse({ ok: true });
}

async function chatRoute({ request, profile }: RouteContext) {
  if (request.method === "GET") {
    const { data, error } = await adminClient
      .from("chat_messages_v2")
      .select("id, sender_id, message, created_at, profiles(username, role)")
      .eq("is_deleted", false)
      .gte("created_at", new Date(new Date().setHours(0, 0, 0, 0)).toISOString())
      .order("created_at");
    if (error) throw error;
    return jsonResponse({ messages: data });
  }

  if (request.method === "POST") {
    const body = await readJson<{ message: string }>(request);
    const { error } = await adminClient.from("chat_messages_v2").insert({
      sender_id: profile.id,
      message: body.message
    });
    if (error) throw error;
    return jsonResponse({ ok: true }, 201);
  }

  return jsonResponse({ error: "Method not allowed" }, 405);
}

const LEGACY_TABLES = new Set([
  "app_users",
  "daily_tasks",
  "student_tasks",
  "checkins",
  "streaks",
  "chat_messages",
  "hidden_chat_messages"
]);

async function legacyRestRoute({ request, profile }: RouteContext) {
  const body = await readJson<{
    path: string;
    method?: string;
    headers?: Record<string, string>;
    body?: unknown;
  }>(request);
  const legacyPath = body.path || "";
  const method = (body.method || "GET").toUpperCase();
  const parsed = new URL("https://legacy.local/" + legacyPath.replace(/^\/+/, ""));
  const table = parsed.pathname.replace(/^\/+/, "");

  if (!LEGACY_TABLES.has(table)) {
    return jsonResponse({ error: "Legacy table is not allowed" }, 400);
  }
  if (!canUseLegacyTable(profile, table, method, body.body)) {
    return jsonResponse({ error: "Forbidden" }, 403);
  }

  if (method === "GET") {
    return legacySelect(table, parsed);
  }
  if (method === "POST") {
    return legacyPost(table, parsed, body);
  }
  if (method === "DELETE") {
    return legacyDelete(table, parsed, body);
  }

  return jsonResponse({ error: "Method not allowed" }, 405);
}

function canUseLegacyTable(profile: AppProfile, table: string, method: string, payload: unknown) {
  if (method === "GET") return true;
  if (isTeacher(profile)) return true;
  if (table === "chat_messages" && method === "POST") return true;
  if (table === "hidden_chat_messages") return legacyRows(payload).every((row) => row.username === profile.username);
  if (table === "app_users" && method === "POST") {
    return legacyRows(payload).every((row) => row.username === profile.username);
  }
  if ((table === "chat_messages" || table === "hidden_chat_messages") && method === "DELETE") return true;
  return false;
}

function legacyRows(payload: unknown): Array<Record<string, unknown>> {
  if (Array.isArray(payload)) return payload.filter((item): item is Record<string, unknown> => !!item && typeof item === "object");
  if (payload && typeof payload === "object") return [payload as Record<string, unknown>];
  return [];
}

function legacySelect(table: string, parsed: URL) {
  const select = parsed.searchParams.get("select") || "*";
  let query = adminClient.from(table).select(select);
  query = applyLegacyFilters(query, parsed);
  query = applyLegacyOrder(query, parsed);
  return query.then(({ data, error }) => {
    if (error) throw error;
    return jsonResponse(data || []);
  });
}

async function legacyPost(table: string, parsed: URL, body: { headers?: Record<string, string>; body?: unknown }) {
  const onConflict = parsed.searchParams.get("on_conflict") || undefined;
  const prefer = body.headers?.Prefer || body.headers?.prefer || "";
  const wantsRepresentation = prefer.includes("return=representation");
  const rows = Array.isArray(body.body) ? body.body : [body.body];
  let query = onConflict
    ? adminClient.from(table).upsert(rows, { onConflict })
    : adminClient.from(table).insert(rows);

  if (wantsRepresentation) {
    const { data, error } = await query.select();
    if (error) throw error;
    return jsonResponse(data || []);
  }

  const { error } = await query;
  if (error) throw error;
  return noContent(body instanceof Request ? body : undefined);
}

async function legacyDelete(table: string, parsed: URL, body: { headers?: Record<string, string> }) {
  const prefer = body.headers?.Prefer || body.headers?.prefer || "";
  const wantsRepresentation = prefer.includes("return=representation");
  let query = adminClient.from(table).delete();
  query = applyLegacyFilters(query, parsed);
  if (wantsRepresentation) {
    const { data, error } = await query.select();
    if (error) throw error;
    return jsonResponse(data || []);
  }
  const { error } = await query;
  if (error) throw error;
  return noContent();
}

function applyLegacyFilters(query: any, parsed: URL) {
  parsed.searchParams.forEach((value, key) => {
    if (["select", "order", "on_conflict"].includes(key)) return;
    const dot = value.indexOf(".");
    if (dot === -1) return;
    const operator = value.slice(0, dot);
    const operand = value.slice(dot + 1);
    if (operator === "eq") query = query.eq(key, operand);
    if (operator === "gte") query = query.gte(key, operand);
    if (operator === "lt") query = query.lt(key, operand);
  });
  return query;
}

function applyLegacyOrder(query: any, parsed: URL) {
  const order = parsed.searchParams.get("order");
  if (!order) return query;
  const [column, direction] = order.split(".");
  return query.order(column, { ascending: direction !== "desc" });
}
