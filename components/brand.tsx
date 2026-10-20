import Link from "next/link";
import type { CSSProperties } from "react";
export function Brand({ small = false }: { small?: boolean }) {
  return (
    <Link
      className={`brand ${small ? "brand-small" : ""}`}
      href="/"
      aria-label="Side B home"
    >
      <span className="brand-mark">
        b<span />
      </span>
      <span>
        side b<span className="brand-period">.</span>
      </span>
    </Link>
  );
}
export function Sleeve({
  artist,
  title,
  color,
  index = 0,
  large = false,
}: {
  artist: string;
  title: string;
  color?: string;
  index?: number;
  large?: boolean;
}) {
  const colors = [
    "#e7ab49",
    "#60849a",
    "#cb684d",
    "#9a9c68",
    "#68846b",
    "#a287a1",
  ];
  return (
    <div
      className={`sleeve sleeve-${index % 4} ${large ? "sleeve-large" : ""}`}
      style={
        {
          "--sleeve-color": color || colors[index % colors.length],
        } as CSSProperties
      }
      aria-hidden="true"
    >
      <div className="sleeve-grid" />
      <div className="sleeve-orbit" />
      <span className="sleeve-artist">{artist}</span>
      <span className="sleeve-title">{title}</span>
      <span className="sleeve-small">SIDE B SELECTS · 33⅓ RPM</span>
    </div>
  );
}
export function VinylArt() {
  return (
    <div className="hero-art" aria-hidden="true">
      <div className="art-caption">
        GOOD TASTE.
        <br />
        MEET GOOD BUSINESS.
      </div>
      <div className="vinyl">
        <div className="vinyl-label">
          <span>side b.</span>
          <small>
            THE SECOND SIDE
            <br />
            IS THE GOOD SIDE
          </small>
          <i />
        </div>
      </div>
      <div className="hero-sleeve">
        <span className="hero-sleeve-top">
          INDEPENDENT SPIRIT
          <br />
          CULTURAL INTELLIGENCE
        </span>
        <div className="hero-sleeve-shape" />
        <strong>
          There’s more
          <br />
          in the grooves.
        </strong>
        <span className="hero-sleeve-bottom">
          SIDE B SELECTS / VOL. 001 <span>↗</span>
        </span>
      </div>
      <div className="art-sticker">
        A new spin
        <br />
        on your stock.<span>↗</span>
      </div>
      <span className="art-footnote">
        BUILT FOR THE SHOPS THAT MAKE A SCENE.
      </span>
    </div>
  );
}
