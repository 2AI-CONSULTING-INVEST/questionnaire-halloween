"""Couronnes du podium (public/decor/crown-{1,2,3}.svg) depuis l'emoji « Crown » Fluent (Color, MIT,
https://github.com/microsoft/fluentui-emoji, assets/Crown/Color/crown_color.svg) : or = l'original,
or, argent et bronze = seules les teintes du métal (jaune → orangé, reflets rosés) recolorées ; les pierres gardent leurs couleurs.
Usage : python -I scripts/crown-variants.py <crown_color.svg> <dossier de sortie>"""
import colorsys, re, sys

src, out = sys.argv[1], sys.argv[2]
svg = open(src, encoding="utf-8").read()
assert not re.search(r"<script|on\w+=|javascript:|<foreignObject", svg, re.I), "SVG suspect"

def recolor(hexc, mode):
    r, g, b = (int(hexc[i:i + 2], 16) / 255 for i in (1, 3, 5))
    h, l, s = colorsys.rgb_to_hls(r, g, b)
    deg = h * 360
    pale_pink = deg >= 340 and l > 0.6 and s < 0.65  # reflets rosés du métal (les pierres sont plus vives)
    if not (5 <= deg <= 62 or pale_pink):  # pierres (rouges, roses, bleues) : inchangées
        return hexc
    if pale_pink:
        deg = 30
    if mode == "gold":  # or franc : teintes jaunes (l'original tire sur le pêche, trop proche du bronze)
        h2, s2, l2 = (40 + (deg - 5) * 0.25) / 360, min(1, s * 1.05), min(0.92, l * 1.04)
    elif mode == "silver":
        h2, s2, l2 = 215 / 360, s * 0.12, min(0.95, l * 1.02 + 0.04)
    else:  # bronze
        h2, s2, l2 = (deg - 14) / 360, s * 0.72, l * 0.78
    r2, g2, b2 = colorsys.hls_to_rgb(h2, l2, s2)
    return "#%02X%02X%02X" % (round(r2 * 255), round(g2 * 255), round(b2 * 255))

for rank, mode in ((1, "gold"), (2, "silver"), (3, "bronze")):
    body = re.sub(r"#[0-9A-Fa-f]{6}\b", lambda m: recolor(m.group(0), mode), svg)
    open(f"{out}/crown-{rank}.svg", "w", encoding="utf-8").write(body)
print("ok")
