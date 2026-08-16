// Another p5.js 1.x sketch, using the curve functions that p5.js 2 renamed to
// the spline family. curveVertex needs four points before it draws a segment:
// the first and last act as control points.
function setup() {
  createCanvas(400, 400);
  noFill();
  stroke(0);
}

function draw() {
  background(220);
  beginShape();
  curveVertex(84, 91);
  curveVertex(84, 91);
  curveVertex(152, 233);
  curveVertex(288, 141);
  curveVertex(288, 141);
  endShape();
}
