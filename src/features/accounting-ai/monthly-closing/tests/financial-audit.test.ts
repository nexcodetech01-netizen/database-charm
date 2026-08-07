import { describe, it, expect } from 'vitest';
import { auditFinancialClosing } from '../queries/financial-audit';
import { AccountingSummary } from '../../types';

describe('auditFinancialClosing', () => {
  const mockSummary = (overrides = {}): AccountingSummary => ({
    companyId: 'test-company',
    period: { start: '2026-07-01', end: '2026-07-31' },
    generatedAt: new Date().toISOString(),
    revenue: { available: true, data: { netRevenue: 10000, grossRevenue: 12000, deductions: 2000, period: { start: '2026-07-01', end: '2026-07-31' } }, source: 'accounting', generatedAt: '' },
    today: { available: true, data: { date: '2026-07-15', total: 500, count: 5 }, source: 'sales', generatedAt: '' },
    trends: { available: false, data: null, source: 'accounting', generatedAt: '' },
    profit: { 
      available: true, 
      data: { 
        netProfit: 2000, 
        grossProfit: 5000, 
        operatingResult: 3000, 
        ebitda: 3500,
        grossMargin: 50,
        operatingMargin: 30,
        netMargin: 20,
        ebitdaMargin: 35,
        period: { start: '2026-07-01', end: '2026-07-31' }
      }, 
      source: 'accounting', 
      generatedAt: '' 
    },
    expenses: { available: true, data: { totalExpenses: 8000, cogs: 5000, operatingExpenses: 2000, financialExpenses: 500, otherExpenses: 500, cogsRatio: 50, expenseRatio: 20, period: { start: '2026-07-01', end: '2026-07-31' } }, source: 'accounting', generatedAt: '' },
    cash: { 
      available: true, 
      data: { 
        currentBalance: 5000, 
        receivable: 3000, 
        receivableOverdue: 0, 
        payable: 1000, 
        projected: 7000, 
        openSessions: 0 
      }, 
      source: 'finance', 
      generatedAt: '' 
    },
    cashFlow: { available: true, data: { incoming: 5000, outgoing: 3000, net: 2000, projectedBalance: 7000, horizonDays: 30, monthly: [] }, source: 'finance', generatedAt: '' },
    taxes: { available: true, data: { taxAmount: 1000, revenue: 10000, competence: '2026-07', effectiveRate: 10, status: 'pending', dueDate: '2026-08-20' }, source: 'fiscal', generatedAt: '' },
    inventory: { available: false, data: null, source: 'inventory', generatedAt: '' },
    ticket: { available: false, data: null, source: 'sales', generatedAt: '' },
    margin: { available: false, data: null, source: 'accounting', generatedAt: '' },
    products: { available: false, data: null, source: 'reports', generatedAt: '' },
    customers: { available: false, data: null, source: 'reports', generatedAt: '' },
    payroll: { available: true, data: { suggestedAmount: 1000, basis: 2000, suggestedRate: 50, reserveAmount: 500, reserveRate: 25, distributableProfit: 1500, confident: true, rationale: 'OK', period: { start: '2026-07-01', end: '2026-07-31' } }, source: 'accounting', generatedAt: '' },
    health: { 
      available: true, 
      data: { 
        score: 85, 
        level: 'healthy', 
        financial: { score: 85, level: 'healthy', liquidity: 5, workingCapital: 4000, debtRatio: 0.2, reasons: [] },
        highlights: [],
        warnings: []
      }, 
      source: 'accounting', 
      generatedAt: '' 
    },
    ...overrides
  });

  it('deve gerar score financeiro baseado na saude financeira', () => {
    const audit = auditFinancialClosing(mockSummary(), '2026-07');
    expect(audit.healthScore.score).toBe(85);
    expect(audit.healthScore.level).toBe('Boa');
  });

  it('deve identificar recebiveis vencidos como erro no checklist', () => {
    const summary = mockSummary({
      cash: {
        available: true,
        data: { currentBalance: 5000, receivable: 3000, receivableOverdue: 1000, payable: 1000, projected: 7000, openSessions: 0 },
        source: 'finance',
        generatedAt: ''
      }
    });
    const audit = auditFinancialClosing(summary, '2026-07');
    const overdueItem = audit.checklist.find(i => i.id === 'fin_overdue_rec');
    expect(overdueItem?.status).toBe('error');
  });

  it('deve identificar lucro liquido negativo como erro no checklist', () => {
    const summary = mockSummary({
      profit: {
        available: true,
        data: { netProfit: -500, grossProfit: 1000, operatingResult: -300, ebitda: -200, grossMargin: 10, operatingMargin: -3, netMargin: -5, ebitdaMargin: -2, period: { start: '2026-07-01', end: '2026-07-31' } },
        source: 'accounting',
        generatedAt: ''
      }
    });
    const audit = auditFinancialClosing(summary, '2026-07');
    const profitItem = audit.checklist.find(i => i.id === 'fin_net_loss');
    expect(profitItem?.status).toBe('error');
  });

  it('deve gerar resumo da Bella utilizando Advisor', () => {
    const audit = auditFinancialClosing(mockSummary(), '2026-07');
    expect(audit.summary.monthSummary).toContain('Auditoria financeira');
    expect(audit.summary.finalRecommendation).toBeDefined();
  });
});
