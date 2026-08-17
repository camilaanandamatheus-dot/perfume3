const { getUser, getProfile, supabaseAdmin, json } = require("./_lib");
const products = require("./products");

module.exports = async (req, res) => {
  if (req.method !== "POST") return json(res, 405, { error: "Método não permitido." });

  try {
    const { user } = await getUser(req);
    if (!user) return json(res, 401, { error: "Faça login para finalizar o pedido." });

    const { items } = req.body || {};
    if (!Array.isArray(items) || !items.length) return json(res, 400, { error: "Seu carrinho está vazio." });

    const normalized = [];
    let total = 0;

    for (const raw of items) {
      const id = Number(raw.id);
      const quantidade = Number(raw.quantidade);
      const product = products.find(p => p.id === id);

      if (!product) return json(res, 400, { error: `Produto ${id} não encontrado.` });
      if (!Number.isInteger(quantidade) || quantidade < 1 || quantidade > 20) {
        return json(res, 400, { error: "Quantidade de produto inválida." });
      }

      const subtotal = Number((product.preco * quantidade).toFixed(2));
      total += subtotal;
      normalized.push({
        product_id: product.id,
        product_name: product.nome,
        unit_price: product.preco,
        quantity: quantidade,
        subtotal
      });
    }

    total = Number(total.toFixed(2));

    const profile = await getProfile(user.id);
    const customerEmail = user.email || profile?.email || "";
    const customerName = profile?.full_name || user.user_metadata?.full_name || "Cliente Sutan";
    const code = "SUT-" + new Date().toISOString().slice(0, 10).replace(/-/g, "") + "-" +
      Math.random().toString(36).slice(2, 8).toUpperCase();

    const admin = supabaseAdmin();
    const { data: order, error: orderError } = await admin.from("orders").insert({
      order_code: code,
      user_id: user.id,
      customer_email: customerEmail,
      customer_name: customerName,
      status: "novo",
      total
    }).select("*").single();

    if (orderError) return json(res, 500, { error: orderError.message });

    const rows = normalized.map(i => ({ ...i, order_id: order.id }));
    const { error: itemError } = await admin.from("order_items").insert(rows);

    if (itemError) {
      await admin.from("orders").delete().eq("id", order.id);
      return json(res, 500, { error: itemError.message });
    }

    return json(res, 200, {
      orderCode: order.order_code,
      customerName: order.customer_name,
      customerEmail: order.customer_email,
      total: order.total,
      createdAt: order.created_at,
      items: normalized.map(i => ({
        id: i.product_id,
        nome: i.product_name,
        preco: i.unit_price,
        quantidade: i.quantity,
        subtotal: i.subtotal
      }))
    });
  } catch (e) {
    return json(res, 500, { error: e.message || "Erro ao criar pedido." });
  }
};
