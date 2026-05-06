import argparse
import json
import math
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


def taper_radius(config, t):
    geometry = config["geometry"]
    root = geometry["rootRadius"]
    mid = geometry["midRadius"]
    tip = geometry["tipRadius"]
    if t < 0.42:
        local = t / 0.42
        return lerp(root, mid, local ** 0.75)
    local = (t - 0.42) / 0.58
    return lerp(mid, tip, local ** 1.55)


def make_material(name, color, roughness, specular):
    material = bpy.data.materials.new(name)
    material.diffuse_color = color
    material.use_nodes = True
    nodes = material.node_tree.nodes
    nodes.clear()
    output = nodes.new(type="ShaderNodeOutputMaterial")
    output.location = (280, 0)
    bsdf = nodes.new(type="ShaderNodeBsdfPrincipled")
    bsdf.location = (0, 0)
    bsdf.inputs["Base Color"].default_value = color
    bsdf.inputs["Metallic"].default_value = 0
    bsdf.inputs["Roughness"].default_value = roughness
    bsdf.inputs["Specular IOR Level"].default_value = specular
    bsdf.inputs["Coat Weight"].default_value = 0.22
    bsdf.inputs["Coat Roughness"].default_value = 0.38
    if "Anisotropic" in bsdf.inputs:
        bsdf.inputs["Anisotropic"].default_value = 0.42
    material.node_tree.links.new(bsdf.outputs["BSDF"], output.inputs["Surface"])
    return material


def make_fiber_mesh(config, material):
    length = config["lengthMm"] * 0.095
    geometry = config["geometry"]
    p0 = Vector((0, -0.52, 0))
    p1 = Vector((0.02, -0.52 + length * geometry["rootStraightness"], 0.015))
    p2 = Vector((length * 0.18, -0.52 + length * 0.66, 0.04))
    p3 = Vector((length * geometry["tipHook"], -0.52 + length * (1 + geometry["curveStrength"] * 0.24), 0.08))

    rings = 58
    sides = 14
    verts = []
    faces = []
    previous_normal = Vector((1, 0, 0))

    for ring in range(rings):
        t = ring / (rings - 1)
        center = cubic(p0, p1, p2, p3, t)
        tangent = cubic_tangent(p0, p1, p2, p3, t)
        binormal = tangent.cross(previous_normal).normalized()
        if binormal.length == 0:
            binormal = Vector((0, 0, 1))
        normal = binormal.cross(tangent).normalized()
        previous_normal = normal
        radius = taper_radius(config, t)

        for side in range(sides):
            angle = (side / sides) * math.tau + geometry["twist"] * t * math.tau
            ellipse = 0.72 + 0.28 * abs(math.cos(angle))
            offset = normal * math.cos(angle) * radius * ellipse + binormal * math.sin(angle) * radius
            verts.append(center + offset)

    for ring in range(rings - 1):
        for side in range(sides):
            a = ring * sides + side
            b = ring * sides + (side + 1) % sides
            c = (ring + 1) * sides + (side + 1) % sides
            d = (ring + 1) * sides + side
            faces.append((a, b, c, d))

    mesh = bpy.data.meshes.new("single_fiber_mesh")
    mesh.from_pydata([tuple(v) for v in verts], [], faces)
    mesh.update()
    obj = bpy.data.objects.new("Tapered Single Fiber", mesh)
    bpy.context.collection.objects.link(obj)
    obj.data.materials.append(material)
    bpy.context.view_layer.objects.active = obj
    obj.select_set(True)
    bpy.ops.object.shade_smooth()
    obj.select_set(False)
    return obj, p0


def add_root_sleeve(config, material, root_point):
    geometry = config["geometry"]
    length = config["lengthMm"] * 0.095
    direction = Vector((0.02, length * geometry["rootStraightness"], 0.015)).normalized()
    side = direction.cross(Vector((0, 0, 1)))
    if side.length == 0:
        side = Vector((1, 0, 0))
    side.normalize()
    up = side.cross(direction).normalized()

    rings = 9
    sides = 14
    verts = []
    faces = []
    sleeve_length = 0.105
    for ring in range(rings):
        t = ring / (rings - 1)
        center = root_point + direction * (t * sleeve_length - 0.012)
        radius = lerp(geometry["rootRadius"] * 1.32, geometry["rootRadius"] * 0.92, t)
        for side_index in range(sides):
            angle = (side_index / sides) * math.tau
            flatten = 0.76 + 0.14 * math.sin(angle + 0.8)
            offset = side * math.cos(angle) * radius * flatten + up * math.sin(angle) * radius * 0.62
            verts.append(center + offset)

    for ring in range(rings - 1):
        for side_index in range(sides):
            a = ring * sides + side_index
            b = ring * sides + (side_index + 1) % sides
            c = (ring + 1) * sides + (side_index + 1) % sides
            d = (ring + 1) * sides + side_index
            faces.append((a, b, c, d))

    mesh = bpy.data.meshes.new("root_sleeve_mesh")
    mesh.from_pydata([tuple(v) for v in verts], [], faces)
    mesh.update()
    sleeve = bpy.data.objects.new("Short Dark Root Sleeve", mesh)
    bpy.context.collection.objects.link(sleeve)
    sleeve.data.materials.append(material)
    bpy.context.view_layer.objects.active = sleeve
    sleeve.select_set(True)
    bpy.ops.object.shade_smooth()
    sleeve.select_set(False)

    bulb_location = root_point - direction * 0.022 + up * 0.002
    bpy.ops.mesh.primitive_uv_sphere_add(
        segments=24,
        ring_count=12,
        radius=geometry["rootBulbRadius"] * 0.66,
        location=bulb_location,
    )
    bulb = bpy.context.object
    bulb.name = "Small Root Adhesive Knot"
    bulb.scale = (0.95, 0.58, 0.42)
    bulb.rotation_euler[2] = math.radians(-18)
    bulb.data.materials.append(material)
    bpy.ops.object.shade_smooth()


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
    scene.view_settings.exposure = -0.65

    bpy.ops.object.light_add(type="AREA", location=(-0.95, -1.35, 1.65))
    key = bpy.context.object
    key.name = "Long Soft Reflection"
    key.data.energy = 80
    key.data.size = 2.8

    bpy.ops.object.light_add(type="AREA", location=(0.7, -1.05, 0.62))
    rim = bpy.context.object
    rim.name = "Thin Rim"
    rim.data.energy = 12
    rim.data.size = 0.55

    bpy.ops.object.camera_add(location=(0.32, -0.32, 2.85))
    camera = bpy.context.object
    camera.data.type = "ORTHO"
    camera.data.ortho_scale = 1.24
    target = Vector((0.055, 0.03, 0.025))
    direction = target - camera.location
    camera.rotation_euler = direction.to_track_quat("-Z", "Y").to_euler()
    scene.camera = camera


def add_preview_background():
    material = bpy.data.materials.new("Calibration Warm Gray Background")
    material.diffuse_color = (0.82, 0.82, 0.78, 1)
    material.use_nodes = True
    bsdf = material.node_tree.nodes.get("Principled BSDF")
    if bsdf:
        bsdf.inputs["Base Color"].default_value = (0.82, 0.82, 0.78, 1)
        bsdf.inputs["Roughness"].default_value = 0.9

    bpy.ops.mesh.primitive_plane_add(size=2.0, location=(0.055, 0.02, -0.09))
    plane = bpy.context.object
    plane.name = "Preview Contrast Background"
    plane.data.materials.append(material)
    return plane


def render(config):
    setup_scene(config)
    fiber_mat = make_material(
        "Deep Black PBT Satin",
        hex_to_rgba(config["color"]["base"]),
        config["material"]["roughness"],
        config["material"]["specular"],
    )
    root_mat = make_material("Root Dark Adhesive", hex_to_rgba("#010101"), 0.78, 0.05)
    _, root = make_fiber_mesh(config, fiber_mat)
    add_root_sleeve(config, root_mat, root)

    output = Path(config["render"]["output"])
    output.parent.mkdir(parents=True, exist_ok=True)
    bpy.context.scene.render.filepath = str(output)
    bpy.ops.render.render(write_still=True)

    preview_output = output.with_name("preview-gray.png")
    bpy.context.scene.render.film_transparent = False
    add_preview_background()
    bpy.context.scene.render.filepath = str(preview_output)
    bpy.ops.render.render(write_still=True)


def main():
    args = parse_args()
    with open(args.config, "r", encoding="utf-8") as file:
        config = json.load(file)
    render(config)


if __name__ == "__main__":
    main()
