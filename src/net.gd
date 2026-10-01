extends Node
## 联机模块（服务器权威架构）：
## · 服务器跑完整模拟（含 AI），客户端只发送「意图」(移动/瞄准/开火/技能/必杀)。
## · 服务器以 20Hz 广播状态快照，关键动作（开火/技能/死亡…）走可靠事件。
## · 传输层 WebSocket —— 原生与 Web 导出通用。

signal init_received(data: Dictionary)
signal status_changed(text: String)
signal dropped

const PORT := 9090
const SNAP_EVERY := 3   # 物理帧间隔 → 20Hz 快照
const SEND_EVERY := 2   # 客户端 30Hz 意图

var role := ""          # "" / "server" / "client"
var arena: Node2D = null
var peers := {}         # 服务器：peer_id -> {n, lo, unit}
var my_uid := -1
var tick := 0
var last_stat := ""
var stat_ms := 0
# —— 联机冒烟测试（--netsmoke）——
var smoke := false
var smoke_done := false
var smoke_t := 0.0
var smoke_maxd := 0.0
var spawn_pos := Vector2.ZERO
var snap_count := 0
var fire_count := 0


func _ready() -> void:
	process_mode = Node.PROCESS_MODE_ALWAYS
	multiplayer.peer_connected.connect(_on_peer_connected)
	multiplayer.peer_disconnected.connect(_on_peer_disconnected)
	multiplayer.connected_to_server.connect(_on_connected)
	multiplayer.connection_failed.connect(_on_conn_failed)
	multiplayer.server_disconnected.connect(_on_server_closed)
	(multiplayer as SceneMultiplayer).peer_packet.connect(_on_packet)


func is_server() -> bool:
	return role == "server"


func is_client() -> bool:
	return role == "client"


func host(port := PORT) -> bool:
	var p := WebSocketMultiplayerPeer.new()
	var err := p.create_server(port, "0.0.0.0")
	if err != OK:
		push_error("NET host failed: %s" % err)
		return false
	multiplayer.multiplayer_peer = p
	role = "server"
	print("NET server listening on :", port)
	return true


func join(url: String) -> void:
	leave()
	var p := WebSocketMultiplayerPeer.new()
	var err := p.create_client(url)
	if err != OK:
		status_changed.emit("连接失败（地址无效）")
		return
	multiplayer.multiplayer_peer = p
	role = "client"
	status_changed.emit("连接中… " + url)
	print("NET joining ", url)


func leave() -> void:
	if multiplayer.multiplayer_peer != null and role != "":
		multiplayer.multiplayer_peer = null
	role = ""
	arena = null
	peers.clear()
	my_uid = -1
	last_stat = ""


func _physics_process(_delta: float) -> void:
	tick += 1
	if role == "server":
		if arena != null and is_instance_valid(arena) and tick % SNAP_EVERY == 0:
			_broadcast_snapshot()
	elif role == "client":
		if arena != null and is_instance_valid(arena) and tick % SEND_EVERY == 0:
			var mp := multiplayer.multiplayer_peer
			if mp != null and mp.get_connection_status() == MultiplayerPeer.CONNECTION_CONNECTED:
				_send_intents()


# ══════════════════ 底层收发 ══════════════════

func _send(d: Dictionary, id := 0, reliable := true) -> void:
	if multiplayer.multiplayer_peer == null or multiplayer.get_peers().is_empty():
		return
	var mode := MultiplayerPeer.TRANSFER_MODE_RELIABLE if reliable \
		else MultiplayerPeer.TRANSFER_MODE_UNRELIABLE_ORDERED
	(multiplayer as SceneMultiplayer).send_bytes(var_to_bytes(d), id, mode)


func _on_packet(from_id: int, bytes: PackedByteArray) -> void:
	var d: Variant = bytes_to_var(bytes)
	if typeof(d) != TYPE_DICTIONARY:
		return
	if role == "server":
		_server_packet(from_id, d)
	elif role == "client":
		_client_packet(d)


func _on_peer_connected(id: int) -> void:
	if role == "server":
		print("NET peer connected: ", id)


func _on_peer_disconnected(id: int) -> void:
	if role != "server":
		return
	var info: Dictionary = peers.get(id, {})
	peers.erase(id)
	if info.is_empty():
		return
	var u = info.get("unit")
	if u != null and is_instance_valid(u) and arena != null and is_instance_valid(arena):
		arena.remove_net_unit(u)
		ev_feed("%s 离开了战斗" % info["n"])
	print("NET peer left: ", id)


func _on_connected() -> void:
	status_changed.emit("已连接，等待加入战斗…")
	_send({"t": "hi", "n": G.player_name, "lo": G.loadout}, 1)


func _on_conn_failed() -> void:
	leave()
	status_changed.emit("连接失败：无法连上服务器")
	if smoke and not smoke_done:
		smoke_done = true
		print("NETSMOKE_FAIL connect")
		get_tree().quit(1)


func _on_server_closed() -> void:
	leave()
	status_changed.emit("与服务器断开")
	dropped.emit()


# ══════════════════ 服务器侧 ══════════════════

func attach_arena(a: Node2D) -> void:
	arena = a
	for id in peers:
		_spawn_peer(id)


func _server_packet(id: int, d: Dictionary) -> void:
	var t := String(d.get("t", ""))
	if t == "hi":
		var pname := String(d.get("n", "玩家")).left(12)
		if pname.strip_edges() == "":
			pname = "玩家%d" % (id % 1000)
		peers[id] = {"n": pname, "lo": _sanitize_loadout(d.get("lo", {})), "unit": null}
		if arena != null and is_instance_valid(arena):
			_spawn_peer(id)
		return
	var info: Dictionary = peers.get(id, {})
	if info.is_empty():
		return
	var u = info.get("unit")
	if u == null or not is_instance_valid(u):
		return
	if t == "in":
		u.move_input = Vector2(float(d.get("mx", 0)), float(d.get("my", 0))).limit_length(1.0)
		u.aim_point = Vector2(float(d.get("px", 0)), float(d.get("py", 0)))
		var ad := Vector2(float(d.get("ax", 0)), float(d.get("ay", 0)))
		if ad.length() > 0.1:
			u.aim_dir = ad.normalized()
		u.want_fire = bool(d.get("f", false))
		if bool(d.get("sk", false)):
			u.want_skill = true
		if bool(d.get("ul", false)):
			u.want_ult = true
	elif t == "up":
		var k := String(d.get("k", ""))
		if Catalog.UPGRADES.has(k):
			u.apply_upgrade(k)


func _spawn_peer(id: int) -> void:
	var info: Dictionary = peers[id]
	var u: Node = arena.add_remote_player(id, info["n"], info["lo"])
	info["unit"] = u
	_send(_build_init(u.net_id), id)


func _sanitize_loadout(lo: Variant) -> Dictionary:
	var src: Dictionary = lo if typeof(lo) == TYPE_DICTIONARY else {}
	var out := {}
	var tables := {
		"chara": Catalog.CHARS, "weapon": Catalog.WEAPONS, "skill": Catalog.SKILLS,
		"item": Catalog.ITEMS, "ult": Catalog.ULTS,
	}
	for slot in tables:
		var k := String(src.get(slot, ""))
		out[slot] = k if (tables[slot] as Dictionary).has(k) else (tables[slot] as Dictionary).keys()[0]
	return out


func _build_init(for_uid: int) -> Dictionary:
	var us: Array = []
	for u in arena.units:
		if u == null or not is_instance_valid(u):
			continue
		us.append({
			"i": u.net_id, "n": u.display_name, "lo": u.loadout_src, "tm": u.team,
			"x": u.global_position.x, "y": u.global_position.y,
			"hp": u.hp, "mh": u.max_hp, "al": u.alive, "bo": u.is_boss,
		})
	var cg: Array = []
	for i in range(arena.crates.size()):
		var c = arena.crates[i]  # 可能已释放，不能用带类型变量
		if c == null or not is_instance_valid(c) or c.is_queued_for_deletion():
			cg.append(i)
	var pks: Array = []
	for pid in arena.net_pickups:
		var p = arena.net_pickups[pid]
		if p != null and is_instance_valid(p):
			pks.append({"p": pid, "k": p.kind, "x": p.global_position.x, "y": p.global_position.y})
	return {
		"t": "init", "me": for_uid, "map": arena.map_key, "mode": arena.mode,
		"tl": arena.time_left, "units": us, "cg": cg, "pks": pks,
	}


func _broadcast_snapshot() -> void:
	if peers.is_empty():
		return
	var rows: Array = []
	for u in arena.units:
		if u == null or not is_instance_valid(u):
			continue
		rows.append([
			u.net_id, snappedf(u.global_position.x, 0.1), snappedf(u.global_position.y, 0.1),
			snappedf(u.hp, 0.1), snappedf(u.shield, 0.1), snappedf(u.ult_charge, 1.0),
			snappedf(u.skill_cd, 0.1), u.kills, u.gems, 1 if u.alive else 0,
			snappedf(u.aim_dir.x, 0.01), snappedf(u.aim_dir.y, 0.01), u.max_hp,
		])
	_send({"t": "s", "tl": snappedf(arena.time_left, 0.1), "u": rows}, 0, false)


# —— 游戏逻辑调用的事件广播（非服务器时自动忽略）——

func ev_fire(u: Node) -> void:
	if role == "server":
		_send({"t": "fire", "i": u.net_id, "x": u.aim_point.x, "y": u.aim_point.y})


func ev_skill(u: Node) -> void:
	if role == "server":
		_send({"t": "sk", "i": u.net_id, "x": u.aim_point.x, "y": u.aim_point.y})


func ev_ult(u: Node) -> void:
	if role == "server":
		_send({"t": "ul", "i": u.net_id, "x": u.aim_point.x, "y": u.aim_point.y, "u": u.udef.get("id", "storm")})


func ev_die(u: Node, killer: Node) -> void:
	if role == "server":
		var kid := -1
		if killer != null and is_instance_valid(killer):
			kid = killer.net_id
		_send({"t": "die", "i": u.net_id, "k": kid})


func ev_respawn(u: Node) -> void:
	if role == "server":
		_send({"t": "rsp", "i": u.net_id, "x": u.global_position.x, "y": u.global_position.y})


func ev_crate(ci: int) -> void:
	if role == "server" and ci >= 0:
		_send({"t": "crate", "i": ci})


func ev_pk_add(p: Node) -> void:
	if role == "server":
		_send({"t": "pk+", "p": p.pid, "k": p.kind, "x": p.global_position.x, "y": p.global_position.y})


func ev_pk_gone(pid: int, taken := true) -> void:
	if role == "server":
		_send({"t": "pk-", "p": pid, "tk": taken})


func ev_feed(s: String) -> void:
	if role == "server":
		_send({"t": "feed", "s": s})


func ev_ann(s: String, dur: float) -> void:
	if role == "server":
		_send({"t": "ann", "s": s, "d": dur})


func ev_stat(s: String) -> void:
	if role != "server":
		return
	if s == last_stat:
		return
	var now := Time.get_ticks_msec()
	if s != "" and now - stat_ms < 150:
		return
	last_stat = s
	stat_ms = now
	_send({"t": "stat", "s": s})


func ev_offer(peer_id: int, options: Array) -> void:
	if role == "server" and peers.has(peer_id):
		_send({"t": "off", "o": options}, peer_id)


func ev_end(title: String, rows: Array) -> void:
	if role == "server":
		_send({"t": "end", "ti": title, "rows": rows})


# ══════════════════ 客户端侧 ══════════════════

func send_upgrade_pick(key: String) -> void:
	if role == "client":
		_send({"t": "up", "k": key}, 1)


func _client_packet(d: Dictionary) -> void:
	var t := String(d.get("t", ""))
	if t == "init":
		my_uid = int(d.get("me", -1))
		init_received.emit(d)
		if smoke and not smoke_done and snap_count == 0:
			get_tree().create_timer(14.0).timeout.connect(_smoke_eval)
		return
	if arena == null or not is_instance_valid(arena):
		return
	match t:
		"s":
			_apply_snapshot(d)
		"fire":
			var u := _cu(d)
			if u != null and u.alive:
				_aim_at(u, d)
				u.fire()
				fire_count += 1
		"sk":
			var u := _cu(d)
			if u != null and u.alive:
				_aim_at(u, d)
				u.use_skill()
		"ul":
			var u := _cu(d)
			if u != null and u.alive:
				_aim_at(u, d)
				u.udef = Catalog.ULTS.get(String(d.get("u", "storm")), Catalog.ULTS["storm"])
				u.ult_charge = u.ULT_NEED
				u.use_ult()
		"die":
			_client_die(d)
		"rsp":
			var u := _cu(d)
			if u != null:
				u.respawn(Vector2(float(d.get("x", 0)), float(d.get("y", 0))))
				u.net_pos = u.global_position
		"crate":
			arena.net_crate_break(int(d.get("i", -1)))
		"pk+":
			arena.net_pickup_add(d)
		"pk-":
			arena.net_pickup_gone(int(d.get("p", -1)), bool(d.get("tk", true)))
		"feed":
			arena.hud.killfeed(String(d.get("s", "")))
		"ann":
			arena.hud.announce(String(d.get("s", "")), float(d.get("d", 1.4)))
		"stat":
			arena.hud.set_status(String(d.get("s", "")))
		"off":
			arena.hud.offer_upgrades(d.get("o", []))
		"end":
			arena.net_end(d)


func _cu(d: Dictionary) -> Node:
	var u = arena.unit_map.get(int(d.get("i", -1)))
	if u != null and is_instance_valid(u):
		return u
	return null


func _aim_at(u: Node, d: Dictionary) -> void:
	u.aim_point = Vector2(float(d.get("x", 0)), float(d.get("y", 0)))
	var v: Vector2 = u.aim_point - u.global_position
	if v.length() > 2.0:
		u.aim_dir = v.normalized()


func _apply_snapshot(d: Dictionary) -> void:
	snap_count += 1
	arena.time_left = float(d.get("tl", arena.time_left))
	for row in d.get("u", []):
		var u = arena.unit_map.get(int(row[0]))
		if u == null or not is_instance_valid(u):
			continue
		var new_hp := float(row[3])
		if u.alive and new_hp < u.hp - 1.0:
			FX.flash(u.sprite)
		u.hp = new_hp
		u.shield = float(row[4])
		u.ult_charge = float(row[5])
		u.skill_cd = float(row[6])
		u.kills = int(row[7])
		u.gems = int(row[8])
		u.max_hp = float(row[12])
		u.net_pos = Vector2(float(row[1]), float(row[2]))
		if u != G.player:
			var ad := Vector2(float(row[10]), float(row[11]))
			if ad.length() > 0.1:
				u.aim_dir = ad
		var al := int(row[9]) == 1
		if al and not u.alive:
			u.respawn(u.net_pos)
		elif not al and u.alive:
			arena.net_die_fx(u)
		if smoke and u == G.player:
			smoke_maxd = maxf(smoke_maxd, u.global_position.distance_to(spawn_pos))


func _client_die(d: Dictionary) -> void:
	var u := _cu(d)
	var kid := int(d.get("k", -1))
	if u != null and u.alive:
		arena.net_die_fx(u)
	if kid == my_uid and int(d.get("i", -1)) != my_uid:
		var vname := "敌人"
		if u != null:
			vname = u.display_name
		arena.notify_player_kill(vname)
	if int(d.get("i", -1)) == my_uid:
		arena.player_streak = 0
		arena.add_shake(10.0)


func _send_intents() -> void:
	var p: Node = G.player
	if p == null or not is_instance_valid(p):
		return
	var mv: Vector2
	var ad: Vector2
	var ap: Vector2
	var f := false
	var sk := false
	var ul := false
	if smoke:
		smoke_t += get_physics_process_delta_time() * SEND_EVERY
		mv = Vector2.RIGHT.rotated(smoke_t * 1.3)
		ad = mv
		ap = p.global_position + mv * 320.0
		f = true
		sk = fmod(smoke_t, 3.0) < 0.1
		ul = fmod(smoke_t, 5.0) < 0.1
		if spawn_pos == Vector2.ZERO:
			spawn_pos = p.global_position
	else:
		mv = p.move_input
		ad = p.aim_dir
		ap = p.aim_point
		f = p.want_fire
		sk = p.want_skill
		ul = p.want_ult
		p.want_skill = false
		p.want_ult = false
	_send({
		"t": "in", "mx": snappedf(mv.x, 0.01), "my": snappedf(mv.y, 0.01),
		"ax": snappedf(ad.x, 0.01), "ay": snappedf(ad.y, 0.01),
		"px": snappedf(ap.x, 0.1), "py": snappedf(ap.y, 0.1),
		"f": f, "sk": sk, "ul": ul,
	}, 1, false)


func _smoke_eval() -> void:
	if smoke_done:
		return
	smoke_done = true
	var ok := snap_count > 100 and fire_count > 0 and smoke_maxd > 80.0
	print("NETSMOKE_%s snaps=%d fires=%d maxd=%.0f" % [
		"OK" if ok else "FAIL", snap_count, fire_count, smoke_maxd])
	get_tree().quit(0 if ok else 1)
