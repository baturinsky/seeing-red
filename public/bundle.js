
(function(l, i, v, e) { v = l.createElement(i); v.async = 1; v.src = '//' + (location.host || 'localhost').split(':')[0] + ':35729/livereload.js?snipver=1'; e = l.getElementsByTagName(i)[0]; e.parentNode.insertBefore(v, e)})(document, 'script');
var app = (function (exports) {
    'use strict';

    function noop() { }
    function add_location(element, file, line, column, char) {
        element.__svelte_meta = {
            loc: { file, line, column, char }
        };
    }
    function run(fn) {
        return fn();
    }
    function blank_object() {
        return Object.create(null);
    }
    function run_all(fns) {
        fns.forEach(run);
    }
    function is_function(thing) {
        return typeof thing === 'function';
    }
    function safe_not_equal(a, b) {
        return a != a ? b == b : a !== b || ((a && typeof a === 'object') || typeof a === 'function');
    }
    function insert(target, node, anchor) {
        target.insertBefore(node, anchor || null);
    }
    function detach(node) {
        node.parentNode.removeChild(node);
    }
    function element(name) {
        return document.createElement(name);
    }
    function children(element) {
        return Array.from(element.childNodes);
    }

    let current_component;
    function set_current_component(component) {
        current_component = component;
    }

    const dirty_components = [];
    const resolved_promise = Promise.resolve();
    let update_scheduled = false;
    const binding_callbacks = [];
    const render_callbacks = [];
    const flush_callbacks = [];
    function schedule_update() {
        if (!update_scheduled) {
            update_scheduled = true;
            resolved_promise.then(flush);
        }
    }
    function add_render_callback(fn) {
        render_callbacks.push(fn);
    }
    function flush() {
        const seen_callbacks = new Set();
        do {
            // first, call beforeUpdate functions
            // and update components
            while (dirty_components.length) {
                const component = dirty_components.shift();
                set_current_component(component);
                update(component.$$);
            }
            while (binding_callbacks.length)
                binding_callbacks.shift()();
            // then, once components are updated, call
            // afterUpdate functions. This may cause
            // subsequent updates...
            while (render_callbacks.length) {
                const callback = render_callbacks.pop();
                if (!seen_callbacks.has(callback)) {
                    callback();
                    // ...so guard against infinite loops
                    seen_callbacks.add(callback);
                }
            }
        } while (dirty_components.length);
        while (flush_callbacks.length) {
            flush_callbacks.pop()();
        }
        update_scheduled = false;
    }
    function update($$) {
        if ($$.fragment) {
            $$.update($$.dirty);
            run_all($$.before_render);
            $$.fragment.p($$.dirty, $$.ctx);
            $$.dirty = null;
            $$.after_render.forEach(add_render_callback);
        }
    }
    function mount_component(component, target, anchor) {
        const { fragment, on_mount, on_destroy, after_render } = component.$$;
        fragment.m(target, anchor);
        // onMount happens after the initial afterUpdate. Because
        // afterUpdate callbacks happen in reverse order (inner first)
        // we schedule onMount callbacks before afterUpdate callbacks
        add_render_callback(() => {
            const new_on_destroy = on_mount.map(run).filter(is_function);
            if (on_destroy) {
                on_destroy.push(...new_on_destroy);
            }
            else {
                // Edge case - component was destroyed immediately,
                // most likely as a result of a binding initialising
                run_all(new_on_destroy);
            }
            component.$$.on_mount = [];
        });
        after_render.forEach(add_render_callback);
    }
    function destroy(component, detaching) {
        if (component.$$) {
            run_all(component.$$.on_destroy);
            component.$$.fragment.d(detaching);
            // TODO null out other refs, including component.$$ (but need to
            // preserve final state?)
            component.$$.on_destroy = component.$$.fragment = null;
            component.$$.ctx = {};
        }
    }
    function make_dirty(component, key) {
        if (!component.$$.dirty) {
            dirty_components.push(component);
            schedule_update();
            component.$$.dirty = blank_object();
        }
        component.$$.dirty[key] = true;
    }
    function init(component, options, instance, create_fragment, not_equal$$1, prop_names) {
        const parent_component = current_component;
        set_current_component(component);
        const props = options.props || {};
        const $$ = component.$$ = {
            fragment: null,
            ctx: null,
            // state
            props: prop_names,
            update: noop,
            not_equal: not_equal$$1,
            bound: blank_object(),
            // lifecycle
            on_mount: [],
            on_destroy: [],
            before_render: [],
            after_render: [],
            context: new Map(parent_component ? parent_component.$$.context : []),
            // everything else
            callbacks: blank_object(),
            dirty: null
        };
        let ready = false;
        $$.ctx = instance
            ? instance(component, props, (key, value) => {
                if ($$.ctx && not_equal$$1($$.ctx[key], $$.ctx[key] = value)) {
                    if ($$.bound[key])
                        $$.bound[key](value);
                    if (ready)
                        make_dirty(component, key);
                }
            })
            : props;
        $$.update();
        ready = true;
        run_all($$.before_render);
        $$.fragment = create_fragment($$.ctx);
        if (options.target) {
            if (options.hydrate) {
                // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
                $$.fragment.l(children(options.target));
            }
            else {
                // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
                $$.fragment.c();
            }
            if (options.intro && component.$$.fragment.i)
                component.$$.fragment.i();
            mount_component(component, options.target, options.anchor);
            flush();
        }
        set_current_component(parent_component);
    }
    class SvelteComponent {
        $destroy() {
            destroy(this, true);
            this.$destroy = noop;
        }
        $on(type, callback) {
            const callbacks = (this.$$.callbacks[type] || (this.$$.callbacks[type] = []));
            callbacks.push(callback);
            return () => {
                const index = callbacks.indexOf(callback);
                if (index !== -1)
                    callbacks.splice(index, 1);
            };
        }
        $set() {
            // overridden by instance, if it has props
        }
    }
    class SvelteComponentDev extends SvelteComponent {
        constructor(options) {
            if (!options || (!options.target && !options.$$inline)) {
                throw new Error(`'target' is a required option`);
            }
            super();
        }
        $destroy() {
            super.$destroy();
            this.$destroy = () => {
                console.warn(`Component was already destroyed`); // eslint-disable-line no-console
            };
        }
    }

    /**
     * This code is an implementation of Alea algorithm; (C) 2010 Johannes Baagøe.
     * Alea is licensed according to the http://en.wikipedia.org/wiki/MIT_License.
     */
    const FRAC = 2.3283064365386963e-10; /* 2^-32 */
    class RNG {
        constructor() {
            this._seed = 0;
            this._s0 = 0;
            this._s1 = 0;
            this._s2 = 0;
            this._c = 0;
        }
        getSeed() { return this._seed; }
        /**
         * Seed the number generator
         */
        setSeed(seed) {
            seed = (seed < 1 ? 1 / seed : seed);
            this._seed = seed;
            this._s0 = (seed >>> 0) * FRAC;
            seed = (seed * 69069 + 1) >>> 0;
            this._s1 = seed * FRAC;
            seed = (seed * 69069 + 1) >>> 0;
            this._s2 = seed * FRAC;
            this._c = 1;
            return this;
        }
        /**
         * @returns Pseudorandom value [0,1), uniformly distributed
         */
        getUniform() {
            let t = 2091639 * this._s0 + this._c * FRAC;
            this._s0 = this._s1;
            this._s1 = this._s2;
            this._c = t | 0;
            this._s2 = t - this._c;
            return this._s2;
        }
        /**
         * @param lowerBound The lower end of the range to return a value from, inclusive
         * @param upperBound The upper end of the range to return a value from, inclusive
         * @returns Pseudorandom value [lowerBound, upperBound], using ROT.RNG.getUniform() to distribute the value
         */
        getUniformInt(lowerBound, upperBound) {
            let max = Math.max(lowerBound, upperBound);
            let min = Math.min(lowerBound, upperBound);
            return Math.floor(this.getUniform() * (max - min + 1)) + min;
        }
        /**
         * @param mean Mean value
         * @param stddev Standard deviation. ~95% of the absolute values will be lower than 2*stddev.
         * @returns A normally distributed pseudorandom value
         */
        getNormal(mean = 0, stddev = 1) {
            let u, v, r;
            do {
                u = 2 * this.getUniform() - 1;
                v = 2 * this.getUniform() - 1;
                r = u * u + v * v;
            } while (r > 1 || r == 0);
            let gauss = u * Math.sqrt(-2 * Math.log(r) / r);
            return mean + gauss * stddev;
        }
        /**
         * @returns Pseudorandom value [1,100] inclusive, uniformly distributed
         */
        getPercentage() {
            return 1 + Math.floor(this.getUniform() * 100);
        }
        /**
         * @returns Randomly picked item, null when length=0
         */
        getItem(array) {
            if (!array.length) {
                return null;
            }
            return array[Math.floor(this.getUniform() * array.length)];
        }
        /**
         * @returns New array with randomized items
         */
        shuffle(array) {
            let result = [];
            let clone = array.slice();
            while (clone.length) {
                let index = clone.indexOf(this.getItem(clone));
                result.push(clone.splice(index, 1)[0]);
            }
            return result;
        }
        /**
         * @param data key=whatever, value=weight (relative probability)
         * @returns whatever
         */
        getWeightedValue(data) {
            let total = 0;
            for (let id in data) {
                total += data[id];
            }
            let random = this.getUniform() * total;
            let id, part = 0;
            for (id in data) {
                part += data[id];
                if (random < part) {
                    return id;
                }
            }
            // If by some floating-point annoyance we have
            // random >= total, just return the last id.
            return id;
        }
        /**
         * Get RNG state. Useful for storing the state and re-setting it via setState.
         * @returns Internal state
         */
        getState() { return [this._s0, this._s1, this._s2, this._c]; }
        /**
         * Set a previously retrieved state.
         */
        setState(state) {
            this._s0 = state[0];
            this._s1 = state[1];
            this._s2 = state[2];
            this._c = state[3];
            return this;
        }
        /**
         * Returns a cloned RNG
         */
        clone() {
            let clone = new RNG();
            return clone.setState(this.getState());
        }
    }
    var RNG$1 = new RNG().setSeed(Date.now());

    /**
     * @class Abstract display backend module
     * @private
     */
    class Backend {
        getContainer() { return null; }
        setOptions(options) { this._options = options; }
    }

    class Canvas extends Backend {
        constructor() {
            super();
            this._ctx = document.createElement("canvas").getContext("2d");
        }
        schedule(cb) { requestAnimationFrame(cb); }
        getContainer() { return this._ctx.canvas; }
        setOptions(opts) {
            super.setOptions(opts);
            const style = (opts.fontStyle ? `${opts.fontStyle} ` : ``);
            const font = `${style} ${opts.fontSize}px ${opts.fontFamily}`;
            this._ctx.font = font;
            this._updateSize();
            this._ctx.font = font;
            this._ctx.textAlign = "center";
            this._ctx.textBaseline = "middle";
        }
        clear() {
            this._ctx.fillStyle = this._options.bg;
            this._ctx.fillRect(0, 0, this._ctx.canvas.width, this._ctx.canvas.height);
        }
        eventToPosition(x, y) {
            let canvas = this._ctx.canvas;
            let rect = canvas.getBoundingClientRect();
            x -= rect.left;
            y -= rect.top;
            x *= canvas.width / rect.width;
            y *= canvas.height / rect.height;
            if (x < 0 || y < 0 || x >= canvas.width || y >= canvas.height) {
                return [-1, -1];
            }
            return this._normalizedEventToPosition(x, y);
        }
    }

    /**
     * Always positive modulus
     * @param x Operand
     * @param n Modulus
     * @returns x modulo n
     */
    function mod(x, n) {
        return (x % n + n) % n;
    }
    function clamp(val, min = 0, max = 1) {
        if (val < min)
            return min;
        if (val > max)
            return max;
        return val;
    }

    /**
     * @class Hexagonal backend
     * @private
     */
    class Hex extends Canvas {
        constructor() {
            super();
            this._spacingX = 0;
            this._spacingY = 0;
            this._hexSize = 0;
        }
        draw(data, clearBefore) {
            let [x, y, ch, fg, bg] = data;
            let px = [
                (x + 1) * this._spacingX,
                y * this._spacingY + this._hexSize
            ];
            if (this._options.transpose) {
                px.reverse();
            }
            if (clearBefore) {
                this._ctx.fillStyle = bg;
                this._fill(px[0], px[1]);
            }
            if (!ch) {
                return;
            }
            this._ctx.fillStyle = fg;
            let chars = [].concat(ch);
            for (let i = 0; i < chars.length; i++) {
                this._ctx.fillText(chars[i], px[0], Math.ceil(px[1]));
            }
        }
        computeSize(availWidth, availHeight) {
            if (this._options.transpose) {
                availWidth += availHeight;
                availHeight = availWidth - availHeight;
                availWidth -= availHeight;
            }
            let width = Math.floor(availWidth / this._spacingX) - 1;
            let height = Math.floor((availHeight - 2 * this._hexSize) / this._spacingY + 1);
            return [width, height];
        }
        computeFontSize(availWidth, availHeight) {
            if (this._options.transpose) {
                availWidth += availHeight;
                availHeight = availWidth - availHeight;
                availWidth -= availHeight;
            }
            let hexSizeWidth = 2 * availWidth / ((this._options.width + 1) * Math.sqrt(3)) - 1;
            let hexSizeHeight = availHeight / (2 + 1.5 * (this._options.height - 1));
            let hexSize = Math.min(hexSizeWidth, hexSizeHeight);
            // compute char ratio
            let oldFont = this._ctx.font;
            this._ctx.font = "100px " + this._options.fontFamily;
            let width = Math.ceil(this._ctx.measureText("W").width);
            this._ctx.font = oldFont;
            let ratio = width / 100;
            hexSize = Math.floor(hexSize) + 1; // closest larger hexSize
            // FIXME char size computation does not respect transposed hexes
            let fontSize = 2 * hexSize / (this._options.spacing * (1 + ratio / Math.sqrt(3)));
            // closest smaller fontSize
            return Math.ceil(fontSize) - 1;
        }
        _normalizedEventToPosition(x, y) {
            let nodeSize;
            if (this._options.transpose) {
                x += y;
                y = x - y;
                x -= y;
                nodeSize = this._ctx.canvas.width;
            }
            else {
                nodeSize = this._ctx.canvas.height;
            }
            let size = nodeSize / this._options.height;
            y = Math.floor(y / size);
            if (mod(y, 2)) { /* odd row */
                x -= this._spacingX;
                x = 1 + 2 * Math.floor(x / (2 * this._spacingX));
            }
            else {
                x = 2 * Math.floor(x / (2 * this._spacingX));
            }
            return [x, y];
        }
        /**
         * Arguments are pixel values. If "transposed" mode is enabled, then these two are already swapped.
         */
        _fill(cx, cy) {
            let a = this._hexSize;
            let b = this._options.border;
            const ctx = this._ctx;
            ctx.beginPath();
            if (this._options.transpose) {
                ctx.moveTo(cx - a + b, cy);
                ctx.lineTo(cx - a / 2 + b, cy + this._spacingX - b);
                ctx.lineTo(cx + a / 2 - b, cy + this._spacingX - b);
                ctx.lineTo(cx + a - b, cy);
                ctx.lineTo(cx + a / 2 - b, cy - this._spacingX + b);
                ctx.lineTo(cx - a / 2 + b, cy - this._spacingX + b);
                ctx.lineTo(cx - a + b, cy);
            }
            else {
                ctx.moveTo(cx, cy - a + b);
                ctx.lineTo(cx + this._spacingX - b, cy - a / 2 + b);
                ctx.lineTo(cx + this._spacingX - b, cy + a / 2 - b);
                ctx.lineTo(cx, cy + a - b);
                ctx.lineTo(cx - this._spacingX + b, cy + a / 2 - b);
                ctx.lineTo(cx - this._spacingX + b, cy - a / 2 + b);
                ctx.lineTo(cx, cy - a + b);
            }
            ctx.fill();
        }
        _updateSize() {
            const opts = this._options;
            const charWidth = Math.ceil(this._ctx.measureText("W").width);
            this._hexSize = Math.floor(opts.spacing * (opts.fontSize + charWidth / Math.sqrt(3)) / 2);
            this._spacingX = this._hexSize * Math.sqrt(3) / 2;
            this._spacingY = this._hexSize * 1.5;
            let xprop;
            let yprop;
            if (opts.transpose) {
                xprop = "height";
                yprop = "width";
            }
            else {
                xprop = "width";
                yprop = "height";
            }
            this._ctx.canvas[xprop] = Math.ceil((opts.width + 1) * this._spacingX);
            this._ctx.canvas[yprop] = Math.ceil((opts.height - 1) * this._spacingY + 2 * this._hexSize);
        }
    }

    /**
     * @class Rectangular backend
     * @private
     */
    class Rect extends Canvas {
        constructor() {
            super();
            this._spacingX = 0;
            this._spacingY = 0;
            this._canvasCache = {};
        }
        setOptions(options) {
            super.setOptions(options);
            this._canvasCache = {};
        }
        draw(data, clearBefore) {
            if (Rect.cache) {
                this._drawWithCache(data);
            }
            else {
                this._drawNoCache(data, clearBefore);
            }
        }
        _drawWithCache(data) {
            let [x, y, ch, fg, bg] = data;
            let hash = "" + ch + fg + bg;
            let canvas;
            if (hash in this._canvasCache) {
                canvas = this._canvasCache[hash];
            }
            else {
                let b = this._options.border;
                canvas = document.createElement("canvas");
                let ctx = canvas.getContext("2d");
                canvas.width = this._spacingX;
                canvas.height = this._spacingY;
                ctx.fillStyle = bg;
                ctx.fillRect(b, b, canvas.width - b, canvas.height - b);
                if (ch) {
                    ctx.fillStyle = fg;
                    ctx.font = this._ctx.font;
                    ctx.textAlign = "center";
                    ctx.textBaseline = "middle";
                    let chars = [].concat(ch);
                    for (let i = 0; i < chars.length; i++) {
                        ctx.fillText(chars[i], this._spacingX / 2, Math.ceil(this._spacingY / 2));
                    }
                }
                this._canvasCache[hash] = canvas;
            }
            this._ctx.drawImage(canvas, x * this._spacingX, y * this._spacingY);
        }
        _drawNoCache(data, clearBefore) {
            let [x, y, ch, fg, bg] = data;
            if (clearBefore) {
                let b = this._options.border;
                this._ctx.fillStyle = bg;
                this._ctx.fillRect(x * this._spacingX + b, y * this._spacingY + b, this._spacingX - b, this._spacingY - b);
            }
            if (!ch) {
                return;
            }
            this._ctx.fillStyle = fg;
            let chars = [].concat(ch);
            for (let i = 0; i < chars.length; i++) {
                this._ctx.fillText(chars[i], (x + 0.5) * this._spacingX, Math.ceil((y + 0.5) * this._spacingY));
            }
        }
        computeSize(availWidth, availHeight) {
            let width = Math.floor(availWidth / this._spacingX);
            let height = Math.floor(availHeight / this._spacingY);
            return [width, height];
        }
        computeFontSize(availWidth, availHeight) {
            let boxWidth = Math.floor(availWidth / this._options.width);
            let boxHeight = Math.floor(availHeight / this._options.height);
            /* compute char ratio */
            let oldFont = this._ctx.font;
            this._ctx.font = "100px " + this._options.fontFamily;
            let width = Math.ceil(this._ctx.measureText("W").width);
            this._ctx.font = oldFont;
            let ratio = width / 100;
            let widthFraction = ratio * boxHeight / boxWidth;
            if (widthFraction > 1) { /* too wide with current aspect ratio */
                boxHeight = Math.floor(boxHeight / widthFraction);
            }
            return Math.floor(boxHeight / this._options.spacing);
        }
        _normalizedEventToPosition(x, y) {
            return [Math.floor(x / this._spacingX), Math.floor(y / this._spacingY)];
        }
        _updateSize() {
            const opts = this._options;
            const charWidth = Math.ceil(this._ctx.measureText("W").width);
            this._spacingX = Math.ceil(opts.spacing * charWidth);
            this._spacingY = Math.ceil(opts.spacing * opts.fontSize);
            if (opts.forceSquareRatio) {
                this._spacingX = this._spacingY = Math.max(this._spacingX, this._spacingY);
            }
            this._ctx.canvas.width = opts.width * this._spacingX;
            this._ctx.canvas.height = opts.height * this._spacingY;
        }
    }
    Rect.cache = false;

    /**
     * @class Tile backend
     * @private
     */
    class Tile extends Canvas {
        constructor() {
            super();
            this._colorCanvas = document.createElement("canvas");
        }
        draw(data, clearBefore) {
            let [x, y, ch, fg, bg] = data;
            let tileWidth = this._options.tileWidth;
            let tileHeight = this._options.tileHeight;
            if (clearBefore) {
                if (this._options.tileColorize) {
                    this._ctx.clearRect(x * tileWidth, y * tileHeight, tileWidth, tileHeight);
                }
                else {
                    this._ctx.fillStyle = bg;
                    this._ctx.fillRect(x * tileWidth, y * tileHeight, tileWidth, tileHeight);
                }
            }
            if (!ch) {
                return;
            }
            let chars = [].concat(ch);
            let fgs = [].concat(fg);
            let bgs = [].concat(bg);
            for (let i = 0; i < chars.length; i++) {
                let tile = this._options.tileMap[chars[i]];
                if (!tile) {
                    throw new Error(`Char "${chars[i]}" not found in tileMap`);
                }
                if (this._options.tileColorize) { // apply colorization
                    let canvas = this._colorCanvas;
                    let context = canvas.getContext("2d");
                    context.globalCompositeOperation = "source-over";
                    context.clearRect(0, 0, tileWidth, tileHeight);
                    let fg = fgs[i];
                    let bg = bgs[i];
                    context.drawImage(this._options.tileSet, tile[0], tile[1], tileWidth, tileHeight, 0, 0, tileWidth, tileHeight);
                    if (fg != "transparent") {
                        context.fillStyle = fg;
                        context.globalCompositeOperation = "source-atop";
                        context.fillRect(0, 0, tileWidth, tileHeight);
                    }
                    if (bg != "transparent") {
                        context.fillStyle = bg;
                        context.globalCompositeOperation = "destination-over";
                        context.fillRect(0, 0, tileWidth, tileHeight);
                    }
                    this._ctx.drawImage(canvas, x * tileWidth, y * tileHeight, tileWidth, tileHeight);
                }
                else { // no colorizing, easy
                    this._ctx.drawImage(this._options.tileSet, tile[0], tile[1], tileWidth, tileHeight, x * tileWidth, y * tileHeight, tileWidth, tileHeight);
                }
            }
        }
        computeSize(availWidth, availHeight) {
            let width = Math.floor(availWidth / this._options.tileWidth);
            let height = Math.floor(availHeight / this._options.tileHeight);
            return [width, height];
        }
        computeFontSize() {
            throw new Error("Tile backend does not understand font size");
        }
        _normalizedEventToPosition(x, y) {
            return [Math.floor(x / this._options.tileWidth), Math.floor(y / this._options.tileHeight)];
        }
        _updateSize() {
            const opts = this._options;
            this._ctx.canvas.width = opts.width * opts.tileWidth;
            this._ctx.canvas.height = opts.height * opts.tileHeight;
            this._colorCanvas.width = opts.tileWidth;
            this._colorCanvas.height = opts.tileHeight;
        }
    }

    function fromString(str) {
        let cached, r;
        if (str in CACHE) {
            cached = CACHE[str];
        }
        else {
            if (str.charAt(0) == "#") { // hex rgb
                let matched = str.match(/[0-9a-f]/gi) || [];
                let values = matched.map((x) => parseInt(x, 16));
                if (values.length == 3) {
                    cached = values.map((x) => x * 17);
                }
                else {
                    for (let i = 0; i < 3; i++) {
                        values[i + 1] += 16 * values[i];
                        values.splice(i, 1);
                    }
                    cached = values;
                }
            }
            else if ((r = str.match(/rgb\(([0-9, ]+)\)/i))) { // decimal rgb
                cached = r[1].split(/\s*,\s*/).map((x) => parseInt(x));
            }
            else { // html name
                cached = [0, 0, 0];
            }
            CACHE[str] = cached;
        }
        return cached.slice();
    }
    /**
     * Add two or more colors
     */
    function add(color1, ...colors) {
        let result = color1.slice();
        for (let i = 0; i < 3; i++) {
            for (let j = 0; j < colors.length; j++) {
                result[i] += colors[j][i];
            }
        }
        return result;
    }
    /**
     * Add two or more colors, MODIFIES FIRST ARGUMENT
     */
    function add_(color1, ...colors) {
        for (let i = 0; i < 3; i++) {
            for (let j = 0; j < colors.length; j++) {
                color1[i] += colors[j][i];
            }
        }
        return color1;
    }
    /**
     * Multiply (mix) two or more colors
     */
    function multiply(color1, ...colors) {
        let result = color1.slice();
        for (let i = 0; i < 3; i++) {
            for (let j = 0; j < colors.length; j++) {
                result[i] *= colors[j][i] / 255;
            }
            result[i] = Math.round(result[i]);
        }
        return result;
    }
    /**
     * Multiply (mix) two or more colors, MODIFIES FIRST ARGUMENT
     */
    function multiply_(color1, ...colors) {
        for (let i = 0; i < 3; i++) {
            for (let j = 0; j < colors.length; j++) {
                color1[i] *= colors[j][i] / 255;
            }
            color1[i] = Math.round(color1[i]);
        }
        return color1;
    }
    /**
     * Interpolate (blend) two colors with a given factor
     */
    function interpolate(color1, color2, factor = 0.5) {
        let result = color1.slice();
        for (let i = 0; i < 3; i++) {
            result[i] = Math.round(result[i] + factor * (color2[i] - color1[i]));
        }
        return result;
    }
    const lerp = interpolate;
    /**
     * Interpolate (blend) two colors with a given factor in HSL mode
     */
    function interpolateHSL(color1, color2, factor = 0.5) {
        let hsl1 = rgb2hsl(color1);
        let hsl2 = rgb2hsl(color2);
        for (let i = 0; i < 3; i++) {
            hsl1[i] += factor * (hsl2[i] - hsl1[i]);
        }
        return hsl2rgb(hsl1);
    }
    const lerpHSL = interpolateHSL;
    /**
     * Create a new random color based on this one
     * @param color
     * @param diff Set of standard deviations
     */
    function randomize(color, diff) {
        if (!(diff instanceof Array)) {
            diff = Math.round(RNG$1.getNormal(0, diff));
        }
        let result = color.slice();
        for (let i = 0; i < 3; i++) {
            result[i] += (diff instanceof Array ? Math.round(RNG$1.getNormal(0, diff[i])) : diff);
        }
        return result;
    }
    /**
     * Converts an RGB color value to HSL. Expects 0..255 inputs, produces 0..1 outputs.
     */
    function rgb2hsl(color) {
        let r = color[0] / 255;
        let g = color[1] / 255;
        let b = color[2] / 255;
        let max = Math.max(r, g, b), min = Math.min(r, g, b);
        let h = 0, s, l = (max + min) / 2;
        if (max == min) {
            s = 0; // achromatic
        }
        else {
            let d = max - min;
            s = (l > 0.5 ? d / (2 - max - min) : d / (max + min));
            switch (max) {
                case r:
                    h = (g - b) / d + (g < b ? 6 : 0);
                    break;
                case g:
                    h = (b - r) / d + 2;
                    break;
                case b:
                    h = (r - g) / d + 4;
                    break;
            }
            h /= 6;
        }
        return [h, s, l];
    }
    function hue2rgb(p, q, t) {
        if (t < 0)
            t += 1;
        if (t > 1)
            t -= 1;
        if (t < 1 / 6)
            return p + (q - p) * 6 * t;
        if (t < 1 / 2)
            return q;
        if (t < 2 / 3)
            return p + (q - p) * (2 / 3 - t) * 6;
        return p;
    }
    /**
     * Converts an HSL color value to RGB. Expects 0..1 inputs, produces 0..255 outputs.
     */
    function hsl2rgb(color) {
        let l = color[2];
        if (color[1] == 0) {
            l = Math.round(l * 255);
            return [l, l, l];
        }
        else {
            let s = color[1];
            let q = (l < 0.5 ? l * (1 + s) : l + s - l * s);
            let p = 2 * l - q;
            let r = hue2rgb(p, q, color[0] + 1 / 3);
            let g = hue2rgb(p, q, color[0]);
            let b = hue2rgb(p, q, color[0] - 1 / 3);
            return [Math.round(r * 255), Math.round(g * 255), Math.round(b * 255)];
        }
    }
    function toRGB(color) {
        let clamped = color.map(x => clamp(x, 0, 255));
        return `rgb(${clamped.join(",")})`;
    }
    function toHex(color) {
        let clamped = color.map(x => clamp(x, 0, 255).toString(16).padStart(2, "0"));
        return `#${clamped.join("")}`;
    }
    const CACHE = {
        "black": [0, 0, 0],
        "navy": [0, 0, 128],
        "darkblue": [0, 0, 139],
        "mediumblue": [0, 0, 205],
        "blue": [0, 0, 255],
        "darkgreen": [0, 100, 0],
        "green": [0, 128, 0],
        "teal": [0, 128, 128],
        "darkcyan": [0, 139, 139],
        "deepskyblue": [0, 191, 255],
        "darkturquoise": [0, 206, 209],
        "mediumspringgreen": [0, 250, 154],
        "lime": [0, 255, 0],
        "springgreen": [0, 255, 127],
        "aqua": [0, 255, 255],
        "cyan": [0, 255, 255],
        "midnightblue": [25, 25, 112],
        "dodgerblue": [30, 144, 255],
        "forestgreen": [34, 139, 34],
        "seagreen": [46, 139, 87],
        "darkslategray": [47, 79, 79],
        "darkslategrey": [47, 79, 79],
        "limegreen": [50, 205, 50],
        "mediumseagreen": [60, 179, 113],
        "turquoise": [64, 224, 208],
        "royalblue": [65, 105, 225],
        "steelblue": [70, 130, 180],
        "darkslateblue": [72, 61, 139],
        "mediumturquoise": [72, 209, 204],
        "indigo": [75, 0, 130],
        "darkolivegreen": [85, 107, 47],
        "cadetblue": [95, 158, 160],
        "cornflowerblue": [100, 149, 237],
        "mediumaquamarine": [102, 205, 170],
        "dimgray": [105, 105, 105],
        "dimgrey": [105, 105, 105],
        "slateblue": [106, 90, 205],
        "olivedrab": [107, 142, 35],
        "slategray": [112, 128, 144],
        "slategrey": [112, 128, 144],
        "lightslategray": [119, 136, 153],
        "lightslategrey": [119, 136, 153],
        "mediumslateblue": [123, 104, 238],
        "lawngreen": [124, 252, 0],
        "chartreuse": [127, 255, 0],
        "aquamarine": [127, 255, 212],
        "maroon": [128, 0, 0],
        "purple": [128, 0, 128],
        "olive": [128, 128, 0],
        "gray": [128, 128, 128],
        "grey": [128, 128, 128],
        "skyblue": [135, 206, 235],
        "lightskyblue": [135, 206, 250],
        "blueviolet": [138, 43, 226],
        "darkred": [139, 0, 0],
        "darkmagenta": [139, 0, 139],
        "saddlebrown": [139, 69, 19],
        "darkseagreen": [143, 188, 143],
        "lightgreen": [144, 238, 144],
        "mediumpurple": [147, 112, 216],
        "darkviolet": [148, 0, 211],
        "palegreen": [152, 251, 152],
        "darkorchid": [153, 50, 204],
        "yellowgreen": [154, 205, 50],
        "sienna": [160, 82, 45],
        "brown": [165, 42, 42],
        "darkgray": [169, 169, 169],
        "darkgrey": [169, 169, 169],
        "lightblue": [173, 216, 230],
        "greenyellow": [173, 255, 47],
        "paleturquoise": [175, 238, 238],
        "lightsteelblue": [176, 196, 222],
        "powderblue": [176, 224, 230],
        "firebrick": [178, 34, 34],
        "darkgoldenrod": [184, 134, 11],
        "mediumorchid": [186, 85, 211],
        "rosybrown": [188, 143, 143],
        "darkkhaki": [189, 183, 107],
        "silver": [192, 192, 192],
        "mediumvioletred": [199, 21, 133],
        "indianred": [205, 92, 92],
        "peru": [205, 133, 63],
        "chocolate": [210, 105, 30],
        "tan": [210, 180, 140],
        "lightgray": [211, 211, 211],
        "lightgrey": [211, 211, 211],
        "palevioletred": [216, 112, 147],
        "thistle": [216, 191, 216],
        "orchid": [218, 112, 214],
        "goldenrod": [218, 165, 32],
        "crimson": [220, 20, 60],
        "gainsboro": [220, 220, 220],
        "plum": [221, 160, 221],
        "burlywood": [222, 184, 135],
        "lightcyan": [224, 255, 255],
        "lavender": [230, 230, 250],
        "darksalmon": [233, 150, 122],
        "violet": [238, 130, 238],
        "palegoldenrod": [238, 232, 170],
        "lightcoral": [240, 128, 128],
        "khaki": [240, 230, 140],
        "aliceblue": [240, 248, 255],
        "honeydew": [240, 255, 240],
        "azure": [240, 255, 255],
        "sandybrown": [244, 164, 96],
        "wheat": [245, 222, 179],
        "beige": [245, 245, 220],
        "whitesmoke": [245, 245, 245],
        "mintcream": [245, 255, 250],
        "ghostwhite": [248, 248, 255],
        "salmon": [250, 128, 114],
        "antiquewhite": [250, 235, 215],
        "linen": [250, 240, 230],
        "lightgoldenrodyellow": [250, 250, 210],
        "oldlace": [253, 245, 230],
        "red": [255, 0, 0],
        "fuchsia": [255, 0, 255],
        "magenta": [255, 0, 255],
        "deeppink": [255, 20, 147],
        "orangered": [255, 69, 0],
        "tomato": [255, 99, 71],
        "hotpink": [255, 105, 180],
        "coral": [255, 127, 80],
        "darkorange": [255, 140, 0],
        "lightsalmon": [255, 160, 122],
        "orange": [255, 165, 0],
        "lightpink": [255, 182, 193],
        "pink": [255, 192, 203],
        "gold": [255, 215, 0],
        "peachpuff": [255, 218, 185],
        "navajowhite": [255, 222, 173],
        "moccasin": [255, 228, 181],
        "bisque": [255, 228, 196],
        "mistyrose": [255, 228, 225],
        "blanchedalmond": [255, 235, 205],
        "papayawhip": [255, 239, 213],
        "lavenderblush": [255, 240, 245],
        "seashell": [255, 245, 238],
        "cornsilk": [255, 248, 220],
        "lemonchiffon": [255, 250, 205],
        "floralwhite": [255, 250, 240],
        "snow": [255, 250, 250],
        "yellow": [255, 255, 0],
        "lightyellow": [255, 255, 224],
        "ivory": [255, 255, 240],
        "white": [255, 255, 255]
    };

    var color = /*#__PURE__*/Object.freeze({
        fromString: fromString,
        add: add,
        add_: add_,
        multiply: multiply,
        multiply_: multiply_,
        interpolate: interpolate,
        lerp: lerp,
        interpolateHSL: interpolateHSL,
        lerpHSL: lerpHSL,
        randomize: randomize,
        rgb2hsl: rgb2hsl,
        hsl2rgb: hsl2rgb,
        toRGB: toRGB,
        toHex: toHex
    });

    /**
     * @class Tile backend
     * @private
     */
    class TileGL extends Backend {
        static isSupported() {
            return !!document.createElement("canvas").getContext("webgl2", { preserveDrawingBuffer: true });
        }
        constructor() {
            super();
            this._uniforms = {};
            try {
                this._gl = this._initWebGL();
            }
            catch (e) {
                alert(e.message);
            }
        }
        schedule(cb) { requestAnimationFrame(cb); }
        getContainer() { return this._gl.canvas; }
        setOptions(opts) {
            super.setOptions(opts);
            this._updateSize();
            let tileSet = this._options.tileSet;
            if (tileSet && "complete" in tileSet && !tileSet.complete) {
                tileSet.addEventListener("load", () => this._updateTexture(tileSet));
            }
            else {
                this._updateTexture(tileSet);
            }
        }
        draw(data, clearBefore) {
            const gl = this._gl;
            const opts = this._options;
            let [x, y, ch, fg, bg] = data;
            let scissorY = gl.canvas.height - (y + 1) * opts.tileHeight;
            gl.scissor(x * opts.tileWidth, scissorY, opts.tileWidth, opts.tileHeight);
            if (clearBefore) {
                if (opts.tileColorize) {
                    gl.clearColor(0, 0, 0, 0);
                }
                else {
                    gl.clearColor(...parseColor(bg));
                }
                gl.clear(gl.COLOR_BUFFER_BIT);
            }
            if (!ch) {
                return;
            }
            let chars = [].concat(ch);
            let bgs = [].concat(bg);
            let fgs = [].concat(fg);
            gl.uniform2fv(this._uniforms["targetPosRel"], [x, y]);
            for (let i = 0; i < chars.length; i++) {
                let tile = this._options.tileMap[chars[i]];
                if (!tile) {
                    throw new Error(`Char "${chars[i]}" not found in tileMap`);
                }
                gl.uniform1f(this._uniforms["colorize"], opts.tileColorize ? 1 : 0);
                gl.uniform2fv(this._uniforms["tilesetPosAbs"], tile);
                if (opts.tileColorize) {
                    gl.uniform4fv(this._uniforms["tint"], parseColor(fgs[i]));
                    gl.uniform4fv(this._uniforms["bg"], parseColor(bgs[i]));
                }
                gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
            }
            /*
            
            
                    for (let i=0;i<chars.length;i++) {
                        
                        if (this._options.tileColorize) { // apply colorization
                            let canvas = this._colorCanvas;
                            let context = canvas.getContext("2d") as CanvasRenderingContext2D;
                            context.globalCompositeOperation = "source-over";
                            context.clearRect(0, 0, tileWidth, tileHeight);
            
                            let fg = fgs[i];
                            let bg = bgs[i];
            
                            context.drawImage(
                                this._options.tileSet!,
                                tile[0], tile[1], tileWidth, tileHeight,
                                0, 0, tileWidth, tileHeight
                            );
            
                            if (fg != "transparent") {
                                context.fillStyle = fg;
                                context.globalCompositeOperation = "source-atop";
                                context.fillRect(0, 0, tileWidth, tileHeight);
                            }
            
                            if (bg != "transparent") {
                                context.fillStyle = bg;
                                context.globalCompositeOperation = "destination-over";
                                context.fillRect(0, 0, tileWidth, tileHeight);
                            }
            
                            this._ctx.drawImage(canvas, x*tileWidth, y*tileHeight, tileWidth, tileHeight);
                        } else { // no colorizing, easy
                            this._ctx.drawImage(
                                this._options.tileSet!,
                                tile[0], tile[1], tileWidth, tileHeight,
                                x*tileWidth, y*tileHeight, tileWidth, tileHeight
                            );
                        }
                    }
            
            */
        }
        clear() {
            const gl = this._gl;
            gl.clearColor(...parseColor(this._options.bg));
            gl.scissor(0, 0, gl.canvas.width, gl.canvas.height);
            gl.clear(gl.COLOR_BUFFER_BIT);
        }
        computeSize(availWidth, availHeight) {
            let width = Math.floor(availWidth / this._options.tileWidth);
            let height = Math.floor(availHeight / this._options.tileHeight);
            return [width, height];
        }
        computeFontSize() {
            throw new Error("Tile backend does not understand font size");
        }
        eventToPosition(x, y) {
            let canvas = this._gl.canvas;
            let rect = canvas.getBoundingClientRect();
            x -= rect.left;
            y -= rect.top;
            x *= canvas.width / rect.width;
            y *= canvas.height / rect.height;
            if (x < 0 || y < 0 || x >= canvas.width || y >= canvas.height) {
                return [-1, -1];
            }
            return this._normalizedEventToPosition(x, y);
        }
        _initWebGL() {
            let gl = document.createElement("canvas").getContext("webgl2", { preserveDrawingBuffer: true });
            window.gl = gl;
            let program = createProgram(gl, VS, FS);
            gl.useProgram(program);
            createQuad(gl);
            UNIFORMS.forEach(name => this._uniforms[name] = gl.getUniformLocation(program, name));
            this._program = program;
            gl.enable(gl.BLEND);
            gl.blendFuncSeparate(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA, gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
            gl.enable(gl.SCISSOR_TEST);
            return gl;
        }
        _normalizedEventToPosition(x, y) {
            return [Math.floor(x / this._options.tileWidth), Math.floor(y / this._options.tileHeight)];
        }
        _updateSize() {
            const gl = this._gl;
            const opts = this._options;
            const canvasSize = [opts.width * opts.tileWidth, opts.height * opts.tileHeight];
            gl.canvas.width = canvasSize[0];
            gl.canvas.height = canvasSize[1];
            gl.viewport(0, 0, canvasSize[0], canvasSize[1]);
            gl.uniform2fv(this._uniforms["tileSize"], [opts.tileWidth, opts.tileHeight]);
            gl.uniform2fv(this._uniforms["targetSize"], canvasSize);
        }
        _updateTexture(tileSet) {
            createTexture(this._gl, tileSet);
        }
    }
    const UNIFORMS = ["targetPosRel", "tilesetPosAbs", "tileSize", "targetSize", "colorize", "bg", "tint"];
    const VS = `
#version 300 es

in vec2 tilePosRel;
out vec2 tilesetPosPx;

uniform vec2 tilesetPosAbs;
uniform vec2 tileSize;
uniform vec2 targetSize;
uniform vec2 targetPosRel;

void main() {
	vec2 targetPosPx = (targetPosRel + tilePosRel) * tileSize;
	vec2 targetPosNdc = ((targetPosPx / targetSize)-0.5)*2.0;
	targetPosNdc.y *= -1.0;

	gl_Position = vec4(targetPosNdc, 0.0, 1.0);
	tilesetPosPx = tilesetPosAbs + tilePosRel * tileSize;
}`.trim();
    const FS = `
#version 300 es
precision highp float;

in vec2 tilesetPosPx;
out vec4 fragColor;
uniform sampler2D image;
uniform bool colorize;
uniform vec4 bg;
uniform vec4 tint;

void main() {
	fragColor = vec4(0, 0, 0, 1);

	vec4 texel = texelFetch(image, ivec2(tilesetPosPx), 0);

	if (colorize) {
		texel.rgb = tint.a * tint.rgb + (1.0-tint.a) * texel.rgb;
		fragColor.rgb = texel.a*texel.rgb + (1.0-texel.a)*bg.rgb;
		fragColor.a = texel.a + (1.0-texel.a)*bg.a;
	} else {
		fragColor = texel;
	}
}`.trim();
    function createProgram(gl, vss, fss) {
        const vs = gl.createShader(gl.VERTEX_SHADER);
        gl.shaderSource(vs, vss);
        gl.compileShader(vs);
        if (!gl.getShaderParameter(vs, gl.COMPILE_STATUS)) {
            throw new Error(gl.getShaderInfoLog(vs) || "");
        }
        const fs = gl.createShader(gl.FRAGMENT_SHADER);
        gl.shaderSource(fs, fss);
        gl.compileShader(fs);
        if (!gl.getShaderParameter(fs, gl.COMPILE_STATUS)) {
            throw new Error(gl.getShaderInfoLog(fs) || "");
        }
        const p = gl.createProgram();
        gl.attachShader(p, vs);
        gl.attachShader(p, fs);
        gl.linkProgram(p);
        if (!gl.getProgramParameter(p, gl.LINK_STATUS)) {
            throw new Error(gl.getProgramInfoLog(p) || "");
        }
        return p;
    }
    function createQuad(gl) {
        const pos = new Float32Array([0, 0, 1, 0, 0, 1, 1, 1]);
        const buf = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, buf);
        gl.bufferData(gl.ARRAY_BUFFER, pos, gl.STATIC_DRAW);
        gl.enableVertexAttribArray(0);
        gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
    }
    function createTexture(gl, data) {
        let t = gl.createTexture();
        gl.bindTexture(gl.TEXTURE_2D, t);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.REPEAT);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.REPEAT);
        gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, 0);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, data);
        return t;
    }
    let colorCache = {};
    function parseColor(color$1) {
        if (!(color$1 in colorCache)) {
            let parsed;
            if (color$1 == "transparent") {
                parsed = [0, 0, 0, 0];
            }
            else if (color$1.indexOf("rgba") > -1) {
                parsed = (color$1.match(/[\d.]+/g) || []).map(Number);
                for (let i = 0; i < 3; i++) {
                    parsed[i] = parsed[i] / 255;
                }
            }
            else {
                parsed = fromString(color$1).map($ => $ / 255);
                parsed.push(1);
            }
            colorCache[color$1] = parsed;
        }
        return colorCache[color$1];
    }

    function clearToAnsi(bg) {
        return `\x1b[0;48;5;${termcolor(bg)}m\x1b[2J`;
    }
    function colorToAnsi(fg, bg) {
        return `\x1b[0;38;5;${termcolor(fg)};48;5;${termcolor(bg)}m`;
    }
    function positionToAnsi(x, y) {
        return `\x1b[${y + 1};${x + 1}H`;
    }
    function termcolor(color$1) {
        const SRC_COLORS = 256.0;
        const DST_COLORS = 6.0;
        const COLOR_RATIO = DST_COLORS / SRC_COLORS;
        let rgb = fromString(color$1);
        let r = Math.floor(rgb[0] * COLOR_RATIO);
        let g = Math.floor(rgb[1] * COLOR_RATIO);
        let b = Math.floor(rgb[2] * COLOR_RATIO);
        return r * 36 + g * 6 + b * 1 + 16;
    }
    class Term extends Backend {
        constructor() {
            super();
            this._offset = [0, 0];
            this._cursor = [-1, -1];
            this._lastColor = "";
        }
        schedule(cb) { setTimeout(cb, 1000 / 60); }
        setOptions(options) {
            super.setOptions(options);
            let size = [options.width, options.height];
            let avail = this.computeSize();
            this._offset = avail.map((val, index) => Math.floor((val - size[index]) / 2));
        }
        clear() {
            process.stdout.write(clearToAnsi(this._options.bg));
        }
        draw(data, clearBefore) {
            // determine where to draw what with what colors
            let [x, y, ch, fg, bg] = data;
            // determine if we need to move the terminal cursor
            let dx = this._offset[0] + x;
            let dy = this._offset[1] + y;
            let size = this.computeSize();
            if (dx < 0 || dx >= size[0]) {
                return;
            }
            if (dy < 0 || dy >= size[1]) {
                return;
            }
            if (dx !== this._cursor[0] || dy !== this._cursor[1]) {
                process.stdout.write(positionToAnsi(dx, dy));
                this._cursor[0] = dx;
                this._cursor[1] = dy;
            }
            // terminals automatically clear, but if we're clearing when we're
            // not otherwise provided with a character, just use a space instead
            if (clearBefore) {
                if (!ch) {
                    ch = " ";
                }
            }
            // if we're not clearing and not provided with a character, do nothing
            if (!ch) {
                return;
            }
            // determine if we need to change colors
            let newColor = colorToAnsi(fg, bg);
            if (newColor !== this._lastColor) {
                process.stdout.write(newColor);
                this._lastColor = newColor;
            }
            // write the provided symbol to the display
            let chars = [].concat(ch);
            process.stdout.write(chars[0]);
            // update our position, given that we wrote a character
            this._cursor[0]++;
            if (this._cursor[0] >= size[0]) {
                this._cursor[0] = 0;
                this._cursor[1]++;
            }
        }
        computeFontSize() { throw new Error("Terminal backend has no notion of font size"); }
        eventToPosition(x, y) { return [x, y]; }
        computeSize() { return [process.stdout.columns, process.stdout.rows]; }
    }

    /**
     * @namespace
     * Contains text tokenization and breaking routines
     */
    const RE_COLORS = /%([bc]){([^}]*)}/g;
    // token types
    const TYPE_TEXT = 0;
    const TYPE_NEWLINE = 1;
    const TYPE_FG = 2;
    const TYPE_BG = 3;
    /**
     * Convert string to a series of a formatting commands
     */
    function tokenize(str, maxWidth) {
        let result = [];
        /* first tokenization pass - split texts and color formatting commands */
        let offset = 0;
        str.replace(RE_COLORS, function (match, type, name, index) {
            /* string before */
            let part = str.substring(offset, index);
            if (part.length) {
                result.push({
                    type: TYPE_TEXT,
                    value: part
                });
            }
            /* color command */
            result.push({
                type: (type == "c" ? TYPE_FG : TYPE_BG),
                value: name.trim()
            });
            offset = index + match.length;
            return "";
        });
        /* last remaining part */
        let part = str.substring(offset);
        if (part.length) {
            result.push({
                type: TYPE_TEXT,
                value: part
            });
        }
        return breakLines(result, maxWidth);
    }
    /* insert line breaks into first-pass tokenized data */
    function breakLines(tokens, maxWidth) {
        if (!maxWidth) {
            maxWidth = Infinity;
        }
        let i = 0;
        let lineLength = 0;
        let lastTokenWithSpace = -1;
        while (i < tokens.length) { /* take all text tokens, remove space, apply linebreaks */
            let token = tokens[i];
            if (token.type == TYPE_NEWLINE) { /* reset */
                lineLength = 0;
                lastTokenWithSpace = -1;
            }
            if (token.type != TYPE_TEXT) { /* skip non-text tokens */
                i++;
                continue;
            }
            /* remove spaces at the beginning of line */
            while (lineLength == 0 && token.value.charAt(0) == " ") {
                token.value = token.value.substring(1);
            }
            /* forced newline? insert two new tokens after this one */
            let index = token.value.indexOf("\n");
            if (index != -1) {
                token.value = breakInsideToken(tokens, i, index, true);
                /* if there are spaces at the end, we must remove them (we do not want the line too long) */
                let arr = token.value.split("");
                while (arr.length && arr[arr.length - 1] == " ") {
                    arr.pop();
                }
                token.value = arr.join("");
            }
            /* token degenerated? */
            if (!token.value.length) {
                tokens.splice(i, 1);
                continue;
            }
            if (lineLength + token.value.length > maxWidth) { /* line too long, find a suitable breaking spot */
                /* is it possible to break within this token? */
                let index = -1;
                while (1) {
                    let nextIndex = token.value.indexOf(" ", index + 1);
                    if (nextIndex == -1) {
                        break;
                    }
                    if (lineLength + nextIndex > maxWidth) {
                        break;
                    }
                    index = nextIndex;
                }
                if (index != -1) { /* break at space within this one */
                    token.value = breakInsideToken(tokens, i, index, true);
                }
                else if (lastTokenWithSpace != -1) { /* is there a previous token where a break can occur? */
                    let token = tokens[lastTokenWithSpace];
                    let breakIndex = token.value.lastIndexOf(" ");
                    token.value = breakInsideToken(tokens, lastTokenWithSpace, breakIndex, true);
                    i = lastTokenWithSpace;
                }
                else { /* force break in this token */
                    token.value = breakInsideToken(tokens, i, maxWidth - lineLength, false);
                }
            }
            else { /* line not long, continue */
                lineLength += token.value.length;
                if (token.value.indexOf(" ") != -1) {
                    lastTokenWithSpace = i;
                }
            }
            i++; /* advance to next token */
        }
        tokens.push({ type: TYPE_NEWLINE }); /* insert fake newline to fix the last text line */
        /* remove trailing space from text tokens before newlines */
        let lastTextToken = null;
        for (let i = 0; i < tokens.length; i++) {
            let token = tokens[i];
            switch (token.type) {
                case TYPE_TEXT:
                    lastTextToken = token;
                    break;
                case TYPE_NEWLINE:
                    if (lastTextToken) { /* remove trailing space */
                        let arr = lastTextToken.value.split("");
                        while (arr.length && arr[arr.length - 1] == " ") {
                            arr.pop();
                        }
                        lastTextToken.value = arr.join("");
                    }
                    lastTextToken = null;
                    break;
            }
        }
        tokens.pop(); /* remove fake token */
        return tokens;
    }
    /**
     * Create new tokens and insert them into the stream
     * @param {object[]} tokens
     * @param {int} tokenIndex Token being processed
     * @param {int} breakIndex Index within current token's value
     * @param {bool} removeBreakChar Do we want to remove the breaking character?
     * @returns {string} remaining unbroken token value
     */
    function breakInsideToken(tokens, tokenIndex, breakIndex, removeBreakChar) {
        let newBreakToken = {
            type: TYPE_NEWLINE
        };
        let newTextToken = {
            type: TYPE_TEXT,
            value: tokens[tokenIndex].value.substring(breakIndex + (removeBreakChar ? 1 : 0))
        };
        tokens.splice(tokenIndex + 1, 0, newBreakToken, newTextToken);
        return tokens[tokenIndex].value.substring(0, breakIndex);
    }

    /** Default with for display and map generators */
    let DEFAULT_WIDTH = 80;
    /** Default height for display and map generators */
    let DEFAULT_HEIGHT = 25;
    const DIRS = {
        4: [[0, -1], [1, 0], [0, 1], [-1, 0]],
        8: [[0, -1], [1, -1], [1, 0], [1, 1], [0, 1], [-1, 1], [-1, 0], [-1, -1]],
        6: [[-1, -1], [1, -1], [2, 0], [1, 1], [-1, 1], [-2, 0]]
    };

    const BACKENDS = {
        "hex": Hex,
        "rect": Rect,
        "tile": Tile,
        "tile-gl": TileGL,
        "term": Term
    };
    const DEFAULT_OPTIONS = {
        width: DEFAULT_WIDTH,
        height: DEFAULT_HEIGHT,
        transpose: false,
        layout: "rect",
        fontSize: 15,
        spacing: 1,
        border: 0,
        forceSquareRatio: false,
        fontFamily: "monospace",
        fontStyle: "",
        fg: "#ccc",
        bg: "#000",
        tileWidth: 32,
        tileHeight: 32,
        tileMap: {},
        tileSet: null,
        tileColorize: false
    };
    /**
     * @class Visual map display
     */
    class Display {
        constructor(options = {}) {
            this._data = {};
            this._dirty = false; // false = nothing, true = all, object = dirty cells
            this._options = {};
            options = Object.assign({}, DEFAULT_OPTIONS, options);
            this.setOptions(options);
            this.DEBUG = this.DEBUG.bind(this);
            this._tick = this._tick.bind(this);
            this._backend.schedule(this._tick);
        }
        /**
         * Debug helper, ideal as a map generator callback. Always bound to this.
         * @param {int} x
         * @param {int} y
         * @param {int} what
         */
        DEBUG(x, y, what) {
            let colors = [this._options.bg, this._options.fg];
            this.draw(x, y, null, null, colors[what % colors.length]);
        }
        /**
         * Clear the whole display (cover it with background color)
         */
        clear() {
            this._data = {};
            this._dirty = true;
        }
        /**
         * @see ROT.Display
         */
        setOptions(options) {
            Object.assign(this._options, options);
            if (options.width || options.height || options.fontSize || options.fontFamily || options.spacing || options.layout) {
                if (options.layout) {
                    let ctor = BACKENDS[options.layout];
                    this._backend = new ctor();
                }
                this._backend.setOptions(this._options);
                this._dirty = true;
            }
            return this;
        }
        /**
         * Returns currently set options
         */
        getOptions() { return this._options; }
        /**
         * Returns the DOM node of this display
         */
        getContainer() { return this._backend.getContainer(); }
        /**
         * Compute the maximum width/height to fit into a set of given constraints
         * @param {int} availWidth Maximum allowed pixel width
         * @param {int} availHeight Maximum allowed pixel height
         * @returns {int[2]} cellWidth,cellHeight
         */
        computeSize(availWidth, availHeight) {
            return this._backend.computeSize(availWidth, availHeight);
        }
        /**
         * Compute the maximum font size to fit into a set of given constraints
         * @param {int} availWidth Maximum allowed pixel width
         * @param {int} availHeight Maximum allowed pixel height
         * @returns {int} fontSize
         */
        computeFontSize(availWidth, availHeight) {
            return this._backend.computeFontSize(availWidth, availHeight);
        }
        computeTileSize(availWidth, availHeight) {
            let width = Math.floor(availWidth / this._options.width);
            let height = Math.floor(availHeight / this._options.height);
            return [width, height];
        }
        /**
         * Convert a DOM event (mouse or touch) to map coordinates. Uses first touch for multi-touch.
         * @param {Event} e event
         * @returns {int[2]} -1 for values outside of the canvas
         */
        eventToPosition(e) {
            let x, y;
            if ("touches" in e) {
                x = e.touches[0].clientX;
                y = e.touches[0].clientY;
            }
            else {
                x = e.clientX;
                y = e.clientY;
            }
            return this._backend.eventToPosition(x, y);
        }
        /**
         * @param {int} x
         * @param {int} y
         * @param {string || string[]} ch One or more chars (will be overlapping themselves)
         * @param {string} [fg] foreground color
         * @param {string} [bg] background color
         */
        draw(x, y, ch, fg, bg) {
            if (!fg) {
                fg = this._options.fg;
            }
            if (!bg) {
                bg = this._options.bg;
            }
            let key = `${x},${y}`;
            this._data[key] = [x, y, ch, fg, bg];
            if (this._dirty === true) {
                return;
            } // will already redraw everything 
            if (!this._dirty) {
                this._dirty = {};
            } // first!
            this._dirty[key] = true;
        }
        /**
         * Draws a text at given position. Optionally wraps at a maximum length. Currently does not work with hex layout.
         * @param {int} x
         * @param {int} y
         * @param {string} text May contain color/background format specifiers, %c{name}/%b{name}, both optional. %c{}/%b{} resets to default.
         * @param {int} [maxWidth] wrap at what width?
         * @returns {int} lines drawn
         */
        drawText(x, y, text, maxWidth) {
            let fg = null;
            let bg = null;
            let cx = x;
            let cy = y;
            let lines = 1;
            if (!maxWidth) {
                maxWidth = this._options.width - x;
            }
            let tokens = tokenize(text, maxWidth);
            while (tokens.length) { // interpret tokenized opcode stream
                let token = tokens.shift();
                switch (token.type) {
                    case TYPE_TEXT:
                        let isSpace = false, isPrevSpace = false, isFullWidth = false, isPrevFullWidth = false;
                        for (let i = 0; i < token.value.length; i++) {
                            let cc = token.value.charCodeAt(i);
                            let c = token.value.charAt(i);
                            // Assign to `true` when the current char is full-width.
                            isFullWidth = (cc > 0xff00 && cc < 0xff61) || (cc > 0xffdc && cc < 0xffe8) || cc > 0xffee;
                            // Current char is space, whatever full-width or half-width both are OK.
                            isSpace = (c.charCodeAt(0) == 0x20 || c.charCodeAt(0) == 0x3000);
                            // The previous char is full-width and
                            // current char is nether half-width nor a space.
                            if (isPrevFullWidth && !isFullWidth && !isSpace) {
                                cx++;
                            } // add an extra position
                            // The current char is full-width and
                            // the previous char is not a space.
                            if (isFullWidth && !isPrevSpace) {
                                cx++;
                            } // add an extra position
                            this.draw(cx++, cy, c, fg, bg);
                            isPrevSpace = isSpace;
                            isPrevFullWidth = isFullWidth;
                        }
                        break;
                    case TYPE_FG:
                        fg = token.value || null;
                        break;
                    case TYPE_BG:
                        bg = token.value || null;
                        break;
                    case TYPE_NEWLINE:
                        cx = x;
                        cy++;
                        lines++;
                        break;
                }
            }
            return lines;
        }
        /**
         * Timer tick: update dirty parts
         */
        _tick() {
            this._backend.schedule(this._tick);
            if (!this._dirty) {
                return;
            }
            if (this._dirty === true) { // draw all
                this._backend.clear();
                for (let id in this._data) {
                    this._draw(id, false);
                } // redraw cached data 
            }
            else { // draw only dirty 
                for (let key in this._dirty) {
                    this._draw(key, true);
                }
            }
            this._dirty = false;
        }
        /**
         * @param {string} key What to draw
         * @param {bool} clearBefore Is it necessary to clean before?
         */
        _draw(key, clearBefore) {
            let data = this._data[key];
            if (data[4] != this._options.bg) {
                clearBefore = true;
            }
            this._backend.draw(data, clearBefore);
        }
    }
    Display.Rect = Rect;
    Display.Hex = Hex;
    Display.Tile = Tile;
    Display.TileGL = TileGL;
    Display.Term = Term;

    class EventQueue {
        /**
         * @class Generic event queue: stores events and retrieves them based on their time
         */
        constructor() {
            this._time = 0;
            this._events = [];
            this._eventTimes = [];
        }
        /**
         * @returns {number} Elapsed time
         */
        getTime() { return this._time; }
        /**
         * Clear all scheduled events
         */
        clear() {
            this._events = [];
            this._eventTimes = [];
            return this;
        }
        /**
         * @param {?} event
         * @param {number} time
         */
        add(event, time) {
            let index = this._events.length;
            for (let i = 0; i < this._eventTimes.length; i++) {
                if (this._eventTimes[i] > time) {
                    index = i;
                    break;
                }
            }
            this._events.splice(index, 0, event);
            this._eventTimes.splice(index, 0, time);
        }
        /**
         * Locates the nearest event, advances time if necessary. Returns that event and removes it from the queue.
         * @returns {? || null} The event previously added by addEvent, null if no event available
         */
        get() {
            if (!this._events.length) {
                return null;
            }
            let time = this._eventTimes.splice(0, 1)[0];
            if (time > 0) { /* advance */
                this._time += time;
                for (let i = 0; i < this._eventTimes.length; i++) {
                    this._eventTimes[i] -= time;
                }
            }
            return this._events.splice(0, 1)[0];
        }
        /**
         * Get the time associated with the given event
         * @param {?} event
         * @returns {number} time
         */
        getEventTime(event) {
            let index = this._events.indexOf(event);
            if (index == -1) {
                return undefined;
            }
            return this._eventTimes[index];
        }
        /**
         * Remove an event from the queue
         * @param {?} event
         * @returns {bool} success?
         */
        remove(event) {
            let index = this._events.indexOf(event);
            if (index == -1) {
                return false;
            }
            this._remove(index);
            return true;
        }
        ;
        /**
         * Remove an event from the queue
         * @param {int} index
         */
        _remove(index) {
            this._events.splice(index, 1);
            this._eventTimes.splice(index, 1);
        }
        ;
    }

    class Scheduler {
        /**
         * @class Abstract scheduler
         */
        constructor() {
            this._queue = new EventQueue();
            this._repeat = [];
            this._current = null;
        }
        /**
         * @see ROT.EventQueue#getTime
         */
        getTime() { return this._queue.getTime(); }
        /**
         * @param {?} item
         * @param {bool} repeat
         */
        add(item, repeat) {
            if (repeat) {
                this._repeat.push(item);
            }
            return this;
        }
        /**
         * Get the time the given item is scheduled for
         * @param {?} item
         * @returns {number} time
         */
        getTimeOf(item) {
            return this._queue.getEventTime(item);
        }
        /**
         * Clear all items
         */
        clear() {
            this._queue.clear();
            this._repeat = [];
            this._current = null;
            return this;
        }
        /**
         * Remove a previously added item
         * @param {?} item
         * @returns {bool} successful?
         */
        remove(item) {
            let result = this._queue.remove(item);
            let index = this._repeat.indexOf(item);
            if (index != -1) {
                this._repeat.splice(index, 1);
            }
            if (this._current == item) {
                this._current = null;
            }
            return result;
        }
        /**
         * Schedule next item
         * @returns {?}
         */
        next() {
            this._current = this._queue.get();
            return this._current;
        }
    }

    /**
     * @class Simple fair scheduler (round-robin style)
     */
    class Simple extends Scheduler {
        add(item, repeat) {
            this._queue.add(item, 0);
            return super.add(item, repeat);
        }
        next() {
            if (this._current && this._repeat.indexOf(this._current) != -1) {
                this._queue.add(this._current, 0);
            }
            return super.next();
        }
    }

    /**
     * @class Speed-based scheduler
     */
    class Speed extends Scheduler {
        /**
         * @param {object} item anything with "getSpeed" method
         * @param {bool} repeat
         * @param {number} [time=1/item.getSpeed()]
         * @see ROT.Scheduler#add
         */
        add(item, repeat, time) {
            this._queue.add(item, time !== undefined ? time : 1 / item.getSpeed());
            return super.add(item, repeat);
        }
        /**
         * @see ROT.Scheduler#next
         */
        next() {
            if (this._current && this._repeat.indexOf(this._current) != -1) {
                this._queue.add(this._current, 1 / this._current.getSpeed());
            }
            return super.next();
        }
    }

    /**
     * @class Action-based scheduler
     * @augments ROT.Scheduler
     */
    class Action extends Scheduler {
        constructor() {
            super();
            this._defaultDuration = 1; /* for newly added */
            this._duration = this._defaultDuration; /* for this._current */
        }
        /**
         * @param {object} item
         * @param {bool} repeat
         * @param {number} [time=1]
         * @see ROT.Scheduler#add
         */
        add(item, repeat, time) {
            this._queue.add(item, time || this._defaultDuration);
            return super.add(item, repeat);
        }
        clear() {
            this._duration = this._defaultDuration;
            return super.clear();
        }
        remove(item) {
            if (item == this._current) {
                this._duration = this._defaultDuration;
            }
            return super.remove(item);
        }
        /**
         * @see ROT.Scheduler#next
         */
        next() {
            if (this._current && this._repeat.indexOf(this._current) != -1) {
                this._queue.add(this._current, this._duration || this._defaultDuration);
                this._duration = this._defaultDuration;
            }
            return super.next();
        }
        /**
         * Set duration for the active item
         */
        setDuration(time) {
            if (this._current) {
                this._duration = time;
            }
            return this;
        }
    }

    var Scheduler$1 = { Simple, Speed, Action };

    class FOV {
        /**
         * @class Abstract FOV algorithm
         * @param {function} lightPassesCallback Does the light pass through x,y?
         * @param {object} [options]
         * @param {int} [options.topology=8] 4/6/8
         */
        constructor(lightPassesCallback, options = {}) {
            this._lightPasses = lightPassesCallback;
            this._options = Object.assign({ topology: 8 }, options);
        }
        /**
         * Return all neighbors in a concentric ring
         * @param {int} cx center-x
         * @param {int} cy center-y
         * @param {int} r range
         */
        _getCircle(cx, cy, r) {
            let result = [];
            let dirs, countFactor, startOffset;
            switch (this._options.topology) {
                case 4:
                    countFactor = 1;
                    startOffset = [0, 1];
                    dirs = [
                        DIRS[8][7],
                        DIRS[8][1],
                        DIRS[8][3],
                        DIRS[8][5]
                    ];
                    break;
                case 6:
                    dirs = DIRS[6];
                    countFactor = 1;
                    startOffset = [-1, 1];
                    break;
                case 8:
                    dirs = DIRS[4];
                    countFactor = 2;
                    startOffset = [-1, 1];
                    break;
                default:
                    throw new Error("Incorrect topology for FOV computation");
                    break;
            }
            /* starting neighbor */
            let x = cx + startOffset[0] * r;
            let y = cy + startOffset[1] * r;
            /* circle */
            for (let i = 0; i < dirs.length; i++) {
                for (let j = 0; j < r * countFactor; j++) {
                    result.push([x, y]);
                    x += dirs[i][0];
                    y += dirs[i][1];
                }
            }
            return result;
        }
    }

    /**
     * @class Discrete shadowcasting algorithm. Obsoleted by Precise shadowcasting.
     * @augments ROT.FOV
     */
    class DiscreteShadowcasting extends FOV {
        compute(x, y, R, callback) {
            /* this place is always visible */
            callback(x, y, 0, 1);
            /* standing in a dark place. FIXME is this a good idea?  */
            if (!this._lightPasses(x, y)) {
                return;
            }
            /* start and end angles */
            let DATA = [];
            let A, B, cx, cy, blocks;
            /* analyze surrounding cells in concentric rings, starting from the center */
            for (let r = 1; r <= R; r++) {
                let neighbors = this._getCircle(x, y, r);
                let angle = 360 / neighbors.length;
                for (let i = 0; i < neighbors.length; i++) {
                    cx = neighbors[i][0];
                    cy = neighbors[i][1];
                    A = angle * (i - 0.5);
                    B = A + angle;
                    blocks = !this._lightPasses(cx, cy);
                    if (this._visibleCoords(Math.floor(A), Math.ceil(B), blocks, DATA)) {
                        callback(cx, cy, r, 1);
                    }
                    if (DATA.length == 2 && DATA[0] == 0 && DATA[1] == 360) {
                        return;
                    } /* cutoff? */
                } /* for all cells in this ring */
            } /* for all rings */
        }
        /**
         * @param {int} A start angle
         * @param {int} B end angle
         * @param {bool} blocks Does current cell block visibility?
         * @param {int[][]} DATA shadowed angle pairs
         */
        _visibleCoords(A, B, blocks, DATA) {
            if (A < 0) {
                let v1 = this._visibleCoords(0, B, blocks, DATA);
                let v2 = this._visibleCoords(360 + A, 360, blocks, DATA);
                return v1 || v2;
            }
            let index = 0;
            while (index < DATA.length && DATA[index] < A) {
                index++;
            }
            if (index == DATA.length) { /* completely new shadow */
                if (blocks) {
                    DATA.push(A, B);
                }
                return true;
            }
            let count = 0;
            if (index % 2) { /* this shadow starts in an existing shadow, or within its ending boundary */
                while (index < DATA.length && DATA[index] < B) {
                    index++;
                    count++;
                }
                if (count == 0) {
                    return false;
                }
                if (blocks) {
                    if (count % 2) {
                        DATA.splice(index - count, count, B);
                    }
                    else {
                        DATA.splice(index - count, count);
                    }
                }
                return true;
            }
            else { /* this shadow starts outside an existing shadow, or within a starting boundary */
                while (index < DATA.length && DATA[index] < B) {
                    index++;
                    count++;
                }
                /* visible when outside an existing shadow, or when overlapping */
                if (A == DATA[index - count] && count == 1) {
                    return false;
                }
                if (blocks) {
                    if (count % 2) {
                        DATA.splice(index - count, count, A);
                    }
                    else {
                        DATA.splice(index - count, count, A, B);
                    }
                }
                return true;
            }
        }
    }

    /**
     * @class Precise shadowcasting algorithm
     * @augments ROT.FOV
     */
    class PreciseShadowcasting extends FOV {
        compute(x, y, R, callback) {
            /* this place is always visible */
            callback(x, y, 0, 1);
            /* standing in a dark place. FIXME is this a good idea?  */
            if (!this._lightPasses(x, y)) {
                return;
            }
            /* list of all shadows */
            let SHADOWS = [];
            let cx, cy, blocks, A1, A2, visibility;
            /* analyze surrounding cells in concentric rings, starting from the center */
            for (let r = 1; r <= R; r++) {
                let neighbors = this._getCircle(x, y, r);
                let neighborCount = neighbors.length;
                for (let i = 0; i < neighborCount; i++) {
                    cx = neighbors[i][0];
                    cy = neighbors[i][1];
                    /* shift half-an-angle backwards to maintain consistency of 0-th cells */
                    A1 = [i ? 2 * i - 1 : 2 * neighborCount - 1, 2 * neighborCount];
                    A2 = [2 * i + 1, 2 * neighborCount];
                    blocks = !this._lightPasses(cx, cy);
                    visibility = this._checkVisibility(A1, A2, blocks, SHADOWS);
                    if (visibility) {
                        callback(cx, cy, r, visibility);
                    }
                    if (SHADOWS.length == 2 && SHADOWS[0][0] == 0 && SHADOWS[1][0] == SHADOWS[1][1]) {
                        return;
                    } /* cutoff? */
                } /* for all cells in this ring */
            } /* for all rings */
        }
        /**
         * @param {int[2]} A1 arc start
         * @param {int[2]} A2 arc end
         * @param {bool} blocks Does current arc block visibility?
         * @param {int[][]} SHADOWS list of active shadows
         */
        _checkVisibility(A1, A2, blocks, SHADOWS) {
            if (A1[0] > A2[0]) { /* split into two sub-arcs */
                let v1 = this._checkVisibility(A1, [A1[1], A1[1]], blocks, SHADOWS);
                let v2 = this._checkVisibility([0, 1], A2, blocks, SHADOWS);
                return (v1 + v2) / 2;
            }
            /* index1: first shadow >= A1 */
            let index1 = 0, edge1 = false;
            while (index1 < SHADOWS.length) {
                let old = SHADOWS[index1];
                let diff = old[0] * A1[1] - A1[0] * old[1];
                if (diff >= 0) { /* old >= A1 */
                    if (diff == 0 && !(index1 % 2)) {
                        edge1 = true;
                    }
                    break;
                }
                index1++;
            }
            /* index2: last shadow <= A2 */
            let index2 = SHADOWS.length, edge2 = false;
            while (index2--) {
                let old = SHADOWS[index2];
                let diff = A2[0] * old[1] - old[0] * A2[1];
                if (diff >= 0) { /* old <= A2 */
                    if (diff == 0 && (index2 % 2)) {
                        edge2 = true;
                    }
                    break;
                }
            }
            let visible = true;
            if (index1 == index2 && (edge1 || edge2)) { /* subset of existing shadow, one of the edges match */
                visible = false;
            }
            else if (edge1 && edge2 && index1 + 1 == index2 && (index2 % 2)) { /* completely equivalent with existing shadow */
                visible = false;
            }
            else if (index1 > index2 && (index1 % 2)) { /* subset of existing shadow, not touching */
                visible = false;
            }
            if (!visible) {
                return 0;
            } /* fast case: not visible */
            let visibleLength;
            /* compute the length of visible arc, adjust list of shadows (if blocking) */
            let remove = index2 - index1 + 1;
            if (remove % 2) {
                if (index1 % 2) { /* first edge within existing shadow, second outside */
                    let P = SHADOWS[index1];
                    visibleLength = (A2[0] * P[1] - P[0] * A2[1]) / (P[1] * A2[1]);
                    if (blocks) {
                        SHADOWS.splice(index1, remove, A2);
                    }
                }
                else { /* second edge within existing shadow, first outside */
                    let P = SHADOWS[index2];
                    visibleLength = (P[0] * A1[1] - A1[0] * P[1]) / (A1[1] * P[1]);
                    if (blocks) {
                        SHADOWS.splice(index1, remove, A1);
                    }
                }
            }
            else {
                if (index1 % 2) { /* both edges within existing shadows */
                    let P1 = SHADOWS[index1];
                    let P2 = SHADOWS[index2];
                    visibleLength = (P2[0] * P1[1] - P1[0] * P2[1]) / (P1[1] * P2[1]);
                    if (blocks) {
                        SHADOWS.splice(index1, remove);
                    }
                }
                else { /* both edges outside existing shadows */
                    if (blocks) {
                        SHADOWS.splice(index1, remove, A1, A2);
                    }
                    return 1; /* whole arc visible! */
                }
            }
            let arcLength = (A2[0] * A1[1] - A1[0] * A2[1]) / (A1[1] * A2[1]);
            return visibleLength / arcLength;
        }
    }

    /** Octants used for translating recursive shadowcasting offsets */
    const OCTANTS = [
        [-1, 0, 0, 1],
        [0, -1, 1, 0],
        [0, -1, -1, 0],
        [-1, 0, 0, -1],
        [1, 0, 0, -1],
        [0, 1, -1, 0],
        [0, 1, 1, 0],
        [1, 0, 0, 1]
    ];
    /**
     * @class Recursive shadowcasting algorithm
     * Currently only supports 4/8 topologies, not hexagonal.
     * Based on Peter Harkins' implementation of Björn Bergström's algorithm described here: http://www.roguebasin.com/index.php?title=FOV_using_recursive_shadowcasting
     * @augments ROT.FOV
     */
    class RecursiveShadowcasting extends FOV {
        /**
         * Compute visibility for a 360-degree circle
         * @param {int} x
         * @param {int} y
         * @param {int} R Maximum visibility radius
         * @param {function} callback
         */
        compute(x, y, R, callback) {
            //You can always see your own tile
            callback(x, y, 0, 1);
            for (let i = 0; i < OCTANTS.length; i++) {
                this._renderOctant(x, y, OCTANTS[i], R, callback);
            }
        }
        /**
         * Compute visibility for a 180-degree arc
         * @param {int} x
         * @param {int} y
         * @param {int} R Maximum visibility radius
         * @param {int} dir Direction to look in (expressed in a ROT.DIRS value);
         * @param {function} callback
         */
        compute180(x, y, R, dir, callback) {
            //You can always see your own tile
            callback(x, y, 0, 1);
            let previousOctant = (dir - 1 + 8) % 8; //Need to retrieve the previous octant to render a full 180 degrees
            let nextPreviousOctant = (dir - 2 + 8) % 8; //Need to retrieve the previous two octants to render a full 180 degrees
            let nextOctant = (dir + 1 + 8) % 8; //Need to grab to next octant to render a full 180 degrees
            this._renderOctant(x, y, OCTANTS[nextPreviousOctant], R, callback);
            this._renderOctant(x, y, OCTANTS[previousOctant], R, callback);
            this._renderOctant(x, y, OCTANTS[dir], R, callback);
            this._renderOctant(x, y, OCTANTS[nextOctant], R, callback);
        }
        ;
        /**
         * Compute visibility for a 90-degree arc
         * @param {int} x
         * @param {int} y
         * @param {int} R Maximum visibility radius
         * @param {int} dir Direction to look in (expressed in a ROT.DIRS value);
         * @param {function} callback
         */
        compute90(x, y, R, dir, callback) {
            //You can always see your own tile
            callback(x, y, 0, 1);
            let previousOctant = (dir - 1 + 8) % 8; //Need to retrieve the previous octant to render a full 90 degrees
            this._renderOctant(x, y, OCTANTS[dir], R, callback);
            this._renderOctant(x, y, OCTANTS[previousOctant], R, callback);
        }
        /**
         * Render one octant (45-degree arc) of the viewshed
         * @param {int} x
         * @param {int} y
         * @param {int} octant Octant to be rendered
         * @param {int} R Maximum visibility radius
         * @param {function} callback
         */
        _renderOctant(x, y, octant, R, callback) {
            //Radius incremented by 1 to provide same coverage area as other shadowcasting radiuses
            this._castVisibility(x, y, 1, 1.0, 0.0, R + 1, octant[0], octant[1], octant[2], octant[3], callback);
        }
        /**
         * Actually calculates the visibility
         * @param {int} startX The starting X coordinate
         * @param {int} startY The starting Y coordinate
         * @param {int} row The row to render
         * @param {float} visSlopeStart The slope to start at
         * @param {float} visSlopeEnd The slope to end at
         * @param {int} radius The radius to reach out to
         * @param {int} xx
         * @param {int} xy
         * @param {int} yx
         * @param {int} yy
         * @param {function} callback The callback to use when we hit a block that is visible
         */
        _castVisibility(startX, startY, row, visSlopeStart, visSlopeEnd, radius, xx, xy, yx, yy, callback) {
            if (visSlopeStart < visSlopeEnd) {
                return;
            }
            for (let i = row; i <= radius; i++) {
                let dx = -i - 1;
                let dy = -i;
                let blocked = false;
                let newStart = 0;
                //'Row' could be column, names here assume octant 0 and would be flipped for half the octants
                while (dx <= 0) {
                    dx += 1;
                    //Translate from relative coordinates to map coordinates
                    let mapX = startX + dx * xx + dy * xy;
                    let mapY = startY + dx * yx + dy * yy;
                    //Range of the row
                    let slopeStart = (dx - 0.5) / (dy + 0.5);
                    let slopeEnd = (dx + 0.5) / (dy - 0.5);
                    //Ignore if not yet at left edge of Octant
                    if (slopeEnd > visSlopeStart) {
                        continue;
                    }
                    //Done if past right edge
                    if (slopeStart < visSlopeEnd) {
                        break;
                    }
                    //If it's in range, it's visible
                    if ((dx * dx + dy * dy) < (radius * radius)) {
                        callback(mapX, mapY, i, 1);
                    }
                    if (!blocked) {
                        //If tile is a blocking tile, cast around it
                        if (!this._lightPasses(mapX, mapY) && i < radius) {
                            blocked = true;
                            this._castVisibility(startX, startY, i + 1, visSlopeStart, slopeStart, radius, xx, xy, yx, yy, callback);
                            newStart = slopeEnd;
                        }
                    }
                    else {
                        //Keep narrowing if scanning across a block
                        if (!this._lightPasses(mapX, mapY)) {
                            newStart = slopeEnd;
                            continue;
                        }
                        //Block has ended
                        blocked = false;
                        visSlopeStart = newStart;
                    }
                }
                if (blocked) {
                    break;
                }
            }
        }
    }

    var FOV$1 = { DiscreteShadowcasting, PreciseShadowcasting, RecursiveShadowcasting };

    class Map$1 {
        /**
         * @class Base map generator
         * @param {int} [width=ROT.DEFAULT_WIDTH]
         * @param {int} [height=ROT.DEFAULT_HEIGHT]
         */
        constructor(width = DEFAULT_WIDTH, height = DEFAULT_HEIGHT) {
            this._width = width;
            this._height = height;
        }
        ;
        _fillMap(value) {
            let map = [];
            for (let i = 0; i < this._width; i++) {
                map.push([]);
                for (let j = 0; j < this._height; j++) {
                    map[i].push(value);
                }
            }
            return map;
        }
    }

    /**
     * @class Dungeon map: has rooms and corridors
     * @augments ROT.Map
     */
    class Dungeon extends Map$1 {
        constructor(width, height) {
            super(width, height);
            this._rooms = [];
            this._corridors = [];
        }
        /**
         * Get all generated rooms
         * @returns {ROT.Map.Feature.Room[]}
         */
        getRooms() { return this._rooms; }
        /**
         * Get all generated corridors
         * @returns {ROT.Map.Feature.Corridor[]}
         */
        getCorridors() { return this._corridors; }
    }

    /**
     * @class Dungeon feature; has own .create() method
     */
    class Feature {
    }
    /**
     * @class Room
     * @augments ROT.Map.Feature
     * @param {int} x1
     * @param {int} y1
     * @param {int} x2
     * @param {int} y2
     * @param {int} [doorX]
     * @param {int} [doorY]
     */
    class Room extends Feature {
        constructor(x1, y1, x2, y2, doorX, doorY) {
            super();
            this._x1 = x1;
            this._y1 = y1;
            this._x2 = x2;
            this._y2 = y2;
            this._doors = {};
            if (doorX !== undefined && doorY !== undefined) {
                this.addDoor(doorX, doorY);
            }
        }
        ;
        /**
         * Room of random size, with a given doors and direction
         */
        static createRandomAt(x, y, dx, dy, options) {
            let min = options.roomWidth[0];
            let max = options.roomWidth[1];
            let width = RNG$1.getUniformInt(min, max);
            min = options.roomHeight[0];
            max = options.roomHeight[1];
            let height = RNG$1.getUniformInt(min, max);
            if (dx == 1) { /* to the right */
                let y2 = y - Math.floor(RNG$1.getUniform() * height);
                return new this(x + 1, y2, x + width, y2 + height - 1, x, y);
            }
            if (dx == -1) { /* to the left */
                let y2 = y - Math.floor(RNG$1.getUniform() * height);
                return new this(x - width, y2, x - 1, y2 + height - 1, x, y);
            }
            if (dy == 1) { /* to the bottom */
                let x2 = x - Math.floor(RNG$1.getUniform() * width);
                return new this(x2, y + 1, x2 + width - 1, y + height, x, y);
            }
            if (dy == -1) { /* to the top */
                let x2 = x - Math.floor(RNG$1.getUniform() * width);
                return new this(x2, y - height, x2 + width - 1, y - 1, x, y);
            }
            throw new Error("dx or dy must be 1 or -1");
        }
        /**
         * Room of random size, positioned around center coords
         */
        static createRandomCenter(cx, cy, options) {
            let min = options.roomWidth[0];
            let max = options.roomWidth[1];
            let width = RNG$1.getUniformInt(min, max);
            min = options.roomHeight[0];
            max = options.roomHeight[1];
            let height = RNG$1.getUniformInt(min, max);
            let x1 = cx - Math.floor(RNG$1.getUniform() * width);
            let y1 = cy - Math.floor(RNG$1.getUniform() * height);
            let x2 = x1 + width - 1;
            let y2 = y1 + height - 1;
            return new this(x1, y1, x2, y2);
        }
        /**
         * Room of random size within a given dimensions
         */
        static createRandom(availWidth, availHeight, options) {
            let min = options.roomWidth[0];
            let max = options.roomWidth[1];
            let width = RNG$1.getUniformInt(min, max);
            min = options.roomHeight[0];
            max = options.roomHeight[1];
            let height = RNG$1.getUniformInt(min, max);
            let left = availWidth - width - 1;
            let top = availHeight - height - 1;
            let x1 = 1 + Math.floor(RNG$1.getUniform() * left);
            let y1 = 1 + Math.floor(RNG$1.getUniform() * top);
            let x2 = x1 + width - 1;
            let y2 = y1 + height - 1;
            return new this(x1, y1, x2, y2);
        }
        addDoor(x, y) {
            this._doors[x + "," + y] = 1;
            return this;
        }
        /**
         * @param {function}
         */
        getDoors(cb) {
            for (let key in this._doors) {
                let parts = key.split(",");
                cb(parseInt(parts[0]), parseInt(parts[1]));
            }
            return this;
        }
        clearDoors() {
            this._doors = {};
            return this;
        }
        addDoors(isWallCallback) {
            let left = this._x1 - 1;
            let right = this._x2 + 1;
            let top = this._y1 - 1;
            let bottom = this._y2 + 1;
            for (let x = left; x <= right; x++) {
                for (let y = top; y <= bottom; y++) {
                    if (x != left && x != right && y != top && y != bottom) {
                        continue;
                    }
                    if (isWallCallback(x, y)) {
                        continue;
                    }
                    this.addDoor(x, y);
                }
            }
            return this;
        }
        debug() {
            console.log("room", this._x1, this._y1, this._x2, this._y2);
        }
        isValid(isWallCallback, canBeDugCallback) {
            let left = this._x1 - 1;
            let right = this._x2 + 1;
            let top = this._y1 - 1;
            let bottom = this._y2 + 1;
            for (let x = left; x <= right; x++) {
                for (let y = top; y <= bottom; y++) {
                    if (x == left || x == right || y == top || y == bottom) {
                        if (!isWallCallback(x, y)) {
                            return false;
                        }
                    }
                    else {
                        if (!canBeDugCallback(x, y)) {
                            return false;
                        }
                    }
                }
            }
            return true;
        }
        /**
         * @param {function} digCallback Dig callback with a signature (x, y, value). Values: 0 = empty, 1 = wall, 2 = door. Multiple doors are allowed.
         */
        create(digCallback) {
            let left = this._x1 - 1;
            let right = this._x2 + 1;
            let top = this._y1 - 1;
            let bottom = this._y2 + 1;
            let value = 0;
            for (let x = left; x <= right; x++) {
                for (let y = top; y <= bottom; y++) {
                    if (x + "," + y in this._doors) {
                        value = 2;
                    }
                    else if (x == left || x == right || y == top || y == bottom) {
                        value = 1;
                    }
                    else {
                        value = 0;
                    }
                    digCallback(x, y, value);
                }
            }
        }
        getCenter() {
            return [Math.round((this._x1 + this._x2) / 2), Math.round((this._y1 + this._y2) / 2)];
        }
        getLeft() { return this._x1; }
        getRight() { return this._x2; }
        getTop() { return this._y1; }
        getBottom() { return this._y2; }
    }
    /**
     * @class Corridor
     * @augments ROT.Map.Feature
     * @param {int} startX
     * @param {int} startY
     * @param {int} endX
     * @param {int} endY
     */
    class Corridor extends Feature {
        constructor(startX, startY, endX, endY) {
            super();
            this._startX = startX;
            this._startY = startY;
            this._endX = endX;
            this._endY = endY;
            this._endsWithAWall = true;
        }
        static createRandomAt(x, y, dx, dy, options) {
            let min = options.corridorLength[0];
            let max = options.corridorLength[1];
            let length = RNG$1.getUniformInt(min, max);
            return new this(x, y, x + dx * length, y + dy * length);
        }
        debug() {
            console.log("corridor", this._startX, this._startY, this._endX, this._endY);
        }
        isValid(isWallCallback, canBeDugCallback) {
            let sx = this._startX;
            let sy = this._startY;
            let dx = this._endX - sx;
            let dy = this._endY - sy;
            let length = 1 + Math.max(Math.abs(dx), Math.abs(dy));
            if (dx) {
                dx = dx / Math.abs(dx);
            }
            if (dy) {
                dy = dy / Math.abs(dy);
            }
            let nx = dy;
            let ny = -dx;
            let ok = true;
            for (let i = 0; i < length; i++) {
                let x = sx + i * dx;
                let y = sy + i * dy;
                if (!canBeDugCallback(x, y)) {
                    ok = false;
                }
                if (!isWallCallback(x + nx, y + ny)) {
                    ok = false;
                }
                if (!isWallCallback(x - nx, y - ny)) {
                    ok = false;
                }
                if (!ok) {
                    length = i;
                    this._endX = x - dx;
                    this._endY = y - dy;
                    break;
                }
            }
            /**
             * If the length degenerated, this corridor might be invalid
             */
            /* not supported */
            if (length == 0) {
                return false;
            }
            /* length 1 allowed only if the next space is empty */
            if (length == 1 && isWallCallback(this._endX + dx, this._endY + dy)) {
                return false;
            }
            /**
             * We do not want the corridor to crash into a corner of a room;
             * if any of the ending corners is empty, the N+1th cell of this corridor must be empty too.
             *
             * Situation:
             * #######1
             * .......?
             * #######2
             *
             * The corridor was dug from left to right.
             * 1, 2 - problematic corners, ? = N+1th cell (not dug)
             */
            let firstCornerBad = !isWallCallback(this._endX + dx + nx, this._endY + dy + ny);
            let secondCornerBad = !isWallCallback(this._endX + dx - nx, this._endY + dy - ny);
            this._endsWithAWall = isWallCallback(this._endX + dx, this._endY + dy);
            if ((firstCornerBad || secondCornerBad) && this._endsWithAWall) {
                return false;
            }
            return true;
        }
        /**
         * @param {function} digCallback Dig callback with a signature (x, y, value). Values: 0 = empty.
         */
        create(digCallback) {
            let sx = this._startX;
            let sy = this._startY;
            let dx = this._endX - sx;
            let dy = this._endY - sy;
            let length = 1 + Math.max(Math.abs(dx), Math.abs(dy));
            if (dx) {
                dx = dx / Math.abs(dx);
            }
            if (dy) {
                dy = dy / Math.abs(dy);
            }
            for (let i = 0; i < length; i++) {
                let x = sx + i * dx;
                let y = sy + i * dy;
                digCallback(x, y, 0);
            }
            return true;
        }
        createPriorityWalls(priorityWallCallback) {
            if (!this._endsWithAWall) {
                return;
            }
            let sx = this._startX;
            let sy = this._startY;
            let dx = this._endX - sx;
            let dy = this._endY - sy;
            if (dx) {
                dx = dx / Math.abs(dx);
            }
            if (dy) {
                dy = dy / Math.abs(dy);
            }
            let nx = dy;
            let ny = -dx;
            priorityWallCallback(this._endX + dx, this._endY + dy);
            priorityWallCallback(this._endX + nx, this._endY + ny);
            priorityWallCallback(this._endX - nx, this._endY - ny);
        }
    }

    const FEATURES = {
        "room": Room,
        "corridor": Corridor
    };
    /**
     * Random dungeon generator using human-like digging patterns.
     * Heavily based on Mike Anderson's ideas from the "Tyrant" algo, mentioned at
     * http://www.roguebasin.roguelikedevelopment.org/index.php?title=Dungeon-Building_Algorithm.
     */
    class Digger extends Dungeon {
        constructor(width, height, options = {}) {
            super(width, height);
            this._options = Object.assign({
                roomWidth: [3, 9],
                roomHeight: [3, 5],
                corridorLength: [3, 10],
                dugPercentage: 0.2,
                timeLimit: 1000 /* we stop after this much time has passed (msec) */
            }, options);
            this._features = {
                "room": 4,
                "corridor": 4
            };
            this._map = [];
            this._featureAttempts = 20; /* how many times do we try to create a feature on a suitable wall */
            this._walls = {}; /* these are available for digging */
            this._dug = 0;
            this._digCallback = this._digCallback.bind(this);
            this._canBeDugCallback = this._canBeDugCallback.bind(this);
            this._isWallCallback = this._isWallCallback.bind(this);
            this._priorityWallCallback = this._priorityWallCallback.bind(this);
        }
        create(callback) {
            this._rooms = [];
            this._corridors = [];
            this._map = this._fillMap(1);
            this._walls = {};
            this._dug = 0;
            let area = (this._width - 2) * (this._height - 2);
            this._firstRoom();
            let t1 = Date.now();
            let priorityWalls;
            do {
                priorityWalls = 0;
                let t2 = Date.now();
                if (t2 - t1 > this._options.timeLimit) {
                    break;
                }
                /* find a good wall */
                let wall = this._findWall();
                if (!wall) {
                    break;
                } /* no more walls */
                let parts = wall.split(",");
                let x = parseInt(parts[0]);
                let y = parseInt(parts[1]);
                let dir = this._getDiggingDirection(x, y);
                if (!dir) {
                    continue;
                } /* this wall is not suitable */
                //		console.log("wall", x, y);
                /* try adding a feature */
                let featureAttempts = 0;
                do {
                    featureAttempts++;
                    if (this._tryFeature(x, y, dir[0], dir[1])) { /* feature added */
                        //if (this._rooms.length + this._corridors.length == 2) { this._rooms[0].addDoor(x, y); } /* first room oficially has doors */
                        this._removeSurroundingWalls(x, y);
                        this._removeSurroundingWalls(x - dir[0], y - dir[1]);
                        break;
                    }
                } while (featureAttempts < this._featureAttempts);
                for (let id in this._walls) {
                    if (this._walls[id] > 1) {
                        priorityWalls++;
                    }
                }
            } while (this._dug / area < this._options.dugPercentage || priorityWalls); /* fixme number of priority walls */
            this._addDoors();
            if (callback) {
                for (let i = 0; i < this._width; i++) {
                    for (let j = 0; j < this._height; j++) {
                        callback(i, j, this._map[i][j]);
                    }
                }
            }
            this._walls = {};
            this._map = [];
            return this;
        }
        _digCallback(x, y, value) {
            if (value == 0 || value == 2) { /* empty */
                this._map[x][y] = 0;
                this._dug++;
            }
            else { /* wall */
                this._walls[x + "," + y] = 1;
            }
        }
        _isWallCallback(x, y) {
            if (x < 0 || y < 0 || x >= this._width || y >= this._height) {
                return false;
            }
            return (this._map[x][y] == 1);
        }
        _canBeDugCallback(x, y) {
            if (x < 1 || y < 1 || x + 1 >= this._width || y + 1 >= this._height) {
                return false;
            }
            return (this._map[x][y] == 1);
        }
        _priorityWallCallback(x, y) { this._walls[x + "," + y] = 2; }
        ;
        _firstRoom() {
            let cx = Math.floor(this._width / 2);
            let cy = Math.floor(this._height / 2);
            let room = Room.createRandomCenter(cx, cy, this._options);
            this._rooms.push(room);
            room.create(this._digCallback);
        }
        /**
         * Get a suitable wall
         */
        _findWall() {
            let prio1 = [];
            let prio2 = [];
            for (let id in this._walls) {
                let prio = this._walls[id];
                if (prio == 2) {
                    prio2.push(id);
                }
                else {
                    prio1.push(id);
                }
            }
            let arr = (prio2.length ? prio2 : prio1);
            if (!arr.length) {
                return null;
            } /* no walls :/ */
            let id = RNG$1.getItem(arr.sort()); // sort to make the order deterministic
            delete this._walls[id];
            return id;
        }
        /**
         * Tries adding a feature
         * @returns {bool} was this a successful try?
         */
        _tryFeature(x, y, dx, dy) {
            let featureName = RNG$1.getWeightedValue(this._features);
            let ctor = FEATURES[featureName];
            let feature = ctor.createRandomAt(x, y, dx, dy, this._options);
            if (!feature.isValid(this._isWallCallback, this._canBeDugCallback)) {
                //		console.log("not valid");
                //		feature.debug();
                return false;
            }
            feature.create(this._digCallback);
            //	feature.debug();
            if (feature instanceof Room) {
                this._rooms.push(feature);
            }
            if (feature instanceof Corridor) {
                feature.createPriorityWalls(this._priorityWallCallback);
                this._corridors.push(feature);
            }
            return true;
        }
        _removeSurroundingWalls(cx, cy) {
            let deltas = DIRS[4];
            for (let i = 0; i < deltas.length; i++) {
                let delta = deltas[i];
                let x = cx + delta[0];
                let y = cy + delta[1];
                delete this._walls[x + "," + y];
                x = cx + 2 * delta[0];
                y = cy + 2 * delta[1];
                delete this._walls[x + "," + y];
            }
        }
        /**
         * Returns vector in "digging" direction, or false, if this does not exist (or is not unique)
         */
        _getDiggingDirection(cx, cy) {
            if (cx <= 0 || cy <= 0 || cx >= this._width - 1 || cy >= this._height - 1) {
                return null;
            }
            let result = null;
            let deltas = DIRS[4];
            for (let i = 0; i < deltas.length; i++) {
                let delta = deltas[i];
                let x = cx + delta[0];
                let y = cy + delta[1];
                if (!this._map[x][y]) { /* there already is another empty neighbor! */
                    if (result) {
                        return null;
                    }
                    result = delta;
                }
            }
            /* no empty neighbor */
            if (!result) {
                return null;
            }
            return [-result[0], -result[1]];
        }
        /**
         * Find empty spaces surrounding rooms, and apply doors.
         */
        _addDoors() {
            let data = this._map;
            function isWallCallback(x, y) {
                return (data[x][y] == 1);
            }
            for (let i = 0; i < this._rooms.length; i++) {
                let room = this._rooms[i];
                room.clearDoors();
                room.addDoors(isWallCallback);
            }
        }
    }

    /**
     * @class Abstract pathfinder
     * @param {int} toX Target X coord
     * @param {int} toY Target Y coord
     * @param {function} passableCallback Callback to determine map passability
     * @param {object} [options]
     * @param {int} [options.topology=8]
     */
    class Path {
        constructor(toX, toY, passableCallback, options = {}) {
            this._toX = toX;
            this._toY = toY;
            this._passableCallback = passableCallback;
            this._options = Object.assign({
                topology: 8
            }, options);
            this._dirs = DIRS[this._options.topology];
            if (this._options.topology == 8) { /* reorder dirs for more aesthetic result (vertical/horizontal first) */
                this._dirs = [
                    this._dirs[0],
                    this._dirs[2],
                    this._dirs[4],
                    this._dirs[6],
                    this._dirs[1],
                    this._dirs[3],
                    this._dirs[5],
                    this._dirs[7]
                ];
            }
        }
        _getNeighbors(cx, cy) {
            let result = [];
            for (let i = 0; i < this._dirs.length; i++) {
                let dir = this._dirs[i];
                let x = cx + dir[0];
                let y = cy + dir[1];
                if (!this._passableCallback(x, y)) {
                    continue;
                }
                result.push([x, y]);
            }
            return result;
        }
    }

    /**
     * @class Simplified Dijkstra's algorithm: all edges have a value of 1
     * @augments ROT.Path
     * @see ROT.Path
     */
    class Dijkstra extends Path {
        constructor(toX, toY, passableCallback, options) {
            super(toX, toY, passableCallback, options);
            this._computed = {};
            this._todo = [];
            this._add(toX, toY, null);
        }
        /**
         * Compute a path from a given point
         * @see ROT.Path#compute
         */
        compute(fromX, fromY, callback) {
            let key = fromX + "," + fromY;
            if (!(key in this._computed)) {
                this._compute(fromX, fromY);
            }
            if (!(key in this._computed)) {
                return;
            }
            let item = this._computed[key];
            while (item) {
                callback(item.x, item.y);
                item = item.prev;
            }
        }
        /**
         * Compute a non-cached value
         */
        _compute(fromX, fromY) {
            while (this._todo.length) {
                let item = this._todo.shift();
                if (item.x == fromX && item.y == fromY) {
                    return;
                }
                let neighbors = this._getNeighbors(item.x, item.y);
                for (let i = 0; i < neighbors.length; i++) {
                    let neighbor = neighbors[i];
                    let x = neighbor[0];
                    let y = neighbor[1];
                    let id = x + "," + y;
                    if (id in this._computed) {
                        continue;
                    } /* already done */
                    this._add(x, y, item);
                }
            }
        }
        _add(x, y, prev) {
            let obj = {
                x: x,
                y: y,
                prev: prev
            };
            this._computed[x + "," + y] = obj;
            this._todo.push(obj);
        }
    }

    /**
     * @class Simplified A* algorithm: all edges have a value of 1
     * @augments ROT.Path
     * @see ROT.Path
     */
    class AStar extends Path {
        constructor(toX, toY, passableCallback, options = {}) {
            super(toX, toY, passableCallback, options);
            this._todo = [];
            this._done = {};
        }
        /**
         * Compute a path from a given point
         * @see ROT.Path#compute
         */
        compute(fromX, fromY, callback) {
            this._todo = [];
            this._done = {};
            this._fromX = fromX;
            this._fromY = fromY;
            this._add(this._toX, this._toY, null);
            while (this._todo.length) {
                let item = this._todo.shift();
                let id = item.x + "," + item.y;
                if (id in this._done) {
                    continue;
                }
                this._done[id] = item;
                if (item.x == fromX && item.y == fromY) {
                    break;
                }
                let neighbors = this._getNeighbors(item.x, item.y);
                for (let i = 0; i < neighbors.length; i++) {
                    let neighbor = neighbors[i];
                    let x = neighbor[0];
                    let y = neighbor[1];
                    let id = x + "," + y;
                    if (id in this._done) {
                        continue;
                    }
                    this._add(x, y, item);
                }
            }
            let item = this._done[fromX + "," + fromY];
            if (!item) {
                return;
            }
            while (item) {
                callback(item.x, item.y);
                item = item.prev;
            }
        }
        _add(x, y, prev) {
            let h = this._distance(x, y);
            let obj = {
                x: x,
                y: y,
                prev: prev,
                g: (prev ? prev.g + 1 : 0),
                h: h
            };
            /* insert into priority queue */
            let f = obj.g + obj.h;
            for (let i = 0; i < this._todo.length; i++) {
                let item = this._todo[i];
                let itemF = item.g + item.h;
                if (f < itemF || (f == itemF && h < item.h)) {
                    this._todo.splice(i, 0, obj);
                    return;
                }
            }
            this._todo.push(obj);
        }
        _distance(x, y) {
            switch (this._options.topology) {
                case 4:
                    return (Math.abs(x - this._fromX) + Math.abs(y - this._fromY));
                    break;
                case 6:
                    let dx = Math.abs(x - this._fromX);
                    let dy = Math.abs(y - this._fromY);
                    return dy + Math.max(0, (dx - dy) / 2);
                    break;
                case 8:
                    return Math.max(Math.abs(x - this._fromX), Math.abs(y - this._fromY));
                    break;
            }
        }
    }

    var Path$1 = { Dijkstra, AStar };

    /**
     * @class Asynchronous main loop
     * @param {ROT.Scheduler} scheduler
     */
    class Engine {
        constructor(scheduler) {
            this._scheduler = scheduler;
            this._lock = 1;
        }
        /**
         * Start the main loop. When this call returns, the loop is locked.
         */
        start() { return this.unlock(); }
        /**
         * Interrupt the engine by an asynchronous action
         */
        lock() {
            this._lock++;
            return this;
        }
        /**
         * Resume execution (paused by a previous lock)
         */
        unlock() {
            if (!this._lock) {
                throw new Error("Cannot unlock unlocked engine");
            }
            this._lock--;
            while (!this._lock) {
                let actor = this._scheduler.next();
                if (!actor) {
                    return this.lock();
                } /* no actors */
                let result = actor.act();
                if (result && result.then) { /* actor returned a "thenable", looks like a Promise */
                    this.lock();
                    result.then(this.unlock.bind(this));
                }
            }
            return this;
        }
    }

    const Color = color;

    var Keyboard = /** @class */ (function () {
        function Keyboard() {
            this.interval = 100;
            this.pressed = {};
            this.subs = [];
            window.addEventListener("keydown", this);
            window.addEventListener("keyup", this);
        }
        Keyboard.prototype.handleEvent = function (e) {
            var _this = this;
            var code = e.keyCode;
            if (e.type == "keydown") {
                if (!(code in this.pressed)) {
                    this.click(e.keyCode);
                    this.pressed[code] = window.setInterval(function () { return _this.click(e.keyCode); }, this.interval);
                }
            }
            if (e.type == "keyup") {
                window.clearInterval(this.pressed[code]);
                delete this.pressed[code];
            }
        };
        Keyboard.prototype.click = function (keyCode) {
            for (var _i = 0, _a = this.subs; _i < _a.length; _i++) {
                var s = _a[_i];
                s(keyCode);
            }
        };
        Keyboard.prototype.sub = function (handler) {
            this.subs.push(handler);
        };
        Keyboard.prototype.unsub = function (handler) {
            this.subs = this.subs.filter(function (s) {
                return s != handler;
            });
        };
        Keyboard.prototype.once = function (handler) {
            var _this = this;
            var f = function (keyCode) {
                _this.unsub(f);
                handler(keyCode);
            };
            this.sub(f);
        };
        Keyboard.prototype.isPressed = function (keyCode) {
            return keyCode in this.pressed;
        };
        return Keyboard;
    }());
    var keyboard = new Keyboard();

    console.log(keyboard);
    var keyMap = {};
    keyMap[38] = 0;
    keyMap[33] = 1;
    keyMap[39] = 2;
    keyMap[34] = 3;
    keyMap[40] = 4;
    keyMap[35] = 5;
    keyMap[37] = 6;
    keyMap[36] = 7;
    keyMap[12] = -1;
    var Mob = /** @class */ (function () {
        function Mob() {
            this.sees = [];
            this.path = [];
            this.hate = 0;
            this.dead = false;
            game.mobs.push(this);
        }
        Mob.prototype.getSpeed = function () {
            if (this == game.player) {
                return 120 + this.hate;
            }
            return 100;
        };
        Mob.prototype.act = function () {
            var _this = this;
            if (this == game.player) {
                game.engine.lock();
                if (game.seeingRed) {
                    this.playerAct(null);
                    //game.engine.unlock()
                    window.setTimeout(function () { return game.engine.unlock(); }, 50);
                }
                else {
                    keyboard.once(this.keyDown.bind(this));
                }
            }
            else {
                if (this.path && this.path.length > 0) {
                    this.goTo(this.path.shift());
                }
                else {
                    this.path = [];
                    var goal = RNG$1.getItem(game.rooms).getCenter();
                    var pathfinder = new Path$1.AStar(goal[0], goal[1], function (x, y) { return game.at([x, y]).cost < 1000; }, { topology: 4 });
                    pathfinder.compute(this.at[0], this.at[1], function (x, y) {
                        return _this.path.push([x, y]);
                    });
                    this.path.shift();
                }
            }
        };
        Mob.prototype.tile = function () {
            return game.at(this.at);
        };
        Mob.prototype.goTo = function (newAt) {
            var tile = this.tile();
            var targetMob = game.at(newAt).mob;
            if (targetMob) {
                if (targetMob == game.player)
                    return;
                if (this == game.player) {
                    targetMob.die();
                    this.hate = 0;
                }
                else {
                    if (RNG$1.getUniform() < 0.5)
                        return;
                    else {
                        targetMob.at = this.at.slice(0, 2);
                        tile.mob = targetMob;
                    }
                }
            }
            if (tile.mob == this)
                tile.mob = null;
            this.at = newAt.slice(0, 2);
            this.tile().mob = this;
            if (this == game.player) {
                if (this.tile().symbol == "⚘") {
                    this.tile().symbol = " ";
                    game.flowersCollected++;
                }
                if (this.tile().symbol == "☨" && game.allFlowersCollected()) {
                    game.won = true;
                }
            }
            else {
                this.leaveScent();
            }
        };
        Mob.prototype.die = function () {
            var _this = this;
            this.dead = true;
            game.mobs = game.mobs.filter(function (m) { return m != _this; });
            this.tile().mob = null;
            game.engine._scheduler.remove(this);
            var fov = new FOV$1.PreciseShadowcasting(function (x, y) { return game.safeAt([x, y]).cost < 1000; });
            fov.compute(this.at[0], this.at[1], 3, function (x, y, r, vis) {
                var tile = game.at([x, y]);
                if (tile.symbol == " ")
                    tile.symbol = "*";
            });
        };
        Mob.prototype.leaveScent = function () {
            var tile = game.at(this.at);
            tile.mob = this;
            if (tile.scent <= 0.01) {
                game.scent.push(tile);
            }
            tile.scent = 1;
        };
        Mob.prototype.playerAct = function (code) {
            var _this = this;
            if (!code) {
                var nearestD = 1000;
                var nearestMob = null;
                for (var _i = 0, _a = game.mobs; _i < _a.length; _i++) {
                    var m = _a[_i];
                    if (m == game.player)
                        continue;
                    var d = distance(m.at, game.player.at);
                    if (d < nearestD) {
                        nearestD = d;
                        nearestMob = m;
                    }
                }
                if (nearestMob) {
                    var pathfinder = new Path$1.AStar(nearestMob.at[0], nearestMob.at[1], function (x, y) { return game.at([x, y]).cost < 1000; }, { topology: 4 });
                    this.path = [];
                    pathfinder.compute(this.at[0], this.at[1], function (x, y) {
                        return _this.path.push([x, y]);
                    });
                    this.goTo(this.path[1]);
                }
            }
            else {
                if (!(code in keyMap)) {
                    return;
                }
                var kmc = keyMap[code];
                var diff = kmc == -1 ? [0, 0] : DIRS[8][kmc];
                var newAt = [this.at[0] + diff[0], this.at[1] + diff[1]];
                if (game.at(newAt).cost > 1000) {
                    return;
                }
                this.goTo(newAt);
            }
            this.lookAround();
            if (RNG$1.getUniform() < 0.3 || game.player.hate == 100)
                game.seeingRed = this.hate / 100 > RNG$1.getUniform();
            game.draw();
        };
        Mob.prototype.keyDown = function (keyCode) {
            this.playerAct(keyCode);
            //keyboard.unsub(this.keyDownBound)
            game.engine.unlock();
        };
        Mob.prototype.enrage = function (dHate) {
            this.hate = Math.min(Math.max(0, this.hate + dHate), 100);
        };
        Mob.prototype.lookAround = function () {
            var _this = this;
            for (var _i = 0, _a = this.sees; _i < _a.length; _i++) {
                var coord = _a[_i];
                game.at(coord).visible = 0;
            }
            var seeThroughR = 4;
            for (var x = -seeThroughR; x <= seeThroughR; x++)
                for (var y = -seeThroughR; y <= seeThroughR; y++) {
                    var tile = game.safeAt([this.at[0] + x, this.at[1] + y]);
                    if (tile != game.emptyTile)
                        tile.seen = 1;
                }
            var fov = new FOV$1.PreciseShadowcasting(function (x, y) { return game.safeAt([x, y]).cost < 1000; });
            this.sees = [];
            var dHate = game.seeingRed ? -0.5 : -0.3;
            var seesFlower = false;
            fov.compute(this.at[0], this.at[1], 20, function (x, y, r, vis) {
                _this.sees.push([x, y]);
                var tile = game.at([x, y]);
                if (tile.symbol == "⚘" && r <= 10)
                    seesFlower = true;
                if (tile.mob && tile.mob != game.player) {
                    dHate += 10 / (r + 5);
                }
                tile.visible = (vis * (20 - r)) / 20;
                tile.seen = 1;
            });
            if (this.tile().scent > 0.1) {
                dHate += this.tile().scent * 2;
            }
            if (seesFlower) {
                if (dHate > 0) {
                    dHate *= 2;
                }
                else {
                    dHate += -3;
                }
            }
            this.enrage(dHate);
        };
        Mob.prototype.actFixedInterval = function () {
        };
        return Mob;
    }());

    var game;
    var screenBg = Color.fromString("#180C24");
    function distance(a, b) {
        var x = a[0] - b[0];
        var y = a[1] - b[1];
        return Math.sqrt(x * x + y * y);
    }
    var Ticker = /** @class */ (function () {
        function Ticker() {
        }
        Ticker.prototype.getSpeed = function () {
            return 100;
        };
        Ticker.prototype.act = function () {
            game.scent = game.scent.filter(function (tile) {
                tile.scent = Math.max(tile.scent - 0.05, 0.01);
                return tile.scent > 0.01;
            });
            for (var _i = 0, _a = game.mobs; _i < _a.length; _i++) {
                var mob = _a[_i];
                mob.actFixedInterval();
            }
        };
        return Ticker;
    }());
    var Tile$1 = /** @class */ (function () {
        function Tile(symbol) {
            this.symbol = symbol;
            this.seen = 0;
            this.visible = 0;
            this.scent = 0;
            this.cost = ["♠", "♣"].includes(symbol) ? 1e6 : 1;
        }
        return Tile;
    }());
    function add2d(a, b) {
        return [a[0] + b[0], a[1] + b[1]];
    }
    var Game = /** @class */ (function () {
        function Game(options) {
            if (options === void 0) { options = {}; }
            this.options = options;
            this.mobs = [];
            this.seeingRed = false;
            this.emptyTile = new Tile$1("♠");
            this.flowersCollected = 0;
            this.scent = [];
            this.won = false;
            this.mobStatus = [];
            this.flowerStatus = [];
            game = this;
            RNG$1.setSeed(options.seed || Math.random());
            this.player = new Mob();
            this.size = options.size || [60, 60];
            options.emptiness = options.emptiness * 1 || 0.35;
            options.mobs = options.mobs * 1 || 10;
            options.flowers = options.flowers * 1 || 4;
            this.displaySize = options.displaySize || [60, 60];
            var d = (this.d = new Display({
                width: this.displaySize[0],
                height: this.displaySize[1],
                fontSize: 20,
                spacing: 0.6,
                forceSquareRatio: true,
                bg: "#180C24",
                fontFamily: "Icons"
            }));
            document.getElementById("game").appendChild(d.getContainer());
            this.generateMap();
            var scheduler = new Scheduler$1.Speed();
            scheduler.add(new Ticker(), true);
            for (var _i = 0, _a = this.mobs; _i < _a.length; _i++) {
                var mob = _a[_i];
                scheduler.add(mob, true);
            }
            this.engine = new Engine(scheduler);
            this.engine.start();
            this.player.lookAround();
            this.draw();
        }
        Game.prototype.at = function (at) {
            return this.grid[at[0]][at[1]];
        };
        Game.prototype.safeAt = function (at) {
            if (at[0] < 0 ||
                at[1] < 0 ||
                at[0] >= this.size[0] ||
                at[1] >= this.size[1])
                return this.emptyTile;
            return this.grid[at[0]][at[1]];
        };
        Game.prototype.generateMap = function () {
            var _this = this;
            var w = this.size[0];
            var h = this.size[1];
            this.grid = new Array(w).fill(null).map(function (_) { return []; });
            var map = new Digger(w, h, {
                dugPercentage: this.options.emptiness,
                corridorLength: [2, 6],
                roomWidth: [3, 6],
                roomHeight: [3, 6]
            });
            map.create(function (x, y, what) {
                var symbol = what ? ((x + y) % 2 ? "♠" : "♣") : " ";
                _this.grid[x][y] = new Tile$1(symbol);
            });
            var rooms = (this.rooms = map.getRooms());
            var roomsRandom = RNG$1.shuffle(rooms);
            this.at(roomsRandom[0].getCenter()).symbol = "☨";
            this.player.at = roomsRandom[1].getCenter();
            for (var i = 3; i < 3 + this.options.flowers; i++) {
                var room = roomsRandom[i];
                var c = room.getCenter();
                this.flowerStatus.push(this.at(c));
                this.at(c).symbol = "⚘";
            }
            for (var i = 3 + this.options.flowers; i < 3 + this.options.flowers + this.options.mobs; i++) {
                var room = roomsRandom[i];
                var monster = new Mob();
                this.mobStatus.push(monster);
                monster.at = room.getCenter();
            }
        };
        Game.prototype.bg = function (at) {
            var tile = this.safeAt(at);
            var bg = [0, 0, 0];
            if (tile.visible) {
                var b = 48 * tile.visible;
                bg = Color.add(bg, [b, b, b]);
            }
            else {
                if (!tile.seen && tile.scent == 0) {
                    bg = this.hateBg;
                }
            }
            if (tile.scent > 0) {
                var scent = tile.scent;
                var d = distance(at, this.player.at);
                /*scent -= distance(at, this.player.at) / 100
                scent -= (100 - this.player.rage) * 0.003
                scent = Math.max(0, scent)*/
                if (this.player.hate * 0.3 + 10 > d) {
                    bg = Color.add(bg, [128 * scent, 0, 0]);
                }
            }
            return Color.toRGB(bg);
        };
        Game.prototype.draw = function () {
            this.d.drawText(0, 0, "_".repeat(this.displaySize[1]));
            this.d.drawText(0, 0, "%b{red}%c{red}" +
                "_".repeat((this.player.hate / this.displaySize[1]) * 100));
            this.hateBg = this.seeingRed
                ? [255, 0, 0]
                : Color.add(screenBg, [0.64 * this.player.hate, 0, 0]);
            //this.d.drawText(0,  0, Math.round(this.player.rage).toString())
            var half = [
                Math.floor(this.displaySize[0] / 2),
                Math.floor(this.displaySize[1] / 2)
            ];
            var delta = [0, 0];
            for (var _i = 0, _a = [0, 1]; _i < _a.length; _i++) {
                var i = _a[_i];
                delta[i] = -this.player.at[i] + half[i];
            }
            for (var x = this.player.at[0] - half[0]; x < this.player.at[0] + half[0]; x++)
                for (var y = this.player.at[1] - half[1] + 1; y < this.player.at[1] + half[1] - 1; y++) {
                    var tile = this.safeAt([x, y]);
                    var c = tile.visible || tile.seen ? tile.symbol : " ";
                    var displayAt = add2d([x, y], delta);
                    var bg = tile.seen ? "#222" : "black";
                    this.d.draw(displayAt[0], displayAt[1], c, ["♠", "♣", "."].includes(c) ? null : "red", this.bg([x, y]));
                }
            for (var _b = 0, _c = game.mobs; _b < _c.length; _b++) {
                var mob = _c[_b];
                var tile = game.at(mob.at);
                if (tile.visible) {
                    var mobDisplayAt = add2d(mob.at, delta);
                    var c = "white";
                    if (this.player == mob && this.seeingRed)
                        c = "red";
                    this.d.draw(mobDisplayAt[0], mobDisplayAt[1], this.player == mob ? "☻" : "☺", c, this.bg(mob.at));
                }
            }
            this.d.drawText(0, this.displaySize[1] - 1, "%b{#180C24}%c{#180C24}" + "_".repeat(this.displaySize[0]));
            var statusLine = "use NUMPAD ";
            statusLine +=
                "%c{gray}avoid? " +
                    this.mobStatus.map(function (m) { return (m.dead ? "%c{red}*" : "%c{white}☺"); }).join("");
            if (this.won) {
                statusLine += " %c{red}GAME COMPLETE";
            }
            else if (this.allFlowersCollected()) {
                statusLine += " %c{gray}visit %c{red}☨";
            }
            else {
                statusLine +=
                    " %c{gray}collect " +
                        this.flowerStatus
                            .map(function (t) { return (t.symbol == "⚘" ? "%c{gray}⚘" : "%c{red}⚘"); })
                            .join("");
            }
            this.d.drawText(0, this.displaySize[1] - 1, statusLine);
        };
        Game.prototype.allFlowersCollected = function () {
            //return true;
            return this.flowersCollected == this.flowerStatus.length;
        };
        return Game;
    }());

    function createCommonjsModule(fn, module) {
    	return module = { exports: {} }, fn(module, module.exports), module.exports;
    }

    var fontfaceobserver_standalone = createCommonjsModule(function (module) {
    /* Font Face Observer v2.1.0 - © Bram Stein. License: BSD-3-Clause */(function(){function l(a,b){document.addEventListener?a.addEventListener("scroll",b,!1):a.attachEvent("scroll",b);}function m(a){document.body?a():document.addEventListener?document.addEventListener("DOMContentLoaded",function c(){document.removeEventListener("DOMContentLoaded",c);a();}):document.attachEvent("onreadystatechange",function k(){if("interactive"==document.readyState||"complete"==document.readyState)document.detachEvent("onreadystatechange",k),a();});}function t(a){this.a=document.createElement("div");this.a.setAttribute("aria-hidden","true");this.a.appendChild(document.createTextNode(a));this.b=document.createElement("span");this.c=document.createElement("span");this.h=document.createElement("span");this.f=document.createElement("span");this.g=-1;this.b.style.cssText="max-width:none;display:inline-block;position:absolute;height:100%;width:100%;overflow:scroll;font-size:16px;";this.c.style.cssText="max-width:none;display:inline-block;position:absolute;height:100%;width:100%;overflow:scroll;font-size:16px;";
    this.f.style.cssText="max-width:none;display:inline-block;position:absolute;height:100%;width:100%;overflow:scroll;font-size:16px;";this.h.style.cssText="display:inline-block;width:200%;height:200%;font-size:16px;max-width:none;";this.b.appendChild(this.h);this.c.appendChild(this.f);this.a.appendChild(this.b);this.a.appendChild(this.c);}
    function u(a,b){a.a.style.cssText="max-width:none;min-width:20px;min-height:20px;display:inline-block;overflow:hidden;position:absolute;width:auto;margin:0;padding:0;top:-999px;white-space:nowrap;font-synthesis:none;font:"+b+";";}function z(a){var b=a.a.offsetWidth,c=b+100;a.f.style.width=c+"px";a.c.scrollLeft=c;a.b.scrollLeft=a.b.scrollWidth+100;return a.g!==b?(a.g=b,!0):!1}function A(a,b){function c(){var a=k;z(a)&&a.a.parentNode&&b(a.g);}var k=a;l(a.b,c);l(a.c,c);z(a);}function B(a,b){var c=b||{};this.family=a;this.style=c.style||"normal";this.weight=c.weight||"normal";this.stretch=c.stretch||"normal";}var C=null,D=null,E=null,F=null;function G(){if(null===D)if(J()&&/Apple/.test(window.navigator.vendor)){var a=/AppleWebKit\/([0-9]+)(?:\.([0-9]+))(?:\.([0-9]+))/.exec(window.navigator.userAgent);D=!!a&&603>parseInt(a[1],10);}else D=!1;return D}function J(){null===F&&(F=!!document.fonts);return F}
    function K(){if(null===E){var a=document.createElement("div");try{a.style.font="condensed 100px sans-serif";}catch(b){}E=""!==a.style.font;}return E}function L(a,b){return [a.style,a.weight,K()?a.stretch:"","100px",b].join(" ")}
    B.prototype.load=function(a,b){var c=this,k=a||"BESbswy",r=0,n=b||3E3,H=(new Date).getTime();return new Promise(function(a,b){if(J()&&!G()){var M=new Promise(function(a,b){function e(){(new Date).getTime()-H>=n?b(Error(""+n+"ms timeout exceeded")):document.fonts.load(L(c,'"'+c.family+'"'),k).then(function(c){1<=c.length?a():setTimeout(e,25);},b);}e();}),N=new Promise(function(a,c){r=setTimeout(function(){c(Error(""+n+"ms timeout exceeded"));},n);});Promise.race([N,M]).then(function(){clearTimeout(r);a(c);},
    b);}else m(function(){function v(){var b;if(b=-1!=f&&-1!=g||-1!=f&&-1!=h||-1!=g&&-1!=h)(b=f!=g&&f!=h&&g!=h)||(null===C&&(b=/AppleWebKit\/([0-9]+)(?:\.([0-9]+))/.exec(window.navigator.userAgent),C=!!b&&(536>parseInt(b[1],10)||536===parseInt(b[1],10)&&11>=parseInt(b[2],10))),b=C&&(f==w&&g==w&&h==w||f==x&&g==x&&h==x||f==y&&g==y&&h==y)),b=!b;b&&(d.parentNode&&d.parentNode.removeChild(d),clearTimeout(r),a(c));}function I(){if((new Date).getTime()-H>=n)d.parentNode&&d.parentNode.removeChild(d),b(Error(""+
    n+"ms timeout exceeded"));else{var a=document.hidden;if(!0===a||void 0===a)f=e.a.offsetWidth,g=p.a.offsetWidth,h=q.a.offsetWidth,v();r=setTimeout(I,50);}}var e=new t(k),p=new t(k),q=new t(k),f=-1,g=-1,h=-1,w=-1,x=-1,y=-1,d=document.createElement("div");d.dir="ltr";u(e,L(c,"sans-serif"));u(p,L(c,"serif"));u(q,L(c,"monospace"));d.appendChild(e.a);d.appendChild(p.a);d.appendChild(q.a);document.body.appendChild(d);w=e.a.offsetWidth;x=p.a.offsetWidth;y=q.a.offsetWidth;I();A(e,function(a){f=a;v();});u(e,
    L(c,'"'+c.family+'",sans-serif'));A(p,function(a){g=a;v();});u(p,L(c,'"'+c.family+'",serif'));A(q,function(a){h=a;v();});u(q,L(c,'"'+c.family+'",monospace'));});})};module.exports=B;}());
    });

    /* src\App.svelte generated by Svelte v3.5.1 */

    const file = "src\\App.svelte";

    function create_fragment(ctx) {
    	var div;

    	return {
    		c: function create() {
    			div = element("div");
    			div.id = "game";
    			add_location(div, file, 29, 0, 529);
    		},

    		l: function claim(nodes) {
    			throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
    		},

    		m: function mount(target, anchor) {
    			insert(target, div, anchor);
    		},

    		p: noop,
    		i: noop,
    		o: noop,

    		d: function destroy(detaching) {
    			if (detaching) {
    				detach(div);
    			}
    		}
    	};
    }

    let regex = /[?&]([^=#]+)=([^&#]*)/g;

    function instance($$self, $$props, $$invalidate) {
    	

      let icons = new fontfaceobserver_standalone('Icons');

      let conf = {};
      let hash = location.hash;
      let url = window.location.href;
      let match;
      
      while(match = regex.exec(url)) {
          conf[match[1]] = JSON.parse(match[2]);  }  
      
      console.log(conf);

      icons.load().then(() => {
        new Game(conf);  
      });

    	return {};
    }

    class App extends SvelteComponentDev {
    	constructor(options) {
    		super(options);
    		init(this, options, instance, create_fragment, safe_not_equal, []);
    	}
    }

    window.onload = function(){

    	exports.ui = new App({
    		target: document.body
      });
      
    };

    exports.default = app;

    return exports;

}({}));
