class_name Arena
extends Node2D
## 竞技场：地图构建、模式逻辑（独狼乱斗 / 宝石争夺）、比赛结算、相机。

signal restart_requested
signal menu_requested

const TILE := 100.0
const FFA_TIME := 180.0
const GEMS_TIME := 240.0
const GEM_TARGET := 10
const GEM_WIN_HOLD := 15.0
# 地图字符：W=墙 B=草丛 C=箱子 L=岩浆 1-6=出生点 .=地面（行自动补齐，边界强制为墙）
# 宝石产出点（两张地图中央均为空地）
const GEM_SPOTS := [
	Vector2(1200, 550), Vector2(1200, 950), Vector2(950, 750), Vector2(1450, 750),
]


class LavaPool:
	extends Area2D
	var pulse := 0.0

	func _ready() -> void:
		collision_layer = 0
		collision_mask = 2
		z_index = -5
		var cs := CollisionShape2D.new()
		var sh := CircleShape2D.new()
		sh.radius = 46.0
		cs.shape = sh
		add_child(cs)
		body_entered.connect(func(body: Node2D):
			if body is Unit:
				body.lava_count += 1)
		body_exited.connect(func(body: Node2D):
			if body is Unit and is_instance_valid(body):
				body.lava_count = maxi(0, body.lava_count - 1))

	func _process(delta: float) -> void:
		pulse += delta * 3.0
		queue_redraw()

	func _draw() -> void:
		var glow := 0.75 + sin(pulse) * 0.25
		draw_circle(Vector2.ZERO, 56.0, Color(1.0, 0.35, 0.05, 0.25 * glow))
		draw_circle(Vector2.ZERO, 46.0, Color(1.0, 0.45, 0.1, 0.85))
		draw_circle(Vector2.ZERO, 34.0, Color(1.0, 0.72, 0.2, 0.9 * glow))
		draw_circle(Vector2.ZERO, 18.0, Color(1.0, 0.9, 0.5, glow))

var mode := "ffa"
var map_key := "grass"
var mdef: Dictionary
var world: Node2D
var bush_layer: Node2D
var camera: Camera2D
var hud: HUD
var units: Array = []
var spawn_points: Array = []        # 全部出生点（FFA 用）
var team_spawns := {0: [], 1: []}   # 左列=0 / 右列=1（宝石模式用）
var time_left := FFA_TIME
var shake := 0.0
var match_over := false
var map_w := 24
var map_h := 15
var wall_tex: Texture2D
var bush_tex: Texture2D

# —— 宝石模式状态 ——
var gem_timer := 3.0
var gems_spawned := 0
var winning_team := -1
var win_countdown := 0.0
# —— Boss / 手感 ——
var boss: Unit = null
var player_streak := 0
# —— 联机 ——
var replica := false        # 客户端影子竞技场：渲染快照，不跑模拟
var net_data := {}          # 服务器发来的 init 数据（仅 replica）
var uid_counter := 1
var unit_map := {}          # net_id -> Unit
var crates: Array = []      # 按建图顺序编号的补给箱
var net_pickups := {}       # pid -> Pickup
var next_pid := 1


func _ready() -> void:
	mode = G.mode
	map_key = G.map
	if replica:
		mode = String(net_data.get("mode", "ffa"))
		map_key = String(net_data.get("map", "grass"))
	if map_key == "random" or not Catalog.MAPS.has(map_key):
		map_key = Catalog.MAPS.keys().pick_random()
	mdef = Catalog.MAPS[map_key]
	time_left = GEMS_TIME if mode == "gems" else FFA_TIME
	if replica:
		time_left = float(net_data.get("tl", time_left))
	map_h = (mdef["rows"] as Array).size()
	wall_tex = load(String(mdef["wall"]))
	bush_tex = load("res://assets/img/bush.png")

	var ground := Sprite2D.new()
	ground.texture = load(String(mdef["ground"]))
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
	if replica:
		_spawn_replicas()
	else:
		_spawn_units()
		for u in units:
			if u.net_id == 0:
				u.net_id = uid_counter
				unit_map[uid_counter] = u
				uid_counter += 1

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
	hud.gem_mode = mode == "gems"
	hud.boss_mode = mode == "boss"
	add_child(hud)
	if mode == "gems":
		hud.announce("宝石争夺！收集 %d 颗宝石并坚守！" % GEM_TARGET, 1.6)
	elif mode == "boss":
		hud.announce("魔王·雪烬 降临！全员出击！", 1.6)
	else:
		hud.announce("战斗开始！", 1.2)
	G.play_sfx("start")


func _build_map() -> void:
	var rows: Array = mdef["rows"]
	for y in range(map_h):
		var row: String = rows[y]
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
				"L":
					var lv := LavaPool.new()
					add_child(lv)
					lv.global_position = pos
				"C":
					var c := Crate.new()
					c.ci = crates.size()
					crates.append(c)
					world.add_child(c)
					c.global_position = pos
				"1", "3", "5":
					spawn_points.append(pos)
					team_spawns[0].append(pos)
				"2", "4", "6":
					spawn_points.append(pos)
					team_spawns[1].append(pos)


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
	var char_keys := Catalog.CHARS.keys()
	var weapon_keys := Catalog.WEAPONS.keys()
	var skill_keys := Catalog.SKILLS.keys()
	var item_keys := Catalog.ITEMS.keys()
	var ult_keys := Catalog.ULTS.keys()
	var bot_names := Catalog.BOT_NAMES.duplicate()
	bot_names.shuffle()

	if mode == "boss":
		# 全员 (队伍0) vs 魔王 (队伍1)
		var pts: Array = spawn_points.duplicate()
		pts.shuffle()
		if Net.is_server():
			_spawn_bot_at(bot_names[6], 0, pts[0])
		else:
			var player3 := Player.new()
			world.add_child(player3)
			player3.setup(self, G.loadout, "你 · " + String(Catalog.CHARS[G.loadout["chara"]]["name"]), true, 0)
			player3.global_position = pts[0]
			player3.died.connect(_on_unit_died)
			units.append(player3)
			G.player = player3
		for i in range(5):
			var ally := Bot.new()
			world.add_child(ally)
			var alo := {
				"chara": char_keys.pick_random(),
				"weapon": weapon_keys.pick_random(),
				"skill": skill_keys.pick_random(),
				"item": item_keys.pick_random(),
				"ult": ult_keys.pick_random(),
			}
			ally.setup(self, alo, bot_names[i], false, 0)
			ally.global_position = pts[(i + 1) % pts.size()]
			ally.died.connect(_on_unit_died)
			units.append(ally)
		var b := Boss.new()
		world.add_child(b)
		b.setup(self, {
			"chara": "violet", "weapon": "shotgun", "skill": "nova",
			"item": "amulet", "ult": "meteor",
		}, "魔王·雪烬", false, 1)
		var far_pt: Vector2 = pts[0]
		var far_d := -1.0
		for p in spawn_points:
			var d: float = (p as Vector2).distance_to(pts[0])
			if d > far_d:
				far_d = d
				far_pt = p
		b.global_position = far_pt
		b.make_boss()
		b.died.connect(_on_unit_died)
		units.append(b)
		boss = b
		for u in units:
			u.refresh_relation()
		return

	if mode == "gems":
		# 3v3：玩家 + 2 队友 (队伍0) vs 3 敌人 (队伍1)
		var home: Array = team_spawns[0].duplicate()
		home.shuffle()
		var away: Array = team_spawns[1].duplicate()
		away.shuffle()

		if Net.is_server():
			_spawn_bot_at(bot_names[6], 0, home[0])
		else:
			var player := Player.new()
			world.add_child(player)
			player.setup(self, G.loadout, "你 · " + String(Catalog.CHARS[G.loadout["chara"]]["name"]), true, 0)
			player.global_position = home[0]
			player.died.connect(_on_unit_died)
			units.append(player)
			G.player = player

		for i in range(5):
			var bot := Bot.new()
			world.add_child(bot)
			var lo := {
				"chara": char_keys.pick_random(),
				"weapon": weapon_keys.pick_random(),
				"skill": skill_keys.pick_random(),
				"item": item_keys.pick_random(),
				"ult": ult_keys.pick_random(),
			}
			var bteam := 0 if i < 2 else 1
			bot.setup(self, lo, bot_names[i], false, bteam)
			if bteam == 0:
				bot.global_position = home[(i + 1) % home.size()]
			else:
				bot.global_position = away[(i - 2) % away.size()]
			bot.died.connect(_on_unit_died)
			units.append(bot)
	else:
		# FFA：每人独立队伍
		var points := spawn_points.duplicate()
		points.shuffle()
		if points.is_empty():
			points = [Vector2(300, 300)]

		if Net.is_server():
			_spawn_bot_at(bot_names[6], 0, points[0])
		else:
			var player2 := Player.new()
			world.add_child(player2)
			player2.setup(self, G.loadout, "你 · " + String(Catalog.CHARS[G.loadout["chara"]]["name"]), true, 0)
			player2.global_position = points[0]
			player2.died.connect(_on_unit_died)
			units.append(player2)
			G.player = player2

		for i in range(5):
			var bot2 := Bot.new()
			world.add_child(bot2)
			var lo2 := {
				"chara": char_keys.pick_random(),
				"weapon": weapon_keys.pick_random(),
				"skill": skill_keys.pick_random(),
				"item": item_keys.pick_random(),
				"ult": ult_keys.pick_random(),
			}
			bot2.setup(self, lo2, bot_names[i], false, i + 1)
			bot2.global_position = points[(i + 1) % points.size()]
			bot2.died.connect(_on_unit_died)
			units.append(bot2)

	for u in units:
		u.refresh_relation()


func _process(delta: float) -> void:
	if match_over:
		return
	time_left -= delta
	hud.set_time(time_left)
	if G.player != null and is_instance_valid(G.player):
		camera.position = G.player.global_position
	shake = maxf(0.0, shake - 40.0 * delta) * exp(-6.0 * delta)
	camera.offset = Vector2(randf_range(-1, 1), randf_range(-1, 1)) * shake

	if replica:
		# 影子竞技场：计时与计分来自服务器快照，只负责展示
		time_left = maxf(0.0, time_left)
		if hud.gem_mode:
			hud.set_gems(team_gems(0), team_gems(1))
		if hud.boss_mode and boss != null and is_instance_valid(boss):
			hud.set_boss_hp(boss.hp, boss.max_hp)
		return

	if mode == "gems":
		_process_gems(delta)
		if time_left <= 0.0:
			var b := team_gems(0)
			var r := team_gems(1)
			if b == r:
				_end_match(-1)
			else:
				_end_match(0 if b > r else 1)
	elif mode == "boss":
		if boss != null and is_instance_valid(boss):
			hud.set_boss_hp(boss.hp, boss.max_hp)
		if time_left <= 0.0:
			_end_match(1)
	else:
		if time_left <= 0.0:
			_end_match(-1)


func _process_gems(delta: float) -> void:
	# 产出宝石
	if gems_spawned < 22:
		gem_timer -= delta
		if gem_timer <= 0.0:
			gem_timer = 6.0
			gems_spawned += 1
			var spot: Vector2 = GEM_SPOTS[randi() % GEM_SPOTS.size()]
			spot += Vector2(randf_range(-40, 40), randf_range(-40, 40))
			spawn_pickup(spot, "gem")
			FX.ring(self, spot, 50.0, Color(0.35, 0.95, 0.9), 0.5)
			G.play_sfx("pickup", spot, -10.0)

	var blue := team_gems(0)
	var red := team_gems(1)
	hud.set_gems(blue, red)

	var leader := -1
	if blue >= GEM_TARGET and blue >= red:
		leader = 0
	elif red >= GEM_TARGET and red > blue:
		leader = 1

	if leader == -1:
		if winning_team != -1:
			winning_team = -1
			hud.set_status("")
	else:
		if winning_team != leader:
			winning_team = leader
			win_countdown = GEM_WIN_HOLD
			hud.announce("%s即将获胜！" % ("蓝队" if leader == 0 else "红队"), 1.2)
		win_countdown -= delta
		var tname := "蓝队" if leader == 0 else "红队"
		hud.set_status("%s 坚守中… %d" % [tname, int(ceilf(win_countdown))])
		if win_countdown <= 0.0:
			_end_match(leader)


func team_gems(t: int) -> int:
	var total := 0
	for u in units:
		if is_instance_valid(u) and u.team == t:
			total += u.gems
	return total


func add_shake(s: float) -> void:
	shake = minf(shake + s, 18.0)


func explode(pos: Vector2, radius: float, damage: float, source: Unit, col: Color) -> void:
	## 通用范围爆炸（流星等），在非物理回调时机调用
	FX.ring(self, pos, radius, col, 0.4, true)
	FX.burst(self, pos, col, 20, 360.0)
	G.play_sfx("boom", pos, -4.0)
	if source != null and is_instance_valid(source) and source.is_player_unit:
		add_shake(6.0)
	for u in units:
		if not is_instance_valid(u) or not u.alive:
			continue
		if source != null and is_instance_valid(source) and (u == source or u.team == source.team):
			continue
		if u.global_position.distance_to(pos) <= radius:
			u.take_damage(damage, source)
			u.kb_vel = (u.global_position - pos).normalized() * 280.0
	for c in world.get_children():
		if c is Crate and c.global_position.distance_to(pos) <= radius:
			(c as Crate).take_damage(damage, source)


func spawn_temp_wall(pos: Vector2, dur: float) -> void:
	# 不在单位身上召唤，避免卡住
	for u in units:
		if is_instance_valid(u) and u.alive and u.global_position.distance_to(pos) < 60.0:
			return
	var w := StaticBody2D.new()
	w.collision_layer = 1
	w.collision_mask = 0
	var cs := CollisionShape2D.new()
	var sh := RectangleShape2D.new()
	sh.size = Vector2(80, 70)
	cs.shape = sh
	w.add_child(cs)
	var s := Sprite2D.new()
	s.texture = wall_tex
	s.scale = Vector2(0.5, 0.5)
	s.offset = Vector2(0, -22)
	s.modulate = Color(0.95, 0.9, 0.8)
	w.add_child(s)
	world.add_child(w)
	w.global_position = pos
	FX.burst(self, pos, Color(0.8, 0.75, 0.6), 10, 200.0)
	var tw := w.create_tween()
	tw.tween_interval(dur - 0.4)
	tw.tween_property(s, "modulate:a", 0.0, 0.4)
	tw.tween_callback(w.queue_free)


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
	p.pid = next_pid
	next_pid += 1
	net_pickups[p.pid] = p
	add_child(p)
	p.global_position = pos
	Net.ev_pk_add(p)


func on_pickup_taken(p: Node) -> void:
	net_pickups.erase(p.pid)
	Net.ev_pk_gone(p.pid, true)


func _on_unit_died(unit: Unit, killer: Unit) -> void:
	Net.ev_die(unit, killer)
	if killer != null and is_instance_valid(killer) and killer != unit:
		killer.kills += 1
		if killer.is_player_unit:
			hud.killfeed("你 击败了 %s！" % unit.display_name)
			notify_player_kill(unit.display_name)
		elif unit.is_player_unit:
			hud.killfeed("%s 击败了 你" % killer.display_name)
		else:
			hud.killfeed("%s 击败了 %s" % [killer.display_name, unit.display_name])
		_check_upgrades(killer)
	if unit.is_player_unit:
		add_shake(10.0)
		player_streak = 0
	# Boss 战：魔王被击破 → 讨伐成功
	if mode == "boss" and unit.is_boss:
		_end_match(0)
		return
	# 宝石模式：死亡掉落全部宝石
	if mode == "gems" and unit.gems > 0:
		var n: int = unit.gems
		unit.gems = 0
		for i in range(n):
			var ang := TAU * float(i) / float(n) + randf_range(-0.3, 0.3)
			var dist := randf_range(30.0, 85.0)
			spawn_pickup(unit.global_position + Vector2.from_angle(ang) * dist, "gem")
	if match_over or unit.is_boss:
		return
	var t := get_tree().create_timer(2.5)
	t.timeout.connect(func():
		if match_over or not is_instance_valid(unit) or unit.alive:
			return
		unit.respawn(_best_spawn(unit)))


func _check_upgrades(killer: Unit) -> void:
	## 每 2 击杀触发一次三选一强化；AI 自动随机选
	while killer.kills >= killer.next_upgrade_kills:
		killer.next_upgrade_kills += 2
		var pool := Catalog.UPGRADES.keys()
		pool.shuffle()
		var options: Array = pool.slice(0, 3)
		if killer.is_player_unit:
			hud.offer_upgrades(options)
		elif killer.is_remote:
			Net.ev_offer(killer.peer_id, options)
		else:
			killer.apply_upgrade(options[0])


func notify_player_kill(victim_name: String) -> void:
	## 本机玩家击杀的爽感反馈：慢动作 + 连杀播报（联机时由客户端调用）
	_slowmo(0.25, 0.14)
	player_streak += 1
	if player_streak >= 2:
		var streak_names := {2: "双杀！", 3: "三连击！", 4: "四连超凡！"}
		var sname: String = streak_names.get(player_streak, "无人能挡！！")
		hud.announce(sname, 1.0)
		G.play_sfx("streak", null, -4.0, 0.02)
	else:
		hud.announce("击败 %s！" % victim_name, 0.8)


func _slowmo(scale: float, dur: float) -> void:
	Engine.time_scale = scale
	var t := get_tree().create_timer(dur, true, false, true)
	t.timeout.connect(func():
		Engine.time_scale = 1.0)


func _best_spawn(unit: Unit) -> Vector2:
	var candidates: Array = spawn_points
	if mode == "gems":
		candidates = team_spawns[unit.team]
	var best := Vector2(TILE * 2, TILE * 2)
	var best_score := -1.0
	for p in candidates:
		var min_d := 99999.0
		for u in units:
			if u == unit or not is_instance_valid(u) or not u.alive or u.team == unit.team:
				continue
			min_d = minf(min_d, (p as Vector2).distance_to(u.global_position))
		if min_d > best_score:
			best_score = min_d
			best = p
	return best


func _end_match(winner := -1) -> void:
	match_over = true
	Engine.time_scale = 1.0
	hud.set_status("")
	var title := ""
	var ranking := units.duplicate()
	if mode == "boss":
		ranking.erase(boss)
		ranking.sort_custom(func(a, b):
			return a.dmg_dealt > b.dmg_dealt)
		if winner == 0:
			title = "讨 伐 成 功 ！"
			hud.announce("魔王被击破！", 2.0)
		else:
			title = "讨 伐 失 败 …"
			hud.announce("时间耗尽，魔王扬长而去…", 2.0)
	elif mode == "gems":
		ranking.sort_custom(func(a, b):
			if a.gems == b.gems:
				return a.kills > b.kills
			return a.gems > b.gems)
	var my_team := 0
	if G.player != null and is_instance_valid(G.player):
		my_team = G.player.team
	if mode == "gems":
		if winner == -1:
			title = "平局！"
			hud.announce("时间到，平局！", 2.0)
		elif winner == my_team:
			title = "胜 利 ！"
			hud.announce("蓝队胜利！", 2.0)
		else:
			title = "惜 败 …"
			hud.announce("红队获得了宝石…", 2.0)
	elif mode != "boss":
		ranking.sort_custom(func(a, b):
			if a.kills == b.kills:
				return a.deaths < b.deaths
			return a.kills > b.kills)
		title = "— 战斗结束 —"
		if G.player != null and is_instance_valid(G.player):
			hud.announce("时间到！你排名第 %d" % (ranking.find(G.player) + 1), 2.0)
		else:
			hud.announce("时间到！", 2.0)
	G.play_sfx("death", null, -6.0)

	var lines: Array = []
	var rows: Array = []
	for i in range(ranking.size()):
		var u: Node = ranking[i]
		var medal: String = ["①", "②", "③", "④", "⑤", "⑥"][mini(i, 5)]
		var text := ""
		if mode == "gems":
			var side := "蓝" if u.team == my_team else "红"
			text = "%s [%s] %s — 宝石×%d / %d 击杀" % [medal, side, u.display_name, u.gems, u.kills]
		elif mode == "boss":
			text = "%s  %s — 输出 %d" % [medal, u.display_name, int(u.dmg_dealt)]
		else:
			text = "%s  %s — %d 击杀 / %d 阵亡" % [medal, u.display_name, u.kills, u.deaths]
		lines.append({"text": text, "highlight": u.is_player_unit})
		rows.append([u.net_id, text])
	Net.ev_end(title, rows)

	if Net.is_server():
		# 专用服务器：展示结算 8 秒后自动开新一局
		var rt := get_tree().create_timer(8.0)
		rt.timeout.connect(func():
			get_tree().paused = false
			restart_requested.emit())
	get_tree().paused = true
	hud.show_results(title, lines,
		func():
			get_tree().paused = false
			restart_requested.emit(),
		func():
			get_tree().paused = false
			menu_requested.emit())


# ══════════════════ 联机：服务器侧 ══════════════════

func _rand_loadout() -> Dictionary:
	return {
		"chara": Catalog.CHARS.keys().pick_random(),
		"weapon": Catalog.WEAPONS.keys().pick_random(),
		"skill": Catalog.SKILLS.keys().pick_random(),
		"item": Catalog.ITEMS.keys().pick_random(),
		"ult": Catalog.ULTS.keys().pick_random(),
	}


func _spawn_bot_at(bname: String, bteam: int, pos: Vector2) -> Bot:
	var b := Bot.new()
	world.add_child(b)
	b.setup(self, _rand_loadout(), bname, false, bteam)
	b.global_position = pos
	b.died.connect(_on_unit_died)
	units.append(b)
	return b


func add_remote_player(p_peer: int, pname: String, lo: Dictionary) -> Unit:
	## 远程玩家加入：优先顶替一名 AI（继承其队伍与位置）
	var victim: Unit = null
	for u in units:
		if is_instance_valid(u) and u is Bot and not u.is_boss:
			victim = u
			break
	var team := 0
	var pos: Vector2 = spawn_points.pick_random() if not spawn_points.is_empty() else Vector2(300, 300)
	if victim != null:
		team = victim.team
		pos = victim.global_position
		units.erase(victim)
		unit_map.erase(victim.net_id)
		victim.queue_free()
	elif mode == "ffa":
		team = 50 + units.size()
	var ru := Unit.new()
	world.add_child(ru)
	ru.setup(self, lo, pname, false, team)
	ru.is_remote = true
	ru.peer_id = p_peer
	ru.global_position = pos
	ru.died.connect(_on_unit_died)
	units.append(ru)
	ru.net_id = uid_counter
	unit_map[uid_counter] = ru
	uid_counter += 1
	for u in units:
		if is_instance_valid(u):
			u.refresh_relation()
	hud.killfeed("%s 加入了战斗！" % pname)
	return ru


func remove_net_unit(u: Unit) -> void:
	units.erase(u)
	unit_map.erase(u.net_id)
	u.queue_free()


# ══════════════════ 联机：客户端影子 ══════════════════

func _spawn_replicas() -> void:
	for ud in net_data.get("units", []):
		var uid := int(ud["i"])
		var mine := uid == Net.my_uid
		var u: Unit
		if mine:
			u = Player.new()
		else:
			u = Unit.new()
		u.replica = true
		world.add_child(u)
		u.setup(self, ud["lo"], String(ud["n"]), mine, int(ud["tm"]))
		u.net_id = uid
		unit_map[uid] = u
		u.global_position = Vector2(float(ud["x"]), float(ud["y"]))
		u.net_pos = u.global_position
		u.max_hp = float(ud["mh"])
		u.hp = float(ud["hp"])
		if bool(ud.get("bo", false)):
			u.apply_boss_visuals()
			boss = u
		if not bool(ud.get("al", true)):
			net_die_fx(u, false)
		units.append(u)
		if mine:
			G.player = u
	for u in units:
		u.refresh_relation()
	for ci in net_data.get("cg", []):
		net_crate_break(int(ci), false)
	for pk in net_data.get("pks", []):
		net_pickup_add(pk)


func net_crate_break(ci: int, fx := true) -> void:
	if ci < 0 or ci >= crates.size():
		return
	var c = crates[ci]  # 可能已释放
	if c == null or not is_instance_valid(c):
		return
	if fx:
		c.break_fx()
	c.queue_free()


func net_pickup_add(d: Dictionary) -> void:
	var pid := int(d.get("p", -1))
	if pid < 0 or net_pickups.has(pid):
		return
	var p := Pickup.new()
	p.kind = String(d.get("k", "heal"))
	p.pid = pid
	p.inert = true
	net_pickups[pid] = p
	add_child(p)
	p.global_position = Vector2(float(d.get("x", 0)), float(d.get("y", 0)))


func net_pickup_gone(pid: int, taken: bool) -> void:
	var p = net_pickups.get(pid)
	net_pickups.erase(pid)
	if p == null or not is_instance_valid(p):
		return
	if taken:
		G.play_sfx("pickup", p.global_position, -5.0)
		FX.ring(self, p.global_position, 40.0, Color(1, 1, 1, 0.8), 0.3)
	p.queue_free()


func net_die_fx(u: Unit, fx := true) -> void:
	u.alive = false
	u.hp = 0.0
	u.shield = 0.0
	u.set_deferred("collision_layer", 0)
	u.set_deferred("collision_mask", 0)
	u.sprite.visible = false
	u.info.visible = false
	u.name_label.visible = false
	if fx:
		FX.burst(self, u.global_position, u.chara_tint, 26, 380.0)
		FX.ring(self, u.global_position, 90.0, u.chara_tint, 0.45)
		G.play_sfx("death", u.global_position, -2.0)


func net_end(d: Dictionary) -> void:
	match_over = true
	Engine.time_scale = 1.0
	hud.set_status("")
	var lines: Array = []
	for row in d.get("rows", []):
		lines.append({"text": String(row[1]), "highlight": int(row[0]) == Net.my_uid})
	hud.show_results(String(d.get("ti", "— 战斗结束 —")), lines, _net_back, _net_back)


func _net_back() -> void:
	menu_requested.emit()
