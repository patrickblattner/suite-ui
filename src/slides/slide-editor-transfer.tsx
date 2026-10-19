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
import { Label } from "../ui/label.js";
import { RadioGroup, RadioGroupItem } from "../ui/radio-group.js";
import type { SlideFormat } from "./schema.js";

// What the transfer takes: the page shown, or the whole document.
export type TransferScope = "page" | "all";

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
  const [scope, setScope] = React.useState<TransferScope>("page");
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
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={() => {
          setChosen("0");
          setScope("page");
          setOpen(true);
        }}
        data-testid="slide-editor-transfer"
      >
        {t("slides.editor.transfer")}
      </Button>
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
                <div key={index} className="flex items-center gap-2">
                  <RadioGroupItem value={String(index)} id={`${id}-format-${index}`} />
                  <Label htmlFor={`${id}-format-${index}`}>
                    {t("slides.editor.transferFormatOption", {
                      name: format.name,
                      width: format.width,
                      height: format.height,
                      interpolation: { escapeValue: false },
                    })}
                  </Label>
                </div>
              ))}
            </RadioGroup>
          </fieldset>
          <fieldset className="flex flex-col gap-2">
            <legend className="mb-2 text-sm font-medium">{t("slides.editor.transferScope")}</legend>
            <RadioGroup
              value={scope}
              onValueChange={(value) => setScope(value === "all" ? "all" : "page")}
              onKeyDown={enterConfirms}
              data-testid="slide-editor-transfer-scope"
            >
              {(["page", "all"] as const).map((value) => (
                <div key={value} className="flex items-center gap-2">
                  <RadioGroupItem value={value} id={`${id}-scope-${value}`} />
                  <Label htmlFor={`${id}-scope-${value}`}>
                    {t(
                      value === "page" ? "slides.editor.transferPage" : "slides.editor.transferAll",
                    )}
                  </Label>
                </div>
              ))}
            </RadioGroup>
          </fieldset>
          <DialogFooter>
            <Button type="button" variant="outline" size="default" onClick={() => setOpen(false)}>
              {t("slides.editor.transferCancel")}
            </Button>
            <Button
              type="button"
              variant="default"
              size="default"
              onClick={confirm}
              data-testid="slide-editor-transfer-confirm"
            >
              {t("slides.editor.transferConfirm")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
