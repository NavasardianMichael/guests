"""Converts the fonter.am zips into self-hosted woff2 faces.

Usage: python -I scripts/fonts/build_fonts.py <dir-with-<slug>.zip> <repo-root>

Writes public/fonts/<slug>/<weight>[-italic].woff2 and public/fonts/manifest.json
({slug: [{weight, style, file}]}). `scripts/fonts/build-css.mjs` turns the manifest into
public/fonts/sheet-fonts.css. Re-run only when the font list in src/constants/fonts.ts changes;
see public/fonts/LICENSES.md for where each font comes from.
"""
import io
import json
import re
import sys
import zipfile
from pathlib import Path

from fontTools import subset
from fontTools.ttLib import TTFont

# Latin + Latin-1 + Latin Extended-A, Cyrillic, Armenian (with ֏), Armenian ligatures,
# general punctuation, currency signs, arrows, bullets/geometric shapes. A guest list needs nothing
# else, and FreeSerif shrinks from ~1.2MB to a fraction of that.
UNICODES = (
    list(range(0x20, 0x7F)) + list(range(0xA0, 0x180)) + list(range(0x400, 0x500))
    + list(range(0x530, 0x590)) + list(range(0xFB13, 0xFB18)) + list(range(0x2000, 0x2070))
    + list(range(0x20A0, 0x20C1)) + list(range(0x2190, 0x2200)) + list(range(0x25A0, 0x2600)) + [0x2116, 0x2122]
)

WEIGHT_WORDS = [
    ('extralight', 200), ('ultralight', 200), ('extrabold', 800), ('ultrabold', 800), ('extbld', 800),
    ('semibold', 600), ('demibold', 600), ('thin', 100), ('light', 300), ('medium', 500),
    ('black', 900), ('heavy', 900), ('bold', 700), ('bld', 700), ('regular', 400), ('book', 400),
]
SKIP = re.compile(r'Montserrat Original|__MACOSX', re.I)


def name_of(font: TTFont, *ids: int) -> str:
    for name_id in ids:
        record = font['name'].getDebugName(name_id)
        if record:
            return record
    return ''


def detect(font: TTFont, filename: str) -> tuple[int, str]:
    sub = f"{name_of(font, 17, 2)} {Path(filename).stem}".lower().replace(' ', '').replace('-', '').replace('_', '')
    weight = None
    for word, value in WEIGHT_WORDS:
        if word in sub:
            weight = value
            break
    if weight is None:
        weight = font['OS/2'].usWeightClass if 'OS/2' in font else 400
        weight = min(900, max(100, round(weight / 100) * 100))
    italic = bool(font['OS/2'].fsSelection & 1) if 'OS/2' in font else False
    italic = italic or bool(re.search(r'italic|oblique|blit|rit$|_it$', sub))
    return weight, 'italic' if italic else 'normal'


def main() -> None:
    zips, root = Path(sys.argv[1]), Path(sys.argv[2])
    out_root = root / 'public' / 'fonts'
    manifest: dict[str, list[dict]] = {}
    for archive in sorted(zips.glob('*.zip')):
        slug = archive.stem
        faces: dict[tuple[int, str], dict] = {}
        with zipfile.ZipFile(archive) as zf:
            for info in zf.infolist():
                if info.is_dir() or SKIP.search(info.filename):
                    continue
                if not re.search(r'\.(otf|ttf)$', info.filename, re.I):
                    continue
                font = TTFont(io.BytesIO(zf.read(info)))
                weight, style = detect(font, info.filename)
                if (weight, style) in faces:
                    continue
                fs_type = font['OS/2'].fsType if 'OS/2' in font else 0
                file_name = f"{weight}{'-italic' if style == 'italic' else ''}.woff2"
                target = out_root / slug / file_name
                target.parent.mkdir(parents=True, exist_ok=True)
                options = subset.Options()
                options.flavor = 'woff2'
                options.layout_features = ['*']
                options.name_IDs = ['*']
                options.notdef_outline = True
                subsetter = subset.Subsetter(options)
                subsetter.populate(unicodes=UNICODES)
                subsetter.subset(font)
                font.flavor = 'woff2'
                font.save(target)
                faces[(weight, style)] = {'weight': weight, 'style': style, 'file': f'{slug}/{file_name}'}
                print(f'{slug:24} {info.filename:55} -> {file_name:16} fsType={fs_type} {target.stat().st_size // 1024}KB')
        # A single-face family flagged italic (Davel Aghvor) is its regular face.
        if faces and all(style == 'italic' for _, style in faces):
            renamed = {}
            for (weight, _), face in faces.items():
                normal = out_root / slug / f'{weight}.woff2'
                (out_root / face['file']).replace(normal)
                renamed[(weight, 'normal')] = {'weight': weight, 'style': 'normal', 'file': f'{slug}/{weight}.woff2'}
            faces = renamed
        manifest[slug] = sorted(faces.values(), key=lambda f: (f['style'], f['weight']))
    (out_root / 'manifest.json').write_text(json.dumps(manifest, indent=2) + '\n', encoding='utf-8')


if __name__ == '__main__':
    main()
