#!/usr/bin/env python3
"""BEAK Memory App-Icon (Entwurf 3): 2x2-Raster, eine Karte mit Widerstand,
drei verdeckt mit BEAK-Punkt. Weiß auf #dd007a, r=22%.
Quelle: /workspace/bestueckungs-memory-mockups/icons-v2/icon-3.svg
"""
from __future__ import annotations
import os, subprocess
from PIL import Image, ImageDraw, ImageChops

PINK = (221, 0, 122)
PINK_HEX = "#dd007a"
WHITE = "#ffffff"
R_FRAC = 0.22
RX = 112.64
HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.normpath(os.path.join(HERE, ".."))
MOCK = "/workspace/bestueckungs-memory-mockups"
SRC_SVG = os.path.join(MOCK, "icons-v2", "icon-3.svg")
CHROME = "google-chrome"

def motif_svg(rounded: bool, scale_motif: float = 1.0, simple: bool = False) -> str:
    """SVG body matching design_3. scale_motif < 1 for maskable safe-zone."""
    gap, margin = 18, 88
    usable = 512 - 2 * margin
    cw = (usable - gap) / 2
    ch = cw * 1.15
    total_h = 2 * ch + gap
    y0 = (512 - total_h) / 2
    x0 = margin
    rx = 20
    # scale around center 256,256
    def sx(x, y):
        if scale_motif == 1.0:
            return x, y
        return 256 + (x - 256) * scale_motif, 256 + (y - 256) * scale_motif
    def s(v):
        return v * scale_motif

    cells = [(0, 0, "face"), (1, 0, "back"), (0, 1, "back"), (1, 1, "back")]
    parts = []
    for col, row, kind in cells:
        x = x0 + col * (cw + gap)
        y = y0 + row * (ch + gap)
        x2, y2 = sx(x, y)
        # when scaling, also scale size from center of each card... simpler: transform group
        pass
    # Use a group transform for maskable
    tf = ""
    if scale_motif != 1.0:
        tf = f' transform="translate(256 256) scale({scale_motif}) translate(-256 -256)"'
    parts = [f"  <g{tf}>\n"]
    for col, row, kind in cells:
        x = x0 + col * (cw + gap)
        y = y0 + row * (ch + gap)
        parts.append(
            f'    <rect x="{x:.1f}" y="{y:.1f}" width="{cw:.1f}" height="{ch:.1f}" '
            f'rx="{rx}" fill="{WHITE}"/>\n'
        )
        cx, cy = x + cw / 2, y + ch / 2
        if kind == "face":
            if simple:
                # chunky zigzag for tiny favicons
                parts.append(
                    f'    <path d="M{cx-42:.1f} {cy:.1f} L{cx-28:.1f} {cy:.1f} '
                    f'L{cx-18:.1f} {cy-22:.1f} L{cx-4:.1f} {cy+22:.1f} '
                    f'L{cx+10:.1f} {cy-22:.1f} L{cx+24:.1f} {cy+22:.1f} '
                    f'L{cx+34:.1f} {cy:.1f} L{cx+48:.1f} {cy:.1f}" '
                    f'fill="none" stroke="{PINK_HEX}" stroke-width="12" '
                    f'stroke-linecap="round" stroke-linejoin="round"/>\n'
                )
            else:
                sc, sw = 0.55, 11
                pts = [
                    (cx - 70 * sc, cy), (cx - 50 * sc, cy),
                    (cx - 35 * sc, cy - 28 * sc), (cx - 15 * sc, cy + 28 * sc),
                    (cx + 5 * sc, cy - 28 * sc), (cx + 25 * sc, cy + 28 * sc),
                    (cx + 40 * sc, cy), (cx + 60 * sc, cy),
                ]
                d = " ".join(f"{'M' if i == 0 else 'L'}{x:.1f} {y:.1f}" for i, (x, y) in enumerate(pts))
                parts.append(
                    f'    <path d="{d}" fill="none" stroke="{PINK_HEX}" '
                    f'stroke-width="{sw * sc:.1f}" stroke-linecap="round" stroke-linejoin="round"/>\n'
                )
        else:
            r = 28 if simple else 22
            parts.append(f'    <circle cx="{cx:.1f}" cy="{cy:.1f}" r="{r}" fill="{PINK_HEX}"/>\n')
    parts.append("  </g>\n")
    rx_attr = f' rx="{RX}" ry="{RX}"' if rounded else ""
    note = "Rounded r=22%" if rounded else "Full-bleed maskable (motif ~80% safe zone)"
    if simple:
        note += ", simplified"
    return (
        f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="512" height="512">\n'
        f'  <!-- BEAK Memory. Entwurf 3. {note}. #dd007a, white 2x2 cards -->\n'
        f'  <rect width="512" height="512"{rx_attr} fill="{PINK_HEX}"/>\n'
        + "".join(parts)
        + "</svg>\n"
    )

def chrome_render(svg_path: str, size: int = 512) -> Image.Image:
    tmp = os.path.join(OUT, f"_chrome_{size}.png")
    url = "file://" + os.path.abspath(svg_path)
    cmd = [
        CHROME, "--headless", "--disable-gpu", "--hide-scrollbars",
        "--no-sandbox", f"--window-size={size},{size}",
        f"--screenshot={tmp}", url,
    ]
    subprocess.run(cmd, check=True, capture_output=True)
    img = Image.open(tmp).convert("RGBA")
    if img.size != (size, size):
        img = img.resize((size, size), Image.LANCZOS)
    try:
        os.remove(tmp)
    except OSError:
        pass
    return img

def apply_round_mask(img: Image.Image, rounded: bool) -> Image.Image:
    size = img.size[0]
    if not rounded:
        # opaque full square on pink already
        return img
    mask = Image.new("L", (size, size), 0)
    ImageDraw.Draw(mask).rounded_rectangle(
        [0, 0, size - 1, size - 1], radius=int(R_FRAC * size), fill=255
    )
    out = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    out.paste(img, (0, 0))
    r, g, b, a = out.split()
    a = ImageChops.multiply(a, mask)
    return Image.merge("RGBA", (r, g, b, a))

def render_from_master(master: Image.Image, size: int, rounded: bool) -> Image.Image:
    img = master.resize((size, size), Image.LANCZOS)
    return apply_round_mask(img, rounded)

def write_ico(path: str, master: Image.Image, sizes=(16, 32, 48)):
    imgs = [render_from_master(master, s, True).convert("RGBA") for s in sizes]
    imgs[0].save(path, format="ICO", sizes=[(s, s) for s in sizes])

def make_preview(path: str, master: Image.Image, maskable: Image.Image):
    big = render_from_master(master, 256, True)
    sizes = [180, 64, 32]
    icons = [render_from_master(master, s, True) for s in sizes]
    pad, col_w, row_h = 40, 280, 320
    W = pad * 2 + col_w * 2
    H = pad * 2 + 280 + row_h
    canvas = Image.new("RGBA", (W, H), (245, 245, 248, 255))
    draw = ImageDraw.Draw(canvas)
    draw.rounded_rectangle([pad, pad, pad + col_w - 20, pad + 260], radius=16, fill=(255, 255, 255, 255))
    canvas.paste(big, (pad + (col_w - 20 - 256) // 2, pad + 2), big)
    draw.rounded_rectangle([pad + col_w, pad, pad + col_w * 2 - 20, pad + 260], radius=16, fill=(40, 40, 45, 255))
    canvas.paste(big, (pad + col_w + (col_w - 20 - 256) // 2, pad + 2), big)
    y, x = pad + 280, pad
    for ic, lab in zip(icons, ["180", "64", "32"]):
        tw = max(ic.size[0] + 24, 100)
        draw.rounded_rectangle([x, y, x + tw, y + ic.size[0] + 48], radius=10, fill=(255, 255, 255, 255))
        canvas.paste(ic, (x + (tw - ic.size[0]) // 2, y + 12), ic)
        draw.text((x + tw // 2 - 10, y + ic.size[0] + 20), lab + "px", fill=(80, 80, 80, 255))
        x += tw + 16
        draw.rounded_rectangle([x, y, x + tw, y + ic.size[0] + 48], radius=10, fill=(40, 40, 45, 255))
        canvas.paste(ic, (x + (tw - ic.size[0]) // 2, y + 12), ic)
        draw.text((x + tw // 2 - 10, y + ic.size[0] + 20), lab + "px", fill=(200, 200, 200, 255))
        x += tw + 24
    # maskable thumb
    m = maskable.resize((96, 96), Image.LANCZOS)
    draw.rounded_rectangle([pad, H - 130, pad + 120, H - 20], radius=10, fill=(40, 40, 45, 255))
    canvas.paste(m, (pad + 12, H - 118), m)
    draw.text((pad + 130, H - 80), "maskable 512", fill=(80, 80, 80, 255))
    canvas.convert("RGB").save(path, "PNG")
    print("preview", path)

def main():
    os.makedirs(OUT, exist_ok=True)
    os.makedirs(MOCK, exist_ok=True)

    # Prefer the chosen draft SVG verbatim for rounded icon.svg
    with open(SRC_SVG, encoding="utf-8") as f:
        chosen = f.read()
    # Ensure comment notes it's the app icon
    if "Entwurf 3" not in chosen:
        chosen = chosen.replace(
            "<!-- Memory icon draft. v3: 2x2 grid -->",
            "<!-- BEAK Memory App-Icon. Entwurf 3: 2x2 grid, one resistor face, three BEAK dots -->",
        )
    open(os.path.join(OUT, "icon.svg"), "w").write(chosen)
    open(os.path.join(HERE, "icon.svg"), "w").write(chosen)
    open(os.path.join(OUT, "favicon.svg"), "w").write(motif_svg(True, simple=True))

    maskable_svg = motif_svg(False, scale_motif=0.80)
    open(os.path.join(OUT, "icon-maskable.svg"), "w").write(maskable_svg)

    # Master renders via Chrome
    tmp_round = os.path.join(OUT, "_master_round.svg")
    open(tmp_round, "w").write(chosen)
    master = chrome_render(tmp_round, 512)
    master = apply_round_mask(master, True)

    tmp_mask = os.path.join(OUT, "_master_mask.svg")
    open(tmp_mask, "w").write(maskable_svg)
    maskable = chrome_render(tmp_mask, 512)
    # full bleed opaque
    bg = Image.new("RGBA", (512, 512), PINK + (255,))
    bg.paste(maskable, (0, 0), maskable)
    maskable = bg

    sizes = [16, 32, 48, 64, 120, 152, 167, 180, 192, 256, 512]
    for s in sizes:
        render_from_master(master, s, True).save(os.path.join(OUT, f"icon-{s}.png"))
        print("icon-%d.png" % s)
    render_from_master(master, 180, True).save(os.path.join(OUT, "apple-touch-icon.png"))
    render_from_master(master, 120, True).save(os.path.join(OUT, "apple-touch-icon-120.png"))
    render_from_master(master, 152, True).save(os.path.join(OUT, "apple-touch-icon-152.png"))
    render_from_master(master, 167, True).save(os.path.join(OUT, "apple-touch-icon-167.png"))
    render_from_master(master, 16, True).save(os.path.join(OUT, "favicon-16.png"))
    render_from_master(master, 32, True).save(os.path.join(OUT, "favicon-32.png"))
    render_from_master(master, 48, True).save(os.path.join(OUT, "favicon-48.png"))
    render_from_master(master, 32, True).save(os.path.join(OUT, "favicon.png"))
    for s in (192, 512):
        render_from_master(maskable, s, False).save(os.path.join(OUT, f"icon-{s}-maskable.png"))
    write_ico(os.path.join(OUT, "favicon.ico"), master)
    write_ico(os.path.join(OUT, "icon.ico"), master)

    preview = os.path.join(MOCK, "v104-icon-preview.png")
    make_preview(preview, master, maskable)
    make_preview(os.path.join(OUT, "icon-preview.png"), master, maskable)

    # Chat avatar 512
    avatar = render_from_master(master, 512, True)
    avatar.save(os.path.join(MOCK, "avatar-512.png"))
    print("avatar", os.path.join(MOCK, "avatar-512.png"))

    open(os.path.join(OUT, "manifest-icons.snippet.json"), "w").write(
        '[\n'
        '  { "src": "assets/icon-192.png", "sizes": "192x192", "type": "image/png", "purpose": "any" },\n'
        '  { "src": "assets/icon-512.png", "sizes": "512x512", "type": "image/png", "purpose": "any" },\n'
        '  { "src": "assets/icon-192-maskable.png", "sizes": "192x192", "type": "image/png", "purpose": "maskable" },\n'
        '  { "src": "assets/icon-512-maskable.png", "sizes": "512x512", "type": "image/png", "purpose": "maskable" }\n'
        ']\n'
    )
    open(os.path.join(OUT, "head-icons.snippet.html"), "w").write(
        '<link rel="icon" href="assets/favicon.svg" type="image/svg+xml">\n'
        '<link rel="icon" type="image/png" sizes="16x16" href="assets/favicon-16.png">\n'
        '<link rel="icon" type="image/png" sizes="32x32" href="assets/favicon-32.png">\n'
        '<link rel="icon" type="image/png" sizes="48x48" href="assets/favicon-48.png">\n'
        '<link rel="icon" type="image/png" sizes="192x192" href="assets/icon-192.png">\n'
        '<link rel="icon" type="image/png" sizes="512x512" href="assets/icon-512.png">\n'
        '<link rel="shortcut icon" href="assets/favicon.ico">\n'
        '<link rel="apple-touch-icon" href="assets/apple-touch-icon.png">\n'
    )
    for tmp in (tmp_round, tmp_mask):
        try:
            os.remove(tmp)
        except OSError:
            pass
    print("done", OUT)

if __name__ == "__main__":
    main()
