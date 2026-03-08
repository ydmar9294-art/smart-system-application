/**
 * Shared CORS Utility for Edge Functions
 * Restricts origins to trusted domains only.
 */

const ALLOWED_ORIGINS = [
  'https://smart-system-application.lovable.app',
  'https://a40b1c0f-cee6-438e-9bab-e3634d908e73.lovableproject.com',
  'capacitor://localhost',
  'http://localhost',
  'http://localhost:8080',
  'http://localhost:5173',
  'http://localhost:3000',
];

export function getCorsHeaders(req: Request): Record<string, string> {
  const origin = req.headers.get('Origin') || '';
  
  // Check if origin matches any allowed origin
  const isAllowed = ALLOWED_ORIGINS.some(allowed => {
    if (allowed === origin) return true;
    // Support wildcard subdomains for lovable preview URLs
    if (origin.endsWith('.lovableproject.com') || origin.endsWith('.lovable.app')) return true;
    return false;
  });

  return {
    'Access-Control-Allow-Origin': isAllowed ? origin : ALLOWED_ORIGINS[0],
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
    'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
    'Vary': 'Origin',
  };
}

export function handleCorsPreflightIfNeeded(req: Request): Response | null {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: getCorsHeaders(req) });
  }
  return null;
}
