/**
 * Gera insights determinísticos a partir dos eventos ativos.
 *
 * Sem IA — apenas regras de agregação. Consumido pela Home para narrar
 * o estado atual do ERP em frases curtas.
 */
export function generateInsights(events) {
    const insights = [];
    const byType = new Map();
    for (const event of events) {
        if (event.resolvedAt)
            continue;
        const list = byType.get(event.type) ?? [];
        list.push(event);
        byType.set(event.type, list);
    }
    const push = (module, severity, message, src) => {
        insights.push({
            id: `insight-${module}-${insights.length + 1}`,
            module,
            severity,
            message,
            eventIds: src.map((e) => e.id),
        });
    };
    const out = byType.get("inventory.out_of_stock");
    if (out && out.length > 0) {
        push("inventory", "critical", `${out.length} produto(s) esgotado(s).`, out);
    }
    const min = byType.get("inventory.min_stock_reached");
    if (min && min.length > 0) {
        push("inventory", "warning", `${min.length} produto(s) abaixo do estoque mínimo.`, min);
    }
    const slow = byType.get("inventory.slow_moving");
    if (slow && slow.length > 0) {
        push("inventory", "info", `${slow.length} produto(s) sem giro no período.`, slow);
    }
    const overdue = byType.get("finance.invoice.overdue");
    if (overdue && overdue.length > 0) {
        push("finance", "critical", `${overdue.length} cobrança(s) vencida(s).`, overdue);
    }
    const negative = byType.get("finance.cashflow.negative");
    if (negative && negative.length > 0) {
        push("finance", "critical", "Caixa negativo no período.", negative);
    }
    const revUp = byType.get("finance.revenue.above_average");
    if (revUp && revUp.length > 0) {
        push("finance", "success", "Receita acima da média histórica.", revUp);
    }
    const revDown = byType.get("finance.revenue.below_average");
    if (revDown && revDown.length > 0) {
        push("finance", "warning", "Receita abaixo da média histórica.", revDown);
    }
    const expElev = byType.get("finance.expense.elevated");
    if (expElev && expElev.length > 0) {
        push("finance", "warning", "Despesas elevadas no período.", expElev);
    }
    const delinq = byType.get("customers.became_delinquent");
    if (delinq && delinq.length > 0) {
        push("customers", "warning", `${delinq.length} cliente(s) ficaram inadimplentes.`, delinq);
    }
    const vip = byType.get("customers.vip.inactive");
    if (vip && vip.length > 0) {
        push("customers", "warning", `${vip.length} cliente(s) VIP sem comprar.`, vip);
    }
    const bday = byType.get("customers.birthday");
    if (bday && bday.length > 0) {
        push("customers", "info", `${bday.length} cliente(s) aniversariando hoje.`, bday);
    }
    const back = byType.get("customers.returned_to_buy");
    if (back && back.length > 0) {
        push("customers", "success", `${back.length} cliente(s) voltaram a comprar.`, back);
    }
    const goal = byType.get("sales.goal_reached");
    if (goal && goal.length > 0) {
        push("sales", "success", "Meta de vendas atingida.", goal);
    }
    const decl = byType.get("sales.decline");
    if (decl && decl.length > 0) {
        push("sales", "warning", "Queda relevante nas vendas.", decl);
    }
    const ticket = byType.get("sales.average_ticket.drop");
    if (ticket && ticket.length > 0) {
        push("sales", "warning", "Ticket médio abaixo do padrão recente.", ticket);
    }
    return insights;
}
