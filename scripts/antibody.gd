extends Node3D
## A Y-shaped antibody projectile (IgG): Fc stem + hinged Fab arms,
## each arm in two segments ending in antigen-binding tips.
## Slower now, easier to read and dodge. Spins gently in flight.

const Util := preload("res://scripts/util.gd")
const FlowField := preload("res://scripts/flow_field.gd")

const SPEED := 13.0
const LIFETIME := 9.0
const TURN := 1.7

var radius := 0.7
var alive := true
var velocity := Vector3.ZERO
var life := LIFETIME
var target = null

var _spin := 0.0
var _body: Node3D


func _ready() -> void:
	_body = Node3D.new()
	add_child(_body)
	var mat := Util.make_mat(Util.COL_ANTIBODY, Util.COL_ANTIBODY * 0.55, 0.55, 0.3)
	var joint_mat := Util.make_mat(Color(0.80, 0.86, 0.98), Util.COL_ANTIBODY * 0.3, 0.4, 0.35)
	var tip_mat := Util.make_mat(Color(1, 1, 1), Util.COL_ANTIBODY, 1.2, 0.25)

	# --- Fc stem (double strand look: two parallel thin capsules)
	for side in [-1.0, 1.0]:
		var strand := Util.make_capsule(0.055, 0.62, mat)
		strand.position = Vector3(side * 0.065, -0.36, 0)
		_body.add_child(strand)
	var stem_foot := Util.make_sphere(0.11, joint_mat, 10)
	stem_foot.position = Vector3(0, -0.68, 0)
	_body.add_child(stem_foot)

	# --- hinge
	var hinge := Util.make_sphere(0.13, joint_mat, 10)
	hinge.position = Vector3(0, -0.05, 0)
	_body.add_child(hinge)

	# --- Fab arms: two segments each, bent at the elbow
	for side in [-1.0, 1.0]:
		var upper := Util.make_capsule(0.07, 0.46, mat)
		upper.rotation.z = side * 0.55
		upper.position = Vector3(side * 0.20, 0.16, 0)
		_body.add_child(upper)
		var elbow := Util.make_sphere(0.10, joint_mat, 8)
		elbow.position = Vector3(side * 0.40, 0.36, 0)
		_body.add_child(elbow)
		var lower := Util.make_capsule(0.06, 0.36, mat)
		lower.rotation.z = side * 1.15
		lower.position = Vector3(side * 0.56, 0.62, 0)
		_body.add_child(lower)
		var fab_tip := Util.make_sphere(0.13, tip_mat, 10)
		fab_tip.position = Vector3(side * 0.72, 0.86, 0)
		_body.add_child(fab_tip)

	_spin = randf() * TAU


func launch(from: Vector3, initial_dir: Vector3, p_target) -> void:
	global_position = from
	target = p_target
	velocity = initial_dir.normalized() * SPEED


func step(delta: float, world) -> void:
	life -= delta
	if life <= 0.0:
		alive = false
		return

	var t = target
	if t == null or not is_instance_valid(t) or not t.alive:
		t = world.player
		target = t
	if t != null and t.alive:
		var to_t: Vector3 = t.global_position - global_position
		if to_t.length() < 36.0:
			var desired := to_t.normalized() * SPEED
			velocity = velocity.slerp(desired, minf(1.0, TURN * delta)).normalized() * SPEED

	global_position += velocity * delta
	global_position += world.flow.velocity_at(global_position) * 0.15 * delta

	# gentle spin + bob around flight axis
	_spin += delta * 2.4
	_body.rotation.y = _spin

	if velocity.length_squared() > 0.01:
		var fwd := velocity.normalized()
		if absf(fwd.y) < 0.99:
			look_at(global_position + fwd, Vector3.UP)

	if t != null and t.alive:
		if global_position.distance_to(t.global_position) < t.radius + radius:
			if t.has_method("apply_antibody"):
				t.apply_antibody()
				world.on_antibody_hit(t, global_position)
			alive = false
