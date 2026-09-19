extends RefCounted
## Analytic blood-flow field: a gentle swirl around the vessel axis plus
## time-varying turbulence, and an inward push near the vessel wall.

var time := 0.0
var arena_radius := 42.0


func velocity_at(p: Vector3) -> Vector3:
	var v := Vector3(-p.z, 0.0, p.x)
	var rl := v.length()
	if rl > 0.001:
		var swirl_strength := 2.0 + 1.3 * sin(rl * 0.09 - time * 0.5)
		v = v * (swirl_strength / rl)
	var turb := Vector3(
		sin(p.x * 0.11 + time * 0.63) * cos(p.z * 0.13 - time * 0.41),
		0.0,
		cos(p.x * 0.09 - time * 0.37) * sin(p.z * 0.12 + time * 0.57)
	) * 2.1
	v += turb
	var r := sqrt(p.x * p.x + p.z * p.z)
	var edge := arena_radius - 4.0
	if r > edge:
		v += Vector3(-p.x, 0.0, -p.z) * ((r - edge) * 1.6 / maxf(r, 0.001))
	return v


static func clamp_to_arena(p: Vector3, arena_radius: float, margin := 1.5) -> Vector3:
	var r := sqrt(p.x * p.x + p.z * p.z)
	var lim := arena_radius - margin
	if r > lim:
		var s := lim / r
		p.x *= s
		p.z *= s
	return p
