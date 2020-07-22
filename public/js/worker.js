class Mash {
	constructor(data) {
		data = data.toString();

		let n = 0xefc8249d,
			i = 0,
			il = data.length;
		for (; i<il; i++) {
			n += data.charCodeAt(i);
			let h = 0.02519603282416938 * n;
			n = h >>> 0;
			h -= n;
			h *= n;
			n = h >>> 0;
			h -= n;
			n += h * 0x100000000; // 2^32
		}

		return (n >>> 0) * 2.3283064365386963e-10; // 2^-32
	}

	get version() {
		return "Mash 0.9";
	}
}

class Alea {
	constructor(args) {
		// Johannes Baagøe <baagoe@baagoe.com>, 2010
		if (args.length == 0) {
			args = [+new Date];
		}

		let mash = Mash();
		this.s0 = mash(" ");
		this.s1 = mash(" ");
		this.s2 = mash(" ");
		this.c = 1;

		for (let i=0, il=args.length; i<il; i++) {
			this.s0 -= mash(args[i]);
			if (this.s0 < 0) {
				this.s0 += 1;
			}
			this.s1 -= mash(args[i]);
			if (this.s1 < 0) {
				this.s1 += 1;
			}
			this.s2 -= mash(args[i]);
			if (this.s2 < 0) {
				this.s2 += 1;
			}
		}
	}

	random() {
		let t = 2091639 * this.s0 + c * 2.3283064365386963e-10; // 2^-32
		this.s0 = this.s1;
		this.s1 = this.s2;
		return this.s2 = t - (this.c = t | 0);
	}

	uint32() {
		return this.random() * 0x100000000; // 2^32
	}

	fract53() {
		return this.random() + (this.random() * 0x200000 | 0) * 1.1102230246251565e-16; // 2^-53
	}

	exportState() {
		return [this.s0, this.s1, this.s2, this.c];
	}

	static importState(i) {
		let random = new Alea(i);

		random.s0 = +i[0] || 0;
		random.s1 = +i[1] || 0;
		random.s2 = +i[2] || 0;
		random.c = +i[3] || 0;

		return random;
	}

	get version() {
		return "Alea 0.9";
	}
}

/*
 * A fast javascript implementation of simplex noise by Jonas Wagner
 *
 * Based on a speed-improved simplex noise algorithm for 2D, 3D and 4D in Java.
 * Which is based on example code by Stefan Gustavson (stegu@itn.liu.se).
 * With Optimisations by Peter Eastman (peastman@drizzle.stanford.edu).
 * Better rank ordering method by Stefan Gustavson in 2012.
 *
 */
 
class SimplexNoise {
	constructor(randomOrSeed) {
		this.F2 = 0.5 * (Math.sqrt(3.0) - 1.0);
		this.G2 = (3.0 - Math.sqrt(3.0)) / 6.0;

		let random = Math.random;

		if (typeof randomOrSeed == 'function') {
			random = randomOrSeed;
		} else if (randomOrSeed) {
			random = alea(randomOrSeed);
		}

		this.p = new Uint8Array(256);
		this.perm = new Uint8Array(512);
		this.permMod12 = new Uint8Array(512);

		for (let i=0; i<256; i++) {
			this.p[i] = random() * 256;
		}

		for (let i=0; i<512; i++) {
			this.perm[i] = this.p[i & 255];
			this.permMod12[i] = this.perm[i] % 12;
		}

		this.grad3 = new Float32Array([1, 1, 0, - 1, 1, 0, 1, - 1, 0, - 1, - 1, 0, 1, 0, 1, - 1, 0, 1, 1, 0, - 1, - 1, 0, - 1, 0, 1, 1, 0, - 1, 1, 0, 1, - 1, 0, - 1, - 1]);
		this.grad4 = new Float32Array([0, 1, 1, 1, 0, 1, 1, - 1, 0, 1, - 1, 1, 0, 1, - 1, - 1, 0, - 1, 1, 1, 0, - 1, 1, - 1, 0, - 1, - 1, 1, 0, - 1, - 1, - 1, 1, 0, 1, 1, 1, 0, 1, - 1, 1, 0, - 1, 1, 1, 0, - 1, - 1, - 1, 0, 1, 1, - 1, 0, 1, - 1, - 1, 0, - 1, 1, - 1, 0, - 1, - 1, 1, 1, 0, 1, 1, 1, 0, - 1, 1, - 1, 0, 1, 1, - 1, 0, - 1, - 1, 1, 0, 1, - 1, 1, 0, - 1, - 1, - 1, 0, 1, - 1, - 1, 0, - 1, 1, 1, 1, 0, 1, 1, - 1, 0, 1, - 1, 1, 0, 1, - 1, - 1, 0, - 1, 1, 1, 0, - 1, 1, - 1, 0, - 1, - 1, 1, 0, - 1, - 1, - 1, 0]);
	}

	noise2D(xin, yin) {
		let permMod12 = this.permMod12,
			perm = this.perm,
			grad3 = this.grad3,
			n0=0, n1=0, n2=0; // Noise contributions from the three corners
		// Skew the input space to determine which simplex cell we're in
		let s = (xin + yin) * this.F2, // Hairy factor for 2D
			i = Math.floor(xin + s),
			j = Math.floor(yin + s),
			t = (i + j) * this.G2,
			X0 = i - t, // Unskew the cell origin back to (x,y) space
			Y0 = j - t,
			x0 = xin - X0, // The x,y distances from the cell origin
			y0 = yin - Y0,
			// For the 2D case, the simplex shape is an equilateral triangle.
			// Determine which simplex we are in.
			i1, j1; // Offsets for second (middle) corner of simplex in (i,j) coords
		if (x0 > y0) {
			i1 = 1;
			j1 = 0;
		} else { // lower triangle, XY order: (0,0)->(1,0)->(1,1)
			i1 = 0;
			j1 = 1;
		} // upper triangle, YX order: (0,0)->(0,1)->(1,1)
		// A step of (1,0) in (i,j) means a step of (1-c,-c) in (x,y), and
		// a step of (0,1) in (i,j) means a step of (-c,1-c) in (x,y), where
		// c = (3-sqrt(3))/6
		let x1 = x0 - i1 + this.G2, // Offsets for middle corner in (x,y) unskewed coords
			y1 = y0 - j1 + this.G2,
			x2 = x0 - 1.0 + 2.0 * this.G2, // Offsets for last corner in (x,y) unskewed coords
			y2 = y0 - 1.0 + 2.0 * this.G2,
			// Work out the hashed gradient indices of the three simplex corners
			ii = i & 255,
			jj = j & 255,
			// Calculate the contribution from the three corners
			t0 = 0.5 - x0 * x0 - y0 * y0;
		if (t0 >= 0) {
			let gi0 = permMod12[ii + perm[jj]] * 3;
			t0 *= t0;
			n0 = t0 * t0 * (grad3[gi0] * x0 + grad3[gi0 + 1] * y0); // (x,y) of grad3 used for 2D gradient
		}
		let t1 = 0.5 - x1 * x1 - y1 * y1;
		if (t1 >= 0) {
			let gi1 = permMod12[ii + i1 + perm[jj + j1]] * 3;
			t1 *= t1;
			n1 = t1 * t1 * (grad3[gi1] * x1 + grad3[gi1 + 1] * y1);
		}
		let t2 = 0.5 - x2 * x2 - y2 * y2;
		if (t2 >= 0) {
			let gi2 = permMod12[ii + 1 + perm[jj + 1]] * 3;
			t2 *= t2;
			n2 = t2 * t2 * (grad3[gi2] * x2 + grad3[gi2 + 1] * y2);
		}
		// Add contributions from each corner to get the final noise value.
		// The result is scaled to return values in the interval [-1,1].
		return 70.0 * (n0 + n1 + n2);
	}
}

// From http://www.tannerhelland.com/4435/convert-temperature-rgb-algorithm-code/
function colorTemperatureToRGB(temperature){
	temperature *= 0.01;
	let r, g, b;
	if (temperature <= 66 ){
		r = 255;
		g = 99.4708025861 * Math.log(temperature) - 161.1195681661;
		if (temperature <= 19){
			b = 0;
		} else {
			b = 138.5177312231 * Math.log(temperature-10) - 305.0447927307;
		}
	} else {
		r = 329.698727446 * Math.pow(temperature-60, -0.1332047592);
		g = 288.1221695283 * Math.pow(temperature-60, -0.0755148492 );
		b = 255;
	}
	return [clamp(r, 0, 255), clamp(g, 0, 255), clamp(b, 0, 255)];
}


function clamp(x, x0, x1) {
	return Math.min(Math.max(x, x0), x1);
}

function addVignette(out, image, slice, radius, falloff, intensity){
	let od = out.data,
		id = image.data,
		w = image.width,
		h = image.height,
		ox = slice.x,
		oy = slice.y,
		sh = slice.height,
		sw = slice.width,
		scale = Math.min(slice.width, slice.height);

	for (let y = 0; y < h; y++) {
		let v = (y+oy-sh/2)/scale;
		v *= v;
		for (let x = 0; x < w; x++) {
			let i = (y*w+x)*4,
				h = (x+ox-sw/2)/scale;
			h *= h;
			let d = Math.sqrt(h+v);
			//let vignette = (1-Math.min(1, Math.max(0, (d-radius)/falloff)));
			let vignette = (1-Math.min(1, Math.max(0, (d-radius)/falloff))*(1-1/intensity));
			od[i] = dither(id[i]*vignette);
			od[i+1] = dither(id[i+1]*vignette);
			od[i+2] = dither(id[i+2]*vignette);
		}
	}
}

function dither(value){
	let floorValue = Math.floor(value),
		remainder = value-floorValue;
	return (Math.random() > remainder) ? floorValue : Math.ceil(value);
}

function addGrain(out, image, slice, scale, intensity){
	let simplex = new SimplexNoise(new Alea());
	console.time('addGrain');
	let od = out.data,
		id = image.data,
		w = image.width,
		h = image.height,
		ox = slice.x,
		oy = slice.y,
		d = Math.min(slice.width, slice.height);

	for (let y = 0; y < h; y++) {
		for (let x = 0; x < w; x++) {
			// reduce noise in shadows and highlights, 4 = no noise in pure black and white
			let i = (y*w+x)*4,
				l = (id[i]+id[i+1]+id[i+2])/768-0.5,
				rx = x + ox,
				ry = y + oy,
				noise = (simplex.noise2D(rx/d*scale, ry/d*scale) +
						 simplex.noise2D(rx/d*scale/2, ry/d*scale/2)*0.25 +
						 simplex.noise2D(rx/d*scale/4, ry/d*scale/4))*0.5;
			// reduce noise in shadows and highlights, 4 = no noise in pure black and white
			noise *= (1-l*l*2);
			noise *= intensity*255;
			od[i] = id[i]+noise;
			od[i+1] = id[i+1]+noise;
			od[i+2] = id[i+2]+noise;
		}
	}
	console.timeEnd('addGrain');
}


function addLightLeak(out, image, slice, intensity, scale, seed){
	let simplex = new SimplexNoise(new Alea(seed));
	console.time('addLightLeak');
	console.log(intensity, scale, seed);
	let od = out.data,
		id = image.data,
		w = image.width,
		h = image.height,
		ox = slice.x,
		oy = slice.y,
		d = Math.min(slice.width, slice.height);

	for (let y = 0; y < h; y++) {
		for (let x = 0; x < w; x++) {
			// reduce noise in shadows and highlights, 4 = no noise in pure black and white
			let i = (y*w+x)*4,
				rx = x + ox,
				ry = y + oy,
				noise = (simplex.noise2D(rx/d*scale, ry/d*scale) +
						 simplex.noise2D(rx/d*scale/2, ry/d*scale/2)*0.25 +
						 simplex.noise2D(rx/d*scale/4, ry/d*scale/4))*0.5,
				r = (simplex.noise2D(rx/d*scale, ry/d*scale+1000))*0.5+1,
				g = (simplex.noise2D(rx/d*scale+1000, ry/d*scale))*0.5+1,
				b = (simplex.noise2D(rx/d*scale+1000, ry/d*scale+1000))*0.5+1;

			noise *= noise;
			noise *= intensity*255;
			od[i] = id[i]+noise*r;
			od[i+1] = id[i+1]+noise*g;
			od[i+2] = id[i+2]+noise*b;
		}
	}
	console.timeEnd('addLightLeak');
}


function adjustTemperature(out, image, temperature){
	let od = out.data, id=image.data,
		[rx, gx, bx] = colorTemperatureToRGB(temperature),
		lr = 0.2126,
		lg = 0.7152,
		lb = 0.0722,
		m = (rx*lr+gx*lg+bx*lb);
	rx = m/rx;
	gx = m/gx;
	bx = m/bx;
	for (let i = 0; i < od.length;i+=4){
		id[i] = od[i]*rx;
		id[i+1] = od[i+1]*gx;
		id[i+2] = od[i+2]*bx;
	}
}

function adjust(out, image, brightness, contrast, saturation, vibrance, blacks) {
	console.time('adjust');
	let od = out.data, id=image.data,
		lr = 0.2126,
		lg = 0.7152,
		lb = 0.0722;

	brightness = brightness/(1-blacks);

	for (let i = 0; i < od.length;i+=4){
		// leave values gamma encoded, results are practically nicer
		let r = id[i]/255,
			g = id[i+1]/255,
			b = id[i+2]/255,
			l = (r*lr+g*lg+b*lb)/(lr+lg+lb);

		// blacks
		r = Math.max(0, r-blacks);
		g = Math.max(0, g-blacks);
		b = Math.max(0, b-blacks);

		// vibrance
		// based on darktables velvia iop
		let pmax = Math.max(r, g, b);
		let pmin = Math.min(r, g, b);
		let plum = (pmax + pmin) / 2;
		let psat = plum < 0.5 ? (pmax - pmin) / (1e-5 + pmax + pmin)
							  : (pmax - pmin) / (1e-5 + Math.max(0, 2 - pmax - pmin));
		let vbias = 0.8;
		let pweight = clamp(((1 - (1.5 * psat)) + ((1 + (Math.abs(plum - 0.5) * 2)) * (1 - vbias))) / (1 + (1 - vbias)), 0, 1);
		let saturationVibrance = saturation + vibrance*pweight;


		//let s = Math.max(Math.abs(r-l)*2, Math.abs(g-l), Math.abs(b-l)),
			//v = Math.max(0.5-s, 0)*vibrance*2;
		//r += (r-l)*v;
		//g += (g-l)*v;
		//b += (b-l)*v;

		// saturation
		r += (r-l)*saturationVibrance;
		g += (g-l)*saturationVibrance;
		b += (b-l)*saturationVibrance;

		// contrast
		r += (r-0.5)*contrast;
		g += (g-0.5)*contrast;
		b += (b-0.5)*contrast;

		r *= brightness;
		g *= brightness;
		b *= brightness;

		od[i] = dither(r*255);
		od[i+1] = dither(g*255);
		od[i+2] = dither(b*255);
	}
	console.timeEnd('adjust');
}

function mapColorsFast(out, image, clut, clutMix){
	console.time('mapColorsFast');
	let od = out.data,
		id = image.data,
		w = out.width,
		h = out.height,
		cd = clut.data,
		cl = Math.floor(Math.pow(clut.width, 1/3)+0.001),
		cs = cl*cl,
		cs1 = cs-1;

	let x0 = 1 - clutMix, x1 = clutMix;
	for (let y = 0; y < h; y++) {
		for (let x = 0; x < w; x++) {
			let i = (y*w+x)*4,
				r = id[i]/255*cs1,
				g = id[i+1]/255*cs1,
				b = id[i+2]/255*cs1,
				a = id[i+3]/255,
				ci = (dither(b)*cs*cs+dither(g)*cs+dither(r))*4;

			od[i] = id[i]*x0 + x1*cd[ci];
			od[i+1] = id[i+1]*x0 + x1*cd[ci+1];
			od[i+2] = id[i+2]*x0 + x1*cd[ci+2];
			od[i+3] = a*255;
		}
	}
	console.timeEnd('mapColorsFast');
}

function noisy(n){
	return Math.min(Math.max(0, n+Math.random()-0.5), 255);
}

function mapColors(out, image, clut, clutMix){
	console.time('mapColors');
	let od = out.data,
		id = image.data,
		w = out.width,
		h = out.height,
		cd = clut.data,
		cl = Math.floor(Math.pow(clut.width, 1/3)+0.001),
		cs = cl*cl,
		cs2 = cs-1;

	let r_min_g_min_b_min = [0, 0, 0],
		r_min_g_min_b_max = [0, 0, 0],
		r_min_g_max_b_min = [0, 0, 0],
		r_min_g_max_b_max = [0, 0, 0],
		r_max_g_min_b_min = [0, 0, 0],
		r_max_g_min_b_max = [0, 0, 0],
		r_max_g_max_b_min = [0, 0, 0],
		r_max_g_max_b_max = [0, 0, 0];

	for (let y = 0; y < h; y++) {
		for (let x = 0; x < w; x++) {
			let i = (y*w+x)*4,
				// randomize these to avoid banding
				r = id[i]/256*cs2,
				g = id[i+1]/256*cs2,
				b = id[i+2]/256*cs2,
				a = id[i+3]/256,
				r0 = Math.floor(r),
				r1 = Math.ceil(r),
				g0 = Math.floor(g),
				g1 = Math.ceil(g),
				b0 = Math.floor(b),
				b1 = Math.ceil(b);

			sample(r_min_g_min_b_min, cd, cs, r0, g0, b0);
			sample(r_min_g_min_b_max, cd, cs, r0, g0, b1);
			sample(r_min_g_max_b_min, cd, cs, r0, g1, b0);
			sample(r_min_g_max_b_max, cd, cs, r0, g1, b1);
			sample(r_max_g_min_b_min, cd, cs, r1, g0, b0);
			sample(r_max_g_min_b_max, cd, cs, r1, g0, b1);
			sample(r_max_g_max_b_min, cd, cs, r1, g1, b0);
			sample(r_max_g_max_b_max, cd, cs, r1, g1, b1);

			let t = b-b0;
			rgbLerp(r_min_g_min_b_min, r_min_g_min_b_min, r_min_g_min_b_max, t);
			rgbLerp(r_min_g_max_b_min, r_min_g_max_b_min, r_min_g_max_b_max, t);
			rgbLerp(r_max_g_min_b_min, r_max_g_min_b_min, r_max_g_min_b_max, t);
			rgbLerp(r_max_g_max_b_min, r_max_g_max_b_min, r_max_g_max_b_max, t);

			t = g-g0;
			rgbLerp(r_min_g_min_b_min, r_min_g_min_b_min, r_min_g_max_b_min, t);
			rgbLerp(r_max_g_min_b_min, r_max_g_min_b_min, r_max_g_max_b_min, t);

			t = r-r0;
			rgbLerp(r_min_g_min_b_min, r_min_g_min_b_min, r_max_g_min_b_min, t);

			let x0 = 1 - clutMix, x1 = clutMix;

			od[i] = id[i]*x0 + (r_min_g_min_b_min[0])*x1;
			od[i+1] = od[i+1]*x0 + (r_min_g_min_b_min[1])*x1;
			od[i+2] = od[i+2]*x0 + (r_min_g_min_b_min[2])*x1;
			od[i+3] = a*256;
		}
	}
	console.timeEnd('mapColors');
}

function rgbLerp(out, x, y, t){
	out[0] = x[0]+(y[0]-x[0])*t;
	out[1] = x[1]+(y[1]-x[1])*t;
	out[2] = x[2]+(y[2]-x[2])*t;
}

function sample(out, cd, cs, r, g, b){
	let ci = (b*cs*cs+g*cs+r)*4;
	out[0] = cd[ci];
	out[1] = cd[ci+1];
	out[2] = cd[ci+2];
}

function processImage(data, slice, options){
	if (options.brightness && options.brightness !== 1 || options.contrast || options.saturation || options.vibrance || options.temperature || options.blacks){
		adjust(data, data, options.brightness||1, options.contrast||0, options.saturation||0, options.vibrance||0, options.blacks || 0);
	}
	if (options.temperature && options.temperature != 6500){
		adjustTemperature(data, data, options.temperature);
	}
	if (options.vignette && options.vignette.intensity > 0){
		addVignette(data, data, slice, options.vignette.radius, options.vignette.falloff, options.vignette.intensity);
	}
	if (options.grain && options.grain.intensity > 0) {
		addGrain(data, data, slice, options.grain.scale, options.grain.intensity);
	}
	if (options.clut){
		if (options.highQuality){
			mapColors(data, data, options.clut, options.clutMix);
		} else {
			mapColorsFast(data, data, options.clut, options.clutMix);
		}
	}
	if (options.lightLeak && options.lightLeak.seed > 0){
		addLightLeak(data, data, slice, options.lightLeak.intensity||1, options.lightLeak.scale, options.lightLeak.seed);
	}
}

let clut;

let commands = {
    setClut: (clut_) => {
        clut = clut_;
    },
    processImage: (imageData, slice, options) => {
        //options.clut = clut;
        processImage(imageData, slice, options);
        self.postMessage(imageData, [imageData.data.buffer]);
    }
};

self.onmessage = function(e){
    commands[e.data.command].apply(self, e.data.arguments);
};
