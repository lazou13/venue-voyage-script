import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Loader2, ArrowLeft, AlertCircle, MapPin, Clock, Users } from "lucide-react";

interface CatalogProject {
  id: string;
  title: string;
  city: string;
  slug: string;
  price: number;
  currency: string;
  mode: string;
  short_desc: string;
}

export default function PublicExperienceDetail() {
  const { slug } = useParams<{ slug: string }>();
  const [project, setProject] = useState<CatalogProject | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  // Form
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [partySize, setPartySize] = useState(2);
  const [honeypot, setHoneypot] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!slug) return;
    (async () => {
      const { data } = await supabase
        .from("projects")
        .select("id, hotel_name, city, title_i18n, quest_config");

      const match = (data ?? []).find((p: any) => {
        const cat = p.quest_config?.catalog;
        return cat?.is_public === true && cat?.slug === slug;
      });

      if (match) {
        const cat = (match as any).quest_config.catalog;
        const qc = (match as any).quest_config;
        setProject({
          id: match.id,
          title: (match.title_i18n as any)?.fr || match.hotel_name || "Sans titre",
          city: match.city,
          slug: cat.slug,
          price: cat.price ?? 0,
          currency: cat.currency ?? "MAD",
          mode: qc.experience_mode || cat.mode || "visit",
          short_desc: cat.short_desc ?? "",
        });
      } else {
        setNotFound(true);
      }
      setLoading(false);
    })();
  }, [slug]);

  const handleStart = async () => {
    setError(null);
    setSubmitting(true);

    try {
      const { data, error: fnError } = await supabase.functions.invoke(
        "public-buy-catalog",
        {
          body: {
            slug,
            customer_name: name,
            customer_email: email || undefined,
            locale: "fr",
            party_size: partySize,
            honeypot_website: honeypot,
          },
        },
      );

      if (fnError) {
        setError((fnError as any)?.message ?? "Erreur serveur");
        setSubmitting(false);
        return;
      }

      if (data?.error) {
        if (data.error.includes("Rate limit")) {
          setError("Trop de demandes récentes. Réessayez dans une heure.");
        } else {
          setError(data.error);
        }
        setSubmitting(false);
        return;
      }

      if (data?.access_token) {
        window.location.href = `/play?token=${data.access_token}`;
      } else {
        setError("Réponse inattendue du serveur.");
        setSubmitting(false);
      }
    } catch (e: any) {
      setError(e?.message ?? "Erreur réseau.");
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (notFound || !project) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-background gap-4">
        <MapPin className="w-12 h-12 text-muted-foreground/40" />
        <h2 className="text-xl font-semibold">Expérience introuvable</h2>
        <Button asChild variant="outline">
          <Link to="/experiences">
            <ArrowLeft className="w-4 h-4 mr-1" />
            Retour au catalogue
          </Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border bg-card px-4 py-4">
        <div className="max-w-3xl mx-auto">
          <Button asChild variant="ghost" size="sm">
            <Link to="/experiences">
              <ArrowLeft className="w-4 h-4 mr-1" />
              Catalogue
            </Link>
          </Button>
        </div>
      </header>

      <div className="max-w-3xl mx-auto px-4 py-8">
        <div className="grid grid-cols-1 md:grid-cols-5 gap-8">
          {/* Details */}
          <div className="md:col-span-3 space-y-4">
            <Badge variant={project.mode === "game" ? "default" : "secondary"}>
              {project.mode === "game" ? "🎮 Jeu / Quête" : "🚶 Visite guidée"}
            </Badge>
            <h1 className="text-3xl font-bold text-foreground">{project.title}</h1>
            <p className="text-muted-foreground flex items-center gap-1">
              <MapPin className="w-4 h-4" /> {project.city}
            </p>
            {project.short_desc && (
              <p className="text-foreground leading-relaxed">{project.short_desc}</p>
            )}
          </div>

          {/* Buy card */}
          <div className="md:col-span-2">
            <Card className="border-primary/30 sticky top-8">
              <CardContent className="pt-6 space-y-4">
                <div className="text-center">
                  <span className="text-3xl font-bold text-primary">
                    {project.price > 0 ? `${project.price} ${project.currency}` : "Gratuit"}
                  </span>
                  <p className="text-xs text-muted-foreground mt-1">par groupe</p>
                </div>

                <div className="space-y-3">
                  <div>
                    <Label htmlFor="detail-name">Nom (optionnel)</Label>
                    <Input
                      id="detail-name"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder="Jean"
                      maxLength={80}
                    />
                  </div>
                  <div>
                    <Label htmlFor="detail-email">Email (optionnel)</Label>
                    <Input
                      id="detail-email"
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="jean@example.com"
                      maxLength={120}
                    />
                  </div>
                  <div>
                    <Label htmlFor="detail-party">Participants</Label>
                    <Input
                      id="detail-party"
                      type="number"
                      min={1}
                      max={20}
                      value={partySize}
                      onChange={(e) => setPartySize(Math.max(1, Math.min(20, Number(e.target.value) || 2)))}
                      className="w-20"
                    />
                  </div>
                </div>

                {/* Honeypot */}
                <div className="hidden" aria-hidden="true">
                  <input tabIndex={-1} autoComplete="off" name="website" value={honeypot} onChange={(e) => setHoneypot(e.target.value)} />
                </div>

                {error && (
                  <div className="flex items-start gap-2 p-3 rounded-lg bg-destructive/10 text-destructive text-sm">
                    <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
                    <span>{error}</span>
                  </div>
                )}

                <Button
                  className="w-full h-12 text-base"
                  size="lg"
                  disabled={submitting}
                  onClick={handleStart}
                >
                  {submitting ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Création...
                    </>
                  ) : (
                    "Démarrer l'expérience"
                  )}
                </Button>

                <p className="text-xs text-muted-foreground text-center">
                  Paiement non requis — version beta
                </p>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}
