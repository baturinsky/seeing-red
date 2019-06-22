type Handler = (keyCode: string) => void

export class Keyboard {

  interval = 100
  pressed: { [key: string]: number } = {};
  subs: ((keyCode: string) => void)[] = []

  constructor() {
    window.addEventListener("keydown", this);
    window.addEventListener("keyup", this);
  }

  handleEvent(e:KeyboardEvent) {
    let code = e.code
    if(e.type == "keydown"){
      if(!(code in this.pressed)){
        this.click(e.code)
        this.pressed[code] = window.setInterval(() => this.click(e.code), this.interval)
      }
    }
    if(e.type == "keyup"){
      window.clearInterval(this.pressed[code])
      delete this.pressed[code]
    }
  }

  click(code:string){
    for(let s of this.subs){
      s(code)
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
    let f = (code:string) => {
      this.unsub(f)
      handler(code)
    }
    this.sub(f)
  }

  isPressed(keyCode:number): boolean{
    return keyCode in this.pressed
  }

  clear(){
    this.subs = []
  }
}

let keyboard = new Keyboard();

export default keyboard;
