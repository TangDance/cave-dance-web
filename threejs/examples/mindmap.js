import {
	UnrealBloomPass
} from '//cdn.skypack.dev/three@0.136/examples/jsm/postprocessing/UnrealBloomPass.js';
import {
	BVHLoader
} from '//cdn.skypack.dev/three@0.136/examples/jsm/loaders/BVHLoader.js';
import {
	OrbitControls
} from '//cdn.skypack.dev/three@0.136/examples/jsm/controls/OrbitControls.js';
import {
	Reflector
} from '//cdn.skypack.dev/three@0.136/examples/jsm/objects/Reflector.js';

const Settings = function() {
	const yellow = 'rgba(255,160,0,0.8)';
	const white = 'rgba(255,255,255, 0.7)';
	const white2 = 'rgba(255,255,255, 1)';
	const purple = 'rgb(204, 192, 207, 0.3)';
	// 'rgb(255,0,0,1)'; // red

	this.addBloomPass = true;

	this.addGridHelper = false;
	this.addBottomPlane = false;
	this.addGalaxyToScene = false;

	this.addBackGroundToScene = false;
	this.sceneBackgroundImage = 'textures/dunhuang/dunhuang-4.jpg'; //textures/dunhuang/1_original_dimmed.png'; //'textures/dunhuang/datagrid1.jpg';//

	this.addBVHtoScene = false;
	this.initialCameraPosition = this.addBVHtoScene ? {
		z: 80
	} : {
		z: 80
	};

	this.addWallsToScene = false;

	this.normalLinkDistance = 20;
	this.smallLinkDistance = 5;
	this.largeLinkDistance = 100;
	this.linkVisiblity = true;
	this.linkCurvature = 0.3;
	this.linkRotation = 0;
	this.nodeColor = white;
	this.hoveredNodeColor = white2;
	this.linkedNodeColor = this.hoveredNodeColor;
	this.rootNodeSize = 15;
	this.largeNodeSize = 5;
	this.nodeSize = 1;
	this.childLinkNodeSize = 0.1;
	this.nodeResolution = 15; // Force Graph default is 8
};
const settings = new Settings();

const nodeSize = (nodeId) => {
	let size;
	if (LARGE_NODE_SIZE_NODE_IDS.indexOf(nodeId) > -1) {
		size = settings.largeNodeSize;
	} else {
		size = nodeId === 0 ? settings.rootNodeSize : (nodeId > N ? settings.childLinkNodeSize : settings.nodeSize);
	}
	return size;
};

const BACKGROUND_COLOR_FORCE_GRAPH = "#000000";
const LABELS_MAP = { // node id => display name
	0: "Cave Dance", // root node
	1: "Experiments",
	2: "Academic",
	3: "Education",
	4: "Events",
	5: "Theater",
	6: "Buddhist Art",
	7: "Dance Studies",
	8: "Reconstructing Celestial Dance",
	9: "Visualizing Celestial Body",
	10: "Cave 220"
}
const LARGE_NODE_SIZE_NODE_IDS = [1, 5];
const N = 5; // # of the top level categories
const LINKS_MAP = { // source node id => target node ids
	// NOTE: this map must include all the links appeared in CHILDREN_LINKS_MAP
	0: [1, 2, 3, 4, 5],
	5: [1, 4],
	1: [2, 5, 8, 9],
	2: [5, 1, 3, 4, 6, 7, 10],
	3: [4]
}
const CHILDREN_LINKS_MAP = { // source node id => target node ids
	0: [1, 2, 3, 4, 5],
	1: [8, 9],
	2: [6, 7, 10],
}

// Needed for BVH model animation
let mixer, skeletonHelper, controls;
const clock = new THREE.Clock();

// Graph data
const rootId = 0;
const highlightNodes = new Set();
const highlightLinks = new Set();
let hoverNode = null;
let gData = {
	nodes: [],
	links: []
};

Object.keys(LABELS_MAP).forEach(id => {
	const i = Number(id);
	gData.nodes.push({
		id: i,
		size: nodeSize(i),
		collapsed: false, //i > 0 && CHILDREN_LINKS_MAP[i],
		childLinks: []
	});
});

Object.keys(LINKS_MAP).forEach(sourceId => {
	const targetIds = LINKS_MAP[sourceId];
	if (targetIds) {
		targetIds.forEach(targetId => {
			gData.links.push({
				source: Number(sourceId),
				target: targetId
			});
		});
	}
});

Object.keys(CHILDREN_LINKS_MAP).forEach(sourceId => {
	sourceId = Number(sourceId);
	const targetIds = CHILDREN_LINKS_MAP[sourceId];
	const node = gData.nodes[sourceId];
	targetIds.forEach(targetId => {
		node.childLinks.push({
			source: sourceId,
			target: targetId
		});
	});
});

gData.links.forEach(link => {
	const a = gData.nodes[link.source];
	const b = gData.nodes[link.target];
	!a.neighbors && (a.neighbors = []);
	!b.neighbors && (b.neighbors = []);
	a.neighbors.push(b);
	b.neighbors.push(a);

	!a.links && (a.links = []);
	!b.links && (b.links = []);
	a.links.push(link);
	b.links.push(link);
});

// console.log(gData);

const nodesById = Object.fromEntries(gData.nodes.map(node => [node.id, node]));

const getPrunedTree = () => { // get the graph data with visible nodes (based on collapse state)
	const visibleNodes = [];
	const visibleLinks = [];

	(function traverseTree(node = nodesById[rootId]) {
		visibleNodes.push(node);
		if (node.collapsed) return;
		visibleLinks.push(...node.childLinks);
		node.childLinks
			.map(link => ((typeof link.target) === 'object') ? link.target : nodesById[link.target]) // get child node
			.forEach(traverseTree);
	})(); // IIFE

	// show all the top-level categories by default
	gData.links.filter(link => link.source > 0 && link.target > 0 && link.source <= N && link.target <= N).forEach(link => visibleLinks.push(link));

	// console.log("visibleLinks", visibleLinks);
	return {
		nodes: visibleNodes,
		links: visibleLinks
	};
};

const graphContainerElem = document.getElementById('3d-graph');
const Graph = ForceGraph3D({
		extraRenderers: [new THREE.CSS2DRenderer()]
	})(graphContainerElem)
	.graphData(getPrunedTree())
	//.graphData(gData)
	//.jsonUrl('data/project_overview_3d_graph_data.json')
	.nodeThreeObject(({
		id
	}) => new THREE.Mesh(
		[
			//  new THREE.BoxGeometry(Math.random() * 20, Math.random() * 20, Math.random() * 20),
			new THREE.SphereGeometry(Math.random() * 10),
		][id % 1],
		new THREE.MeshLambertMaterial({
			color: "rgba(255,255,255,0.6)", //rgba(255,255,255,0.6), //Math.round(Math.random() * Math.pow(2, 24)),
			transparent: true,
			opacity: 0.75
		})
	))
	//.linkVisibility(false)
	.nodeThreeObject(node => {
		const nodeEl = document.createElement('div');
		nodeEl.textContent = LABELS_MAP[node.id];
		nodeEl.className = 'node-label';
		if (node.id === rootId) {
			nodeEl.className += ' large';
		} else if (node.id > N) {
			nodeEl.className += ' small';
		}
		return new THREE.CSS2DObject(nodeEl);
	})
	.nodeThreeObjectExtend(true) // needed for the CSS2DObject renderer to work
	.backgroundColor(BACKGROUND_COLOR_FORCE_GRAPH)
	.nodeVal(node => node.size)
	.nodeResolution(settings.nodeResolution)
	.nodeOpacity(0.5)
	.nodeColor(node => highlightNodes.has(node) ? node === hoverNode ?
		settings.hoveredNodeColor : settings.linkedNodeColor : settings.nodeColor)
	//  .nodeColor(node => highlightNodes.has(node) ? node === hoverNode ? 'rgb(173, 214, 213, 1)' : 'rgba(255,255,255, 1)' : 'rgba(255,255,255, 0.3)')
	.linkWidth(link => highlightLinks.has(link) ? 0.2 : 0.1)
	.linkDirectionalArrowLength(1)
	.linkDirectionalArrowRelPos(1)
	.linkCurvature(settings.linkCurvature)
	.linkCurveRotation(settings.linkRotation)
	.linkDirectionalParticles(link => highlightLinks.has(link) ? 2 : 1)
	.linkDirectionalParticleWidth(link => highlightLinks.has(link) ? 0.4 : 0.2)
	.linkDirectionalParticleSpeed(link => highlightLinks.has(link) ? 0.005 : 0.005)
	.linkDirectionalParticleResolution(10)
	.showNavInfo(false)
	.height('100%')
	.width('100%')
	.onNodeClick(clickedNode => {
		const weblink = document.getElementById(String(clickedNode.id));
		if (weblink) {
			weblink.click();
			return;
		}

		console.log(" clickedNode, ", clickedNode);
		console.log("highlightNodes, ", clickedNode.neighbors.map(neighbor => neighbor.id));
		if (clickedNode.childLinks.length > 0) {
			// lengthen the link connected to the root node

			Graph.zoomToFit(5000, 100, node => {
				const visible = node.id > N && clickedNode.neighbors.map(neighbor => neighbor.id).indexOf(node.id) > -1;
				console.log(visible, node.id);
				return visible;
			});

			linkForce.distance(link => {
				console.log(link);
				console.log("connected to root? ", link.source.id === 0 && link.target.id === clickedNode.id);
				console.log("connected to clicked node? ", link.source.id === clickedNode.id);
				if (link.source.id === 0 && link.target.id === clickedNode.id) {
					return settings.largeLinkDistance;
				} else if (link.source.id === clickedNode.id) {
					return settings.smallLinkDistance;
				}
				return settings.normalLinkDistance;
			});

			Graph.cameraPosition({
					x: 0,
					y: 0,
					z: 50
				}, // new position
				clickedNode, // lookAt ({ x, y, z })
				5000 // ms transition duration
			);



			// // Aim at node from outside it
			// const distance = 50;
			// const distRatio = 2 + distance/Math.hypot(clickedNode.x, clickedNode.y, clickedNode.z);
			// const newPos = clickedNode.x || clickedNode.y || clickedNode.z ?
			//     { x: clickedNode.x * distRatio, y: clickedNode.y * distRatio, z: clickedNode.z * distRatio }
			//   : { x: -50, y: 0, z: distance - 100 }; // special case if node is in (0,0,0)
			//
			// Graph.cameraPosition(
			//   newPos, // new position
			//   clickedNode, // lookAt ({ x, y, z })
			//   5000  // ms transition duration
			// );
		}
	})
	.onNodeDragEnd(node => { // Fix the node at the dragged position
		node.fx = node.x;
		node.fy = node.y;
		node.fz = node.z;
	})
	.onNodeHover(node => {
		// no state change
		if ((!node && !highlightNodes.size) || (node && hoverNode === node)) return;

		highlightNodes.clear();
		highlightLinks.clear();

		if (node) {
			highlightNodes.add(node);
			if (node.neighbors) {
				node.neighbors.filter(node => node.id !== rootId && node.id > N).forEach(neighbor => highlightNodes.add(neighbor));
			}
			if (node.links) {
				node.links.forEach(link => highlightLinks.add(link));
			}
		}

		hoverNode = node || null;

		updateHighlight();
	})
	.onLinkHover(link => {
		highlightNodes.clear();
		highlightLinks.clear();

		if (link) {
			highlightLinks.add(link);
			highlightNodes.add(link.source);
			highlightNodes.add(link.target);
		}
		updateHighlight();
	})
	.cameraPosition(settings.initialCameraPosition)
	.onBackgroundClick(() => {
		//location.reload();
		//Graph.zoomToFit(5000, 1, node => true);

		// Graph.cameraPosition(
		//   {x:0, y:0, z: 50}, // new position
		//   {x:0, y:0, z: 0}, // lookAt ({ x, y, z })
		//   2000  // ms transition duration
		// );
	});



const linkForce = Graph
	.d3Force('link')


const scene = Graph.scene();

if (settings.addBackGroundToScene) {
	const spaceTexture = new THREE.TextureLoader().load(settings.sceneBackgroundImage);
	scene.background = spaceTexture;
}

if (settings.addBloomPass) {
	const bloomPass = new UnrealBloomPass();
	bloomPass.strength = 0.9;
	bloomPass.radius = 0.2;
	bloomPass.threshold = 0.05;
	Graph.postProcessingComposer().addPass(bloomPass);
}

if (settings.addBVHtoScene) {
	// BVH Model
	const loader = new BVHLoader();
	loader.load("models/bvh/0-6000.bvh", function(result) {

		skeletonHelper = new THREE.SkeletonHelper(result.skeleton.bones[0]);
		skeletonHelper.skeleton = result.skeleton; // allow animation mixer to bind to THREE.SkeletonHelper directly
		skeletonHelper.material = new THREE.MeshBasicMaterial({
			color: "white",
			transparent: "true",
			opacity: "0.9",
			wireframe: "true",
			wireframeLinewidth: "10.0"
		});
		const boneContainer = new THREE.Group();
		boneContainer.add(result.skeleton.bones[0]);

		let x = 0;
		let y = -20;
		let z = 0;
		boneContainer.translateX(x);
		boneContainer.translateY(y);
		boneContainer.translateZ(z);
		skeletonHelper.translateX(x);
		skeletonHelper.translateY(y);
		skeletonHelper.translateZ(z);

		const scale = 0.3;
		boneContainer.scale.set(scale, scale, scale);
		skeletonHelper.scale.set(scale, scale, scale);

		scene.add(skeletonHelper);
		scene.add(boneContainer);

		// play animation
		mixer = new THREE.AnimationMixer(skeletonHelper);
		mixer.clipAction(result.clip).setEffectiveWeight(1.0).play();

	});

	setInterval(() => { // effectively the renderer() function
		const delta = clock.getDelta();
		if (mixer) mixer.update(delta);
	}, 100);
}

controls = Graph.controls();
controls.minDistance = 0;
controls.maxDistance = 250;


if (settings.addGridHelper) {
	scene.add(new THREE.GridHelper(400, 10));
}

if (settings.addBottomPlane) {
	const planeGeometry = new THREE.PlaneGeometry(1000, 1000, 1, 1);
	const muralTexture = new THREE.TextureLoader().load('textures/dunhuang/mural_500.png');
	//  const planeMaterial = new THREE.MeshBasicMaterial({ map: muralTexture });

	const planeMaterial = new THREE.MeshLambertMaterial({
		color: 0x232323,
		side: THREE.DoubleSide
	}); // 0xFF0000
	//    const planeMaterial = new THREE.MeshPhongMaterial( { color: 0xffffff } ) ; // 0xFF0000
	const mesh = new THREE.Mesh(planeGeometry, planeMaterial);
	mesh.position.set(-100, -200, -100);
	mesh.rotation.set(0.5 * Math.PI, 0, 0);
	scene.add(mesh);
}

if (settings.addGalaxyToScene) {
	const starGeometry = new THREE.SphereGeometry(80, 64, 64);
	const starMaterial = new THREE.MeshBasicMaterial({
		map: new THREE.TextureLoader().load("textures/dunhuang/galaxy.png"),
		side: THREE.BackSide,
		transparent: true,
	});
	const starMesh = new THREE.Mesh(starGeometry, starMaterial);
	scene.add(starMesh);

	// //cloud geometry
	// const cloudgeometry = new THREE.SphereGeometry(1, 32, 32);
	//
	// //cloud material
	// const cloudMaterial = new THREE.MeshPhongMaterial({
	//   map: new THREE.TextureLoader().load("textures/dunhuang/cloud.png"),
	//   transparent: true,
	// });
	//
	// //cloudMesh
	// const cloud = new THREE.Mesh(cloudgeometry, cloudMaterial);
	// //earthMesh.layers.set(0);
	// scene.add(cloud);
}

if (settings.addWallsToScene) {
	let sphereGroup, smallSphere;
	let groundMirror, verticalMirror;
	const planeGeo = new THREE.PlaneGeometry(100.1, 100.1);
	let geometry, material;

	geometry = new THREE.CircleGeometry(40, 64);
	groundMirror = new Reflector(geometry, {
		clipBias: 0.003,
		textureWidth: window.innerWidth * window.devicePixelRatio,
		textureHeight: window.innerHeight * window.devicePixelRatio,
		color: 0x777777
	});
	groundMirror.position.y = 0.5;
	groundMirror.rotateX(-Math.PI / 2);
	scene.add(groundMirror);

	geometry = new THREE.PlaneGeometry(100, 100);
	verticalMirror = new Reflector(geometry, {
		clipBias: 0.003,
		textureWidth: window.innerWidth * window.devicePixelRatio,
		textureHeight: window.innerHeight * window.devicePixelRatio,
		color: 0x889999
	});
	verticalMirror.position.y = 50;
	verticalMirror.position.z = -50;
	scene.add(verticalMirror);

	sphereGroup = new THREE.Object3D();
	scene.add(sphereGroup);

	geometry = new THREE.CylinderGeometry(0.1, 15 * Math.cos(Math.PI / 180 * 30), 0.1, 24, 1);
	material = new THREE.MeshPhongMaterial({
		color: 0xffffff,
		emissive: 0x444444
	});
	const sphereCap = new THREE.Mesh(geometry, material);
	sphereCap.position.y = -15 * Math.sin(Math.PI / 180 * 30) - 0.05;
	sphereCap.rotateX(-Math.PI);

	geometry = new THREE.SphereGeometry(15, 24, 24, Math.PI / 2, Math.PI * 2, 0, Math.PI / 180 * 120);
	// const halfSphere = new THREE.Mesh( geometry, material );
	// halfSphere.add( sphereCap );
	// halfSphere.rotateX( - Math.PI / 180 * 135 );
	// halfSphere.rotateZ( - Math.PI / 180 * 20 );
	// halfSphere.position.y = 7.5 + 15 * Math.sin( Math.PI / 180 * 30 );

	//sphereGroup.add( halfSphere );

	// geometry = new THREE.IcosahedronGeometry( 5, 0 );
	// material = new THREE.MeshPhongMaterial( { color: 0xffffff, emissive: 0x333333, flatShading: true } );
	// smallSphere = new THREE.Mesh( geometry, material );
	//scene.add( smallSphere );

	// walls
	const planeTop = new THREE.Mesh(planeGeo, new THREE.MeshPhongMaterial({
		color: 0xffffff
	}));
	planeTop.position.y = 100;
	planeTop.rotateX(Math.PI / 2);
	scene.add(planeTop);

	const planeBottom = new THREE.Mesh(planeGeo, new THREE.MeshPhongMaterial({
		color: 0x444444
	}));
	planeBottom.rotateX(-Math.PI / 2);
	scene.add(planeBottom);

	const planeFront = new THREE.Mesh(planeGeo, new THREE.MeshPhongMaterial({
		color: 0x444444
	}));
	planeFront.position.z = 50;
	planeFront.position.y = 50;
	planeFront.rotateY(Math.PI);
	scene.add(planeFront);

	const planeRight = new THREE.Mesh(planeGeo, new THREE.MeshPhongMaterial({
		color: 0x444444
	}));
	planeRight.position.x = 50;
	planeRight.position.y = 50;
	planeRight.rotateY(-Math.PI / 2);
	scene.add(planeRight);

	const planeLeft = new THREE.Mesh(planeGeo, new THREE.MeshPhongMaterial({
		color: 0x444444
	}));
	planeLeft.position.x = -50;
	planeLeft.position.y = 50;
	planeLeft.rotateY(Math.PI / 2);
	scene.add(planeLeft);

	// lights
	const mainLight = new THREE.PointLight(0xcccccc, 1.5, 250);
	mainLight.position.y = 60;
	scene.add(mainLight);

	// const greenLight = new THREE.PointLight( 0x00ff00, 0.25, 1000 );
	// greenLight.position.set( 550, 50, 0 );
	// scene.add( greenLight );
	//
	// const redLight = new THREE.PointLight( 0xff0000, 0.25, 1000 );
	// redLight.position.set( - 550, 50, 0 );
	// scene.add( redLight );
	//
	// const blueLight = new THREE.PointLight( 0x7f7fff, 0.25, 1000 );
	// blueLight.position.set( 0, 50, 550 );
	// scene.add( blueLight );
}

// TODO sound
// // create an AudioListener and add it to the camera
// const listener = new THREE.AudioListener();
// Graph.camera().add( listener );
//
// // create a global audio source
// const sound = new THREE.Audio( listener );
//
// // load a sound and set it as the Audio object's buffer
// const audioLoader = new THREE.AudioLoader();
// audioLoader.load( 'sounds/358232_j_s_song.ogg', function( buffer ) {
// 	sound.setBuffer( buffer );
// 	sound.setLoop( true );
// 	sound.setVolume( 0.5 );
//   console.log("here")
// 	sound.play();
// });


function updateHighlight() { // trigger update of highlighted objects in scene
	Graph
		.nodeColor(Graph.nodeColor())
		.linkWidth(Graph.linkWidth())
		.linkDirectionalParticles(Graph.linkDirectionalParticles());
}

$("#reset-graph-btn").click(() => {
	Graph.zoomToFit(5000, 1, node => true);
	//      Graph.cameraPosition(settings.initialCameraPosition, {x:0,y:0,z:0}, 2000);
	//Graph.numDimensions(3); // re-heat simulation
});

// $("#link-visibility-btn").click(() => {
//     settings.linkVisiblity = !settings.linkVisiblity;
//     Graph.linkVisibility(settings.linkVisiblity);
// });
