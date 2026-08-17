const { getUser, getProfile, supabaseAdmin, json } = require("./_lib");

async function loadOrder(admin, code) {
  const { data: order, error } = await admin.from("orders").select("*").eq("order_code", code).maybeSingle();
  if (error) throw new Error(error.message);
  if (!order) return null;

  const { data: items, error: itemsError } = await admin
    .from("order_items")
    .select("product_id,product_name,unit_price,quantity,subtotal")
    .eq("order_id", order.id);

  if (itemsError) throw new Error(itemsError.message);

  return {
    orderCode: order.order_code,
    customerName: order.customer_name,
    customerEmail: order.customer_email,
    status: order.status,
    total: order.total,
    createdAt: order.created_at,
    updatedAt: order.updated_at,
    items: (items || []).map(i => ({
      id: i.product_id,
      nome: i.product_name,
      preco: i.unit_price,
      quantidade: i.quantity,
      subtotal: i.subtotal
    }))
  };
}

module.exports = async (req, res) => {
  try {
    const { user } = await getUser(req);
    if (!user) return json(res, 401, { error: "Não autenticado." });

    const profile = await getProfile(user.id);
    if (profile?.role !== "admin") return json(res, 403, { error: "Acesso negado." });

    const admin = supabaseAdmin();

    if (req.method === "GET") {
      const code = String(req.query?.id || req.query?.code || "").trim().toUpperCase();
      if (!code) return json(res, 400, { error: "Informe o ID do pedido." });

      const order = await loadOrder(admin, code);
      if (!order) return json(res, 404, { error: "Pedido não encontrado." });
      return json(res, 200, { order });
    }

    if (req.method === "PATCH") {
      const { orderCode, status } = req.body || {};
      const allowed = ["novo", "confirmado", "concluido", "cancelado"];
      if (!orderCode || !allowed.includes(status)) {
        return json(res, 400, { error: "Dados de atualização inválidos." });
      }

      const { error } = await admin.from("orders")
        .update({ status, updated_at: new Date().toISOString() })
        .eq("order_code", String(orderCode).trim().toUpperCase());

      if (error) return json(res, 500, { error: error.message });

      const order = await loadOrder(admin, String(orderCode).trim().toUpperCase());
      return json(res, 200, { order });
    }

    return json(res, 405, { error: "Método não permitido." });
  } catch (e) {
    return json(res, 500, { error: e.message || "Erro ao consultar o pedido." });
  }
};
