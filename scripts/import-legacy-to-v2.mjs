import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createClient } from "@supabase/supabase-js";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const env = readEnv(path.join(root, ".env"));
const legacyHtml = fs.readFileSync(path.join(root, "legacy-pwa", "index.html"), "utf8");
const legacyUrl = readConst(legacyHtml, "SUPABASE_URL");
const legacyAnonKey = readConst(legacyHtml, "SUPABASE_ANON_KEY");
const apply = process.argv.includes("--apply");

const targetUrl = env.SUPABASE_URL || env.VITE_SUPABASE_URL;
const serviceRoleKey = env.SUPABASE_SERVICE_ROLE_KEY;

if (!targetUrl || !serviceRoleKey) {
  throw new Error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env");
}

const admin = createClient(targetUrl, serviceRoleKey, {
  auth: { persistSession: false, autoRefreshToken: false }
});

const ZERO_UUID = "00000000-0000-0000-0000-000000000000";
const META_CLASSES_KEY = "__meta_classes__";
const META_PROGRAMS_KEY = "__meta_student_programs__";
const META_CLASS_TASKS_KEY = "__meta_class_tasks__";
const PORTFOLIO_PREFIX = "__portfolio__:";
const DELETED_USER_PREFIX = "__deleted_user__:";

const legacy = await loadLegacySnapshot();
const plan = buildImportPlan(legacy);

console.log(JSON.stringify({
  mode: apply ? "apply" : "dry-run",
  legacyProject: legacyUrl,
  targetProject: targetUrl,
  counts: {
    users: plan.users.length,
    teachers: plan.users.filter((user) => user.role !== "student").length,
    students: plan.users.filter((user) => user.role === "student").length,
    classes: plan.classes.length,
    classMembers: plan.classMembers.length,
    tasks: plan.tasks.length,
    checkins: plan.checkins.length,
    streaks: plan.streaks.length,
    chatMessages: plan.chatMessages.length
  }
}, null, 2));

if (!apply) {
  console.log("Dry run only. Re-run with --apply to write to the staging Supabase project.");
  process.exit(0);
}

await importUsers(plan);
await importClassesAndMembers(plan);
await upsertRows("tasks", plan.tasks, "task_date,target_type,target_id,program");
await upsertRows("checkins_v2", plan.checkins, "student_id,checkin_date");
await upsertRows("streaks_v2", plan.streaks, "student_id");
await upsertRows("chat_messages_v2", plan.chatMessages, "id");
await importLegacyCompatTables(legacy);

console.log("Legacy data import completed.");

function readEnv(filePath) {
  const text = fs.existsSync(filePath) ? fs.readFileSync(filePath, "utf8") : "";
  return Object.fromEntries(text.split(/\r?\n/).flatMap((line) => {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#") || !trimmed.includes("=")) return [];
    const index = trimmed.indexOf("=");
    const key = trimmed.slice(0, index).trim();
    const value = trimmed.slice(index + 1).trim().replace(/^['"]|['"]$/g, "");
    return [[key, value]];
  }));
}

function readConst(source, name) {
  const match = source.match(new RegExp(`const\\s+${name}\\s*=\\s*['"]([^'"]+)['"]`));
  if (!match) throw new Error(`Cannot find ${name} in legacy PWA`);
  return match[1];
}

async function legacyRest(pathname) {
  const response = await fetch(`${legacyUrl}/rest/v1/${pathname}`, {
    headers: {
      apikey: legacyAnonKey,
      Authorization: `Bearer ${legacyAnonKey}`
    }
  });
  if (!response.ok) {
    throw new Error(`Legacy REST failed ${response.status}: ${await response.text()}`);
  }
  return await response.json();
}

async function loadLegacySnapshot() {
  const [
    users,
    dailyTasks,
    studentTasks,
    checkins,
    streaks,
    chatMessages
  ] = await Promise.all([
    legacyRest("app_users?select=*"),
    legacyRest("daily_tasks?select=*"),
    legacyRest("student_tasks?select=*"),
    legacyRest("checkins?select=*"),
    legacyRest("streaks?select=*"),
    legacyRest("chat_messages?select=*&order=created_at.asc")
  ]);

  return { users, dailyTasks, studentTasks, checkins, streaks, chatMessages };
}

function buildImportPlan(snapshot) {
  const deletedUsers = new Set(
    snapshot.dailyTasks
      .map((row) => row.task_date || "")
      .filter((key) => key.startsWith(DELETED_USER_PREFIX))
      .map((key) => decodeURIComponent(key.slice(DELETED_USER_PREFIX.length)))
  );
  const classes = parseMeta(snapshot.dailyTasks, META_CLASSES_KEY, {});
  const studentPrograms = parseMeta(snapshot.dailyTasks, META_PROGRAMS_KEY, {});
  const classTasks = parseMeta(snapshot.dailyTasks, META_CLASS_TASKS_KEY, {});

  const users = snapshot.users
    .filter((user) => !deletedUsers.has(user.username))
    .map((user) => ({
      username: user.username,
      password: String(user.password || "123456"),
      role: user.role === "teacher" || user.role === "owner" ? (user.username === "toni" ? "owner" : "teacher") : "student",
      programs: normalizePrograms(studentPrograms[user.username])
    }));

  const userIdByName = new Map();
  const classIdByName = new Map();

  users.forEach((user) => userIdByName.set(user.username, null));
  Object.keys(classes).forEach((name) => classIdByName.set(name, null));

  const tasks = [];
  snapshot.dailyTasks.forEach((row) => {
    const taskDate = row.task_date || "";
    if (!taskDate || taskDate.startsWith("__")) return;
    tasks.push(toTaskRow(taskDate, "default", ZERO_UUID, row));
  });
  snapshot.dailyTasks.forEach((row) => {
    const taskDate = row.task_date || "";
    if (!taskDate.startsWith(PORTFOLIO_PREFIX)) return;
    tasks.push(toTaskRow(taskDate.slice(PORTFOLIO_PREFIX.length), "default", ZERO_UUID, row, "portfolio"));
  });

  return {
    users,
    classes: Object.keys(classes).map((name) => ({ name })),
    classMembers: Object.entries(classes).flatMap(([className, members]) =>
      (Array.isArray(members) ? members : []).map((username) => ({ className, username }))
    ),
    classesByName: classes,
    classTasks,
    userIdByName,
    classIdByName,
    tasks,
    legacyStudentTasks: snapshot.studentTasks,
    checkins: snapshot.checkins,
    streaks: snapshot.streaks,
    chatMessages: snapshot.chatMessages
  };
}

function parseMeta(rows, key, fallback) {
  const row = rows.find((item) => item.task_date === key);
  if (!row) return fallback;
  try {
    const parsed = JSON.parse(row.homework || "");
    return parsed && typeof parsed === "object" ? parsed : fallback;
  } catch {
    return fallback;
  }
}

function normalizePrograms(programs) {
  return {
    italian: programs?.italian !== false,
    portfolio: Boolean(programs?.portfolio)
  };
}

function toTaskRow(date, targetType, targetId, row, forcedProgram) {
  const program = forcedProgram || (date.startsWith(PORTFOLIO_PREFIX) ? "portfolio" : "italian");
  const taskDate = date.startsWith(PORTFOLIO_PREFIX) ? date.slice(PORTFOLIO_PREFIX.length) : date;
  return {
    task_date: taskDate,
    program,
    target_type: targetType,
    target_id: targetId,
    italian_homework: program === "italian" ? row.homework || "" : "",
    italian_words: program === "italian" ? row.dictation || "" : "",
    italian_written: program === "italian" ? row.recite || "" : "",
    portfolio_text: program === "portfolio" ? [row.homework, row.dictation, row.recite, row.speaking].filter(Boolean).join("\n") : ""
  };
}

async function importUsers(plan) {
  const existing = await listAllUsers();
  for (const user of plan.users) {
    const email = legacyEmail(user.username);
    let authUser = existing.find((item) => item.email?.toLowerCase() === email.toLowerCase());
    if (!authUser) {
      const { data, error } = await admin.auth.admin.createUser({
        email,
        password: user.password,
        email_confirm: true,
        user_metadata: { username: user.username }
      });
      if (error) throw error;
      authUser = data.user;
    } else {
      const { data, error } = await admin.auth.admin.updateUserById(authUser.id, {
        password: user.password,
        email_confirm: true,
        user_metadata: { username: user.username }
      });
      if (error) throw error;
      authUser = data.user;
    }
    plan.userIdByName.set(user.username, authUser.id);
  }

  const profiles = plan.users.map((user) => ({
    id: plan.userIdByName.get(user.username),
    username: user.username,
    role: user.role,
    programs: user.programs
  }));
  await upsertRows("profiles", profiles, "id");
}

async function importClassesAndMembers(plan) {
  if (plan.classes.length) {
    const { data, error } = await admin
      .from("classes")
      .upsert(plan.classes, { onConflict: "name" })
      .select("id,name");
    if (error) throw error;
    data.forEach((item) => plan.classIdByName.set(item.name, item.id));
  }

  const memberRows = [];
  Object.entries(plan.classesByName).forEach(([className, members]) => {
    const classId = plan.classIdByName.get(className);
    (Array.isArray(members) ? members : []).forEach((username) => {
      const studentId = plan.userIdByName.get(username);
      if (classId && studentId) memberRows.push({ class_id: classId, student_id: studentId });
    });
  });
  await upsertRows("class_members", memberRows, "class_id,student_id");

  const studentTaskRows = [];
  plan.legacyStudentTasks.forEach((row) => {
    const studentId = plan.userIdByName.get(row.username);
    if (!studentId) return;
    const date = row.task_date || "";
    studentTaskRows.push(toTaskRow(date, "student", studentId, row));
  });

  const classTaskRows = [];
  Object.entries(plan.classTasks).forEach(([className, datedTasks]) => {
    const classId = plan.classIdByName.get(className);
    if (!classId) return;
    Object.entries(datedTasks || {}).forEach(([date, task]) => {
      classTaskRows.push(toTaskRow(date, "class", classId, task));
    });
  });

  plan.tasks = [...plan.tasks, ...studentTaskRows, ...classTaskRows];

  plan.checkins = plan.checkins.flatMap((row) => {
    const studentId = plan.userIdByName.get(row.username);
    if (!studentId) return [];
    return [{
      student_id: studentId,
      checkin_date: row.checkin_date,
      italian_homework: Boolean(row.homework),
      italian_words: Boolean(row.dictation),
      italian_written: Boolean(row.recite),
      portfolio_done: Boolean(row.speaking)
    }];
  });

  plan.streaks = plan.streaks.flatMap((row) => {
    const studentId = plan.userIdByName.get(row.username);
    if (!studentId) return [];
    return [{
      student_id: studentId,
      streak: row.streak || 0,
      bravos: row.flowers || 0,
      last_checkin_date: row.last_checkin_date || null
    }];
  });

  plan.chatMessages = plan.chatMessages.flatMap((row) => {
    const senderId = plan.userIdByName.get(row.username);
    if (!senderId) return [];
    return [{
      id: row.id,
      sender_id: senderId,
      message: row.message || "",
      created_at: row.created_at || new Date().toISOString()
    }];
  });
}

async function listAllUsers() {
  const users = [];
  for (let page = 1; ; page += 1) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 1000 });
    if (error) throw error;
    users.push(...data.users);
    if (data.users.length < 1000) return users;
  }
}

async function upsertRows(table, rows, onConflict) {
  if (!rows.length) return;
  for (let start = 0; start < rows.length; start += 500) {
    const chunk = rows.slice(start, start + 500);
    const { error } = await admin.from(table).upsert(chunk, { onConflict });
    if (error) throw error;
  }
}

async function importLegacyCompatTables(snapshot) {
  await upsertRows("app_users", snapshot.users.map((row) => ({
    username: row.username,
    password: row.password || "123456",
    role: row.role === "owner" ? "teacher" : row.role,
    updated_at: row.updated_at || new Date().toISOString()
  })), "username");

  await upsertRows("daily_tasks", snapshot.dailyTasks.map((row) => ({
    task_date: row.task_date,
    homework: row.homework || "",
    dictation: row.dictation || "",
    recite: row.recite || "",
    speaking: row.speaking || "",
    updated_at: row.updated_at || new Date().toISOString()
  })), "task_date");

  await upsertRows("student_tasks", snapshot.studentTasks.map((row) => ({
    username: row.username,
    task_date: row.task_date,
    homework: row.homework || "",
    dictation: row.dictation || "",
    recite: row.recite || "",
    speaking: row.speaking || "",
    updated_at: row.updated_at || new Date().toISOString()
  })), "username,task_date");

  await upsertRows("checkins", snapshot.checkins.map((row) => ({
    username: row.username,
    checkin_date: row.checkin_date,
    homework: Boolean(row.homework),
    dictation: Boolean(row.dictation),
    recite: Boolean(row.recite),
    speaking: Boolean(row.speaking),
    updated_at: row.updated_at || new Date().toISOString()
  })), "username,checkin_date");

  await upsertRows("streaks", snapshot.streaks.map((row) => ({
    username: row.username,
    streak: row.streak || 0,
    flowers: row.flowers || 0,
    last_checkin_date: row.last_checkin_date || null,
    updated_at: row.updated_at || new Date().toISOString()
  })), "username");

  await upsertRows("chat_messages", snapshot.chatMessages.map((row) => ({
    id: row.id,
    username: row.username,
    role: row.role === "owner" ? "teacher" : row.role,
    message: row.message || "",
    created_at: row.created_at || new Date().toISOString()
  })), "id");
}

function legacyEmail(username) {
  return `${encodeURIComponent(username).replace(/%/g, "_").toLowerCase()}@a1studio.local`;
}
