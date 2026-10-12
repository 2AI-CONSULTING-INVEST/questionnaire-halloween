/* Décor Halloween discret (toiles, araignées, chauves-souris, citrouilles) inspiré de jeu.startsurf.fr. */

function Web() {
  return (
    <svg viewBox="0 0 150 150" fill="none" stroke="rgba(31,41,55,.45)" strokeWidth="1.1">
      <path d="M0 0L150 150M0 0L150 70M0 0L70 150M0 0L150 20M0 0L20 150" />
      <path d="M0 30Q18 22 26 26Q24 14 30 0M0 62Q34 50 50 52Q48 30 62 0M0 98Q52 80 76 80Q76 46 96 0M0 140Q74 112 108 110Q108 64 136 0" />
    </svg>
  );
}

function Spider() {
  return (
    <svg viewBox="0 0 34 34">
      <g stroke="#111" strokeWidth="2" fill="none" strokeLinecap="round">
        <path d="M17 17L4 8M17 17L2 16M17 17L4 25M17 17L8 32M17 17L30 8M17 17L32 16M17 17L30 25M17 17L26 32" />
      </g>
      <ellipse cx="17" cy="18" rx="6" ry="7" fill="#111" />
      <circle cx="17" cy="10" r="4" fill="#111" />
      <circle cx="15.5" cy="9.5" r="1" fill="#FACC15" />
      <circle cx="18.5" cy="9.5" r="1" fill="#FACC15" />
    </svg>
  );
}

function Bat() {
  return (
    <svg viewBox="0 0 46 24">
      <path
        fill="#1f2937"
        d="M23 8c-2-4-3-6-3-6l-1 4-3-1 2 4C12 6 6 4 0 6c4 2 6 6 6 10 3-2 6-2 8 0 1-3 4-4 6-2l3 6 3-6c2-2 5-1 6 2 2-2 5-2 8 0 0-4 2-8 6-10-6-2-12 0-18 3l2-4-3 1-1-4s-1 2-3 6z"
      />
      <circle cx="21" cy="9" r=".9" fill="#FACC15" />
      <circle cx="25" cy="9" r=".9" fill="#FACC15" />
    </svg>
  );
}

function Pumpkin({ n }: { n: number }) {
  return (
    <svg viewBox="0 0 54 48">
      <path d="M27 8c1-4 4-7 7-7" stroke="#2d5a1e" strokeWidth="4" fill="none" strokeLinecap="round" />
      <ellipse cx="17" cy="28" rx="13" ry="18" fill="#e8650f" />
      <ellipse cx="37" cy="28" rx="13" ry="18" fill="#e8650f" />
      <ellipse cx="27" cy="28" rx="13" ry="19" fill="#ff7a1a" />
      <g className="fl" fill="#ffd34d">
        <path d="M14 22l6-6 4 7z" />
        <path d="M40 22l-6-6-4 7z" />
        {n % 2 ? <path d="M12 33q15 12 30 0l-4 3-3-3-3 4-3-4-3 4-3-4-3 3z" /> : <path d="M13 32q14 10 28 0q-14 4-28 0z" />}
      </g>
    </svg>
  );
}

type CSSVars = React.CSSProperties & Record<`--${string}`, string>;

export function HalloweenDecor() {
  return (
    <div className="hw-deco" aria-hidden>
      <div className="hw-web l"><Web /></div>
      <div className="hw-web r"><Web /></div>
      {([["12%", "7s", "150px", "0s"], ["86%", "9s", "210px", "2s"]] as const).map(([x, d, h, dl]) => (
        <div key={x} className="hw-spider" style={{ "--x": x, "--d": d, "--h": h, "--dl": dl } as CSSVars}>
          <i />
          <Spider />
        </div>
      ))}
      {([["7%", "16s", "0s"], ["16%", "21s", "7s"]] as const).map(([y, d, dl]) => (
        <div key={y} className="hw-bat" style={{ "--y": y, "--d": d, "--dl": dl } as CSSVars}>
          <Bat />
        </div>
      ))}
      <div className="hw-pumps">
        <Pumpkin n={1} />
        <Pumpkin n={2} />
      </div>
    </div>
  );
}
