// Bouncing ball sketch with HTML integration
let balls = [];

function setup() {
  let canvas = createCanvas(600, 400);
  canvas.parent('sketch-container');
  
  // Start with one ball
  balls.push(new Ball(width / 2, height / 2));
  
  console.log('Bouncing ball sketch initialized');
}

function draw() {
  background(240);
  
  // Update and display all balls
  for (let ball of balls) {
    ball.update();
    ball.display();
  }
  
  // Show ball count
  fill(0);
  textAlign(LEFT);
  text(`Balls: ${balls.length}`, 10, 20);
}

function mousePressed() {
  // Add a new ball at mouse position
  if (mouseX > 0 && mouseX < width && mouseY > 0 && mouseY < height) {
    balls.push(new Ball(mouseX, mouseY));
    console.log(`Added ball #${balls.length} at (${mouseX}, ${mouseY})`);
  }
}

class Ball {
  constructor(x, y) {
    this.pos = createVector(x, y);
    this.vel = createVector(random(-5, 5), random(-5, 5));
    this.radius = random(10, 30);
    this.color = color(random(255), random(255), random(255));
  }
  
  update() {
    this.pos.add(this.vel);
    
    // Bounce off walls
    if (this.pos.x < this.radius || this.pos.x > width - this.radius) {
      this.vel.x *= -1;
    }
    if (this.pos.y < this.radius || this.pos.y > height - this.radius) {
      this.vel.y *= -1;
    }
    
    // Keep in bounds
    this.pos.x = constrain(this.pos.x, this.radius, width - this.radius);
    this.pos.y = constrain(this.pos.y, this.radius, height - this.radius);
  }
  
  display() {
    fill(this.color);
    noStroke();
    circle(this.pos.x, this.pos.y, this.radius * 2);
  }
}