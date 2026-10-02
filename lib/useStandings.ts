import { useEffect, useState } from "react";
import { getCookie } from "./clientCookies";

export type StandingsStatus = "loading" | "noaccess" | "error" | "ok";

// Legge una classifica da /api/standings. Stessi esiti per tutte le pagine delle classifiche:
// niente sessione -> "noaccess", errore di rete o del server -> "error".
export function useStandings<T>(view: "individuali" | "classi" | "sedi") {
  const [data, setData] = useState<T | null>(null);
  const [status, setStatus] = useState<StandingsStatus>("loading");
  const [userId, setUserId] = useState<string | null>(null);

  useEffect(() => {
    const load = async () => {
      const id = getCookie("user_id");
      if (!id) {
        setStatus("noaccess");
        return;
      }
      setUserId(id);

      try {
        const res = await fetch(`/api/standings?view=${view}`, { cache: "no-store" });
        if (res.status === 401) {
          setStatus("noaccess");
        } else if (!res.ok) {
          throw new Error(String(res.status));
        } else {
          setData(await res.json());
          setStatus("ok");
        }
      } catch {
        setStatus("error");
      }
    };
    load();
  }, [view]);

  return { data, status, userId };
}
