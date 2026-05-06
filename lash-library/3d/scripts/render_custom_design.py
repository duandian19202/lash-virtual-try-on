import argparse
import json
import math
import random
import sys
from pathlib import Path

import bpy
from mathutils import Vector


def parse_args():
    parser = argparse.ArgumentParser()
    parser.add_argument("--config", required=True)
    argv = sys.argv[sys.argv.index("--") + 1 :] if "--" in sys.argv else sys.argv[1:]
    return parser.parse_args(argv)


def hex_to_rgba(value, alpha=1):
    value = value.lstrip("#")
    return (
        int(value[0:2], 16) / 255,
        int(value[2:4], 16) / 255,
        int(value[4:6], 16) / 255,
        alpha,
    )


def lerp(a, b, t):
    return a + (b - a) * t


def clamp(value, low, high):
    return max(low, min(high, value))


def sample_mapping(segments, t):
    for index in range(len(segments) - 1):
        current = segments[index]
        nxt = segments[index + 1]
        if current["position"] <= t <= nxt["position"]:
            local = (t - current["position"]) / (nxt["position"] - current["position"])
            return {
                "lengthMm": lerp(current["lengthMm"], nxt["lengthMm"], local),
                "density": lerp(current["density"], nxt["density"], local),
                "angleDeg": lerp(current["angleDeg"], nxt["angleDeg"], local),
            }
    last = segments[-1]
    return {
        "lengthMm": last["lengthMm"],
        "density": last["density"],
        "angleDeg": last["angleDeg"],
    }


def make_material(name, color, roughness=0.82, specular=0.03):
    material = bpy.data.materials.new(name)
    material.use_nodes = True
    bsdf = material.node_tree.nodes.get("Principled BSDF")
    if bsdf:
        bsdf.inputs["Base Color"].default_value = color
        if "Metallic" in bsdf.inputs:
            bsdf.inputs["Metallic"].default_value = 0
        if "Roughness" in bsdf.inputs:
            bsdf.inputs["Roughness"].default_value = roughness
        if "Specular IOR Level" in bsdf.inputs:
            bsdf.inputs["Specular IOR Level"].default_value = specular
    return material


def make_curve(name, points, bevel_depth, material):
    curve = bpy.data.curves.new(name, "CURVE")
    curve.dimensions = "3D"
    curve.resolution_u = 8
    curve.bevel_depth = bevel_depth
    curve.bevel_resolution = 3

    spline = curve.splines.new("BEZIER")
    spline.bezier_points.add(len(points) - 1)
    for point, co in zip(spline.bezier_points, points):
        point.co = Vector(co)
        point.handle_left_type = "AUTO"
        point.handle_right_type = "AUTO"

    obj = bpy.data.objects.new(name, curve)
    bpy.context.collection.objects.link(obj)
    obj.data.materials.append(material)
    return obj


def root_point(t):
    x = lerp(-1.65, 1.65, t)
    y = -0.5 - 0.13 * math.sin(math.pi * t)
    return Vector((x, y, 0))


def curl_profile(curl):
    profiles = {
        "B": (0.28, 0.42),
        "C": (0.46, 0.62),
        "D": (0.66, 0.82),
        "L": (0.4, 0.72),
        "M": (0.58, 0.78),
    }
    return profiles.get(curl, profiles["C"])


def add_fiber(config, layer_name, index, t, layer, material):
    profile = sample_mapping(config["mapping"]["segments"], t)
    fiber = config["fiber"]
    mid_lift, tip_lift = curl_profile(fiber["curl"])
    thickness = fiber["thicknessMm"]
    scale = 0.082
    length = profile["lengthMm"] * scale * layer["lengthMultiplier"] * random.uniform(0.92, 1.08)
    angle = math.radians(profile["angleDeg"] + random.uniform(-3, 3))
    depth = random.uniform(layer["depth"][0], layer["depth"][1])
    base = root_point(t + random.uniform(-0.006, 0.006)) + Vector((0, 0, depth))

    side = Vector((math.sin(angle), 0, 0))
    up = Vector((0, 1, 0))
    forward = Vector((0, 0, depth * 0.3))
    root_dir = (side * 0.18 + up * 0.42).normalized()
    lift_dir = (side * 0.5 + up * 1.05 + forward).normalized()

    p0 = base
    p1 = p0 + root_dir * length * 0.18
    p2 = p0 + lift_dir * length * 0.58 + up * length * mid_lift
    p3 = p0 + lift_dir * length + up * length * tip_lift + side * length * 0.16
    bevel = 0.0026 * (thickness / 0.1) * layer["diameterMultiplier"]

    make_curve(f"{layer_name}_{index:03d}", [p0, p1, p2, p3], bevel, material)


def setup_scene(config):
    bpy.ops.object.select_all(action="SELECT")
    bpy.ops.object.delete()
    scene = bpy.context.scene
    scene.render.engine = "CYCLES"
    scene.cycles.samples = 128
    scene.render.film_transparent = True
    scene.render.resolution_x = config["render"]["widthPx"]
    scene.render.resolution_y = config["render"]["heightPx"]
    scene.view_settings.view_transform = "Standard"
    scene.view_settings.look = "Medium High Contrast"

    bpy.ops.object.light_add(type="AREA", location=(0, 1.6, 2.2))
    light = bpy.context.object
    light.data.energy = 28
    light.data.size = 4.8

    bpy.ops.object.light_add(type="AREA", location=(-2.0, 0.8, 0.9))
    rim = bpy.context.object
    rim.data.energy = 3
    rim.data.size = 2.2

    bpy.ops.object.camera_add(location=(0, -3.4, 0.45), rotation=(math.radians(82), 0, 0))
    camera = bpy.context.object
    camera.data.type = "ORTHO"
    camera.data.ortho_scale = 4.1
    scene.camera = camera


def render_design(config):
    random.seed(config["render"]["seed"])
    setup_scene(config)
    fiber_mat = make_material("Fiber", hex_to_rgba(config["fiber"]["color"]))
    root_mat = make_material("RootBand", hex_to_rgba("#010101"), roughness=0.9, specular=0.01)

    root = [root_point(i / 48) + Vector((0, -0.012, -0.02)) for i in range(49)]
    make_curve("RootBand", root, 0.006, root_mat)

    layers = [
        {"name": "base", "count": 110, "lengthMultiplier": 0.48, "diameterMultiplier": 0.54, "depth": (-0.12, 0.0)},
        {"name": "middle", "count": 84, "lengthMultiplier": 0.72, "diameterMultiplier": 0.62, "depth": (-0.04, 0.08)},
        {"name": "style", "count": 62, "lengthMultiplier": 1.0, "diameterMultiplier": 0.72, "depth": (0.04, 0.18)},
    ]

    for layer in layers:
        for index in range(layer["count"]):
            t = index / max(1, layer["count"] - 1)
            density = sample_mapping(config["mapping"]["segments"], t)["density"]
            if random.random() <= clamp(density, 0.3, 1):
                add_fiber(config, layer["name"], index, t, layer, fiber_mat)

    output = Path(config["render"]["output"])
    output.parent.mkdir(parents=True, exist_ok=True)
    bpy.context.scene.render.filepath = str(output)
    bpy.ops.render.render(write_still=True)


def main():
    args = parse_args()
    with open(args.config, "r", encoding="utf-8") as file:
        config = json.load(file)
    render_design(config)


if __name__ == "__main__":
    main()
