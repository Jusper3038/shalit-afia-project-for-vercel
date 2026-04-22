import { describe, expect, it } from "vitest";
import {
  buildSalesCsvRows,
  getClinicDayKey,
  getClinicWeekStartKey,
  matchesSalesPeriod,
} from "@/lib/reporting";

describe("reporting helpers", () => {
  it("uses the clinic timezone when building the daily key", () => {
    expect(getClinicDayKey("2026-04-14T21:30:00.000Z")).toBe("2026-04-15");
  });

  it("returns the Monday week start for the clinic timezone", () => {
    expect(getClinicWeekStartKey("2026-04-19T10:00:00.000Z")).toBe("2026-04-13");
  });

  it("matches transactions against stored monthly and yearly period fields", () => {
    const transaction = {
      created_at: "2026-04-15T09:00:00.000Z",
      date: "2026-04-15T09:00:00.000Z",
      quantity: 2,
      sale_day: "2026-04-15",
      sale_month: 4,
      sale_week_start: "2026-04-13",
      sale_year: 2026,
      total_cost: 800,
    };
    const now = new Date("2026-04-15T12:00:00.000Z");

    expect(matchesSalesPeriod(transaction, "daily", now, 4, 2026)).toBe(true);
    expect(matchesSalesPeriod(transaction, "monthly", now, 4, 2026)).toBe(true);
    expect(matchesSalesPeriod(transaction, "monthly", now, 3, 2026)).toBe(false);
    expect(matchesSalesPeriod(transaction, "yearly", now, 4, 2026)).toBe(true);
    expect(matchesSalesPeriod(transaction, "yearly", now, 4, 2025)).toBe(false);
  });

  it("matches transactions inside a custom date range", () => {
    const transaction = {
      created_at: "2026-04-15T09:00:00.000Z",
      date: "2026-04-15T09:00:00.000Z",
      quantity: 2,
      sale_day: "2026-04-15",
      sale_month: 4,
      sale_week_start: "2026-04-13",
      sale_year: 2026,
      total_cost: 800,
    };
    const now = new Date("2026-04-15T12:00:00.000Z");

    expect(matchesSalesPeriod(transaction, "custom", now, 4, 2026, "2026-04-10", "2026-04-20")).toBe(true);
    expect(matchesSalesPeriod(transaction, "custom", now, 4, 2026, "2026-04-16", "2026-04-20")).toBe(false);
  });

  it("returns false for custom range filtering when dates are missing", () => {
    const transaction = {
      created_at: "2026-04-15T09:00:00.000Z",
      date: "2026-04-15T09:00:00.000Z",
      quantity: 2,
      sale_day: "2026-04-15",
      sale_month: 4,
      sale_week_start: "2026-04-13",
      sale_year: 2026,
      total_cost: 800,
    };

    expect(matchesSalesPeriod(transaction, "custom", new Date("2026-04-15T12:00:00.000Z"), 4, 2026)).toBe(false);
  });

  it("builds CSV rows with exact period, month, year, and pricing columns", () => {
    const rows = buildSalesCsvRows(
      [
        {
          created_at: "2026-04-15T09:00:00.000Z",
          date: "2026-04-15T09:00:00.000Z",
          drug_id: "drug-1",
          patient_id: "patient-1",
          quantity: 2,
          sale_day: "2026-04-15",
          sale_month: 4,
          sale_week_start: "2026-04-13",
          sale_year: 2026,
          total_cost: 800,
          unit_selling_price: 400,
        },
      ],
      {
        getDrugById: () => ({ name: "Amoxicillin", serial_number: "B-22" }),
        getPatientById: () => ({ name: "Jane Doe" }),
        periodLabel: "April 2026",
      },
    );

    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      Period: "April 2026",
      Month: "April",
      Year: 2026,
      Patient: "Jane Doe",
      Item: "Amoxicillin",
      Batch: "B-22",
      Quantity: 2,
      "Unit Selling Price": 400,
      "Total Cost": 800,
    });
  });
});
