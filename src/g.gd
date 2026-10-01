extends Node
## 全局自动加载：出战配置、输入注册、触屏检测、音效播放。

var loadout := {
	"chara": "blue",
	"weapon": "blaster",
	"skill": "dash",
	"item": "boots",
}
var touch_mode := false
var player: Node = null
var sfx_cache := {}


func _ready() -> void:
	process_mode = Node.PROCESS_MODE_ALWAYS
	_setup_actions()
	touch_mode = DisplayServer.is_touchscreen_available()


func _input(event: InputEvent) -> void:
	if event is InputEventScreenTouch and not touch_mode:
		touch_mode = true


func _setup_actions() -> void:
	_key_action("move_up", [KEY_W, KEY_UP])
	_key_action("move_down", [KEY_S, KEY_DOWN])
	_key_action("move_left", [KEY_A, KEY_LEFT])
	_key_action("move_right", [KEY_D, KEY_RIGHT])
	_key_action("skill", [KEY_SPACE])
	_mouse_action("fire", MOUSE_BUTTON_LEFT)
	_mouse_action("skill", MOUSE_BUTTON_RIGHT)


func _key_action(aname: String, keys: Array) -> void:
	if not InputMap.has_action(aname):
		InputMap.add_action(aname)
	for k in keys:
		var ev := InputEventKey.new()
		ev.physical_keycode = k
		InputMap.action_add_event(aname, ev)


func _mouse_action(aname: String, btn: int) -> void:
	if not InputMap.has_action(aname):
		InputMap.add_action(aname)
	var ev := InputEventMouseButton.new()
	ev.button_index = btn as MouseButton
	InputMap.action_add_event(aname, ev)


func play_sfx(sname: String, pos: Variant = null, vol_db := 0.0, pitch_var := 0.08) -> void:
	var path := "res://assets/sfx/%s.wav" % sname
	if not sfx_cache.has(sname):
		if not ResourceLoader.exists(path):
			return
		sfx_cache[sname] = load(path)
	var scene := get_tree().current_scene
	if scene == null:
		return
	if pos == null:
		var p := AudioStreamPlayer.new()
		p.stream = sfx_cache[sname]
		p.volume_db = vol_db
		p.pitch_scale = randf_range(1.0 - pitch_var, 1.0 + pitch_var)
		scene.add_child(p)
		p.play()
		p.finished.connect(p.queue_free)
	else:
		var p2 := AudioStreamPlayer2D.new()
		p2.stream = sfx_cache[sname]
		p2.volume_db = vol_db
		p2.max_distance = 2400.0
		p2.pitch_scale = randf_range(1.0 - pitch_var, 1.0 + pitch_var)
		scene.add_child(p2)
		p2.global_position = pos
		p2.play()
		p2.finished.connect(p2.queue_free)
