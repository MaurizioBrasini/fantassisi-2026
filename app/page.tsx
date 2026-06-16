"use client";

import { useState } from "react";

export default function Dashboard() {
  const [remainingCoins, setRemainingCoins] = useState(20);

  return (
    <div style={{ maxWidth: 420, margin: "0 auto", padding: 20 }}>
      <h1 style={{ color: "#FF6B35" }}>FantAssisi 2026</h1>
      <p>CBTcoin rimasti: {remainingCoins}</p>
      <button onClick={() => window.location.href = "/scan"}>
        VOTA
      </button>
    </div>
  );
}
