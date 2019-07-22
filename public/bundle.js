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

    function append(target, node) {
        target.appendChild(node);
    }
    function insert(target, node, anchor) {
        target.insertBefore(node, anchor || null);
    }
    function detach(node) {
        node.parentNode.removeChild(node);
    }
    function detach_before(after) {
        while (after.previousSibling) {
            after.parentNode.removeChild(after.previousSibling);
        }
    }
    function destroy_each(iterations, detaching) {
        for (let i = 0; i < iterations.length; i += 1) {
            if (iterations[i])
                iterations[i].d(detaching);
        }
    }
    function element(name) {
        return document.createElement(name);
    }
    function text(data) {
        return document.createTextNode(data);
    }
    function space() {
        return text(' ');
    }
    function listen(node, event, handler, options) {
        node.addEventListener(event, handler, options);
        return () => node.removeEventListener(event, handler, options);
    }
    function children(element) {
        return Array.from(element.childNodes);
    }
    function set_data(text, data) {
        data = '' + data;
        if (text.data !== data)
            text.data = data;
    }
    function set_style(node, key, value) {
        node.style.setProperty(key, value);
    }

    let current_component;
    function set_current_component(component) {
        current_component = component;
    }
    function get_current_component() {
        if (!current_component)
            throw new Error(`Function called outside component initialization`);
        return current_component;
    }
    function onMount(fn) {
        get_current_component().$$.on_mount.push(fn);
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
    function tick() {
        schedule_update();
        return resolved_promise;
    }
    function add_binding_callback(fn) {
        binding_callbacks.push(fn);
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

    /*! *****************************************************************************
    Copyright (c) Microsoft Corporation. All rights reserved.
    Licensed under the Apache License, Version 2.0 (the "License"); you may not use
    this file except in compliance with the License. You may obtain a copy of the
    License at http://www.apache.org/licenses/LICENSE-2.0

    THIS CODE IS PROVIDED ON AN *AS IS* BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
    KIND, EITHER EXPRESS OR IMPLIED, INCLUDING WITHOUT LIMITATION ANY IMPLIED
    WARRANTIES OR CONDITIONS OF TITLE, FITNESS FOR A PARTICULAR PURPOSE,
    MERCHANTABLITY OR NON-INFRINGEMENT.

    See the Apache Version 2.0 License for specific language governing permissions
    and limitations under the License.
    ***************************************************************************** */

    var __assign = function() {
        __assign = Object.assign || function __assign(t) {
            for (var s, i = 1, n = arguments.length; i < n; i++) {
                s = arguments[i];
                for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p)) t[p] = s[p];
            }
            return t;
        };
        return __assign.apply(this, arguments);
    };

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

    var Schedulers = { Simple, Speed, Action };

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

    var keyMap = {};
    keyMap["Numpad8"] = 0;
    keyMap["Numpad9"] = 1;
    keyMap["Numpad6"] = 2;
    keyMap["Numpad3"] = 3;
    keyMap["Numpad2"] = 4;
    keyMap["Numpad1"] = 5;
    keyMap["Numpad4"] = 6;
    keyMap["Numpad7"] = 7;
    keyMap["Numpad5"] = -1;
    keyMap["Space"] = -1;
    var WARY = 30, AFRAID = 60, PANIC = 100;
    var Mob = /** @class */ (function () {
        function Mob(type) {
            if (type === void 0) { type = Mob.MOB; }
            this.type = type;
            this.sees = [];
            this.hate = 0;
            this.fear = 0;
            this.alive = true;
            this.concentration = 0;
            this.seesEnemies = false;
            this.freeze = 0;
            game.mobs.push(this);
        }
        Mob.prototype.isPlayer = function () {
            return game.player == this;
        };
        Mob.prototype.isGuard = function () {
            return (this.type == Mob.RED_ONI ||
                this.type == Mob.BLUE_ONI ||
                this.type == Mob.ELDER);
        };
        Mob.prototype.serialise = function () {
            var s = {};
            Object.assign(s, this);
            return s;
        };
        Mob.prototype.deserialise = function (s) {
            Object.assign(this, s);
            if (s.type == Mob.PLAYER)
                game.player = this;
            return this;
        };
        Mob.meansStop = function (code) {
            return keyMap[code] == -1;
        };
        Mob.prototype.getSpeed = function () {
            var speed = 100;
            if (this.isPlayer()) {
                speed = 120 + this.hate;
            }
            else if (this.isGuard) {
                return 120;
            }
            return speed;
        };
        Mob.prototype.act = function () {
            if (!this.alive) {
                console.log("zombie");
                console.log(this);
            }
            if (this.freeze > 0) {
                this.freeze -= this.getSpeed();
                return;
            }
            if (this.isGuard() && !this.at) {
                var tile = game.at(game.exits[0]);
                if (!tile.mob) {
                    this.at = game.exits[0].slice();
                    tile.mob = this;
                    console.log("Spawn guard");
                    console.log(this);
                }
            }
            if (this.isPlayer()) {
                game.engine.lock();
                game.playerAct();
            }
            else {
                if (this.at)
                    this.mobAct();
            }
        };
        Mob.prototype.tile = function () {
            return game.at(this.at);
        };
        Mob.prototype.fight = function (target) {
            console.log("FIGHT");
            console.log(this);
            console.log(target);
            var win;
            if (target.type == Mob.BLUE_ONI) {
                win = this.hate < RNG$1.getUniformInt(1, 100) + 20;
                game.log(win ? str.blue_victory : str.blue_lose);
            }
            else if (target.type == Mob.RED_ONI) {
                console.log(this.hate, RNG$1.getUniformInt(1, 100) - 20);
                win = this.hate > RNG$1.getUniformInt(1, 100) - 20;
                game.log(win ? str.red_victory : str.red_lose);
            }
            else {
                if (game.killed > 0) {
                    win = false;
                    game.log(str.elder_lose);
                }
                else {
                    return;
                }
            }
            game.log(win ? str.death : str.lose);
            if (win) {
                target.die();
            }
            else
                this.die();
        };
        Mob.prototype.goTo = function (newAt) {
            var tile = this.tile();
            this.concentration = 0;
            var targetMob = game.at(newAt).mob;
            if (targetMob) {
                if (this.isPlayer()) {
                    if (targetMob.isGuard()) {
                        this.fight(targetMob);
                        return;
                    }
                    else {
                        targetMob.die();
                    }
                }
                else {
                    if (targetMob.isPlayer() && this.isGuard()) {
                        targetMob.fight(this);
                        return;
                    }
                    else {
                        if (RNG$1.getUniform() < 0.5)
                            return;
                        else {
                            targetMob.at = this.at.slice(0, 2);
                            tile.mob = targetMob;
                            targetMob.reroute();
                        }
                    }
                }
            }
            if (tile.mob == this)
                tile.mob = null;
            this.at = newAt.slice(0, 2);
            tile = this.tile();
            tile.mob = this;
            if (this.isPlayer()) {
                if (tile.symbol == "⚘") {
                    tile.symbol = " ";
                    game.flowersCollected++;
                    game.log(str.collected, game.flowersCollected + "/" + game.options.flowersNeeded);
                    if (game.flowersCollected == game.options.flowersNeeded) {
                        game.log(str.collected_all);
                    }
                    if (game.flowersCollected >= game.options.flowersNeeded &&
                        game.flowersCollected % 2 == 0) {
                        game.log(str.collected_even);
                    }
                }
                if (tile.symbol == "b" && game.allFlowersCollected()) {
                    game.end();
                }
            }
            else {
                this.leaveScent();
            }
        };
        Mob.prototype.die = function () {
            this.alive = false;
            game.scheduler.remove(this);
            this.tile().mob = null;
            var fov = new FOV$1.PreciseShadowcasting(function (x, y) { return !game.safeAt([x, y]).opaque; });
            fov.compute(this.at[0], this.at[1], 3, function (x, y, r, vis) {
                var tile = game.at([x, y]);
                if (tile.symbol == " ") {
                    tile.symbol = "*";
                    tile.cost += 2;
                }
            });
            console.log(this);
            console.log("dies");
            if (this.isPlayer()) {
                this.lookAround();
                game.draw();
                game.complete = true;
                game.engine.lock();
                return;
            }
            else {
                game.player.hate = 0;
                game.seeingRed = false;
            }
            game.log(str.death);
            if (!this.isPlayer()) {
                game.killed++;
            }
        };
        Mob.prototype.leaveScent = function () {
            var tile = game.at(this.at);
            tile.mob = this;
            if (tile.scent <= 0.01) {
                game.scent.push(tile);
            }
            tile.scent = 0.5 + Math.min(1, this.fear / 100);
        };
        Mob.prototype.findNearestMob = function () {
            var nearestMob = game.mobs
                .map(function (m) {
                return {
                    mob: m,
                    d: m.isPlayer() || !m.alive || !m.at
                        ? 1e6
                        : distance(m.at, game.player.at)
                };
            })
                .reduce(function (prev, cur) { return (cur.d < prev.d ? cur : prev); }, {
                mob: null,
                d: 1e6
            });
            return nearestMob.mob;
        };
        Mob.prototype.pathFinderUsed = function () {
            if (this.isPlayer() ||
                this.isGuard() ||
                this.fear < WARY ||
                !this.tile().visible)
                return game.pathfinder;
            else
                return game.escapefinder;
        };
        Mob.prototype.findPathTo = function (to) {
            var finder = this.pathFinderUsed();
            var path = finder.find(this.at, to);
            if (path)
                path.shift();
            return path;
        };
        Mob.prototype.reroute = function () {
            if (this.hasPath()) {
                this.path = this.pathFinderUsed().find(this.at, this.path.pop());
            }
        };
        Mob.prototype.seesOthers = function () {
            for (var _i = 0, _a = this.sees; _i < _a.length; _i++) {
                var at = _a[_i];
                var tile = game.at(at);
                if (tile.mob && tile.mob != this) {
                    return tile.mob;
                }
            }
            return null;
        };
        Mob.prototype.waiting = function () {
            return (this.path &&
                this.path[0] &&
                this.path[0][0] == this.at[0] &&
                this.path[0][1] == this.at[1]);
        };
        Mob.prototype.playerAct = function () {
            if (game.seeingRed) {
                this.stop();
                var nearestMob = this.findNearestMob();
                if (nearestMob) {
                    var path = this.findPathTo(nearestMob.at);
                    if (path[0])
                        this.goTo(path[0]);
                }
            }
            else if (this.path) {
                this.stopWhenMeetEnemies();
                if (!this.hasPath())
                    this.stop();
                if (this.hasPath()) {
                    if (this.waiting()) {
                        this.stay();
                    }
                    else {
                        this.goTo(this.path.shift());
                    }
                }
                else {
                    return false;
                }
            }
            else {
                var code = game.lastKey;
                delete game.lastKey;
                if (!(code in keyMap)) {
                    return false;
                }
                var kmc = keyMap[code];
                if (kmc == -1) {
                    this.stay();
                }
                else {
                    var diff = kmc == -1 ? [0, 0] : DIRS[8][kmc];
                    var newAt = [this.at[0] + diff[0], this.at[1] + diff[1]];
                    if (game.at(newAt).cost > 1000) {
                        return false;
                    }
                    this.goTo(newAt);
                }
            }
            this.lookAround();
            /*for(let mob of game.mobs){
              if(mob.emote){
                new Animation([mob.at[0], mob.at[1] - 1], 2, {duration: 1000, symbol:mob.emote});
                mob.emote = null
              }
            }*/
            return true;
        };
        Mob.prototype.setPath = function (to) {
            this.path = this.findPathTo(to);
        };
        Mob.prototype.mobAct = function () {
            if (this.isGuard()) {
                this.fear = 0;
                if (this.at && game.player.seesEnemies) {
                    this.setPath(game.player.at);
                }
            }
            if (this.path && this.path.length > 0) {
                if (this.tile().visible) {
                    this.path = this.findPathTo(this.path.pop());
                }
                if (this.path && this.path.length > 0)
                    this.goTo(this.path.shift());
                if (!this.alive)
                    return;
                var tile = this.tile();
                if (tile.symbol == "*") {
                    this.fear += 5;
                }
                if (tile.symbol == "<" && !this.hasPath()) {
                    this.leave();
                }
            }
            else {
                this.path = [];
                var goal = void 0;
                var leaving = RNG$1.getUniform() <
                    game.options.despawn + Math.max(0, this.fear - AFRAID) / 100;
                if (leaving)
                    goal = RNG$1.getItem(game.exits);
                else
                    goal = RNG$1.getItem(game.landmarks);
                this.path = this.findPathTo(goal);
            }
        };
        Mob.prototype.leave = function () {
            this.tile().mob = null;
            this.at = null;
            this.path = null;
            game.panic += this.fear;
            game.log("escaped", game.panic.toFixed(2));
        };
        Mob.prototype.stay = function () {
            this.concentration++;
            if (this.isPlayer() && this.concentration > 5 && this.hate == 0)
                game.alertOnce("calm");
            this.changeHateBy(-0.5);
        };
        Mob.prototype.changeHateBy = function (dHate) {
            this.hate = Math.min(Math.max(0, this.hate + dHate), 100);
            if (this.hate >= 25) {
                game.alertOnce("rage");
            }
            if (this.hate >= 50) {
                game.alertOnce("rage_more");
            }
        };
        Mob.prototype.stopWhenMeetEnemies = function () {
            var seen = this.seesOthers();
            if (seen && !this.seesEnemies && this.hasPath()) {
                this.stop();
                game.alertOnce("mob_first_" + seen.type);
                new Animation([seen.at[0], seen.at[1] - 1], 2, {
                    duration: 500,
                    interval: 100
                });
            }
            this.seesEnemies = seen ? true : false;
        };
        Mob.prototype.tooltip = function () {
            if (this.isPlayer()) {
                return [str.me];
            }
            else if (this.type > 1) {
                return [str["mob_" + this.type]];
            }
            else {
                var afraid = this.fear < WARY
                    ? null
                    : this.fear < AFRAID
                        ? str.mob_wary
                        : this.fear < PANIC
                            ? str.mob_afraid
                            : str.mob_fleeing;
                return afraid ? [str.mob, afraid] : [str.mob];
            }
        };
        Mob.prototype.lookAtMe = function () {
            var dFear = game.player.hate / 10 + (game.seeingRed ? 10 : 0);
            dFear *= 1 + game.killed;
            if (this.fear < AFRAID && this.fear + dFear >= AFRAID) {
                game.log(str.mob_startled);
                this.emote = "!";
            }
            if (this.fear < PANIC && this.fear + dFear >= PANIC) {
                game.log(str.mob_flees);
                this.emote = "⚡";
            }
            this.fear += dFear;
            if (this.type == Mob.ELDER && game.killed == 0) {
                if (distance(this.at, game.player.at) <= 3) {
                    game.end(str.ending_true);
                }
            }
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
            var fov = new FOV$1.PreciseShadowcasting(function (x, y) { return !game.safeAt([x, y]).opaque; });
            this.sees = [];
            var dHate = game.seeingRed ? -0.3 : -0.2;
            var seesFlower = false;
            var seesMobs = false;
            fov.compute(this.at[0], this.at[1], 20, function (x, y, r, vis) {
                _this.sees.push([x, y]);
                var tile = game.at([x, y]);
                if (tile.symbol == "⚘" && r <= 10)
                    seesFlower = true;
                if (tile.mob && !tile.mob.isPlayer()) {
                    tile.mob.lookAtMe();
                    seesMobs = true;
                    game.alertOnce("mob_first_" + tile.mob.type);
                    dHate += 10 / (r + 3);
                }
                tile.visible = (vis * (20 - r)) / 20;
                tile.seen = 1;
            });
            if (this.tile().scent > 0.1) {
                dHate += this.tile().scent * 2;
                game.alertOnce("smell_first");
            }
            if (seesFlower) {
                game.alertOnce("flower_first");
                if (dHate > 0) {
                    game.alertOnce("flower_mob_first");
                    dHate *= 2;
                }
                else {
                    dHate += -3;
                }
            }
            this.changeHateBy(Math.min(10, dHate * game.options.hateGain));
            if (game.letterRead < game.flowersCollected &&
                !seesMobs &&
                ((RNG$1.getUniform() < 0.1 && this.hate == 0) || seesFlower)) {
                game.readNextLetter();
            }
            var wasSeeingRed = game.seeingRed;
            if (RNG$1.getUniform() < 0.3 ||
                game.player.hate == 100 ||
                game.player.hate == 0) {
                game.seeingRed = (this.hate - 50) / 50 > RNG$1.getUniform();
                if (wasSeeingRed != game.seeingRed)
                    game.log(game.seeingRed ? str.seeing_red : str.seeing_red_end);
            }
            game.escapefinder.setGridFear();
        };
        Mob.prototype.hasPath = function () {
            return this.path && this.path.length > 0;
        };
        Mob.prototype.stop = function () {
            this.path = null;
        };
        Mob.prototype.sym = function () {
            return ["☺", "☻", "g", "G", "e"][this.type];
        };
        Mob.prototype.fg = function () {
            if (this.isPlayer()) {
                if (game.seeingRed)
                    return "red";
                var redness = Math.min(200, game.killed * 20);
                return Color.toRGB([255, 255 - redness, 255 - redness]);
            }
            else {
                if (this.isGuard()) {
                    if (this.type == Mob.BLUE_ONI ||
                        (this.type == Mob.ELDER && game.killed == 0))
                        return "white";
                    else
                        return "red";
                }
                var brightness = Math.max(128, 255 - this.fear);
                return Color.toRGB([255, brightness, brightness]);
            }
        };
        Mob.prototype.actFixedInterval = function () { };
        Mob.MOB = 0;
        Mob.PLAYER = 1;
        Mob.BLUE_ONI = 2;
        Mob.RED_ONI = 3;
        Mob.ELDER = 4;
        return Mob;
    }());
    /*
        let pathfinder = new Path.AStar(
          to[0],
          to[1],
          (x, y) => game.at([x, y]).cost < 1000,
          { topology: 8 }
        );
        let path = [];
        pathfinder.compute(this.at[0], this.at[1], (x, y) =>
          path.push([x, y])
        );*/
    /*
      
        window.setTimeout(() => game.engine.unlock(), 50);
      } else {
        game.waitForInput();
      }

    */
    /*if (tile.symbol == "☨" && game.allFlowersCollected()) {
            game.won = true;
          }*/

    /**
     * Represents a single instance of EasyStar.
     * A path that is in the queue to eventually be found.
     */
    var instance = function() {
        this.pointsToAvoid = {};
        this.startX;
        this.callback;
        this.startY;
        this.endX;
        this.endY;
        this.nodeHash = {};
        this.openList;
    };

    /**
    * A simple Node that represents a single tile on the grid.
    * @param {Object} parent The parent node.
    * @param {Number} x The x position on the grid.
    * @param {Number} y The y position on the grid.
    * @param {Number} costSoFar How far this node is in moves*cost from the start.
    * @param {Number} simpleDistanceToTarget Manhatten distance to the end point.
    **/
    var node = function(parent, x, y, costSoFar, simpleDistanceToTarget) {
        this.parent = parent;
        this.x = x;
        this.y = y;
        this.costSoFar = costSoFar;
        this.simpleDistanceToTarget = simpleDistanceToTarget;

        /**
        * @return {Number} Best guess distance of a cost using this node.
        **/
        this.bestGuessDistance = function() {
            return this.costSoFar + this.simpleDistanceToTarget;
        };
    };

    var commonjsGlobal = typeof globalThis !== 'undefined' ? globalThis : typeof window !== 'undefined' ? window : typeof global !== 'undefined' ? global : typeof self !== 'undefined' ? self : {};

    function createCommonjsModule(fn, module) {
    	return module = { exports: {} }, fn(module, module.exports), module.exports;
    }

    var heap = createCommonjsModule(function (module, exports) {
    // Generated by CoffeeScript 1.8.0
    (function() {
      var Heap, defaultCmp, floor, heapify, heappop, heappush, heappushpop, heapreplace, insort, min, nlargest, nsmallest, updateItem, _siftdown, _siftup;

      floor = Math.floor, min = Math.min;


      /*
      Default comparison function to be used
       */

      defaultCmp = function(x, y) {
        if (x < y) {
          return -1;
        }
        if (x > y) {
          return 1;
        }
        return 0;
      };


      /*
      Insert item x in list a, and keep it sorted assuming a is sorted.
      
      If x is already in a, insert it to the right of the rightmost x.
      
      Optional args lo (default 0) and hi (default a.length) bound the slice
      of a to be searched.
       */

      insort = function(a, x, lo, hi, cmp) {
        var mid;
        if (lo == null) {
          lo = 0;
        }
        if (cmp == null) {
          cmp = defaultCmp;
        }
        if (lo < 0) {
          throw new Error('lo must be non-negative');
        }
        if (hi == null) {
          hi = a.length;
        }
        while (lo < hi) {
          mid = floor((lo + hi) / 2);
          if (cmp(x, a[mid]) < 0) {
            hi = mid;
          } else {
            lo = mid + 1;
          }
        }
        return ([].splice.apply(a, [lo, lo - lo].concat(x)), x);
      };


      /*
      Push item onto heap, maintaining the heap invariant.
       */

      heappush = function(array, item, cmp) {
        if (cmp == null) {
          cmp = defaultCmp;
        }
        array.push(item);
        return _siftdown(array, 0, array.length - 1, cmp);
      };


      /*
      Pop the smallest item off the heap, maintaining the heap invariant.
       */

      heappop = function(array, cmp) {
        var lastelt, returnitem;
        if (cmp == null) {
          cmp = defaultCmp;
        }
        lastelt = array.pop();
        if (array.length) {
          returnitem = array[0];
          array[0] = lastelt;
          _siftup(array, 0, cmp);
        } else {
          returnitem = lastelt;
        }
        return returnitem;
      };


      /*
      Pop and return the current smallest value, and add the new item.
      
      This is more efficient than heappop() followed by heappush(), and can be
      more appropriate when using a fixed size heap. Note that the value
      returned may be larger than item! That constrains reasonable use of
      this routine unless written as part of a conditional replacement:
          if item > array[0]
            item = heapreplace(array, item)
       */

      heapreplace = function(array, item, cmp) {
        var returnitem;
        if (cmp == null) {
          cmp = defaultCmp;
        }
        returnitem = array[0];
        array[0] = item;
        _siftup(array, 0, cmp);
        return returnitem;
      };


      /*
      Fast version of a heappush followed by a heappop.
       */

      heappushpop = function(array, item, cmp) {
        var _ref;
        if (cmp == null) {
          cmp = defaultCmp;
        }
        if (array.length && cmp(array[0], item) < 0) {
          _ref = [array[0], item], item = _ref[0], array[0] = _ref[1];
          _siftup(array, 0, cmp);
        }
        return item;
      };


      /*
      Transform list into a heap, in-place, in O(array.length) time.
       */

      heapify = function(array, cmp) {
        var i, _i, _len, _ref1, _results, _results1;
        if (cmp == null) {
          cmp = defaultCmp;
        }
        _ref1 = (function() {
          _results1 = [];
          for (var _j = 0, _ref = floor(array.length / 2); 0 <= _ref ? _j < _ref : _j > _ref; 0 <= _ref ? _j++ : _j--){ _results1.push(_j); }
          return _results1;
        }).apply(this).reverse();
        _results = [];
        for (_i = 0, _len = _ref1.length; _i < _len; _i++) {
          i = _ref1[_i];
          _results.push(_siftup(array, i, cmp));
        }
        return _results;
      };


      /*
      Update the position of the given item in the heap.
      This function should be called every time the item is being modified.
       */

      updateItem = function(array, item, cmp) {
        var pos;
        if (cmp == null) {
          cmp = defaultCmp;
        }
        pos = array.indexOf(item);
        if (pos === -1) {
          return;
        }
        _siftdown(array, 0, pos, cmp);
        return _siftup(array, pos, cmp);
      };


      /*
      Find the n largest elements in a dataset.
       */

      nlargest = function(array, n, cmp) {
        var elem, result, _i, _len, _ref;
        if (cmp == null) {
          cmp = defaultCmp;
        }
        result = array.slice(0, n);
        if (!result.length) {
          return result;
        }
        heapify(result, cmp);
        _ref = array.slice(n);
        for (_i = 0, _len = _ref.length; _i < _len; _i++) {
          elem = _ref[_i];
          heappushpop(result, elem, cmp);
        }
        return result.sort(cmp).reverse();
      };


      /*
      Find the n smallest elements in a dataset.
       */

      nsmallest = function(array, n, cmp) {
        var elem, i, los, result, _i, _j, _len, _ref, _ref1, _results;
        if (cmp == null) {
          cmp = defaultCmp;
        }
        if (n * 10 <= array.length) {
          result = array.slice(0, n).sort(cmp);
          if (!result.length) {
            return result;
          }
          los = result[result.length - 1];
          _ref = array.slice(n);
          for (_i = 0, _len = _ref.length; _i < _len; _i++) {
            elem = _ref[_i];
            if (cmp(elem, los) < 0) {
              insort(result, elem, 0, null, cmp);
              result.pop();
              los = result[result.length - 1];
            }
          }
          return result;
        }
        heapify(array, cmp);
        _results = [];
        for (i = _j = 0, _ref1 = min(n, array.length); 0 <= _ref1 ? _j < _ref1 : _j > _ref1; i = 0 <= _ref1 ? ++_j : --_j) {
          _results.push(heappop(array, cmp));
        }
        return _results;
      };

      _siftdown = function(array, startpos, pos, cmp) {
        var newitem, parent, parentpos;
        if (cmp == null) {
          cmp = defaultCmp;
        }
        newitem = array[pos];
        while (pos > startpos) {
          parentpos = (pos - 1) >> 1;
          parent = array[parentpos];
          if (cmp(newitem, parent) < 0) {
            array[pos] = parent;
            pos = parentpos;
            continue;
          }
          break;
        }
        return array[pos] = newitem;
      };

      _siftup = function(array, pos, cmp) {
        var childpos, endpos, newitem, rightpos, startpos;
        if (cmp == null) {
          cmp = defaultCmp;
        }
        endpos = array.length;
        startpos = pos;
        newitem = array[pos];
        childpos = 2 * pos + 1;
        while (childpos < endpos) {
          rightpos = childpos + 1;
          if (rightpos < endpos && !(cmp(array[childpos], array[rightpos]) < 0)) {
            childpos = rightpos;
          }
          array[pos] = array[childpos];
          pos = childpos;
          childpos = 2 * pos + 1;
        }
        array[pos] = newitem;
        return _siftdown(array, startpos, pos, cmp);
      };

      Heap = (function() {
        Heap.push = heappush;

        Heap.pop = heappop;

        Heap.replace = heapreplace;

        Heap.pushpop = heappushpop;

        Heap.heapify = heapify;

        Heap.updateItem = updateItem;

        Heap.nlargest = nlargest;

        Heap.nsmallest = nsmallest;

        function Heap(cmp) {
          this.cmp = cmp != null ? cmp : defaultCmp;
          this.nodes = [];
        }

        Heap.prototype.push = function(x) {
          return heappush(this.nodes, x, this.cmp);
        };

        Heap.prototype.pop = function() {
          return heappop(this.nodes, this.cmp);
        };

        Heap.prototype.peek = function() {
          return this.nodes[0];
        };

        Heap.prototype.contains = function(x) {
          return this.nodes.indexOf(x) !== -1;
        };

        Heap.prototype.replace = function(x) {
          return heapreplace(this.nodes, x, this.cmp);
        };

        Heap.prototype.pushpop = function(x) {
          return heappushpop(this.nodes, x, this.cmp);
        };

        Heap.prototype.heapify = function() {
          return heapify(this.nodes, this.cmp);
        };

        Heap.prototype.updateItem = function(x) {
          return updateItem(this.nodes, x, this.cmp);
        };

        Heap.prototype.clear = function() {
          return this.nodes = [];
        };

        Heap.prototype.empty = function() {
          return this.nodes.length === 0;
        };

        Heap.prototype.size = function() {
          return this.nodes.length;
        };

        Heap.prototype.clone = function() {
          var heap;
          heap = new Heap();
          heap.nodes = this.nodes.slice(0);
          return heap;
        };

        Heap.prototype.toArray = function() {
          return this.nodes.slice(0);
        };

        Heap.prototype.insert = Heap.prototype.push;

        Heap.prototype.top = Heap.prototype.peek;

        Heap.prototype.front = Heap.prototype.peek;

        Heap.prototype.has = Heap.prototype.contains;

        Heap.prototype.copy = Heap.prototype.clone;

        return Heap;

      })();

      (function(root, factory) {
        {
          return module.exports = factory();
        }
      })(this, function() {
        return Heap;
      });

    }).call(commonjsGlobal);
    });

    var heap$1 = heap;

    /**
    *   EasyStar.js
    *   github.com/prettymuchbryce/EasyStarJS
    *   Licensed under the MIT license.
    *
    *   Implementation By Bryce Neal (@prettymuchbryce)
    **/

    var EasyStar = {};




    const CLOSED_LIST = 0;
    const OPEN_LIST = 1;

    var easystar = EasyStar;

    var nextInstanceId = 1;

    EasyStar.js = function() {
        var STRAIGHT_COST = 1.0;
        var DIAGONAL_COST = 1.4;
        var syncEnabled = false;
        var pointsToAvoid = {};
        var collisionGrid;
        var costMap = {};
        var pointsToCost = {};
        var directionalConditions = {};
        var allowCornerCutting = true;
        var iterationsSoFar;
        var instances = {};
        var instanceQueue = [];
        var iterationsPerCalculation = Number.MAX_VALUE;
        var acceptableTiles;
        var diagonalsEnabled = false;

        /**
        * Sets the collision grid that EasyStar uses.
        *
        * @param {Array|Number} tiles An array of numbers that represent
        * which tiles in your grid should be considered
        * acceptable, or "walkable".
        **/
        this.setAcceptableTiles = function(tiles) {
            if (tiles instanceof Array) {
                // Array
                acceptableTiles = tiles;
            } else if (!isNaN(parseFloat(tiles)) && isFinite(tiles)) {
                // Number
                acceptableTiles = [tiles];
            }
        };

        /**
        * Enables sync mode for this EasyStar instance..
        * if you're into that sort of thing.
        **/
        this.enableSync = function() {
            syncEnabled = true;
        };

        /**
        * Disables sync mode for this EasyStar instance.
        **/
        this.disableSync = function() {
            syncEnabled = false;
        };

        /**
         * Enable diagonal pathfinding.
         */
        this.enableDiagonals = function() {
            diagonalsEnabled = true;
        };

        /**
         * Disable diagonal pathfinding.
         */
        this.disableDiagonals = function() {
            diagonalsEnabled = false;
        };

        /**
        * Sets the collision grid that EasyStar uses.
        *
        * @param {Array} grid The collision grid that this EasyStar instance will read from.
        * This should be a 2D Array of Numbers.
        **/
        this.setGrid = function(grid) {
            collisionGrid = grid;

            //Setup cost map
            for (var y = 0; y < collisionGrid.length; y++) {
                for (var x = 0; x < collisionGrid[0].length; x++) {
                    if (!costMap[collisionGrid[y][x]]) {
                        costMap[collisionGrid[y][x]] = 1;
                    }
                }
            }
        };

        /**
        * Sets the tile cost for a particular tile type.
        *
        * @param {Number} The tile type to set the cost for.
        * @param {Number} The multiplicative cost associated with the given tile.
        **/
        this.setTileCost = function(tileType, cost) {
            costMap[tileType] = cost;
        };

        /**
        * Sets the an additional cost for a particular point.
        * Overrides the cost from setTileCost.
        *
        * @param {Number} x The x value of the point to cost.
        * @param {Number} y The y value of the point to cost.
        * @param {Number} The multiplicative cost associated with the given point.
        **/
        this.setAdditionalPointCost = function(x, y, cost) {
            if (pointsToCost[y] === undefined) {
                pointsToCost[y] = {};
            }
            pointsToCost[y][x] = cost;
        };

        /**
        * Remove the additional cost for a particular point.
        *
        * @param {Number} x The x value of the point to stop costing.
        * @param {Number} y The y value of the point to stop costing.
        **/
        this.removeAdditionalPointCost = function(x, y) {
            if (pointsToCost[y] !== undefined) {
                delete pointsToCost[y][x];
            }
        };

        /**
        * Remove all additional point costs.
        **/
        this.removeAllAdditionalPointCosts = function() {
            pointsToCost = {};
        };

        /**
        * Sets a directional condition on a tile
        *
        * @param {Number} x The x value of the point.
        * @param {Number} y The y value of the point.
        * @param {Array.<String>} allowedDirections A list of all the allowed directions that can access
        * the tile.
        **/
        this.setDirectionalCondition = function(x, y, allowedDirections) {
            if (directionalConditions[y] === undefined) {
                directionalConditions[y] = {};
            }
            directionalConditions[y][x] = allowedDirections;
        };

        /**
        * Remove all directional conditions
        **/
        this.removeAllDirectionalConditions = function() {
            directionalConditions = {};
        };

        /**
        * Sets the number of search iterations per calculation.
        * A lower number provides a slower result, but more practical if you
        * have a large tile-map and don't want to block your thread while
        * finding a path.
        *
        * @param {Number} iterations The number of searches to prefrom per calculate() call.
        **/
        this.setIterationsPerCalculation = function(iterations) {
            iterationsPerCalculation = iterations;
        };

        /**
        * Avoid a particular point on the grid,
        * regardless of whether or not it is an acceptable tile.
        *
        * @param {Number} x The x value of the point to avoid.
        * @param {Number} y The y value of the point to avoid.
        **/
        this.avoidAdditionalPoint = function(x, y) {
            if (pointsToAvoid[y] === undefined) {
                pointsToAvoid[y] = {};
            }
            pointsToAvoid[y][x] = 1;
        };

        /**
        * Stop avoiding a particular point on the grid.
        *
        * @param {Number} x The x value of the point to stop avoiding.
        * @param {Number} y The y value of the point to stop avoiding.
        **/
        this.stopAvoidingAdditionalPoint = function(x, y) {
            if (pointsToAvoid[y] !== undefined) {
                delete pointsToAvoid[y][x];
            }
        };

        /**
        * Enables corner cutting in diagonal movement.
        **/
        this.enableCornerCutting = function() {
            allowCornerCutting = true;
        };

        /**
        * Disables corner cutting in diagonal movement.
        **/
        this.disableCornerCutting = function() {
            allowCornerCutting = false;
        };

        /**
        * Stop avoiding all additional points on the grid.
        **/
        this.stopAvoidingAllAdditionalPoints = function() {
            pointsToAvoid = {};
        };

        /**
        * Find a path.
        *
        * @param {Number} startX The X position of the starting point.
        * @param {Number} startY The Y position of the starting point.
        * @param {Number} endX The X position of the ending point.
        * @param {Number} endY The Y position of the ending point.
        * @param {Function} callback A function that is called when your path
        * is found, or no path is found.
        * @return {Number} A numeric, non-zero value which identifies the created instance. This value can be passed to cancelPath to cancel the path calculation.
        *
        **/
        this.findPath = function(startX, startY, endX, endY, callback) {
            // Wraps the callback for sync vs async logic
            var callbackWrapper = function(result) {
                if (syncEnabled) {
                    callback(result);
                } else {
                    setTimeout(function() {
                        callback(result);
                    });
                }
            };

            // No acceptable tiles were set
            if (acceptableTiles === undefined) {
                throw new Error("You can't set a path without first calling setAcceptableTiles() on EasyStar.");
            }
            // No grid was set
            if (collisionGrid === undefined) {
                throw new Error("You can't set a path without first calling setGrid() on EasyStar.");
            }

            // Start or endpoint outside of scope.
            if (startX < 0 || startY < 0 || endX < 0 || endY < 0 ||
            startX > collisionGrid[0].length-1 || startY > collisionGrid.length-1 ||
            endX > collisionGrid[0].length-1 || endY > collisionGrid.length-1) {
                throw new Error("Your start or end point is outside the scope of your grid.");
            }

            // Start and end are the same tile.
            if (startX===endX && startY===endY) {
                callbackWrapper([]);
                return;
            }

            // End point is not an acceptable tile.
            var endTile = collisionGrid[endY][endX];
            var isAcceptable = false;
            for (var i = 0; i < acceptableTiles.length; i++) {
                if (endTile === acceptableTiles[i]) {
                    isAcceptable = true;
                    break;
                }
            }

            if (isAcceptable === false) {
                callbackWrapper(null);
                return;
            }

            // Create the instance
            var instance$1 = new instance();
            instance$1.openList = new heap$1(function(nodeA, nodeB) {
                return nodeA.bestGuessDistance() - nodeB.bestGuessDistance();
            });
            instance$1.isDoneCalculating = false;
            instance$1.nodeHash = {};
            instance$1.startX = startX;
            instance$1.startY = startY;
            instance$1.endX = endX;
            instance$1.endY = endY;
            instance$1.callback = callbackWrapper;

            instance$1.openList.push(coordinateToNode(instance$1, instance$1.startX,
                instance$1.startY, null, STRAIGHT_COST));

            var instanceId = nextInstanceId ++;
            instances[instanceId] = instance$1;
            instanceQueue.push(instanceId);
            return instanceId;
        };

        /**
         * Cancel a path calculation.
         *
         * @param {Number} instanceId The instance ID of the path being calculated
         * @return {Boolean} True if an instance was found and cancelled.
         *
         **/
        this.cancelPath = function(instanceId) {
            if (instanceId in instances) {
                delete instances[instanceId];
                // No need to remove it from instanceQueue
                return true;
            }
            return false;
        };

        /**
        * This method steps through the A* Algorithm in an attempt to
        * find your path(s). It will search 4-8 tiles (depending on diagonals) for every calculation.
        * You can change the number of calculations done in a call by using
        * easystar.setIteratonsPerCalculation().
        **/
        this.calculate = function() {
            if (instanceQueue.length === 0 || collisionGrid === undefined || acceptableTiles === undefined) {
                return;
            }
            for (iterationsSoFar = 0; iterationsSoFar < iterationsPerCalculation; iterationsSoFar++) {
                if (instanceQueue.length === 0) {
                    return;
                }

                if (syncEnabled) {
                    // If this is a sync instance, we want to make sure that it calculates synchronously.
                    iterationsSoFar = 0;
                }

                var instanceId = instanceQueue[0];
                var instance = instances[instanceId];
                if (typeof instance == 'undefined') {
                    // This instance was cancelled
                    instanceQueue.shift();
                    continue;
                }

                // Couldn't find a path.
                if (instance.openList.size() === 0) {
                    instance.callback(null);
                    delete instances[instanceId];
                    instanceQueue.shift();
                    continue;
                }

                var searchNode = instance.openList.pop();

                // Handles the case where we have found the destination
                if (instance.endX === searchNode.x && instance.endY === searchNode.y) {
                    var path = [];
                    path.push({x: searchNode.x, y: searchNode.y});
                    var parent = searchNode.parent;
                    while (parent!=null) {
                        path.push({x: parent.x, y:parent.y});
                        parent = parent.parent;
                    }
                    path.reverse();
                    var ip = path;
                    instance.callback(ip);
                    delete instances[instanceId];
                    instanceQueue.shift();
                    continue;
                }

                searchNode.list = CLOSED_LIST;

                if (searchNode.y > 0) {
                    checkAdjacentNode(instance, searchNode,
                        0, -1, STRAIGHT_COST * getTileCost(searchNode.x, searchNode.y-1));
                }
                if (searchNode.x < collisionGrid[0].length-1) {
                    checkAdjacentNode(instance, searchNode,
                        1, 0, STRAIGHT_COST * getTileCost(searchNode.x+1, searchNode.y));
                }
                if (searchNode.y < collisionGrid.length-1) {
                    checkAdjacentNode(instance, searchNode,
                        0, 1, STRAIGHT_COST * getTileCost(searchNode.x, searchNode.y+1));
                }
                if (searchNode.x > 0) {
                    checkAdjacentNode(instance, searchNode,
                        -1, 0, STRAIGHT_COST * getTileCost(searchNode.x-1, searchNode.y));
                }
                if (diagonalsEnabled) {
                    if (searchNode.x > 0 && searchNode.y > 0) {

                        if (allowCornerCutting ||
                            (isTileWalkable(collisionGrid, acceptableTiles, searchNode.x, searchNode.y-1, searchNode) &&
                            isTileWalkable(collisionGrid, acceptableTiles, searchNode.x-1, searchNode.y, searchNode))) {

                            checkAdjacentNode(instance, searchNode,
                                -1, -1, DIAGONAL_COST * getTileCost(searchNode.x-1, searchNode.y-1));
                        }
                    }
                    if (searchNode.x < collisionGrid[0].length-1 && searchNode.y < collisionGrid.length-1) {

                        if (allowCornerCutting ||
                            (isTileWalkable(collisionGrid, acceptableTiles, searchNode.x, searchNode.y+1, searchNode) &&
                            isTileWalkable(collisionGrid, acceptableTiles, searchNode.x+1, searchNode.y, searchNode))) {

                            checkAdjacentNode(instance, searchNode,
                                1, 1, DIAGONAL_COST * getTileCost(searchNode.x+1, searchNode.y+1));
                        }
                    }
                    if (searchNode.x < collisionGrid[0].length-1 && searchNode.y > 0) {

                        if (allowCornerCutting ||
                            (isTileWalkable(collisionGrid, acceptableTiles, searchNode.x, searchNode.y-1, searchNode) &&
                            isTileWalkable(collisionGrid, acceptableTiles, searchNode.x+1, searchNode.y, searchNode))) {

                            checkAdjacentNode(instance, searchNode,
                                1, -1, DIAGONAL_COST * getTileCost(searchNode.x+1, searchNode.y-1));
                        }
                    }
                    if (searchNode.x > 0 && searchNode.y < collisionGrid.length-1) {

                        if (allowCornerCutting ||
                            (isTileWalkable(collisionGrid, acceptableTiles, searchNode.x, searchNode.y+1, searchNode) &&
                            isTileWalkable(collisionGrid, acceptableTiles, searchNode.x-1, searchNode.y, searchNode))) {

                            checkAdjacentNode(instance, searchNode,
                                -1, 1, DIAGONAL_COST * getTileCost(searchNode.x-1, searchNode.y+1));
                        }
                    }
                }

            }
        };

        // Private methods follow
        var checkAdjacentNode = function(instance, searchNode, x, y, cost) {
            var adjacentCoordinateX = searchNode.x+x;
            var adjacentCoordinateY = searchNode.y+y;

            if ((pointsToAvoid[adjacentCoordinateY] === undefined ||
                 pointsToAvoid[adjacentCoordinateY][adjacentCoordinateX] === undefined) &&
                isTileWalkable(collisionGrid, acceptableTiles, adjacentCoordinateX, adjacentCoordinateY, searchNode)) {
                var node = coordinateToNode(instance, adjacentCoordinateX,
                    adjacentCoordinateY, searchNode, cost);

                if (node.list === undefined) {
                    node.list = OPEN_LIST;
                    instance.openList.push(node);
                } else if (searchNode.costSoFar + cost < node.costSoFar) {
                    node.costSoFar = searchNode.costSoFar + cost;
                    node.parent = searchNode;
                    instance.openList.updateItem(node);
                }
            }
        };

        // Helpers
        var isTileWalkable = function(collisionGrid, acceptableTiles, x, y, sourceNode) {
            var directionalCondition = directionalConditions[y] && directionalConditions[y][x];
            if (directionalCondition) {
                var direction = calculateDirection(sourceNode.x - x, sourceNode.y - y);
                var directionIncluded = function () {
                    for (var i = 0; i < directionalCondition.length; i++) {
                        if (directionalCondition[i] === direction) return true
                    }
                    return false
                };
                if (!directionIncluded()) return false
            }
            for (var i = 0; i < acceptableTiles.length; i++) {
                if (collisionGrid[y][x] === acceptableTiles[i]) {
                    return true;
                }
            }

            return false;
        };

        /**
         * -1, -1 | 0, -1  | 1, -1
         * -1,  0 | SOURCE | 1,  0
         * -1,  1 | 0,  1  | 1,  1
         */
        var calculateDirection = function (diffX, diffY) {
            if (diffX === 0 && diffY === -1) return EasyStar.TOP
            else if (diffX === 1 && diffY === -1) return EasyStar.TOP_RIGHT
            else if (diffX === 1 && diffY === 0) return EasyStar.RIGHT
            else if (diffX === 1 && diffY === 1) return EasyStar.BOTTOM_RIGHT
            else if (diffX === 0 && diffY === 1) return EasyStar.BOTTOM
            else if (diffX === -1 && diffY === 1) return EasyStar.BOTTOM_LEFT
            else if (diffX === -1 && diffY === 0) return EasyStar.LEFT
            else if (diffX === -1 && diffY === -1) return EasyStar.TOP_LEFT
            throw new Error('These differences are not valid: ' + diffX + ', ' + diffY)
        };

        var getTileCost = function(x, y) {
            return (pointsToCost[y] && pointsToCost[y][x]) || costMap[collisionGrid[y][x]]
        };

        var coordinateToNode = function(instance, x, y, parent, cost) {
            if (instance.nodeHash[y] !== undefined) {
                if (instance.nodeHash[y][x] !== undefined) {
                    return instance.nodeHash[y][x];
                }
            } else {
                instance.nodeHash[y] = {};
            }
            var simpleDistanceToTarget = getDistance(x, y, instance.endX, instance.endY);
            if (parent!==null) {
                var costSoFar = parent.costSoFar + cost;
            } else {
                costSoFar = 0;
            }
            var node$1 = new node(parent,x,y,costSoFar,simpleDistanceToTarget);
            instance.nodeHash[y][x] = node$1;
            return node$1;
        };

        var getDistance = function(x1,y1,x2,y2) {
            if (diagonalsEnabled) {
                // Octile distance
                var dx = Math.abs(x1 - x2);
                var dy = Math.abs(y1 - y2);
                if (dx < dy) {
                    return DIAGONAL_COST * dx + dy;
                } else {
                    return DIAGONAL_COST * dy + dx;
                }
            } else {
                // Manhattan distance
                var dx = Math.abs(x1 - x2);
                var dy = Math.abs(y1 - y2);
                return (dx + dy);
            }
        };
    };

    EasyStar.TOP = 'TOP';
    EasyStar.TOP_RIGHT = 'TOP_RIGHT';
    EasyStar.RIGHT = 'RIGHT';
    EasyStar.BOTTOM_RIGHT = 'BOTTOM_RIGHT';
    EasyStar.BOTTOM = 'BOTTOM';
    EasyStar.BOTTOM_LEFT = 'BOTTOM_LEFT';
    EasyStar.LEFT = 'LEFT';
    EasyStar.TOP_LEFT = 'TOP_LEFT';

    var lang = {
        lang: "English",
        guide: "\n<span style=\"color:lightgrey\">\nclick - move to cursor or stop<br/>\nclick self - wait<br/>\nNUMPAD keys - move around<br/>\nNum5, space - wait<br/>\nShift + 1-9: save<br/>\n1-9: load<br/>\nShift + R: restart<br/>\nShift + L: toggle language<br/>\nESC: toggle menu<br/>\n</span>\n",
        save: "Save",
        load: "Load",
        new_game: "New Game",
        continue: "Continue",
        saved_to: "Saved to {0}",
        loaded_from: "Loaded from {0}",
        no_save_in: "No save in {0}",
        me: "It's me. A regular everyday normal person.",
        flower: "A flower. Seeing it grow makes me calm. <br/> <span class='important'>I'll pick it for her.</span>",
        flower_first: "One of those weird red flowers <em>\u2698</em> she is fond of. <span class='important'>I'll pick some for her.</span> \nShe said she wants them with roots.",
        flower_mob_first: "<em>How dares it ☺ to be near the flower ⚘ !</em>",
        collected: "I carefully dig out the flower <em>⚘</em> {0}",
        collected_all: "I have collected enough flowers. But she is nowhere to seen. <span class='important'>Maybe she is home already? I'll go check.</span>",
        collected_even: "Even number of flowers is believed to be connected with death. I hope she is not superstitious.",
        tree: "Thick forest.",
        exit: "The path to the village.",
        entrance: "The path back to the road.",
        blood: "A pool of blood. Why is it here?",
        blood_old: "Looks like a dried blood. Weird.",
        blood_trail: "A trail of blood. Quite old.",
        wall: "An old, but sturdy hut wall. She lives here.",
        mob: "Monster",
        mob_2: "Crafty monster. Fight it calmly.",
        mob_3: "Strong monster. Fight it furiously.",
        mob_4: "Elder",
        mob_first_0: "I see one of the monsters <span style='background:darkred;font-weight:bold;'>☺</span> that infest this forest. Alone they can't harm me, but they are dangerous in groups.",
        mob_first_2: "This monster is crafty. I should be very careful and <span class='important'>keep my calm</span> while fighting with it.",
        mob_first_3: "This monster is strong. But I'll overcome it if I <span class='important'>put all my hatred into the attack</span>.",
        mob_first_4: "It's... another monster. Right? I think I have seen it... him.. before. They call him Elder. \nLooks like it... he wants to tell me something. Can I trust him?",
        smell: "A trail of smell.",
        smell_first: "Those things smell \n<span style='background:#a00'>&nbsp;</span><span style='background:#800'>&nbsp;</span><span style='background:#600'>&nbsp;</span><span style='background:#400'>&nbsp;</span>\nquite bad. I can feel the trail of their stench from quite a far away.",
        calm: "After a moment of rest I feel my emotions calming a little and I get a better awareness of surroundings.",
        rage: "<span style='color:darkred'>Look and smell of those monsters raise a wave of rage in my heart.</span>",
        rage_more: "<em>I'm furious. I feel like I can snap at any moment.</em>",
        seeing_red: "<em>Waaargh!</em>",
        seeing_red_end: "What has just happened?",
        death: "<em>Splort.</em>",
        elder_angry: "So, here it is <em>e</em>. The one that I hate the most. And the one I have no chance to defeat. My only option is to run.",
        elder_lose: "The fight with the elder monster ends at the instant. I am as helpless against it as ordinary monsters are against me.",
        blue_victory: "I carefully dodged it's lunge and then made a precise killing strike.",
        blue_lose: "I charged monster only to be skewered with a fast stab.",
        red_victory: "I overwhelm it's defences with a stream of furious attacks.",
        red_lose: "The monster blocks most of my attacks and shrug off the others. And then deals one, but powerful attack.",
        lose: "<span class='important'>I collapse to never stand up again.<br/><br/>GAME OVER</span><br/><br/>Press Escape to continue.",
        not_here: "She is not here. Probably somewhere in the forest picking up herbs again. <span class='important'>I'll  go look for her.</span>",
        mob_wary: "It stares at me warily.",
        mob_afraid: "It covers in fear.",
        mob_fleeing: "It flees to it's lair screaming.",
        mob_startled: "☺ avoids me.",
        mob_flees: "☺ runs away.",
        game_complete: "GAME COMPLETE",
        grave: "A grave. Seems to be recent.",
        escaped: "Monster has escaped. Panic level: {0}",
        read_letter: [
            "Still no signs of her. Oh, right, I still have her letter. Maybe reading it will give some clues? I started reading:",
            "I have decided to continue reading the letter:",
            "Still can't find her. Maybe she is in the village? I'll continue with the letter:",
            "I'll read the remaining letter part:"
        ],
        close_letter: [
            "My sight has suddenly blurred, making seeing writing difficult. I will continue reading next time.",
            "Is she trying to be a philosopher here? Not my cup of tea. I'll better continue looking for her.",
            "It was painful to reading it. And impossible not to. I'll read the rest, just not now.",
            "It was all. I stand for a while looking at the letter blankly.  If she'd only know... "
        ],
        letter: [
            "\nI had an opportunity to pass you this letter, I hope it will reach you. I will explain this 'opportunity' later.\n\nI'm well, more or less, hope you are too. I have made some progress with my research, but not much. \nI have not yet found the cure, or even the cause of Strangling disease yet, but got some leads.\nLocals have a different name for this disease: Forest Cough. And indeed, symptoms are much more prominent \nwith those that are going to forest often. Which is the most of the village. They had very poor harvest last year, \nand a big chunk of it was looted. So, villagers have to look for food everywhere.\nYou would not find a living animal or unpicked edible berry or mushroom for a mile around the village by now.\n", "\nI try to help them with what I can, but it's not much.\nI perform surgery on occasion, used the medicine I brought from the city, some local herbs.\nBut villagers rarely ask me for help. They don't trust the \"outsider\" and I can't blame them. \nThese days outsider is too often a brigand, a thief or a rapist. People kill each other for a loaf of bread.\nFear, despair and hate are diseases that flood the land. Diseases that are way more fatal than Strangling.\nAnd, unlike Strangling, they are definitely contagious. Sadly, ailness of spirirt are not my major. \nLet's hope I am at least qualified to cure the bodies.\n", "\nI have even heard a rumors about cannibalism. Only rumors yet. \nAt least I know for sure that locals bury their dead properly. I know it, because I wanted to do some autopsy.\nBut the Elder forbid me to even rise the question. \nAnd he is right, some people see me as a \"witch\" already, I don't want to add any more to my \"spookiness\".\nI'm really afraid, you know. Life values so little here, mine included. Villagers tolerate me so far, but fear or desperation \ncan push them over the edge any moment. And instead of as \"weird woman in the forest hut\" they'll see me as a witch that that spoils their crops. \nOr a food. I'd leave already, but travelling to capital is even more dangerous now than staying. And I still hope to find something about the disease.\n", "\nWell, yes, about the \"Forest Cough\". Giving the leads I have, I naturally suspect that something in the forest causes the disease.\nThough it's hard to find which \"something\". It can be animal, insect, maybe even plant? Or some microscopic organism. \nI keep looking for it, but nothing of note so far.\nBut I have found something else - this kid that I send this letter with. \nHe was lying on the outskirts of village, beaten half to death. \nGiven that I have never seen him there before, he is probably some refugee or deserter that was either a victim of robbery, \nor a robber beaten by his would-be victims. Given that he would not want to talk about this, probably latter.\nAs you can guess, I patched him up and was hiding him for couple of weeks until he recovered. \nThen I figured it's a chance to pass you a letter. Hopefully he will not ditch it the moment he leaves my sight.\nI said him you can give him some work, so please consider it. He seems to be bright enough. I have caught him once reading my medical notes, \nso he can read. I considered leaving with him, but I do not trust him enough yet.\n"
        ],
        ending_denial: "\nIt's her! She smiles at me.\n<div class=\"she\">\nOh, you have picked the flowers! How nice of you. I have a good news. \nDo you remember me dreaming of finding a way to cure evil in people? I have found it!\nIt's these very flowers fragrance. It works slow, but inhaling it for a long time will destroy the evil in people completely!\nWould you please plant them around the village for me? \n</div>\n<div class=\"ending-type\">Ending 1/5: Denial.</div>\n",
        ending_anger: "\nOf cause, she is not here. Who would survive after losing so much blood. Who killed her? Villagers? Looters? Does it matter?\nShe is not in this world anymore. All that remained of her is a huge, painful hole in my soul.\nWhy is it there? Why do I miss her so much? I have lived for many years without knowing of her existance, why do I need her so much now?\nOr maybe, I always missed her, just did not know it. And because of that I was always in pain so big, I only could manage by throwing it at others.\n<br/><br/>\nWould explain a lot, wouldn't it?\n<div class=\"ending-type\">Ending 2/5: Anger.</div>\n",
        ending_bargain: "\n<div class=\"you\">You are dead, aren't you?</div>\n\n<div class=\"she\">My body is, looks like.</div>\n\n<div class=\"you\">Your body? Is there anything else? I'm not religious. And even if I were, your soul is not here anymore. God has stolen it from me.</div>\n\n<div class=\"she\">But there are still things I have done. People I have healed. Memories of me. \nMemories of us are what makes us us, aren't they? Even if my body can't hold memories of me anymore, yours can.</div>\n\n<div class=\"you\">You want to say that memories of you will make me you?</div>\n\n<div class=\"she\">Ha ha, yes, to an extent. Do you not want it?</div>\n\n<div class=\"you\">Beats being me, I guess. Do you think I can manage? Be as smart, caring and selfless like you? \nKeep helping people, even though they can kill me for that? I'll never fill the hole you left in the world. Or the hole you have left in my heart.</div>\n\n<div class=\"she\">Not all the way. But maybe a bit. Will you do it?</div>\n\n<div class=\"ending-type\">Ending 3/5: Bargain.</div>\n",
        ending_depression: "\nOf cause, she is not here. This blood must be hers. The stash with her books and research is all here. She would not leave without it.\nLooks like her fears did materialise. \n<br/><br/>\nLooking through her notes, I have found a theory about Strangling's cause. She thinks it's all these flowers I have collected. \nThey cause an allergy that slowly, by steadily makes people's lungs unusable. \nGood thing is these flowers are quite picky about their environment. They grow only in dark dump places, and do not spread too much.\nSo it would not be difficult to weed them out around settlements. \nI'll show this to doctors in city. Maybe this time I will even find the one she has sent the letter to.\n<div class=\"ending-type\">Ending 4/5: Depression/Acceptance.</div>\n",
        ending_true: "\nA mons... person that I have recognized as the village's Elder approaches me.\n\n<div class=\"elder\">\nSo, you are that kid with crazy eyes lurking in the forest I keep hearing about.\nAre you looking for the healer woman? She is not living there anymore. \nSome brigand tried to rob her and slashed her with a knife when she cried out. We came to help, but she has lost a lot of blood.\nMy wife is looking after her at our house until she gets better.  I can take you to her.\n</div>\n\nI don't trust him. But.. Maybe it's true? Would make sense. Such a simple explanation. Probably I should have not assume she is dead so soon.\nI came with the Elder and then...\n\nIt's her! Very pale, but alive. She smiles at me weakly. \n\n<div class=\"she\">Ah... God! I turned out to be such a damsel in distress.</div>\n<div class=\"ending-type\">Ending 5/5: Sometimes You Get Lucky.</div>\n"
    };

    var lang$1 = {
        lang: "Русский",
        guide: "\n<span style=\"color:lightgrey\">\n\u041B\u041A\u041C - \u0434\u0432\u0438\u0436\u0435\u043D\u0438\u0435 \u0438\u043B\u0438 \u043E\u0441\u0442\u0430\u043D\u043E\u0432\u043A\u0430<br/>\n\u041B\u041A\u041C \u043D\u0430 \u0441\u0435\u0431\u044F - \u0436\u0434\u0430\u0442\u044C<br/>\nNUMPAD - \u0434\u0432\u0438\u0436\u0435\u043D\u0438\u0435<br/>\nNum5, \u043F\u0440\u043E\u0431\u0435\u043B - \u0436\u0434\u0430\u0442\u044C<br/>\nShift + 1-9: \u0441\u043E\u0445\u0440\u0430\u043D\u0435\u043D\u0438\u0435<br/>\n1-9: \u0437\u0430\u0433\u0440\u0443\u0437\u043A\u0430<br/>\nShift + R: \u043D\u0430\u0447\u0430\u0442\u044C \u0437\u0430\u043D\u043E\u0432\u043E<br/>\nShift + L: \u043F\u0435\u0440\u0435\u043A\u043B\u044E\u0447\u0438\u0442\u044C \u044F\u0437\u044B\u043A<br/>\nESC: \u043C\u0435\u043D\u044E<br/>\n</span>\n",
        save: "Сохранить",
        load: "Загрузить",
        new_game: "Новая Игра",
        continue: "Продолжить",
        saved_to: "Сохранено в {0}",
        loaded_from: "Загружено из {0}",
        no_save_in: "Нет сохранения в {0}",
        me: "Это я. Обыкновенный ничем не примечательный человек.",
        flower: "Цветок. Его вид меня успокаивает.<br/> <span class='important'>Я выкопаю его для неё.</span>",
        flower_first: "\u041E\u0434\u0438\u043D \u0438\u0437 \u044D\u0442\u0438\u0445 \u0441\u0442\u0440\u0430\u043D\u043D\u044B\u0445 \u043A\u0440\u0430\u0441\u043D\u044B\u0445 \u0446\u0432\u0435\u0442\u043A\u043E\u0432 <em>\u2698</em>, \u043A\u043E\u0442\u043E\u0440\u044B\u0435 \u0435\u0439 \u043D\u0440\u0430\u0432\u044F\u0442\u0441\u044F. <span class='important'>\u042F \u0441\u043E\u0431\u0435\u0440\u0443 \u043D\u0435\u0441\u043A\u043E\u043B\u044C\u043A\u043E \u0448\u0442\u0443\u043A \u0434\u043B\u044F \u043D\u0435\u0451.</span> \n\u041E\u043D\u0430 \u043F\u0440\u043E\u0441\u0438\u043B\u0430 \u043D\u0435 \u043F\u043E\u0432\u0440\u0435\u0434\u0438\u0442\u044C \u043A\u043E\u0440\u043D\u0438.",
        flower_mob_first: "<em>Как он ☺ смеет приближаться к цветку ⚘ !</em>",
        collected: "Я аккуратно выкопал цветок <em>⚘</em> {0}",
        collected_all: "Я собрал достатончо цветов. но её нет и следа. <span class='important'>может, она уже дома? Пойду проверю.</span>",
        collected_even: "Четное число цыетов не принято дарить живым людям. Надеюсь, она не суеверная.",
        tree: "Дремучий лес.",
        exit: "Тропинка к деревне.",
        entrance: "Путь обратно на тракт.",
        blood: "Лужа крови. Откуда она тут?",
        blood_old: "Похоже на засохнувшую кровь. Странно",
        blood_trail: "Кровавый след. Довольно старый",
        wall: "Старая, но крепкая избушка. Она живет тут.",
        mob: "Чудовище",
        mob_2: "Ловкое чудовище. Требуется спокойствие и расчет.",
        mob_3: "Сильный монстр. Надо бить его изо всех сил.",
        mob_4: "Старейшина.",
        mob_first_0: "Одно из чудовищ <span style='background:darkred;font-weight:bold;'>☺</span>, наводнивших эти леса. В одиночку не особо опасно.",
        mob_first_2: "Ловкая тварь. Я должен быть очень осторожным и <span class='important'>сдерживать мою ярость</span>, когда дерусь с ним.",
        mob_first_3: "Огромный монстр. У него тослстая шкура, но я смогу пробить ее, если <span class='important'>вложу в атаку всю мою ярость.</span>.",
        mob_first_4: "\u042D\u0442\u043E... \u0432\u0435\u0434\u044C \u0447\u0443\u0434\u043E\u0432\u0438\u0449\u0435, \u0434\u0430? \u041C\u043D\u0435 \u043A\u0430\u0436\u0435\u0442\u0441\u044F, \u044F \u0432\u0438\u0434\u0435\u043B \u044D\u0442\u043E... \u0435\u0433\u043E... \u0440\u0430\u043D\u044C\u0448\u0435. \u041A\u0430\u0436\u0435\u0442\u0441\u044F, \u0435\u0433\u043E \u043D\u0430\u0437\u044B\u0432\u0430\u043B\u0438 \u0421\u0442\u0430\u0440\u0435\u0439\u0448\u0438\u043D\u043E\u0439. \n\u041F\u043E\u0445\u043E\u0436\u0435, \u043E\u043D\u043E... \u043E\u043D \u043F\u044B\u0442\u0430\u0435\u0442\u0441\u044F \u043C\u043D\u0435 \u0447\u0442\u043E-\u0442\u043E \u0441\u043A\u0430\u0437\u0430\u0442\u044C. \u041C\u043E\u0433\u0443 \u043B\u0438 \u044F \u0435\u043C\u0443 \u0434\u043E\u0432\u0435\u0440\u044F\u0442\u044C?",
        smell: "Пахучий шлейф.",
        smell_first: "\u042D\u0442\u0438 \u0442\u0432\u0430\u0440\u0438 \u043F\u0430\u0445\u043D\u0443\u0442\n<span style='background:#a00'>&nbsp;</span><span style='background:#800'>&nbsp;</span><span style='background:#600'>&nbsp;</span><span style='background:#400'>&nbsp;</span>\n\u043E\u0442\u0432\u0440\u0430\u0442\u0438\u0442\u0435\u043B\u044C\u043D\u043E. \u042F \u043C\u043E\u0433\u0443 \u0443\u043D\u044E\u0445\u0430\u0442\u044C \u0432\u043E\u043D\u044E\u0447\u0438\u0439 \u0448\u043B\u0435\u0439\u0444 \u0438\u0437\u0434\u0430\u043B\u0435\u043A\u0430.",
        calm: "Немного отдохнув, я успокоился и огляделся.",
        rage: "<span style='color:darkred'>Вид и даже запах этих тварей вызывают во мне ярость.</span>",
        rage_more: "<em>Я взбешен. В любой моент могу сорваться.</em>",
        seeing_red: "<em>ААААААА!</em>",
        seeing_red_end: "Что этоб было?",
        death: "<em>Чпок.</em>",
        elder_angry: "Вот он <em>e</em>. Тот, кого я больше всех ненавижу. И кого мне не победить. Остается только бежать.",
        elder_lose: "Бой с древним монстром окончился не успев начаться. Он несравнимо лучший боец, чем я.",
        blue_victory: "Я аккуратно увернулся от его атаки и нанес точный удар.",
        blue_lose: "Я бросился на него, но напоролся на молниеносный укол.",
        red_victory: "Чудовище ошеломлено моими яростными атаками.",
        red_lose: "Мои удары слишком слабы против него. А его собственный мощный удар вминает меня в землю.",
        lose: "<span class='important'>Я падаю и у же не подымаюсь.<br/><br/>ИГРА ОКОНЧЕНА</span><br/><br/>Нажмите Escape для продолжения.",
        not_here: "Её тут нет. Наверное, опять где-то в лесу собирает цветы. <span class='important'>Пойду поищу её.</span>",
        mob_wary: "Оно смотрит на меня с подозрением.",
        mob_afraid: "Оно дрожит от страха.",
        mob_fleeing: "Оно удирает, визжа от ужаса.",
        mob_startled: "☺ избегает меня.",
        mob_flees: "☺ убегает.",
        game_complete: "ИГРА ОКОНЧЕНА",
        grave: "Свежая могила.",
        escaped: "Чудовище сбежало. Уровень паники: {0}",
        read_letter: [
            "Её все не видно. О, уменя ведь осталось её письмо. Может быть, из него я что-то пойму? Я начинаю чтение:",
            "Я продолжил читать письмо:",
            "Я её все еще не нашёл. Может, она в деревне? Продолжу читать письмо:",
            "Дочитываю письмо:"
        ],
        close_letter: [
            "Перед глазами плывет. Продолжу читьать потом.",
            "Опять она вилософствует? Никогда этого не понимал. Лучше вернусь к поискам.",
            "Мне больно  это читать. Закончу потом.",
            "Это всё. Я смотрю на письмо в задумчивости. если бы она только знала... "
        ],
        letter: [
            "\n\u041F\u043E\u0441\u044B\u043B\u0430\u044E \u0442\u0435\u0431\u0435 \u044D\u0442\u043E \u043F\u0438\u0441\u044C\u043C\u043E \u0441 \u043E\u043A\u0430\u0437\u0438\u0435\u0439. \u041E\u0431 \"\u043E\u043A\u0430\u0437\u0438\u0438\" \u0440\u0430\u0441\u043A\u0430\u0436\u0443 \u043F\u043E\u0434\u0440\u043E\u0431\u043D\u0435\u0435 \u043F\u043E\u0442\u043E\u043C.\n\n\u042F \u0432 \u043F\u043E\u0440\u044F\u0434\u043A\u0435, \u0431\u043E\u043B\u0435\u0435 \u0438\u043B\u0438 \u043C\u0435\u043D\u0435\u0435, \u043D\u0430\u0434\u0435\u044E\u0441\u044C, \u0442\u044B \u0442\u043E\u0436\u0435. \u0411\u044B\u043B\u0438 \u043D\u0435\u043A\u043E\u0442\u043E\u0440\u044B\u0435 \u043F\u043E\u0434\u0432\u0438\u0436\u043A\u0438 \u0432 \u043C\u043E\u0435\u043C \u0438\u0441\u0441\u043B\u0435\u0434\u043E\u0432\u0430\u043D\u0438\u0438.\n\u042F \u043F\u043E\u043A\u0430 \u0442\u0430\u043A \u0438 \u043D\u0435 \u043D\u0430\u0448\u043B\u0430 \u043C\u0435\u0442\u043E\u0434 \u043B\u0435\u0447\u0435\u043D\u0438\u044F, \u0438\u043B\u0438 \u0434\u0430\u0436\u0435 \u043F\u0440\u0438\u0447\u0438\u043D\u0443 \u0431\u043E\u043B\u0435\u0437\u043D\u0438. \u041D\u043E \u043F\u043E\u044F\u0432\u0438\u043B\u0438\u0441\u044C \u043A\u043E\u0435-\u043A\u0430\u043A\u0438\u0435 \u0437\u0430\u0446\u0435\u043F\u043A\u0438.\n\u0423 \u043C\u0435\u0441\u0442\u043D\u044B\u0445 \u0435\u0441\u0442\u044C \u043E\u0441\u043E\u0431\u043E\u0435 \u043D\u0430\u0437\u0432\u0430\u043D\u0438\u0435 \u0434\u043B\u044F \u044D\u0442\u043E\u0439 \u0431\u043E\u043B\u0435\u0437\u043D\u0438 - \u041B\u0435\u0441\u043D\u043E\u0439 \u041A\u0430\u0448\u0435\u043B\u044C. \u0418, \u0434\u0435\u0439\u0441\u0442\u0432\u0438\u0442\u0435\u043B\u044C\u043D\u043E, \u0447\u0430\u0449\u0435 \u0432\u0441\u0435\u0433\u043E \n\u043E\u043D\u043E \u0432\u0441\u0442\u0440\u0435\u0447\u0430\u0435\u0442\u0441\u044F \u0443 \u0442\u0435\u0445, \u043A\u0442\u043E \u0447\u0430\u0441\u0442\u043E \u0431\u044B\u0432\u0430\u0435\u0442 \u0432 \u043B\u0435\u0441\u0443. \u0422.\u0435. \u0443 \u0431\u043E\u043B\u044C\u0448\u0438\u043D\u0441\u0442\u0432\u0430 \u0436\u0438\u0442\u0435\u043B\u0435\u0439 \u0434\u0435\u0440\u0435\u0432\u043D\u0438. \n\u0423 \u043D\u0438\u0445 \u0431\u044B\u043B \u043F\u043B\u043E\u0445\u043E\u0439 \u0443\u0440\u043E\u0436\u0430\u0439, \u043A \u0442\u043E\u043C\u0443 \u0436\u0435 \u0447\u0430\u0441\u0442\u044C \u0438\u0437 \u043D\u0438\u0433\u043E \u0431\u044B\u043B\u043E \u0440\u0430\u0441\u0442\u0430\u0449\u0435\u043D\u043E. \u0422\u0430\u043A \u0447\u0442\u043E \u043E\u043D\u0438 \u0438\u0449\u0443\u0442 \u0435\u0434\u0443 \u0433\u0434\u0435 \u043C\u043E\u0433\u0443\u0442.\n\u041D\u0430 \u0440\u0430\u0441\u0441\u0442\u043E\u044F\u043D\u0438\u0438 \u043C\u0438\u043B\u0438 \u0432\u043E\u043A\u0440\u0443\u0433 \u0434\u0435\u0440\u0435\u0432\u043D\u0438 \u0443\u0436\u0435 \u043D\u0435 \u043D\u0430\u0439\u0442\u0438 \u043D\u0438 \u0436\u0438\u0432\u043E\u0442\u043D\u043E\u0433\u043E, \u043D\u0438 \u043D\u0435\u0441\u043E\u0431\u0440\u0430\u043D\u043D\u043E\u0433\u043E \u0433\u0440\u0438\u0431\u0430 \u0438\u043B\u0438 \u044F\u0433\u043E\u0434\u044B.\n", "\n\u042F \u043F\u043E\u043C\u043E\u0433\u0443\u044E \u0438\u043C \u0447\u0435\u043C \u043C\u043E\u0433\u0443, \u043D\u043E \u043F\u043E\u043B\u0443\u0447\u0430\u0435\u0442\u0441\u044F \u043D\u0435 \u0442\u0430\u043A \u043C\u043D\u043E\u0433\u043E. \u041C\u043D\u0435 \u043F\u0440\u0438\u0445\u043E\u0434\u0438\u043B\u043E\u0441\u044C \u0442\u0443\u0442 \u043E\u043F\u0435\u0440\u0438\u0440\u043E\u0432\u0430\u0442\u044C, \u043F\u0440\u0438\u043C\u0435\u043D\u044F\u0442\u044C \u043B\u0435\u043A\u0430\u0440\u0441\u0442\u0432\u0430,\n\u043A\u043E\u0442\u043E\u0440\u044B\u0435 \u044F \u043F\u0440\u0438\u0432\u0435\u0437\u043B\u0430 \u0441 \u0441\u043E\u0431\u043E\u0439 \u0438\u0437 \u0433\u043E\u0440\u043E\u0434\u0430, \u043A\u043E\u0435-\u0447\u0442\u043E \u0443\u0434\u0430\u043B\u043E\u0441\u044C \u0438\u0441\u043F\u043E\u043B\u044C\u0437\u043E\u0432\u0430\u0442\u044C \u0438\u0437 \u043C\u0435\u0441\u0442\u043D\u044B\u0445 \u0442\u0440\u0430\u0432.\n\u041D\u043E \u043E \u043F\u043E\u043C\u043E\u0449\u0438 \u043F\u0440\u043E\u0441\u044F\u0442 \u0440\u0435\u0434\u043A\u043E. \u041E\u043D\u0438 \u043D\u0435 \u0434\u043E\u0432\u0435\u0440\u044F\u044E \"\u0447\u0443\u0436\u0430\u043A\u0430\u043C\" \u0438 \u044F \u0438\u0445 \u043D\u0435 \u0432\u0438\u043D\u044E.\n\u0412 \u043D\u0430\u0448\u0435 \u0432\u0440\u0435\u043C\u044F \u0447\u0443\u0436\u0430\u043A - \u044D\u0442\u043E \u0441\u043B\u0438\u0448\u043A\u043E\u043C \u0447\u0430\u0441\u0442\u043E \u0432\u043E\u0440, \u0433\u0440\u0430\u0431\u0438\u0442\u0435\u043B\u044C \u0438\u043B\u0438 \u043D\u0430\u0441\u0438\u043B\u044C\u043D\u0438\u043A. \u041B\u044E\u0434\u0438 \u0443\u0431\u0438\u0432\u0430\u044E\u0442 \u0434\u0440\u0443\u0433 \u0434\u0440\u0443\u0433\u0430 \u0437\u0430 \u0431\u0443\u0445\u0430\u043D\u043A\u0443 \u0445\u043B\u0435\u0431\u0430.\n\u041B\u044E\u0434\u0438 \u0437\u0430\u0440\u0430\u0436\u0435\u043D\u044B \u0441\u0442\u0440\u0430\u0445\u043E\u043C, \u043E\u0442\u0447\u0430\u044F\u043D\u0438\u0435\u043C \u0438 \u0437\u043B\u043E\u0431\u043E\u0439. \u0411\u043E\u043B\u0435\u0437\u043D\u044F\u043C\u0438 \u0431\u043E\u043B\u0435\u0435 \u0441\u043C\u0435\u0440\u0442\u0435\u043B\u044C\u043D\u044B\u043C\u0438 \u0438 \u0437\u0430\u0440\u0430\u0437\u043D\u044B\u043C\u0438 \u0447\u0435\u043C \u043B\u044E\u0431\u0430\u044F \u0438\u0437 \u0442\u0435\u0445, \u0447\u0442\u043E \u043C\u044B \u043B\u0435\u0447\u0438\u043C.\n\u0416\u0430\u043B\u044C, \u0447\u0442\u043E \u0431\u043E\u043B\u0435\u0437\u043D\u0438 \u0434\u0443\u0445\u0430 \u044F \u043D\u0435 \u043F\u0440\u043E\u0445\u043E\u0434\u0438\u043B\u0430. \u0422\u0430\u043A \u0447\u0442\u043E \u043E\u0441\u0442\u0430\u0435\u0442\u0441\u044F \u0441\u043E\u0441\u0440\u0435\u0434\u043E\u0442\u043E\u0447\u0438\u0442\u0441\u044F \u043D\u0430 \u043B\u0435\u0447\u0435\u043D\u0438\u0438 \u0442\u0435\u043B.\n", "\n\u0414\u043E \u043C\u0435\u043D\u044F \u0434\u0430\u0436\u0435 \u0434\u043E\u0445\u043E\u0434\u0438\u043B\u0438 \u0441\u043B\u0443\u0445\u0438 \u043E \u043A\u0430\u043D\u043D\u0438\u0431\u0430\u043B\u0438\u0437\u043C\u0435. \u041F\u043E\u043A\u0430 \u0442\u043E\u043B\u044C\u043A\u043E \u0441\u043B\u0443\u0445\u0438.\n\u041F\u043E \u043A\u0440\u0430\u0439\u043D\u0435\u0439 \u043C\u0435\u0440\u0435, \u044F \u0437\u043D\u0430\u044E, \u0447\u0442\u043E \u043C\u0435\u0441\u0442\u044B\u0435 \u0441\u0432\u043E\u0438\u0445 \u043C\u0435\u0440\u0442\u0432\u044B\u0445 \u0445\u043E\u0440\u043E\u043D\u044F\u0442 \u043A\u0430\u043A \u0441\u043B\u0435\u0434\u0443\u0435\u0442. \u041C\u043D\u0435 \u0434\u0430\u0436\u0435 \u043D\u0435 \u0440\u0430\u0437\u0440\u0435\u0448\u0438\u043B\u0438 \u0441\u0434\u0435\u043B\u0430\u0442\u044C \u0430\u0443\u0442\u043E\u043F\u0441\u0438\u044E.\n\u0421\u0442\u0430\u0440\u043E\u0441\u0442\u0430 \u0437\u0430\u043F\u0440\u0435\u0442\u0438\u043B \u0434\u0430\u0436\u0435 \u0434\u0443\u043C\u0430\u0442\u044C \u043E\u0431 \u044D\u0442\u043E\u043C. \u0418 \u043E \u043D \u043F\u0440\u0430\u0432, \u043C\u0435\u043D\u044F \u0438 \u0442\u0430\u043A \u043A\u043E\u0435-\u043A\u0442\u043E \u0442\u0443\u0442 \u043D\u0430\u0437\u044B\u0432\u0430\u0435\u0442 \"\u0432\u0435\u0434\u044C\u043C\u043E\u0439\".\n\u0417\u041D\u0430\u0435\u0448\u044C, \u043C\u043D\u0435 \u0434\u0435\u0439\u0441\u0442\u0432\u0438\u0442\u0435\u043B\u044C\u043D\u043E \u0441\u0442\u0440\u0430\u0448\u043D\u043E. \u0416\u0438\u0437\u043D\u044C \u0437\u0434\u0435\u0441\u044C \u0446\u0435\u043D\u0438\u0442\u044C\u0441\u044F \u0442\u0430\u043A \u043C\u0430\u043B\u043E. \u0418 \u043C\u043E\u044F \u0432 \u0442\u043E\u043C \u0447\u0438\u0441\u043B\u0435.\n\u041A\u0440\u0435\u0441\u0442\u044C\u044F\u043D\u0435 \u043C\u0435\u043D\u044F \u0442\u0435\u0440\u043F\u044F\u0442, \u043D\u043E \u043A\u0442\u043E \u0437\u043D\u0430\u0435\u0442, \u043A \u0447\u0435\u043C\u0443 \u0438\u0445 \u043C\u043E\u0436\u0435\u0442 \u043F\u0440\u0438\u0432\u0435\u0441\u0442\u0438 \u0441\u0442\u0440\u0430\u0445 \u0438\u043B\u0438 \u043E\u0442\u0447\u0430\u044F\u043D\u0438\u0435.\n\u0418 \u0432\u043C\u0435\u0441\u0442\u043E \"\u0441\u0442\u0440\u0430\u043D\u043D\u043E\u0439 \u0442\u0435\u0442\u043A\u0438 \u0432 \u043B\u0435\u0441\u0443\" \u043E\u043D\u0438 \u0434\u0435\u0439\u0441\u0442\u0432\u0438\u0442\u0435\u043B\u044C\u043D\u043E \u043C\u043E\u0433\u0443\u0442 \u043F\u043E\u0441\u0447\u0438\u0442\u0430\u0442\u044C \u043C\u0435\u043D\u044F \u0432\u0435\u0434\u0431\u043C\u043E\u0439, \u043A\u043E\u0442\u043E\u0440\u0430\u044F \u043F\u043E\u0440\u0442\u0438\u0442 \u043F\u043E\u0441\u0435\u0432\u044B. \u0438\u043B\u0438 \u0435\u0434\u043E\u0439.\n\u042F \u0431\u044B \u0443\u0436\u0435 \u0443\u0435\u0445\u0430\u043B\u0430, \u043D\u043E \u043D\u0430 \u0434\u043E\u0440\u043E\u0433\u0430\u0445 \u0441\u0435\u0439\u0447\u0430\u0441 \u0435\u0449\u0435 \u043E\u043F\u0430\u0441\u043D\u0435\u0435, \u0447\u0435\u043C \u0437\u0434\u0435\u0441\u044C. \u041A \u0442\u043E\u043C\u0443 \u0436\u0435, \u044F \u0432\u0441\u0435 \u0435\u0449\u0435 \u043D\u0430\u0434\u0435\u044E\u0441\u044C \u043D\u0430\u0439\u0442\u0438, \u043A\u0430\u043A \u043B\u0435\u0447\u0438\u0442\u044C \u044D\u0442\u043E \u0431\u043E\u043B\u0435\u0437\u043D\u044C.\n", "\n\u0414\u0430, \u043D\u0430\u0441\u0447\u0435\u0442 \u043D\u0435\u0439. \u0418\u043C\u0445\u043E\u0434\u044F \u0438\u0437 \u0442\u043E\u0433\u043E, \u0447\u0442\u043E \u044F \u0441\u043A\u0430\u0437\u0430\u043B\u0430 \u0432 \u043D\u0430\u0447\u0430\u043B\u0435 \u043F\u0438\u0441\u044C\u043C\u0430, \u043F\u0440\u0438\u0447\u0438\u043D\u0443 \u0431\u043E\u043B\u0435\u0437\u043D\u0438 \u0441\u0442\u043E\u0438\u0442 \u0438\u0441\u043A\u0430\u0442\u044C \u0432 \u043B\u0435\u0441\u0443.\n\u041D\u043E \u0447\u0442\u043E \u0438\u043C\u0435\u043D\u043D\u043E? \u042D\u0442\u043E \u043C\u043E\u0436\u0435\u0442 \u0431\u044B\u0442\u044C \u0436\u0438\u0432\u043E\u0442\u043D\u043E\u0435, \u043D\u0430\u0441\u0435\u043A\u043E\u043C\u043E\u0435, \u043C\u043E\u0436\u0435\u0442 \u0434\u043B\u0430\u0436\u0435 \u0440\u0430\u0441\u0442\u0435\u043D\u0438\u0435. \u0438\u043B\u0438 \u043A\u0430\u043A\u043E\u0439-\u043D\u0438\u0431\u0443\u0434\u044C \u043C\u0438\u043A\u0440\u043E\u0431. \u0425\u043E\u0440\u043E\u0448\u043E, \u0447\u0442\u043E \u044F \u043F\u0440\u0438\u0445\u0432\u0430\u0442\u0438\u043B\u0430 \u043C\u0438\u043A\u0440\u043E\u0441\u043A\u043E\u043F....\n\u041F\u043E\u043A\u0430 \u0447\u0442\u043E \u043D\u0438\u0447\u0435\u0433\u043E \u043D\u0435 \u043D\u0430\u0448\u043B\u0430. \u041D\u0443, \u043A\u0440\u043E\u043C\u0435 \u044D\u0442\u043E\u0433\u043E \u043F\u0430\u0440\u0435\u043D\u044C\u043A\u0430, \u0441 \u043A\u043E\u0442\u043E\u0440\u044B\u043C \u044F \u043F\u043E\u0441\u043B\u0430\u043B\u0430 \u0442\u0435\u0431\u0435 \u043F\u0438\u0441\u044C\u043C\u043E.\n\u041E\u043D \u0432\u0430\u043B\u044F\u043B\u0441\u044F \u043D\u0430 \u043A\u0440\u0430\u044E \u0434\u0435\u0440\u0435\u0432\u043D\u0438, \u0438\u0437\u0431\u0438\u0442\u044B\u0439 \u0434\u043E \u043F\u043E\u043B\u0443\u0441\u043C\u0435\u0440\u0442\u0438.\n\u042F \u0435\u0433\u043E \u0442\u0443\u0442 \u0440\u0430\u043D\u044C\u0448\u0435 \u043D\u0435 \u0432\u0438\u0434\u0435\u043B, \u0442\u0430\u043A \u0447\u0442\u043E \u043E\u043D, \u0432\u0438\u0434\u0438\u043C\u043E, \u043E\u0434\u0438\u043D \u0438\u0437 \u0431\u0440\u043E\u0434\u044F\u0449\u0438\u0445 \u043F\u043E \u043E\u043A\u0440\u0443\u0433\u0435 \u0434\u0435\u0437\u0435\u0440\u0442\u043E\u0432 \u0438\u043B\u0438 \u0431\u0435\u0436\u0435\u043D\u0446\u043E\u0432. \n\u041C\u043E\u0436\u0435\u0442, \u0435\u0433\u043E \u0438\u0437\u0431\u0438\u043B \u0433\u0440\u0430\u0431\u0438\u0442\u0435\u043B\u044C, \u0430 \u043C\u043E\u0436\u0435\u0442, \u043E\u043D \u0441\u0430\u043C \u043F\u043E\u043F\u044B\u0442\u0430\u043B\u0441\u044F \u0447\u0442\u043E-\u0442\u043E \u0443\u043A\u0440\u0430\u0441\u0442\u044C \u0438 \u043F\u043E\u043F\u0430\u043B\u0441\u044F.\n\u0421\u0430\u043C \u043E\u043D \u043D\u0430 \u044D\u0442\u0443 \u0442\u0435\u043C\u0443 \u0433\u043E\u0432\u043E\u0440\u0438\u0442\u044C \u043D\u0435 \u0445\u043E\u0447\u0435\u0442 \u0438 \u0434\u0435\u0440\u0435\u0432\u0435\u043D\u0441\u043A\u0438\u0445 \u0438\u0437\u0431\u0435\u0433\u0430\u0435\u0442, \u0442\u0430\u043A \u0447\u0442\u043E \u0432\u0442\u043E\u0440\u043E\u0435 \u0432\u043F\u043E\u043B\u043D\u0435 \u0432\u0435\u0440\u043E\u044F\u0442\u043D\u043E.\n\u041A\u0430\u043A \u0442\u044B \u0434\u043E\u0433\u0430\u0434\u044B\u0432\u0430\u0435\u0448\u044C\u0441\u044F, \u044F \u0435\u0433\u043E \u0437\u0430\u043B\u0430\u0442\u0430\u043B\u0430 \u0438 \u043F\u0440\u044F\u0442\u0430\u043B\u0430 \u043F\u0430\u0440\u0443 \u043D\u0435\u0434\u0435\u043B\u044C, \u043F\u043E\u043A\u0430 \u043D\u0435 \u043E\u043A\u043B\u0435\u043C\u0430\u043B\u0441\u044F.\n\u0410 \u043F\u043E\u0442\u043E\u043C \u0440\u0435\u0448\u0438\u043B\u0430 \u043F\u043E\u0441\u043B\u0430\u0442\u044C \u0435\u0433\u043E \u043A \u0442\u0435\u0431\u0435 \u0441 \u043F\u0438\u0441\u044C\u043C\u043E\u043C. \u041D\u0430\u0434\u0435\u044E\u0441\u044C, \u043E \u043D \u043D\u0435 \u0432\u044B\u0431\u0440\u043E\u0441\u0438\u0442 \u0435\u0433\u043E \u0437\u0430 \u043F\u0435\u0440\u0432\u044B\u043C \u043F\u043E\u0432\u043E\u0440\u043E\u0442\u043E\u043C.\n\u042F \u0441\u043A\u0430\u0437\u0430\u043B\u0430 \u0435\u043C\u0443, \u0447\u0442\u043E \u0443 \u0442\u0435\u0431\u044F \u043C\u043E\u0436\u0435\u0442 \u0431\u044B\u0442\u044C \u0434\u043B\u044F \u043D\u0435\u0433\u043E \u0440\u0430\u0431\u043E\u0442\u0430, \u0442\u0430\u043A \u0447\u0442\u043E \u043F\u043E\u0434\u0443\u043C\u0430\u0439 \u043E\u0431 \u044D\u0442\u043E\u043C. \u0412\u0440\u043E\u0434\u0435, \u043D\u0435\u0433\u043B\u043B\u0443\u043F\u044B\u0439 \u043F\u0430\u0440\u0435\u043D\u044C. \n\u042F \u0434\u0430\u0436\u0435 \u043A\u0430\u043A-\u0442\u043E \u043F\u043E\u0439\u043C\u0430\u043B\u0430 \u0435\u0433\u043E \u0437\u0430 \u0447\u0442\u0435\u043D\u0438\u0435\u043C \u043C\u043E\u0438\u0445 \u0437\u0430\u043F\u0438\u0441\u0435\u0439, \u0442\u0430\u043A \u0447\u0442\u043E \u0447\u0438\u0442\u0430\u0442\u044C \u043E\u043D \u0443\u043C\u0435\u0435\u0442.\n\u041C\u043E\u0436\u0435\u0442, \u044F \u0431\u044B \u0438 \u0441\u0430\u043C\u0430 \u0441 \u043D\u0438\u043C \u043E\u0442\u043F\u0440\u0430\u0432\u0438\u043B\u043E\u0441\u044C, \u043D\u043E \u044F \u0432\u0441\u0435-\u0442\u0430\u043A\u0438 \u043D\u0435 \u043D\u0430\u0441\u0442\u043E\u043B\u044C\u043A\u043E \u0435\u043C\u0443 \u0434\u043E\u0432\u0435\u0440\u044F\u044E.\n"
        ],
        ending_denial: "\n\u042D\u0442\u043E \u043E\u043D\u0430! \u0421\u043C\u043E\u0442\u0440\u0438\u0442 \u043D\u0430 \u043C\u0435\u043D\u044F \u0441 \u0443\u043B\u044B\u0431\u043A\u043E\u0439.\n<div class=\"she\">\n\u041E, \u0442\u044B \u0441\u043E\u0431\u0440\u0430\u043B \u0446\u0432\u0435\u0442\u044B! \u041A\u0430\u043A \u043C\u0438\u043B\u043E. \u0410 \u0443 \u043C\u0435\u043D\u044F \u0445\u043E\u0440\u043E\u0448\u0438\u0435 \u043D\u043E\u0432\u043E\u0441\u0442\u0438.\n\u041F\u043E\u043C\u043D\u0438\u0448\u044C, \u044F \u043C\u0435\u0447\u0442\u0430\u043B\u0430 \u043E \u0442\u043E\u043C, \u0447\u0442\u043E\u0431\u044B \u043D\u0430\u0439\u0442\u0438 \u043B\u0435\u043A\u0430\u0440\u0441\u0442\u0432\u043E \u043E\u0442 \u0437\u043B\u0430? \u042F \u0435\u0433\u043E \u043D\u0430\u0448\u043B\u0430!\n\u042D\u0442\u043E \u0437\u0430\u043F\u0430\u0445 \u044D\u0442\u0438\u0445 \u0446\u0432\u0435\u0442\u043E\u0432! \u041E\u043D \u0434\u0435\u0439\u0441\u0442\u0432\u0443\u0435\u0442 \u043C\u0435\u0434\u043B\u0435\u043D\u043D\u043E, \u043D\u043E \u0435\u0441\u043B\u0438 \u0434\u043E\u043B\u0433\u043E \u0435\u0433\u043E \u0432\u0434\u044B\u0445\u0430\u0442\u044C, \u0442\u043E \u043E\u043D \u043F\u043E\u043B\u043D\u043E\u0441\u0442\u044C\u044E \u0443\u043D\u0438\u0447\u0442\u043E\u0436\u0438\u0442 \u0437\u043B\u043E \u0432 \u043B\u044E\u0431\u043E\u043C \u0447\u0435\u043B\u043E\u0432\u0435\u043A\u0435!\n\u041D\u0435 \u043C\u043E\u0433 \u0431\u044B \u0442\u044B \u043F\u043E\u0441\u0430\u0434\u0438\u0442\u044C \u044D\u0442\u0438 \u0446\u0432\u0435\u0442\u044B \u0432\u043E\u043A\u0440\u0443\u0433 \u0434\u0435\u0440\u0435\u0432\u043D\u0438?\n</div>\n<div class=\"ending-type\">\u041E\u043A\u043E\u043D\u0447\u0430\u043D\u0438\u0435 1/5: \u041E\u0442\u0440\u0438\u0446\u0430\u043D\u0438\u0435.</div>\n",
        ending_anger: "\n\u0420\u0430\u0437\u0443\u043C\u0435\u0435\u0442\u0441\u044F, \u0435\u0451 \u0442\u0443\u0442 \u043D\u0435\u0442. \u041A\u0442\u043E \u0432\u044B\u0436\u0438\u0432\u0435\u0442 \u043F\u043E\u0441\u043B\u0435 \u043F\u043E\u0442\u0435\u0440\u0438 \u0442\u0430\u043A\u043E\u0433\u043E \u043A\u043E\u043B\u0438\u0447\u0435\u0441\u0442\u0432\u0430 \u043A\u0440\u043E\u0432\u0438?\n\u041A\u0442\u043E \u0443\u0431\u0438\u043B \u0435\u0435? \u0414\u0435\u0440\u0435\u0432\u0435\u043D\u0441\u043A\u0438\u0435? \u0413\u0440\u0432\u0431\u0438\u0442\u0435\u043B\u0438? \u041A\u0430\u043A\u0430\u044F \u0440\u0430\u0437\u043D\u0438\u0446\u0430...\n\u0435\u0451 \u0431\u043E\u043B\u044C\u0448\u0435 \u043D\u0435\u0442. \u0432\u0441\u0435, \u0447\u0442\u043E \u043E\u0441\u0442\u0430\u043B\u043E\u0441\u044C, \u0437\u0438\u044F\u044E\u0449\u0430\u044F \u043F\u0443\u0441\u0442\u043E\u0442\u0430 \u0432 \u043C\u043E\u0435\u0439 \u0434\u0443\u0448\u0435.\n\u041E\u0442\u043A\u0443\u0434\u0430 \u043E\u043D\u0430. \u041F\u043E\u0447\u0435\u043C\u0443 \u043C\u043D\u0435 \u0435\u0451 \u0442\u0430\u043A \u043D\u0435 \u0445\u0432\u0430\u0442\u0430\u0435\u0442? \u042F \u043F\u0440\u043E\u0436\u0438\u043B \u0442\u0430\u043A \u0434\u043E\u043B\u0433\u043E \u043D\u0435 \u0437\u043D\u0430\u044F \u043E \u0435\u0451 \u0441\u0443\u0449\u0435\u0441\u0442\u0432\u043E\u0432\u0430\u043D\u0438\u0438, \u043F\u043E\u0447\u0435\u043C\u0443 \u043E\u043D\u0430 \u0442\u0430\u043A \u043D\u0443\u0436\u043D\u0430 \u043C\u043D\u0435 \u0441\u0435\u0439\u0447\u0430\u0441?\n\u0411\u044B\u0442\u044C \u043C\u043E\u0436\u0435\u0442, \u043E\u043D\u0430 \u0432\u0441\u0435\u0433\u0434\u0430 \u0431\u044B\u043B\u0430 \u043D\u0443\u0436\u043D\u0430 \u043C\u043D\u0435, \u044F \u043F\u0440\u043E\u0441\u0442\u043E \u043D\u0435 \u0437\u043D\u0430\u043B \u044D\u0442\u043E\u0433\u043E. \u0418 \u043E\u0442 \u0442\u043E\u0433\u043E, \u0447\u0442\u043E \u0435\u0451 \u043D\u0435 \u0431\u044B\u043B\u043E \u0441\u043E \u043C\u043D\u043E\u0439,\n\u0431\u043E\u043B\u044C \u0431\u044B\u043B\u0430 \u0442\u0430\u043A\u043E\u0439 \u0441\u0438\u043B\u044C\u043D\u043E\u0439, \u0447\u0442\u043E \u044F \u043C\u043E\u0433 \u0432\u044B\u0434\u0435\u0440\u0436\u0430\u0442\u044C \u0439, \u0442\u043E\u043B\u044C\u043A\u043E \u0432\u044B\u043F\u043B\u0435\u0441\u043A\u0438\u0432\u0430\u044F \u043D\u0430\u0440\u0443\u0436\u0443.\n<br/><br/>\n\u042D\u0442\u043E \u043C\u043D\u043E\u0433\u043E\u0435 \u043E\u0431\u044A\u044F\u0441\u043D\u044F\u0435\u0442...\n<div class=\"ending-type\">\u041E\u043A\u043E\u043D\u0447\u0430\u043D\u0438\u0435 2/5: \u0413\u043D\u0435\u0432.</div>\n",
        ending_bargain: "\n<div class=\"you\">\u0422\u044B \u043C\u0435\u0440\u0442\u0432\u0430, \u0442\u0430\u043A?</div>\n\n<div class=\"she\">\u041C\u043E\u0451 \u0442\u0435\u043B\u043E, \u043F\u043E\u0445\u043E\u0436\u0435, \u0434\u0430.</div>\n\n<div class=\"you\">\u0410 \u0440\u0430\u0437\u0432\u0435 \u0435\u0441\u0442\u044C \u0447\u0442\u043E-\u0442\u043E \u0435\u0449\u0451? \u042F \u043D\u0435 \u0440\u0435\u043B\u0438\u0433\u0438\u043E\u0437\u0435\u043D. \u0418 \u0434\u0430\u0436\u0435 \u0435\u0441\u043B\u0438 \u0431\u044B \u044F \u0432\u0435\u0440\u0438\u043B \u0432 \u0432\u0435\u0447\u043D\u0443\u044E \u0436\u0438\u0445\u043D\u044C, \u0442\u0432\u043E\u0435\u0439 \u0434\u0443\u0448\u0438 \u0442\u043E\u044D\u0435 \u0443\u0436\u0435 \u043D\u0435\u0442 \u0441\u043E \u043C\u043D\u043E\u0439.\n\u0411\u043E\u0433 \u0443\u043A\u0440\u0430\u043B \u0435\u0451.</div>\n\n<div class=\"she\">\u041D\u043E \u0435\u0449\u0435 \u043E\u0441\u0442\u0430\u043B\u0438\u0441\u044C \u0434\u0435\u043B\u0430, \u0447\u0442\u043E \u044F \u0441\u0434\u0435\u043B\u0430\u043B\u0430. \u041B\u044E\u0434\u0438, \u043A\u043E\u0442\u043E\u0440\u044B\u043C \u044F \u043F\u043E\u043C\u043E\u0433\u043B\u0430. \u0412\u043E\u0441\u043F\u043E\u043C\u0438\u043D\u0430\u043D\u0438\u044F \u043E\u0431\u043E \u043C\u043D\u0435.\n\u0412\u043E\u0441\u043F\u043E\u043C\u0438\u043D\u0430\u043D\u0438\u044F - \u044D\u0442\u043E \u0442\u043E, \u0447\u0442\u043E \u0434\u0435\u043B\u0430\u0435\u0442 \u043D\u0430\u0441 \u0442\u0430\u043A\u0438\u043C\u0438, \u043A\u0430\u043A\u0438\u043C\u0438 \u043C\u044B \u0435\u0441\u0442\u044C, \u0442\u0430\u043A \u0432\u0435\u0434\u044C? \u041C\u043E\u0439 \u0442\u0435\u043B\u043E \u043D\u0435 \u043C\u043E\u0436\u0443\u0442 \u0443\u0436\u0435 \u0432\u043C\u0435\u0441\u0442\u0438\u0442\u044C \u0432\u043E\u0441\u043F\u043E\u043C\u0438\u043D\u0430\u043D\u0438\u044F \u043E\u0431\u043E \u043C\u043D\u0435,\n\u043D\u043E \u0442\u0432\u043E\u0451 \u043C\u043E\u0436\u0435\u0442.</div>\n\n<div class=\"you\">\u0422\u044B \u0445\u043E\u0447\u0435\u0448\u044C \u0441\u043A\u0430\u0437\u0430\u0442\u044C, \u0447\u0442\u043E \u0432\u043E\u0441\u043F\u043E\u043C\u0438\u043D\u0430\u043D\u0438\u044F \u043E \u0442\u0435\u0431\u0435 \u0441\u0434\u0435\u043B\u0430\u0442\u044C \u043C\u0435\u043D\u044F \u0442\u043E\u0431\u043E\u0439?</div>\n\n<div class=\"she\">\u0425\u0430 \u0445\u0430, \u0432 \u043A\u0430\u043A\u043E\u0439-\u0442\u043E \u043C\u0435\u0440\u0435. \u0422\u044B \u0445\u043E\u0447\u0435\u0448\u044C \u044D\u0442\u043E\u0433\u043E?</div>\n\n<div class=\"you\">\u041B\u0443\u0447\u0448\u0435, \u0447\u0435\u043C \u0431\u044B\u0442\u044C \u043C\u043D\u043E\u0439, \u043D\u0430\u0432\u0435\u0440\u043D\u043E\u0435. \u0422\u044B \u0434\u0443\u043C\u0430\u0435\u0448\u044C, \u0443 \u043C\u0435\u043D\u044F \u043F\u043E\u043B\u0443\u0447\u0438\u0442\u0441\u044F? \u0411\u044B\u0442\u044C \u0442\u0430\u043A\u0438\u043C \u0436\u0435 \u0443\u043C\u043D\u044B\u043C \u0438 \u0434\u043E\u0431\u0440\u044B\u044B\u043C, \u043A\u0430\u043A \u0442\u044B? \n\u041F\u043E\u043C\u043E\u0433\u0430\u0442\u044C \u043B\u044E\u0434\u044F\u043C, \u0437\u043D\u0430\u044F, \u0447\u0442\u043E \u043E\u043D\u0438 \u043E\u0434\u043D\u0430\u0436\u0434\u044B \u043C\u043E\u0433\u0443\u0442 \u043C\u0435\u043D\u044F \u0437\u0430 \u044D\u0442\u043E \u0443\u0431\u0438\u0442\u044C? \u042F \u043D\u0438\u043A\u043E\u0433\u0434\u0430 \u043D\u0435 \u043C\u0438\u043E\u0433\u0443 \u0437\u0430\u043F\u043E\u043B\u043D\u0438\u0442\u044C \u0434\u044B\u0440\u0443, \u043A\u043E\u0442\u043E\u0440\u0443\u044E \u0442\u044B \u043E\u0441\u0442\u0430\u0432\u0438\u043B\u0430.\n</div>\n\n<div class=\"she\">\u043F\u043E\u043B\u043D\u043E\u0441\u0442\u044C\u044E, \u043D\u0430\u0432\u0435\u0440\u043D\u043E\u0435, \u043D\u0435\u0442. \u041D\u043E \u043C\u043E\u0436\u0435\u0442 \u0431\u044B\u0442\u044C, \u0445\u043E\u0442\u044F \u0431\u044B \u0447\u0430\u0441\u0442\u0438\u0447\u043D\u043E. \u0422\u044B \u0441\u0434\u0435\u043B\u0430\u0435\u0448\u044C \u044D\u0442\u043E?</div>\n\n<div class=\"ending-type\">\u041E\u043A\u043E\u043D\u0447\u0430\u043D\u0438\u0435 3/5: \u0422\u043E\u0440\u0433.</div>\n",
        ending_depression: "\n\u0420\u0430\u0437\u0443\u043C\u0435\u0435\u0442\u0441\u044F, \u0435\u0451 \u0442\u0443\u0442 \u043D\u0435\u0442. \u042D\u0442\u043E \u0435\u0451 \u043A\u0440\u043E\u0432\u044C. \u0418 \u0442\u0430\u0439\u043D\u0438\u043A \u0441 \u043A\u043D\u0438\u0433\u0430\u043C\u0438 \u0438 \u0437\u0430\u043F\u0438\u0441\u044F\u043C\u0438 \u043D\u0435 \u0442\u0440\u043E\u043D\u0443\u0442. \u041E\u043D\u0430 \u043D\u0438\u043A\u043E\u0433\u0434\u0430 \u0431\u044B \u0438\u0445 \u043D\u0435 \u043E\u0441\u0442\u0430\u0432\u0438\u043B\u0430.\n\u041F\u043E\u0445\u043E\u0436\u0435, \u043E\u0434\u0438\u043D \u0438\u0437 \u0435  \u0441\u0442\u0440\u0430\u0445\u043E\u0432 \u0441\u0442\u0430\u043B \u0440\u0435\u0430\u043B\u044C\u043D\u043E\u0441\u0442\u044C\u044E.\n<br/><br/>\n\u041F\u0440\u043E\u0441\u043C\u043E\u0442\u0440\u0435\u0432 \u0435\u0451 \u0437\u0430\u043F\u0438\u0441\u0438, \u044F \u043D\u0430\u0448\u0451\u043B \u0442\u0435\u043E\u0440\u0438\u044E \u043E \u043F\u0440\u0438\u0447\u0438\u043D\u0430\u0445 \u0431\u043E\u043B\u0435\u0437\u043D\u0438. \u041E\u043D\u0430 \u0434\u0443\u043C\u0430\u0435\u0442, \u0447\u0442\u043E \u043E\u043D\u0430 \u0432\u044B\u0437\u0432\u0430\u043D\u0438\u0430 \u043A\u0430\u043A \u0440\u0430\u0437 \u0442\u0435\u043C\u0438 \u0446\u0432\u0435\u0442\u0430\u043C\u0438,\n\u043A\u043E\u0442\u043E\u0440\u044B\u0435 \u044F \u0441\u0435\u0439\u0447\u0430\u0441 \u0441\u043E\u0431\u0438\u0440\u0430\u043B. \u041E\u043D\u0438 \u0432\u044B\u0437\u044B\u0432\u0430\u044E\u0442 \u0430\u043B\u043B\u0435\u0440\u0433\u0438\u044E, \u043A\u043E\u0442\u043E\u0440\u0430\u044F \u043C\u0435\u0434\u043B\u0435\u043D\u043D\u043E, \u043D\u043E \u0432\u0435\u0440\u043D\u043E \u0433\u0443\u0431\u0438\u0442 \u043B\u0451\u0433\u043A\u0438\u0435.\n\u041A \u0441\u0447\u0430\u0441\u0442\u044C\u044E, \u044D\u0442\u0438 \u0446\u0432\u0435\u0442\u044B \u0440\u0430\u0441\u0442\u0443\u0442 \u0434\u0430\u043B\u0435\u043A\u043E \u043D\u0435 \u0432\u0435\u0437\u0434\u0435. \u0438\u043C \u043D\u0443\u0436\u043D\u043E \u0442\u0435\u043C\u043D\u043E\u0435 \u0441\u044B\u0440\u043E\u0435 \u043C\u0435\u0441\u0442\u043E, \u0438 \u043E\u043D\u0438 \u0440\u0430\u0441\u043F\u0440\u043E\u0441\u0442\u0440\u0430\u043D\u044F\u044E\u0442\u0441\u044F \u0434\u043E\u0432\u043E\u043B\u044C\u043D\u043E \u043C\u0435\u0434\u043B\u0435\u043D\u043D\u043E.\n\u0422\u0430\u043A \u0447\u0442\u043E, \u0431\u0443\u0434\u0435\u0442 \u043D\u0435\u0442\u0440\u0443\u0434\u043D\u043E \u0438\u0445 \u0432\u044B\u043F\u043E\u043B\u043E\u0442\u044C. \u041F\u043E\u043A\u0430\u0436\u0443 \u044D\u0442\u043E \u0432\u0440\u0430\u0447\u0430\u043C \u0432 \u0433\u043E\u0440\u043E\u0434\u0435. \u041C\u043E\u0436\u0435\u0442, \u0435\u0449\u0451 \u0440\u0430\u0437 \u043F\u043E\u043F\u0440\u043E\u0431\u043E\u0432\u0430\u0442\u044C \u043D\u0430\u0439\u0442\u0438 \u0442\u043E\u0433\u043E, \u043A\u043E\u0442\u043E\u0440\u043E\u043C\u0443 \u043E\u043D\u0430 \u043E\u0442\u043F\u0440\u0430\u0432\u043B\u044F\u043B\u0430 \u043F\u0438\u0441\u044C\u043C\u043E?\n<div class=\"ending-type\">Ending 4/5: Depression/Acceptance.</div>\n",
        ending_true: "\n\u0427\u0442\u043E-\u0442\u043E... \u043A\u0442\u043E-\u0442\u043E, \u0432 \u043A\u043E\u043C \u044F \u0443\u0437\u043D\u0430\u044E \u0441\u0442\u0430\u0440\u043E\u0441\u0442\u0443 \u0434\u0435\u0440\u0435\u0432\u043D\u0438 \u043F\u043E\u0434\u0445\u043E\u0434\u0438\u0442 \u043A\u043E \u043C\u043D\u0435.\n\n<div class=\"elder\">\n\u041C\u043D\u0435 \u0441\u043A\u0430\u0437\u0430\u043B\u0438 \u0447\u0442\u043E \u043F\u043E \u043B\u0435\u0441\u0443 \u0431\u043F\u0440\u043E\u0434\u0438\u0442 \u043A\u043A\u043E\u0439-\u0442\u043E \u043F\u0430\u0440\u0435\u043D\u0435\u043A \u0441 \u0434\u0438\u043A\u0438\u043C \u0432\u0437\u0433\u043B\u044F\u0434\u043E\u043E\u043C. \u0422\u0430\u043A \u044D\u0442\u043E \u0442\u044B?\n\u0422\u044B, \u043D\u0430\u0432\u0435\u0440\u043D\u043E\u0435, \u0438\u0449\u0435\u0448 \u0442\u0440\u0430\u0432\u043D\u0438\u0446\u0443? \u041E\u043D\u0430 \u0442\u0443\u0442 \u0431\u043E\u043B\u044C\u0448\u0435 \u043D\u0435 \u0436\u0438\u0432\u0435\u0442.\n\u041A\u0430\u043A\u0438\u0439-\u0442\u043E \u0431\u0430\u043D\u0434\u0438\u0442 \u043F\u044B\u0442\u0430\u043B\u0441\u044F \u0435\u0451 \u043E\u0433\u0440\u0430\u0431\u0438\u0442\u044C \u0438 \u0443\u0434\u0430\u0440\u0438\u043B \u0435\u0451 \u043D\u043E\u0436\u043E\u043C, \u043A\u043E\u0433\u0434\u0430 \u043E\u043D\u0430 \u0437\u0430\u043A\u0440\u0438\u0447\u0430\u043B\u0430. \u041C\u044B \u043F\u0440\u0438\u0431\u0435\u0436\u0430\u043B\u0438 \u043D\u0430 \u043F\u043E\u043C\u043E\u0449\u044C, \u043D\u043E \u043E\u043D\u0430 \u0443\u0436\u0435 \u043F\u043E\u0442\u0435\u0440\u044F\u043B\u0430 \u043C\u043D\u043E\u0433\u043E \u043A\u0440\u043E\u0432\u0438.\n\u041E\u043D\u0430 \u0441\u0435\u0439\u0447\u0430\u0441 \u043E\u0442\u043B\u0435\u0436\u0438\u0432\u0430\u0435\u0442\u0441\u044F \u0443 \u043C\u0435\u043D\u044F \u0434\u043E\u043C\u0430. \u042F \u043C\u043E\u0433\u0443 \u043F\u0440\u043E\u0432\u043E\u0434\u0438\u0442\u044C \u0442\u0435\u0431\u044F \u043A \u043D\u0435\u0439.\n</div>\n\n\u042F \u043D\u0435 \u0434\u043E\u0432\u0435\u0440\u044E \u0435\u043C\u0443. \u041D\u043E... \u041C\u043E\u0436\u0435\u0442 \u0431\u044B\u0442\u044C, \u044D\u0442\u043E \u043F\u0440\u0430\u0432\u0434\u0430? \u0417\u0432\u0443\u0447\u0438\u0442 \u043B\u043E\u0433\u0438\u0447\u043D\u043E. \u0422\u0430\u043A\u043E\u0435 \u043F\u0440\u043E\u0441\u0442\u043E\u0435 \u043E\u0431\u044A\u044F\u0441\u043D\u0435\u043D\u0438\u0435. \u041D\u0430\u0432\u0435\u0440\u043D\u043E\u0435, \u044F \u0441\u043B\u0438\u0448\u043A\u043E\u043C \u0447\u0430\u0441\u0442\u043E \u0440\u0435\u0448\u0438\u043B, \u0447\u0442\u043E \u0441\u043B\u0443\u0447\u0438\u043B\u043E\u0441\u044C \u0445\u0443\u0434\u0448\u0435\u0435.\n\u042F \u043F\u043E\u0441\u043B\u0435\u0434\u043E\u0432\u0430\u043B \u0437\u0430 \u0441\u0442\u0430\u0440\u043E\u0441\u0442\u043E\u0439, \u0438 \u043F\u043E\u0442\u043E\u043C...\n\n\u042D\u0442\u043E \u043E\u043D\u0430! \u041E\u0447\u0435\u043D\u044C \u0431\u043B\u0435\u0434\u043D\u0430\u044F, \u043D\u043E \u0436\u0438\u0432\u0430\u044F. \u041E\u043D\u0430 \u0441\u043B\u0430\u0431\u043E \u0443\u043B\u044B\u0431\u0430\u0435\u0442\u0441\u044F \u043C\u043D\u0435.\n\n<div class=\"she\">\u0410\u0445. \u042F, \u043D\u0430\u0432\u0435\u0440\u043D\u043E\u0435, \u0437\u0430\u0441\u0442\u0430\u0432\u043B\u0430 \u0442\u0435\u0431\u044F \u043F\u043E\u0432\u043E\u043B\u043D\u043E\u0432\u0430\u0442\u044C\u0441\u044F.</div>\n<div class=\"ending-type\">\u041E\u043A\u043E\u043D\u0447\u0430\u043D\u0438\u0435 5/5: \u0418\u043D\u043E\u0433\u0434\u0430 \u0447\u0443\u0434\u0435\u0441\u0430 \u0441\u043B\u0443\u0447\u0430\u044E\u0442\u0441\u044F.</div>\n"
    };

    var Keyboard = /** @class */ (function () {
        function Keyboard(element) {
            this.interval = 100;
            this.pressed = {};
            this.subs = [];
            element.addEventListener("keydown", this);
            element.addEventListener("keyup", this);
            element.addEventListener("mousedown", this);
            element.addEventListener("mouseup", this);
        }
        Keyboard.prototype.handleEvent = function (e) {
            var _this = this;
            var code;
            var type;
            if (e instanceof KeyboardEvent) {
                code = e.code;
                type = e.type == "keydown" ? "down" : "up";
            }
            else {
                code = "Click" + e.button;
                type = e.type == "mousedown" ? "down" : "up";
            }
            if (type == "down") {
                if (!(code in this.pressed)) {
                    this.click(code);
                    this.pressed[code] = window.setInterval(function () { return _this.click(code); }, this.interval);
                }
            }
            if (type == "up") {
                window.clearInterval(this.pressed[code]);
                delete this.pressed[code];
            }
        };
        Keyboard.prototype.click = function (code) {
            for (var _i = 0, _a = this.subs; _i < _a.length; _i++) {
                var s = _a[_i];
                s(code);
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
            var f = function (code) {
                _this.unsub(f);
                handler(code);
            };
            this.sub(f);
        };
        Keyboard.prototype.isPressed = function (keyCode) {
            return keyCode in this.pressed;
        };
        Keyboard.prototype.clear = function () {
            this.subs = [];
        };
        return Keyboard;
    }());

    /**
     * Create a `Writable` store that allows both updating and reading by subscription.
     * @param {*=}value initial value
     * @param {StartStopNotifier=}start start and stop notifications for subscriptions
     */
    function writable(value, start = noop) {
        let stop;
        const subscribers = [];
        function set(new_value) {
            if (safe_not_equal(value, new_value)) {
                value = new_value;
                if (!stop) {
                    return; // not ready
                }
                subscribers.forEach((s) => s[1]());
                subscribers.forEach((s) => s[0](value));
            }
        }
        function update(fn) {
            set(fn(value));
        }
        function subscribe(run, invalidate = noop) {
            const subscriber = [run, invalidate];
            subscribers.push(subscriber);
            if (subscribers.length === 1) {
                stop = start(set) || noop;
            }
            run(value);
            return () => {
                const index = subscribers.indexOf(subscriber);
                if (index !== -1) {
                    subscribers.splice(index, 1);
                }
                if (subscribers.length === 0) {
                    stop();
                }
            };
        }
        return { set, update, subscribe };
    }

    const log = writable(0);

    const lang$2 = writable({});

    var game;
    var screenBg = Color.fromString("#180c24");
    var russian = localStorage.russian;
    var lang$3 = updateLanguage();
    var str = __assign({}, lang$3);
    for (var k in str)
        str[k] = k;
    function toggleLanguage() {
        russian = !russian;
        updateLanguage();
    }
    function updateLanguage() {
        localStorage.russian = lang$3;
        lang$3 = russian ? lang$1 : lang;
        for (var i in lang$3.letter) {
            lang$3["complete_letter_" + i] =
                lang$3.read_letter[i] +
                    "<br/>***<br/>" +
                    lang$3.letter[i] +
                    "<br/>***<br/>" +
                    lang$3.close_letter[i];
        }
        lang$2.update(function (_) { return lang$3; });
        return lang$3;
    }
    function distance(a, b) {
        var x = a[0] - b[0];
        var y = a[1] - b[1];
        return Math.sqrt(x * x + y * y);
    }
    var Milestones = /** @class */ (function () {
        function Milestones() {
        }
        Milestones.prototype.serialise = function () {
            var s = {};
            Object.assign(s, this);
            return s;
        };
        Milestones.prototype.deserialise = function (s) {
            Object.assign(this, s);
            return this;
        };
        return Milestones;
    }());
    var Animation = /** @class */ (function () {
        function Animation(at, mode, options) {
            if (mode === void 0) { mode = 1; }
            this.at = at;
            this.mode = mode;
            this.options = options;
            this.run();
        }
        Animation.prototype.run = function () {
            var _this = this;
            var duration = this.options.duration || 1000;
            var interval = this.options.interval || 50;
            var timer = duration;
            var handle = window.setInterval(function () {
                var on;
                timer -= interval;
                switch (_this.mode) {
                    case 1:
                        on = timer % 250 < 150;
                        game.drawAt(_this.at, null, function (_a) {
                            var sym = _a[0], fg = _a[1], bg = _a[2];
                            return [
                                on ? sym : " ",
                                fg,
                                bg
                            ];
                        });
                        break;
                    case 2:
                        on = timer % 400 < 200;
                        game.drawAt(_this.at, null, function (_a) {
                            var sym = _a[0], fg = _a[1], bg = _a[2];
                            return [
                                _this.options.symbol || "?",
                                on ? "red" : "white",
                                bg
                            ];
                        });
                        break;
                }
                if (timer <= 0) {
                    game.drawAt(_this.at);
                    clearTimeout(handle);
                }
            }, interval);
        };
        return Animation;
    }());
    var Pathfinder = /** @class */ (function () {
        function Pathfinder() {
            this.es = new easystar.js();
            this.es.setAcceptableTiles([1, 2, 3, 4, 5, 6]);
            this.es.setTileCost(1, 1);
            this.es.setTileCost(2, 2);
            this.es.setTileCost(3, 4);
            this.es.setTileCost(4, 8);
            this.es.setTileCost(5, 16);
            this.es.setTileCost(6, 32);
            this.es.enableDiagonals();
            this.es.enableCornerCutting();
            this.es.enableSync();
        }
        Pathfinder.prototype.setGrid = function () {
            var grid = game.grid.map(function (column) { return column.map(function (tile) { return tile.cost; }); });
            this.es.setGrid(grid);
        };
        Pathfinder.prototype.setGridFear = function () {
            var grid = game.grid.map(function (column) { return column.map(function (tile) { return tile.cost; }); });
            var r = 16;
            var limit = [[0, 0], [0, 0]];
            for (var axis = 0; axis < 2; axis++) {
                limit[axis] = [
                    Math.max(0, game.player.at[axis] - r),
                    Math.min(game.options.size[axis], game.player.at[axis] + r)
                ];
            }
            for (var x = limit[0][0]; x < limit[0][1]; x++)
                for (var y = limit[1][0]; y < limit[1][1]; y++) {
                    if (grid[x][y] == 1) {
                        var d = distance(game.player.at, [x, y]);
                        grid[x][y] = Math.max(1, 7 - Math.floor(Math.sqrt(d)));
                    }
                }
            this.es.setGrid(grid);
        };
        Pathfinder.prototype.find = function (from, to) {
            var path;
            this.es.findPath(from[1], from[0], to[1], to[0], function (p) {
                path = p ? p.map(function (at) { return [at.y, at.x]; }) : [];
            });
            this.es.calculate();
            return path;
        };
        return Pathfinder;
    }());
    var Ticker = /** @class */ (function () {
        function Ticker() {
        }
        Ticker.prototype.getSpeed = function () {
            return 100;
        };
        Ticker.prototype.act = function () {
            game.time++;
            game.scent = game.scent.filter(function (tile) {
                tile.scent = Math.max(tile.scent - 0.05, 0.01);
                return tile.scent > 0.01;
            });
            for (var _i = 0, _a = game.mobs; _i < _a.length; _i++) {
                var mob = _a[_i];
                mob.actFixedInterval();
            }
            if (RNG$1.getUniform() < (game.options.spawn * 10) / (100 + game.panic)) {
                var exit = RNG$1.getItem(game.exits);
                var tile = game.at(exit);
                if (!tile.mob) {
                    var mob = new Mob();
                    mob.at = exit.slice();
                    tile.mob = mob;
                }
            }
            if (game.guardsSpawned + 1 <= Math.min(game.panic / 200, game.killed / 2)) {
                game.guardsSpawned++;
                var mob = new Mob(RNG$1.getUniform() < 0.5 ? Mob.RED_ONI : Mob.BLUE_ONI);
                mob.freeze = 300;
                game.scheduler.add(mob, true);
            }
            if (!game.elderSpawned &&
                game.killed == 0 &&
                game.panic >= game.options.elderSpawnAt) {
                game.elderSpawned = true;
                var mob = new Mob(Mob.ELDER);
                game.scheduler.add(mob, true);
            }
        };
        return Ticker;
    }());
    var Tile$1 = /** @class */ (function () {
        function Tile(symbol) {
            this.symbol = symbol;
            this.cost = 1;
            this.opaque = false;
            this.seen = 0;
            this.visible = 0;
            this.scent = 0;
            this.cost = symbol.match(Tile.impassible) ? 1e6 : 1;
            this.opaque = symbol.match(Tile.impassible) ? true : false;
        }
        Tile.prototype.serialise = function () {
            var s = {};
            Object.assign(s, this);
            delete s.mob;
            return s;
        };
        Tile.prototype.deserialise = function (s) {
            Object.assign(this, s);
            if (this.scent > 0.01) {
                game.scent.push(this);
            }
            return this;
        };
        Tile.prototype.tooltip = function (at) {
            if (!this.seen && !this.scent)
                return null;
            if (this.mob) {
                return this.mob.tooltip().map(function (s) { return lang$3[s]; }).join("<br/>");
            }
            switch (this.symbol) {
                case "⚘":
                    return lang$3.flower;
                case "♠":
                    return lang$3.tree;
                case "<":
                    return lang$3.exit;
                case ">":
                    return lang$3.entrance;
                case "*":
                    return lang$3.blood;
                case "b":
                    return lang$3.blood_old;
                case "B":
                    return lang$3.blood_trail;
                case "☨":
                    return lang$3.grave;
                case "#":
                    return lang$3.wall;
                case " ":
                    if (this.scent > 0.1)
                        return lang$3.smell;
                    break;
            }
        };
        Tile.impassible = /[♠#]/;
        return Tile;
    }());
    function add2d(a, b) {
        return [a[0] + b[0], a[1] + b[1]];
    }
    function sub2d(a, b) {
        return [a[0] - b[0], a[1] - b[1]];
    }
    function eq2d(a, b) {
        return a[0] == b[0] && a[1] == b[1];
    }
    var Options = /** @class */ (function () {
        function Options(o) {
            this.size = [80, 80];
            this.mobs = 18;
            this.flowers = 6;
            this.hateGain = 1;
            this.emptiness = 0.3;
            this.spawn = 0.1;
            this.despawn = 0.01;
            this.elderSpawnAt = 100;
            Object.assign(this, o);
            this.flowersNeeded = this.flowersNeeded || this.flowers - 1;
        }
        return Options;
    }());
    var Game = /** @class */ (function () {
        function Game() {
            this.emptyTile = new Tile$1("♠");
            this.scent = [];
            this.mouseOver = [0, 0];
            this.pathfinder = new Pathfinder();
            this.escapefinder = new Pathfinder();
            this.waitingForInput = true;
            this.autoSaved = true;
            this.paused = false;
            this.displaySize = [45, 45];
            this.mobs = [];
            this.seeingRed = false;
            this.complete = false;
            this.time = 0;
            this._log = [];
            this.flowersCollected = 0;
            this.letterRead = 0;
            game = this;
            window.gameState = this;
        }
        Game.prototype.serialise = function () {
            return {
                options: this.options,
                seeingRed: this.seeingRed,
                flowersCollected: this.flowersCollected,
                letterRead: this.letterRead,
                time: this.time,
                complete: this.complete,
                landmarks: this.landmarks,
                exits: this.exits,
                killed: this.killed,
                guardsSpawned: this.guardsSpawned,
                panic: this.panic,
                elderSpawned: this.elderSpawned,
                _log: this._log,
                milestones: this.milestones.serialise(),
                grid: this.grid.map(function (line) { return line.map(function (t) { return t.serialise(); }); }),
                mobs: this.mobs.map(function (m) { return m.serialise(); })
            };
        };
        Game.prototype.deserialise = function (s) {
            this.options = new Options(s.options);
            this.seeingRed = s.seeingRed;
            this.time = s.time;
            this.complete = s.complete;
            this.panic = s.panic;
            this.landmarks = s.landmarks;
            this.exits = s.exits;
            this.killed = s.killed;
            this.elderSpawned = s.elderSpawned;
            this.guardsSpawned = s.guardsSpawned;
            this.flowersCollected = s.flowersCollected;
            this.letterRead = s.letterRead;
            this._log = s._log;
            this.scent = [];
            this.milestones = new Milestones().deserialise(s.milestones);
            this.grid = s.grid.map(function (line) {
                return line.map(function (t) { return new Tile$1(t.symbol).deserialise(t); });
            });
            this.findFreeTiles();
            this.mobs = s.mobs.map(function (m) { return new Mob().deserialise(m); });
            this.initMobs();
            this.pathfinder.setGrid();
            this.escapefinder.setGridFear();
            this.waitingForInput = true;
            this.draw();
        };
        Game.prototype.at = function (at) {
            return this.grid[at[0]][at[1]];
        };
        Game.prototype.safeAt = function (at) {
            if (at[0] < 0 ||
                at[1] < 0 ||
                at[0] >= this.options.size[0] ||
                at[1] >= this.options.size[1])
                return this.emptyTile;
            return this.grid[at[0]][at[1]];
        };
        Game.prototype.save = function (slot) {
            localStorage.setItem(slot, JSON.stringify(game.serialise()));
            localStorage.setItem("!" + slot, "yes");
            if (slot != "0")
                game.log(str.saved_to, slot);
        };
        Game.prototype.load = function (slot) {
            if (!this.hasSave(slot))
                return;
            var save = localStorage.getItem(slot);
            game.deserialise(JSON.parse(save));
            game.log(str.loaded_from, slot == "0" ? "autosave" : slot);
        };
        Game.prototype.hasSave = function (slot) {
            return localStorage.getItem("!" + slot) ? true : false;
        };
        Game.prototype.init = function (size) {
            var _this = this;
            var d = (this.d = new Display({
                width: size[0],
                height: size[1],
                fontSize: 32,
                spacing: 0.6,
                forceSquareRatio: true,
                bg: "#180C24",
                fontFamily: "Icons"
            }));
            document.getElementById("game").appendChild(d.getContainer());
            this.scheduler = new Schedulers.Speed();
            this.engine = new Engine(this.scheduler);
            this.engine.start();
            setInterval(function () {
                if (!_this.complete && !_this.autoSaved) {
                    _this.save("0");
                    _this.autoSaved = true;
                }
            }, 1000);
            window.addEventListener("keypress", function (e) { return _this.keypress(e); });
            d.getContainer().addEventListener("mousedown", function (e) { return _this.onClick(e); });
            d.getContainer().addEventListener("touchend", function (e) { return _this.onClick(e); });
            d.getContainer().addEventListener("mousemove", function (e) { return _this.mousemove(e); });
            this.keyboard = new Keyboard(window);
            this.keyboard.sub(this.onKeyboard.bind(this));
        };
        Game.prototype.start = function (cfg) {
            this.options = new Options(cfg);
            RNG$1.setSeed(this.options.seed || Math.random());
            this._log = [];
            this.mobs = [];
            this.complete = false;
            this.killed = 0;
            this.flowersCollected = 0;
            this.panic = 0;
            this.letterRead = 0;
            this.time = 0;
            this.guardsSpawned = 0;
            this.seeingRed = false;
            this.milestones = new Milestones();
            this.elderSpawned = false;
            this.generateMap();
            this.initMobs();
            this.draw();
        };
        Game.prototype.addHut = function () {
            var hut = "         \n ####### \n #   s # \n # bb  # \n # bbbb# \n # bbb # \n ###b### \n    B    \n   B     ".split("\n");
            var h = hut.length;
            var pat = this.player.at.slice();
            for (var y = 0; y < h; y++) {
                var line = hut[y];
                var w = line.length;
                for (var x = 0; x < w; x++) {
                    var sym = line[x];
                    var tile = new Tile$1(sym);
                    this.grid[pat[0] + x - 4][pat[1] + y - 4] = tile;
                }
            }
        };
        Game.prototype.keypress = function (e) { };
        Game.prototype.drawAtDisplay = function (displayAt, bg) {
            var delta = this.deltaAndHalf().delta;
            var at = sub2d(displayAt, delta);
            if (eq2d(this.mouseOver, displayAt)) {
                bg = "#400";
            }
            this.d.draw(displayAt[0], displayAt[1], this.tileSym(at), this.tileFg(at), bg || this.tileBg(at));
        };
        Game.prototype.mousemove = function (e) {
            var displayAt = this.d.eventToPosition(e);
            var outside = displayAt[1] <= 0 || displayAt[1] >= this.displaySize[1] - 1;
            if (outside) {
                this.tooltip = null;
                return;
            }
            var delta = this.deltaAndHalf().delta;
            var at = sub2d(displayAt, delta);
            var tile = this.safeAt(at);
            this.tooltip = tile.tooltip(at);
            var old = this.mouseOver;
            this.mouseOver = displayAt;
            this.drawAtDisplay(old);
            this.drawAtDisplay(this.mouseOver);
        };
        Game.prototype.initMobs = function () {
            this.scheduler.clear();
            this.scheduler.add(new Ticker(), true);
            for (var _i = 0, _a = this.mobs; _i < _a.length; _i++) {
                var mob = _a[_i];
                if (!mob.alive || (!mob.at && !mob.isGuard()))
                    continue;
                this.scheduler.add(mob, true);
                if (mob.at)
                    this.at(mob.at).mob = mob;
            }
        };
        Game.prototype.findFreeTiles = function () {
            var _this = this;
            this.freeTiles = [];
            this.eachTile(function (at, t) {
                if (t.cost < 1000)
                    _this.freeTiles.push(at);
            });
            return this.freeTiles;
        };
        Game.prototype.generateMap = function () {
            var _this = this;
            var w = this.options.size[0];
            var h = this.options.size[1];
            this.grid = new Array(w).fill(null).map(function (_) { return []; });
            var map = new Digger(w, h, {
                dugPercentage: this.options.emptiness,
                corridorLength: [2, 6],
                roomWidth: [3, 6],
                roomHeight: [3, 6]
            });
            map.create(function (x, y, what) {
                var symbol = what ? "♠" : " ";
                _this.grid[x][y] = new Tile$1(symbol);
            });
            this.findFreeTiles();
            /*for(let at of this.freeTiles){
              if(RNG.getUniform() < 0.3){
                let tile = this.at(at)
                tile.symbol = "."
                tile.cost += 3
              }
            }*/
            var rooms = map.getRooms();
            var roomsRandom = RNG$1.shuffle(rooms);
            this.landmarks = rooms.map(function (r) { return r.getCenter(); });
            this.exits = [[1e6, 0], [-1e6, 0]];
            for (var _i = 0, _a = this.freeTiles; _i < _a.length; _i++) {
                var at = _a[_i];
                var t = this.at(at);
                if (t.symbol == " ") {
                    if (at[0] < this.exits[0][0]) {
                        this.exits[0] = at;
                    }
                    if (at[0] >= this.exits[1][0])
                        this.exits[1] = at;
                }
            }
            this.at(this.exits[0]).symbol = "<";
            this.at(this.exits[1]).symbol = ">";
            this.at(roomsRandom[0].getCenter()).symbol = "☨";
            var freeLandmarks = this.landmarks.slice();
            this.player = new Mob(Mob.PLAYER);
            for (var i = 0; i < freeLandmarks.length; i++) {
                var lm = freeLandmarks[i];
                if (lm[0] > 5 &&
                    lm[0] < this.options.size[0] - 5 &&
                    lm[1] > 5 &&
                    lm[1] < this.options.size[1] - 5) {
                    this.player.at = freeLandmarks[i].slice();
                    freeLandmarks.splice(i, 1);
                    break;
                }
            }
            this.addHut();
            f: for (var i = 0; i < this.options.flowers; i++) {
                while (freeLandmarks.length > 0) {
                    var place = freeLandmarks.pop();
                    if (this.at(place).symbol == " ") {
                        this.at(place).symbol = "⚘";
                        continue f;
                    }
                }
            }
            this.player.lookAround();
            m: for (var i = 0; i < this.options.mobs; i++) {
                var monster = new Mob();
                while (freeLandmarks.length > 0) {
                    var place = freeLandmarks.pop();
                    var tile = this.at(place);
                    if (tile.symbol == " " && !tile.seen) {
                        monster.at = place.slice();
                        continue m;
                    }
                }
                if (!monster.at)
                    game.mobs.pop();
            }
            this.pathfinder.setGrid();
            game.log(str.guide);
            game.log(str.not_here);
        };
        Game.prototype.tileBg = function (at) {
            var tile = this.safeAt(at);
            var bg = [0, 0, 0];
            var d = distance(at, this.player.at);
            var inScentRadius = d <
                10 +
                    Math.max(Math.min(this.player.concentration, 10), this.player.hate * 0.1);
            if (!tile.seen && (!inScentRadius || tile.scent == 0)) {
                return Color.toRGB(this.hateBg);
            }
            if (tile.visible) {
                var b = 48 * tile.visible;
                bg = [b, b, b];
            }
            if (tile.scent > 0) {
                bg = Color.add(bg, [128 * (inScentRadius ? tile.scent : 0), 0, 0]);
                tile.seen = 1;
            }
            return Color.toRGB(bg);
        };
        Game.prototype.tileFg = function (at) {
            var tile = this.safeAt(at);
            if (tile.mob && tile.visible) {
                return tile.mob.fg();
            }
            if (!tile.mob && tile.seen && tile.symbol == "♠") {
                RNG$1.setSeed(at[0] * 1000 + at[1] * 3);
                var shade = RNG$1.getUniformInt(150, 250);
                return Color.toRGB([shade, shade, shade]);
            }
            if (tile.symbol == "b" || tile.symbol == "B")
                return "#800";
            if (!tile.symbol.match(/[ ♠#_]/))
                return "red";
            return null;
        };
        Game.prototype.tileSym = function (at) {
            var tile = this.safeAt(at);
            if (tile.mob && tile.visible) {
                return tile.mob.sym();
            }
            if (tile.visible || tile.seen) {
                if (tile.symbol == "♠") {
                    RNG$1.setSeed(at[0] * 1000 + at[1] * 3);
                    return RNG$1.getItem(["♠", "♣"]);
                }
                if (tile.symbol == "b" || tile.symbol == "B")
                    return "*";
                if (tile.symbol == "s") {
                    if (tile.visible &&
                        game.allFlowersCollected() &&
                        this.flowersCollected % 2 == 1) {
                        return "s";
                    }
                    else {
                        return " ";
                    }
                }
                return tile.symbol;
            }
            return " ";
        };
        Game.prototype.deltaAndHalf = function () {
            var _this = this;
            var half = [0, 1].map(function (axis) { return Math.floor(_this.displaySize[axis] / 2); });
            var delta = [0, 1].map(function (axis) { return -_this.player.at[axis] + half[axis]; });
            return { delta: delta, half: half };
        };
        Game.prototype.drawAt = function (at, delta, filter) {
            var _a;
            if (!delta)
                delta = this.deltaAndHalf().delta;
            var displayAt = add2d(at, delta);
            var tile = this.safeAt(at);
            var _b = [this.tileSym(at), this.tileFg(at), this.tileBg(at)], sym = _b[0], fg = _b[1], bg = _b[2];
            if (filter) {
                _a = filter([sym, fg, bg]), sym = _a[0], fg = _a[1], bg = _a[2];
            }
            if (tile == this.emptyTile)
                this.d.draw(displayAt[0], displayAt[1], " ", null, Color.toRGB(this.hateBg));
            else
                this.d.draw(displayAt[0], displayAt[1], sym, fg, bg);
        };
        Game.prototype.draw = function () {
            this.hateBg = this.seeingRed
                ? [255, 0, 0]
                : Color.add(screenBg, [0.64 * this.player.hate, 0, 0]);
            var hateRGB = Color.toRGB(this.hateBg);
            this.d.setOptions({ bg: hateRGB });
            this.d.clear();
            this.d.drawText(0, 0, "%b{red}%c{red}" +
                "-".repeat(Math.round((this.player.hate * this.displaySize[0]) / 100)));
            document.documentElement.style.background = hateRGB;
            var _a = this.deltaAndHalf(), delta = _a.delta, half = _a.half;
            for (var x = this.player.at[0] - half[0]; x < this.player.at[0] + half[0] + 1; x++) {
                for (var y = this.player.at[1] - half[1] + 1; y < this.player.at[1] + half[1]; y++) {
                    this.drawAt([x, y], delta);
                }
            }
            this.d.drawText(0, this.displaySize[1] - 1, "%b{" + hateRGB + "}%c{" + hateRGB + "}" + " ".repeat(this.displaySize[0]));
            var statusLine = "";
            if (this.milestones["flower_first"]) {
                for (var i = 0; i < Math.max(this.options.flowersNeeded, this.flowersCollected); i++) {
                    statusLine += i < this.flowersCollected ? "%c{red}⚘" : "%c{gray}⚘";
                }
            }
            if (this.player.waiting()) {
                this.drawAt([this.player.at[0], this.player.at[1] - 1], delta, function (_a) {
                    var sym = _a[0], fg = _a[1], bg = _a[2];
                    return [
                        [".", "‥", "…"][new Date().getSeconds() % 3],
                        "white",
                        bg
                    ];
                });
            }
            if (this.milestones["mob_first_0"]) {
                statusLine +=
                    "%b{" +
                        hateRGB +
                        "}" +
                        "%c{gray} " +
                        this.mobs
                            .filter(function (m) { return !m.isPlayer() && (m.at || m.isGuard); })
                            .map(function (m) { return (m.alive ? "%c{" + m.fg() + "}" + m.sym() : "%c{red}*"); })
                            .join("");
            }
            this.d.drawText(0, this.displaySize[1] - 1, statusLine);
        };
        Game.prototype.onKeyboard = function (code) {
            if (this.paused)
                return;
            this.lastKey = code;
            if (Mob.meansStop(code))
                this.player.stop();
            if (this.waitingForInput)
                this.playerAct();
        };
        Game.prototype.displayToGrid = function (at) {
            var delta = this.deltaAndHalf().delta;
            return sub2d(at, delta);
        };
        Game.prototype.onClick = function (e) {
            if (this.paused)
                return;
            e.preventDefault();
            this.click();
        };
        Game.prototype.click = function () {
            if (game.player.hasPath()) {
                game.player.stop();
                return;
            }
            var to = this.displayToGrid(this.mouseOver);
            var tile = this.safeAt(to);
            if (eq2d(to, game.player.at)) {
                game.player.path = [game.player.at.slice()];
            }
            else {
                if (tile.cost > 1000) {
                    var nearest = this.freeTiles
                        .map(function (at) { return ({ at: at, d: distance(at, to) }); })
                        .reduce(function (prev, cur) { return (cur.d < prev.d ? cur : prev); }, {
                        at: [0, 0],
                        d: 1e6
                    });
                    if (distance(to, this.player.at) < nearest.d) {
                        return;
                    }
                    to = nearest.at;
                }
                game.player.setPath(to);
            }
            if (this.waitingForInput)
                this.playerAct();
        };
        Game.prototype.allFlowersCollected = function () {
            return this.flowersCollected >= this.options.flowersNeeded;
        };
        Game.prototype.eachTile = function (hook) {
            var _a = this.options.size, w = _a[0], h = _a[1];
            for (var x = 0; x < w; x++)
                for (var y = 0; y < w; y++)
                    if (hook([x, y], this.grid[x][y]))
                        return;
        };
        Game.prototype.log = function (text) {
            var _this = this;
            var params = [];
            for (var _i = 1; _i < arguments.length; _i++) {
                params[_i - 1] = arguments[_i];
            }
            if (!text)
                return;
            this._log.push([text].concat(params));
            console.log(text);
            console.log(this._log);
            log.update(function (s) { return _this._log; });
        };
        Game.prototype.alertOnce = function (id) {
            if (this.milestones[id])
                return;
            this.player.stop();
            this.milestones[id] = 1;
            if (id == "mob_first_4" && game.killed > 0)
                this.log(str.elder_angry);
            else
                this.log(id);
        };
        Game.prototype.playerAct = function () {
            var _this = this;
            if (!this.player.alive) {
                return;
            }
            var moveMade = this.player.playerAct();
            this.draw();
            if (moveMade) {
                if (!this.player.hasPath() && !this.seeingRed)
                    this.autoSaved = false;
                if (this.seeingRed || this.player.hasPath()) {
                    this.waitingForInput = false;
                    window.setTimeout(function () {
                        _this.waitingForInput = true;
                        game.engine.unlock();
                    }, 50);
                }
                else {
                    game.engine.unlock();
                }
            }
        };
        Game.prototype.readNextLetter = function () {
            this.player.stop();
            if (lang$3.letter.length >= this.letterRead) {
                var i = this.letterRead;
                if (lang$3.read_letter[i])
                    this.log("complete_letter_" + i);
                /*this.log(lang.letter[i])
                this.log(lang.close_letter[i])*/
                this.letterRead++;
            }
        };
        Game.prototype.end = function (ending) {
            this.complete = true;
            this.paused = true;
            if (!ending) {
                var roll = RNG$1.getUniformInt(0, this.killed);
                console.log(roll);
                var pacifist = roll <= 1;
                var optimist = this.flowersCollected % 2 == 1;
                ending = pacifist
                    ? optimist
                        ? lang$3.ending_bargain
                        : lang$3.ending_depression
                    : optimist
                        ? lang$3.ending_denial
                        : lang$3.ending_anger;
            }
            this.onEnd(ending);
        };
        return Game;
    }());
    //♠♣⚘☻☺😁😞😐⚡⌛
    /*
        let roomsByX = rooms.sort(r => r.getCenter()[0]);

        this.exits = [
          [roomsByX[0].getLeft() - 1, roomsByX[0].getCenter()[1]],
          [
            roomsByX[roomsByX.length - 1].getRight() + 1,
            roomsByX[roomsByX.length - 1].getCenter()[1]
          ]
        ];*/
    /*
        if (this.won) {
          statusLine += " %c{red}" + lang.game_complete;
        } else if (this.allFlowersCollected()) {
          statusLine += " %c{gray}visit %c{red}☨";
        } else {
        }
    */
    /*
        let waitAnim = 0;
        setInterval(() => {
          if (this.player.waiting()) {
            this.drawAt(
              [this.player.at[0], this.player.at[1] - 1],
              null,
              ([sym, fg, bg]) => [[".", "‥", "…"][waitAnim], "white", bg]
            );
            waitAnim = (waitAnim + 1)%3;
          }
        }, 1000);

    */

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

    function get_each_context(ctx, list, i) {
    	const child_ctx = Object.create(ctx);
    	child_ctx.record = list[i];
    	return child_ctx;
    }

    function get_each_context_1(ctx, list, i) {
    	const child_ctx = Object.create(ctx);
    	child_ctx.slot = list[i];
    	return child_ctx;
    }

    // (198:4) {:else}
    function create_else_block(ctx) {
    	var h1, t1, div4, div3, div1, button0, t2_value = ctx.lang.new_game, t2, t3, t4, div0, t5, button1, t6_value = ctx.lang.lang, t6, t7, div2, dispose;

    	var if_block = (ctx.game && ctx.game.time > 0 && !ctx.game.complete) && create_if_block_2(ctx);

    	var each_value_1 = [1, 2, 3, 4, 5, 6, 7, 8, 9];

    	var each_blocks = [];

    	for (var i = 0; i < 9; i += 1) {
    		each_blocks[i] = create_each_block_1(get_each_context_1(ctx, each_value_1, i));
    	}

    	return {
    		c: function create() {
    			h1 = element("h1");
    			h1.textContent = "Seeing Red";
    			t1 = space();
    			div4 = element("div");
    			div3 = element("div");
    			div1 = element("div");
    			button0 = element("button");
    			t2 = text(t2_value);
    			t3 = space();
    			if (if_block) if_block.c();
    			t4 = space();
    			div0 = element("div");
    			t5 = space();
    			button1 = element("button");
    			t6 = text(t6_value);
    			t7 = space();
    			div2 = element("div");

    			for (var i = 0; i < 9; i += 1) {
    				each_blocks[i].c();
    			}
    			add_location(h1, file, 198, 6, 4459);
    			add_location(button0, file, 202, 12, 4577);
    			set_style(div0, "flex-grow", "1");
    			add_location(div0, file, 208, 12, 4845);
    			add_location(button1, file, 209, 12, 4886);
    			div1.className = "menu-buttons";
    			add_location(div1, file, 201, 10, 4537);
    			div2.className = "saves";
    			add_location(div2, file, 211, 10, 4970);
    			div3.className = "menu-table";
    			add_location(div3, file, 200, 8, 4501);
    			add_location(div4, file, 199, 6, 4486);

    			dispose = [
    				listen(button0, "click", ctx.click_handler_1),
    				listen(button1, "click", toggleLanguage)
    			];
    		},

    		m: function mount(target, anchor) {
    			insert(target, h1, anchor);
    			insert(target, t1, anchor);
    			insert(target, div4, anchor);
    			append(div4, div3);
    			append(div3, div1);
    			append(div1, button0);
    			append(button0, t2);
    			append(div1, t3);
    			if (if_block) if_block.m(div1, null);
    			append(div1, t4);
    			append(div1, div0);
    			append(div1, t5);
    			append(div1, button1);
    			append(button1, t6);
    			append(div3, t7);
    			append(div3, div2);

    			for (var i = 0; i < 9; i += 1) {
    				each_blocks[i].m(div2, null);
    			}
    		},

    		p: function update(changed, ctx) {
    			if ((changed.lang) && t2_value !== (t2_value = ctx.lang.new_game)) {
    				set_data(t2, t2_value);
    			}

    			if (ctx.game && ctx.game.time > 0 && !ctx.game.complete) {
    				if (if_block) {
    					if_block.p(changed, ctx);
    				} else {
    					if_block = create_if_block_2(ctx);
    					if_block.c();
    					if_block.m(div1, t4);
    				}
    			} else if (if_block) {
    				if_block.d(1);
    				if_block = null;
    			}

    			if ((changed.lang) && t6_value !== (t6_value = ctx.lang.lang)) {
    				set_data(t6, t6_value);
    			}

    			if (changed.game || changed.lang) {
    				each_value_1 = [1, 2, 3, 4, 5, 6, 7, 8, 9];

    				for (var i = 0; i < each_value_1.length; i += 1) {
    					const child_ctx = get_each_context_1(ctx, each_value_1, i);

    					if (each_blocks[i]) {
    						each_blocks[i].p(changed, child_ctx);
    					} else {
    						each_blocks[i] = create_each_block_1(child_ctx);
    						each_blocks[i].c();
    						each_blocks[i].m(div2, null);
    					}
    				}

    				for (; i < 9; i += 1) {
    					each_blocks[i].d(1);
    				}
    			}
    		},

    		d: function destroy(detaching) {
    			if (detaching) {
    				detach(h1);
    				detach(t1);
    				detach(div4);
    			}

    			if (if_block) if_block.d();

    			destroy_each(each_blocks, detaching);

    			run_all(dispose);
    		}
    	};
    }

    // (191:4) {#if winText}
    function create_if_block_1(ctx) {
    	var div1, raw_after, t0, div0, button, t1_value = ctx.lang.continue, t1, dispose;

    	return {
    		c: function create() {
    			div1 = element("div");
    			raw_after = element('noscript');
    			t0 = space();
    			div0 = element("div");
    			button = element("button");
    			t1 = text(t1_value);
    			add_location(button, file, 194, 10, 4342);
    			set_style(div0, "text-align", "center");
    			add_location(div0, file, 193, 8, 4298);
    			div1.className = "win";
    			div1.id = "win";
    			add_location(div1, file, 191, 6, 4218);
    			dispose = listen(button, "click", ctx.click_handler);
    		},

    		m: function mount(target, anchor) {
    			insert(target, div1, anchor);
    			append(div1, raw_after);
    			raw_after.insertAdjacentHTML("beforebegin", ctx.winText);
    			append(div1, t0);
    			append(div1, div0);
    			append(div0, button);
    			append(button, t1);
    			add_binding_callback(() => ctx.div1_binding(div1, null));
    		},

    		p: function update(changed, ctx) {
    			if (changed.winText) {
    				detach_before(raw_after);
    				raw_after.insertAdjacentHTML("beforebegin", ctx.winText);
    			}

    			if ((changed.lang) && t1_value !== (t1_value = ctx.lang.continue)) {
    				set_data(t1, t1_value);
    			}

    			if (changed.items) {
    				ctx.div1_binding(null, div1);
    				ctx.div1_binding(div1, null);
    			}
    		},

    		d: function destroy(detaching) {
    			if (detaching) {
    				detach(div1);
    			}

    			ctx.div1_binding(null, div1);
    			dispose();
    		}
    	};
    }

    // (204:12) {#if game && game.time > 0 && !game.complete}
    function create_if_block_2(ctx) {
    	var button, t_value = ctx.lang.continue, t, dispose;

    	return {
    		c: function create() {
    			button = element("button");
    			t = text(t_value);
    			add_location(button, file, 204, 14, 4711);
    			dispose = listen(button, "click", ctx.click_handler_2);
    		},

    		m: function mount(target, anchor) {
    			insert(target, button, anchor);
    			append(button, t);
    		},

    		p: function update(changed, ctx) {
    			if ((changed.lang) && t_value !== (t_value = ctx.lang.continue)) {
    				set_data(t, t_value);
    			}
    		},

    		d: function destroy(detaching) {
    			if (detaching) {
    				detach(button);
    			}

    			dispose();
    		}
    	};
    }

    // (213:12) {#each [1, 2, 3, 4, 5, 6, 7, 8, 9] as slot}
    function create_each_block_1(ctx) {
    	var div, t0, t1, button0, t2_value = ctx.lang.save, t2, button0_disabled_value, t3, button1, t4_value = ctx.lang.load, t4, button1_disabled_value, dispose;

    	function click_handler_3() {
    		return ctx.click_handler_3(ctx);
    	}

    	function click_handler_4() {
    		return ctx.click_handler_4(ctx);
    	}

    	return {
    		c: function create() {
    			div = element("div");
    			t0 = text(ctx.slot);
    			t1 = text(".\r\n                ");
    			button0 = element("button");
    			t2 = text(t2_value);
    			t3 = space();
    			button1 = element("button");
    			t4 = text(t4_value);
    			button0.disabled = button0_disabled_value = !ctx.game || ctx.game.time == 0;
    			add_location(button0, file, 215, 16, 5123);
    			button1.disabled = button1_disabled_value = !ctx.game || !ctx.game.hasSave(ctx.slot);
    			add_location(button1, file, 220, 16, 5308);
    			div.className = "save";
    			add_location(div, file, 213, 14, 5062);

    			dispose = [
    				listen(button0, "click", click_handler_3),
    				listen(button1, "click", click_handler_4)
    			];
    		},

    		m: function mount(target, anchor) {
    			insert(target, div, anchor);
    			append(div, t0);
    			append(div, t1);
    			append(div, button0);
    			append(button0, t2);
    			append(div, t3);
    			append(div, button1);
    			append(button1, t4);
    		},

    		p: function update(changed, new_ctx) {
    			ctx = new_ctx;
    			if ((changed.lang) && t2_value !== (t2_value = ctx.lang.save)) {
    				set_data(t2, t2_value);
    			}

    			if ((changed.game) && button0_disabled_value !== (button0_disabled_value = !ctx.game || ctx.game.time == 0)) {
    				button0.disabled = button0_disabled_value;
    			}

    			if ((changed.lang) && t4_value !== (t4_value = ctx.lang.load)) {
    				set_data(t4, t4_value);
    			}

    			if ((changed.game) && button1_disabled_value !== (button1_disabled_value = !ctx.game || !ctx.game.hasSave(ctx.slot))) {
    				button1.disabled = button1_disabled_value;
    			}
    		},

    		d: function destroy(detaching) {
    			if (detaching) {
    				detach(div);
    			}

    			run_all(dispose);
    		}
    	};
    }

    // (243:8) {#if log.length > 0}
    function create_if_block(ctx) {
    	var t, div, raw_value = ctx.translated(ctx.log[ctx.log.length - 1]).substr(0, ctx.lettersLogged);

    	var each_value = ctx.log.slice(0, ctx.log.length - 1);

    	var each_blocks = [];

    	for (var i = 0; i < each_value.length; i += 1) {
    		each_blocks[i] = create_each_block(get_each_context(ctx, each_value, i));
    	}

    	return {
    		c: function create() {
    			for (var i = 0; i < each_blocks.length; i += 1) {
    				each_blocks[i].c();
    			}

    			t = space();
    			div = element("div");
    			div.className = "record";
    			add_location(div, file, 248, 10, 6051);
    		},

    		m: function mount(target, anchor) {
    			for (var i = 0; i < each_blocks.length; i += 1) {
    				each_blocks[i].m(target, anchor);
    			}

    			insert(target, t, anchor);
    			insert(target, div, anchor);
    			div.innerHTML = raw_value;
    		},

    		p: function update(changed, ctx) {
    			if (changed.translated || changed.log) {
    				each_value = ctx.log.slice(0, ctx.log.length - 1);

    				for (var i = 0; i < each_value.length; i += 1) {
    					const child_ctx = get_each_context(ctx, each_value, i);

    					if (each_blocks[i]) {
    						each_blocks[i].p(changed, child_ctx);
    					} else {
    						each_blocks[i] = create_each_block(child_ctx);
    						each_blocks[i].c();
    						each_blocks[i].m(t.parentNode, t);
    					}
    				}

    				for (; i < each_blocks.length; i += 1) {
    					each_blocks[i].d(1);
    				}
    				each_blocks.length = each_value.length;
    			}

    			if ((changed.log || changed.lettersLogged) && raw_value !== (raw_value = ctx.translated(ctx.log[ctx.log.length - 1]).substr(0, ctx.lettersLogged))) {
    				div.innerHTML = raw_value;
    			}
    		},

    		d: function destroy(detaching) {
    			destroy_each(each_blocks, detaching);

    			if (detaching) {
    				detach(t);
    				detach(div);
    			}
    		}
    	};
    }

    // (244:10) {#each log.slice(0, log.length - 1) as record}
    function create_each_block(ctx) {
    	var div, raw_value = ctx.translated(ctx.record);

    	return {
    		c: function create() {
    			div = element("div");
    			div.className = "record";
    			add_location(div, file, 244, 12, 5938);
    		},

    		m: function mount(target, anchor) {
    			insert(target, div, anchor);
    			div.innerHTML = raw_value;
    		},

    		p: function update(changed, ctx) {
    			if ((changed.log) && raw_value !== (raw_value = ctx.translated(ctx.record))) {
    				div.innerHTML = raw_value;
    			}
    		},

    		d: function destroy(detaching) {
    			if (detaching) {
    				detach(div);
    			}
    		}
    	};
    }

    function create_fragment(ctx) {
    	var div0, t1, div6, div1, t2, div5, div4, div2, t3, div3, dispose;

    	function select_block_type(ctx) {
    		if (ctx.winText) return create_if_block_1;
    		return create_else_block;
    	}

    	var current_block_type = select_block_type(ctx);
    	var if_block0 = current_block_type(ctx);

    	var if_block1 = (ctx.log.length > 0) && create_if_block(ctx);

    	return {
    		c: function create() {
    			div0 = element("div");
    			div0.textContent = "Tooltip";
    			t1 = space();
    			div6 = element("div");
    			div1 = element("div");
    			if_block0.c();
    			t2 = space();
    			div5 = element("div");
    			div4 = element("div");
    			div2 = element("div");
    			t3 = space();
    			div3 = element("div");
    			if (if_block1) if_block1.c();
    			div0.className = "tooltip fadein";
    			add_location(div0, file, 184, 0, 4063);
    			div1.className = "menu";
    			add_location(div1, file, 188, 2, 4151);
    			div2.className = "game";
    			div2.id = "game";
    			add_location(div2, file, 235, 6, 5662);
    			div3.className = "log";
    			add_location(div3, file, 241, 6, 5799);
    			div4.className = "main-table";
    			add_location(div4, file, 234, 4, 5630);
    			div5.className = "mainer-table";
    			add_location(div5, file, 233, 2, 5598);
    			div6.className = "all";
    			add_location(div6, file, 186, 0, 4128);
    			dispose = listen(div2, "contextmenu", contextmenu_handler);
    		},

    		l: function claim(nodes) {
    			throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
    		},

    		m: function mount(target, anchor) {
    			insert(target, div0, anchor);
    			add_binding_callback(() => ctx.div0_binding(div0, null));
    			insert(target, t1, anchor);
    			insert(target, div6, anchor);
    			append(div6, div1);
    			if_block0.m(div1, null);
    			add_binding_callback(() => ctx.div1_binding_1(div1, null));
    			append(div6, t2);
    			append(div6, div5);
    			append(div5, div4);
    			append(div4, div2);
    			add_binding_callback(() => ctx.div2_binding(div2, null));
    			append(div4, t3);
    			append(div4, div3);
    			if (if_block1) if_block1.m(div3, null);
    			add_binding_callback(() => ctx.div3_binding(div3, null));
    		},

    		p: function update(changed, ctx) {
    			if (changed.items) {
    				ctx.div0_binding(null, div0);
    				ctx.div0_binding(div0, null);
    			}

    			if (current_block_type === (current_block_type = select_block_type(ctx)) && if_block0) {
    				if_block0.p(changed, ctx);
    			} else {
    				if_block0.d(1);
    				if_block0 = current_block_type(ctx);
    				if (if_block0) {
    					if_block0.c();
    					if_block0.m(div1, null);
    				}
    			}

    			if (changed.items) {
    				ctx.div1_binding_1(null, div1);
    				ctx.div1_binding_1(div1, null);
    			}
    			if (changed.items) {
    				ctx.div2_binding(null, div2);
    				ctx.div2_binding(div2, null);
    			}

    			if (ctx.log.length > 0) {
    				if (if_block1) {
    					if_block1.p(changed, ctx);
    				} else {
    					if_block1 = create_if_block(ctx);
    					if_block1.c();
    					if_block1.m(div3, null);
    				}
    			} else if (if_block1) {
    				if_block1.d(1);
    				if_block1 = null;
    			}

    			if (changed.items) {
    				ctx.div3_binding(null, div3);
    				ctx.div3_binding(div3, null);
    			}
    		},

    		i: noop,
    		o: noop,

    		d: function destroy(detaching) {
    			if (detaching) {
    				detach(div0);
    			}

    			ctx.div0_binding(null, div0);

    			if (detaching) {
    				detach(t1);
    				detach(div6);
    			}

    			if_block0.d();
    			ctx.div1_binding_1(null, div1);
    			ctx.div2_binding(null, div2);
    			if (if_block1) if_block1.d();
    			ctx.div3_binding(null, div3);
    			dispose();
    		}
    	};
    }

    let regex = /[?&]([^=#]+)=([^&#]*)/g;

    function timeout(ms) {
      return new Promise(resolve => setTimeout(resolve, ms));
    }

    function contextmenu_handler(e) {
    	return e.preventDefault();
    }

    function instance$1($$self, $$props, $$invalidate) {
    	

      let icons = new fontfaceobserver_standalone("Icons");

      let conf = {};
      let hash = location.hash;
      let url = window.location.href;
      let match;
      let game;
      let gameDiv;
      let gameLog;
      let menuDiv;
      let winDiv;
      let tooltip;
      let lettersLogged = 0;
      let menu = false;
      let winText;
      let log$1;
      let lang;

      log.subscribe(value => {
        $$invalidate('log', log$1 = value);
        $$invalidate('lettersLogged', lettersLogged = 0);
        if (gameLog) { gameLog.scrollTop = 1e6; $$invalidate('gameLog', gameLog); }
      });

      lang$2.subscribe(value => {
        $$invalidate('lang', lang = value);
        $$invalidate('log', log$1);
      });

      function translated(s) {
        let text = lang[s[0]];
        if (!text) return "-";
        if (s.length > 0) {
          for (let i in s) text = text.replace("{" + (i - 1) + "}", s[i]);
        }
        return text;
      }

      while ((match = regex.exec(url))) {
        try {
          conf[match[1]] = JSON.parse(match[2]); match; conf;
        } catch (e) {
          console.log("what is " + match[1] + "?");
        }
      }

      icons.load().then(() => {
        $$invalidate('game', game = new Game());
        game.onEnd = gameOver; $$invalidate('game', game);
        game.init([45, 45]);
        if (game.hasSave("0")) {
          game.load("0");
        } else {
          game.start(conf);
        }
        gameLog.style.height = gameDiv.clientHeight + "px"; $$invalidate('gameLog', gameLog);
        toggleMenu(true);
      });

      onMount(async () => {
        setInterval(() => {
          if (log$1 && log$1.length > 0) {
            let last = translated(log$1[log$1.length - 1]);
            if (last && lettersLogged < last.length) {
              $$invalidate('lettersLogged', lettersLogged =
                Math.ceil((last.length - lettersLogged) / 40) + lettersLogged);
              gameLog.scrollTop = gameLog.scrollHeight; $$invalidate('gameLog', gameLog);
            }
          }
        }, 10);
      });

      function toggleTooltip(text) {
        tooltip.innerHTML = text; $$invalidate('tooltip', tooltip);
        let classes = tooltip.classList;
        if (text) {
          classes.add("visible");
        } else {
          classes.remove("visible");
        }
      }

      window.addEventListener("mousemove", async e => {
        if (menu) return;

        if (Math.abs(e.movementY) + Math.abs(e.movementX) > 2) {
          toggleTooltip(null);
          await timeout(30);
        }

        if (tooltip) {
          tooltip.style.left = e.clientX + "px"; $$invalidate('tooltip', tooltip);
          tooltip.style.top = e.clientY + "px"; $$invalidate('tooltip', tooltip);
          if (game) {
            toggleTooltip(game.tooltip);
          }
        }
      });

      window.addEventListener("keydown", e => {
        if (e.code == "Escape") {
          if (winText) {
            $$invalidate('winText', winText = null);
          } else {
            toggleMenu(!menu);
          }
        }

        if (e.shiftKey && e.code == "KeyR") {
          game.start();
          toggleMenu(false);
        }

        if (e.shiftKey && e.code == "KeyL") {
          toggleLanguage();
        }

        if (e.code.substr(0, 5) == "Digit") {
          let slot = e.code.substr(5);
          if (e.shiftKey) {
            game.save(slot);
            toggleMenu(false);
          } else {
            if (game.hasSave(slot)) {
              game.load(slot);
              toggleMenu(false);
            } else {
              game.log("no_save_in", slot);
            }
          }
        }
      });

      function toggleMenu(on) {
        menu = on;
        game.paused = on; $$invalidate('game', game);
        menuDiv.style.opacity = on ? 1 : 0; $$invalidate('menuDiv', menuDiv);
        menuDiv.style["pointer-events"] = on ? "auto" : "none"; $$invalidate('menuDiv', menuDiv);
        if (on) {
          toggleTooltip(null);
        }

        if (!on) {
          $$invalidate('winText', winText = null);
        }
      }

      function save(slot) {
        game.save(slot);
        toggleMenu(false);
      }

      function load(slot) {
        game.load(slot);
        toggleMenu(false);
      }

      function newGame() {
        game.start(conf);
        toggleMenu(false);
      }

      async function gameOver(text) {
        toggleMenu(true);
        $$invalidate('winText', winText = text);
        await tick();
        winDiv.style.opacity = 0; $$invalidate('winDiv', winDiv);
        window.setTimeout(() => { const $$result = (winDiv.style.opacity = 1); $$invalidate('winDiv', winDiv); return $$result; }, 100);
        game.start(conf);
      }

    	function div0_binding($$node, check) {
    		tooltip = $$node;
    		$$invalidate('tooltip', tooltip);
    	}

    	function click_handler() {
    		const $$result = (winText = null);
    		$$invalidate('winText', winText);
    		return $$result;
    	}

    	function div1_binding($$node, check) {
    		winDiv = $$node;
    		$$invalidate('winDiv', winDiv);
    	}

    	function click_handler_1() {
    		return newGame();
    	}

    	function click_handler_2() {
    		return toggleMenu(false);
    	}

    	function click_handler_3({ slot }) {
    		return save(slot);
    	}

    	function click_handler_4({ slot }) {
    		return load(slot);
    	}

    	function div1_binding_1($$node, check) {
    		menuDiv = $$node;
    		$$invalidate('menuDiv', menuDiv);
    	}

    	function div2_binding($$node, check) {
    		gameDiv = $$node;
    		$$invalidate('gameDiv', gameDiv);
    	}

    	function div3_binding($$node, check) {
    		gameLog = $$node;
    		$$invalidate('gameLog', gameLog);
    	}

    	return {
    		game,
    		gameDiv,
    		gameLog,
    		menuDiv,
    		winDiv,
    		tooltip,
    		lettersLogged,
    		winText,
    		log: log$1,
    		lang,
    		translated,
    		toggleMenu,
    		save,
    		load,
    		newGame,
    		div0_binding,
    		click_handler,
    		div1_binding,
    		click_handler_1,
    		click_handler_2,
    		click_handler_3,
    		click_handler_4,
    		div1_binding_1,
    		div2_binding,
    		div3_binding
    	};
    }

    class App extends SvelteComponentDev {
    	constructor(options) {
    		super(options);
    		init(this, options, instance$1, create_fragment, safe_not_equal, []);
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
