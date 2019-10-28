import { EVENT_TYPES, EVENT_TYPES_SEND_WW, IWWEventFromClient, IWWPayloadFromWW } from "./WorkerTypes";

export const dummy = () => {};

declare let window: any;
const _global = typeof global !== 'undefined' ? global : (typeof window !== 'undefined' ? window : {});
const NativeWebSocket = _global.WebSocket || _global.MozWebSocket;



class WebWorkerHandler {
  private worker: Worker;
  private client: typeof NativeWebSocket | null = null;
  private buffer: {[key: string]: { batch: any[]; opTypename: string; dataTypename: string, lastTimeBatched: number }} = {};
  private batchedOperations: string[] = [];

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
  }

  connect({url, wsProtocols, batchedOperations}: any) {
    if(this.client) return console.log('WebWorker WS already connected');
    this.batchedOperations = batchedOperations;
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

    let ops = 0;

    this.client.onmessage = ({ data }: {data: any}) => {
      const parsedData = JSON.parse(data);
      if(parsedData.type === "data" && parsedData.payload) {

        if(parsedData.payload.errors)
          return this.worker.postMessage({type: EVENT_TYPES_SEND_WW.ONMESSAGE, value: parsedData} as IWWPayloadFromWW);

        const id = parsedData.id;
        const opName = Object.keys(parsedData.payload.data)[0];

        if(!this.batchedOperations.includes(opName)) return this.worker.postMessage({type: EVENT_TYPES_SEND_WW.ONMESSAGE, value: parsedData} as IWWPayloadFromWW)

        if(!id) return console.log('no Id found in JSON: ', parsedData);
        if(!this.buffer[id]) {
          this.buffer[id] = {
            batch: [],
            dataTypename: parsedData.payload.data[opName].data.__typename,
            opTypename: parsedData.payload.data[opName].__typename,
            lastTimeBatched: new Date().getTime()
          }
        }

        if(parsedData.payload.data[opName].data)
          this.buffer[id].batch.push(parsedData.payload.data[opName].data.value);

        if(parsedData.payload.data[opName].finished || (this.buffer[id].batch.length > 1000 && ((new Date().getTime() - this.buffer[id].lastTimeBatched) > 500))) {

          //TODO: Rewrite it so that batched object does not depend on received data shape
          const batched = {
             ...parsedData,
             payload: {
               data: {
                 [opName]: {
                   data: {
                     value: this.buffer[id].batch,
                     __typename: this.buffer[id].dataTypename
                   },
                   finished: null,
                   error: null,
                   progress: null,
                   __typename: this.buffer[id].opTypename
                 },
               }
             }
           };
          this.worker.postMessage({type: EVENT_TYPES_SEND_WW.ONMESSAGE, value: batched} as IWWPayloadFromWW)
          if(parsedData.payload.data[opName].finished) {
            this.worker.postMessage({type: EVENT_TYPES_SEND_WW.ONMESSAGE, value: parsedData} as IWWPayloadFromWW)
            delete this.buffer[id];
          }
          else {
            this.buffer[id].lastTimeBatched = new Date().getTime();
            this.buffer[id].batch = [];
          }
        }
      } else {
        this.worker.postMessage({type: EVENT_TYPES_SEND_WW.ONMESSAGE, value: parsedData} as IWWPayloadFromWW)
      }
    }

  }
}

new WebWorkerHandler(self);
