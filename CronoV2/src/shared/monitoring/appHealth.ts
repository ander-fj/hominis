export function reportUnhandledError(error: unknown, context: string) {
  console.error(`[${context}]`, error);
}

export function installGlobalErrorMonitoring() {
  window.addEventListener('error', (event) => reportUnhandledError(event.error ?? event.message, 'window.error'));
  window.addEventListener('unhandledrejection', (event) => reportUnhandledError(event.reason, 'unhandledrejection'));
}
