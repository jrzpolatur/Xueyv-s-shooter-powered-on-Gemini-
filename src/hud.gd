class_name HUD
extends CanvasLayer
## 战斗界面：计时 / 比分 / 击杀播报 / 技能按钮 / 血条 / 触屏摇杆 / 结算面板。

var root: Control
var time_label: Label
var score_label: Label
var gem_blue_label: Label
var gem_red_label: Label
var status_label: Label
var feed_box: VBoxContainer
var announce_label: Label
var skill_btn: Button
var ult_btn: Button
var hp_bar: ProgressBar
var hp_label: Label
var stick_left: VirtualJoystick
var stick_right: VirtualJoystick
var results_layer: Control
var gem_mode := false
var boss_mode := false
var boss_bar: ProgressBar
var boss_label: Label
var vignette: Vignette
var upgrade_panel: PanelContainer
var upgrade_btns: Array = []
var upgrade_queue: Array = []
var upgrade_options: Array = []
var upgrade_open := false


class Vignette extends Control:
	## 低血量红色警示边框
	var strength := 0.0

	func _ready() -> void:
		mouse_filter = Control.MOUSE_FILTER_IGNORE

	func _process(_d: float) -> void:
		queue_redraw()

	func _draw() -> void:
		if strength <= 0.01:
			return
		var pulse := 0.7 + 0.3 * absf(sin(Time.get_ticks_msec() * 0.005))
		var a := strength * pulse
		var s := size
		var th := 110.0
		var col := Color(0.9, 0.05, 0.05)
		# 四条渐变边
		draw_rect(Rect2(0, 0, s.x, th), Color(col, 0.0), true)
		for i in range(8):
			var f := 1.0 - i / 8.0
			var aa := a * 0.09 * f
			var t := th * (i + 1) / 8.0
			draw_rect(Rect2(0, 0, s.x, t), Color(col, aa), true)
			draw_rect(Rect2(0, s.y - t, s.x, t), Color(col, aa), true)
			draw_rect(Rect2(0, 0, t, s.y), Color(col, aa), true)
			draw_rect(Rect2(s.x - t, 0, t, s.y), Color(col, aa), true)


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
	gem_blue_label = _mk_label("◆ 0", 24, Color(0.5, 0.85, 1.0))
	gem_red_label = _mk_label("0 ◆", 24, Color(1, 0.5, 0.5))
	if gem_mode:
		top_box.add_child(gem_blue_label)
		top_box.add_child(time_label)
		top_box.add_child(gem_red_label)
	else:
		top_box.add_child(time_label)
	top_box.add_child(score_label)

	# —— 状态栏（夺冠倒计时等）——
	status_label = _mk_label("", 24, Color(1, 0.9, 0.4))
	_place(status_label, Control.PRESET_CENTER_TOP, -300, 66, 600, 36)
	status_label.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	root.add_child(status_label)

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

	# —— 必杀按钮 ——
	ult_btn = Button.new()
	ult_btn.focus_mode = Control.FOCUS_NONE
	_place(ult_btn, Control.PRESET_BOTTOM_RIGHT, -290, -342, 118, 118)
	ult_btn.add_theme_font_size_override("font_size", 18)
	ult_btn.add_theme_stylebox_override("normal", _panel_style(Color(0.62, 0.3, 0.95, 0.92), 58))
	ult_btn.add_theme_stylebox_override("hover", _panel_style(Color(0.72, 0.4, 1.0, 0.96), 58))
	ult_btn.add_theme_stylebox_override("pressed", _panel_style(Color(0.5, 0.22, 0.8, 0.96), 58))
	ult_btn.add_theme_stylebox_override("disabled", _panel_style(Color(0.22, 0.18, 0.3, 0.8), 58))
	ult_btn.pressed.connect(func():
		if G.player != null and is_instance_valid(G.player):
			G.player.want_ult = true)
	root.add_child(ult_btn)

	# —— 虚拟摇杆 ——
	stick_left = VirtualJoystick.new()
	_place(stick_left, Control.PRESET_BOTTOM_LEFT, 24, -254, 230, 230)
	stick_left.accent = Color(0.6, 0.9, 1.0)
	root.add_child(stick_left)
	stick_right = VirtualJoystick.new()
	_place(stick_right, Control.PRESET_BOTTOM_RIGHT, -254, -254, 230, 230)
	stick_right.accent = Color(1.0, 0.6, 0.5)
	root.add_child(stick_right)

	# —— 低血量警示边框 ——
	vignette = Vignette.new()
	vignette.set_anchors_preset(Control.PRESET_FULL_RECT)
	root.add_child(vignette)
	root.move_child(vignette, 0)

	# —— Boss 血条 ——
	if boss_mode:
		var bbox := VBoxContainer.new()
		_place(bbox, Control.PRESET_CENTER_TOP, -310, 70, 620, 60)
		bbox.mouse_filter = Control.MOUSE_FILTER_IGNORE
		root.add_child(bbox)
		boss_label = _mk_label("魔王·雪烬", 18, Color(1, 0.6, 0.9))
		boss_label.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
		bbox.add_child(boss_label)
		boss_bar = ProgressBar.new()
		boss_bar.custom_minimum_size = Vector2(620, 20)
		boss_bar.show_percentage = false
		boss_bar.mouse_filter = Control.MOUSE_FILTER_IGNORE
		boss_bar.add_theme_stylebox_override("background", _panel_style(Color(0, 0, 0, 0.55), 10))
		boss_bar.add_theme_stylebox_override("fill", _panel_style(Color(0.85, 0.2, 0.45, 0.95), 10))
		bbox.add_child(boss_bar)

	# —— 强化三选一面板 ——
	upgrade_panel = PanelContainer.new()
	_place(upgrade_panel, Control.PRESET_CENTER_BOTTOM, -352, -400, 704, 150)
	upgrade_panel.add_theme_stylebox_override("panel", _panel_style(Color(0.08, 0.07, 0.16, 0.92), 16))
	upgrade_panel.visible = false
	root.add_child(upgrade_panel)
	var uv := VBoxContainer.new()
	uv.add_theme_constant_override("separation", 8)
	upgrade_panel.add_child(uv)
	var utitle := _mk_label("升 级 ！选择一项强化（按 1 / 2 / 3）", 20, Color(1, 0.85, 0.4))
	utitle.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	uv.add_child(utitle)
	var urow := HBoxContainer.new()
	urow.alignment = BoxContainer.ALIGNMENT_CENTER
	urow.add_theme_constant_override("separation", 14)
	uv.add_child(urow)
	for i in range(3):
		var btn := Button.new()
		btn.focus_mode = Control.FOCUS_NONE
		btn.custom_minimum_size = Vector2(216, 92)
		btn.add_theme_font_size_override("font_size", 18)
		btn.add_theme_stylebox_override("normal", _panel_style(Color(0.16, 0.2, 0.36, 0.95), 12))
		btn.add_theme_stylebox_override("hover", _panel_style(Color(0.26, 0.34, 0.56, 0.98), 12))
		btn.add_theme_stylebox_override("pressed", _panel_style(Color(0.1, 0.12, 0.24, 0.98), 12))
		var idx := i
		btn.pressed.connect(func():
			_pick_upgrade(idx))
		urow.add_child(btn)
		upgrade_btns.append(btn)


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
	if p.alive and p.hp < p.max_hp * 0.35:
		vignette.strength = clampf(1.0 - p.hp / (p.max_hp * 0.35), 0.25, 1.0)
	else:
		vignette.strength = 0.0
	if gem_mode:
		score_label.text = "◆%d · 击杀 %d" % [p.gems, p.kills]
	else:
		score_label.text = "击杀 %d" % p.kills
	if p.skill_cd > 0.0:
		skill_btn.disabled = true
		skill_btn.text = "%s\n%.1f" % [p.sdef["name"], p.skill_cd]
	else:
		skill_btn.disabled = false
		skill_btn.text = String(p.sdef["name"])
	var pct := int(p.ult_charge * 100.0 / p.ULT_NEED)
	if pct >= 100:
		ult_btn.disabled = false
		ult_btn.text = "%s\n就绪!" % p.udef["name"]
		ult_btn.modulate = Color(1, 1, 1) * (1.0 + 0.15 * absf(sin(Time.get_ticks_msec() * 0.006)))
	else:
		ult_btn.disabled = true
		ult_btn.text = "%s\n%d%%" % [p.udef["name"], pct]
		ult_btn.modulate = Color(1, 1, 1)


func set_boss_hp(hp: float, max_hp: float) -> void:
	if boss_bar == null:
		return
	boss_bar.max_value = max_hp
	boss_bar.value = hp
	boss_label.text = "魔王·雪烬  %d / %d" % [int(maxf(hp, 0)), int(max_hp)]


func offer_upgrades(options: Array) -> void:
	if upgrade_open:
		upgrade_queue.append(options)
		return
	_show_upgrade_panel(options)


func _show_upgrade_panel(options: Array) -> void:
	upgrade_open = true
	upgrade_options = options
	for i in range(3):
		var key: String = options[i]
		var u: Dictionary = Catalog.UPGRADES[key]
		upgrade_btns[i].text = "%d. %s\n%s" % [i + 1, u["name"], u["desc"]]
	upgrade_panel.visible = true
	G.play_sfx("pickup", null, -4.0)


func _pick_upgrade(idx: int) -> void:
	if not upgrade_open or idx < 0 or idx >= upgrade_options.size():
		return
	upgrade_panel.visible = false
	upgrade_open = false
	if G.player != null and is_instance_valid(G.player):
		G.player.apply_upgrade(upgrade_options[idx])
		G.play_sfx("ui")
	if not upgrade_queue.is_empty():
		_show_upgrade_panel(upgrade_queue.pop_front())


func _input(event: InputEvent) -> void:
	if not upgrade_open or not event is InputEventKey:
		return
	var k := event as InputEventKey
	if not k.pressed or k.echo:
		return
	match k.keycode:
		KEY_1, KEY_KP_1:
			_pick_upgrade(0)
		KEY_2, KEY_KP_2:
			_pick_upgrade(1)
		KEY_3, KEY_KP_3:
			_pick_upgrade(2)


func set_gems(blue: int, red: int) -> void:
	gem_blue_label.text = "蓝 ◆ %d" % blue
	gem_red_label.text = "%d ◆ 红" % red


func set_status(text: String) -> void:
	status_label.text = text


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


func show_results(title_text: String, lines: Array, on_restart: Callable, on_menu: Callable) -> void:
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

	var title := _mk_label(title_text, 34, Color(1, 0.85, 0.4))
	title.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	box.add_child(title)
	for line in lines:
		var row := _mk_label(String(line["text"]), 22,
			Color(1, 1, 0.7) if bool(line["highlight"]) else Color(0.9, 0.9, 0.95))
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
