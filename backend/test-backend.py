from process_mission import (
    process_mission,
    build_path_geometry,
    latlon_to_xy,
    xy_to_latlon,
    LineSeg,
    ArcSeg)
import matplotlib.pyplot as plt
from matplotlib.backend_bases import MouseEvent
from matplotlib.patches import Circle
import numpy as np

# === Define Test Cases ===
test_missions = [
    {
        "name": "Back-to-Back Turns",
        "waypoints": [
            {"lat": 34.000000, "lon": -117.000000, "alt": 100},
            {"lat": 34.000500, "lon": -117.000000, "alt": 100},
            {"lat": 34.000500, "lon": -117.000500, "alt": 100},
            {"lat": 34.001000, "lon": -117.000500, "alt": 100},
            {"lat": 34.000950, "lon": -117.000400, "alt": 100},
            {"lat": 34.001300, "lon": -117.000600, "alt": 100}
        ],
        "cruise_speed": 20.0,  # km/h
        "loiter_radius": 20.0  # the same radius for both turns
    }
]
''' ,
    {
        "name": "Slight Left Turn",
        "waypoints": [
            {"lat": 34.000000, "lon": -117.000000, "alt": 100},
            {"lat": 34.000500, "lon": -117.000000, "alt": 100},
            {"lat": 34.000900, "lon": -117.000400, "alt": 100}
        ],
        "cruise_speed": 20.0,  # km/h
        "loiter_radius": 30.0
    },
    {
        "name": "Short Tight Turn (Too Sharp)",
        "waypoints": [
            {"lat": 34.001000, "lon": -117.001000, "alt": 100},
            {"lat": 34.001050, "lon": -117.001000, "alt": 100},
            {"lat": 34.001020, "lon": -117.000950, "alt": 100}
        ],
        "cruise_speed": 20.0,
        "loiter_radius": 30.0  # turning radius is too large for this spacing
    },
    {
        "name": "Short Tight Turn (Just Enough)",
        "waypoints": [
            {"lat": 34.002000, "lon": -117.002000, "alt": 100},
            {"lat": 34.002030, "lon": -117.002000, "alt": 100},
            {"lat": 34.002040, "lon": -117.001970, "alt": 100}
        ],
        "cruise_speed": 20.0,
        "loiter_radius": 20.0  # just small enough radius to manage the curve
    }'''

# === Run Test Cases ===
for i, mission in enumerate(test_missions):
    print(f"Running test: {mission['name']}")
    result = process_mission(mission)
    print(f"Status: {result['status']}")
    print(f"Waypoints: {result['waypoint_count']}")
    print(f"Distance (km): {result['total_distance_km']}")
    print(f"Estimated time (min): {result['estimated_time_min']}")
    print()

'''


# Assume the following exist and are imported:
# - build_path_geometry
# - latlon_to_xy
# - xy_to_latlon
# - LineSeg, ArcSeg

def interactive_path_editor(loiter_radius: float = 0.3):
    waypoints = []  # List of {'lat', 'lon', 'alt'}
    scat = None
    draggables = []
    fig, ax = plt.subplots()
    ax.set_title("Click to Add Waypoints, Drag to Move")
    ax.set_aspect('equal')
    selected = {"index": None}

    def draw_geometry(geom):
        ax.clear()
        ax.set_title("Click to Add Waypoints, Drag to Move")
        for seg in geom['segments']:
            if isinstance(seg, LineSeg):
                xs = [seg.start[0], seg.end[0]]
                ys = [seg.start[1], seg.end[1]]
                ax.plot(xs, ys, 'b', lw=2)
            elif isinstance(seg, ArcSeg):
                # Smooth arc
                start, end = seg.start_ang, seg.end_ang
                if seg.direction > 0:
                    if end < start:
                        end += 360
                    angles = np.linspace(start, end, 200)
                else:
                    if start < end:
                        start += 360
                    angles = np.linspace(start, end, 200)
                radians = np.radians(angles)
                xs = seg.center[0] + seg.radius * np.cos(radians)
                ys = seg.center[1] + seg.radius * np.sin(radians)
                ax.plot(xs, ys, 'r', lw=2)
        # Replot points
        if waypoints:
            points = np.array(
                [latlon_to_xy(waypoints[0]['lat'], waypoints[0]['lon'], wp['lat'], wp['lon']) for wp in waypoints])
            ax.scatter(points[:, 0], points[:, 1], color='black', zorder=3)
        fig.canvas.draw()

    def update_plot():
        if len(waypoints) >= 2:
            try:
                geom = build_path_geometry(waypoints, loiter_radius)
                draw_geometry(geom)
            except Exception as e:
                print("Error:", e)
        else:
            draw_geometry({"segments": []})

    def onclick(event: MouseEvent):
        if event.inaxes != ax or event.button != 1:
            return
        if len(waypoints) == 0:
            # First point becomes reference origin
            lat0, lon0 = 34.0, -117.0  # Example origin
        else:
            lat0, lon0 = waypoints[0]['lat'], waypoints[0]['lon']
        x, y = event.xdata, event.ydata
        lat, lon = xy_to_latlon(lat0, lon0, x, y)
        waypoints.append({'lat': lat, 'lon': lon, 'alt': 100.0})
        update_plot()

    def on_press(event):
        if event.inaxes != ax:
            return
        if len(waypoints) == 0:
            return
        lat0, lon0 = waypoints[0]['lat'], waypoints[0]['lon']
        pts = np.array([latlon_to_xy(lat0, lon0, wp['lat'], wp['lon']) for wp in waypoints])
        dists = np.linalg.norm(pts - np.array([event.xdata, event.ydata]), axis=1)
        idx = np.argmin(dists)
        if dists[idx] < 10:
            selected['index'] = idx

    def on_release(event):
        selected['index'] = None

    def on_motion(event):
        if event.inaxes != ax or selected['index'] is None:
            return
        idx = selected['index']
        x, y = event.xdata, event.ydata
        lat0, lon0 = waypoints[0]['lat'], waypoints[0]['lon']
        lat, lon = xy_to_latlon(lat0, lon0, x, y)
        waypoints[idx]['lat'] = lat
        waypoints[idx]['lon'] = lon
        update_plot()

    fig.canvas.mpl_connect("button_press_event", onclick)
    fig.canvas.mpl_connect("button_press_event", on_press)
    fig.canvas.mpl_connect("button_release_event", on_release)
    fig.canvas.mpl_connect("motion_notify_event", on_motion)

    ax.set_xlim(-1.5 * loiter_radius, 1.5 * loiter_radius)
    ax.set_ylim(-1.5 * loiter_radius, 1.5 * loiter_radius)

    plt.ion()  # Turn on interactive mode
    plt.show()

    # Keep the plot alive until closed
    while plt.fignum_exists(fig.number):
        plt.pause(0.1)


interactive_path_editor()
'''
