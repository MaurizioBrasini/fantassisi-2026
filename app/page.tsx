"use client"; 
import { useEffect, useState } from "react"; 
import { supabase } from "@/lib/supabase"; 
export default function Dashboard() { 
  const [remainingCoins, setRemainingCoins] = useState(20); 
  return ( 
    <div style={{ maxWidth: 420, margin: "0 auto", padding: 20 }}> 
      <h1 style={{ color: "#FF6B35" }}>FantAssisi 2026</h1> 
      <p>CBTcoin rimasti: {remainingCoins}</p> 
      <button onClick={() =="/scan"}>VOTA</button> 
    </div> 
  ); 
} 
