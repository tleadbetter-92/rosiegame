import bpy

bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.fbx(filepath=r"C:\Users\admin.DESKTOP-NGOH14H\rosiesgame\Breathing Idle.fbx")
bpy.ops.export_scene.gltf(
    filepath=r"C:\Users\admin.DESKTOP-NGOH14H\rosiesgame\models\kaykit\paladin-idle.glb",
    export_format="GLB",
    export_animations=True,
    export_skins=True,
    export_yup=True,
)
print("EXPORTED")
