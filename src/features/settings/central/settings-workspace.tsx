import { useMemo, useState, useEffect } from "react";
import { Link, useSearch, useNavigate } from "@tanstack/react-router";
import { Search, Settings, Star, TrendingUp, Info } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import { SETTINGS_SECTIONS } from "./registry";
import type {
  SettingsSectionDefinition,
  SettingsSectionId,
} from "./types";

const FAVORITES_KEY = "nexos:settings:favorites";

function loadFavorites(): SettingsSectionId[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(FAVORITES_KEY);
    return raw ? (JSON.parse(raw) as SettingsSectionId[]) : [];
  } catch {
    return [];
  }
}

function normalize(v: string): string {
  return v
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

export function SettingsWorkspace() {
  const search = useSearch({ strict: false }) as { section?: string } | undefined;
  const navigate = useNavigate();
  const initialSection = (SETTINGS_SECTIONS.find((s) => s.id === search?.section)?.id ??
    "empresa") as SettingsSectionId;
  const [active, setActiveState] = useState<SettingsSectionId>(initialSection);
  const [searchText, setSearch] = useState("");
  const [favorites, setFavorites] = useState<SettingsSectionId[]>(() => loadFavorites());

  useEffect(() => {
    if (typeof window === "undefined") return;
    window.localStorage.setItem(FAVORITES_KEY, JSON.stringify(favorites));
  }, [favorites]);

  // Sincroniza estado quando o parâmetro ?section= mudar (deep link).
  useEffect(() => {
    const target = SETTINGS_SECTIONS.find((s) => s.id === search?.section)?.id;
    if (target && target !== active) setActiveState(target as SettingsSectionId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search?.section]);

  const setActive = (id: SettingsSectionId) => {
    setActiveState(id);
    navigate({
      to: "/configuracoes",
      search: { section: id },
      replace: true,
    });
  };

  const toggleFavorite = (id: SettingsSectionId) => {
    setFavorites((prev) =>
      prev.includes(id) ? prev.filter((p) => p !== id) : [...prev, id],
    );
  };

  const filtered = useMemo(() => {
    const q = normalize(searchText.trim());
    if (!q) return SETTINGS_SECTIONS;
    return SETTINGS_SECTIONS.filter((s) => {
      const haystack = [
        s.title,
        s.description,
        s.hint ?? "",
        s.group,
        ...(s.searchTerms ?? []),
      ]
        .map(normalize)
        .join(" ");
      return haystack.includes(q);
    });
  }, [searchText]);


  const current = SETTINGS_SECTIONS.find((s) => s.id === active) ?? SETTINGS_SECTIONS[0];
  const Current = current.component;
  const CurrentIcon = current.icon;

  return (
    <div className="mx-auto w-full max-w-7xl space-y-4 p-4 sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-semibold tracking-tight">
            <Settings className="h-5 w-5 text-primary" />
            Configurações
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Você vende. O NexOS cuida do resto. Organize aqui empresa, equipe e canais.
          </p>
        </div>
        <Button asChild size="sm" variant="outline">
          <Link to="/configuracoes/precificacao">
            <TrendingUp className="mr-1.5 h-4 w-4" /> Política de preços
          </Link>
        </Button>
      </div>

      <div className="grid gap-4 lg:grid-cols-[260px_minmax(0,1fr)]">
        <aside className="rounded-lg border bg-card/40">
          <div className="border-b p-2">
            <div className="relative">
              <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={searchText}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Pesquisar (ex.: PIX, usuário, cupom)…"
                className="h-8 pl-8 text-sm"
              />
            </div>
          </div>
          <ScrollArea className="max-h-[70vh]">
            <nav className="p-2">
              {favorites.length > 0 ? (
                <div className="mb-2">
                  <p className="px-2 pb-1 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                    Favoritos
                  </p>
                  <ul className="space-y-0.5">
                    {favorites
                      .map((id) => SETTINGS_SECTIONS.find((s) => s.id === id))
                      .filter((s): s is SettingsSectionDefinition => !!s)
                      .map((s) => (
                        <SectionButton
                          key={`fav-${s.id}`}
                          section={s}
                          active={active === s.id}
                          onSelect={() => setActive(s.id)}
                          favorite
                          onToggleFavorite={() => toggleFavorite(s.id)}
                        />
                      ))}
                  </ul>
                </div>
              ) : null}

              <ul className="space-y-0.5">
                {filtered.map((s) => (
                  <SectionButton
                    key={s.id}
                    section={s}
                    active={active === s.id}
                    onSelect={() => setActive(s.id)}
                    favorite={favorites.includes(s.id)}
                    onToggleFavorite={() => toggleFavorite(s.id)}
                  />
                ))}
              </ul>

              {filtered.length === 0 ? (
                <p className="px-3 py-6 text-center text-xs text-muted-foreground">
                  Nenhuma configuração encontrada.
                </p>
              ) : null}
            </nav>
          </ScrollArea>
        </aside>

        <section className="min-w-0 space-y-4">
          <div className="rounded-lg border bg-card/40 px-4 py-3">
            <div className="flex items-center gap-3">
              <div className="grid h-10 w-10 place-items-center rounded-lg bg-primary/10 text-primary">
                <CurrentIcon className="h-5 w-5" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <h2 className="truncate text-base font-semibold">{current.title}</h2>
                </div>
                <p className="truncate text-xs text-muted-foreground">{current.description}</p>
              </div>
            </div>
            {current.hint || current.whenToUse ? (
              <div className="mt-3 flex items-start gap-2 rounded-md border border-dashed bg-muted/30 p-3 text-xs text-muted-foreground">
                <Info className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary" />
                <div className="space-y-0.5">
                  {current.hint ? (
                    <p>
                      <span className="font-medium text-foreground">Para que serve: </span>
                      {current.hint}
                    </p>
                  ) : null}
                  {current.whenToUse ? (
                    <p>
                      <span className="font-medium text-foreground">Quando usar: </span>
                      {current.whenToUse}
                    </p>
                  ) : null}
                </div>
              </div>
            ) : null}
          </div>

          <div className="motion-safe:animate-in motion-safe:fade-in motion-safe:duration-200">
            <Current />
          </div>
        </section>
      </div>
    </div>
  );
}

function SectionButton({
  section,
  active,
  onSelect,
  favorite,
  onToggleFavorite,
}: {
  section: SettingsSectionDefinition;
  active: boolean;
  onSelect: () => void;
  favorite: boolean;
  onToggleFavorite: () => void;
}) {
  const Icon = section.icon;
  return (
    <li className="group flex items-center gap-1">
      <button
        type="button"
        onClick={onSelect}
        className={cn(
          "flex min-w-0 flex-1 items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm transition",
          active
            ? "bg-primary/10 text-primary"
            : "text-foreground/80 hover:bg-muted hover:text-foreground",
        )}
      >
        <Icon className="h-4 w-4 shrink-0" />
        <span className="truncate">{section.title}</span>
      </button>
      <button
        type="button"
        aria-label={favorite ? "Remover dos favoritos" : "Marcar como favorito"}
        onClick={onToggleFavorite}
        className={cn(
          "grid h-6 w-6 place-items-center rounded text-muted-foreground opacity-0 transition hover:text-foreground group-hover:opacity-100",
          favorite && "text-amber-500 opacity-100 hover:text-amber-600",
        )}
      >
        <Star className={cn("h-3.5 w-3.5", favorite && "fill-current")} />
      </button>
    </li>
  );
}
