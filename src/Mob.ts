import { DIRS, FOV, RNG, Path } from "rot-js/lib/index";
import { game, distance, Animation } from "./Game";

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
keyMap["Space"] = -1;

export default class Mob {
  at: number[];
  sees: number[][] = [];
  path: number[][];
  hate: number = 0;
  fear: number = 0;
  alive: boolean = true;
  concentration = 0;
  seesEnemies = false

  get isPlayer() {
    return this == game.player
  }

  serialise() {
    return {
      hate: this.hate,
      fear: this.fear,
      alive: this.alive,
      concentration: this.concentration,
      at: this.at,
      path: this.path,
      isPlayer: this.isPlayer
    };
  }

  static meansStop(code:string){
    return keyMap[code] == -1
  }

  deserialise(s: any) {
    this.hate = s.hate;
    this.fear = s.fear;
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
    if (this.isPlayer) {
      speed = 120 + this.hate;
    }
    return speed;
  }

  act() {
    if (this.isPlayer) {
      game.engine.lock()
      game.playerAct()
    } else {
      this.mobAct();
    }
  }


  tile() {
    return game.at(this.at);
  }

  goTo(newAt: number[]) {
    let tile = this.tile();

    let targetMob = game.at(newAt).mob;
    if (targetMob) {
      if (targetMob.isPlayer) return;
      if (this.isPlayer) {
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

    if (this.isPlayer) {

      if (this.tile().symbol == "⚘") {
        this.tile().symbol = " ";        
        game.flowersCollected++;
        game.log("collected", game.flowersCollected + "/" + game.options.flowersNeeded);
        if(game.flowersCollected == game.options.flowersNeeded){
          game.log("collected_all")
        }
        if(game.flowersCollected >= game.options.flowersNeeded && game.flowersCollected%2 == 0){
          game.log("collected_even")
        }
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

    game.log("death")

    if(!this.isPlayer){
      game.killed ++;
    }

    this.tile().mob = null;
    game.scheduler.remove(this);

    var fov = new FOV.PreciseShadowcasting(
      (x, y) => !game.safeAt([x, y]).opaque
    );
    
    fov.compute(this.at[0], this.at[1], 3, (x, y, r, vis) => {
      let tile = game.at([x, y]);
      if (tile.symbol == " ") {
        tile.symbol = "*";
        tile.cost += 2;
      }
    });
    game.pathfinder.setGrid()
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
      .map(m => ({
        mob: m,
        d: m.isPlayer || !m.alive ? 1e6 : distance(m.at, game.player.at)
      }))
      .reduce((prev, cur) => (cur.d < prev.d ? cur : prev), {
        mob: null,
        d: 1e6
      });

    return nearestMob.mob;
  }

  findPathTo(to: number[]) {
    let finder = this.isPlayer ? game.pathfinder : game.escapefinder;
    let path = finder.find(this.at, to);    
    if(path)
      path.shift()
    return path;
  }

  seesOthers(){
    for(let at of this.sees){
      let tile = game.at(at);
      if(tile.mob && tile.mob != this){
        return tile.mob
      }
    }
    return null;
  }

  playerAct(): boolean {

    if (game.seeingRed) {
      this.stop();
      let nearestMob = this.findNearestMob();

      if (nearestMob) {
        let path = this.findPathTo(nearestMob.at);
        if (path[0]) this.goTo(path[0]);
      }
      
    } else if (this.path) {
      this.stopWhenMeetEnemies()

      if (!this.hasPath())
        this.stop();

      if (this.hasPath()) {
        if(this.path[0][0] == this.at[0] && this.path[0][1] == this.at[1]){
          this.stay()
          /*if(this.hate == 0){
            this.path.shift()
          }*/
        } else {
          this.goTo(this.path.shift());
        }
      } else {
        return false;
      }
    } else {
      let code = game.lastKey
      delete game.lastKey

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
        return false;
      }
      this.goTo(newAt);
    }

    this.lookAround();
    return true;

  }

  setPath(to:number[]){
    this.path = this.findPathTo(to);
  }

  mobAct() {
    if (this.path && this.path.length > 0) {  
      if(this.tile().visible){
        this.path = this.findPathTo(this.path.pop())
      }
      if(this.path && this.path.length > 0)
        this.goTo(this.path.shift());
    } else {
      this.path = [];
      let goal = RNG.getItem(game.landmarks);
      this.path = this.findPathTo(goal);
    }
  }

  stay() {
    this.concentration++;
    if(this.isPlayer && this.concentration > 5 && this.hate == 0)
      game.alertOnce("calm")
    this.changeHateBy(-0.5);
  }

  changeHateBy(dHate: number) {
    this.hate = Math.min(Math.max(0, this.hate + dHate), 100);
    if(this.hate >= 25){
      game.alertOnce("rage")
    }
    if(this.hate >= 50){
      game.alertOnce("rage_more")
    }
  }

  stopWhenMeetEnemies(){
    let seen = this.seesOthers()
    if(seen && !this.seesEnemies && this.hasPath()){
      this.stop();
      new Animation([seen.at[0], seen.at[1]-1], 2, 500)
    }

    this.seesEnemies = seen?true:false;
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
      (x, y) => !game.safeAt([x, y]).opaque
    );

    this.sees = [];

    let dHate = game.seeingRed ? -0.5 : -0.3;
    let seesFlower = false;

    fov.compute(this.at[0], this.at[1], 20, (x, y, r, vis) => {
      this.sees.push([x, y]);
      let tile = game.at([x, y]);
      if (tile.symbol == "⚘" && r <= 10) seesFlower = true;
      if (tile.mob && !tile.mob.isPlayer) {
        game.alertOnce("mob_first")
        dHate += 10 / (r + 5);
      }
      tile.visible = (vis * (20 - r)) / 20;
      tile.seen = 1;
    });

    if (this.tile().scent > 0.1) {
      dHate += this.tile().scent * 2;
      game.alertOnce("smell_first")
    }

    if (seesFlower) {
      if (dHate > 0) {
        game.alertOnce("flower_mob_first")
        dHate *= 2;
      } else {
        game.alertOnce("flower_first")
        dHate += -3;
      }
    }

    this.changeHateBy(dHate);

    let wasSeeingRed = game.seeingRed

    if (
      RNG.getUniform() < 0.3 ||
      game.player.hate == 100 ||
      game.player.hate == 0
    ) {
      game.seeingRed = (this.hate - 50) / 50 > RNG.getUniform();
      if(wasSeeingRed != game.seeingRed)
        game.log(game.seeingRed?"seeing_red":"seeing_red_end")
    }

    game.escapefinder.setGridFear();
  }

  hasPath(){
    return this.path && this.path.length>0;
  }

  stop(){
    this.path = null
  }

  actFixedInterval() {}
}

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