type Handler = (keyCode: number) => void

export class Keyboard {

  interval = 100
  pressed: { [key: string]: number } = {};
  subs: ((keyCode: number) => void)[] = []

  constructor() {
    window.addEventListener("keydown", this);
    window.addEventListener("keyup", this);
  }

  handleEvent(e:KeyboardEvent) {
    let code = e.keyCode
    if(e.type == "keydown"){
      if(!(code in this.pressed)){
        this.click(e.keyCode)
        this.pressed[code] = window.setInterval(() => this.click(e.keyCode), this.interval)
      }
    }
    if(e.type == "keyup"){
      window.clearInterval(this.pressed[code])
      delete this.pressed[code]
    }
  }

  click(keyCode:number){
    for(let s of this.subs){
      s(keyCode)
    }
  }

  sub(handler: Handler){
    this.subs.push(handler)
  }  

  unsub(handler: Handler){
    this.subs = this.subs.filter(s => {
      return s!=handler
    })
  }

  once(handler: Handler){
    let f = (keyCode:number) => {
      this.unsub(f)
      handler(keyCode)
    }
    this.sub(f)
  }

  isPressed(keyCode:number): boolean{
    return keyCode in this.pressed
  }
}

let keyboard = new Keyboard();

export default keyboard;
