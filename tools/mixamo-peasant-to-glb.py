import bpy

pairs = [
    (
        r"C:\Users\admin.DESKTOP-NGOH14H\rosiesgame\models\kaykit\Idle.fbx",
        r"C:\Users\admin.DESKTOP-NGOH14H\rosiesgame\models\kaykit\mixamo-idle.glb",
    ),
    (
        r"C:\Users\admin.DESKTOP-NGOH14H\rosiesgame\models\kaykit\Walking (2).fbx",
        r"C:\Users\admin.DESKTOP-NGOH14H\rosiesgame\models\kaykit\mixamo-walk.glb",
    ),
]
for src, dest in pairs:
    bpy.ops.wm.read_factory_settings(use_empty=True)
    bpy.ops.import_scene.fbx(filepath=src)
    bpy.ops.export_scene.gltf(
        filepath=dest,
        export_format="GLB",
        export_animations=True,
        export_skins=True,
        export_yup=True,
    )
    print("EXPORTED", dest)
