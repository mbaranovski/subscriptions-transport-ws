export declare enum EVENT_TYPES {
    INIT = 0,
    REQUEST = 1,
    CONNECT = 2,
    ONCLOSE_REQUEST = 3
}
export declare enum EVENT_TYPES_SEND_WW {
    ONOPEN = 0,
    ONCLOSE = 1,
    ONERROR = 2,
    ONMESSAGE = 3
}
export interface IWWPayloadFromClient {
    type: EVENT_TYPES;
    value?: any;
}
export interface IWWEventFromClient {
    [key: string]: any;
    data: IWWPayloadFromClient;
}
export interface IWWEventFromWW {
    [key: string]: any;
    data: IWWPayloadFromWW;
}
export interface IWWPayloadFromWW {
    type: EVENT_TYPES_SEND_WW;
    value?: any;
}
