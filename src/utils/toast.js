export const toastEvent = new EventTarget()

export const toast = {
  success: (message) => toastEvent.dispatchEvent(new CustomEvent('show', { detail: { message, type: 'success' } })),
  error: (message) => toastEvent.dispatchEvent(new CustomEvent('show', { detail: { message, type: 'error' } }))
}
