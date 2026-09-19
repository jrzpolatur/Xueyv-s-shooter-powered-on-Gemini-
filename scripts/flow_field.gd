extends RefCounted
## Analytic blood-flow field for the large vessel: gentle swirl around the
## vessel axis plus wide, slow turbulence, and an inward push near the wall.

var time := 0.0
var arena_radius := 75.0


func velocity_at(p: Vector3) -> Vector3:
	var v := Vector3(-p.z, 0.0, p.x)
	var rl := v.length()
	if rl > 0.001:
		var swirl_strength := 1.7 + 0.9 * sin(rl * 0.045 - time * 0.35)
		v = v * (swirl_strength / rl)
	var turb := Vector3(
		sin(p.x * 0.055 + time * 0.45) * cos(p.z * 0.065 - time * 0.30),
		0.0,
		cos(p.x * 0.050 - time * 0.27) * sin(p.z * 0.060 + time * 0.40)
	) * 2.6
	v += turb
	var r := sqrt(p.x * p.x + p.z * p.z)
	var edge := arena_radius - 6.0
	if r > edge:
		v += Vector3(-p.x, 0.0, -p.z) * ((r - edge) * 1.4 / maxf(r, 0.001))
	return v


static func clamp_to_arena(p: Vector3, arena_radius: float, margin := 1.5) -> Vector3:
	var r := sqrt(p.x * p.x + p.z * p.z)
	var lim := arena_radius - margin
	if r > lim:
		var s := lim / r
		p.x *= s
		p.z *= s
	return p
