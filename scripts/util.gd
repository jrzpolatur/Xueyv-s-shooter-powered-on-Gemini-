extends RefCounted
## Shared helpers for building procedural visuals (no imported assets).

const COL_BG := Color(0.16, 0.03, 0.06)
const COL_FLOOR := Color(0.32, 0.07, 0.10)
const COL_RIM := Color(0.85, 0.25, 0.25)
const COL_CELL := Color(0.93, 0.65, 0.62)
const COL_NUCLEUS := Color(0.68, 0.32, 0.36)
const COL_CELL_INFECTED := Color(0.72, 0.32, 0.92)
const COL_VIRUS := Color(0.80, 0.18, 0.55)
const COL_VIRUS_GLOW := Color(0.55, 0.08, 0.35)
const COL_MACROPHAGE := Color(0.25, 0.78, 0.72)
const COL_PLASMA := Color(0.95, 0.82, 0.25)
const COL_ANTIBODY := Color(0.95, 0.97, 1.0)
const COL_MARK := Color(1.0, 0.25, 0.15)


static func make_mat(albedo: Color, emission := Color(0, 0, 0), emission_energy := 0.0, roughness := 0.75) -> StandardMaterial3D:
	var mat := StandardMaterial3D.new()
	mat.albedo_color = albedo
	mat.roughness = roughness
	if emission_energy > 0.0:
		mat.emission_enabled = true
		mat.emission = emission
		mat.emission_energy_multiplier = emission_energy
	return mat


static func make_sphere(radius: float, mat: Material) -> MeshInstance3D:
	var mi := MeshInstance3D.new()
	var mesh := SphereMesh.new()
	mesh.radius = radius
	mesh.height = radius * 2.0
	mesh.radial_segments = 24
	mesh.rings = 12
	mi.mesh = mesh
	mi.material_override = mat
	return mi


static func make_cylinder(top_radius: float, bottom_radius: float, height: float, mat: Material) -> MeshInstance3D:
	var mi := MeshInstance3D.new()
	var mesh := CylinderMesh.new()
	mesh.top_radius = top_radius
	mesh.bottom_radius = bottom_radius
	mesh.height = height
	mesh.radial_segments = 16
	mi.mesh = mesh
	mi.material_override = mat
	return mi


static func make_torus(inner: float, outer: float, mat: Material) -> MeshInstance3D:
	var mi := MeshInstance3D.new()
	var mesh := TorusMesh.new()
	mesh.inner_radius = inner
	mesh.outer_radius = outer
	mesh.rings = 32
	mesh.ring_segments = 10
	mi.mesh = mesh
	mi.material_override = mat
	return mi


## Orientation basis whose local +Y axis points along dir.
static func basis_y(dir: Vector3) -> Basis:
	var y := dir.normalized()
	var x := y.cross(Vector3.UP)
	if x.length_squared() < 0.001:
		x = y.cross(Vector3.RIGHT)
	x = x.normalized()
	var z := x.cross(y).normalized()
	return Basis(x, y, z)
