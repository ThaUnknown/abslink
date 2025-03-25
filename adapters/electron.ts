import { wrap as _wrap, expose as _expose, type Endpoint, finalizer, Remote } from '../src/abslink'
import { ElectronLike, Messageable, W3CEvent } from '../src/types'
import { ipcMain, ipcRenderer } from 'electron'

function createWrapper (channel: ElectronLike, messageable: Messageable): Endpoint {
  const listeners = new WeakMap<(...args: any[]) => void, (...args: any[]) => void>()

  return {
    on (event: string, listener: (data: any) => void) {
      const unwrapped = (event: W3CEvent, data: any) => listener(data)
      channel.on(event, unwrapped)
      listeners.set(listener, unwrapped)
    },
    off (event: string, listener: (...args: any[]) => void) {
      const unwrapped = listeners.get(listener)
      channel.off(event, unwrapped)
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

export function wrap<T> (channel: ElectronLike, messageable: Messageable = channel as unknown as Messageable): Remote<T> {
  return _wrap(createWrapper(channel, messageable))
}

export function expose <T extends any> (obj: T, channel: ElectronLike = ipcMain ?? ipcRenderer, messageable: Messageable = channel as unknown as Messageable): T {
  return _expose(obj, createWrapper(channel, messageable))
}
