class_name Bot
extends Unit
## AI 机器人：巡逻 / 交战 / 逃跑 三状态，带武器距离偏好与技能使用。

var think_t := 0.0
var state := "roam"
var roam_target := Vector2.ZERO
var target: Unit = null
var gem_target: Node2D = null
var strafe_sign := 1.0
var aim_err := 0.0
var last_pos := Vector2.ZERO


func _physics_process(delta: float) -> void:
	if alive and arena != null and not arena.get("match_over"):
		think_t -= delta
		if think_t <= 0.0:
			think_t = 0.16
			_think()
		_steer()
	else:
		move_input = Vector2.ZERO
		want_fire = false
	super._physics_process(delta)


func _think() -> void:
	target = _pick_target()
	gem_target = _pick_gem()
	if target != null and hp < max_hp * 0.35:
		state = "flee"
	elif gem_target != null and (target == null
			or global_position.distance_to(gem_target.global_position)
			< global_position.distance_to(target.global_position) * 0.9):
		state = "gem"
	elif target != null:
		state = "engage"
	else:
		state = "roam"

	if randf() < 0.1:
		strafe_sign = -strafe_sign
	aim_err = randf_range(-0.085, 0.085)

	# 技能决策
	var dist := 99999.0
	if target != null:
		dist = global_position.distance_to(target.global_position)
	match String(sdef["id"]):
		"heal":
			if hp < max_hp * 0.6:
				want_skill = true
		"shield":
			if state != "roam" and hp < max_hp * 0.8:
				want_skill = true
		"nova":
			if dist < 170.0:
				want_skill = true
		"dash":
			if state == "flee" or (state == "engage" and dist > float(wdef["range"]) * 1.05):
				want_skill = true

	# 卡墙检测
	if move_input.length() > 0.1 and global_position.distance_to(last_pos) < 9.0:
		roam_target = _random_point()
		strafe_sign = -strafe_sign
	last_pos = global_position


func _pick_gem() -> Node2D:
	if String(arena.get("mode")) != "gems":
		return null
	var best: Node2D = null
	var best_d := 640.0
	for g in get_tree().get_nodes_in_group("gems"):
		if not is_instance_valid(g):
			continue
		var d: float = global_position.distance_to(g.global_position)
		if d < best_d:
			best_d = d
			best = g
	return best


func _pick_target() -> Unit:
	var best: Unit = null
	var best_d := 560.0
	for u in arena.get("units"):
		if u == self or not is_instance_valid(u) or not u.alive or u.team == team:
			continue
		var d: float = global_position.distance_to(u.global_position)
		if d > best_d:
			continue
		if u.is_hidden() and d > 170.0:
			continue
		best = u
		best_d = d
	return best


func _random_point() -> Vector2:
	if arena.has_method("random_point"):
		return arena.random_point()
	return global_position


func _steer() -> void:
	if state == "gem":
		if gem_target == null or not is_instance_valid(gem_target):
			state = "roam"
		else:
			var gdir := gem_target.global_position - global_position
			move_input = gdir.normalized() if gdir.length() > 1.0 else Vector2.ZERO
			if target != null and is_instance_valid(target) and target.alive:
				var tv := target.global_position - global_position
				aim_point = target.global_position
				aim_dir = tv.normalized().rotated(aim_err)
				want_fire = tv.length() < float(wdef["range"]) * 0.95 \
					and (bool(wdef["arc"]) or _has_los())
			else:
				if move_input.length() > 0.1:
					aim_dir = move_input.normalized()
				want_fire = false
			return
	if state == "roam" or target == null or not is_instance_valid(target) or not target.alive:
		if roam_target == Vector2.ZERO or global_position.distance_to(roam_target) < 70.0:
			roam_target = _random_point()
		var dir := roam_target - global_position
		move_input = dir.normalized() if dir.length() > 1.0 else Vector2.ZERO
		if move_input.length() > 0.1:
			aim_dir = move_input.normalized()
		want_fire = false
		return

	var to := target.global_position - global_position
	var d := to.length()
	var lead: Vector2 = target.velocity * clampf(d / float(wdef["speed"]), 0.0, 0.5) * 0.6
	aim_point = target.global_position + lead
	aim_dir = (aim_point - global_position).normalized().rotated(aim_err)

	var radial := to.normalized()
	var tangent := radial.orthogonal() * strafe_sign
	if state == "flee":
		move_input = (-radial * 1.0 + tangent * 0.4).normalized()
	else:
		var desired := float(wdef["desired_range"])
		var push := clampf((d - desired) / 160.0, -1.0, 1.0)
		move_input = (radial * push + tangent * 0.8).normalized()

	want_fire = d < float(wdef["range"]) * 0.95 and (bool(wdef["arc"]) or _has_los())


func _has_los() -> bool:
	var sp := get_world_2d().direct_space_state
	var q := PhysicsRayQueryParameters2D.create(global_position, target.global_position, 1)
	return sp.intersect_ray(q).is_empty()
