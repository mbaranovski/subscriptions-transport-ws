import { EVENT_TYPES, EVENT_TYPES_SEND_WW, IWWEventFromClient, IWWPayloadFromWW } from "./WorkerTypes";

export const dummy = () => {};

declare let window: any;
const _global = typeof global !== 'undefined' ? global : (typeof window !== 'undefined' ? window : {});
const NativeWebSocket = _global.WebSocket || _global.MozWebSocket;


const GRAPHQL_ENDPOINT = "ws://localhost:4000/graphql";

class WebWorkerHandler {
  private worker: Worker;
  private client: typeof NativeWebSocket | null = null;
  private connected = false;

  constructor(ctx: any) {
    this.worker = ctx;
    this.registerListeners();
  }

  registerListeners() {
    this.worker.onmessage = (event: IWWEventFromClient) => {
      switch (event.data.type) {
        case EVENT_TYPES.CONNECT: {
          this.connect(event.data.value);
          break;
        }
        case EVENT_TYPES.REQUEST: {
          this.request(event.data.value);
          break;
        }
        default: {
          console.error('Send unhandled EVENT_TYPE to the Worker')
        }
      }
    }

    //const d = new NativeWebSocket()
  }

  connect({url, wsProtocols}: any) {
    if(this.connected) return console.log('WebWorker WS already connected')
    this.client = new NativeWebSocket(url, wsProtocols);

    this.client.onopen = () => {
      this.connected = true;
      this.worker.postMessage({type: EVENT_TYPES_SEND_WW.ONOPEN} as IWWPayloadFromWW)
    }

  }

  request(operation: any) {
    if(!this.client) return;

//    this.worker.postMessage("elo elo from worker");
    // const dupa = new Observable(observer => {
    //   this.promiseWorker.postMessage(operation)
    //     .then(data => {
    //       observer.next(data);
    //       observer.complete();
    //     })
    //     .catch(observer.error.bind(observer));
    // });

  }
}

new WebWorkerHandler(self);
