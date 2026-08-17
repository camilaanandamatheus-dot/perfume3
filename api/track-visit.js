const { supabaseAdmin, json } = require("./_lib");

module.exports = async (req, res) => {
  if (req.method !== "POST") return json(res, 405, { error: "Método não permitido." });
  try {
    const { visitorId } = req.body || {};
    if (!visitorId) return json(res, 400, { error: "visitorId obrigatório." });

    const admin = supabaseAdmin();
    const { error } = await admin.rpc("register_visit", {
      p_visitor_id: String(visitorId).slice(0, 120)
    });
    if (error) return json(res, 500, { error: error.message });
    return json(res, 200, { ok: true });
  } catch (e) {
    return json(res, 500, { error: e.message || "Erro ao registrar acesso." });
  }
};
