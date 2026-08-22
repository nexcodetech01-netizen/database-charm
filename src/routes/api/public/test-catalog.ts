import { createFileRoute } from '@tanstack/react-router'
import { testCatalogAutomation } from '@/features/catalog/__tests__/catalog-automation.test'

export const Route = createFileRoute('/api/public/test-catalog')({
  server: {
    handlers: {
      GET: async () => {
        try {
          await testCatalogAutomation()
          return new Response(JSON.stringify({ ok: true, message: 'Test passed' }), {
            headers: { 'Content-Type': 'application/json' }
          })
        } catch (error: any) {
          return new Response(JSON.stringify({ ok: false, error: error.message }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' }
          })
        }
      }
    }
  }
})
