/**
 * Spring physics engine ported from test.html
 */

type SpringParams = {
    mass?: number;
    stiffness?: number;
    damping?: number;
    soft?: boolean;
};

type Solver = (t: number) => number;

function solveSpring(from: number, velocity: number, to: number, delay: number = 0, params: SpringParams = {}): Solver {
    const stiffness = params.stiffness || 100;
    const damping = params.damping || 10;
    const mass = params.mass || 1;
    const soft = params.soft || false;
    const delta = to - from;

    if (soft || 1.0 <= damping / (2.0 * Math.sqrt(stiffness * mass))) {
        const angular_frequency = -Math.sqrt(stiffness / mass);
        const leftover = -angular_frequency * delta - velocity;
        return (t: number) => {
            t -= delay;
            if (t < 0) return from;
            return to - (delta + t * leftover) * Math.E ** (t * angular_frequency);
        };
    }
    const damping_frequency = Math.sqrt(4.0 * mass * stiffness - damping ** 2.0);
    const leftover = (damping * delta - 2.0 * mass * velocity) / damping_frequency;
    const dfm = (0.5 * damping_frequency) / mass;
    const dm = -(0.5 * damping) / mass;
    return (t: number) => {
        t -= delay;
        if (t < 0) return from;
        return (to - (Math.cos(t * dfm) * delta + Math.sin(t * dfm) * leftover) * Math.E ** (t * dm));
    };
}

function getVelocity(currentSolver: Solver): (t: number) => number {
    return (t: number) => {
        const dt = 0.0001;
        return (currentSolver(t + dt) - currentSolver(t)) / dt;
    };
}

export class Spring {
    private currentPosition: number;
    private targetPosition: number;
    private currentTime: number;
    private params: SpringParams;
    private currentSolver: Solver;
    private getV: (t: number) => number;
    private queuePosition?: { position: number; time: number };
    private _settled: boolean = false;

    constructor(currentPosition = 0) {
        this.currentPosition = currentPosition;
        this.targetPosition = currentPosition;
        this.currentTime = 0;
        this.params = {};
        this.currentSolver = () => this.targetPosition;
        this.getV = () => 0;
    }

    private resetSolver() {
        const curV = this.getV(this.currentTime);
        this.currentTime = 0;
        this.currentSolver = solveSpring(this.currentPosition, curV, this.targetPosition, 0, this.params);
        this.getV = getVelocity(this.currentSolver);
    }

    updateParams(params: SpringParams) {
        this.params = { ...this.params, ...params };
        this.resetSolver();
    }

    setTargetPosition(targetPosition: number, delay = 0) {
        if (delay > 0) {
            this.queuePosition = { position: targetPosition, time: delay };
        } else {
            this.queuePosition = undefined;
            this.targetPosition = targetPosition;
            this._settled = false;
            this.resetSolver();
        }
    }

    setPosition(position: number) {
        this.currentPosition = position;
        this.targetPosition = position;
        this.currentSolver = () => this.targetPosition;
        this.getV = () => 0;
        this.currentTime = 0;
        this.queuePosition = undefined;
        this._settled = true;
    }

    update(delta = 0) {
        if (this._settled) return;
        this.currentTime += delta;
        this.currentPosition = this.currentSolver(this.currentTime);
        if (this.queuePosition) {
            this.queuePosition.time -= delta;
            if (this.queuePosition.time <= 0) {
                this.setTargetPosition(this.queuePosition.position, 0);
            }
        }
        // 收敛检测：位置接近目标且速度接近零时直接 snap 到目标
        const vel = Math.abs(this.getV(this.currentTime));
        const dist = Math.abs(this.currentPosition - this.targetPosition);
        if (vel < 0.5 && dist < 0.5) {
            this.currentPosition = this.targetPosition;
            this._settled = true;
        }
    }

    getCurrentPosition() {
        return this.currentPosition;
    }

    isSettled() {
        return this._settled;
    }
}
