class_name VirtualJoystick
extends Control
## 触屏虚拟摇杆：左摇杆移动，右摇杆瞄准+射击。

var value := Vector2.ZERO
var active := false
var touch_id := -1
var base_radius := 86.0
var knob_radius := 38.0
var accent := Color(1, 1, 1)


func _ready() -> void:
	custom_minimum_size = Vector2(230, 230)
	mouse_filter = Control.MOUSE_FILTER_IGNORE


func _process(_delta: float) -> void:
	queue_redraw()


func _input(event: InputEvent) -> void:
	if event is InputEventScreenTouch:
		var st := event as InputEventScreenTouch
		if st.pressed and touch_id == -1 and get_global_rect().has_point(st.position):
			touch_id = st.index
			active = true
			_update_value(st.position)
		elif not st.pressed and st.index == touch_id:
			touch_id = -1
			active = false
			value = Vector2.ZERO
	elif event is InputEventScreenDrag:
		var dg := event as InputEventScreenDrag
		if dg.index == touch_id:
			_update_value(dg.position)


func _update_value(screen_pos: Vector2) -> void:
	var center := get_global_rect().get_center()
	var v := (screen_pos - center) / base_radius
	value = v.limit_length(1.0)


func _draw() -> void:
	var c := size / 2.0
	draw_circle(c, base_radius, Color(0, 0, 0, 0.25))
	draw_arc(c, base_radius, 0.0, TAU, 48, Color(accent, 0.5), 3.0)
	var knob_pos := c + value * base_radius * 0.62
	draw_circle(knob_pos, knob_radius, Color(accent, 0.55 if active else 0.3))
	draw_circle(knob_pos, knob_radius * 0.55, Color(1, 1, 1, 0.5))
