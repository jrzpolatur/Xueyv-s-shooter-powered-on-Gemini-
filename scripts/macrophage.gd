extends Node3D
## Macrophage: wanders the vessel, prioritizes eating antibody-marked
## viruses, then any virus it bumps into. Can swallow the player too.

const Util := preload("res://scripts/util.gd")
const FlowField := preload("res://scripts/flow_field.gd")

const WANDER_SPEED := 4.5
const CHASE_SPEED := 9.0
const AGGRO_MARKED := 34.0
const AGGRO_PLAIN := 16.0

var radius := 3.2
var alive := true
var velocity := Vector3.ZERO
var slow_factor := 1.0 # kept for uniformity, macrophages are not slowed
var wander_target := Vector3.ZERO
var wander_timer := 0.0
var chew_timer := 0.0
var chew_target = null
var _target = null

var _pods: Array = []
var _body_mat: StandardMaterial3D


func _ready() -> void:
	_body_mat = Util.make_mat(Util.COL_MACROPHAGE, Util.COL_MACROPHAGE * 0.25, 0.35, 0.6)
	add_child(Util.make_sphere(radius, _body_mat))
	var pod_mat := Util.make_mat(Util.COL_MACROPHAGE.darkened(0.15), Color(0, 0, 0), 0.0, 0.65)
	for i in 5:
		var pod := Util.make_sphere(radius * 0.38, pod_mat)
		add_child(pod)
		_pods.append(pod)
	var nucleus := Util.make_sphere(radius * 0.4, Util.make_mat(Color(0.1, 0.25, 0.3), Color(0, 0, 0), 0.0, 0.5))
	add_child(nucleus)
	_pick_wander_target()


func _pick_wander_target() -> void:
	var ang := randf() * TAU
	var r := sqrt(randf()) * 36.0
	wander_target = Vector3(cos(ang) * r, 0.0, sin(ang) * r)


func step(delta: float, world) -> void:
	if chew_timer > 0.0:
		chew_timer -= delta
		velocity = velocity.move_toward(Vector3.ZERO, 20.0 * delta)
		var s := 1.0 + 0.08 * sin(world.sim_time * 14.0)
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
			if wander_timer <= 0.0 or global_position.distance_to(wander_target) < 3.0:
				wander_timer = randf_range(4.0, 8.0)
				_pick_wander_target()
			desired = (wander_target - global_position).normalized() * WANDER_SPEED
		velocity = velocity.move_toward(desired, 10.0 * delta)

	global_position += velocity * delta
	global_position += world.flow.velocity_at(global_position) * 0.12 * delta
	global_position = FlowField.clamp_to_arena(global_position, world.arena_radius, radius)

	# Pseudopod blobs slowly orbit the membrane.
	for i in _pods.size():
		var pod: Node3D = _pods[i]
		var a: float = world.sim_time * (0.7 + 0.13 * float(i)) + float(i) * TAU / float(_pods.size())
		pod.position = Vector3(cos(a), 0.25 * sin(a * 1.7), sin(a)) * (radius * 0.82)

	if _target != null and chew_timer <= 0.0:
		if not is_instance_valid(_target) or not _target.alive:
			_target = null
		elif global_position.distance_to(_target.global_position) < radius + _target.radius + 0.2:
			chew_target = _target
			chew_timer = 1.4
			world.begin_eat(self, _target)
