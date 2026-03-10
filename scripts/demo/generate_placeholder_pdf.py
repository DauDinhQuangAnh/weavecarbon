from pathlib import Path

from PIL import Image, ImageDraw, ImageFont


ROOT = Path(__file__).resolve().parents[2]
OUTPUT_PATH = ROOT / "public" / "demo-assets" / "documents" / "demo-placeholder.pdf"
FONT_PATH = Path(r"C:\Windows\Fonts\arial.ttf")

PAGE_SIZE = (1240, 1754)  # A4 at ~150 DPI
PRIMARY_COLOR = (8, 124, 117)
SECONDARY_COLOR = (100, 116, 139)
BORDER_COLOR = (15, 118, 110)


def centered_x(draw: ImageDraw.ImageDraw, text: str, font: ImageFont.FreeTypeFont) -> int:
    left, _, right, _ = draw.textbbox((0, 0), text, font=font)
    text_width = right - left
    return (PAGE_SIZE[0] - text_width) // 2


def main() -> None:
    image = Image.new("RGB", PAGE_SIZE, "white")
    draw = ImageDraw.Draw(image)

    title_font = ImageFont.truetype(str(FONT_PATH), 78)
    subtitle_font = ImageFont.truetype(str(FONT_PATH), 34)
    note_font = ImageFont.truetype(str(FONT_PATH), 18)

    draw.rounded_rectangle(
        (180, 220, PAGE_SIZE[0] - 180, PAGE_SIZE[1] - 220),
        radius=28,
        outline=BORDER_COLOR,
        width=6
    )

    title = "Dữ liệu demo"
    subtitle = "WeaveCarbon Demo PDF Placeholder"
    note = "Demo only - generated locally for the browser viewer"

    title_y = 720
    subtitle_y = title_y + 150
    note_y = subtitle_y + 540

    draw.text(
        (centered_x(draw, title, title_font), title_y),
        title,
        fill=PRIMARY_COLOR,
        font=title_font
    )
    draw.text(
        (centered_x(draw, subtitle, subtitle_font), subtitle_y),
        subtitle,
        fill=SECONDARY_COLOR,
        font=subtitle_font
    )
    draw.text(
        (centered_x(draw, note, note_font), note_y),
        note,
        fill=SECONDARY_COLOR,
        font=note_font
    )

    OUTPUT_PATH.parent.mkdir(parents=True, exist_ok=True)
    image.save(OUTPUT_PATH, "PDF", resolution=150.0)


if __name__ == "__main__":
    main()
