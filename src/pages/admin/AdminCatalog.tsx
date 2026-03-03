import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Loader2, Store, Save, ExternalLink } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface CatalogData {
  is_public: boolean;
  slug: string;
  price: number;
  currency: string;
  mode: string;
  short_desc: string;
}

interface ProjectRow {
  id: string;
  hotel_name: string;
  city: string;
  title_i18n: Record<string, string>;
  quest_config: Record<string, any>;
}

const DEFAULT_CATALOG: CatalogData = {
  is_public: false,
  slug: "",
  price: 0,
  currency: "MAD",
  mode: "visit",
  short_desc: "",
};

export default function AdminCatalog() {
  const { toast } = useToast();
  const [projects, setProjects] = useState<ProjectRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);
  const [edits, setEdits] = useState<Record<string, CatalogData>>({});

  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from("projects")
        .select("id, hotel_name, city, title_i18n, quest_config")
        .order("created_at", { ascending: false });
      setProjects((data as unknown as ProjectRow[]) ?? []);
      const initial: Record<string, CatalogData> = {};
      for (const p of data ?? []) {
        const qc = (p as any).quest_config as Record<string, any>;
        initial[p.id] = { ...DEFAULT_CATALOG, ...(qc?.catalog ?? {}) };
      }
      setEdits(initial);
      setLoading(false);
    })();
  }, []);

  const updateField = (id: string, field: keyof CatalogData, value: any) => {
    setEdits((prev) => ({
      ...prev,
      [id]: { ...prev[id], [field]: value },
    }));
  };

  const handleSave = async (project: ProjectRow) => {
    setSaving(project.id);
    const catalog = edits[project.id];
    if (catalog.is_public && !catalog.slug.trim()) {
      toast({ title: "Erreur", description: "Le slug est requis pour un projet public.", variant: "destructive" });
      setSaving(null);
      return;
    }
    const newQuestConfig = { ...project.quest_config, catalog };
    const { error } = await supabase
      .from("projects")
      .update({ quest_config: newQuestConfig as any })
      .eq("id", project.id);
    if (error) {
      toast({ title: "Erreur", description: error.message, variant: "destructive" });
    } else {
      // Update local state
      setProjects((prev) =>
        prev.map((p) =>
          p.id === project.id ? { ...p, quest_config: newQuestConfig } : p,
        ),
      );
      toast({ title: "Sauvegardé", description: `Catalogue mis à jour pour ${project.hotel_name}.` });
    }
    setSaving(null);
  };

  const title = (p: ProjectRow) =>
    (p.title_i18n as any)?.fr || p.hotel_name || "Sans titre";

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-6 h-6 animate-spin text-primary" />
      </div>
    );
  }

  const publicCount = Object.values(edits).filter((c) => c.is_public).length;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold flex items-center gap-2">
            <Store className="w-6 h-6 text-primary" />
            Catalogue public
          </h2>
          <p className="text-muted-foreground text-sm mt-1">
            Marquez des projets comme disponibles publiquement.{" "}
            <Badge variant="outline">{publicCount} public(s)</Badge>
          </p>
        </div>
        <Button variant="outline" size="sm" asChild>
          <a href="/experiences" target="_blank" rel="noopener noreferrer">
            <ExternalLink className="w-4 h-4 mr-1" />
            Voir le catalogue
          </a>
        </Button>
      </div>

      {projects.length === 0 && (
        <p className="text-muted-foreground text-center py-10">Aucun projet trouvé.</p>
      )}

      <div className="space-y-4">
        {projects.map((p) => {
          const cat = edits[p.id] ?? DEFAULT_CATALOG;
          return (
            <Card key={p.id} className={cat.is_public ? "border-primary/40" : ""}>
              <CardContent className="pt-5 space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="font-semibold text-foreground">{title(p)}</h3>
                    <p className="text-xs text-muted-foreground">{p.city} · {p.id.slice(0, 8)}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Label htmlFor={`pub-${p.id}`} className="text-sm">Public</Label>
                    <Switch
                      id={`pub-${p.id}`}
                      checked={cat.is_public}
                      onCheckedChange={(v) => updateField(p.id, "is_public", v)}
                    />
                  </div>
                </div>

                {cat.is_public && (
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <div>
                      <Label>Slug *</Label>
                      <Input
                        value={cat.slug}
                        onChange={(e) =>
                          updateField(p.id, "slug", e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, "").slice(0, 60))
                        }
                        placeholder="mystere-des-souks"
                        maxLength={60}
                      />
                    </div>
                    <div>
                      <Label>Prix</Label>
                      <Input
                        type="number"
                        min={0}
                        value={cat.price}
                        onChange={(e) => updateField(p.id, "price", Number(e.target.value) || 0)}
                      />
                    </div>
                    <div>
                      <Label>Mode</Label>
                      <Select value={cat.mode} onValueChange={(v) => updateField(p.id, "mode", v)}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="visit">Visite</SelectItem>
                          <SelectItem value="game">Jeu</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="sm:col-span-3">
                      <Label>Description courte</Label>
                      <Textarea
                        value={cat.short_desc}
                        onChange={(e) => updateField(p.id, "short_desc", e.target.value.slice(0, 300))}
                        placeholder="Découvrez les secrets de la médina…"
                        maxLength={300}
                        rows={2}
                      />
                    </div>
                  </div>
                )}

                <div className="flex justify-end">
                  <Button
                    size="sm"
                    onClick={() => handleSave(p)}
                    disabled={saving === p.id}
                  >
                    {saving === p.id ? (
                      <Loader2 className="w-4 h-4 mr-1 animate-spin" />
                    ) : (
                      <Save className="w-4 h-4 mr-1" />
                    )}
                    Sauvegarder
                  </Button>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
