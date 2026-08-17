"use client";

import { useSyncExternalStore } from "react";

const emptySubscribe = () => () => {};

/**
 * False during server render and the first client render, true afterwards.
 *
 * Use it to gate components that seed their state from browser-only storage.
 * Reading sessionStorage in a `useState` initialiser looks convenient, but the
 * prerendered HTML has no storage to read, so the first client render disagrees
 * with the server and React throws a hydration mismatch. Rendering a
 * placeholder until this flips means the component mounts fresh on the client,
 * where the initialiser can read storage safely.
 */
export function useMounted(): boolean {
  return useSyncExternalStore(
    emptySubscribe,
    () => true,
    () => false,
  );
}
