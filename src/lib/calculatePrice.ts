/**
 * Pure pricing calculation — shared between frontend preview and edge function server-side validation.
 */

export interface PricingConfig {
  currency: string;
  base_prices: Record<string, number>;
  duration_multipliers: Record<string, number>;
  party_thresholds: { min: number; max: number; supplement: number }[];
  pause_supplement: number;
  add_ons: { key: string; label_i18n: Record<string, string>; price: number }[];
}

export interface PricingInput {
  experience_mode: string;
  duration_minutes: number;
  party_size: number;
  pause: boolean;
  add_ons: string[];
  locale?: string;
}

export interface AddOnDetail {
  key: string;
  label: string;
  price: number;
}

export interface PricingResult {
  base_price: number;
  duration_multiplier: number;
  party_supplement: number;
  pause_supplement: number;
  add_ons_total: number;
  add_ons_detail: AddOnDetail[];
  total: number;
  currency: string;
}

export function calculatePrice(
  input: PricingInput,
  config: PricingConfig,
): PricingResult {
  const locale = input.locale ?? 'fr';

  // Base price by mode
  const base_price = config.base_prices[input.experience_mode] ?? 0;

  // Duration multiplier
  const duration_multiplier =
    config.duration_multipliers[String(input.duration_minutes)] ?? 1;

  // Party supplement
  const partyThreshold = config.party_thresholds.find(
    (t) => input.party_size >= t.min && input.party_size <= t.max,
  );
  const party_supplement = partyThreshold?.supplement ?? 0;

  // Pause
  const pause_supplement = input.pause ? config.pause_supplement : 0;

  // Add-ons
  const add_ons_detail: AddOnDetail[] = [];
  for (const key of input.add_ons) {
    const addon = config.add_ons.find((a) => a.key === key);
    if (addon) {
      add_ons_detail.push({
        key: addon.key,
        label: addon.label_i18n[locale] ?? addon.label_i18n.fr ?? addon.key,
        price: addon.price,
      });
    }
  }
  const add_ons_total = add_ons_detail.reduce((sum, a) => sum + a.price, 0);

  // Total
  const total = Math.round(
    base_price * duration_multiplier + party_supplement + pause_supplement + add_ons_total,
  );

  return {
    base_price,
    duration_multiplier,
    party_supplement,
    pause_supplement,
    add_ons_total,
    add_ons_detail,
    total,
    currency: config.currency,
  };
}
