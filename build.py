#!/usr/bin/env python3
"""Build single-file index.html (fonts + Ava audio inlined)."""
import base64, json, os, sys
HERE = os.path.dirname(os.path.abspath(__file__))
B = os.path.join(HERE, "build"); S = os.path.join(HERE, "src")
b64 = lambda p: base64.b64encode(open(os.path.join(B, p), "rb").read()).decode()
css = open(os.path.join(S, "style.css"), encoding="utf-8").read()
css = css.replace("__N300I__", b64("n300i.ttf")).replace("__N600__", b64("n600.ttf")).replace("__AEONIS__", b64("aeonis.ttf"))
js = open(os.path.join(S, "game.js"), encoding="utf-8").read()
SOUNDS = ["los-gehts", "prima", "nee"]
AUD = os.path.join(HERE, "audio")
snd = {n: base64.b64encode(open(os.path.join(AUD, n + ".mp3"), "rb").read()).decode() for n in SOUNDS}
js = js.replace("__SOUNDS__", json.dumps(snd, separators=(",", ":")))
PAGES = "--pages" in sys.argv
head = ""
if PAGES:
    head = "\n".join([
        '<meta name="theme-color" content="#dd007a">',
        '<link rel="manifest" href="manifest.webmanifest">',
        '<link rel="icon" href="assets/favicon.svg" type="image/svg+xml">',
        '<link rel="icon" type="image/png" sizes="16x16" href="assets/favicon-16.png">',
        '<link rel="icon" type="image/png" sizes="32x32" href="assets/favicon-32.png">',
        '<link rel="icon" type="image/png" sizes="48x48" href="assets/favicon-48.png">',
        '<link rel="icon" type="image/png" sizes="192x192" href="assets/icon-192.png">',
        '<link rel="icon" type="image/png" sizes="512x512" href="assets/icon-512.png">',
        '<link rel="shortcut icon" href="assets/favicon.ico">',
        '<link rel="apple-touch-icon" href="assets/apple-touch-icon.png">',
        '<link rel="apple-touch-icon" sizes="180x180" href="assets/apple-touch-icon.png">',
        '<link rel="apple-touch-icon" sizes="167x167" href="assets/apple-touch-icon-167.png">',
        '<link rel="apple-touch-icon" sizes="152x152" href="assets/apple-touch-icon-152.png">',
        '<link rel="apple-touch-icon" sizes="120x120" href="assets/apple-touch-icon-120.png">',
    ]) + "\n"
html = open(os.path.join(S, "index.html"), encoding="utf-8").read().replace("__HEAD__", head).replace("__CSS__", css).replace("__JS__", js)
out = sys.argv[sys.argv.index("--out") + 1] if "--out" in sys.argv else os.path.join(HERE, "index.html")
open(out, "w", encoding="utf-8").write(html)
print(out, os.path.getsize(out))
