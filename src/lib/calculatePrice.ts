/**
 * Pure pricing calculation — shared between frontend preview and edge function server-side validation.
 * Supports two pricing models: 'group' (fixed price) and 'per_person' (price × party_size).
 */

export interface PricingConfig {
  currency: string;
  base_prices: Record<string, number>;
  duration_multipliers: Record<string, number>;
  party_thresholds: { min: number; max: number; supplement: number }[];
  pause_supplement: number;
  add_ons: { key: string; label_i18n: Record<string, string>; price: number }[];
}

export interface PricingModelConfig {
  pricing_model: 'group' | 'per_person';
  group_price?: number;
  party_size_max?: number;
  devices_allowed?: number;
  devices_allowed_rule?: 'party_size';
  label_fr?: string;
  label_en?: string;
}

export interface PricingInput {
  experience_mode: string;
  duration_minutes: number;
  party_size: number;
  pause: boolean;
  add_ons: string[];
  locale?: string;
  pricing_model_config?: PricingModelConfig;
}

export interface AddOnDetail {
  key: string;
  label: string;
  price: number;
}

export interface PricingResult {
  pricing_model: 'group' | 'per_person';
  base_price: number;
  duration_multiplier: number;
  party_supplement: number;
  pause_supplement: number;
  add_ons_total: number;
  add_ons_detail: AddOnDetail[];
  total: number;
  currency: string;
  devices_allowed: number;
  party_size_max?: number;
  price_label?: string;
}

export function calculatePrice(
  input: PricingInput,
  config: PricingConfig,
): PricingResult {
  const locale = input.locale ?? 'fr';
  const pmc = input.pricing_model_config;
  const pricingModel = pmc?.pricing_model ?? 'per_person';

  if (pricingModel === 'group' && pmc) {
    // GROUP pricing: fixed price, addons are flat (not per person)
    const groupPrice = pmc.group_price ?? 0;

    // Addons (flat, not multiplied)
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

    const pause_supplement = input.pause ? config.pause_supplement : 0;
    const total = Math.round(groupPrice + add_ons_total + pause_supplement);

    return {
      pricing_model: 'group',
      base_price: groupPrice,
      duration_multiplier: 1,
      party_supplement: 0,
      pause_supplement,
      add_ons_total,
      add_ons_detail,
      total,
      currency: config.currency,
      devices_allowed: pmc.devices_allowed ?? 1,
      party_size_max: pmc.party_size_max,
      price_label: locale === 'en' ? pmc.label_en : pmc.label_fr,
    };
  }

  // PER_PERSON pricing (default / legacy-compatible)
  const base_price = config.base_prices[input.experience_mode] ?? 0;
  const duration_multiplier =
    config.duration_multipliers[String(input.duration_minutes)] ?? 1;

  const partyThreshold = config.party_thresholds.find(
    (t) => input.party_size >= t.min && input.party_size <= t.max,
  );
  const party_supplement = partyThreshold?.supplement ?? 0;
  const pause_supplement = input.pause ? config.pause_supplement : 0;

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

  const total = Math.round(
    (base_price * duration_multiplier + party_supplement + pause_supplement + add_ons_total) * input.party_size,
  );

  const devicesAllowed = pmc?.devices_allowed_rule === 'party_size'
    ? input.party_size
    : (pmc?.devices_allowed ?? input.party_size);

  return {
    pricing_model: 'per_person',
    base_price,
    duration_multiplier,
    party_supplement,
    pause_supplement,
    add_ons_total,
    add_ons_detail,
    total,
    currency: config.currency,
    devices_allowed: devicesAllowed,
    price_label: locale === 'en' ? pmc?.label_en : pmc?.label_fr,
  };
}
