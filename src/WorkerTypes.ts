export enum EVENT_TYPES {
  INIT,
  REQUEST,
  CONNECT,
  ONCLOSE_REQUEST,
}

export enum EVENT_TYPES_SEND_WW {
  ONOPEN,
  ONCLOSE,
  ONERROR,
  ONMESSAGE,

}

export interface IWWPayloadFromClient {
  type: EVENT_TYPES
  value?: any;
}

export interface IWWEventFromClient {
  [key: string]: any;
  data: IWWPayloadFromClient
}
export interface IWWEventFromWW {
  [key: string]: any;
  data: IWWPayloadFromWW
}

export interface IWWPayloadFromWW {
  type: EVENT_TYPES_SEND_WW,
  value?: any
}
