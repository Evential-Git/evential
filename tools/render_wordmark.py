"""Render the licensed Montserrat Alternates wordmark for email clients without web fonts."""
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont
root=Path(__file__).resolve().parents[1]
font=ImageFont.truetype(str(root/'tools/assets/MontserratAlternates-ExtraBold.ttf'),100)
bounds=font.getbbox('EVENTIAL');size=(bounds[2]+4,bounds[3]-bounds[1]+8)
for name,color in [('white','#FFFFFF'),('navy','#0B1B4D')]:
    image=Image.new('RGBA',size,(0,0,0,0));ImageDraw.Draw(image).text((2,4-bounds[1]),'EVENTIAL',font=font,fill=color)
    path=root/f'images/brand/evential-wordmark-{name}.png';path.parent.mkdir(parents=True,exist_ok=True);image.save(path)
    local=root/'newsletter-studio/static/brand'/path.name
    if local.parent.exists():image.save(local)
print('Rendered white and navy Montserrat Alternates wordmarks.')
