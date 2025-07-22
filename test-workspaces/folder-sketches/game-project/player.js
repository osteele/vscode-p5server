// Player class
class Player {
  constructor(x, y) {
    this.x = x;
    this.y = y;
    this.size = 30;
    this.speed = 5;
  }
  
  update() {
    // Move with arrow keys
    if (keyIsDown(LEFT_ARROW)) {
      this.x -= this.speed;
    }
    if (keyIsDown(RIGHT_ARROW)) {
      this.x += this.speed;
    }
    
    // Keep on screen
    this.x = constrain(this.x, this.size / 2, width - this.size / 2);
  }
  
  display() {
    fill(0, 255, 0);
    noStroke();
    circle(this.x, this.y, this.size);
  }
  
  collides(enemy) {
    let d = dist(this.x, this.y, enemy.x, enemy.y);
    return d < (this.size + enemy.size) / 2;
  }
}