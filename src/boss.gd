class_name Boss
extends Bot
## 魔王·雪烬：巨型 Boss。高血量、散射弹幕、周期性随机必杀，永不退缩。

var ult_timer := 6.0


func make_boss() -> void:
	apply_boss_visuals()
	wdef = Catalog.BOSS_WEAPON
	max_hp = 2800.0
	hp = max_hp
	move_speed = 235.0
	armor_mult = 0.85


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
