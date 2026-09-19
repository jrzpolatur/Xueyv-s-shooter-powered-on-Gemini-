extends Node3D
## A progeny virus released by lysis. Automatically seeks and infects
## the nearest healthy cell; consumed when infection succeeds.

const Util := preload("res://scripts/util.gd")
const FlowField := preload("res://scripts/flow_field.gd")

const RETARGET_INTERVAL := 0.5

var radius := 0.75
var max_speed := 11.0
var accel := 26.0
var flow_response := 0.6
var velocity := Vector3.ZERO
var slow_factor := 1.0
var slow_timer := 0.0
var mark_stacks := 0
var alive := true
var is_player := false

var _target = null
var _retarget_timer := 0.0
var _spike_root: Node3D


func _ready() -> void:
	var body_mat := Util.make_mat(Util.COL_VIRUS.lightened(0.15), Util.COL_VIRUS_GLOW, 1.1, 0.5)
	add_child(Util.make_sphere(radius, body_mat))
	_spike_root = Node3D.new()
	add_child(_spike_root)
	var spike_mat := Util.make_mat(Util.COL_VIRUS.darkened(0.2), Util.COL_VIRUS_GLOW, 0.5, 0.5)
	for i in 8:
		var k := float(i) + 0.5
		var phi := acos(1.0 - 2.0 * k / 8.0)
		var theta := PI * (1.0 + sqrt(5.0)) * k
		var dir := Vector3(sin(phi) * cos(theta), cos(phi), sin(phi) * sin(theta))
		var spike := Util.make_cylinder(0.01, 0.12, 0.55, spike_mat)
		spike.transform = Transform3D(Util.basis_y(dir), dir * (radius + 0.22))
		_spike_root.add_child(spike)


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

	_spike_root.rotate_y(delta * 3.0)
	if slow_timer > 0.0:
		slow_timer -= delta
		if slow_timer <= 0.0:
			slow_factor = 1.0
