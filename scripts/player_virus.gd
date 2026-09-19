extends Node3D
## The player: an infective virus. WASD to swim, Q/E rotates the camera.

const Util := preload("res://scripts/util.gd")
const FlowField := preload("res://scripts/flow_field.gd")

const MARK_DECAY := 6.0

var radius := 1.3
var max_speed := 15.0
var accel := 42.0
var flow_response := 0.45
var velocity := Vector3.ZERO
var slow_factor := 1.0
var slow_timer := 0.0
var mark_stacks := 0
var mark_timer := 0.0
var alive := true
var is_player := true

var _spike_root: Node3D
var _halo: MeshInstance3D
var _body_mat: StandardMaterial3D


func _ready() -> void:
	_body_mat = Util.make_mat(Util.COL_VIRUS, Util.COL_VIRUS_GLOW, 0.9, 0.5)
	var body := Util.make_sphere(radius, _body_mat)
	add_child(body)

	_spike_root = Node3D.new()
	add_child(_spike_root)
	var spike_mat := Util.make_mat(Util.COL_VIRUS.darkened(0.25), Util.COL_VIRUS_GLOW, 0.4, 0.5)
	for i in 14:
		var dir := _spike_dir(i, 14)
		var spike := Util.make_cylinder(0.02, 0.24, 1.0, spike_mat)
		spike.transform = Transform3D(Util.basis_y(dir), dir * (radius + 0.45))
		_spike_root.add_child(spike)

	_halo = Util.make_torus(radius + 0.35, radius + 0.65, Util.make_mat(Util.COL_MARK, Util.COL_MARK, 2.0, 0.4))
	_halo.rotation.x = PI / 2.0
	_halo.visible = false
	add_child(_halo)


func _spike_dir(i: int, n: int) -> Vector3:
	# Evenly distributed points on a sphere (spiral distribution).
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

	_spike_root.rotate_y(delta * 1.6)
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
		_halo.scale = Vector3.ONE * (1.0 + 0.08 * float(mark_stacks))
	var e := 0.9
	if slow_timer > 0.0:
		e = 0.5
	_body_mat.emission_energy_multiplier = e + 0.25 * sin(global_position.x * 0.7 + global_position.z * 0.9)
