import { render } from "@testing-library/react";
import { CopyIcon, DownloadIcon } from "lucide-react";
import { describe, expect, it, vi } from "vitest";

import { Table, TableBody, TableRow } from "../ui/table.js";
import { RowActions } from "./row-actions.js";

// Its own file: the snapshot holds React ids, which count across the renders of one file.
describe("RowActions without step (SUI-FEATURE-330)", () => {
  it("AC6: renders exactly as before", () => {
    const { container } = render(
      <Table>
        <TableBody>
          <TableRow>
            <RowActions
              rowName="Ada"
              usage={{ count: 2, active: false, onToggle: vi.fn() }}
              extra={[
                { label: "Copy", icon: CopyIcon, onClick: vi.fn(), disabledText: "Not yet" },
                { label: "Send", icon: DownloadIcon, onClick: vi.fn(), busy: true },
              ]}
              onEdit={vi.fn()}
              onDelete={vi.fn()}
              menu={{ label: "More Ada", items: [{ label: "Archive", onSelect: vi.fn() }] }}
              deleteShortcut
            />
          </TableRow>
        </TableBody>
      </Table>,
    );
    expect(container.innerHTML).toMatchSnapshot();
  });
});
