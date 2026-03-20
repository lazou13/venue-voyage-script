#!/usr/bin/env python3
"""
Script d'extraction OSM pour la médina de Marrakech.
Génère le graphe piéton + POIs à importer dans Supabase/PostGIS.

Prérequis:
    pip install osmnx geopandas networkx psycopg2-binary python-dotenv

Usage:
    python extract_medina_osm.py --mode graph    # Exporte nodes + edges
    python extract_medina_osm.py --mode pois     # Exporte POIs OSM
    python extract_medina_osm.py --mode all      # Les deux
    python extract_medina_osm.py --mode import   # Importe directement dans Supabase

Variables d'environnement (.env):
    SUPABASE_DB_URL=postgresql://postgres:...@db.xxx.supabase.co:5432/postgres
"""

import os
import sys
import json
import argparse
import logging
from pathlib import Path

logging.basicConfig(level=logging.INFO, format='%(asctime)s %(levelname)s %(message)s')
log = logging.getLogger(__name__)

# ── Bbox médina de Marrakech ──────────────────────────────
# Format osmnx v2: (west, south, east, north)
MEDINA_BBOX = (-7.9950, 31.6240, -7.9750, 31.6380)

# ── Filtre highway piéton ─────────────────────────────────
PEDESTRIAN_FILTER = (
    '["highway"~"pedestrian|footway|path|residential|'
    'living_street|service|steps|unclassified|track|'
    'tertiary|secondary|primary"]'
)

# ── Tags supplémentaires pour les rues ───────────────────
EXTRA_TAGS = [
    'surface', 'width', 'covered', 'tunnel', 'lit',
    'foot', 'access', 'name:ar', 'name:fr',
    'historic', 'tourism',
]

# ── Mapping highway → street_type médina ─────────────────
STREET_TYPE_MAP = {
    'steps': 'steps',
    'footway': 'pedestrian_street',
    'pedestrian': 'pedestrian_street',
    'living_street': 'derb',
    'service': 'derb',
    'path': 'alley',
    'residential': 'main_street',
    'unclassified': 'main_street',
    'tertiary': 'main_street',
    'secondary': 'boulevard',
    'primary': 'boulevard',
}

# ── Tags POI Overpass ─────────────────────────────────────
POI_TAGS = {
    "amenity": True,
    "historic": True,
    "tourism": True,
    "shop": True,
    "craft": True,
    "man_made": "fountain",
    "leisure": "garden",
    "building": "fondouk",
}


def clean_for_json(obj):
    """Nettoyer les valeurs non-sérialisables JSON."""
    if isinstance(obj, (list, tuple)):
        return json.dumps(obj)
    if isinstance(obj, dict):
        return json.dumps(obj)
    return obj


def extract_graph():
    """Extraire le graphe piéton de la médina via osmnx."""
    try:
        import osmnx as ox
        import geopandas as gpd
        import pandas as pd
    except ImportError:
        log.error("Installez: pip install osmnx geopandas pandas")
        sys.exit(1)

    log.info("Configuration osmnx...")
    ox.settings.use_cache = True
    ox.settings.timeout = 180
    ox.settings.useful_tags_way += EXTRA_TAGS

    log.info(f"Extraction graphe piéton, bbox={MEDINA_BBOX}...")
    G = ox.graph.graph_from_bbox(
        bbox=MEDINA_BBOX,
        custom_filter=PEDESTRIAN_FILTER,
        simplify=True,
        retain_all=True,
        truncate_by_edge=True,
    )
    log.info(f"Graphe extrait: {G.number_of_nodes()} nœuds, {G.number_of_edges()} arêtes")

    gdf_nodes, gdf_edges = ox.convert.graph_to_gdfs(G)

    # Ajouter street_type calculé depuis highway
    def get_street_type(row):
        hw = row.get('highway', '')
        if isinstance(hw, list):
            hw = hw[0] if hw else ''
        covered = row.get('covered', '')
        tunnel = row.get('tunnel', '')
        if covered in ('yes', True) or tunnel in ('building_passage', 'yes'):
            return 'covered_passage'
        return STREET_TYPE_MAP.get(str(hw), 'other')

    gdf_edges['street_type'] = gdf_edges.apply(get_street_type, axis=1)

    # Nettoyer colonnes pour export JSON
    def clean_gdf(gdf):
        result = gdf.copy()
        for col in result.columns:
            if col != 'geometry':
                result[col] = result[col].apply(clean_for_json)
        return result

    output_dir = Path('scripts/output')
    output_dir.mkdir(exist_ok=True)

    clean_gdf(gdf_nodes).to_file(output_dir / 'medina_nodes.geojson', driver='GeoJSON')
    clean_gdf(gdf_edges).to_file(output_dir / 'medina_edges.geojson', driver='GeoJSON')

    log.info(f"Exporté: {output_dir}/medina_nodes.geojson, medina_edges.geojson")
    return gdf_nodes, gdf_edges


def extract_pois():
    """Extraire les POIs OSM de la médina."""
    try:
        import osmnx as ox
        import pandas as pd
    except ImportError:
        log.error("Installez: pip install osmnx pandas")
        sys.exit(1)

    log.info("Extraction POIs OSM (Overpass)...")
    pois = ox.features.features_from_bbox(bbox=MEDINA_BBOX, tags=POI_TAGS)

    # Convertir polygones en centroïdes
    pois['geometry'] = pois['geometry'].apply(
        lambda g: g.centroid if g.geom_type in ('Polygon', 'MultiPolygon') else g
    )
    pois['lat'] = pois.geometry.y
    pois['lng'] = pois.geometry.x

    def get_poi_type(row):
        for key in ['amenity', 'historic', 'tourism', 'shop', 'craft', 'man_made', 'leisure']:
            if key in row.index and pd.notna(row.get(key)):
                return f"{key}={row[key]}"
        return "other"

    pois['poi_type'] = pois.apply(get_poi_type, axis=1)

    output_dir = Path('scripts/output')
    output_dir.mkdir(exist_ok=True)

    def clean_gdf(gdf):
        result = gdf.copy()
        for col in result.columns:
            if col != 'geometry':
                result[col] = result[col].apply(clean_for_json)
        return result

    clean_gdf(pois).to_file(output_dir / 'medina_pois_osm.geojson', driver='GeoJSON')
    log.info(f"Exporté: scripts/output/medina_pois_osm.geojson ({len(pois)} POIs)")
    return pois


def import_to_supabase(gdf_nodes, gdf_edges, pois_gdf=None):
    """Importer graphe + POIs OSM directement dans Supabase via psycopg2."""
    try:
        import psycopg2
        import psycopg2.extras
        from dotenv import load_dotenv
    except ImportError:
        log.error("Installez: pip install psycopg2-binary python-dotenv")
        sys.exit(1)

    load_dotenv()
    dsn = os.getenv('SUPABASE_DB_URL')
    if not dsn:
        log.error("Variable SUPABASE_DB_URL manquante dans .env")
        sys.exit(1)

    log.info("Connexion à Supabase...")
    conn = psycopg2.connect(dsn)
    cur = conn.cursor()

    # ── Importer les nœuds ──────────────────────────────────
    log.info(f"Import {len(gdf_nodes)} nœuds...")
    node_osmid_to_db_id = {}

    for osmid, row in gdf_nodes.iterrows():
        lat = float(row.geometry.y)
        lng = float(row.geometry.x)
        cur.execute("""
            INSERT INTO public.street_nodes (geom, osm_node_id, is_intersection)
            VALUES (ST_SetSRID(ST_MakePoint(%s, %s), 4326), %s, %s)
            ON CONFLICT (osm_node_id) DO UPDATE SET
                geom = EXCLUDED.geom
            RETURNING id
        """, (lng, lat, int(osmid), row.get('street_count', 1) >= 3))
        db_id = cur.fetchone()[0]
        node_osmid_to_db_id[int(osmid)] = db_id

    conn.commit()
    log.info("Nœuds importés.")

    # ── Importer les arêtes ─────────────────────────────────
    log.info(f"Import {len(gdf_edges)} arêtes...")
    edge_count = 0

    for (u, v, _), row in gdf_edges.iterrows():
        source_id = node_osmid_to_db_id.get(int(u))
        target_id = node_osmid_to_db_id.get(int(v))
        if source_id is None or target_id is None:
            continue

        geom_wkt = row.geometry.wkt
        street_type = row.get('street_type', 'other')
        name = row.get('name', '')
        name_ar = row.get('name:ar', '')
        name_fr = row.get('name:fr', '')
        osm_id = row.get('osmid', None)
        is_covered = row.get('covered', '') in ('yes', True)

        if isinstance(name, list): name = name[0] if name else ''
        if isinstance(name_ar, list): name_ar = name_ar[0] if name_ar else ''
        if isinstance(name_fr, list): name_fr = name_fr[0] if name_fr else ''

        cur.execute("""
            INSERT INTO public.streets (osm_id, name, name_ar, name_fr, geom, street_type, is_covered, source, target)
            VALUES (%s, %s, %s, %s, ST_SetSRID(ST_GeomFromText(%s), 4326), %s, %s, %s, %s)
            ON CONFLICT DO NOTHING
        """, (
            int(osm_id) if osm_id and str(osm_id).lstrip('-').isdigit() else None,
            str(name)[:200] if name else None,
            str(name_ar)[:200] if name_ar else None,
            str(name_fr)[:200] if name_fr else None,
            geom_wkt,
            street_type,
            bool(is_covered),
            source_id,
            target_id,
        ))
        edge_count += 1

        if edge_count % 500 == 0:
            conn.commit()
            log.info(f"  {edge_count} arêtes importées...")

    conn.commit()
    log.info(f"{edge_count} arêtes importées.")

    # ── Lier les POIs aux nœuds ─────────────────────────────
    log.info("Liaison POIs → nœuds les plus proches...")
    cur.execute("SELECT public.link_pois_to_nearest_nodes()")
    updated = cur.fetchone()[0]
    conn.commit()
    log.info(f"{updated} POIs liés à leurs nœuds.")

    # ── Statistiques finales ────────────────────────────────
    cur.execute("SELECT public.get_graph_stats()")
    stats = cur.fetchone()[0]
    log.info(f"Statistiques graphe: {stats}")

    cur.close()
    conn.close()
    log.info("Import terminé avec succès.")


def main():
    parser = argparse.ArgumentParser(description='Extraction OSM médina Marrakech')
    parser.add_argument('--mode', choices=['graph', 'pois', 'all', 'import'], default='all')
    args = parser.parse_args()

    gdf_nodes = gdf_edges = pois = None

    if args.mode in ('graph', 'all'):
        gdf_nodes, gdf_edges = extract_graph()

    if args.mode in ('pois', 'all'):
        pois = extract_pois()

    if args.mode == 'import':
        if gdf_nodes is None:
            gdf_nodes, gdf_edges = extract_graph()
        import_to_supabase(gdf_nodes, gdf_edges, pois)


if __name__ == '__main__':
    main()
