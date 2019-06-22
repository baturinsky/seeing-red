import { DIRS, FOV, RNG, Path } from "rot-js/lib/index";
import { game, distance } from "./Game";

let keyMap = {};
keyMap["Numpad8"] = 0;
keyMap["Numpad9"] = 1;
keyMap["Numpad6"] = 2;
keyMap["Numpad3"] = 3;
keyMap["Numpad2"] = 4;
keyMap["Numpad1"] = 5;
keyMap["Numpad4"] = 6;
keyMap["Numpad7"] = 7;
keyMap["Numpad5"] = -1;

export default class Mob {
  at: number[];
  sees: number[][] = [];
  path: number[][];
  hate: number = 0;
  alive: boolean = true;
  concentration = 0;

  serialise() {
    return {
      hate: this.hate,
      alive: this.alive,
      concentration: this.concentration,
      at: this.at,
      path: this.path,
      isPlayer: game.player == this
    };
  }

  deserialise(s: any) {
    this.hate = s.hate;
    this.alive = s.alive;
    this.concentration = s.concentration;
    this.at = s.at;
    this.path = s.path;
    if (s.isPlayer) game.player = this;
    return this;
  }

  constructor() {
    game.mobs.push(this);
  }

  getSpeed() {
    let speed = 100;
    if (this == game.player) {
      speed = 120 + this.hate;
    }
    return speed;
  }

  act() {
    if (this == game.player) {
      if (game.seeingRed || this.path) {
        this.playerAct(game.seeingRed?"rampage":"path");
        game.engine.lock();
        window.setTimeout(() => game.engine.unlock(), 50);
      } else {
        game.waitForInput();
      }
    } else {
      if (this.path && this.path.length > 0) {
        this.goTo(this.path.shift());
      } else {
        this.path = [];
        let goal = RNG.getItem(game.landmarks);
        this.path = this.findPathTo(goal)
      }
    }
  }

  tile() {
    return game.at(this.at);
  }

  goTo(newAt: number[]) {
    let tile = this.tile();

    let targetMob = game.at(newAt).mob;
    if (targetMob) {
      if (targetMob == game.player) return;
      if (this == game.player) {
        targetMob.die();
        this.hate = 0;
      } else {
        if (RNG.getUniform() < 0.5) return;
        else {
          targetMob.at = this.at.slice(0, 2);
          tile.mob = targetMob;
        }
      }
    }

    if (tile.mob == this) tile.mob = null;
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
    } else {
      this.leaveScent();
    }
  }

  die() {
    this.alive = false;

    this.tile().mob = null;
    game.scheduler.remove(this);

    var fov = new FOV.PreciseShadowcasting(
      (x, y) => game.safeAt([x, y]).cost < 1000
    );
    fov.compute(this.at[0], this.at[1], 3, (x, y, r, vis) => {
      let tile = game.at([x, y]);
      if (tile.symbol == " ") tile.symbol = "*";
    });
  }

  leaveScent() {
    let tile = game.at(this.at);
    tile.mob = this;
    if (tile.scent <= 0.01) {
      game.scent.push(tile);
    }
    tile.scent = 1;
  }

  findNearestMob() {
    let nearestMob = game.mobs
      .map(m => ({ mob: m, d: (m==game.player || !m.alive)?1e6 : distance(m.at, game.player.at) }))
      .reduce((prev, cur) => (cur.d < prev.d ? cur : prev), {
        mob: null,
        d: 1e6
      });

    return nearestMob.mob;
  }

  findPathTo(at:number[]){
    let pathfinder = new Path.AStar(
      at[0],
      at[1],
      (x, y) => game.at([x, y]).cost < 1000,
      { topology: 8 }
    );
    let path = [];
    pathfinder.compute(this.at[0], this.at[1], (x, y) =>
      path.push([x, y])
    );
    if(path)
      path.shift()
    return path
  }

  playerAct(code: string | null): boolean {
    if (code == "rampage") {
      this.path = null
      let nearestMob = this.findNearestMob();

      if (nearestMob) {
        let path = this.findPathTo(nearestMob.at)
        if (path[0])
          this.goTo(path[0]);
      }

      this.lookAround();
      return true;

    } else if(code == "path") {
      if(this.path.length == 0)
        this.path = null;
      
      if(this.path){
        this.goTo(this.path.shift())
        this.lookAround();
        for(let t of this.sees){
          let m = game.at(t).mob
          if(m && m!=this)
            this.path = null
        }
        return true;
      } else {
        return false;
      }

    } else {

      if (!(code in keyMap)) {
        return false;
      }

      let kmc = keyMap[code];

      if (kmc == -1) {
        this.stay();
      } else {
        this.concentration = 0;
      }

      var diff = kmc == -1 ? [0, 0] : DIRS[8][kmc];
      let newAt = [this.at[0] + diff[0], this.at[1] + diff[1]];
      if (game.at(newAt).cost > 1000) {
        return true;
      }
      this.goTo(newAt);
    }

    this.lookAround();

    return true;
  }

  stay() {
    this.concentration++;
    this.changeHateBy(-0.5);
  }

  changeHateBy(dHate: number) {
    this.hate = Math.min(Math.max(0, this.hate + dHate), 100);
  }

  lookAround() {
    for (let coord of this.sees) {
      game.at(coord).visible = 0;
    }

    let seeThroughR = 4;
    for (let x = -seeThroughR; x <= seeThroughR; x++)
      for (let y = -seeThroughR; y <= seeThroughR; y++) {
        let tile = game.safeAt([this.at[0] + x, this.at[1] + y]);
        if (tile != game.emptyTile) tile.seen = 1;
      }

    var fov = new FOV.PreciseShadowcasting(
      (x, y) => game.safeAt([x, y]).cost < 1000
    );

    this.sees = [];

    let dHate = game.seeingRed ? -0.5 : -0.3;
    let seesFlower = false;

    fov.compute(this.at[0], this.at[1], 20, (x, y, r, vis) => {
      this.sees.push([x, y]);
      let tile = game.at([x, y]);
      if (tile.symbol == "⚘" && r <= 10) seesFlower = true;
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
      } else {
        dHate += -3;
      }
    }

    this.changeHateBy(dHate);

    if (
      RNG.getUniform() < 0.3 ||
      game.player.hate == 100 ||
      game.player.hate == 0
    )
      game.seeingRed = this.hate / 100 > RNG.getUniform();

    game.draw();
  }

  actFixedInterval() {}
}
