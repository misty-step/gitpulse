import { jest } from "@jest/globals";
import { TextDecoder, TextEncoder } from "util";

if (typeof global.TextEncoder === "undefined") {
  global.TextEncoder = TextEncoder;
}

if (typeof global.TextDecoder === "undefined") {
  global.TextDecoder = TextDecoder;
}

if (typeof global.fetch === "undefined") {
  (global as any).fetch = jest.fn();
}

beforeEach(() => {
  jest.spyOn(console, "warn").mockImplementation(() => {});
  jest.spyOn(console, "error").mockImplementation(() => {});

  if (typeof global.fetch === "function") {
    const mockFetch = global.fetch as jest.Mock;
    if (typeof mockFetch.mockReset === "function") {
      mockFetch.mockReset();
    }
  }
});

afterEach(() => {
  jest.restoreAllMocks();
});
