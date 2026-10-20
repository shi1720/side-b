"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  ArrowUpRight,
  ArrowRight,
  AudioLines,
  Boxes,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  CircleHelp,
  Disc3,
  Download,
  ExternalLink,
  FileJson,
  Globe,
  LayoutDashboard,
  LoaderCircle,
  LogIn,
  Megaphone,
  Plus,
  Printer,
  Search,
  Settings2,
  ShieldCheck,
  Sparkles,
  Trash2,
  Upload,
  X,
} from "lucide-react";
import type {
  AgentRun,
  Constraints,
  EntityKind,
  InventoryItem,
  TasteEntity,
  Workspace,
} from "@/lib/types";
import { Brand, Sleeve, VinylArt } from "@/components/brand";
import { useModal } from "@/components/use-modal";
import { csvFields, parseCsv, toCsv } from "@/lib/csv";
import { clientApi as api } from "@/components/client-api";

type Tab = "studio" | "inventory" | "campaigns" | "about";
function download(name: string, text: string, type = "text/plain") {
  const a = document.createElement("a");
  const url = URL.createObjectURL(new Blob([text], { type }));
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
const defaultConstraints: Constraints = {
  count: 4,
  maxPrice: 40,
  minMargin: 0.3,
  minFit: 0.25,
  prioritizeAge: true,
};
export default function Home() {
  const [workspace, setWorkspace] = useState<Workspace | null>(null);
  const [tab, setTab] = useState<Tab>("studio");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState("");
  const [anchors, setAnchors] = useState<TasteEntity[]>([]);
  const [kind, setKind] = useState<EntityKind>("movie");
  const [query, setQuery] = useState("");
  const [matches, setMatches] = useState<TasteEntity[]>([]);
  const [searching, setSearching] = useState(false);
  const [searched, setSearched] = useState(false);
  const [constraints, setConstraints] = useState(defaultConstraints);
  const [run, setRun] = useState<AgentRun | null>(null);
  const [title, setTitle] = useState("");
  const [copy, setCopy] = useState("");
  const [published, setPublished] = useState("");
  const [editing, setEditing] = useState<InventoryItem | null>(null);
  const [shopName, setShopName] = useState("");
  const [pickup, setPickup] = useState("");
  const [settings, setSettings] = useState(false);
  const upload = useRef<HTMLInputElement>(null);
  const result = useRef<HTMLDivElement>(null);
  const searchSerial = useRef(0);
  const [originalSku, setOriginalSku] = useState<string | null>(null);
  useModal(!!editing || settings, () => {
    if (!busy) {
      setEditing(null);
      setSettings(false);
    }
  });
  const refresh = useCallback(async () => {
    const w = await api<Workspace>("/api/workspace");
    setWorkspace(w);
    setShopName(w.name);
    setPickup(
      (w as Workspace & { pickupInstructions?: string }).pickupInstructions ||
        "",
    );
    return w;
  }, []);
  useEffect(() => {
    let active = true;
    api<Workspace>("/api/workspace")
      .then((w) => {
        if (active) {
          setWorkspace(w);
          setShopName(w.name);
          setPickup(
            (w as Workspace & { pickupInstructions?: string })
              .pickupInstructions || "",
          );
        }
      })
      .catch((e) => {
        if (active) setError(e.message);
      });
    return () => {
      active = false;
    };
  }, []);
  const money = (n: number) =>
    new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: workspace?.currency || "USD",
      maximumFractionDigits: 2,
    }).format(n);
  async function perform(action: string, fn: () => Promise<void>) {
    setBusy(action);
    setError("");
    setNotice("");
    try {
      await fn();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Please try again.");
    } finally {
      setBusy("");
    }
  }
  async function search(q = query, k = kind) {
    if (q.trim().length < 2) return;
    const serial = ++searchSerial.current;
    setSearching(true);
    setSearched(false);
    setError("");
    try {
      const data = await api<{ entities: TasteEntity[] }>(
        `/api/search?q=${encodeURIComponent(q)}&kind=${k}`,
      );
      if (serial === searchSerial.current) {
        setMatches(data.entities);
        setSearched(true);
      }
    } catch (e) {
      if (serial === searchSerial.current)
        setError(e instanceof Error ? e.message : "Search failed.");
    } finally {
      if (serial === searchSerial.current) setSearching(false);
    }
  }
  function select(entity: TasteEntity) {
    if (anchors.some((a) => a.id === entity.id)) return;
    if (anchors.length >= 3) {
      setError("Choose up to three cultural anchors for a focused audience.");
      return;
    }
    if (!anchors.some((a) => a.id === entity.id))
      setAnchors([...anchors, entity]);
    setMatches([]);
    setQuery("");
    setSearched(false);
  }
  async function saveInventory(items: InventoryItem[]) {
    await api<{ inventory: InventoryItem[] }>("/api/inventory", "PUT", {
      items,
      sample: false,
    });
    await refresh();
    setRun(null);
    setPublished("");
    setNotice("Inventory saved. Your next edit will use this stock.");
  }
  async function runAgent() {
    if (
      !Number.isFinite(constraints.maxPrice) ||
      constraints.maxPrice < 1 ||
      constraints.maxPrice > 10000 ||
      constraints.minMargin < 0 ||
      constraints.minMargin > 0.95 ||
      constraints.minFit < 0 ||
      constraints.minFit > 1
    ) {
      setError(
        "Use a price between 1 and 10,000, a margin from 0 to 95%, and cultural rank fit from 0 to 100.",
      );
      return;
    }
    await perform("agent", async () => {
      const data = await api<AgentRun>("/api/agent", "POST", {
        anchors,
        constraints,
      });
      setRun(data);
      setTitle(data.title);
      setCopy(data.description);
      setPublished("");
      setTimeout(
        () =>
          result.current?.scrollIntoView({
            behavior: "smooth",
            block: "start",
          }),
        100,
      );
    });
  }
  return (
    <div className="app-shell">
      <a className="skip-link" href="#main-content">
        Skip to main content
      </a>
      <aside className="sidebar no-print">
        <Brand />
        <div className="sidebar-kicker">THE INDEPENDENT ADVANTAGE</div>
        <nav aria-label="Main navigation">
          {(
            [
              { id: "studio", label: "The studio", icon: LayoutDashboard },
              { id: "inventory", label: "Your inventory", icon: Boxes },
              { id: "campaigns", label: "Campaigns", icon: Megaphone },
              { id: "about", label: "How it works", icon: CircleHelp },
            ] as const
          ).map((item) => (
            <button
              key={item.id}
              className={tab === item.id ? "nav-active" : ""}
              aria-current={tab === item.id ? "page" : undefined}
              onClick={() => {
                setTab(item.id);
                setError("");
                setNotice("");
              }}
            >
              <item.icon size={18} />
              {item.label}
              {item.id === "studio" && <span className="nav-dot" />}
              {item.id === "campaigns" && !!workspace?.campaigns.length && (
                <small>{workspace.campaigns.length}</small>
              )}
            </button>
          ))}
          <button className="mobile-settings" onClick={() => setSettings(true)}>
            <Settings2 size={18} />
            Shop settings
          </button>
        </nav>
        <div className="sidebar-bottom">
          <div className="powered">
            <span className="tiny-disc" />
            <span>
              Culturally grounded.
              <br />
              <strong>Powered by Qloo.</strong>
            </span>
            <ArrowUpRight size={16} />
          </div>
          <button
            className="shop-switch"
            aria-label="Open shop settings"
            onClick={() => setSettings(true)}
          >
            <span className="shop-avatar">
              {workspace?.name.slice(0, 1) || "S"}
            </span>
            <span>
              <strong>{workspace?.name || "Opening your shop…"}</strong>
              <small>
                {workspace?.sample
                  ? "Sample shop · Try everything"
                  : workspace?.user
                    ? "Your shop workspace"
                    : "Private guest workspace"}
              </small>
            </span>
            <Settings2 size={15} />
          </button>
          {!workspace?.user && (
            <a className="sidebar-login" href="/signin" target="_top">
              <LogIn size={14} /> Sign in with Google
            </a>
          )}
        </div>
      </aside>
      <div className="main-shell">
        <header className="topbar no-print">
          <div className="breadcrumbs">
            Workspace <ChevronRight size={13} />
            <strong>
              {tab === "studio"
                ? "The studio"
                : tab === "inventory"
                  ? "Your inventory"
                  : tab === "campaigns"
                    ? "Campaigns"
                    : "How it works"}
            </strong>
          </div>
          <div className="topbar-right">
            <span className="api-badge">
              <i />
              Qloo taste intelligence
            </span>
            <span className="edition">FOR INDEPENDENT RECORD SHOPS</span>
            {!workspace?.user && (
              <a
                className="topbar-login"
                href="/signin"
                target="_top"
                title="Sign in with Google, opens a separate account workspace"
              >
                <LogIn size={13} />
                Sign in
              </a>
            )}
          </div>
        </header>
        <main id="main-content" tabIndex={-1}>
          {error && (
            <div className="alert alert-error no-print" role="alert">
              <CircleHelp size={18} />
              <span>{error}</span>
              <button aria-label="Dismiss error" onClick={() => setError("")}>
                <X size={16} />
              </button>
            </div>
          )}
          {notice && (
            <div className="alert alert-success no-print" role="status">
              <CheckCircle2 size={18} />
              <span>{notice}</span>
              <button
                aria-label="Dismiss notification"
                onClick={() => setNotice("")}
              >
                <X size={16} />
              </button>
            </div>
          )}
          {workspace && !workspace.user && (
            <div className="guest-workspace-note no-print">
              <ShieldCheck size={13} />
              <span>
                Guest workspace. Google sign-in opens a separate account; guest
                data does not transfer. Download inventory and receipts to keep
                this work.
              </span>
            </div>
          )}
          {!workspace ? (
            <div className="loading-state" role="status" aria-live="polite">
              <Disc3 className="spin" size={40} />
              <h1>
                {error ? "The shop couldn’t open yet." : "Opening the shop."}
              </h1>
              <p>
                {error
                  ? "Your connection or the service may be unavailable. Please try again."
                  : "Preparing your private workspace and sample stock."}
              </p>
              {error && (
                <button
                  className="button primary"
                  disabled={!!busy}
                  onClick={() =>
                    perform("retry", async () => {
                      await refresh();
                    })
                  }
                >
                  Try again
                </button>
              )}
            </div>
          ) : (
            <>
              {tab === "studio" && (
                <>
                  <section className="hero no-print">
                    <div className="hero-copy">
                      <div className="eyebrow">
                        <span />
                        YOUR STOCK. THEIR NEXT OBSESSION.
                      </div>
                      <h1>
                        Your next bestseller
                        <br />
                        is already <em>on the shelf.</em>
                      </h1>
                      <p>
                        Turn what your customers love into records they’ll love
                        next. Meet the merchandising agent with a taste for
                        independent shops.
                      </p>
                      <div className="hero-proof">
                        <span>
                          <Check size={14} />
                          Real Qloo connections
                        </span>
                        <span>
                          <Check size={14} />
                          Only your actual stock
                        </span>
                        <span>
                          <Check size={14} />
                          Your margins protected
                        </span>
                      </div>
                    </div>
                    <VinylArt />
                  </section>
                  <div className="section-heading no-print">
                    <div>
                      <span className="eyebrow">FROM CULTURE TO COUNTER</span>
                      <h2>Let’s make a little discovery happen.</h2>
                    </div>
                    <span className="subtle-label">
                      A HUMAN IDEA. AN AGENT’S LEGWORK.
                    </span>
                  </div>
                  <section
                    className="workbench no-print"
                    aria-label="Build a shop edit"
                    aria-busy={busy === "agent"}
                  >
                    <div className="audience-panel">
                      <div className="step-label">
                        <span>01</span> Start with their world
                      </div>
                      <h3>Who’s walking through the door?</h3>
                      <p className="muted">
                        A film they rewatch. A book they won’t stop talking
                        about. An artist they love. Give your agent a cultural
                        starting point.
                      </p>
                      <div className="anchor-chips">
                        {anchors.map((a) => (
                          <div className="anchor-chip" key={a.id}>
                            <span>
                              {a.kind === "movie"
                                ? "FILM"
                                : a.kind === "tv_show"
                                  ? "TV"
                                  : a.kind.toUpperCase()}
                            </span>
                            {a.name}
                            <button
                              aria-label={`Remove ${a.name}`}
                              onClick={() =>
                                setAnchors(anchors.filter((x) => x.id !== a.id))
                              }
                            >
                              <X size={13} />
                            </button>
                          </div>
                        ))}
                      </div>
                      <form
                        className="search-form"
                        onSubmit={(e) => {
                          e.preventDefault();
                          search();
                        }}
                      >
                        <div className="search-type">
                          <select
                            aria-label="Cultural anchor category"
                            value={kind}
                            onChange={(e) => {
                              searchSerial.current++;
                              setSearching(false);
                              setKind(e.target.value as EntityKind);
                              setMatches([]);
                              setSearched(false);
                            }}
                          >
                            <option value="movie">Film</option>
                            <option value="artist">Music</option>
                            <option value="book">Book</option>
                            <option value="tv_show">TV</option>
                          </select>
                          <ChevronDown size={13} />
                        </div>
                        <input
                          aria-label="Find a cultural anchor"
                          value={query}
                          onChange={(e) => {
                            searchSerial.current++;
                            setSearching(false);
                            setMatches([]);
                            setQuery(e.target.value);
                            setSearched(false);
                          }}
                          placeholder={
                            kind === "movie"
                              ? "Search a film, e.g. Moonrise Kingdom…"
                              : kind === "artist"
                                ? "Search an artist, e.g. Khruangbin…"
                                : kind === "book"
                                  ? "Search a book, e.g. Norwegian Wood…"
                                  : "Search a TV show…"
                          }
                        />
                        <button
                          type="submit"
                          aria-label="Search Qloo"
                          disabled={searching || query.trim().length < 2}
                        >
                          {searching ? (
                            <LoaderCircle className="spin" size={18} />
                          ) : (
                            <Search size={18} />
                          )}
                        </button>
                      </form>
                      <span className="sr-only" role="status">
                        {searching
                          ? "Searching Qloo."
                          : searched
                            ? `${matches.length} matching results. Select a result to add it to the audience.`
                            : ""}
                      </span>
                      {(matches.length > 0 || searched) && (
                        <div
                          className="search-results"
                          role="region"
                          aria-label="Qloo search results"
                        >
                          {matches.length ? (
                            matches.map((entity) => (
                              <button
                                key={entity.id}
                                onClick={() => select(entity)}
                              >
                                <span>
                                  <strong>{entity.name}</strong>
                                  <small>
                                    {entity.disambiguation ||
                                      entity.description ||
                                      entity.kind}
                                  </small>
                                </span>
                                <Plus size={16} />
                              </button>
                            ))
                          ) : (
                            <p>No matches. Try another title or category.</p>
                          )}
                        </div>
                      )}
                      <div className="try-label">
                        NEED A STARTING POINT? TRY A SEARCH
                      </div>
                      <div className="preset-row">
                        {[
                          {
                            name: "The Past Lives crowd",
                            q: "Past Lives",
                            k: "movie",
                          },
                          {
                            name: "The Khruangbin crowd",
                            q: "Khruangbin",
                            k: "artist",
                          },
                          {
                            name: "A world of Spirited Away",
                            q: "Spirited Away",
                            k: "movie",
                          },
                        ].map((p) => (
                          <button
                            key={p.name}
                            onClick={() => {
                              setQuery(p.q);
                              setKind(p.k as EntityKind);
                              search(p.q, p.k as EntityKind);
                            }}
                          >
                            {p.name}
                            <ArrowUpRight size={13} />
                          </button>
                        ))}
                      </div>
                      <div className="source-note">
                        <ShieldCheck size={15} />
                        <span>
                          Choose an exact Qloo match. Every recommendation keeps
                          its evidence.
                        </span>
                      </div>
                    </div>
                    <div className="constraints-panel">
                      <div className="step-label">
                        <span>02</span> Make it work for the shop
                      </div>
                      <div className="constraint-grid">
                        <label>
                          Records in the edit
                          <select
                            value={constraints.count}
                            onChange={(e) =>
                              setConstraints({
                                ...constraints,
                                count: Number(e.target.value),
                              })
                            }
                          >
                            {[3, 4, 5, 6, 8].map((n) => (
                              <option key={n} value={n}>
                                {n} records
                              </option>
                            ))}
                          </select>
                        </label>
                        <label>
                          Max price per record ({workspace.currency})
                          <input
                            type="number"
                            min="1"
                            max="10000"
                            value={constraints.maxPrice}
                            onChange={(e) =>
                              setConstraints({
                                ...constraints,
                                maxPrice: Number(e.target.value),
                              })
                            }
                          />
                        </label>
                        <label>
                          Min. gross margin
                          <span className="input-suffix">
                            <input
                              type="number"
                              min="0"
                              max="95"
                              value={Math.round(constraints.minMargin * 100)}
                              onChange={(e) =>
                                setConstraints({
                                  ...constraints,
                                  minMargin: Number(e.target.value) / 100,
                                })
                              }
                            />
                            <span>%</span>
                          </span>
                        </label>
                        <label>
                          Min. cultural rank fit
                          <span className="input-suffix">
                            <input
                              type="number"
                              min="0"
                              max="100"
                              value={Math.round(constraints.minFit * 100)}
                              onChange={(e) =>
                                setConstraints({
                                  ...constraints,
                                  minFit: Number(e.target.value) / 100,
                                })
                              }
                            />
                            <span>/ 100</span>
                          </span>
                        </label>
                      </div>
                      <label className="toggle-label">
                        <input
                          type="checkbox"
                          checked={constraints.prioritizeAge}
                          onChange={(e) =>
                            setConstraints({
                              ...constraints,
                              prioritizeAge: e.target.checked,
                            })
                          }
                        />
                        <span>
                          <strong>Give older stock a second spin</strong>
                          <small>
                            Prioritize shelf age within taste and margin limits.
                          </small>
                        </span>
                      </label>
                      <div className="stock-availability">
                        <span>
                          <Boxes size={14} />
                          {
                            workspace.inventory.filter((i) => i.quantity > 0)
                              .length
                          }{" "}
                          in-stock titles
                        </span>
                        <button onClick={() => setTab("inventory")}>
                          View stock
                          <ArrowRight size={12} />
                        </button>
                      </div>
                      <button
                        className="button primary run-button"
                        disabled={
                          !anchors.length ||
                          !!busy ||
                          !workspace.inventory.length
                        }
                        onClick={runAgent}
                      >
                        {busy === "agent" ? (
                          <>
                            <LoaderCircle className="spin" size={18} />
                            Finding the connections…
                          </>
                        ) : (
                          <>
                            <Sparkles size={17} />
                            Build my shop edit
                            <ArrowUpRight size={18} />
                          </>
                        )}
                      </button>
                      <p className="run-note" role="status">
                        {busy === "agent"
                          ? "Resolving your stock, querying Qloo and checking every constraint. This may take a minute."
                          : !anchors.length
                            ? "Select a cultural anchor to get the records spinning."
                            : "Live taste graph. Real inventory. An auditable decision."}
                      </p>
                    </div>
                  </section>
                  {!run && (
                    <div className="below-workbench no-print">
                      <div>
                        <span className="orange-spark">✳</span>
                        <strong>The connection is the point.</strong>
                        <p>
                          “People who love this film might love this record,”
                          with Qloo evidence, stock checks, and a reason to
                          believe it.
                        </p>
                      </div>
                      <div>
                        <span className="sample-tag">
                          {workspace.sample ? "SAMPLE SHOP" : "YOUR WORKSPACE"}
                        </span>
                        <p>
                          {workspace.sample
                            ? "Real artists. Illustrative stock and pricing. A real Qloo-powered workflow."
                            : "Your private stock and commercial constraints. Public only when you publish an edit."}
                        </p>
                      </div>
                    </div>
                  )}
                  {run && (
                    <div ref={result} className="results-section">
                      <div className="section-heading">
                        <div>
                          <span className="eyebrow">03 / THE AGENT’S EDIT</span>
                          <h2>A new way into the record rack.</h2>
                        </div>
                        <span className="live-pill">
                          <i />
                          Live Qloo result
                        </span>
                      </div>
                      {run.warnings.map((w, i) => (
                        <div className="alert alert-warning" key={i}>
                          <CircleHelp size={16} />
                          {w}
                        </div>
                      ))}
                      <div className="results-layout">
                        <div>
                          <div className="results-title">
                            <h3>{run.title}</h3>
                            <p>{run.description}</p>
                            <div className="result-anchors">
                              {run.anchors.map((a) => (
                                <span key={a.id}>
                                  {a.kind.replaceAll("_", " ")} / {a.name}
                                </span>
                              ))}
                            </div>
                          </div>
                          <div className="record-grid">
                            {run.selected.map((item, i) => (
                              <article className="record-card" key={item.sku}>
                                <Sleeve
                                  artist={item.artist}
                                  title={item.title}
                                  color={item.color}
                                  index={i}
                                />
                                <div className="record-info">
                                  <span className="record-genre">
                                    {item.genre} · {item.quantity} available
                                  </span>
                                  <h4>{item.title}</h4>
                                  <p>{item.artist}</p>
                                  <div className="record-meta">
                                    <strong>{money(item.price)}</strong>
                                    <span>
                                      {Math.round(item.fit * 100)}{" "}
                                      <small>rank fit</small>
                                    </span>
                                  </div>
                                  <details className="evidence">
                                    <summary>
                                      Why this record <ChevronDown size={14} />
                                    </summary>
                                    <p>
                                      Qloo connects the audience anchors to this
                                      artist. Rank fit is relative position
                                      within the stocked artist pool, not a
                                      probability of purchase. Missing Qloo
                                      affinities score zero.
                                    </p>
                                    {item.evidence.map((e) => (
                                      <div key={e.anchorId}>
                                        <strong>{e.anchorName}</strong>
                                        <span>
                                          Artist rank {e.rank} of {e.poolSize} ·{" "}
                                          {Math.round(e.rankFit * 100)} rank fit
                                        </span>
                                        {e.contribution !== undefined && (
                                          <span>
                                            Qloo joint-input contribution{" "}
                                            {Math.round(e.contribution * 100)}
                                            /100 (relative influence, not
                                            purchase probability)
                                          </span>
                                        )}
                                        <small>
                                          {e.cached
                                            ? "Cached Qloo response"
                                            : "Qloo response"}{" "}
                                          ·{" "}
                                          {new Date(
                                            e.fetchedAt,
                                          ).toLocaleString()}
                                        </small>
                                      </div>
                                    ))}
                                    <p>
                                      Gross margin{" "}
                                      {Math.round(item.margin * 100)}% ·{" "}
                                      {item.daysOnShelf} days on shelf
                                    </p>
                                  </details>
                                </div>
                              </article>
                            ))}
                          </div>
                          {!run.selected.length && (
                            <div className="empty-state">
                              <Disc3 size={32} />
                              <h3>No stock clears the whole brief.</h3>
                              <p>
                                Try a different anchor, lower the rank fit
                                threshold, or review your price and margin
                                limits. The agent won’t invent a match.
                              </p>
                            </div>
                          )}
                          <details className="audit-panel">
                            <summary>
                              <AudioLines size={17} />
                              See the agent’s decision trail
                              <span>
                                {run.steps.length} steps
                                <ChevronDown size={15} />
                              </span>
                            </summary>
                            <ol className="trace">
                              {run.steps.map((s, i) => (
                                <li key={i}>
                                  <span
                                    className={
                                      s.status === "warning"
                                        ? "trace-warning"
                                        : ""
                                    }
                                  >
                                    {s.status === "done" ? (
                                      <Check size={13} />
                                    ) : (
                                      <CircleHelp size={13} />
                                    )}
                                  </span>
                                  <div>
                                    <strong>
                                      {s.tool.replaceAll("_", " ")}
                                    </strong>
                                    <p>{s.detail}</p>
                                  </div>
                                  {s.durationMs != null && (
                                    <small>{s.durationMs}ms</small>
                                  )}
                                </li>
                              ))}
                            </ol>
                            <p className="small-muted">
                              Run {run.id} · {run.calls} uncached Qloo queries ·{" "}
                              {new Date(run.createdAt).toLocaleString()}
                            </p>
                          </details>
                          <details className="audit-panel">
                            <summary>
                              <Boxes size={17} />
                              Stock that didn’t make the cut
                              <span>
                                {run.items.filter((i) => !i.selected).length}{" "}
                                titles
                                <ChevronDown size={15} />
                              </span>
                            </summary>
                            <div className="rejected-list">
                              {run.items
                                .filter((i) => !i.selected)
                                .map((i) => (
                                  <div key={i.sku}>
                                    <span>
                                      <strong>{i.artist}</strong>
                                      <small>{i.title}</small>
                                    </span>
                                    <span>
                                      {i.exclusion ||
                                        "Lower overall objective than the selected edit"}
                                    </span>
                                  </div>
                                ))}
                            </div>
                          </details>
                        </div>
                        <aside className="results-sidebar">
                          <div className="economics-card">
                            <span className="eyebrow">
                              A SMALL EDIT. A CLEAR BUSINESS CASE.
                            </span>
                            <h3>If one of each sells.</h3>
                            <div className="economics-big">
                              {money(run.economics.contribution)}
                              <span>gross profit scenario</span>
                            </div>
                            <dl>
                              <div>
                                <dt>Retail value</dt>
                                <dd>{money(run.economics.retail)}</dd>
                              </div>
                              <div>
                                <dt>Cost of records</dt>
                                <dd>{money(run.economics.cost)}</dd>
                              </div>
                              <div>
                                <dt>Gross margin</dt>
                                <dd>
                                  {Math.round(run.economics.margin * 100)}%
                                </dd>
                              </div>
                              <div>
                                <dt>Older-stock selections</dt>
                                <dd>{run.economics.agedUnits}</dd>
                              </div>
                            </dl>
                            <p>
                              One unit of each selected record. A scenario, not
                              a sales forecast. Excludes tax, fees and overhead.
                            </p>
                          </div>
                          <div className="comparison-card">
                            <span className="eyebrow">
                              WHY TASTE CHANGES THE ANSWER
                            </span>
                            <h3>The spreadsheet misses the connection.</h3>
                            <p>
                              Only{" "}
                              <strong>
                                {run.baseline.culturalOverlap} of{" "}
                                {run.selected.length}
                              </strong>{" "}
                              picks overlap with the oldest-stock baseline.
                            </p>
                            <details>
                              <summary>
                                Compare the alternatives
                                <ChevronDown size={14} />
                              </summary>
                              <small>Oldest-stock SKUs</small>
                              <p>{run.baseline.oldest.join(" · ") || "None"}</p>
                              <small>Highest-margin SKUs</small>
                              <p>{run.baseline.margin.join(" · ") || "None"}</p>
                            </details>
                            <p className="small-muted">
                              These baselines use stock age or margin. They do
                              not use cultural evidence.
                            </p>
                          </div>
                        </aside>
                      </div>
                      {!!run.selected.length && (
                        <section className="publish-panel no-print">
                          <div>
                            <span className="eyebrow">
                              04 / TAKE IT TO THE COUNTER
                            </span>
                            <h3>Make the edit yours. Then share it.</h3>
                            <p>
                              Publish a customer-facing page with live stock and
                              free pickup holds.
                            </p>
                            <label>
                              Edit title
                              <input
                                value={title}
                                maxLength={120}
                                onChange={(e) => setTitle(e.target.value)}
                              />
                            </label>
                            <label>
                              The story
                              <textarea
                                value={copy}
                                maxLength={2000}
                                rows={3}
                                onChange={(e) => setCopy(e.target.value)}
                              />
                            </label>
                          </div>
                          <div className="publish-actions">
                            <div className="publish-note">
                              <Globe size={24} />
                              <strong>
                                From a cultural connection
                                <br />
                                to a customer at the counter.
                              </strong>
                              <p>
                                Customers reserve a record for 48 hours. You
                                mark it collected. No payment is taken in Side
                                B.
                              </p>
                            </div>
                            <button
                              className="button primary"
                              disabled={
                                !!busy ||
                                !title.trim() ||
                                (!workspace.sample &&
                                  !(
                                    (
                                      workspace as Workspace & {
                                        pickupInstructions?: string;
                                      }
                                    ).pickupInstructions || ""
                                  ).trim())
                              }
                              onClick={() =>
                                perform("publish", async () => {
                                  const d = await api<{ url: string }>(
                                    "/api/campaigns",
                                    "POST",
                                    { runId: run.id, title, description: copy },
                                  );
                                  setPublished(d.url);
                                  await refresh();
                                  setNotice(
                                    "Your edit is live. Share the link with your customers.",
                                  );
                                })
                              }
                            >
                              {busy === "publish" ? (
                                <LoaderCircle className="spin" size={17} />
                              ) : (
                                <Globe size={17} />
                              )}
                              Publish shop edit
                              <ArrowUpRight size={17} />
                            </button>
                            {!workspace.sample &&
                              !(
                                (
                                  workspace as Workspace & {
                                    pickupInstructions?: string;
                                  }
                                ).pickupInstructions || ""
                              ).trim() && (
                                <button
                                  className="pickup-needed"
                                  onClick={() => setSettings(true)}
                                >
                                  Add your shop’s pickup details before
                                  publishing
                                  <ArrowRight size={13} />
                                </button>
                              )}
                            {published && (
                              <div className="published-link">
                                <a
                                  href={published}
                                  target="_blank"
                                  rel="noreferrer"
                                >
                                  Open live shop edit
                                  <ExternalLink size={14} />
                                </a>
                                <button
                                  onClick={() => {
                                    navigator.clipboard
                                      .writeText(
                                        new URL(published, location.origin)
                                          .href,
                                      )
                                      .then(() =>
                                        setNotice("Campaign link copied."),
                                      )
                                      .catch(() =>
                                        setError(
                                          "Copy the URL from the open campaign page.",
                                        ),
                                      );
                                  }}
                                >
                                  Copy link
                                </button>
                              </div>
                            )}
                            <div className="secondary-actions">
                              <button
                                className="button secondary"
                                onClick={() => window.print()}
                              >
                                <Printer size={15} />
                                Shelf cards
                              </button>
                              <button
                                className="button secondary"
                                onClick={() =>
                                  download(
                                    `side-b-${run.id}.json`,
                                    JSON.stringify(run, null, 2),
                                    "application/json",
                                  )
                                }
                              >
                                <FileJson size={15} />
                                Receipt
                              </button>
                            </div>
                          </div>
                        </section>
                      )}
                    </div>
                  )}
                  <div className="studio-footnote no-print">
                    <span>MADE FOR INDEPENDENTS. BUILT BY SHIVAM GUPTA.</span>
                    <span>CULTURE IS THE CONNECTION. QLOO IS THE PROOF.</span>
                  </div>
                </>
              )}
              {tab === "inventory" && (
                <section className="page-section">
                  <div className="page-heading">
                    <span className="eyebrow">
                      THE RECORDS BEHIND THE RECOMMENDATIONS
                    </span>
                    <h1>Your shelf. Your rules.</h1>
                    <p>
                      Great recommendations start with what you can actually
                      sell.
                    </p>
                  </div>
                  <div className="inventory-summary">
                    <div>
                      <span>{workspace.inventory.length}</span>
                      <small>titles on the shelf</small>
                    </div>
                    <div>
                      <span>
                        {workspace.inventory.reduce(
                          (s, i) => s + i.quantity,
                          0,
                        )}
                      </span>
                      <small>available records</small>
                    </div>
                    <div>
                      <span>
                        {money(
                          workspace.inventory.reduce(
                            (s, i) => s + i.price * i.quantity,
                            0,
                          ),
                        )}
                      </span>
                      <small>retail stock value</small>
                    </div>
                    <div>
                      <span>
                        {
                          workspace.inventory.filter((i) => i.daysOnShelf >= 90)
                            .length
                        }
                      </span>
                      <small>titles aged 90+ days</small>
                    </div>
                  </div>
                  <div className="table-toolbar">
                    <div>
                      <strong>{workspace.name}</strong>
                      <span className="sample-tag">
                        {workspace.sample
                          ? "SAMPLE INVENTORY"
                          : "YOUR INVENTORY"}
                      </span>
                    </div>
                    <div>
                      <button
                        className="button secondary"
                        onClick={() =>
                          download(
                            "side-b-inventory.csv",
                            toCsv(workspace.inventory),
                            "text/csv",
                          )
                        }
                      >
                        <Download size={15} />
                        Download CSV
                      </button>
                      <button
                        className="button secondary"
                        disabled={!!busy}
                        onClick={() => upload.current?.click()}
                      >
                        <Upload size={15} />
                        Import CSV
                      </button>
                      <button
                        className="button primary"
                        onClick={() => {
                          setOriginalSku(null);
                          setError("");
                          setEditing({
                            sku: "",
                            artist: "",
                            title: "",
                            price: 25,
                            cost: 15,
                            quantity: 1,
                            daysOnShelf: 0,
                            genre: "",
                          });
                        }}
                        disabled={workspace.inventory.length >= 50}
                      >
                        <Plus size={16} />
                        Add record
                      </button>
                    </div>
                  </div>
                  <input
                    type="file"
                    accept=".csv,text/csv"
                    hidden
                    ref={upload}
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file)
                        perform("inventory", async () => {
                          if (file.size > 100000)
                            throw new Error(
                              "CSV file must be smaller than 100 KB.",
                            );
                          await saveInventory(parseCsv(await file.text()));
                        });
                      e.target.value = "";
                    }}
                  />
                  <div
                    className="table-container"
                    tabIndex={0}
                    role="region"
                    aria-label="Inventory records, scroll horizontally for all columns"
                  >
                    <table>
                      <caption className="sr-only">
                        Your available stock, prices, margins and shelf age
                      </caption>
                      <thead>
                        <tr>
                          <th>Record / artist</th>
                          <th>Genre</th>
                          <th>Retail</th>
                          <th>Cost</th>
                          <th>Margin</th>
                          <th>Available</th>
                          <th>On shelf</th>
                          <th>
                            <span className="sr-only">Edit</span>
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {workspace.inventory.map((i, n) => (
                          <tr key={i.sku}>
                            <td>
                              <div className="inventory-record">
                                <Sleeve
                                  artist={i.artist}
                                  title={i.title}
                                  color={i.color}
                                  index={n}
                                />
                                <span>
                                  <strong>{i.title}</strong>
                                  <small>
                                    {i.artist} · {i.sku}
                                  </small>
                                </span>
                              </div>
                            </td>
                            <td>{i.genre}</td>
                            <td>{money(i.price)}</td>
                            <td>{money(i.cost)}</td>
                            <td>
                              {i.price
                                ? Math.round(
                                    ((i.price - i.cost) / i.price) * 100,
                                  )
                                : 0}
                              %
                            </td>
                            <td>
                              <span className={!i.quantity ? "stock-out" : ""}>
                                {i.quantity}
                              </span>
                            </td>
                            <td>
                              <span
                                className={
                                  i.daysOnShelf >= 90 ? "aged-stock" : ""
                                }
                              >
                                {i.daysOnShelf}d
                              </span>
                            </td>
                            <td>
                              <button
                                className="text-button"
                                aria-label={`Edit ${i.title} by ${i.artist}`}
                                onClick={() => {
                                  setOriginalSku(i.sku);
                                  setError("");
                                  setEditing({ ...i });
                                }}
                              >
                                Edit
                                <ArrowUpRight size={12} />
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    {!workspace.inventory.length && (
                      <div className="empty-state">
                        <Boxes size={28} />
                        <h3>The racks are ready.</h3>
                        <p>Add a record or upload your stock to get started.</p>
                      </div>
                    )}
                  </div>
                  <div className="inventory-guidance">
                    <div>
                      <h3>Your data stays backstage.</h3>
                      <p>
                        Cost prices and gross margins are private. Published
                        campaigns show customers retail prices and available
                        units only.
                      </p>
                    </div>
                    <div>
                      <h3>One simple CSV. Up to 50 titles.</h3>
                      <p>
                        Required columns: <code>{csvFields.join(", ")}</code>.
                        Prices use {workspace.currency}; quantities and shelf
                        days are whole numbers. Download the current inventory
                        for a ready-to-edit template. Import replaces all stock
                        and is blocked while active holds exist.
                      </p>
                    </div>
                  </div>
                </section>
              )}
              {tab === "campaigns" && (
                <section className="page-section">
                  <div className="page-heading">
                    <span className="eyebrow">
                      CULTURAL CONNECTIONS, OUT IN THE WORLD
                    </span>
                    <h1>Keep the good records moving.</h1>
                    <p>
                      Your shop edits and the customers coming to collect them.
                    </p>
                  </div>
                  {!workspace.campaigns.length ? (
                    <div className="empty-state large-empty">
                      <Megaphone size={36} />
                      <h2>Your first edit starts a conversation.</h2>
                      <p>
                        Build a Qloo-grounded shop edit in the studio, then
                        publish it here.
                      </p>
                      <button
                        className="button primary"
                        onClick={() => setTab("studio")}
                      >
                        Go to the studio
                        <ArrowRight size={16} />
                      </button>
                    </div>
                  ) : (
                    <>
                      <div className="campaign-grid">
                        {workspace.campaigns.map((c) => (
                          <article className="campaign-card" key={c.id}>
                            <span
                              className={`live-pill ${c.published ? "" : "paused-pill"}`}
                            >
                              <i />
                              {c.published ? "Published" : "Paused"}
                            </span>
                            <h2>{c.title}</h2>
                            <p>{c.description}</p>
                            <div className="campaign-sleeves">
                              {c.run.selected.slice(0, 4).map((i, n) => (
                                <Sleeve
                                  key={i.sku}
                                  artist={i.artist}
                                  title={i.title}
                                  color={i.color}
                                  index={n}
                                />
                              ))}
                            </div>
                            <div className="campaign-bottom">
                              <span>
                                {new Date(c.createdAt).toLocaleDateString()} ·{" "}
                                {c.run.selected.length} records
                              </span>
                              {c.published && (
                                <a
                                  href={`/c/${c.id}`}
                                  target="_blank"
                                  rel="noreferrer"
                                >
                                  View shop edit
                                  <ArrowUpRight size={15} />
                                </a>
                              )}
                            </div>
                            <div className="campaign-controls">
                              <button
                                className="button secondary"
                                disabled={!!busy}
                                onClick={() =>
                                  perform("campaign", async () => {
                                    await api(
                                      `/api/campaigns/${c.id}`,
                                      "PATCH",
                                      { published: !c.published },
                                    );
                                    await refresh();
                                    setNotice(
                                      c.published
                                        ? "Collection paused. Existing pickup holds remain available to manage below."
                                        : "Collection resumed. Your public shop edit can accept new holds.",
                                    );
                                  })
                                }
                              >
                                {busy === "campaign" ? (
                                  <LoaderCircle className="spin" size={14} />
                                ) : (
                                  <Globe size={14} />
                                )}
                                {c.published
                                  ? "Pause public collection"
                                  : "Resume public collection"}
                              </button>
                              {!c.published && (
                                <small>
                                  Public page hidden. Existing holds remain
                                  active.
                                </small>
                              )}
                            </div>
                          </article>
                        ))}
                      </div>
                      <div className="section-heading">
                        <div>
                          <span className="eyebrow">
                            FROM DISCOVERY TO THE COUNTER
                          </span>
                          <h2>Pickup holds</h2>
                        </div>
                        <button
                          className="button secondary"
                          disabled={!!busy}
                          onClick={() =>
                            perform("refresh", async () => {
                              await refresh();
                              setNotice("Holds refreshed.");
                            })
                          }
                        >
                          Refresh
                        </button>
                      </div>
                      <div
                        className="table-container"
                        tabIndex={0}
                        role="region"
                        aria-label="Pickup holds, scroll horizontally for all columns"
                      >
                        <table>
                          <caption className="sr-only">
                            Customer pickup holds and collection actions
                          </caption>
                          <thead>
                            <tr>
                              <th>Customer / reference</th>
                              <th>Record</th>
                              <th>Created</th>
                              <th>Status</th>
                              <th>Action</th>
                            </tr>
                          </thead>
                          <tbody>
                            {workspace.reservations.map((r) => (
                              <tr key={r.id}>
                                <td>
                                  <strong>{r.customerName}</strong>
                                  <small className="block-muted">
                                    {r.reference}
                                  </small>
                                </td>
                                <td>{r.itemTitle}</td>
                                <td>
                                  {new Date(r.createdAt).toLocaleString()}
                                </td>
                                <td>
                                  <span
                                    className={`status-tag status-${r.status}`}
                                  >
                                    {r.status}
                                  </span>
                                </td>
                                <td>
                                  {r.status === "held" ? (
                                    <div className="row-actions">
                                      <button
                                        className="text-button"
                                        aria-label={`Mark hold ${r.reference} collected`}
                                        disabled={!!busy}
                                        onClick={() =>
                                          perform("reservation", async () => {
                                            await api(
                                              `/api/reservations/${r.id}`,
                                              "PATCH",
                                              { status: "collected" },
                                            );
                                            await refresh();
                                            setNotice(
                                              "Marked collected. The record is off to a good home.",
                                            );
                                          })
                                        }
                                      >
                                        <Check size={14} />
                                        Collected
                                      </button>
                                      <button
                                        className="text-button danger"
                                        aria-label={`Cancel hold ${r.reference} and restore stock`}
                                        disabled={!!busy}
                                        onClick={() =>
                                          perform("reservation", async () => {
                                            await api(
                                              `/api/reservations/${r.id}`,
                                              "PATCH",
                                              { status: "cancelled" },
                                            );
                                            await refresh();
                                            setNotice(
                                              "Hold cancelled and stock restored.",
                                            );
                                          })
                                        }
                                      >
                                        Cancel
                                      </button>
                                    </div>
                                  ) : (
                                    <span className="muted">Complete</span>
                                  )}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                        {!workspace.reservations.length && (
                          <div className="empty-state">
                            <p>
                              No pickup holds yet. Share a campaign link to get
                              started.
                            </p>
                          </div>
                        )}
                      </div>
                      <p className="small-muted">
                        Holds reserve one available unit immediately. Cancelling
                        restores it once. Holds expire after 48 hours and stock
                        is restored. No automatic email or reminders. Payment
                        and collection happen in your shop.
                      </p>
                    </>
                  )}
                </section>
              )}
              {tab === "about" && (
                <section className="page-section about-page">
                  <div className="page-heading">
                    <span className="eyebrow">THE INDEPENDENT ADVANTAGE</span>
                    <h1>
                      A record shop has taste.
                      <br />
                      <em>Now its tools do, too.</em>
                    </h1>
                    <p>
                      The best record shops connect people to something they
                      didn’t know they were looking for. Side B gives that
                      intuition a cultural graph and a practical workflow.
                    </p>
                  </div>
                  <div className="about-steps">
                    {[
                      {
                        n: "01",
                        title: "Start beyond the genre.",
                        text: "A customer’s favorite film, book, TV show or artist becomes an exact Qloo entity. Cross-domain taste affinities reveal musical connections a genre tag cannot.",
                      },
                      {
                        n: "02",
                        title: "Let the agent work the racks.",
                        text: "Side B resolves the artists in your inventory, retrieves Qloo affinity rankings, enforces stock, price and margin limits, then selects an edit that balances cultural fit with shelf age.",
                      },
                      {
                        n: "03",
                        title: "Show your work. Then sell it.",
                        text: "Inspect the evidence, rejected stock, baseline and economics. Publish a customer page, print shelf cards, export a decision receipt, and track holds through collection.",
                      },
                    ].map((s) => (
                      <article key={s.n}>
                        <span>{s.n}</span>
                        <h2>{s.title}</h2>
                        <p>{s.text}</p>
                      </article>
                    ))}
                  </div>
                  <div className="honesty-panel">
                    <ShieldCheck size={28} />
                    <div>
                      <h2>Built to earn a shopkeeper’s trust.</h2>
                      <p>
                        Rank fit is a relative score within the stocked artist
                        pool using Qloo affinity rankings. It is not a purchase
                        probability. Gross profit is a transparent one-of-each
                        scenario, not a forecast. Sample inventory is
                        illustrative. Side B never claims to have real customer
                        demand or completed sales until you record a collection.
                      </p>
                      <p>
                        The agent’s choices are constrained and auditable. No
                        invented Qloo evidence, no hidden substitutions, and no
                        automatic purchasing.
                      </p>
                    </div>
                  </div>
                  <div className="founder-note">
                    <span className="eyebrow">
                      BUILT BY SHIVAM GUPTA · QLOO AGENTIC HACKATHON
                    </span>
                    <h2>Technology that keeps the human taste.</h2>
                    <p>
                      Side B is designed for independent record retailers who
                      have the expertise, the stock and the story, but little
                      time to turn every cultural moment into a well-matched
                      shop edit.
                    </p>
                    <button
                      className="button primary"
                      onClick={() => setTab("studio")}
                    >
                      Make your first edit
                      <ArrowRight size={16} />
                    </button>
                  </div>
                </section>
              )}
            </>
          )}
        </main>
      </div>
      {editing && workspace && (
        <div
          className="modal-backdrop"
          onClick={(e) => {
            if (e.target === e.currentTarget && !busy) setEditing(null);
          }}
        >
          <section
            className="modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="edit-title"
          >
            <button
              className="modal-close"
              aria-label="Close edit record"
              disabled={!!busy}
              onClick={() => setEditing(null)}
            >
              <X size={20} />
            </button>
            <span className="eyebrow">YOUR INVENTORY</span>
            <h2 id="edit-title">Give this record its details.</h2>
            {error && (
              <div className="alert alert-error" role="alert">
                {error}
              </div>
            )}
            <form
              onSubmit={(e) => {
                e.preventDefault();
                perform("inventory", async () => {
                  const exists = originalSku !== null;
                  if (
                    !exists &&
                    workspace.inventory.some((i) => i.sku === editing.sku)
                  )
                    throw new Error(
                      "That SKU already exists. Choose a unique SKU for this record.",
                    );
                  await saveInventory(
                    exists
                      ? workspace.inventory.map((i) =>
                          i.sku === originalSku ? editing : i,
                        )
                      : [...workspace.inventory, editing],
                  );
                  setEditing(null);
                });
              }}
            >
              <div className="edit-grid">
                {(
                  [
                    "sku",
                    "artist",
                    "title",
                    "genre",
                    "price",
                    "cost",
                    "quantity",
                    "daysOnShelf",
                  ] as const
                ).map((k) => (
                  <label key={k}>
                    {
                      {
                        sku: "SKU (unique)",
                        artist: "Artist",
                        title: "Record title",
                        genre: "Genre",
                        price: `Retail (${workspace.currency})`,
                        cost: `Cost (${workspace.currency})`,
                        quantity: "Available units",
                        daysOnShelf: "Days on shelf",
                      }[k]
                    }
                    <input
                      autoFocus={k === "artist"}
                      required
                      value={editing[k]}
                      readOnly={k === "sku" && originalSku !== null}
                      type={
                        ["price", "cost", "quantity", "daysOnShelf"].includes(k)
                          ? "number"
                          : "text"
                      }
                      min={k === "price" ? 0.01 : 0}
                      step={["price", "cost"].includes(k) ? ".01" : 1}
                      maxLength={k === "sku" ? 60 : 160}
                      onChange={(e) =>
                        setEditing({
                          ...editing,
                          [k]: [
                            "price",
                            "cost",
                            "quantity",
                            "daysOnShelf",
                          ].includes(k)
                            ? Number(e.target.value)
                            : e.target.value,
                        })
                      }
                    />
                  </label>
                ))}
              </div>
              <p className="small-muted">
                Changing stock is blocked while active pickup holds exist. SKU
                identifies a record and stays fixed after creation.
              </p>
              <div className="modal-actions">
                {originalSku !== null && (
                  <button
                    className="button secondary danger"
                    type="button"
                    disabled={!!busy}
                    onClick={() =>
                      perform("inventory", async () => {
                        await saveInventory(
                          workspace.inventory.filter(
                            (i) => i.sku !== editing.sku,
                          ),
                        );
                        setEditing(null);
                      })
                    }
                  >
                    <Trash2 size={15} />
                    Remove
                  </button>
                )}
                <button
                  className="button primary"
                  disabled={!!busy}
                  type="submit"
                >
                  {busy === "inventory" ? (
                    <LoaderCircle className="spin" size={16} />
                  ) : (
                    <Check size={16} />
                  )}
                  Save record
                </button>
              </div>
            </form>
          </section>
        </div>
      )}
      {settings && workspace && (
        <div className="modal-backdrop">
          <section
            className="modal settings-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="settings-title"
          >
            <button
              className="modal-close"
              aria-label="Close shop settings"
              disabled={!!busy}
              onClick={() => setSettings(false)}
            >
              <X size={20} />
            </button>
            <span className="eyebrow">YOUR PRIVATE WORKSPACE</span>
            <h2 id="settings-title">A name above the door.</h2>
            {error && (
              <div className="alert alert-error" role="alert">
                {error}
              </div>
            )}
            <form
              onSubmit={(e) => {
                e.preventDefault();
                perform("settings", async () => {
                  await api("/api/workspace", "POST", {
                    name: shopName,
                    pickupInstructions: pickup,
                  });
                  await refresh();
                  setSettings(false);
                  setNotice("Shop name updated.");
                });
              }}
            >
              <label>
                Shop name
                <input
                  required
                  maxLength={100}
                  value={shopName}
                  onChange={(e) => setShopName(e.target.value)}
                />
              </label>
              <label className="pickup-label">
                Pickup details
                <textarea
                  rows={4}
                  maxLength={1000}
                  value={pickup}
                  onChange={(e) => setPickup(e.target.value)}
                  placeholder="Shop address, opening hours and a contact customers can use to arrange collection."
                />
              </label>
              <p className="small-muted">
                Published customers see these details. For real inventory, add
                your address, opening hours and a contact before publishing.
                Holds expire automatically after 48 hours; no emails or
                reminders are sent.
              </p>
              <p className="small-muted">
                This name appears on public campaign pages. Your inventory uses{" "}
                {workspace.currency}.
              </p>
              <button className="button primary" disabled={!!busy}>
                Save shop name
                <Check size={16} />
              </button>
            </form>
            <div className="settings-privacy">
              <strong>Your workspace belongs to you.</strong>
              {workspace.user && (
                <a className="button secondary account-signout" href="/signout">
                  Sign out
                </a>
              )}
              <p>
                {workspace.user
                  ? "Signed in and saved to your account."
                  : "Your private guest workspace uses this browser’s cookie. Signing in opens a separate account workspace; guest data is not transferred. Sign in before uploading stock you need across devices."}
              </p>
              {!workspace.user && (
                <a className="button secondary" href="/signin" target="_top">
                  <LogIn size={15} />
                  Sign in with Google
                </a>
              )}
              <button
                className="text-button danger"
                disabled={!!busy}
                onClick={() => {
                  if (
                    window.confirm(
                      "Delete this workspace, all inventory, campaigns and pickup holds? This cannot be undone.",
                    )
                  )
                    perform("delete", async () => {
                      await api("/api/workspace", "DELETE");
                      setSettings(false);
                      setRun(null);
                      setAnchors([]);
                      await refresh();
                      setNotice(
                        "Previous workspace data deleted. A fresh sample workspace is ready.",
                      );
                    });
                }}
              >
                Delete all workspace data
              </button>
            </div>
          </section>
        </div>
      )}
    </div>
  );
}
