// Main game file
let player;
let enemies = [];
let score = 0;
let gameOver = false;

function setup() {
  createCanvas(800, 600);
  player = new Player(width / 2, height - 50);
  console.log('Game initialized');
}

function draw() {
  background(20);
  
  if (!gameOver) {
    // Update player
    player.update();
    player.display();
    
    // Spawn enemies occasionally
    if (frameCount % 60 === 0) {
      enemies.push(new Enemy(random(width), -20));
    }
    
    // Update enemies
    for (let i = enemies.length - 1; i >= 0; i--) {
      enemies[i].update();
      enemies[i].display();
      
      // Check collision
      if (player.collides(enemies[i])) {
        gameOver = true;
        console.error('Game Over! Final score:', score);
      }
      
      // Remove off-screen enemies
      if (enemies[i].y > height + 20) {
        enemies.splice(i, 1);
        score++;
      }
    }
    
    // Display score
    fill(255);
    textSize(20);
    text(`Score: ${score}`, 10, 30);
  } else {
    // Game over screen
    textAlign(CENTER, CENTER);
    fill(255);
    textSize(40);
    text('GAME OVER', width / 2, height / 2 - 40);
    textSize(20);
    text(`Final Score: ${score}`, width / 2, height / 2);
    text('Press SPACE to restart', width / 2, height / 2 + 40);
    textAlign(LEFT, BASELINE);
  }
}

function keyPressed() {
  if (key === ' ' && gameOver) {
    // Reset game
    player = new Player(width / 2, height - 50);
    enemies = [];
    score = 0;
    gameOver = false;
    console.log('Game restarted');
  }
}