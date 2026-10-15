import { XIcon } from "lucide-react";
import type * as React from "react";

type RemovableChipProps = {
  label: React.ReactNode;
  onRemove: () => void;
  // The ×'s accessible name, e.g. "Remove tag summer".
  removeLabel: string;
  disabled?: boolean;
  // The chip gets `<testId>-chip`, its × `<testId>-remove`.
  testId?: string;
};

// The one chip with a remove button (`SUI-FEATURE-007`): a `h-6` chip whose × is a round `size-6`
// button. A chip without removal stays `Badge` (`GL-UI-011`). The focus after removal and its
// announcement are the caller's.
function RemovableChip({
  label,
  onRemove,
  removeLabel,
  disabled = false,
  testId = "removable-chip",
}: RemovableChipProps) {
  return (
    <span
      data-testid={`${testId}-chip`}
      className="inline-flex h-6 items-center gap-1 rounded-full bg-secondary pl-2.5 text-xs font-medium text-secondary-foreground"
    >
      {label}
      <button
        type="button"
        aria-label={removeLabel}
        disabled={disabled}
        onClick={onRemove}
        data-testid={`${testId}-remove`}
        className="relative inline-flex size-6 items-center justify-center rounded-full outline-none after:absolute after:top-1/2 after:left-1/2 after:size-6 after:-translate-x-1/2 after:-translate-y-1/2 hover:bg-secondary-hover focus-visible:focus-ring disabled:pointer-events-none"
      >
        <XIcon aria-hidden="true" className="size-3" />
      </button>
    </span>
  );
}

export { RemovableChip, type RemovableChipProps };
