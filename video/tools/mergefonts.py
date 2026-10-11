import sys, glob, os, re
from fontTools.ttLib import TTFont
from fontTools.merge import Merger
src, out, tmp = sys.argv[1:4]
groups = {}
for f in glob.glob(os.path.join(src, "*/package/files/*-normal.woff2")):
    m = re.match(r"(.+)-(hebrew|latin)-(\d+)-normal\.woff2$", os.path.basename(f))
    if m: groups.setdefault((m[1], m[3]), {})[m[2]] = f
ok, bad = [], []
for (fam, w), parts in sorted(groups.items()):
    if "hebrew" not in parts: continue
    ttfs = []
    for k in ("hebrew", "latin"):
        if k in parts:
            t = TTFont(parts[k]); t.flavor = None
            p = os.path.join(tmp, f"{fam}-{k}-{w}.ttf"); t.save(p); ttfs.append(p)
    dst = os.path.join(out, f"{fam}-{w}.ttf")
    try:
        Merger().merge(ttfs).save(dst); ok.append(f"{fam}-{w}")
    except Exception as e:
        # fallback: install subsets separately (fontconfig falls back per glyph)
        for p in ttfs: TTFont(p).save(os.path.join(out, os.path.basename(p)))
        bad.append(f"{fam}-{w}")
print("merged:", len(ok), "| separate:", bad)
