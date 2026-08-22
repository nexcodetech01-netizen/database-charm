import { createFileRoute } from '@tanstack/react-router';
import { associateVestuarioProductsFn } from '@/features/products/lib/collection-migration-v2.functions';
import { useState } from 'react';

export const Route = createFileRoute('/api/public/run-migration-v2')({
  component: MigrationPage,
});

function MigrationPage() {
  const [result, setResult] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  const runMigration = async () => {
    setLoading(true);
    try {
      const res = await associateVestuarioProductsFn();
      setResult(res);
    } catch (err: any) {
      setResult({ error: err.message });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ padding: '20px', fontFamily: 'sans-serif' }}>
      <h1>Migração V2: Associar Vestuário à Coleção Pública</h1>
      <button 
        id="run-migration-btn"
        onClick={runMigration} 
        disabled={loading}
        style={{ padding: '10px 20px', cursor: 'pointer' }}
      >
        {loading ? 'Executando...' : 'Executar Associação'}
      </button>
      
      {result && (
        <div id="migration-result" style={{ marginTop: '20px', padding: '10px', border: '1px solid #ccc' }}>
          <pre>{JSON.stringify(result, null, 2)}</pre>
        </div>
      )}
    </div>
  );
}
