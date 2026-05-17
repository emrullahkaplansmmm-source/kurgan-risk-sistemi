import { createInternalRoot } from 'react';

export function createRoot(container) {
  if (!container) throw new Error('createRoot requires a DOM container.');
  return createInternalRoot(container);
}
