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


def cubic(p0, p1, p2, p3, t):
    u = 1 - t
    return p0 * (u ** 3) + p1 * (3 * u * u * t) + p2 * (3 * u * t * t) + p3 * (t ** 3)


def cubic_tangent(p0, p1, p2, p3, t):
    u = 1 - t
    tangent = (p1 - p0) * (3 * u * u) + (p2 - p1) * (6 * u * t) + (p3 - p2) * (3 * t * t)
    return tangent.normalized()


def pixel_to_world(px, py, width, height):
    aspect = width / height
    return Vector(((px / width - 0.5) * aspect, 0.5 - py / height, 0))


def lash_line_point(config, t):
    size = config["backgroundSize"]
    start = pixel_to_world(*config["lashLinePx"]["start"], size["widthPx"], size["heightPx"])
    mid = pixel_to_world(*config["lashLinePx"]["mid"], size["widthPx"], size["heightPx"])
    end = pixel_to_world(*config["lashLinePx"]["end"], size["widthPx"], size["heightPx"])
    u = 1 - t
    return start * (u * u) + mid * (2 * u * t) + end * (t * t)


def lash_line_tangent(config, t):
    size = config["backgroundSize"]
    start = pixel_to_world(*config["lashLinePx"]["start"], size["widthPx"], size["heightPx"])
    mid = pixel_to_world(*config["lashLinePx"]["mid"], size["widthPx"], size["heightPx"])
    end = pixel_to_world(*config["lashLinePx"]["end"], size["widthPx"], size["heightPx"])
    tangent = (mid - start) * (2 * (1 - t)) + (end - mid) * (2 * t)
    tangent.z = 0
    return tangent.normalized()


def taper_radius(segment, t, radius_scale):
    root = segment["rootRadius"] * radius_scale
    mid = segment["midRadius"] * radius_scale
    tip = segment["tipRadius"] * radius_scale
    if t < 0.32:
        local = t / 0.32
        return lerp(root, mid, local ** 0.66)
    if t < 0.86:
        local = (t - 0.32) / 0.54
        return lerp(mid, mid * 0.42, local ** 1.16)
    local = (t - 0.86) / 0.14
    return lerp(mid * 0.42, tip, local ** 2.35)


def make_material(segment):
    material = bpy.data.materials.new("Try-on gray-black PBT")
    material.diffuse_color = hex_to_rgba(segment["baseColor"])
    material.use_nodes = True
    nodes = material.node_tree.nodes
    nodes.clear()
    output = nodes.new(type="ShaderNodeOutputMaterial")
    bsdf = nodes.new(type="ShaderNodeBsdfPrincipled")
    bsdf.inputs["Base Color"].default_value = hex_to_rgba(segment["baseColor"])
    bsdf.inputs["Metallic"].default_value = 0
    bsdf.inputs["Roughness"].default_value = segment["roughness"]
    bsdf.inputs["Specular IOR Level"].default_value = segment["specular"]
    bsdf.inputs["Coat Weight"].default_value = 0.1
    bsdf.inputs["Coat Roughness"].default_value = 0.52
    if "Anisotropic" in bsdf.inputs:
        bsdf.inputs["Anisotropic"].default_value = segment["anisotropic"]
    material.node_tree.links.new(bsdf.outputs["BSDF"], output.inputs["Surface"])
    return material


def add_background(config):
    size = config["backgroundSize"]
    aspect = size["widthPx"] / size["heightPx"]
    image = bpy.data.images.load(config["backgroundImage"])

    material = bpy.data.materials.new("Reference eye background")
    material.use_nodes = True
    nodes = material.node_tree.nodes
    nodes.clear()
    output = nodes.new(type="ShaderNodeOutputMaterial")
    bsdf = nodes.new(type="ShaderNodeBsdfPrincipled")
    texture = nodes.new(type="ShaderNodeTexImage")
    texture.image = image
    bsdf.inputs["Roughness"].default_value = 0.86
    material.node_tree.links.new(texture.outputs["Color"], bsdf.inputs["Base Color"])
    material.node_tree.links.new(bsdf.outputs["BSDF"], output.inputs["Surface"])

    bpy.ops.mesh.primitive_plane_add(size=1, location=(0, 0, -0.035))
    plane = bpy.context.object
    plane.name = "Reference image plane"
    plane.dimensions = (aspect, 1, 1)
    plane.data.materials.append(material)
    return plane


def setup_scene(config):
    bpy.ops.object.select_all(action="SELECT")
    bpy.ops.object.delete()
    scene = bpy.context.scene
    scene.render.engine = "CYCLES"
    scene.cycles.samples = config["render"]["samples"]
    scene.render.film_transparent = False
    scene.render.resolution_x = config["render"]["widthPx"]
    scene.render.resolution_y = config["render"]["heightPx"]
    scene.view_settings.view_transform = "Filmic"
    scene.view_settings.look = "Medium High Contrast"
    scene.view_settings.exposure = -0.1

    bpy.ops.object.light_add(type="AREA", location=(-0.35, 0.35, 1.2))
    key = bpy.context.object
    key.name = "Eye photo softbox match"
    key.data.energy = 55
    key.data.size = 1.6

    bpy.ops.object.light_add(type="AREA", location=(0.45, 0.1, 0.75))
    rim = bpy.context.object
    rim.name = "Fine lash rim"
    rim.data.energy = 5
    rim.data.size = 0.45

    bpy.ops.object.camera_add(location=(0, 0, 1.55), rotation=(0, 0, 0))
    camera = bpy.context.object
    camera.data.type = "ORTHO"
    camera.data.ortho_scale = 1.0
    camera.rotation_euler = Vector((0, 0, -1)).to_track_quat("-Z", "Y").to_euler()
    scene.camera = camera


def build_specs(config):
    rng = random.Random(config["seed"])
    layout = config["layout"]
    size = config["backgroundSize"]
    specs = []

    for layer_index, layer in enumerate(layout["layers"]):
        for i in range(layer["count"]):
            base = (i + 0.5) / layer["count"]
            biased = base ** (1 - layout["outerDensityBias"])
            t = min(0.98, max(layout["innerSkip"], biased + rng.uniform(-0.03, 0.03)))
            root = lash_line_point(config, t)
            tangent = lash_line_tangent(config, t)
            projected_length = layer["liftPx"] / size["heightPx"]
            outward = tangent * rng.uniform(layer["outwardMin"], layer["outwardMax"]) * projected_length
            projected_out_from_lid = Vector((0, -1, 0)) * projected_length
            root += Vector(
                (
                    rng.uniform(-layout["rootNoisePx"], layout["rootNoisePx"]) / size["widthPx"],
                    rng.uniform(-layout["rootNoisePx"], layout["rootNoisePx"]) / size["heightPx"],
                    layer["z"] + rng.uniform(-0.004, 0.004),
                )
            )
            specs.append(
                {
                    "root": root,
                    "direction": (projected_out_from_lid + outward).normalized(),
                    "lengthMm": rng.uniform(layer["lengthMin"], layer["lengthMax"]),
                    "curl": rng.uniform(0.82, 1.18),
                    "radiusScale": rng.uniform(0.82, 1.06),
                    "rootScale": rng.uniform(0.68, 1.05),
                    "phase": rng.uniform(0, math.tau),
                    "twistOffset": rng.uniform(0, math.tau),
                }
            )
    return sorted(specs, key=lambda item: item["root"].z)


def make_fiber_mesh(name, spec, segment, material):
    length = spec["lengthMm"] * segment["lengthScale"]
    side = Vector((spec["direction"].y, -spec["direction"].x, 0)).normalized()
    if side.x < 0:
        side = -side
    direction = spec["direction"]
    p0 = spec["root"]
    p1 = p0 + direction * length * 0.24 + side * length * 0.01
    p2 = p0 + direction * length * 0.66 + side * length * 0.09 * spec["curl"] + Vector((0, 0, 0.012))
    p3 = p0 + direction * length * 1.0 + side * length * 0.18 * spec["curl"] + Vector((0, 0, 0.018))
    root_direction = (p1 - p0).normalized()
    root_length = segment["rootLength"] * spec["rootScale"]
    root_start = p0 - root_direction * root_length

    rings = 66
    sides = 12
    verts = []
    faces = []
    previous_normal = Vector((1, 0, 0))

    for ring in range(rings):
        q = ring / (rings - 1)
        if q < segment["rootSection"]:
            root_t = q / segment["rootSection"]
            center = root_start + root_direction * root_length * root_t
            tangent = root_direction
            profile = math.sin(root_t * math.pi * 0.5)
            radius = segment["rootRadius"] * spec["radiusScale"] * lerp(segment["rootStartScale"], 1, profile)
        else:
            t = (q - segment["rootSection"]) / (1 - segment["rootSection"])
            center = cubic(p0, p1, p2, p3, t)
            tangent = cubic_tangent(p0, p1, p2, p3, t)
            radius = taper_radius(segment, t, spec["radiusScale"])

        binormal = tangent.cross(previous_normal).normalized()
        if binormal.length == 0:
            binormal = Vector((0, 0, 1))
        normal = binormal.cross(tangent).normalized()
        previous_normal = normal
        for side_index in range(sides):
            angle = (side_index / sides) * math.tau + 0.09 * q * math.tau + spec["twistOffset"]
            ellipse = 0.62 + 0.38 * abs(math.cos(angle))
            grain = 1 + 0.012 * math.sin(angle * 3 + q * 19 + spec["phase"])
            offset = normal * math.cos(angle) * radius * ellipse * grain + binormal * math.sin(angle) * radius * grain
            verts.append(center + offset)

    for ring in range(rings - 1):
        for side_index in range(sides):
            a = ring * sides + side_index
            b = ring * sides + (side_index + 1) % sides
            c = (ring + 1) * sides + (side_index + 1) % sides
            d = (ring + 1) * sides + side_index
            faces.append((a, b, c, d))

    start_center = len(verts)
    verts.append(root_start)
    end_center = len(verts)
    verts.append(p3 + cubic_tangent(p0, p1, p2, p3, 1) * segment["tipExtension"])
    for side_index in range(sides):
        faces.append((start_center, (side_index + 1) % sides, side_index))
        a = (rings - 1) * sides + side_index
        b = (rings - 1) * sides + (side_index + 1) % sides
        faces.append((end_center, a, b))

    mesh = bpy.data.meshes.new(f"{name}_mesh")
    mesh.from_pydata([tuple(v) for v in verts], [], faces)
    mesh.update()
    obj = bpy.data.objects.new(name, mesh)
    bpy.context.collection.objects.link(obj)
    obj.data.materials.append(material)
    bpy.context.view_layer.objects.active = obj
    obj.select_set(True)
    bpy.ops.object.shade_smooth()
    obj.select_set(False)


def render(config):
    setup_scene(config)
    add_background(config)
    material = make_material(config["segment"])
    for index, spec in enumerate(build_specs(config), start=1):
        make_fiber_mesh(f"Try-on lash {index:02d}", spec, config["segment"], material)

    output = Path(config["render"]["output"])
    output.parent.mkdir(parents=True, exist_ok=True)
    bpy.context.scene.render.filepath = str(output)
    bpy.ops.render.render(write_still=True)


def main():
    args = parse_args()
    with open(args.config, "r", encoding="utf-8") as file:
        config = json.load(file)
    render(config)


if __name__ == "__main__":
    main()
