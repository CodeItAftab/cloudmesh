export function throttle<T extends (...args: any[]) => void>(
  fn: T,
  waitMs: number,
): T {
  let lastCall = 0;
  let pendingArgs: any[] | null = null;
  let timeout: ReturnType<typeof setTimeout> | null = null;

  const invoke = (args: any[]) => {
    lastCall = Date.now();
    fn(...args);
  };

  return ((...args: any[]) => {
    const now = Date.now();
    const remaining = waitMs - (now - lastCall);

    if (remaining <= 0) {
      if (timeout) {
        clearTimeout(timeout);
        timeout = null;
      }
      invoke(args);
    } else {
      pendingArgs = args;
      if (!timeout) {
        timeout = setTimeout(() => {
          timeout = null;
          if (pendingArgs) invoke(pendingArgs);
        }, remaining);
      }
    }
  }) as T;
}
