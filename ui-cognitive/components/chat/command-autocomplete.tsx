type CommandAutocompleteItem = {
  label: string;
  value: string;
  description: string;
};

type CommandAutocompleteProps = {
  items: CommandAutocompleteItem[];
  activeIndex: number;
  onSelect: (item: CommandAutocompleteItem) => void;
  onHover: (index: number) => void;
};

export const CommandAutocomplete = ({ items, activeIndex, onSelect, onHover }: CommandAutocompleteProps) => {
  if (items.length === 0) {
    return null;
  }

  return (
    <div className="absolute inset-x-0 bottom-full z-20 mb-2 rounded-xl border border-[var(--border)] bg-[var(--surface)] p-2 shadow-lg">
      <div className="grid gap-1">
        {items.map((item, index) => {
          const isActive = index === activeIndex;
          return (
            <button
              key={`${item.label}-${index}`}
              type="button"
              onMouseEnter={() => onHover(index)}
              onClick={() => onSelect(item)}
              className={`grid w-full gap-0.5 rounded-lg px-2 py-2 text-left transition-colors ${
                isActive ? "bg-[var(--primary)]/12" : "hover:bg-[var(--primary)]/8"
              }`}
            >
              <span className="font-mono text-sm text-[var(--text-primary)]">{item.label}</span>
              <span className="text-xs text-muted">{item.description}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
};

export type { CommandAutocompleteItem };
