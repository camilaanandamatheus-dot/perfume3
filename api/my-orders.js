const { getUser, supabaseAdmin, json } = require("./_lib");

module.exports = async (req, res) => {
  try {
    const { user } = await getUser(req);
    if (!user) return json(res, 401, { error: "Faça login para continuar." });

    const admin = supabaseAdmin();
    const { data, error } = await admin
      .from("orders")
      .select("id,order_code,customer_email,customer_name,status,total,created_at,updated_at")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false });

    if (error) return json(res, 500, { error: error.message });
    return json(res, 200, { orders: data || [] });
  } catch (e) {
    return json(res, 500, { error: e.message || "Erro ao carregar pedidos." });
  }
};
