import { DIRS, FOV, RNG, Color } from "rot-js/lib/index";
import { game, distance, Animation } from "./Game";
import lang from "./Lang";
import { throws } from "assert";

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

const WARY = 30,
  AFRAID = 60,
  PANIC = 100;

export default class Mob {

  static MOB = 0;
  static PLAYER = 1;
  static BLUE_ONI = 2;
  static RED_ONI = 3;
  static ELDER = 4;

  at: number[];
  sees: number[][] = [];
  path: number[][];
  hate: number = 0;
  fear: number = 0;
  alive: boolean = true;
  concentration = 0;
  seesEnemies = false;
  freeze:number = 0;
  emote?: string;

  isPlayer() {
    return game.player == this;
  }

  isGuard() {
    return this.type == Mob.RED_ONI || this.type == Mob.BLUE_ONI || this.type == Mob.ELDER
  }

  serialise() {
    let s: any = {};
    Object.assign(s, this);
    return s
  }

  deserialise(s: any) {
    Object.assign(this, s)
    if(s.type == Mob.PLAYER)
      game.player = this;
    return this;
  }

  static meansStop(code: string) {
    return keyMap[code] == -1;
  }

  constructor(public type = Mob.MOB) {
    game.mobs.push(this);
  }

  getSpeed() {
    let speed = 100;
    if (this.isPlayer()) {
      speed = 120 + this.hate;
    } else if(this.isGuard){
      return 120;
    }
    return speed;
  }

  act() {
    if(!this.alive){
      console.log("zombie");
      console.log(this);
    }

    if(this.freeze>0){
      this.freeze -= this.getSpeed();
      return;
    }
    
    if(this.isGuard() && !this.at){
      let tile = game.at(game.exits[0]);
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
    } else {
      if (this.at) this.mobAct();
    }
  }

  tile() {
    return game.at(this.at);
  }

  fight(target:Mob){
    console.log("FIGHT");
    console.log(this);
    console.log(target);
    let win:boolean
    if(target.type == Mob.BLUE_ONI){
      win = this.hate < RNG.getUniformInt(1,100) + 20      
      game.log(win?lang.blue_victory:lang.blue_lose)
    } else if(target.type == Mob.RED_ONI) {
      console.log(this.hate, RNG.getUniformInt(1,100) - 20);
      win = this.hate > RNG.getUniformInt(1,100) - 20
      game.log(win?lang.red_victory:lang.red_lose)
    } else {
      if(game.killed > 0){
        win = false
        game.log(lang.elder_lose)
      } else {
        return;
      }
    }
    game.log(win?lang.death:lang.lose)
    if(win) {
      target.die();
    } else
      this.die()
  }

  goTo(newAt: number[]) {
    let tile = this.tile();
    this.concentration = 0;

    let targetMob = game.at(newAt).mob;
    if (targetMob) {
      if (this.isPlayer()) {
        if(targetMob.isGuard()){
          this.fight(targetMob)
          return
        } else {
          targetMob.die();
        }
      } else {
        if(targetMob.isPlayer() && this.isGuard()){
          targetMob.fight(this)
          return
        } else {
          if (RNG.getUniform() < 0.5) return;
          else {
            targetMob.at = this.at.slice(0, 2);
            tile.mob = targetMob;
            targetMob.reroute()
          }
        }
      }
    }

    if (tile.mob == this) tile.mob = null;
    this.at = newAt.slice(0, 2);
    tile = this.tile();
    tile.mob = this;

    if (this.isPlayer()) {
      if (tile.symbol == "⚘") {
        tile.symbol = " ";
        game.flowersCollected++;
        game.log(
          lang.collected,
          game.flowersCollected + "/" + game.options.flowersNeeded
        );
        if (game.flowersCollected == game.options.flowersNeeded) {
          game.log(lang.collected_all);
        }
        if (
          game.flowersCollected >= game.options.flowersNeeded &&
          game.flowersCollected % 2 == 0
        ) {
          game.log(lang.collected_even);
        }
      }
      /*if (tile.symbol == "☨" && game.allFlowersCollected()) {
        game.won = true;
      }*/
      if (tile.symbol == "b" && game.allFlowersCollected()) {
        game.end()
      }
    } else {
      this.leaveScent();
    }
  }

  die() {
    this.alive = false;
    game.scheduler.remove(this);
    this.tile().mob = null;

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

    console.log(this);
    console.log("dies");

    if(this.isPlayer()){
      this.lookAround();
      game.draw();
      game.complete = true;
      game.engine.lock();      
      return
    } else {
      game.player.hate = 0;
      game.seeingRed = false;
    }

    game.log(lang.death);

    if (!this.isPlayer()) {
      game.killed++;
    }
    
  }

  leaveScent() {
    let tile = game.at(this.at);
    tile.mob = this;
    if (tile.scent <= 0.01) {
      game.scent.push(tile);
    }
    tile.scent = 0.5 + Math.min(1, this.fear / 100);
  }

  findNearestMob() {
    let nearestMob = game.mobs
      .map(m => {
        return {
          mob: m,
          d:
            m.isPlayer() || !m.alive || !m.at
              ? 1e6
              : distance(m.at, game.player.at)
        };
      })
      .reduce((prev, cur) => (cur.d < prev.d ? cur : prev), {
        mob: null,
        d: 1e6
      });

    return nearestMob.mob;
  }

  pathFinderUsed(){
    if(this.isPlayer() || this.isGuard() || this.fear < WARY || !this.tile().visible)
      return game.pathfinder;
    else
      return game.escapefinder;
  }

  findPathTo(to: number[]) {
    let finder = this.pathFinderUsed();
    let path = finder.find(this.at, to);
    if (path) path.shift();
    return path;
  }

  reroute(){
    if(this.hasPath()){
      this.path = this.pathFinderUsed().find(this.at, this.path.pop())
    }
  }

  seesOthers() {
    for (let at of this.sees) {
      let tile = game.at(at);
      if (tile.mob && tile.mob != this) {
        return tile.mob;
      }
    }
    return null;
  }

  waiting(){
    return this.path && this.path[0] && this.path[0][0] == this.at[0] && this.path[0][1] == this.at[1]
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
      this.stopWhenMeetEnemies();

      if (!this.hasPath()) this.stop();

      if (this.hasPath()) {
        if (this.waiting()) {
          this.stay();
        } else {
          this.goTo(this.path.shift());
        }
      } else {
        return false;
      }
    } else {
      let code = game.lastKey;
      delete game.lastKey;

      if (!(code in keyMap)) {
        return false;
      }

      let kmc = keyMap[code];

      if (kmc == -1) {
        this.stay();
      } else {
        var diff = kmc == -1 ? [0, 0] : DIRS[8][kmc];
        let newAt = [this.at[0] + diff[0], this.at[1] + diff[1]];
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
  }

  setPath(to: number[]) {
    this.path = this.findPathTo(to);
  }

  mobAct() {
    
    if(this.isGuard()){
      this.fear = 0;
      if(this.at && game.player.seesEnemies){
        this.setPath(game.player.at)
      }
    }

    if (this.path && this.path.length > 0) {
      if (this.tile().visible) {
        this.path = this.findPathTo(this.path.pop());
      }
      if (this.path && this.path.length > 0) this.goTo(this.path.shift());
      
      if(!this.alive)
        return;

      let tile = this.tile();
      if (tile.symbol == "*") {
        this.fear += 5;
      }

      if (tile.symbol == "<" && !this.hasPath()) {
        this.leave()
      }
    } else {
      this.path = [];
      let goal: number[];
      let leaving = RNG.getUniform() < game.options.despawn + Math.max(0, this.fear - AFRAID) / 100;
      if (leaving) goal = RNG.getItem(game.exits);
      else goal = RNG.getItem(game.landmarks);
      this.path = this.findPathTo(goal);
    }
  }

  leave(){
    this.tile().mob = null;
    this.at = null;
    this.path = null;
    game.panic += this.fear;
  }

  stay() {
    this.concentration++;
    if (this.isPlayer() && this.concentration > 5 && this.hate == 0)
      game.alertOnce("calm");
    this.changeHateBy(-0.5);
  }

  changeHateBy(dHate: number) {
    this.hate = Math.min(Math.max(0, this.hate + dHate), 100);
    if (this.hate >= 25) {
      game.alertOnce("rage");
    }
    if (this.hate >= 50) {
      game.alertOnce("rage_more");
    }
  }

  stopWhenMeetEnemies() {
    let seen = this.seesOthers();
    if (seen && !this.seesEnemies && this.hasPath()) {
      this.stop();
      game.alertOnce("mob_first_" + seen.type);
      new Animation([seen.at[0], seen.at[1] - 1], 2, { duration: 500, interval:100 });
    }

    this.seesEnemies = seen ? true : false;
  }

  tooltip() {
    if (this.isPlayer()) {
      return lang.me;
    } else {
      let afraid =
        this.fear < WARY
          ? null
          : this.fear < AFRAID
          ? lang.mob_wary
          : this.fear < PANIC
          ? lang.mob_afraid
          : lang.mob_fleeing;
      return lang.mob + (afraid ? "<br/>" + afraid : "");
    }
  }

  lookAtMe() {
    let dFear = game.player.hate / 10 + (game.seeingRed ? 10 : 0);
    dFear *= 1 + game.killed;
    if (this.fear < AFRAID && this.fear + dFear >= AFRAID) {
      game.log(lang.mob_startled);
      this.emote = "!";
    }
    if (this.fear < PANIC && this.fear + dFear >= PANIC) {
      game.log(lang.mob_flees);
      this.emote = "⚡";
    }
    this.fear += dFear;
    if(this.type == Mob.ELDER && game.killed == 0){
      if(distance(this.at, game.player.at) <= 3){
        game.end(lang.ending_true);
      }
    }
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

    let dHate = game.seeingRed ? -0.3 : -0.2;
    let seesFlower = false;
    let seesMobs = false;

    fov.compute(this.at[0], this.at[1], 20, (x, y, r, vis) => {
      this.sees.push([x, y]);
      let tile = game.at([x, y]);
      if (tile.symbol == "⚘" && r <= 10) seesFlower = true;
      if (tile.mob && !tile.mob.isPlayer()) {
        tile.mob.lookAtMe();
        seesMobs = true;
        game.alertOnce("mob_first_"+tile.mob.type);
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
      } else {
        dHate += -3;
      }
    }

    this.changeHateBy(Math.min(10, dHate * game.options.hateGain));

    if (
      game.letterRead < game.flowersCollected &&
      !seesMobs &&
      ((RNG.getUniform() < 0.1 && this.hate == 0) || seesFlower)
    ) {
      game.readNextLetter();
    }

    let wasSeeingRed = game.seeingRed;

    if (
      RNG.getUniform() < 0.3 ||
      game.player.hate == 100 ||
      game.player.hate == 0
    ) {
      game.seeingRed = (this.hate - 50) / 50 > RNG.getUniform();
      if (wasSeeingRed != game.seeingRed)
        game.log(game.seeingRed ? lang.seeing_red : lang.seeing_red_end);
    }

    game.escapefinder.setGridFear();
  }

  hasPath() {
    return this.path && this.path.length > 0;
  }

  stop() {
    this.path = null;
  }

  sym(){
    return ['☺', '☻', 'g', 'G', 'e'][this.type]    
  }

  fg() {
    if (this.isPlayer()) {
      if (game.seeingRed) return "red";
      let redness = Math.min(200, game.killed * 20);
      return Color.toRGB([255, 255 - redness, 255 - redness]);
    } else {
      if(this.isGuard()){
        if (this.type == Mob.BLUE_ONI || (this.type == Mob.ELDER && game.killed == 0))
          return "white";
        else
          return "red";
      }
      let brightness = Math.max(128, 255 - this.fear);
      return Color.toRGB([255, brightness, brightness]);
    }
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
