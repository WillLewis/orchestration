import { useSyncExternalStore } from "react";

let latestRecordId = "gwp_acme_001";
const listeners = new Set<() => void>();

function emit() {
  listeners.forEach((listener) => listener());
}

export function getLatestRecordId() {
  return latestRecordId;
}

export function setLatestRecordId(recordId: string) {
  if (!recordId || recordId === latestRecordId) return;
  latestRecordId = recordId;
  emit();
}

export function useLatestRecordId() {
  return useSyncExternalStore(
    (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    () => latestRecordId,
    () => "gwp_acme_001",
  );
}
