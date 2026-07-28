/**
 * Gregorian → Hebrew date conversion.
 *
 * Implemented directly rather than pulled from a library: the arithmetic is
 * small, it avoids a dependency, and it keeps the whole tool offline-capable.
 * Follows the standard fixed-calendar algorithm (Dershowitz & Reingold),
 * which is exact for every date in the current calendar era.
 */

import { toHebrewNumeral } from './numerals';

// R.D. of 1 Tishrei AM 1 — i.e. fixed-from-julian(3761 BCE, October 7).
const HEBREW_EPOCH = -1373427;

const MONTH_NAMES = [
  null,
  'Nisan', 'Iyar', 'Sivan', 'Tammuz', 'Av', 'Elul',
  'Tishrei', 'Cheshvan', 'Kislev', 'Tevet', 'Shevat', 'Adar', 'Adar II',
];

const MONTH_NAMES_HE = [
  null,
  'ניסן', 'אייר', 'סיון', 'תמוז', 'אב', 'אלול',
  'תשרי', 'חשון', 'כסלו', 'טבת', 'שבט', 'אדר', 'אדר ב׳',
];

const mod = (a, b) => ((a % b) + b) % b;
const quotient = (a, b) => Math.floor(a / b);

/** Gregorian date → Rata Die (fixed day number). */
function gregorianToFixed(year, month, day) {
  const y = year - 1;
  return (
    365 * y
    + quotient(y, 4)
    - quotient(y, 100)
    + quotient(y, 400)
    + quotient(367 * month - 362, 12)
    + (month <= 2 ? 0 : isGregorianLeap(year) ? -1 : -2)
    + day
  );
}

function isGregorianLeap(year) {
  return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
}

export function isHebrewLeapYear(year) {
  return mod(7 * year + 1, 19) < 7;
}

function lastMonthOfHebrewYear(year) {
  return isHebrewLeapYear(year) ? 13 : 12;
}

/**
 * Days elapsed from the epoch to the molad of Tishrei of `year`, with the
 * "lo ADU rosh" postponement applied — Rosh Hashanah never falls on a Sunday,
 * Wednesday or Friday.
 *
 * The remaining postponements (molad zaken, GaTaRaD, BeTUTaKPaT) are not
 * applied here; they fall out of the year-length correction in
 * {@link hebrewNewYearDelay}. Applying both double-counts and shifts the
 * calendar two days forward.
 */
function hebrewCalendarElapsedDays(year) {
  const monthsElapsed = quotient(235 * year - 234, 19);
  const partsElapsed = 12084 + 13753 * monthsElapsed;
  const day = 29 * monthsElapsed + quotient(partsElapsed, 25920);
  return mod(3 * (day + 1), 7) < 3 ? day + 1 : day;
}

function hebrewNewYearDelay(year) {
  const current = hebrewCalendarElapsedDays(year);
  const next = hebrewCalendarElapsedDays(year + 1);
  const previous = hebrewCalendarElapsedDays(year - 1);
  if (next - current === 356) return 2;
  if (current - previous === 382) return 1;
  return 0;
}

/** R.D. of 1 Tishrei of the given Hebrew year. */
function hebrewNewYear(year) {
  return HEBREW_EPOCH + hebrewCalendarElapsedDays(year) + hebrewNewYearDelay(year);
}

export function daysInHebrewYear(year) {
  return hebrewNewYear(year + 1) - hebrewNewYear(year);
}

export function lastDayOfHebrewMonth(year, month) {
  if ([2, 4, 6, 10, 13].includes(month)) return 29;
  if (month === 12 && !isHebrewLeapYear(year)) return 29;
  if (month === 8 && !longCheshvan(year)) return 29;
  if (month === 9 && shortKislev(year)) return 29;
  return 30;
}

const longCheshvan = (year) => mod(daysInHebrewYear(year), 10) === 5;
const shortKislev = (year) => mod(daysInHebrewYear(year), 10) === 3;

/** Hebrew date → R.D. */
function hebrewToFixed(year, month, day) {
  let total = hebrewNewYear(year) + day - 1;
  if (month < 7) {
    // Months from Tishrei to the end of the year, then Nisan up to `month`.
    for (let m = 7; m <= lastMonthOfHebrewYear(year); m += 1) {
      total += lastDayOfHebrewMonth(year, m);
    }
    for (let m = 1; m < month; m += 1) {
      total += lastDayOfHebrewMonth(year, m);
    }
  } else {
    for (let m = 7; m < month; m += 1) {
      total += lastDayOfHebrewMonth(year, m);
    }
  }
  return total;
}

/** R.D. → Hebrew date `{ year, month, day }`. */
function fixedToHebrew(fixed) {
  const approx = Math.floor((fixed - HEBREW_EPOCH) / 365.24682220597794) + 1;
  let year = approx - 1;
  while (hebrewNewYear(year + 1) <= fixed) year += 1;

  const start = fixed < hebrewToFixed(year, 1, 1) ? 7 : 1;
  let month = start;
  while (fixed > hebrewToFixed(year, month, lastDayOfHebrewMonth(year, month))) {
    month += 1;
  }
  const day = fixed - hebrewToFixed(year, month, 1) + 1;
  return { year, month, day };
}

/**
 * Convert a JS `Date` (or y/m/d) to a Hebrew date.
 *
 * @param {Date|number} dateOrYear
 * @param {number} [month] 1–12
 * @param {number} [day]
 * @param {boolean} [afterSunset=false] Hebrew days begin the previous evening
 */
export function toHebrewDate(dateOrYear, month, day, afterSunset = false) {
  let y;
  let m;
  let d;
  if (dateOrYear instanceof Date) {
    y = dateOrYear.getFullYear();
    m = dateOrYear.getMonth() + 1;
    d = dateOrYear.getDate();
  } else {
    y = dateOrYear;
    m = month;
    d = day;
  }
  if (!y || !m || !d) return null;

  const fixed = gregorianToFixed(y, m, d) + (afterSunset ? 1 : 0);
  const hebrew = fixedToHebrew(fixed);

  const monthName = monthNameFor(hebrew.year, hebrew.month);
  return {
    ...hebrew,
    monthName: monthName.en,
    monthNameHe: monthName.he,
    isLeapYear: isHebrewLeapYear(hebrew.year),
    // The conventional written form drops the thousands ("5785" → תשפ״ה).
    yearNumeral: toHebrewNumeral(hebrew.year % 1000),
    dayNumeral: toHebrewNumeral(hebrew.day),
    /** e.g. "כ״ה כסלו תשפ״ה" */
    formattedHe: `${toHebrewNumeral(hebrew.day)} ${monthName.he} ${toHebrewNumeral(hebrew.year % 1000)}`,
    /** e.g. "25 Kislev 5785" */
    formatted: `${hebrew.day} ${monthName.en} ${hebrew.year}`,
  };
}

function monthNameFor(year, month) {
  const leap = isHebrewLeapYear(year);
  if (leap && month === 12) return { en: 'Adar I', he: 'אדר א׳' };
  if (!leap && month === 12) return { en: 'Adar', he: 'אדר' };
  return { en: MONTH_NAMES[month], he: MONTH_NAMES_HE[month] };
}

/**
 * The gematria-relevant view of a date: the numeral form of the day, month
 * and year, and the combined value of the whole written date.
 */
export function hebrewDateGematria(hebrewDate) {
  if (!hebrewDate) return null;
  const text = `${hebrewDate.dayNumeral} ${hebrewDate.monthNameHe} ${hebrewDate.yearNumeral}`;
  const letters = text.replace(/[^א-ת]/g, '');
  const VALUES = {
    'א': 1, 'ב': 2, 'ג': 3, 'ד': 4, 'ה': 5, 'ו': 6, 'ז': 7, 'ח': 8, 'ט': 9,
    'י': 10, 'כ': 20, 'ל': 30, 'מ': 40, 'נ': 50, 'ס': 60, 'ע': 70, 'פ': 80, 'צ': 90,
    'ק': 100, 'ר': 200, 'ש': 300, 'ת': 400,
    'ך': 20, 'ם': 40, 'ן': 50, 'ף': 80, 'ץ': 90,
  };
  return {
    text,
    value: letters.split('').reduce((n, c) => n + (VALUES[c] || 0), 0),
  };
}

export { MONTH_NAMES, MONTH_NAMES_HE };
