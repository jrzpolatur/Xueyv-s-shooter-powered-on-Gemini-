class_name Menu
extends CanvasLayer
## 主菜单：角色外观 + 武器 / 技能 / 道具 自由组合配装。

signal start_requested

var desc_labels := {}


func _ready() -> void:
	layer = 5
	var root := Control.new()
	root.set_anchors_preset(Control.PRESET_FULL_RECT)
	add_child(root)

	var bg := TextureRect.new()
	bg.texture = load("res://assets/img/menu_bg.png")
	bg.expand_mode = TextureRect.EXPAND_IGNORE_SIZE
	bg.stretch_mode = TextureRect.STRETCH_KEEP_ASPECT_COVERED
	bg.set_anchors_preset(Control.PRESET_FULL_RECT)
	bg.modulate = Color(0.6, 0.6, 0.7)
	root.add_child(bg)

	var centerer := CenterContainer.new()
	centerer.set_anchors_preset(Control.PRESET_FULL_RECT)
	root.add_child(centerer)
	var center := VBoxContainer.new()
	center.alignment = BoxContainer.ALIGNMENT_CENTER
	center.add_theme_constant_override("separation", 14)
	centerer.add_child(center)

	var title := Label.new()
	title.text = "雪 羽 乱 斗"
	title.add_theme_font_size_override("font_size", 64)
	title.add_theme_color_override("font_color", Color(1, 1, 1))
	title.add_theme_color_override("font_outline_color", Color(0.15, 0.3, 0.9, 0.9))
	title.add_theme_constant_override("outline_size", 14)
	title.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	center.add_child(title)

	var sub := Label.new()
	sub.text = "Xueyv's Hero Shooter · 武器 × 技能 × 道具 自由组合"
	sub.add_theme_font_size_override("font_size", 19)
	sub.add_theme_color_override("font_color", Color(0.85, 0.9, 1.0))
	sub.add_theme_color_override("font_outline_color", Color(0, 0, 0, 0.8))
	sub.add_theme_constant_override("outline_size", 5)
	sub.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	center.add_child(sub)

	# —— 模式选择 ——
	var mode_row := HBoxContainer.new()
	mode_row.alignment = BoxContainer.ALIGNMENT_CENTER
	mode_row.add_theme_constant_override("separation", 14)
	center.add_child(mode_row)
	var mode_group := ButtonGroup.new()
	var mode_desc := Label.new()
	for key in Catalog.MODES:
		var mdef: Dictionary = Catalog.MODES[key]
		var mbtn := _opt_button(String(mdef["name"]), mode_group)
		mbtn.custom_minimum_size = Vector2(220, 46)
		mbtn.add_theme_font_size_override("font_size", 20)
		mbtn.button_pressed = (G.mode == key)
		mbtn.toggled.connect(func(on: bool):
			if on:
				G.mode = key
				mode_desc.text = String(mdef["desc"])
				G.play_sfx("ui"))
		mode_row.add_child(mbtn)
	mode_desc.text = String(Catalog.MODES[G.mode]["desc"])
	mode_desc.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	mode_desc.add_theme_font_size_override("font_size", 15)
	mode_desc.add_theme_color_override("font_color", Color(0.75, 0.9, 1.0))
	mode_desc.add_theme_color_override("font_outline_color", Color(0, 0, 0, 0.8))
	mode_desc.add_theme_constant_override("outline_size", 4)
	center.add_child(mode_desc)

	var cols := HBoxContainer.new()
	cols.add_theme_constant_override("separation", 14)
	cols.alignment = BoxContainer.ALIGNMENT_CENTER
	center.add_child(cols)

	cols.add_child(_chara_column())
	cols.add_child(_pick_column("武 器", "weapon", Catalog.WEAPONS))
	cols.add_child(_pick_column("技 能", "skill", Catalog.SKILLS))
	cols.add_child(_pick_column("道 具", "item", Catalog.ITEMS))

	var start := Button.new()
	start.text = "开 始 战 斗"
	start.focus_mode = Control.FOCUS_NONE
	start.custom_minimum_size = Vector2(280, 62)
	start.add_theme_font_size_override("font_size", 28)
	start.add_theme_stylebox_override("normal", _style(Color(0.95, 0.55, 0.15, 0.97), 16))
	start.add_theme_stylebox_override("hover", _style(Color(1.0, 0.65, 0.25, 1.0), 16))
	start.add_theme_stylebox_override("pressed", _style(Color(0.8, 0.45, 0.1, 1.0), 16))
	start.pressed.connect(func():
		G.play_sfx("ui")
		start_requested.emit())
	var start_wrap := HBoxContainer.new()
	start_wrap.alignment = BoxContainer.ALIGNMENT_CENTER
	start_wrap.add_child(start)
	center.add_child(start_wrap)

	var hint := Label.new()
	hint.text = "电脑：WASD 移动 · 鼠标瞄准 · 左键射击 · 空格/右键技能      手机：左摇杆移动 · 右摇杆瞄准射击"
	hint.add_theme_font_size_override("font_size", 15)
	hint.add_theme_color_override("font_color", Color(1, 1, 1, 0.75))
	hint.add_theme_color_override("font_outline_color", Color(0, 0, 0, 0.8))
	hint.add_theme_constant_override("outline_size", 4)
	hint.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	center.add_child(hint)


func _chara_column() -> PanelContainer:
	var panel := PanelContainer.new()
	panel.add_theme_stylebox_override("panel", _style(Color(0.07, 0.09, 0.16, 0.88), 14))
	var box := VBoxContainer.new()
	box.add_theme_constant_override("separation", 6)
	panel.add_child(box)
	box.add_child(_header("角 色"))
	var row := HBoxContainer.new()
	row.add_theme_constant_override("separation", 8)
	box.add_child(row)
	var group := ButtonGroup.new()
	for key in Catalog.CHARS:
		var cdef: Dictionary = Catalog.CHARS[key]
		var cell := VBoxContainer.new()
		cell.alignment = BoxContainer.ALIGNMENT_CENTER
		var tex := TextureRect.new()
		tex.texture = load(cdef["tex"])
		tex.expand_mode = TextureRect.EXPAND_IGNORE_SIZE
		tex.stretch_mode = TextureRect.STRETCH_KEEP_ASPECT_CENTERED
		tex.custom_minimum_size = Vector2(86, 86)
		cell.add_child(tex)
		var btn := _opt_button(String(cdef["name"]), group)
		btn.button_pressed = (G.loadout["chara"] == key)
		btn.toggled.connect(func(on: bool):
			if on:
				G.loadout["chara"] = key
				G.play_sfx("ui"))
		cell.add_child(btn)
		row.add_child(cell)
	return panel


func _pick_column(header: String, slot: String, data: Dictionary) -> PanelContainer:
	var panel := PanelContainer.new()
	panel.add_theme_stylebox_override("panel", _style(Color(0.07, 0.09, 0.16, 0.88), 14))
	var box := VBoxContainer.new()
	box.add_theme_constant_override("separation", 6)
	panel.add_child(box)
	box.add_child(_header(header))
	var group := ButtonGroup.new()
	var desc := Label.new()
	for key in data:
		var ddef: Dictionary = data[key]
		var btn := _opt_button(String(ddef["name"]), group)
		btn.button_pressed = (G.loadout[slot] == key)
		btn.toggled.connect(func(on: bool):
			if on:
				G.loadout[slot] = key
				desc.text = String(ddef["desc"])
				G.play_sfx("ui"))
		box.add_child(btn)
	desc.text = String(data[G.loadout[slot]]["desc"])
	desc.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	desc.custom_minimum_size = Vector2(190, 58)
	desc.add_theme_font_size_override("font_size", 14)
	desc.add_theme_color_override("font_color", Color(0.75, 0.85, 1.0, 0.95))
	box.add_child(desc)
	desc_labels[slot] = desc
	return panel


func _header(text: String) -> Label:
	var l := Label.new()
	l.text = text
	l.add_theme_font_size_override("font_size", 22)
	l.add_theme_color_override("font_color", Color(1, 0.85, 0.45))
	l.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	return l


func _opt_button(text: String, group: ButtonGroup) -> Button:
	var b := Button.new()
	b.text = text
	b.toggle_mode = true
	b.button_group = group
	b.focus_mode = Control.FOCUS_NONE
	b.custom_minimum_size = Vector2(170, 40)
	b.add_theme_font_size_override("font_size", 18)
	b.add_theme_stylebox_override("normal", _style(Color(0.14, 0.18, 0.28, 0.9), 10))
	b.add_theme_stylebox_override("hover", _style(Color(0.2, 0.26, 0.4, 0.95), 10))
	b.add_theme_stylebox_override("pressed", _style(Color(0.9, 0.5, 0.14, 0.95), 10))
	return b


func _style(color: Color, radius: int) -> StyleBoxFlat:
	var sb := StyleBoxFlat.new()
	sb.bg_color = color
	sb.corner_radius_top_left = radius
	sb.corner_radius_top_right = radius
	sb.corner_radius_bottom_left = radius
	sb.corner_radius_bottom_right = radius
	sb.content_margin_left = 12
	sb.content_margin_right = 12
	sb.content_margin_top = 8
	sb.content_margin_bottom = 8
	return sb
