export const AGE_CONFIRMATION_STORAGE_KEY = "yuzu-age-confirmed";
export const AGE_CONFIRMED_DOCUMENT_ATTRIBUTE = "data-yuzu-age-confirmed";
export const ageConfirmationStorageVersion = 1;
export const ageConfirmationMaxAgeDays = 30;
export const ageConfirmationMaxAgeMs = ageConfirmationMaxAgeDays * 24 * 60 * 60 * 1000;
export const ageGateBootstrapStyleId = "yuzu-age-gate-bootstrap-style";

export const ageGateBootstrapScript = `(() => {
  const styleId = "${ageGateBootstrapStyleId}";
  const overlayRule = '[data-yuzu-age-gate="overlay"]{display:none!important;}';

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

  try {
    const value = window.localStorage.getItem("${AGE_CONFIRMATION_STORAGE_KEY}");
    if (!value) {
      setGateHidden(false);
      return;
    }

    const parsed = JSON.parse(value);
    const confirmedAt = Number(parsed.confirmedAt);
    const elapsed = Date.now() - confirmedAt;
    const isCurrent =
      parsed.value === "yes" &&
      parsed.version === ${ageConfirmationStorageVersion} &&
      Number.isFinite(confirmedAt) &&
      elapsed >= 0 &&
      elapsed <= ${ageConfirmationMaxAgeMs};

    if (isCurrent) {
      setGateHidden(true);
    } else {
      window.localStorage.removeItem("${AGE_CONFIRMATION_STORAGE_KEY}");
      setGateHidden(false);
    }
  } catch {
    setGateHidden(false);
  }
})();`;
