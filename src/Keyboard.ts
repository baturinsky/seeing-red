type Handler = (keyCode: string) => void

export default class Keyboard {

  interval = 100
  pressed: { [key: string]: number } = {};
  subs: ((keyCode: string) => void)[] = []

  constructor(element:Element|Window) {
    element.addEventListener("keydown", this);
    element.addEventListener("keyup", this);
    element.addEventListener("mousedown", this);
    element.addEventListener("mouseup", this);
  }

  handleEvent(e:KeyboardEvent|MouseEvent) {
    let code
    let type

    if(e instanceof KeyboardEvent){
      code = e.code
      type = e.type=="keydown"?"down":"up"
    } else {
      code = "Click" + e.button
      type = e.type == "mousedown"?"down":"up"
    }

    if(type == "down"){
      if(!(code in this.pressed)){
        this.click(code)
        this.pressed[code] = window.setInterval(() => this.click(code), this.interval)
      }
    }
    if(type == "up"){
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
