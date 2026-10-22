import bpy

root = r"C:\Users\admin.DESKTOP-NGOH14H\rosiesgame"
pairs = [
    (
        root + r"\models\medieval-people\fbx\unral_better_export\peasant_1.fbx",
        root + r"\models\kaykit\medieval-innkeeper.glb",
    ),
    (
        root + r"\models\medieval-people\fbx\unral_better_export\rich_citizens_1.fbx",
        root + r"\models\kaykit\medieval-commander.glb",
    ),
    (
        root + r"\models\medieval-people\fbx\unral_better_export\king.fbx",
        root + r"\models\kaykit\medieval-king.glb",
    ),
]
for src, dest in pairs:
    bpy.ops.wm.read_factory_settings(use_empty=True)
    bpy.ops.import_scene.fbx(filepath=src)
    bpy.ops.object.select_all(action="DESELECT")
    for obj in bpy.context.scene.objects:
        if obj.type in {"MESH", "ARMATURE"}:
            obj.select_set(True)
    bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)
    bpy.ops.export_scene.gltf(
        filepath=dest,
        export_format="GLB",
        export_apply=True,
        export_animations=False,
        export_skins=True,
        export_yup=True,
    )
    print("EXPORTED", dest)
