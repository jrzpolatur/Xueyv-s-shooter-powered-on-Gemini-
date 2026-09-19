extends Node3D
## Macrophage: slowly patrols, prioritizes eating antibody-marked viruses,
## then any virus it bumps into. Can swallow the player too.
## Model: ruffled organic blob, pseudopod crowns, internal vesicles,
## kidney nucleus. Slow crawler with squash-stretch.

const Util := preload("res://scripts/util.gd")
const FlowField := preload("res://scripts/flow_field.gd")

const WANDER_SPEED := 2.6
const CHASE_SPEED := 5.0
const ACCEL := 5.0
const AGGRO_MARKED := 42.0
const AGGRO_PLAIN := 18.0

var radius := 4.6
var alive := true
var velocity := Vector3.ZERO
var slow_factor := 1.0
var wander_target := Vector3.ZERO
var wander_timer := 0.0
var chew_timer := 0.0
var chew_target = null
var _target = null

var _blob: MeshInstance3D
var _body_mat: StandardMaterial3D
var _pods: Array = []
var _seed := 0


func _ready() -> void:
	_seed = randi() % 1000
	_body_mat = Util.make_mat(Util.COL_MACROPHAGE, Util.COL_MACROPHAGE * 0.2, 0.28, 0.6)
	_body_mat.vertex_color_use_as_albedo = true
	_blob = Util.make_blob(radius, 0.14, _seed, _body_mat)
	add_child(_blob)

	# ruffled membrane crown
	var pod_mat := Util.make_mat(Util.COL_MACROPHAGE.darkened(0.12), Color(0, 0, 0), 0.0, 0.65)
	for i in 8:
		var pod := Util.make_blob(radius * 0.30, 0.2, _seed + i * 13, pod_mat)
		add_child(pod)
		_pods.append(pod)

	# kidney-shaped nucleus: two overlapping spheres
	var nuc_mat := Util.make_mat(Color(0.08, 0.22, 0.26), Color(0, 0, 0), 0.0, 0.5)
	var n1 := Util.make_sphere(radius * 0.34, nuc_mat, 14)
	n1.position = Vector3(-0.15 * radius, 0.22 * radius, 0.1 * radius)
	var n2 := Util.make_sphere(radius * 0.28, nuc_mat, 14)
	n2.position = n1.position + Vector3(0.34 * radius, -0.05 * radius, 0.12 * radius)
	add_child(n1)
	add_child(n2)

	# internal vesicles
	var ves_mat := Util.make_mat(Util.COL_MACROPHAGE.darkened(0.28), Color(0, 0, 0), 0.0, 0.55)
	for i in 4:
		var v := Util.make_sphere(radius * 0.12, ves_mat, 8)
		v.position = Vector3(sin(float(i) * 2.1), 0.4 * cos(float(i) * 1.3), cos(float(i) * 2.7)) * radius * 0.5
		add_child(v)

	_pick_wander_target()


func _pick_wander_target() -> void:
	var ang := randf() * TAU
	var r := sqrt(randf()) * 56.0
	wander_target = Vector3(cos(ang) * r, 0.0, sin(ang) * r)


func step(delta: float, world) -> void:
	if chew_timer > 0.0:
		chew_timer -= delta
		velocity = velocity.move_toward(Vector3.ZERO, 12.0 * delta)
		var s := 1.0 + 0.06 * sin(world.sim_time * 11.0)
		scale = Vector3(s, s, s)
		if chew_timer <= 0.0 and chew_target != null:
			world.finish_eat(self, chew_target)
			chew_target = null
	else:
		_target = world.pick_macrophage_target(self)
		var desired := Vector3.ZERO
		if _target != null:
			desired = (_target.global_position - global_position).normalized() * CHASE_SPEED
		else:
			wander_timer -= delta
			if wander_timer <= 0.0 or global_position.distance_to(wander_target) < 4.0:
				wander_timer = randf_range(6.0, 11.0)
				_pick_wander_target()
			desired = (wander_target - global_position).normalized() * WANDER_SPEED
		velocity = velocity.move_toward(desired, ACCEL * delta)

	global_position += velocity * delta
	global_position += world.flow.velocity_at(global_position) * 0.1 * delta
	global_position = FlowField.clamp_to_arena(global_position, world.arena_radius, radius)

	# pseudopods crawl around the membrane; lean toward target when chasing
	var lean := Vector3.ZERO
	if _target != null:
		lean = (_target.global_position - global_position).normalized() * radius * 0.25
	for i in _pods.size():
		var pod: Node3D = _pods[i]
		var a: float = world.sim_time * (0.4 + 0.07 * float(i)) + float(i) * TAU / float(_pods.size())
		pod.position = lean + Vector3(cos(a), 0.22 * sin(a * 1.6), sin(a)) * (radius * 0.86)
		var s := 1.0 + 0.15 * sin(world.sim_time * 2.0 + float(i))
		pod.scale = Vector3(s, s, s)

	# slow body roll
	_blob.rotate_z(delta * 0.1)
