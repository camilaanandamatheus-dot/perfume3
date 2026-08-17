const { getUser, getProfile, supabaseAdmin, json } = require("./_lib");

module.exports = async (req, res) => {
  try {
    const { user } = await getUser(req);
    if (!user) return json(res, 401, { error: "Não autenticado." });

    const profile = await getProfile(user.id);
    if (profile?.role !== "admin") return json(res, 403, { error: "Acesso negado." });

    const admin = supabaseAdmin();
    const [{ data: metricsData, error: metricsError },
           { data: orders, error: ordersError },
           { data: users, error: usersError }] = await Promise.all([
      admin.rpc("admin_dashboard_metrics"),
      admin.from("orders").select("id,order_code,customer_name,customer_email,status,total,created_at").order("created_at", { ascending: false }).limit(100),
      admin.from("profiles").select("id,full_name,email,role,created_at").order("created_at", { ascending: false }).limit(100)
    ]);

    if (metricsError) return json(res, 500, { error: metricsError.message });
    if (ordersError) return json(res, 500, { error: ordersError.message });
    if (usersError) return json(res, 500, { error: usersError.message });

    const m = Array.isArray(metricsData) ? (metricsData[0] || {}) : (metricsData || {});
    return json(res, 200, {
      metrics: {
        uniqueVisitors: m.unique_visitors || 0,
        totalVisits: m.total_visits || 0,
        visitorsToday: m.visitors_today || 0,
        registeredUsers: m.registered_users || 0,
        orders: m.orders_count || 0,
        newOrders: m.new_orders_count || 0,
        orderValue: m.total_order_value || 0
      },
      orders: orders || [],
      users: users || []
    });
  } catch (e) {
    return json(res, 500, { error: e.message || "Erro ao carregar o painel." });
  }
};
