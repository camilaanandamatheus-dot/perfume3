const { supabasePublic, supabaseAdmin, getProfile, json } = require("./_lib");

module.exports = async (req, res) => {
  if (req.method !== "POST") return json(res, 405, { error: "Método não permitido." });

  try {
    const { name, email, password } = req.body || {};
    const cleanName = String(name || "").trim();
    const cleanEmail = String(email || "").trim().toLowerCase();

    if (!cleanName || !cleanEmail || !password) return json(res, 400, { error: "Preencha nome, e-mail e senha." });
    if (cleanName.length > 80) return json(res, 400, { error: "O nome é muito grande." });
    if (password.length < 8) return json(res, 400, { error: "A senha deve ter pelo menos 8 caracteres." });

    const supabase = supabasePublic();
    const { data, error } = await supabase.auth.signUp({
      email: cleanEmail,
      password,
      options: { data: { full_name: cleanName } }
    });

    if (error) {
      if (/already registered|already exists|user already registered/i.test(error.message)) {
        return json(res, 409, { error: "Este e-mail já está cadastrado. Entre na sua conta." });
      }
      return json(res, 400, { error: error.message });
    }

    if (!data.user) return json(res, 400, { error: "Não foi possível criar a conta." });

    // Se a confirmação de e-mail estiver ligada, o Supabase não devolve sessão.
    if (!data.session) {
      return json(res, 200, {
        requiresEmailConfirmation: true,
        user: { id: data.user.id, email: data.user.email, isAdmin: false },
        message: "Conta criada. Confirme o e-mail para entrar."
      });
    }

    const admin = supabaseAdmin();
    const profile = await getProfile(data.user.id);
    await admin.from("profiles").update({
      email: cleanEmail,
      full_name: cleanName,
      last_login_at: new Date().toISOString()
    }).eq("id", data.user.id);

    return json(res, 200, {
      accessToken: data.session.access_token,
      refreshToken: data.session.refresh_token,
      user: {
        id: data.user.id,
        email: data.user.email,
        full_name: profile?.full_name || cleanName,
        isAdmin: profile?.role === "admin"
      }
    });
  } catch (e) {
    return json(res, 500, { error: e.message || "Erro ao criar a conta." });
  }
};
