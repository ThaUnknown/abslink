import { wrap as _wrap, expose as _expose, type Endpoint, finalizer, Remote } from '../src/abslink'
import { Messageable, NodeLike } from '../src/types'

function createWrapper (channel: NodeLike, messageable: Messageable): Endpoint {
  return {
    on (event: string, listener: (data: any) => void) {
      channel.on(event, listener)
    },
    off (event: string, listener: (...args: any[]) => void) {
      channel.off(event, listener)
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

export function wrap<T> (channel: NodeLike, messageable: Messageable = channel as unknown as Messageable): Remote<T> {
  return _wrap(createWrapper(channel, messageable))
}

export function expose <T extends any> (obj: T, channel: NodeLike, messageable: Messageable = channel as unknown as Messageable): T {
  return _expose(obj, createWrapper(channel, messageable))
}
