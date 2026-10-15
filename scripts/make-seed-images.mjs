// Génère des images de démonstration (stockage local uniquement) : node scripts/make-seed-images.mjs
import sharp from "sharp";

const names = ["LILLE FIVES", "LILLE MOULINS", "VILLENEUVE D'ASCQ"];
const palettes = [
  ["#1d0f33", "#ff7a1a"], ["#140b22", "#facc15"], ["#2a0d0d", "#c3122b"],
  ["#0b1a12", "#7cff4f"], ["#1a1033", "#b48cff"], ["#1f1305", "#ff9f1a"],
];

for (const [i, name] of names.entries()) {
  const [bg, accent] = palettes[i];
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1280" height="720">
  <defs><radialGradient id="g" cx="78%" cy="18%" r="90%"><stop offset="0" stop-color="${accent}" stop-opacity=".55"/><stop offset=".45" stop-color="${bg}"/><stop offset="1" stop-color="#050308"/></radialGradient></defs>
  <rect width="1280" height="720" fill="url(#g)"/>
  <circle cx="1000" cy="130" r="70" fill="#fff2c8" opacity=".9"/>
  <g transform="translate(470 250) scale(6)" >
    <path d="M27 8c1-4 4-7 7-7" stroke="#2d5a1e" stroke-width="4" fill="none" stroke-linecap="round"/>
    <ellipse cx="17" cy="28" rx="13" ry="18" fill="#e8650f"/><ellipse cx="37" cy="28" rx="13" ry="18" fill="#e8650f"/><ellipse cx="27" cy="28" rx="13" ry="19" fill="#ff7a1a"/>
    <g fill="#ffd34d"><path d="M14 22l6-6 4 7z"/><path d="M40 22l-6-6-4 7z"/><path d="M12 33q15 12 30 0l-4 3-3-3-3 4-3-4-3 4-3-4-3 3z"/></g>
  </g>
  <text x="640" y="660" text-anchor="middle" font-family="Arial, sans-serif" font-size="44" font-weight="700" fill="#f3e9d2">DÉMO · ${name.replace("'", "&apos;")}</text>
</svg>`;
  await sharp(Buffer.from(svg)).webp({ quality: 78 }).toFile(`public/seed/deco-${i + 1}.webp`);
}
console.log("ok");
