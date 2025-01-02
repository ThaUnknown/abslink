import { type EventEmitter } from 'node:events'
import { wrap as _wrap, expose as _expose, type Endpoint, finalizer, Remote } from '../src/abslink'

function createWrapper (worker: Worker): Endpoint {
  const listeners = new WeakMap<(...args: any[]) => void, (...args: any[]) => void>()

  return {
    on<K extends 'message'> (event: K, listener: (data: any) => void) {
      const unwrapped = (event: MessageEvent) => listener(event.data)
      worker.addEventListener(event, unwrapped)
      listeners.set(listener, unwrapped)
      return this as unknown as EventEmitter<{message: [string]}>
    },
    off<K extends 'message'> (event: K, listener: (...args: any[]) => void) {
      const unwrapped = listeners.get(listener)
      if (unwrapped) {
        worker.removeEventListener(event, unwrapped)
        listeners.delete(listener)
      }
      return this as unknown as EventEmitter<{message: [string]}>
    },
    postMessage (message: Parameters<typeof worker.postMessage>[0]) {
      worker.postMessage(message)
    },
    [finalizer]: () => {
      worker.terminate?.()
    }
  }
}

export function wrap<T> (worker: Worker): Remote<T> {
  return _wrap(createWrapper(worker))
}

export function expose (obj: any): void {
  return _expose(obj, createWrapper(self as unknown as Worker))
}
