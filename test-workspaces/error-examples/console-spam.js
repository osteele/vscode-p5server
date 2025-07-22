// This sketch generates lots of console output for testing
let messageCount = 0;

function setup() {
  createCanvas(400, 400);
  console.log('Console spam test started');
  console.info('This will generate many messages');
  console.warn('Use this to test console performance');
}

function draw() {
  background(220);
  
  // Log messages frequently
  if (frameCount % 5 === 0) {
    console.log(`Frame ${frameCount}: Regular log message ${messageCount++}`);
  }
  
  // Different log levels
  if (frameCount % 30 === 0) {
    console.info('📊 Info: Performance check');
    console.warn('⚠️ Warning: High message rate');
    console.error('❌ Error: This is a test error (not real)');
  }
  
  // Visual feedback
  fill(0);
  textAlign(CENTER, CENTER);
  text(`Messages sent: ${messageCount}`, width / 2, height / 2);
  text(`Frame: ${frameCount}`, width / 2, height / 2 + 20);
  
  // Burst mode on click
  if (mouseIsPressed) {
    for (let i = 0; i < 10; i++) {
      console.log(`Burst message ${i}: Mouse at (${mouseX}, ${mouseY})`);
    }
  }
}