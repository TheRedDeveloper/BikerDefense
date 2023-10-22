// A cross-browser requestAnimationFrame
var requestAnimFrame = (function(){
    return window.requestAnimationFrame    ||
        window.webkitRequestAnimationFrame ||
        window.mozRequestAnimationFrame    ||
        window.oRequestAnimationFrame      ||
        window.msRequestAnimationFrame     ||
        function(callback){
            window.setTimeout(callback, 1000 / 60);
        };
})();

// Returns a random number between min (inclusive) and max (exclusive)
function getRandomArbitrary(min, max) {
  return Math.random() * (max - min) + min;
}

// Returns a random integer between min (included) and max (excluded)
// Using Math.round() will give you a non-uniform distribution!
function getRandomInt(min, max) {
  return Math.floor(Math.random() * (max - min)) + min;
}

// Create the canvas
var canvas = document.createElement("canvas");
var ctx = canvas.getContext("2d");
canvas.width = 1024;
canvas.height = 520;
document.body.appendChild(canvas);

// The main game loop
var lastTime;
function main() {
    var now = Date.now();
    var dt = (now - lastTime) / 1000.0;

    update(dt);
    render();

    lastTime = now;
    requestAnimFrame(main);
}

function init() {
    dragElement(document.querySelector(".card"))
    terrainPattern = ctx.createPattern(resources.get('img/terrain.png'), 'repeat');

	document.getElementById('play-again').addEventListener('click', ()=>location.reload());
    document.getElementById('drawT').addEventListener('click', buyTower);
    document.getElementById('drawU').addEventListener('click', buyUpgrade);
    document.getElementById('drawP').addEventListener('click', buyPowerUp);
	
    reset();
    lastTime = Date.now();
    main();
}

resources.load([
    'img/tower1.png',
    'img/tower2.png',
    'img/tower3.png',
    'img/tower4.png',
    'img/tower5.png',
	'img/sprites.png',
	'img/biker1.png',
	'img/biker2.png',
	'img/biker3.png',
	'img/bullet.png',
    'img/terrain.png'
]);
resources.onReady(init);

// Game state
var towers = [];
var bullets = [];
var enemies = [];
var explosions = [];
var gameTime = 0;
var isGameOver;
var terrainPattern;

var score = 0;
var coins = 0;
var towerCost = 1;
var upgradeCost = 4;
var powerUpCost = 10;

// Speed in pixels per second
var bulletSpeed = 350;
var enemySpeed = 50;

// Update game objects
function update(dt) {
    gameTime += dt;
    updateEntities(dt);
	
	// It gets harder over time by adding enemies using this
    // equation: 1-0.993^gameTime
    if (Math.random() < 1 - Math.pow(0.995, gameTime)) {
        switch (getRandomInt(0,4)) {
            case 0:	//left
                pos = [0, Math.random() * (canvas.height - 30)]
                break;
            case 1:	//top
                pos = [Math.random() * canvas.width, 0]
                break;
            case 2:	//bottom
                pos = [Math.random() * canvas.width, canvas.height - 30]
                break;
            default: //right
                pos = [canvas.width, Math.random() * (canvas.height - 30)]
                break;
        }
        let health = Math.ceil(Math.random() * Math.pow(1.001, gameTime))
        let sprite = new Sprite('img/biker'+Math.min(health,3)+'.png', [0, 0], [50, 50], 5, [0, 1]);
        enemies.push({ pos, sprite, health });
    }

    checkCollisions();
    document.getElementById("coins").innerHTML = coins + " 🪙";
    document.getElementById("score").innerHTML = score;
    document.getElementById("drawT").disabled = towerCost>coins
    document.getElementById("drawU").disabled = upgradeCost>coins
    document.getElementById("drawP").disabled = powerUpCost>coins
}

function updateEntities(dt) {
    // Update the towers sprite animation
    for(var i = 0; i < towers.length; i++) {
        var tower = towers[i];
        tower.sprite.update(dt);

        if (!isGameOver && Date.now() - tower.lastFire > 300/(tower.speed??1)) {
            var pi = Math.PI;
            var x = tower.pos[0] + tower.sprite.size[0] / 2;
            var y = tower.pos[1] + tower.sprite.size[1] / 2;
            k = getRandomArbitrary(-5 * pi, 5 * pi)
            if (Math.random()<0.1*(tower.aim??1)) {
                try{
                worstEnemy = enemies.toSorted((a,b)=>Math.hypot(a.pos[0]-512,a.pos[1]-260)-Math.hypot(b.pos[0]-512,b.pos[1]-260))[0];
                k = Math.atan((tower.pos[0]-worstEnemy.pos[0])/(tower.pos[1]-worstEnemy.pos[1]))+((worstEnemy.pos[1]-tower.pos[1])<0?pi:0)
                } catch {}
            }
            bullets.push({
                pos: [x, y],
                k,
                sprite: new Sprite('img/bullet.png', [0, 0], [24, 24]) 
            });
            tower.lastFire = Date.now();
        }
    }

    // Update all the bullets
    for (var i = 0; i < bullets.length; i++) {
        var bullet = bullets[i];

        var c = dt * bulletSpeed;
        var sin = Math.sin(bullet.k);        
        var cos = Math.cos(bullet.k);

        bullet.pos[0] += sin * c;
        bullet.pos[1] += cos * c;        

        // Remove the bullet if it goes offscreen
        if (bullet.pos[1] < 0 || bullet.pos[1] > canvas.height ||
            bullet.pos[0] > canvas.width) {
            
            bullets.splice(i, 1);
            i--;
        }
    }

    // Update all the enemies
    for (var i = 0; i < enemies.length; i++) {
        var x0 = enemies[i].pos[0];
        var y0 = enemies[i].pos[1];
        var x1 = canvas.width / 2
        var y1 = canvas.height / 2
        var c = enemySpeed * (1.5**enemies[i].health-.5) * dt;
        var l = Math.sqrt((x1 - x0) * (x1 - x0) + (y1 - y0) * (y1 - y0));
        
        enemies[i].pos[0] += (x1 - x0) * c / l;
        enemies[i].pos[1] += (y1 - y0) * c / l;
        
        enemies[i].sprite.update(dt);

        // Remove if offscreen
        if (enemies[i].pos[0] + enemies[i].sprite.size[0] < 0) {
            enemies.splice(i, 1);
            i--;
        }
    }

    // Update all the explosions
    for (var i = 0; i < explosions.length; i++) {
        explosions[i].sprite.update(dt);

        // Remove if animation is done
        if (explosions[i].sprite.done) {
            explosions.splice(i, 1);
            i--;
        }
    }
}

function addCard(name) {
    let cElem = document.createElement('div');
    cElem.innerText = name
    document.querySelector("#draggable-cards").append(cElem);
    dragElement(cElem)
}

// Collisions

function collides(x, y, r, b, x2, y2, r2, b2) {
    return !(r <= x2 || x > r2 || b <= y2 || y > b2);
}

function boxCollides(pos, size, pos2, size2) {
    return collides(pos[0], pos[1],
                    pos[0] + size[0], pos[1] + size[1],
                    pos2[0], pos2[1],
                    pos2[0] + size2[0], pos2[1] + size2[1]);
}

function checkCollisions() {
    // Run collision detection for all enemies and bullets
    for (var i = 0; i < enemies.length; i++) {
        var pos = enemies[i].pos;
        var size = enemies[i].sprite.size;

        for (var j = 0; j < bullets.length; j++) {
            var pos2 = bullets[j].pos;
            var size2 = bullets[j].sprite.size;

            if (boxCollides(pos, size, pos2, size2)) {
                // Remove the enemy
                enemies[i].health -= 1
                if (enemies[i].health < 1){
                    enemies.splice(i, 1);
                    i--;
                } else {
                    enemies[i].sprite.url = 'img/biker'+Math.min(enemies[i].health,3)+'.png'
                }
                // Add score
                score += 1;
                coins += 1;

                // Add an explosion
                explosions.push({
                    pos: pos,
                    sprite: new Sprite('img/sprites.png',
                                       [0, 117],
                                       [39, 39],
                                       16,
                                       [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12],
                                       null,
                                       true)
                });

                // Remove the bullet and stop this iteration
                bullets.splice(j, 1);
                break;
            }
        }

        if (boxCollides(pos, size, [canvas.width / 2, canvas.height / 2], [48,30])) {
            gameOver();	
        }
    }
}

// Draw everything
function render() {
    ctx.fillStyle = terrainPattern;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Render the towers, enemies, bullets, and explosions
    if (!isGameOver) {
        renderEntities(towers);
        renderEntities(enemies);
    }

    renderEntities(bullets);
    renderEntities(explosions);
}

function renderEntities(list) {
    for(var i=0; i<list.length; i++) {
        renderEntity(list[i]);
    }
}

function renderEntity(entity) {
    ctx.save();
    ctx.translate(entity.pos[0], entity.pos[1]);
    entity.sprite.render(ctx);
    ctx.restore();
}

// Game over
function gameOver() {
	document.getElementById('game-over').style.display = 'block';
    document.getElementById('game-over-overlay').style.display = 'block';
    isGameOver = true;
}

// Reset game to original state
function reset() {
	document.getElementById('game-over').style.display = 'none';
    document.getElementById('game-over-overlay').style.display = 'none';
    isGameOver = false;
    gameTime = 0;
    score = 0;

	towers = [];
    enemies = [];
    bullets = [];
}

function dragElement(elmnt) {
    var pos1 = 0, pos2 = 0, pos3 = 0, pos4 = 0;
    elmnt.onmousedown = dragMouseDown;
    function dragMouseDown(e) {
      e = e || window.event;
      e.preventDefault();
      // get the mouse cursor position at startup:
      pos3 = e.clientX;
      pos4 = e.clientY;
      document.onmouseup = closeDragElement;
      // call a function whenever the cursor moves:
      document.onmousemove = elementDrag;
    }
  
    function elementDrag(e) {
      e = e || window.event;
      e.preventDefault();
      // calculate the new cursor position:
      pos1 = pos3 - e.clientX;
      pos2 = pos4 - e.clientY;
      pos3 = e.clientX;
      pos4 = e.clientY;
      // set the element's new position:
      elmnt.setAttribute("data-trx",+(elmnt.dataset.trx??0)-pos1)
      elmnt.setAttribute("data-try",+(elmnt.dataset.try??0)-pos2)
      elmnt.style.transform = "translate(" + (elmnt.dataset.trx) + "px, " + (elmnt.dataset.try) + "px)";
    }
  
    function closeDragElement(e) {
      e = e || window.event;
      e.preventDefault();
      // stop moving when mouse button is released:
      if(e.clientX < 1024 && e.clientY < 520){
        switch(elmnt.innerText){
            case "Tower":
                towers.push({
                    pos: [e.clientX, e.clientY],
                    lastFire: Date.now(),
                    sprite: new Sprite('img/tower1.png', [0, 0], [38, 35], 8, [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15])
                });
                break;
            case "Aim":
                upgradee = towers.toSorted((a,b)=>Math.hypot(a.pos[0]-e.clientX,a.pos[1]-e.clientY)-Math.hypot(b.pos[0]-e.clientX,b.pos[1]-e.clientY))[0];
                upgradee.aim = (upgradee.aim??1)+1
                upgradee.sprite.url = "img/tower"+Math.min((upgradee.speed??0)+(upgradee.aim??0),5)+".png"
                break;
            case "Speed":
                upgradee = towers.toSorted((a,b)=>Math.hypot(a.pos[0]-e.clientX,a.pos[1]-e.clientY)-Math.hypot(b.pos[0]-e.clientX,b.pos[1]-e.clientY))[0];
                upgradee.speed = (upgradee.speed??1)+1
                upgradee.sprite.url = "img/tower"+Math.min((upgradee.speed??0)+(upgradee.aim??0),5)+".png"
                break;
            case "Erase":
                enemies.forEach((e)=>explosions.push({
                    pos: e.pos,
                    sprite: new Sprite('img/sprites.png',
                                       [0, 117],
                                       [39, 39],
                                       16,
                                       [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12],
                                       null,
                                       true)
                }))
                enemies = [];
                break;
        }
        elmnt.remove()
      }
      document.onmouseup = null;
      document.onmousemove = null;
    }
}

function buyTower() {
    if(coins >= Math.round(towerCost)) {
        coins -= Math.round(towerCost)
        towerCost += 3
        towerCost **= 1.1
        document.getElementById('drawT').innerText = "T -"+Math.round(towerCost)
        addCard("Tower")
    }
}

function buyUpgrade() {
    if(coins >= Math.round(upgradeCost)) {
        coins -= Math.round(upgradeCost)
        upgradeCost += 3
        upgradeCost **= 1.1
        document.getElementById('drawU').innerText = "U -"+Math.round(upgradeCost)
        addCard(["Aim","Speed"][Math.floor(Math.random()*2)])
    }
}

function buyPowerUp() {
    if(coins >= Math.round(powerUpCost)) {
        coins -= Math.round(powerUpCost)
        powerUpCost += 4
        powerUpCost **= 1.1
        document.getElementById('drawP').innerText = "P -"+Math.round(powerUpCost)
        addCard("Erase")
    }
}