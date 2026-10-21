import { Field } from "../src/ui/field.js";
import { Input } from "../src/ui/input.js";

// `?harness=field-pair` (#441): two `Field`s side by side in an app's own grid, without a row marker,
// and one full-width field under them, as an app lays out a form. The hint bubbles of the pair stand
// beside the whole pair; at 390 px the full-width field's bubble stands at the field, at least 120 px
// wide (`GL-UI-016` §Lage). Not a gallery page, so it adds no capture and no page option.
function FieldPairHarness() {
  return (
    <main className="flex max-w-3xl flex-col gap-4 p-6">
      <div className="grid grid-cols-2 gap-4" data-testid="harness-pair">
        <Field
          label="Name"
          htmlFor="harness-name"
          hint="The name shown in lists."
          valueHint="Up to 80 characters."
        >
          <Input id="harness-name" />
        </Field>
        <Field
          label="Owner"
          htmlFor="harness-owner"
          hint="Who answers questions about this item."
          valueHint="Pick one person of this team; they get the mails."
        >
          <Input id="harness-owner" />
        </Field>
      </div>
      <Field
        label="Description"
        htmlFor="harness-description"
        hint="What the item is for, in a sentence."
        valueHint="Shown under the name in lists."
      >
        <Input id="harness-description" />
      </Field>
    </main>
  );
}

export { FieldPairHarness };
