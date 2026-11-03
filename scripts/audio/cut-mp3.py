"""Découpe sans réencodage d'un MP3 (MPEG-1 couche III) entre deux instants, aux limites de trames
(1152 échantillons) : balise ID3 et trame d'en-tête VBR (Xing / Info) retirées.
Usage : python -I scripts/audio/cut-mp3.py <entrée.mp3> <sortie.mp3> <début s> <fin s>"""
import sys

BITRATES = [0, 32, 40, 48, 56, 64, 80, 96, 112, 128, 160, 192, 224, 256, 320, 0]
RATES = [44100, 48000, 32000, 0]

src, dst, t0, t1 = sys.argv[1], sys.argv[2], float(sys.argv[3]), float(sys.argv[4])
data = open(src, "rb").read()
pos = 0
if data[:3] == b"ID3":
    size = (data[6] << 21) | (data[7] << 14) | (data[8] << 7) | data[9]
    pos = 10 + size
frames = []
while pos + 4 <= len(data):
    h = data[pos:pos + 4]
    if h[0] != 0xFF or (h[1] & 0xFE) != 0xFA:  # MPEG-1, couche III
        pos += 1
        continue
    br, sr, pad = BITRATES[h[2] >> 4], RATES[(h[2] >> 2) & 3], (h[2] >> 1) & 1
    if not br or not sr:
        pos += 1
        continue
    n = 144 * br * 1000 // sr + pad
    frames.append((pos, n, sr))
    pos += n
assert frames, "aucune trame MP3"
first = data[frames[0][0]:frames[0][0] + frames[0][1]]
if b"Xing" in first or b"Info" in first:
    frames = frames[1:]
sr = frames[0][2]
a, b = int(t0 * sr / 1152), int(t1 * sr / 1152)
out = b"".join(data[p:p + n] for p, n, _ in frames[a:b])
open(dst, "wb").write(out)
print(f"{dst} : {(b - a) * 1152 / sr:.2f} s, {len(out) // 1024} Ko")
