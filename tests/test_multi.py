import math
import unittest
from server.multi.schema import parse_scene, force, body_frame, frame


def obj(ident, kind="mass", **kw):
    return dict(id=ident, kind=kind, **kw)


class StructureTests(unittest.TestCase):
    def test_body_newton_equation_and_center_of_mass(self):
        scene = parse_scene({"objects": [obj("a", mass=2), obj("b", mass=1)]})
        a = body_frame(
            scene.bodies[0], 0, 0, 1, 0, [force("spring", 3, 0, "S", "pair")]
        )
        b = body_frame(
            scene.bodies[1], 6, 0, -2, 0, [force("spring", -3, 0, "S", "pair")]
        )
        result = frame(scene, 0, [a, b])
        self.assertEqual(a["ax"], 1.5)
        self.assertEqual(result["cax"], 0)
        self.assertEqual(result["cx"], 2)
        self.assertEqual(result["px"], 0)
        self.assertEqual(a["forces"][0]["pair"], b["forces"][0]["pair"])

    def test_validation(self):
        for raw in [
            dict(objects=[obj("a", mass=0)]),
            dict(objects=[obj("a"), obj("a")]),
            dict(objects=[obj("a", mus=0.1, muk=0.5)]),
            dict(objects=[obj("a", x=math.nan)]),
            dict(
                objects=[obj("a")],
                connections=[dict(id="s", kind="spring", a="a", b="missing")],
            ),
        ]:
            with self.assertRaises(ValueError):
                parse_scene(raw)


from server.multi.engine import simulate_multi, inspect
from server.multi.presets import platform_scene


class PlatformTests(unittest.TestCase):
    def model(self, mus=0.6, muk=0.3):
        return inspect(platform_scene(mus, muk))[1]

    def test_static_and_newton_third_law(self):
        m = self.model()
        r = m.at(2)
        a, b = r["bodies"]
        self.assertEqual(r["regime"], "sticking")
        self.assertAlmostEqual(a["ax"], 1.6)
        self.assertAlmostEqual(a["ax"], b["ax"])
        self.assertAlmostEqual(r["cax"], 8 / 5)
        for pair in ["contact-friction", "contact-normal"]:
            forces = [f for o in r["bodies"] for f in o["forces"] if f["pair"] == pair]
            self.assertAlmostEqual(sum(f["fx"] for f in forces), 0)
            self.assertAlmostEqual(sum(f["fy"] for f in forces), 0)

    def test_frictionless_and_slipping(self):
        r = self.model(0, 0).at(1)
        self.assertAlmostEqual(r["bodies"][0]["ax"], 0)
        self.assertAlmostEqual(r["bodies"][1]["ax"], 2)
        r = self.model(0.08, 0.05).at(1)
        self.assertAlmostEqual(r["bodies"][0]["ax"], 0.05 * 9.8)
        self.assertEqual(r["regime"], "sliding")

    def test_relative_velocity_stop_and_resticking(self):
        raw = platform_scene()
        raw["objects"][1]["vx"] = 1
        model = inspect(raw)[1]
        self.assertGreater(model.stop, 0)
        a = model.at(model.stop - 1e-8)
        b = model.at(model.stop + 1e-8)
        self.assertEqual(b["regime"], "sticking")
        self.assertAlmostEqual(a["bodies"][0]["x"], b["bodies"][0]["x"], places=6)
        self.assertAlmostEqual(b["bodies"][0]["vx"], b["bodies"][1]["vx"])

    def test_work_energy_and_boundary_stop(self):
        model = self.model(0.08, 0.05)
        a, b = model.at(0), model.at(1)
        work = 8 * (b["bodies"][1]["x"] - a["bodies"][1]["x"])
        self.assertAlmostEqual(b["energy"] - a["energy"] + b["dissipated"], work)
        result = simulate_multi(platform_scene(0, 0))
        self.assertTrue(result["warning"])
        self.assertLess(result["duration"], 12)

    def test_unsupported_coupling_does_not_simulate(self):
        raw = platform_scene()
        raw["connections"] = [dict(id="s", kind="spring", a="deck", b="load")]
        result = simulate_multi(raw)
        self.assertFalse(result["supported"])
        self.assertEqual(result["frames"], [])


from server.multi.presets import spring_scene


class SpringNetworkTests(unittest.TestCase):
    def test_equal_mass_normal_modes(self):
        model = inspect(spring_scene())[1]
        self.assertAlmostEqual(model.modes[0]["omega"], math.sqrt(8))
        self.assertAlmostEqual(model.modes[1]["omega"], math.sqrt(24))
        self.assertAlmostEqual(model.modes[0]["vector"][0], model.modes[0]["vector"][1])
        self.assertAlmostEqual(
            model.modes[1]["vector"][0], -model.modes[1]["vector"][1]
        )
        self.assertAlmostEqual(model.meta["equilibrium"][0], -1.5)

    def test_verlet_energy_and_exact_mode_period(self):
        raw = spring_scene()
        raw["objects"][0]["x"] = -1.2
        raw["objects"][1]["x"] = 1.8
        model = inspect(raw)[1]
        start = model.at(0)
        period = 2 * math.pi / math.sqrt(8)
        for i in range(1, 601):
            result = model.at(i * period / 600)
            self.assertLess(
                abs(result["energy"] - start["energy"]) / start["energy"], 0.0001
            )
        self.assertAlmostEqual(result["bodies"][0]["x"], -1.2, places=4)

    def test_free_network_momentum_and_center(self):
        model = inspect(spring_scene(walls=False))[1]
        initial = model.at(0)
        for i in range(1, 241):
            r = model.at(i / 120)
            self.assertAlmostEqual(r["px"], initial["px"], places=10)
            self.assertAlmostEqual(r["cx"], initial["cx"], places=10)
        self.assertAlmostEqual(model.modes[0]["omega"], 0)

    def test_three_body_and_force_pairs(self):
        model = inspect(spring_scene(3))[1]
        r = model.at(0)
        self.assertEqual(len([o for o in r["bodies"] if o["id"].startswith("m")]), 3)
        for link in model.scene.connections:
            pair = [f for b in r["bodies"] for f in b["forces"] if f["pair"] == link.id]
            self.assertEqual(len(pair), 2)
            self.assertAlmostEqual(sum(f["fx"] for f in pair), 0)

    def test_unequal_mass_eigenvectors_satisfy_equations(self):
        raw = spring_scene()
        raw["objects"][0]["mass"] = 3
        model = inspect(raw)[1]
        for mode in model.modes:
            for i, b in enumerate(model.bodies):
                self.assertAlmostEqual(
                    sum(model.matrix[i][j] * mode["vector"][j] for j in range(2)),
                    b.mass * mode["omega"] ** 2 * mode["vector"][i],
                )


from server.multi.presets import pulley_scene


class PulleyTests(unittest.TestCase):
    def test_atwood_acceleration_tension_constraint_and_energy(self):
        model = inspect(pulley_scene())[1]
        r = model.at(0.3)
        a, b = r["bodies"][:2]
        self.assertAlmostEqual(a["ay"], 9.8 / 5)
        self.assertAlmostEqual(b["ay"], -9.8 / 5)
        self.assertAlmostEqual(r["tension"], 2 * 2 * 3 * 9.8 / 5)
        self.assertAlmostEqual(r["ropeLength"], 6)
        self.assertAlmostEqual(a["vy"] + b["vy"], 0)
        self.assertAlmostEqual(r["energy"], model.at(0)["energy"])

    def test_incline_pulley_equilibrium(self):
        model = inspect(pulley_scene(True))[1]
        r = model.at(2)
        self.assertAlmostEqual(r["tension"], 9.8)
        self.assertAlmostEqual(r["bodies"][0]["ax"], 0, places=9)
        self.assertAlmostEqual(r["bodies"][0]["ay"], 0, places=9)

    def test_slack_catch_never_negative_tension(self):
        raw = pulley_scene()
        raw["connections"][0]["rest"] = 7
        model = inspect(raw)[1]
        self.assertEqual(model.at(0)["tension"], 0)
        before = model.at(model.catch - 1e-8)
        after = model.at(model.catch)
        self.assertAlmostEqual(before["bodies"][0]["x"], after["bodies"][0]["x"])
        self.assertAlmostEqual(after["ropeLength"], 7)
        self.assertGreater(after["dissipated"], 0)
        for i in range(31):
            self.assertGreaterEqual(model.at(i / 100)["tension"], 0)
        self.assertAlmostEqual(
            before["energy"], after["energy"] + after["dissipated"], places=5
        )

    def test_negative_candidate_tension_releases_rope(self):
        raw = pulley_scene()
        raw["external"] = [
            dict(id="f1", body="m1", fy=-(0) + 30, fx=0),
            dict(id="f2", body="m2", fy=40, fx=0),
        ]
        model = inspect(raw)[1]
        self.assertLess(model.candidate, 0)
        r = model.at(0.1)
        self.assertEqual(r["regime"], "slack")
        self.assertEqual(r["tension"], 0)
        self.assertLess(r["ropeLength"], 6)

    def test_initial_outward_velocity_uses_impulse(self):
        raw = pulley_scene()
        raw["objects"][0]["vy"] = -1
        model = inspect(raw)[1]
        self.assertEqual(model.catch, 0)
        r = model.at(0)
        self.assertAlmostEqual(sum(b["vy"] for b in r["bodies"][:2]), 0)
        self.assertGreater(r["dissipated"], 0)

    def test_stretched_rope_and_unsupported_friction_rejected(self):
        raw = pulley_scene()
        raw["connections"][0]["rest"] = 5
        self.assertFalse(simulate_multi(raw)["supported"])
        raw = pulley_scene(True)
        raw["objects"][0]["mus"] = 0.3
        self.assertFalse(simulate_multi(raw)["supported"])


class EditorSafetyTests(unittest.TestCase):
    def test_free_particle_with_vector_force(self):
        raw = dict(
            objects=[obj("a", mass=2, y=5)],
            external=[dict(id="f", body="a", fx=4, fy=2)],
        )
        model = inspect(raw)[1]
        r = model.at(1)["bodies"][0]
        self.assertAlmostEqual(r["x"], 1)
        self.assertAlmostEqual(r["ay"], -8.8)
        self.assertAlmostEqual(r["y"], 0.6)

    def test_unimplemented_contacts_and_rotating_assemblies_are_blocked(self):
        for raw in [
            dict(objects=[obj("a"), obj("floor", "floor")]),
            dict(objects=[obj("a"), obj("wall", "wall")]),
            dict(objects=[obj("a", support="b"), obj("b")]),
        ]:
            result = simulate_multi(raw)
            self.assertFalse(result["supported"])
            self.assertTrue(result["reasons"])
            self.assertEqual(result["frames"], [])

    def test_all_eight_presets_compile(self):
        from server.multi.presets import presets

        items = presets()
        self.assertEqual(len(items), 8)
        for item in items:
            with self.subTest(item=item["id"]):
                scene, model, result = inspect(item["scene"])
                self.assertTrue(result["supported"], result["reasons"])
                self.assertTrue(model.at(0)["bodies"])


class AdditionalAccuracyTests(unittest.TestCase):
    def test_static_threshold_and_negative_push(self):
        raw = platform_scene()
        raw["objects"][1]["mus"] = (8 / 5) / 9.8
        raw["objects"][1]["muk"] = 0
        self.assertEqual(inspect(raw)[1].at(1)["regime"], "sticking")
        raw["external"][0]["fx"] = -8
        r = inspect(raw)[1].at(1)
        self.assertEqual(r["regime"], "sticking")
        self.assertAlmostEqual(r["cax"], -1.6)

    def test_stiff_springs_subdivide_and_preserve_energy(self):
        raw = spring_scene(3)
        for o in raw["objects"]:
            o["mass"] = 0.1
        for l in raw["connections"]:
            l["k"] = 100
        model = inspect(raw)[1]
        self.assertGreater(model.substeps, 4)
        initial = model.at(0)["energy"]
        for i in range(1, 241):
            r = model.at(i / 120)
            self.assertLess(abs(r["energy"] - initial) / initial, 0.0002)

    def test_constant_external_work_for_spring_network(self):
        raw = spring_scene()
        raw["external"] = [dict(id="F", body="m1", fx=1, fy=0)]
        model = inspect(raw)[1]
        initial = model.at(0)
        for i in range(1, 241):
            r = model.at(i / 120)
        displacement = r["bodies"][0]["x"] - initial["bodies"][0]["x"]
        self.assertAlmostEqual(
            r["energy"] - initial["energy"], displacement, delta=0.0001
        )

    def test_inward_initial_rope_velocity_releases_then_catches(self):
        raw = pulley_scene()
        raw["objects"][0]["vy"] = 1
        model = inspect(raw)[1]
        self.assertGreater(model.catch, 0)
        self.assertEqual(model.at(0.01)["tension"], 0)
        self.assertLess(model.at(0.01)["ropeLength"], 6)
        after = model.at(model.catch)
        self.assertAlmostEqual(after["ropeLength"], 6)
        self.assertGreater(after["dissipated"], 0)

    def test_event_limits_have_same_time_and_position(self):
        raw = pulley_scene()
        raw["connections"][0]["rest"] = 7
        result = simulate_multi(raw)
        before, after = result["events"]
        self.assertEqual(before["t"], after["t"])
        self.assertAlmostEqual(before["bodies"][0]["y"], after["bodies"][0]["y"])
        self.assertNotAlmostEqual(before["bodies"][0]["vy"], after["bodies"][0]["vy"])
        self.assertAlmostEqual(before["energy"], after["energy"] + after["dissipated"])

    def test_rigid_block_contacts_stop_before_overlap(self):
        raw = spring_scene(walls=False)
        for o in raw["objects"]:
            o["kind"] = "block"
        raw["objects"][0]["vx"] = 10
        raw["objects"][1]["vx"] = -10
        raw["connections"][0]["k"] = 0.1
        result = simulate_multi(raw)
        self.assertTrue(result["warning"])
        for r in result["frames"]:
            a, b = r["bodies"][:2]
            self.assertGreater(b["x"] - a["x"], 0.8)

    def test_slope_translation_requires_realignment(self):
        raw = pulley_scene(True)
        raw["objects"][-1]["y"] += 1
        self.assertFalse(simulate_multi(raw)["supported"])

class StrictSchemaTests(unittest.TestCase):
    def test_unknown_physics_is_never_silently_ignored(self):
        for raw in [dict(objects=[obj('a',angularVelocity=1)]),dict(objects=[obj('a')],joints=[]),dict(objects=[obj('a'),obj('b',x=3)],connections=[dict(id='k',kind='spring',a='a',b='b',pulley='missing')])]:
            with self.assertRaises(ValueError):parse_scene(raw)
        raw=spring_scene();raw['objects'][-1]['vx']=1
        self.assertFalse(simulate_multi(raw)['supported'])
