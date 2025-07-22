// Interactive p5.js sketch - follows mouse
function setup() {
  createCanvas(windowWidth, windowHeight);
  console.log('Interactive sketch loaded');
  console.log('Move your mouse to interact');
}

function draw() {
  background(0, 20);
  
  // Draw circles at mouse position
  noStroke();
  fill(mouseX % 255, mouseY % 255, 200);
  circle(mouseX, mouseY, 50);
}

function mousePressed() {
  console.log(`Mouse clicked at: ${mouseX}, ${mouseY}`);
}

function windowResized() {
  resizeCanvas(windowWidth, windowHeight);
}