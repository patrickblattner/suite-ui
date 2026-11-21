import { PlusIcon } from "lucide-react";
import { useRef } from "react";

import { Button } from "../src/ui/button.js";
import { toast, Toaster, useToastClearance } from "../src/ui/toaster.js";

// A page with two lists side by side whose headers sit at the top of the content (`GL-UI-028`,
// `SUI-FEATURE-147`): the page calls `useToastClearance` once per list header, so the toast after
// Add starts below the lowest header and covers neither header's add action. Below `lg` the lists
// stack and the second header sits mid-page, outside the receipt area, so only the first counts
// (rev 3).
function ListColumn({ id, title, items }: { id: string; title: string; items: string[] }) {
  const header = useRef<HTMLDivElement>(null);
  useToastClearance(header);
  return (
    <section className="flex min-w-0 flex-1 flex-col gap-4" aria-labelledby={`${id}-title`}>
      <div
        ref={header}
        className="flex items-center justify-between gap-4"
        data-testid={`${id}-header`}
      >
        <h2 id={`${id}-title`} className="text-base font-semibold">
          {title}
        </h2>
        <Button
          variant="default"
          size="default"
          data-testid={`${id}-add`}
          onClick={() => {
            toast.success(`${title}: entry added.`);
          }}
        >
          <PlusIcon aria-hidden="true" />
          Add
        </Button>
      </div>
      <ul className="flex flex-col divide-y rounded-md border">
        {items.map((item) => (
          <li key={item} className="px-4 py-2">
            {item}
          </li>
        ))}
      </ul>
    </section>
  );
}

export function ListClearancePage({ theme }: { theme: "light" | "dark" }) {
  return (
    <div className="flex flex-col gap-6 lg:flex-row" data-testid="list-clearance">
      <ListColumn
        id="series"
        title="Series"
        items={["Morning news", "Weekly review", "Interviews"]}
      />
      <ListColumn
        id="seasons"
        title="Seasons"
        items={["Spring 2026", "Summer 2026", "Autumn 2026"]}
      />
      <Toaster theme={theme} />
    </div>
  );
}
