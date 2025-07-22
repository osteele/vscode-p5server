// Pattern generator with custom HTML/CSS styling
let angle = 0;
let colorScheme = 0;

function setup() {
  let canvas = createCanvas(400, 400);
  canvas.parent('sketch-holder');
  angleMode(DEGREES);
  console.log('Pattern generator ready');
}

function draw() {
  background(255);
  translate(width / 2, height / 2);
  
  for (let i = 0; i < 12; i++) {
    push();
    rotate(angle + i * 30);
    
    // Choose color based on scheme
    if (colorScheme === 0) {
      stroke(100 + i * 10, 126, 234);
    } else if (colorScheme === 1) {
      stroke(234, 100 + i * 10, 126);
    } else {
      stroke(126, 234, 100 + i * 10);
    }
    
    strokeWeight(3);
    noFill();
    
    // Draw pattern
    for (let j = 0; j < 5; j++) {
      let size = 20 + j * 30;
      rect(-size/2, -size/2, size, size);
    }
    
    pop();
  }
  
  angle += 0.5;
}

// Global functions for button controls
function resetPattern() {
  angle = 0;
  console.log('Pattern reset');
}

function changeColors() {
  colorScheme = (colorScheme + 1) % 3;
  console.log('Color scheme changed to:', colorScheme);
}