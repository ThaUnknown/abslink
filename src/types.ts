import type { EventEmitter } from "node:events"

export interface Endpoint extends EventEmitter<{message: [string]}> {
  postMessage(message: string): void
}

export const enum WireValueType {
  RAW = "RAW",
  PROXY = "PROXY",
  THROW = "THROW",
  HANDLER = "HANDLER",
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
  GET = "GET",
  SET = "SET",
  APPLY = "APPLY",
  CONSTRUCT = "CONSTRUCT",
  RELEASE = "RELEASE",
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
