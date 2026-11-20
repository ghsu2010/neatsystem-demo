"""Build dist/NeatSystem-demo.html: the whole demo in ONE file that opens by double-click (no server).

How it works: every ES module under core/ and systems/ is embedded as a string. At load, a tiny boot
script turns each one into a blob: URL and writes an import map that points "@ns/<path>" at it, so the
modules keep importing each other exactly as in the folder version. CSS and the app icon are inlined.
Needs only Python 3 (no packages). Run from the project folder:  python tools/build-single.py
"""
import base64, json, os, re, posixpath, zipfile

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DIST = os.path.join(ROOT, 'dist')

def read(p):
    with open(os.path.join(ROOT, p), encoding='utf8') as f:
        return f.read()

def modules():
    out = {}
    for top in ('core', 'systems'):
        for dirpath, _, names in os.walk(os.path.join(ROOT, top)):
            for n in names:
                if n.endswith('.js'):
                    rel = os.path.relpath(os.path.join(dirpath, n), ROOT).replace(os.sep, '/')
                    out[rel] = read(rel)
    return out

def rewrite(path, src):
    base = posixpath.dirname(path)
    def spec(s):
        if s.startswith('.'):
            return '@ns/' + posixpath.normpath(posixpath.join(base, s))
        return s
    # static imports / re-exports
    src = re.sub(r"""(\bfrom\s*)(['"])([^'"]+)\2""", lambda m: m.group(1) + m.group(2) + spec(m.group(3)) + m.group(2), src)
    src = re.sub(r"""(\bimport\s*)(['"])(\.[^'"]+)\2""", lambda m: m.group(1) + m.group(2) + spec(m.group(3)) + m.group(2), src)
    # dynamic imports with a literal
    src = re.sub(r"""(\bimport\(\s*)(['"])(\.[^'"]+)\2""", lambda m: m.group(1) + m.group(2) + spec(m.group(3)) + m.group(2), src)
    # dynamic import with a template literal (core/app.js loads systems/<name>/<file>)
    src = re.sub(r"import\(`\.\./systems/", "import(`@ns/systems/", src)
    return src

def data_uri(path, mime):
    with open(os.path.join(ROOT, path), 'rb') as f:
        return f'data:{mime};base64,' + base64.b64encode(f.read()).decode()

def build():
    mods = {p: rewrite(p, s) for p, s in modules().items()}
    css = read('core/tokens.css') + '\n' + read('core/components.css')
    icon = data_uri('assets/icon.svg', 'image/svg+xml')
    icon192 = data_uri('assets/icon-192.png', 'image/png')
    icon512 = data_uri('assets/icon-512.png', 'image/png')
    payload = json.dumps(mods, ensure_ascii=False).replace('</', '<\\/')
    boot = r"""
(function () {
  var SOURCES = window.__NS_SOURCES;
  var map = { imports: {} };
  Object.keys(SOURCES).forEach(function (p) {
    map.imports['@ns/' + p] = URL.createObjectURL(new Blob([SOURCES[p]], { type: 'text/javascript' }));
  });
  var im = document.createElement('script');
  im.type = 'importmap';
  im.textContent = JSON.stringify(map);
  document.head.appendChild(im);
  // Web-app manifest (used when this file is hosted on an https site)
  try {
    var here = location.href.split('#')[0];
    var manifest = { name: 'Neat Team', short_name: 'Neat Team', lang: 'he', dir: 'rtl', start_url: here + '#/home', scope: here.replace(/[^/]*$/, ''),
      display: 'standalone', background_color: '#1C00EA', theme_color: '#1C00EA',
      icons: [{ src: '__ICON192__', sizes: '192x192', type: 'image/png' }, { src: '__ICON512__', sizes: '512x512', type: 'image/png', purpose: 'any maskable' }] };
    var l = document.createElement('link'); l.rel = 'manifest';
    l.href = 'data:application/manifest+json,' + encodeURIComponent(JSON.stringify(manifest));
    document.head.appendChild(l);
  } catch (e) {}
  var s = document.createElement('script');
  s.type = 'module';
  s.textContent = "import '@ns/core/app.js';";
  document.body.appendChild(s);
})();
""".replace('__ICON192__', icon192).replace('__ICON512__', icon512)
    html = f"""<!doctype html>
<html lang="he" dir="rtl">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<meta name="robots" content="noindex, nofollow">
<meta name="theme-color" content="#1C00EA">
<meta name="apple-mobile-web-app-capable" content="yes">
<meta name="apple-mobile-web-app-title" content="Neat Team">
<title>Neat Team</title>
<link rel="icon" href="{icon}" type="image/svg+xml">
<link rel="apple-touch-icon" href="{icon192}">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Rubik:wght@400;500;700&display=swap">
<style>{css}</style>
<script>try {{ var t = (JSON.parse(localStorage.getItem('ns:neatsystem:device') || '{{}}') || {{}}).theme;
  if (t === 'light' || t === 'dark') document.documentElement.dataset.theme = t; }} catch (e) {{}}</script>
<script src="https://unpkg.com/lucide@0.460.0/dist/umd/lucide.min.js"></script>
</head>
<body>
<div id="app"><div style="min-height:100vh;display:grid;place-items:center"><img src="{icon}" width="96" height="96" alt=""></div></div>
<script>window.__NS_SOURCES = {payload};</script>
<script>{boot}</script>
</body>
</html>
"""
    os.makedirs(DIST, exist_ok=True)
    out = os.path.join(DIST, 'NeatSystem-demo.html')
    with open(out, 'w', encoding='utf8') as f:
        f.write(html)
    print('wrote', out, round(len(html.encode('utf8')) / 1024), 'KB,', len(mods), 'modules')

    # Ready-to-host web app (drag the zip's contents onto any https static host, then "Install")
    z = os.path.join(DIST, 'NeatSystem-webapp.zip')
    with zipfile.ZipFile(z, 'w', zipfile.ZIP_DEFLATED) as zf:
        for top in ('index.html', 'manifest.webmanifest', 'sw.js', 'README.md'):
            zf.write(os.path.join(ROOT, top), top)
        for top in ('core', 'systems', 'assets'):
            for dirpath, _, names in os.walk(os.path.join(ROOT, top)):
                for n in names:
                    full = os.path.join(dirpath, n)
                    zf.write(full, os.path.relpath(full, ROOT).replace(os.sep, '/'))
    print('wrote', z)

if __name__ == '__main__':
    build()
