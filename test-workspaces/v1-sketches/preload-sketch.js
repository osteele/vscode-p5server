// A p5.js 1.x sketch: it loads its asset in preload(), which p5.js 2 no longer
// calls. P5 Server includes the official compatibility add-on so that it keeps
// running, and offers to convert it.
let img;

function preload() {
  img = loadImage('cat.png');
}

function setup() {
  createCanvas(400, 400);
}

function draw() {
  background(220);
  image(img, 0, 0);
}
