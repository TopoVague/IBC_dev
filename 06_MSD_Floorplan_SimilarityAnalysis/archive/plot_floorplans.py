import os
import matplotlib.pyplot as plt
import matplotlib.patches as mpatches

from your_module import get_geometries_from_id  # Update this import
from shapely.geometry import Polygon

plt.rcParams['font.family'] = 'DejaVu Sans'

# --- Global color config ---
colors = ['#000000', '#FF0000', "goldenrod", "deepskyblue", "Lightgrey", "darkgrey", "violet", "purple", "yellow"]
sep_names = ["Walls", "Doors", "Entrances", "Windows", "Floor", "Balcony", "Apartment Corridor", "Circulation", "Stairs"]

def plot_polygon(ax, poly, label=None, **kwargs):
    x, y = poly.exterior.xy
    ax.fill(x, y, label=label, **kwargs)

def remove_duplicate_geometries(geoms):
    unique = []
    for g in geoms:
        if not any(g.equals(u) for u in unique):
            unique.append(g)
    return unique

def draw_walls_and_openings(ax, geoms, cats, zonings, apartment_ids, colors):
    walls = [g for g, c in zip(geoms, cats) if c == 'Structure']
    doors = remove_duplicate_geometries([g for g, c in zip(geoms, cats) if c == 'Door'])
    entrances = remove_duplicate_geometries([g for g, c in zip(geoms, cats) if c == 'Entrance Door'])
    windows = [g for g, c in zip(geoms, cats) if c == 'Window']
    intSpaces = [g for g, c in zip(geoms, cats) if c in ['Bathroom', 'Livingroom', 'Bedroom', 'Kitchen', 'Balcony', 'Corridor', 'Dining', 'Storeroom']]
    extSpaces = [g for g, c in zip(geoms, cats) if c == 'Balcony']
    cores = [g for g, c in zip(geoms, cats) if c == 'Stairs']
    corridors = [g for g, c in zip(geoms, cats) if c == 'Corridor']
    corridor_zones = [zone for geom, cat, zone in zip(geoms, cats, zonings) if cat == 'Corridor']

    core_corridors = []
    for i, (corridor, zone) in enumerate(zip(corridors, corridor_zones)):
        buffered = corridor.buffer(0.001)
        entrance_count = sum(1 for e in entrances if corridor.touches(e) or corridor.intersects(e))
        door_count = sum(1 for d in doors if buffered.intersects(d) or buffered.touches(d))
        cond1 = (zone == "Zone3") and (entrance_count > door_count)
        cond2 = (zone == "Zone2") and (entrance_count > door_count)
        cond3 = (door_count != 0) or (door_count != 1)
        if cond1 or (cond2 and cond3) or cond2:
            core_corridors.append(corridor)

    for g, c in zip(
        [walls, doors, entrances, windows, intSpaces, extSpaces, corridors, core_corridors, cores],
        colors
    ):
        for geom in g:
            plot_polygon(ax, geom, facecolor=c)

    return core_corridors

def plot_floorplan(building_id, floor_id, DF, output_dir):
    geoms, cats, zonings = get_geometries_from_id(DF, building_id, floor_id)
    fig, ax = plt.subplots(1, 1, figsize=(10, 10))
    ax.set_aspect('equal')
    ax.axis('off')
    ax.set_title(f"Building ID: {building_id}, Floor ID: {floor_id}", fontsize=13)

    draw_walls_and_openings(ax, geoms, cats, zonings, apartment_ids=[], colors=colors)

    legend = [mpatches.Patch(color=c, label=l) for c, l in zip(colors, sep_names)]
    plt.legend(handles=legend, loc='upper left', bbox_to_anchor=(1, 0.5), fontsize=10)

    os.makedirs(output_dir, exist_ok=True)
    filepath = os.path.join(output_dir, f"floorplan_{building_id}_{floor_id}.png")
    plt.savefig(filepath, bbox_inches='tight', dpi=300)
    plt.close()
    print(f"✔️ Saved: {filepath}")

# MAIN LOOP
if __name__ == "__main__":
    # Replace with your own data loading method
    from data_loader import load_DF
    DF = load_DF()

    output_dir = r"/your/local/output/dir"
    building_ids = [1001, 1002]
    floor_ids = [0, 1]

    for b_id in building_ids:
        for f_id in floor_ids:
            try:
                plot_floorplan(b_id, f_id, DF, output_dir)
            except Exception as e:
                print(f"❌ Error for Building {b_id}, Floor {f_id}: {e}")
