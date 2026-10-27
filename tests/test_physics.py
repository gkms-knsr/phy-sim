import math
import unittest
from server.physics import validate, state, metadata, simulate, event_frames, SPECS

class PhysicsTests(unittest.TestCase):
    def test_linear_exact(self):
        p=validate('linear',{'x0':3,'v0':-4,'a':2})
        r=state('linear',p,5)
        self.assertAlmostEqual(r['x'],8)
        self.assertAlmostEqual(r['vx'],6)

    def test_invalid_inputs(self):
        for raw in [{'m':0},{'a':float('nan')},{'m':True},{'v0':float('inf')},{'alien':1}]:
            with self.assertRaises(ValueError): validate('linear',raw)

    def test_every_default_finite(self):
        for kind in SPECS:
            r=simulate(kind,{})
            self.assertEqual(len(r['frames']),3601)
            for s in r['frames']:
                self.assertTrue(all(math.isfinite(v) for v in s.values() if isinstance(v,(int,float))))


class ExtendedPhysicsTests(unittest.TestCase):
    def test_linear_reversal(self):
        p=validate('linear',{'v0':4,'a':-1})
        self.assertEqual(metadata('linear',p)['reversal'],4)
        self.assertEqual(state('linear',p,4)['vx'],0)
        self.assertLess(state('linear',p,4.1)['vx'],0)

    def test_incline_static_threshold(self):
        p=validate('incline',{'angle':30,'mus':math.tan(math.pi/6),'muk':.2})
        r=state('incline',p,10)
        self.assertEqual(r['regime'],'static')
        self.assertEqual(r['vx'],0)
        self.assertAlmostEqual(r['friction'],-p['m']*p['g']*.5)

    def test_incline_frictionless(self):
        p=validate('incline',{'mus':0,'muk':0,'angle':30})
        r=state('incline',p,2)
        self.assertAlmostEqual(r['s'],9.8)
        self.assertAlmostEqual(r['a'],4.9)
        self.assertAlmostEqual(r['energy'],0,places=10)

    def test_incline_stopping_does_not_reverse(self):
        p=validate('incline',{'angle':10,'mus':.6,'muk':.4,'v0':2})
        r=state('incline',p,10)
        self.assertEqual(r['v'],0)
        self.assertEqual(r['a'],0)
        self.assertEqual(r['s'],state('incline',p,30)['s'])

    def test_uphill_motion_stops_and_slides_down(self):
        p=validate('incline',{'v0':-3,'angle':45,'mus':.2,'muk':.1})
        a=p['g']*(math.sin(math.pi/4)+.1*math.cos(math.pi/4))
        stop=3/a
        left=state('incline',p,stop-1e-8)
        right=state('incline',p,stop+1e-8)
        self.assertLess(left['v'],0)
        self.assertGreater(right['v'],0)
        self.assertAlmostEqual(left['s'],right['s'],places=7)

    def test_projectile_flight_and_range(self):
        p=validate('projectile',{'v0':20,'angle':45})
        m=metadata('projectile',p)
        self.assertAlmostEqual(m['flight'],20*math.sqrt(2)/9.8)
        self.assertAlmostEqual(m['range'],400/9.8)
        apex=state('projectile',p,m['apexTime'])
        self.assertAlmostEqual(apex['vy'],0,places=10)
        self.assertGreater(apex['vx'],0)
        self.assertAlmostEqual(apex['energy'],200,places=10)
        land=state('projectile',p,m['flight'])
        self.assertEqual(land['y'],0)
        self.assertTrue(land['landed'])
        self.assertEqual(land['kinetic'],0)

    def test_horizontal_projectile(self):
        p=validate('projectile',{'v0':8,'angle':0,'y0':5})
        self.assertAlmostEqual(metadata('projectile',p)['flight'],math.sqrt(10/9.8))

    def test_spring_period_energy(self):
        p=validate('spring',{'k':8,'m':2,'x0':2,'v0':1})
        period=metadata('spring',p)['period']
        self.assertAlmostEqual(period,math.pi)
        self.assertAlmostEqual(state('spring',p,period)['x'],2)
        self.assertAlmostEqual(state('spring',p,period)['vx'],1)
        for i in range(100): self.assertAlmostEqual(state('spring',p,i*.3)['energy'],17,places=10)

    def test_collision_elastic_conservation(self):
        p=validate('collision',{'e':1})
        before,after=state('collision',p,0),state('collision',p,10)
        self.assertAlmostEqual(before['momentum'],after['momentum'])
        self.assertAlmostEqual(before['kinetic'],after['kinetic'])

    def test_collision_inelastic(self):
        for e in [0,.5]:
            p=validate('collision',{'e':e})
            before,after=state('collision',p,0),state('collision',p,10)
            self.assertAlmostEqual(before['momentum'],after['momentum'])
            loss=.5*p['m1']*p['m2']/(p['m1']+p['m2'])*(1-e*e)*(p['v1']-p['v2'])**2
            self.assertAlmostEqual(before['kinetic']-after['kinetic'],loss)
            self.assertAlmostEqual(after['vx2']-after['vx'],e*(p['v1']-p['v2']))

    def test_collision_contact_continuity_and_no_overlap(self):
        p=validate('collision',{})
        t=metadata('collision',p)['collisionTime']
        left,right=state('collision',p,t-1e-8),state('collision',p,t)
        self.assertAlmostEqual(left['x'],right['x'],places=6)
        self.assertAlmostEqual(right['x2']-right['x'],1)
        for i in range(500):
            r=state('collision',p,i/20)
            self.assertGreaterEqual(r['x2']-r['x'],1-1e-10)

    def test_no_collision_and_initial_contact(self):
        p=validate('collision',{'v1':-1,'v2':1})
        self.assertIsNone(metadata('collision',p)['collisionTime'])
        p=validate('collision',{'x1':-.5,'x2':.5})
        self.assertTrue(state('collision',p,0)['collided'])

    def test_extreme_parameters_finite(self):
        for kind,spec in SPECS.items():
            for bound in [0,1]:
                p=validate(kind,{k:v[bound] for k,v in spec.items()})
                for t in [0,1/120,1,30]:
                    r=state(kind,p,t)
                    self.assertTrue(all(math.isfinite(v) for v in r.values() if isinstance(v,(float,int))))
        with self.assertRaises(ValueError):validate('incline',{'mus':.1,'muk':.4})

class EventAndEdgeTests(unittest.TestCase):
    def test_collision_graph_limits(self):
        p=validate('collision',{'e':.5})
        before,after=event_frames('collision',p)
        self.assertEqual(before['t'],after['t'])
        self.assertEqual(before['x'],after['x'])
        self.assertEqual(before['vx'],p['v1'])
        self.assertEqual(before['momentum'],after['momentum'])
        self.assertGreater(before['energy'],after['energy'])

    def test_landing_graph_limits(self):
        p=validate('projectile',{})
        before,after=event_frames('projectile',p)
        self.assertEqual(before['t'],metadata('projectile',p)['flight'])
        self.assertEqual(before['x'],after['x'])
        self.assertEqual(before['y'],0)
        self.assertGreater(before['kinetic'],0)
        self.assertEqual(after['kinetic'],0)
        self.assertEqual(after['normal'],p['m']*p['g'])

    def test_friction_work_matches_energy_loss(self):
        p=validate('incline',{'angle':30,'mus':.4,'muk':.25,'v0':1})
        initial,final=state('incline',p,0),state('incline',p,4)
        work=-p['muk']*final['normal']*(final['s']-initial['s'])
        self.assertAlmostEqual(final['energy']-initial['energy'],work,places=9)

    def test_flight_shorter_than_sample_interval(self):
        p=validate('projectile',{'v0':.1,'angle':1,'g':20})
        flight=metadata('projectile',p)['flight']
        self.assertLess(flight,1/120)
        self.assertGreater(flight,0)
        self.assertFalse(state('projectile',p,0)['landed'])
        self.assertTrue(state('projectile',p,1/120)['landed'])
        self.assertAlmostEqual(state('projectile',p,1/120)['x'],metadata('projectile',p)['range'])

    def test_reversal_requires_initial_motion(self):
        self.assertIsNone(metadata('linear',validate('linear',{'v0':0,'a':1}))['reversal'])
        self.assertEqual(metadata('linear',validate('linear',{'v0':1e-200,'a':-1e-200}))['reversal'],1)

    def test_tiny_velocities_and_accelerations(self):
        for kind,raw in [('collision',{'v1':1e-320,'v2':0}),('linear',{'v0':-1,'a':1e-320})]:
            result=simulate(kind,raw)
            import json
            json.dumps(result,allow_nan=False)
        with self.assertRaises(ValueError):state('linear',validate('linear',{}),-1)

if __name__=='__main__': unittest.main()
