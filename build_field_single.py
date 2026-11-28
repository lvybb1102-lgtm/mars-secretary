#!/usr/bin/env python3
"""field-studio/index.html + style.css + app.js 를 하나의 단독 실행 HTML로 합친다.
산출: /workspace/downloads/잉크원_필드스튜디오_프로토타입.html (PC·폰에서 파일로 열어도 동작)"""
import base64, pathlib, re

ROOT = pathlib.Path(__file__).parent / 'field-studio'
OUT = pathlib.Path('/workspace/downloads/잉크원_필드스튜디오_프로토타입.html')

html = (ROOT / 'index.html').read_text(encoding='utf-8')
css = (ROOT / 'style.css').read_text(encoding='utf-8')
js = (ROOT / 'app.js').read_text(encoding='utf-8')
icon = base64.b64encode((ROOT / 'apple-touch-icon.png').read_bytes()).decode()

html = html.replace('<link rel="stylesheet" href="./style.css">', '<style>\n' + css + '\n</style>')
html = html.replace('<script src="./app.js"></script>', '<script>\n' + js + '\n</script>')
html = html.replace('<link rel="manifest" href="./manifest.webmanifest">\n', '')
html = html.replace('<link rel="apple-touch-icon" href="./apple-touch-icon.png">',
                    '<link rel="icon" href="data:image/png;base64,' + icon + '">')
html = re.sub(r'\n\s*\n\s*\n', '\n\n', html)

OUT.write_text(html, encoding='utf-8')
print('wrote', OUT, len(html), 'bytes')
