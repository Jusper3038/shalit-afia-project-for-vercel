export const CLINIC_TIME_ZONE = "Africa/Nairobi";

export type SalesPeriod = "daily" | "weekly" | "monthly" | "yearly" | "custom";

type TimeZoneDateInput = Date | string;

type TimeZoneParts = {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
};

type TransactionPeriodFields = {
  created_at?: string | null;
  date?: string | null;
  drug_id?: string | null;
  patient_id?: string | null;
  quantity: number;
  sale_day?: string | null;
  sale_month?: number | null;
  sale_week_start?: string | null;
  sale_year?: number | null;
  total_cost: number;
  unit_selling_price?: number | null;
};

type CsvLookup = {
  getDrugById: (drugId: string | null) => { name?: string | null; serial_number?: string | null } | undefined;
  getPatientById: (patientId: string | null) => { name?: string | null } | undefined;
  periodLabel: string;
};

const getFormatter = (
  options: Intl.DateTimeFormatOptions,
  timeZone: string = CLINIC_TIME_ZONE,
) => new Intl.DateTimeFormat("en-GB", { timeZone, ...options });

const pad = (value: number) => String(value).padStart(2, "0");

export const getTimeZoneParts = (
  value: TimeZoneDateInput,
  timeZone: string = CLINIC_TIME_ZONE,
): TimeZoneParts => {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  }).formatToParts(new Date(value));

  const getNumber = (type: string) => Number(parts.find((part) => part.type === type)?.value ?? "0");

  return {
    year: getNumber("year"),
    month: getNumber("month"),
    day: getNumber("day"),
    hour: getNumber("hour"),
    minute: getNumber("minute"),
    second: getNumber("second"),
  };
};

export const getClinicDayKey = (
  value: TimeZoneDateInput,
  timeZone: string = CLINIC_TIME_ZONE,
) => {
  const parts = getTimeZoneParts(value, timeZone);
  return `${parts.year}-${pad(parts.month)}-${pad(parts.day)}`;
};

export const getClinicWeekStartKey = (
  value: TimeZoneDateInput,
  timeZone: string = CLINIC_TIME_ZONE,
) => {
  const parts = getTimeZoneParts(value, timeZone);
  const utcDate = new Date(Date.UTC(parts.year, parts.month - 1, parts.day));
  const dayOfWeek = utcDate.getUTCDay() === 0 ? 7 : utcDate.getUTCDay();
  utcDate.setUTCDate(utcDate.getUTCDate() - (dayOfWeek - 1));

  return `${utcDate.getUTCFullYear()}-${pad(utcDate.getUTCMonth() + 1)}-${pad(utcDate.getUTCDate())}`;
};

export const getClinicMonth = (
  value: TimeZoneDateInput,
  timeZone: string = CLINIC_TIME_ZONE,
) => getTimeZoneParts(value, timeZone).month;

export const getClinicYear = (
  value: TimeZoneDateInput,
  timeZone: string = CLINIC_TIME_ZONE,
) => getTimeZoneParts(value, timeZone).year;

export const formatClinicDate = (
  value: TimeZoneDateInput,
  timeZone: string = CLINIC_TIME_ZONE,
) => getFormatter({ year: "numeric", month: "long", day: "numeric" }, timeZone).format(new Date(value));

export const formatClinicTime = (
  value: TimeZoneDateInput,
  timeZone: string = CLINIC_TIME_ZONE,
) => getFormatter({ hour: "2-digit", minute: "2-digit", second: "2-digit", hourCycle: "h23" }, timeZone).format(new Date(value));

export const formatClinicDateTime = (
  value: TimeZoneDateInput,
  timeZone: string = CLINIC_TIME_ZONE,
) => `${formatClinicDate(value, timeZone)} ${formatClinicTime(value, timeZone)}`;

export const getMonthLabel = (month: number, year?: number) => {
  const monthDate = new Date(Date.UTC(year ?? 2026, month - 1, 1));
  return getFormatter({ month: "long", year: year ? "numeric" : undefined }, "UTC").format(monthDate);
};

export const getTransactionSaleDay = (transaction: TransactionPeriodFields) =>
  transaction.sale_day ?? getClinicDayKey(transaction.date ?? transaction.created_at ?? new Date().toISOString());

export const getTransactionSaleWeekStart = (transaction: TransactionPeriodFields) =>
  transaction.sale_week_start ?? getClinicWeekStartKey(transaction.date ?? transaction.created_at ?? new Date().toISOString());

export const getTransactionSaleMonth = (transaction: TransactionPeriodFields) =>
  transaction.sale_month ?? getClinicMonth(transaction.date ?? transaction.created_at ?? new Date().toISOString());

export const getTransactionSaleYear = (transaction: TransactionPeriodFields) =>
  transaction.sale_year ?? getClinicYear(transaction.date ?? transaction.created_at ?? new Date().toISOString());

export const matchesSalesPeriod = (
  transaction: TransactionPeriodFields,
  salesPeriod: SalesPeriod,
  now: Date,
  selectedMonth: number,
  selectedYear: number,
  customStartDay?: string,
  customEndDay?: string,
) => {
  const saleDay = getTransactionSaleDay(transaction);

  if (salesPeriod === "daily") {
    return saleDay === getClinicDayKey(now);
  }

  if (salesPeriod === "weekly") {
    return getTransactionSaleWeekStart(transaction) === getClinicWeekStartKey(now);
  }

  if (salesPeriod === "monthly") {
    return getTransactionSaleMonth(transaction) === selectedMonth && getTransactionSaleYear(transaction) === selectedYear;
  }

  if (salesPeriod === "custom") {
    if (!customStartDay || !customEndDay) return false;
    return saleDay >= customStartDay && saleDay <= customEndDay;
  }

  return getTransactionSaleYear(transaction) === selectedYear;
};

export const formatDayKeyLabel = (dayKey: string) => {
  const [year, month, day] = dayKey.split("-").map(Number);
  return formatClinicDate(new Date(Date.UTC(year, month - 1, day)));
};

export const enumerateDayKeys = (startDay: string, endDay: string) => {
  const [startYear, startMonth, startDate] = startDay.split("-").map(Number);
  const [endYear, endMonth, endDate] = endDay.split("-").map(Number);
  const cursor = new Date(Date.UTC(startYear, startMonth - 1, startDate));
  const end = new Date(Date.UTC(endYear, endMonth - 1, endDate));
  const keys: string[] = [];

  while (cursor <= end) {
    keys.push(`${cursor.getUTCFullYear()}-${pad(cursor.getUTCMonth() + 1)}-${pad(cursor.getUTCDate())}`);
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }

  return keys;
};

export const getCustomRangeLabel = (startDay: string, endDay: string) =>
  `${formatDayKeyLabel(startDay)} to ${formatDayKeyLabel(endDay)}`;

export const buildSalesCsvRows = (
  transactions: TransactionPeriodFields[],
  { getDrugById, getPatientById, periodLabel }: CsvLookup,
) =>
  transactions.map((transaction) => {
    const transactionDate = transaction.date ?? transaction.created_at ?? new Date().toISOString();
    const drug = getDrugById(transaction.drug_id ?? null);
    const patient = getPatientById(transaction.patient_id ?? null);
    const month = getTransactionSaleMonth(transaction);
    const year = getTransactionSaleYear(transaction);

    return {
      Period: periodLabel,
      Month: getMonthLabel(month),
      Year: year,
      Date: formatClinicDate(transactionDate),
      Time: formatClinicTime(transactionDate),
      Patient: patient?.name || "Walk-in Customer",
      Item: drug?.name || "Item",
      Batch: drug?.serial_number || "-",
      Quantity: transaction.quantity,
      "Unit Selling Price": Number(transaction.unit_selling_price ?? 0),
      "Total Cost": Number(transaction.total_cost),
    };
  });
