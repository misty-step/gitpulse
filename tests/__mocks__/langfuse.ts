// Mock for langfuse to avoid dynamic import issues in Jest
export class Langfuse {
  trace = jest.fn(() => ({
    span: jest.fn(() => ({
      generation: jest.fn(() => ({
        end: jest.fn(),
      })),
      end: jest.fn(),
    })),
    update: jest.fn(),
  }));
  flushAsync = jest.fn().mockResolvedValue(undefined);
  shutdownAsync = jest.fn().mockResolvedValue(undefined);
}

export const getLangfuse = jest.fn(() => new Langfuse());
export const flushLangfuse = jest.fn().mockResolvedValue(undefined);
export const isLangfuseConfigured = jest.fn(() => false);
export const calculateCost = jest.fn(() => 0);
