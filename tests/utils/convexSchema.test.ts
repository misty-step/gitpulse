import schema from "../../convex/schema";

describe("Convex Schema", () => {
  it("should have the expected tables", () => {
    // The schema object returned by defineSchema has a 'tables' property
    // which contains the table definitions.
    const tables = Object.keys(schema.tables);

    // Verify Phase 1 new tables
    expect(tables).toContain("userInstallations");
    expect(tables).toContain("trackedRepos");
    expect(tables).toContain("userRepoAccessCache");

    // Verify existing tables
    expect(tables).toContain("users");
    expect(tables).toContain("repos");
    expect(tables).toContain("installations");
  });
});
