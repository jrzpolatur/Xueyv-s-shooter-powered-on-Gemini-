class_name Projectile
extends Area2D
## 投射物：直射 / 贯穿 / 抛物线榴弹 统一实现，参数来自 Catalog.WEAPONS。

var shooter: Unit
var wdef: Dictionary
var dir := Vector2.RIGHT
var damage := 10.0
var speed := 900.0
var max_range := 400.0
var traveled := 0.0
var pierce := false
var arc := false
var aoe := 0.0
var start_pos := Vector2.ZERO
var target_pos := Vector2.ZERO
var t := 0.0
var col := Color.WHITE
var psize := 7.0
var hit_set := {}
var done := false


func setup(p_shooter: Unit, p_pos: Vector2, p_dir: Vector2, p_wdef: Dictionary, p_aim_point: Vector2) -> void:
	shooter = p_shooter
	wdef = p_wdef
	dir = p_dir.normalized()
	speed = float(wdef["speed"])
	max_range = float(wdef["range"])
	damage = float(wdef["damage"]) * shooter.total_dmg_mult()
	pierce = bool(wdef["pierce"])
	arc = bool(wdef["arc"])
	aoe = float(wdef["aoe"])
	col = wdef["color"]
	psize = float(wdef["size"])
	global_position = p_pos
	start_pos = p_pos
	z_index = 20
	if arc:
		var d := clampf(start_pos.distance_to(p_aim_point), 130.0, max_range)
		target_pos = start_pos + dir * d
	else:
		rotation = dir.angle()
	collision_layer = 0
	collision_mask = 1 | 2
	monitoring = not arc
	var cs := CollisionShape2D.new()
	var sh := CircleShape2D.new()
	sh.radius = maxf(6.0, psize)
	cs.shape = sh
	add_child(cs)
	body_entered.connect(_on_body)


func _physics_process(delta: float) -> void:
	if done:
		return
	if arc:
		var total := maxf(1.0, start_pos.distance_to(target_pos))
		t += speed * delta / total
		global_position = start_pos.lerp(target_pos, minf(t, 1.0))
		queue_redraw()
		if t >= 1.0:
			_explode()
	else:
		var step := dir * speed * delta
		global_position += step
		traveled += step.length()
		if traveled >= max_range:
			if aoe > 0.0:
				_explode()
			else:
				queue_free()


func _on_body(body: Node2D) -> void:
	if done or body == shooter:
		return
	if body is Unit:
		var u := body as Unit
		if not u.alive or hit_set.has(u):
			return
		hit_set[u] = true
		if aoe > 0.0:
			_explode()
			return
		u.take_damage(damage, shooter)
		if not pierce:
			_impact()
	elif body is Crate:
		(body as Crate).take_damage(damage, shooter)
		if aoe > 0.0:
			_explode()
		elif not pierce:
			_impact()
	else:
		if aoe > 0.0:
			_explode()
		else:
			_impact()


func _impact() -> void:
	done = true
	FX.burst(get_parent(), global_position, col, 6, 160.0)
	queue_free()


func _explode() -> void:
	done = true
	var parent := get_parent()
	FX.ring(parent, global_position, aoe if aoe > 0.0 else 50.0, col, 0.4, true)
	FX.burst(parent, global_position, col, 20, 360.0)
	G.play_sfx("boom", global_position, -4.0)
	if shooter != null and is_instance_valid(shooter) and shooter.is_player_unit \
			and parent != null and parent.has_method("add_shake"):
		parent.add_shake(6.0)
	var radius := maxf(aoe, 40.0)
	var sp := get_world_2d().direct_space_state
	var shape := CircleShape2D.new()
	shape.radius = radius
	var q := PhysicsShapeQueryParameters2D.new()
	q.shape = shape
	q.transform = Transform2D(0.0, global_position)
	q.collision_mask = 1 | 2
	var res := sp.intersect_shape(q, 32)
	for r in res:
		var c: Object = r["collider"]
		if c == shooter:
			continue
		if c is Unit and (c as Unit).alive:
			(c as Unit).take_damage(damage, shooter)
			(c as Unit).kb_vel = ((c as Unit).global_position - global_position).normalized() * 260.0
		elif c is Crate:
			(c as Crate).take_damage(damage, shooter)
	queue_free()


func _draw() -> void:
	if arc:
		var h := sin(minf(t, 1.0) * PI) * 72.0
		draw_set_transform(Vector2(0, 6), 0.0, Vector2(1.0, 0.5))
		draw_circle(Vector2.ZERO, psize * 0.9, Color(0, 0, 0, 0.25))
		draw_set_transform(Vector2.ZERO, 0.0, Vector2.ONE)
		draw_circle(Vector2(0, -h - 26.0), psize * 1.8, Color(col, 0.25))
		draw_circle(Vector2(0, -h - 26.0), psize, col)
	else:
		draw_line(Vector2(-psize * 2.4, -30), Vector2(psize * 1.4, -30), Color(col, 0.5), psize * 1.5)
		draw_circle(Vector2(psize * 0.6, -30), psize * 1.6, Color(col, 0.28))
		draw_circle(Vector2(psize * 0.6, -30), psize * 0.85, Color(1, 1, 1, 0.9))
		draw_circle(Vector2(0, -30), psize, col)
