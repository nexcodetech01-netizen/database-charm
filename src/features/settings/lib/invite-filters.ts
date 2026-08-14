/**
 * Filtro de revogação de convite — extraído como função pura testável.
 *
 * Bug real de segurança (2026-08-14, auditoria de Onboarding/Convites):
 * `revokeInvite` filtrava só por `id` do convite, sem restringir por
 * `company_id`. A checagem de permissão (`settings.delete`) confirma que
 * o usuário TEM essa permissão na própria empresa dele, mas sem este
 * filtro, ele poderia revogar um convite de QUALQUER empresa só sabendo
 * o UUID do convite — a permissão não protegia a linha específica sendo
 * alterada, só confirmava que o usuário tinha aquele nível de acesso em
 * algum lugar.
 */
export function buildRevokeInviteFilter(inviteId: string, companyId: string) {
  return {
    id: inviteId,
    company_id: companyId,
    status: "pending" as const,
  };
}
