import { deriveEventKey } from "../BellaEventRegistry";
export const vipInactiveDetector = {
    id: "customers.vip.inactive",
    module: "customers",
    detect(input, ctx) {
        const min = input.config?.minDaysWithoutPurchase ?? 45;
        const emit = [];
        const resolve = [];
        for (const c of input.customers) {
            if (!c.isVip)
                continue;
            const days = c.daysSinceLastPurchase ?? 0;
            if (days >= min) {
                emit.push({
                    type: "customers.vip.inactive",
                    tenantId: ctx.tenantId,
                    payload: { entityId: c.customerId, name: c.name, daysSinceLastPurchase: days },
                    source: "detector:customers.vip",
                });
            }
            else {
                resolve.push(deriveEventKey({
                    tenantId: ctx.tenantId,
                    type: "customers.vip.inactive",
                    payload: { entityId: c.customerId },
                }));
            }
        }
        return { emit, resolve };
    },
};
export const delinquentDetector = {
    id: "customers.became_delinquent",
    module: "customers",
    detect(customers, ctx) {
        const emit = [];
        const resolve = [];
        for (const c of customers) {
            if (c.hasOverdueInvoices) {
                emit.push({
                    type: "customers.became_delinquent",
                    tenantId: ctx.tenantId,
                    payload: { entityId: c.customerId, name: c.name },
                    source: "detector:customers.delinquent",
                });
            }
            else {
                resolve.push(deriveEventKey({
                    tenantId: ctx.tenantId,
                    type: "customers.became_delinquent",
                    payload: { entityId: c.customerId },
                }));
            }
        }
        return { emit, resolve };
    },
};
function endOfToday(now) {
    const end = new Date(now);
    end.setHours(23, 59, 59, 999);
    return end;
}
export const birthdayDetector = {
    id: "customers.birthday",
    module: "customers",
    detect(customers, ctx) {
        const emit = [];
        for (const c of customers) {
            if (!c.birthday)
                continue;
            if (c.birthday.getDate() === ctx.now.getDate() && c.birthday.getMonth() === ctx.now.getMonth()) {
                emit.push({
                    type: "customers.birthday",
                    tenantId: ctx.tenantId,
                    payload: { entityId: c.customerId, name: c.name },
                    expiresAt: endOfToday(ctx.now),
                    source: "detector:customers.birthday",
                });
            }
        }
        return { emit, resolve: [] };
    },
};
