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


def taper_radius(geometry, t, scale):
    root = geometry["rootRadius"] * scale
    mid = geometry["midRadius"] * scale
    tip = geometry["tipRadius"] * scale
    if t < 0.32:
        local = t / 0.32
        return lerp(root, mid, local ** 0.66)
    if t < 0.86:
        local = (t - 0.32) / 0.54
        return lerp(mid, mid * 0.42, local ** 1.16)
    local = (t - 0.86) / 0.14
    return lerp(mid * 0.42, tip, local ** 2.35)


def make_material(name, color, roughness, specular, anisotropic, bump_strength):
    material = bpy.data.materials.new(name)
    material.diffuse_color = color
    material.use_nodes = True
    nodes = material.node_tree.nodes
    nodes.clear()
    output = nodes.new(type="ShaderNodeOutputMaterial")
    bsdf = nodes.new(type="ShaderNodeBsdfPrincipled")
    bsdf.inputs["Base Color"].default_value = color
    bsdf.inputs["Metallic"].default_value = 0
    bsdf.inputs["Roughness"].default_value = roughness
    bsdf.inputs["Specular IOR Level"].default_value = specular
    bsdf.inputs["Coat Weight"].default_value = 0.12
    bsdf.inputs["Coat Roughness"].default_value = 0.48
    if "Anisotropic" in bsdf.inputs:
        bsdf.inputs["Anisotropic"].default_value = anisotropic
    if bump_strength > 0:
        noise = nodes.new(type="ShaderNodeTexNoise")
        noise.inputs["Scale"].default_value = 115
        noise.inputs["Detail"].default_value = 12
        noise.inputs["Roughness"].default_value = 0.55
        bump = nodes.new(type="ShaderNodeBump")
        bump.inputs["Strength"].default_value = bump_strength
        bump.inputs["Distance"].default_value = 0.012
        material.node_tree.links.new(noise.outputs["Fac"], bump.inputs["Height"])
        material.node_tree.links.new(bump.outputs["Normal"], bsdf.inputs["Normal"])
    material.node_tree.links.new(bsdf.outputs["BSDF"], output.inputs["Surface"])
    return material


def make_fiber_mesh(name, spec, geometry, material):
    length = spec["lengthMm"] * 0.055
    root = spec["root"]
    lean = spec["lean"]
    lift = spec["lift"]
    curve = geometry["curveStrength"] * spec["curlScale"]

    p0 = root
    p1 = root + Vector((lean * length * 0.03, length * 0.2, lift * 0.22))
    p2 = root + Vector((lean * length * 0.28, length * (0.62 + curve * 0.05), lift * 0.68))
    p3 = root + Vector((lean * length * 0.84, length * (0.9 + curve * 0.1), lift))
    root_direction = (p1 - p0).normalized()
    root_length = geometry["rootLength"] * spec["rootScale"]
    root_start = p0 - root_direction * root_length
    root_section = geometry["rootSection"]

    rings = 70
    sides = 12
    verts = []
    faces = []
    previous_normal = Vector((1, 0, 0))

    for ring in range(rings):
        q = ring / (rings - 1)
        if q < root_section:
            root_t = q / root_section
            center = root_start + root_direction * root_length * root_t
            tangent = root_direction
            profile = math.sin(root_t * math.pi * 0.5)
            radius = geometry["rootRadius"] * spec["radiusScale"] * lerp(geometry["rootStartScale"], 1, profile)
        else:
            t = (q - root_section) / (1 - root_section)
            center = cubic(p0, p1, p2, p3, t)
            tangent = cubic_tangent(p0, p1, p2, p3, t)
            radius = taper_radius(geometry, t, spec["radiusScale"])

        binormal = tangent.cross(previous_normal).normalized()
        if binormal.length == 0:
            binormal = Vector((0, 0, 1))
        normal = binormal.cross(tangent).normalized()
        previous_normal = normal

        for side in range(sides):
            angle = (side / sides) * math.tau + geometry["twist"] * q * math.tau + spec["twistOffset"]
            ellipse = 0.64 + 0.36 * abs(math.cos(angle))
            grain = 1 + 0.014 * math.sin(angle * 3.0 + q * 19.0 + spec["phase"])
            wobble = 1 + 0.01 * math.sin(q * 83.0 + side * 0.71 + spec["phase"])
            local_radius = radius * grain * wobble
            offset = normal * math.cos(angle) * local_radius * ellipse + binormal * math.sin(angle) * local_radius
            verts.append(center + offset)

    for ring in range(rings - 1):
        for side in range(sides):
            a = ring * sides + side
            b = ring * sides + (side + 1) % sides
            c = (ring + 1) * sides + (side + 1) % sides
            d = (ring + 1) * sides + side
            faces.append((a, b, c, d))

    start_center = len(verts)
    verts.append(root_start)
    end_center = len(verts)
    verts.append(p3 + cubic_tangent(p0, p1, p2, p3, 1) * geometry["tipExtension"])
    for side in range(sides):
        faces.append((start_center, (side + 1) % sides, side))
        a = (rings - 1) * sides + side
        b = (rings - 1) * sides + (side + 1) % sides
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
    return obj


def setup_scene(config):
    bpy.ops.object.select_all(action="SELECT")
    bpy.ops.object.delete()
    scene = bpy.context.scene
    scene.render.engine = "CYCLES"
    scene.cycles.samples = config["render"]["samples"]
    scene.render.film_transparent = True
    scene.render.resolution_x = config["render"]["widthPx"]
    scene.render.resolution_y = config["render"]["heightPx"]
    scene.view_settings.view_transform = "Filmic"
    scene.view_settings.look = "Medium High Contrast"
    scene.view_settings.exposure = -0.58

    bpy.ops.object.light_add(type="AREA", location=(-0.8, -0.75, 1.9))
    key = bpy.context.object
    key.name = "Large eyelash reflection"
    key.data.energy = 82
    key.data.size = 2.8

    bpy.ops.object.light_add(type="AREA", location=(0.85, -0.35, 0.8))
    rim = bpy.context.object
    rim.name = "Outer rim"
    rim.data.energy = 10
    rim.data.size = 0.55

    bpy.ops.object.camera_add(location=(0.08, -0.14, 2.7))
    camera = bpy.context.object
    camera.data.type = "ORTHO"
    camera.data.ortho_scale = 1.38
    target = Vector((0.04, 0.24, 0.0))
    direction = target - camera.location
    camera.rotation_euler = direction.to_track_quat("-Z", "Y").to_euler()
    scene.camera = camera


def add_preview_background():
    material = bpy.data.materials.new("Warm skin-gray calibration")
    material.diffuse_color = (0.82, 0.8, 0.75, 1)
    material.use_nodes = True
    nodes = material.node_tree.nodes
    nodes.clear()
    output = nodes.new(type="ShaderNodeOutputMaterial")
    bsdf = nodes.new(type="ShaderNodeBsdfPrincipled")
    bsdf.inputs["Base Color"].default_value = (0.82, 0.8, 0.75, 1)
    bsdf.inputs["Roughness"].default_value = 0.88
    material.node_tree.links.new(bsdf.outputs["BSDF"], output.inputs["Surface"])
    bpy.ops.mesh.primitive_plane_add(size=2.0, location=(0.05, 0.38, -0.08))
    plane = bpy.context.object
    plane.name = "Preview skin plane"
    plane.data.materials.append(material)

    lid_material = bpy.data.materials.new("Soft eyelid root occlusion")
    lid_material.diffuse_color = (0.78, 0.76, 0.71, 1)
    lid_material.use_nodes = True
    nodes = lid_material.node_tree.nodes
    nodes.clear()
    output = nodes.new(type="ShaderNodeOutputMaterial")
    bsdf = nodes.new(type="ShaderNodeBsdfPrincipled")
    bsdf.inputs["Base Color"].default_value = (0.78, 0.76, 0.71, 1)
    bsdf.inputs["Roughness"].default_value = 0.92
    lid_material.node_tree.links.new(bsdf.outputs["BSDF"], output.inputs["Surface"])

    verts = [
        (-0.62, -0.018, 0.11),
        (0.62, -0.01, 0.11),
        (0.62, -0.09, 0.11),
        (-0.62, -0.105, 0.11),
    ]
    mesh = bpy.data.meshes.new("eyelid_occlusion_mesh")
    mesh.from_pydata(verts, [], [(0, 1, 2, 3)])
    mesh.update()
    lid = bpy.data.objects.new("Preview eyelid root occlusion", mesh)
    bpy.context.collection.objects.link(lid)
    lid.data.materials.append(lid_material)


def build_specs(config):
    rng = random.Random(config["seed"])
    layout = config["layout"]
    specs = []
    width = layout["width"]
    layer_start_offsets = [-0.015, 0.0, 0.018]

    for layer_index, layer in enumerate(layout["layers"]):
        count = layer["count"]
        for i in range(count):
            base = i / max(count - 1, 1)
            stagger = (layer_index - 1) * 0.012
            x = -width * 0.5 + width * (base + rng.uniform(-0.055, 0.055)) + stagger
            root_y = layout["rootCurve"] * math.sin((base - 0.5) * math.pi) + rng.uniform(-0.018, 0.012)
            root_z = layer["z"] + layer_start_offsets[layer_index] + rng.uniform(-0.006, 0.006)
            length = rng.uniform(layer["lengthMin"], layer["lengthMax"])
            lean = rng.uniform(layer["leanMin"], layer["leanMax"]) + base * 0.12 + rng.uniform(-layer["angleJitter"], layer["angleJitter"])
            specs.append(
                {
                    "layer": layer["name"],
                    "root": Vector((x, root_y, root_z)),
                    "lengthMm": length,
                    "lean": max(0.12, lean),
                    "lift": 0.022 + layer_index * 0.014 + rng.uniform(-0.008, 0.008),
                    "curlScale": rng.uniform(0.88, 1.14),
                    "radiusScale": rng.uniform(0.86, 1.08),
                    "rootScale": rng.uniform(0.72, 1.08),
                    "twistOffset": rng.uniform(0, math.tau),
                    "phase": rng.uniform(0, math.tau),
                }
            )
    return sorted(specs, key=lambda item: item["root"].z)


def render(config):
    setup_scene(config)
    material_config = config["material"]
    fiber_material = make_material(
        "Gray-black PBT segment fibers",
        hex_to_rgba(material_config["base"]),
        material_config["roughness"],
        material_config["specular"],
        material_config["anisotropic"],
        material_config["bumpStrength"],
    )

    for index, spec in enumerate(build_specs(config), start=1):
        make_fiber_mesh(f"Segment fiber {index:02d}", spec, config["geometry"], fiber_material)

    output = Path(config["render"]["output"])
    output.parent.mkdir(parents=True, exist_ok=True)
    bpy.context.scene.render.filepath = str(output)
    bpy.ops.render.render(write_still=True)

    bpy.context.scene.render.film_transparent = False
    add_preview_background()
    bpy.context.scene.render.filepath = str(output.with_name("preview-gray.png"))
    bpy.ops.render.render(write_still=True)


def main():
    args = parse_args()
    with open(args.config, "r", encoding="utf-8") as file:
        config = json.load(file)
    render(config)


if __name__ == "__main__":
    main()
