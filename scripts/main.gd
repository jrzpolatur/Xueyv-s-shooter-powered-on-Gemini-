extends Node3D
## 免疫对决 M0-M2 demo — main orchestrator.
## World = blood vessel: analytic flow field, drifting body cells,
## 2 macrophages + 1 plasma cell. Player is a virus: infect cells,
## lysis releases progeny that auto-infect; win at 100% infection.

const Util := preload("res://scripts/util.gd")
const FlowFieldScript := preload("res://scripts/flow_field.gd")
const PlayerVirusScript := preload("res://scripts/player_virus.gd")
const ProgenyVirusScript := preload("res://scripts/progeny_virus.gd")
const BodyCellScript := preload("res://scripts/body_cell.gd")
const MacrophageScript := preload("res://scripts/macrophage.gd")
const PlasmaCellScript := preload("res://scripts/plasma_cell.gd")
const AntibodyScript := preload("res://scripts/antibody.gd")
const HudScript := preload("res://scripts/hud.gd")

const ARENA_RADIUS := 42.0
const TARGET_CELL_COUNT := 24
const MACROPHAGE_COUNT := 2
const MACROPHAGE_GRACE := 6.0
const PROGENY_PER_LYSIS := 4
const MAX_VIRUSES := 60
const PLAYER_MAX_HP := 3
const INFECT_TIME_PLAYER := 1.1
const INFECT_TIME_PROGENY := 1.7

var flow # FlowField instance
var arena_radius := ARENA_RADIUS
var sim_time := 0.0
var game_state := "playing" # playing / win / lose

var player = null
var player_hp := PLAYER_MAX_HP
var invuln_timer := 0.0
var player_infecting_pct := 0.0

var progeny: Array = []
var cells: Array = []
var macrophages: Array = []
var plasma_cells: Array = []
var antibodies: Array = []
var debris: Array = []
var converted := 0
var total_cells_count := 0

var cam_yaw := 0.0
var cam_pitch := 0.95
var cam_dist := 26.0
var cam_node: Camera3D
var shake := 0.0

var hud = null
var smoke_test := false


func _ready() -> void:
	randomize()
	if OS.get_cmdline_args().has("--smoke-test"):
		smoke_test = true
		seed(12345)

	flow = FlowFieldScript.new()
	flow.arena_radius = ARENA_RADIUS

	_build_environment()
	_build_arena()
	_spawn_debris()
	_spawn_entities()

	cam_node = Camera3D.new()
	cam_node.fov = 60.0
	add_child(cam_node)
	_update_camera(1.0)

	hud = HudScript.new()
	add_child(hud)

	if smoke_test:
		print("[smoke] booted: cells=", cells.size(), " macrophages=", macrophages.size(), " plasma=", plasma_cells.size())


# ---------------------------------------------------------------- world build

func _build_environment() -> void:
	var env := Environment.new()
	env.background_mode = Environment.BG_COLOR
	env.background_color = Util.COL_BG
	env.ambient_light_source = Environment.AMBIENT_SOURCE_COLOR
	env.ambient_light_color = Color(0.9, 0.55, 0.5)
	env.ambient_light_energy = 0.85
	env.fog_enabled = true
	env.fog_light_color = Color(0.45, 0.08, 0.12)
	env.fog_density = 0.006
	var we := WorldEnvironment.new()
	we.environment = env
	add_child(we)

	var sun := DirectionalLight3D.new()
	sun.rotation = Vector3(deg_to_rad(-55.0), deg_to_rad(-35.0), 0.0)
	sun.light_energy = 1.25
	sun.light_color = Color(1.0, 0.92, 0.88)
	add_child(sun)


func _build_arena() -> void:
	var floor_mesh := MeshInstance3D.new()
	var cyl := CylinderMesh.new()
	cyl.top_radius = ARENA_RADIUS
	cyl.bottom_radius = ARENA_RADIUS
	cyl.height = 0.6
	cyl.radial_segments = 48
	floor_mesh.mesh = cyl
	floor_mesh.position = Vector3(0, -0.55, 0)
	floor_mesh.material_override = Util.make_mat(Util.COL_FLOOR, Util.COL_FLOOR * 0.35, 0.25, 0.9)
	add_child(floor_mesh)

	var rim := Util.make_torus(ARENA_RADIUS - 0.4, ARENA_RADIUS + 0.4, Util.make_mat(Util.COL_RIM, Util.COL_RIM, 1.6, 0.4))
	rim.position = Vector3(0, 0.2, 0)
	rim.rotation.x = PI / 2.0
	add_child(rim)


func _spawn_debris() -> void:
	var mat_a := Util.make_mat(Color(0.75, 0.18, 0.2), Color(0, 0, 0), 0.0, 0.8)
	var mat_b := Util.make_mat(Color(0.55, 0.1, 0.16), Color(0, 0, 0), 0.0, 0.8)
	for i in 220:
		var d := Util.make_sphere(0.16, mat_a if i % 2 == 0 else mat_b)
		d.scale = Vector3(1.6, 0.4, 1.0)
		var ang := randf() * TAU
		var r := sqrt(randf()) * (ARENA_RADIUS - 2.0)
		d.position = Vector3(cos(ang) * r, randf_range(0.2, 5.0), sin(ang) * r)
		add_child(d)
		debris.append(d)


func _spawn_entities() -> void:
	total_cells_count = TARGET_CELL_COUNT
	for i in TARGET_CELL_COUNT:
		var c = BodyCellScript.new()
		c.position = _random_pos(3.0)
		add_child(c)
		cells.append(c)

	var player_spawn := Vector3(0, 1.2, 14.0)
	for i in MACROPHAGE_COUNT:
		var m = MacrophageScript.new()
		m.position = _random_pos(6.0)
		while m.position.distance_to(player_spawn) < 28.0:
			m.position = _random_pos(6.0)
		add_child(m)
		macrophages.append(m)

	var p = PlasmaCellScript.new()
	p.position = _random_pos(6.0)
	add_child(p)
	plasma_cells.append(p)

	player = PlayerVirusScript.new()
	player.position = Vector3(0, 1.2, 14.0)
	add_child(player)


func _random_pos(margin: float) -> Vector3:
	var ang := randf() * TAU
	var r := sqrt(randf()) * (ARENA_RADIUS - margin - 4.0)
	return Vector3(cos(ang) * r, 1.0, sin(ang) * r)


# ---------------------------------------------------------------- main loop

func _physics_process(delta: float) -> void:
	if game_state != "playing":
		if Input.is_action_just_pressed("restart"):
			get_tree().reload_current_scene()
		return

	sim_time += delta
	flow.time = sim_time

	if smoke_test and Engine.get_physics_frames() % 600 == 0:
		print("[smoke] status t=", int(sim_time), "s infected=", converted, "/", total_cells_count,
			" prog=", progeny.size(), " hp=", player_hp, " max_prog=", max_progeny_seen,
			" ppos=", player.global_position, " v=", player.velocity.length())

	if invuln_timer > 0.0:
		invuln_timer -= delta

	if player != null and player.alive:
		player.step(delta, self)

	# Prune freed/dead nodes so we never touch freed instances.
	cells = cells.filter(func(c): return is_instance_valid(c) and c.alive and c.state != 2)

	var vp := 0
	while vp < progeny.size():
		var v = progeny[vp]
		if v.alive:
			v.step(delta, self)
			vp += 1
		else:
			v.queue_free()
			progeny.remove_at(vp)

	for c in cells:
		if c.alive:
			c.step(delta, self)

	for m in macrophages:
		if m.alive:
			m.step(delta, self)

	for pc in plasma_cells:
		if pc.alive:
			pc.step(delta, self)

	var ap := 0
	while ap < antibodies.size():
		var ab = antibodies[ap]
		if ab.alive:
			ab.step(delta, self)
			ap += 1
		else:
			ab.queue_free()
			antibodies.remove_at(ap)

	_update_debris(delta)
	_update_infections(delta)
	_resolve_collisions()
	_update_camera(delta)

	player_infecting_pct = 0.0
	for c in cells:
		if c.alive and c.state == 0 and player != null and player.alive:
			if global_dist(player, c) < player.radius + c.radius + 0.8:
				player_infecting_pct = c.infect_progress

	_check_win_lose()
	_update_hud()


func global_dist(a, b) -> float:
	return a.global_position.distance_to(b.global_position)


# ---------------------------------------------------------------- infection

func _update_infections(delta: float) -> void:
	for c in cells:
		if not c.alive or c.state != 0:
			continue
		var touching := false
		if player != null and player.alive and global_dist(player, c) < player.radius + c.radius + 0.8:
			touching = true
			c.infect_progress += delta / INFECT_TIME_PLAYER
		for v in progeny:
			if v.alive and global_dist(v, c) < v.radius + c.radius + 0.7:
				touching = true
				c.infect_progress += delta / INFECT_TIME_PROGENY
		if touching and c.infect_progress >= 1.0:
			infect_cell(c)


func infect_cell(c) -> void:
	if not c.alive or c.state != 0:
		return
	c.state = 1
	c.lysis_timer = c.LYSIS_DELAY
	converted += 1
	shake = maxf(shake, 0.12)
	if hud != null:
		hud.toast(hud.T("细胞被感染！ %d/%d" % [converted, total_cells_count], "Cell infected! %d/%d" % [converted, total_cells_count]), 1.1)


func lyse_cell(c) -> void:
	if c.state == 2:
		return
	c.state = 2
	c.alive = false
	shake = maxf(shake, 0.3)
	var pos: Vector3 = c.global_position
	c.queue_free()
	spawn_progeny(pos, PROGENY_PER_LYSIS)


func spawn_progeny(pos: Vector3, n: int) -> void:
	for i in n:
		if virus_count() >= MAX_VIRUSES:
			return
		var v = ProgenyVirusScript.new()
		v.position = pos + Vector3(randf_range(-0.5, 0.5), 0, randf_range(-0.5, 0.5))
		var a := randf() * TAU
		v.velocity = Vector3(cos(a), 0.0, sin(a)) * randf_range(6.0, 11.0)
		add_child(v)
		progeny.append(v)
	max_progeny_seen = maxi(max_progeny_seen, progeny.size())


func nearest_healthy_cell(pos: Vector3):
	var best = null
	var best_d := 1e9
	for c in cells:
		if c.alive and c.state == 0:
			var d := pos.distance_to(c.global_position)
			if d < best_d:
				best_d = d
				best = c
	return best


func infection_ratio() -> float:
	return float(converted) / float(maxi(cells.size(), 1))


func total_cells() -> int:
	return cells.size()


func virus_count() -> int:
	var n := 0
	if player != null and player.alive:
		n += 1
	n += progeny.size()
	return n


# ---------------------------------------------------------------- immune NPCs

func pick_macrophage_target(m):
	# Priority 1: antibody-marked viruses inside aggro range (most marks, then nearest).
	var best = null
	var best_score := -1.0
	for v in _all_viruses():
		if not v.alive:
			continue
		if v.is_player and invuln_timer > 0.0:
			continue
		var d := global_dist(m, v)
		if v.mark_stacks >= 1 and d < m.AGGRO_MARKED:
			var score := float(v.mark_stacks) * 100.0 - d
			if score > best_score:
				best_score = score
				best = v
	if best != null:
		return best
	# Priority 2: nearest unmarked virus in close range.
	best = null
	var best_d: float = m.AGGRO_PLAIN
	for v in _all_viruses():
		if not v.alive:
			continue
		if v.is_player and (invuln_timer > 0.0 or sim_time < MACROPHAGE_GRACE):
			continue
		var d := global_dist(m, v)
		if d < best_d:
			best_d = d
			best = v
	return best


func _all_viruses() -> Array:
	var out: Array = []
	if player != null and player.alive:
		out.append(player)
	out.append_array(progeny)
	return out


func begin_eat(m, target) -> void:
	if target.is_player:
		damage_player(m.global_position)
	else:
		target.alive = false # grabbed: stops moving, removed when chew finishes
	if hud != null:
		if target.is_player:
			hud.toast(hud.T("警告：巨噬细胞咬住了你！", "WARNING: a macrophage bit you!"), 1.6)
		else:
			hud.toast(hud.T("巨噬细胞吞噬了一个子代", "A macrophage swallowed a progeny"), 1.2)


func finish_eat(_m, _target) -> void:
	pass # progeny node is freed in the main loop; player handled at bite


func damage_player(from_pos: Vector3) -> void:
	if invuln_timer > 0.0 or game_state != "playing":
		return
	player_hp -= 1
	invuln_timer = 2.5
	shake = maxf(shake, 0.4)
	var away: Vector3 = player.global_position - from_pos
	away.y = 0.0
	if away.length_squared() < 0.01:
		away = Vector3.FORWARD
	player.global_position += away.normalized() * 6.0
	player.velocity = away.normalized() * 18.0
	if hud != null:
		hud.toast(hud.T("被吞噬！剩余 HP：%d" % maxi(player_hp, 0), "Swallowed! HP left: %d" % maxi(player_hp, 0)), 1.6)
	if player_hp <= 0:
		player.alive = false


func spawn_antibody(from_cell) -> void:
	if player == null or not player.alive:
		return
	var ab = AntibodyScript.new()
	var predicted: Vector3 = player.global_position + player.velocity * 0.35
	var dir: Vector3 = (predicted - from_cell.global_position)
	dir.y = 0.0
	if dir.length_squared() < 0.01:
		dir = Vector3.FORWARD
	add_child(ab)
	ab.launch(from_cell.global_position + dir.normalized() * (from_cell.radius + 0.6), dir, player)
	antibodies.append(ab)


func on_antibody_hit(_t, _pos) -> void:
	shake = maxf(shake, 0.1)
	if hud != null and player != null:
		hud.toast(hud.T("被抗体标记 x%d（减速！巨噬细胞正在接近…）" % player.mark_stacks,
			"Marked x%d (slowed! macrophages incoming…)" % player.mark_stacks), 1.4)


# ---------------------------------------------------------------- collisions

func _resolve_collisions() -> void:
	var solids: Array = []
	for c in cells:
		if c.alive:
			solids.append(c)
	for m in macrophages:
		if m.alive:
			solids.append(m)
	for pc in plasma_cells:
		if pc.alive:
			solids.append(pc)
	for v in progeny:
		if v.alive:
			solids.append(v)
	if player != null and player.alive:
		solids.append(player)

	var n := solids.size()
	for i in n:
		for j in range(i + 1, n):
			var a = solids[i]
			var b = solids[j]
			var d := global_dist(a, b)
			var min_d: float = a.radius + b.radius
			if d < min_d and d > 0.0001:
				var push: Vector3 = (b.global_position - a.global_position) / d * ((min_d - d) * 0.5)
				var wa := _movability(a)
				var wb := _movability(b)
				var total := wa + wb
				if total > 0.0:
					a.global_position -= push * (wa / total)
					b.global_position += push * (wb / total)


func _movability(e) -> float:
	if e == null:
		return 0.5
	if e.is_player:
		return 1.0
	if "fire_timer" in e:
		return 0.6 # plasma cell
	if "wander_target" in e:
		return 0.8 # macrophage
	if "lysis_timer" in e:
		return 0.5 # body cell
	return 0.3 # progeny


# ---------------------------------------------------------------- misc updates

func _update_debris(delta: float) -> void:
	for d in debris:
		d.position += flow.velocity_at(d.position) * delta * 1.7
		var r := sqrt(d.position.x * d.position.x + d.position.z * d.position.z)
		if r > ARENA_RADIUS - 1.0:
			var ang := randf() * TAU
			var nr := sqrt(randf()) * (ARENA_RADIUS - 4.0)
			d.position = Vector3(cos(ang) * nr, randf_range(0.2, 5.0), sin(ang) * nr)


func _unhandled_input(event: InputEvent) -> void:
	if event is InputEventMouseButton and event.pressed:
		if event.button_index == MOUSE_BUTTON_WHEEL_UP:
			cam_dist = maxf(14.0, cam_dist - 2.0)
		elif event.button_index == MOUSE_BUTTON_WHEEL_DOWN:
			cam_dist = minf(44.0, cam_dist + 2.0)


func _update_camera(delta: float) -> void:
	var turn := 0.0
	if Input.is_action_pressed("turn_left"):
		turn += 1.0
	if Input.is_action_pressed("turn_right"):
		turn -= 1.0
	cam_yaw += turn * 1.9 * delta

	var focus: Vector3 = player.global_position if (player != null and player.alive) else Vector3.ZERO
	var desired := focus + Vector3(
		sin(cam_yaw) * cos(cam_pitch),
		sin(cam_pitch),
		cos(cam_yaw) * cos(cam_pitch)
	) * cam_dist + Vector3(0, 1.5, 0)

	cam_node.global_position = cam_node.global_position.lerp(desired, 1.0 - exp(-9.0 * delta))
	if shake > 0.0:
		shake = maxf(shake - delta * 1.2, 0.0)
		cam_node.global_position += Vector3(
			randf_range(-1, 1), randf_range(-1, 1), randf_range(-1, 1)
		) * shake * 0.6
	cam_node.look_at(focus + Vector3(0, 1.0, 0), Vector3.UP)


func _update_hud() -> void:
	hud.update_hud(self)
	hud.show_infecting(player_infecting_pct)


func _check_win_lose() -> void:
	if player_hp <= 0:
		game_state = "lose"
		hud.show_end(false, hud.T("感染率：%d%%  存活时间：%ds" % [int(infection_ratio() * 100.0), int(sim_time)],
			"Infection: %d%%  Survived: %ds" % [int(infection_ratio() * 100.0), int(sim_time)]))
		_smoke_report()
	elif converted >= total_cells_count and total_cells_count > 0:
		game_state = "win"
		hud.show_end(true, hud.T("全部 %d 个细胞被感染！用时 %d 秒" % [total_cells_count, int(sim_time)],
			"All %d cells infected in %d s!" % [total_cells_count, int(sim_time)]))
		_smoke_report()


var max_progeny_seen := 0


func _smoke_report() -> void:
	if not smoke_test:
		return
	var ok := converted > 0 and max_progeny_seen > 0
	print("[smoke] RESULT t=", int(sim_time), "s infected=", converted, "/", total_cells_count,
		" max_progeny=", max_progeny_seen, " hp=", player_hp, " state=", game_state, " ok=", ok)
	print("SMOKE_OK" if ok else "SMOKE_FAIL")
	get_tree().quit(0 if ok else 1)
