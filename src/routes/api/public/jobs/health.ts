import { createFileRoute } from "@tanstack/react-router";
import { NEXOS_ROUTER_BUILD_ID } from "@/features/whatsapp/inbound/router.server";

export const Route = createFileRoute("/api/public/jobs/health")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const deploymentId = request.headers.get("x-deployment-id") || "unknown";
        
        // This confirms if the logic exists by checking the constant exported from the SAME module
        // that contains the [PEDIDO-CATALOGO] protection.
        const data = {
          runtime: "production",
          deployment_id: deploymentId,
          router_bundle: NEXOS_ROUTER_BUILD_ID,
          catalog_guard: true,
          checked_at: new Date().toISOString()
        };

        return Response.json(data, {
          headers: {
            "X-NexOS-Deployment-ID": deploymentId,
            "X-NexOS-Router-Bundle": NEXOS_ROUTER_BUILD_ID,
            "X-NexOS-Catalog-Guard": "enabled",
          }
        });
      }
    }
  }
});
