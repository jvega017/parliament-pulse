"""Build parliament-pulse-updated.html and parliament-pulse-beta.html."""
import os, re

BASE = os.path.dirname(os.path.abspath(__file__))
JSX_ORDER = ["data.jsx", "entities.jsx", "icons.jsx", "store.jsx", "shell.jsx", "pages.jsx", "app.jsx"]

def read(name):
    with open(os.path.join(BASE, name), encoding="utf-8") as f:
        return f.read()

html = read("index.html")
html = re.sub(r'<script type="text/babel" src="[^"]+\.jsx"></script>\n?', "", html)

inline_parts = [
    '<!-- NOTE: Live page requires local CORS proxy: node proxy-server.js -->'
]
for jsx in JSX_ORDER:
    content = read(jsx)
    inline_parts.append(f'<script type="text/babel">\n{content}\n</script>')

inline_block = "\n\n".join(inline_parts)
html = html.replace("</body>", inline_block + "\n</body>")

# Write updated (dev reference)
out = os.path.join(BASE, "parliament-pulse-updated.html")
with open(out, "w", encoding="utf-8") as f:
    f.write(html)
print(f"Updated: {out} ({os.path.getsize(out)//1024} KB)")

# Write beta (clean copy with version comment)
beta_html = html.replace(
    "<!-- NOTE: Live page requires local CORS proxy: node proxy-server.js -->",
    "<!-- Parliament Pulse · Beta · Prometheus Policy Lab\n"
    "     Live page requires: node proxy-server.js\n"
    "     Single-file distribution — open directly in any modern browser -->"
)
beta = os.path.join(BASE, "parliament-pulse-beta.html")
with open(beta, "w", encoding="utf-8") as f:
    f.write(beta_html)
print(f"Beta:    {beta} ({os.path.getsize(beta)//1024} KB)")
