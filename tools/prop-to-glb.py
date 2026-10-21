import bpy

pairs = [
    (r"C:\Users\admin.DESKTOP-NGOH14H\rosiesgame\Great Sword Idle.fbx", r"C:\Users\admin.DESKTOP-NGOH14H\rosiesgame\models\kaykit\prop-idle.glb"),
    (r"C:\Users\admin.DESKTOP-NGOH14H\rosiesgame\Knight Walk (2).fbx", r"C:\Users\admin.DESKTOP-NGOH14H\rosiesgame\models\kaykit\prop-walk.glb"),
    (r"C:\Users\admin.DESKTOP-NGOH14H\rosiesgame\Sword And Shield Attack.fbx", r"C:\Users\admin.DESKTOP-NGOH14H\rosiesgame\models\kaykit\prop-attack.glb"),
    (r"C:\Users\admin.DESKTOP-NGOH14H\rosiesgame\Standing Death Forward 01.fbx", r"C:\Users\admin.DESKTOP-NGOH14H\rosiesgame\models\kaykit\prop-death.glb"),
    (r"C:\Users\admin.DESKTOP-NGOH14H\rosiesgame\Dwarf Idle.fbx", r"C:\Users\admin.DESKTOP-NGOH14H\rosiesgame\models\kaykit\archer-idle.glb"),
    (r"C:\Users\admin.DESKTOP-NGOH14H\rosiesgame\Shooting Arrow (1).fbx", r"C:\Users\admin.DESKTOP-NGOH14H\rosiesgame\models\kaykit\archer-shoot.glb"),
    (r"C:\Users\admin.DESKTOP-NGOH14H\rosiesgame\Archer Walk (1).fbx", r"C:\Users\admin.DESKTOP-NGOH14H\rosiesgame\models\kaykit\archer-walk.glb"),
]
for src, dest in pairs:
    bpy.ops.wm.read_factory_settings(use_empty=True)
    bpy.ops.import_scene.fbx(filepath=src)
    bpy.ops.export_scene.gltf(filepath=dest, export_format="GLB", export_animations=True, export_skins=True, export_yup=True)
    print("EXPORTED", dest)
