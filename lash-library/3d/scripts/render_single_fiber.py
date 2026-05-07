import argparse
import json
import math
import sys
from pathlib import Path

import bpy
from bpy_extras.object_utils import world_to_camera_view
from mathutils import Vector


def parse_args():
    parser = argparse.ArgumentParser()
    parser.add_argument("--config")
    parser.add_argument("--config-dir")
    argv = sys.argv[sys.argv.index("--") + 1 :] if "--" in sys.argv else sys.argv[1:]
    args = parser.parse_args(argv)
    if not args.config and not args.config_dir:
        parser.error("provide --config or --config-dir")
    return args


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


def mix_rgba(a, b, t, alpha=None):
    return (
        lerp(a[0], b[0], t),
        lerp(a[1], b[1], t),
        lerp(a[2], b[2], t),
        a[3] if alpha is None else alpha,
    )


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
    if t < 0.34:
        local = t / 0.34
        return lerp(root, mid, local ** 0.68)
    if t < 0.86:
        local = (t - 0.34) / 0.52
        return lerp(mid, mid * 0.48, local ** 1.18)
    local = (t - 0.86) / 0.14
    return lerp(mid * 0.48, tip, local ** 2.25)


def make_material(name, color, roughness, specular, anisotropic=0.4, bump_strength=0.0, alpha=1.0, coat_weight=0.16):
    material = bpy.data.materials.new(name)
    color = (color[0], color[1], color[2], alpha)
    material.diffuse_color = color
    material.use_nodes = True
    nodes = material.node_tree.nodes
    nodes.clear()
    output = nodes.new(type="ShaderNodeOutputMaterial")
    output.location = (520, 0)
    bsdf = nodes.new(type="ShaderNodeBsdfPrincipled")
    bsdf.location = (0, 0)
    bsdf.inputs["Base Color"].default_value = color
    bsdf.inputs["Metallic"].default_value = 0
    bsdf.inputs["Roughness"].default_value = roughness
    bsdf.inputs["Specular IOR Level"].default_value = specular
    bsdf.inputs["Coat Weight"].default_value = coat_weight
    bsdf.inputs["Coat Roughness"].default_value = 0.44
    if "Alpha" in bsdf.inputs:
        bsdf.inputs["Alpha"].default_value = alpha
    if "Anisotropic" in bsdf.inputs:
        bsdf.inputs["Anisotropic"].default_value = anisotropic
    if bump_strength > 0:
        noise = nodes.new(type="ShaderNodeTexNoise")
        noise.location = (-540, -190)
        noise.inputs["Scale"].default_value = 95
        noise.inputs["Detail"].default_value = 13
        noise.inputs["Roughness"].default_value = 0.58
        bump = nodes.new(type="ShaderNodeBump")
        bump.location = (-260, -170)
        bump.inputs["Strength"].default_value = bump_strength
        bump.inputs["Distance"].default_value = 0.018
        material.node_tree.links.new(noise.outputs["Fac"], bump.inputs["Height"])
        material.node_tree.links.new(bump.outputs["Normal"], bsdf.inputs["Normal"])
    if alpha < 1:
        transparent = nodes.new(type="ShaderNodeBsdfTransparent")
        transparent.location = (0, -250)
        mix_shader = nodes.new(type="ShaderNodeMixShader")
        mix_shader.location = (260, 0)
        mix_shader.inputs[0].default_value = 1 - alpha
        material.node_tree.links.new(bsdf.outputs["BSDF"], mix_shader.inputs[1])
        material.node_tree.links.new(transparent.outputs["BSDF"], mix_shader.inputs[2])
        material.node_tree.links.new(mix_shader.outputs["Shader"], output.inputs["Surface"])
        if hasattr(material, "blend_method"):
            material.blend_method = "BLEND"
        if hasattr(material, "surface_render_method"):
            material.surface_render_method = "BLENDED"
        if hasattr(material, "show_transparent_back"):
            material.show_transparent_back = True
    else:
        material.node_tree.links.new(bsdf.outputs["BSDF"], output.inputs["Surface"])
    return material


def make_fiber_materials(config):
    color = config["color"]
    material_config = config["material"]
    base = hex_to_rgba(color["base"])
    edge = hex_to_rgba(color.get("edge", color["base"]))
    highlight = hex_to_rgba(color.get("highlight", color["base"]))
    shaft_color = mix_rgba(base, highlight, material_config.get("highlightMix", 0.06), material_config.get("shaftAlpha", 0.97))
    root_color = mix_rgba(edge, shaft_color, material_config.get("rootShaftMix", 0.72), material_config.get("rootAlpha", 0.98))
    tip_color = mix_rgba(base, highlight, material_config.get("tipHighlightMix", 0.24), material_config.get("tipAlpha", 0.62))
    roughness = material_config["roughness"]
    specular = material_config["specular"]
    anisotropic = material_config.get("anisotropic", 0.4)
    return [
        make_material(
            "Soft Dark Root",
            root_color,
            min(0.84, roughness + 0.025),
            specular * 0.9,
            anisotropic,
            material_config.get("rootBumpStrength", 0.006),
            root_color[3],
            material_config.get("rootCoatWeight", 0.08),
        ),
        make_material(
            "Satin PBT Shaft",
            shaft_color,
            roughness,
            specular,
            anisotropic,
            material_config.get("bumpStrength", 0.008),
            shaft_color[3],
            material_config.get("coatWeight", 0.16),
        ),
        make_material(
            "Feathered Semi Transparent Tip",
            tip_color,
            min(0.92, roughness + 0.12),
            specular * 0.86,
            anisotropic,
            material_config.get("tipBumpStrength", 0.002),
            tip_color[3],
            material_config.get("tipCoatWeight", 0.06),
        ),
    ]


def material_index_for_q(q, geometry):
    root_limit = geometry.get("rootSection", 0.045) + geometry.get("rootMaterialLength", 0.045)
    tip_start = geometry.get("tipMaterialStart", 0.83)
    if q < root_limit:
        return 0
    if q > tip_start:
        return 2
    return 1


def make_fiber_mesh(config, materials):
    length = config["lengthMm"] * 0.095
    geometry = config["geometry"]
    p0 = Vector((0, -0.52, 0))
    p1 = Vector((0.02, -0.52 + length * geometry["rootStraightness"], 0.015))
    p2 = Vector((length * 0.18, -0.52 + length * 0.66, 0.04))
    p3 = Vector((length * geometry["tipHook"], -0.52 + length * (1 + geometry["curveStrength"] * 0.24), 0.08))
    root_direction = (p1 - p0).normalized()
    root_length = geometry.get("rootLength", 0.042)
    root_start = p0 - root_direction * root_length
    root_section = geometry.get("rootSection", 0.045)

    rings = 116
    sides = 24
    verts = []
    faces = []
    material_indices = []
    previous_normal = Vector((1, 0, 0))
    micro_amp = geometry.get("microBendAmplitude", 0.0)
    micro_freq = geometry.get("microBendFrequency", 3.0)
    micro_phase = geometry.get("microBendPhase", 0.0)
    micro_depth = geometry.get("microDepthAmplitude", micro_amp * 0.42)

    for ring in range(rings):
        q = ring / (rings - 1)
        if q < root_section:
            root_t = q / root_section
            center = root_start + root_direction * root_length * root_t
            tangent = root_direction
            root_profile = math.sin(root_t * math.pi * 0.5)
            root_start_scale = geometry.get("rootStartScale", 0.2)
            radius = geometry["rootRadius"] * lerp(root_start_scale, 1, root_profile)
        else:
            t = (q - root_section) / (1 - root_section)
            center = cubic(p0, p1, p2, p3, t)
            tangent = cubic_tangent(p0, p1, p2, p3, t)
            radius = taper_radius(config, t)
        if micro_amp:
            falloff = math.sin(q * math.pi) ** 1.4
            center.x += math.sin(q * math.tau * micro_freq + micro_phase) * micro_amp * falloff
            center.z += math.cos(q * math.tau * (micro_freq * 0.72) + micro_phase * 1.37) * micro_depth * falloff
        binormal = tangent.cross(previous_normal).normalized()
        if binormal.length == 0:
            binormal = Vector((0, 0, 1))
        normal = binormal.cross(tangent).normalized()
        previous_normal = normal

        for side in range(sides):
            angle = (side / sides) * math.tau + geometry["twist"] * q * math.tau
            ellipse = 0.68 + 0.32 * abs(math.cos(angle))
            longitudinal_grain = 1 + 0.018 * math.sin(angle * 3.0 + q * 17.0)
            hand_variation = 1 + 0.009 * math.sin(q * 91.0 + side * 0.73)
            local_radius = radius * longitudinal_grain * hand_variation
            offset = normal * math.cos(angle) * local_radius * ellipse + binormal * math.sin(angle) * local_radius
            verts.append(center + offset)

    for ring in range(rings - 1):
        for side in range(sides):
            a = ring * sides + side
            b = ring * sides + (side + 1) % sides
            c = (ring + 1) * sides + (side + 1) % sides
            d = (ring + 1) * sides + side
            faces.append((a, b, c, d))
            material_indices.append(material_index_for_q((ring + 0.5) / (rings - 1), geometry))
    start_center = len(verts)
    verts.append(root_start)
    end_center = len(verts)
    verts.append(p3 + cubic_tangent(p0, p1, p2, p3, 1) * geometry.get("tipExtension", 0.028))
    for side in range(sides):
        faces.append((start_center, (side + 1) % sides, side))
        material_indices.append(0)
        a = (rings - 1) * sides + side
        b = (rings - 1) * sides + (side + 1) % sides
        faces.append((end_center, a, b))
        material_indices.append(2)

    mesh = bpy.data.meshes.new("single_fiber_mesh")
    mesh.from_pydata([tuple(v) for v in verts], [], faces)
    mesh.update()
    obj = bpy.data.objects.new("Tapered Single Fiber", mesh)
    bpy.context.collection.objects.link(obj)
    for material in materials:
        obj.data.materials.append(material)
    for polygon, material_index in zip(obj.data.polygons, material_indices):
        polygon.material_index = material_index
    bpy.context.view_layer.objects.active = obj
    obj.select_set(True)
    bpy.ops.object.shade_smooth()
    obj.select_set(False)
    return obj, root_start, p3

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
    scene.view_settings.exposure = -0.72

    bpy.ops.object.light_add(type="AREA", location=(-0.86, -1.2, 1.78))
    key = bpy.context.object
    key.name = "Long Soft Reflection"
    key.data.energy = 68
    key.data.size = 2.2

    bpy.ops.object.light_add(type="AREA", location=(0.62, -0.78, 0.54))
    rim = bpy.context.object
    rim.name = "Thin Rim"
    rim.data.energy = 7
    rim.data.size = 0.42

    bpy.ops.object.camera_add(location=(0.32, -0.32, 2.85))
    camera = bpy.context.object
    camera.data.type = "ORTHO"
    camera.data.ortho_scale = 1.24
    target = Vector((0.055, 0.03, 0.025))
    direction = target - camera.location
    camera.rotation_euler = direction.to_track_quat("-Z", "Y").to_euler()
    scene.camera = camera


def aim_camera(target, ortho_scale):
    camera = bpy.context.scene.camera
    camera.location = Vector((target.x + 0.32, target.y - 0.32, target.z + 2.85))
    direction = target - camera.location
    camera.rotation_euler = direction.to_track_quat("-Z", "Y").to_euler()
    camera.data.ortho_scale = ortho_scale


def add_preview_background():
    material = bpy.data.materials.new("Calibration Warm Gray Background")
    material.diffuse_color = (0.82, 0.82, 0.78, 1)
    material.use_nodes = True
    nodes = material.node_tree.nodes
    nodes.clear()
    output = nodes.new(type="ShaderNodeOutputMaterial")
    bsdf = nodes.new(type="ShaderNodeBsdfPrincipled")
    bsdf.inputs["Base Color"].default_value = (0.82, 0.82, 0.78, 1)
    bsdf.inputs["Roughness"].default_value = 0.9
    material.node_tree.links.new(bsdf.outputs["BSDF"], output.inputs["Surface"])

    bpy.ops.mesh.primitive_plane_add(size=2.0, location=(0.055, 0.02, -0.09))
    plane = bpy.context.object
    plane.name = "Preview Contrast Background"
    plane.data.materials.append(material)
    return plane


def projected_anchor(scene, point):
    camera = scene.camera
    projected = world_to_camera_view(scene, camera, point)
    return {
        "x": round(projected.x, 6),
        "y": round(1 - projected.y, 6),
        "pixelX": round(projected.x * scene.render.resolution_x, 2),
        "pixelY": round((1 - projected.y) * scene.render.resolution_y, 2),
    }


def write_metadata(config, root, tip, output):
    scene = bpy.context.scene
    metadata = {
        "fiberId": config["fiberId"],
        "name": config["name"],
        "assetType": "single-fiber",
        "lengthMm": config["lengthMm"],
        "thicknessMm": config["thicknessMm"],
        "curl": config["curl"],
        "color": config["color"],
        "material": config["material"],
        "geometry": config["geometry"],
        "render": {
            "widthPx": scene.render.resolution_x,
            "heightPx": scene.render.resolution_y,
            "rootAnchor": projected_anchor(scene, root),
            "tipAnchor": projected_anchor(scene, tip),
            "orientation": "root-to-tip"
        }
    }
    metadata_path = output.with_name("metadata.json")
    with open(metadata_path, "w", encoding="utf-8") as file:
        json.dump(metadata, file, ensure_ascii=False, indent=2)


def render(config):
    setup_scene(config)
    fiber_materials = make_fiber_materials(config)
    _, root, tip = make_fiber_mesh(config, fiber_materials)

    output = Path(config["render"]["output"])
    output.parent.mkdir(parents=True, exist_ok=True)
    write_metadata(config, root, tip, output)
    bpy.context.scene.render.filepath = str(output)
    bpy.ops.render.render(write_still=True)

    preview_output = output.with_name("preview-gray.png")
    bpy.context.scene.render.film_transparent = False
    add_preview_background()
    bpy.context.scene.render.filepath = str(preview_output)
    bpy.ops.render.render(write_still=True)

    aim_camera(root + Vector((0.015, 0.035, 0.0)), 0.28)
    bpy.context.scene.render.filepath = str(output.with_name("root-detail.png"))
    bpy.ops.render.render(write_still=True)

    aim_camera(tip - Vector((0.02, 0.055, 0.0)), 0.24)
    bpy.context.scene.render.filepath = str(output.with_name("tip-detail.png"))
    bpy.ops.render.render(write_still=True)


def main():
    args = parse_args()
    if args.config_dir:
        config_paths = sorted(Path(args.config_dir).rglob("*.json"))
    else:
        config_paths = [Path(args.config)]
    for config_path in config_paths:
        with open(config_path, "r", encoding="utf-8") as file:
            config = json.load(file)
        print(f"Rendering single fiber: {config_path}")
        render(config)


if __name__ == "__main__":
    main()
