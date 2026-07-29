import { supabase } from "./supabase";

const apiUrl = import.meta.env.VITE_APP_API_URL as string | undefined;

if (!apiUrl) {
  throw new Error("Missing VITE_APP_API_URL");
}

export type ApiMethod = "GET" | "POST" | "PUT" | "PATCH" | "DELETE";

export async function apiRequest<T>(
  path: string,
  options: { method?: ApiMethod; body?: unknown; query?: Record<string, string> } = {}
): Promise<T> {
  const session = await supabase.auth.getSession();
  const token = session.data.session?.access_token;
  if (!token) {
    throw new Error("Not authenticated");
  }

  const url = new URL(apiUrl + path);
  Object.entries(options.query || {}).forEach(([key, value]) => url.searchParams.set(key, value));

  const response = await fetch(url, {
    method: options.method || "GET",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json"
    },
    body: options.body == null ? undefined : JSON.stringify(options.body)
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(text || `API request failed: ${response.status}`);
  }

  if (response.status === 204) {
    return undefined as T;
  }

  return (await response.json()) as T;
}
