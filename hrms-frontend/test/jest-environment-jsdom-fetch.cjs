/**
 * jsdom does not expose Node's fetch/TextEncoder. Capture fetch from the Node
 * realm and inject it. Keep jsdom's FormData/Blob/File — Node's FormData does
 * not accept HTMLFormElement (`new FormData(form)`), which breaks dialogs.
 */
const { TextDecoder, TextEncoder } = require("node:util");
const {
  ReadableStream,
  TransformStream,
  WritableStream,
} = require("node:stream/web");
const { TestEnvironment } = require("jest-environment-jsdom");

const nodeFetch = globalThis.fetch;
const nodeHeaders = globalThis.Headers;
const nodeRequest = globalThis.Request;
const nodeResponse = globalThis.Response;
const nodeBlob = globalThis.Blob;
const nodeFile = globalThis.File;
const nodeStructuredClone = globalThis.structuredClone;

class JsdomFetchEnvironment extends TestEnvironment {
  async setup() {
    await super.setup();
    this.global.TextEncoder = TextEncoder;
    this.global.TextDecoder = TextDecoder;
    this.global.ReadableStream = ReadableStream;
    this.global.TransformStream = TransformStream;
    this.global.WritableStream = WritableStream;
    this.global.fetch = nodeFetch;
    this.global.Headers = nodeHeaders;
    this.global.Request = nodeRequest;
    this.global.Response = nodeResponse;
    // Node Blob has `.text()` / `.arrayBuffer()`; keep jsdom FormData for forms.
    this.global.Blob = nodeBlob;
    this.global.File = nodeFile;
    if (!this.global.structuredClone && nodeStructuredClone) {
      this.global.structuredClone = nodeStructuredClone;
    }
    if (typeof this.global.URL.createObjectURL !== "function") {
      this.global.URL.createObjectURL = () => "blob:jest-mock-object-url";
      this.global.URL.revokeObjectURL = () => undefined;
    }
  }
}

module.exports = JsdomFetchEnvironment;
