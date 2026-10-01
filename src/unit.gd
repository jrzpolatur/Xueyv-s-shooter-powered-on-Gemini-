class_name Unit
extends CharacterBody2D
## 战斗单位基类：玩家与 AI 共用。
## 设计说明：所有操作都通过「意图」字段 (move_input / aim_dir / want_fire / want_skill)
## 驱动，控制端（本地输入、AI、将来的网络同步）只负责写入意图，方便扩展联机。

signal died(unit: Unit, killer: Unit)

const BASE_HP := 100.0
const BASE_SPEED := 300.0
const CUBE_DMG := 0.12
const CUBE_HP := 8.0
const ULT_NEED := 500.0


class InfoDraw:
	extends Node2D
	var u: Unit

	func _process(_delta: float) -> void:
		queue_redraw()

	func _draw() -> void:
		if u == null or not u.alive:
			return
		var w := 62.0
		var h := 7.0
		var y := -128.0
		draw_rect(Rect2(-w / 2 - 1, y - 1, w + 2, h + 2), Color(0, 0, 0, 0.55))
		var pct: float = clampf(u.hp / u.max_hp, 0.0, 1.0)
		var c := Color(0.35, 0.9, 0.4) if u.is_player_unit else Color(0.95, 0.35, 0.35)
		draw_rect(Rect2(-w / 2, y, w * pct, h), c)
		if u.shield > 0.0:
			var spct: float = clampf(u.shield / 60.0, 0.0, 1.0)
			draw_rect(Rect2(-w / 2, y - 5, w * spct, 3), Color(0.55, 0.8, 1.0))
		if u.cubes > 0:
			for i in range(u.cubes):
				draw_circle(Vector2(-w / 2 + 5 + i * 10, y + h + 6), 3.5, Color(0.8, 0.5, 1.0))
		if u.gems > 0:
			for i in range(mini(u.gems, 12)):
				var gx := -w / 2 + 5 + i * 9
				var gy := y - 11
				draw_colored_polygon(PackedVector2Array([
					Vector2(gx, gy - 5), Vector2(gx + 4, gy), Vector2(gx, gy + 5), Vector2(gx - 4, gy),
				]), Color(0.35, 0.95, 0.9))


var arena: Node2D
var display_name := "???"
var is_player_unit := false
var team := 0
var rel_ally := false
var gems := 0

var wdef: Dictionary
var sdef: Dictionary
var idef: Dictionary
var udef: Dictionary
var chara_tint := Color.WHITE

var max_hp := BASE_HP
var hp := BASE_HP
var move_speed := BASE_SPEED
var dmg_mult := 1.0
var lifesteal := 0.0
var cd_mult := 1.0
var armor_mult := 1.0
var rage_t := 0.0
var slow_t := 0.0
var lava_count := 0
var lava_tick := 0.0
var ult_charge := 0.0
var want_ult := false

var kills := 0
var deaths := 0
var cubes := 0

# —— 控制意图 ——
var move_input := Vector2.ZERO
var aim_dir := Vector2.RIGHT
var aim_point := Vector2.ZERO
var want_fire := false
var want_skill := false

var fire_cd := 0.0
var skill_cd := 0.0
var skill_cd_total := 5.0
var shield := 0.0
var shield_t := 0.0
var dash_t := 0.0
var dash_dir := Vector2.RIGHT
var kb_vel := Vector2.ZERO
var invuln_t := 0.0
var regen_wait := 0.0
var bush_count := 0
var reveal_t := 0.0
var alive := true

var sprite: Sprite2D
var info: InfoDraw
var name_label: Label
var bob_t := 0.0


func setup(p_arena: Node2D, p_loadout: Dictionary, p_name: String, p_is_player: bool, p_team := 0) -> void:
	arena = p_arena
	display_name = p_name
	is_player_unit = p_is_player
	team = p_team
	var cdef: Dictionary = Catalog.CHARS[p_loadout["chara"]]
	wdef = Catalog.WEAPONS[p_loadout["weapon"]]
	sdef = Catalog.SKILLS[p_loadout["skill"]]
	idef = Catalog.ITEMS[p_loadout["item"]]
	udef = Catalog.ULTS[p_loadout.get("ult", "storm")]
	chara_tint = cdef["tint"]
	max_hp = BASE_HP * float(idef.get("hp_mult", 1.0))
	hp = max_hp
	move_speed = BASE_SPEED * float(idef.get("speed_mult", 1.0))
	dmg_mult = float(idef.get("dmg_mult", 1.0))
	lifesteal = float(idef.get("lifesteal", 0.0))
	cd_mult = float(idef.get("cd_mult", 1.0))
	armor_mult = float(idef.get("armor_mult", 1.0))
	skill_cd_total = float(sdef["cd"]) * cd_mult

	collision_layer = 2
	collision_mask = 1 | 2
	var cs := CollisionShape2D.new()
	var sh := CircleShape2D.new()
	sh.radius = 24.0
	cs.shape = sh
	add_child(cs)

	sprite = Sprite2D.new()
	sprite.texture = load(cdef["tex"])
	sprite.scale = Vector2(0.43, 0.43)
	sprite.offset = Vector2(0, -118)
	add_child(sprite)

	info = InfoDraw.new()
	info.u = self
	info.z_index = 30
	info.z_as_relative = false
	add_child(info)

	name_label = Label.new()
	name_label.text = display_name
	name_label.add_theme_font_size_override("font_size", 15)
	name_label.add_theme_color_override("font_color", Color(1, 1, 1))
	name_label.add_theme_color_override("font_outline_color", Color(0, 0, 0, 0.8))
	name_label.add_theme_constant_override("outline_size", 5)
	name_label.position = Vector2(-70, -158)
	name_label.size = Vector2(140, 20)
	name_label.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	name_label.z_index = 30
	name_label.z_as_relative = false
	add_child(name_label)


func refresh_relation() -> void:
	## 根据与玩家的阵营关系刷新配色（出生与换队时由 Arena 调用）
	var viewer: Node = G.player
	rel_ally = viewer != null and is_instance_valid(viewer) and viewer != self \
		and viewer.get("team") == team
	if is_player_unit:
		name_label.add_theme_color_override("font_color", Color(1, 0.95, 0.6))
	elif rel_ally:
		name_label.add_theme_color_override("font_color", Color(0.6, 0.9, 1.0))
	else:
		name_label.add_theme_color_override("font_color", Color(1, 0.75, 0.75))


func total_dmg_mult() -> float:
	return dmg_mult * (1.0 + CUBE_DMG * cubes)


func is_enemy_of(u: Unit) -> bool:
	return u != null and u != self and u.team != team


func is_hidden() -> bool:
	return bush_count > 0 and reveal_t <= 0.0


func _physics_process(delta: float) -> void:
	if not alive:
		return
	fire_cd = maxf(0.0, fire_cd - delta)
	skill_cd = maxf(0.0, skill_cd - delta)
	invuln_t = maxf(0.0, invuln_t - delta)
	reveal_t = maxf(0.0, reveal_t - delta)
	dash_t = maxf(0.0, dash_t - delta)
	rage_t = maxf(0.0, rage_t - delta)
	slow_t = maxf(0.0, slow_t - delta)
	# 岩浆灼烧
	if lava_count > 0 and invuln_t <= 0.0:
		hp -= 15.0 * delta
		regen_wait = maxf(regen_wait, 1.5)
		lava_tick -= delta
		if lava_tick <= 0.0:
			lava_tick = 0.6
			FX.damage_num(arena, global_position + Vector2(0, -120), "灼烧", Color(1, 0.55, 0.2))
			FX.flash(sprite)
		if hp <= 0.0:
			die(null)
			return
	if shield > 0.0:
		shield_t -= delta
		if shield_t <= 0.0:
			shield = 0.0
	regen_wait = maxf(0.0, regen_wait - delta)
	if regen_wait <= 0.0 and hp < max_hp:
		heal(12.0 * delta, false)

	if dash_t > 0.0:
		velocity = dash_dir * 950.0
	else:
		var spd := move_speed * (1.25 if rage_t > 0.0 else 1.0)
		if slow_t > 0.0:
			spd *= 0.4
		velocity = move_input.limit_length(1.0) * spd + kb_vel
	kb_vel = kb_vel.move_toward(Vector2.ZERO, 1400.0 * delta)
	move_and_slide()

	if want_fire and fire_cd <= 0.0:
		fire()
	if want_skill and skill_cd <= 0.0:
		use_skill()
	want_skill = false
	if want_ult and ult_charge >= ULT_NEED:
		use_ult()
	want_ult = false

	_update_visual(delta)


func _update_visual(delta: float) -> void:
	sprite.flip_h = aim_dir.x < 0.0
	if velocity.length() > 20.0:
		bob_t += delta * 11.0
		sprite.rotation = sin(bob_t) * 0.07
		sprite.scale.y = 0.43 + sin(bob_t * 2.0) * 0.012
	else:
		sprite.rotation = lerpf(sprite.rotation, 0.0, 10.0 * delta)

	var a := 1.0
	if is_hidden():
		if is_player_unit:
			a = 0.55
		else:
			var viewer: Node = G.player
			if viewer != null and is_instance_valid(viewer) and viewer.alive \
					and viewer.global_position.distance_to(global_position) < 170.0:
				a = 0.5
			else:
				a = 0.0
	if invuln_t > 0.0 and a > 0.0:
		a *= 0.5 + 0.5 * absf(sin(Time.get_ticks_msec() * 0.02))
	var target := Color(1, 1, 1, a)
	self_modulate = target
	sprite.visible = a > 0.01
	info.visible = a > 0.01
	name_label.visible = a > 0.01
	sprite.modulate.a = a
	queue_redraw()


func _draw() -> void:
	if not alive:
		return
	# 脚下阴影 + 阵营圈
	draw_set_transform(Vector2(0, 4), 0.0, Vector2(1.0, 0.5))
	draw_circle(Vector2.ZERO, 26.0, Color(0, 0, 0, 0.22))
	var ring_col := Color(1, 0.4, 0.4, 0.45)
	if is_player_unit:
		ring_col = Color(1, 0.95, 0.5, 0.85)
	elif rel_ally:
		ring_col = Color(0.5, 0.85, 1.0, 0.7)
	draw_arc(Vector2.ZERO, 30.0, 0.0, TAU, 32, ring_col, 3.0)
	if rage_t > 0.0:
		draw_arc(Vector2.ZERO, 36.0, 0.0, TAU, 32, Color(1, 0.25, 0.2, 0.8), 3.0)
	if slow_t > 0.0:
		draw_arc(Vector2.ZERO, 40.0, 0.0, TAU, 32, Color(0.4, 0.7, 1.0, 0.7), 3.0)
	draw_set_transform(Vector2.ZERO, 0.0, Vector2.ONE)
	if is_player_unit and sprite != null and sprite.visible:
		draw_line(aim_dir * 40.0, aim_dir * 170.0, Color(1, 1, 1, 0.18), 4.0)


func fire() -> void:
	fire_cd = float(wdef["interval"]) * (0.6 if rage_t > 0.0 else 1.0)
	reveal_t = 1.0
	invuln_t = minf(invuln_t, 0.1)
	var n := int(wdef["pellets"])
	var base_angle := aim_dir.angle()
	for i in range(n):
		var ang := base_angle
		var spread := float(wdef["spread"])
		if n > 1:
			ang += deg_to_rad(lerpf(-spread, spread, float(i) / float(n - 1)))
		else:
			ang += deg_to_rad(randf_range(-spread, spread))
		var d := Vector2.from_angle(ang)
		var p := Projectile.new()
		arena.add_child(p)
		p.setup(self, global_position + d * 30.0, d, wdef, aim_point)
	FX.ring(arena, global_position + aim_dir * 38.0 - Vector2(0, 30), 14.0, wdef["color"], 0.12)
	G.play_sfx(String(wdef["sfx"]), global_position, -4.0)
	if is_player_unit and arena.has_method("add_shake"):
		arena.add_shake(float(wdef["shake"]))


func use_skill() -> void:
	skill_cd = skill_cd_total
	G.play_sfx("skill", global_position, -6.0)
	match String(sdef["id"]):
		"dash":
			dash_dir = move_input.normalized() if move_input.length() > 0.1 else aim_dir
			dash_t = 0.17
			invuln_t = maxf(invuln_t, 0.3)
			FX.burst(arena, global_position, Color(1, 1, 1, 0.8), 10, 200.0)
		"nova":
			FX.ring(arena, global_position, 150.0, Color(1, 0.5, 0.25), 0.4, true)
			FX.burst(arena, global_position, Color(1, 0.55, 0.3), 24, 420.0)
			G.play_sfx("boom", global_position, -4.0)
			if arena.has_method("add_shake"):
				arena.add_shake(8.0)
			for u in arena.get("units"):
				if u == self or not is_instance_valid(u) or not u.alive or u.team == team:
					continue
				var dist: float = u.global_position.distance_to(global_position)
				if dist <= 160.0:
					u.take_damage(36.0 * total_dmg_mult(), self)
					u.kb_vel = (u.global_position - global_position).normalized() * 420.0
		"heal":
			var f := HealField.new()
			f.owner_unit = self
			arena.add_child(f)
			f.global_position = global_position
			G.play_sfx("heal", global_position, -6.0)
		"shield":
			shield = 60.0
			shield_t = 3.0
			FX.ring(arena, global_position, 60.0, Color(0.55, 0.8, 1.0), 0.4)
		"rage":
			rage_t = 4.0
			FX.ring(arena, global_position, 70.0, Color(1, 0.25, 0.2), 0.4, true)
			FX.burst(arena, global_position, Color(1, 0.3, 0.25), 16, 300.0)


func add_ult_charge(v: float) -> void:
	ult_charge = minf(ULT_NEED, ult_charge + v)


func use_ult() -> void:
	ult_charge = 0.0
	G.play_sfx("ult", global_position, -2.0)
	if is_player_unit and arena.has_method("add_shake"):
		arena.add_shake(8.0)
	var clamped_aim: Vector2 = global_position + (aim_point - global_position).limit_length(500.0)
	match String(udef["id"]):
		"storm":
			_storm_wave()
			for w in [0.22, 0.44]:
				var t := get_tree().create_timer(w)
				t.timeout.connect(_storm_wave)
		"meteor":
			for k in range(5):
				var pos := clamped_aim + Vector2(randf_range(-130, 130), randf_range(-110, 110))
				FX.ring(arena, pos, 70.0, Color(1, 0.4, 0.2, 0.8), 0.85)
				var t2 := get_tree().create_timer(0.8 + k * 0.13)
				var dmg := 42.0 * total_dmg_mult()
				t2.timeout.connect(func():
					if arena != null and is_instance_valid(arena) and arena.has_method("explode"):
						arena.explode(pos, 95.0, dmg, self, Color(1, 0.5, 0.25)))
		"wall":
			var base := global_position + aim_dir * 140.0
			var perp := aim_dir.orthogonal()
			for k in [-1, 0, 1]:
				if arena.has_method("spawn_temp_wall"):
					arena.spawn_temp_wall(base + perp * float(k) * 85.0, 6.0)
			FX.ring(arena, base, 90.0, Color(0.8, 0.75, 0.6), 0.4)
		"chrono":
			FX.ring(arena, clamped_aim, 190.0, Color(0.45, 0.7, 1.0), 0.6, true)
			for u in arena.get("units"):
				if u == self or not is_instance_valid(u) or not u.alive or u.team == team:
					continue
				if u.global_position.distance_to(clamped_aim) <= 190.0:
					u.slow_t = 4.0
					u.take_damage(10.0 * total_dmg_mult(), self)


func _storm_wave() -> void:
	if not alive or arena == null or not is_instance_valid(arena):
		return
	G.play_sfx("shot1", global_position, -6.0)
	for k in range(14):
		var ang := TAU * float(k) / 14.0 + randf_range(0.0, 0.25)
		var d := Vector2.from_angle(ang)
		var p := Projectile.new()
		arena.add_child(p)
		p.setup(self, global_position + d * 32.0, d, Catalog.ULT_PROJ, global_position + d * 100.0)


func take_damage(amount: float, source: Unit) -> void:
	if not alive or invuln_t > 0.0:
		return
	var a := amount * armor_mult
	if shield > 0.0:
		var absorbed := minf(shield, a)
		shield -= absorbed
		a -= absorbed
		FX.damage_num(arena, global_position + Vector2(0, -120), str(int(absorbed)), Color(0.6, 0.85, 1.0))
	if a > 0.0:
		hp -= a
		regen_wait = 4.0
		FX.damage_num(arena, global_position + Vector2(0, -130), str(int(roundf(a))),
			Color(1, 0.9, 0.3) if source != null and source.is_player_unit else Color(1, 0.45, 0.45))
		FX.flash(sprite)
		G.play_sfx("hit", global_position, -8.0)
		if source != null and is_instance_valid(source) and source != self and source.alive:
			if source.lifesteal > 0.0:
				source.heal(a * source.lifesteal, false)
			if source.team != team:
				source.add_ult_charge(a * 0.9)
	if hp <= 0.0:
		die(source)


func heal(amount: float, show := true) -> void:
	if not alive:
		return
	var before := hp
	hp = minf(max_hp, hp + amount)
	if show and hp - before >= 1.0:
		FX.damage_num(arena, global_position + Vector2(0, -130), "+" + str(int(hp - before)), Color(0.5, 1.0, 0.55))


func die(killer: Unit) -> void:
	if not alive:
		return
	alive = false
	hp = 0.0
	deaths += 1
	shield = 0.0
	want_fire = false
	set_deferred("collision_layer", 0)
	set_deferred("collision_mask", 0)
	sprite.visible = false
	info.visible = false
	name_label.visible = false
	queue_redraw()
	FX.burst(arena, global_position, chara_tint, 26, 380.0)
	FX.ring(arena, global_position, 90.0, chara_tint, 0.45)
	G.play_sfx("death", global_position, -2.0)
	if killer != null and is_instance_valid(killer) and killer != self:
		killer.add_ult_charge(150.0)
	died.emit(self, killer)


func respawn(pos: Vector2) -> void:
	# 死亡会掉落能量方块加成
	max_hp -= CUBE_HP * cubes
	cubes = 0
	alive = true
	hp = max_hp
	shield = 0.0
	kb_vel = Vector2.ZERO
	global_position = pos
	invuln_t = 2.0
	fire_cd = 0.3
	skill_cd = minf(skill_cd, 2.0)
	collision_layer = 2
	collision_mask = 1 | 2
	sprite.visible = true
	info.visible = true
	name_label.visible = true
	FX.ring(arena, pos, 70.0, Color(1, 1, 1, 0.8), 0.4)
