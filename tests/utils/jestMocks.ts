import { jest } from "@jest/globals";

type AsyncFn<TReturn, TArgs extends any[]> = (...args: TArgs) => Promise<TReturn>;

export type AsyncMock<TReturn = unknown, TArgs extends any[] = any[]> = jest.Mock<
  AsyncFn<TReturn, TArgs>
>;

export const createAsyncMock = <TReturn = unknown, TArgs extends any[] = any[]>(): AsyncMock<
  TReturn,
  TArgs
> => jest.fn<AsyncFn<TReturn, TArgs>>();
