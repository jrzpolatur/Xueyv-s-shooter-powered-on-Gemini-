class_name Boss
extends Bot
## 魔王·雪烬：巨型 Boss。高血量、散射弹幕、周期性随机必杀，永不退缩。

var ult_timer := 6.0


func make_boss() -> void:
	is_boss = true
	wdef = Catalog.BOSS_WEAPON
	max_hp = 2800.0
	hp = max_hp
	move_speed = 235.0
	armor_mult = 0.85
	sprite_scale = 0.78
	sprite.scale = Vector2(0.78, 0.78)
	sprite.modulate = Color(0.85, 0.65, 1.0)
	(cshape.shape as CircleShape2D).radius = 42.0
	name_label.position = Vector2(-70, -268)
	name_label.add_theme_font_size_override("font_size", 19)
	info.position = Vector2(0, -90)


func _physics_process(delta: float) -> void:
	if alive and arena != null and not arena.get("match_over"):
		ult_timer -= delta
		if ult_timer <= 0.0:
			ult_timer = randf_range(7.0, 10.0)
			udef = Catalog.ULTS[["storm", "meteor", "chrono"].pick_random()]
			ult_charge = ULT_NEED
			if target != null and is_instance_valid(target):
				aim_point = target.global_position
			want_ult = true
	super._physics_process(delta)


func _think() -> void:
	super._think()
	# 魔王永不逃跑，减速效果减半
	if state == "flee":
		state = "engage"
	slow_t = minf(slow_t, 2.0)
