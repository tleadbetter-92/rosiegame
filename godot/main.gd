extends Node3D
## Main scene is now world.tscn (Project → Project Settings → Application → Run).

func _ready() -> void:
	get_tree().change_scene_to_file("res://world.tscn")
