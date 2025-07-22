// Simple p5.js sketch - draws a moving circle
let x = 0;

function setup() {
  createCanvas(400, 400);
  console.log('Simple circle sketch started');
}

function draw() {
  background(220);
  
  // Draw a circle that moves across the screen
  fill(255, 0, 0);
  circle(x, height / 2, 50);
  
  x += 2;
  if (x > width + 25) {
    x = -25;
  }
}