import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { calculatePrice, type PricingConfig, type PricingResult } from "@/lib/calculatePrice";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  MapPin,
  Clock,
  Users,
  Coffee,
  Sparkles,
  Loader2,
  AlertCircle,
} from "lucide-react";

const DURATION_OPTIONS = [
  { value: 60, label: "1h", desc: "Express" },
  { value: 90, label: "1h30", desc: "Classique" },
  { value: 120, label: "2h", desc: "Immersif" },
];

export default function PublicExperienceBuilder() {
  // ── Config state ──
  const [pricingConfig, setPricingConfig] = useState<PricingConfig | null>(null);
  const [zones, setZones] = useState<string[]>([]);
  const [categories, setCategories] = useState<string[]>([]);
  const [loadingConfig, setLoadingConfig] = useState(true);

  // ── Form state ──
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [mode, setMode] = useState<"visit" | "game">("visit");
  const [duration, setDuration] = useState(60);
  const [zone, setZone] = useState("");
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const [pause, setPause] = useState(false);
  const [selectedAddOns, setSelectedAddOns] = useState<string[]>([]);
  const [partySize, setPartySize] = useState(2);
  const [honeypot, setHoneypot] = useState("");

  // ── Submit state ──
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
  const supabaseKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

  // ── Load pricing config + zones on mount ──
  useEffect(() => {
    (async () => {
      const [configRes, zonesRes] = await Promise.all([
        supabase
          .from("app_configs")
          .select("payload")
          .eq("key", "pricing")
          .eq("status", "published")
          .order("updated_at", { ascending: false })
          .limit(1)
          .single(),
        fetch(`${supabaseUrl}/functions/v1/public-zones?mode=zones`, {
          headers: { apikey: supabaseKey },
        }).then((r) => r.ok ? r.json() : null).catch(() => null) as Promise<{ zones: string[] } | null>,
      ]);

      if (configRes.data?.payload) {
        setPricingConfig(configRes.data.payload as unknown as PricingConfig);
      }

      if (zonesRes?.zones) {
        setZones(zonesRes.zones);
      }

      setLoadingConfig(false);
    })();
  }, []);

  // ── Load categories when zone changes ──
  useEffect(() => {
    if (!zone) { setCategories([]); return; }
    (async () => {
      const res = await fetch(
        `${supabaseUrl}/functions/v1/public-zones?mode=categories&zone=${encodeURIComponent(zone)}`,
        { headers: { apikey: supabaseKey } },
      );
      if (res.status === 429) {
        setError("Trop de requêtes, réessayez dans quelques minutes.");
        return;
      }
      if (res.ok) {
        const json = await res.json();
        setCategories(json.categories ?? []);
      }
    })();
  }, [zone]);

  // ── Compute pricing live ──
  const pricing: PricingResult | null = useMemo(() => {
    if (!pricingConfig) return null;
    return calculatePrice(
      {
        experience_mode: mode,
        duration_minutes: duration,
        party_size: partySize,
        pause,
        add_ons: selectedAddOns,
        locale: "fr",
      },
      pricingConfig,
    );
  }, [pricingConfig, mode, duration, partySize, pause, selectedAddOns]);

  // ── Submit ──
  const handleSubmit = async () => {
    setError(null);
    if (!email || !email.includes("@")) {
      setError("Veuillez entrer un email valide.");
      return;
    }
    if (!zone) {
      setError("Veuillez sélectionner une zone.");
      return;
    }

    setSubmitting(true);
    try {
      const { data, error: fnError } = await supabase.functions.invoke(
        "public-generate-quest",
        {
          body: {
            customer_name: name,
            customer_email: email,
            experience_mode: mode,
            duration_minutes: duration,
            zone,
            categories: selectedCategories,
            pause,
            add_ons: selectedAddOns,
            locale: "fr",
            party_size: partySize,
            seed: email,
            honeypot_website: honeypot,
          },
        },
      );

      if (fnError) {
        const msg = (fnError as any)?.message ?? "Erreur lors de la création";
        // Try to parse JSON error from edge function
        setError(msg);
        setSubmitting(false);
        return;
      }

      if (data?.error) {
        if (data.error.includes("Rate limit")) {
          setError("Trop de créations récentes. Réessayez dans une heure.");
        } else if (data.error.includes("No active POIs")) {
          setError("Aucun point d'intérêt disponible pour cette zone. Essayez une autre zone.");
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

  // ── Toggle helpers ──
  const toggleCategory = (cat: string) =>
    setSelectedCategories((prev) =>
      prev.includes(cat) ? prev.filter((c) => c !== cat) : [...prev, cat],
    );

  const toggleAddOn = (key: string) =>
    setSelectedAddOns((prev) =>
      prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key],
    );

  if (loadingConfig) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border bg-card px-4 py-6">
        <div className="max-w-5xl mx-auto text-center">
          <h1 className="text-3xl font-bold text-foreground">
            Créez votre expérience
          </h1>
          <p className="text-muted-foreground mt-2">
            Personnalisez votre parcours dans la médina
          </p>
        </div>
      </header>

      <div className="max-w-5xl mx-auto px-4 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* ── Left: Form ── */}
          <div className="lg:col-span-2 space-y-6">
            {/* A) Identité */}
            <Card>
              <CardContent className="pt-6 space-y-4">
                <h2 className="text-lg font-semibold flex items-center gap-2">
                  <Users className="w-5 h-5 text-primary" />
                  Vos informations
                </h2>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="name">Nom (optionnel)</Label>
                    <Input
                      id="name"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder="Jean Dupont"
                      maxLength={80}
                    />
                  </div>
                  <div>
                    <Label htmlFor="email">Email *</Label>
                    <Input
                      id="email"
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="jean@example.com"
                      required
                      maxLength={120}
                    />
                  </div>
                </div>
                <div>
                  <Label htmlFor="partySize">Nombre de participants</Label>
                  <Input
                    id="partySize"
                    type="number"
                    min={1}
                    max={20}
                    value={partySize}
                    onChange={(e) =>
                      setPartySize(Math.max(1, Math.min(20, Number(e.target.value) || 2)))
                    }
                    className="w-24"
                  />
                </div>

                {/* Honeypot */}
                <div className="hidden" aria-hidden="true">
                  <input
                    tabIndex={-1}
                    autoComplete="off"
                    name="website"
                    value={honeypot}
                    onChange={(e) => setHoneypot(e.target.value)}
                  />
                </div>
              </CardContent>
            </Card>

            {/* B) Mode */}
            <Card>
              <CardContent className="pt-6 space-y-4">
                <h2 className="text-lg font-semibold flex items-center gap-2">
                  <Sparkles className="w-5 h-5 text-primary" />
                  Type d'expérience
                </h2>
                <div className="grid grid-cols-2 gap-4">
                  {(["visit", "game"] as const).map((m) => (
                    <button
                      key={m}
                      type="button"
                      onClick={() => setMode(m)}
                      className={`selection-button ${mode === m ? "selected" : ""}`}
                    >
                      <span className="text-2xl">{m === "visit" ? "🚶" : "🎮"}</span>
                      <span className="font-medium text-foreground">
                        {m === "visit" ? "Visite guidée" : "Jeu / Quête"}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        {m === "visit"
                          ? "Découverte à votre rythme"
                          : "Énigmes et défis"}
                      </span>
                    </button>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* C) Durée */}
            <Card>
              <CardContent className="pt-6 space-y-4">
                <h2 className="text-lg font-semibold flex items-center gap-2">
                  <Clock className="w-5 h-5 text-primary" />
                  Durée
                </h2>
                <div className="grid grid-cols-3 gap-4">
                  {DURATION_OPTIONS.map((d) => (
                    <button
                      key={d.value}
                      type="button"
                      onClick={() => setDuration(d.value)}
                      className={`selection-button ${duration === d.value ? "selected" : ""}`}
                    >
                      <span className="text-xl font-bold text-foreground">{d.label}</span>
                      <span className="text-xs text-muted-foreground">{d.desc}</span>
                    </button>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* D) Zone */}
            <Card>
              <CardContent className="pt-6 space-y-4">
                <h2 className="text-lg font-semibold flex items-center gap-2">
                  <MapPin className="w-5 h-5 text-primary" />
                  Zone
                </h2>
                {zones.length > 0 ? (
                  <Select value={zone} onValueChange={(v) => { setZone(v); setSelectedCategories([]); }}>
                    <SelectTrigger>
                      <SelectValue placeholder="Choisir une zone" />
                    </SelectTrigger>
                    <SelectContent>
                      {zones.map((z) => (
                        <SelectItem key={z} value={z}>
                          {z}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                ) : (
                  <Input
                    value={zone}
                    onChange={(e) => { setZone(e.target.value); setSelectedCategories([]); }}
                    placeholder="Ex: medina-nord"
                    maxLength={100}
                  />
                )}
              </CardContent>
            </Card>

            {/* E) Catégories */}
            {zone && (
              <Card>
                <CardContent className="pt-6 space-y-4">
                  <h2 className="text-lg font-semibold">Centres d'intérêt</h2>
                  <p className="text-sm text-muted-foreground">
                    Optionnel — laissez vide pour un parcours varié
                  </p>
                  {categories.length > 0 ? (
                    <div className="flex flex-wrap gap-2">
                      {categories.map((cat) => (
                        <Badge
                          key={cat}
                          variant={selectedCategories.includes(cat) ? "default" : "outline"}
                          className="cursor-pointer select-none"
                          onClick={() => toggleCategory(cat)}
                        >
                          {cat}
                        </Badge>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground italic">
                      Les catégories seront sélectionnées automatiquement.
                    </p>
                  )}
                </CardContent>
              </Card>
            )}

            {/* F) Options */}
            <Card>
              <CardContent className="pt-6 space-y-4">
                <h2 className="text-lg font-semibold flex items-center gap-2">
                  <Coffee className="w-5 h-5 text-primary" />
                  Options
                </h2>

                <div className="flex items-center gap-3">
                  <Checkbox
                    id="pause"
                    checked={pause}
                    onCheckedChange={(v) => setPause(v === true)}
                  />
                  <Label htmlFor="pause" className="cursor-pointer">
                    Pause café / thé incluse
                    {pricingConfig && (
                      <span className="text-muted-foreground ml-1">
                        (+{pricingConfig.pause_supplement} {pricingConfig.currency})
                      </span>
                    )}
                  </Label>
                </div>

                {pricingConfig?.add_ons?.map((addon) => (
                  <div key={addon.key} className="flex items-center gap-3">
                    <Checkbox
                      id={`addon-${addon.key}`}
                      checked={selectedAddOns.includes(addon.key)}
                      onCheckedChange={() => toggleAddOn(addon.key)}
                    />
                    <Label htmlFor={`addon-${addon.key}`} className="cursor-pointer">
                      {addon.label_i18n.fr ?? addon.key}
                      <span className="text-muted-foreground ml-1">
                        (+{addon.price} {pricingConfig.currency})
                      </span>
                    </Label>
                  </div>
                ))}
              </CardContent>
            </Card>
          </div>

          {/* ── Right: Pricing + Submit ── */}
          <div className="lg:col-span-1">
            <div className="lg:sticky lg:top-8 space-y-4">
              <Card className="border-primary/30">
                <CardContent className="pt-6 space-y-3">
                  <h2 className="text-lg font-semibold">Récapitulatif</h2>

                  {pricing ? (
                    <>
                      <div className="space-y-2 text-sm">
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">
                            Base ({mode === "visit" ? "Visite" : "Jeu"})
                          </span>
                          <span>{pricing.base_price} {pricing.currency}</span>
                        </div>
                        {pricing.duration_multiplier !== 1 && (
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">
                              Durée (×{pricing.duration_multiplier})
                            </span>
                            <span>
                              ×{pricing.duration_multiplier}
                            </span>
                          </div>
                        )}
                        {pricing.party_supplement > 0 && (
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">
                              Supplément groupe ({partySize} pers.)
                            </span>
                            <span>+{pricing.party_supplement} {pricing.currency}</span>
                          </div>
                        )}
                        {pricing.pause_supplement > 0 && (
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">Pause</span>
                            <span>+{pricing.pause_supplement} {pricing.currency}</span>
                          </div>
                        )}
                        {pricing.add_ons_detail.map((a) => (
                          <div key={a.key} className="flex justify-between">
                            <span className="text-muted-foreground">{a.label}</span>
                            <span>+{a.price} {pricing.currency}</span>
                          </div>
                        ))}
                      </div>

                      <div className="border-t border-border pt-3 mt-3">
                        <div className="flex justify-between text-lg font-bold">
                          <span>Total</span>
                          <span className="text-primary">
                            {pricing.total} {pricing.currency}
                          </span>
                        </div>
                      </div>
                    </>
                  ) : (
                    <p className="text-sm text-muted-foreground">
                      Chargement des tarifs...
                    </p>
                  )}
                </CardContent>
              </Card>

              {error && (
                <div className="flex items-start gap-2 p-3 rounded-lg bg-destructive/10 text-destructive text-sm">
                  <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
                  <span>{error}</span>
                </div>
              )}

              <Button
                className="w-full h-12 text-base"
                size="lg"
                disabled={!pricingConfig || submitting || !email}
                onClick={handleSubmit}
              >
                {submitting ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Création en cours...
                  </>
                ) : (
                  "Créer mon expérience"
                )}
              </Button>

              <p className="text-xs text-muted-foreground text-center">
                Paiement non requis pour la version beta
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
