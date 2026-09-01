import {
  ArrowClockwiseIcon,
  CheckCircleIcon,
  ClockIcon,
  CrosshairIcon,
  DroneIcon,
  GaugeIcon,
  HouseIcon,
  ListChecksIcon,
  MapPinIcon,
  NavigationArrowIcon,
  PackageIcon,
  RadioIcon,
  RadioButtonIcon,
  UsersThreeIcon,
  WaveformIcon
} from "@phosphor-icons/react";
import {
  useEffect,
  useMemo,
  useState,
  type FormEvent
} from "react";
import {
  answerOptions,
  requestTypes,
  type RequestType,
  type Session,
  type Source,
  type Spot
} from "./schemas";
import { useGrapevine } from "./useGrapevine";
import { useWebMCPTools, type WebMCPToolsState } from "./useWebMCPTools";
import ResponseApp from "./Response";
import WarehouseApp from "./Warehouse";

const defaultQuestions: Record<RequestType, string> = {
  route_status: "Can aid vehicles safely reach Mountain Shelter B from Boone?",
  flood_depth: "What is the water depth at the creek crossing?",
  supply_access: "Can a relief convoy reach Mountain Shelter B from the Boone staging hub?",
  hazard_report: "Are debris, downed lines, or flooding blocking the aid corridor?",
  custom: "What conditions should the operations team know about right now?"
};

function minutesAgo(value: string) {
  const timestamp = new Date(value).getTime();
  if (!Number.isFinite(timestamp)) return "recently";
  const minutes = Math.max(1, Math.round((Date.now() - timestamp) / 60000));
  return `${minutes} min ago`;
}

function statusView(state: WebMCPToolsState) {
  if (state.error) return "Demo helpers could not connect";
  if (state.registered) return `${state.count} ways to check the route`;
  if (state.supported) return "Connecting route-check tools";
  return "Browser route checks are off";
}

function requestLabel(value: RequestType) {
  const labels: Record<RequestType, string> = {
    route_status: "route passability",
    flood_depth: "water level",
    supply_access: "shelter access",
    hazard_report: "road hazards",
    custom: "custom question"
  };
  return labels[value];
}

function sourceKindLabel(source: Source) {
  if (source.source_profile === "drone") return "Recon drone";
  return source.source_profile === "sensor" ? "Infrastructure sensor" : "Field responder";
}

function sourceDisplayName(source: Source) {
  if (source.display_name) return source.display_name;
  const names: Record<string, string> = {
    "demo-creek-gauge-7": "Creek depth sensor",
    "watauga-road-camera-2": "Road conditions camera",
    "boone-field-team": "Boone field team",
    "mountain-convoy-3": "Mountain convoy"
  };
  return names[source.handle] ?? source.handle.replaceAll("-", " ");
}

function verificationLabel(source: Source) {
  if (source.source_kind === "system") return source.verification_label;
  if (source.handle.includes("convoy")) return "Vehicle location check-in";
  return "Responder can confirm current road conditions";
}

function baselineStatusText(baseline: Spot) {
  if (baseline.baseline_status.toLowerCase().includes("passable")) {
    return "Earlier update says the route was open";
  }
  return baseline.baseline_status;
}

function baselineDetailText(baseline: Spot) {
  if (baseline.baseline_detail.toLowerCase().includes("verification required")) {
    return "That update may be stale, so ask someone nearby before sending vehicles";
  }
  return baseline.baseline_detail;
}

function operationalAssessment(session: Session | null, baseline: Spot | null) {
  if (!session?.answer_value || !baseline) return null;
  if (session.request_type === "route_status" && session.answer_value === "blocked") {
    return "The newest report says the route is not safe. Send teams another way.";
  }
  if (session.request_type === "route_status" && session.answer_value === "caution") {
    return "Conditions changed since the last update. Hold large vehicles until confirmed.";
  }
  if (
    session.request_type === "flood_depth" &&
    ["6-12 in", "over 12 in"].includes(session.answer_value)
  ) {
    return "Water may be too high for some vehicles. Check clearance before sending teams.";
  }
  return "The newest report adds current conditions to the older route update.";
}

function SourceMap({
  sources,
  selectedSource,
  onSelect
}: {
  sources: Source[];
  selectedSource: Source | null;
  onSelect: (source: Source) => void;
}) {
  const bounds = { west: -81.685, east: -81.663, south: 36.208, north: 36.225 };
  const markerPosition = (source: Pick<Source, "lat" | "lng">) => ({
    left: `${((source.lng - bounds.west) / (bounds.east - bounds.west)) * 100}%`,
    top: `${((bounds.north - source.lat) / (bounds.north - bounds.south)) * 100}%`
  });
  const obstructionPosition = markerPosition({
    lat: 36.21945,
    lng: -81.67435
  });

  return (
    <div className="map-wrap">
      <div className="source-map" aria-label="Map of nearby sources">
        <img src="/watauga-corridor-map.webp" alt="Street map of Boone and the Watauga relief corridor" />
        {sources.map((source) => (
          <button
            key={source.id}
            type="button"
            className={`map-marker ${source.source_profile} ${selectedSource?.id === source.id ? "selected" : ""}`}
            style={markerPosition(source)}
            aria-label={`Locate ${sourceDisplayName(source)}`}
            title={sourceDisplayName(source)}
            onClick={() => onSelect(source)}
          >
            {source.source_profile === "drone" ? "D" : source.source_profile === "sensor" ? "S" : "H"}
          </button>
        ))}
        <span
          className="incident-marker"
          style={obstructionPosition}
          role="img"
          aria-label="Fallen tree blocking the Mountain Shelter B access route"
          title="Fallen tree blocking both lanes"
        >!</span>
      </div>
      <div className="map-legend" aria-label="Map legend">
        <span><i className="human" /> Human</span>
        <span><i className="system" /> Sensor</span>
        <span><i className="drone" /> Drone</span>
        <span><i className="incident" /> Blockage</span>
      </div>
      <div className="map-caption">
        <MapPinIcon weight="fill" /> Junaluska Community incident area
      </div>
    </div>
  );
}

function SourceRoster({
  sources,
  selectedSource,
  onLocate,
  onRequest
}: {
  sources: Source[];
  selectedSource: Source | null;
  onLocate: (source: Source) => void;
  onRequest: (source: Source) => void;
}) {
  return (
    <div className="source-roster">
      <div className="roster-head" aria-hidden="true">
        <span>Source</span><span>Verification</span><span>Signals</span>
        <span>Updated</span><span>Availability</span><span>Actions</span>
      </div>
      {sources.length > 0 ? sources.map((source) => (
        <div
          className={`roster-row ${selectedSource?.id === source.id ? "selected" : ""}`}
          key={source.id}
        >
          <div className="roster-source" data-label="Source">
            <span className={`source-symbol ${source.source_profile}`}>
              {source.source_profile === "drone" ? <DroneIcon /> : source.source_profile === "sensor" ? <GaugeIcon /> : <UsersThreeIcon />}
            </span>
            <span><strong>{sourceDisplayName(source)}</strong><small>{sourceKindLabel(source)} · {source.location_name}</small></span>
          </div>
          <div className="roster-verification" data-label="Verification">
            <CheckCircleIcon weight="fill" /><span>{verificationLabel(source)}</span>
          </div>
          <div className="signal-list" data-label="Signals">
            {source.offered.slice(0, 2).map((item) => <span key={item}>{requestLabel(item)}</span>)}
            {source.offered.length > 2 && <span>+{source.offered.length - 2}</span>}
          </div>
          <div className="roster-meta" data-label="Updated">
            <strong>{minutesAgo(source.last_active)}</strong>
            <small>{source.distance_m ? `${source.distance_m} m away` : "on corridor"}</small>
          </div>
          <div className="quality" data-label="Availability">
            <strong>{source.source_profile === "drone" ? `${source.battery_percent}% battery` : source.availability_label}</strong><span>{source.mission_status || source.channel_label}</span>
          </div>
          <div className="roster-actions" data-label="Actions">
            <button
              className="icon-button"
              type="button"
              title={`Locate ${sourceDisplayName(source)}`}
              aria-label={`Locate ${sourceDisplayName(source)}`}
              onClick={() => onLocate(source)}
            ><CrosshairIcon /></button>
            <button className="request-button" type="button" onClick={() => onRequest(source)}>
              Request <NavigationArrowIcon weight="fill" />
            </button>
          </div>
        </div>
      )) : <p className="empty-roster muted">No people or sensors are available for this route.</p>}
    </div>
  );
}

function SessionPanel({
  session,
  onApprove
}: {
  session: Session | null;
  onApprove: (id: string) => void;
}) {
  if (!session) {
    return (
      <section className="request-status empty">
        <h2>Current Question</h2>
        <p className="muted">Choose who can answer, then prepare the question.</p>
      </section>
    );
  }

  const sourceLabel = session.source ? sourceKindLabel(session.source) : "Source";

  return (
    <section className="request-status">
      <div className="panel-heading">
        <h2>Current Question</h2>
        <span className={`status-pill ${session.status}`}>
          {session.status.replaceAll("_", " ")}
        </span>
      </div>
      <div className="session-card">
        <strong>{requestLabel(session.request_type)}</strong>
        <p>{session.question}</p>
        <span className="muted">
          {sourceLabel} · {session.source ? sourceDisplayName(session.source) : session.source_id}
        </span>
      </div>
      {session.status === "pending_approval" && (
        <div className="approval">
          <p>Review the question before it is sent.</p>
          <button type="button" onClick={() => onApprove(session.id)}>
            Send question
          </button>
        </div>
      )}
      {session.status === "sent" && (
        <p className="muted response-waiting">Waiting for an answer.</p>
      )}
      {session.answer_value && (
        <div className="answer">
          <span className="answer-label">Answer received</span>
          <strong>{session.answer_value}</strong>
          {session.answer_note && <p>{session.answer_note}</p>}
          {session.photo_url && <img className="answer-evidence" src={session.photo_url} alt="Aerial evidence of the reported obstruction" />}
        </div>
      )}
    </section>
  );
}

function LogisticsSidebar({
  active,
  tools
}: {
  active: "operations" | "drive";
  tools?: WebMCPToolsState;
}) {
  return <aside className="app-sidebar">
    <div className="brand-block">
      <span className="brand-mark"><WaveformIcon weight="bold" /></span>
      <span><strong>Project Grapevine</strong><small>Relief intelligence</small></span>
    </div>
    <p className="nav-group-label">Demo 1 · Live ground truth</p>
    <nav className="primary-nav" aria-label="Live ground truth navigation">
      <a className={active === "operations" ? "active" : ""} href="/"><HouseIcon weight={active === "operations" ? "fill" : "regular"} /><span>Operations Team</span></a>
      <a className={active === "drive" ? "active" : ""} href="/drive"><ListChecksIcon weight={active === "drive" ? "fill" : "regular"} /><span>Field inbox</span></a>
    </nav>
    <p className="nav-group-label">Demo 2 · Resource coordination</p>
    <nav className="primary-nav" aria-label="Resource coordination navigation">
      <a href="/response"><WaveformIcon /><span>Partner Directory</span></a>
      <a href="/warehouse"><PackageIcon /><span>Warehouse</span></a>
    </nav>
    <div className="sidebar-status">
      <p><RadioButtonIcon weight="fill" /> {tools ? statusView(tools) : "Human field channel"}</p>
    </div>
  </aside>;
}

function Board() {
  const grapevine = useGrapevine();
  const webMCP = useWebMCPTools(grapevine.actions);
  const [near, setNear] = useState("Watauga Relief Corridor");
  const [requestType, setRequestType] = useState<RequestType>("route_status");
  const [question, setQuestion] = useState(defaultQuestions.route_status);
  const [busy, setBusy] = useState(false);
  const [composerOpen, setComposerOpen] = useState(false);

  const selectedSource = grapevine.selectedSource ?? grapevine.state.sources[0] ?? null;
  const assessment = operationalAssessment(grapevine.activeSession, grapevine.baseline);
  const availableTypes = useMemo(() => {
    if (!selectedSource) return requestTypes;
    return requestTypes.filter(
      (type) => selectedSource.offered.includes(type) || type === "custom"
    );
  }, [selectedSource]);

  async function runDiscovery(event?: FormEvent) {
    event?.preventDefault();
    setBusy(true);
    grapevine.setError(null);
    try {
      await Promise.all([
        grapevine.actions.getWebBaseline(near),
        grapevine.actions.findAvailableSources(near, 5000)
      ]);
    } catch (caught) {
      grapevine.setError(caught instanceof Error ? caught.message : "Discovery failed.");
    } finally {
      setBusy(false);
    }
  }

  function selectSource(source: Source) {
    grapevine.setSelectedSource(source);
    if (source.source_profile === "drone") void grapevine.actions.getDroneStatus(source.id);
    if (!source.offered.includes(requestType)) {
      const nextType = source.offered[0] ?? "custom";
      setRequestType(nextType);
      setQuestion(defaultQuestions[nextType]);
    }
  }

  function openRequest(source: Source) {
    selectSource(source);
    setComposerOpen(true);
  }

  async function ask() {
    if (!selectedSource) return;
    setBusy(true);
    grapevine.setError(null);
    try {
      await grapevine.actions.askSource(selectedSource.id, requestType, question);
    } catch (caught) {
      grapevine.setError(
        caught instanceof Error ? caught.message : "Could not create request."
      );
    } finally {
      setBusy(false);
    }
  }

  useEffect(() => {
    void runDiscovery();
  }, []);

  useEffect(() => {
    if (!grapevine.activeSession) return;
    if (["answered", "rated"].includes(grapevine.activeSession.status)) return;
    const timer = window.setInterval(() => {
      if (grapevine.activeSession) {
        void grapevine.actions.getSession(grapevine.activeSession.id);
      }
    }, 2000);
    return () => window.clearInterval(timer);
  }, [grapevine.activeSession, grapevine.actions]);

  useEffect(() => {
    if (grapevine.activeSession?.status === "pending_approval") setComposerOpen(true);
  }, [grapevine.activeSession?.status]);

  return (
    <div className="dashboard-shell">
      <LogisticsSidebar active="operations" tools={webMCP} />

      <main className="dashboard-main">
        <header className="operation-header">
          <div>
            <p className="eyebrow">Western North Carolina · Relief operations</p>
            <h1>Watauga Relief Corridor</h1>
            <p className="deck">Boone Staging Hub to Mountain Shelter B</p>
          </div>
          <form className="area-control" onSubmit={runDiscovery}>
            <label htmlFor="near">Operational area</label>
            <div>
              <input id="near" value={near} onChange={(event) => setNear(event.target.value)} />
              <button className="icon-button refresh-button" type="submit" disabled={busy} title="Refresh reports" aria-label="Refresh current reports">
                <ArrowClockwiseIcon className={busy ? "spinning" : ""} />
              </button>
            </div>
          </form>
        </header>

        {new URLSearchParams(window.location.search).get("handoff") === "response-plan" && <div className="handoff-banner">
          <CheckCircleIcon weight="fill" />
          <span><strong>Response partners selected.</strong> Confirm the Watauga corridor before approving dispatch.</span>
          <a href="/response">View response plan</a>
        </div>}

        {grapevine.error && <p className="error" role="alert">{grapevine.error}</p>}

        <section className="overview-grid">
          <div className="map-panel">
            <div className="panel-title">
              <div><p className="eyebrow">Source network</p><h2>Live corridor map</h2></div>
              <span className="source-count"><i /> {grapevine.state.sources.length} online</span>
            </div>
            <SourceMap
              sources={grapevine.state.sources}
              selectedSource={selectedSource}
              onSelect={selectSource}
            />
          </div>

          <aside className="intelligence-panel">
            <div className="panel-title">
              <div><p className="eyebrow">What we know</p><h2>Route status</h2></div>
            </div>
            <section className="intel-section">
              <span className="intel-kicker"><ClockIcon /> Earlier report</span>
              {grapevine.baseline ? <>
                <strong>{baselineStatusText(grapevine.baseline)}</strong>
                <p>{baselineDetailText(grapevine.baseline)}</p>
                <small>Last updated {minutesAgo(grapevine.baseline.as_of ?? "")}</small>
              </> : <p className="muted">No baseline loaded.</p>}
            </section>
            <section className="intel-section live-report">
              <span className="intel-kicker"><RadioIcon weight="fill" /> Latest report</span>
              {grapevine.activeSession?.answer_value ? <>
                <strong className="answer-value">{grapevine.activeSession.answer_value}</strong>
                <p>{assessment}</p>
                <small>{grapevine.activeSession.source ? verificationLabel(grapevine.activeSession.source) : "Verified source report"}</small>
              </> : <>
                <strong>Waiting for someone nearby</strong>
                <p>Ask a person or sensor nearby before sending relief vehicles.</p>
              </>}
            </section>
            <section className="intel-section active-request">
              <span className="intel-kicker"><NavigationArrowIcon /> Question in progress</span>
              {grapevine.activeSession ? <>
                <strong>{requestLabel(grapevine.activeSession.request_type)}</strong>
                <p>{grapevine.activeSession.status.replaceAll("_", " ")} · {grapevine.activeSession.source ? sourceDisplayName(grapevine.activeSession.source) : "selected source"}</p>
              </> : <p>No question has been sent yet.</p>}
            </section>
          </aside>
        </section>

        {selectedSource?.source_profile === "drone" && grapevine.droneStatus && <section className="drone-panel">
          <img src={grapevine.droneStatus.observation.image_url || "/drone-tree-obstruction.png"} alt="Drone view of a fallen tree blocking the relief route" />
          <div>
            <p className="eyebrow">Aerial observation</p>
            <h2>{grapevine.droneStatus.observation.classification}</h2>
            <div className="drone-metrics"><span><strong>{selectedSource.battery_percent}%</strong> battery</span><span><strong>{selectedSource.telemetry.connection}</strong> link</span></div>
            <p>{selectedSource.mission_status}.</p>
            {!grapevine.droneMission && <button type="button" onClick={() => void grapevine.actions.prepareDroneMission({ source_id: selectedSource.id, target_name: "Mountain Shelter B access road", objective: "Confirm Miles's fallen-tree report and capture current route evidence." })}>Prepare reposition</button>}
            {grapevine.droneMission?.status === "pending_approval" && <div className="mission-approval"><span>Mission staged. Human approval required.</span><button type="button" onClick={() => void grapevine.actions.approveDroneMission(grapevine.droneMission!.id)}>Approve mission</button></div>}
            {grapevine.droneMission?.status === "completed" && <p className="mission-complete"><CheckCircleIcon weight="fill" /> Survey complete. Obstruction confirmed.</p>}
          </div>
        </section>}

        <section className="roster-panel">
          <div className="panel-title roster-title">
            <div><p className="eyebrow">Available network</p><h2>People and sensors nearby</h2></div>
            <span>{grapevine.state.sources.length} sources within 3 mi</span>
          </div>
          <SourceRoster
            sources={grapevine.state.sources}
            selectedSource={selectedSource}
            onLocate={selectSource}
            onRequest={openRequest}
          />
        </section>
      </main>

      {composerOpen && <div className="drawer-scrim" onMouseDown={() => setComposerOpen(false)}>
        <aside className="request-drawer" aria-label="Request source update" onMouseDown={(event) => event.stopPropagation()}>
          <div className="drawer-header">
            <div><p className="eyebrow">Source request</p><h2>Request an update</h2></div>
            <button className="icon-button close-button" type="button" aria-label="Close request panel" onClick={() => setComposerOpen(false)}>×</button>
          </div>
          {selectedSource && <div className="selected-source-summary">
            <span className={`source-symbol ${selectedSource.source_kind}`}>{selectedSource.source_kind === "system" ? <GaugeIcon /> : <UsersThreeIcon />}</span>
            <span><strong>{sourceDisplayName(selectedSource)}</strong><small>{verificationLabel(selectedSource)}</small></span>
          </div>}
          <div className="drawer-form">
            <label>Signal requested
              <select value={requestType} onChange={(event) => {
                const nextType = event.target.value as RequestType;
                setRequestType(nextType);
                setQuestion(defaultQuestions[nextType]);
              }}>
                {availableTypes.map((type) => <option key={type} value={type}>{requestLabel(type)}</option>)}
              </select>
            </label>
            <label>Question
              <textarea value={question} maxLength={240} onChange={(event) => setQuestion(event.target.value)} />
            </label>
            <button type="button" disabled={!selectedSource || busy} onClick={ask}>Prepare question</button>
            <p className="muted">Nothing is sent until you review and approve the request.</p>
          </div>
          <SessionPanel
            session={grapevine.activeSession}
            onApprove={(id) => void grapevine.actions.approveSession(id)}
          />
          {selectedSource?.source_kind === "human" && <a className="field-link" href={`/drive?source_id=${selectedSource.id}`}>Open field inbox for this responder</a>}
        </aside>
      </div>}
    </div>
  );
}

function Driver() {
  const grapevine = useGrapevine();
  const [name, setName] = useState("Miles Carter");
  const [handle, setHandle] = useState("miles828");
  const [channel, setChannel] = useState("Radio CH 3");
  const [place, setPlace] = useState("Watauga Relief Corridor");
  const [sourceId, setSourceId] = useState(
    () =>
      new URLSearchParams(window.location.search).get("source_id") ??
      localStorage.getItem("grapevine.logistics_source_id") ??
      ""
  );
  const [sessions, setSessions] = useState<Session[]>([]);
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [message, setMessage] = useState("Go online to receive field requests.");
  const seededSpot = useMemo(
    () => grapevine.state.spots.find((spot) => spot.is_seeded) ?? grapevine.state.spots[0],
    [grapevine.state.spots]
  );

  async function checkIn() {
    const source = await grapevine.actions.checkIn({
      source_id: sourceId || undefined,
      handle,
      display_name: name,
      channel_label: channel,
      place_id: seededSpot?.place_id ?? "demo-watauga-relief-corridor",
      location_name: place || seededSpot?.name || "Watauga Relief Corridor",
      address: seededSpot?.address,
      lat: seededSpot?.lat,
      lng: seededSpot?.lng,
      offered: ["route_status", "supply_access", "hazard_report"]
    });
    setSourceId(source.id);
    localStorage.setItem("grapevine.logistics_source_id", source.id);
    setMessage(`Online at ${source.location_name}.`);
  }

  function useGps() {
    if (!navigator.geolocation) {
      setMessage("GPS is not available in this browser.");
      return;
    }
    navigator.geolocation.getCurrentPosition(
      () => setMessage("Location verified. Go online when ready."),
      () => setMessage("GPS was unavailable. Use the operational area fallback.")
    );
  }

  async function refreshDriver() {
    const result = await grapevine.actions.loadDriver(sourceId);
    setSessions(result.sessions);
    if (result.source) {
      setName(result.source.display_name);
      setHandle(result.source.handle);
      setChannel(result.source.channel_label);
      setPlace(result.source.location_name);
    }
  }

  async function answer(session: Session, answerValue: string) {
    await grapevine.actions.submitAnswer(session.id, answerValue, notes[session.id] ?? "");
    setMessage("Field report submitted.");
    setNotes((current) => ({ ...current, [session.id]: "" }));
    await refreshDriver();
  }

  useEffect(() => {
    const timer = window.setInterval(() => void refreshDriver(), 2000);
    void refreshDriver();
    return () => window.clearInterval(timer);
  }, [sourceId]);

  return (
    <div className="dashboard-shell">
      <LogisticsSidebar active="drive" />
      <main className="dashboard-main driver-dashboard-main">
        <header className="operation-header driver-header">
          <div>
            <p className="eyebrow">Demo 1 · Human field source</p>
            <h1>Field Inbox</h1>
            <p className="deck">Receive and answer authorized operational questions.</p>
          </div>
          <span className="human-channel-label"><UsersThreeIcon weight="fill" /> Human responder</span>
        </header>
        <div className="phone-shell embedded">
          <div className="phone">
        <section className="phone-panel">
          <label>
            Name
            <input value={name} onChange={(event) => setName(event.target.value)} />
          </label>
          <label>
            Username / call sign
            <input value={handle} onChange={(event) => setHandle(event.target.value)} />
          </label>
          <label>
            Radio channel
            <input value={channel} onChange={(event) => setChannel(event.target.value)} />
          </label>
          <label>
            Operational area
            <input value={place} onChange={(event) => setPlace(event.target.value)} />
          </label>
          <div className="phone-actions">
            <button type="button" className="secondary-button" onClick={useGps}>
              <MapPinIcon /> Verify location
            </button>
            <button type="button" onClick={checkIn}>Go online</button>
          </div>
          <p className="muted">{message}</p>
          {sourceId && <p className="source-id">Connected as {name} · {handle} · {channel}</p>}
        </section>

        <section className="phone-panel">
          <div className="panel-heading">
            <h2>Field Requests</h2>
            <span className="request-count">{sessions.length}</span>
          </div>
          {sessions.length === 0 ? (
            <p className="muted empty-state">No authorized requests.</p>
          ) : (
            <div className="driver-list">
              {sessions.map((session) => (
                <div className="driver-request" key={session.id}>
                  <span className="answer-label">{requestLabel(session.request_type)}</span>
                  <strong>{session.question}</strong>
                  <textarea
                    value={notes[session.id] ?? ""}
                    onChange={(event) =>
                      setNotes((current) => ({
                        ...current,
                        [session.id]: event.target.value
                      }))
                    }
                    placeholder="Add an observation"
                  />
                  <div className="answer-chips">
                    {answerOptions[session.request_type].map((option) => (
                      <button
                        key={option}
                        type="button"
                        onClick={() => void answer(session, option)}
                      >
                        {option}
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
          </div>
        </div>
      </main>
    </div>
  );
}

export default function App() {
  const path = window.location.pathname;
  if (path.startsWith("/warehouse")) return <WarehouseApp />;
  if (path.startsWith("/response")) return <ResponseApp />;
  if (path === "/drive") return <Driver />;
  if (path === "/") return <Board />;

  return (
    <main className="not-found-page">
      <p className="eyebrow">Project Grapevine</p>
      <h1>Page not found</h1>
      <a href="/">Return to Operations Team</a>
    </main>
  );
}
