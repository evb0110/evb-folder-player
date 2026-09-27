from PIL import Image, ImageDraw
from pathlib import Path
root = Path(__file__).resolve().parent.parent / 'assets'
def icon(size, transparent=False):
    scale = size / 1024
    im = Image.new('RGBA', (size, size), (0, 0, 0, 0) if transparent else '#101918')
    draw = ImageDraw.Draw(im)
    def box(values): return tuple(round(x * scale) for x in values)
    draw.rounded_rectangle(box((218, 270, 515, 475)), radius=round(40*scale), fill='#D6B987')
    draw.rounded_rectangle(box((218, 352, 806, 754)), radius=round(62*scale), fill='#C2E5BA')
    draw.polygon([tuple(round(x*scale) for x in xy) for xy in [(458,451),(458,655),(635,553)]], fill='#163626')
    return im
icon(1024).save(root/'icon.png')
icon(1024, True).save(root/'android-icon-foreground.png')
icon(64).save(root/'favicon.png')
