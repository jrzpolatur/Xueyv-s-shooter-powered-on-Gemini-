class_name HealField
extends Node2D
## 治愈领域：持续回复领域主人的生命。

var owner_unit: Unit
var life := 3.2
var radius := 135.0


func _ready() -> void:
	z_index = 2


func _process(delta: float) -> void:
	life -= delta
	queue_redraw()
	if owner_unit != null and is_instance_valid(owner_unit) and owner_unit.alive \
			and owner_unit.global_position.distance_to(global_position) <= radius:
		owner_unit.heal(14.0 * delta, false)
	if life <= 0.0:
		queue_free()


func _draw() -> void:
	var pulse := 0.9 + sin(Time.get_ticks_msec() * 0.008) * 0.1
	draw_circle(Vector2.ZERO, radius * pulse, Color(0.4, 1.0, 0.55, 0.13))
	draw_arc(Vector2.ZERO, radius * pulse, 0.0, TAU, 48, Color(0.5, 1.0, 0.6, 0.6), 3.0)
	draw_arc(Vector2.ZERO, radius * 0.55 * pulse, 0.0, TAU, 32, Color(0.5, 1.0, 0.6, 0.3), 2.0)
