import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Sparkles, Loader2 } from "lucide-react";
import { BulkNcmDialog } from "./bulk-ncm-dialog";

interface Props {
  companyId: string;
}

export function NcmClassificationDashboard({ companyId }: Props) {
  const [onlyWithoutNcm, setOnlyWithoutNcm] = useState(true);
  const [groupBy, setGroupBy] = useState<"category" | "material" | "brand">("category");

  const { data: stats = [], isLoading } = useQuery({
    queryKey: ["products", "ncm-stats", companyId, onlyWithoutNcm, groupBy],
    queryFn: async () => {
      let query = supabase
        .from("products")
        .select("id, category_id, material, brand, ncm, product_categories(name)")
        .eq("company_id", companyId);

      if (onlyWithoutNcm) {
        query = query.or("ncm.is.null,ncm.eq.");
      }

      const { data, error } = await query;
      if (error) throw error;

      const groups: Record<string, number> = {};
      data.forEach((p: any) => {
        let key = "Não informado";
        if (groupBy === "category") key = p.product_categories?.name || "Sem categoria";
        else if (groupBy === "material") key = p.material || "Sem material";
        else if (groupBy === "brand") key = p.brand || "Sem marca";
        
        groups[key] = (groups[key] || 0) + 1;
      });

      return Object.entries(groups)
        .map(([name, count]) => ({ name, count }))
        .sort((a, b) => b.count - a.count);
    }
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle>Produtos</CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="flex items-center space-x-2">
          <Checkbox 
            id="without-ncm" 
            checked={onlyWithoutNcm} 
            onCheckedChange={(checked) => setOnlyWithoutNcm(!!checked)} 
          />
          <Label htmlFor="without-ncm">Somente produtos sem NCM</Label>
        </div>

        <div className="space-y-3">
          <Label>Agrupar por:</Label>
          <RadioGroup 
            value={groupBy} 
            onValueChange={(v: any) => setGroupBy(v)}
            className="flex flex-col space-y-1"
          >
            <div className="flex items-center space-x-2">
              <RadioGroupItem value="category" id="group-category" />
              <Label htmlFor="group-category">Categoria</Label>
            </div>
            <div className="flex items-center space-x-2">
              <RadioGroupItem value="material" id="group-material" />
              <Label htmlFor="group-material">Material</Label>
            </div>
            <div className="flex items-center space-x-2">
              <RadioGroupItem value="brand" id="group-brand" />
              <Label htmlFor="group-brand">Marca</Label>
            </div>
          </RadioGroup>
        </div>

        <div className="border-t pt-4">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{groupBy === "category" ? "Categoria" : groupBy === "material" ? "Material" : "Marca"}</TableHead>
                <TableHead className="text-right">Produtos</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow><TableCell colSpan={2} className="text-center animate-pulse">Carregando...</TableCell></TableRow>
              ) : stats.length === 0 ? (
                <TableRow><TableCell colSpan={2} className="text-center text-muted-foreground">Nenhum produto encontrado</TableCell></TableRow>
              ) : (
                stats.map((s) => (
                  <TableRow key={s.name}>
                    <TableCell className="font-medium">{s.name}</TableCell>
                    <TableCell className="text-right">{s.count}</TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>

        <div className="flex justify-end pt-4">
          <BulkNcmDialog companyId={companyId} />
        </div>
      </CardContent>
    </Card>
  );
}
