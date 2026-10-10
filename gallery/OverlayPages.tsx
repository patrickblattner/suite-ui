import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
// sonner's own toast: the package's `toast` caps every duration at 12 s, and the gallery holds its
// toasts for the screenshots.
import { toast } from "sonner";

import { Button } from "../src/ui/button.js";
import { ConfirmDeleteDialog } from "../src/ui/confirm-delete-dialog.js";
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "../src/ui/dialog.js";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "../src/ui/dropdown-menu.js";
import { Input } from "../src/ui/input.js";
import { Label } from "../src/ui/label.js";
import { Popover, PopoverContent, PopoverTrigger } from "../src/ui/popover.js";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../src/ui/select.js";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "../src/ui/sheet.js";
import { Textarea } from "../src/ui/textarea.js";
import { TimezoneCombobox } from "../src/ui/timezone-combobox.js";
import { Toaster } from "../src/ui/toaster.js";
import { Tooltip, TooltipContent, TooltipTrigger } from "../src/ui/tooltip.js";

// Keeps a gallery overlay open while another one takes the focus or the pointer.
const stayOpen = {
  onOpenAutoFocus: (event: Event) => event.preventDefault(),
  onCloseAutoFocus: (event: Event) => event.preventDefault(),
  onInteractOutside: (event: Event) => event.preventDefault(),
};

export function DialogPage() {
  const { t } = useTranslation("suite");
  const [timezone, setTimezone] = useState("Europe/Zurich");
  return (
    <Dialog open>
      <DialogContent size="form" mode="add" data-testid="form-dialog">
        <DialogHeader>
          <DialogTitle>Add channel</DialogTitle>
          <DialogDescription>A form dialog in add mode.</DialogDescription>
        </DialogHeader>
        <DialogBody className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <Label htmlFor="channel-name">Name</Label>
            <Input id="channel-name" placeholder="Name" />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="channel-notes">Notes</Label>
            <Textarea id="channel-notes" defaultValue="Grows with its text." />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="channel-timezone">Time zone</Label>
            <TimezoneCombobox
              id="channel-timezone"
              value={timezone}
              onValueChange={setTimezone}
              data-testid="dialog-timezone"
            />
          </div>
        </DialogBody>
        <DialogFooter>
          <Button variant="outline" size="default" data-testid="dialog-cancel">
            {t("actions.cancel")}
          </Button>
          <Button variant="success" size="default" data-testid="dialog-primary">
            {t("actions.save")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function ConfirmPage() {
  return (
    <ConfirmDeleteDialog
      open
      description="Channel “Main” is removed for good."
      onConfirm={() => undefined}
      onOpenChange={() => undefined}
      data-testid="confirm-dialog"
    />
  );
}

export function OverlaysPage() {
  const { t } = useTranslation("suite");
  return (
    <div className="grid grid-cols-3 gap-8 pt-2">
      <DropdownMenu open modal={false}>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" size="default" className="w-fit">
            DropdownMenu
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" {...stayOpen}>
          <DropdownMenuLabel>Run</DropdownMenuLabel>
          <DropdownMenuGroup>
            <DropdownMenuItem>Edit</DropdownMenuItem>
            <DropdownMenuItem disabled>Disabled</DropdownMenuItem>
          </DropdownMenuGroup>
          <DropdownMenuSeparator />
          <DropdownMenuItem variant="destructive">{t("actions.delete")}</DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      <Popover open>
        <PopoverTrigger asChild>
          <Button variant="outline" size="default" className="w-fit">
            Popover
          </Button>
        </PopoverTrigger>
        <PopoverContent align="start" {...stayOpen}>
          Popover content
        </PopoverContent>
      </Popover>
      <Tooltip open>
        <TooltipTrigger asChild>
          <Button variant="outline" size="default" className="w-fit">
            Tooltip
          </Button>
        </TooltipTrigger>
        <TooltipContent>Saves the draft</TooltipContent>
      </Tooltip>
    </div>
  );
}

export function SelectPage() {
  return (
    <Select open defaultValue="weekly">
      <SelectTrigger aria-label="Select open" className="w-48">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="daily">Daily</SelectItem>
        <SelectItem value="weekly">Weekly</SelectItem>
        <SelectItem value="monthly" disabled>
          Monthly (disabled)
        </SelectItem>
      </SelectContent>
    </Select>
  );
}

export function SheetPage() {
  const { t } = useTranslation("suite");
  return (
    <Sheet open>
      <SheetContent data-testid="sheet">
        <SheetHeader>
          <SheetTitle>Sheet</SheetTitle>
          <SheetDescription>A side panel from the right.</SheetDescription>
        </SheetHeader>
        <div className="px-4">Content</div>
        <SheetFooter>
          <Button variant="outline" size="default">
            {t("actions.close")}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}

export function ToastPage({ theme }: { theme: "light" | "dark" }) {
  useEffect(() => {
    // Fixed ids, so the second effect run of StrictMode updates the toasts instead of doubling them.
    const options = (id: string) => ({ id, duration: Infinity });
    toast("Neutral", options("neutral"));
    toast.info("Info", options("info"));
    toast.warning("Warning", options("warning"));
    toast.error("Error", options("error"));
    toast.success("Success", options("success"));
  }, []);
  return <Toaster theme={theme} expand visibleToasts={5} closeButton />;
}
