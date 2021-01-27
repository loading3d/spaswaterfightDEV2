/// <reference path="js/babylon.max.js" />
/// <reference path="js/socket.js" />
var canvas;
var engine;
var scene;
var isWPressed = false;
var isSPressed = false;
var isAPressed = false;
var isDPressed = false;
var isBPressed = false;
document.addEventListener("DOMContentLoaded", connectToServer);

var socket;
var Game = {};
var enemies = {};

function connectToServer() {
    socket = io.connect( { transports: ['websocket'], upgrade:false });
    socket.on("connect", function () {
        console.log("connction established successfully");
        
        socket.on("GetYourID", function (data) {
            Game.id = data.id;
            startGame();
            socket.emit("ThankYou", {});
        });

        socket.on("AnotherTankCreated", function (data) {
            createTank(scene, data);
        });

        socket.on("AnotherTankMoved", function (data) {
            var tank = enemies[data.id];
            tank.setState(data);        
        });

        window.onbeforeunload = function () {
            socket.emit("IGoAway", Game.id);
            socket.disconnect();
        }

        socket.on("AnotherWentAway", function (data) {            
            var tank = enemies[data.id];
            tank.dispose();
            delete enemies[data.id];        
        });

        socket.on("AnotherBalloonLaunched", function (positionPrimitives) { 
            enemyFire(positionPrimitives);
        });

    });
}

function startGame() {
    canvas = document.getElementById("renderCanvas");
    engine = new BABYLON.Engine(canvas, true);
    scene = createScene();
    var tank = scene.getMeshByName("HeroTank");
    var toRender = function () {
        tank.move();
        tank.fire();
        scene.render();
    }
    engine.runRenderLoop(toRender);
}

var createScene = function () {
    
    var scene = new BABYLON.Scene(engine);
    scene.enablePhysics();
    var ground = CreateGround(scene);
    var freeCamera = createFreeCamera(scene);
    var tank = createTank(scene);
    var followCamera = createFollowCamera(scene, tank);
    scene.activeCamera = followCamera;
    createLights(scene);
    return scene;
};

function CreateGround(scene) {
    var ground = new BABYLON.Mesh.CreateGroundFromHeightMap("ground", "images/hmap1.png", 2000, 2000, 20, 0, 1000, scene, false, OnGroundCreated);
    function OnGroundCreated() {
        var groundMaterial = new BABYLON.StandardMaterial("groundMaterial", scene);
        groundMaterial.diffuseTexture = new BABYLON.Texture("images/grass.jpg", scene);
        ground.material = groundMaterial;
        ground.checkCollisions = true;
        ground.physicsImpostor = new BABYLON.PhysicsImpostor(ground, BABYLON.PhysicsImpostor.HeightmapImpostor, { mass: 0 }, scene);
    }
    return ground;
}

function createLights(scene) {
    var light0 = new BABYLON.DirectionalLight("dir0", new BABYLON.Vector3(-.1, -1, 0), scene);
    var light1 = new BABYLON.DirectionalLight("dir1", new BABYLON.Vector3(-1, -1, 0), scene);

}
function createFreeCamera(scene) {
    var camera = new BABYLON.FreeCamera("freeCamera", new BABYLON.Vector3(0, 0, 0), scene);
    camera.attachControl(canvas);
    camera.position.y = 50;
    camera.checkCollisions = true;
    camera.applyGravity = true;
    camera.keysUp.push('w'.charCodeAt(0));
    camera.keysUp.push('W'.charCodeAt(0));
    camera.keysDown.push('s'.charCodeAt(0));
    camera.keysDown.push('S'.charCodeAt(0));
    camera.keysRight.push('d'.charCodeAt(0));
    camera.keysRight.push('D'.charCodeAt(0));
    camera.keysLeft.push('a'.charCodeAt(0));
    camera.keysLeft.push('A'.charCodeAt(0));    
    return camera;
}

function createFollowCamera(scene, target) {
    var camera = new BABYLON.FollowCamera("tankFollowCamera", target.position, scene, target);
    camera.radius = 20; // how far from the object to follow
    camera.heightOffset = 4; // how high above the object to place the camera
    camera.rotationOffset = 180; // the viewing angle
    camera.cameraAcceleration = .1; // how fast to move
    camera.maxCameraSpeed = 5; // speed limit
    return camera;
}
function createTank(scene, data) {
    var tank = new BABYLON.MeshBuilder.CreateBox("HeroTank", { height: 1, depth: 6, width: 6 }, scene);
    var tankMaterial = new BABYLON.StandardMaterial("tankMaterial", scene);
    tankMaterial.diffuseColor = new BABYLON.Color3.Red;
    tankMaterial.emissiveColor = new BABYLON.Color3.Blue;
    tank.material = tankMaterial;
    tank.position.y += 2;
    tank.speed = 1;

    //var boxParams = { height: 0.5, width: 3, depth: 3 };
    //var boxImpostorParams = { mass: 1, restitution: 0, friction: 0 };
    //tank.physicsImpostor = new BABYLON.PhysicsImpostor(tank, BABYLON.PhysicsImpostor.BoxImpostor, boxImpostorParams, scene);

    tank.frontVector = new BABYLON.Vector3(0, 0, 1);

    tank.state = {
        id: Game.id,
        x: tank.position.x,
        y: tank.position.y,
        z: tank.position.z,
        rX: tank.rotation.x,
        rY: tank.rotation.y,
        rZ: tank.rotation.z
    }

    tank.setState = function(data)
    {
        tank.position.x = data.x;
        tank.position.y = data.y;
        tank.position.z = data.z;
        tank.rotation.x = data.rX;
        tank.rotation.y = data.rY;
        tank.rotation.z = data.rZ;
    }

    if (data) {
        tankMaterial.diffuseColor = new BABYLON.Color3.Yellow;
        tankMaterial.emissiveColor = new BABYLON.Color3.Yellow;
        enemies[data.id] = tank;
        tank.setState(data);
    }
    else {
        socket.emit("IWasCreated", tank.state);
    }

    tank.move = function () {
        var notifyServer = false;
        var yMovement = 0;
        if (tank.position.y > 2) {
            tank.moveWithCollisions(new BABYLON.Vector3(0, -2, 0));
            notifyServer = true;
        }
        
        if (isWPressed) {
            tank.moveWithCollisions(tank.frontVector.multiplyByFloats(tank.speed, tank.speed, tank.speed));
            notifyServer = true;
        }
        if (isSPressed) {
            tank.moveWithCollisions(tank.frontVector.multiplyByFloats(-1 * tank.speed, -1 * tank.speed, -1 * tank.speed));
            notifyServer = true;    
        }
        if (isAPressed) {
            tank.rotation.y -= .1;
            tank.frontVector = new BABYLON.Vector3(Math.sin(tank.rotation.y), 0, Math.cos(tank.rotation.y))
            notifyServer = true;
        }
        if (isDPressed) {
            tank.rotation.y += .1;
            tank.frontVector = new BABYLON.Vector3(Math.sin(tank.rotation.y), 0, Math.cos(tank.rotation.y))
            notifyServer = true;
        }
    
        if (notifyServer) {
            tank.state.x = tank.position.x;
            tank.state.y = tank.position.y;
            tank.state.z = tank.position.z;
            tank.state.rX = tank.rotation.x;
            tank.state.rY = tank.rotation.y;
            tank.state.rZ = tank.rotation.z;
            socket.emit("IMoved", tank.state);
        }
    }

    tank.canFire = true;
    tank.fire = function()
    {
        var tank = this;
        if (!isBPressed) return;
        if (!tank.canFire) return;
        tank.canFire = false;

        setTimeout(function () {
            tank.canFire = true;
        }, 500);

        var cannonBall = new BABYLON.Mesh.CreateSphere("cannonBall", 32, 2, scene);
        cannonBall.material = new BABYLON.StandardMaterial("Fire", scene);
        cannonBall.material.diffuseTexture = new BABYLON.Texture("images/normal_map.jpg", scene);
        var pos = tank.position;
        cannonBall.position = new BABYLON.Vector3(pos.x, pos.y + 1, pos.z);
        cannonBall.position.addInPlace(tank.frontVector.multiplyByFloats(5, 5, 5));
        cannonBall.physicsImpostor = new BABYLON.PhysicsImpostor(cannonBall, BABYLON.PhysicsImpostor.SphereImpostor, { mass: 1 }, scene);
        var fVector = tank.frontVector;
        var force = new BABYLON.Vector3(fVector.x * 100 , (fVector.y+ .1) * 100 , fVector.z * 100);
        cannonBall.physicsImpostor.applyImpulse(force, cannonBall.getAbsolutePosition());

        setTimeout(function () {            
            cannonBall.dispose();
        }, 3000);
        
        var positionPrimitives = [tank.position.x, tank.position.y, tank.position.z, tank.frontVector.x, tank.frontVector.y, tank.frontVector.z]; 
        socket.emit("ILaunchedBalloon", positionPrimitives);
    }
    
    return tank;
}


function enemyFire(positionPrimitives)
{
    enemyFrontVector = new BABYLON.Vector3(positionPrimitives[3], positionPrimitives[4], positionPrimitives[5]);
    var cannonBall = new BABYLON.Mesh.CreateSphere("cannonBall", 32, 2, scene);
    cannonBall.material = new BABYLON.StandardMaterial("Fire", scene);
    cannonBall.material.diffuseTexture = new BABYLON.Texture("images/normal_map.jpg", scene);
    cannonBall.position = new BABYLON.Vector3(positionPrimitives[0], positionPrimitives[1] + 1, positionPrimitives[2]);
    cannonBall.position.addInPlace(enemyFrontVector.multiplyByFloats(5, 5, 5));
    cannonBall.physicsImpostor = new BABYLON.PhysicsImpostor(cannonBall, BABYLON.PhysicsImpostor.SphereImpostor, { mass: 1 }, scene);
    var fVector = enemyFrontVector;
    var force = new BABYLON.Vector3(fVector.x * 100 , (fVector.y+ .1) * 100 , fVector.z * 100);
    cannonBall.physicsImpostor.applyImpulse(force, cannonBall.getAbsolutePosition());

    setTimeout(function () {            
        cannonBall.dispose();
    }, 3000);
}

window.addEventListener("resize", function () {
    engine.resize();
});

document.addEventListener("keydown", function (event) {
    if (event.key == 'w' || event.key == 'W') {
        isWPressed = true;
    }
    if (event.key == 's' || event.key == 'S') {
        isSPressed = true;
    }
    if (event.key == 'a' || event.key == 'A') {
        isAPressed = true;
    }
    if (event.key == 'd' || event.key == 'D') {
        isDPressed = true;
    }
    if (event.key == 'b' || event.key == 'B') {
        isBPressed = true;
    }
});

document.addEventListener("keyup", function (event) {
    if (event.key == 'w' || event.key == 'W') {
        isWPressed = false;
    }
    if (event.key == 's' || event.key == 'S') {
        isSPressed = false;
    }
    if (event.key == 'a' || event.key == 'A') {
        isAPressed = false;
    }
    if (event.key == 'd' || event.key == 'D') {
        isDPressed = false;
    }
    if (event.key == 'b' || event.key == 'B') {
        isBPressed = false;
    }
});
