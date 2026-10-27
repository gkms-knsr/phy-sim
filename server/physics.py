"""SI-based exact solutions. Positive s on an incline points downhill.
No time integration: every sample is evaluated from initial conditions.
"""
import math

DT = 1 / 120
DURATION = 30
SPECS = {
    'linear': {'x0':(-20,20,0),'v0':(-10,10,2),'a':(-5,5,1),'m':(.1,10,1)},
    'incline': {'x0':(-10,10,0),'v0':(-10,10,0),'angle':(0,80,30),'m':(.1,10,2),'g':(.1,20,9.8),'mus':(0,1.5,.4),'muk':(0,1.5,.25)},
    'projectile': {'x0':(-20,20,0),'y0':(0,15,0),'v0':(0,25,12),'angle':(0,90,45),'m':(.1,10,1),'g':(.1,20,9.8)},
    'spring': {'x0':(-4,4,2),'v0':(-10,10,0),'k':(.1,50,8),'m':(.1,10,2)},
    'collision': {'x1':(-15,-.5,-4),'x2':(.5,15,4),'v1':(-10,10,3),'v2':(-10,10,-1),'m1':(.1,10,2),'m2':(.1,10,1),'e':(0,1,1)},
}


def validate(kind, raw):
    if kind not in SPECS or not isinstance(raw, dict):
        raise ValueError('実験またはパラメータが不正です。')
    if set(raw) - set(SPECS[kind]):
        raise ValueError('未知のパラメータです。')
    p = {}
    for key, (lo, hi, default) in SPECS[kind].items():
        v = raw.get(key, default)
        if isinstance(v, bool) or not isinstance(v, (float, int)) or not math.isfinite(v) or not lo <= v <= hi:
            raise ValueError(f'{key} は {lo}〜{hi} の有限な数値にしてください。')
        p[key] = float(v)
    if kind == 'incline' and p['muk'] > p['mus']:
        raise ValueError('動摩擦係数は静止摩擦係数以下にしてください。')
    return p


def state(kind, p, t):
    if not math.isfinite(t) or t < 0:
        raise ValueError('時刻は0以上の有限値です。')
    r = dict(t=t, x=0., y=0., vx=0., vy=0., ax=0., ay=0., kinetic=0., potential=0., energy=0., friction=0., normal=0., momentum=0.)
    if kind == 'linear':
        r.update(x=p['x0']+p['v0']*t+.5*p['a']*t*t, vx=p['v0']+p['a']*t, ax=p['a'])
        r['kinetic'] = .5*p['m']*r['vx']**2
    elif kind == 'incline':
        theta = math.radians(p['angle'])
        drive, n = p['g']*math.sin(theta), p['m']*p['g']*math.cos(theta)
        static = drive <= p['mus']*p['g']*math.cos(theta) + 1e-12
        v0, x0 = p['v0'], p['x0']
        if v0 == 0 and static:
            s, v, a, f = x0, 0., 0., -p['m']*drive
        else:
            sign = 1 if v0 >= 0 else -1
            a = drive-sign*p['muk']*p['g']*math.cos(theta)
            stop = -v0/a if (v0 > 0 and a < 0) or (v0 < 0 and a > 0) else math.inf
            if t >= stop:
                xs = x0+v0*stop+.5*a*stop**2
                if static:
                    s, v, a, f = xs, 0., 0., -p['m']*drive
                else:
                    a = drive-p['muk']*p['g']*math.cos(theta)
                    dt = t-stop
                    s, v, f = xs+.5*a*dt*dt, a*dt, -p['muk']*n
            else:
                s, v, f = x0+v0*t+.5*a*t*t, v0+a*t, -sign*p['muk']*n
        r.update(x=s*math.cos(theta), y=-s*math.sin(theta), vx=v*math.cos(theta), vy=-v*math.sin(theta), ax=a*math.cos(theta), ay=-a*math.sin(theta), s=s, v=v, a=a, friction=f, normal=n, regime='static' if v == 0 and a == 0 else 'kinetic')
        r['kinetic'] = .5*p['m']*v*v
        r['potential'] = p['m']*p['g']*r['y']
    elif kind == 'projectile':
        angle = math.radians(p['angle'])
        ux, uy = p['v0']*math.cos(angle), p['v0']*math.sin(angle)
        flight = (uy+math.sqrt(uy*uy+2*p['g']*p['y0']))/p['g']
        q = min(t, flight)
        landed = t >= flight
        r.update(x=p['x0']+ux*q, y=0. if landed else max(0.,p['y0']+uy*q-.5*p['g']*q*q), vx=0. if landed else ux, vy=0. if landed else uy-p['g']*q, ay=0. if landed else -p['g'], landed=landed)
        r['kinetic'] = .5*p['m']*(r['vx']**2+r['vy']**2)
        r['potential'] = p['m']*p['g']*r['y']
        r['normal'] = p['m']*p['g'] if landed else 0.
    elif kind == 'spring':
        w = math.sqrt(p['k']/p['m'])
        x = p['x0']*math.cos(w*t)+p['v0']/w*math.sin(w*t)
        v = -p['x0']*w*math.sin(w*t)+p['v0']*math.cos(w*t)
        r.update(x=x, vx=v, ax=-w*w*x, kinetic=.5*p['m']*v*v, potential=.5*p['k']*x*x)
    elif kind == 'collision':
        gap, relative = p['x2']-p['x1']-1, p['v1']-p['v2']
        hit = gap/relative if relative > 0 else math.inf
        total, e = p['m1']+p['m2'], p['e']
        u1 = ((p['m1']-e*p['m2'])*p['v1']+(1+e)*p['m2']*p['v2'])/total
        u2 = ((p['m2']-e*p['m1'])*p['v2']+(1+e)*p['m1']*p['v1'])/total
        after = t >= hit
        v1, v2 = (u1,u2) if after else (p['v1'],p['v2'])
        x1 = p['x1']+p['v1']*min(t,hit)+(u1*(t-hit) if after else 0)
        x2 = p['x2']+p['v2']*min(t,hit)+(u2*(t-hit) if after else 0)
        r.update(x=x1, vx=v1, x2=x2, vx2=v2, collided=after, impulse=abs(t-hit)<1e-10, momentum=p['m1']*v1+p['m2']*v2, kinetic=.5*p['m1']*v1*v1+.5*p['m2']*v2*v2)
    r['energy'] = r['kinetic']+r['potential']
    return r


def metadata(kind, p):
    if kind == 'linear':
        opposite = (p['v0'] > 0 and p['a'] < 0) or (p['v0'] < 0 and p['a'] > 0)
        rev = -p['v0']/p['a'] if opposite else None
        return {'reversal':rev if rev is not None and math.isfinite(rev) else None}
    if kind == 'spring':
        w = math.sqrt(p['k']/p['m'])
        return {'period':2*math.pi/w, 'amplitude':math.hypot(p['x0'],p['v0']/w)}
    if kind == 'projectile':
        a = math.radians(p['angle'])
        vx, vy = p['v0']*math.cos(a), p['v0']*math.sin(a)
        flight = (vy+math.sqrt(vy*vy+2*p['g']*p['y0']))/p['g']
        return {'flight':flight,'range':vx*flight,'apexTime':vy/p['g'],'apex':p['y0']+vy*vy/(2*p['g'])}
    if kind == 'collision':
        relative = p['v1']-p['v2']
        hit = (p['x2']-p['x1']-1)/relative if relative>0 else None
        if hit is not None and not math.isfinite(hit):
            hit = None
        after = state(kind,p,hit if hit is not None else 0)
        before = .5*p['m1']*p['v1']**2+.5*p['m2']*p['v2']**2
        return {'collisionTime':hit,'afterV1':after['vx'],'afterV2':after['vx2'],'energyLoss':before-after['kinetic']}
    return {}


def event_frames(kind, p):
    """Two one-sided limits at instantaneous events, for honest graph jumps."""
    meta = metadata(kind, p)
    t = meta.get('collisionTime') if kind == 'collision' else meta.get('flight') if kind == 'projectile' else None
    if t is None or not 0 <= t <= DURATION:
        return []
    after = state(kind, p, t)
    before = dict(after)
    if kind == 'collision':
        before.update(vx=p['v1'], vx2=p['v2'], collided=False,
                      kinetic=.5*p['m1']*p['v1']**2+.5*p['m2']*p['v2']**2)
    else:
        angle = math.radians(p['angle'])
        ux, uy = p['v0']*math.cos(angle), p['v0']*math.sin(angle)-p['g']*t
        before.update(vx=ux, vy=uy, ay=-p['g'], landed=False, normal=0.,
                      kinetic=.5*p['m']*(ux*ux+uy*uy))
    before['energy'] = before['kinetic']+before['potential']
    return [before, after]


def simulate(kind, raw):
    p = validate(kind, raw)
    return {'kind':kind,'params':p,'dt':DT,'duration':DURATION,'meta':metadata(kind,p),'events':event_frames(kind,p),'frames':[state(kind,p,i*DT) for i in range(round(DURATION/DT)+1)]}
