// GltfLoader.js

import xhr from './xhr';
import loadImages from './loadImages';
import Mesh from '../Mesh';
import GLTexture from '../GLTexture2';
import Object3D from '../objects/Object3D';
import Promise from 'promise-polyfill';


const ARRAY_CTOR_MAP = {
	5120: Int8Array,
	5121: Uint8Array,
	5122: Int16Array,
	5123: Uint16Array,
	5125: Uint32Array,
	5126: Float32Array
};

const SIZE_MAP = {
	SCALAR: 1,
	VEC2: 2,
	VEC3: 3,
	VEC4: 4,
	MAT2: 4,
	MAT3: 9,
	MAT4: 16
};

const semanticAttributeMap = {
	NORMAL: 'aNormal',
	POSITION: 'aVertexPosition',
	// 'TANGENT': 'aTangent',
	TEXCOORD_0: 'aTextureCoord',
	TEXCOORD_1: 'aTextureCoord1',
	WEIGHTS_0: 'aWeight',
	JOINTS_0: 'aJoint',
	COLOR: 'aColor'
};

let base;

const load = (mSource) => new Promise((resolve, reject) => {
	if((typeof mSource) === 'string') {
		base = mSource.substring(0, mSource.lastIndexOf('/')+1);
	} else {
		base = '';
	}

	_loadGltf(mSource)
		.then(_loadBin)
		.then(_loadTextures)
		.then(_getBufferViewData)
		.then(_parseMesh)
		.then(_parseNodes)
		.then((gltfInfo)=>{
			resolve(gltfInfo);
		})
		.catch(e => {
			console.log('Error:', e);
		});
});


const _parseNodes = (gltf) => new Promise((resolve, reject) => {
	const { nodes, scenes } = gltf;

	//	first parse to get meshes
	nodes.forEach((nodeInfo, i) => {
		if(nodeInfo.mesh != null) {
			nodeInfo.glMesh = gltf.output.meshes[nodeInfo.mesh];
		}

	});

	nodes.forEach((nodeInfo, i) => {
		if(nodeInfo.children);
	});

	const getTree = (nodeIndex) => {
		const node = nodes[nodeIndex];

		const obj3D = new Object3D();
		if(node.scale) {
			obj3D.scaleX = node.scale[0];
			obj3D.scaleY = node.scale[1];
			obj3D.scaleZ = node.scale[2];
		}

		if(node.rotation) {
			obj3D.setRotationFromQuaternion(node.rotation);
		}

		if(node.translation) {
			obj3D.x = node.translation[0];
			obj3D.y = node.translation[1];
			obj3D.z = node.translation[2];
		}

		if(node.mesh) {
			obj3D.mesh = node.glMesh;
		}

		if(node.children) {
			node.children.forEach( child => {
				const _child = getTree(child);
				obj3D.addChild(_child);
			});	
		}
		

		return obj3D;
	}

	gltf.output.scenes = scenes.map( scene => {
		const container = new Object3D();
		scene.nodes.forEach( node => {
			const childTree = getTree(scene.nodes[0]);
			container.addChild(childTree);
		});

		return container;
	});

	resolve(gltf);
});

const _parseMesh = (gltf) => new Promise((resolve, reject) => {
	const { meshes } = gltf;
	gltf.geometries = [];
	gltf.output = {
		meshes:[],
		scenes:[],
		textures:[]
	};

	meshes.forEach((mesh, i) => {
		const { primitives } = mesh;
		const geometry = {};

		primitives.forEach((primitiveInfo, i) => {
			const semantics = Object.keys(primitiveInfo.attributes);

			semantics.forEach((semantic, i) => {
				const accessorIdx = primitiveInfo.attributes[semantic];
				const attributeInfo = gltf.accessors[accessorIdx];
				const attributeName = semanticAttributeMap[semantic];
				if(!attributeName) {
					return;
				}
				const size = SIZE_MAP[attributeInfo.type];
				let attributeArray = _getAccessorData(gltf, accessorIdx);
				if (attributeArray instanceof Uint32Array) {
					attributeArray = new Float32Array(attributeArray);
				}

				geometry[attributeName] = {
					value:attributeArray,
					size,
				};
				// console.log('attribute', attributeName, geometry[attributeName]);
			});

			//	parse index
			if (primitiveInfo.indices != null) {
				const attributeArray = _getAccessorData(gltf, primitiveInfo.indices, true);
				geometry.indices = {
					value:attributeArray,
					size:1
				};
			}

			const m = new Mesh();

			for(const s in geometry) {
				const data = geometry[s];
				if(s !== 'indices') {
					// console.log(s, data);
					m.bufferFlattenData(data.value, s, data.size);
				} else {
					// console.log(data.value);
					m.bufferIndex(data.value);
				}
			}
			gltf.output.meshes.push(m);
			gltf.geometries.push(geometry);
		});
	});

	resolve(gltf);
});

const _getBufferViewData = (gltfInfo) => new Promise((resolve, reject) => {
	const { bufferViews, buffers } = gltfInfo;

	bufferViews.forEach((bufferViewInfo, i) => {
		const buffer = buffers[bufferViewInfo.buffer].data;
		bufferViewInfo.data = buffer.slice(bufferViewInfo.byteOffset || 0, (bufferViewInfo.byteOffset || 0) + (bufferViewInfo.byteLength || 0));
	});
	resolve(gltfInfo);
});

const _loadGltf = (mSource) => new Promise((resolve, reject) => {
	if((typeof mSource) !== 'string') {
		resolve(mSource);
	} else {
		xhr(mSource).then((o)=>{
			resolve(JSON.parse(o));
		}, (e)=> {
			reject(e);
		});
	}
});


const _loadBin = (gltfInfo) => new Promise((resolve, reject) => {
	
	if(gltfInfo.buffers) {
		let count = gltfInfo.buffers.length;

		gltfInfo.buffers.forEach(buffer => {

			const urlBin = `${base}${gltfInfo.buffers[0].uri}`;
			xhr(urlBin, true).then((o)=> {
				buffer.data = o;

				count --;
				if(count === 0) {
					resolve(gltfInfo);	
				}
				
			}, e => {
				reject(e);
			});
		});
		
	} else {
		resolve(gltfInfo);	
	}
	
});

const _loadTextures = (gltfInfo) => new Promise((resolve, reject) => {
	const { textures, images } = gltfInfo;
	const imagesToLoad = images.map( img => `${base}${img.uri}`);

	loadImages(imagesToLoad).then((o) => {
		gltfInfo.textures = o.map( img => new GLTexture(img));
	}, (e)=> {
		reject(e);
	});


	resolve(gltfInfo);
});

const parse = (mGltfInfo, mBin) => new Promise((resolve, reject) => {
	resolve(mSource);
});


const _getAccessorData = (gltf, accessorIdx, isIndices = false) => {
	const accessorInfo = gltf.accessors[accessorIdx];
	const buffer = gltf.bufferViews[accessorInfo.bufferView].data;
	const byteOffset = accessorInfo.byteOffset || 0;
	const ArrayCtor = ARRAY_CTOR_MAP[accessorInfo.componentType] || Float32Array;
	let size = SIZE_MAP[accessorInfo.type];
	if (size == null && isIndices) {
		size = 1;
	}
	let arr = new ArrayCtor(buffer, byteOffset, size * accessorInfo.count);
	const quantizeExtension = accessorInfo.extensions && accessorInfo.extensions['WEB3D_quantized_attributes'];
	if (quantizeExtension) {
		const decodedArr = new Float32Array(size * accessorInfo.count);
		const decodeMatrix = quantizeExtension.decodeMatrix;
		const decodeOffset = new Array(size);
		const decodeScale = new Array(size);
		for (let k = 0; k < size; k++) {
			decodeOffset[k] = decodeMatrix[size * (size + 1) + k];
			decodeScale[k] = decodeMatrix[k * (size + 1) + k];
		}
		for (let i = 0; i < accessorInfo.count; i++) {
			for (let k = 0; k < size; k++) {
				decodedArr[i * size + k] = arr[i * size + k] * decodeScale[k] + decodeOffset[k];
			}
		}

		arr = decodedArr;
	}

	// console.log({buffer, byteOffset, ArrayCtor, size, arr});

	return arr;
};

export default {
	load,
	parse
};