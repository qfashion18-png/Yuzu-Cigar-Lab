"use client";

import { useEffect, useState } from "react";

export function useEventClock(initialNowIso: string) {
  const [now, setNow] = useState(() => new Date(initialNowIso));

  useEffect(() => {
    function refreshNow() {
      setNow(new Date());
    }

    refreshNow();
    const interval = window.setInterval(refreshNow, 60 * 1000);

    return () => window.clearInterval(interval);
  }, []);

  return now;
}
