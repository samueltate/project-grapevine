import { useCallback, useEffect, useMemo, useState } from "react";
import type { CoordinationRequest, PublicAppealDraft, ResponseBundle, ResponseNeed, ResponsePartner, ResponseShortlist, SupplyInventoryItem } from "./responseSchemas";

async function api<T>(path: string, options: RequestInit = {}): Promise<T> {
  const response = await fetch(path, {
    ...options,
    headers: { "content-type": "application/json", ...options.headers }
  });
  const data = await response.json() as T & { error?: string };
  if (!response.ok) throw new Error(data.error || "Resource request failed.");
  return data;
}

export type ResponseActions = {
  refresh: () => Promise<ResponseBundle>;
  getIncidentBrief: () => Promise<ResponseBundle["incident"]>;
  findPartners: (need: ResponseNeed, area: string, localLedOnly?: boolean) => Promise<{ partners: ResponsePartner[]; matching_need: ResponseNeed; area: string }>;
  getPartnerDetails: (partnerId: string) => Promise<ResponsePartner>;
  createShortlist: (input: { title: string; need: ResponseNeed; area: string; partner_ids: string[]; rationale: string }) => Promise<ResponseShortlist>;
  prepareCoordination: (input: { shortlist_id: string; objective: string; available_resources: string }) => Promise<{ request: CoordinationRequest; approval_required: true; recommended_next_step: Record<string, string> }>;
  approveCoordination: (requestId: string) => Promise<CoordinationRequest>;
  resetWorkRequest: () => Promise<ResponseBundle>;
  getSupplyInventory: (status?: SupplyInventoryItem["status"]) => Promise<{ inventory: SupplyInventoryItem[] }>;
  draftSupplyAppeal: (itemId: string) => Promise<PublicAppealDraft>;
};

export function useResponse() {
  const [bundle, setBundle] = useState<ResponseBundle | null>(null);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    const result = await api<ResponseBundle>("/api/response/state");
    setBundle(result);
    return result;
  }, []);

  useEffect(() => {
    void refresh().catch((caught: unknown) => setError(caught instanceof Error ? caught.message : "Could not load response directory."));
  }, [refresh]);

  const refreshInBackground = useCallback(() => {
    void refresh().catch((caught: unknown) => setError(caught instanceof Error ? caught.message : "Could not refresh response directory."));
  }, [refresh]);

  useEffect(() => {
    const refreshWhenVisible = () => {
      if (document.visibilityState !== "hidden") {
        void refresh().catch((caught: unknown) =>
          setError(caught instanceof Error ? caught.message : "Could not refresh response directory.")
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

  const getIncidentBrief = useCallback(() => api<ResponseBundle["incident"]>("/api/response/incident"), []);
  const findPartners = useCallback((need: ResponseNeed, area: string, local_led_only = false) => api<{ partners: ResponsePartner[]; matching_need: ResponseNeed; area: string }>("/api/response/partners/find", {
    method: "POST", body: JSON.stringify({ need, area, local_led_only })
  }), []);
  const getPartnerDetails = useCallback((partnerId: string) => api<ResponsePartner>(`/api/response/partners/${encodeURIComponent(partnerId)}`), []);
  const createShortlist = useCallback(async (input: { title: string; need: ResponseNeed; area: string; partner_ids: string[]; rationale: string }) => {
    const result = await api<{ shortlist: ResponseShortlist }>("/api/response/shortlists", { method: "POST", body: JSON.stringify(input) });
    refreshInBackground();
    return result.shortlist;
  }, [refreshInBackground]);
  const prepareCoordination = useCallback(async (input: { shortlist_id: string; objective: string; available_resources: string }) => {
    const result = await api<{ request: CoordinationRequest; approval_required: true; recommended_next_step: Record<string, string> }>("/api/response/requests", { method: "POST", body: JSON.stringify(input) });
    refreshInBackground();
    return result;
  }, [refreshInBackground]);
  const approveCoordination = useCallback(async (requestId: string) => {
    const result = await api<{ request: CoordinationRequest }>(`/api/response/requests/${encodeURIComponent(requestId)}/approve`, { method: "POST" });
    refreshInBackground();
    return result.request;
  }, [refreshInBackground]);
  const resetWorkRequest = useCallback(async () => {
    const result = await api<{ reset: true; workspace: ResponseBundle }>("/api/response/work-request/reset", { method: "POST" });
    setBundle(result.workspace);
    return result.workspace;
  }, []);
  const getSupplyInventory = useCallback((status?: SupplyInventoryItem["status"]) => api<{ inventory: SupplyInventoryItem[] }>("/api/response/inventory", { method: "POST", body: JSON.stringify({ status }) }), []);
  const draftSupplyAppeal = useCallback(async (itemId: string) => {
    const result = await api<{ draft: PublicAppealDraft }>("/api/response/appeals", { method: "POST", body: JSON.stringify({ item_id: itemId }) });
    refreshInBackground();
    return result.draft;
  }, [refreshInBackground]);

  const actions = useMemo<ResponseActions>(() => ({
    refresh, getIncidentBrief, findPartners, getPartnerDetails, createShortlist, prepareCoordination, approveCoordination, resetWorkRequest, getSupplyInventory, draftSupplyAppeal
  }), [refresh, getIncidentBrief, findPartners, getPartnerDetails, createShortlist, prepareCoordination, approveCoordination, resetWorkRequest, getSupplyInventory, draftSupplyAppeal]);

  return { bundle, error, setError, actions };
}
