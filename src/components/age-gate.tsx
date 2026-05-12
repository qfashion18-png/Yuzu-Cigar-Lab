"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { ShieldCheck } from "lucide-react";

import { BrandMark } from "@/components/brand-mark";
import { Button } from "@/components/ui/button";
import {
  AGE_CONFIRMATION_STORAGE_KEY,
  AGE_CONFIRMED_DOCUMENT_ATTRIBUTE,
  ageConfirmationMaxAgeDays,
  ageConfirmationMaxAgeMs,
  ageConfirmationStorageVersion,
  ageGateBootstrapScript,
} from "@/lib/age-gate-bootstrap";

const minimumAge = 21;
const earliestBirthYear = 1900;
const latestBirthYear = new Date().getFullYear();

export { ageConfirmationMaxAgeMs, ageGateBootstrapScript };

const useBrowserLayoutEffect = typeof window === "undefined" ? useEffect : useLayoutEffect;

const months = [
  { value: "1", label: "January" },
  { value: "2", label: "February" },
  { value: "3", label: "March" },
  { value: "4", label: "April" },
  { value: "5", label: "May" },
  { value: "6", label: "June" },
  { value: "7", label: "July" },
  { value: "8", label: "August" },
  { value: "9", label: "September" },
  { value: "10", label: "October" },
  { value: "11", label: "November" },
  { value: "12", label: "December" },
];

const days = Array.from({ length: 31 }, (_, index) => String(index + 1));
const years = Array.from(
  { length: latestBirthYear - earliestBirthYear + 1 },
  (_, index) => String(latestBirthYear - index),
);

type BirthdaySelection = {
  month: string;
  day: string;
  year: string;
};

type BirthdayStatus = {
  confirmed: boolean;
  message: string;
};

type StoredAgeConfirmation = {
  confirmedAt?: unknown;
  value?: unknown;
  version?: unknown;
};

export function isAtLeast21(birthday: Date, today = new Date()) {
  let age = today.getFullYear() - birthday.getFullYear();
  const hasHadBirthdayThisYear =
    today.getMonth() > birthday.getMonth() ||
    (today.getMonth() === birthday.getMonth() && today.getDate() >= birthday.getDate());

  if (!hasHadBirthdayThisYear) {
    age -= 1;
  }

  return age >= minimumAge;
}

export function getBirthdayStatus(selection: BirthdaySelection, today = new Date()): BirthdayStatus {
  const birthday = getSelectedBirthday(selection);

  if (!selection.month || !selection.day || !selection.year) {
    return {
      confirmed: false,
      message: "Select your full birthday to continue.",
    };
  }

  if (!birthday) {
    return {
      confirmed: false,
      message: "Select a valid birthday to continue.",
    };
  }

  if (!isAtLeast21(birthday, today)) {
    return {
      confirmed: false,
      message: "You must be at least 21 years old to enter Yuzu Cigar Club.",
    };
  }

  return {
    confirmed: true,
    message: "",
  };
}

export function createAgeConfirmationValue(confirmedAt = Date.now()) {
  return JSON.stringify({
    confirmedAt,
    value: "yes",
    version: ageConfirmationStorageVersion,
  });
}

export function isAgeConfirmationCurrent(value: string | null, now = Date.now()) {
  if (!value) {
    return false;
  }

  try {
    const parsed = JSON.parse(value) as StoredAgeConfirmation;
    const confirmedAt = Number(parsed.confirmedAt);
    const elapsed = now - confirmedAt;

    return (
      parsed.value === "yes" &&
      parsed.version === ageConfirmationStorageVersion &&
      Number.isFinite(confirmedAt) &&
      elapsed >= 0 &&
      elapsed <= ageConfirmationMaxAgeMs
    );
  } catch {
    return false;
  }
}

function getSelectedBirthday({ month, day, year }: BirthdaySelection) {
  const numericMonth = Number(month);
  const numericDay = Number(day);
  const numericYear = Number(year);

  if (!Number.isInteger(numericMonth) || !Number.isInteger(numericDay) || !Number.isInteger(numericYear)) {
    return null;
  }

  const birthday = new Date(numericYear, numericMonth - 1, numericDay);
  const matchesSelection =
    birthday.getFullYear() === numericYear &&
    birthday.getMonth() === numericMonth - 1 &&
    birthday.getDate() === numericDay;

  return matchesSelection ? birthday : null;
}

export function AgeGate() {
  const overlayRef = useRef<HTMLDivElement>(null);
  const dialogRef = useRef<HTMLDivElement>(null);
  const firstFieldRef = useRef<HTMLSelectElement>(null);
  const [ready, setReady] = useState(false);
  const [confirmed, setConfirmed] = useState(false);
  const [birthday, setBirthday] = useState<BirthdaySelection>({ month: "", day: "", year: "" });
  const [statusMessage, setStatusMessage] = useState("");
  const gateActive = !(ready && confirmed);

  useBrowserLayoutEffect(() => {
    try {
      const value = window.localStorage.getItem(AGE_CONFIRMATION_STORAGE_KEY);
      const hasCurrentConfirmation = isAgeConfirmationCurrent(value);

      setConfirmed(hasCurrentConfirmation);
      setDocumentAgeConfirmed(hasCurrentConfirmation);

      if (value && !hasCurrentConfirmation) {
        window.localStorage.removeItem(AGE_CONFIRMATION_STORAGE_KEY);
      }
    } catch {
      setConfirmed(false);
      setDocumentAgeConfirmed(false);
    } finally {
      setReady(true);
    }
  }, []);

  useEffect(() => {
    if (!gateActive) {
      return;
    }

    firstFieldRef.current?.focus({ preventScroll: true });
  }, [gateActive]);

  useEffect(() => {
    if (!gateActive || !overlayRef.current) {
      return;
    }

    const previousBodyOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const parent = overlayRef.current.parentElement;
    const siblings = parent
      ? Array.from(parent.children).filter((element) => element !== overlayRef.current)
      : [];
    const siblingStates = siblings.map((element) => {
      const htmlElement = element as HTMLElement & { inert?: boolean };

      return {
        element,
        hadInertAttribute: element.hasAttribute("inert"),
        inert: htmlElement.inert ?? false,
        ariaHidden: element.getAttribute("aria-hidden"),
        display: htmlElement.style.display,
      };
    });

    siblingStates.forEach(({ element }) => {
      const htmlElement = element as HTMLElement & { inert?: boolean };
      element.setAttribute("aria-hidden", "true");
      element.setAttribute("inert", "");
      htmlElement.inert = true;
      htmlElement.style.display = "none";
    });

    return () => {
      document.body.style.overflow = previousBodyOverflow;

      siblingStates.forEach(({ element, hadInertAttribute, inert, ariaHidden, display }) => {
        const htmlElement = element as HTMLElement & { inert?: boolean };

        if (ariaHidden === null) {
          element.removeAttribute("aria-hidden");
        } else {
          element.setAttribute("aria-hidden", ariaHidden);
        }

        htmlElement.inert = inert;
        htmlElement.style.display = display;

        if (hadInertAttribute) {
          element.setAttribute("inert", "");
        } else {
          element.removeAttribute("inert");
        }
      });
    };
  }, [gateActive]);

  useEffect(() => {
    if (!gateActive) {
      return;
    }

    function focusFirstField() {
      const dialog = dialogRef.current;
      const firstFocusable = dialog ? getFocusableElements(dialog)[0] : null;
      (firstFieldRef.current ?? firstFocusable ?? dialog)?.focus({ preventScroll: true });
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key !== "Tab") {
        return;
      }

      const dialog = dialogRef.current;

      if (!dialog) {
        return;
      }

      const focusableElements = getFocusableElements(dialog);

      if (focusableElements.length === 0) {
        event.preventDefault();
        dialog.focus({ preventScroll: true });
        return;
      }

      const firstElement = focusableElements[0];
      const lastElement = focusableElements[focusableElements.length - 1];
      const activeElement = document.activeElement;

      if (!activeElement || !dialog.contains(activeElement)) {
        event.preventDefault();
        firstElement.focus({ preventScroll: true });
        return;
      }

      if (event.shiftKey && activeElement === firstElement) {
        event.preventDefault();
        lastElement.focus({ preventScroll: true });
      }

      if (!event.shiftKey && activeElement === lastElement) {
        event.preventDefault();
        firstElement.focus({ preventScroll: true });
      }
    }

    function handleFocusIn(event: FocusEvent) {
      const dialog = dialogRef.current;

      if (!dialog || !(event.target instanceof Node) || dialog.contains(event.target)) {
        return;
      }

      focusFirstField();
    }

    document.addEventListener("keydown", handleKeyDown);
    document.addEventListener("focusin", handleFocusIn);

    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      document.removeEventListener("focusin", handleFocusIn);
    };
  }, [gateActive]);

  const hasCompleteBirthday = Boolean(birthday.month && birthday.day && birthday.year);

  function updateBirthday(field: keyof BirthdaySelection, value: string) {
    setBirthday((current) => ({ ...current, [field]: value }));
    setStatusMessage("");
  }

  function confirmBirthday() {
    const status = getBirthdayStatus(birthday);
    setStatusMessage(status.message);

    if (!status.confirmed) {
      return;
    }

    try {
      window.localStorage.setItem(AGE_CONFIRMATION_STORAGE_KEY, createAgeConfirmationValue());
    } catch {
      // The current session can still enter even if browser storage is unavailable.
    }

    setDocumentAgeConfirmed(true);
    setConfirmed(true);
  }

  if (!gateActive) {
    return null;
  }

  return (
    <div
      className="fixed inset-0 z-[80] grid place-items-center overflow-hidden bg-yuzu-night/95 px-4 py-4 backdrop-blur-md sm:px-5"
      data-yuzu-age-gate="overlay"
      ref={overlayRef}
    >
        <div
          aria-describedby="age-gate-description age-gate-status"
          aria-labelledby="age-gate-title"
          aria-modal="true"
          className="max-h-[calc(100dvh-2rem)] w-full max-w-lg overflow-y-auto border border-yuzu-gold/60 bg-yuzu-forest p-5 shadow-[0_28px_90px_rgba(0,0,0,0.55)] sm:p-6"
          ref={dialogRef}
          role="dialog"
          tabIndex={-1}
        >
          <BrandMark />
          <div className="mt-8 flex flex-col gap-4">
            <div className="grid size-12 place-items-center border border-yuzu-gold/60 text-yuzu-gold">
              <ShieldCheck />
            </div>
            <h2 className="font-heading text-4xl leading-tight text-yuzu-cream" id="age-gate-title">
              Adults 21+ Only.
            </h2>
            <p className="text-sm leading-6 text-yuzu-muted" id="age-gate-description">
              Yuzu Cigar Club sells age-restricted tobacco products. Select your birthday to confirm you are at least 21 years old to enter.
            </p>
            <div className="grid gap-3 sm:grid-cols-3">
              <label className="flex flex-col gap-2 text-xs font-bold uppercase tracking-[0.16em] text-yuzu-gold">
                Month
                <select
                  aria-describedby="age-gate-status"
                  className="h-12 w-full border border-yuzu-line bg-yuzu-ink px-3 text-sm font-medium normal-case tracking-normal text-yuzu-cream outline-none transition focus:border-yuzu-gold focus:ring-2 focus:ring-yuzu-gold/35"
                  name="birthMonth"
                  ref={firstFieldRef}
                  value={birthday.month}
                  onChange={(event) => updateBirthday("month", event.target.value)}
                >
                  <option value="">Month</option>
                  {months.map((month) => (
                    <option key={month.value} value={month.value}>
                      {month.label}
                    </option>
                  ))}
                </select>
              </label>
              <label className="flex flex-col gap-2 text-xs font-bold uppercase tracking-[0.16em] text-yuzu-gold">
                Day
                <select
                  aria-describedby="age-gate-status"
                  className="h-12 w-full border border-yuzu-line bg-yuzu-ink px-3 text-sm font-medium normal-case tracking-normal text-yuzu-cream outline-none transition focus:border-yuzu-gold focus:ring-2 focus:ring-yuzu-gold/35"
                  name="birthDay"
                  value={birthday.day}
                  onChange={(event) => updateBirthday("day", event.target.value)}
                >
                  <option value="">Day</option>
                  {days.map((day) => (
                    <option key={day} value={day}>
                      {day}
                    </option>
                  ))}
                </select>
              </label>
              <label className="flex flex-col gap-2 text-xs font-bold uppercase tracking-[0.16em] text-yuzu-gold">
                Year
                <select
                  aria-describedby="age-gate-status"
                  className="h-12 w-full border border-yuzu-line bg-yuzu-ink px-3 text-sm font-medium normal-case tracking-normal text-yuzu-cream outline-none transition focus:border-yuzu-gold focus:ring-2 focus:ring-yuzu-gold/35"
                  name="birthYear"
                  value={birthday.year}
                  onChange={(event) => updateBirthday("year", event.target.value)}
                >
                  <option value="">Year</option>
                  {years.map((year) => (
                    <option key={year} value={year}>
                      {year}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            <p
              className="min-h-5 text-xs leading-5 text-yuzu-muted"
              id="age-gate-status"
              role="status"
              aria-live="polite"
            >
              {statusMessage || `We store only this browser confirmation for ${ageConfirmationMaxAgeDays} days, not your date of birth.`}
            </p>
            <div className="grid gap-3 sm:grid-cols-2">
              <Button
                className="h-12 bg-yuzu-gold text-yuzu-ink hover:bg-yuzu-gold-light"
                disabled={!hasCompleteBirthday}
                onClick={confirmBirthday}
              >
                Enter site
              </Button>
              <Button
                className="h-12 border-yuzu-line text-yuzu-cream hover:bg-yuzu-ink"
                variant="outline"
                onClick={() => window.location.assign("https://www.fda.gov/tobacco-products")}
              >
                Leave site
              </Button>
            </div>
            <p className="text-xs leading-5 text-yuzu-muted">
              Checkout still requires identity and age verification before purchase.
            </p>
          </div>
        </div>
    </div>
  );
}

function setDocumentAgeConfirmed(isConfirmed: boolean) {
  if (typeof document === "undefined") {
    return;
  }

  if (isConfirmed) {
    document.documentElement.setAttribute(AGE_CONFIRMED_DOCUMENT_ATTRIBUTE, "true");
    return;
  }

  document.documentElement.removeAttribute(AGE_CONFIRMED_DOCUMENT_ATTRIBUTE);
}

function getFocusableElements(container: HTMLElement) {
  const focusableSelector = [
    "a[href]",
    "button:not([disabled])",
    "input:not([disabled])",
    "select:not([disabled])",
    "textarea:not([disabled])",
    '[tabindex]:not([tabindex="-1"])',
  ].join(",");

  return Array.from(container.querySelectorAll<HTMLElement>(focusableSelector)).filter(
    (element) => !element.hasAttribute("disabled") && element.getAttribute("aria-hidden") !== "true",
  );
}
