import { beforeAll, describe, expect, it, jest } from "@jest/globals";
import type { Doc, Id } from "../../_generated/dataModel";
import type { QueryCtx } from "../../_generated/server";

jest.unstable_mockModule("../../_generated/server", () => ({
  query: (definition: unknown) => definition,
  mutation: (definition: unknown) => definition,
  internalQuery: (definition: unknown) => definition,
  internalMutation: (definition: unknown) => definition,
}));

let listByActorComplete: typeof import("../../events").listByActorComplete;
let countByActor: typeof import("../../events").countByActor;

beforeAll(async () => {
  ({ listByActorComplete, countByActor } = await import("../../events"));
});

type EventDoc = Doc<"events">;

interface PaginatePage {
  page: EventDoc[];
  continueCursor: string | null;
  isDone: boolean;
}

type PaginateFn = (args: {
  cursor: string | null;
  numItems: number;
}) => PaginatePage;

const ACTOR_ID = "user_actor" as Id<"users">;
const REPO_ID = "repo_alpha" as Id<"repos">;

describe("Event Query Service", () => {
  it("yields no batches when the query returns nothing", async () => {
    const helper = createPaginatedCtx([
      {
        page: [],
        continueCursor: null,
        isDone: true,
      },
    ]);

    const batches = await collectBatches(
      listByActorComplete(helper.ctx, ACTOR_ID),
    );

    expect(batches).toHaveLength(0);
    expect(helper.paginateCalls).toEqual([null]);
  });

  it("returns a single batch when results fit within one page", async () => {
    const page = [makeEvent(10), makeEvent(11)];
    const helper = createPaginatedCtx([
      {
        page,
        continueCursor: null,
        isDone: true,
      },
    ]);

    const batches = await collectBatches(
      listByActorComplete(helper.ctx, ACTOR_ID),
    );

    expect(batches).toEqual([page]);
    expect(helper.paginateCalls).toEqual([null]);
  });

  it("walks every cursor page when more than 100 events exist", async () => {
    const events = Array.from({ length: 500 }, (_, idx) => makeEvent(idx));
    const pages = chunk(events, 100).map((page, index, all) => ({
      page,
      continueCursor: index === all.length - 1 ? null : `cursor-${index}`,
      isDone: index === all.length - 1,
    }));

    const helper = createPaginatedCtx(pages);

    const batches = await collectBatches(
      listByActorComplete(helper.ctx, ACTOR_ID),
    );

    expect(batches).toHaveLength(5);
    expect(batches.flat()).toEqual(events);
    expect(helper.paginateCalls).toEqual([
      null,
      "cursor-0",
      "cursor-1",
      "cursor-2",
      "cursor-3",
    ]);
  });

  it("remains stable when new events are inserted mid-pagination", async () => {
    const original = [makeEvent(1), makeEvent(2), makeEvent(3), makeEvent(4)];
    const inserted = makeEvent(999);

    let callCount = 0;
    const helper = createPaginatedCtx(({ cursor }) => {
      callCount += 1;
      if (cursor === null) {
        return {
          page: original.slice(0, 2),
          continueCursor: "cursor-1",
          isDone: false,
        };
      }

      if (cursor === "cursor-1") {
        // Simulate a new event being written before we fetch the next page.
        return {
          page: [...original.slice(2), inserted],
          continueCursor: null,
          isDone: true,
        };
      }

      throw new Error(`Unexpected cursor: ${cursor}`);
    });

    const resultIds = (
      await collectBatches(listByActorComplete(helper.ctx, ACTOR_ID))
    )
      .flat()
      .map((event) => event._id);

    expect(resultIds).toEqual(
      original.map((event) => event._id).concat(inserted._id),
    );
    expect(new Set(resultIds).size).toBe(resultIds.length);
    expect(helper.paginateCalls).toEqual([null, "cursor-1"]);
    expect(callCount).toBe(2);
  });

  it("reports the same total as countByActor", async () => {
    const events = Array.from({ length: 175 }, (_, idx) =>
      makeEvent(idx + 1000),
    );
    const pages = chunk(events, 100).map((page, index, all) => ({
      page,
      continueCursor: index === all.length - 1 ? null : `cursor-${index}`,
      isDone: index === all.length - 1,
    }));

    const pagination = createPaginatedCtx(pages);
    const batches = await collectBatches(
      listByActorComplete(pagination.ctx, ACTOR_ID, 0, 10),
    );
    const flattened = batches.flat();

    const counter = createCountCtx(flattened);
    const total = await countByActor(counter.ctx, ACTOR_ID, 0, 10);

    expect(total).toBe(flattened.length);
    expect(counter.queryChain.collect).toHaveBeenCalledTimes(1);
    expect(counter.queryChain.filter).toHaveBeenCalledTimes(2);
    expect(pagination.queryChain.filter).toHaveBeenCalledTimes(2);
  });
});

async function collectBatches(
  generator: AsyncGenerator<EventDoc[]>,
): Promise<EventDoc[][]> {
  const batches: EventDoc[][] = [];
  for await (const batch of generator) {
    batches.push(batch);
  }
  return batches;
}

function makeEvent(ts: number, overrides: Partial<EventDoc> = {}): EventDoc {
  return {
    _id: `event_${ts}` as Id<"events">,
    _creationTime: ts,
    type: "push",
    actorId: ACTOR_ID,
    repoId: REPO_ID,
    ts,
    createdAt: ts,
    ...overrides,
  } as EventDoc;
}

function chunk<T>(items: T[], size: number): T[][] {
  const result: T[][] = [];
  for (let i = 0; i < items.length; i += size) {
    result.push(items.slice(i, i + size));
  }
  return result;
}

function createPaginatedCtx(plan: PaginatePage[] | PaginateFn): {
  ctx: QueryCtx;
  paginateCalls: Array<string | null>;
  queryChain: ReturnType<typeof buildQueryChain>;
} {
  const queryChain = buildQueryChain();
  const cursorCalls: Array<string | null> = [];

  const impl: PaginateFn = Array.isArray(plan)
    ? (() => {
        const queue = [...plan];
        return ({ cursor: _cursor, numItems: _numItems }) => {
          if (queue.length === 0) {
            throw new Error("No more pages configured");
          }
          return queue.shift()!;
        };
      })()
    : plan;

  queryChain.paginate.mockImplementation(
    (args: { cursor: string | null; numItems: number }) => {
      const normalizedCursor = args.cursor ?? null;
      cursorCalls.push(normalizedCursor);
      return impl({ cursor: normalizedCursor, numItems: args.numItems });
    },
  );

  const ctx = {
    db: {
      query: jest.fn().mockReturnValue(queryChain),
    },
  } as unknown as QueryCtx;

  return { ctx, paginateCalls: cursorCalls, queryChain };
}

function createCountCtx(results: EventDoc[]): {
  ctx: QueryCtx;
  queryChain: ReturnType<typeof buildQueryChain>;
} {
  const queryChain = buildQueryChain();
  queryChain.collect.mockResolvedValue(results);

  const ctx = {
    db: {
      query: jest.fn().mockReturnValue(queryChain),
    },
  } as unknown as QueryCtx;

  return { ctx, queryChain };
}

function buildQueryChain() {
  const chain: any = {};
  chain.withIndex = jest.fn().mockReturnValue(chain);
  chain.filter = jest.fn().mockReturnValue(chain);
  chain.order = jest.fn().mockReturnValue(chain);
  chain.paginate = jest.fn();
  chain.collect = jest.fn();
  return chain;
}
