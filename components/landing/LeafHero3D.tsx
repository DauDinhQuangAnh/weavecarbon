
// "use client";

// import * as THREE from "three";
// import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
// import { RGBELoader } from "three/addons/loaders/RGBELoader.js";
// import { useEffect, useRef, useState } from "react";

// const LeafHero3D = () => {
//   const containerRef = useRef<HTMLDivElement>(null);
//   const [isLoaded, setIsLoaded] = useState(false);

//   const sceneRef = useRef<THREE.Scene | null>(null);
//   const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
//   const animationFrameRef = useRef<number | null>(null);
//   const texturesRef = useRef<THREE.Texture[]>([]);
//   const currentFrameRef = useRef(0);
//   const lastTimeRef = useRef(0);
//   const lastRenderTimeRef = useRef(0);
//   const sequencePlaneRef = useRef<THREE.Mesh<
//     THREE.PlaneGeometry,
//     THREE.MeshBasicMaterial> |
//   null>(null);
//   const leafModelRef = useRef<THREE.Object3D | null>(null);
//   const hasAnimatedRef = useRef(false);
//   const isLoadedRef = useRef(false);
//   const transitionStartTimeRef = useRef(0);
//   const isTransitioningRef = useRef(false);
//   const leafFadeMaterialsRef = useRef<THREE.Material[]>([]);
//   const glowPlaneRef = useRef<THREE.Mesh | null>(null);
//   const glowLightRef = useRef<THREE.PointLight | null>(null);
//   const fillLightRef = useRef<THREE.HemisphereLight | null>(null);
//   const keyLightRef = useRef<THREE.DirectionalLight | null>(null);
//   const initialLeafPositionRef = useRef({ x: 0.1, y: 0.2, z: 0 });
//   const isDocumentVisibleRef = useRef(true);
//   const isHeroVisibleRef = useRef(true);
//   const isUserScrollingRef = useRef(false);
//   const modelReadyRef = useRef(false);
//   const sequenceStartTimeRef = useRef(0);
//   const lastSequenceAdvanceTimeRef = useRef(0);
//   const sequenceMissingFramesRef = useRef<Set<number>>(new Set());

//   useEffect(() => {
//     if (!containerRef.current) return;

//     const container = containerRef.current;
//     const win = window as Window & {
//       requestIdleCallback?: (
//       callback: IdleRequestCallback,
//       options?: IdleRequestOptions)
//       => number;
//       cancelIdleCallback?: (id: number) => void;
//     };
//     const width = container.clientWidth;
//     const height = container.clientHeight;
//     const isCoarsePointer = window.matchMedia("(pointer: coarse)").matches;
//     const prefersReducedMotion = window.matchMedia(
//       "(prefers-reduced-motion: reduce)"
//     ).matches;
//     const deviceMemory =
//     (
//     navigator as Navigator & {
//       deviceMemory?: number;
//     }).
//     deviceMemory ?? 4;
//     const hardwareConcurrency = navigator.hardwareConcurrency ?? 4;
//     const networkConnection =
//     (
//     navigator as Navigator & {
//       connection?: {
//         effectiveType?: string;
//         saveData?: boolean;
//       };
//     }).
//     connection ?? null;
//     const effectiveType = networkConnection?.effectiveType ?? "4g";
//     const prefersDataSaver = networkConnection?.saveData ?? false;
//     const isConstrainedNetwork =
//     prefersDataSaver || ["slow-2g", "2g", "3g"].includes(effectiveType);
//     const isLowEndDevice =
//     prefersReducedMotion ||
//     deviceMemory <= 4 ||
//     hardwareConcurrency <= 4 ||
//     isCoarsePointer && hardwareConcurrency <= 6;

//     const MAX_PIXEL_RATIO = isLowEndDevice ? 1 : 1.5;
//     const SEQUENCE_FPS = isLowEndDevice ?
//     24 :
//     isConstrainedNetwork ?
//     36 :
//     isCoarsePointer ?
//     42 :
//     48;
//     const BASE_RENDER_FPS = isLowEndDevice ? 30 : 48;
//     const SCROLL_RENDER_FPS = isLowEndDevice ? 18 : 28;
//     const SCROLL_SEQUENCE_FPS = Math.max(12, Math.round(SEQUENCE_FPS * 0.55));
//     const MAX_FRAME_RETRIES = isConstrainedNetwork ? 1 : 2;
//     const FIRST_FRAME_TIMEOUT_MS = isConstrainedNetwork ? 4200 : 2600;
//     const SEQUENCE_GAP_TRANSITION_MS = isConstrainedNetwork ? 700 : 320;
//     const SEQUENCE_GLOBAL_TIMEOUT_MS = isConstrainedNetwork ? 9000 : 6500;
//     const INITIAL_PRELOAD_FRAMES = isLowEndDevice ?
//     8 :
//     isConstrainedNetwork ?
//     20 :
//     isCoarsePointer ?
//     28 :
//     40;
//     const MAX_SEQUENCE_CONCURRENCY = isLowEndDevice ?
//     1 :
//     isConstrainedNetwork ?
//     1 :
//     isCoarsePointer ?
//     2 :
//     3;
//     const SOURCE_FRAME_COUNT = isConstrainedNetwork ? 120 : 200;
//     const SEQUENCE_FRAME_COUNT = isLowEndDevice ?
//     64 :
//     isConstrainedNetwork ?
//     96 :
//     SOURCE_FRAME_COUNT;
//     const ENABLE_GLOW_LIGHT = !isLowEndDevice;
//     const ENABLE_HDR_ENV = !isLowEndDevice && !isConstrainedNetwork;


//     const scene = new THREE.Scene();
//     sceneRef.current = scene;




//     const CAMERA_FOV = 39.6;
//     const CAMERA_POSITION = { x: 4.8868, y: 1.71783, z: 3.80109 };

//     const camera = new THREE.PerspectiveCamera(
//       CAMERA_FOV,
//       width / height,
//       0.1,
//       1000
//     );


//     camera.position.set(
//       CAMERA_POSITION.x,
//       CAMERA_POSITION.y,
//       CAMERA_POSITION.z
//     );


//     camera.lookAt(0, 0, 0);

//     const renderer = new THREE.WebGLRenderer({
//       alpha: true,
//       antialias: !isLowEndDevice,
//       powerPreference: isLowEndDevice ? "low-power" : "high-performance"
//     });
//     renderer.toneMapping = isLowEndDevice ?
//     THREE.NoToneMapping :
//     THREE.ACESFilmicToneMapping;
//     renderer.toneMappingExposure = 1.0;
//     renderer.outputColorSpace = THREE.SRGBColorSpace;
//     renderer.setSize(width, height);
//     renderer.setPixelRatio(Math.min(window.devicePixelRatio, MAX_PIXEL_RATIO));
//     container.appendChild(renderer.domElement);
//     rendererRef.current = renderer;


//     const fillLight = new THREE.HemisphereLight(
//       0xf4fff6,
//       0x1f2f24,
//       ENABLE_HDR_ENV ? 0.22 : 0.78
//     );
//     scene.add(fillLight);
//     fillLightRef.current = fillLight;

//     const keyLight = new THREE.DirectionalLight(
//       0xffffff,
//       ENABLE_HDR_ENV ? 0.3 : 1.05
//     );
//     keyLight.position.set(2.2, 3.4, 4.2);
//     scene.add(keyLight);
//     keyLightRef.current = keyLight;

//     const handleVisibilityChange = () => {
//       isDocumentVisibleRef.current = document.visibilityState === "visible";
//       if (isDocumentVisibleRef.current) {

//         lastRenderTimeRef.current = 0;
//         lastTimeRef.current = 0;
//       }
//     };
//     let scrollIdleTimeoutId: number | null = null;
//     const onScrollActivity = () => {
//       isUserScrollingRef.current = true;
//       if (scrollIdleTimeoutId !== null) {
//         win.clearTimeout(scrollIdleTimeoutId);
//       }
//       scrollIdleTimeoutId = win.setTimeout(() => {
//         isUserScrollingRef.current = false;
//       }, 140);
//     };
//     let viewportObserver: IntersectionObserver | null = null;
//     if ("IntersectionObserver" in window) {
//       viewportObserver = new IntersectionObserver(
//         (entries) => {
//           const entry = entries[0];
//           if (!entry) return;
//           isHeroVisibleRef.current = entry.isIntersecting;
//           if (isHeroVisibleRef.current) {

//             lastRenderTimeRef.current = 0;
//             lastTimeRef.current = 0;
//           }
//         },
//         {
//           root: null,
//           rootMargin: "200px 0px",
//           threshold: 0
//         }
//       );
//       viewportObserver.observe(container);
//     }
//     handleVisibilityChange();
//     document.addEventListener("visibilitychange", handleVisibilityChange);
//     window.addEventListener("scroll", onScrollActivity, { passive: true });
//     window.addEventListener("wheel", onScrollActivity, { passive: true });
//     window.addEventListener("touchmove", onScrollActivity, { passive: true });


//     if (ENABLE_GLOW_LIGHT) {
//       const pointLight = new THREE.PointLight(0xa0ff80, 0);
//       pointLight.position.set(0.1, 0.2, -0.5);
//       scene.add(pointLight);
//       glowLightRef.current = pointLight;
//     } else {
//       glowLightRef.current = null;
//     }


//     const manager = new THREE.LoadingManager();
//     let hdriLoadCancelled = false;
//     let cancelDeferredHdriStart: (() => void) | null = null;
//     if (ENABLE_HDR_ENV) {
//       const loadHdri = () => {
//         if (hdriLoadCancelled) return;
//         const rgbeLoader = new RGBELoader();
//         rgbeLoader.load(
//           "/hdri/studio_kominka.hdr",
//           (texture) => {
//             if (hdriLoadCancelled) {
//               texture.dispose();
//               return;
//             }
//             texture.mapping = THREE.EquirectangularReflectionMapping;
//             scene.environment = texture;
//           },
//           undefined,
//           () => {

//           }
//         );
//       };

//       if (typeof win.requestIdleCallback === "function") {
//         const hdriIdleId = win.requestIdleCallback(
//           () => {
//             loadHdri();
//           },
//           { timeout: 2500 }
//         );
//         cancelDeferredHdriStart = () => {
//           if (typeof win.cancelIdleCallback === "function") {
//             win.cancelIdleCallback(hdriIdleId);
//           }
//         };
//       } else {
//         const hdriTimeoutId = win.setTimeout(() => {
//           loadHdri();
//         }, 400);
//         cancelDeferredHdriStart = () => win.clearTimeout(hdriTimeoutId);
//       }
//     }

//     manager.onLoad = () => {
//       console.log("All assets loaded!");
//       isLoadedRef.current = true;
//       setIsLoaded(true);
//     };


//     const textureLoader = new THREE.TextureLoader();
//     const gltfLoader = new GLTFLoader(manager);
//     const totalFrames = SEQUENCE_FRAME_COUNT;
//     const configureSequenceTexture = (texture: THREE.Texture) => {
//       texture.colorSpace = THREE.SRGBColorSpace;
//       texture.generateMipmaps = false;
//       texture.minFilter = THREE.LinearFilter;
//       texture.magFilter = THREE.LinearFilter;
//       texture.needsUpdate = true;
//       return texture;
//     };
//     const resolveSourceFrameNumber = (frameIndex: number) => {
//       if (totalFrames <= 1) return 1;
//       const normalizedFrame = frameIndex / (totalFrames - 1);
//       return Math.round(normalizedFrame * (SOURCE_FRAME_COUNT - 1)) + 1;
//     };


//     const loadedTextures: THREE.Texture[] = [];
//     texturesRef.current = loadedTextures;
//     let sequenceLoadCancelled = false;
//     const disposeSequenceTextures = () => {
//       texturesRef.current.forEach((texture) => {
//         if (texture) texture.dispose();
//       });
//       texturesRef.current = [];
//     };
//     sequenceMissingFramesRef.current.clear();
//     sequenceStartTimeRef.current = performance.now();
//     lastSequenceAdvanceTimeRef.current = sequenceStartTimeRef.current;

//     const loadSequenceFrame = (
//     frameIndex: number,
//     attempt = 0)
//     : Promise<boolean> =>
//     new Promise<boolean>((resolve) => {
//       const frameNumber = resolveSourceFrameNumber(frameIndex).
//       toString().
//       padStart(4, "0");

//       textureLoader.load(
//         `/textures/sequence/${frameNumber}.webp`,
//         (texture) => {
//           if (sequenceLoadCancelled) {
//             texture.dispose();
//             resolve(false);
//             return;
//           }

//           loadedTextures[frameIndex] = configureSequenceTexture(texture);
//           sequenceMissingFramesRef.current.delete(frameIndex);
//           if (frameIndex === 0) {
//             lastSequenceAdvanceTimeRef.current = performance.now();
//           }
//           resolve(true);
//         },
//         undefined,
//         () => {
//           if (sequenceLoadCancelled) {
//             resolve(false);
//             return;
//           }

//           if (attempt < MAX_FRAME_RETRIES) {
//             const retryDelay = 120 * (attempt + 1);
//             win.setTimeout(() => {
//               void loadSequenceFrame(frameIndex, attempt + 1).then(resolve);
//             }, retryDelay);
//             return;
//           }

//           sequenceMissingFramesRef.current.add(frameIndex);
//           resolve(false);
//         }
//       );
//     });

//     const loadFrameRange = async (
//     startIndex: number,
//     endIndex: number,
//     concurrency: number) =>
//     {
//       if (startIndex > endIndex) return;
//       let cursor = startIndex;

//       const workers = Array.from({ length: concurrency }, async () => {
//         while (!sequenceLoadCancelled) {
//           if (!isHeroVisibleRef.current) {
//             await new Promise((resolve) => win.setTimeout(resolve, 180));
//             continue;
//           }

//           const frameIndex = cursor;
//           cursor += 1;
//           if (frameIndex > endIndex) break;
//           await loadSequenceFrame(frameIndex);
//         }
//       });

//       await Promise.all(workers);
//     };
//     let cancelDeferredSequenceStart: (() => void) | null = null;
//     void loadSequenceFrame(0);
//     const startSequenceLoading = () => {
//       const firstBatchStartIndex = totalFrames > 1 ? 1 : 0;
//       void loadFrameRange(
//         firstBatchStartIndex,
//         Math.min(totalFrames - 1, INITIAL_PRELOAD_FRAMES - 1),
//         MAX_SEQUENCE_CONCURRENCY
//       ).then(() => {
//         if (sequenceLoadCancelled) return;
//         void loadFrameRange(
//           INITIAL_PRELOAD_FRAMES,
//           totalFrames - 1,
//           Math.max(1, MAX_SEQUENCE_CONCURRENCY - 1)
//         );
//       });
//     };

//     if (typeof win.requestIdleCallback === "function") {
//       const idleId = win.requestIdleCallback(
//         () => {
//           startSequenceLoading();
//         },
//         { timeout: isLowEndDevice ? 1400 : 800 }
//       );
//       cancelDeferredSequenceStart = () => {
//         if (typeof win.cancelIdleCallback === "function") {
//           win.cancelIdleCallback(idleId);
//         }
//       };
//     } else {
//       const timeoutId = win.setTimeout(() => {
//         startSequenceLoading();
//       }, isLowEndDevice ? 120 : 60);
//       cancelDeferredSequenceStart = () => win.clearTimeout(timeoutId);
//     }

//     const aspect = 1920 / 1080;
//     const planeHeight = 5;
//     const planeWidth = planeHeight * aspect;

//     const geometry = new THREE.PlaneGeometry(planeWidth, planeHeight);

//     const material = new THREE.MeshBasicMaterial({
//       transparent: true,
//       opacity: 0,
//       toneMapped: false,
//       depthWrite: false
//     });

//     const sequencePlane = new THREE.Mesh(geometry, material);
//     sequencePlaneRef.current = sequencePlane;
//     sequencePlane.position.set(0, 0, 0);


//     sequencePlane.lookAt(camera.position);

//     scene.add(sequencePlane);

//     gltfLoader.load(
//       "/models/Leaf-Animation.glb",
//       (gltf: {scene: THREE.Object3D<THREE.Object3DEventMap> | null;}) => {
//         leafModelRef.current = gltf.scene;
//         if (leafModelRef.current) {
//           leafModelRef.current.visible = hasAnimatedRef.current;



//           const LEAF_POSITION = { x: 0.1, y: 0.2, z: 0 };
//           const LEAF_ROTATION = { x: 0, y: 0, z: 0 };
//           const LEAF_SCALE = { x: 1.2, y: 1.2, z: 1.2 };


//           leafModelRef.current.position.set(
//             LEAF_POSITION.x,
//             LEAF_POSITION.y,
//             LEAF_POSITION.z
//           );


//           leafModelRef.current.rotation.set(
//             LEAF_ROTATION.x,
//             LEAF_ROTATION.y,
//             LEAF_ROTATION.z
//           );


//           leafModelRef.current.scale.set(
//             LEAF_SCALE.x,
//             LEAF_SCALE.y,
//             LEAF_SCALE.z
//           );


//           const leafFadeMaterials = new Set<THREE.Material>();
//           leafModelRef.current.traverse((child) => {
//             if (child instanceof THREE.Mesh) {
//               child.frustumCulled = false;
//               const materials = Array.isArray(child.material) ?
//               child.material :
//               [child.material];

//               materials.forEach((mat) => {

//                 if (
//                 mat instanceof THREE.MeshStandardMaterial ||
//                 mat instanceof THREE.MeshPhysicalMaterial)
//                 {
//                   // Leaf geometry is very thin; render both sides to avoid culling flicker.
//                   mat.side = THREE.DoubleSide;

//                   mat.transparent = true;
//                   mat.opacity = hasAnimatedRef.current && !isTransitioningRef.current ? 1 : 0;
//                   mat.toneMapped = false;
//                   mat.needsUpdate = true;
//                   leafFadeMaterials.add(mat);
//                 }
//               });
//             }
//           });
//           leafFadeMaterialsRef.current = Array.from(leafFadeMaterials);

//           scene.add(leafModelRef.current);
//           modelReadyRef.current = true;
//           isLoadedRef.current = true;
//           setIsLoaded(true);


//           const box = new THREE.Box3().setFromObject(leafModelRef.current);
//           const size = new THREE.Vector3();
//           box.getSize(size);
//           const center = new THREE.Vector3();
//           box.getCenter(center);

//           console.log("Leaf model dimensions:", {
//             width: size.x,
//             height: size.y,
//             depth: size.z,
//             center: center
//           });



//           const distance = camera.position.distanceTo(center);



//           const vFOV = CAMERA_FOV * Math.PI / 180;
//           const visibleHeight = 2 * Math.tan(vFOV / 2) * distance;



//           const heightRatio = 1.3 / visibleHeight;
//           const planeVisualHeight = visibleHeight * heightRatio * 2.5;
//           const newPlaneWidth = planeVisualHeight * aspect;


//           if (sequencePlaneRef.current) {

//             sequencePlaneRef.current.geometry.dispose();
//             sequencePlaneRef.current.geometry = new THREE.PlaneGeometry(
//               newPlaneWidth,
//               planeVisualHeight
//             );

//             console.log("Adjusted plane dimensions:", {
//               width: newPlaneWidth,
//               height: planeVisualHeight,
//               distance: distance,
//               heightRatio: heightRatio
//             });
//           }


//           if (!isLowEndDevice) {
//             const wasVisible = leafModelRef.current.visible;
//             leafModelRef.current.visible = true;
//             renderer.compile(scene, camera);
//             leafModelRef.current.visible = wasVisible;
//           }
//         }
//       },

//       undefined,

//       (error) => {
//         console.error("Error loading leaf model:", error);
//       }
//     );

//     const ensureLeafVisible = () => {
//       if (!leafModelRef.current) return;
//       leafModelRef.current.visible = true;
//       leafModelRef.current.traverse((child) => {
//         if (child instanceof THREE.Mesh) {
//           child.visible = true;
//           child.frustumCulled = false;
//         }
//       });
//       leafFadeMaterialsRef.current.forEach((mat) => {
//         if (mat.opacity !== 1) {
//           mat.opacity = 1;
//           mat.needsUpdate = true;
//         }
//       });
//     };


//     const startLeafTransition = (startTime: number) => {
//       if (hasAnimatedRef.current) return;
//       hasAnimatedRef.current = true;
//       transitionStartTimeRef.current = startTime;
//       isTransitioningRef.current = true;
//       ensureLeafVisible();
//     };

//     const revealLeafWithoutSequence = () => {
//       if (hasAnimatedRef.current) return;
//       hasAnimatedRef.current = true;
//       isTransitioningRef.current = false;
//       ensureLeafVisible();
//       if (sequencePlaneRef.current) {
//         sequencePlaneRef.current.material.opacity = 0;
//         sequencePlaneRef.current.material.map = null;
//         sequencePlaneRef.current.material.needsUpdate = true;
//         sequencePlaneRef.current.visible = false;
//       }
//       sequenceLoadCancelled = true;
//       disposeSequenceTextures();
//     };

//     const animate = (time: number) => {
//       animationFrameRef.current = requestAnimationFrame(animate);

//       if (!isDocumentVisibleRef.current) {
//         return;
//       }

//       const targetRenderFps =
//       !isHeroVisibleRef.current ?
//       12 :
//       isUserScrollingRef.current ?
//       SCROLL_RENDER_FPS :
//       BASE_RENDER_FPS;
//       const renderInterval =
//       1000 / targetRenderFps;
//       if (time - lastRenderTimeRef.current < renderInterval) {
//         return;
//       }
//       lastRenderTimeRef.current = time;


//       if (!modelReadyRef.current) {
//         renderer.render(scene, camera);
//         return;
//       }

//       // If the leaf transition already finished, skip sequence logic
//       // and go straight to idle sway animation
//       const sequenceFinished = hasAnimatedRef.current && !isTransitioningRef.current;

//       if (!sequenceFinished) {

//       let firstLoadedFrame = -1;
//       for (let idx = 0; idx < totalFrames; idx += 1) {
//         if (texturesRef.current[idx]) {
//           firstLoadedFrame = idx;
//           break;
//         }
//       }

//       if (firstLoadedFrame === -1) {
//         const sequenceElapsed = time - sequenceStartTimeRef.current;
//         if (sequenceElapsed > FIRST_FRAME_TIMEOUT_MS) {
//           revealLeafWithoutSequence();
//         }
//         renderer.render(scene, camera);
//         return;
//       }

//       if (currentFrameRef.current === 0 && firstLoadedFrame > 0) {
//         currentFrameRef.current = firstLoadedFrame;
//         if (sequencePlaneRef.current) {
//           sequencePlaneRef.current.material.opacity = 1;
//           sequencePlaneRef.current.material.map = texturesRef.current[firstLoadedFrame];
//           sequencePlaneRef.current.material.needsUpdate = true;
//         }
//         lastSequenceAdvanceTimeRef.current = time;
//       }


//       const sequenceFrameInterval =
//       1000 / (
//       !isHeroVisibleRef.current ?
//       Math.max(10, Math.round(SCROLL_SEQUENCE_FPS * 0.7)) :
//       isUserScrollingRef.current ?
//       SCROLL_SEQUENCE_FPS :
//       SEQUENCE_FPS
//       );
//       if (time - lastTimeRef.current >= sequenceFrameInterval) {

//         if (currentFrameRef.current === 0 && sequencePlaneRef.current) {
//           sequencePlaneRef.current.material.opacity = 1;

//           if (texturesRef.current[0]) {
//             sequencePlaneRef.current.material.map = texturesRef.current[0];
//             sequencePlaneRef.current.material.needsUpdate = true;
//           }
//         }

//         if (currentFrameRef.current < totalFrames - 1) {
//           let nextAvailableFrame = currentFrameRef.current + 1;
//           while (
//           nextAvailableFrame < totalFrames &&
//           !texturesRef.current[nextAvailableFrame])
//           {
//             nextAvailableFrame += 1;
//           }

//           if (nextAvailableFrame < totalFrames && sequencePlaneRef.current) {
//             currentFrameRef.current = nextAvailableFrame;
//             sequencePlaneRef.current.material.map =
//             texturesRef.current[nextAvailableFrame];
//             sequencePlaneRef.current.material.needsUpdate = true;
//             lastSequenceAdvanceTimeRef.current = time;
//           }


//           const stalledFor = time - lastSequenceAdvanceTimeRef.current;
//           const elapsedSinceSequenceStart = time - sequenceStartTimeRef.current;
//           const nearSequenceEnd = currentFrameRef.current >= totalFrames - 3;
//           const hasBufferedNextFrame = nextAvailableFrame < totalFrames;
//           const bufferDryTooLong =
//           currentFrameRef.current > 0 &&
//           !hasBufferedNextFrame &&
//           stalledFor > SEQUENCE_GAP_TRANSITION_MS;

//           if (
//           currentFrameRef.current === totalFrames - 1 ||
//           nearSequenceEnd ||
//           bufferDryTooLong ||
//           elapsedSinceSequenceStart > SEQUENCE_GLOBAL_TIMEOUT_MS)
//           {
//             startLeafTransition(time);
//           }
//         } else {
//           startLeafTransition(time);
//         }
//         lastTimeRef.current = time;
//       }


//       if (isTransitioningRef.current) {
//         const transitionDuration = 850;
//         const elapsed = time - transitionStartTimeRef.current;
//         const progress = Math.min(elapsed / transitionDuration, 1);


//         const easeProgress = 1 - Math.pow(1 - progress, 3);


//         if (sequencePlaneRef.current) {
//           sequencePlaneRef.current.material.opacity = 1 - easeProgress;
//         }


//         if (leafFadeMaterialsRef.current.length > 0) {
//           leafFadeMaterialsRef.current.forEach((mat) => {
//             mat.opacity = easeProgress;
//             mat.needsUpdate = true;
//           });
//         }



//         const glowDelay = 0.4;
//         const glowProgress = Math.max(
//           0,
//           (progress - glowDelay) / (1 - glowDelay)
//         );


//         const glowEase = glowProgress * glowProgress * glowProgress;

//         if (glowPlaneRef.current && !Array.isArray(glowPlaneRef.current.material)) {
//           glowPlaneRef.current.material.opacity = glowEase * 0.6;
//         }


//         if (glowLightRef.current) {
//           glowLightRef.current.intensity = glowEase * 15;
//         }


//         if (progress >= 1) {
//           isTransitioningRef.current = false;
//           ensureLeafVisible();
//           if (sequencePlaneRef.current) {
//             sequencePlaneRef.current.material.opacity = 0;
//             sequencePlaneRef.current.material.map = null;
//             sequencePlaneRef.current.material.needsUpdate = true;
//             sequencePlaneRef.current.visible = false;
//           }
//           sequenceLoadCancelled = true;
//           disposeSequenceTextures();
//         }
//       }

//       } // end if (!sequenceFinished)


//       if (hasAnimatedRef.current && leafModelRef.current) {
//         ensureLeafVisible();
//         const t = time * 0.001;

//         const breeze = 0.85 + Math.sin(t * 0.25 + 0.4) * 0.2;
//         const swayPrimary = Math.sin(t * 0.55);
//         const swaySecondary = Math.sin(t * 1.1 + 0.9) * 0.3;
//         const sway = (swayPrimary + swaySecondary) * breeze;

//         const floatY = Math.sin(t * 0.8 + 0.25) * 0.06;
//         const driftX = sway * 0.18;
//         const driftZ = Math.sin(t * 0.4 + 1.1) * 0.04;

//         const rotateX = Math.sin(t * 0.7 + 0.7) * 0.06;
//         const rotateY = Math.cos(t * 0.5 + 0.2) * 0.04 + sway * 0.03;
//         const rotateZ = sway * 0.22;
//         const glowPulse = 0.9 + Math.sin(t * 1.0) * 0.1;

//         leafModelRef.current.scale.set(1.2, 1.2, 1.2);


//         leafModelRef.current.position.x = initialLeafPositionRef.current.x + driftX;
//         leafModelRef.current.position.y = initialLeafPositionRef.current.y + floatY;
//         leafModelRef.current.position.z = initialLeafPositionRef.current.z + driftZ;

//         leafModelRef.current.rotation.x = rotateX;
//         leafModelRef.current.rotation.y = rotateY;
//         leafModelRef.current.rotation.z = rotateZ;
        
//         leafModelRef.current.updateMatrixWorld(true);


//         if (glowPlaneRef.current && !Array.isArray(glowPlaneRef.current.material)) {
//           glowPlaneRef.current.material.opacity = 0.5 * glowPulse;
//         }
//         if (glowLightRef.current) {
//           glowLightRef.current.intensity = 10 * glowPulse;
//         }
//       }

//       renderer.render(scene, camera);
//     };

//     animate(0);
//     const glowPlaneAtCleanup = glowPlaneRef.current;


//     return () => {
//       document.removeEventListener("visibilitychange", handleVisibilityChange);
//       window.removeEventListener("scroll", onScrollActivity);
//       window.removeEventListener("wheel", onScrollActivity);
//       window.removeEventListener("touchmove", onScrollActivity);
//       if (scrollIdleTimeoutId !== null) {
//         win.clearTimeout(scrollIdleTimeoutId);
//       }
//       if (viewportObserver) {
//         viewportObserver.disconnect();
//       }

//       if (animationFrameRef.current !== null) {
//         cancelAnimationFrame(animationFrameRef.current);
//       }

//       if (cancelDeferredSequenceStart) {
//         cancelDeferredSequenceStart();
//       }
//       if (cancelDeferredHdriStart) {
//         cancelDeferredHdriStart();
//       }
//       hdriLoadCancelled = true;
//       sequenceLoadCancelled = true;


//       disposeSequenceTextures();


//       if (sequencePlaneRef.current) {
//         sequencePlaneRef.current.geometry.dispose();
//         sequencePlaneRef.current.material.dispose();
//       }

//       if (fillLightRef.current) {
//         scene.remove(fillLightRef.current);
//         fillLightRef.current = null;
//       }
//       if (keyLightRef.current) {
//         scene.remove(keyLightRef.current);
//         keyLightRef.current = null;
//       }


//       if (glowPlaneAtCleanup) {
//         glowPlaneAtCleanup.geometry.dispose();
//         const material = glowPlaneAtCleanup.material;
//         if (!Array.isArray(material)) {
//           if (
//           "map" in material &&
//           material.map &&
//           typeof material.map === "object" &&
//           "dispose" in material.map)
//           {
//             (material.map as THREE.Texture).dispose();
//           }
//           material.dispose();
//         }
//       }


//       if (leafModelRef.current) {
//         leafModelRef.current.traverse((object) => {
//           if (object instanceof THREE.Mesh) {
//             object.geometry.dispose();
//             if (object.material instanceof THREE.Material) {
//               object.material.dispose();
//             } else if (Array.isArray(object.material)) {
//               object.material.forEach((material) => material.dispose());
//             }
//           }
//         });
//       }


//       if (rendererRef.current) {
//         rendererRef.current.dispose();
//         if (container && rendererRef.current.domElement) {
//           container.removeChild(rendererRef.current.domElement);
//         }
//       }


//       if (sceneRef.current?.environment) {
//         sceneRef.current.environment.dispose();
//       }
//     };
//   }, []);

//   return (
//     <div className="pointer-events-none absolute right-0 z-20 h-[100svh] w-[min(100vw,72rem)] overflow-hidden bg-transparent md:w-[min(92vw,84rem)]">
      
//       {!isLoaded &&
//       <div className="absolute bg-transparent inset-0 flex items-center justify-center z-50"></div>
//       }

      


      
//       <div
//         ref={containerRef}
//         className="relative z-20 inset-0 w-full h-full bg-transparent" />
      
//     </div>);

// };

// export default LeafHero3D;


/* eslint-disable react-hooks/exhaustive-deps */
"use client";

import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { useEffect, useRef, useState } from "react";

type LeafSurfaceMaterial =
  | THREE.MeshPhysicalMaterial
  | THREE.MeshStandardMaterial;

const LeafHero3D = () => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [, setLoadingProgress] = useState(0);
  const [isLoaded, setIsLoaded] = useState(false);

  const sceneRef = useRef<THREE.Scene | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const texturesRef = useRef<THREE.Texture[]>([]);
  const currentFrameRef = useRef(0);
  const lastTimeRef = useRef(0);
  const sequencePlaneRef = useRef<THREE.Mesh<
    THREE.PlaneGeometry,
    THREE.MeshBasicMaterial
  > | null>(null);
  const leafModelRef = useRef<THREE.Object3D | null>(null);
  const leafMaterialsRef = useRef<LeafSurfaceMaterial[]>([]);
  const hasAnimatedRef = useRef(false);
  const isLoadedRef = useRef(false);
  const transitionStartTimeRef = useRef(0);
  const isTransitioningRef = useRef(false);
  const transitionCompleteTimeRef = useRef(0); // When transition finished (for float delay)
  const glowPlaneRef = useRef<THREE.Mesh | null>(null);
  const glowLightRef = useRef<THREE.PointLight | null>(null);
  // Leaf at origin (same as Blender)
  const initialLeafPositionRef = useRef({ x: 0, y: 0, z: 0 });
  const baseLeafScaleRef = useRef(1.9); // Base scale for the leaf model
  const isDocumentVisibleRef = useRef(true);
  const isHeroVisibleRef = useRef(true);
  const lastRenderTimeRef = useRef(0);

  useEffect(() => {
    if (!containerRef.current) return;

    const container = containerRef.current; // Capture for cleanup
    const width = container.clientWidth;
    const height = container.clientHeight;
    const isCoarsePointer = window.matchMedia("(pointer: coarse)").matches;
    const prefersReducedMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;
    const hardwareConcurrency = navigator.hardwareConcurrency ?? 8;
    const maxPixelRatio =
      prefersReducedMotion || hardwareConcurrency <= 4 ?
        1 :
      isCoarsePointer || hardwareConcurrency <= 6 ?
        1.25 :
        2;
    const targetRenderFps = maxPixelRatio <= 1.25 ? 24 : 30;

    // --- 1. SETUP THREE.JS ---
    const scene = new THREE.Scene();
    sceneRef.current = scene;

    // Camera setup - VALUES FROM BLENDER (converted to Three.js coordinate system)
    // Blender Camera: Position (4.8868, -3.80109, 1.71783), Rotation (73.2°, 0°, 52.4°), Focal 50mm
    // Blender Z-up → Three.js Y-up conversion applied
    const CAMERA_FOV = 39.6; // Calculated from 50mm focal length with 36mm sensor
    const CAMERA_POSITION = { x: 4.8868, y: 1.71783, z: 3.80109 }; // Converted from Blender

    const camera = new THREE.PerspectiveCamera(
      CAMERA_FOV,
      width / height,
      0.1,
      1000,
    );

    // Apply camera position
    camera.position.set(
      CAMERA_POSITION.x,
      CAMERA_POSITION.y,
      CAMERA_POSITION.z,
    );

    // Point camera at origin (where the leaf is)
    camera.lookAt(0, -0.2, 0);

    // Apply Blender camera shift (Shift X: -0.250, Shift Y: 0.020)
    // Blender shift moves the lens without moving the camera
    // In Three.js, we use setViewOffset to achieve the same effect
    // Blender shift is in fractions of sensor size
    // Negative X shift = view moves left = objects appear to the RIGHT
    const blenderShiftX = -0.25;
    const blenderShiftY = 0.02;
    // setViewOffset simulates lens shift:
    // fullWidth/fullHeight = the virtual "full" image
    // offsetX/offsetY = where our viewport window starts
    // width/height = our actual viewport size
    // Shift X of -0.25 means move viewport 25% to the left of center
    const shiftPixelsX = -blenderShiftX * width; // positive = shift viewport right, showing left part = objects appear right
    const shiftPixelsY = blenderShiftY * height;
    camera.setViewOffset(
      width,
      height,
      -shiftPixelsX,
      -shiftPixelsY, // offset of our viewport
      width,
      height,
    );

    const renderer = new THREE.WebGLRenderer({
      alpha: true,
      antialias: true,
      powerPreference:
        maxPixelRatio > 1 ? "high-performance" : "low-power",
    });
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.0;
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, maxPixelRatio));
    container.appendChild(renderer.domElement);
    rendererRef.current = renderer;

    // Point light for the glow effect ONLY (appears after transition)
    const pointLight = new THREE.PointLight(0xa0ff80, 0);
    pointLight.position.set(0, 0, -0.5);
    scene.add(pointLight);
    glowLightRef.current = pointLight;

    // Use lightweight scene lights so we don't need a large HDR environment file.
    const fillLight = new THREE.HemisphereLight(0xf4fff6, 0x1f2f24, 0.78);
    scene.add(fillLight);

    const keyLight = new THREE.DirectionalLight(0xffffff, 1.05);
    keyLight.position.set(2.2, 3.4, 4.2);
    scene.add(keyLight);

    const resetAnimationClocks = () => {
      lastRenderTimeRef.current = 0;
      lastTimeRef.current = 0;
    };

    const updateLeafMaterialState = (
      opacity: number,
      useTransparency: boolean,
    ) => {
      leafMaterialsRef.current.forEach((material) => {
        material.transparent = useTransparency;
        material.opacity = opacity;
        material.depthWrite = !useTransparency;
        material.needsUpdate = true;
      });
    };

    const handleVisibilityChange = () => {
      isDocumentVisibleRef.current = document.visibilityState === "visible";
      if (isDocumentVisibleRef.current) {
        resetAnimationClocks();
      }
    };

    let viewportObserver: IntersectionObserver | null = null;
    if ("IntersectionObserver" in window) {
      viewportObserver = new IntersectionObserver(
        ([entry]) => {
          if (!entry) return;

          isHeroVisibleRef.current = entry.isIntersecting;
          if (isHeroVisibleRef.current) {
            resetAnimationClocks();
          }
        },
        {
          root: null,
          rootMargin: "0px",
          threshold: 0.05,
        },
      );
      viewportObserver.observe(container);
    }

    handleVisibilityChange();
    document.addEventListener("visibilitychange", handleVisibilityChange);

    // --- 2. LOADING MANAGER (CHÌA KHÓA VẤN ĐỀ) ---
    const manager = new THREE.LoadingManager();

    // Cập nhật % loading
    manager.onProgress = (url, itemsLoaded, itemsTotal) => {
      const progress = Math.round((itemsLoaded / itemsTotal) * 100);
      setLoadingProgress(progress);
    };

    // Khi tải xong TẤT CẢ (Ảnh + Model)
    manager.onLoad = () => {
      console.log("All assets loaded!");
      isLoadedRef.current = true; // Use ref instead of state to avoid re-render
      setIsLoaded(true);
    };

    // --- 3. LOAD ASSETS ---
    const textureLoader = new THREE.TextureLoader(manager);
    const gltfLoader = new GLTFLoader(manager);
    const totalFrames = 200;

    // Load Sequence WebP
    const loadedTextures: THREE.Texture[] = [];
    for (let i = 1; i <= totalFrames; i++) {
      const frameNumber = i.toString().padStart(4, "0");
      // Dùng manager để theo dõi tiến độ
      textureLoader.load(`/textures/sequence/${frameNumber}.webp`, (txt) => {
        // Đảm bảo thứ tự mảng đúng với frame (vì load bất đồng bộ)
        txt.colorSpace = THREE.SRGBColorSpace; // Quan trọng để màu không bị nhạt
        loadedTextures[i - 1] = txt;
      });
    }
    // Lưu ý: loadedTextures sẽ là mảng rỗng ban đầu, nhưng khi onLoad chạy thì nó đã đầy
    texturesRef.current = loadedTextures;

    // === SEQUENCE PLANE: Rendered as a 2D fullscreen overlay ===
    // Use a separate scene + orthographic camera so the sequence PNG
    // fills exactly the viewport, independent of the 3D perspective camera.
    // The PNG was rendered in Blender with the correct composition already.
    const sequenceScene = new THREE.Scene();

    // Orthographic camera: maps a 2x2 unit area to the full viewport
    const orthoCamera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 10);
    orthoCamera.position.set(0, 0, 1);

    // Keep the sequence slightly smaller than full-viewport so it matches
    // the resting 3D leaf more closely during the cross-fade.
    const SEQUENCE_VISUAL_SCALE = 0.95;

    // "Cover" mode: maintain PNG aspect ratio while filling the viewport
    const vpAspect = width / height;
    const imgAspect = 1920 / 1080;
    let geoW: number, geoH: number;
    if (vpAspect > imgAspect) {
      // Viewport wider than image - fill width, extend height
      geoW = 2;
      geoH = 2 * (vpAspect / imgAspect);
    } else {
      // Viewport taller than image - fill height, extend width
      geoH = 2;
      geoW = 2 * (imgAspect / vpAspect);
    }

    const geometry = new THREE.PlaneGeometry(
      geoW * SEQUENCE_VISUAL_SCALE,
      geoH * SEQUENCE_VISUAL_SCALE,
    );
    const material = new THREE.MeshBasicMaterial({
      transparent: true,
      opacity: 0,
      toneMapped: false,
    });

    const sequencePlane = new THREE.Mesh(geometry, material);
    sequencePlaneRef.current = sequencePlane;
    sequencePlane.position.set(0, 0, 0); // Centered in ortho view
    sequenceScene.add(sequencePlane);

    // Disable auto-clear so we can render both scenes
    renderer.autoClear = false;

    // Create glow effect plane (behind the leaf) - Light rays burst effect
    // const createGlowTexture = () => {
    //   const canvas = document.createElement("canvas");
    //   canvas.width = 1024;
    //   canvas.height = 1024;
    //   const ctx = canvas.getContext("2d");

    //   if (ctx) {
    //     const centerX = 512;
    //     const centerY = 512;

    //     // Clear canvas
    //     ctx.fillStyle = "rgba(0, 0, 0, 0)";
    //     ctx.fillRect(0, 0, 1024, 1024);

    //     // Draw light rays radiating from center
    //     const numRays = 64; // Number of light beams
    //     const rayLength = 512;

    //     for (let i = 0; i < numRays; i++) {
    //       const angle = (i / numRays) * Math.PI * 2;
    //       const rayWidth = 8 + Math.random() * 12; // Varying widths
    //       const rayOpacity = 0.15 + Math.random() * 0.25; // Varying opacity

    //       // Create gradient for each ray
    //       const gradient = ctx.createLinearGradient(
    //         centerX,
    //         centerY,
    //         centerX + Math.cos(angle) * rayLength,
    //         centerY + Math.sin(angle) * rayLength,
    //       );

    //       gradient.addColorStop(0, `rgba(200, 255, 220, ${rayOpacity})`);
    //       gradient.addColorStop(
    //         0.5,
    //         `rgba(120, 220, 150, ${rayOpacity * 0.5})`,
    //       );
    //       gradient.addColorStop(1, "rgba(80, 180, 120, 0)");

    //       // Draw the ray
    //       ctx.beginPath();
    //       ctx.moveTo(centerX, centerY);
    //       ctx.lineTo(
    //         centerX + Math.cos(angle - 0.05) * rayLength,
    //         centerY + Math.sin(angle - 0.05) * rayLength,
    //       );
    //       ctx.lineTo(
    //         centerX + Math.cos(angle + 0.05) * rayLength,
    //         centerY + Math.sin(angle + 0.05) * rayLength,
    //       );
    //       ctx.closePath();
    //       ctx.fillStyle = gradient;
    //       ctx.fill();
    //     }

    //     // Add central glow
    //     const centerGlow = ctx.createRadialGradient(
    //       centerX,
    //       centerY,
    //       0,
    //       centerX,
    //       centerY,
    //       150,
    //     );
    //     centerGlow.addColorStop(0, "rgba(220, 255, 230, 0.6)");
    //     centerGlow.addColorStop(0.3, "rgba(180, 255, 200, 0.3)");
    //     centerGlow.addColorStop(1, "rgba(120, 220, 150, 0)");

    //     ctx.fillStyle = centerGlow;
    //     ctx.fillRect(0, 0, 1024, 1024);
    //   }

    //   return new THREE.CanvasTexture(canvas);
    // };

    // const glowTexture = createGlowTexture();
    // const glowGeometry = new THREE.PlaneGeometry(8, 8); // Smaller, focused glow
    // const glowMaterial = new THREE.MeshBasicMaterial({
    //   map: glowTexture,
    //   transparent: true,
    //   opacity: 0,
    //   toneMapped: false,
    //   depthWrite: false,
    //   blending: THREE.AdditiveBlending, // Makes it glow
    // });

    // const glowPlane = new THREE.Mesh(glowGeometry, glowMaterial);
    // glowPlaneRef.current = glowPlane;
    // glowPlane.position.set(0.1, 0.2, -0.3); // Position behind the leaf center
    // glowPlane.lookAt(camera.position);
    // scene.add(glowPlane);

    // Load Model 3D
    gltfLoader.load(
      "/models/Leaf-Animation.glb",
      (gltf: { scene: THREE.Object3D<THREE.Object3DEventMap> | null }) => {
        leafModelRef.current = gltf.scene;
        if (leafModelRef.current) {
          leafModelRef.current.visible = false;

          // VALUES FROM BLENDER (with Apply All Transforms)
          // Blender Leaf: Location (0, 0, 0), Rotation (0, 0, 0), Scale (1, 1, 1)
          // Leaf stays at origin - camera shift handles the right-side positioning
          const LEAF_POSITION = { x: 0, y: 0, z: 0 };
          const LEAF_ROTATION = { x: 0, y: 0, z: 0 };
          const LEAF_SCALE = 1.9; // Slightly smaller so the hero feels less cramped
          baseLeafScaleRef.current = LEAF_SCALE; // Store for animation loop

          // Apply transform values
          leafModelRef.current.position.set(
            LEAF_POSITION.x,
            LEAF_POSITION.y,
            LEAF_POSITION.z,
          );

          // Apply rotation (convert from Blender if needed)
          leafModelRef.current.rotation.set(
            LEAF_ROTATION.x,
            LEAF_ROTATION.y,
            LEAF_ROTATION.z,
          );

          // Apply scale
          leafModelRef.current.scale.set(LEAF_SCALE, LEAF_SCALE, LEAF_SCALE);

          // Configure materials for the scene lighting and fade transition.
          const leafMaterials = new Set<LeafSurfaceMaterial>();
          leafModelRef.current.traverse((child) => {
            if (child instanceof THREE.Mesh) {
              child.frustumCulled = false;
              const materials = Array.isArray(child.material)
                ? child.material
                : [child.material];

              materials.forEach((mat) => {
                if (
                  mat instanceof THREE.MeshStandardMaterial ||
                  mat instanceof THREE.MeshPhysicalMaterial
                ) {
                  // Thin folds look clipped at shallow angles unless both sides render.
                  mat.side = THREE.DoubleSide;
                  mat.transparent = true;
                  mat.opacity = 0; // Start invisible for fade-in effect
                  mat.depthWrite = false;
                  mat.toneMapped = false; // Disable tone mapping to match sequence PNG colors
                  mat.needsUpdate = true;
                  leafMaterials.add(mat);
                }
              });
            }
          });
          leafMaterialsRef.current = Array.from(leafMaterials);

          scene.add(leafModelRef.current);

          // PRE-WARM: Render the model once (invisible, opacity 0) to force
          // GPU shader compilation NOW, not during the transition.
          // This prevents the 1-second freeze when transitioning.
          renderer.compile(scene, camera);

          // Calculate bounding box to get actual model size
          const box = new THREE.Box3().setFromObject(leafModelRef.current);
          const size = new THREE.Vector3();
          box.getSize(size);
          const center = new THREE.Vector3();
          box.getCenter(center);

          console.log("Leaf model dimensions:", {
            width: size.x,
            height: size.y,
            depth: size.z,
            center: center,
          });

          console.log(
            "Leaf model loaded, 3D model will appear after sequence.",
          );
        }
      },
      // Progress callback
      undefined,
      // Error callback
      (error) => {
        console.error("Error loading leaf model:", error);
      },
    );

    // --- 4. ANIMATION LOOP ---
    const fps = 30;
    const frameInterval = 1000 / fps;

    const animate = (time: number) => {
      animationFrameRef.current = requestAnimationFrame(animate);

      if (!isDocumentVisibleRef.current || !isHeroVisibleRef.current) {
        return;
      }

      const renderInterval = 1000 / targetRenderFps;
      if (
        lastRenderTimeRef.current !== 0 &&
        time - lastRenderTimeRef.current < renderInterval
      ) {
        return;
      }
      lastRenderTimeRef.current = time;

      // CHỈ CHẠY KHI ĐÃ LOAD XONG - Use ref to avoid re-render issues
      if (!isLoadedRef.current) {
        renderer.clear();
        renderer.render(sequenceScene, orthoCamera);
        renderer.render(scene, camera);
        return;
      }

      // Logic chuyển frame
      if (time - lastTimeRef.current > frameInterval) {
        // Hiện plane ngay frame đầu tiên
        if (currentFrameRef.current === 0 && sequencePlaneRef.current) {
          sequencePlaneRef.current.material.opacity = 1;
          // Gán texture đầu tiên ngay lập tức để tránh chớp trắng
          if (texturesRef.current[0]) {
            sequencePlaneRef.current.material.map = texturesRef.current[0];
            sequencePlaneRef.current.material.needsUpdate = true;
          }
        }

        if (currentFrameRef.current < totalFrames - 1) {
          currentFrameRef.current++;

          if (
            texturesRef.current[currentFrameRef.current] &&
            sequencePlaneRef.current
          ) {
            sequencePlaneRef.current.material.map =
              texturesRef.current[currentFrameRef.current];
            // Quan trọng: Báo ThreeJS cập nhật texture mới
            sequencePlaneRef.current.material.needsUpdate = true;
          }
        } else if (!hasAnimatedRef.current) {
          // Start transition - but ONLY if the 3D model is loaded
          if (leafModelRef.current) {
            hasAnimatedRef.current = true;
            transitionStartTimeRef.current = time;
            isTransitioningRef.current = true;
            updateLeafMaterialState(0, true);
            leafModelRef.current.visible = true;
          }
          // If model isn't loaded yet, we'll retry next frame
          // (currentFrameRef stays at totalFrames-1, hasAnimatedRef stays false)
        }
        lastTimeRef.current = time;
      }

      // Handle smooth fade transition
      if (isTransitioningRef.current) {
        const transitionDuration = 1000; // 1 second fade
        const elapsed = time - transitionStartTimeRef.current;
        const progress = Math.min(elapsed / transitionDuration, 1);

        // Ease-in-out function for smoother transition
        const easeProgress =
          progress < 0.5
            ? 2 * progress * progress
            : 1 - Math.pow(-2 * progress + 2, 2) / 2;

        // Fade out sequence plane
        if (sequencePlaneRef.current) {
          sequencePlaneRef.current.material.opacity = 1 - easeProgress;
        }

        // Fade in 3D model
        updateLeafMaterialState(easeProgress, true);

        // Fade in glow effect (delayed and slower for more natural appearance)
        // Glow starts appearing only after 40% of transition is complete
        const glowDelay = 0.4; // Start glow at 40% of transition
        const glowProgress = Math.max(
          0,
          (progress - glowDelay) / (1 - glowDelay),
        );

        // Apply smooth ease-in curve specifically for glow (cubic ease-in for gentle start)
        const glowEase = glowProgress * glowProgress * glowProgress;

        if (
          glowPlaneRef.current &&
          !Array.isArray(glowPlaneRef.current.material)
        ) {
          glowPlaneRef.current.material.opacity = glowEase * 0.6; // Max 60% opacity, more subtle
        }

        // Fade in glow light even more gradually
        if (glowLightRef.current) {
          glowLightRef.current.intensity = glowEase * 15; // Softer light intensity
        }

        // End transition
        if (progress >= 1) {
          isTransitioningRef.current = false;
          transitionCompleteTimeRef.current = time; // Record when transition finished
          updateLeafMaterialState(1, false);
          if (sequencePlaneRef.current) {
            sequencePlaneRef.current.visible = false;
          }
        }
      }

      // Lightweight idle floating animation (no mouse/scroll interaction)
      // Only starts 2 seconds AFTER transition completes for smooth handoff
      if (hasAnimatedRef.current && leafModelRef.current) {
        const timeSinceTransition = transitionCompleteTimeRef.current > 0
          ? time - transitionCompleteTimeRef.current
          : 0;
        const floatDelay = 2000; // 2 second delay
        // Ease in the floating effect from 0 to 1 over 1 second after the delay
        const floatStrength = transitionCompleteTimeRef.current > 0
          ? Math.min(Math.max((timeSinceTransition - floatDelay) / 1000, 0), 1)
          : 0;

        // Base floating animation
        const floatSpeed = 0.0008;
        const floatAmount = 0.05;
        const rotateSpeed = 0.0003;
        const rotateAmount = 0.08;
        const swaySpeed = 0.00045;
        const swayAmount = 0.035;

        const floatY = Math.sin(time * floatSpeed) * floatAmount * floatStrength;
        const rotateX = Math.sin(time * rotateSpeed) * rotateAmount * floatStrength;
        const rotateZ = Math.cos(time * rotateSpeed * 0.7) * rotateAmount * floatStrength;

        const baseScale = baseLeafScaleRef.current;
        leafModelRef.current.scale.set(baseScale, baseScale, baseScale);

        // Apply floating transformations only
        leafModelRef.current.position.y = initialLeafPositionRef.current.y + floatY;

        leafModelRef.current.position.x =
          initialLeafPositionRef.current.x +
          Math.sin(time * swaySpeed) * swayAmount * floatStrength;

        leafModelRef.current.rotation.x = rotateX;
        leafModelRef.current.rotation.y = 0;
        leafModelRef.current.rotation.z = rotateZ;
      }

      // Render both scenes: sequence overlay first, then 3D on top
      renderer.clear();
      renderer.render(sequenceScene, orthoCamera);
      renderer.render(scene, camera);
    };

    animate(0);

    // Cleanup
    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      if (viewportObserver) {
        viewportObserver.disconnect();
      }

      if (animationFrameRef.current !== null) {
        cancelAnimationFrame(animationFrameRef.current);
      }

      // Dispose textures
      texturesRef.current.forEach((texture) => {
        if (texture) texture.dispose();
      });

      // Dispose geometry and material
      if (sequencePlaneRef.current) {
        sequencePlaneRef.current.geometry.dispose();
        sequencePlaneRef.current.material.dispose();
      }

      // Dispose glow plane
      const glowPlane = glowPlaneRef.current;
      if (glowPlane) {
        glowPlane.geometry.dispose();
        const material = glowPlane.material;
        if (!Array.isArray(material)) {
          if (
            "map" in material &&
            material.map &&
            typeof material.map === "object" &&
            "dispose" in material.map
          ) {
            (material.map as THREE.Texture).dispose();
          }
          material.dispose();
        }
      }

      // Dispose model
      if (leafModelRef.current) {
        leafModelRef.current.traverse((object) => {
          if (object instanceof THREE.Mesh) {
            object.geometry.dispose();
            if (object.material instanceof THREE.Material) {
              object.material.dispose();
            } else if (Array.isArray(object.material)) {
              object.material.forEach((material) => material.dispose());
            }
          }
        });
      }
      leafMaterialsRef.current = [];

      // Dispose renderer
      if (rendererRef.current) {
        rendererRef.current.dispose();
        if (container && rendererRef.current.domElement) {
          container.removeChild(rendererRef.current.domElement);
        }
      }

      // Dispose scene environment
      if (sceneRef.current?.environment) {
        sceneRef.current.environment.dispose();
      }
    };
  }, []); // Empty dependency array to prevent re-running

  return (
    <div className="absolute z-0 -translate-x-380 w-600 md:w-400 md:-translate-x-200 lg:translate-x-0 lg:left-0 lg:z-1 bg-transparent lg:w-screen h-screen overflow-hidden">
      {/* LOADING SCREEN */}
      {!isLoaded && (
        <div className="absolute bg-transparent inset-0 flex items-center justify-center z-50"></div>
      )}

      {/* <motion.div
        className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 flex items-center justify-center overflow-hidden"
        initial={{ x: "0%" }}
        animate={{ x: "-50%" }}
        transition={{
          duration: 150,
          repeat: Infinity,
          ease: "linear",
          repeatType: "loop",
        }}
      >
        <span className="text-[240px] font-bold whitespace-nowrap px-8">
          WEAVECARBON
        </span>
        <span className="text-[240px] font-bold whitespace-nowrap px-8">
          WEAVECARBON
        </span>
        <span className="text-[240px] font-bold whitespace-nowrap px-8">
          WEAVECARBON
        </span>
        <span className="text-[240px] font-bold whitespace-nowrap px-8">
          WEAVECARBON
        </span>
        <span className="text-[240px] font-bold whitespace-nowrap px-8">
          WEAVECARBON
        </span>
        <span className="text-[240px] font-bold whitespace-nowrap px-8">
          WEAVECARBON
        </span>
        <span className="text-[240px] font-bold whitespace-nowrap px-8">
          WEAVECARBON
        </span>
        <span className="text-[240px] font-bold whitespace-nowrap px-8">
          WEAVECARBON
        </span>
      </motion.div> */}

      {/* CANVAS CONTAINER */}
      <div ref={containerRef} className="w-full h-full" />
    </div>
  );
};

export default LeafHero3D;
