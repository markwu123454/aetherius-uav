"""
flight_path_planner.py

This module provides utilities to build and sample a flight path composed of
line segments and arc (turn) segments based on given waypoints and a minimum
turn radius (loiter radius). It also processes mission parameters to produce
a detailed flight path with metadata.
"""

import math
from typing import List, Dict, Union, NamedTuple
import numpy as np
import ast



class LineSeg(NamedTuple):
    """
    Represents a straight line segment in local XY coordinates.
    Attributes:
        start: Starting point [x, y] in meters.
        end: Ending point [x, y] in meters.
        alt: Altitude in meters (constant along the segment).
    """
    start: np.ndarray
    end: np.ndarray
    alt: float

class ArcSeg(NamedTuple):
    """
    Represents an arc (circular turn) segment.
    Attributes:
        center: Center of the circle [x, y] in meters.
        radius: Radius of the circle in meters.
        start_ang: Starting angle in degrees (0=+X, CCW positive).
        end_ang: Ending angle in degrees.
        direction: +1 for CCW turn, -1 for CW turn.
        alt: Altitude in meters (constant along the arc).
    """
    center: np.ndarray
    radius: float
    start_ang: float
    end_ang: float
    direction: int
    alt: float

Segment = Union[LineSeg, ArcSeg]


def latlon_to_xy(lat0: float, lon0: float, lat: float, lon: float) -> np.ndarray:
    """
    Convert geographical coordinates (lat, lon) to local Cartesian (x, y)
    using equirectangular projection around reference point (lat0, lon0).
    Returns:
        numpy array [x, y] in meters.
    """
    R = 6371000  # Earth radius in meters
    dlat = math.radians(lat - lat0)
    dlon = math.radians(lon - lon0)
    x = R * dlon * math.cos(math.radians(lat0))  # East offset
    y = R * dlat  # North offset
    return np.array([x, y])


def xy_to_latlon(lat0: float, lon0: float, x: float, y: float) -> (float, float):
    """
    Convert local Cartesian coordinates (x, y) back to geographical
    coordinates (lat, lon) using inverse equirectangular projection.
    Returns:
        (lat, lon) tuple in degrees.
    """
    R = 6371000
    dlat = y / R
    dlon = x / (R * math.cos(math.radians(lat0)))
    lat = lat0 + math.degrees(dlat)
    lon = lon0 + math.degrees(dlon)
    return lat, lon


def angle_to(p: np.ndarray, q: np.ndarray) -> float:
    """
    Compute the bearing from point p to point q in local XY, in degrees.
    """
    dx = q[0] - p[0]
    dy = q[1] - p[1]
    ang = math.degrees(math.atan2(dy, dx)) % 360
    return ang


def shortest(a: float, b: float) -> float:
    """
    Compute the shortest signed angular difference from angle a to angle b.
    Result is in [-180, 180) degrees.
    """
    diff = ((b - a + 180) % 360) - 180
    return diff


def build_path_geometry(waypoints: List[Dict[str, float]], loiter_radius: float) -> Dict[str, Union[float, List[Segment]]]:
    """
    Build a smooth flight path through a series of waypoints, using line segments
    and circular arcs that respect a minimum turning radius.

    The first leg is a straight LineSeg from WP0 to WP1. For each interior
    waypoint WP_i, a circle of radius loiter_radius is placed tangent to the
    previous segment at WP_i on the side toward WP_{i+1}. If WP_{i+1} lies
    inside that circle, the circle is flipped to the opposite side. The two
    candidate tangent points from that circle to WP_{i+1} are computed, and
    the one whose connecting line from P makes the smallest (or largest, if
    flipped) angle with the previous segment direction is chosen. An ArcSeg is
    added from WP_i to that tangent point, followed by a LineSeg to WP_{i+1}.
    """
    num_wp = len(waypoints)
    if num_wp < 2:
        raise ValueError("At least two waypoints are required.")

    # Reference origin for lat/lon
    lat0, lon0 = waypoints[0]["lat"], waypoints[0]["lon"]
    # Convert all waypoints to local XY
    xy = [latlon_to_xy(lat0, lon0, wp["lat"], wp["lon"]) for wp in waypoints]

    segments: List[Segment] = []
    # 1) First straight leg
    segments.append(LineSeg(start=xy[0], end=xy[1], alt=waypoints[0]["alt"]))

    # 2) Iterate each interior waypoint
    for i in range(1, num_wp - 1):
        P = xy[i]
        Q = xy[i + 1]
        alt = waypoints[i]["alt"]

        # Determine direction vector of previous segment
        prev = segments[-1]
        if isinstance(prev, LineSeg):
            A, B = prev.start, prev.end
        else:
            # Arc end point
            theta = math.radians(prev.end_ang)
            A = prev.center + prev.radius * np.array([math.cos(theta), math.sin(theta)])
            B = P
        dir_vec = (B - A) / np.linalg.norm(B - A)

        # Compute circle center on the “toward Q” side, flipping if needed
        normals = [np.array([-dir_vec[1], dir_vec[0]]), np.array([dir_vec[1], -dir_vec[0]])]
        dists = [np.dot(Q - P, n) for n in normals]
        side = 0 if dists[0] > dists[1] else 1
        center = P + loiter_radius * normals[side]
        flipped = False
        if np.linalg.norm(Q - center) < loiter_radius:
            side ^= 1
            center = P + loiter_radius * normals[side]
            flipped = True

        # Compute tangent points from circle to Q
        v = Q - center
        d = np.linalg.norm(v)
        alpha = math.acos(loiter_radius / d)
        base_ang = math.atan2(v[1], v[0])
        t1 = base_ang + alpha
        t2 = base_ang - alpha
        pts = [
            center + loiter_radius * np.array([math.cos(t1), math.sin(t1)]),
            center + loiter_radius * np.array([math.cos(t2), math.sin(t2)])
        ]

        # --- NEW: Angle‐based selection of tangent point ---
        # For each candidate, get vector from P and compute its angle against dir_vec
        angles = []
        for pt in pts:
            vec = (pt - P) / np.linalg.norm(pt - P)
            # Clip dot to [-1,1] to avoid numerical issues
            dot = max(-1.0, min(1.0, float(np.dot(dir_vec, vec))))
            angles.append(math.degrees(math.acos(dot)))
        # If not flipped, pick index with minimum angle; if flipped, pick maximum
        idx = int(np.argmax(angles) if flipped else np.argmin(angles))
        tangent_pt = pts[idx]

        # Compute start/end angles and turning direction
        start_ang = math.degrees(math.atan2(P[1] - center[1], P[0] - center[0])) % 360
        end_ang = math.degrees(math.atan2(tangent_pt[1] - center[1], tangent_pt[0] - center[0])) % 360
        # Determine CW vs CCW by cross product sign
        cross = dir_vec[0] * (tangent_pt[1] - P[1]) - dir_vec[1] * (tangent_pt[0] - P[0])
        direction = 1 if cross > 0 else -1

        # Append the arc and final line segment
        segments.append(ArcSeg(
            center=center,
            radius=loiter_radius,
            start_ang=start_ang,
            end_ang=end_ang,
            direction=direction,
            alt=alt
        ))
        segments.append(LineSeg(start=tangent_pt, end=Q, alt=alt))

    return {"lat0": lat0, "lon0": lon0, "segments": segments}

def sample_geometry(
    geom: Dict[str, Union[float, List]],
    speed_mps: float,
    dt: float = 0.2
) -> List[Dict[str, float]]:
    """
    Sample the abstract geometry into discrete points based on speed and
    time delta, with a smooth altitude gradient between segments.

    Args:
        geom: Dictionary from build_path_geometry, which must include:
            - "lat0", "lon0" (reference lat/lon)
            - "segments": a list of Segment objects, each having:
                - start (np.array([x, y]))
                - end   (np.array([x, y]))
                - center (np.array([x, y]))           # for arcs
                - start_ang, end_ang, direction, radius  # for arcs
                - alt   (float): target altitude at the end of this segment
        speed_mps: Speed in meters per second.
        dt: Time interval per sample in seconds.
    Returns:
        List of points with keys 'lat', 'lon', 'alt', sampled at intervals
        of ~speed_mps*dt meters along each segment, with altitude interpolated
        from the previous segment’s altitude to the current segment’s alt.
    """
    lat0 = geom["lat0"]
    lon0 = geom["lon0"]
    spacing = speed_mps * dt  # desired meters between samples
    out_points: List[Dict[str, float]] = []

    prev_alt = None

    for seg in geom["segments"]:
        end_alt = seg.alt
        # Determine the starting altitude for this segment:
        if prev_alt is None:
            start_alt = end_alt
        else:
            start_alt = prev_alt

        # Compute number of samples along this segment:
        if isinstance(seg, LineSeg):
            # Straight‐line distance:
            vec = seg.end - seg.start
            length = np.linalg.norm(vec)
            n_samples = max(1, int(length / spacing))

            for i in range(1, n_samples + 1):
                frac = i / (n_samples + 1)
                point_xy = seg.start + vec * frac
                lat, lon = xy_to_latlon(lat0, lon0, point_xy[0], point_xy[1])
                # Linear interpolation of altitude:
                alt = start_alt + (end_alt - start_alt) * frac
                out_points.append({
                    "lat": round(lat, 6),
                    "lon": round(lon, 6),
                    "alt": round(alt, 1)
                })

        else:
            # Arc segment:
            raw_diff = (seg.end_ang - seg.start_ang + 360) % 360
            ang_span = raw_diff if seg.direction > 0 else raw_diff - 360
            arc_length = abs(math.radians(ang_span) * seg.radius)
            n_samples = max(1, int(arc_length / spacing))

            for i in range(1, n_samples + 1):
                frac = i / (n_samples + 1)
                ang = seg.start_ang + seg.direction * frac * abs(ang_span)
                ang %= 360
                rad = math.radians(ang)
                point_xy = seg.center + seg.radius * np.array([math.cos(rad), math.sin(rad)])
                lat, lon = xy_to_latlon(lat0, lon0, point_xy[0], point_xy[1])
                alt = start_alt + (end_alt - start_alt) * frac
                out_points.append({
                    "lat": round(lat, 6),
                    "lon": round(lon, 6),
                    "alt": round(alt, 1)
                })

        prev_alt = end_alt

    return out_points



def extract_callable_methods_from_file(code: str, filename: str):
    print(f"[extractor] Parsing file: {filename}")
    print(f"[extractor] Raw code:\n{code[:300]}")  # limit to 300 chars for readability

    logic_entries = []

    try:
        tree = ast.parse(code)
    except SyntaxError as e:
        #print(f"[extractor] SyntaxError in {filename}: {e}")
        return [{"file": filename, "class": "?", "method": "?", "parameters": [], "error": str(e)}]

    for node in tree.body:
        if isinstance(node, ast.ClassDef):
            #print(f"[extractor] Found class: {node.name}")
            for item in node.body:
                if isinstance(item, ast.FunctionDef):
                    #print(f"[extractor] └── Method: {item.name}")
                    if item.name == "__init__":
                        continue
                    arg_names = [arg.arg for arg in item.args.args]
                    if arg_names and arg_names[0] == "self":
                        arg_names = arg_names[1:]

                    logic_entries.append({
                        "file": filename,
                        "class": node.name,
                        "method": item.name,
                        "parameters": arg_names
                    })

        elif isinstance(node, ast.FunctionDef):
            #print(f"[extractor] Found top-level function: {node.name}")
            arg_names = [arg.arg for arg in node.args.args if arg.arg != "self"]
            logic_entries.append({
                "file": filename,
                "class": "Global",
                "method": node.name,
                "parameters": arg_names
            })

    #print(f"[extractor] Extracted entries: {logic_entries}")
    return logic_entries


def validate_processed_mission(mission: Dict,result: List[Dict]) -> List[str]:
    """
    Performs validation checks on the processed mission result.
    Returns a list of error messages if issues are detected.
    """
    errors = []

    #print(mission)
    #print(result)

    for waypoint in mission.get("waypoints", []):
        if waypoint["alt"] > 122:
            errors.append(f"waypoint {waypoint['name']}(alt: {waypoint["alt"]} meters) exceeds maximum altitude of 400 feet.")

    if not isinstance(mission.get("cruise_speed", 10.0), (int, float)) or mission.get("cruise_speed", 10.0) <= 0:
        errors.append("Cruise speed must be a positive number.")

    return errors


def process_mission(mission: Dict) -> Dict[str, Union[str, float, int, List]]:
    """
    High-level mission processing: builds and samples the flight path,
    computes total distance and estimated time.
    Args:
        mission: dict with keys 'waypoints', optional 'cruise_speed' (km/h),
                 optional 'loiter_radius' (m).
    Returns:
        dict with status, waypoint_count, total_distance_km,
        estimated_time_min, errors, and flight_path.
    """
    wps = mission.get("waypoints", [])
    cruise_kmh = mission.get("cruise_speed", 10.0)
    loiter_radius = mission.get("loiter_radius", 30.0)

    errors = []

    # Convert speed to m/s
    speed_mps = cruise_kmh * 1000.0 / 3600.0

    # Trivial case: fewer than 2 waypoints
    if len(wps) < 2:
        path = [{"lat": round(w["lat"], 6), "lon": round(w["lon"], 6), "alt": round(w.get("alt", 0), 1)} for w in wps]
        return {"status": "processed", "waypoint_count": len(wps),
                "total_distance_km": 0.0, "estimated_time_min": 0.0,
                "errors": [], "flight_path": path}

    # Build geometry and sample
    geometry = build_path_geometry(wps, loiter_radius)
    sampled = sample_geometry(geometry, speed_mps)

    # Prepend exact first waypoint
    first_wp = wps[0]
    flight_path = [{"lat": round(first_wp["lat"], 6), "lon": round(first_wp["lon"], 6),
                    "alt": round(first_wp.get("alt", 0), 1)}] + sampled

    # Compute total distance (approx.) in km
    from math import sqrt
    def dist3d(p1, p2):
        dx = (p2["lat"] - p1["lat"]) * 111.32  # km per degree latitude
        dy = (p2["lon"] - p1["lon"]) * 111.32  # km per degree longitude
        dz = (p2["alt"] - p1["alt"]) / 1000.0  # convert meters to km
        return sqrt(dx * dx + dy * dy + dz * dz)

    total_km = sum(dist3d(a, b) for a, b in zip(flight_path, flight_path[1:]))
    est_min = (total_km / cruise_kmh * 60.0) if cruise_kmh > 0 else 0.0

    available_logic = []
    for filename, code in mission.get("logic_files", {}).items():
        available_logic.extend(extract_callable_methods_from_file(code, filename))

    return {"status": "processed",
            "waypoint_count": len(wps),
            "total_distance_km": round(total_km, 2),
            "estimated_time_min": round(est_min, 1),
            "errors": errors + validate_processed_mission(mission, sampled),
            "flight_path": flight_path,
            "available_logic": available_logic}
