import { EVENT_TYPES, EVENT_TYPES_SEND_WW, IWWEventFromClient, IWWPayloadFromWW } from "./WorkerTypes";

export const dummy = () => {};

declare let window: any;
const _global = typeof global !== 'undefined' ? global : (typeof window !== 'undefined' ? window : {});
const NativeWebSocket = _global.WebSocket || _global.MozWebSocket;



class WebWorkerHandler {
  private worker: Worker;
  private client: typeof NativeWebSocket | null = null;
  private buffer: {[key: string]: { batch: any[]; lastTimeBatched: number }} = {};
  private batchedQuerySubscriptions: string[] = [];

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

  connect({url, wsProtocols, batchedQuerySubscriptions}: any) {
    if(this.client) return console.log('WebWorker WS already connected');
    this.batchedQuerySubscriptions = batchedQuerySubscriptions;
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
      const parsedData = JSON.parse(data);
      if(parsedData.type === "data" && parsedData.payload) {

        //Handling GQL Errors from the BE
        if(parsedData.payload.errors)
          return this.worker.postMessage({type: EVENT_TYPES_SEND_WW.ONMESSAGE, value: parsedData} as IWWPayloadFromWW);

        const opName = Object.keys(parsedData.payload.data)[0];
        const id = parsedData.id;
        if(!id) return console.log('no Id found in JSON: ', parsedData);

        if(this.batchedQuerySubscriptions.includes(opName)) return this.handleBatchedQueries(parsedData, opName , id)

        //Handling non data of non batched operations (default behaviour)
        else return this.worker.postMessage({type: EVENT_TYPES_SEND_WW.ONMESSAGE, value: parsedData} as IWWPayloadFromWW)

      } else {
        //Handling different data types like. connection init, stop etc.
        this.worker.postMessage({type: EVENT_TYPES_SEND_WW.ONMESSAGE, value: parsedData} as IWWPayloadFromWW)
      }
    }

  }

  handleBatchedQueries(parsedData: any, opName: string, id: string) {
    const operation = parsedData.payload.data[opName];
    const finishedMsg = operation.finished;
    const dataMsg = operation.data;
    const isEventType = !finishedMsg && !dataMsg;

    //If we queried something and received only finished event and no data before then handle this.
    if(finishedMsg && !this.buffer[id])
      return this.worker.postMessage({type: EVENT_TYPES_SEND_WW.ONMESSAGE, value: parsedData} as IWWPayloadFromWW)

    if(!this.buffer[id]) {
      this.buffer[id] = {
        batch: [],
        lastTimeBatched: new Date().getTime()
      }
    }

    //Adding data to the batch buffer
    if(!finishedMsg)
      this.buffer[id].batch.push(operation);

    //Sending the batched data once finished event come or when we meet other below conditions
    if(
        finishedMsg ||
        (this.buffer[id].batch.length > 500 && ((new Date().getTime() - this.buffer[id].lastTimeBatched) > 500)) ||
        (isEventType && ((new Date().getTime() - this.buffer[id].lastTimeBatched) > 500)) ||
        (isEventType && this.buffer[id].batch.length <= 3 && ((new Date().getTime() - this.buffer[id].lastTimeBatched) > 100))
    ) {
      const batched = {
        ...parsedData,
        payload: {
          data: {
            [opName]: this.buffer[id].batch,
          }
        }
      };
      this.worker.postMessage({type: EVENT_TYPES_SEND_WW.ONMESSAGE, value: batched} as IWWPayloadFromWW)
      if(finishedMsg) {
        this.worker.postMessage({type: EVENT_TYPES_SEND_WW.ONMESSAGE, value: parsedData} as IWWPayloadFromWW)
        delete this.buffer[id];
      } else {
        this.buffer[id].lastTimeBatched = new Date().getTime();
        this.buffer[id].batch = [];
      }
    }
  }
}

new WebWorkerHandler(self);
