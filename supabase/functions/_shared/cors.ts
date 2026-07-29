export function corsHeadersFor(request?: Request) {
  if (!request) {
    return corsHeaders;
  }

  const configuredOrigins = (Deno.env.get("APP_ORIGIN") || "*")
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean);
  const origin = request?.headers.get("Origin") || "";
  const allowed =
    configuredOrigins.includes("*") || (origin && configuredOrigins.includes(origin)) ? origin || "*" : configuredOrigins[0] || "*";

  return {
    "Access-Control-Allow-Origin": allowed,
    "Vary": "Origin",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "GET, POST, PUT, PATCH, DELETE, OPTIONS"
  };
}

export const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Vary": "Origin",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, POST, PUT, PATCH, DELETE, OPTIONS"
};

export function jsonResponse(body: unknown, status = 200, request?: Request) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeadersFor(request),
      "Content-Type": "application/json"
    }
  });
}

export function noContent(request?: Request) {
  return new Response(null, { status: 204, headers: corsHeadersFor(request) });
}
