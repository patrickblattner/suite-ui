import * as React from "react";

import { toast } from "../ui/toaster.js";
import { type Operation, OperationsContext } from "./context.js";

// The provider part of the operation status (`GL-UI-033`, `SUI-FEATURE-077`): the app frame mounts it,
// so it sits in every app's entry bundle. It depends on no display building block; the status slot,
// indicator and label (`@suite/ui/ui/operation-status`) read the operations from here.

// `progress` is a share from 0 to 1; without it the operation only runs.
type OperationStart = { scope: string; label: string; progress?: number };
type OperationUpdate = { label?: string; progress?: number };
// An action on the end toast (`SUI-FEATURE-141`): the app supplies the label in its language, and
// `onClick` must still work once the page that started the operation is gone.
type OperationEndAction = { label: string; onClick: () => void };
type OperationEnd = { action?: OperationEndAction };

type OperationHandle = {
  update: (patch: OperationUpdate) => void;
  succeed: (message: string, end?: OperationEnd) => void;
  fail: (message: string, end?: OperationEnd) => void;
};

type OperationStatusApi = { start: (operation: OperationStart) => OperationHandle };

const OperationStatusApiContext = React.createContext<OperationStatusApi | null>(null);

// The running operations of the session (`GL-UI-033`), held once beside the `Toaster` and independent of
// the page on screen: a handle keeps working after the page that started it is gone, and its end is
// still acknowledged by a toast.
function OperationStatusProvider({ children }: { children: React.ReactNode }) {
  const [operations, setOperations] = React.useState<readonly Operation[]>([]);
  const nextId = React.useRef(0);

  const api = React.useMemo<OperationStatusApi>(() => {
    const remove = (id: number) => setOperations((prev) => prev.filter((op) => op.id !== id));
    return {
      start: ({ scope, label, progress }) => {
        const id = nextId.current++;
        setOperations((prev) => [...prev, { id, scope, label, progress }]);
        return {
          update: (patch) =>
            setOperations((prev) => prev.map((op) => (op.id === id ? { ...op, ...patch } : op))),
          succeed: (message, end) => {
            remove(id);
            if (end?.action === undefined) toast.success(message);
            else toast.success(message, { action: end.action });
          },
          fail: (message, end) => {
            remove(id);
            if (end?.action === undefined) toast.error(message);
            else toast.error(message, { action: end.action });
          },
        };
      },
    };
  }, []);

  return (
    <OperationStatusApiContext.Provider value={api}>
      <OperationsContext.Provider value={operations}>{children}</OperationsContext.Provider>
    </OperationStatusApiContext.Provider>
  );
}

function useOperationStatus(): OperationStatusApi {
  const api = React.useContext(OperationStatusApiContext);
  if (api === null) throw new Error("useOperationStatus needs an OperationStatusProvider");
  return api;
}

export {
  OperationStatusProvider,
  useOperationStatus,
  type OperationEnd,
  type OperationEndAction,
  type OperationHandle,
  type OperationStart,
  type OperationStatusApi,
  type OperationUpdate,
};
