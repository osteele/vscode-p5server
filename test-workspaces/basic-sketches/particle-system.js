// Particle system example
let particles = [];

function setup() {
  createCanvas(600, 400);
  colorMode(HSB);
  console.info('Particle system initialized');
}

function draw() {
  background(0, 0.1);
  
  // Add new particles
  for (let i = 0; i < 3; i++) {
    particles.push(new Particle(width / 2, height / 2));
  }
  
  // Update and display particles
  for (let i = particles.length - 1; i >= 0; i--) {
    let p = particles[i];
    p.update();
    p.display();
    
    if (p.isDead()) {
      particles.splice(i, 1);
    }
  }
  
  // Display particle count
  fill(255);
  noStroke();
  text(`Particles: ${particles.length}`, 10, 20);
}

class Particle {
  constructor(x, y) {
    this.pos = createVector(x, y);
    this.vel = createVector(random(-5, 5), random(-5, 5));
    this.lifespan = 255;
    this.hue = random(360);
  }
  
  update() {
    this.pos.add(this.vel);
    this.lifespan -= 2;
  }
  
  display() {
    noStroke();
    fill(this.hue, 100, 100, this.lifespan / 255);
    circle(this.pos.x, this.pos.y, 12);
  }
  
  isDead() {
    return this.lifespan <= 0;
  }
}