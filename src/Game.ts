import {
  Display,
  RNG,
  DIRS,
  FOV,
  Scheduler,
  Engine,
  Path,
  Color
} from "rot-js/lib/index";
import Digger from "rot-js/lib/map/digger";
import { Room } from "rot-js/lib/map/features";
import Mob from "./Mob";
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
    let remove: number[];
    for (let mob of game.mobs) {
      remove = [];
      mob.scent = mob.scent.filter(tile => {
        tile.scent = Math.max(tile.scent - 0.05, 0.01);
        return tile.scent > 0.01;
      });
    }
  }
}

export class Tile {
  at: [number, number];
  cost: number;
  seen: number = 0;
  visible: number = 0;
  scent: number = 0;
  mob: Mob | null;
  constructor(public symbol: string) {
    this.cost = ["♠", "♣"].includes(symbol) ? 1e6 : 1;
  }
}



function add2d(a: number[], b: number[]) {
  return [a[0] + b[0], a[1] + b[1]];
}

function sub2d(a: number[], b: number[]) {
  return [a[0] - b[0], a[1] - b[1]];
}

export default class Game {
  grid: Tile[][];
  player: Mob;
  d: Display;
  engine: Engine;
  size: number[];
  displaySize: number[];
  mobs: Mob[] = [];
  rooms: Room[];
  hateBg: [number, number, number];
  playerRaging:boolean = false
  emptyTile = new Tile("♠");

  at(at: number[]) {
    return this.grid[at[0]][at[1]];
  }

  safeAt(at: number[]) {
    if (
      at[0] < 0 ||
      at[1] < 0 ||
      at[0] >= this.size[0] ||
      at[1] >= this.size[1]
    )
      return this.emptyTile;
    return this.grid[at[0]][at[1]];
  }

  constructor(w = 100, h = 100, options: { 
    displaySize?: number[],
    seed?:number
  } = {}) {
    game = this;

    RNG.setSeed(options.seed || 1);

    this.player = new Mob();
    this.size = [w, h];

    this.displaySize = options.displaySize || [60, 60];

    let d = (this.d = new Display({
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

    let scheduler = new Scheduler.Speed();
    scheduler.add(new Ticker(), true);
    for (let mob of this.mobs) {
      scheduler.add(mob, true);
    }
    this.engine = new Engine(scheduler);
    this.engine.start();

    this.player.lookAround();

    this.draw();
  }

  generateMap() {
    let w = this.size[0];
    let h = this.size[1];
    this.grid = new Array(w).fill(null).map(_ => []);
    
    let map = new Digger(w, h, {
      dugPercentage: 0.3,
      corridorLength: [2, 6],
      roomWidth: [3, 9],
      roomHeight: [3, 5]
    });

    map.create((x, y, what) => {
      let symbol = what ? ((x + y) % 2 ? "♠" : "♣") : " ";
      this.grid[x][y] = new Tile(symbol);
    });

    let rooms = (this.rooms = map.getRooms());

    let roomsRandom = RNG.shuffle(rooms);

    this.at(roomsRandom[0].getCenter()).symbol = "☨";

    this.player.at = roomsRandom[1].getCenter();

    let roses = 4;

    let monsters = 20;

    for (let i = 3; i < 3 + roses; i++) {
      let room = roomsRandom[i];
      this.at(room.getCenter()).symbol = "⚘";
    }

    for (let i = 3 + roses; i < 3 + roses + monsters; i++) {
      let room = roomsRandom[i];
      let monster = new Mob();
      monster.at = room.getCenter();
    }
  }

  bg(at: number[]) {
    let tile = this.safeAt(at);
    let bg: [number, number, number] = [0, 0, 0];
    if (tile.visible) {
      let b = 48 * tile.visible;
      bg = Color.add(bg, [b, b, b]);
    } else {
      if (!tile.seen && tile.scent == 0) {
        bg = this.hateBg;
      }
    }
    if (tile.scent > 0) {
      let scent = tile.scent
      let d = distance(at, this.player.at)
      /*scent -= distance(at, this.player.at) / 100
      scent -= (100 - this.player.rage) * 0.003
      scent = Math.max(0, scent)*/
      if(this.player.hate * 0.3 + 10 > d){
        bg = Color.add(bg, [
          128 * scent,
          0,
          0
        ]);
      }
    }
    return Color.toRGB(bg);
  }

  draw() {
    this.d.drawText(0, 0, "_".repeat(this.displaySize[1]));
    this.d.drawText(
      0,
      0,
      "%b{red}%c{red}" +
        "_".repeat((this.player.hate / this.displaySize[1]) * 100)
    );

    this.hateBg = Color.add(screenBg, [0.64 * this.player.hate, 0, 0]);

    //this.d.drawText(0,  0, Math.round(this.player.rage).toString())

    let half = [
      Math.floor(this.displaySize[0] / 2),
      Math.floor(this.displaySize[1] / 2)
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
          this.bg([x, y])
        );
      }


    for (let mob of game.mobs) {
      let tile = game.at(mob.at);
      if (tile.visible) {
        let mobDisplayAt = add2d(mob.at, delta);
        let c = "white"
        if(this.player == mob && this.playerRaging)
          c = "red"
        this.d.draw(
          mobDisplayAt[0],
          mobDisplayAt[1],
          this.player == mob ? "☻" : "☺",
          c,
          this.bg(mob.at)
        );
      }
    }
  }
}
