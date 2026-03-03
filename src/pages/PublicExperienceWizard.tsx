import { useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useIsMobile } from '@/hooks/use-mobile';
import { calculatePrice, type PricingConfig, type PricingResult } from '@/lib/calculatePrice';
import { ExperienceHero } from '@/components/experience/ExperienceHero';
import { WizardProgress } from '@/components/experience/WizardProgress';
import { StepMode } from '@/components/experience/StepMode';
import { StepZone } from '@/components/experience/StepZone';
import { StepOptions } from '@/components/experience/StepOptions';
import { StepIdentity } from '@/components/experience/StepIdentity';
import { PricingBox } from '@/components/experience/PricingBox';
import { Button } from '@/components/ui/button';
import { ArrowLeft, ArrowRight } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';

type PageConfig = {
  hero: { title: string; subtitle: string; cta_label: string; benefits: { icon: string; text: string }[] };
  steps: { id: string; title: string; subtitle: string }[];
  modes: { key: string; emoji: string; label: string; desc: string }[];
  durations: { value: number; label: string; desc: string }[];
  labels: Record<string, string>;
  unavailable_message: string;
};

const slideVariants = {
  enter: (d: number) => ({ x: d > 0 ? 200 : -200, opacity: 0 }),
  center: { x: 0, opacity: 1 },
  exit: (d: number) => ({ x: d > 0 ? -200 : 200, opacity: 0 }),
};

export default function PublicExperienceWizard() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const isMobile = useIsMobile();

  const [config, setConfig] = useState<PageConfig | null>(null);
  const [pricingConfig, setPricingConfig] = useState<PricingConfig | null>(null);
  const [zones, setZones] = useState<string[]>([]);
  const [categories, setCategories] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [unavailable, setUnavailable] = useState<string | null>(null);

  // Wizard state
  const [step, setStep] = useState(-1); // -1 = hero
  const [direction, setDirection] = useState(1);
  const [mode, setMode] = useState('visit');
  const [duration, setDuration] = useState(120);
  const [zone, setZone] = useState('');
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const [pause, setPause] = useState(false);
  const [addOns, setAddOns] = useState<string[]>([]);
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [partySize, setPartySize] = useState(2);
  const [honeypot, setHoneypot] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // Load config + pricing
  useEffect(() => {
    async function load() {
      const [cfgRes, prcRes] = await Promise.all([
        supabase.from('app_configs').select('payload, status').eq('key', 'experience_page_config').eq('status', 'published').order('updated_at', { ascending: false }).limit(1).maybeSingle(),
        supabase.from('app_configs').select('payload').eq('key', 'pricing').eq('status', 'published').order('updated_at', { ascending: false }).limit(1).maybeSingle(),
      ]);
      if (!cfgRes.data || cfgRes.error) {
        setUnavailable('Cette page est temporairement indisponible.');
        setLoading(false);
        return;
      }
      const cfg = cfgRes.data.payload as unknown as PageConfig;
      setConfig(cfg);
      if (cfg.durations?.length) setDuration(cfg.durations[0].value);
      if (prcRes.data) setPricingConfig(prcRes.data.payload as unknown as PricingConfig);
      setLoading(false);
    }
    load();
  }, []);

  // Load zones
  useEffect(() => {
    const projectId = import.meta.env.VITE_SUPABASE_PROJECT_ID;
    fetch(`https://${projectId}.supabase.co/functions/v1/public-zones?mode=zones`)
      .then(r => r.json())
      .then(d => { if (d.zones) setZones(d.zones); })
      .catch(() => {});
  }, []);

  // Load categories when zone changes
  useEffect(() => {
    if (!zone) { setCategories([]); return; }
    const projectId = import.meta.env.VITE_SUPABASE_PROJECT_ID;
    fetch(`https://${projectId}.supabase.co/functions/v1/public-zones?mode=categories&zone=${encodeURIComponent(zone)}`)
      .then(r => r.json())
      .then(d => { if (d.categories) setCategories(d.categories); })
      .catch(() => {});
  }, [zone]);

  const pricing: PricingResult | null = useMemo(() => {
    if (!pricingConfig) return null;
    return calculatePrice({ experience_mode: mode, duration_minutes: duration, party_size: partySize, pause, add_ons: addOns }, pricingConfig);
  }, [pricingConfig, mode, duration, partySize, pause, addOns]);

  const emailError = useMemo(() => {
    if (!email) return null;
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ? null : 'Email invalide';
  }, [email]);

  const canSubmit = email.length > 0 && !emailError && zone.length > 0 && !submitting;

  const go = useCallback((d: number) => {
    setDirection(d);
    setStep(s => s + d);
  }, []);

  const canNext = step === 0 ? true : step === 1 ? zone.length > 0 : step === 2 ? true : false;

  const handleSubmit = async () => {
    if (honeypot) return;
    setSubmitting(true);
    try {
      const { data, error } = await supabase.functions.invoke('public-generate-quest', {
        body: {
          customer_email: email.trim(),
          customer_name: name.trim(),
          experience_mode: mode,
          duration_minutes: duration,
          zone,
          categories: selectedCategories,
          pause,
          add_ons: addOns,
          party_size: partySize,
          locale: 'fr',
        },
      });
      if (error || data?.error) throw new Error(data?.error || error?.message || 'Erreur');
      toast({ title: config?.labels.success_title || 'C\'est parti !', description: config?.labels.success_desc });
      navigate(`/play?token=${data.access_token}`);
    } catch (e: any) {
      toast({ title: 'Erreur', description: e.message, variant: 'destructive' });
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="space-y-4 w-full max-w-md px-4">
          <Skeleton className="h-8 w-3/4" />
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-48 w-full rounded-2xl" />
        </div>
      </div>
    );
  }

  if (unavailable || !config) {
    return (
      <div className="min-h-screen flex items-center justify-center px-4">
        <div className="text-center">
          <p className="text-xl text-muted-foreground">{unavailable || config?.unavailable_message}</p>
        </div>
      </div>
    );
  }

  const labels = config.labels;

  const stepContent = [
    <StepMode key="mode" modes={config.modes} durations={config.durations} selectedMode={mode} selectedDuration={duration} onMode={setMode} onDuration={setDuration} />,
    <StepZone key="zone" zones={zones} categories={categories} selectedZone={zone} selectedCategories={selectedCategories} onZone={setZone} onToggleCategory={(c) => setSelectedCategories(prev => prev.includes(c) ? prev.filter(x => x !== c) : [...prev, c])} labels={{ categories_title: labels.categories_title, categories_hint: labels.categories_hint }} />,
    <StepOptions key="options" pause={pause} onPause={setPause} addOns={addOns} onToggleAddOn={(k) => setAddOns(prev => prev.includes(k) ? prev.filter(x => x !== k) : [...prev, k])} pricingConfig={pricingConfig} labels={{ pause_label: labels.pause_label }} locale="fr" />,
    <StepIdentity key="identity" email={email} name={name} partySize={partySize} honeypot={honeypot} onEmail={setEmail} onName={setName} onPartySize={setPartySize} onHoneypot={setHoneypot} labels={labels} emailError={step === 3 ? emailError : null} />,
  ];

  return (
    <div className={`min-h-screen bg-background ${isMobile ? 'pb-20' : ''}`}>
      {step === -1 ? (
        <ExperienceHero config={config.hero} onCta={() => go(1)} />
      ) : (
        <>
          <div className="container mx-auto px-4 pt-6">
            <WizardProgress steps={config.steps} current={step} />
          </div>

          <div className={`container mx-auto px-4 py-8 ${!isMobile ? 'grid grid-cols-3 gap-8' : ''}`}>
            <div className={!isMobile ? 'col-span-2' : ''}>
              <AnimatePresence mode="wait" custom={direction}>
                <motion.div
                  key={step}
                  custom={direction}
                  variants={slideVariants}
                  initial="enter"
                  animate="center"
                  exit="exit"
                  transition={{ type: 'spring', stiffness: 300, damping: 30 }}
                >
                  {stepContent[step]}
                </motion.div>
              </AnimatePresence>

              {/* Navigation */}
              <div className="flex justify-between mt-8">
                <Button variant="ghost" onClick={() => go(-1)} disabled={step <= 0 && step !== 0}>
                  {step === 0 ? null : <><ArrowLeft className="w-4 h-4 mr-1" /> {labels.prev_label}</>}
                </Button>
                {step < 3 ? (
                  <Button onClick={() => go(1)} disabled={!canNext}>
                    {labels.next_label} <ArrowRight className="w-4 h-4 ml-1" />
                  </Button>
                ) : (
                  !isMobile && (
                    <Button onClick={handleSubmit} disabled={!canSubmit}>
                      {submitting ? '...' : labels.submit_label}
                    </Button>
                  )
                )}
              </div>
            </div>

            {!isMobile && (
              <div>
                <PricingBox pricing={pricing} labels={{ pricing_title: labels.pricing_title, total_label: labels.total_label, submit_label: labels.submit_label }} onSubmit={handleSubmit} submitting={submitting} canSubmit={canSubmit && step === 3} isMobile={false} />
              </div>
            )}
          </div>

          {isMobile && (
            <PricingBox pricing={pricing} labels={{ pricing_title: labels.pricing_title, total_label: labels.total_label, submit_label: labels.submit_label }} onSubmit={handleSubmit} submitting={submitting} canSubmit={canSubmit && step === 3} isMobile={true} />
          )}
        </>
      )}
    </div>
  );
}
