extends CharacterBody3D

const WALK_SPEED := 5.0
const RUN_SPEED := 9.0
const FLY_SPEED := 55.0
const JUMP_VELOCITY := 4.5

var flying := false

@onready var camera: Camera3D = $Camera3D


func _ready() -> void:
	Input.mouse_mode = Input.MOUSE_MODE_VISIBLE


func _unhandled_input(event: InputEvent) -> void:
	if event is InputEventMouseButton and event.pressed and event.button_index == MOUSE_BUTTON_LEFT:
		Input.mouse_mode = Input.MOUSE_MODE_CAPTURED
	elif event is InputEventKey and event.pressed and not event.echo:
		if event.physical_keycode == KEY_ESCAPE:
			Input.mouse_mode = Input.MOUSE_MODE_VISIBLE
		elif event.physical_keycode == KEY_F:
			flying = not flying
	elif event is InputEventMouseMotion and Input.mouse_mode == Input.MOUSE_MODE_CAPTURED:
		rotate_y(-event.relative.x * 0.002)
		camera.rotate_x(-event.relative.y * 0.002)
		camera.rotation.x = clampf(camera.rotation.x, -1.4, 1.4)


func _physics_process(delta: float) -> void:
	var input_dir := Vector2(
		float(Input.is_physical_key_pressed(KEY_D)) - float(Input.is_physical_key_pressed(KEY_A)),
		float(Input.is_physical_key_pressed(KEY_S)) - float(Input.is_physical_key_pressed(KEY_W))
	)
	var direction := (transform.basis * Vector3(input_dir.x, 0.0, input_dir.y)).normalized()

	if flying:
		velocity = direction * FLY_SPEED
		if Input.is_physical_key_pressed(KEY_SPACE):
			velocity.y = FLY_SPEED * 0.45
		elif Input.is_physical_key_pressed(KEY_SHIFT):
			velocity.y = -FLY_SPEED * 0.45
	else:
		if not is_on_floor():
			velocity += get_gravity() * delta
		if Input.is_physical_key_pressed(KEY_SPACE) and is_on_floor():
			velocity.y = JUMP_VELOCITY
		var speed := RUN_SPEED if Input.is_physical_key_pressed(KEY_SHIFT) else WALK_SPEED
		if direction:
			velocity.x = direction.x * speed
			velocity.z = direction.z * speed
		else:
			velocity.x = move_toward(velocity.x, 0.0, speed)
			velocity.z = move_toward(velocity.z, 0.0, speed)

	move_and_slide()

	if position.y < -80.0:
		var root := get_parent()
		if root.has_method("respawn"):
			root.respawn()
