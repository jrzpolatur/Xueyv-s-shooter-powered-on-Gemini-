extends RefCounted
## Shared helpers for procedural visuals (no imported assets).
## v2: flat-shaded icospheres, organic blobs, richer primitives.

# ---- palette: 体内暗色系 ----
const COL_BG := Color(0.10, 0.015, 0.04)
const COL_FLOOR := Color(0.24, 0.05, 0.08)
const COL_FLOOR_PATCH := Color(0.30, 0.07, 0.10)
const COL_RIM := Color(0.95, 0.30, 0.32)
const COL_RBC := Color(0.55, 0.08, 0.10)
const COL_CELL := Color(0.94, 0.66, 0.60)
const COL_NUCLEUS := Color(0.66, 0.30, 0.36)
const COL_MITO := Color(0.82, 0.42, 0.30)
const COL_CELL_INFECTED := Color(0.70, 0.30, 0.95)
const COL_VIRUS := Color(0.85, 0.20, 0.55)
const COL_VIRUS_DARK := Color(0.55, 0.10, 0.34)
const COL_VIRUS_GLOW := Color(0.60, 0.08, 0.38)
const COL_MACROPHAGE := Color(0.24, 0.76, 0.70)
const COL_PLASMA := Color(0.95, 0.82, 0.25)
const COL_ANTIBODY := Color(0.96, 0.97, 1.0)
const COL_MARK := Color(1.0, 0.25, 0.15)


static func make_mat(albedo: Color, emission := Color(0, 0, 0), emission_energy := 0.0, roughness := 0.75, flat := false) -> StandardMaterial3D:
	var mat := StandardMaterial3D.new()
	mat.albedo_color = albedo
	mat.roughness = roughness
	if flat:
		mat.shading_mode = BaseMaterial3D.SHADING_MODE_PER_PIXEL
		mat.metallic_specular = 0.2
	if emission_energy > 0.0:
		mat.emission_enabled = true
		mat.emission = emission
		mat.emission_energy_multiplier = emission_energy
	return mat


static func make_sphere(radius: float, mat: Material, seg := 24) -> MeshInstance3D:
	var mi := MeshInstance3D.new()
	var mesh := SphereMesh.new()
	mesh.radius = radius
	mesh.height = radius * 2.0
	mesh.radial_segments = seg
	mesh.rings = maxi(seg / 2, 6)
	mi.mesh = mesh
	mi.material_override = mat
	return mi


static func make_capsule(radius: float, height: float, mat: Material) -> MeshInstance3D:
	var mi := MeshInstance3D.new()
	var mesh := CapsuleMesh.new()
	mesh.radius = radius
	mesh.height = height
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
	mesh.rings = 40
	mesh.ring_segments = 12
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


# ---------------------------------------------------------------- icosphere

const _PHI := 1.6180339887


static func _icosahedron() -> Array:
	var t: float = _PHI
	var verts := [
		Vector3(-1, t, 0), Vector3(1, t, 0), Vector3(-1, -t, 0), Vector3(1, -t, 0),
		Vector3(0, -1, t), Vector3(0, 1, t), Vector3(0, -1, -t), Vector3(0, 1, -t),
		Vector3(t, 0, -1), Vector3(t, 0, 1), Vector3(-t, 0, -1), Vector3(-t, 0, 1),
	]
	for i in verts.size():
		verts[i] = (verts[i] as Vector3).normalized()
	var faces := [
		[0, 11, 5], [0, 5, 1], [0, 1, 7], [0, 7, 10], [0, 10, 11],
		[1, 5, 9], [5, 11, 4], [11, 10, 2], [10, 7, 6], [7, 1, 8],
		[3, 9, 4], [3, 4, 2], [3, 2, 6], [3, 6, 8], [3, 8, 9],
		[4, 9, 5], [2, 4, 11], [6, 2, 10], [8, 6, 7], [9, 8, 1],
	]
	return [verts, faces]


## Flat-shaded icosphere. Every face gets its own vertices (crisp facets).
## face_tint: Callable(face_index, face_center) -> Color for per-face color.
static func make_icosphere(radius: float, subdivisions: int, mat: Material, face_tint: Callable) -> MeshInstance3D:
	var data := _icosahedron()
	var verts: Array = data[0]
	var faces: Array = data[1]

	for s in subdivisions:
		var new_faces := []
		var cache := {}
		for f in faces:
			var a: Vector3 = verts[f[0]]
			var b: Vector3 = verts[f[1]]
			var c: Vector3 = verts[f[2]]
			var ab := _mid(a, b, verts, cache)
			var bc := _mid(b, c, verts, cache)
			var ca := _mid(c, a, verts, cache)
			new_faces.append_array([[f[0], ab, ca], [f[1], bc, ab], [f[2], ca, bc], [ab, bc, ca]])
		faces = new_faces

	var positions := PackedVector3Array()
	var normals := PackedVector3Array()
	var colors := PackedColorArray()
	var indices := PackedInt32Array()
	var vi := 0
	for fi in faces.size():
		var f = faces[fi]
		var p0: Vector3 = verts[f[0]] * radius
		var p1: Vector3 = verts[f[1]] * radius
		var p2: Vector3 = verts[f[2]] * radius
		var n := (p1 - p0).cross(p2 - p0).normalized()
		var center := (p0 + p1 + p2) / 3.0
		var col: Color = face_tint.call(fi, center)
		positions.append_array([p0, p1, p2])
		normals.append_array([n, n, n])
		colors.append_array([col, col, col])
		indices.append_array([vi, vi + 1, vi + 2])
		vi += 3

	var arrays := []
	arrays.resize(Mesh.ARRAY_MAX)
	arrays[Mesh.ARRAY_VERTEX] = positions
	arrays[Mesh.ARRAY_NORMAL] = normals
	arrays[Mesh.ARRAY_COLOR] = colors
	arrays[Mesh.ARRAY_INDEX] = indices
	var mesh := ArrayMesh.new()
	mesh.add_surface_from_arrays(Mesh.PRIMITIVE_TRIANGLES, arrays)
	mesh.surface_set_material(0, mat)

	var mi := MeshInstance3D.new()
	mi.mesh = mesh
	return mi


static func _mid(a: Vector3, b: Vector3, verts: Array, cache: Dictionary) -> int:
	var key := str(mini(verts.find(a), verts.find(b))) + "_" + str(maxi(verts.find(a), verts.find(b)))
	if cache.has(key):
		return cache[key]
	verts.append((a + b).normalized())
	cache[key] = verts.size() - 1
	return verts.size() - 1


## Organic blob: icosphere whose vertices are radially displaced by
## deterministic pseudo-noise (stable across frames).
static func make_blob(radius: float, wobble: float, seed_val: int, mat: Material) -> MeshInstance3D:
	var tint := func(_fi: int, center: Vector3) -> Color:
		var n := 0.85 + 0.15 * absf(sin(center.x * 4.1 + seed_val) * cos(center.z * 3.7 - seed_val))
		return Color(n, n, n)
	var mi := make_icosphere(radius, 2, mat, tint)
	# displace: rewrite vertex positions with noise, then recompute normals per face
	var mesh: ArrayMesh = mi.mesh
	var arrays := mesh.surface_get_arrays(0)
	var pos: PackedVector3Array = arrays[Mesh.ARRAY_VERTEX]
	for i in pos.size():
		var p := pos[i].normalized()
		var d := 1.0 + wobble * (0.5 * sin(p.x * 3.1 + seed_val * 0.7) + 0.3 * sin(p.y * 4.3 - seed_val) + 0.2 * cos(p.z * 3.7 + seed_val * 1.3))
		pos[i] = p * radius * d
	# flat normals again
	var idx: PackedInt32Array = arrays[Mesh.ARRAY_INDEX]
	var nor := PackedVector3Array()
	nor.resize(pos.size())
	for f in range(0, idx.size(), 3):
		var p0 := pos[idx[f]]
		var p1 := pos[idx[f + 1]]
		var p2 := pos[idx[f + 2]]
		var n := (p1 - p0).cross(p2 - p0).normalized()
		nor[idx[f]] = n
		nor[idx[f + 1]] = n
		nor[idx[f + 2]] = n
	arrays[Mesh.ARRAY_NORMAL] = nor
	arrays[Mesh.ARRAY_VERTEX] = pos
	var mesh2 := ArrayMesh.new()
	mesh2.add_surface_from_arrays(Mesh.PRIMITIVE_TRIANGLES, arrays)
	mesh2.surface_set_material(0, mat)
	mi.mesh = mesh2
	return mi


## Capsid-style virus shell: faceted ball, alternating face tones,
## knob at each original icosahedron vertex.
static func make_capsid(radius: float, body_mat: Material, knob_mat: Material, knobs := true) -> MeshInstance3D:
	var root := MeshInstance3D.new()
	var tint := func(fi: int, _c: Vector3) -> Color:
		return Color(1, 1, 1) if fi % 2 == 0 else Color(0.82, 0.82, 0.82)
	var shell := make_icosphere(radius, 1, body_mat, tint)
	root.add_child(shell)
	if knobs:
		var data := _icosahedron()
		var verts: Array = data[0]
		for v in verts:
			var dir: Vector3 = v
			var stem := make_cylinder(0.03, 0.10, radius * 0.28, knob_mat)
			stem.transform = Transform3D(basis_y(dir), dir * (radius + radius * 0.1))
			root.add_child(stem)
			var knob := make_sphere(radius * 0.14, knob_mat, 10)
			knob.position = dir * (radius + radius * 0.30)
			root.add_child(knob)
	return root
