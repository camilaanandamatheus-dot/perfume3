const { createClient } = require("@supabase/supabase-js");

function supabaseAdmin() {
  if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error("Supabase não configurado. Verifique as variáveis da Vercel.");
  }
  return createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false }
  });
}

function supabasePublic() {
  if (!process.env.SUPABASE_URL || !process.env.SUPABASE_ANON_KEY) {
    throw new Error("SUPABASE_URL ou SUPABASE_ANON_KEY não configurado.");
  }
  return createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY);
}

function tokenFromRequest(req) {
  const h = req.headers.authorization || "";
  return h.replace(/^Bearer\s+/i, "").trim();
}

async function getUser(req) {
  const token = tokenFromRequest(req);
  if (!token) return { user: null, token: null };
  const admin = supabaseAdmin();
  const { data, error } = await admin.auth.getUser(token);
  if (error || !data.user) return { user: null, token };
  return { user: data.user, token };
}

async function getProfile(userId) {
  const admin = supabaseAdmin();
  const { data, error } = await admin
    .from("profiles")
    .select("id,email,full_name,role,created_at,updated_at,last_login_at")
    .eq("id", userId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data;
}

function json(res, status, body) {
  return res.status(status).json(body);
}

module.exports = { supabaseAdmin, supabasePublic, tokenFromRequest, getUser, getProfile, json };
