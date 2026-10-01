class_name HUD
extends CanvasLayer
## 战斗界面：计时 / 比分 / 击杀播报 / 技能按钮 / 血条 / 触屏摇杆 / 结算面板。

var root: Control
var time_label: Label
var score_label: Label
var feed_box: VBoxContainer
var announce_label: Label
var skill_btn: Button
var hp_bar: ProgressBar
var hp_label: Label
var stick_left: VirtualJoystick
var stick_right: VirtualJoystick
var results_layer: Control


func _ready() -> void:
	process_mode = Node.PROCESS_MODE_ALWAYS
	layer = 10
	root = Control.new()
	root.set_anchors_preset(Control.PRESET_FULL_RECT)
	root.mouse_filter = Control.MOUSE_FILTER_IGNORE
	add_child(root)

	# —— 顶部信息条 ——
	var top := PanelContainer.new()
	_place(top, Control.PRESET_CENTER_TOP, -190, 10, 380, 52)
	top.mouse_filter = Control.MOUSE_FILTER_IGNORE
	top.add_theme_stylebox_override("panel", _panel_style(Color(0.06, 0.08, 0.14, 0.75), 14))
	root.add_child(top)
	var top_box := HBoxContainer.new()
	top_box.alignment = BoxContainer.ALIGNMENT_CENTER
	top_box.add_theme_constant_override("separation", 26)
	top_box.mouse_filter = Control.MOUSE_FILTER_IGNORE
	top.add_child(top_box)
	time_label = _mk_label("3:00", 26, Color(1, 1, 1))
	score_label = _mk_label("击杀 0", 20, Color(1, 0.9, 0.55))
	top_box.add_child(time_label)
	top_box.add_child(score_label)

	# —— 击杀播报 ——
	feed_box = VBoxContainer.new()
	_place(feed_box, Control.PRESET_TOP_LEFT, 16, 14, 460, 220)
	feed_box.mouse_filter = Control.MOUSE_FILTER_IGNORE
	root.add_child(feed_box)

	# —— 中央公告 ——
	announce_label = _mk_label("", 44, Color(1, 1, 1))
	_place(announce_label, Control.PRESET_CENTER, -320, -170, 640, 60)
	announce_label.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	announce_label.modulate.a = 0.0
	root.add_child(announce_label)

	# —— 左下 HP ——
	var hp_box := VBoxContainer.new()
	_place(hp_box, Control.PRESET_BOTTOM_LEFT, 20, -84, 260, 64)
	hp_box.mouse_filter = Control.MOUSE_FILTER_IGNORE
	root.add_child(hp_box)
	hp_label = _mk_label("HP 100 / 100", 18, Color(0.8, 1.0, 0.85))
	hp_box.add_child(hp_label)
	hp_bar = ProgressBar.new()
	hp_bar.custom_minimum_size = Vector2(240, 18)
	hp_bar.show_percentage = false
	hp_bar.mouse_filter = Control.MOUSE_FILTER_IGNORE
	hp_bar.add_theme_stylebox_override("background", _panel_style(Color(0, 0, 0, 0.5), 9))
	hp_bar.add_theme_stylebox_override("fill", _panel_style(Color(0.35, 0.9, 0.45, 0.95), 9))
	hp_box.add_child(hp_bar)

	# —— 技能按钮 ——
	skill_btn = Button.new()
	skill_btn.focus_mode = Control.FOCUS_NONE
	_place(skill_btn, Control.PRESET_BOTTOM_RIGHT, -152, -342, 118, 118)
	skill_btn.add_theme_font_size_override("font_size", 19)
	skill_btn.add_theme_stylebox_override("normal", _panel_style(Color(0.95, 0.65, 0.2, 0.9), 58))
	skill_btn.add_theme_stylebox_override("hover", _panel_style(Color(1.0, 0.75, 0.3, 0.95), 58))
	skill_btn.add_theme_stylebox_override("pressed", _panel_style(Color(0.8, 0.5, 0.15, 0.95), 58))
	skill_btn.add_theme_stylebox_override("disabled", _panel_style(Color(0.25, 0.25, 0.3, 0.8), 58))
	skill_btn.pressed.connect(func():
		if G.player != null and is_instance_valid(G.player):
			G.player.want_skill = true)
	root.add_child(skill_btn)

	# —— 虚拟摇杆 ——
	stick_left = VirtualJoystick.new()
	_place(stick_left, Control.PRESET_BOTTOM_LEFT, 24, -254, 230, 230)
	stick_left.accent = Color(0.6, 0.9, 1.0)
	root.add_child(stick_left)
	stick_right = VirtualJoystick.new()
	_place(stick_right, Control.PRESET_BOTTOM_RIGHT, -254, -254, 230, 230)
	stick_right.accent = Color(1.0, 0.6, 0.5)
	root.add_child(stick_right)


func _process(_delta: float) -> void:
	var touch := G.touch_mode
	stick_left.visible = touch
	stick_right.visible = touch
	var p: Node = G.player
	if p == null or not is_instance_valid(p):
		return
	hp_bar.max_value = p.max_hp
	hp_bar.value = p.hp
	hp_label.text = "HP %d / %d" % [int(p.hp), int(p.max_hp)]
	score_label.text = "击杀 %d" % p.kills
	if p.skill_cd > 0.0:
		skill_btn.disabled = true
		skill_btn.text = "%s\n%.1f" % [p.sdef["name"], p.skill_cd]
	else:
		skill_btn.disabled = false
		skill_btn.text = String(p.sdef["name"])


func set_time(t: float) -> void:
	var s := maxi(0, int(ceilf(t)))
	time_label.text = "%d:%02d" % [s / 60, s % 60]
	if s <= 10:
		time_label.add_theme_color_override("font_color", Color(1, 0.4, 0.4))


func killfeed(text: String) -> void:
	var l := _mk_label(text, 17, Color(1, 1, 1, 0.95))
	feed_box.add_child(l)
	var tw := l.create_tween()
	tw.set_pause_mode(Tween.TWEEN_PAUSE_PROCESS)
	tw.tween_interval(2.6)
	tw.tween_property(l, "modulate:a", 0.0, 0.5)
	tw.tween_callback(l.queue_free)
	if feed_box.get_child_count() > 5:
		feed_box.get_child(0).queue_free()


func announce(text: String, dur := 1.4) -> void:
	announce_label.text = text
	announce_label.modulate.a = 0.0
	var tw := announce_label.create_tween()
	tw.set_pause_mode(Tween.TWEEN_PAUSE_PROCESS)
	tw.tween_property(announce_label, "modulate:a", 1.0, 0.25)
	tw.tween_interval(dur)
	tw.tween_property(announce_label, "modulate:a", 0.0, 0.4)


func show_results(ranking: Array, on_restart: Callable, on_menu: Callable) -> void:
	results_layer = Control.new()
	results_layer.set_anchors_preset(Control.PRESET_FULL_RECT)
	root.add_child(results_layer)
	var dim := ColorRect.new()
	dim.color = Color(0, 0, 0, 0.6)
	dim.set_anchors_preset(Control.PRESET_FULL_RECT)
	results_layer.add_child(dim)

	var centerer := CenterContainer.new()
	centerer.set_anchors_preset(Control.PRESET_FULL_RECT)
	results_layer.add_child(centerer)
	var panel := PanelContainer.new()
	panel.add_theme_stylebox_override("panel", _panel_style(Color(0.08, 0.1, 0.17, 0.96), 18))
	centerer.add_child(panel)
	var box := VBoxContainer.new()
	box.add_theme_constant_override("separation", 10)
	box.custom_minimum_size = Vector2(420, 0)
	panel.add_child(box)

	var title := _mk_label("— 战斗结束 —", 34, Color(1, 0.85, 0.4))
	title.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	box.add_child(title)
	for i in range(ranking.size()):
		var u: Node = ranking[i]
		var medal: String = ["①", "②", "③", "④", "⑤", "⑥"][mini(i, 5)]
		var row := _mk_label("%s  %s — %d 击杀 / %d 阵亡" % [medal, u.display_name, u.kills, u.deaths],
			22, Color(1, 1, 0.7) if u.is_player_unit else Color(0.9, 0.9, 0.95))
		box.add_child(row)

	var btn_row := HBoxContainer.new()
	btn_row.alignment = BoxContainer.ALIGNMENT_CENTER
	btn_row.add_theme_constant_override("separation", 20)
	box.add_child(btn_row)
	var again := _mk_button("再来一局")
	again.pressed.connect(on_restart)
	btn_row.add_child(again)
	var back := _mk_button("重新配装")
	back.pressed.connect(on_menu)
	btn_row.add_child(back)


func _place(ctrl: Control, preset: int, x0: float, y0: float, w: float, h: float) -> void:
	ctrl.set_anchors_preset(preset as Control.LayoutPreset)
	ctrl.offset_left = x0
	ctrl.offset_top = y0
	ctrl.offset_right = x0 + w
	ctrl.offset_bottom = y0 + h


func _mk_label(text: String, fsize: int, color: Color) -> Label:
	var l := Label.new()
	l.text = text
	l.mouse_filter = Control.MOUSE_FILTER_IGNORE
	l.add_theme_font_size_override("font_size", fsize)
	l.add_theme_color_override("font_color", color)
	l.add_theme_color_override("font_outline_color", Color(0, 0, 0, 0.7))
	l.add_theme_constant_override("outline_size", 5)
	return l


func _mk_button(text: String) -> Button:
	var b := Button.new()
	b.text = text
	b.focus_mode = Control.FOCUS_NONE
	b.custom_minimum_size = Vector2(160, 52)
	b.add_theme_font_size_override("font_size", 22)
	b.add_theme_stylebox_override("normal", _panel_style(Color(0.2, 0.45, 0.9, 0.95), 12))
	b.add_theme_stylebox_override("hover", _panel_style(Color(0.3, 0.55, 1.0, 1.0), 12))
	b.add_theme_stylebox_override("pressed", _panel_style(Color(0.15, 0.35, 0.75, 1.0), 12))
	return b


func _panel_style(color: Color, radius: int) -> StyleBoxFlat:
	var sb := StyleBoxFlat.new()
	sb.bg_color = color
	sb.corner_radius_top_left = radius
	sb.corner_radius_top_right = radius
	sb.corner_radius_bottom_left = radius
	sb.corner_radius_bottom_right = radius
	sb.content_margin_left = 14
	sb.content_margin_right = 14
	sb.content_margin_top = 8
	sb.content_margin_bottom = 8
	return sb
