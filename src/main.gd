extends Node2D
## 游戏主流程：菜单 ⇄ 战斗。
## 架构说明：战斗逻辑全部由「意图字段」驱动（见 unit.gd），
## 将来做联机时，只需把远端玩家的意图通过网络写入对应 Unit 即可。

var menu: Menu
var arena: Arena


func _ready() -> void:
	Net.init_received.connect(_on_net_init)
	Net.dropped.connect(_on_net_dropped)
	var args := OS.get_cmdline_user_args()
	if args.has("--gems"):
		G.mode = "gems"
	if args.has("--lava"):
		G.map = "lava"
	if args.has("--boss"):
		G.mode = "boss"
	if args.has("--server"):
		# 专用联机服务器（无本地玩家）
		Net.host(_arg_port(args))
		start_game()
		return
	var ji := args.find("--join")
	if ji != -1 and ji + 1 < args.size():
		# 命令行直连（联机冒烟测试用）
		if args.has("--netsmoke"):
			Net.smoke = true
			get_tree().create_timer(40.0).timeout.connect(_netsmoke_timeout)
		Net.join(args[ji + 1])
		return
	if args.has("--autostart") or args.has("--smoke"):
		start_game()
		if args.has("--smoke"):
			_smoke()
	else:
		show_menu()


func _arg_port(args: PackedStringArray) -> int:
	var pi := args.find("--port")
	if pi != -1 and pi + 1 < args.size() and args[pi + 1].is_valid_int():
		return int(args[pi + 1])
	return Net.PORT


func _netsmoke_timeout() -> void:
	if not Net.smoke_done:
		print("NETSMOKE_FAIL timeout")
		get_tree().quit(1)


func _on_net_init(data: Dictionary) -> void:
	# 服务器接纳了我们：搭建影子竞技场（新一局也走这里）
	get_tree().paused = false
	Engine.time_scale = 1.0
	if menu != null:
		menu.queue_free()
		menu = null
	if arena != null:
		arena.queue_free()
		G.player = null
	arena = Arena.new()
	arena.replica = true
	arena.net_data = data
	Net.arena = arena
	add_child(arena)
	arena.restart_requested.connect(show_menu)
	arena.menu_requested.connect(show_menu)


func _on_net_dropped() -> void:
	if arena != null and arena.replica:
		show_menu()


func _smoke() -> void:
	# 2 秒后给所有单位灌满必杀充能，覆盖大招代码路径
	await get_tree().create_timer(2.0).timeout
	if arena != null:
		for u in arena.units:
			if is_instance_valid(u):
				u.add_ult_charge(Unit.ULT_NEED)
		# 覆盖强化面板 / 键选 / 慢动作代码路径
		arena.hud.offer_upgrades(["dmg", "hp", "speed"])
		arena.hud.offer_upgrades(["firerate", "cdr", "ultgain"])
		arena.hud._pick_upgrade(1)
		arena.hud._pick_upgrade(2)
		arena._slowmo(0.3, 0.1)
	await get_tree().create_timer(18.0).timeout
	assert(Engine.time_scale == 1.0)
	print("SMOKE_OK kills_tracked=", arena.units.map(func(u): return u.kills))
	get_tree().quit()


func show_menu() -> void:
	get_tree().paused = false
	Engine.time_scale = 1.0
	if Net.is_client():
		Net.leave()
	if arena != null:
		arena.queue_free()
		arena = null
		G.player = null
	menu = Menu.new()
	add_child(menu)
	menu.start_requested.connect(start_game)


func start_game() -> void:
	get_tree().paused = false
	Engine.time_scale = 1.0
	if menu != null:
		menu.queue_free()
		menu = null
	if arena != null:
		arena.queue_free()
		G.player = null
	arena = Arena.new()
	add_child(arena)
	arena.restart_requested.connect(start_game)
	arena.menu_requested.connect(show_menu)
	if Net.is_server():
		Net.attach_arena(arena)
