'use client';

import { useId, useLayoutEffect, useSyncExternalStore } from 'react';

interface StackEntry {
  id: string;
  zIndex: number;
}

const modalStack: StackEntry[] = [];
const listeners = new Set<() => void>();

function notifyListeners() {
  for (const listener of listeners) {
    listener();
  }
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function computeNextZIndex(minZIndex: number): number {
  const topZ = modalStack.reduce((max, entry) => Math.max(max, entry.zIndex), 0);
  if (topZ === 0) return minZIndex;
  return Math.max(minZIndex, topZ + 10);
}

function getModalZIndex(id: string, fallback: number): number {
  const entry = modalStack.find((item) => item.id === id);
  return entry ? entry.zIndex : fallback;
}

/**
 * Dynamically allocates a z-index above all currently open modals so that
 * any nested or chained modal always renders cleanly on top of its parent.
 */
export function useModalZIndex(isOpen: boolean, minZIndex: number = 100): number {
  const modalId = useId();

  useLayoutEffect(() => {
    if (!isOpen) return;

    const existingIdx = modalStack.findIndex((item) => item.id === modalId);
    if (existingIdx !== -1) {
      modalStack.splice(existingIdx, 1);
    }

    const allocated = computeNextZIndex(minZIndex);
    modalStack.push({ id: modalId, zIndex: allocated });
    notifyListeners();

    return () => {
      const idx = modalStack.findIndex((item) => item.id === modalId);
      if (idx !== -1) {
        modalStack.splice(idx, 1);
        notifyListeners();
      }
    };
  }, [isOpen, minZIndex, modalId]);

  return useSyncExternalStore(
    subscribe,
    () => (isOpen ? getModalZIndex(modalId, minZIndex) : minZIndex),
    () => minZIndex,
  );
}

/**
 * Returns the highest z-index currently active on the modal stack.
 */
export function getTopModalZIndex(): number {
  return modalStack.reduce((max, entry) => Math.max(max, entry.zIndex), 0);
}

