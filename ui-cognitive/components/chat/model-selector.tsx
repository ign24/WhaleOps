"use client";

import { useEffect, useRef, useState, KeyboardEvent } from "react";
import { Check, ChevronDown, Zap } from "lucide-react";
import {
  MODEL_REGISTRY,
  getModelOpennessMetadata,
  getModelPolicyEnvironment,
  getModelPolicyTag,
  getModelVendor,
  getThinkingVariant,
  type ModelEntry,
  type ModelOpennessCategory,
  type ModelTier,
} from "@/lib/model-registry";
import type { TemperaturePreset } from "@/types/chat";

type ModelSelectorChipProps = {
  model: string;
  thinking: boolean;
  temperaturePreset: TemperaturePreset;
  onModelChange: (model: string) => void;
  onThinkingToggle: () => void;
  onTemperatureChange: (preset: TemperaturePreset) => void;
  /** Called when /models command is issued from outside — opens dropdown */
  openRef?: React.MutableRefObject<(() => void) | null>;
};

const TIER_LABELS: Record<ModelTier, string> = {
  S: "Programación",
  A: "Razonamiento",
  B: "Conversación",
};

const TEMP_LABELS: Record<TemperaturePreset, string> = {
  low: "Baja",
  medium: "Med",
  high: "Alta",
};

const TEMP_PRESETS: TemperaturePreset[] = ["low", "medium", "high"];

const OPENNESS_LABELS: Record<ModelOpennessCategory, string> = {
  "open-source": "Código abierto",
  "open-weights": "Pesos abiertos",
  "source-available": "Fuente disponible",
};

const OPENNESS_TOOLTIP_ES: Record<ModelOpennessCategory, string> = {
  "open-source": "Código y pesos abiertos bajo licencia abierta.",
  "open-weights": "Pesos abiertos; puede tener restricciones de licencia para uso y distribución.",
  "source-available": "Disponible públicamente, pero no califica como open source OSI.",
};

const OPENNESS_CLASS_BY_CATEGORY: Record<ModelOpennessCategory, string> = {
  "open-source": "border-[var(--border)] bg-[color:color-mix(in_srgb,var(--text-primary)_4%,var(--surface)_96%)] text-foreground/70",
  "open-weights": "border-[var(--border)] bg-[color:color-mix(in_srgb,var(--text-primary)_5%,var(--surface)_95%)] text-foreground/70",
  "source-available": "border-[var(--border)] bg-[color:color-mix(in_srgb,var(--text-primary)_6%,var(--surface)_94%)] text-foreground/70",
};

function groupByTier(entries: ModelEntry[]): [ModelTier, ModelEntry[]][] {
  const tiers: ModelTier[] = ["S", "A", "B"];
  return tiers
    .map((tier) => [tier, entries.filter((e) => e.tier === tier)] as [ModelTier, ModelEntry[]])
    .filter(([, items]) => items.length > 0);
}

export function ModelSelectorChip({
  model,
  thinking,
  temperaturePreset,
  onModelChange,
  onThinkingToggle,
  onTemperatureChange,
  openRef,
}: ModelSelectorChipProps) {
  const [open, setOpen] = useState(false);
  const [selectionWarning, setSelectionWarning] = useState<string | null>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const policyEnvironment = getModelPolicyEnvironment();

  const activeEntry = MODEL_REGISTRY.find((m) => m.key === model) ?? MODEL_REGISTRY[0]!;
  const activeVendor = getModelVendor(activeEntry.key);
  const activeOpennessMeta = getModelOpennessMetadata(activeEntry.key);
  const supportsThinking = getThinkingVariant(model) !== null;
  const grouped = groupByTier(MODEL_REGISTRY);

  useEffect(() => {
    if (openRef) {
      openRef.current = () => setOpen(true);
    }
  }, [openRef]);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  const handleKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key === "Escape") {
      setOpen(false);
      buttonRef.current?.focus();
    }
  };

  const selectModel = (key: string) => {
    const policyTag = getModelPolicyTag(key, policyEnvironment);

    if (policyTag === "block") {
      setSelectionWarning("Modelo bloqueado por política de entorno.");
      return;
    }

    setSelectionWarning(null);
    onModelChange(key);
    setOpen(false);
    buttonRef.current?.focus();
  };

  const tempLabel = temperaturePreset === "medium" ? "" : ` · ${TEMP_LABELS[temperaturePreset]}`;
  const thinkingLabel = thinking && supportsThinking ? " · Razonar" : "";

  return (
    <div className="relative flex-shrink-0" ref={dropdownRef} onKeyDown={handleKeyDown}>
      {/* Chip */}
      <button
        ref={buttonRef}
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-1 rounded-md border border-[var(--border)] bg-[var(--surface)] px-2 py-1 text-[11px] font-medium text-foreground/70 transition-colors hover:border-[color:color-mix(in_srgb,var(--text-primary)_18%,var(--border)_82%)] hover:bg-[color:color-mix(in_srgb,var(--text-primary)_4%,var(--surface)_96%)] hover:text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
        aria-haspopup="listbox"
        aria-expanded={open}
        title="Cambiar modelo"
      >
        {thinking && supportsThinking && (
          <Zap className="h-2.5 w-2.5 text-amber-400" aria-label="Thinking activo" />
        )}
        {activeVendor?.logoUrl ? (
          <img
            src={activeVendor.logoUrl}
            alt={`${activeVendor.name} logo`}
            className="h-3 w-3 rounded-sm object-contain"
            loading="lazy"
            referrerPolicy="no-referrer"
          />
        ) : null}
        <span className="hidden sm:inline">{activeEntry.shortName}{tempLabel}{thinkingLabel}</span>
        <span
          className={`hidden rounded-full border px-1.5 py-0.5 text-[9px] font-medium tracking-wide sm:inline-flex ${OPENNESS_CLASS_BY_CATEGORY[activeOpennessMeta.opennessCategory]}`}
          title={`${OPENNESS_LABELS[activeOpennessMeta.opennessCategory]}: ${OPENNESS_TOOLTIP_ES[activeOpennessMeta.opennessCategory]}`}
        >
          {OPENNESS_LABELS[activeOpennessMeta.opennessCategory]}
        </span>
        <span className="sm:hidden">{activeEntry.shortName.charAt(0)}</span>
        <ChevronDown className={`h-2.5 w-2.5 transition-transform duration-150 ${open ? "rotate-180" : ""}`} />
      </button>

      {/* Dropdown */}
      {open && (
        <div
          role="dialog"
          aria-label="Selector de modelo"
          className="absolute bottom-full left-0 z-50 mb-1.5 w-64 overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--surface)]/95 shadow-sm backdrop-blur-sm"
        >
          {/* Model list */}
          <div role="listbox" aria-label="Modelos disponibles" className="py-1">
            {grouped.map(([tier, entries], groupIdx) => (
              <div key={tier}>
                {groupIdx > 0 && <div className="mx-2 my-1 border-t border-[var(--border)]" />}
                <div className="px-3 pb-0.5 pt-1.5 text-[10px] font-medium uppercase tracking-widest text-foreground/30">
                  {TIER_LABELS[tier]}
                </div>
                {entries.map((entry) => {
                  const vendor = getModelVendor(entry.key);
                  const opennessMeta = getModelOpennessMetadata(entry.key);
                  const policyTag = getModelPolicyTag(entry.key, policyEnvironment);
                  const isBlocked = policyTag === "block";
                  return (
                  <button
                    key={entry.key}
                    role="option"
                    aria-selected={model === entry.key}
                    type="button"
                    onClick={() => selectModel(entry.key)}
                    disabled={isBlocked}
                    className={`flex w-full items-center gap-2 px-3 py-1.5 text-left text-[12px] transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring ${
                      isBlocked
                        ? "cursor-not-allowed opacity-45"
                        : ""
                    } ${
                      model === entry.key
                        ? "bg-[color:color-mix(in_srgb,var(--text-primary)_8%,var(--surface)_92%)] text-foreground"
                        : "text-foreground/60 hover:bg-[color:color-mix(in_srgb,var(--text-primary)_6%,var(--surface)_94%)] hover:text-foreground/90"
                    }`}
                  >
                    <span className="flex-1 leading-tight">{entry.displayName}</span>
                    <span
                      className={`rounded-full border px-1.5 py-0.5 text-[9px] font-medium tracking-wide ${OPENNESS_CLASS_BY_CATEGORY[opennessMeta.opennessCategory]}`}
                      title={`${OPENNESS_LABELS[opennessMeta.opennessCategory]}: ${OPENNESS_TOOLTIP_ES[opennessMeta.opennessCategory]}`}
                    >
                      {OPENNESS_LABELS[opennessMeta.opennessCategory]}
                    </span>
                    {vendor ? (
                      <span className="hidden items-center gap-1 rounded-full border border-[var(--border)] px-1.5 py-0.5 text-[9px] text-foreground/50 sm:inline-flex">
                        {vendor.logoUrl ? (
                          <img
                            src={vendor.logoUrl}
                            alt={`${vendor.name} logo`}
                            className="h-2.5 w-2.5 rounded-sm object-contain"
                            loading="lazy"
                            referrerPolicy="no-referrer"
                          />
                        ) : null}
                        <span>{vendor.name}</span>
                      </span>
                    ) : null}
                    {model === entry.key && (
                      <Check className="h-3 w-3 text-foreground/50" aria-hidden="true" />
                    )}
                  </button>
                  );
                })}
              </div>
            ))}
          </div>

          {/* Footer: temperature + thinking */}
          <div className="border-t border-[var(--border)] px-2 py-2 space-y-2">
            {selectionWarning ? (
              <p className="rounded border border-rose-500/35 bg-rose-500/10 px-2 py-1 text-[10px] text-rose-200">
                {selectionWarning}
              </p>
            ) : null}
            {/* Temperature segmented control */}
            <div className="flex items-center gap-2">
              <span className="w-14 text-[10px] font-medium uppercase tracking-wider text-foreground/30">Temperatura</span>
              <div className="flex flex-1 overflow-hidden rounded-md border border-[var(--border)]">
                {TEMP_PRESETS.map((preset, i) => (
                  <button
                    key={preset}
                    type="button"
                    onClick={() => onTemperatureChange(preset)}
                    className={`flex-1 py-0.5 text-[10px] font-medium transition-colors focus-visible:outline-none ${
                      i > 0 ? "border-l border-[var(--border)]" : ""
                    } ${
                      temperaturePreset === preset
                        ? "bg-[color:color-mix(in_srgb,var(--text-primary)_10%,var(--surface)_90%)] text-foreground"
                        : "text-foreground/40 hover:bg-[color:color-mix(in_srgb,var(--text-primary)_5%,var(--surface)_95%)] hover:text-foreground/70"
                    }`}
                  >
                    {TEMP_LABELS[preset]}
                  </button>
                ))}
              </div>
            </div>

            {/* Thinking toggle */}
            <div className="flex items-center gap-2">
              <span className="w-14 text-[10px] font-medium uppercase tracking-wider text-foreground/30">Razonar</span>
              {supportsThinking ? (
                <button
                  type="button"
                  role="switch"
                  aria-checked={thinking}
                  onClick={onThinkingToggle}
                  className="group relative h-4 w-7 rounded-full border border-[var(--border)] bg-background transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring data-[checked=true]:border-amber-500/45 data-[checked=true]:bg-amber-500/15"
                  data-checked={thinking}
                >
                  <span
                    className={`absolute top-0.5 h-3 w-3 rounded-full transition-all ${
                      thinking
                        ? "left-3 bg-amber-400"
                        : "left-0.5 bg-foreground/25"
                    }`}
                  />
                </button>
              ) : (
                <span className="text-[10px] text-foreground/25">no disponible</span>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
