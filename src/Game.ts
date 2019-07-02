import {
  Display,
  RNG,
  DIRS,
  FOV,
  Scheduler as Schedulers,
  Engine,
  Path,
  Color
} from "rot-js";
import Digger from "rot-js/lib/map/digger";
import Scheduler from "rot-js/lib/scheduler/scheduler";
import Mob from "./Mob";
export let game: Game;
import EasyStar from "easystarjs";
import lang from "./Lang";
import Keyboard from "./Keyboard";

let screenBg = Color.fromString("#180C24") as [number, number, number];
export function distance(a: number[], b: number[]) {
  let x = a[0] - b[0];
  let y = a[1] - b[1];
  return Math.sqrt(x * x + y * y);
}

class Milestones {

  serialise() {
    let s: any = {};
    Object.assign(s, this);
    return s;
  }

  deserialise(s: any) {
    Object.assign(this, s);
    return this;
  }
}

export class Animation {
  constructor(
    public at: number[],
    public mode: number = 1,
    public timer: number = 200,
    public interval: number = 50
  ) {
    this.run();
  }

  run() {
    window.setTimeout(() => {
      let on: boolean;
      this.timer -= this.interval;
      switch (this.mode) {
        case 1:
          on = this.timer % 250 < 150;
          game.drawAt(this.at, null, ([sym, fg, bg]) => [
            on ? sym : " ",
            fg,
            bg
          ]);
          break;
        case 2:
          on = this.timer % 400 < 200;
          game.drawAt(this.at, null, ([sym, fg, bg]) => [
            "!",
            on ? "red" : "white",
            bg
          ]);
          break;
      }

      if (this.timer > 0) {
        this.run();
      } else {
        game.drawAt(this.at);
      }
    }, this.interval);
  }
}

class Pathfinder {
  es = new EasyStar.js();

  setGrid() {
    let grid = game.grid.map(column => column.map(tile => tile.cost));
    this.es.setGrid(grid);
  }

  setGridFear() {
    let grid = game.grid.map(column => column.map(tile => tile.cost));
    let r = 16;
    let limit = [[0, 0], [0, 0]];
    for (let axis = 0; axis < 2; axis++) {
      limit[axis] = [
        Math.max(0, game.player.at[axis] - r),
        Math.min(game.options.size[axis], game.player.at[axis] + r)
      ];
    }

    for (let x = limit[0][0]; x < limit[0][1]; x++)
      for (let y = limit[1][0]; y < limit[1][1]; y++) {
        if (grid[x][y] == 1) {
          let d = distance(game.player.at, [x, y]);
          grid[x][y] = Math.max(1, 7 - Math.floor(Math.sqrt(d)));
        }
      }

    this.es.setGrid(grid);
  }

  constructor() {
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

  find(from: number[], to: number[]) {
    let path: number[][];
    this.es.findPath(from[1], from[0], to[1], to[0], p => {
      path = p ? p.map(at => [at.y, at.x]) : [];
    });
    this.es.calculate();
    return path;
  }
}

class Ticker {
  getSpeed() {
    return 100;
  }

  act() {
    game.time++;

    game.scent = game.scent.filter(tile => {
      tile.scent = Math.max(tile.scent - 0.05, 0.01);
      return tile.scent > 0.01;
    });

    for (let mob of game.mobs) {
      mob.actFixedInterval();
    }
  }
}

export class Tile {
  cost = 1;
  opaque = false;
  seen = 0;
  visible = 0;
  scent = 0;
  mob: Mob | null;
  also: any;

  static impassible = /[♠#]/;
  constructor(public symbol: string) {
    this.cost = symbol.match(Tile.impassible) ? 1e6 : 1;
    this.opaque = symbol.match(Tile.impassible)? true : false;
  }

  serialise() {
    let s: any = {};
    Object.assign(s, this);
    delete s.mob;
    return s;
  }

  deserialise(s: any) {
    Object.assign(this, s);
    if (this.scent > 0.01) {
      game.scent.push(this);
    }
    return this;
  }

  tooltip(at?: number[]) {
    if (!this.seen && !this.scent) return null;

    if (this.mob) {
      if (this.mob.isPlayer) return lang.me;
      else return lang.mob;
    }

    switch (this.symbol) {
      case "⚘":
        return lang.flower;
      case "♠":
        return lang.tree;
      case "<":
        return lang.exit;
      case ">":
        return lang.entrance;
      case "*":
        return lang.blood;
      case "b":
        return lang.blood_old;
      case "B":
        return lang.blood_trail;
      case "#":
        return lang.wall;
      case " ":
        if (this.scent > 0.1) return lang.smell;
        break;
    }
  }
}

function add2d(a: number[], b: number[]): [number, number] {
  return [a[0] + b[0], a[1] + b[1]];
}

function sub2d(a: number[], b: number[]): [number, number] {
  return [a[0] - b[0], a[1] - b[1]];
}

function eq2d(a: number[], b: number[]) {
  return a[0] == b[0] && a[1] == b[1];
}

export class Game {
  player: Mob;
  d: Display;
  engine: Engine;
  emptyTile = new Tile("♠");
  hateBg: [number, number, number];
  scent: Tile[] = [];
  scheduler: Scheduler;
  mouseOver: number[] = [0, 0];
  freeTiles: number[][];
  pathfinder = new Pathfinder();
  escapefinder = new Pathfinder();
  waitingForInput = true;
  lastKey: string;
  tooltip: string;
  keyboard: Keyboard;

  landmarks: number[][];
  grid: Tile[][];
  exits: number[][];
  killed: number = 0;
  milestones = new Milestones();

  mobs: Mob[] = [];
  seeingRed: boolean = false;
  won = false;
  time = 0;
  _log: string[] = [];
  onLog: (string) => void;

  flowersCollected = 0;

  serialise() {
    return {
      options: this.options,
      seeingRed: this.seeingRed,
      flowersCollected: this.flowersCollected,
      time: this.time,
      won: this.won,
      landmarks: this.landmarks,
      exits: this.exits,
      killed: this.killed,
      _log: this._log,
      milestones: this.milestones.serialise(),
      grid: this.grid.map(line => line.map(t => t.serialise())),
      mobs: this.mobs.map(m => m.serialise())
    };
  }

  deserialise(s: any) {
    this.options = s.options;
    this.seeingRed = s.seeingRed;
    this.flowersCollected = s.flowersCollected;
    this.time = s.time;
    this.won = s.won;
    this.landmarks = s.landmarks;
    this.exits = s.exits;
    (this.killed = s.killed), (this._log = s._log);
    this.scent = [];
    this.milestones = new Milestones().deserialise(s.milestones);
    this.grid = s.grid.map(line =>
      line.map(t => new Tile(t.symbol).deserialise(t))
    );
    this.findFreeTiles();
    this.mobs = s.mobs.map(m => new Mob().deserialise(m));
    this.initMobs();
    this.pathfinder.setGrid();
    this.escapefinder.setGridFear();
    this.waitingForInput = true;
    this.draw();
  }

  at(at: number[]) {
    return this.grid[at[0]][at[1]];
  }

  safeAt(at: number[]) {
    if (
      at[0] < 0 ||
      at[1] < 0 ||
      at[0] >= this.options.size[0] ||
      at[1] >= this.options.size[1]
    )
      return this.emptyTile;
    return this.grid[at[0]][at[1]];
  }

  constructor(
    public options: {
      displaySize?: number[];
      size?: number[];
      seed?: number;
      mobs?: number;
      flowers?: number;
      flowersNeeded?: number;
      emptiness?: number;
    } = {}
  ) {
    game = this;

    (window as any).gameState = this;

    options.size = options.size || [60, 60];
    options.emptiness = options.emptiness * 1 || 0.35;
    options.mobs = "mobs" in options ? options.mobs : 10;
    options.flowers = options.flowers * 1 || 6;
    options.flowersNeeded = options.flowersNeeded * 1 || options.flowers - 1;

    options.displaySize = options.displaySize || [45, 45];

    RNG.setSeed(options.seed || Math.random());
  }

  start() {
    this.player = new Mob();

    let d = (this.d = new Display({
      width: this.options.displaySize[0],
      height: this.options.displaySize[1],
      fontSize: 32,
      spacing: 0.6,
      forceSquareRatio: true,
      bg: "#180C24",
      fontFamily: "Icons"
    }));

    document.getElementById("game").appendChild(d.getContainer());

    this.generateMap();    

    this.scheduler = new Schedulers.Speed();
    this.engine = new Engine(this.scheduler);
    this.initMobs();
    this.engine.start();


    this.player.lookAround();

    window.addEventListener("keypress", e => this.keypress(e));
    d.getContainer().addEventListener("mousedown", e => this.onClick(e));
    d.getContainer().addEventListener("touchend", e => this.onClick(e));
    d.getContainer().addEventListener("mousemove", e => this.mousemove(e));

    this.keyboard = new Keyboard(window);
    this.keyboard.sub(this.onKeyboard.bind(this));

    game.draw();
  }

  addHut() {
    let hut = 
`         
 ####### 
 #     # 
 # bb  # 
 # bbbb# 
 # bbb # 
 ###b### 
    B    
   B     `.split("\n");

    let h = hut.length;
    let pat = this.player.at;

    for (let y = 0; y < h; y++) {
      let line = hut[y];
      let w = line.length;
      for (let x = 0; x < w; x++) {
        let sym = line[x];
        let tile = new Tile(sym);
        this.grid[pat[0] + x - 4][pat[1] + y - 4] = tile;
      }
    }
  }

  keypress(e: KeyboardEvent) {
    if (e.code.substr(0, 5) == "Digit") {
      let slot = e.code.substr(5);
      if (e.shiftKey) {
        localStorage.setItem(slot, JSON.stringify(this.serialise()));
        game.log("Save to " + slot);
      } else {
        let save = localStorage.getItem(slot);
        if (save) {
          this.deserialise(JSON.parse(save));
          game.log("Load from " + slot);
        } else {
          game.log("No save in " + slot);
        }
      }
    }
  }

  drawAtDisplay(displayAt: number[], bg?: string) {
    let { delta } = this.deltaAndHalf();

    let at = sub2d(displayAt, delta);

    if (eq2d(this.mouseOver, displayAt)) {
      bg = "#400";
    }

    this.d.draw(
      displayAt[0],
      displayAt[1],
      this.tileSym(at),
      this.tileFg(at),
      bg || this.tileBg(at)
    );
  }

  mousemove(e: MouseEvent) {
    let displayAt = this.d.eventToPosition(e);
    let outside =
      displayAt[1] <= 0 || displayAt[1] >= this.options.displaySize[1] - 1;
    if (outside) {
      this.tooltip = null;
      return;
    }

    let { delta } = this.deltaAndHalf();
    let at = sub2d(displayAt, delta);
    let tile = this.safeAt(at);
    this.tooltip = tile.tooltip(at);

    let old = this.mouseOver;
    this.mouseOver = displayAt;

    this.drawAtDisplay(old);
    this.drawAtDisplay(this.mouseOver);
  }

  initMobs() {
    this.scheduler.clear();
    this.scheduler.add(new Ticker(), true);
    for (let mob of this.mobs) {
      this.scheduler.add(mob, true);
      this.at(mob.at).mob = mob;
    }
  }

  findFreeTiles() {
    this.freeTiles = [];
    this.eachTile((at, t) => {
      if (t.cost < 1000) this.freeTiles.push(at);
    });
    return this.freeTiles;
  }

  generateMap() {
    let w = this.options.size[0];
    let h = this.options.size[1];
    this.grid = new Array(w).fill(null).map(_ => []);

    let map = new Digger(w, h, {
      dugPercentage: this.options.emptiness,
      corridorLength: [2, 6],
      roomWidth: [3, 6],
      roomHeight: [3, 6]
    });

    map.create((x, y, what) => {
      let symbol = what ? "♠" : " ";
      this.grid[x][y] = new Tile(symbol);
    });

    this.findFreeTiles();

    /*for(let at of this.freeTiles){
      if(RNG.getUniform() < 0.3){
        let tile = this.at(at)
        tile.symbol = "."
        tile.cost += 3
      }
    }*/

    let rooms = map.getRooms();

    let roomsRandom = RNG.shuffle(rooms);
    this.landmarks = rooms.map(r => r.getCenter());

    this.exits = [[1e6, 0], [-1e6, 0]];
    for (let at of this.freeTiles) {
      let t = this.at(at);
      if (t.symbol == " ") {
        if (at[0] < this.exits[0][0]) {
          this.exits[0] = at;
        }
        if (at[0] >= this.exits[1][0]) this.exits[1] = at;
      }
    }

    this.at(this.exits[0]).symbol = "<";
    this.at(this.exits[1]).symbol = ">";

    this.at(roomsRandom[0].getCenter()).symbol = "☨";

    //this.addHut();

    let freeLandmarks = this.landmarks.slice()

    for(let i=0; i<freeLandmarks.length;i++){
      let lm = freeLandmarks[i]
      if(lm[0] > 5 && lm[0] < this.options.size[0]-5 && lm[1] > 5 && lm[1] < this.options.size[1]-5){
        this.player.at = freeLandmarks[i].slice();
        freeLandmarks.splice(i,1)
        break;
      }
    }    

    this.addHut()

    f:for (let i = 0; i < this.options.flowers; i++) {
      while(freeLandmarks.length>0){
        let place = freeLandmarks.pop()
        if(this.at(place).symbol == " "){
          this.at(place).symbol = "⚘";  
          continue f
        }
      }
    }


    m:for (let i = 0; i < this.options.mobs; i++) {
      let monster = new Mob();
      while(freeLandmarks.length>0){
        let place = freeLandmarks.pop()
        if(this.at(place).symbol == " "){
          monster.at = place.slice();
          continue m;
        }
      }
      if(!monster.at)
        game.mobs.pop()
    }

    this.pathfinder.setGrid();

    game.log(lang.guide);
    game.log(lang.not_here);
  }

  tileBg(at: number[]) {
    let tile = this.safeAt(at);
    let bg: [number, number, number] = [0, 0, 0];
    let d = distance(at, this.player.at);
    let inScentRadius =
      d <
      7 +
        Math.max(
          Math.min(this.player.concentration, 10),
          this.player.hate * 0.1
        );

    if (!tile.seen && (!inScentRadius || tile.scent == 0)) {
      return Color.toRGB(this.hateBg);
    }

    if (tile.visible) {
      let b = 48 * tile.visible;
      bg = [b, b, b];
    }

    if (tile.scent > 0) {
      bg = Color.add(bg, [128 * (inScentRadius ? tile.scent : 0), 0, 0]);
      tile.seen = 1;
    }

    return Color.toRGB(bg);
  }

  tileFg(at: number[]) {
    let tile = this.safeAt(at);

    if (tile.mob && tile.visible) {
      if (tile.mob.isPlayer) {
        if (this.seeingRed) return "red";
        let redness = Math.min(200, this.killed * 20);
        return Color.toRGB([255, 255 - redness, 255 - redness]);
      } else {
        return "white";
      }
    }

    if (!tile.mob && tile.seen && tile.symbol == "♠") {
      RNG.setSeed(at[0] * 1000 + at[1] * 3);
      let shade = RNG.getUniformInt(150, 250);
      return Color.toRGB([shade, shade, shade]);
    }

    if (!tile.symbol.match(/[ ♠#_]/)) return "red";

    return null;
  }

  tileSym(at: number[]) {
    let tile = this.safeAt(at);

    if (tile.mob && tile.visible) {
      return tile.mob.isPlayer ? "☻" : "☺";
    }

    if (tile.visible || tile.seen) {
      if (tile.symbol == "♠") {
        RNG.setSeed(at[0] * 1000 + at[1] * 3);
        return RNG.getItem(["♠", "♣"]);
      }
      if (tile.symbol == "b" || tile.symbol == "B")
        return "*"
      return tile.symbol;
    }
    return " ";
  }

  deltaAndHalf() {
    const half = [0, 1].map(axis =>
      Math.floor(this.options.displaySize[axis] / 2)
    );
    const delta = [0, 1].map(axis => -this.player.at[axis] + half[axis]);
    return { delta, half };
  }

  drawAt(
    at: number[],
    delta?: number[],
    filter?: (symFgBg: string[]) => string[]
  ) {
    if (!delta) delta = this.deltaAndHalf().delta;
    let displayAt = add2d(at, delta);
    let tile = this.safeAt(at);
    let [sym, fg, bg] = [this.tileSym(at), this.tileFg(at), this.tileBg(at)];

    if (filter) {
      [sym, fg, bg] = filter([sym, fg, bg]);
    }

    if (tile != this.emptyTile)
      this.d.draw(displayAt[0], displayAt[1], sym, fg, bg);
  }

  draw() {
    this.d.clear();

    this.d.drawText(
      0,
      0,
      "%b{red}%c{red}" +
        "-".repeat(
          Math.round((this.player.hate * this.options.displaySize[0]) / 100)
        )
    );

    this.hateBg = this.seeingRed
      ? [255, 0, 0]
      : Color.add(screenBg, [0.64 * this.player.hate, 0, 0]);

    const { delta, half } = this.deltaAndHalf();

    for (
      let x = this.player.at[0] - half[0];
      x < this.player.at[0] + half[0] + 1;
      x++
    ) {
      for (
        let y = this.player.at[1] - half[1] + 1;
        y < this.player.at[1] + half[1];
        y++
      ) {
        this.drawAt([x, y], delta);
      }
    }

    this.d.drawText(
      0,
      this.options.displaySize[1] - 1,
      "%b{#180C24}%c{#180C24}" + " ".repeat(this.options.displaySize[0])
    );

    let statusLine = "";


    if (this.won) {
      statusLine += " %c{red}" + lang.game_complete;
    } else if (this.allFlowersCollected()) {
      statusLine += " %c{gray}visit %c{red}☨";
    } else {
      if(this.milestones["flower_first"]){
        for (let i = 0; i < Math.max(this.options.flowersNeeded, this.flowersCollected); i++) {
          statusLine += i < this.flowersCollected ? "%c{red}⚘" : "%c{gray}⚘";
        }
      }
    }

    if(this.milestones["mob_first"]){
      statusLine +=
        "%c{gray} " +
        this.mobs.map(m => (m.alive ? "%c{white}☺" : "%c{red}*")).join("") + " ";
    }

    this.d.drawText(0, this.options.displaySize[1] - 1, statusLine);
  }

  onKeyboard(code) {
    this.lastKey = code;

    if (Mob.meansStop(code)) this.player.stop();

    if (this.waitingForInput) this.playerAct();
  }

  displayToGrid(at: number[]) {
    let { delta } = this.deltaAndHalf();
    return sub2d(at, delta);
  }

  onClick(e: MouseEvent | TouchEvent) {
    e.preventDefault();

    if (e instanceof MouseEvent) {
      if (e.button == 2) {
        this.onKeyboard("Space");
        return;
      }
    }

    this.click();
  }

  click() {
    if (game.player.hasPath()) {
      game.player.stop();
      return;
    }

    let to = this.displayToGrid(this.mouseOver);

    let tile = this.safeAt(to);

    if (eq2d(to, game.player.at)) {
      game.player.path = [game.player.at.slice()];
    } else {
      if (tile.cost > 1000) {
        let nearest = this.freeTiles
          .map(at => ({ at: at as [number, number], d: distance(at, to) }))
          .reduce((prev, cur) => (cur.d < prev.d ? cur : prev), {
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

    if (this.waitingForInput) this.playerAct();
  }

  allFlowersCollected() {
    return this.flowersCollected == this.options.flowersNeeded;
  }

  eachTile(hook: (at: number[], tile: Tile) => boolean | void) {
    let [w, h] = this.options.size;
    for (let x = 0; x < w; x++)
      for (let y = 0; y < w; y++) if (hook([x, y], this.grid[x][y])) return;
  }

  log(text: string, ...params:string[]) {
    console.log(params);
    if(text in lang)
      text = lang[text];
    if(params){
      for(let i in params)
        text = text.replace("{" + i + "}", params[i])
    }
    this._log.push(text.trim().replace(/(?:\r\n|\r|\n)/g, "<br/>"));
    if (this.onLog) {
      this.onLog(text);
    }
  }

  alertOnce(id: string) {
    if (this.milestones[id]) return;
    this.player.stop();
    this.milestones[id] = 1;
    this.log(lang[id]);
  }

  playerAct() {
    let moveMade = this.player.playerAct();
    game.draw();
    if (moveMade) {
      if (this.seeingRed || this.player.hasPath()) {
        this.waitingForInput = false;
        window.setTimeout(() => {
          this.waitingForInput = true;
          game.engine.unlock();
        }, 50);
      } else {
        game.engine.unlock();
      }
    }
  }
}

//♠♣⚘☻☺😁😞😐

/*
    let roomsByX = rooms.sort(r => r.getCenter()[0]);

    this.exits = [
      [roomsByX[0].getLeft() - 1, roomsByX[0].getCenter()[1]],
      [
        roomsByX[roomsByX.length - 1].getRight() + 1,
        roomsByX[roomsByX.length - 1].getCenter()[1]
      ]
    ];*/
