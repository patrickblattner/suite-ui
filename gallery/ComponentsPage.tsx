import { PencilIcon, PlusIcon, Trash2Icon } from "lucide-react";
import type { ReactNode } from "react";
import { useState } from "react";
import { useTranslation } from "react-i18next";

import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "../src/ui/accordion.js";
import { Badge, type BadgeVariant } from "../src/ui/badge.js";
import { Button, type ButtonSize, type ButtonVariant } from "../src/ui/button.js";
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "../src/ui/card.js";
import { Checkbox } from "../src/ui/checkbox.js";
import { Hint } from "../src/ui/hint.js";
import { Input } from "../src/ui/input.js";
import { Label } from "../src/ui/label.js";
import { LabelWithHelp } from "../src/ui/label-with-help.js";
import { RadioGroup, RadioGroupItem } from "../src/ui/radio-group.js";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../src/ui/select.js";
import { Skeleton } from "../src/ui/skeleton.js";
import { Switch } from "../src/ui/switch.js";
import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "../src/ui/table.js";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../src/ui/tabs.js";
import { Textarea } from "../src/ui/textarea.js";
import { TimezoneCombobox } from "../src/ui/timezone-combobox.js";

const VARIANTS: ButtonVariant[] = [
  "success",
  "warn",
  "destructive",
  "outline",
  "secondary",
  "ghost",
  "default",
  "link",
];
const TEXT_SIZES: ButtonSize[] = ["default", "xs", "sm", "lg"];
const ICON_SIZES: ButtonSize[] = ["icon", "icon-xs", "icon-sm", "icon-lg"];
const BADGES: BadgeVariant[] = [
  "success",
  "warn",
  "destructive",
  "secondary",
  "outline",
  "default",
];

export function Section({
  id,
  title,
  children,
}: {
  id: string;
  title: string;
  children: ReactNode;
}) {
  return (
    <section aria-labelledby={`${id}-heading`} data-testid={`section-${id}`} className="mb-8">
      <h2 id={`${id}-heading`} className="mb-3 text-lg font-medium">
        {title}
      </h2>
      {children}
    </section>
  );
}

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex items-center gap-3 py-1">
      <span className="w-32 shrink-0 text-muted-foreground">{label}</span>
      <div className="flex flex-wrap items-center gap-3">{children}</div>
    </div>
  );
}

function Buttons() {
  const { t } = useTranslation("suite");
  return (
    <Section id="button" title="Button">
      {VARIANTS.map((variant) => (
        <Row key={variant} label={variant}>
          {TEXT_SIZES.map((size) => (
            <Button key={size} variant={variant} size={size}>
              {t("actions.save")} {size}
            </Button>
          ))}
          {ICON_SIZES.map((size) => (
            <Button key={size} variant={variant} size={size} aria-label={t("actions.create")}>
              <PlusIcon />
            </Button>
          ))}
          <Button variant={variant} size="default" disabled>
            disabled
          </Button>
          <Button variant={variant} size="default" busy>
            <PlusIcon />
            busy
          </Button>
          <Button variant={variant} size="default" loading>
            loading
          </Button>
        </Row>
      ))}
      <Row label="row actions">
        <Button variant="warn" size="icon-xs" aria-label="Edit">
          <PencilIcon />
        </Button>
        <Button variant="destructive" size="icon-xs" aria-label={t("actions.delete")}>
          <Trash2Icon />
        </Button>
      </Row>
    </Section>
  );
}

function Fields() {
  const [timezone, setTimezone] = useState("Europe/Zurich");
  const [empty, setEmpty] = useState("");
  return (
    <Section id="fields" title="Input · Textarea · Label · TimezoneCombobox">
      <div className="grid grid-cols-4 gap-4">
        <div className="flex flex-col gap-2">
          <Label htmlFor="input-empty">Label</Label>
          <Input id="input-empty" placeholder="Placeholder" />
        </div>
        <div className="flex flex-col gap-2">
          <LabelWithHelp htmlFor="input-filled" help="The name shown in lists">
            LabelWithHelp
          </LabelWithHelp>
          <Input id="input-filled" defaultValue="Filled" aria-describedby="input-filled-help" />
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="input-disabled">Disabled</Label>
          <Input id="input-disabled" defaultValue="Disabled" disabled />
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="input-invalid">Invalid</Label>
          <Input id="input-invalid" defaultValue="Invalid" aria-invalid />
        </div>
        <Textarea aria-label="Textarea empty" placeholder="Placeholder" />
        <Textarea aria-label="Textarea filled" defaultValue={"Two\nlines"} />
        <Textarea aria-label="Textarea disabled" defaultValue="Disabled" disabled />
        <Textarea aria-label="Textarea invalid" defaultValue="Invalid" aria-invalid />
        <TimezoneCombobox
          value={timezone}
          onValueChange={setTimezone}
          data-testid="timezone-value"
        />
        <TimezoneCombobox value={empty} onValueChange={setEmpty} data-testid="timezone-empty" />
        <TimezoneCombobox value="Europe/Berlin" onValueChange={() => undefined} disabled />
        <TimezoneCombobox value="Europe/Berlin" onValueChange={() => undefined} aria-invalid />
      </div>
    </Section>
  );
}

function Choices() {
  return (
    <Section id="choices" title="Checkbox · RadioGroup · Switch · Select">
      <Row label="Checkbox">
        <Checkbox aria-label="unchecked" />
        <Checkbox aria-label="checked" defaultChecked />
        <Checkbox aria-label="disabled" disabled />
        <Checkbox aria-label="disabled checked" disabled defaultChecked />
        <Checkbox aria-label="invalid" aria-invalid />
      </Row>
      <Row label="RadioGroup">
        <RadioGroup defaultValue="a" className="flex gap-4" aria-label="RadioGroup">
          {["a", "b", "c"].map((value) => (
            <div key={value} className="flex items-center gap-2">
              <RadioGroupItem id={`radio-${value}`} value={value} disabled={value === "c"} />
              <Label htmlFor={`radio-${value}`}>{value === "c" ? "disabled" : value}</Label>
            </div>
          ))}
        </RadioGroup>
      </Row>
      <Row label="Switch">
        <Switch aria-label="off" />
        <Switch aria-label="on" defaultChecked />
        <Switch aria-label="disabled" disabled />
        <Switch aria-label="disabled on" disabled defaultChecked />
        <Switch aria-label="sm off" size="sm" />
        <Switch aria-label="sm on" size="sm" defaultChecked />
      </Row>
      <Row label="Select">
        <Select defaultValue="weekly">
          <SelectTrigger aria-label="Select with value" className="w-48">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="daily">Daily</SelectItem>
            <SelectItem value="weekly">Weekly</SelectItem>
          </SelectContent>
        </Select>
        <Select>
          <SelectTrigger aria-label="Select empty" className="w-48">
            <SelectValue placeholder="Placeholder" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="daily">Daily</SelectItem>
          </SelectContent>
        </Select>
        <Select defaultValue="daily" disabled>
          <SelectTrigger aria-label="Select disabled" className="w-48">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="daily">Daily</SelectItem>
          </SelectContent>
        </Select>
        <Select defaultValue="daily">
          <SelectTrigger aria-label="Select small" size="sm" className="w-48">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="daily">Daily</SelectItem>
          </SelectContent>
        </Select>
        <Select defaultValue="long">
          <SelectTrigger aria-label="Select clipped" className="w-32">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="long">A value too long for its trigger</SelectItem>
          </SelectContent>
        </Select>
      </Row>
    </Section>
  );
}

function Badges() {
  const { t } = useTranslation("suite");
  const label: Partial<Record<BadgeVariant, string>> = {
    success: t("status.success"),
    warn: t("status.warning"),
    destructive: t("status.error"),
  };
  return (
    <Section id="badge" title="Badge · Hint · Skeleton">
      <Row label="Badge">
        {BADGES.map((variant) => (
          <Badge key={variant} variant={variant}>
            {label[variant] ?? variant}
          </Badge>
        ))}
      </Row>
      <Row label="Hint">
        <Hint text="Saves the draft">
          <Button variant="success" size="default">
            {t("actions.save")}
          </Button>
        </Hint>
        <Hint text="Saves the draft" disabledText="Possible once a field changed">
          <Button variant="success" size="default" disabled>
            {t("actions.save")}
          </Button>
        </Hint>
      </Row>
      <Row label="Skeleton">
        <Skeleton className="h-4 w-48" />
        <Skeleton className="size-9 rounded-full" />
      </Row>
    </Section>
  );
}

function Structure() {
  return (
    <Section id="structure" title="Tabs · Card · Table · Accordion">
      <div className="grid grid-cols-2 gap-6">
        <div className="flex flex-col gap-4">
          <Tabs defaultValue="general">
            <TabsList>
              <TabsTrigger value="general">General</TabsTrigger>
              <TabsTrigger value="mail">Mail</TabsTrigger>
              <TabsTrigger value="off" disabled>
                Disabled
              </TabsTrigger>
            </TabsList>
            <TabsContent value="general">Default tabs</TabsContent>
          </Tabs>
          <Tabs defaultValue="general">
            <TabsList variant="line">
              <TabsTrigger value="general">General</TabsTrigger>
              <TabsTrigger value="mail">Mail</TabsTrigger>
            </TabsList>
            <TabsContent value="general">Line tabs</TabsContent>
          </Tabs>
          <Accordion type="single" collapsible defaultValue="open">
            <AccordionItem value="open">
              <AccordionTrigger>Open item</AccordionTrigger>
              <AccordionContent>The content of the open item.</AccordionContent>
            </AccordionItem>
            <AccordionItem value="closed">
              <AccordionTrigger>Closed item</AccordionTrigger>
              <AccordionContent>Hidden.</AccordionContent>
            </AccordionItem>
          </Accordion>
        </div>
        <div className="flex flex-col gap-4">
          <div className="grid grid-cols-2 gap-4">
            <Card>
              <CardHeader>
                <CardTitle>Card</CardTitle>
                <CardDescription>Presentational</CardDescription>
                <CardAction>
                  <Badge variant="secondary">Manual</Badge>
                </CardAction>
              </CardHeader>
              <CardContent>Content</CardContent>
              <CardFooter>Footer</CardFooter>
            </Card>
            <Card interactive tabIndex={0}>
              <CardHeader>
                <CardTitle>Interactive card</CardTitle>
                <CardDescription>Clickable</CardDescription>
              </CardHeader>
              <CardContent>Content</CardContent>
            </Card>
          </div>
          <Table>
            <TableCaption>Table</TableCaption>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Count</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              <TableRow>
                <TableCell>Alpha</TableCell>
                <TableCell>
                  <Badge variant="success">Success</Badge>
                </TableCell>
                <TableCell className="text-right">12</TableCell>
              </TableRow>
              <TableRow data-state="selected">
                <TableCell>Beta (selected)</TableCell>
                <TableCell>
                  <Badge variant="destructive">Error</Badge>
                </TableCell>
                <TableCell className="text-right">3</TableCell>
              </TableRow>
              <TableRow>
                <TableCell>Gamma</TableCell>
                <TableCell>
                  <Badge variant="outline">Automatic</Badge>
                </TableCell>
                <TableCell className="text-right">0</TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </div>
      </div>
    </Section>
  );
}

export function ComponentsPage() {
  return (
    <>
      <Buttons />
      <Badges />
      <Fields />
      <Choices />
      <Structure />
    </>
  );
}
