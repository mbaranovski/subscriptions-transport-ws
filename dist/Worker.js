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
        this.batchedOperations = [];
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
        var url = _a.url, wsProtocols = _a.wsProtocols, batchedOperations = _a.batchedOperations;
        if (this.client)
            return console.log('WebWorker WS already connected');
        this.batchedOperations = batchedOperations;
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
        var ops = 0;
        this.client.onmessage = function (_a) {
            var data = _a.data;
            var _b;
            var parsedData = JSON.parse(data);
            if (parsedData.type === "data" && parsedData.payload) {
                if (parsedData.payload.errors)
                    return _this.worker.postMessage({ type: WorkerTypes_1.EVENT_TYPES_SEND_WW.ONMESSAGE, value: parsedData });
                var id = parsedData.id;
                var opName = Object.keys(parsedData.payload.data)[0];
                if (!_this.batchedOperations.includes(opName))
                    return _this.worker.postMessage({ type: WorkerTypes_1.EVENT_TYPES_SEND_WW.ONMESSAGE, value: parsedData });
                if (!id)
                    return console.log('no Id found in JSON: ', parsedData);
                if (!_this.buffer[id]) {
                    _this.buffer[id] = {
                        batch: [],
                        dataTypename: parsedData.payload.data[opName].data.__typename,
                        opTypename: parsedData.payload.data[opName].__typename,
                        lastTimeBatched: new Date().getTime()
                    };
                }
                if (parsedData.payload.data[opName].data)
                    _this.buffer[id].batch.push(parsedData.payload.data[opName].data.value);
                if (parsedData.payload.data[opName].finished || (_this.buffer[id].batch.length > 1000 && ((new Date().getTime() - _this.buffer[id].lastTimeBatched) > 500))) {
                    var batched = __assign({}, parsedData, { payload: {
                            data: (_b = {},
                                _b[opName] = {
                                    data: {
                                        value: _this.buffer[id].batch,
                                        __typename: _this.buffer[id].dataTypename
                                    },
                                    finished: null,
                                    error: null,
                                    progress: null,
                                    __typename: _this.buffer[id].opTypename
                                },
                                _b)
                        } });
                    _this.worker.postMessage({ type: WorkerTypes_1.EVENT_TYPES_SEND_WW.ONMESSAGE, value: batched });
                    if (parsedData.payload.data[opName].finished) {
                        _this.worker.postMessage({ type: WorkerTypes_1.EVENT_TYPES_SEND_WW.ONMESSAGE, value: parsedData });
                        delete _this.buffer[id];
                    }
                    else {
                        _this.buffer[id].lastTimeBatched = new Date().getTime();
                        _this.buffer[id].batch = [];
                    }
                }
            }
            else {
                _this.worker.postMessage({ type: WorkerTypes_1.EVENT_TYPES_SEND_WW.ONMESSAGE, value: parsedData });
            }
        };
    };
    return WebWorkerHandler;
}());
new WebWorkerHandler(self);
//# sourceMappingURL=Worker.js.map