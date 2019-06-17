import { DIRS, FOV, RNG, Scheduler, Engine, Path } from "rot-js/lib/index";
import { game, distance, Tile } from "./Game";
import Game from "./Game";

export default class Mob {
  at: number[];
  sees: number[][] = [];
  path: number[][] = [];
  scent: Tile[] = [];
  hate: number = 1;

  constructor() {
    game.mobs.push(this);
  }

  getSpeed() {
    if (this == game.player) {
      return 120 + this.hate;
    }
    return 100;
  }

  act() {
    if (this == game.player) {
      game.engine.lock();
      window.addEventListener("keydown", this);
    } else {
      if (this.path && this.path.length > 0) {
        this.goTo(this.path.shift());
      } else {
        this.path = [];
        let goal = RNG.getItem(game.rooms).getCenter();
        let pathfinder = new Path.AStar(
          goal[0],
          goal[1],
          (x, y) => game.at([x, y]).cost < 1000,
          { topology: 4 }
        );
        pathfinder.compute(this.at[0], this.at[1], (x, y) =>
          this.path.push([x, y])
        );
        this.path.shift();
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

    if (this != game.player) {
      this.leaveScent();
    }
  }

  die() {
    game.mobs = game.mobs.filter(m => m != this);
    this.tile().mob = null;
    game.engine._scheduler.remove(this);

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
      this.scent.push(tile);
    }
    tile.scent = 1;
  }

  handleEvent(e) {
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

    var code = e.keyCode;

    if (!(code in keyMap)) {
      return;
    }

    if (RNG.getUniform() < 0.3)
      game.playerRaging = this.hate / 100 > RNG.getUniform();

    if (game.playerRaging) {
      let nearestD = 1000;
      let nearestMob = null;
      for (let m of game.mobs) {
        if (m == game.player) continue;
        let d = distance(m.at, game.player.at);
        if (d < nearestD) {
          nearestD = d;
          nearestMob = m;
        }
      }

      if (nearestMob) {
        let pathfinder = new Path.AStar(
          nearestMob.at[0],
          nearestMob.at[1],
          (x, y) => game.at([x, y]).cost < 1000,
          { topology: 4 }
        );
        this.path = [];
        pathfinder.compute(this.at[0], this.at[1], (x, y) =>
          this.path.push([x, y])
        );
        this.goTo(this.path[1]);
      }
    } else {
      let kmc = keyMap[code];
      var diff = kmc == -1 ? [0, 0] : DIRS[8][kmc];
      let newAt = [this.at[0] + diff[0], this.at[1] + diff[1]];
      if (game.at(newAt).cost > 1000) {
        return;
      }
      this.goTo(newAt);
    }

    this.lookAround();

    window.removeEventListener("keydown", this);
    game.draw();
    game.engine.unlock();
  }

  enrage(dHate: number) {
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

    let dHate = game.playerRaging?-0.3:-0.15;
    let seesFlower = false;

    fov.compute(this.at[0], this.at[1], 20, (x, y, r, vis) => {
      this.sees.push([x, y]);
      let tile = game.at([x, y]);
      if (tile.symbol == "⚘" && r <= 10) seesFlower = true;
      if (tile.mob && tile.mob != game.player) {
        dHate += 15 / (r + 5);
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

    this.enrage(dHate);
  }
}
