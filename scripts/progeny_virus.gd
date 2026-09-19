extends Node3D
## A progeny virus released by lysis. Automatically seeks and infects
## the nearest healthy cell; consumed when infection succeeds.
## Smaller faceted capsid with short spikes.

const Util := preload("res://scripts/util.gd")
const FlowField := preload("res://scripts/flow_field.gd")

const RETARGET_INTERVAL := 0.5

var radius := 1.05
var max_speed := 10.0
var accel := 20.0
var flow_response := 0.55
var velocity := Vector3.ZERO
var slow_factor := 1.0
var slow_timer := 0.0
var mark_stacks := 0
var alive := true
var is_player := false

var _target = null
var _retarget_timer := 0.0
var _shell: Node3D
var _spike_root: Node3D
var _core_mat: StandardMaterial3D


func _ready() -> void:
	var body_mat := Util.make_mat(Util.COL_VIRUS.lightened(0.15), Util.COL_VIRUS_GLOW, 0.6, 0.42)
	body_mat.vertex_color_use_as_albedo = true
	_shell = Util.make_capsid(radius, body_mat, Util.make_mat(Util.COL_VIRUS.darkened(0.3), Util.COL_VIRUS_GLOW, 0.5, 0.4))
	add_child(_shell)
	_spike_root = Node3D.new()
	add_child(_spike_root)
	var spike_mat := Util.make_mat(Util.COL_VIRUS.darkened(0.25), Util.COL_VIRUS_GLOW, 0.45, 0.4)
	for i in 10:
		var k := float(i) + 0.5
		var phi := acos(1.0 - 2.0 * k / 10.0)
		var theta := PI * (1.0 + sqrt(5.0)) * k
		var dir := Vector3(sin(phi) * cos(theta), cos(phi), sin(phi) * sin(theta))
		var stem := Util.make_cylinder(0.015, 0.08, 0.5, spike_mat)
		stem.transform = Transform3D(Util.basis_y(dir), dir * (radius + 0.2))
		_spike_root.add_child(stem)
		var tip := Util.make_sphere(0.13, spike_mat, 8)
		tip.position = dir * (radius + 0.52)
		_spike_root.add_child(tip)
	_core_mat = Util.make_mat(Util.COL_VIRUS.lightened(0.3), Color(1.0, 0.45, 0.8), 1.3, 0.3)
	add_child(Util.make_sphere(radius * 0.45, _core_mat, 12))


func step(delta: float, world) -> void:
	_retarget_timer -= delta
	if _retarget_timer <= 0.0:
		_retarget_timer = RETARGET_INTERVAL
		_target = world.nearest_healthy_cell(global_position)

	var desired := velocity
	if _target != null and is_instance_valid(_target) and _target.alive:
		var to_target: Vector3 = _target.global_position - global_position
		desired = to_target.normalized() * max_speed * slow_factor
	velocity = velocity.move_toward(desired, accel * delta)
	global_position += velocity * delta
	global_position += world.flow.velocity_at(global_position) * flow_response * delta
	global_position = FlowField.clamp_to_arena(global_position, world.arena_radius)

	_shell.rotate_y(delta * 1.6)
	_spike_root.rotate_y(-delta * 1.1)
	if slow_timer > 0.0:
		slow_timer -= delta
		if slow_timer <= 0.0:
			slow_factor = 1.0
