import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { AppState, DroneMission, DroneStatus, RequestType, Session, Source, Spot } from "./schemas";

const emptyState: AppState = {
  spots: [],
  sources: [],
  sessions: []
};

type ApiFindSourcesResponse = {
  spot: Spot | null;
  sources: Source[];
  radius_m: number;
};

async function api<T>(path: string, options: RequestInit = {}): Promise<T> {
  const response = await fetch(path, {
    ...options,
    headers: {
      "content-type": "application/json",
      ...options.headers
    }
  });
  const data = (await response.json()) as T & { error?: string };
  if (!response.ok) {
    throw new Error(data.error || "Project Grapevine request failed.");
  }
  return data;
}

export type CheckInInput = {
  source_id?: string;
  handle: string;
  place_id: string;
  location_name: string;
  address?: string;
  lat?: number;
  lng?: number;
  offered: RequestType[];
  display_name?: string;
  channel_label?: string;
};

export type GrapevineActions = {
  refresh: () => Promise<AppState>;
  findAvailableSources: (near: string, radius_m?: number) => Promise<ApiFindSourcesResponse>;
  getWebBaseline: (spot: string) => Promise<Spot>;
  askSource: (
    source_id: string,
    request_type: RequestType,
    question?: string
  ) => Promise<Session>;
  approveSession: (session_id: string) => Promise<Session>;
  getSession: (session_id: string) => Promise<Session>;
  getResponse: (session_id: string) => Promise<{ status: string; session?: Session }>;
  submitAnswer: (
    session_id: string,
    answer_value: string,
    answer_note?: string
  ) => Promise<Session>;
  getDroneStatus: (source_id: string) => Promise<DroneStatus>;
  prepareDroneMission: (input: { source_id: string; target_name: string; objective: string; target_lat?: number; target_lng?: number }) => Promise<DroneMission>;
  approveDroneMission: (mission_id: string) => Promise<DroneMission>;
  checkIn: (input: CheckInInput) => Promise<Source>;
  loadDriver: (source_id: string) => Promise<{ source: Source | null; sessions: Session[] }>;
};

export function useGrapevine() {
  const [state, setState] = useState<AppState>(emptyState);
  const [selectedSpot, setSelectedSpot] = useState<Spot | null>(null);
  const [selectedSource, setSelectedSource] = useState<Source | null>(null);
  const [activeSession, setActiveSession] = useState<Session | null>(null);
  const [baseline, setBaseline] = useState<Spot | null>(null);
  const [droneStatus, setDroneStatus] = useState<DroneStatus | null>(null);
  const [droneMission, setDroneMission] = useState<DroneMission | null>(null);
  const [error, setError] = useState<string | null>(null);
  const stateRef = useRef(state);

  const commit = useCallback((next: AppState) => {
    stateRef.current = next;
    setState(next);
  }, []);

  const refresh = useCallback(async () => {
    const next = await api<AppState>("/api/state");
    commit(next);
    const latestSession = next.sessions[0] ?? null;
    setActiveSession((current) => {
      if (!current) return latestSession;
      return next.sessions.find((session) => session.id === current.id) ?? latestSession;
    });
    if (latestSession?.source) {
      setSelectedSource((current) => current ?? latestSession.source ?? null);
    }
    return next;
  }, [commit]);

  useEffect(() => {
    void refresh().catch((caught: unknown) =>
      setError(caught instanceof Error ? caught.message : "Could not load Grapevine.")
    );
  }, [refresh]);

  const refreshInBackground = useCallback(() => {
    void refresh().catch((caught: unknown) =>
      setError(caught instanceof Error ? caught.message : "Could not refresh Grapevine.")
    );
  }, [refresh]);

  useEffect(() => {
    const refreshWhenVisible = () => {
      if (document.visibilityState !== "hidden") {
        void refresh().catch((caught: unknown) =>
          setError(caught instanceof Error ? caught.message : "Could not refresh Grapevine.")
        );
      }
    };
    window.addEventListener("focus", refreshWhenVisible);
    window.addEventListener("pageshow", refreshWhenVisible);
    document.addEventListener("visibilitychange", refreshWhenVisible);
    return () => {
      window.removeEventListener("focus", refreshWhenVisible);
      window.removeEventListener("pageshow", refreshWhenVisible);
      document.removeEventListener("visibilitychange", refreshWhenVisible);
    };
  }, [refresh]);

  const findAvailableSources = useCallback(
    async (near: string, radius_m = 1500) => {
      const result = await api<ApiFindSourcesResponse>("/api/sources/find", {
        method: "POST",
        body: JSON.stringify({ near, radius_m })
      });
      setSelectedSpot(result.spot);
      setSelectedSource(result.sources[0] ?? null);
      commit({
        ...stateRef.current,
        sources: result.sources
      });
      return result;
    },
    [commit]
  );

  const getWebBaseline = useCallback(async (spot: string) => {
    const result = await api<Spot>("/api/baseline", {
      method: "POST",
      body: JSON.stringify({ spot })
    });
    setBaseline(result);
    setSelectedSpot(result);
    return result;
  }, []);

  const askSource = useCallback(
    async (source_id: string, request_type: RequestType, question = "") => {
      const result = await api<{ session: Session }>("/api/sessions", {
        method: "POST",
        body: JSON.stringify({ source_id, request_type, question })
      });
      setActiveSession(result.session);
      refreshInBackground();
      return result.session;
    },
    [refreshInBackground]
  );

  const approveSession = useCallback(
    async (session_id: string) => {
      const result = await api<{ session: Session }>(
        `/api/sessions/${session_id}/approve`,
        { method: "POST" }
      );
      setActiveSession(result.session);
      refreshInBackground();
      return result.session;
    },
    [refreshInBackground]
  );

  const getSession = useCallback(async (session_id: string) => {
    const result = await api<{ session: Session }>(`/api/sessions/${session_id}`);
    setActiveSession(result.session);
    return result.session;
  }, []);

  const getResponse = useCallback(async (session_id: string) => {
    const started = Date.now();
    while (Date.now() - started < 10000) {
      const result = await api<{ session: Session }>(`/api/sessions/${session_id}`);
      if (result.session.status === "answered" || result.session.status === "rated") {
        setActiveSession(result.session);
        await refresh();
        return { status: result.session.status, session: result.session };
      }
      await new Promise((resolve) => setTimeout(resolve, 1200));
    }
    await refresh();
    return { status: "waiting" };
  }, [refresh]);

  const submitAnswer = useCallback(
    async (session_id: string, answer_value: string, answer_note = "") => {
      const result = await api<{ session: Session }>(
        `/api/sessions/${session_id}/answer`,
        {
          method: "POST",
          body: JSON.stringify({ answer_value, answer_note })
        }
      );
      refreshInBackground();
      return result.session;
    },
    [refreshInBackground]
  );

  const getDroneStatus = useCallback(async (source_id: string) => {
    const result = await api<DroneStatus>(`/api/drones/${encodeURIComponent(source_id)}`);
    setDroneStatus(result);
    return result;
  }, []);

  const prepareDroneMission = useCallback(async (input: { source_id: string; target_name: string; objective: string; target_lat?: number; target_lng?: number }) => {
    const result = await api<{ mission: DroneMission }>("/api/drone-missions", { method: "POST", body: JSON.stringify(input) });
    setDroneMission(result.mission);
    return result.mission;
  }, []);

  const approveDroneMission = useCallback(async (mission_id: string) => {
    const result = await api<{ mission: DroneMission }>(`/api/drone-missions/${encodeURIComponent(mission_id)}/approve`, { method: "POST" });
    setDroneMission(result.mission);
    refreshInBackground();
    return result.mission;
  }, [refreshInBackground]);

  const checkIn = useCallback(
    async (input: CheckInInput) => {
      const result = await api<{ source: Source }>("/api/drive/check-in", {
        method: "POST",
        body: JSON.stringify(input)
      });
      refreshInBackground();
      return result.source;
    },
    [refreshInBackground]
  );

  const loadDriver = useCallback(
    async (source_id: string) => {
      return api<{ source: Source | null; sessions: Session[] }>(
        `/api/driver?source_id=${encodeURIComponent(source_id)}`
      );
    },
    []
  );

  const actions = useMemo<GrapevineActions>(
    () => ({
      refresh,
      findAvailableSources,
      getWebBaseline,
      askSource,
      approveSession,
      getSession,
      getResponse,
      submitAnswer,
      getDroneStatus,
      prepareDroneMission,
      approveDroneMission,
      checkIn,
      loadDriver
    }),
    [
      refresh,
      findAvailableSources,
      getWebBaseline,
      askSource,
      approveSession,
      getSession,
      getResponse,
      submitAnswer,
      getDroneStatus,
      prepareDroneMission,
      approveDroneMission,
      checkIn,
      loadDriver
    ]
  );

  return {
    state,
    selectedSpot,
    setSelectedSpot,
    selectedSource,
    setSelectedSource,
    activeSession,
    setActiveSession,
    baseline,
    droneStatus,
    droneMission,
    error,
    setError,
    actions
  };
}
