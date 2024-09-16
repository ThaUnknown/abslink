import {
  Endpoint,
  Message,
  MessageType,
  WireValue,
  WireValueType,
} from "./types"
export type { Endpoint }

export const proxyMarker = Symbol("Abslink.proxy")
export const releaseProxy = Symbol("Abslink.releaseProxy")
export const finalizer = Symbol("Abslink.finalizer")

const throwMarker = Symbol("Abslink.thrown")

/**
 * Interface of values that were marked to be proxied with `abslink.proxy()`.
 * Can also be implemented by classes.
 */
export interface ProxyMarked {
  [proxyMarker]: true
}

/**
 * Takes a type and wraps it in a Promise, if it not already is one.
 * This is to avoid `Promise<Promise<T>>`.
 *
 * This is the inverse of `Unpromisify<T>`.
 */
type Promisify<T> = T extends Promise<unknown> ? T : Promise<T>
/**
 * Takes a type that may be Promise and unwraps the Promise type.
 * If `P` is not a Promise, it returns `P`.
 *
 * This is the inverse of `Promisify<T>`.
 */
type Unpromisify<P> = P extends Promise<infer T> ? T : P

/**
 * Takes the raw type of a remote property and returns the type that is visible to the local thread on the proxy.
 *
 * Note: This needs to be its own type alias, otherwise it will not distribute over unions.
 * See https://www.typescriptlang.org/docs/handbook/advanced-types.html#distributive-conditional-types
 */
type RemoteProperty<T> =
  // If the value is a method, abslink will proxy it automatically.
  // Objects are only proxied if they are marked to be proxied.
  // Otherwise, the property is converted to a Promise that resolves the cloned value.
  T extends Function | ProxyMarked ? Remote<T> : Promisify<T>

/**
 * Takes the raw type of a property as a remote thread would see it through a proxy (e.g. when passed in as a function
 * argument) and returns the type that the local thread has to supply.
 *
 * This is the inverse of `RemoteProperty<T>`.
 *
 * Note: This needs to be its own type alias, otherwise it will not distribute over unions. See
 * https://www.typescriptlang.org/docs/handbook/advanced-types.html#distributive-conditional-types
 */
type LocalProperty<T> = T extends Function | ProxyMarked
  ? Local<T>
  : Unpromisify<T>

/**
 * Proxies `T` if it is a `ProxyMarked`, clones it otherwise (as handled by structured cloning and transfer handlers).
 */
export type ProxyOrClone<T> = T extends ProxyMarked ? Remote<T> : T
/**
 * Inverse of `ProxyOrClone<T>`.
 */
export type UnproxyOrClone<T> = T extends RemoteObject<ProxyMarked>
  ? Local<T>
  : T

/**
 * Takes the raw type of a remote object in the other thread and returns the type as it is visible to the local thread
 * when proxied with `Abslink.proxy()`.
 *
 * This does not handle call signatures, which is handled by the more general `Remote<T>` type.
 *
 * @template T The raw type of a remote object as seen in the other thread.
 */
export type RemoteObject<T> = { [P in keyof T]: RemoteProperty<T[P]> }
/**
 * Takes the type of an object as a remote thread would see it through a proxy (e.g. when passed in as a function
 * argument) and returns the type that the local thread has to supply.
 *
 * This does not handle call signatures, which is handled by the more general `Local<T>` type.
 *
 * This is the inverse of `RemoteObject<T>`.
 *
 * @template T The type of a proxied object.
 */
export type LocalObject<T> = { [P in keyof T]: LocalProperty<T[P]> }

/**
 * Additional special abslink methods available on each proxy returned by `Abslink.wrap()`.
 */
export interface ProxyMethods {
  [releaseProxy]: () => Promise<void>
}

/**
 * Takes the raw type of a remote object, function or class in the other thread and returns the type as it is visible to
 * the local thread from the proxy return value of `Abslink.wrap()` or `Abslink.proxy()`.
 */
export type Remote<T> =
  // Handle properties
  RemoteObject<T> &
  // Handle call signature (if present)
  (T extends (...args: infer TArguments) => infer TReturn
    ? (
      ...args: { [I in keyof TArguments]: UnproxyOrClone<TArguments[I]> }
    ) => Promisify<ProxyOrClone<Unpromisify<TReturn>>>
    : unknown) &
  // Handle construct signature (if present)
  // The return of construct signatures is always proxied (whether marked or not)
  (T extends { new(...args: infer TArguments): infer TInstance }
    ? {
      new(
        ...args: {
          [I in keyof TArguments]: UnproxyOrClone<TArguments[I]>
        }
      ): Promisify<Remote<TInstance>>
    }
    : unknown) &
  // Include additional special abslink methods available on the proxy.
  ProxyMethods

/**
 * Expresses that a type can be either a sync or async.
 */
type MaybePromise<T> = Promise<T> | T

/**
 * Takes the raw type of a remote object, function or class as a remote thread would see it through a proxy (e.g. when
 * passed in as a function argument) and returns the type the local thread has to supply.
 *
 * This is the inverse of `Remote<T>`. It takes a `Remote<T>` and returns its original input `T`.
 */
export type Local<T> =
  // Omit the special proxy methods (they don"t need to be supplied, abslink adds them)
  Omit<LocalObject<T>, keyof ProxyMethods> &
  // Handle call signatures (if present)
  (T extends (...args: infer TArguments) => infer TReturn
    ? (
      ...args: { [I in keyof TArguments]: ProxyOrClone<TArguments[I]> }
    ) => // The raw function could either be sync or async, but is always proxied automatically
      MaybePromise<UnproxyOrClone<Unpromisify<TReturn>>>
    : unknown) &
  // Handle construct signature (if present)
  // The return of construct signatures is always proxied (whether marked or not)
  (T extends { new(...args: infer TArguments): infer TInstance }
    ? {
      new(
        ...args: {
          [I in keyof TArguments]: ProxyOrClone<TArguments[I]>
        }
      ): // The raw constructor could either be sync or async, but is always proxied automatically
        MaybePromise<Local<Unpromisify<TInstance>>>
    }
    : unknown)

const isObject = (val: unknown): val is object =>
  (typeof val === "object" && val !== null) || typeof val === "function"

/**
 * Customizes the serialization of certain values as determined by `canHandle()`.
 *
 * @template T The input type being handled by this transfer handler.
 * @template S The serialized type sent over the wire.
 */
export interface TransferHandler<T, S = void> {
  /**
   * Gets called for every value to determine whether this transfer handler
   * should serialize the value, which includes checking that it is of the right
   * type (but can perform checks beyond that as well).
   */
  canHandle (value: unknown): value is T

  /**
   * Gets called with the value if `canHandle()` returned `true` to produce a
   * value that can be sent in a message, consisting of structured-cloneable
   * values and/or transferrable objects.
   */
  serialize (value: T, ep: Endpoint): S

  /**
   * Gets called to deserialize an incoming value that was serialized in the
   * other thread with this transfer handler (known through the name it was
   * registered under).
   */
  deserialize (value: S, ep: Endpoint): T
}

/**
 * Internal transfer handle to handle objects marked to proxy.
 */
const proxyTransferHandler: TransferHandler<object> = {
  canHandle: (val): val is ProxyMarked =>
    isObject(val) && (val as ProxyMarked)[proxyMarker],
  serialize (obj, ep) {
    expose(obj, ep)
  },
  deserialize (port, ep) {
    return wrap(ep)
  },
}

interface ThrownValue {
  [throwMarker]: unknown // just needs to be present
  value: unknown
}
type SerializedThrownValue =
  | { isError: true; value: Error }
  | { isError: false; value: unknown }
type PendingListenersMap = Map<
  string,
  (value: WireValue | PromiseLike<WireValue>) => void
>

/**
 * Internal transfer handler to handle thrown exceptions.
 */
const throwTransferHandler: TransferHandler<
  ThrownValue,
  SerializedThrownValue
> = {
  canHandle: (value): value is ThrownValue =>
    isObject(value) && throwMarker in value,
  serialize ({ value }) {
    let serialized: SerializedThrownValue
    if (value instanceof Error) {
      serialized = {
        isError: true,
        value: {
          message: value.message,
          name: value.name,
          stack: value.stack,
        },
      }
    } else {
      serialized = { isError: false, value }
    }
    return serialized
  },
  deserialize (serialized) {
    if (serialized.isError) {
      throw Object.assign(
        new Error(serialized.value.message),
        serialized.value
      )
    }
    throw serialized.value
  },
}

/**
 * Allows customizing the serialization of certain values.
 */
export const transferHandlers = new Map<
  string,
  TransferHandler<unknown, unknown>
>([
  ["proxy", proxyTransferHandler],
  ["throw", throwTransferHandler],
])

export function expose (
  obj: any,
  ep: Endpoint
) {
  ep.on("message", function callback (ev: string) {
    if (!ev) {
      return
    }
    const data = JSON.parse(ev)

    const { id, type, path } = {
      path: [] as string[],
      ...(data as Message),
    }
    const argumentList = (data.argumentList || []).map((v: WireValue) => fromWireValue(v, ep))
    let returnValue
    try {
      const parent = path.slice(0, -1).reduce((obj, prop) => obj[prop], obj)
      const rawValue = path.reduce((obj, prop) => obj[prop], obj)
      switch (type) {
        case MessageType.GET:
          {
            returnValue = rawValue
          }
          break
        case MessageType.SET:
          {
            parent[path.slice(-1)[0]] = fromWireValue(data.value, ep)
            returnValue = true
          }
          break
        case MessageType.APPLY:
          {
            returnValue = rawValue.apply(parent, argumentList)
          }
          break
        case MessageType.CONSTRUCT:
          {
            const value = new rawValue(...argumentList)
            returnValue = proxy(value)
          }
          break
        case MessageType.RELEASE:
          {
            returnValue = undefined
          }
          break
        default:
          return
      }
    } catch (value) {
      returnValue = { value, [throwMarker]: 0 }
    }
    Promise.resolve(returnValue)
      .catch((value) => {
        return { value, [throwMarker]: 0 }
      })
      .then((returnValue) => {
        const wireValue = toWireValue(returnValue, ep)
        ep.postMessage(JSON.stringify({ ...wireValue, id }))
        if (type === MessageType.RELEASE) {
          // detach and deactive after sending release response above.
          ep.off("message", callback)
          releaseEndpoint(ep)
        }
      })
      .catch((error) => {
        // Send Serialization Error To Caller
        const wireValue = toWireValue({
          value: new TypeError("Unserializable return value"),
          [throwMarker]: 0,
        }, ep)
        ep.postMessage(JSON.stringify({ ...wireValue, id }))
      })
  } as any)
}

export function wrap<T> (ep: Endpoint, target?: any): Remote<T> {
  const pendingListeners: PendingListenersMap = new Map()

  ep.on("message", (ev) => {
    const data = JSON.parse(ev)
    if (!data || !data.id) {
      return
    }
    const resolver = pendingListeners.get(data.id)
    if (!resolver) {
      return
    }

    try {
      resolver(data)
    } finally {
      pendingListeners.delete(data.id)
    }
  })

  return createProxy<T>(ep, pendingListeners, [], target) as any
}

function throwIfProxyReleased (isReleased: boolean) {
  if (isReleased) {
    throw new Error("Proxy has been released and is not useable")
  }
}

function releaseEndpoint (ep: Endpoint) {
  return requestResponseMessage(ep, new Map(), {
    type: MessageType.RELEASE,
  }).then(() => {
    if (finalizer in ep && typeof ep[finalizer] === "function") {
      ep[finalizer]()
    }
  })
}

interface FinalizationRegistry<T> {
  new(cb: (heldValue: T) => void): FinalizationRegistry<T>
  register (
    weakItem: object,
    heldValue: T,
    unregisterToken?: object | undefined
  ): void
  unregister (unregisterToken: object): void
}
declare var FinalizationRegistry: FinalizationRegistry<Endpoint>

const proxyCounter = new WeakMap<Endpoint, number>()
const proxyFinalizers =
  "FinalizationRegistry" in globalThis &&
  new FinalizationRegistry((ep: Endpoint) => {
    const newCount = (proxyCounter.get(ep) || 0) - 1
    proxyCounter.set(ep, newCount)
    if (newCount === 0) {
      releaseEndpoint(ep)
    }
  })

function registerProxy (proxy: object, ep: Endpoint) {
  const newCount = (proxyCounter.get(ep) || 0) + 1
  proxyCounter.set(ep, newCount)
  if (proxyFinalizers) {
    proxyFinalizers.register(proxy, ep, proxy)
  }
}

function unregisterProxy (proxy: object) {
  if (proxyFinalizers) {
    proxyFinalizers.unregister(proxy)
  }
}

function createProxy<T> (
  ep: Endpoint,
  pendingListeners: PendingListenersMap,
  path: (string | number | symbol)[] = [],
  target: object = function () { }
): Remote<T> {
  let isProxyReleased = false
  const proxy = new Proxy(target, {
    get (_target, prop) {
      throwIfProxyReleased(isProxyReleased)
      if (prop === releaseProxy) {
        return async () => {
          unregisterProxy(proxy)
          await releaseEndpoint(ep)
          pendingListeners.clear()
          isProxyReleased = true
        }
      }
      if (prop === "then") {
        if (path.length === 0) {
          return { then: () => proxy }
        }
        const r = requestResponseMessage(ep, pendingListeners, {
          type: MessageType.GET,
          path: path.map((p) => p.toString()),
        }).then(v => fromWireValue(v, ep))
        return r.then.bind(r)
      }
      return createProxy(ep, pendingListeners, [...path, prop])
    },
    set (_target, prop, rawValue) {
      throwIfProxyReleased(isProxyReleased)
      // FIXME: ES6 Proxy Handler `set` methods are supposed to return a
      // boolean. To show good will, we return true asynchronously ¯\_(ツ)_/¯
      const value = toWireValue(rawValue, ep)
      return requestResponseMessage(
        ep,
        pendingListeners,
        {
          type: MessageType.SET,
          path: [...path, prop].map((p) => p.toString()),
          value,
        }
      ).then(v => fromWireValue(v, ep)) as any
    },
    apply (_target, _thisArg, rawArgumentList) {
      throwIfProxyReleased(isProxyReleased)
      const last = path[path.length - 1]
      // We just pretend that `bind()` didn’t happen.
      if (last === "bind") {
        return createProxy(ep, pendingListeners, path.slice(0, -1))
      }
      const argumentList = processArguments(rawArgumentList, ep)
      return requestResponseMessage(
        ep,
        pendingListeners,
        {
          type: MessageType.APPLY,
          path: path.map((p) => p.toString()),
          argumentList,
        }
      ).then(v => fromWireValue(v, ep))
    },
    construct (_target, rawArgumentList) {
      throwIfProxyReleased(isProxyReleased)
      const argumentList = processArguments(rawArgumentList, ep)
      return requestResponseMessage(
        ep,
        pendingListeners,
        {
          type: MessageType.CONSTRUCT,
          path: path.map((p) => p.toString()),
          argumentList,
        }
      ).then(v => fromWireValue(v, ep))
    },
  })
  registerProxy(proxy, ep)
  return proxy as any
}


function processArguments (argumentList: any[], ep: Endpoint): WireValue[] {
  return argumentList.map(v => toWireValue(v, ep))
}

export function proxy<T extends {}> (obj: T): T & ProxyMarked {
  return Object.assign(obj, { [proxyMarker]: true }) as any
}

function toWireValue (value: any, ep: Endpoint): WireValue {
  for (const [name, handler] of transferHandlers) {
    if (handler.canHandle(value)) {
      const serializedValue = handler.serialize(value, ep)
      return {
        type: WireValueType.HANDLER,
        name,
        value: serializedValue,
      }
    }
  }
  return {
    type: WireValueType.RAW,
    value,
  }
}

function fromWireValue (value: WireValue, ep: Endpoint): any {
  switch (value.type) {
    case WireValueType.HANDLER:
      return transferHandlers.get(value.name)!.deserialize(value.value, ep)
    case WireValueType.RAW:
      return value.value
  }
}

function requestResponseMessage (
  ep: Endpoint,
  pendingListeners: PendingListenersMap,
  msg: Message
): Promise<WireValue> {
  return new Promise((resolve) => {
    const id = Math.trunc(Math.random() * Number.MAX_SAFE_INTEGER).toString()
    pendingListeners.set(id, resolve)
    ep.postMessage(JSON.stringify({ id, ...msg }))
  })
}
