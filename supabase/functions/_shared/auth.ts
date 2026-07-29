import { adminClient } from "./client.ts";

export type AppRole = "owner" | "teacher" | "student";

export type AppProfile = {
  id: string;
  username: string;
  role: AppRole;
  programs: { italian: boolean; portfolio: boolean };
};

export async function requireProfile(request: Request): Promise<AppProfile> {
  const authHeader = request.headers.get("Authorization") || "";
  const token = authHeader.replace(/^Bearer\s+/i, "");
  if (!token) {
    throw new Response("Missing bearer token", { status: 401 });
  }

  const { data: userData, error: userError } = await adminClient.auth.getUser(token);
  if (userError || !userData.user) {
    throw new Response("Invalid bearer token", { status: 401 });
  }

  const { data: profile, error } = await adminClient
    .from("profiles")
    .select("id, username, role, programs")
    .eq("id", userData.user.id)
    .single();

  if (error || !profile) {
    throw new Response("Profile not found", { status: 403 });
  }

  return profile as AppProfile;
}

export function requireRole(profile: AppProfile, roles: AppRole[]) {
  if (!roles.includes(profile.role)) {
    throw new Response("Forbidden", { status: 403 });
  }
}

export function isTeacher(profile: AppProfile) {
  return profile.role === "owner" || profile.role === "teacher";
}
