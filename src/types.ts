import { finalizer } from './abslink'

export interface W3CEvent {
  type: string
}

export interface W3CMessageEvent<T = any> extends W3CEvent {
  data: T
}

interface Terminateable {
  terminate?(): void;
  [finalizer]?: () => void | null | undefined
}

export interface Messageable extends Terminateable {
  postMessage(message: any): void;
}

export interface W3CLike<T = any> extends Terminateable {
  addEventListener(type: string, listener: (event: W3CMessageEvent<T>) => void): void;
  removeEventListener(type: string, listener?: (event: W3CMessageEvent<T>) => void): void;
  postMessage?: (message: any) => void;
}

export interface NodeLike<T = any> extends Terminateable {
  on(type: string, listener: (data: T) => void): void;
  off(type: string, listener?: (data: T) => void): void;
  postMessage?: (message: any) => void;
}

export interface ElectronLike<T = any> extends Terminateable {
  on(type: string, listener: (e: any, data: T) => void): void;
  off(type: string, listener?: (e: any, data: T) => void): void;
  postMessage?: (message: any) => void;
}

export interface Endpoint extends NodeLike {}

export const enum WireValueType {
  RAW = 'RAW',
  PROXY = 'PROXY',
  THROW = 'THROW',
  HANDLER = 'HANDLER',
}

export interface RawWireValue {
  id?: string
  type: WireValueType.RAW
  value: {}
}

export interface HandlerWireValue {
  id?: string
  type: WireValueType.HANDLER
  name: string
  value: unknown
}

export type WireValue = RawWireValue | HandlerWireValue

export type MessageID = string

export const enum MessageType {
  GET = 'GET',
  SET = 'SET',
  APPLY = 'APPLY',
  CONSTRUCT = 'CONSTRUCT',
  RELEASE = 'RELEASE',
}

export interface GetMessage {
  id?: MessageID
  type: MessageType.GET
  path: string[]
}

export interface SetMessage {
  id?: MessageID
  type: MessageType.SET
  path: string[]
  value: WireValue
}

export interface ApplyMessage {
  id?: MessageID
  type: MessageType.APPLY
  path: string[]
  argumentList: WireValue[]
}

export interface ConstructMessage {
  id?: MessageID
  type: MessageType.CONSTRUCT
  path: string[]
  argumentList: WireValue[]
}

export interface ReleaseMessage {
  id?: MessageID
  type: MessageType.RELEASE
}

export type Message =
  | GetMessage
  | SetMessage
  | ApplyMessage
  | ConstructMessage
  | ReleaseMessage
