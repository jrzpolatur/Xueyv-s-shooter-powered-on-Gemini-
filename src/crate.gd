class_name Crate
extends StaticBody2D
## 可破坏的补给箱：打碎后掉落治疗球或能量方块。

var hp := 40.0
var sprite: Sprite2D
var ci := -1   # 联机同步用编号


func _ready() -> void:
	collision_layer = 1
	collision_mask = 0
	var cs := CollisionShape2D.new()
	var sh := RectangleShape2D.new()
	sh.size = Vector2(70, 60)
	cs.shape = sh
	add_child(cs)
	sprite = Sprite2D.new()
	sprite.texture = load("res://assets/img/crate.png")
	sprite.scale = Vector2(0.45, 0.45)
	sprite.offset = Vector2(0, -28)
	add_child(sprite)


func take_damage(d: float, _source: Unit) -> void:
	if Net.is_client():
		FX.flash(sprite)   # 客户端影子：破坏由服务器事件驱动
		return
	hp -= d
	FX.flash(sprite)
	if hp <= 0.0:
		var arena := get_parent().get_parent()
		if arena != null and arena.has_method("spawn_pickup"):
			arena.spawn_pickup(global_position, "heal" if randf() < 0.5 else "cube")
		Net.ev_crate(ci)
		break_fx()
		queue_free()


func break_fx() -> void:
	var arena := get_parent().get_parent()
	FX.burst(arena if arena != null else get_parent(), global_position, Color(0.75, 0.55, 0.35), 16, 260.0)
	G.play_sfx("crate", global_position, -6.0)
