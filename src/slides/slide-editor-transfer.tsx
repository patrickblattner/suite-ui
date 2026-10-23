import * as React from "react";
import { useTranslation } from "react-i18next";

import { Button } from "../ui/button.js";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "../ui/dialog.js";
import { Hint } from "../ui/hint.js";
import { Label } from "../ui/label.js";
import { RadioGroup, RadioGroupItem } from "../ui/radio-group.js";
import type { SlideFormat } from "./schema.js";

// What the transfer takes: the page shown, or the whole document.
export type TransferScope = "page" | "all";

// One option of the dialog: radio and label are one hint trigger, as both carry the same text
// (`GL-UI-017`), so the bubble stands beside the label, never over it (`GL-UI-016` §Lage). The radio
// itself takes the text as its description.
function TransferOption({
  id,
  value,
  label,
  hint,
}: {
  id: string;
  value: string;
  label: string;
  hint: string;
}) {
  return (
    <>
      <Hint text={hint} describe={false}>
        <Label htmlFor={id} className="w-fit">
          <RadioGroupItem value={value} id={id} aria-describedby={`${id}-hint`} />
          {label}
        </Label>
      </Hint>
      <span id={`${id}-hint`} hidden>
        {hint}
      </span>
    </>
  );
}

// The editor's "Transfer format" (`SUI-FEATURE-162` §Format übertragen, `SUI-FEATURE-231`): a button
// that opens a dialog to choose one of the app's other formats and what to transfer; Transfer hands
// the choice to the editor, which makes the copy. The dialog has its own keyboard path (radio
// groups, Esc, Enter on Transfer) and returns the focus to the button.
export function TransferFormat({
  formats,
  onTransfer,
}: {
  formats: readonly SlideFormat[];
  onTransfer: (format: SlideFormat, scope: TransferScope) => void;
}) {
  const { t } = useTranslation("suite");
  const [open, setOpen] = React.useState(false);
  const [chosen, setChosen] = React.useState("0");
  const [scope, setScope] = React.useState<TransferScope>("all");
  const id = React.useId();
  const confirm = () => {
    const format = formats[Number(chosen)];
    setOpen(false);
    if (format !== undefined) onTransfer(format, scope);
  };
  // Enter on a choice triggers Transfer, as Enter does anywhere in a dialog but on a button
  // (`GL-UI-027` §Tastatur).
  const enterConfirms = (event: React.KeyboardEvent) => {
    if (event.key !== "Enter") return;
    event.preventDefault();
    confirm();
  };
  return (
    <>
      <Hint text={t("slides.editor.transferHint")}>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => {
            setChosen("0");
            // The whole document first: the transfer replaces the Cockpit studio's
            // (`SUI-FEATURE-231` rev 3).
            setScope("all");
            setOpen(true);
          }}
          data-testid="slide-editor-transfer"
        >
          {t("slides.editor.transfer")}
        </Button>
      </Hint>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent data-testid="slide-editor-transfer-dialog">
          <DialogHeader>
            <DialogTitle>{t("slides.editor.transferTitle")}</DialogTitle>
            <DialogDescription>{t("slides.editor.transferDescription")}</DialogDescription>
          </DialogHeader>
          <fieldset className="flex flex-col gap-2">
            <legend className="mb-2 text-sm font-medium">
              {t("slides.editor.transferFormat")}
            </legend>
            <RadioGroup
              value={chosen}
              onValueChange={setChosen}
              onKeyDown={enterConfirms}
              data-testid="slide-editor-transfer-formats"
            >
              {formats.map((format, index) => (
                <TransferOption
                  key={index}
                  id={`${id}-format-${index}`}
                  value={String(index)}
                  label={t("slides.editor.transferFormatOption", {
                    name: format.name,
                    width: format.width,
                    height: format.height,
                    interpolation: { escapeValue: false },
                  })}
                  hint={t("slides.editor.transferFormatOptionHint", {
                    width: format.width,
                    height: format.height,
                  })}
                />
              ))}
            </RadioGroup>
          </fieldset>
          <fieldset className="flex flex-col gap-2">
            <legend className="mb-2 text-sm font-medium">{t("slides.editor.transferScope")}</legend>
            <RadioGroup
              value={scope}
              onValueChange={(value) => setScope(value === "all" ? "all" : "page")}
              onKeyDown={enterConfirms}
              // The options are one group of controls: an option's bubble stands beside the labels it
              // would reach, so it never covers the other option's (`GL-UI-016` §Lage, #438).
              data-tooltip-row=""
              data-testid="slide-editor-transfer-scope"
            >
              {(["page", "all"] as const).map((value) => (
                <TransferOption
                  key={value}
                  id={`${id}-scope-${value}`}
                  value={value}
                  label={t(
                    value === "page" ? "slides.editor.transferPage" : "slides.editor.transferAll",
                  )}
                  hint={t(
                    value === "page"
                      ? "slides.editor.transferPageHint"
                      : "slides.editor.transferAllHint",
                  )}
                />
              ))}
            </RadioGroup>
          </fieldset>
          <DialogFooter>
            <Hint text={t("slides.editor.transferCancelHint")}>
              <Button
                type="button"
                variant="outline"
                size="default"
                onClick={() => setOpen(false)}
                data-testid="slide-editor-transfer-cancel"
              >
                {t("slides.editor.transferCancel")}
              </Button>
            </Hint>
            <Hint text={t("slides.editor.transferConfirmHint")}>
              <Button
                type="button"
                variant="default"
                size="default"
                onClick={confirm}
                data-testid="slide-editor-transfer-confirm"
              >
                {t("slides.editor.transferConfirm")}
              </Button>
            </Hint>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
