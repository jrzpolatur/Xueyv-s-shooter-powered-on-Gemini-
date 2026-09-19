extends Node3D
## A body cell. Healthy -> infected (by virus contact) -> lyses, releasing
## progeny viruses. Organic membrane blob, visible organelles, infection ring.

const Util := preload("res://scripts/util.gd")
const FlowField := preload("res://scripts/flow_field.gd")

const LYSIS_DELAY := 5.0

var radius := 2.3
var alive := true
var state := 0 # 0 healthy, 1 infected, 2 lysed
var infect_progress := 0.0
var lysis_timer := 0.0
var wander_phase := 0.0

var _blob: MeshInstance3D
var _body_mat: StandardMaterial3D
var _nucleus_mat: StandardMaterial3D
var _ring: MeshInstance3D
var _ring_mat: StandardMaterial3D
var _mito: Array = []
var _seed := 0


func _ready() -> void:
	_seed = randi() % 1000
	wander_phase = randf() * TAU
	# --- organic membrane (noise-displaced flat-shaded blob)
	_body_mat = Util.make_mat(Util.COL_CELL, Color(0, 0, 0), 0.0, 0.65)
	_body_mat.vertex_color_use_as_albedo = true
	_blob = Util.make_blob(radius, 0.16, _seed, _body_mat)
	add_child(_blob)

	# --- nucleus + nucleolus
	_nucleus_mat = Util.make_mat(Util.COL_NUCLEUS, Color(0, 0, 0), 0.0, 0.55)
	var nucleus := Util.make_sphere(radius * 0.46, _nucleus_mat, 18)
	nucleus.position = Vector3(0.25 * radius, 0.4 * radius, 0.1)
	add_child(nucleus)
	var nucleolus := Util.make_sphere(radius * 0.16, Util.make_mat(Util.COL_NUCLEUS.darkened(0.25), Color(0, 0, 0), 0.0, 0.5), 10)
	nucleolus.position = nucleus.position + Vector3(0.2 * radius, 0.15 * radius, 0.15 * radius)
	add_child(nucleolus)

	# --- mitochondria (capsules) + vesicles
	var mito_mat := Util.make_mat(Util.COL_MITO, Color(0, 0, 0), 0.0, 0.6)
	for i in 3:
		var m := Util.make_capsule(radius * 0.13, radius * 0.5, mito_mat)
		var dir := _dir_on_sphere(i, 3)
		m.transform = Transform3D(Util.basis_y(dir) * Basis(Vector3.RIGHT, 0.8 + 0.4 * float(i)), dir * radius * 0.55)
		add_child(m)
		_mito.append(m)
	var ves_mat := Util.make_mat(Util.COL_CELL.darkened(0.12), Color(0, 0, 0), 0.0, 0.5)
	for i in 3:
		var v := Util.make_sphere(radius * 0.10, ves_mat, 8)
		v.position = _dir_on_sphere(i + 3, 6) * radius * 0.62
		add_child(v)

	# --- infection progress ring
	_ring_mat = Util.make_mat(Util.COL_CELL_INFECTED, Util.COL_CELL_INFECTED, 2.2, 0.3)
	_ring = Util.make_torus(radius + 0.25, radius + 0.5, _ring_mat)
	_ring.rotation.x = PI / 2.0
	_ring.visible = false
	add_child(_ring)


func _dir_on_sphere(i: int, n: int) -> Vector3:
	var k := float(i) + 0.5
	var phi := acos(1.0 - 2.0 * k / float(n))
	var theta := PI * (1.0 + sqrt(5.0)) * k
	return Vector3(sin(phi) * cos(theta), cos(phi), sin(phi) * sin(theta))


func step(delta: float, world) -> void:
	global_position += world.flow.velocity_at(global_position) * delta
	global_position += Vector3(
		sin(world.sim_time * 0.5 + wander_phase) * 0.5,
		0.0,
		cos(world.sim_time * 0.42 + wander_phase * 1.3) * 0.5
	) * delta
	global_position = FlowField.clamp_to_arena(global_position, world.arena_radius, radius + 1.0)

	# breathing + slow tumble
	var breath := 1.0 + 0.035 * sin(world.sim_time * 1.7 + wander_phase)
	_blob.scale = Vector3(breath, 2.0 - breath, breath)
	_blob.rotate_y(delta * 0.08)
	for m in _mito:
		m.rotate_x(delta * 0.3)

	if state == 0:
		_ring.visible = infect_progress > 0.01
		var s := 0.35 + 0.65 * clampf(infect_progress, 0.0, 1.0)
		_ring.scale = Vector3(s, s, s)
	elif state == 1:
		var pulse := 1.0 + 0.5 * sin(world.sim_time * 7.0 + wander_phase)
		_body_mat.emission_enabled = true
		_body_mat.emission = Util.COL_CELL_INFECTED
		_body_mat.emission_energy_multiplier = pulse
		_nucleus_mat.emission_enabled = true
		_nucleus_mat.emission = Util.COL_CELL_INFECTED.darkened(0.3)
		_nucleus_mat.emission_energy_multiplier = pulse * 0.7
		lysis_timer -= delta
		if lysis_timer <= 0.0:
			world.lyse_cell(self)
