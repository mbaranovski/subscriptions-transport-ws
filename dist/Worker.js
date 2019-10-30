"use strict";
var __assign = (this && this.__assign) || Object.assign || function(t) {
    for (var s, i = 1, n = arguments.length; i < n; i++) {
        s = arguments[i];
        for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p))
            t[p] = s[p];
    }
    return t;
};
Object.defineProperty(exports, "__esModule", { value: true });
var WorkerTypes_1 = require("./WorkerTypes");
exports.dummy = function () { };
var _global = typeof global !== 'undefined' ? global : (typeof window !== 'undefined' ? window : {});
var NativeWebSocket = _global.WebSocket || _global.MozWebSocket;
var WebWorkerHandler = (function () {
    function WebWorkerHandler(ctx) {
        this.client = null;
        this.buffer = {};
        this.batchedQuerySubscriptions = [];
        this.worker = ctx;
        this.registerListeners();
    }
    WebWorkerHandler.prototype.registerListeners = function () {
        var _this = this;
        this.worker.onmessage = function (event) {
            switch (event.data.type) {
                case WorkerTypes_1.EVENT_TYPES.CONNECT: {
                    _this.connect(event.data.value);
                    break;
                }
                case WorkerTypes_1.EVENT_TYPES.REQUEST: {
                    _this.client.send(event.data.value);
                    break;
                }
                case WorkerTypes_1.EVENT_TYPES.ONCLOSE_REQUEST: {
                    _this.client.close();
                    _this.client = null;
                    break;
                }
                default: {
                    console.error('Send unhandled EVENT_TYPE to the Worker');
                }
            }
        };
    };
    WebWorkerHandler.prototype.connect = function (_a) {
        var _this = this;
        var url = _a.url, wsProtocols = _a.wsProtocols, batchedQuerySubscriptions = _a.batchedQuerySubscriptions;
        if (this.client)
            return console.log('WebWorker WS already connected');
        this.batchedQuerySubscriptions = batchedQuerySubscriptions;
        this.client = new NativeWebSocket(url, wsProtocols);
        this.client.onopen = function () {
            _this.worker.postMessage({ type: WorkerTypes_1.EVENT_TYPES_SEND_WW.ONOPEN });
        };
        this.client.onclose = function () {
            _this.worker.postMessage({ type: WorkerTypes_1.EVENT_TYPES_SEND_WW.ONCLOSE });
        };
        this.client.onerror = function (err) {
            _this.worker.postMessage({ type: WorkerTypes_1.EVENT_TYPES_SEND_WW.ONERROR, value: JSON.stringify(err) });
        };
        this.client.onmessage = function (_a) {
            var data = _a.data;
            var parsedData = JSON.parse(data);
            if (parsedData.type === "data" && parsedData.payload) {
                if (parsedData.payload.errors)
                    return _this.worker.postMessage({ type: WorkerTypes_1.EVENT_TYPES_SEND_WW.ONMESSAGE, value: parsedData });
                var opName = Object.keys(parsedData.payload.data)[0];
                var id = parsedData.id;
                if (!id)
                    return console.log('no Id found in JSON: ', parsedData);
                if (_this.batchedQuerySubscriptions.includes(opName))
                    return _this.handleBatchedQueries(parsedData, opName, id);
                else
                    return _this.worker.postMessage({ type: WorkerTypes_1.EVENT_TYPES_SEND_WW.ONMESSAGE, value: parsedData });
            }
            else {
                _this.worker.postMessage({ type: WorkerTypes_1.EVENT_TYPES_SEND_WW.ONMESSAGE, value: parsedData });
            }
        };
    };
    WebWorkerHandler.prototype.handleBatchedQueries = function (parsedData, opName, id) {
        var _a;
        var operation = parsedData.payload.data[opName];
        var finishedMsg = operation.finished;
        var dataMsg = operation.data;
        var isEventType = !finishedMsg && !dataMsg;
        if (finishedMsg && !this.buffer[id])
            return this.worker.postMessage({ type: WorkerTypes_1.EVENT_TYPES_SEND_WW.ONMESSAGE, value: parsedData });
        if (!this.buffer[id]) {
            this.buffer[id] = {
                batch: [],
                lastTimeBatched: new Date().getTime()
            };
        }
        if (!finishedMsg)
            this.buffer[id].batch.push(operation);
        if (finishedMsg ||
            (this.buffer[id].batch.length > 500 && ((new Date().getTime() - this.buffer[id].lastTimeBatched) > 500)) ||
            (isEventType && ((new Date().getTime() - this.buffer[id].lastTimeBatched) > 500)) ||
            (isEventType && this.buffer[id].batch.length <= 3 && ((new Date().getTime() - this.buffer[id].lastTimeBatched) > 100))) {
            var batched = __assign({}, parsedData, { payload: {
                    data: (_a = {},
                        _a[opName] = this.buffer[id].batch,
                        _a)
                } });
            this.worker.postMessage({ type: WorkerTypes_1.EVENT_TYPES_SEND_WW.ONMESSAGE, value: batched });
            if (finishedMsg) {
                this.worker.postMessage({ type: WorkerTypes_1.EVENT_TYPES_SEND_WW.ONMESSAGE, value: parsedData });
                delete this.buffer[id];
            }
            else {
                this.buffer[id].lastTimeBatched = new Date().getTime();
                this.buffer[id].batch = [];
            }
        }
    };
    return WebWorkerHandler;
}());
new WebWorkerHandler(self);
//# sourceMappingURL=Worker.js.map