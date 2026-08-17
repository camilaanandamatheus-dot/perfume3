const { getUser, getProfile, json } = require("./_lib");

module.exports = async (req, res) => {
  try {
    const { user } = await getUser(req);
    if (!user) return json(res, 401, { error: "Sessão inválida." });

    const profile = await getProfile(user.id);
    return json(res, 200, {
      id: user.id,
      email: user.email,
      fullName: profile?.full_name || user.user_metadata?.full_name || "Cliente Sutan",
      isAdmin: profile?.role === "admin"
    });
  } catch (e) {
    return json(res, 500, { error: e.message || "Erro ao carregar a conta." });
  }
};
