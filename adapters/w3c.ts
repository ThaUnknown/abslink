import { wrap as _wrap, expose as _expose, type Endpoint, finalizer, Remote } from '../src/abslink'
import { Messageable, W3CMessageEvent, W3CLike } from '../src/types'

function createWrapper (channel: W3CLike, messageable: Messageable): Endpoint {
  const listeners = new WeakMap<(...args: any[]) => void, (...args: any[]) => void>()

  return {
    on (event: string, listener: (data: any) => void) {
      const unwrapped = (event: W3CMessageEvent) => listener(event.data)
      channel.addEventListener(event, unwrapped)
      listeners.set(listener, unwrapped)
    },
    off (event: string, listener: (...args: any[]) => void) {
      const unwrapped = listeners.get(listener)
      channel.removeEventListener(event, unwrapped)
      listeners.delete(listener)
    },
    postMessage (message: any) {
      messageable.postMessage(message)
    },
    [finalizer]: () => {
      channel.terminate?.()
      messageable.terminate?.()
    }
  }
}

export function wrap<T> (channel: W3CLike, messageable: Messageable = channel as unknown as Messageable): Remote<T> {
  return _wrap(createWrapper(channel, messageable))
}

export function expose <T extends any> (obj: T, channel: W3CLike = self, messageable: Messageable = channel as unknown as Messageable): T {
  return _expose(obj, createWrapper(channel, messageable))
}
