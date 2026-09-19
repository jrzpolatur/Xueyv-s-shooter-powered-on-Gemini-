extends Node3D
## The player: an infective virus. WASD to swim, Q/E rotates the camera.
## Model: faceted capsid (flat-shaded icosphere, alternating facets),
## knobbed spikes on every vertex, translucent envelope + glowing core.

const Util := preload("res://scripts/util.gd")
const FlowField := preload("res://scripts/flow_field.gd")

const MARK_DECAY := 6.0

var radius := 1.7
var max_speed := 16.0
var accel := 36.0
var flow_response := 0.4
var velocity := Vector3.ZERO
var slow_factor := 1.0
var slow_timer := 0.0
var mark_stacks := 0
var mark_timer := 0.0
var alive := true
var is_player := true

var _shell: Node3D
var _spike_root: Node3D
var _halo: MeshInstance3D
var _envelope_mat: StandardMaterial3D
var _core_mat: StandardMaterial3D


func _ready() -> void:
	# --- faceted capsid shell
	var body_mat := Util.make_mat(Util.COL_VIRUS, Util.COL_VIRUS_GLOW, 0.55, 0.42)
	body_mat.vertex_color_use_as_albedo = true
	_shell = Util.make_capsid(radius, body_mat, Util.make_mat(Util.COL_VIRUS.darkened(0.35), Util.COL_VIRUS_GLOW, 0.5, 0.4))
	add_child(_shell)

	# --- long crown spikes with knob tips (the classic corona silhouette)
	_spike_root = Node3D.new()
	add_child(_spike_root)
	var spike_mat := Util.make_mat(Util.COL_VIRUS_DARK, Util.COL_VIRUS_GLOW, 0.45, 0.4)
	var tip_mat := Util.make_mat(Util.COL_VIRUS.lightened(0.2), Util.COL_VIRUS_GLOW, 0.9, 0.35)
	for i in 18:
		var dir := _spike_dir(i, 18)
		var stem := Util.make_cylinder(0.025, 0.16, 0.95, spike_mat)
		stem.transform = Transform3D(Util.basis_y(dir), dir * (radius + 0.42))
		_spike_root.add_child(stem)
		var tip := Util.make_sphere(0.24, tip_mat, 12)
		tip.position = dir * (radius + 1.0)
		_spike_root.add_child(tip)

	# --- translucent envelope + inner glowing core
	_envelope_mat = Util.make_mat(Color(1.0, 0.4, 0.7, 0.16), Util.COL_VIRUS_GLOW, 0.25, 0.1)
	_envelope_mat.transparency = BaseMaterial3D.TRANSPARENCY_ALPHA
	_envelope_mat.cull_mode = BaseMaterial3D.CULL_DISABLED
	_envelope_mat.no_depth_test = false
	add_child(Util.make_sphere(radius * 1.28, _envelope_mat, 24))
	_core_mat = Util.make_mat(Util.COL_VIRUS.lightened(0.35), Color(1.0, 0.45, 0.8), 1.6, 0.3)
	add_child(Util.make_sphere(radius * 0.42, _core_mat, 16))

	# --- antibody mark halo
	_halo = Util.make_torus(radius + 0.5, radius + 0.85, Util.make_mat(Util.COL_MARK, Util.COL_MARK, 2.2, 0.4))
	_halo.rotation.x = PI / 2.0
	_halo.visible = false
	add_child(_halo)


func _spike_dir(i: int, n: int) -> Vector3:
	var k := float(i) + 0.5
	var phi := acos(1.0 - 2.0 * k / float(n))
	var theta := PI * (1.0 + sqrt(5.0)) * k
	return Vector3(sin(phi) * cos(theta), cos(phi), sin(phi) * sin(theta))


func step(delta: float, world) -> void:
	var input2 := Input.get_vector("move_left", "move_right", "move_up", "move_down")
	var dir := Vector3(input2.x, 0.0, input2.y).rotated(Vector3.UP, world.cam_yaw)
	if dir.length_squared() > 1.0:
		dir = dir.normalized()
	if world.smoke_test:
		var goal = world.nearest_healthy_cell(global_position)
		if goal != null:
			dir = (goal.global_position - global_position)
			dir.y = 0.0
			dir = dir.normalized()
	var target_v := dir * max_speed * slow_factor
	velocity = velocity.move_toward(target_v, accel * delta)
	global_position += velocity * delta
	global_position += world.flow.velocity_at(global_position) * flow_response * delta
	global_position = FlowField.clamp_to_arena(global_position, world.arena_radius)

	_shell.rotate_y(delta * 0.7)
	_spike_root.rotate_y(-delta * 0.45)
	tick_status(delta)
	_update_visuals()


func tick_status(delta: float) -> void:
	if slow_timer > 0.0:
		slow_timer -= delta
		if slow_timer <= 0.0:
			slow_factor = 1.0
	if mark_timer > 0.0:
		mark_timer -= delta
		if mark_timer <= 0.0 and mark_stacks > 0:
			mark_stacks -= 1
			mark_timer = MARK_DECAY if mark_stacks > 0 else 0.0


func apply_antibody() -> void:
	slow_factor = 0.5
	slow_timer = 5.0
	mark_stacks = mini(mark_stacks + 1, 5)
	mark_timer = MARK_DECAY


func _update_visuals() -> void:
	var marked := mark_stacks > 0
	_halo.visible = marked
	if marked:
		_halo.scale = Vector3.ONE * (1.0 + 0.07 * float(mark_stacks))
	# core pulses faster when slowed (danger)
	var rate := 6.0 if slow_timer > 0.0 else 2.6
	var p := 1.3 + 0.5 * sin(world_time() * rate)
	_core_mat.emission_energy_multiplier = p


var _t := 0.0

func world_time() -> float:
	_t += get_process_delta_time()
	return _t
