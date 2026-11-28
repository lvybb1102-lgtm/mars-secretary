"""자비스 HUD 단독 HTML 빌드 — index.html + style.css + app.js 를 한 파일로 인라인.
   결과: /workspace/downloads/마르스_자비스_HUD.html (PC·폰에서 파일만 열어도 동작)
"""
import pathlib
import re
import sys

ROOT = pathlib.Path(__file__).resolve().parent
OUT = pathlib.Path("/workspace/downloads/마르스_자비스_HUD.html")

html = (ROOT / "index.html").read_text(encoding="utf-8")
css = (ROOT / "style.css").read_text(encoding="utf-8")
js = (ROOT / "app.js").read_text(encoding="utf-8")

if "</script" in js:
    sys.exit("app.js 안에 </script 문자열이 있어 인라인할 수 없습니다.")

style_tag = '<style>\n/* style.css 인라인 */\n' + css + '\n</style>'
script_tag = '<script>\n/* app.js 인라인 */\n' + js + '\n</script>'

html = re.sub(r'<link rel="stylesheet" href="style\.css(?:\?[^"]*)?"\s*/?>', lambda _: style_tag, html)
html = re.sub(r'<script src="app\.js(?:\?[^"]*)?"></script>', lambda _: script_tag, html)

banner = "<!-- 마르스 자비스 HUD — 단독 실행 파일 (style.css · app.js 인라인) -->\n"
html = banner + html

OUT.parent.mkdir(parents=True, exist_ok=True)
OUT.write_text(html, encoding="utf-8")

leftover = [m for m in re.findall(r'(?:src|href)="([^"]+)"', html) if not m.startswith(("data:", "#", "https://generativelanguage"))]
print("saved:", OUT, OUT.stat().st_size, "bytes")
print("external refs:", leftover)
