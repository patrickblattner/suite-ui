import * as React from "react";

// The running operations, shared by the provider and the status display. Internal: not exported from
// any package path (`SUI-FEATURE-077`).
type Operation = { id: number; scope: string; label: string; progress?: number };

const OperationsContext = React.createContext<readonly Operation[] | null>(null);

export { type Operation, OperationsContext };
