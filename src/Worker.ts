import { EVENT_TYPES, EVENT_TYPES_SEND_WW, IWWEventFromClient, IWWPayloadFromWW } from "./WorkerTypes";

export const dummy = () => {};

declare let window: any;
const _global = typeof global !== 'undefined' ? global : (typeof window !== 'undefined' ? window : {});
const NativeWebSocket = _global.WebSocket || _global.MozWebSocket;



class WebWorkerHandler {
  private worker: Worker;
  private client: typeof NativeWebSocket | null = null;
  private buffer: {[key: string]: any[]} = {};
  private idValueRegexp = /\s*\"id\" *: *(\"([0-9]?)\"(|\s|)|\s*\{(.*?)\}(,|\s|))/;

  constructor(ctx: any) {
    this.worker = ctx;
    this.registerListeners();
  }

  getIdValueFromJSON(json: string) {
    const match = json.match(this.idValueRegexp);
    if(!match) return null;
    return match[0].replace(/"/g, '').split(":")[1];
  }

  registerListeners() {
    this.worker.onmessage = (event: IWWEventFromClient) => {
      switch (event.data.type) {
        case EVENT_TYPES.CONNECT: {
          this.connect(event.data.value);
          break;
        }
        case EVENT_TYPES.REQUEST: {
         // console.log("MICHAL: Request to the WW: ", event.data.value);
          this.client.send(event.data.value);
          break;
        }
        case EVENT_TYPES.ONCLOSE_REQUEST: {
          this.client.close();
          this.client = null;
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
    if(this.client) return console.log('WebWorker WS already connected')
    this.client = new NativeWebSocket(url, wsProtocols);

    this.client.onopen = () => {
    //  this.connected = true;
      this.worker.postMessage({type: EVENT_TYPES_SEND_WW.ONOPEN} as IWWPayloadFromWW)
    }

    this.client.onclose = () => {
      this.worker.postMessage({type: EVENT_TYPES_SEND_WW.ONCLOSE} as IWWPayloadFromWW)
    }

    this.client.onerror = (err: Error) => {
      //Stringifying the error because we cannot serialize whole error instance.
      this.worker.postMessage({type: EVENT_TYPES_SEND_WW.ONERROR, value: JSON.stringify(err)} as IWWPayloadFromWW)
    }


    this.client.onmessage = ({ data }: {data: any}) => {
      //console.log("MICHAL: data", data);
      if(data.includes('"type":"data"')) {
        const id = this.getIdValueFromJSON(data);
        if(!id) return console.log('no Id found in JSON: ', data);
        if(!this.buffer[id]) {
          this.buffer[id] = []
        }

        this.buffer[id].push(data);
        //console.log("MICHAL: this.buffer", this.buffer);

        if(data.includes("QueryFinished") || data.includes("FINISHED")) {
          console.log("MICHAL: 'FINISHED'", 'FINISHED');
          this.worker.postMessage({type: EVENT_TYPES_SEND_WW.ONMESSAGE, value: this.buffer[id]} as IWWPayloadFromWW)
        //  console.log("MICHAL: this.buffer[id] FINISHED", this.buffer[id]);
          delete this.buffer[id];
        }
      } else {
        console.log("MICHAL: 'different type'", 'different type', data);
        this.worker.postMessage({type: EVENT_TYPES_SEND_WW.ONMESSAGE, value: data} as IWWPayloadFromWW)
      }
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
