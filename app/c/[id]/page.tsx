"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import {
  ArrowUpRight,
  CheckCircle2,
  Disc3,
  LoaderCircle,
  MapPin,
  ShieldCheck,
  X,
} from "lucide-react";
import { Brand, Sleeve } from "@/components/brand";
import { useModal } from "@/components/use-modal";
import type { Campaign, InventoryItem } from "@/lib/types";
type PublicData = {
  campaign: Campaign;
  shop: {
    name: string;
    currency: string;
    sample: boolean;
    pickupInstructions?: string;
  };
  inventory: InventoryItem[];
};
export default function CampaignPage() {
  const params = useParams<{ id: string }>();
  const id = String(params.id);
  const [data, setData] = useState<PublicData | null>(null);
  const [error, setError] = useState("");
  const [selected, setSelected] = useState<InventoryItem | null>(null);
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [reference, setReference] = useState("");
  const [key, setKey] = useState("");
  const [holdError, setHoldError] = useState("");
  useModal(!!selected, () => {
    if (!busy) setSelected(null);
  });
  async function load() {
    const r = await fetch(`/api/campaigns/${id}`);
    const d = (await r.json()) as PublicData & { error?: string };
    if (!r.ok) throw new Error(d.error || "This shop edit could not be found.");
    setData(d);
  }
  useEffect(() => {
    let active = true;
    fetch(`/api/campaigns/${id}`)
      .then(async (r) => {
        const d = (await r.json()) as PublicData & { error?: string };
        if (!r.ok)
          throw new Error(d.error || "This shop edit could not be found.");
        return d;
      })
      .then((d) => {
        if (active) setData(d);
      })
      .catch((e) => {
        if (active) setError(e.message);
      });
    return () => {
      active = false;
    };
  }, [id]);
  const money = (n: number) =>
    new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: data?.shop.currency || "USD",
    }).format(n);
  async function reserve(e: React.FormEvent) {
    e.preventDefault();
    if (!selected) return;
    setBusy(true);
    setHoldError("");
    try {
      const r = await fetch(`/api/campaigns/${id}/reserve`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sku: selected.sku,
          customerName: name.trim(),
          quantity: 1,
          idempotencyKey: key,
        }),
      });
      const d = (await r.json()) as {
        error?: string;
        reservation: { reference: string };
      };
      if (!r.ok) throw new Error(d.error || "Unable to reserve this record.");
      setReference(d.reservation.reference);
      await load();
    } catch (e) {
      setHoldError(e instanceof Error ? e.message : "Please try again.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="storefront">
      <header className="store-header">
        <Brand small />
        <span>INDEPENDENT TASTE. A NEW CONNECTION.</span>
        <Link href="/">
          For record shops
          <ArrowUpRight size={14} />
        </Link>
      </header>
      {error ? (
        <main className="store-error">
          <Disc3 size={40} />
          <h1>This record isn’t spinning.</h1>
          <p>{error}</p>
          <Link className="button primary" href="/">
            Visit Side B<ArrowUpRight size={16} />
          </Link>
        </main>
      ) : !data ? (
        <div className="loading-state">
          <Disc3 className="spin" size={40} />
          <h1>Digging out the good stuff.</h1>
        </div>
      ) : (
        <>
          <main>
            <section className="store-hero">
              <div className="eyebrow">
                <span />
                {data.shop.name.toUpperCase()} · THE SHOP EDIT
              </div>
              <h1>{data.campaign.title}</h1>
              <p>{data.campaign.description}</p>
              <div className="store-byline">
                <span className="shop-avatar">
                  {data.shop.name.slice(0, 1)}
                </span>
                <span>
                  Selected from the shelves of <strong>{data.shop.name}</strong>
                </span>
                <span className="store-qloo">
                  <Disc3 size={16} />
                  Culturally connected by Qloo
                </span>
              </div>
              {data.shop.sample && (
                <div className="store-sample">
                  <strong>Sample shop experience.</strong> Real Qloo
                  recommendations with illustrative inventory. Holds demonstrate
                  the workflow; there is no physical shop or fulfillment.
                </div>
              )}
            </section>
            {data.shop.pickupInstructions && (
              <section className="store-pickup">
                <MapPin size={20} />
                <div>
                  <span className="eyebrow">
                    PICKUP AT {data.shop.name.toUpperCase()}
                  </span>
                  <p>{data.shop.pickupInstructions}</p>
                  <small>
                    Holds expire after 48 hours. Bring your reference; contact
                    the shop directly with questions. No email or reminder is
                    sent.
                  </small>
                </div>
              </section>
            )}
            <div className="store-collection-head">
              <span>
                {data.campaign.run.selected.length} RECORDS. SOMETHING NEW TO
                LOVE.
              </span>
              <span>
                <MapPin size={14} />
                Reserve online · Collect in store
              </span>
            </div>
            <section className="store-records">
              {data.campaign.run.selected.map((item, i) => {
                const stock = data.inventory.find((x) => x.sku === item.sku);
                const quantity = stock?.quantity || 0;
                return (
                  <article className="store-record" key={item.sku}>
                    <Sleeve
                      artist={item.artist}
                      title={item.title}
                      color={item.color}
                      index={i}
                      large
                    />
                    <div className="store-record-top">
                      <span className="record-genre">{item.genre}</span>
                      <span
                        className={
                          quantity ? "available-label" : "sold-out-label"
                        }
                      >
                        {quantity
                          ? `${quantity} available`
                          : "Currently held / sold out"}
                      </span>
                    </div>
                    <h2>{item.title}</h2>
                    <p>{item.artist}</p>
                    <div className="store-record-bottom">
                      <strong>{money(item.price)}</strong>
                      <button
                        className="button primary"
                        disabled={!quantity}
                        onClick={() => {
                          setSelected(item);
                          setName("");
                          setReference("");
                          setHoldError("");
                          setKey(crypto.randomUUID());
                        }}
                      >
                        {quantity ? "Hold for pickup" : "Unavailable"}
                        {quantity && <ArrowUpRight size={15} />}
                      </button>
                    </div>
                  </article>
                );
              })}
            </section>
            <section className="store-how">
              <div>
                <span className="eyebrow">
                  A LITTLE DISCOVERY. A REAL CONNECTION.
                </span>
                <h2>
                  Find it here.
                  <br />
                  <em>Make it yours in store.</em>
                </h2>
              </div>
              <ol>
                <li>
                  <span>01</span>
                  <div>
                    <strong>Find your next record.</strong>
                    <p>
                      Explore this shop’s cultural edit, made from what’s
                      actually on the shelf.
                    </p>
                  </div>
                </li>
                <li>
                  <span>02</span>
                  <div>
                    <strong>Put your name on it.</strong>
                    <p>
                      A free pickup hold reserves one available copy for 48
                      hours. Save your reference; no email or reminders are
                      sent.
                    </p>
                  </div>
                </li>
                <li>
                  <span>03</span>
                  <div>
                    <strong>Meet at the counter.</strong>
                    <p>
                      Collect and pay directly in the shop. Side B does not take
                      payments or arrange shipping.
                    </p>
                  </div>
                </li>
              </ol>
            </section>
          </main>
          <footer className="store-footer">
            <Brand small />
            <p>Good records. Independent shops. Unexpected connections.</p>
            <span>Built by Shivam Gupta · Powered by Qloo</span>
          </footer>
        </>
      )}
      {selected && (
        <div className="modal-backdrop">
          <section
            className="modal reserve-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="hold-title"
          >
            <button
              className="modal-close"
              aria-label="Close pickup hold"
              onClick={() => {
                if (!busy) setSelected(null);
              }}
            >
              <X size={20} />
            </button>
            {reference ? (
              <div className="hold-success">
                <CheckCircle2 size={44} />
                <span className="eyebrow">IT HAS YOUR NAME ON IT</span>
                <h2 id="hold-title">
                  A good record.
                  <br />A good choice.
                </h2>
                <p>
                  Your copy of <strong>{selected.title}</strong> is held at{" "}
                  {data?.shop.name}.
                </p>
                <div className="hold-reference">
                  <small>YOUR PICKUP REFERENCE</small>
                  <strong>{reference}</strong>
                </div>
                {data?.shop.pickupInstructions && (
                  <div className="hold-pickup">
                    <strong>Where to collect</strong>
                    <p>{data.shop.pickupInstructions}</p>
                  </div>
                )}
                <p>
                  Save this reference and collect within 48 hours. The hold
                  expires automatically after that. No email or reminder will be
                  sent. Payment happens in store.{" "}
                  {data?.shop.sample &&
                    "This is a sample hold only; no physical record will be supplied."}
                </p>
                <button
                  className="button primary"
                  onClick={() => setSelected(null)}
                >
                  Keep digging
                  <ArrowUpRight size={16} />
                </button>
              </div>
            ) : (
              <>
                <span className="eyebrow">A RECORD WITH YOUR NAME ON IT</span>
                <h2 id="hold-title">We’ll hold that thought.</h2>
                <div className="hold-record">
                  <Sleeve artist={selected.artist} title={selected.title} />
                  <span>
                    <strong>{selected.title}</strong>
                    <small>{selected.artist}</small>
                    <b>{money(selected.price)}</b>
                  </span>
                </div>
                <form onSubmit={reserve}>
                  <label>
                    Your name
                    <input
                      autoFocus
                      required
                      minLength={1}
                      maxLength={60}
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      autoComplete="name"
                      placeholder="Name for pickup"
                    />
                  </label>
                  <p className="small-muted">
                    The shop uses your name to find this hold. No email, account
                    or payment details needed.
                  </p>
                  {data?.shop.sample && (
                    <p className="store-sample">
                      Sample inventory. This demonstrates a hold; it does not
                      reserve a real-world record.
                    </p>
                  )}
                  {holdError && (
                    <div className="alert alert-error" role="alert">
                      {holdError}
                    </div>
                  )}
                  <button
                    className="button primary full-width"
                    disabled={busy || !name.trim()}
                  >
                    {busy ? (
                      <LoaderCircle className="spin" size={17} />
                    ) : (
                      <ShieldCheck size={17} />
                    )}
                    Reserve one copy — free
                  </button>
                  <p className="run-note">
                    One copy held for 48 hours. Pay and collect in store. No
                    shipping.
                  </p>
                </form>
              </>
            )}
          </section>
        </div>
      )}
    </div>
  );
}
