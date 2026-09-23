import { addYears, parseISO, differenceInCalendarYears, format } from "date-fns";

/**
 * Computes the next IPO (Inspeção Periódica Obrigatória) date based on
 * Portuguese rules:
 * - 1st inspection at 4 years of age
 * - Then every 2 years until age 8 (years 4, 6, 8)
 * - Annually from age 8 onwards (year 9, 10, 11, ...)
 *
 * @param {number} vehicleYear - The registration year of the vehicle
 * @param {string|null} lastInspectionDate - ISO date string of last inspection
 * @returns {Date|null} The next inspection date
 */
export function getNextInspectionDate(vehicleYear, lastInspectionDate = null, registrationDate = null) {
  if (!vehicleYear && !registrationDate) return null;

  const regDate = registrationDate
    ? (typeof registrationDate === "string" ? parseISO(registrationDate) : registrationDate)
    : new Date(vehicleYear, 0, 1);
  const today = new Date();

  if (lastInspectionDate) {
    const lastDate = typeof lastInspectionDate === "string"
      ? parseISO(lastInspectionDate)
      : lastInspectionDate;
    // IPO dates are always anchored to the registration anniversary (day/month).
    // Find the first milestone more than 90 days after the last inspection
    // (IPO can be done up to 3 months before the due date, per Portuguese law).
    const NINETY_DAYS_MS = 1000 * 60 * 60 * 24 * 90;
    let age = 4;
    while (age <= 100) {
      const milestone = addYears(regDate, age);
      if (milestone - lastDate > NINETY_DAYS_MS) return milestone;
      age = age < 8 ? age + 2 : age + 1;
    }
    return null;
  }

  const vehicleAge = differenceInCalendarYears(today, regDate);

  if (vehicleAge < 4) return addYears(regDate, 4);

  let age = 4;
  let nextDate = addYears(regDate, 4);

  while (nextDate <= today) {
    age = age < 8 ? age + 2 : age + 1;
    nextDate = addYears(regDate, age);
  }

  return nextDate;
}

export function formatInspectionDate(date) {
  if (!date) return null;
  return format(date, "yyyy-MM-dd");
}