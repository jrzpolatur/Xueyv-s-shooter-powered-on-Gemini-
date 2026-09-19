extends Node3D
## Plasma cell: keeps its distance from the player and fires Y-shaped
## antibodies that slow the target and stack "marked" on it.
## Model: eccentric nucleus, arranged ER sheets (torus arcs),
## golgi stack. Gentle pulsing glow.

const Util := preload("res://scripts/util.gd")
const FlowField := preload("res://scripts/flow_field.gd")

const KEEP_MIN := 22.0
const KEEP_MAX := 40.0
const FIRE_INTERVAL := 1.9

var radius := 3.2
var alive := true
var velocity := Vector3.ZERO
var fire_timer := 1.4
var strafe_dir := 1.0

var _blob: MeshInstance3D
var _core_mat: StandardMaterial3D
var _seed := 0


func _ready() -> void:
	_seed = randi() % 1000
	_core_mat = Util.make_mat(Util.COL_PLASMA, Util.COL_PLASMA * 0.35, 0.6, 0.5)
	_core_mat.vertex_color_use_as_albedo = true
	_blob = Util.make_blob(radius, 0.10, _seed, _core_mat)
	add_child(_blob)

	# eccentric big nucleus
	var nuc := Util.make_sphere(radius * 0.42, Util.make_mat(Color(0.72, 0.55, 0.16), Color(0, 0, 0), 0.0, 0.5), 16)
	nuc.position = Vector3(-0.3 * radius, 0.12 * radius, 0.1 * radius)
	add_child(nuc)

	# ER sheets: flattened torus arcs around the nucleus
	var er_mat := Util.make_mat(Util.COL_PLASMA.darkened(0.28), Color(0, 0, 0), 0.0, 0.6)
	for i in 3:
		var sheet := Util.make_torus(radius * (0.5 + 0.13 * float(i)), radius * (0.62 + 0.13 * float(i)), er_mat)
		sheet.position = nuc.position + Vector3(0.05 * float(i) * radius, 0, 0)
		sheet.rotation = Vector3(1.35 + 0.15 * float(i), float(i) * 0.9, 0.3)
		add_child(sheet)

	# golgi: stack of flattened discs
	var golgi_mat := Util.make_mat(Util.COL_PLASMA.darkened(0.15), Color(0, 0, 0), 0.0, 0.55)
	for i in 4:
		var d := Util.make_cylinder(radius * (0.30 - 0.03 * float(i)), radius * (0.34 - 0.03 * float(i)), radius * 0.055, golgi_mat)
		d.position = Vector3(0.35 * radius, (-0.1 + 0.06 * float(i)) * radius, -0.2 * radius)
		add_child(d)

	# secretory vesicles near the rim
	var ves_mat := Util.make_mat(Util.COL_PLASMA.lightened(0.2), Util.COL_PLASMA * 0.5, 0.6, 0.4)
	for i in 6:
		var k := float(i) + 0.5
		var phi := acos(1.0 - 2.0 * k / 6.0)
		var theta := PI * (1.0 + sqrt(5.0)) * k
		var dir := Vector3(sin(phi) * cos(theta), cos(phi), sin(phi) * sin(theta))
		var v := Util.make_sphere(radius * 0.09, ves_mat, 8)
		v.position = dir * radius * 0.92
		add_child(v)

	strafe_dir = 1.0 if randf() < 0.5 else -1.0


func step(delta: float, world) -> void:
	var to_player: Vector3 = world.player.global_position - global_position
	var dist := to_player.length()
	var desired := Vector3.ZERO
	if dist > KEEP_MAX:
		desired = to_player.normalized() * 4.4
	elif dist < KEEP_MIN:
		desired = -to_player.normalized() * 4.8
	else:
		var tangent := Vector3(-to_player.z, 0.0, to_player.x).normalized() * 3.0 * strafe_dir
		desired = tangent
		if randf() < delta * 0.15:
			strafe_dir = -strafe_dir
	velocity = velocity.move_toward(desired, 8.0 * delta)
	global_position += velocity * delta
	global_position += world.flow.velocity_at(global_position) * 0.1 * delta
	global_position = FlowField.clamp_to_arena(global_position, world.arena_radius, radius)

	fire_timer -= delta
	if fire_timer <= 0.0 and world.player.alive:
		fire_timer = FIRE_INTERVAL * randf_range(0.85, 1.2)
		world.spawn_antibody(self)

	_blob.rotate_y(delta * 0.12)
	var breath := 1.0 + 0.03 * sin(world.sim_time * 2.2)
	_blob.scale = Vector3(breath, 2.0 - breath, breath)
	_core_mat.emission_energy_multiplier = 0.45 + 0.35 * sin(world.sim_time * 3.5)
