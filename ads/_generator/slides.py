"""
Instagram slideshow ad generator for the Big Bass Bash weigh-in helper.
Produces 5 square 1080x1080 PNGs.
"""

from PIL import Image, ImageDraw, ImageFont, ImageFilter
from pathlib import Path

OUT_DIR = Path("/sessions/zealous-wizardly-galileo/mnt/314-apps.com/ads")
OUT_DIR.mkdir(parents=True, exist_ok=True)

W = H = 1080

FONT_DIR = Path("/usr/share/fonts/truetype/google-fonts")
F_BOLD = str(FONT_DIR / "Poppins-Bold.ttf")
F_MED = str(FONT_DIR / "Poppins-Medium.ttf")
F_REG = str(FONT_DIR / "Poppins-Regular.ttf")
F_LIGHT = str(FONT_DIR / "Poppins-Light.ttf")

# palette — deep lake navy with sunrise accents
NAVY = (10, 45, 79)
NAVY_DEEP = (5, 24, 44)
TEAL = (30, 90, 120)
GOLD = (247, 183, 49)
ORANGE = (255, 140, 66)
CREAM = (247, 243, 233)
WHITE = (255, 255, 255)
MUTED = (180, 195, 215)


def f(path, size):
    return ImageFont.truetype(path, size)


def bg_gradient(top, bottom):
    base = Image.new("RGB", (1, H))
    for y in range(H):
        t = y / (H - 1)
        r = int(top[0] + (bottom[0] - top[0]) * t)
        g = int(top[1] + (bottom[1] - top[1]) * t)
        b = int(top[2] + (bottom[2] - top[2]) * t)
        base.putpixel((0, y), (r, g, b))
    return base.resize((W, H))


def new_canvas():
    return bg_gradient(NAVY, NAVY_DEEP).convert("RGBA")


def sun_glow(img, center, radius, color=(247, 183, 49), alpha=90):
    """Soft radial glow overlay, composited onto img."""
    glow = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    gd = ImageDraw.Draw(glow)
    steps = 24
    for i in range(steps, 0, -1):
        r = int(radius * (i / steps))
        a = int(alpha * (1 - i / steps) ** 1.6)
        gd.ellipse(
            [center[0] - r, center[1] - r, center[0] + r, center[1] + r],
            fill=(color[0], color[1], color[2], a),
        )
    glow = glow.filter(ImageFilter.GaussianBlur(radius=18))
    img.alpha_composite(glow)


def water_shimmer(img):
    over = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    od = ImageDraw.Draw(over)
    import random
    random.seed(7)
    for _ in range(140):
        y = random.randint(int(H * 0.55), H - 20)
        x1 = random.randint(0, W)
        length = random.randint(20, 120)
        a = random.randint(10, 45)
        od.line([(x1, y), (x1 + length, y)], fill=(255, 255, 255, a), width=1)
    img.alpha_composite(over)


def overlay_pill(img, x, y, text, font, bg_rgba, fg, pad_x=22, pad_y=12):
    """Translucent pill — drawn on a transparent overlay and composited."""
    # Measure text
    tmp = Image.new("RGBA", (1, 1))
    td = ImageDraw.Draw(tmp)
    bbox = td.textbbox((0, 0), text, font=font)
    tw = bbox[2] - bbox[0]
    th = bbox[3] - bbox[1]
    w = tw + pad_x * 2
    h = th + pad_y * 2 + 4

    layer = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    ld = ImageDraw.Draw(layer)
    ld.rounded_rectangle([0, 0, w, h], radius=h // 2, fill=bg_rgba)
    ld.text((pad_x - bbox[0], pad_y - bbox[1]), text, font=font, fill=fg)
    img.alpha_composite(layer, (x, y))
    return x + w, y + h


def overlay_circle(img, cx, cy, r, fill_rgba, outline_rgba=None, outline_w=0):
    layer = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    ld = ImageDraw.Draw(layer)
    ld.ellipse([cx - r, cy - r, cx + r, cy + r], fill=fill_rgba,
               outline=outline_rgba, width=outline_w)
    img.alpha_composite(layer)


def badge_slide_number(img, idx, total=5):
    r = 38
    cx, cy = W - 80, 80
    overlay_circle(img, cx, cy, r, fill_rgba=(255, 255, 255, 55),
                   outline_rgba=(255, 255, 255, 180), outline_w=2)
    d = ImageDraw.Draw(img)
    t = f"{idx}/{total}"
    font = f(F_BOLD, 24)
    bbox = d.textbbox((0, 0), t, font=font)
    tw = bbox[2] - bbox[0]
    th = bbox[3] - bbox[1]
    d.text((cx - tw / 2 - bbox[0], cy - th / 2 - bbox[1]), t, font=font, fill=WHITE)


def draw_wordmark(d, x, y, size=36, base_color=WHITE, accent_color=GOLD, weight="bold"):
    """Render BigBassIQ with IQ in an accent color."""
    font_base = f(F_BOLD if weight == "bold" else F_MED, size)
    font_iq = f(F_BOLD, size)
    base_text = "BigBass"
    iq_text = "IQ"
    bbox = d.textbbox((0, 0), base_text, font=font_base)
    base_w = bbox[2] - bbox[0]
    d.text((x - bbox[0], y - bbox[1]), base_text, font=font_base, fill=base_color)
    iq_x = x + base_w - bbox[0]
    iq_bbox = d.textbbox((0, 0), iq_text, font=font_iq)
    d.text((iq_x + 2 - iq_bbox[0], y - iq_bbox[1]), iq_text, font=font_iq, fill=accent_color)
    return iq_x + 2 + (iq_bbox[2] - iq_bbox[0])


def brand_footer(img, alpha=200):
    """Subtle BigBassIQ footer wordmark bottom-left."""
    d = ImageDraw.Draw(img)
    draw_wordmark(d, 60, H - 70, size=32,
                  base_color=(255, 255, 255, alpha),
                  accent_color=(247, 183, 49, 255))


def draw_arrow(d, x, y, color=WHITE, length=60, thickness=6):
    """Draw a simple right-pointing arrow via primitives."""
    # shaft
    d.rounded_rectangle([x, y - thickness // 2, x + length - 20, y + thickness // 2],
                        radius=thickness // 2, fill=color)
    # head
    d.polygon([(x + length - 26, y - 18),
               (x + length, y),
               (x + length - 26, y + 18)], fill=color)


# ---------------- slides ----------------

def slide_1():
    img = new_canvas()
    sun_glow(img, (W // 2, int(H * 0.28)), 520, color=GOLD, alpha=140)
    sun_glow(img, (int(W * 0.15), int(H * 0.1)), 280, color=ORANGE, alpha=90)
    water_shimmer(img)

    # eyebrow pill
    overlay_pill(img, 60, 70, "BIG BASS BASH  ·  LAKE OF THE OZARKS",
                 f(F_BOLD, 26), bg_rgba=(255, 255, 255, 55), fg=WHITE)

    d = ImageDraw.Draw(img)

    # Hook — strategic "now vs. wait" angle
    d.text((60, 260), "Weigh in now?", font=f(F_BOLD, 102), fill=WHITE)
    d.text((60, 372), "Or hold out", font=f(F_BOLD, 102), fill=WHITE)
    d.text((60, 484), "for a bigger", font=f(F_BOLD, 102), fill=GOLD)
    d.text((60, 596), "check?", font=f(F_BOLD, 102), fill=GOLD)

    # underline accent
    d.rounded_rectangle([60, 728, 260, 740], radius=6, fill=ORANGE)

    # Brand reveal
    draw_wordmark(d, 60, 770, size=74, base_color=WHITE, accent_color=GOLD)
    d.text((60, 870), "The strategic weigh-in co-pilot.",
           font=f(F_MED, 32), fill=(210, 222, 236))

    # swipe hint
    d.text((W - 200, H - 100), "SWIPE", font=f(F_BOLD, 26),
           fill=(255, 255, 255, 200))
    draw_arrow(d, W - 100, H - 88, color=GOLD, length=60, thickness=6)

    badge_slide_number(img, 1)
    return img


def slide_2():
    img = new_canvas()
    sun_glow(img, (int(W * 0.85), int(H * 0.15)), 380, color=ORANGE, alpha=110)
    water_shimmer(img)

    overlay_pill(img, 60, 70, "THE REAL QUESTION", f(F_BOLD, 26),
                 bg_rgba=(255, 255, 255, 55), fg=WHITE)

    d = ImageDraw.Draw(img)

    # headline
    d.text((60, 170), "Every window", font=f(F_BOLD, 96), fill=WHITE)
    d.text((60, 275), "is a different", font=f(F_BOLD, 96), fill=WHITE)
    d.text((60, 380), "shot at", font=f(F_BOLD, 96), fill=GOLD)
    d.text((60, 485), "cashing.", font=f(F_BOLD, 96), fill=GOLD)

    # comparison card: three windows side-by-side with pay-chance %
    card_x, card_y = 60, 630
    card_w, card_h = W - 120, 330
    # translucent card background — composited as its own layer
    layer = Image.new("RGBA", (card_w, card_h), (0, 0, 0, 0))
    ld = ImageDraw.Draw(layer)
    ld.rounded_rectangle([0, 0, card_w, card_h],
                         radius=22,
                         fill=(255, 255, 255, 35),
                         outline=(255, 255, 255, 130), width=2)
    # best-row highlight drawn on same translucent layer so it composites cleanly
    best_idx = 1
    row_y0 = 78
    ry_best = row_y0 + best_idx * 78
    ld.rounded_rectangle(
        [18, ry_best - 10, card_w - 18, ry_best + 62],
        radius=14,
        fill=(247, 183, 49, 240),
    )
    img.alpha_composite(layer, (card_x, card_y))

    # Now draw text over the composited card directly on img
    d.text((card_x + 26, card_y + 22),
           "YOUR 4.31 LB FISH  ·  CHANCE TO CASH",
           font=f(F_BOLD, 22), fill=WHITE)

    windows = [
        ("Window 3", "weigh now",     "38%", False),
        ("Window 4", "1:00 – 2:00 pm", "61%", True),
        ("Window 5", "2:00 – 3:00 pm", "44%", False),
    ]
    for i, (w_title, w_sub, pct, is_best) in enumerate(windows):
        ry = card_y + row_y0 + i * 78

        d.text((card_x + 32, ry - 2), w_title,
               font=f(F_BOLD, 34),
               fill=NAVY_DEEP if is_best else WHITE)
        sub_text = w_sub
        if is_best:
            sub_text = w_sub + "  ·  BEST SHOT"
        d.text((card_x + 32, ry + 38), sub_text,
               font=f(F_BOLD if is_best else F_REG, 22),
               fill=NAVY_DEEP if is_best else (200, 212, 228))

        pct_color = NAVY_DEEP if is_best else WHITE
        pct_font = f(F_BOLD, 52)
        bbox = d.textbbox((0, 0), pct, font=pct_font)
        pw = bbox[2] - bbox[0]
        d.text((card_x + card_w - 40 - pw, ry - 4),
               pct, font=pct_font, fill=pct_color)

    brand_footer(img)
    badge_slide_number(img, 2)
    return img


def slide_3():
    img = new_canvas()
    sun_glow(img, (W // 2, int(H * 0.85)), 520, color=GOLD, alpha=110)
    water_shimmer(img)

    overlay_pill(img, 60, 70, "THE FIX", f(F_BOLD, 26),
                 bg_rgba=(255, 255, 255, 55), fg=WHITE)

    d = ImageDraw.Draw(img)

    d.text((60, 170), "It tells you", font=f(F_BOLD, 110), fill=WHITE)
    d.text((60, 290), "when to weigh", font=f(F_BOLD, 110), fill=WHITE)
    d.text((60, 410), "— and when", font=f(F_BOLD, 110), fill=GOLD)
    d.text((60, 530), "to wait.", font=f(F_BOLD, 110), fill=GOLD)

    d.text((60, 680), "Compare your odds across every", font=f(F_MED, 30), fill=MUTED)
    d.text((60, 720), "remaining window, then hear one", font=f(F_MED, 30), fill=MUTED)
    d.text((60, 760), "clear recommendation.", font=f(F_MED, 30), fill=MUTED)

    # recommendation tile — opaque cream card
    card_y = 810
    card_h = 180
    d.rounded_rectangle([60, card_y, W - 60, card_y + card_h], radius=22, fill=CREAM)
    d.text((90, card_y + 22), "RECOMMENDATION", font=f(F_BOLD, 22), fill=(60, 70, 90))
    d.text((90, card_y + 52), "Wait for Window 4",
           font=f(F_BOLD, 58), fill=(13, 92, 46))
    d.text((90, card_y + 128), "61% to cash  ·  +23 pts vs. weighing now",
           font=f(F_MED, 24), fill=(90, 100, 120))

    # "HOLD" chip on the right
    chip_font = f(F_BOLD, 20)
    chip_text = "HOLD"
    bbox = d.textbbox((0, 0), chip_text, font=chip_font)
    tw = bbox[2] - bbox[0]
    th = bbox[3] - bbox[1]
    chip_pad_x = 22
    chip_pad_y = 10
    cw = tw + chip_pad_x * 2
    ch = th + chip_pad_y * 2
    cx0 = W - 60 - 30 - cw
    cy0 = card_y + 40
    d.rounded_rectangle([cx0, cy0, cx0 + cw, cy0 + ch],
                        radius=ch // 2, fill=(13, 92, 46))
    d.text((cx0 + chip_pad_x - bbox[0], cy0 + chip_pad_y - bbox[1]),
           chip_text, font=chip_font, fill=WHITE)

    badge_slide_number(img, 3)
    return img


def slide_4():
    img = new_canvas()
    sun_glow(img, (int(W * 0.1), int(H * 0.9)), 420, color=TEAL, alpha=140)
    sun_glow(img, (int(W * 0.9), int(H * 0.15)), 320, color=GOLD, alpha=100)

    overlay_pill(img, 60, 70, "WHAT'S INSIDE", f(F_BOLD, 26),
                 bg_rgba=(255, 255, 255, 55), fg=WHITE)

    d = ImageDraw.Draw(img)

    d.text((60, 170), "Everything you", font=f(F_BOLD, 84), fill=WHITE)
    d.text((60, 260), "need, live.", font=f(F_BOLD, 84), fill=GOLD)

    features = [
        ("01", "Compare every window", "Your odds of cashing in each remaining window."),
        ("02", "Weigh-in recommendation", "Weigh now, hold, or wait for a better window."),
        ("03", "Cutoff weight, real time", "Live leaderboard — know what the #10 fish weighs."),
        ("04", "Lake conditions & pressure", "Barometric trend and weather at the ramp."),
    ]

    y = 410
    for num, title, desc in features:
        # number badge
        d.rounded_rectangle([60, y, 148, y + 84], radius=20, fill=GOLD)
        nfont = f(F_BOLD, 40)
        bbox = d.textbbox((0, 0), num, font=nfont)
        nw = bbox[2] - bbox[0]
        nh = bbox[3] - bbox[1]
        d.text((60 + (88 - nw) / 2 - bbox[0], y + (84 - nh) / 2 - bbox[1]),
               num, font=nfont, fill=NAVY_DEEP)

        d.text((175, y + 2), title, font=f(F_BOLD, 40), fill=WHITE)
        d.text((175, y + 50), desc, font=f(F_REG, 24), fill=MUTED)
        y += 130

    brand_footer(img)
    badge_slide_number(img, 4)
    return img


def slide_5():
    img = new_canvas()
    sun_glow(img, (W // 2, int(H * 0.4)), 720, color=GOLD, alpha=180)
    sun_glow(img, (W // 2, int(H * 0.4)), 340, color=ORANGE, alpha=130)
    water_shimmer(img)

    overlay_pill(img, 60, 70, "FREE  ·  NO DOWNLOAD  ·  RUNS IN YOUR BROWSER",
                 f(F_BOLD, 22), bg_rgba=(255, 255, 255, 60), fg=WHITE, pad_x=18, pad_y=10)

    d = ImageDraw.Draw(img)

    # Brand reveal — hero
    d.text((60, 230), "Meet", font=f(F_LIGHT, 68), fill=(255, 255, 255, 220))

    # Wordmark at large size
    draw_wordmark(d, 60, 310, size=156, base_color=WHITE, accent_color=GOLD)

    # Tagline
    d.text((60, 510), "The strategic weigh-in", font=f(F_MED, 44), fill=WHITE)
    d.text((60, 566), "co-pilot for Big Bass Bash.", font=f(F_MED, 44), fill=WHITE)

    # URL panel
    panel_y = 700
    panel_h = 220
    d.rounded_rectangle([60, panel_y, W - 60, panel_y + panel_h], radius=26,
                        fill=CREAM)
    d.text((100, panel_y + 30), "OPEN ON YOUR PHONE", font=f(F_BOLD, 26), fill=(90, 100, 120))
    d.text((100, panel_y + 74), "314-apps.com/fish", font=f(F_BOLD, 72), fill=NAVY_DEEP)

    # arrow button
    ax = W - 200
    ay = panel_y + panel_h - 54
    d.rounded_rectangle([ax, ay - 26, ax + 110, ay + 26], radius=26, fill=GOLD)
    draw_arrow(d, ax + 22, ay, color=NAVY_DEEP, length=64, thickness=7)
    d.text((100, panel_y + 168), "Free · no sign-up · works on iOS and Android",
           font=f(F_REG, 22), fill=(90, 100, 120))

    # footer
    d.text((60, H - 55), "From 314 Apps  ·  Unofficial Big Bass Bash helper",
           font=f(F_REG, 20), fill=(255, 255, 255, 220))

    badge_slide_number(img, 5)
    return img


def main():
    slides = [
        ("slide-1-hook.png", slide_1),
        ("slide-2-problem.png", slide_2),
        ("slide-3-solution.png", slide_3),
        ("slide-4-features.png", slide_4),
        ("slide-5-cta.png", slide_5),
    ]
    for name, fn in slides:
        img = fn()
        out = OUT_DIR / name
        img.convert("RGB").save(out, "PNG", optimize=True)
        print("wrote", out)


if __name__ == "__main__":
    main()
