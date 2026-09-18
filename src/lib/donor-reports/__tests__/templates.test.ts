import { describe, it, expect } from "vitest";
import { computeSF425, computeEchoSingleForm, computeUnhcrIPR, selectTemplate } from "../templates";

const grant = {
  code:"G-2026-001", name:"Test Grant", nameAr:"منحة تجريبية",
  totalAmount:100000, currencyCode:"USD", startDate:"2026-01-01", endDate:"2026-12-31",
};

const lines = [
  { code:"BL-001", name:"Staff", nameAr:"الموارد البشرية", budgetCategory:"staff", plannedAmount:40000, committedAmount:5000, spentAmount:20000 },
  { code:"BL-002", name:"Supplies", nameAr:"المستلزمات", budgetCategory:"supplies", plannedAmount:60000, committedAmount:10000, spentAmount:30000 },
];

describe("computeSF425", () => {
  it("computes federal expenditures and unliquidated obligations correctly", () => {
    const r = computeSF425(grant, lines);
    expect(r.line10.e_federalShareExpenditures).toBe(50000);
    expect(r.line10.f_federalShareUnliquidatedObligations).toBe(15000);
    expect(r.line10.g_totalFederalShare).toBe(65000);
  });

  it("computes unobligated balance as authorized minus total federal share", () => {
    const r = computeSF425(grant, lines);
    expect(r.line10.h_unobligatedBalance).toBe(grant.totalAmount - 65000);
  });

  it("returns zero recipient share and program income by default", () => {
    const r = computeSF425(grant, lines);
    expect(r.line10.i_totalRecipientShare).toBe(0);
    expect(r.line10.j_programIncome).toBe(0);
  });
});

describe("computeEchoSingleForm", () => {
  it("computes actual cost as spent plus committed per line", () => {
    const r = computeEchoSingleForm(grant, lines);
    expect(r.rows[0].actualCostToDate).toBe(25000);
    expect(r.rows[1].actualCostToDate).toBe(40000);
  });

  it("computes implementation percentage correctly", () => {
    const r = computeEchoSingleForm(grant, lines);
    expect(r.rows[0].implementationPct).toBeCloseTo(62.5, 5);
  });

  it("sums totals across all lines", () => {
    const r = computeEchoSingleForm(grant, lines);
    expect(r.totals.budgetApproved).toBe(100000);
    expect(r.totals.actualCostToDate).toBe(65000);
  });

  it("handles a zero-planned line without dividing by zero", () => {
    const zeroLine = [{ code:"BL-003", name:"Zero", nameAr:null, budgetCategory:"other", plannedAmount:0, committedAmount:0, spentAmount:0 }];
    const r = computeEchoSingleForm(grant, zeroLine);
    expect(r.rows[0].implementationPct).toBe(0);
  });
});

describe("computeUnhcrIPR", () => {
  it("computes achievement percentage against targets", () => {
    const r = computeUnhcrIPR(grant, lines, {
      beneficiariesReached: 450, beneficiariesTargeted: 500, distributionsCount: 10, totalDistributionValue: 20000,
    });
    expect(r.achievement.achievementPct).toBe(90);
  });

  it("returns 0% achievement when target is zero", () => {
    const r = computeUnhcrIPR(grant, lines, {
      beneficiariesReached: 10, beneficiariesTargeted: 0, distributionsCount: 1, totalDistributionValue: 100,
    });
    expect(r.achievement.achievementPct).toBe(0);
  });

  it("computes financial utilization percentage per budget line", () => {
    const r = computeUnhcrIPR(grant, lines, { beneficiariesReached:0, beneficiariesTargeted:0, distributionsCount:0, totalDistributionValue:0 });
    expect(r.financial[0].utilizationPct).toBe(50); // 20000/40000
  });
});

describe("selectTemplate", () => {
  it("maps known reporting standards to template keys", () => {
    expect(selectTemplate("usaid_sf425")).toBe("usaid_sf425");
    expect(selectTemplate("echo_single_form")).toBe("echo_single_form");
    expect(selectTemplate("unhcr_ipr")).toBe("unhcr_ipr");
  });

  it("falls back to generic for unknown standards", () => {
    expect(selectTemplate("something_else")).toBe("generic");
  });
});
