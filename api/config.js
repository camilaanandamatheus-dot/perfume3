const { json } = require("./_lib");

module.exports = async (req, res) => {
  if (req.method !== "GET") return json(res, 405, { error: "Método não permitido." });
  const { SUPABASE_URL, SUPABASE_ANON_KEY } = process.env;
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    return json(res, 500, { error: "Supabase não configurado na Vercel." });
  }
  return json(res, 200, {
    supabaseUrl: SUPABASE_URL,
    publishableKey: SUPABASE_ANON_KEY,
    adminEmail: process.env.ADMIN_EMAIL || ""
  });
};
