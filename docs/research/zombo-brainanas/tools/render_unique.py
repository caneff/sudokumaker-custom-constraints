"""render_unique.py unique.json out.png — two panels: the puzzle as presented (circles + dots on an empty grid)
and the solution (digits, shading: green infected, red patient zero, cream uninfected) with the same clues."""
import json, sys, os
from PIL import Image, ImageDraw, ImageFont
F = "/home/caneff/orca/workspaces/sudokumaker-custom-constraints/tang/docs/research/zombo-brainanas/found/"
u = json.load(open(sys.argv[1])); d = json.load(open(F + u["fill"] + ".json"))
N = 9; C = 64; M = 24; W = N * C + 2 * M
img = Image.new("RGB", (2 * W + 20, W + 40), "white"); dr = ImageDraw.Draw(img)
font = ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf", 30)
small = ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf", 18)
circles = {tuple(p) for p in u["circles"]}
box = lambda r, c: (r // 3) * 3 + c // 3 + 1
def panel(ox, title, solved):
    dr.text((ox + M, 4), title, fill="black", font=small)
    oy = 30
    for r in range(N):
        for c in range(N):
            x0, y0 = ox + M + c * C, oy + M + r * C
            inf = d["infected"][r][c] == "*"; pz = inf and int(d["grid"][r][c]) == box(r, c)
            fill = ((190, 40, 40) if pz else (70, 120, 70) if inf else (255, 245, 200)) if solved else "white"
            dr.rectangle([x0, y0, x0 + C, y0 + C], fill=fill)
            if (r, c) in circles: dr.ellipse([x0 + 7, y0 + 7, x0 + C - 7, y0 + C - 7], outline="black", width=4)
            if solved:
                t = d["grid"][r][c]; bb = dr.textbbox((0, 0), t, font=font)
                dr.text((x0 + C / 2 - (bb[2] - bb[0]) / 2, y0 + C / 2 - (bb[3] - bb[1]) / 2 - 4), t, fill="white" if inf else "black", font=font)
    for i in range(N + 1):
        w = 4 if i % 3 == 0 else 1
        dr.line([ox + M + i * C, oy + M, ox + M + i * C, oy + M + N * C], fill="black", width=w)
        dr.line([ox + M, oy + M + i * C, ox + M + N * C, oy + M + i * C], fill="black", width=w)
    for kind, edges in (("white", u.get("white", [])), ("black", u.get("black", []))):
        for r, c, a, b in edges:
            cx, cy = ox + M + (c + b + 1) * C / 2, oy + M + (r + a + 1) * C / 2
            dr.ellipse([cx - 9, cy - 9, cx + 9, cy + 9], fill="white" if kind == "white" else "black", outline="black", width=3)
panel(0, f"{u['fill']}: {len(circles)} circles, {len(u.get('white', []))} white, {len(u.get('black', []))} black", False)
panel(W + 20, "solution", True)
img.save(sys.argv[2])
