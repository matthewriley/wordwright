from pathlib import Path
import shutil, struct, zipfile
from PIL import Image, ImageDraw
import cairosvg

ROOT = Path('/mnt/data/Wordwright-Icons-v3')
ZIP = Path('/mnt/data/Wordwright-Icons-v3.zip')
BASE = '#CC6C4D'  # W
SOFT = '#F6E4DB'  # tile background
DEEP = '#9E4F36'  # arrow
PAGE = '#FFF9F6'
FOLD = '#F3D3C4'

WINDOWS_SIZES = [16,20,24,30,32,36,40,48,60,64,72,80,96,128,256,512]
ICO_SIZES = [16,20,24,32,40,48,64,128,256]
MAC_ICONSET = {
    'icon_16x16.png': 16,
    'icon_16x16@2x.png': 32,
    'icon_32x32.png': 32,
    'icon_32x32@2x.png': 64,
    'icon_128x128.png': 128,
    'icon_128x128@2x.png': 256,
    'icon_256x256.png': 256,
    'icon_256x256@2x.png': 512,
    'icon_512x512.png': 512,
    'icon_512x512@2x.png': 1024,
}
BADGE_SIZES = [16,32,64,128,256,512,1024]

# Option 5 Minimal Mark geometry.
# The five upper extrema are intentionally aligned at y=84 so the W reads
# as level across the top, matching the accepted concept reference.
W_POINTS = [
    (38,84),   # outer left top
    (95,180),
    (127,135),
    (158,180),
    (215,84),  # outer right top
    (179,84),  # inner right top
    (155,121),
    (125,84),  # center peak aligned with outer tops
    (97,121),
    (73,84),   # inner left top
]

ARROW_PATH = 'M198 158 L198 207 M178 188 L198 208 L218 188'


def reset():
    if ROOT.exists():
        shutil.rmtree(ROOT)
    for p in [
        ROOT/'source', ROOT/'reference', ROOT/'preview',
        ROOT/'windows/app/png', ROOT/'windows/document/png',
        ROOT/'macos/app/Wordwright.iconset',
        ROOT/'macos/document/WordwrightMarkdown.iconset',
        ROOT/'macos/document/badge'
    ]:
        p.mkdir(parents=True, exist_ok=True)


def pts(points):
    return ' '.join(f'{x},{y}' for x,y in points)


def mark_group(scale=1.0, tx=0.0, ty=0.0):
    # W uses Base terracotta. Arrow uses Deep terracotta.
    return f'''<g transform="translate({tx} {ty}) scale({scale})">
  <polygon points="{pts(W_POINTS)}" fill="{BASE}"/>
  <path d="{ARROW_PATH}" fill="none" stroke="{DEEP}" stroke-width="11" stroke-linecap="round" stroke-linejoin="round"/>
</g>'''


def app_svg():
    return f'''<svg xmlns="http://www.w3.org/2000/svg" width="256" height="256" viewBox="0 0 256 256">
  <rect x="7" y="7" width="242" height="242" rx="42" fill="{SOFT}"/>
  <rect x="7.5" y="7.5" width="241" height="241" rx="41.5" fill="none" stroke="{DEEP}" stroke-opacity="0.10"/>
  {mark_group()}
</svg>'''


def transparent_mark_svg():
    return f'''<svg xmlns="http://www.w3.org/2000/svg" width="256" height="256" viewBox="0 0 256 256">
  {mark_group()}
</svg>'''


def document_svg(include_label=True):
    label = f'<text x="128" y="218" text-anchor="middle" font-family="Arial, Helvetica, sans-serif" font-size="25" font-weight="700" fill="{BASE}">.md</text>' if include_label else ''
    mg = mark_group(scale=0.62, tx=23.0, ty=57.0)
    return f'''<svg xmlns="http://www.w3.org/2000/svg" width="256" height="256" viewBox="0 0 256 256">
  <path d="M42 18 H166 L214 66 V234 H42 Q31 234 31 223 V29 Q31 18 42 18 Z" fill="{PAGE}" stroke="{DEEP}" stroke-opacity="0.13" stroke-width="1.5"/>
  <path d="M166 18 V57 Q166 66 175 66 H214 Z" fill="{FOLD}" stroke="{DEEP}" stroke-opacity="0.10" stroke-width="1.2" stroke-linejoin="round"/>
  {mg}
  {label}
</svg>'''


def render(svg, size, out):
    out.parent.mkdir(parents=True, exist_ok=True)
    cairosvg.svg2png(bytestring=svg.encode(), write_to=str(out), output_width=size, output_height=size)


def write_ico(path, png_paths):
    # Resizes down from the largest of the already-rendered per-size PNGs,
    # letting Pillow's own ICO writer pick the right per-size internal
    # encoding. Replaces an earlier manual struct-packed writer that wrote
    # every size as raw PNG bytes directly — live Windows testing (a
    # blurry taskbar icon, eventually traced to VM-specific DPI-scaling
    # rendering, not the file itself) prompted rebuilding via Pillow as
    # part of ruling that out; keeping Pillow's approach here since it's
    # the better-tested path and produced an equally valid file.
    images = [Image.open(p) for p in png_paths]
    master = max(images, key=lambda im: im.width).convert('RGBA')
    master.save(path, format='ICO', sizes=[im.size for im in images])


def write_icns(path, icon_dir):
    chunks=[
        (b'icp4','icon_16x16.png'),(b'ic11','icon_16x16@2x.png'),
        (b'icp5','icon_32x32.png'),(b'ic12','icon_32x32@2x.png'),
        (b'icp6','icon_32x32@2x.png'),(b'ic07','icon_128x128.png'),
        (b'ic13','icon_128x128@2x.png'),(b'ic08','icon_256x256.png'),
        (b'ic14','icon_256x256@2x.png'),(b'ic09','icon_512x512.png'),
        (b'ic10','icon_512x512@2x.png')]
    payload=bytearray()
    for typ,name in chunks:
        data=(icon_dir/name).read_bytes()
        payload += typ+struct.pack('>I',len(data)+8)+data
    path.write_bytes(b'icns'+struct.pack('>I',len(payload)+8)+payload)


def make_preview():
    canvas=Image.new('RGB',(1700,1120),'white')
    d=ImageDraw.Draw(canvas)
    d.text((55,35),'Wordwright production icon preview v3',fill='#222222')
    d.text((55,68),'Corrections: level W top + Deep terracotta arrow',fill='#555555')
    d.text((55,98),f'W: {BASE}    Arrow: {DEEP}    Background: {SOFT}',fill='#555555')

    # Large reference render with alignment guide.
    large = Image.open(ROOT/'windows/app/png/wordwright-256.png').convert('RGBA').resize((384,384),Image.Resampling.LANCZOS)
    canvas.paste(large,(60,155),large)
    # y=84 in a 256 source rendered to 384, plus tile placement
    guide_y = 155 + round(84 * 384 / 256)
    d.line((60,guide_y,444,guide_y),fill='#111827',width=3)
    d.text((60,545),'256 px production icon with top-alignment guide',fill='#333333')

    d.text((510,155),'App icon sizes',fill='#222222')
    y=200; x=510
    for s in [16,20,24,32,48,64,96,128,256]:
        im=Image.open(ROOT/f'windows/app/png/wordwright-{s}.png').convert('RGBA')
        disp=80 if s<=24 else max(80,s)
        rs=Image.Resampling.NEAREST if s<=24 else Image.Resampling.LANCZOS
        im=im.resize((disp,disp),rs); canvas.paste(im,(x,y),im)
        d.text((x,y+disp+8),f'{s}px',fill='#333333'); x += disp+35
        if x > 1580:
            y += 180; x=510

    d.text((55,680),'Markdown document icons',fill='#222222')
    y=730; x=55
    for s in [16,24,32,48,64,96,128,256]:
        im=Image.open(ROOT/f'windows/document/png/wordwright-markdown-{s}.png').convert('RGBA')
        disp=90 if s<=24 else max(90,s)
        rs=Image.Resampling.NEAREST if s<=24 else Image.Resampling.LANCZOS
        im=im.resize((disp,disp),rs); canvas.paste(im,(x,y),im)
        d.text((x,y+disp+8),f'{s}px',fill='#333333'); x += disp+45
    canvas.save(ROOT/'preview/wordwright-icon-preview.png')


def build():
    reset()

    (ROOT/'source/wordwright-app.svg').write_text(app_svg())
    (ROOT/'source/wordwright-mark.svg').write_text(transparent_mark_svg())
    (ROOT/'source/wordwright-markdown.svg').write_text(document_svg(True))
    (ROOT/'source/wordwright-markdown-small.svg').write_text(document_svg(False))

    # Preserve both the accepted board and the user's comparison image as QA references.
    approved=Path('/mnt/data/a_clean_flat_modern_style_brand_guideline_poster.png')
    if approved.exists():
        shutil.copy2(approved, ROOT/'reference/accepted-option-5-board.png')
    comparison=Path('/mnt/data/image.png')
    if comparison.exists():
        shutil.copy2(comparison, ROOT/'reference/user-comparison-v2.png')

    for s in WINDOWS_SIZES:
        render(app_svg(),s,ROOT/f'windows/app/png/wordwright-{s}.png')
        render(document_svg(include_label=s>=32),s,ROOT/f'windows/document/png/wordwright-markdown-{s}.png')
    write_ico(ROOT/'windows/wordwright.ico',[ROOT/f'windows/app/png/wordwright-{s}.png' for s in ICO_SIZES])
    write_ico(ROOT/'windows/wordwright-markdown.ico',[ROOT/f'windows/document/png/wordwright-markdown-{s}.png' for s in ICO_SIZES])

    appdir=ROOT/'macos/app/Wordwright.iconset'; docdir=ROOT/'macos/document/WordwrightMarkdown.iconset'
    for name,s in MAC_ICONSET.items():
        render(app_svg(),s,appdir/name)
        render(document_svg(include_label=s>=32),s,docdir/name)
    write_icns(ROOT/'macos/app/Wordwright.icns',appdir)
    write_icns(ROOT/'macos/document/WordwrightMarkdown.icns',docdir)
    for s in BADGE_SIZES:
        render(transparent_mark_svg(),s,ROOT/f'macos/document/badge/wordwright-mark-{s}.png')

    make_preview()

    readme=f'''# Wordwright Icon Package v3

Production assets for the accepted **Option 5: Minimal Mark** configuration.

## Visual source of truth

Version 3 applies two explicit corrections from visual QA against the accepted concept:

1. **Level W top:** the left top, center peak, and right top are aligned to the same horizontal level.
2. **Two-color mark:** the W uses Base terracotta and the down arrow uses Deep terracotta.

Colors:

- W / Base terracotta: `{BASE}`
- Arrow / Deep terracotta: `{DEEP}`
- App tile / Soft cream: `{SOFT}`
- App appearance: light only

The accepted concept board is preserved at `reference/accepted-option-5-board.png`. The comparison image that motivated the v3 corrections is preserved at `reference/user-comparison-v2.png`.

## Source files

- `source/wordwright-app.svg` - canonical application icon
- `source/wordwright-mark.svg` - transparent W + arrow mark
- `source/wordwright-markdown.svg` - canonical Markdown document icon
- `source/wordwright-markdown-small.svg` - small document variant without `.md`

## Windows

- `windows/wordwright.ico`: 16, 20, 24, 32, 40, 48, 64, 128, 256 px
- `windows/wordwright-markdown.ico`: same embedded sizes
- Individual PNGs are in `windows/app/png` and `windows/document/png`.

## macOS

- `macos/app/Wordwright.icns`
- `macos/app/Wordwright.iconset/` contains 1x/2x source PNGs through 1024 px
- `macos/document/WordwrightMarkdown.icns`
- `macos/document/WordwrightMarkdown.iconset/`
- `macos/document/badge/` contains transparent W + arrow assets for native document composition

## Regeneration

Run `generate_icons.py` with Python, Pillow, and CairoSVG installed. All generated formats derive from the same SVG geometry and color constants.
'''
    (ROOT/'README.md').write_text(readme)
    shutil.copy2('/mnt/data/build_wordwright_icons_v3.py',ROOT/'generate_icons.py')

    if ZIP.exists():
        ZIP.unlink()
    with zipfile.ZipFile(ZIP,'w',zipfile.ZIP_DEFLATED) as z:
        for p in ROOT.rglob('*'):
            if p.is_file():
                z.write(p,p.relative_to(ROOT.parent))

    print(ROOT)
    print(ZIP)

build()
