import { resume } from "./ingestionJobs";

describe("ingestionJobs.resume", () => {
  it("clears blocked state and marks job as running", async () => {
    const jobId = "job_1" as any;
    const job = {
      _id: jobId,
      status: "blocked",
      blockedUntil: Date.now() + 60_000,
      startedAt: undefined,
      createdAt: 123,
      reposRemaining: ["old/repo"],
    };

    const get = jest.fn().mockResolvedValue(job);
    const patch = jest.fn();
    const ctx = { db: { get, patch } } as any;

    await (resume as any).handler(ctx, {
      jobId,
      reposRemaining: ["next/repo"],
    });

    expect(patch).toHaveBeenCalledTimes(1);
    expect(patch).toHaveBeenCalledWith(
      jobId,
      expect.objectContaining({
        status: "running",
        blockedUntil: undefined,
        reposRemaining: ["next/repo"],
        startedAt: job.createdAt,
      }),
    );

    const updatedFields = patch.mock.calls[0][1];
    expect(typeof updatedFields.lastUpdatedAt).toBe("number");
  });

  it("no-ops when job is missing", async () => {
    const ctx = {
      db: {
        get: jest.fn().mockResolvedValue(null),
        patch: jest.fn(),
      },
    } as any;

    await (resume as any).handler(ctx, {
      jobId: "missing" as any,
      reposRemaining: [],
    });
    expect(ctx.db.patch).not.toHaveBeenCalled();
  });
});
