import {
  BuildingsIcon,
  CaretDownIcon,
  CheckCircleIcon,
  FacebookLogoIcon,
  HouseIcon,
  ListChecksIcon,
  MegaphoneIcon,
  PackageIcon,
  ShieldCheckIcon,
  WaveformIcon
} from "@phosphor-icons/react";
import { useEffect, useRef, useState } from "react";
import { useResponse } from "./useResponse";
import { useWarehouseWebMCPTools } from "./useWarehouseWebMCPTools";

function Sidebar({ toolCount }: { toolCount: number }) {
  return <aside className="app-sidebar">
    <div className="brand-block">
      <span className="brand-mark"><WaveformIcon weight="bold" /></span>
      <span><strong>Project Grapevine</strong><small>Relief intelligence</small></span>
    </div>
    <p className="nav-group-label">Demo 1 · Live ground truth</p>
    <nav className="primary-nav" aria-label="Live ground truth navigation">
      <a href="/"><HouseIcon /><span>Operations Team</span></a>
      <a href="/drive"><ListChecksIcon /><span>Field inbox</span></a>
    </nav>
    <p className="nav-group-label">Demo 2 · Resource coordination</p>
    <nav className="primary-nav" aria-label="Resource coordination navigation">
      <a href="/response"><BuildingsIcon /><span>Partner Directory</span></a>
      <a className="active" href="/warehouse"><PackageIcon weight="fill" /><span>Warehouse</span></a>
    </nav>
    <div className="sidebar-status">
      <p><ShieldCheckIcon weight="fill" /> {toolCount} warehouse tools ready</p>
    </div>
  </aside>;
}

export default function WarehouseApp() {
  const response = useResponse();
  const tools = useWarehouseWebMCPTools(response.actions);
  const [publishConfirm, setPublishConfirm] = useState(false);
  const [publishApproved, setPublishApproved] = useState(false);
  const [outreachOpen, setOutreachOpen] = useState(false);
  const seenDraftId = useRef<string | null | undefined>(undefined);
  const bundle = response.bundle;
  const latestDraft = bundle?.public_drafts[0] ?? null;

  useEffect(() => {
    if (!bundle) return;
    if (seenDraftId.current === undefined) {
      seenDraftId.current = latestDraft?.id ?? null;
      return;
    }
    if (latestDraft && latestDraft.id !== seenDraftId.current) {
      setOutreachOpen(true);
    }
    seenDraftId.current = latestDraft?.id ?? null;
  }, [bundle, latestDraft]);

  async function draftAppeal(itemId: string) {
    setPublishConfirm(false);
    setPublishApproved(false);
    await response.actions.draftSupplyAppeal(itemId);
    setOutreachOpen(true);
  }

  if (!bundle) return <div className="dashboard-shell"><Sidebar toolCount={tools.count} /><main className="dashboard-main"><p>Loading warehouse...</p></main></div>;

  return <div className="dashboard-shell response-shell">
    <Sidebar toolCount={tools.count} />
    <main className="dashboard-main response-main">
      <header className="operation-header response-header">
        <div><p className="eyebrow">Demo 2 · Supplies and public needs</p><h1>Warehouse</h1><p className="deck">Turn current inventory gaps into clear, reviewable public asks.</p></div>
        <span className="demo-badge"><PackageIcon weight="fill" /> Inventory connected</span>
      </header>
      {response.error && <p className="error" role="alert">{response.error}</p>}

      <section className="inventory-panel warehouse-page-panel">
        <div className="response-section-heading"><div><p className="eyebrow">Warehouse signals</p><h2>Supply gaps, not donation volume</h2></div><span>{bundle.inventory.filter((item) => item.status === "shortage").length} shortages</span></div>
        <div className="inventory-grid">
          {bundle.inventory.map((item) => <article key={item.id} className={`inventory-item ${item.status}`}>
            <div><strong>{item.item_name}</strong><span>{item.status}</span></div>
            <p>{item.field_signal}</p>
            <small>{item.on_hand} {item.unit} on hand · {item.requested} requested</small>
            {item.status === "shortage" && <button type="button" onClick={() => void draftAppeal(item.id)}><MegaphoneIcon /> Draft appeal</button>}
          </article>)}
        </div>
      </section>

      <section className={`outreach-panel ${outreachOpen ? "open" : ""}`}>
        <div className="outreach-header">
          <span className="outreach-mark"><MegaphoneIcon weight="fill" /></span>
          <span className="outreach-copy">
            <small>Communications tool</small>
            <strong>Supply outreach</strong>
            <span>Turn a verified shortage into a reviewable public request.</span>
          </span>
          <span className="outreach-state">{latestDraft ? "Draft ready" : "No draft"}</span>
          <button type="button" aria-expanded={outreachOpen} aria-label={`${outreachOpen ? "Close" : "Open"} supply outreach`} onClick={() => setOutreachOpen((current) => !current)}>
            <CaretDownIcon />
          </button>
        </div>
        {outreachOpen && <div className="outreach-body">
          {latestDraft ? <article className="appeal-draft">
          <header>
            <div><span>{publishApproved ? "Approved for publishing" : "Ready for review"}</span><h3>Public supply appeal</h3></div>
            <strong className="appeal-channel"><FacebookLogoIcon weight="fill" /> Facebook</strong>
          </header>
          <p>{latestDraft.copy}</p>
          <footer>
            {!publishConfirm && !publishApproved && <button type="button" onClick={() => setPublishConfirm(true)}><FacebookLogoIcon weight="fill" /> Publish to Facebook</button>}
            {publishConfirm && !publishApproved && <div className="publish-confirmation">
              <span><strong>Approve this Facebook post?</strong><small>Review the message before publishing.</small></span>
              <button type="button" className="secondary-button" onClick={() => setPublishConfirm(false)}>Cancel</button>
              <button type="button" onClick={() => { setPublishConfirm(false); setPublishApproved(true); }}>Confirm publish</button>
            </div>}
            {publishApproved && <div className="publish-approved"><CheckCircleIcon weight="fill" /><span><strong>Facebook post approved</strong><small>Ready for the communications team.</small></span></div>}
          </footer>
          </article> : <p className="outreach-empty">Choose a shortage above to draft a public supply request.</p>}
        </div>}
      </section>
    </main>
  </div>;
}
