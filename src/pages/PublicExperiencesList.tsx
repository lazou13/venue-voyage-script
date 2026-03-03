import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Loader2, MapPin, ArrowRight } from "lucide-react";

interface CatalogItem {
  id: string;
  title: string;
  city: string;
  slug: string;
  price: number;
  currency: string;
  mode: string;
  short_desc: string;
}

export default function PublicExperiencesList() {
  const [items, setItems] = useState<CatalogItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from("projects")
        .select("id, hotel_name, city, title_i18n, quest_config");

      const catalog: CatalogItem[] = [];
      for (const p of data ?? []) {
        const qc = (p as any).quest_config;
        const cat = qc?.catalog;
        if (cat?.is_public && cat?.slug) {
          catalog.push({
            id: p.id,
            title: (p.title_i18n as any)?.fr || p.hotel_name || "Sans titre",
            city: p.city,
            slug: cat.slug,
            price: cat.price ?? 0,
            currency: cat.currency ?? "MAD",
            mode: qc?.experience_mode || cat.mode || "visit",
            short_desc: cat.short_desc ?? "",
          });
        }
      }
      setItems(catalog);
      setLoading(false);
    })();
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border bg-card px-4 py-6">
        <div className="max-w-4xl mx-auto text-center">
          <h1 className="text-3xl font-bold text-foreground">Nos expériences</h1>
          <p className="text-muted-foreground mt-2">
            Choisissez un parcours prêt à jouer dans la médina
          </p>
        </div>
      </header>

      <div className="max-w-4xl mx-auto px-4 py-8">
        {items.length === 0 ? (
          <div className="text-center py-16">
            <MapPin className="w-12 h-12 mx-auto text-muted-foreground/40 mb-4" />
            <h3 className="text-lg font-semibold text-foreground mb-1">Aucune expérience disponible</h3>
            <p className="text-muted-foreground text-sm">Revenez bientôt !</p>
            <Button asChild variant="outline" className="mt-4">
              <Link to="/experience">Créer une expérience sur-mesure</Link>
            </Button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {items.map((item) => (
              <Card key={item.id} className="card-hover">
                <CardContent className="pt-6 space-y-3">
                  <div className="flex items-start justify-between">
                    <div>
                      <h3 className="text-lg font-semibold text-foreground">{item.title}</h3>
                      <p className="text-sm text-muted-foreground">{item.city}</p>
                    </div>
                    <Badge variant={item.mode === "game" ? "default" : "secondary"}>
                      {item.mode === "game" ? "🎮 Jeu" : "🚶 Visite"}
                    </Badge>
                  </div>

                  {item.short_desc && (
                    <p className="text-sm text-muted-foreground">{item.short_desc}</p>
                  )}

                  <div className="flex items-center justify-between pt-2">
                    <span className="text-xl font-bold text-primary">
                      {item.price > 0 ? `${item.price} ${item.currency}` : "Gratuit"}
                    </span>
                    <Button asChild size="sm">
                      <Link to={`/experiences/${item.slug}`}>
                        Voir
                        <ArrowRight className="w-4 h-4 ml-1" />
                      </Link>
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        <div className="text-center mt-12">
          <p className="text-muted-foreground text-sm mb-3">Envie de quelque chose d'unique ?</p>
          <Button asChild variant="outline">
            <Link to="/experience">Créer une expérience sur-mesure</Link>
          </Button>
        </div>
      </div>
    </div>
  );
}
