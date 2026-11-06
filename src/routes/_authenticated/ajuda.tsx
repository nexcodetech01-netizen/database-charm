import { createFileRoute } from "@tanstack/react-router";
import { LifeBuoy } from "lucide-react";
import { PageLayout } from "@/components/layout";
import { HelpGuide } from "@/features/help/components/help-guide";

export const Route = createFileRoute("/_authenticated/ajuda")({
  head: () => ({ meta: [{ title: "Ajuda | NexOS" }] }),
  component: HelpPage,
});

function HelpPage() {
  return (
    <PageLayout
      title="Ajuda"
      description="Como fazer cada coisa no NexOS. Busque uma palavra ou escolha o tema."
      icon={LifeBuoy}
    >
      <HelpGuide />
    </PageLayout>
  );
}
