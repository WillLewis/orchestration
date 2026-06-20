import { useSyncExternalStore } from "react";

export type PinnedState = {
  pinned: boolean;
  by?: string;
  at?: number;
};

let state: PinnedState = { pinned: false };
const listeners = new Set<() => void>();

function emit() {
  listeners.forEach((l) => l());
}

function subscribe(cb: () => void) {
  listeners.add(cb);
  return () => {
    listeners.delete(cb);
  };
}

function getSnapshot() {
  return state;
}

export function usePacketPinned(): PinnedState {
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}

export function pinPacket(by: string) {
  state = { pinned: true, by, at: Date.now() };
  emit();
}

export function unpinPacket() {
  state = { pinned: false };
  emit();
}
