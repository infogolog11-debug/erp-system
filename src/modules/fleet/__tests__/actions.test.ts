import { describe, it, expect, vi, beforeEach } from "vitest";

const mockInsertReturning = vi.fn();
const mockVehicleFindFirst = vi.fn();
const mockTripFindFirst = vi.fn();
const mockSelectWhere = vi.fn();
const mockUpdateWhere = vi.fn().mockResolvedValue(undefined);
const mockInsertValues = vi.fn(() => ({ returning: mockInsertReturning }));

vi.mock("@/db", () => ({
  db: {
    insert: vi.fn(() => ({ values: mockInsertValues })),
    select: vi.fn(() => ({ from: vi.fn(() => ({ where: (...a: any[]) => mockSelectWhere(...a) })) })),
    query: {
      vehicles: { findFirst: (...a: any[]) => mockVehicleFindFirst(...a) },
      vehicleTrips: { findFirst: (...a: any[]) => mockTripFindFirst(...a) },
    },
    update: vi.fn(() => ({ set: vi.fn(() => ({ where: (...a: any[]) => mockUpdateWhere(...a) })) })),
  },
}));

// driverId/vehicleId/grantId المُرسَلة من العميل تُتحقَّق الآن عبر assertOwnedByOrg
// الموحّدة (src/lib/auth/ownership.ts، عُمِّمت لهذا الموديول v38) بدل findFirst
// مخصص لكل حقل. الدالة نفسها لها اختباراتها المستقلة بـownership.test.ts؛
// هنا نكتفي بمحاكاتها كـtrue/false حسب سيناريو كل اختبار.
const mockAssertOwnedByOrg = vi.fn();
vi.mock("@/lib/auth/ownership", () => ({
  assertOwnedByOrg: (...args: any[]) => mockAssertOwnedByOrg(...args),
}));

vi.mock("@/core/audit/audit-trail", () => ({ createAuditLog: vi.fn().mockResolvedValue(undefined) }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

let mockSessionOk = true;
vi.mock("@/lib/auth/guard", () => ({
  requirePermission: vi.fn(() => Promise.resolve(
    mockSessionOk
      ? { ok: true, userId: "user-1", organizationId: "11111111-1111-1111-1111-111111111111", role: "procurement" }
      : { ok: false, error: "ليست لديك الصلاحية الكافية لتنفيذ هذا الإجراء" }
  )),
  assertOrgMatches: (claimed: string, session: any) => claimed === session.organizationId,
}));

import { createTrip, completeTrip, createVehicle, assignDriver, createFuelLog, createMaintenanceRecord } from "../actions";

const ORG = "11111111-1111-1111-1111-111111111111";

beforeEach(() => {
  vi.clearAllMocks();
  mockSessionOk = true;
  mockInsertReturning.mockResolvedValue([{ id: "trip-1" }]);
  mockSelectWhere.mockResolvedValue([{ cnt: 0 }]);
  mockAssertOwnedByOrg.mockResolvedValue(true);
});

describe("createVehicle", () => {
  it("rejects when the caller lacks permission", async () => {
    mockSessionOk = false;
    const res = await createVehicle({ organizationId: ORG, plateNumber:"ABC-123", vehicleType:"pickup", currentOdometer:0 }, "user-1");
    expect(res.success).toBe(false);
  });

  it("creates successfully with valid input", async () => {
    const res = await createVehicle({ organizationId: ORG, plateNumber:"ABC-123", vehicleType:"pickup", currentOdometer:0 }, "user-1");
    expect(res.success).toBe(true);
  });
});

describe("createTrip", () => {
  const baseInput = {
    organizationId: ORG, vehicleId: "44444444-4444-4444-4444-444444444444", driverId: "55555555-5555-5555-5555-555555555555",
    purpose: "Delivery", origin: "Warehouse A", destination: "Site B",
    departureDate: "2026-01-01T08:00:00Z", startOdometer: 1000,
  };

  it("blocks a trip when the vehicle is not active", async () => {
    mockVehicleFindFirst.mockResolvedValue({ id:"veh-1", organizationId:ORG, vehicleStatus:"maintenance", currentOdometer:900 });
    const res = await createTrip(baseInput, "user-1");
    expect(res.success).toBe(false);
    if (!res.success) expect(res.error).toContain("غير متاحة");
  });

  it("blocks a trip when the starting odometer is behind the vehicle's current reading", async () => {
    mockVehicleFindFirst.mockResolvedValue({ id:"veh-1", organizationId:ORG, vehicleStatus:"active", currentOdometer:5000 });
    const res = await createTrip(baseInput, "user-1"); // startOdometer 1000 < 5000
    expect(res.success).toBe(false);
  });

  it("refuses a trip for a vehicle belonging to a different organization", async () => {
    mockVehicleFindFirst.mockResolvedValue({ id:"veh-1", organizationId:"other-org", vehicleStatus:"active", currentOdometer:900 });
    const res = await createTrip(baseInput, "user-1");
    expect(res.success).toBe(false);
  });

  it("creates a trip successfully when the vehicle is active and odometer is valid", async () => {
    mockVehicleFindFirst.mockResolvedValue({ id:"veh-1", organizationId:ORG, vehicleStatus:"active", currentOdometer:900 });
    const res = await createTrip(baseInput, "user-1");
    expect(res.success).toBe(true);
    if (res.success) expect(res.data.waybillNumber).toMatch(/^WB-\d{4}-00001$/);
  });

  // إصلاح IDOR v34: driverId وgrantId يجب أن يخصا نفس المنظمة
  it("refuses a driverId belonging to a different organization (IDOR)", async () => {
    mockVehicleFindFirst.mockResolvedValue({ id:"veh-1", organizationId:ORG, vehicleStatus:"active", currentOdometer:900 });
    mockAssertOwnedByOrg.mockResolvedValueOnce(false); // driver check
    const res = await createTrip(baseInput, "user-1");
    expect(res.success).toBe(false);
  });

  it("refuses a grantId belonging to a different organization (IDOR)", async () => {
    mockVehicleFindFirst.mockResolvedValue({ id:"veh-1", organizationId:ORG, vehicleStatus:"active", currentOdometer:900 });
    mockAssertOwnedByOrg.mockResolvedValueOnce(true).mockResolvedValueOnce(false); // driver: ok, grant: IDOR
    const res = await createTrip({ ...baseInput, grantId: "66666666-6666-6666-6666-666666666666" }, "user-1");
    expect(res.success).toBe(false);
  });
});

describe("assignDriver", () => {
  it("refuses a driverId belonging to a different organization (IDOR)", async () => {
    mockAssertOwnedByOrg.mockResolvedValueOnce(false);
    const res = await assignDriver("veh-1", "driver-1", ORG, "user-1");
    expect(res.success).toBe(false);
    expect(mockUpdateWhere).not.toHaveBeenCalled();
  });

  it("assigns successfully when the driver belongs to the same organization", async () => {
    const res = await assignDriver("veh-1", "driver-1", ORG, "user-1");
    expect(res.success).toBe(true);
  });
});

describe("createFuelLog", () => {
  const baseInput = {
    organizationId: ORG, vehicleId: "44444444-4444-4444-4444-444444444444", liters: 40, cost: 100, odometerAtFueling: 1000,
  };

  // إصلاح IDOR v34: كانت الدالة تُدرج سجل وقود بدون أي تحقق من ملكية vehicleId
  it("refuses a vehicleId belonging to a different organization (IDOR)", async () => {
    mockAssertOwnedByOrg.mockResolvedValueOnce(false);
    const res = await createFuelLog(baseInput, "user-1");
    expect(res.success).toBe(false);
    expect(mockInsertValues).not.toHaveBeenCalled();
  });

  it("creates successfully when the vehicle belongs to the same organization", async () => {
    mockInsertReturning.mockResolvedValue([{ id:"log-1" }]);
    const res = await createFuelLog(baseInput, "user-1");
    expect(res.success).toBe(true);
  });
});

describe("createMaintenanceRecord", () => {
  const baseInput = {
    organizationId: ORG, vehicleId: "44444444-4444-4444-4444-444444444444", maintenanceType: "routine_service" as const, cost: 50,
    setVehicleUnderMaintenance: false,
  };

  // إصلاح IDOR v34: نفس ثغرة createFuelLog
  it("refuses a vehicleId belonging to a different organization (IDOR)", async () => {
    mockAssertOwnedByOrg.mockResolvedValueOnce(false);
    const res = await createMaintenanceRecord(baseInput, "user-1");
    expect(res.success).toBe(false);
    expect(mockInsertValues).not.toHaveBeenCalled();
  });

  it("creates successfully when the vehicle belongs to the same organization", async () => {
    mockInsertReturning.mockResolvedValue([{ id:"maint-1" }]);
    const res = await createMaintenanceRecord(baseInput, "user-1");
    expect(res.success).toBe(true);
  });
});

describe("completeTrip", () => {
  it("rejects an end odometer reading behind the trip's start reading", async () => {
    mockTripFindFirst.mockResolvedValue({ id:"trip-1", organizationId:ORG, startOdometer:5000 });
    const res = await completeTrip("trip-1", "veh-1", ORG, 4000, "user-1");
    expect(res.success).toBe(false);
  });

  it("completes successfully with a valid end odometer reading", async () => {
    mockTripFindFirst.mockResolvedValue({ id:"trip-1", organizationId:ORG, startOdometer:5000 });
    const res = await completeTrip("trip-1", "veh-1", ORG, 5200, "user-1");
    expect(res.success).toBe(true);
    expect(mockUpdateWhere).toHaveBeenCalled();
  });

  it("refuses to complete a trip belonging to a different organization", async () => {
    mockTripFindFirst.mockResolvedValue({ id:"trip-1", organizationId:"other-org", startOdometer:5000 });
    const res = await completeTrip("trip-1", "veh-1", ORG, 5200, "user-1");
    expect(res.success).toBe(false);
  });
});
