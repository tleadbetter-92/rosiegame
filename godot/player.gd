extends CharacterBody3D

const WALK := 5.0
const RUN := 11.0
const FLY := 60.0
const JUMP := 5.0

var flying := false

@onready var cam: Camera3D = $Camera3D
@onready var info: Label = $"../HUD/Info"


func _unhandled_input(event: InputEvent) -> void:
	if event is InputEventMouseButton and event.pressed:
		Input.mouse_mode = Input.MOUSE_MODE_CAPTURED
	elif event is InputEventKey and event.pressed and not event.echo:
		if event.physical_keycode == KEY_ESCAPE:
			Input.mouse_mode = Input.MOUSE_MODE_VISIBLE
		elif event.physical_keycode == KEY_F:
			flying = not flying
	elif event is InputEventMouseMotion and Input.mouse_mode == Input.MOUSE_MODE_CAPTURED:
		rotation.y -= event.relative.x * 0.0025
		cam.rotation.x = clampf(cam.rotation.x - event.relative.y * 0.0025, -1.5, 1.5)


func _physics_process(delta: float) -> void:
	var push := Vector2(
		float(Input.is_physical_key_pressed(KEY_D)) - float(Input.is_physical_key_pressed(KEY_A)),
		float(Input.is_physical_key_pressed(KEY_S)) - float(Input.is_physical_key_pressed(KEY_W))
	)
	var dir := (transform.basis * Vector3(push.x, 0.0, push.y)).normalized()
	if flying:
		velocity = dir * FLY
		if Input.is_physical_key_pressed(KEY_SPACE):
			velocity.y = FLY * 0.5
		elif Input.is_physical_key_pressed(KEY_SHIFT):
			velocity.y = -FLY * 0.5
	else:
		var speed := RUN if Input.is_physical_key_pressed(KEY_SHIFT) else WALK
		velocity.x = dir.x * speed
		velocity.z = dir.z * speed
		if is_on_floor():
			if Input.is_physical_key_pressed(KEY_SPACE):
				velocity.y = JUMP
		else:
			velocity.y -= 9.8 * delta
	move_and_slide()
	if position.y < -40.0:
		get_parent().respawn()
	var mode := "flying (F to walk)" if flying else "walking (F to fly)"
	info.text = "%d, %d  ·  %d m  ·  %s\nWASD move · mouse look · Shift run · Space jump · Esc frees mouse" % [position.x, position.z, position.y, mode]
