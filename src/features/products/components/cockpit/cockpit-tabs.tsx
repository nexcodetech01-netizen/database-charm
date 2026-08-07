import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Package, Boxes, FileText, ShoppingCart, Globe, History } from "lucide-react";

interface ProductCockpitTabsProps {
  activeTab: string;
  onTabChange: (tab: string) => void;
  children: React.ReactNode;
}

export function ProductCockpitTabs({ activeTab, onTabChange, children }: ProductCockpitTabsProps) {
  return (
    <Tabs value={activeTab} onValueChange={onTabChange} className="space-y-6">
      <TabsList className="grid w-full grid-cols-3 lg:grid-cols-6 h-auto p-1 bg-muted/50">
        <TabsTrigger value="geral" className="py-2.5 gap-2">
          <Package className="h-4 w-4" />
          <span className="hidden sm:inline">Geral</span>
        </TabsTrigger>
        <TabsTrigger value="estoque" className="py-2.5 gap-2">
          <Boxes className="h-4 w-4" />
          <span className="hidden sm:inline">Estoque</span>
        </TabsTrigger>
        <TabsTrigger value="fiscal" className="py-2.5 gap-2">
          <FileText className="h-4 w-4" />
          <span className="hidden sm:inline">Fiscal</span>
        </TabsTrigger>
        <TabsTrigger value="compras" className="py-2.5 gap-2">
          <ShoppingCart className="h-4 w-4" />
          <span className="hidden sm:inline">Compras</span>
        </TabsTrigger>
        <TabsTrigger value="marketplace" className="py-2.5 gap-2">
          <Globe className="h-4 w-4" />
          <span className="hidden sm:inline">Marketplace</span>
        </TabsTrigger>
        <TabsTrigger value="historico" className="py-2.5 gap-2">
          <History className="h-4 w-4" />
          <span className="hidden sm:inline">Histórico</span>
        </TabsTrigger>
      </TabsList>
      {children}
    </Tabs>
  );
}
