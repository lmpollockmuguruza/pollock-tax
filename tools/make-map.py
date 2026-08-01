"""Regenerate the choropleth of U.S. nationals by Spanish autonomous community.

Two inputs, both fetched manually because they are large and change rarely:

  ne.geojson  Natural Earth 1:10m admin-1 states/provinces (public domain)
              https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson/ne_10m_admin_1_states_provinces.geojson

  Counts      INE padrón table 04005, "Poblacion extranjera por Nacionalidad,
              comunidades y provincias, Sexo y Ano", rows for "Estados Unidos
              de America". The CSV export lives at
              https://www.ine.es/jaxi/files/_px/es/csv_bdsc/t20/e245/p08/l0/04005.csv_bdsc?nocab=1
              and the figures below are transcribed into COUNTS.

Run with ne.geojson in the working directory; it writes spain-map.svg, whose
contents replace the <svg class="es-map"> block in index.html. When INE
publishes a newer breakdown, update COUNTS and the source note in index.html.
"""

import json, math, re

REGION = {  # Natural Earth "region" -> INE community key
 'Andalucía':'andalucia','Aragón':'aragon','Asturias':'asturias','Islas Baleares':'balears',
 'Canary Is.':'canarias','Cantabria':'cantabria','Castilla-La Mancha':'clm','Castilla y León':'cyl',
 'Cataluña':'cataluna','Extremadura':'extremadura','Galicia':'galicia','La Rioja':'rioja',
 'Madrid':'madrid','Murcia':'murcia','Foral de Navarra':'navarra','País Vasco':'paisvasco',
 'Valenciana':'valenciana','Ceuta':'ceuta','Melilla':'melilla',
}
COUNTS = {  # INE padrón 2022, table 04005, "Estados Unidos de América", both sexes
 'madrid':11570,'cataluna':9325,'andalucia':7304,'valenciana':4549,'balears':1464,'galicia':1393,
 'canarias':1119,'paisvasco':1117,'cyl':826,'clm':572,'asturias':535,'murcia':521,'aragon':515,
 'navarra':370,'cantabria':355,'extremadura':212,'rioja':175,'melilla':28,'ceuta':3,
}
NAMES = {
 'madrid':('Madrid','Madrid'),'cataluna':('Catalonia','Cataluña'),'andalucia':('Andalusia','Andalucía'),
 'valenciana':('Valencia','C. Valenciana'),'balears':('Balearic Islands','Isles Balears'),
 'galicia':('Galicia','Galicia'),'canarias':('Canary Islands','Canarias'),'paisvasco':('Basque Country','País Vasco'),
 'cyl':('Castile and León','Castilla y León'),'clm':('Castile-La Mancha','Castilla-La Mancha'),
 'asturias':('Asturias','Asturias'),'murcia':('Murcia','Murcia'),'aragon':('Aragon','Aragón'),
 'navarra':('Navarre','Navarra'),'cantabria':('Cantabria','Cantabria'),'extremadura':('Extremadura','Extremadura'),
 'rioja':('La Rioja','La Rioja'),'melilla':('Melilla','Melilla'),'ceuta':('Ceuta','Ceuta'),
}
TOTAL = sum(COUNTS.values())
STEP_FILL = {0: '#DCDDD8', 1: '#C2CCDA', 2: '#8FA6C4', 3: '#4A719F', 4: '#0A3161'}

feats = [f for f in json.load(open('ne.geojson'))['features'] if f['properties'].get('adm0_a3') == 'ESP']

def rings(geom):
    if geom['type'] == 'Polygon': return [geom['coordinates'][0]]
    return [poly[0] for poly in geom['coordinates']]

# --- projection: equirectangular with latitude correction, peninsula and canaries separately
W, H = 1000, 620
LAT0 = 40.0
def proj(lon, lat, box):
    x0, y0, x1, y1, sx, sy, ox, oy = box
    x = (lon - x0) * sx + ox
    y = (y1 - lat) * sy + oy
    return x, y

def bounds(fs):
    xs, ys = [], []
    for f in fs:
        for r in rings(f['geometry']):
            for lon, lat in r: xs.append(lon); ys.append(lat)
    return min(xs), min(ys), max(xs), max(ys)

canary = [f for f in feats if REGION.get(f['properties']['region']) == 'canarias']
main   = [f for f in feats if REGION.get(f['properties']['region']) not in ('canarias', None)]

def make_box(fs, target_w, target_h, ox, oy):
    x0, y0, x1, y1 = bounds(fs)
    k = math.cos(math.radians((y0 + y1) / 2))
    w_deg, h_deg = (x1 - x0) * k, (y1 - y0)
    s = min(target_w / w_deg, target_h / h_deg)
    sx, sy = s * k, s
    # centre inside the target box
    ox += (target_w - w_deg * s) / 2
    oy += (target_h - h_deg * s) / 2
    return (x0, y0, x1, y1, sx, sy, ox, oy)

main_box   = make_box(main, 940, 560, 30, 16)
canary_box = make_box(canary, 190, 78, 34, 512)

def simplify(pts, tol):
    """Douglas-Peucker, so the paths stay light without visible loss at this size."""
    if len(pts) < 3: return pts
    def d(p, a, b):
        (x, y), (x1, y1), (x2, y2) = p, a, b
        dx, dy = x2 - x1, y2 - y1
        if dx == 0 and dy == 0: return math.hypot(x - x1, y - y1)
        t = max(0, min(1, ((x - x1) * dx + (y - y1) * dy) / (dx * dx + dy * dy)))
        return math.hypot(x - (x1 + t * dx), y - (y1 + t * dy))
    dmax, idx = 0, 0
    for i in range(1, len(pts) - 1):
        dd = d(pts[i], pts[0], pts[-1])
        if dd > dmax: dmax, idx = dd, i
    if dmax > tol:
        return simplify(pts[:idx + 1], tol)[:-1] + simplify(pts[idx:], tol)
    return [pts[0], pts[-1]]

paths = {}
for f in feats:
    key = REGION.get(f['properties']['region'])
    if not key: continue
    box = canary_box if key == 'canarias' else main_box
    for ring in rings(f['geometry']):
        pts = [proj(lon, lat, box) for lon, lat in ring]
        pts = simplify(pts, 0.6)
        if len(pts) < 4: continue
        d = 'M' + 'L'.join(f'{x:.1f} {y:.1f}' for x, y in pts) + 'Z'
        paths.setdefault(key, []).append(d)

# --- five-step scale on share of the American population
shares = {k: v / TOTAL * 100 for k, v in COUNTS.items()}
def step(share):
    for i, edge in enumerate([0.5, 2, 5, 15]):
        if share < edge: return i
    return 4

# fit the viewBox to what was actually drawn, including the Canaries inset
allpts = []
for ds in paths.values():
    for d in ds:
        for xy in re.findall(r'(-?\d+\.?\d*) (-?\d+\.?\d*)', d):
            allpts.append((float(xy[0]), float(xy[1])))
pad = 10
minx = min(p[0] for p in allpts) - pad
maxx = max(p[0] for p in allpts) + pad
miny = min(p[1] for p in allpts) - pad
maxy = max(p[1] for p in allpts) + pad + 6
vb = f'{minx:.0f} {miny:.0f} {maxx-minx:.0f} {maxy-miny:.0f}'
out = [f'<svg class="es-map" viewBox="{vb}" role="img" aria-labelledby="map-title map-desc" xmlns="http://www.w3.org/2000/svg">']
out.append('<title id="map-title" data-map-title></title><desc id="map-desc" data-map-desc></desc>')
for key, ds in sorted(paths.items(), key=lambda kv: COUNTS.get(kv[0], 0)):
    n = COUNTS.get(key, 0)
    st = step(shares.get(key, 0))
    c = STEP_FILL[st]
    # presentation attributes lose to any CSS rule, so the stylesheet still
    # controls dark mode and hover; these only matter if it fails to load
    out.append(f'<g class="es-region es-step-{st}" data-region="{key}" '
               f'data-region-count="{n}" data-share="{shares.get(key,0):.1f}" '
               f'fill="{c}" stroke="{c}" stroke-width="1.6">')
    for d in ds: out.append(f'<path d="{d}"/>')
    out.append('</g>')
# inset frame for the Canaries
cx0, cy0 = canary_box[6] - 8, canary_box[7] - 8
out.append(f'<rect class="es-inset" x="{cx0:.0f}" y="{cy0:.0f}" width="206" height="94" rx="3"/>')
out.append('</svg>')
open('spain-map.svg','w').write('\n'.join(out))
print('regions:', len(paths), '| svg bytes:', len('\n'.join(out)))
print('total:', TOTAL)
for k, v in sorted(COUNTS.items(), key=lambda kv: -kv[1])[:6]:
    print(f'  {NAMES[k][0]:<20} {v:>6,} {shares[k]:5.1f}%  step {step(shares[k])}')
json.dump({'names': NAMES, 'counts': COUNTS, 'total': TOTAL}, open('mapdata.json','w'), ensure_ascii=False)
