class_name Arena
extends Node2D
## 竞技场：地图构建、生成玩家与 AI、比赛计时与结算、相机跟随与震屏。

signal restart_requested
signal menu_requested

const TILE := 100.0
const MATCH_TIME := 180.0
# 地图：W=墙 B=草丛 C=箱子 1-6=出生点 .=地面（行自动补齐，边界强制为墙）
const MAP := [
	"WWWWWWWWWWWWWWWWWWWWWWWW",
	"W1....B........B.....2.W",
	"W..BB...C..WW..C..BB...W",
	"W......W........W......W",
	"W..C...W..BBBB..W..C...W",
	"W......................W",
	"W.BB..WW..C..C..WW..BB.W",
	"W3.........WW.........4W",
	"W.BB..WW..C..C..WW..BB.W",
	"W......................W",
	"W..C...W..BBBB..W..C...W",
	"W......W........W......W",
	"W..BB...C..WW..C..BB...W",
	"W5....B........B.....6.W",
	"WWWWWWWWWWWWWWWWWWWWWWWW",
]

var world: Node2D
var bush_layer: Node2D
var camera: Camera2D
var hud: HUD
var units: Array = []
var spawn_points: Array = []
var time_left := MATCH_TIME
var shake := 0.0
var match_over := false
var map_w := 24
var map_h := 15
var wall_tex: Texture2D
var bush_tex: Texture2D


func _ready() -> void:
	map_h = MAP.size()
	wall_tex = load("res://assets/img/wall.png")
	bush_tex = load("res://assets/img/bush.png")

	var ground := Sprite2D.new()
	ground.texture = load("res://assets/img/grass_tile.png")
	ground.texture_repeat = CanvasItem.TEXTURE_REPEAT_ENABLED
	ground.region_enabled = true
	ground.region_rect = Rect2(0, 0, map_w * TILE, map_h * TILE)
	ground.centered = false
	ground.z_index = -10
	add_child(ground)

	world = Node2D.new()
	world.y_sort_enabled = true
	add_child(world)
	bush_layer = Node2D.new()
	bush_layer.z_index = 3
	add_child(bush_layer)

	_build_map()
	_spawn_units()

	camera = Camera2D.new()
	camera.position_smoothing_enabled = true
	camera.position_smoothing_speed = 7.0
	camera.limit_left = 0
	camera.limit_top = 0
	camera.limit_right = int(map_w * TILE)
	camera.limit_bottom = int(map_h * TILE)
	camera.zoom = Vector2(0.9, 0.9)
	add_child(camera)
	if G.player != null:
		camera.position = G.player.global_position
	camera.make_current()

	hud = HUD.new()
	add_child(hud)
	hud.announce("战斗开始！", 1.2)
	G.play_sfx("start")


func _build_map() -> void:
	for y in range(map_h):
		var row: String = MAP[y]
		for x in range(map_w):
			var ch := "."
			if x < row.length():
				ch = row[x]
			if x == 0 or y == 0 or x == map_w - 1 or y == map_h - 1:
				ch = "W"
			var pos := Vector2((x + 0.5) * TILE, (y + 0.5) * TILE)
			match ch:
				"W":
					_add_wall(pos)
				"B":
					_add_bush(pos)
				"C":
					var c := Crate.new()
					world.add_child(c)
					c.global_position = pos
				"1", "2", "3", "4", "5", "6":
					spawn_points.append(pos)


func _add_wall(pos: Vector2) -> void:
	var w := StaticBody2D.new()
	w.collision_layer = 1
	w.collision_mask = 0
	var cs := CollisionShape2D.new()
	var sh := RectangleShape2D.new()
	sh.size = Vector2(TILE, TILE)
	cs.shape = sh
	w.add_child(cs)
	var s := Sprite2D.new()
	s.texture = wall_tex
	s.scale = Vector2(0.62, 0.62)
	s.offset = Vector2(0, -22)
	w.add_child(s)
	world.add_child(w)
	w.global_position = pos


func _add_bush(pos: Vector2) -> void:
	var b := Area2D.new()
	b.collision_layer = 4
	b.collision_mask = 2
	var cs := CollisionShape2D.new()
	var sh := CircleShape2D.new()
	sh.radius = 52.0
	cs.shape = sh
	b.add_child(cs)
	var s := Sprite2D.new()
	s.texture = bush_tex
	s.scale = Vector2(0.62, 0.62)
	b.add_child(s)
	b.body_entered.connect(func(body: Node2D):
		if body is Unit:
			body.bush_count += 1)
	b.body_exited.connect(func(body: Node2D):
		if body is Unit and is_instance_valid(body):
			body.bush_count = maxi(0, body.bush_count - 1))
	bush_layer.add_child(b)
	b.global_position = pos + Vector2(randf_range(-6, 6), randf_range(-6, 6))


func _spawn_units() -> void:
	var points := spawn_points.duplicate()
	points.shuffle()
	if points.is_empty():
		points = [Vector2(300, 300)]

	var player := Player.new()
	world.add_child(player)
	player.setup(self, G.loadout, "你 · " + String(Catalog.CHARS[G.loadout["chara"]]["name"]), true)
	player.global_position = points[0]
	player.died.connect(_on_unit_died)
	units.append(player)
	G.player = player

	var char_keys := Catalog.CHARS.keys()
	var weapon_keys := Catalog.WEAPONS.keys()
	var skill_keys := Catalog.SKILLS.keys()
	var item_keys := Catalog.ITEMS.keys()
	for i in range(5):
		var bot := Bot.new()
		world.add_child(bot)
		var lo := {
			"chara": char_keys.pick_random(),
			"weapon": weapon_keys.pick_random(),
			"skill": skill_keys.pick_random(),
			"item": item_keys.pick_random(),
		}
		bot.setup(self, lo, Catalog.BOT_NAMES[i % Catalog.BOT_NAMES.size()], false)
		bot.global_position = points[(i + 1) % points.size()]
		bot.died.connect(_on_unit_died)
		units.append(bot)


func _process(delta: float) -> void:
	if match_over:
		return
	time_left -= delta
	hud.set_time(time_left)
	if G.player != null and is_instance_valid(G.player):
		camera.position = G.player.global_position
	shake = maxf(0.0, shake - 40.0 * delta) * exp(-6.0 * delta)
	camera.offset = Vector2(randf_range(-1, 1), randf_range(-1, 1)) * shake
	if time_left <= 0.0:
		_end_match()


func add_shake(s: float) -> void:
	shake = minf(shake + s, 18.0)


func random_point() -> Vector2:
	for _i in range(24):
		var p := Vector2(randf_range(1.5, map_w - 1.5) * TILE, randf_range(1.5, map_h - 1.5) * TILE)
		var sp := get_world_2d().direct_space_state
		var q := PhysicsPointQueryParameters2D.new()
		q.position = p
		q.collision_mask = 1
		if sp.intersect_point(q, 1).is_empty():
			return p
	return Vector2(map_w * TILE / 2.0, map_h * TILE / 2.0)


func spawn_pickup(pos: Vector2, kind: String) -> void:
	# 可能在物理回调中被调用，延迟到安全时机再生成
	_spawn_pickup_deferred.call_deferred(pos, kind)


func _spawn_pickup_deferred(pos: Vector2, kind: String) -> void:
	if match_over or not is_inside_tree():
		return
	var p := Pickup.new()
	p.kind = kind
	add_child(p)
	p.global_position = pos


func _on_unit_died(unit: Unit, killer: Unit) -> void:
	if killer != null and is_instance_valid(killer) and killer != unit:
		killer.kills += 1
		if killer.is_player_unit:
			hud.killfeed("你 击败了 %s！" % unit.display_name)
			hud.announce("击败 %s！" % unit.display_name, 0.8)
		elif unit.is_player_unit:
			hud.killfeed("%s 击败了 你" % killer.display_name)
		else:
			hud.killfeed("%s 击败了 %s" % [killer.display_name, unit.display_name])
	if unit.is_player_unit:
		add_shake(10.0)
	if match_over:
		return
	var t := get_tree().create_timer(2.5)
	t.timeout.connect(func():
		if match_over or not is_instance_valid(unit) or unit.alive:
			return
		unit.respawn(_best_spawn(unit)))


func _best_spawn(unit: Unit) -> Vector2:
	var best := Vector2(TILE * 2, TILE * 2)
	var best_score := -1.0
	for p in spawn_points:
		var min_d := 99999.0
		for u in units:
			if u == unit or not is_instance_valid(u) or not u.alive:
				continue
			min_d = minf(min_d, (p as Vector2).distance_to(u.global_position))
		if min_d > best_score:
			best_score = min_d
			best = p
	return best


func _end_match() -> void:
	match_over = true
	var ranking := units.duplicate()
	ranking.sort_custom(func(a, b):
		if a.kills == b.kills:
			return a.deaths < b.deaths
		return a.kills > b.kills)
	var player_rank := ranking.find(G.player) + 1
	hud.announce("时间到！你排名第 %d" % player_rank, 2.0)
	G.play_sfx("death", null, -6.0)
	get_tree().paused = true
	hud.show_results(ranking,
		func():
			get_tree().paused = false
			restart_requested.emit(),
		func():
			get_tree().paused = false
			menu_requested.emit())
