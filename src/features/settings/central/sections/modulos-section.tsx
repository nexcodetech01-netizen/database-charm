import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { MODULES, useEnabledModules } from "@/features/modules";

/** Liga/desliga módulos do menu. Desligar só esconde — nada é apagado. */
export function ModulosSection() {
  const { isEnabled, setEnabled, isSaving, isLoading } = useEnabledModules();

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">Módulos do menu</CardTitle>
          <p className="text-xs text-muted-foreground">
            Desligue o que a sua loja não usa para deixar o menu mais limpo. Nenhum dado é apagado:
            ao ligar de novo, tudo volta como estava. Vendas, PDV, Produtos, Estoque, Compras,
            Financeiro e Caixa ficam sempre ligados.
          </p>
        </CardHeader>
        <CardContent className="divide-y divide-border p-0">
          {MODULES.map((m) => {
            const on = isEnabled(m.key);
            const id = `module-${m.key}`;
            return (
              <div key={m.key} className="flex items-start justify-between gap-4 px-6 py-4">
                <label htmlFor={id} className="min-w-0 cursor-pointer">
                  <span className="block text-sm font-medium">{m.title}</span>
                  <span className="block text-xs text-muted-foreground">{m.description}</span>
                  <span className="mt-1 block text-[11px] text-muted-foreground/80">
                    No menu: {m.menuItems.join(", ")}
                  </span>
                </label>
                <Switch
                  id={id}
                  checked={on}
                  disabled={isLoading || isSaving}
                  onCheckedChange={(v) => setEnabled(m.key, v)}
                  aria-label={`${on ? "Desligar" : "Ligar"} ${m.title}`}
                />
              </div>
            );
          })}
        </CardContent>
      </Card>
    </div>
  );
}
