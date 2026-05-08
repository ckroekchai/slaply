"use client";

import { useEffect, useState } from "react";

export function PaymentCountdown({ enabled = false, seconds = 10 }) {
  const [remaining, setRemaining] = useState(seconds);

  useEffect(() => {
    if (!enabled) return undefined;

    setRemaining(seconds);

    const interval = window.setInterval(() => {
      setRemaining((value) => {
        if (value <= 1) {
          window.clearInterval(interval);
          return 0;
        }

        return value - 1;
      });
    }, 1000);

    return () => window.clearInterval(interval);
  }, [enabled, seconds]);

  if (!enabled) return null;

  return (
    <small className="payment-countdown">
      {remaining > 0
        ? `Checking payment confirmation... report opens in ${remaining}s.`
        : "Payment confirmation received. Report guidance is now open."}
    </small>
  );
}
