# Proteger retiradas acima do teto seguro

## Implementação
- Bloquear a retirada acima do máximo seguro quando faltar confirmação explícita ou motivo válido.
- Exigir motivo com pelo menos cinco caracteres na janela de retirada.
- Registrar no histórico financeiro que a retirada excedeu o teto e qual foi o motivo.
- Usar a data local da empresa para evitar mudança de dia ou mês por UTC.
- Validar tipos, testes da retirada e compilação.
