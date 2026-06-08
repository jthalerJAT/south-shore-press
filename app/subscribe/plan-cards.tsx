'use client';

import { PLAN_LIST, type PlanTier } from '@/lib/stripe/plans';
import { cn } from '@/lib/utils';

/**
 * The "Choose your subscription" selector. Radio-style cards — exactly one
 * is selectable. A tier whose Stripe Price ID isn't configured renders
 * disabled (mirrors the payment "not configured" graceful degradation).
 */
export function PlanCards({
  selected,
  onSelect,
  configured,
}: {
  selected: PlanTier | null;
  onSelect: (tier: PlanTier) => void;
  configured: Record<PlanTier, boolean>;
}) {
  return (
    <fieldset className="flex flex-col gap-4">
      <legend className="sr-only">Choose your subscription</legend>
      {PLAN_LIST.map((plan) => {
        const isSelected = selected === plan.tier;
        const isConfigured = configured[plan.tier];
        return (
          <label
            key={plan.tier}
            className={cn(
              'relative flex flex-col gap-2 rounded-lg border px-5 py-4 transition-colors',
              isConfigured ? 'cursor-pointer' : 'cursor-not-allowed opacity-60',
              isSelected
                ? 'border-brand-red ring-1 ring-brand-red bg-red-50/40'
                : 'border-zinc-300 hover:border-zinc-400'
            )}
          >
            <div className="flex items-start gap-3">
              <input
                type="radio"
                name="plan"
                value={plan.tier}
                checked={isSelected}
                disabled={!isConfigured}
                onChange={() => onSelect(plan.tier)}
                className="mt-1 h-4 w-4 accent-brand-red"
              />
              <div className="flex-1">
                <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
                  <span className="font-headline text-base font-bold text-zinc-900">
                    {plan.label}
                  </span>
                  <span className="text-base font-bold text-brand-red">
                    {plan.priceLine}
                  </span>
                </div>
                <p className="mt-1 text-sm text-zinc-600">{plan.blurb}</p>
                {!isConfigured ? (
                  <p className="mt-2 text-xs text-amber-700">
                    This plan isn&apos;t available yet.
                  </p>
                ) : null}
              </div>
            </div>
          </label>
        );
      })}
    </fieldset>
  );
}
