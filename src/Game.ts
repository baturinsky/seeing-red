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
import Mob from "./Mob";
import keyboard from "./Keyboard";
import Scheduler from "rot-js/lib/scheduler/scheduler";
export let game: Game;

let screenBg = Color.fromString("#180C24") as [number, number, number];
export function distance(a: number[], b: number[]) {
  let x = a[0] - b[0];
  let y = a[1] - b[1];
  return Math.sqrt(x * x + y * y);
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
  cost: number;
  seen: number = 0;
  visible: number = 0;
  scent: number = 0;
  mob: Mob | null;
  constructor(public symbol: string) {
    this.cost = ["♠", "♣"].includes(symbol) ? 1e6 : 1;
  }

  serialise() {
    let s:any = {};
    Object.assign(s, this)
    delete s.mob;
    return s;
  }

  deserialise(s:any) {
    Object.assign(this, s)
    if(this.scent > 0.01){
      game.scent.push(this)
    }
    return this;
  }

}

function add2d(a: number[], b: number[]) {
  return [a[0] + b[0], a[1] + b[1]];
}

function sub2d(a: number[], b: number[]) {
  return [a[0] - b[0], a[1] - b[1]];
}

export class Game {
  player: Mob;
  d: Display;
  engine: Engine;
  emptyTile = new Tile("♠");
  hateBg: [number, number, number];
  scent: Tile[] = [];
  scheduler:Scheduler

  landmarks: number[][];
  grid: Tile[][];

  mobs: Mob[] = [];
  seeingRed: boolean = false;
  won = false;
  time = 0;

  flowersCollected = 0;
  flowers: number[][] = [];

  serialise() {
    return {
      options : this.options,
      seeingRed: this.seeingRed,
      flowersCollected: this.flowersCollected,
      time: this.time,
      won: this.won,
      landmarks: this.landmarks,
      flowers: this.flowers,
      grid: this.grid.map(line => line.map(t => t.serialise())),
      mobs: this.mobs.map(m => m.serialise())
    }
  }

  deserialise(s:any){
    this.options = s.options
    this.seeingRed = s.seeingRed
    this.flowersCollected = s.flowersCollected
    this.time = s.time
    this.won = s.won
    this.landmarks = s.landmarks
    this.flowers = s.flowers
    this.scent = []
    this.grid = s.grid.map(line => line.map(t => new Tile(t.symbol).deserialise(t)))
    this.mobs = s.mobs.map(m=> new Mob().deserialise(m))    
    this.schedule()
    this.draw()
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
      emptiness?: number;
    } = {}
  ) {
    game = this;
    
    console.log(this);
    (window as any).gameState = this;

    RNG.setSeed(options.seed || Math.random());

    this.player = new Mob();
    options.size = options.size || [60, 60];
    options.emptiness = options.emptiness * 1 || 0.35;
    options.mobs = options.mobs * 1 || 10;
    options.flowers = options.flowers * 1 || 4;

    options.displaySize = options.displaySize || [60, 60];

    let d = (this.d = new Display({
      width: options.displaySize[0],
      height: options.displaySize[1],
      fontSize: 20,
      spacing: 0.6,
      forceSquareRatio: true,
      bg: "#180C24",
      fontFamily: "Icons"
    }));
    document.getElementById("game").appendChild(d.getContainer());

    this.generateMap();

    this.scheduler = new Schedulers.Speed();
    this.engine = new Engine(this.scheduler);
    this.schedule();
    this.engine.start();
    
    this.player.lookAround();    
    
    window.addEventListener("keypress", e => this.keypress(e));
  }

  keypress(e: KeyboardEvent) {
    if (e.code.substr(0, 5) == "Digit") {
      let slot = e.code.substr(5);
      if (e.shiftKey) {
        localStorage.setItem(slot, JSON.stringify(this.serialise()))
        console.log("Save to " + slot)
      } else {
        let save = localStorage.getItem(slot)
        if(save){
          console.log("Load from " + slot)
          this.deserialise(JSON.parse(save))
        } else {
          console.log("No save in " + slot)
        }
      }
    }
  }

  schedule(){
    this.scheduler.clear()
    this.scheduler.add(new Ticker(), true);
    for (let mob of this.mobs) {
      this.scheduler.add(mob, true);
    }
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
      let symbol = what ? ((x + y) % 2 ? "♠" : "♣") : " ";
      this.grid[x][y] = new Tile(symbol);
    });

    let rooms = map.getRooms();

    this.landmarks = rooms.map(r => r.getCenter());

    let roomsRandom = RNG.shuffle(rooms);

    this.at(roomsRandom[0].getCenter()).symbol = "☨";

    this.player.at = roomsRandom[1].getCenter();

    for (let i = 3; i < 3 + this.options.flowers; i++) {
      let room = roomsRandom[i];
      let c = room.getCenter();
      this.flowers.push(c);
      this.at(c).symbol = "⚘";
    }

    for (
      let i = 3 + this.options.flowers;
      i < 3 + this.options.flowers + this.options.mobs;
      i++
    ) {
      let room = roomsRandom[i];
      let monster = new Mob();
      monster.at = room.getCenter();
    }
  }

  tileBg(at: number[]) {
    let tile = this.safeAt(at);
    let bg: [number, number, number] = [0, 0, 0];
    let d = distance(at, this.player.at);
    let inScentRadius =
      Math.max(
        Math.min(this.player.concentration, 10),
        this.player.hate * 0.1
      ) +
        7 >
      d;

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

  draw() {
    this.d.drawText(0, 0, "_".repeat(this.options.displaySize[1]));
    this.d.drawText(
      0,
      0,
      "%b{red}%c{red}" +
        "_".repeat((this.player.hate / this.options.displaySize[1]) * 100)
    );

    this.hateBg = this.seeingRed
      ? [255, 0, 0]
      : Color.add(screenBg, [0.64 * this.player.hate, 0, 0]);

    //this.d.drawText(0,  0, Math.round(this.player.rage).toString())

    let half = [
      Math.floor(this.options.displaySize[0] / 2),
      Math.floor(this.options.displaySize[1] / 2)
    ];
    let delta = [0, 0];
    for (let i of [0, 1]) {
      delta[i] = -this.player.at[i] + half[i];
    }

    for (
      let x = this.player.at[0] - half[0];
      x < this.player.at[0] + half[0];
      x++
    )
      for (
        let y = this.player.at[1] - half[1] + 1;
        y < this.player.at[1] + half[1] - 1;
        y++
      ) {
        let tile = this.safeAt([x, y]);
        let c = tile.visible || tile.seen ? tile.symbol : " ";

        let displayAt = add2d([x, y], delta);
        let bg = tile.seen ? "#222" : "black";
        this.d.draw(
          displayAt[0],
          displayAt[1],
          c,
          ["♠", "♣", "."].includes(c) ? null : "red",
          this.tileBg([x, y])
        );
      }

    for (let mob of game.mobs) {
      if (!mob.alive) continue;
      let tile = game.at(mob.at);
      if (tile.visible) {
        let mobDisplayAt = add2d(mob.at, delta);
        let c = "white";
        if (this.player == mob && this.seeingRed) c = "red";
        this.d.draw(
          mobDisplayAt[0],
          mobDisplayAt[1],
          this.player == mob ? "☻" : "☺",
          c,
          this.tileBg(mob.at)
        );
      }
    }

    this.d.drawText(
      0,
      this.options.displaySize[1] - 1,
      "%b{#180C24}%c{#180C24}" + "_".repeat(this.options.displaySize[0])
    );

    let statusLine = "use NUMPAD ";

    statusLine +=
      "%c{gray}avoid? " +
      this.mobs.map(m => (m.alive ? "%c{white}☺" : "%c{red}*")).join("");

    if (this.won) {
      statusLine += " %c{red}GAME COMPLETE";
    } else if (this.allFlowersCollected()) {
      statusLine += " %c{gray}visit %c{red}☨";
    } else {
      statusLine +=
        " %c{gray}collect " +
        this.flowers
          .map(t => (this.at(t).symbol == "⚘" ? "%c{gray}⚘" : "%c{red}⚘"))
          .join("");
    }

    this.d.drawText(0, this.options.displaySize[1] - 1, statusLine);
  }

  waitForInput(){
    game.engine.lock();
    keyboard.once(this.onKeyboard.bind(this));
  }

  onKeyboard(code) {    
    if (this.player.playerAct(code)) 
      game.engine.unlock();
    else
      keyboard.once(this.onKeyboard.bind(this));
  }

  allFlowersCollected() {
    return this.flowersCollected == this.flowers.length;
  }
}
