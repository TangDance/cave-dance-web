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
	const white2 = 'rgba(255,255,255, 0.9)';
	const purple = 'rgb(204, 192, 207, 0.3)';
	// 'rgb(255,0,0,1)'; // red

	this.addBloomPass = true;
	this.addGridHelper = false;
	this.addBottomPlane = false;
	this.addGalaxyToScene = false;
	this.addBackGroundToScene = false;
	this.sceneBackgroundImage = //'textures/dunhuang/datagrid1.jpg'; //'textures/dunhuang/dunhuang-4.jpg'; 'textures/dunhuang/1_original_dimmed.png';
	this.addBVHtoScene = false;
	this.initialCameraPosition = {
		x: 0,
		y: 0,
		z: 100
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
	this.rootNodeSize = 12;
	this.largeNodeSize = 4;
	this.nodeSize = 2;
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
	6: "Machine Learning",
	7: "Dance Studies",
	8: "Reconstructing Celestial Dance",
	9: "Visualizing Celestial Body",
	10: "Cave 220",
}
const LARGE_NODE_SIZE_NODE_IDS = [];
const N = 5; // number of the top level categories
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
let Graph;
const rootId = 0;
const highlightNodes = new Set();
const highlightLinks = new Set();
let hoverNode = null;
let gData = {
	nodes: [],
	links: []
};
let bgData = {
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

	// Random additional graph data (referenece: https://github.com/vasturiano/3d-force-graph/blob/master/example/curved-links/index.html)
	// let additionalNodes = [...Array(14).keys()].map(i => ({ id: "n"+i }));
	// let additionalLinks = [
  //       { source: 0, target: 1, curvature: 0, rotation: 0 },
  //       { source: 0, target: 1, curvature: 0.8, rotation: 0 },
  //       { source: 0, target: 1, curvature: 0.8, rotation: Math.PI * 1 / 6 },
  //       { source: 0, target: 1, curvature: 0.8, rotation: Math.PI * 2 / 6 },
  //       { source: 0, target: 1, curvature: 0.8, rotation: Math.PI * 3 / 6 },
  //       { source: 0, target: 1, curvature: 0.8, rotation: Math.PI * 4 / 6 },
  //       { source: 0, target: 1, curvature: 0.8, rotation: Math.PI * 5 / 6 },
  //       { source: 0, target: 1, curvature: 0.8, rotation: Math.PI },
  //       { source: 0, target: 1, curvature: 0.8, rotation: Math.PI * 7 / 6 },
  //       { source: 0, target: 1, curvature: 0.8, rotation: Math.PI * 8 / 6 },
  //       { source: 0, target: 1, curvature: 0.8, rotation: Math.PI * 9 / 6 },
  //       { source: 0, target: 1, curvature: 0.8, rotation: Math.PI * 10 / 6 },
  //       { source: 0, target: 1, curvature: 0.8, rotation: Math.PI * 11 / 6 },
  //       { source: 2, target: 3, curvature: 0.4, rotation: 0 },
  //       { source: 3, target: 2, curvature: 0.4, rotation: Math.PI / 2 },
  //       { source: 2, target: 3, curvature: 0.4, rotation: Math.PI },
  //       { source: 3, target: 2, curvature: 0.4, rotation: -Math.PI / 2 },
  //       { source: 4, target: 4, curvature: 0.3, rotation: 0 },
  //       { source: 4, target: 4, curvature: 0.3, rotation: Math.PI * 2 / 3 },
  //       { source: 4, target: 4, curvature: 0.3, rotation: Math.PI * 4 / 3 },
  //       { source: 5, target: 6, curvature: 0, rotation: 0 },
  //       { source: 5, target: 5, curvature: 0.5, rotation: 0 },
  //       { source: 6, target: 6, curvature: -0.5, rotation: 0 },
  //       { source: 7, target: 8, curvature: 0.2, rotation: 0 },
  //       { source: 8, target: 9, curvature: 0.5, rotation: 0 },
  //       { source: 9, target: 10, curvature: 0.7, rotation: 0 },
  //       { source: 10, target: 11, curvature: 1, rotation: 0 },
  //       { source: 11, target: 12, curvature: 2, rotation: 0 },
  //       { source: 12, target: 7, curvature: 4, rotation: 0 },
  //       { source: 13, target: 13, curvature: 0.1, rotation: 0 },
  //       { source: 13, target: 13, curvature: 0.2, rotation: 0 },
  //       { source: 13, target: 13, curvature: 0.5, rotation: 0 },
  //       { source: 13, target: 13, curvature: 0.7, rotation: 0 },
  //       { source: 13, target: 13, curvature: 1, rotation: 0 }
  //     ].map(link => {
	// 			return {
	// 				source: "n" + link.source,
	// 				target: "n" + link.target,
	// 				curvature: link.curvature,
	// 				rotation: link.rotation
	// 			}
	// 		});
	//
	// const additionalNodes2 = additionalNodes.map(node => {
	// 	return {
	// 		id: "n2"+node.id
	// 	}
	// });
	// const additionalLinks2 = additionalLinks.map(link => {
	// 	return {
	// 		source: "n2"+link.source,
	// 		target: "n2"+link.target,
	// 		curvature: link.curvature,
	// 		rotation: link.rotation
	// 	}
	// });
	// const additionalNodes3 = additionalNodes.map(node => {
	// 	return {
	// 		id: "n3"+node.id
	// 	}
	// });
	// const additionalLinks3 = additionalLinks.map(link => {
	// 	return {
	// 		source: "n3"+link.source,
	// 		target: "n3"+link.target,
	// 		curvature: link.curvature,
	// 		rotation: link.rotation
	// 	}
	// });
	//
	// additionalNodes = additionalNodes.concat(additionalNodes2);
	// additionalNodes = additionalNodes.concat(additionalNodes3);
	// additionalLinks = additionalLinks.concat(additionalLinks2);
	// additionalLinks = additionalLinks.concat(additionalLinks3);

	// const addmoredata = false;
	// const allVisibleNodes = addmoredata? visibleNodes.concat(additionalNodes) : visibleNodes;
	// const allVisibleLinks = addmoredata? visibleLinks.concat(additionalLinks) : visibleLinks;

	const allVisibleNodes = visibleNodes;
	const allVisibleLinks = visibleLinks;

	// console.log("all graph data stat: ", allVisibleNodes.length, allVisibleLinks.length);
	// console.log(allVisibleNodes);
	// console.log(allVisibleLinks);

	return {
		nodes: allVisibleNodes,
		links: allVisibleLinks
	};
};

const graphContainerElem = document.getElementById('3d-graph');

fetch("mindmap_bgdata.json")
  .then(response => response.json())
  .then(json => {
		bgData = json; //todo remove
		initGraph();
	});


function initGraph() {

			Graph = ForceGraph3D({
					extraRenderers: [new THREE.CSS2DRenderer()]
				})(graphContainerElem)
				.graphData(getPrunedTree())
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
				.nodeColor(node => highlightNodes.has(node) ? (node === hoverNode ? settings.hoveredNodeColor : settings.linkedNodeColor) : settings.nodeColor)
				//  .nodeColor(node => highlightNodes.has(node) ? node === hoverNode ? 'rgb(173, 214, 213, 1)' : 'rgba(255,255,255, 1)' : 'rgba(255,255,255, 0.3)')
				.linkWidth(link => highlightLinks.has(link) ? 0.5 : 0.1)
				.linkDirectionalArrowLength(1)
				.linkDirectionalArrowRelPos(1)
				.linkCurvature(settings.linkCurvature)
				.linkCurveRotation(settings.linkRotation)
				.linkDirectionalParticles(link => highlightLinks.has(link) ? 3 : 1)
				.linkDirectionalParticleWidth(link => highlightLinks.has(link) ? 0.7 : 0.5)
				.linkDirectionalParticleSpeed(link => highlightLinks.has(link) ? 0.02 : 0.005)
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

					if (clickedNode.id === 0) {
						resetGraph();
					}
					else if (clickedNode.id <= N && clickedNode.childLinks.length > 0) {
						// Graph.zoomToFit(5000, 100, node => {
						// 	const visible = node.id > N && clickedNode.neighbors.map(neighbor => neighbor.id).indexOf(node.id) > -1;
						// 	console.log(visible, node.id);
						// 	return visible;
						// });

						// lengthen the link connected to the root node
						Graph.d3Force('link').distance(link => {
							if (link.source.id === 0 && link.target.id === clickedNode.id) {
								console.log("root link detected: ", link);
								return 400; //settings.largeLinkDistance;
							} else if (link.source.id === clickedNode.id && link.target.id > N) {
								console.log("child link detected: ", link);
								return 5; // settings.smallLinkDistance;
							}
							return 10; //settings.normalLinkDistance;
						});
						Graph.numDimensions(3); // Re-heat simulation
						focusNode(clickedNode);
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
						// if (node.links) {
						// 	node.links.forEach(link => highlightLinks.add(link));
						// }
						if (node.childLinks) {
							node.childLinks.forEach(link => highlightLinks.add(link));
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
				.cameraPosition(
				{
					x: settings.initialCameraPosition.x-0,
					y: settings.initialCameraPosition.y-0,
					z: settings.initialCameraPosition.z+0,
				})
				.onBackgroundClick(() => {
					// no op
				});

			const scene = Graph.scene();
			resetLinkForceDistance();
			//const axesHelper = new THREE.AxesHelper( 1000 );
			//scene.add( axesHelper );


			TweenMax.to("#mindmap-helper", 5, {opacity:1});
			TweenMax.to("#info", 5, {opacity:1});

			// gsap.to(camera.position, {
			// 	duration: 4,
			// 	x: settings.initialCameraPosition.x,
			// 	y: settings.initialCameraPosition.y,
			// 	z: settings.initialCameraPosition.z,
			// 	ease: "power3.inOut",
			// 	onComplete: () => {
			// 		camera.lookAt( 0, -100, 0 );
			// 	}
			// });
			// Graph.cameraPosition({
			// 	x: settings.initialCameraPosition.x,
			// 	y: settings.initialCameraPosition.y,
			// 	z: settings.initialCameraPosition.z
			// },
			// //{x:-450,y:-100,z:20}
			//{x:0,y:0,z:0} ,
			//2000 );

			// gsap.timeline()
			// .to(camera.position, { duration: 2,
			// 	x: -500, //settings.initialCameraPosition.z-100,
			// 	ease: "power3.inOut",
			// 	onComplete: () => {
			// 		console.log("onComplete 1");
			//
			// 	}
			// })
			// .to(camera.position, { duration: 4,
			// 	x: -450, //settings.initialCameraPosition.x-450,
			// 	y: -180, //settings.initialCameraPosition.y-180,
			// 	z: -20, //z: 0,//settings.initialCameraPosition.z+20,
			// 	ease: "power3.inOut",
			// 	onComplete: () => {
			// 		console.log("onComplete 1");
			// 		//camera.rotation.x = 0;
			// 		//camera.rotation.y = 0;
			// 	}
			// })
			// .to(camera.rotation, { x: 50 * Math.sin(Math.PI),
			// 		onComplete: () => {
			// 			console.log("onComplete 2");
			// 			//camera.lookAt( 0, -100, 0 );
			// 			// const startY = camera.rotation.y;
			// 			// gsap.to(camera.rotation, {duration: 4, y: startY - 24*settings.walkerTurnSpeed });
			// 			// $("#button_scene1").addClass("active");
			// 			// $("#scene1_start").animate({
			// 			// 	opacity: 1
			// 			// }, 1000, function() {
			// 			//
			// 			// });
			// 		}
			// });

			// gsap.to(camera.position, {
			// 	duration: 4,
			// 	x: camera.position-450,
			// 	ease: "power3.inOut",
			// 	onComplete: () => {
			// 		console.log("onComplete explore gsap");
			// 	}
			// });

			controls = Graph.controls();
			controls.minDistance = 0;
			controls.maxDistance = 1000;

			const mainLight = new THREE.PointLight(0xcccccc, 1.8, 100);
			mainLight.position.y = 60;
			scene.add(mainLight);

			const purple1 = 0xe3aafd;
			const yellow1 = 0xc0c856;
			const green1 = 0x56c8c0;
			const spotLight = new THREE.SpotLight( purple1, 1 );
			spotLight.position.set( 15, -40, 35 );
			spotLight.angle = Math.PI / 4;
			spotLight.penumbra = 1;
			spotLight.decay = 2;
			spotLight.distance = 200;
			spotLight.castShadow = true;
			spotLight.shadow.mapSize.width = 512;
			spotLight.shadow.mapSize.height = 512;
			spotLight.shadow.camera.near = 10;
			spotLight.shadow.camera.far = 200;
			spotLight.shadow.focus = 1;
			scene.add( spotLight );

			const lightHelper = new THREE.SpotLightHelper( spotLight );
			//scene.add( lightHelper );
			//const shadowCameraHelper = new THREE.CameraHelper( spotLight.shadow.camera );
			//scene.add( shadowCameraHelper );

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

					const scale = 0.15;
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
				// const mainLight = new THREE.PointLight(0xcccccc, 2, 100);
				// mainLight.position.y = 60;
				//scene.add(mainLight);

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
}

function updateHighlight() {
	// trigger update of highlighted objects in scene
	Graph
		.nodeColor(Graph.nodeColor())
		.linkWidth(Graph.linkWidth())
		.linkDirectionalParticles(Graph.linkDirectionalParticles());
}

function resetGraph(focusOnNode = null) {
	resetLinkForceDistance();
	if (focusOnNode) {
		focusNode(focusOnNode);
	} else {
		Graph.cameraPosition(
			settings.initialCameraPosition,
		// {
		// 	x: settings.initialCameraPosition.x,
		// 	y: settings.initialCameraPosition.y,
		// 	z: settings.initialCameraPosition.z
		// },
		{x:0,y:0,z:0}, 2000);
	}
	//Graph.numDimensions(3); // re-heat simulation
}

function resetLinkForceDistance() {
	if (Graph.d3Force('link')) {
		Graph.d3Force('link').distance(link => {
			if (link.source.id === 0) {
				return 50;
			} else if (link.source.id <= N) {
				return 5;
			}
		});
	}
}

function focusNode(node) {
	// Aim at node from outside it
	const distance = 50; // 50 is also good
	const distRatio = 2 + distance/Math.hypot(node.x, node.y, node.z);
	const newPos = node.x || node.y || node.z ?
			{ x: node.x * distRatio, y: node.y * distRatio, z: node.z * distRatio }
		: { x: -50, y: 0, z: distance - 100 }; // special case if node is in (0,0,0)

	Graph.cameraPosition(
		newPos, // new camera position
		node, // lookAt ({ x, y, z })
		5000  // ms transition duration
	);
}

window.onresize = function() {
	location.reload();

	// const canvas = Graph.renderer().domElement;
	// if (canvas) {
	// 	canvas.remove();
	// }
	// initGraph();

	// const camera = Graph.camera();
	// const renderer = Graph.renderer();
	// camera.aspect = window.innerWidth / window.innerHeight;
	// camera.updateProjectionMatrix();
	// renderer.setSize(window.innerWidth, window.innerHeight);


	// if (!Graph) return;
	//
	// const canvas = Graph.renderer().domElement;
	// // const width = window.innerWidth;
	// // const height = window.innerHeight;
	// const width = canvas.clientWidth;
	// const height = canvas.clientHeight;
	// Graph.camera().aspect = width / height;
	// Graph.camera().updateProjectionMatrix();
	// // //Graph.renderer().setSize( canvas.clientWidth, canvas.clientHeight );
}

const resetBtn = $("#reset-graph");
if (resetBtn) {
	resetBtn.click(() => {
		const rootNode =
		// todo pass in the root node here?
		resetGraph();
	});
}
