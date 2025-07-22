// This sketch has runtime errors for testing console output
let myArray = [1, 2, 3];

function setup() {
  createCanvas(400, 400);
  console.log('Setup complete');
  console.warn('This sketch will generate errors');
}

function draw() {
  background(220);
  
  // This will cause an error every 60 frames
  if (frameCount % 60 === 0) {
    // TypeError: Cannot read property 'x' of undefined
    let nonExistent = undefined;
    console.log(nonExistent.x);
  }
  
  // This will cause an error when clicked
  if (mouseIsPressed) {
    // ReferenceError: undefinedFunction is not defined
    undefinedFunction();
  }
  
  // Array index out of bounds (won't throw but demonstrates bad practice)
  let value = myArray[10];
  text(`Array value: ${value}`, 10, 20);
}