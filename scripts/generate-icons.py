#!/usr/bin/env python3
"""Generate Yulu HSK studio-crafted PWA and Apple Touch icons."""

from __future__ import annotations

import math
from pathlib import Path
from PIL import Image, ImageDraw, ImageFilter, ImageFont

ROOT = Path(__file__).resolve().parent.parent
OUT_DIR = ROOT / "public" / "icons"
SIZE = 1024

# Design tokens matching src/styles/design-system.css
JADE_TOP_LEFT = (31, 84, 78)      # #1f544e
JADE_CENTER = (39, 102, 95)       # #27665f
JADE_BOTTOM_RIGHT = (22, 61, 57)  # #163d39
GLOW_COLOR = (231, 215, 185)      # #e7d7b9 warm ceramic/gold sheen
RING_GOLD = (231, 215, 185, 220)  # #e7d7b9
RING_WHITE = (255, 255, 255, 88)  # subtle porcelain inner hairline
GLYPH_COLOR = (251, 253, 251, 255)  # #fbfdfb porcelain white
SHADOW_COLOR = (9, 31, 29, 130)   # deep jade depth shadow

FONT_CANDIDATES: list[tuple[str, list[int]]] = [
    ("/System/Library/Fonts/Supplemental/Songti.ttc", [1, 0, 4]),
    ("/System/Library/Fonts/Songti.ttc", [1, 0, 4]),
    ("/System/Library/Fonts/PingFang.ttc", [2, 1, 0]),
    ("/System/Library/Fonts/STHeiti Medium.ttc", [1, 0]),
    ("/System/Library/Fonts/Hiragino Sans GB.ttc", [2, 0]),
    ("/Library/Fonts/Arial Unicode.ttf", [0]),
    ("/System/Library/Fonts/Supplemental/Arial Unicode.ttf", [0]),
]


def load_cjk_font(size: int) -> tuple[ImageFont.FreeTypeFont, str]:
    """Probe macOS CJK fonts and verify '语' renders cleanly with non-boxy metrics."""
    for path_str, indices in FONT_CANDIDATES:
        path = Path(path_str)
        if not path.exists():
            continue
        for idx in indices:
            try:
                font = ImageFont.truetype(str(path), size=size, index=idx)
                mask = font.getmask("语")
                bbox = mask.getbbox()
                if not bbox:
                    continue
                w = bbox[2] - bbox[0]
                h = bbox[3] - bbox[1]
                # Reject missing-glyph placeholder boxes or degenerate metrics
                if w >= size * 0.45 and h >= size * 0.45:
                    name = " ".join(str(p) for p in font.getname())
                    return font, f"{path.name}[{idx}] ({name})"
            except Exception:
                continue
    raise RuntimeError("No usable macOS CJK font found for character '语'.")


def lerp_rgb(a: tuple[int, int, int], b: tuple[int, int, int], t: float) -> tuple[int, int, int]:
    t = max(0.0, min(1.0, t))
    return (
        int(round(a[0] + (b[0] - a[0]) * t)),
        int(round(a[1] + (b[1] - a[1]) * t)),
        int(round(a[2] + (b[2] - a[2]) * t)),
    )


def build_jade_backdrop(size: int) -> Image.Image:
    """Create a smooth 3-stop deep-jade gradient with a warm ceramic upper-left glow."""
    # Render gradient on 256x256 and smoothly upscale with LANCZOS for artifact-free silk tone
    grid = 256
    base = Image.new("RGBA", (grid, grid))
    px = base.load()
    assert px is not None

    for y in range(grid):
        ny = y / (grid - 1)
        for x in range(grid):
            nx = x / (grid - 1)
            # Diagonal blend from top-left (0) -> center (0.5) -> bottom-right (1)
            diag = (nx + ny) * 0.5
            if diag <= 0.5:
                r, g, b = lerp_rgb(JADE_TOP_LEFT, JADE_CENTER, diag * 2.0)
            else:
                r, g, b = lerp_rgb(JADE_CENTER, JADE_BOTTOM_RIGHT, (diag - 0.5) * 2.0)

            # Soft ceramic radial glow in upper-left quadrant
            dx = nx - 0.25
            dy = ny - 0.22
            dist = math.sqrt(dx * dx + dy * dy)
            glow = max(0.0, 1.0 - dist / 0.72)
            glow = (glow * glow) * 0.14
            r = min(255, int(round(r + (GLOW_COLOR[0] - r) * glow)))
            g = min(255, int(round(g + (GLOW_COLOR[1] - g) * glow)))
            b = min(255, int(round(b + (GLOW_COLOR[2] - b) * glow)))

            # Delicate outer vignette for sculptural depth
            cx = nx - 0.5
            cy = ny - 0.5
            edge = math.sqrt(cx * cx + cy * cy) / 0.7071
            vignette = max(0.0, edge - 0.55) / 0.45
            shade = vignette * vignette * 0.14
            r = max(0, int(round(r * (1.0 - shade))))
            g = max(0, int(round(g * (1.0 - shade))))
            b = max(0, int(round(b * (1.0 - shade))))
            px[x, y] = (r, g, b, 255)

    return base.resize((size, size), Image.Resampling.LANCZOS)


def render_icon(
    *,
    ring_outer_radius: int,
    ring_inner_radius: int,
    ring_outer_width: int,
    ring_inner_width: int,
    glyph_size: int,
    shadow_offset: tuple[int, int],
    shadow_blur: int,
) -> Image.Image:
    """Render a 1024x1024 opaque RGB master icon."""
    canvas = build_jade_backdrop(SIZE)
    ring_layer = Image.new("RGBA", (SIZE, SIZE), (0, 0, 0, 0))
    ring_draw = ImageDraw.Draw(ring_layer)
    cx = SIZE // 2
    cy = SIZE // 2

    ring_draw.ellipse(
        (
            cx - ring_outer_radius,
            cy - ring_outer_radius,
            cx + ring_outer_radius,
            cy + ring_outer_radius,
        ),
        outline=RING_GOLD,
        width=ring_outer_width,
    )
    ring_draw.ellipse(
        (
            cx - ring_inner_radius,
            cy - ring_inner_radius,
            cx + ring_inner_radius,
            cy + ring_inner_radius,
        ),
        outline=RING_WHITE,
        width=ring_inner_width,
    )
    canvas = Image.alpha_composite(canvas, ring_layer)

    # Render '语' onto scratch canvas and crop to exact ink bbox so centering is geometric
    font, font_label = load_cjk_font(glyph_size)
    scratch_dim = glyph_size * 2
    scratch = Image.new("RGBA", (scratch_dim, scratch_dim), (0, 0, 0, 0))
    sdraw = ImageDraw.Draw(scratch)
    sdraw.text((scratch_dim // 4, scratch_dim // 4), "语", font=font, fill=GLYPH_COLOR)
    bbox = scratch.getbbox()
    if not bbox:
        raise RuntimeError(f"Failed to render '语' using {font_label}")

    glyph = scratch.crop(bbox)
    gw, gh = glyph.size
    gx = round((SIZE - gw) / 2)
    gy = round((SIZE - gh) / 2)

    # Soft depth shadow underneath the porcelain glyph
    shadow_alpha = glyph.getchannel("A")
    shadow_glyph = Image.new("RGBA", (gw, gh), SHADOW_COLOR[:3] + (0,))
    scaled_alpha = shadow_alpha.point(lambda a: int(a * (SHADOW_COLOR[3] / 255.0)))
    shadow_glyph.putalpha(scaled_alpha)

    shadow_layer = Image.new("RGBA", (SIZE, SIZE), (0, 0, 0, 0))
    shadow_layer.paste(shadow_glyph, (gx + shadow_offset[0], gy + shadow_offset[1]))
    shadow_layer = shadow_layer.filter(ImageFilter.GaussianBlur(radius=shadow_blur))
    canvas = Image.alpha_composite(canvas, shadow_layer)

    glyph_layer = Image.new("RGBA", (SIZE, SIZE), (0, 0, 0, 0))
    glyph_layer.paste(glyph, (gx, gy))
    canvas = Image.alpha_composite(canvas, glyph_layer)

    # Strictly opaque RGB (required for Apple Touch Icon and seamless adaptive masking)
    return canvas.convert("RGB")


def write_svg(path: Path) -> None:
    """Write crisp vector favicon matching the jade-and-gold Yulu seal."""
    svg = """<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" role="img" aria-label="Yulu">
  <defs>
    <linearGradient id="jade" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#1f544e" />
      <stop offset="50%" stop-color="#27665f" />
      <stop offset="100%" stop-color="#163d39" />
    </linearGradient>
    <radialGradient id="glow" cx="26%" cy="22%" r="65%">
      <stop offset="0%" stop-color="#e7d7b9" stop-opacity="0.16" />
      <stop offset="100%" stop-color="#e7d7b9" stop-opacity="0" />
    </radialGradient>
    <filter id="shadow" x="-15%" y="-15%" width="130%" height="135%">
      <feDropShadow dx="0" dy="5" stdDeviation="6" flood-color="#091f1d" flood-opacity="0.48" />
    </filter>
  </defs>
  <rect width="512" height="512" rx="116" fill="url(#jade)" />
  <rect width="512" height="512" rx="116" fill="url(#glow)" />
  <circle cx="256" cy="256" r="192" fill="none" stroke="#e7d7b9" stroke-opacity="0.86" stroke-width="3.5" />
  <circle cx="256" cy="256" r="182" fill="none" stroke="#ffffff" stroke-opacity="0.34" stroke-width="1.25" />
  <text
    x="256"
    y="264"
    text-anchor="middle"
    dominant-baseline="central"
    fill="#fbfdfb"
    filter="url(#shadow)"
    font-family="'Songti SC', 'Noto Serif SC', 'STSong', 'PingFang SC', serif"
    font-weight="700"
    font-size="258"
  >语</text>
</svg>
"""
    path.write_text(svg, encoding="utf-8")


def main() -> None:
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    _, font_label = load_cjk_font(500)
    print(f"Using font: {font_label}")

    standard_master = render_icon(
        ring_outer_radius=384,
        ring_inner_radius=364,
        ring_outer_width=6,
        ring_inner_width=2,
        glyph_size=496,
        shadow_offset=(0, 12),
        shadow_blur=14,
    )
    # >= 20% margin on every side (outer ring diameter 592 / 1024 = 57.8%, margin = 21.1% each side)
    maskable_master = render_icon(
        ring_outer_radius=296,
        ring_inner_radius=280,
        ring_outer_width=5,
        ring_inner_width=2,
        glyph_size=364,
        shadow_offset=(0, 9),
        shadow_blur=11,
    )

    outputs = [
        (standard_master, 180, "apple-touch-icon.png"),
        (standard_master, 192, "icon-192.png"),
        (standard_master, 512, "icon-512.png"),
        (maskable_master, 512, "icon-maskable-512.png"),
    ]
    for master, dim, filename in outputs:
        dest = OUT_DIR / filename
        resized = master.resize((dim, dim), Image.Resampling.LANCZOS)
        assert resized.mode == "RGB", f"Expected RGB mode for {filename}, got {resized.mode}"
        resized.save(dest, format="PNG", optimize=True)
        print(f"Wrote {dest.relative_to(ROOT)} ({dim}x{dim}, {resized.mode})")

    svg_path = OUT_DIR / "favicon.svg"
    write_svg(svg_path)
    print(f"Wrote {svg_path.relative_to(ROOT)}")


if __name__ == "__main__":
    main()
