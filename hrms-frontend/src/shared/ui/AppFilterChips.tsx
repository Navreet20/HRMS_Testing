"use client";

export interface AppFilterChipItem<T extends string = string> {
  readonly id: T;
  readonly label: string;
  /** Shown in brackets after the label, like "Waiting (4)". */
  readonly count?: number;
}

export interface AppFilterChipsProps<T extends string = string> {
  readonly items: readonly AppFilterChipItem<T>[];
  readonly value: T;
  readonly onChange: (id: T) => void;
  readonly ariaLabel: string;
  readonly className?: string;
  /** "solid" fills the chosen chip, for use on a tinted panel where the soft style blends in. */
  readonly variant?: "soft" | "solid";
}

/**
 * Small pill filters above a list (Waiting, Approved, Rejected, All). Use the
 * same words on every Manage screen so managers learn them once.
 */
export function AppFilterChips<T extends string>({
  items,
  value,
  onChange,
  ariaLabel,
  className,
  variant = "soft",
}: AppFilterChipsProps<T>) {
  return (
    <div
      role="group"
      aria-label={ariaLabel}
      className={["flex flex-wrap gap-[0.4rem]", className ?? ""].filter(Boolean).join(" ")}
    >
      {items.map((item) => {
        const selected = item.id === value;
        return (
          <button
            key={item.id}
            type="button"
            aria-pressed={selected}
            onClick={() => onChange(item.id)}
            className={[
              "cursor-pointer rounded-full border px-[0.75rem] py-[0.28rem] text-[0.85rem] font-bold",
              "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emp-focus",
              selected
                ? variant === "solid"
                  ? "border-emp-accent bg-emp-accent text-emp-on-accent"
                  : "border-emp-accent bg-emp-accent-soft text-emp-accent"
                : "border-emp-line bg-emp-surface text-emp-text hover:border-emp-accent",
            ].join(" ")}
          >
            {item.count === undefined ? item.label : `${item.label} (${item.count})`}
          </button>
        );
      })}
    </div>
  );
}
