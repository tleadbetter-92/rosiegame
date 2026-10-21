import bpy
from mathutils import Vector

bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.fbx(filepath=r"C:\Users\admin.DESKTOP-NGOH14H\rosiesgame\Idle.fbx")

keep = []
for obj in list(bpy.data.objects):
    if obj.type != "MESH":
        continue
    if obj.name == "sword":
        bpy.data.objects.remove(obj, do_unlink=True)
        continue
    keep.append(obj)

for obj in keep:
    bpy.context.view_layer.objects.active = obj
    for mod in list(obj.modifiers):
        if mod.type == "ARMATURE":
            bpy.ops.object.modifier_apply(modifier=mod.name)

for obj in list(bpy.data.objects):
    if obj.type == "ARMATURE":
        bpy.data.objects.remove(obj, do_unlink=True)

bpy.ops.object.select_all(action="DESELECT")
for obj in keep:
    obj.select_set(True)
bpy.context.view_layer.objects.active = keep[0]
bpy.ops.object.join()
body = bpy.context.view_layer.objects.active

low = Vector((1e9, 1e9, 1e9))
high = Vector((-1e9, -1e9, -1e9))
for corner in body.bound_box:
    world = body.matrix_world @ Vector(corner)
    low.x, low.y, low.z = min(low.x, world.x), min(low.y, world.y), min(low.z, world.z)
    high.x, high.y, high.z = max(high.x, world.x), max(high.y, world.y), max(high.z, world.z)
height = high.z - low.z
print("BOUNDS", tuple(round(v, 2) for v in low), tuple(round(v, 2) for v in high), "height", round(height, 2))
scale = 1.8 / height if height else 1
body.scale = (scale, scale, scale)
bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
bpy.ops.object.origin_set(type="ORIGIN_GEOMETRY", center="BOUNDS")
body.location = (0, 0, body.dimensions.z * 0.5)
bpy.ops.object.transform_apply(location=True, rotation=False, scale=False)

bpy.ops.export_scene.fbx(
    filepath=r"C:\Users\admin.DESKTOP-NGOH14H\rosiesgame\Knight Upload.fbx",
    use_selection=True,
    object_types={"MESH"},
    add_leaf_bones=False,
    bake_anim=False,
    axis_forward="-Z",
    axis_up="Y",
)
print("EXPORTED")
