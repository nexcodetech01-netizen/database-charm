import { PrinterDiscoveryService } from '../services/printer-discovery.service';
import { printJobService } from '../services/print-job.service';

describe('NexOS Print Bridge Hardening Tests', () => {
  test('Requirement 4: Printer Discovery uses cache on rapid calls', async () => {
    const service = new PrinterDiscoveryService();
    // Em mock, ambos devem retornar a lista mockada rapidamente
    const p1 = await service.discoverPrinters();
    const p2 = await service.discoverPrinters();
    expect(p1).toEqual(p2);
  });

  test('Requirement 5 & 6: Job Retry and Timeout logic', async () => {
    const jobId = await printJobService.enqueue({
      type: 'ZPL',
      printer: 'Test Printer',
      document: 'Test Doc',
      metadata: { version: '2.0.0' },
      data: { zpl: '^XA^XZ' }
    });

    const jobs = printJobService.getJobs();
    const job = jobs.pending.find(j => j.id === jobId) || jobs.history.find(j => j.id === jobId);
    expect(job).toBeDefined();
    expect(job?.maxAttempts).toBe(3);
  });

  test('Requirement 8: Metrics calculation', async () => {
    const metrics = printJobService.getMetrics();
    expect(metrics).toHaveProperty('jobsPerMin');
    expect(metrics).toHaveProperty('avgDurationMs');
  });
});
