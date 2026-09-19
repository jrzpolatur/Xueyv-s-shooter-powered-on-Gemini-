extends Node3D
## A Y-shaped antibody projectile. Homes slightly onto the player;
## on hit applies a slow and a "marked" stack (macrophages prefer
## marked targets).

const Util := preload("res://scripts/util.gd")
const FlowField := preload("res://scripts/flow_field.gd")

const SPEED := 22.0
const LIFETIME := 7.0
const TURN := 2.2

var radius := 0.5
var alive := true
var velocity := Vector3.ZERO
var life := LIFETIME
var target = null


func _ready() -> void:
	var mat := Util.make_mat(Util.COL_ANTIBODY, Util.COL_ANTIBODY * 0.5, 0.7, 0.35)
	var stem := Util.make_cylinder(0.09, 0.09, 0.8, mat)
	stem.position = Vector3(0, -0.2, 0)
	add_child(stem)
	for side in [-1.0, 1.0]:
		var arm := Util.make_cylinder(0.07, 0.07, 0.5, mat)
		arm.rotation.z = side * 0.6
		arm.position = Vector3(side * 0.22, 0.35, 0.0)
		add_child(arm)
		var tip := Util.make_sphere(0.14, mat)
		tip.position = Vector3(side * 0.42, 0.62, 0.0)
		add_child(tip)


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
		if to_t.length() < 30.0:
			var desired := to_t.normalized() * SPEED
			velocity = velocity.slerp(desired, minf(1.0, TURN * delta)).normalized() * SPEED

	global_position += velocity * delta
	global_position += world.flow.velocity_at(global_position) * 0.15 * delta

	if velocity.length_squared() > 0.01:
		var look := global_position + velocity.normalized()
		if absf(velocity.normalized().y) < 0.99:
			look_at(look, Vector3.UP)

	if t != null and t.alive:
		if global_position.distance_to(t.global_position) < t.radius + radius:
			if t.has_method("apply_antibody"):
				t.apply_antibody()
				world.on_antibody_hit(t, global_position)
			alive = false
