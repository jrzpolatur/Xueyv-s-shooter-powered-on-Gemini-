extends CanvasLayer
## HUD: infection rate, timer, HP, hints, win/lose overlay.
## Loads the bundled Noto Sans SC subset at runtime (no editor import needed).

var _root: Control
var _pct_label: Label
var _bar_fill: ColorRect
var _timer_label: Label
var _progeny_label: Label
var _hp_label: Label
var _toast_label: Label
var _infect_label: Label
var _end_panel: Control
var _end_title: Label
var _end_sub: Label
var _hint: Label
var _toast_timer := 0.0
var _cjk := false


func _ready() -> void:
	_root = Control.new()
	_root.set_anchors_preset(Control.PRESET_FULL_RECT)
	_root.mouse_filter = Control.MOUSE_FILTER_IGNORE
	add_child(_root)

	var font := _load_font()
	if font != null:
		var theme := Theme.new()
		theme.default_font = font
		theme.default_font_size = 22
		_root.theme = theme
		_cjk = true

	# --- top-left: infection rate
	var tl := VBoxContainer.new()
	tl.position = Vector2(18, 14)
	tl.add_theme_constant_override("separation", 6)
	_root.add_child(tl)
	var pct_title := Label.new()
	pct_title.text = T("感染率", "INFECTION")
	pct_title.add_theme_font_size_override("font_size", 18)
	tl.add_child(pct_title)
	var bar_bg := ColorRect.new()
	bar_bg.color = Color(0, 0, 0, 0.55)
	bar_bg.custom_minimum_size = Vector2(320, 20)
	tl.add_child(bar_bg)
	_bar_fill = ColorRect.new()
	_bar_fill.color = Color(0.85, 0.25, 0.75)
	_bar_fill.position = Vector2(2, 2)
	_bar_fill.size = Vector2(0, 16)
	bar_bg.add_child(_bar_fill)
	_pct_label = Label.new()
	_pct_label.text = "0%"
	tl.add_child(_pct_label)

	# --- top-right: time + progeny
	var tr := VBoxContainer.new()
	tr.set_anchors_preset(Control.PRESET_TOP_RIGHT)
	tr.position = Vector2(-240, 14)
	tr.custom_minimum_size = Vector2(220, 0)
	_root.add_child(tr)
	_timer_label = _mk_label(tr, 24)
	_progeny_label = _mk_label(tr, 18)

	# --- bottom-center: HP + hint
	var bc := VBoxContainer.new()
	bc.set_anchors_preset(Control.PRESET_CENTER_BOTTOM)
	bc.position = Vector2(-260, -96)
	bc.custom_minimum_size = Vector2(520, 0)
	_root.add_child(bc)
	_hp_label = _mk_label(bc, 26)
	_hint = _mk_label(bc, 17)
	_hint.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	_hint.modulate = Color(1, 1, 1, 0.9)
	_hint.text = T("WASD 移动 · Q/E 旋转视角 · 滚轮缩放\n贴近细胞注射感染 · 感染全部细胞获胜",
		"WASD move · Q/E rotate view · wheel zoom\nTouch cells to inject · infect them all to win")

	# --- toast (events)
	_toast_label = Label.new()
	_toast_label.set_anchors_preset(Control.PRESET_CENTER_TOP)
	_toast_label.position = Vector2(-400, 64)
	_toast_label.custom_minimum_size = Vector2(800, 0)
	_toast_label.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	_toast_label.add_theme_font_size_override("font_size", 25)
	_root.add_child(_toast_label)

	# --- infection progress (dedicated, under the toast)
	_infect_label = Label.new()
	_infect_label.set_anchors_preset(Control.PRESET_CENTER_TOP)
	_infect_label.position = Vector2(-400, 104)
	_infect_label.custom_minimum_size = Vector2(800, 0)
	_infect_label.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	_infect_label.add_theme_font_size_override("font_size", 22)
	_infect_label.add_theme_color_override("font_color", Color(0.95, 0.6, 0.95))
	_root.add_child(_infect_label)

	_build_end_panel()


func _load_font() -> FontFile:
	var bytes := FileAccess.get_file_as_bytes("res://assets/NotoSansSC-Regular.ttf")
	if bytes.size() == 0:
		return null
	var font := FontFile.new()
	font.data = bytes
	return font


func _mk_label(parent: Control, size: int) -> Label:
	var l := Label.new()
	l.add_theme_font_size_override("font_size", size)
	parent.add_child(l)
	return l


func _build_end_panel() -> void:
	_end_panel = Control.new()
	_end_panel.set_anchors_preset(Control.PRESET_FULL_RECT)
	_end_panel.visible = false
	_root.add_child(_end_panel)
	var dim := ColorRect.new()
	dim.color = Color(0, 0, 0, 0.65)
	dim.set_anchors_preset(Control.PRESET_FULL_RECT)
	_end_panel.add_child(dim)
	var vb := VBoxContainer.new()
	vb.set_anchors_preset(Control.PRESET_CENTER)
	vb.position = Vector2(-360, -120)
	vb.custom_minimum_size = Vector2(720, 240)
	vb.alignment = BoxContainer.ALIGNMENT_CENTER
	_end_panel.add_child(vb)
	_end_title = Label.new()
	_end_title.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	_end_title.add_theme_font_size_override("font_size", 52)
	vb.add_child(_end_title)
	_end_sub = Label.new()
	_end_sub.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	_end_sub.add_theme_font_size_override("font_size", 24)
	vb.add_child(_end_sub)


func _process(delta: float) -> void:
	if _toast_timer > 0.0:
		_toast_timer -= delta
		if _toast_timer <= 0.0:
			_toast_label.text = ""


func T(zh: String, en: String) -> String:
	return zh if _cjk else en


func update_hud(world) -> void:
	var pct := clampf(world.infection_ratio() * 100.0, 0.0, 100.0)
	_bar_fill.size.x = (320.0 - 4.0) * pct / 100.0
	_pct_label.text = "%d%%  (%d/%d)" % [int(pct), world.converted, world.total_cells()]
	_timer_label.text = "%s %d s" % [T("时间", "Time"), int(world.sim_time)]
	_progeny_label.text = "%s ● %d" % [T("子代病毒", "Progeny"), world.virus_count()]
	_hp_label.text = "HP ●●●".substr(0, 3 + maxi(world.player_hp, 0) * 2) if world.player_hp > 0 else "HP 0"

	if world.game_state == "playing" and world.sim_time > 10.0:
		_hint.visible = false

	if world.player_infecting_pct > 0.005 and world.player_infecting_pct < 1.0:
		_infect_label.text = T("注射感染中… %d%%" % int(world.player_infecting_pct * 100.0),
			"Injecting… %d%%" % int(world.player_infecting_pct * 100.0))
	else:
		_infect_label.text = ""


func toast(text: String, dur := 1.6) -> void:
	_toast_label.text = text
	_toast_timer = dur


func show_end(win: bool, extra: String) -> void:
	_end_panel.visible = true
	if win:
		_end_title.text = T("◆ 胜 利 ◆", "◆ VICTORY ◆")
		_end_title.add_theme_color_override("font_color", Color(0.6, 1.0, 0.5))
	else:
		_end_title.text = T("■ 失 败 ■", "■ DEFEAT ■")
		_end_title.add_theme_color_override("font_color", Color(1.0, 0.4, 0.35))
	_end_sub.text = extra + "\n" + T("按 R 重新开始", "Press R to restart")
