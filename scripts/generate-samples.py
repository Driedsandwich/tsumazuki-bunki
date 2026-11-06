"""Optional asset regeneration: Python + fonttools + DejaVu Sans Mono Oblique.
Committed SVG outlines require no installed fonts at runtime. No student data.
"""
from pathlib import Path
from fontTools.ttLib import TTFont
from fontTools.pens.svgPathPen import SVGPathPen
samples=[['3x + 4 = 19','3x = 19 + 4','x = 23/3'],['-(x + 3) = 5','-x + 3 = 5','-x = 2','x = -2'],['-4x = 20','x = 5'],['x/3 + 2 = 6','x + 2 = 18','x = 16'],['2x + 3 = 20','5x = 20','x = 4']]
font=TTFont('/usr/share/fonts/truetype/dejavu/DejaVuSansMono-Oblique.ttf')
glyphs=font.getGlyphSet();cmap=font.getBestCmap();units=font['head'].unitsPerEm
for index,lines in enumerate(samples,1):
 parts=['<svg xmlns="http://www.w3.org/2000/svg" width="680" height="440" viewBox="0 0 680 440" role="img">',f'<title>見本 {index} の答案</title><rect width="680" height="440" fill="#fcfaf0"/><path d="M55 20V420" stroke="#e9bab1"/>']
 for y in range(95,441,72): parts.append(f'<path d="M20 {y}H660" stroke="#d6e0dd" stroke-width="1"/>')
 for line_no,line in enumerate(lines):
  x=87;y=85+line_no*72;scale=34/units
  parts.append(f'<g fill="#374b61" transform="rotate({[-.6,.5,-.3,.4][line_no%4]} 100 {y})">')
  for char in line:
   g=glyphs[cmap[ord(char)]];pen=SVGPathPen(glyphs);g.draw(pen)
   parts.append(f'<path d="{pen.getCommands()}" transform="translate({x:.2f} {y}) scale({scale:.5f} {-scale:.5f})"/>');x+=g.width*scale
  parts.append('</g>')
 parts.append('</svg>');Path(f'public/samples/s{index}.svg').write_text(''.join(parts))
