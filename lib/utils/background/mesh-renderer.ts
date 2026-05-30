import { mat4 as Mat4, vec2 as Vec2, vec3 as Vec3, vec4 as Vec4 } from "gl-matrix";
import type { Disposable } from "./interfaces";
import {
	loadResourceFromElement,
	loadResourceFromUrl,
} from "./resource";
import { BaseRenderer } from "./base";
import {
	blurImage,
	brightnessImage,
	contrastImage,
	saturateImage,
} from "./img";
import { generateControlPoints } from "./cp-generate";
import { CONTROL_POINT_PRESETS, ControlPointConf } from "./cp-presets";
import { meshFragShader, meshFragShaderMobile, meshVertShader } from "./shaders";

type RenderingContext = WebGLRenderingContext;

class GLProgram implements Disposable {
	private gl: RenderingContext;
	program: WebGLProgram;
	private vertexShader: WebGLShader;
	private fragmentShader: WebGLShader;
	readonly attrs: { [name: string]: number };
	constructor(
		gl: RenderingContext,
		vertexShaderSource: string,
		fragmentShaderSource: string,
		private readonly label = "unknown",
	) {
		this.gl = gl;
		this.vertexShader = this.createShader(gl.VERTEX_SHADER, vertexShaderSource);
		this.fragmentShader = this.createShader(
			gl.FRAGMENT_SHADER,
			fragmentShaderSource,
		);
		this.program = this.createProgram();

		const num = gl.getProgramParameter(this.program, gl.ACTIVE_ATTRIBUTES);
		const attrs: { [name: string]: number } = {};
		for (let i = 0; i < num; i++) {
			const info = gl.getActiveAttrib(this.program, i);
			if (!info) continue;
			const location = gl.getAttribLocation(this.program, info.name);
			if (location === -1) continue;
			attrs[info.name] = location;
		}
		this.attrs = attrs;
	}
	private createShader(type: number, source: string) {
		const gl = this.gl;
		const shader = gl.createShader(type);
		if (!shader) throw new Error("Failed to create shader");
		gl.shaderSource(shader, source);
		gl.compileShader(shader);
		if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
			throw new Error(
				`Failed to compile shader for type ${type} "${this.label
				}": ${gl.getShaderInfoLog(shader)}`,
			);
		}
		return shader;
	}
	private createProgram() {
		const gl = this.gl;
		const program = gl.createProgram();
		if (!program) throw new Error("Failed to create program");
		gl.attachShader(program, this.vertexShader);
		gl.attachShader(program, this.fragmentShader);
		gl.linkProgram(program);
		gl.validateProgram(program);
		if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
			const errLog = gl.getProgramInfoLog(program);
			gl.deleteProgram(program);
			throw new Error(`Failed to link program "${this.label}": ${errLog}`);
		}
		return program;
	}
	use() {
		const gl = this.gl;
		gl.useProgram(this.program);
	}
	private notFoundUniforms: Set<string> = new Set();
	private warnUniformNotFound(name: string) {
		if (this.notFoundUniforms.has(name)) return;
		this.notFoundUniforms.add(name);
		console.warn(
			`Failed to get uniform location for program "${this.label}": ${name}`,
		);
	}
	setUniform1f(name: string, value: number) {
		const gl = this.gl;
		const location = gl.getUniformLocation(this.program, name);
		if (!location) this.warnUniformNotFound(name);
		else gl.uniform1f(location, value);
	}
	setUniform2f(name: string, value1: number, value2: number) {
		const gl = this.gl;
		const location = gl.getUniformLocation(this.program, name);
		if (!location) this.warnUniformNotFound(name);
		else gl.uniform2f(location, value1, value2);
	}
	setUniform1i(name: string, value: number) {
		const gl = this.gl;
		const location = gl.getUniformLocation(this.program, name);
		if (!location) this.warnUniformNotFound(name);
		else gl.uniform1i(location, value);
	}
	dispose() {
		const gl = this.gl;
		gl.deleteShader(this.vertexShader);
		gl.deleteShader(this.fragmentShader);
		gl.deleteProgram(this.program);
	}
}

class Mesh implements Disposable {
	protected vertexWidth = 0;
	protected vertexHeight = 0;
	private vertexBuffer: WebGLBuffer;
	private indexBuffer: WebGLBuffer;
	private vertexData: Float32Array;
	private indexData: Uint16Array;
	private vertexIndexLength = 0;
	// 调试用途，开启线框模式
	private wireFrame = false;
	constructor(
		private readonly gl: RenderingContext,
		private readonly attrPos: number | undefined,
		private readonly attrColor: number | undefined,
		private readonly attrUV: number | undefined,
	) {
		const vertexBuf = gl.createBuffer();
		if (!vertexBuf) throw new Error("Failed to create vertex buffer");
		this.vertexBuffer = vertexBuf;
		const indexBuf = gl.createBuffer();
		if (!indexBuf) throw new Error("Failed to create index buffer");
		this.indexBuffer = indexBuf;

		this.bind();

		this.vertexData = new Float32Array(0);
		this.indexData = new Uint16Array(0);

		this.resize(2, 2);
		this.update();
	}

	setWireFrame(enable: boolean) {
		this.wireFrame = enable;
		this.resize(this.vertexWidth, this.vertexHeight);
	}

	setVertexPos(vx: number, vy: number, x: number, y: number): void {
		const idx = (vx + vy * this.vertexWidth) * 7;
		if (idx >= this.vertexData.length - 1) return;
		this.vertexData[idx] = x;
		this.vertexData[idx + 1] = y;
	}

	setVertexColor(
		vx: number,
		vy: number,
		r: number,
		g: number,
		b: number,
	): void {
		const idx = (vx + vy * this.vertexWidth) * 7 + 2;
		if (idx >= this.vertexData.length - 2) return;
		this.vertexData[idx] = r;
		this.vertexData[idx + 1] = g;
		this.vertexData[idx + 2] = b;
	}

	setVertexUV(vx: number, vy: number, x: number, y: number): void {
		const idx = (vx + vy * this.vertexWidth) * 7 + 5;
		if (idx >= this.vertexData.length - 1) return;
		this.vertexData[idx] = x;
		this.vertexData[idx + 1] = y;
	}

	// 批量设置顶点数据的优化方法
	setVertexData(
		vx: number,
		vy: number,
		x: number,
		y: number,
		r: number,
		g: number,
		b: number,
		u: number,
		v: number,
	): void {
		const idx = (vx + vy * this.vertexWidth) * 7;
		if (idx >= this.vertexData.length - 6) return;
		const data = this.vertexData;
		data[idx] = x;
		data[idx + 1] = y;
		data[idx + 2] = r;
		data[idx + 3] = g;
		data[idx + 4] = b;
		data[idx + 5] = u;
		data[idx + 6] = v;
	}

	getVertexIndexLength(): number {
		return this.vertexIndexLength;
	}

	draw() {
		const gl = this.gl;

		if (this.wireFrame) {
			gl.drawElements(gl.LINES, this.vertexIndexLength, gl.UNSIGNED_SHORT, 0);
		} else {
			gl.drawElements(
				gl.TRIANGLES,
				this.vertexIndexLength,
				gl.UNSIGNED_SHORT,
				0,
			);
		}
	}

	resize(vertexWidth: number, vertexHeight: number): void {
		this.vertexWidth = vertexWidth;
		this.vertexHeight = vertexHeight;
		// 2 个顶点坐标 + 3 个颜色值 + 2 个 UV 坐标
		this.vertexIndexLength = vertexWidth * vertexHeight * 6;
		if (this.wireFrame) {
			this.vertexIndexLength = vertexWidth * vertexHeight * 10;
		}
		const vertexData = new Float32Array(
			vertexWidth * vertexHeight * (2 + 3 + 2),
		);
		const indexData = new Uint16Array(this.vertexIndexLength);
		this.vertexData = vertexData;
		this.indexData = indexData;
		for (let y = 0; y < vertexHeight; y++) {
			for (let x = 0; x < vertexWidth; x++) {
				const px = (x / (vertexWidth - 1)) * 2 - 1;
				const py = (y / (vertexHeight - 1)) * 2 - 1;
				this.setVertexPos(x, y, px || 0, py || 0);
				this.setVertexColor(x, y, 1, 1, 1);
				this.setVertexUV(x, y, x / (vertexWidth - 1), y / (vertexHeight - 1));
			}
		}
		for (let y = 0; y < vertexHeight - 1; y++) {
			for (let x = 0; x < vertexWidth - 1; x++) {
				if (this.wireFrame) {
					const idx = (y * vertexWidth + x) * 10;

					indexData[idx] = y * vertexWidth + x;
					indexData[idx + 1] = y * vertexWidth + x + 1;

					indexData[idx + 2] = y * vertexWidth + x + 1;
					indexData[idx + 3] = (y + 1) * vertexWidth + x;

					indexData[idx + 4] = (y + 1) * vertexWidth + x;
					indexData[idx + 5] = (y + 1) * vertexWidth + x + 1;

					indexData[idx + 6] = (y + 1) * vertexWidth + x + 1;
					indexData[idx + 7] = y * vertexWidth + x + 1;

					indexData[idx + 8] = y * vertexWidth + x;
					indexData[idx + 9] = (y + 1) * vertexWidth + x;
				} else {
					const idx = (y * vertexWidth + x) * 6;
					indexData[idx] = y * vertexWidth + x;
					indexData[idx + 1] = y * vertexWidth + x + 1;
					indexData[idx + 2] = (y + 1) * vertexWidth + x;
					indexData[idx + 3] = y * vertexWidth + x + 1;
					indexData[idx + 4] = (y + 1) * vertexWidth + x + 1;
					indexData[idx + 5] = (y + 1) * vertexWidth + x;
				}
			}
		}
		const gl = this.gl;
		gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, this.indexBuffer);
		gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, this.indexData, gl.STATIC_DRAW);
	}

	bind() {
		const gl = this.gl;
		gl.bindBuffer(gl.ARRAY_BUFFER, this.vertexBuffer);
		gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, this.indexBuffer);

		if (this.attrPos !== undefined) {
			gl.vertexAttribPointer(this.attrPos, 2, gl.FLOAT, false, 4 * 7, 0);
			gl.enableVertexAttribArray(this.attrPos);
		}
		if (this.attrColor !== undefined) {
			gl.vertexAttribPointer(this.attrColor, 3, gl.FLOAT, false, 4 * 7, 4 * 2);
			gl.enableVertexAttribArray(this.attrColor);
		}
		if (this.attrUV !== undefined) {
			gl.vertexAttribPointer(this.attrUV, 2, gl.FLOAT, false, 4 * 7, 4 * 5);
			gl.enableVertexAttribArray(this.attrUV);
		}
	}

	update() {
		const gl = this.gl;
		gl.bindBuffer(gl.ARRAY_BUFFER, this.vertexBuffer);
		gl.bufferData(gl.ARRAY_BUFFER, this.vertexData, gl.DYNAMIC_DRAW);
	}

	dispose(): void {
		this.gl.deleteBuffer(this.vertexBuffer);
		this.gl.deleteBuffer(this.indexBuffer);
	}
}

class ControlPoint {
	color = Vec3.fromValues(1, 1, 1);
	location = Vec2.fromValues(0, 0);
	uTangent = Vec2.fromValues(0, 0);
	vTangent = Vec2.fromValues(0, 0);
	private _uRot = 0;
	private _vRot = 0;
	private _uScale = 1;
	private _vScale = 1;

	constructor() {
		Object.seal(this);
	}

	get uRot() {
		return this._uRot;
	}

	get vRot() {
		return this._vRot;
	}

	set uRot(value: number) {
		this._uRot = value;
		this.updateUTangent();
	}

	set vRot(value: number) {
		this._vRot = value;
		this.updateVTangent();
	}

	get uScale() {
		return this._uScale;
	}

	get vScale() {
		return this._vScale;
	}

	set uScale(value: number) {
		this._uScale = value;
		this.updateUTangent();
	}

	set vScale(value: number) {
		this._vScale = value;
		this.updateVTangent();
	}

	private updateUTangent() {
		this.uTangent[0] = Math.cos(this._uRot) * this._uScale;
		this.uTangent[1] = Math.sin(this._uRot) * this._uScale;
	}

	private updateVTangent() {
		this.vTangent[0] = -Math.sin(this._vRot) * this._vScale;
		this.vTangent[1] = Math.cos(this._vRot) * this._vScale;
	}
}

const H = Mat4.fromValues(2, -2, 1, 1, -3, 3, -2, -1, 0, 0, 1, 0, 1, 0, 0, 0);
const H_T = Mat4.clone(H);
Mat4.transpose(H_T, H_T);

const spUx = Vec4.create();
const spUy = Vec4.create();
const spV = Vec4.create();

const spxAcc = Mat4.create();
const spyAcc = Mat4.create();
function surfacePoint(
	u: number,
	v: number,
	X: Mat4,
	Y: Mat4,
	output = Vec2.create(),
): import("gl-matrix").vec2 {
	spUx[0] = u ** 3;
	spUx[1] = u ** 2;
	spUx[2] = u;
	spUx[3] = 1;

	Vec4.copy(spUy, spUx);

	spV[0] = v ** 3;
	spV[1] = v ** 2;
	spV[2] = v;
	spV[3] = 1;

	Mat4.copy(spxAcc, X);
	Mat4.transpose(spxAcc, spxAcc);
	Mat4.mul(spxAcc, spxAcc, H);
	Mat4.mul(spxAcc, H_T, spxAcc);
	Vec4.transformMat4(spUx, spUx, spxAcc);
	const x = Vec4.dot(spV, spUx);

	Mat4.copy(spyAcc, Y);
	Mat4.transpose(spyAcc, spyAcc);
	Mat4.mul(spyAcc, spyAcc, H);
	Mat4.mul(spyAcc, H_T, spyAcc);
	Vec4.transformMat4(spUy, spUy, spyAcc);
	const y = Vec4.dot(spV, spUy);

	output[0] = x;
	output[1] = y;
	return output;
}

function meshCoefficients(
	p00: ControlPoint,
	p01: ControlPoint,
	p10: ControlPoint,
	p11: ControlPoint,
	axis: "0" | "1", // x=0, y=1 from Vec2
	output = Mat4.create(),
): import("gl-matrix").mat4 {
	const l = (p: ControlPoint) => p.location[Number(axis)];
	const u = (p: ControlPoint) => p.uTangent[Number(axis)];
	const v = (p: ControlPoint) => p.vTangent[Number(axis)];

	output[0] = l(p00);
	output[1] = l(p01);
	output[2] = v(p00);
	output[3] = v(p01);
	output[4] = l(p10);
	output[5] = l(p11);
	output[6] = v(p10);
	output[7] = v(p11);
	output[8] = u(p00);
	output[9] = u(p01);
	output[10] = 0;
	output[11] = 0;
	output[12] = u(p10);
	output[13] = u(p11);
	output[14] = 0;
	output[15] = 0;

	return output;
}

function colorCoefficients(
	p00: ControlPoint,
	p01: ControlPoint,
	p10: ControlPoint,
	p11: ControlPoint,
	axis: "0" | "1" | "2", // r=0, g=1, b=2 from Vec3
	output = Mat4.create(),
): import("gl-matrix").mat4 {
	const c = (p: ControlPoint) => p.color[Number(axis)];
	Mat4.identity(output); // reset slightly differently since Mat4 doesn't have fill
	for (let i = 0; i < 16; i++) output[i] = 0;
	output[0] = c(p00);
	output[1] = c(p01);
	output[4] = c(p10);
	output[5] = c(p11);

	return output;
}

const cpUx = Vec4.create();
const cpUy = Vec4.create();
const cpUz = Vec4.create();

const cpV = Vec4.create();

const cprAcc = Mat4.create();
const cpgAcc = Mat4.create();
const cpbAcc = Mat4.create();
const cpResult = Vec3.create();
function colorPoint(u: number, v: number, R: Mat4, G: Mat4, B: Mat4): import("gl-matrix").vec3 {
	cpUx[0] = u ** 3;
	cpUx[1] = u ** 2;
	cpUx[2] = u;
	cpUx[3] = 1;
	Vec4.copy(cpUy, cpUx);
	Vec4.copy(cpUz, cpUx);

	cpV[0] = v ** 3;
	cpV[1] = v ** 2;
	cpV[2] = v;
	cpV[3] = 1;

	Mat4.copy(cprAcc, R);
	Mat4.transpose(cprAcc, cprAcc);
	Mat4.mul(cprAcc, cprAcc, H);
	Mat4.mul(cprAcc, H_T, cprAcc);
	Vec4.transformMat4(cpUx, cpUx, cprAcc);
	cpResult[0] = Vec4.dot(cpV, cpUx);

	Mat4.copy(cpgAcc, G);
	Mat4.transpose(cpgAcc, cpgAcc);
	Mat4.mul(cpgAcc, cpgAcc, H);
	Mat4.mul(cpgAcc, H_T, cpgAcc);
	Vec4.transformMat4(cpUy, cpUy, cpgAcc);
	cpResult[1] = Vec4.dot(cpV, cpUy);

	Mat4.copy(cpbAcc, B);
	Mat4.transpose(cpbAcc, cpbAcc);
	Mat4.mul(cpbAcc, cpbAcc, H);
	Mat4.mul(cpbAcc, H_T, cpbAcc);
	Vec4.transformMat4(cpUz, cpUz, cpbAcc);
	cpResult[2] = Vec4.dot(cpV, cpUz);

	return cpResult;
}

class Map2D<T> {
	private _width = 0;
	private _height = 0;
	private _data: T[] = [];
	constructor(width: number, height: number) {
		this.resize(width, height);
		Object.seal(this);
	}
	resize(width: number, height: number) {
		this._width = width;
		this._height = height;
		this._data = new Array(width * height).fill(0 as any); // initialize roughly
	}
	set(x: number, y: number, value: T) {
		this._data[x + y * this._width] = value;
	}
	get(x: number, y: number) {
		return this._data[x + y * this._width];
	}
	get width() {
		return this._width;
	}
	get height() {
		return this._height;
	}
}

class BHPMesh extends Mesh {
	private _subDivisions = 10;
	private _controlPoints: Map2D<ControlPoint> = new Map2D(3, 3);

	constructor(
		gl: RenderingContext,
		attrPos: number,
		attrColor: number,
		attrUV: number,
	) {
		super(gl, attrPos, attrColor, attrUV);
		this.resizeControlPoints(3, 3);
		Object.seal(this);
	}
	override setWireFrame(enable: boolean) {
		super.setWireFrame(enable);
		this.updateMesh();
	}

	resetSubdivition(subDivisions: number) {
		this._subDivisions = subDivisions;
		super.resize(
			(this._controlPoints.width - 1) * subDivisions,
			(this._controlPoints.height - 1) * subDivisions,
		);
	}

	resizeControlPoints(width: number, height: number) {
		if (!(width >= 2 && height >= 2)) {
			throw new Error("Control points must be larger than 3x3 or equal");
		}
		this._controlPoints.resize(width, height);
		for (let y = 0; y < height; y++) {
			for (let x = 0; x < width; x++) {
				const point = new ControlPoint();
				point.location[0] = (x / (width - 1)) * 2 - 1;
				point.location[1] = (y / (height - 1)) * 2 - 1;
				point.uTangent[0] = 2 / (width - 1);
				point.vTangent[1] = 2 / (height - 1);
				this._controlPoints.set(x, y, point);
			}
		}
		this.resetSubdivition(this._subDivisions);
	}

	getControlPoint(x: number, y: number) {
		return this._controlPoints.get(x, y);
	}
	private tmpV2 = Vec2.create();
	private tempX = Mat4.create();
	private tempY = Mat4.create();
	private tempR = Mat4.create();
	private tempG = Mat4.create();
	private tempB = Mat4.create();

	updateMesh() {
		const subDivM1 = this._subDivisions - 1;
		const tW = subDivM1 * (this._controlPoints.height - 1);
		const tH = subDivM1 * (this._controlPoints.width - 1);
		const controlPointsWidth = this._controlPoints.width;
		const controlPointsHeight = this._controlPoints.height;
		const subDivisions = this._subDivisions;

		const invSubDivM1 = 1 / subDivM1;
		const invTH = 1 / tH;
		const invTW = 1 / tW;

		for (let x = 0; x < controlPointsWidth - 1; x++) {
			for (let y = 0; y < controlPointsHeight - 1; y++) {
				const p00 = this._controlPoints.get(x, y) as ControlPoint;
				const p01 = this._controlPoints.get(x, y + 1) as ControlPoint;
				const p10 = this._controlPoints.get(x + 1, y) as ControlPoint;
				const p11 = this._controlPoints.get(x + 1, y + 1) as ControlPoint;

				meshCoefficients(p00, p01, p10, p11, "0", this.tempX);
				meshCoefficients(p00, p01, p10, p11, "1", this.tempY);
				colorCoefficients(p00, p01, p10, p11, "0", this.tempR);
				colorCoefficients(p00, p01, p10, p11, "1", this.tempG);
				colorCoefficients(p00, p01, p10, p11, "2", this.tempB);

				const sX = x / (controlPointsWidth - 1);
				const sY = y / (controlPointsHeight - 1);
				const baseVx = y * subDivisions;
				const baseVy = x * subDivisions;

				for (let u = 0; u < subDivisions; u++) {
					const uNorm = u * invSubDivM1;
					const vxOffset = baseVx + u;

					for (let v = 0; v < subDivisions; v++) {
						const vNorm = v * invSubDivM1;
						const vy = baseVy + v;

						const [px, py] = surfacePoint(
							uNorm,
							vNorm,
							this.tempX,
							this.tempY,
							this.tmpV2,
						);
						const [pr, pg, pb] = colorPoint(
							uNorm,
							vNorm,
							this.tempR,
							this.tempG,
							this.tempB,
						);
						const uvX = sX + v * invTH;
						const uvY = 1 - sY - u * invTW;

						this.setVertexData(vxOffset, vy, px, py, pr, pg, pb, uvX, uvY);
					}
				}
			}
		}
		this.update();
	}
}

class GLTexture implements Disposable {
	readonly tex: WebGLTexture;

	constructor(
		private gl: WebGLRenderingContext,
		albumImageData: ImageData,
	) {
		const albumTexture = gl.createTexture();
		if (!albumTexture) throw new Error("Failed to create texture");
		this.tex = albumTexture;
		gl.activeTexture(gl.TEXTURE0);
		gl.bindTexture(gl.TEXTURE_2D, albumTexture);
		gl.texImage2D(
			gl.TEXTURE_2D,
			0,
			gl.RGBA,
			gl.RGBA,
			gl.UNSIGNED_BYTE,
			albumImageData,
		);
		gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
		gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
		gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.MIRRORED_REPEAT);
		gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.MIRRORED_REPEAT);
	}

	bind() {
		this.gl.bindTexture(this.gl.TEXTURE_2D, this.tex);
	}

	dispose(): void {
		this.gl.deleteTexture(this.tex);
	}
}

function createOffscreenCanvas(width: number, height: number) {
	if (typeof window !== "undefined" && "OffscreenCanvas" in window) return new OffscreenCanvas(width, height);
	const canvas = document.createElement("canvas");
	canvas.width = width;
	canvas.height = height;
	return canvas;
}

interface MeshState {
	mesh: BHPMesh;
	texture: GLTexture;
	alpha: number;
}

export class MeshGradientRenderer extends BaseRenderer {
	private gl: RenderingContext;
	private lastFrameTime = 0;
	private frameTime = 0;
	private lastTickTime = 0;
	private smoothedVolume = 0;
	private volume = 0;
	private bass = 0;
	private mid = 0;
	private treble = 0;
	private smoothedBass = 0;
	private smoothedMid = 0;
	private smoothedTreble = 0;
	private tickHandle = 0;
	private maxFPS = 60;
	private paused = false;
	private staticMode = false;
	private mainProgram: GLProgram;
	private manualControl = false;
	private reduceImageSizeCanvas = createOffscreenCanvas(
		32,
		32,
	) as HTMLCanvasElement;
	private targetSize = Vec2.create();
	private currentSize = Vec2.create();
	private isNoCover = true;
	private meshStates: MeshState[] = [];
	private _disposed = false;
	private frameCount = 0;
	private lastFPSUpdate = 0;
	private currentFPS = 0;
	private enablePerformanceMonitoring = false;
	private _mobileMode = false;

	private get meshSubdivision(): number {
		return this._mobileMode ? 6 : 15;
	}

	setManualControl(enable: boolean) {
		this.manualControl = enable;
	}

	setWireFrame(enable: boolean) {
		for (const state of this.meshStates) {
			state.mesh.setWireFrame(enable);
		}
	}

	getControlPoint(x: number, y: number): ControlPoint | undefined {
		return this.meshStates[this.meshStates.length - 1]?.mesh?.getControlPoint(
			x,
			y,
		);
	}

	resizeControlPoints(width: number, height: number) {
		return this.meshStates[
			this.meshStates.length - 1
		]?.mesh?.resizeControlPoints(width, height);
	}

	resetSubdivition(subDivisions: number) {
		return this.meshStates[this.meshStates.length - 1]?.mesh?.resetSubdivition(
			subDivisions,
		);
	}

	private onTick(tickTime: number) {
		this.tickHandle = 0;
		if (this.paused) return;
		if (this._disposed) return;

		this.updatePerformanceStats(tickTime);

		if (Number.isNaN(this.lastFrameTime)) {
			this.lastFrameTime = tickTime;
		}
		const delta = tickTime - this.lastTickTime;
		if (delta < 1000 / this.maxFPS) {
			this.requestTick();
			return;
		}

		const frameDelta = tickTime - this.lastFrameTime;
		this.lastFrameTime = tickTime;

		this.frameTime += frameDelta * this.flowSpeed;

		if (!(this.onRedraw(this.frameTime, frameDelta) && this.staticMode)) {
			this.requestTick();
		} else if (this.staticMode) {
			this.lastFrameTime = Number.NaN;
		}

		this.lastTickTime = tickTime;
	}

	private checkIfResize() {
		const [tW, tH] = [this.targetSize[0], this.targetSize[1]];
		const [cW, cH] = [this.currentSize[0], this.currentSize[1]];
		if (tW !== cW || tH !== cH) {
			super.onResize(tW, tH);
			const gl = this.gl;
			gl.bindFramebuffer(gl.FRAMEBUFFER, null);
			gl.viewport(0, 0, tW, tH);
			this.currentSize[0] = tW;
			this.currentSize[1] = tH;
		}
	}

	private onRedraw(tickTime: number, delta: number) {
		const latestMeshState = this.meshStates[this.meshStates.length - 1];
		let canBeStatic = false;

		const deltaFactor = delta / 500;

		if (latestMeshState) {
			const isTransitioning = latestMeshState.alpha < 1 || this.meshStates.length > 1;
			if (this.manualControl || isTransitioning) {
				latestMeshState.mesh.updateMesh();
			}

			if (this.isNoCover) {
				let hasActiveStates = false;
				for (let i = this.meshStates.length - 1; i >= 0; i--) {
					const state = this.meshStates[i];
					state.alpha = Math.max(0, state.alpha - deltaFactor);
					if (state.alpha > 0) {
						hasActiveStates = true;
					} else {
						state.mesh.dispose();
						state.texture.dispose();
						this.meshStates.splice(i, 1);
					}
				}
				canBeStatic = !hasActiveStates;
			} else {
				latestMeshState.alpha = Math.min(
					1,
					latestMeshState.alpha + deltaFactor,
				);
				if (latestMeshState.alpha >= 1) {
					const deleted = this.meshStates.splice(0, this.meshStates.length - 1);
					for (const state of deleted) {
						state.mesh.dispose();
						state.texture.dispose();
					}
				}
				canBeStatic =
					this.meshStates.length === 1 && latestMeshState.alpha >= 1;
			}
		}

		const gl = this.gl;
		gl.bindFramebuffer(gl.FRAMEBUFFER, null);
		gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
		gl.clear(gl.COLOR_BUFFER_BIT);
		this.checkIfResize();

		const lerpFactor = Math.min(0.5, delta / 150.0);
		this.smoothedVolume += (this.volume - this.smoothedVolume) * lerpFactor;
		this.smoothedBass += (this.bass - this.smoothedBass) * lerpFactor;
		this.smoothedMid += (this.mid - this.smoothedMid) * lerpFactor;
		this.smoothedTreble += (this.treble - this.smoothedTreble) * lerpFactor;

		this.mainProgram.use();

		gl.activeTexture(gl.TEXTURE0);
		this.mainProgram.setUniform1f("u_time", tickTime / 10000);
		this.mainProgram.setUniform1f(
			"u_aspect",
			this.manualControl ? 1 : this.canvas.width / this.canvas.height,
		);
		this.mainProgram.setUniform1i("u_texture", 0);
		this.mainProgram.setUniform1f("u_volume", this.volume);
		this.mainProgram.setUniform1f("u_bass", this.smoothedBass);
		this.mainProgram.setUniform1f("u_mid", this.smoothedMid);
		this.mainProgram.setUniform1f("u_treble", this.smoothedTreble);

		for (const state of this.meshStates) {
			this.mainProgram.setUniform1f("u_alpha", state.alpha);
			state.texture.bind();
			state.mesh.bind();
			state.mesh.draw();
		}

		gl.flush();

		return canBeStatic;
	}

	private onTickBinded = this.onTick.bind(this);

	private requestTick() {
		if (this._disposed) return;
		if (this.tickHandle === 0 && typeof requestAnimationFrame !== 'undefined')
			this.tickHandle = requestAnimationFrame(this.onTickBinded);
	}

	constructor(canvas: HTMLCanvasElement) {
		super(canvas);

		const gl = canvas.getContext("webgl");
		if (!gl) throw new Error("WebGL not supported");
		if (!gl.getExtension("EXT_color_buffer_float"))
			console.warn("EXT_color_buffer_float not supported");
		if (!gl.getExtension("EXT_float_blend")) {
			console.warn("EXT_float_blend not supported");
		}
		if (!gl.getExtension("OES_texture_float_linear"))
			console.warn("OES_texture_float_linear not supported");
		if (!gl.getExtension("OES_texture_float")) {
			console.warn("OES_texture_float not supported");
		}

		this.gl = gl;
		gl.enable(gl.BLEND);
		gl.enable(gl.DEPTH_TEST);
		gl.depthFunc(gl.ALWAYS);

		this.mainProgram = new GLProgram(
			gl,
			meshVertShader,
			meshFragShader,
			"main-program-mg",
		);

		// 初始化默认蓝色渐变背景，避免封面未加载时全黑
		this.initDefaultGradient();

		this.requestTick();
	}

	/**
	 * 生成默认蓝色渐变 ImageData（32x32）
	 */
	private createDefaultGradient(): ImageData {
		const size = 32;
		const imageData = new ImageData(size, size);
		const data = imageData.data;
		for (let y = 0; y < size; y++) {
			for (let x = 0; x < size; x++) {
				const idx = (y * size + x) * 4;
				const nx = x / (size - 1); // 0~1
				const ny = y / (size - 1); // 0~1
				// 从深蓝 (15, 23, 72) 到靛蓝 (30, 60, 130) 到蓝紫 (55, 40, 110)
				const r = Math.round(15 + nx * 40 + ny * 15);
				const g = Math.round(23 + nx * 17 + ny * 20);
				const b = Math.round(72 + nx * 38 + ny * 20);
				data[idx] = r;
				data[idx + 1] = g;
				data[idx + 2] = b;
				data[idx + 3] = 255;
			}
		}
		return imageData;
	}

	/**
	 * 用默认渐变色初始化一个 mesh state
	 */
	private initDefaultGradient() {
		const imageData = this.createDefaultGradient();

		const newMesh = new BHPMesh(
			this.gl,
			this.mainProgram.attrs.a_pos,
			this.mainProgram.attrs.a_color,
			this.mainProgram.attrs.a_uv,
		);
		newMesh.resetSubdivition(this.meshSubdivision);

		const chosenPreset =
			CONTROL_POINT_PRESETS[
			Math.floor(Math.random() * CONTROL_POINT_PRESETS.length)
			];

		newMesh.resizeControlPoints(chosenPreset.width, chosenPreset.height);
		const uPower = 2 / (chosenPreset.width - 1);
		const vPower = 2 / (chosenPreset.height - 1);
		for (const cp of chosenPreset.conf) {
			const p = newMesh.getControlPoint(cp.cx, cp.cy);
			if (p) {
				p.location[0] = cp.x;
				p.location[1] = cp.y;
				p.uRot = (cp.ur * Math.PI) / 180;
				p.vRot = (cp.vr * Math.PI) / 180;
				p.uScale = uPower * cp.up;
				p.vScale = vPower * cp.vp;
			}
		}

		newMesh.updateMesh();

		const albumTexture = new GLTexture(this.gl, imageData);
		const defaultState: MeshState = {
			mesh: newMesh,
			texture: albumTexture,
			alpha: 1,
		};
		this.meshStates.push(defaultState);
		this.isNoCover = false;
	}

	protected override onResize(width: number, height: number): void {
		this.targetSize[0] = Math.ceil(width);
		this.targetSize[1] = Math.ceil(height);
		this.requestTick();
	}

	override setStaticMode(enable: boolean): void {
		this.staticMode = enable;
		this.lastFrameTime = performance.now();
		this.requestTick();
	}
	override setFPS(fps: number): void {
		this.maxFPS = fps;
	}
	override pause(): void {
		if (this.tickHandle && typeof cancelAnimationFrame !== 'undefined') {
			cancelAnimationFrame(this.tickHandle);
			this.tickHandle = 0;
		}
		this.paused = true;
	}
	override resume(): void {
		this.paused = false;
		this.requestTick();
	}
	override async setAlbum(
		albumSource?: string | HTMLImageElement | HTMLVideoElement,
		isVideo?: boolean,
	): Promise<void> {
		if (
			albumSource === undefined ||
			(typeof albumSource === "string" && albumSource.trim().length === 0)
		) {
			this.initDefaultGradient();
			this.requestTick();
			return;
		}
		let res: HTMLImageElement | HTMLVideoElement | null = null;
		let remainRetryTimes = 5;
		while (!res && remainRetryTimes > 0) {
			try {
				if (typeof albumSource === "string") {
					res = await loadResourceFromUrl(albumSource, isVideo);
				} else {
					res = await loadResourceFromElement(albumSource);
				}
			} catch (error) {
				console.warn(
					`failed on loading album resource, retrying (${remainRetryTimes})`,
					{
						albumSource,
						error,
					},
				);
				remainRetryTimes--;
			}
		}
		if (!res) {
			console.error("Failed to load album resource", albumSource);
			this.initDefaultGradient();
			this.requestTick();
			return;
		}
		this.isNoCover = false;
		const c = this.reduceImageSizeCanvas;
		const ctx = c.getContext("2d", {
			willReadFrequently: true,
		});
		if (!ctx) throw new Error("Failed to create canvas context");
		ctx.clearRect(0, 0, c.width, c.height);
		const imgw =
			res instanceof HTMLVideoElement ? res.videoWidth : res.naturalWidth;
		const imgh =
			res instanceof HTMLVideoElement ? res.videoHeight : res.naturalHeight;
		if (imgw * imgh === 0) throw new Error("Invalid image size");
		ctx.drawImage(res, 0, 0, imgw, imgh, 0, 0, c.width, c.height);

		const imageData = ctx.getImageData(0, 0, c.width, c.height);
		contrastImage(imageData, 0.4);
		saturateImage(imageData, 3.0);
		contrastImage(imageData, 1.7);
		brightnessImage(imageData, 0.75);
		blurImage(imageData, 2, 4);

		if (this.manualControl && this.meshStates.length > 0) {
			this.meshStates[0].texture.dispose();
			this.meshStates[0].texture = new GLTexture(this.gl, imageData);
		} else {
			const newMesh = new BHPMesh(
				this.gl,
				this.mainProgram.attrs.a_pos,
				this.mainProgram.attrs.a_color,
				this.mainProgram.attrs.a_uv,
			);
			newMesh.resetSubdivition(this.meshSubdivision);

			const chosenPreset =
				Math.random() > 0.8
					? generateControlPoints(6, 6)
					: CONTROL_POINT_PRESETS[
					Math.floor(Math.random() * CONTROL_POINT_PRESETS.length)
					];

			newMesh.resizeControlPoints(chosenPreset.width, chosenPreset.height);
			const uPower = 2 / (chosenPreset.width - 1);
			const vPower = 2 / (chosenPreset.height - 1);
			for (const cp of chosenPreset.conf) {
				const p = newMesh.getControlPoint(cp.cx, cp.cy);
				if (p) {
					p.location[0] = cp.x;
					p.location[1] = cp.y;
					p.uRot = (cp.ur * Math.PI) / 180;
					p.vRot = (cp.vr * Math.PI) / 180;
					p.uScale = uPower * cp.up;
					p.vScale = vPower * cp.vp;
				}
			}

			newMesh.updateMesh();

			const albumTexture = new GLTexture(this.gl, imageData);
			const newState: MeshState = {
				mesh: newMesh,
				texture: albumTexture,
				alpha: 0,
			};
			this.meshStates.push(newState);
		}

		this.requestTick();
	}
	override setLowFreqVolume(volume: number): void {
		this.volume = volume / 10;
	}

	setFrequencyData(bass: number, mid: number, treble: number): void {
		this.bass = bass;
		this.mid = mid;
		this.treble = treble;
	}
	override setHasLyric(_hasLyric: boolean): void {
	}

	override setMobileMode(enable: boolean): void {
		super.setMobileMode(enable);
		this._mobileMode = enable;
		// 重建 shader program 以使用对应的 fragment shader
		this.mainProgram.dispose();
		this.mainProgram = new GLProgram(
			this.gl,
			meshVertShader,
			enable ? meshFragShaderMobile : meshFragShader,
			"main-program-mg",
		);
		// 重新绑定已有的 mesh states
		for (const state of this.meshStates) {
			state.mesh.bind();
		}
		this.requestTick();
	}

	override dispose(): void {
		super.dispose();
		if (this.tickHandle && typeof cancelAnimationFrame !== 'undefined') {
			cancelAnimationFrame(this.tickHandle);
			this.tickHandle = 0;
		}
		this._disposed = true;
		this.mainProgram.dispose();
		for (const state of this.meshStates) {
			state.mesh.dispose();
			state.texture.dispose();
		}
	}

	enablePerformanceMonitor(enable: boolean) {
		this.enablePerformanceMonitoring = enable;
		if (enable) {
			this.frameCount = 0;
			this.lastFPSUpdate = performance.now();
		}
	}

	getCurrentFPS(): number {
		return this.currentFPS;
	}

	private updatePerformanceStats(tickTime: number) {
		if (!this.enablePerformanceMonitoring) return;

		this.frameCount++;
		if (tickTime - this.lastFPSUpdate > 1000) {
			this.currentFPS = this.frameCount;
			this.frameCount = 0;
			this.lastFPSUpdate = tickTime;
		}
	}
}
