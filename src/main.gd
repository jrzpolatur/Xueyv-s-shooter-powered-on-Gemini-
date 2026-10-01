extends Node2D
## 游戏主流程：菜单 ⇄ 战斗。
## 架构说明：战斗逻辑全部由「意图字段」驱动（见 unit.gd），
## 将来做联机时，只需把远端玩家的意图通过网络写入对应 Unit 即可。

var menu: Menu
var arena: Arena


func _ready() -> void:
	var args := OS.get_cmdline_user_args()
	if args.has("--gems"):
		G.mode = "gems"
	if args.has("--autostart") or args.has("--smoke"):
		start_game()
		if args.has("--smoke"):
			_smoke()
	else:
		show_menu()


func _smoke() -> void:
	await get_tree().create_timer(20.0).timeout
	print("SMOKE_OK kills_tracked=", arena.units.map(func(u): return u.kills))
	get_tree().quit()


func show_menu() -> void:
	get_tree().paused = false
	if arena != null:
		arena.queue_free()
		arena = null
		G.player = null
	menu = Menu.new()
	add_child(menu)
	menu.start_requested.connect(start_game)


func start_game() -> void:
	get_tree().paused = false
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
