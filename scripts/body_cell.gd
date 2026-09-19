extends Node3D
## A body cell. Healthy -> infected (by virus contact) -> lyses, releasing
## progeny viruses. Shows infection progress with a growing ring.

const Util := preload("res://scripts/util.gd")
const FlowField := preload("res://scripts/flow_field.gd")

const LYSIS_DELAY := 5.0

var radius := 1.6
var alive := true
var state := 0 # 0 healthy, 1 infected, 2 lysed
var infect_progress := 0.0
var lysis_timer := 0.0
var wander_phase := 0.0

var _body_mat: StandardMaterial3D
var _nucleus_mat: StandardMaterial3D
var _ring: MeshInstance3D
var _ring_mat: StandardMaterial3D


func _ready() -> void:
	wander_phase = randf() * TAU
	_body_mat = Util.make_mat(Util.COL_CELL, Color(0, 0, 0), 0.0, 0.7)
	add_child(Util.make_sphere(radius, _body_mat))
	_nucleus_mat = Util.make_mat(Util.COL_NUCLEUS, Color(0, 0, 0), 0.0, 0.6)
	var nucleus := Util.make_sphere(radius * 0.45, _nucleus_mat)
	nucleus.position = Vector3(0.2, 0.35, 0.1)
	add_child(nucleus)

	_ring_mat = Util.make_mat(Util.COL_CELL_INFECTED, Util.COL_CELL_INFECTED, 2.2, 0.3)
	_ring = Util.make_torus(radius + 0.15, radius + 0.35, _ring_mat)
	_ring.rotation.x = PI / 2.0
	_ring.visible = false
	add_child(_ring)


func step(delta: float, world) -> void:
	global_position += world.flow.velocity_at(global_position) * delta
	global_position += Vector3(
		sin(world.sim_time * 0.6 + wander_phase) * 0.4,
		0.0,
		cos(world.sim_time * 0.5 + wander_phase * 1.3) * 0.4
	) * delta
	global_position = FlowField.clamp_to_arena(global_position, world.arena_radius, radius + 1.0)

	if state == 0:
		_ring.visible = infect_progress > 0.01
		var s := 0.35 + 0.65 * clampf(infect_progress, 0.0, 1.0)
		_ring.scale = Vector3(s, s, s)
	elif state == 1:
		var pulse := 1.15 + 0.45 * sin(world.sim_time * 8.0 + wander_phase)
		_body_mat.emission_enabled = true
		_body_mat.emission = Util.COL_CELL_INFECTED
		_body_mat.emission_energy_multiplier = pulse
		lysis_timer -= delta
		if lysis_timer <= 0.0:
			world.lyse_cell(self)
