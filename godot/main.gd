extends Node3D

const CHUNK := 64
const HAZE := Color(0.78, 0.82, 0.86)
# Same order as KINDS in tools/godot-export.js.
const GROUND := [
	Color(0.34, 0.54, 0.22),
	Color(0.50, 0.39, 0.25),
	Color(0.50, 0.49, 0.46),
	Color(0.80, 0.73, 0.52),
	Color(0.56, 0.55, 0.52),
	Color(0.47, 0.45, 0.42),
	Color(0.30, 0.35, 0.18),
]
const STOREYS := { "house": 5.0, "tall": 7.5, "shop": 6.0, "brick": 6.0, "long": 5.0, "grand": 7.5 }

var origin := 0.0
var step := 8.0
var size := 0
var home := Vector2.ZERO
var heights := PackedFloat32Array()
var ground := PackedByteArray()
var water := PackedFloat32Array()


func _ready() -> void:
	var info: Dictionary = JSON.parse_string(FileAccess.get_file_as_string("res://data/world.json"))
	origin = info.origin
	step = info.step
	size = int(info.size)
	home = Vector2(info.home[0], info.home[1])
	heights = FileAccess.get_file_as_bytes("res://data/height.bin").to_float32_array()
	ground = FileAccess.get_file_as_bytes("res://data/ground.bin")
	water = FileAccess.get_file_as_bytes("res://data/water.bin").to_float32_array()
	build_sky()
	build_terrain()
	build_sea()
	build_rivers()
	build_trees(info.trees)
	build_buildings(info.buildings)
	build_rocks(info.rocks)
	respawn()


func respawn() -> void:
	var player: CharacterBody3D = $Player
	player.velocity = Vector3.ZERO
	player.position = Vector3(home.x, height_at(home.x, home.y) + 1.0, home.y)


func height_at(x: float, z: float) -> float:
	var fx := clampf((x - origin) / step, 0.0, size - 1.001)
	var fz := clampf((z - origin) / step, 0.0, size - 1.001)
	var ix := int(fx)
	var iz := int(fz)
	var tx := fx - ix
	var tz := fz - iz
	var i := iz * size + ix
	var top := lerpf(heights[i], heights[i + 1], tx)
	var bottom := lerpf(heights[i + size], heights[i + size + 1], tx)
	return lerpf(top, bottom, tz)


func plain(color: Color, rough := 1.0) -> StandardMaterial3D:
	var mat := StandardMaterial3D.new()
	mat.albedo_color = color
	mat.roughness = rough
	return mat


# Distance fades into a sky-coloured haze, as in Daggerfall; the next town stays hidden until you walk there.
func build_sky() -> void:
	var sky_mat := ProceduralSkyMaterial.new()
	sky_mat.sky_top_color = Color(0.36, 0.54, 0.86)
	sky_mat.sky_horizon_color = HAZE
	sky_mat.ground_horizon_color = HAZE
	sky_mat.ground_bottom_color = HAZE
	var sky := Sky.new()
	sky.sky_material = sky_mat
	var env := Environment.new()
	env.background_mode = Environment.BG_SKY
	env.sky = sky
	env.ambient_light_source = Environment.AMBIENT_SOURCE_SKY
	env.tonemap_mode = Environment.TONE_MAPPER_FILMIC
	env.fog_enabled = true
	env.fog_light_color = HAZE
	env.fog_density = 0.0017
	env.fog_sky_affect = 0.2
	var world_env := WorldEnvironment.new()
	world_env.environment = env
	add_child(world_env)
	var sun := DirectionalLight3D.new()
	sun.rotation_degrees = Vector3(-52.0, -35.0, 0.0)
	sun.shadow_enabled = true
	sun.directional_shadow_max_distance = 220.0
	add_child(sun)


func build_terrain() -> void:
	var mat := StandardMaterial3D.new()
	mat.vertex_color_use_as_albedo = true
	mat.vertex_color_is_srgb = true
	mat.roughness = 1.0
	mat.specular_mode = BaseMaterial3D.SPECULAR_DISABLED
	var body := StaticBody3D.new()
	add_child(body)
	var cells := size - 1
	for cz in range(0, cells, CHUNK):
		for cx in range(0, cells, CHUNK):
			var mesh := terrain_chunk(cx, cz, mini(CHUNK, cells - cx), mini(CHUNK, cells - cz))
			mesh.surface_set_material(0, mat)
			var inst := MeshInstance3D.new()
			inst.mesh = mesh
			add_child(inst)
			var shape := CollisionShape3D.new()
			shape.shape = mesh.create_trimesh_shape()
			body.add_child(shape)


func terrain_chunk(x0: int, z0: int, w: int, d: int) -> ArrayMesh:
	var verts := PackedVector3Array()
	var normals := PackedVector3Array()
	var colors := PackedColorArray()
	var indices := PackedInt32Array()
	for iz in range(z0, z0 + d + 1):
		for ix in range(x0, x0 + w + 1):
			var i := iz * size + ix
			verts.append(Vector3(origin + ix * step, heights[i], origin + iz * step))
			var left := heights[iz * size + maxi(ix - 1, 0)]
			var right := heights[iz * size + mini(ix + 1, size - 1)]
			var back := heights[maxi(iz - 1, 0) * size + ix]
			var front := heights[mini(iz + 1, size - 1) * size + ix]
			normals.append(Vector3(left - right, 2.0 * step, back - front).normalized())
			var base: Color = GROUND[mini(ground[i], GROUND.size() - 1)]
			var shade := 0.88 + 0.22 * fposmod(sin(ix * 12.9898 + iz * 78.233) * 43758.5453, 1.0)
			colors.append(Color(base.r * shade, base.g * shade, base.b * shade))
	var row := w + 1
	for iz in d:
		for ix in w:
			var a := iz * row + ix
			indices.append_array([a, a + 1, a + row, a + 1, a + row + 1, a + row])
	var arrays := []
	arrays.resize(Mesh.ARRAY_MAX)
	arrays[Mesh.ARRAY_VERTEX] = verts
	arrays[Mesh.ARRAY_NORMAL] = normals
	arrays[Mesh.ARRAY_COLOR] = colors
	arrays[Mesh.ARRAY_INDEX] = indices
	var mesh := ArrayMesh.new()
	mesh.add_surface_from_arrays(Mesh.PRIMITIVE_TRIANGLES, arrays)
	return mesh


func build_sea() -> void:
	var plane := PlaneMesh.new()
	plane.size = Vector2(30000.0, 30000.0)
	plane.material = plain(Color(0.15, 0.34, 0.48), 0.15)
	var sea := MeshInstance3D.new()
	sea.mesh = plane
	sea.position.y = -0.3
	add_child(sea)


# River water sits just above its bed, so it can run over hills.
func build_rivers() -> void:
	var st := SurfaceTool.new()
	st.begin(Mesh.PRIMITIVE_TRIANGLES)
	st.set_normal(Vector3.UP)
	var any := false
	for iz in size - 1:
		for ix in size - 1:
			var level := water[iz * size + ix]
			if is_nan(level):
				continue
			any = true
			var x := origin + ix * step - step * 0.5
			var z := origin + iz * step - step * 0.5
			var a := Vector3(x, level, z)
			var b := Vector3(x + step, level, z)
			var c := Vector3(x, level, z + step)
			var e := Vector3(x + step, level, z + step)
			for v in [a, b, c, b, e, c]:
				st.add_vertex(v)
	if not any:
		return
	var inst := MeshInstance3D.new()
	inst.mesh = st.commit()
	inst.material_override = plain(Color(0.16, 0.36, 0.46), 0.15)
	add_child(inst)


func multi(mesh: Mesh, count: int) -> MultiMesh:
	var mm := MultiMesh.new()
	mm.transform_format = MultiMesh.TRANSFORM_3D
	mm.mesh = mesh
	mm.instance_count = count
	var inst := MultiMeshInstance3D.new()
	inst.multimesh = mm
	add_child(inst)
	return mm


func build_trees(trees: Array) -> void:
	var trunk := BoxMesh.new()
	trunk.size = Vector3(0.45, 3.2, 0.45)
	trunk.material = plain(Color(0.36, 0.24, 0.14))
	var crown := BoxMesh.new()
	crown.size = Vector3(4.2, 3.6, 4.2)
	crown.material = plain(Color(0.2, 0.42, 0.16))
	var cone := CylinderMesh.new()
	cone.top_radius = 0.0
	cone.bottom_radius = 2.2
	cone.height = 6.5
	cone.radial_segments = 6
	cone.material = plain(Color(0.14, 0.32, 0.18))
	var pines := 0
	for t in trees:
		pines += int(t[2])
	var trunks := multi(trunk, trees.size())
	var crowns := multi(crown, trees.size() - pines)
	var cones := multi(cone, pines)
	var oak := 0
	var pine := 0
	for i in trees.size():
		var t: Array = trees[i]
		var x: float = t[0]
		var z: float = t[1]
		var s := 0.8 + 0.5 * fposmod(sin(x * 3.1 + z * 7.7) * 4375.85, 1.0)
		var y := height_at(x, z)
		var turn := Basis(Vector3.UP, fposmod(x * 0.37 + z * 0.11, TAU)).scaled(Vector3(s, s, s))
		trunks.set_instance_transform(i, Transform3D(turn, Vector3(x, y + 1.6 * s, z)))
		if int(t[2]) == 1:
			cones.set_instance_transform(pine, Transform3D(turn, Vector3(x, y + 5.0 * s, z)))
			pine += 1
		else:
			crowns.set_instance_transform(oak, Transform3D(turn, Vector3(x, y + 4.4 * s, z)))
			oak += 1


func build_buildings(list: Array) -> void:
	var wall := BoxMesh.new()
	wall.material = plain(Color(0.86, 0.8, 0.66))
	var roof := PrismMesh.new()
	roof.material = plain(Color(0.6, 0.26, 0.17))
	var walls := multi(wall, list.size())
	var roofs := multi(roof, list.size())
	var body := StaticBody3D.new()
	add_child(body)
	for i in list.size():
		var b: Array = list[i]
		var x: float = b[0]
		var z: float = b[1]
		var w: float = b[2]
		var d: float = b[3]
		var tall: float = STOREYS.get(b[4], 6.0)
		var y := minf(minf(height_at(x - w / 2, z - d / 2), height_at(x + w / 2, z - d / 2)), minf(height_at(x - w / 2, z + d / 2), height_at(x + w / 2, z + d / 2))) - 0.5
		walls.set_instance_transform(i, Transform3D(Basis.from_scale(Vector3(w, tall + 0.5, d)), Vector3(x, y + (tall + 0.5) / 2, z)))
		var ridge := Basis.from_scale(Vector3(w + 0.6, 2.4, d + 0.6))
		if w > d:
			ridge = Basis(Vector3.UP, PI / 2) * Basis.from_scale(Vector3(d + 0.6, 2.4, w + 0.6))
		roofs.set_instance_transform(i, Transform3D(ridge, Vector3(x, y + tall + 0.5 + 1.2, z)))
		var box := BoxShape3D.new()
		box.size = Vector3(w, tall + 0.5, d)
		var shape := CollisionShape3D.new()
		shape.shape = box
		shape.position = Vector3(x, y + (tall + 0.5) / 2, z)
		body.add_child(shape)


func build_rocks(list: Array) -> void:
	var rock := BoxMesh.new()
	rock.material = plain(Color(0.47, 0.46, 0.43))
	var rocks := multi(rock, list.size())
	var body := StaticBody3D.new()
	add_child(body)
	for i in list.size():
		var r: Array = list[i]
		var x: float = r[0]
		var z: float = r[1]
		var s: float = r[3]
		var dims := Vector3(14.0 * s, 5.0 * s, 11.0 * s)
		var spot := Transform3D(Basis(Vector3.UP, r[2]), Vector3(x, height_at(x, z) + dims.y * 0.3, z))
		rocks.set_instance_transform(i, spot * Transform3D(Basis.from_scale(dims), Vector3.ZERO))
		var box := BoxShape3D.new()
		box.size = dims
		var shape := CollisionShape3D.new()
		shape.shape = box
		shape.transform = spot
		body.add_child(shape)
