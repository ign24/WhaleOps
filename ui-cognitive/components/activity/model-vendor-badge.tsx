import { getModelVendor } from "@/lib/model-registry";

type ModelVendorBadgeProps = {
  model?: string | null;
};

export const ModelVendorBadge = ({ model }: ModelVendorBadgeProps) => {
  const vendor = getModelVendor(model);
  if (!vendor) {
    return null;
  }

  return (
    <span className="inline-flex items-center gap-1 rounded-full border border-[color-mix(in_srgb,var(--primary)_20%,transparent)] bg-[color-mix(in_srgb,var(--primary)_8%,transparent)] px-2 py-0.5 text-[10px] text-muted">
      {vendor.logoUrl ? (
        <img
          src={vendor.logoUrl}
          alt={`Logo de ${vendor.name}`}
          className="h-3 w-3 rounded-sm object-contain"
          loading="lazy"
          referrerPolicy="no-referrer"
        />
      ) : null}
      <span>{vendor.name}</span>
    </span>
  );
};
