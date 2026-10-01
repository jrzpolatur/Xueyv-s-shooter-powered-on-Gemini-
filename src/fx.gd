class_name FX
## 轻量特效工具：伤害数字、扩散光环、粒子爆发、受击闪白。


class RingFX:
	extends Node2D
	var radius := 10.0
	var width := 5.0
	var col := Color.WHITE
	var fill := false

	func _process(_delta: float) -> void:
		queue_redraw()

	func _draw() -> void:
		if fill:
			draw_circle(Vector2.ZERO, radius, Color(col, 0.16))
		draw_arc(Vector2.ZERO, radius, 0.0, TAU, 48, col, width)


static func damage_num(parent: Node, pos: Vector2, text: String, color: Color, big := false) -> void:
	if parent == null or not is_instance_valid(parent):
		return
	var l := Label.new()
	l.text = text
	l.z_index = 60
	l.add_theme_font_size_override("font_size", 30 if big else 22)
	l.add_theme_color_override("font_color", color)
	l.add_theme_color_override("font_outline_color", Color(0.05, 0.05, 0.1, 0.9))
	l.add_theme_constant_override("outline_size", 7)
	parent.add_child(l)
	l.global_position = pos + Vector2(randf_range(-16.0, 16.0), randf_range(-6.0, 2.0))
	var tw := l.create_tween()
	tw.set_parallel(true)
	tw.tween_property(l, "global_position", l.global_position + Vector2(0, -48), 0.65)\
		.set_ease(Tween.EASE_OUT).set_trans(Tween.TRANS_CUBIC)
	tw.tween_property(l, "modulate:a", 0.0, 0.45).set_delay(0.2)
	tw.chain().tween_callback(l.queue_free)


static func ring(parent: Node, pos: Vector2, radius: float, col: Color, dur := 0.35, fill := false) -> void:
	if parent == null or not is_instance_valid(parent):
		return
	var n := RingFX.new()
	n.col = col
	n.fill = fill
	n.z_index = 40
	parent.add_child(n)
	n.global_position = pos
	n.radius = radius * 0.25
	var tw := n.create_tween()
	tw.set_parallel(true)
	tw.tween_property(n, "radius", radius, dur).set_ease(Tween.EASE_OUT)
	tw.tween_property(n, "modulate:a", 0.0, dur)
	tw.chain().tween_callback(n.queue_free)


static func burst(parent: Node, pos: Vector2, col: Color, amount := 14, speed := 260.0) -> void:
	if parent == null or not is_instance_valid(parent):
		return
	var p := CPUParticles2D.new()
	p.amount = amount
	p.one_shot = true
	p.explosiveness = 1.0
	p.lifetime = 0.5
	p.direction = Vector2.RIGHT
	p.spread = 180.0
	p.gravity = Vector2.ZERO
	p.initial_velocity_min = speed * 0.4
	p.initial_velocity_max = speed
	p.scale_amount_min = 2.0
	p.scale_amount_max = 5.0
	p.color = col
	p.z_index = 40
	parent.add_child(p)
	p.global_position = pos
	p.emitting = true
	var t := parent.get_tree().create_timer(1.2)
	t.timeout.connect(func():
		if is_instance_valid(p):
			p.queue_free())


static func flash(item: CanvasItem) -> void:
	if item == null or not is_instance_valid(item):
		return
	var tw := item.create_tween()
	tw.tween_property(item, "modulate", Color(5, 1.6, 1.6), 0.05)
	tw.tween_property(item, "modulate", Color(1, 1, 1), 0.15)
