"""Convert Mixamo FBX downloads to GLB for bake-kaykit. Run via Blender --background."""
import os
import sys
import bpy

root = os.path.normpath(os.path.join(os.path.dirname(__file__), "..", "models", "kaykit"))
# Use latest Mixamo downloads (With Skin): Idle (1).fbx + Walking (3).fbx
pairs = [
    (os.path.join(root, "Idle (1).fbx"), os.path.join(root, "mixamo-idle.glb")),
    (os.path.join(root, "Walking (3).fbx"), os.path.join(root, "mixamo-walk.glb")),
]
for src, dest in pairs:
    if not os.path.isfile(src):
        print("MISSING", src, file=sys.stderr)
        sys.exit(1)
    bpy.ops.wm.read_factory_settings(use_empty=True)
    bpy.ops.import_scene.fbx(filepath=src)
    bpy.ops.export_scene.gltf(
        filepath=dest,
        export_format="GLB",
        export_animations=True,
        export_skins=True,
        export_yup=True,
    )
    print("EXPORTED", dest, os.path.getsize(dest))
