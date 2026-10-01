class_name Player
extends Unit
## 本地玩家控制器：键鼠 + 触屏双摇杆。只负责把输入翻译成意图。


func _physics_process(delta: float) -> void:
	if alive and arena != null and not arena.get("match_over"):
		_read_input()
	else:
		move_input = Vector2.ZERO
		want_fire = false
	super._physics_process(delta)


func _read_input() -> void:
	var hud: Node = arena.get("hud")
	var stick_l: Control = null
	var stick_r: Control = null
	if hud != null:
		stick_l = hud.get("stick_left")
		stick_r = hud.get("stick_right")

	if G.touch_mode and stick_l != null:
		move_input = stick_l.get("value")
	else:
		move_input = Input.get_vector("move_left", "move_right", "move_up", "move_down")

	if G.touch_mode and stick_r != null:
		var rv: Vector2 = stick_r.get("value")
		if rv.length() > 0.35:
			aim_dir = rv.normalized()
			aim_point = global_position + rv * 460.0
			want_fire = true
		else:
			want_fire = false
			if move_input.length() > 0.2:
				aim_dir = move_input.normalized()
	else:
		var m := get_global_mouse_position()
		aim_point = m
		var v := m - global_position
		if v.length() > 4.0:
			aim_dir = v.normalized()
		want_fire = Input.is_action_pressed("fire")

	if Input.is_action_just_pressed("skill"):
		want_skill = true
