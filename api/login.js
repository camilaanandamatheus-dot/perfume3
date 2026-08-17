const { supabasePublic, supabaseAdmin, getProfile, json } = require("./_lib");

module.exports = async (req, res) => {
  if (req.method !== "POST") return json(res, 405, { error: "Método não permitido." });

  try {
    const { email, password } = req.body || {};
    const cleanEmail = String(email || "").trim().toLowerCase();

    if (!cleanEmail || !password) return json(res, 400, { error: "Informe e-mail e senha." });

    const supabase = supabasePublic();
    const { data, error } = await supabase.auth.signInWithPassword({
      email: cleanEmail,
      password
    });

    if (error) {
      if (/invalid login credentials/i.test(error.message)) {
        const admin = supabaseAdmin();
        const { data: existing } = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 });
        const exists = (existing?.users || []).some(u => String(u.email || "").toLowerCase() === cleanEmail);
        if (!exists) {
          return json(res, 404, {
            error: "Esta conta não existe. Clique em “Criar conta” para se cadastrar."
          });
        }
        return json(res, 401, { error: "Senha incorreta. Confira sua senha e tente novamente." });
      }
      return json(res, 401, { error: error.message });
    }

    const profile = await getProfile(data.user.id);
    const admin = supabaseAdmin();
    await admin.from("profiles").update({
      last_login_at: new Date().toISOString()
    }).eq("id", data.user.id);

    return json(res, 200, {
      accessToken: data.session.access_token,
      refreshToken: data.session.refresh_token,
      user: {
        id: data.user.id,
        email: data.user.email,
        full_name: profile?.full_name || data.user.user_metadata?.full_name || "Cliente Sutan",
        isAdmin: profile?.role === "admin"
      }
    });
  } catch (e) {
    return json(res, 500, { error: e.message || "Erro ao entrar." });
  }
};
