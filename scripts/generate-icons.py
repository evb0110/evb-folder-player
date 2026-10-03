"""Generate launcher layers and a small-size favicon. Requires Pillow."""
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parent.parent
BACKGROUND = '#F1F6ED'
GREEN = '#28704A'
TAB = '#8EBB83'


def folder(size, *, adaptive=False, monochrome=False, background=False):
    # Supersampling keeps the tab, rounded corners and play mark smooth at 16px.
    canvas = size * 4
    image = Image.new('RGBA', (canvas, canvas), BACKGROUND if background else (0, 0, 0, 0))
    draw = ImageDraw.Draw(image)
    # Android layers use a 108dp canvas. Keep all artwork inside its 66dp safe circle.
    # Legacy icons and favicons get a larger mark; they are not cropped as layers.
    left, top, width, height = (28, 32, 52, 44) if adaptive else (12, 19, 84, 70)
    scale = canvas / 108

    def box(x, y, w, h):
        return tuple(round(value * scale) for value in (x, y, x + w, y + h))

    ink = '#FFFFFF' if monochrome else GREEN
    draw.rounded_rectangle(box(left, top, width * .47, height * .5),
                           radius=round(width * .055 * scale),
                           fill=ink if monochrome else TAB)
    draw.rounded_rectangle(box(left, top + height * .21, width, height * .79),
                           radius=round(width * .09 * scale), fill=ink)
    # A transparent play cutout also survives wallpaper-tinted monochrome rendering.
    play = [(left + width * .43, top + height * .39),
            (left + width * .43, top + height * .79),
            (left + width * .72, top + height * .59)]
    draw.polygon([(round(x * scale), round(y * scale)) for x, y in play],
                 fill=(0, 0, 0, 0) if monochrome else '#FFFFFF')
    return image.resize((size, size), Image.Resampling.LANCZOS)


def store_feature():
    image = Image.new('RGB', (1024, 500), '#101918')
    image.paste(folder(256, background=True).convert('RGB'), (96, 122))
    # macOS source-art generation; launcher icons themselves do not use fonts.
    font = ImageFont.truetype('/System/Library/Fonts/Supplemental/Arial Bold.ttf', 48)
    ImageDraw.Draw(image).text((400, 218), 'EVB Folder Player', font=font, fill='#F1F6ED')
    image.save(ROOT / 'fastlane/metadata/android/en-US/images/featureGraphic.png')


if __name__ == '__main__':
    store_feature()
    assets = ROOT / 'assets'
    folder(1024, background=True).save(assets / 'icon.png')
    folder(1024, adaptive=True).save(assets / 'android-icon-foreground.png')
    folder(1024, adaptive=True, monochrome=True).save(assets / 'android-icon-monochrome.png')
    folder(1024).save(assets / 'splash-icon.png')
    folder(64).save(assets / 'favicon.png')
