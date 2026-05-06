import argparse
import json
import math
import os
import random
import sys
from pathlib import Path

import bpy
from mathutils import Vector


def parse_args():
    parser = argparse.ArgumentParser()
    parser.add_argument("--params", required=True)
    parser.add_argument("--output", required=False)
    argv = sys.argv[sys.argv.index("--") + 1 :] if "--" in sys.argv else sys.argv[1:]
    args, _ = parser.parse_known_args(argv)
    return args


def hex_to_rgba(value, alpha=1.0):
    value = value.lstrip("#")
    red = int(value[0:2], 16) / 255
    green = int(value[2:4], 16) / 255
    blue = int(value[4:6], 16) / 255
    return (red, green, blue, alpha)


def lerp(a, b, t):
    return a + (b - a) * t


def clamp(value, low, high):
    return max(low, min(high, value))


def sample_segments(segments, t):
    if not segments:
        return {"lengthMm": 10, "density": 1, "angleDeg": 0}

    t = clamp(t, 0, 1)
    for index in range(len(segments) - 1):
        current = segments[index]
        nxt = segments[index + 1]
        start = current.get("position", index / (len(segments) - 1))
        end = nxt.get("position", (index + 1) / (len(segments) - 1))
        if start <= t <= end:
            local = 0 if end == start else (t - start) / (end - start)
            return {
                "lengthMm": lerp(current["lengthMm"], nxt["lengthMm"], local),
                "density": lerp(current.get("density", 1), nxt.get("density", 1), local),
                "angleDeg": lerp(current.get("angleDeg", 0), nxt.get("angleDeg", 0), local),
            }

    last = segments[-1]
    return {
        "lengthMm": last["lengthMm"],
        "density": last.get("density", 1),
        "angleDeg": last.get("angleDeg", 0),
    }


def make_material(name, color, roughness=0.45, specular=0.35, alpha=1):
    material = bpy.data.materials.new(name)
    material.use_nodes = True
    material.blend_method = "BLEND" if alpha < 1 else "OPAQUE"
    bsdf = material.node_tree.nodes.get("Principled BSDF")
    if bsdf:
        bsdf.inputs["Base Color"].default_value = color
        bsdf.inputs["Alpha"].default_value = alpha
        if "Metallic" in bsdf.inputs:
            bsdf.inputs["Metallic"].default_value = 0
        if "Roughness" in bsdf.inputs:
            bsdf.inputs["Roughness"].default_value = roughness
        if "Specular IOR Level" in bsdf.inputs:
            bsdf.inputs["Specular IOR Level"].default_value = specular
        if "Specular Tint" in bsdf.inputs:
            bsdf.inputs["Specular Tint"].default_value = 0.15
    return material


def make_curve_object(name, points, bevel_depth, material, resolution=5):
    curve = bpy.data.curves.new(name, "CURVE")
    curve.dimensions = "3D"
    curve.resolution_u = resolution
    curve.bevel_depth = bevel_depth
    curve.bevel_resolution = 3
    curve.twist_smooth = 5

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


def lash_root_curve(t):
    x = lerp(-1.55, 1.55, t)
    y = -0.46 - 0.12 * math.sin(math.pi * t) + 0.035 * math.sin(math.pi * 2 * t)
    z = 0
    return Vector((x, y, z))


def create_lash_fiber(params, layer, index, t, material):
    mapping = sample_segments(params["mapping"]["segments"], t)
    randomness = params["randomness"]
    curl = params["curlProfile"]
    units = params["units"]
    model_scale = units.get("modelScale", 0.01)
    length_jitter = 1 + random.uniform(-randomness["length"], randomness["length"])
    angle_jitter = random.uniform(-randomness["angle"], randomness["angle"]) * 16
    depth_min, depth_max = layer["depthRange"]
    depth = random.uniform(depth_min, depth_max)
    root = lash_root_curve(t + random.uniform(-randomness["position"], randomness["position"]) * 0.018)

    length = mapping["lengthMm"] * model_scale * layer["lengthMultiplier"] * length_jitter * 8.2
    angle = math.radians(mapping.get("angleDeg", 0) + angle_jitter)
    lift = math.radians(curl["liftAngleDeg"])
    root_straightness = curl.get("rootStraightness", 0.18)
    mid_lift = curl.get("midLift", 0.42)
    tip_curl = curl.get("tipCurl", 0.56)

    side = Vector((math.sin(angle), 0, 0))
    up = Vector((0, 1, 0))
    forward = Vector((0, 0, depth))
    root_tangent = Vector((1, 0, 0)).normalized()
    root_splay = side * 0.24 + root_tangent * (0.08 if t > 0.5 else -0.08) + up * 0.36
    lifted_direction = (side * 0.52 + up * math.sin(lift) * 1.12 + forward).normalized()

    p0 = root + Vector((0, 0, depth))
    p1 = p0 + root_splay * length * (0.16 + root_straightness * 0.08)
    p2 = p0 + lifted_direction * length * (0.5 + mid_lift * 0.13) + up * length * mid_lift * 0.74
    p3 = p0 + lifted_direction * length + up * length * tip_curl * 0.98 + side * length * 0.16

    diameter = 0.0036 * layer["diameterMultiplier"] * (0.78 + mapping["density"] * 0.16)
    obj = make_curve_object(f"{layer['name']}_{index:03d}", [p0, p1, p2, p3], diameter, material)
    obj["lengthMm"] = mapping["lengthMm"]
    obj["density"] = mapping["density"]
    obj["layer"] = layer["name"]
    return obj


def create_root_band(params, material):
    points = [lash_root_curve(i / 18) + Vector((0, -0.008, -0.01)) for i in range(19)]
    return make_curve_object("RootBand", points, params["root"]["thicknessMm"] * 0.006, material, resolution=8)


def setup_scene(params):
    bpy.ops.object.select_all(action="SELECT")
    bpy.ops.object.delete()

    scene = bpy.context.scene
    scene.render.engine = "CYCLES"
    scene.cycles.samples = 96
    scene.render.film_transparent = True
    scene.render.resolution_x = params["canvas"]["widthPx"]
    scene.render.resolution_y = params["canvas"]["heightPx"]
    scene.view_settings.view_transform = "Filmic"
    scene.view_settings.look = "Medium High Contrast"
    scene.view_settings.exposure = 0
    scene.view_settings.gamma = 1

    bpy.ops.object.light_add(type="AREA", location=(0, 1.8, 2.4))
    key = bpy.context.object
    key.name = "Large Softbox"
    key.data.energy = 34
    key.data.size = 4.2

    bpy.ops.object.light_add(type="AREA", location=(1.8, 0.6, 1.2))
    rim = bpy.context.object
    rim.name = "Soft Rim"
    rim.data.energy = 4
    rim.data.size = 2.0

    bpy.ops.object.camera_add(location=(0, -3.4, 0.52), rotation=(math.radians(82), 0, 0))
    camera = bpy.context.object
    camera.name = "Ortho Camera"
    camera.data.type = "ORTHO"
    camera.data.ortho_scale = params["camera"]["orthographicScale"]
    scene.camera = camera


def generate(params):
    setup_scene(params)
    material_cfg = params["material"]
    fiber_mat = make_material(
        "Deep Black Satin Fiber",
        hex_to_rgba(material_cfg["baseColor"], 1),
        roughness=material_cfg["roughness"],
        specular=material_cfg["specular"],
    )
    root_mat = make_material(
        "Soft Black Root",
        hex_to_rgba(material_cfg["rootColor"], params["root"]["opacity"]),
        roughness=0.52,
        specular=0.22,
        alpha=params["root"]["opacity"],
    )

    random.seed(params["randomness"]["seed"])
    create_root_band(params, root_mat)

    for layer in params["layers"]:
        count = layer["fiberCount"]
        for index in range(count):
            t = 0.02 + 0.96 * (index / max(1, count - 1))
            profile = sample_segments(params["mapping"]["segments"], t)
            if random.random() > clamp(profile["density"], 0.35, 1.0):
                continue
            create_lash_fiber(params, layer, index, t, fiber_mat)


def export_outputs(params, output_override=None):
    outputs = params["outputs"]
    main_png = Path(output_override or outputs["mainPng"])
    main_png.parent.mkdir(parents=True, exist_ok=True)
    bpy.context.scene.render.filepath = str(main_png)
    bpy.ops.render.render(write_still=True)

    blend_path = Path(outputs["sourceBlend"])
    blend_path.parent.mkdir(parents=True, exist_ok=True)
    bpy.ops.wm.save_as_mainfile(filepath=str(blend_path))

    glb_path = Path(outputs["sourceGlb"])
    glb_path.parent.mkdir(parents=True, exist_ok=True)
    bpy.ops.export_scene.gltf(filepath=str(glb_path), export_format="GLB")


def main():
    args = parse_args()
    with open(args.params, "r", encoding="utf-8") as file:
        params = json.load(file)
    generate(params)
    export_outputs(params, args.output)


if __name__ == "__main__":
    main()
