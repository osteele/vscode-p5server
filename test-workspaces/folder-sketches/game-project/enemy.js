// Enemy class
class Enemy {
  constructor(x, y) {
    this.x = x;
    this.y = y;
    this.size = 20;
    this.speed = random(2, 4);
  }
  
  update() {
    this.y += this.speed;
  }
  
  display() {
    fill(255, 0, 0);
    noStroke();
    square(this.x - this.size / 2, this.y - this.size / 2, this.size);
  }
}