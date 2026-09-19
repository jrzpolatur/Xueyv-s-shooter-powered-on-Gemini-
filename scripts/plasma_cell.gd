extends Node3D
## Plasma cell: keeps its distance from the player and fires Y-shaped
## antibodies that slow the target and stack "marked" on it.

const Util := preload("res://scripts/util.gd")
const FlowField := preload("res://scripts/flow_field.gd")

const KEEP_MIN := 16.0
const KEEP_MAX := 28.0
const FIRE_INTERVAL := 1.35

var radius := 2.1
var alive := true
var velocity := Vector3.ZERO
var fire_timer := 1.0
var strafe_dir := 1.0

var _core_mat: StandardMaterial3D


func _ready() -> void:
	_core_mat = Util.make_mat(Util.COL_PLASMA, Util.COL_PLASMA * 0.4, 0.8, 0.5)
	add_child(Util.make_sphere(radius, _core_mat))
	# Rough endoplasmic reticulum look: a few small bumps on the surface.
	var bump_mat := Util.make_mat(Util.COL_PLASMA.darkened(0.2), Color(0, 0, 0), 0.0, 0.6)
	for i in 10:
		var k := float(i) + 0.5
		var phi := acos(1.0 - 2.0 * k / 10.0)
		var theta := PI * (1.0 + sqrt(5.0)) * k
		var dir := Vector3(sin(phi) * cos(theta), cos(phi), sin(phi) * sin(theta))
		var bump := Util.make_sphere(radius * 0.22, bump_mat)
		bump.position = dir * (radius + 0.1)
		add_child(bump)
	strafe_dir = 1.0 if randf() < 0.5 else -1.0


func step(delta: float, world) -> void:
	var to_player: Vector3 = world.player.global_position - global_position
	var dist := to_player.length()
	var desired := Vector3.ZERO
	if dist > KEEP_MAX:
		desired = to_player.normalized() * 6.5
	elif dist < KEEP_MIN:
		desired = -to_player.normalized() * 7.5
	else:
		# Strafe around the player.
		var tangent := Vector3(-to_player.z, 0.0, to_player.x).normalized() * 5.0 * strafe_dir
		desired = tangent
		if randf() < delta * 0.2:
			strafe_dir = -strafe_dir
	velocity = velocity.move_toward(desired, 14.0 * delta)
	global_position += velocity * delta
	global_position += world.flow.velocity_at(global_position) * 0.1 * delta
	global_position = FlowField.clamp_to_arena(global_position, world.arena_radius, radius)

	fire_timer -= delta
	if fire_timer <= 0.0 and world.player.alive:
		fire_timer = FIRE_INTERVAL * randf_range(0.85, 1.2)
		world.spawn_antibody(self)

	_core_mat.emission_energy_multiplier = 0.6 + 0.4 * sin(world.sim_time * 5.0)
