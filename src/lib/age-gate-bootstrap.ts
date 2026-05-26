export const AGE_CONFIRMATION_STORAGE_KEY = "yuzu-age-confirmed";
export const AGE_CONFIRMED_DOCUMENT_ATTRIBUTE = "data-yuzu-age-confirmed";
export const ageConfirmationStorageVersion = 1;
export const ageConfirmationMaxAgeDays = 30;
export const ageConfirmationMaxAgeMs = ageConfirmationMaxAgeDays * 24 * 60 * 60 * 1000;
export const ageGateBootstrapStyleId = "yuzu-age-gate-bootstrap-style";

export const ageGateBootstrapScript = `(() => {
  const styleId = "${ageGateBootstrapStyleId}";
  const overlayRule = '[data-yuzu-age-gate="overlay"]{display:none!important;}';
  const storageKey = "${AGE_CONFIRMATION_STORAGE_KEY}";
  const confirmedDocumentAttribute = "${AGE_CONFIRMED_DOCUMENT_ATTRIBUTE}";
  const maxAgeMs = ${ageConfirmationMaxAgeMs};

  function setDocumentAgeConfirmed(isConfirmed) {
    try {
      if (isConfirmed) {
        document.documentElement.setAttribute(confirmedDocumentAttribute, "true");
      } else {
        document.documentElement.removeAttribute(confirmedDocumentAttribute);
      }
    } catch {
      // ignore
    }
  }

  function setGateHidden(isHidden) {
    const existingStyle = document.getElementById(styleId);

    if (!isHidden) {
      existingStyle?.remove();
      return;
    }

    if (existingStyle) {
      return;
    }

    const style = document.createElement("style");
    style.id = styleId;
    style.textContent = overlayRule;
    document.head.appendChild(style);
  }

  function isAgeConfirmationCurrent(value, nowMs) {
    try {
      const parsed = JSON.parse(value);
      const confirmedAt = Number(parsed.confirmedAt);
      const elapsed = nowMs - confirmedAt;

      return (
        parsed.value === "yes" &&
        parsed.version === ${ageConfirmationStorageVersion} &&
        Number.isFinite(confirmedAt) &&
        elapsed >= 0 &&
        elapsed <= maxAgeMs
      );
    } catch {
      return false;
    }
  }

  function readCookie(name) {
    const prefix = name + "=";
    const cookies = document.cookie ? document.cookie.split(";") : [];

    for (const cookie of cookies) {
      const trimmed = cookie.trim();
      if (!trimmed.startsWith(prefix)) {
        continue;
      }

      try {
        return decodeURIComponent(trimmed.slice(prefix.length));
      } catch {
        return trimmed.slice(prefix.length);
      }
    }

    return null;
  }

  function readStoredValue() {
    const localValue = (() => {
      try {
        return window.localStorage.getItem(storageKey);
      } catch {
        return null;
      }
    })();

    const cookieValue = readCookie(storageKey);
    const nowMs = Date.now();

    if (isAgeConfirmationCurrent(localValue, nowMs)) {
      return localValue;
    }

    if (isAgeConfirmationCurrent(cookieValue, nowMs)) {
      return cookieValue;
    }

    return localValue || cookieValue;
  }

  function clearStorage() {
    try {
      window.localStorage.removeItem(storageKey);
    } catch {
      // ignore
    }

    const now = new Date(0);
    document.cookie = storageKey + "=; Path=/; Max-Age=0; Expires=" + now.toUTCString() + "; SameSite=Lax";
  }

  try {
    const value = readStoredValue();
    if (!value) {
      setDocumentAgeConfirmed(false);
      setGateHidden(false);
      return;
    }

    const isCurrent = isAgeConfirmationCurrent(value, Date.now());

    if (isCurrent) {
      setDocumentAgeConfirmed(true);
      setGateHidden(true);
    } else {
      clearStorage();
      setDocumentAgeConfirmed(false);
      setGateHidden(false);
    }
  } catch {
    setDocumentAgeConfirmed(false);
    setGateHidden(false);
  }
})();`;
