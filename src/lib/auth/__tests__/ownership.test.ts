import { describe, it, expect, vi, beforeEach } from "vitest";

const mockSelectWhere = vi.fn();

vi.mock("@/db", () => ({
  db: {
    select: vi.fn(() => ({
      from: vi.fn(() => ({
        where: (...a: any[]) => mockSelectWhere(...a),
      })),
    })),
  },
}));

// جدول وهمي بسيط — يكفي أن يملك عمودي id وorganizationId مثل أي جدول حقيقي
// بالمشروع (كلها تحصل عليهما عبر baseColumns). لا حاجة لجدول pg حقيقي هنا،
// فقط لتمرير مرجع كائن يمكن لـ eq() استدعاء .id/.organizationId عليه.
const fakeTable = { id: "id-column", organizationId: "org-column" } as any;

import { assertOwnedByOrg, assertAllOwnedByOrg } from "../ownership";

beforeEach(() => {
  vi.clearAllMocks();
});

describe("assertOwnedByOrg", () => {
  it("returns true when the record belongs to the given organization", async () => {
    mockSelectWhere.mockResolvedValue([{ organizationId: "org-1" }]);
    const ok = await assertOwnedByOrg(fakeTable, "record-1", "org-1");
    expect(ok).toBe(true);
  });

  it("returns false when the record belongs to a different organization", async () => {
    mockSelectWhere.mockResolvedValue([{ organizationId: "org-2" }]);
    const ok = await assertOwnedByOrg(fakeTable, "record-1", "org-1");
    expect(ok).toBe(false);
  });

  it("returns false when the record does not exist at all", async () => {
    mockSelectWhere.mockResolvedValue([]);
    const ok = await assertOwnedByOrg(fakeTable, "record-1", "org-1");
    expect(ok).toBe(false);
  });

  it("returns false without querying the database when id is missing", async () => {
    const ok = await assertOwnedByOrg(fakeTable, undefined, "org-1");
    expect(ok).toBe(false);
    expect(mockSelectWhere).not.toHaveBeenCalled();
  });

  it("returns false without querying the database when organizationId is missing", async () => {
    const ok = await assertOwnedByOrg(fakeTable, "record-1", undefined);
    expect(ok).toBe(false);
    expect(mockSelectWhere).not.toHaveBeenCalled();
  });
});

describe("assertAllOwnedByOrg", () => {
  it("returns true only when every referenced record belongs to the organization", async () => {
    mockSelectWhere.mockResolvedValue([{ organizationId: "org-1" }]);
    const ok = await assertAllOwnedByOrg(
      [{ table: fakeTable, id: "record-1" }, { table: fakeTable, id: "record-2" }],
      "org-1",
    );
    expect(ok).toBe(true);
  });

  it("returns false when at least one referenced record belongs to a different organization", async () => {
    mockSelectWhere
      .mockResolvedValueOnce([{ organizationId: "org-1" }])
      .mockResolvedValueOnce([{ organizationId: "org-2" }]);
    const ok = await assertAllOwnedByOrg(
      [{ table: fakeTable, id: "record-1" }, { table: fakeTable, id: "record-2" }],
      "org-1",
    );
    expect(ok).toBe(false);
  });

  it("returns false immediately when organizationId itself is missing", async () => {
    const ok = await assertAllOwnedByOrg([{ table: fakeTable, id: "record-1" }], undefined);
    expect(ok).toBe(false);
    expect(mockSelectWhere).not.toHaveBeenCalled();
  });
});
