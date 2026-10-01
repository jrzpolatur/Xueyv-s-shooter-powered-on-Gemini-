class_name Pickup
extends Area2D
## 掉落物：治疗球 / 能量方块（增加伤害与生命上限）。

var kind := "heal"
var bob := 0.0


func _ready() -> void:
	collision_layer = 0
	collision_mask = 2
	z_index = 2
	if kind == "gem":
		add_to_group("gems")
	var cs := CollisionShape2D.new()
	var sh := CircleShape2D.new()
	sh.radius = 26.0
	cs.shape = sh
	add_child(cs)
	body_entered.connect(_on_body)


func _process(delta: float) -> void:
	bob += delta * 4.0
	queue_redraw()


func _on_body(body: Node2D) -> void:
	if not (body is Unit):
		return
	var u := body as Unit
	if not u.alive:
		return
	if kind == "heal":
		u.heal(40.0)
	elif kind == "gem":
		u.gems += 1
		FX.damage_num(get_parent(), global_position + Vector2(0, -40), "宝石 +1", Color(0.45, 0.95, 0.9))
	else:
		u.cubes += 1
		u.max_hp += Unit.CUBE_HP
		u.hp = minf(u.max_hp, u.hp + Unit.CUBE_HP)
		FX.damage_num(get_parent(), global_position + Vector2(0, -40), "力量提升!", Color(0.85, 0.6, 1.0))
	G.play_sfx("pickup", global_position, -5.0)
	FX.ring(get_parent(), global_position, 40.0, Color(1, 1, 1, 0.8), 0.3)
	queue_free()


func _draw() -> void:
	var y := -14.0 + sin(bob) * 5.0
	draw_set_transform(Vector2(0, 2), 0.0, Vector2(1.0, 0.5))
	draw_circle(Vector2.ZERO, 16.0, Color(0, 0, 0, 0.2))
	draw_set_transform(Vector2.ZERO, 0.0, Vector2.ONE)
	if kind == "heal":
		draw_circle(Vector2(0, y), 20.0, Color(0.5, 1.0, 0.6, 0.25))
		draw_circle(Vector2(0, y), 14.0, Color(0.95, 1.0, 0.97))
		draw_rect(Rect2(-7, y - 2.5, 14, 5), Color(0.2, 0.75, 0.35))
		draw_rect(Rect2(-2.5, y - 7, 5, 14), Color(0.2, 0.75, 0.35))
	elif kind == "gem":
		draw_circle(Vector2(0, y), 20.0, Color(0.35, 0.95, 0.9, 0.3))
		draw_colored_polygon(PackedVector2Array([
			Vector2(0, y - 14), Vector2(11, y), Vector2(0, y + 14), Vector2(-11, y),
		]), Color(0.3, 0.9, 0.85))
		draw_colored_polygon(PackedVector2Array([
			Vector2(0, y - 7), Vector2(5.5, y), Vector2(0, y + 7), Vector2(-5.5, y),
		]), Color(0.8, 1.0, 0.98))
	else:
		draw_circle(Vector2(0, y), 20.0, Color(0.8, 0.5, 1.0, 0.25))
		draw_set_transform(Vector2(0, y), PI / 4.0, Vector2.ONE)
		draw_rect(Rect2(-10, -10, 20, 20), Color(0.72, 0.45, 1.0))
		draw_rect(Rect2(-6, -6, 12, 12), Color(0.9, 0.75, 1.0))
		draw_set_transform(Vector2.ZERO, 0.0, Vector2.ONE)
