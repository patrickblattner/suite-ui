import { Input } from "../src/ui/input.js";

// `?harness=date-fields` (#410, `SUI-FEATURE-260`): the date and time types of `Input` between two
// buttons, so a test tabs onto their calendar button. Not a gallery page, so it adds no capture and no
// page option.
function DateFieldsHarness() {
  return (
    <main className="flex max-w-md flex-col gap-4 p-6">
      <button type="button">Before</button>
      <Input type="datetime-local" aria-label="Starts at" />
      <Input type="date" aria-label="Day" />
      <Input type="time" aria-label="Time" />
      <Input type="month" aria-label="Month" />
      <Input type="week" aria-label="Week" />
      <Input type="date" aria-label="Invalid day" aria-invalid="true" />
      <button type="button">After</button>
    </main>
  );
}

export { DateFieldsHarness };
