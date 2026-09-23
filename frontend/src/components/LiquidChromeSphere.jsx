import React, { useEffect, useRef } from 'react';
import * as THREE from 'three';

export default function LiquidChromeSphere({ isListening, onClick }) {
  const mountRef = useRef(null);
  const materialRef = useRef(null);
  const meshRef = useRef(null);

  useEffect(() => {
    const container = mountRef.current;
    if (!container) return;

    const width = container.clientWidth || 320;
    const height = container.clientHeight || 320;

    // 1. Scene & Camera Setup
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 100);
    camera.position.set(0, 0, 4.5);

    // 2. WebGL Renderer
    const renderer = new THREE.WebGLRenderer({ 
      antialias: true, 
      alpha: true,
      powerPreference: "high-performance" 
    });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.25;
    container.appendChild(renderer.domElement);

    // 3. Procedural Studio Cube Environment Map
    const createStudioEnvMap = () => {
      const cubeRenderTarget = new THREE.WebGLCubeRenderTarget(256, {
        generateMipmaps: true,
        minFilter: THREE.LinearMipmapLinearFilter,
        magFilter: THREE.LinearFilter,
      });

      const envScene = new THREE.Scene();
      envScene.background = new THREE.Color(0x05070b);

      // Studio Softbox Lights (Upper Left Key Light, Soft Fill, Cool Rim)
      const keyLight = new THREE.Mesh(
        new THREE.PlaneGeometry(10, 10),
        new THREE.MeshBasicMaterial({ color: 0xffffff, side: THREE.DoubleSide })
      );
      keyLight.position.set(-6, 8, 5);
      keyLight.lookAt(0, 0, 0);
      envScene.add(keyLight);

      const rimLight = new THREE.Mesh(
        new THREE.PlaneGeometry(8, 8),
        new THREE.MeshBasicMaterial({ color: 0x00ffff, side: THREE.DoubleSide })
      );
      rimLight.position.set(6, 4, -5);
      rimLight.lookAt(0, 0, 0);
      envScene.add(rimLight);

      const magentaLight = new THREE.Mesh(
        new THREE.PlaneGeometry(8, 8),
        new THREE.MeshBasicMaterial({ color: 0xff00ff, side: THREE.DoubleSide })
      );
      magentaLight.position.set(0, -6, 4);
      magentaLight.lookAt(0, 0, 0);
      envScene.add(magentaLight);

      const cubeCamera = new THREE.CubeCamera(0.1, 100, cubeRenderTarget);
      cubeCamera.update(renderer, envScene);

      return cubeRenderTarget.texture;
    };

    const envMapTexture = createStudioEnvMap();

    // 4. Custom GLSL Shader Material for Liquid Chrome Iridescence
    const vertexShader = `
      uniform float uTime;
      uniform float uDistortion;
      varying vec3 vNormal;
      varying vec3 vPosition;
      varying vec3 vWorldPosition;
      varying vec2 vUv;

      // 3D Simplex Noise generator
      vec4 permute(vec4 x){return mod(((x*34.0)+1.0)*x, 289.0);}
      vec4 taylorInvSqrt(vec4 r){return 1.79284291400159 - 0.85373472095314 * r;}
      
      float snoise(vec3 v){
        const vec2 C = vec2(1.0/6.0, 1.0/3.0);
        const vec4 D = vec4(0.0, 0.5, 1.0, 2.0);
        vec3 i  = floor(v + dot(v, C.yyy) );
        vec3 x0 = v - i + dot(i, C.xxx) ;
        vec3 g = step(x0.yzx, x0.xyz);
        vec3 l = 1.0 - g;
        vec3 i1 = min( g.xyz, l.zxy );
        vec3 i2 = max( g.xyz, l.zxy );
        vec3 x1 = x0 - i1 + C.xxx;
        vec3 x2 = x0 - i2 + C.yyy;
        vec3 x3 = x0 - D.yyy;
        i = mod(i, 289.0 );
        vec4 p = permute( permute( permute(
                   i.z + vec4(0.0, i1.z, i2.z, 1.0 ))
                 + i.y + vec4(0.0, i1.y, i2.y, 1.0 ))
                 + i.x + vec4(0.0, i1.x, i2.x, 1.0 ));
        float n_ = 0.142857142857;
        vec3  ns = n_ * D.wyz - D.xzx;
        vec4 j = p - 49.0 * floor(p * ns.z);
        vec4 x_ = floor(j * ns.z);
        vec4 y_ = floor(j - 7.0 * x_ );
        vec4 x = x_ *ns.x + ns.yyyy;
        vec4 y = y_ *ns.x + ns.yyyy;
        vec4 h = 1.0 - abs(x) - abs(y);
        vec4 b0 = vec4( x.xy, y.xy );
        vec4 b1 = vec4( x.zw, y.zw );
        vec4 s0 = floor(b0)*2.0 + 1.0;
        vec4 s1 = floor(b1)*2.0 + 1.0;
        vec4 sh = -step(h, vec4(0.0));
        vec4 a0 = b0.xzyw + s0.xzyw*sh.xxyy ;
        vec4 a1 = b1.xzyw + s1.xzyw*sh.zzww ;
        vec3 p0 = vec3(a0.xy,h.x);
        vec3 p1 = vec3(a0.zw,h.y);
        vec3 p2 = vec3(a1.xy,h.z);
        vec3 p3 = vec3(a1.zw,h.w);
        vec4 norm = taylorInvSqrt(vec4(dot(p0,p0), dot(p1,p1), dot(p2, p2), dot(p3,p3)));
        p0 *= norm.x;
        p1 *= norm.y;
        p2 *= norm.z;
        p3 *= norm.w;
        vec4 m = max(0.6 - vec4(dot(x0,x0), dot(x1,x1), dot(x2,x2), dot(x3,x3)), 0.0);
        m = m * m;
        return 42.0 * dot( m*m, vec4( dot(p0,x0), dot(p1,x1), dot(p2,x2), dot(p3,x3) ) );
      }

      void main() {
        vUv = uv;
        vNormal = normalize(normalMatrix * normal);
        
        // Multi-layered subtle organic liquid deformation
        float noise1 = snoise(position * 1.8 + vec3(uTime * 0.25));
        float noise2 = snoise(position * 3.5 - vec3(uTime * 0.35));
        float displacement = (noise1 * 0.14 + noise2 * 0.06) * uDistortion;
        
        vec3 newPosition = position + normal * displacement;
        vPosition = newPosition;
        
        vec4 worldPosition = modelMatrix * vec4(newPosition, 1.0);
        vWorldPosition = worldPosition.xyz;
        
        gl_Position = projectionMatrix * viewMatrix * worldPosition;
      }
    `;

    const fragmentShader = `
      uniform float uTime;
      uniform samplerCube uEnvMap;
      uniform float uIsListening;
      
      varying vec3 vNormal;
      varying vec3 vPosition;
      varying vec3 vWorldPosition;
      varying vec2 vUv;

      // Holographic iridescent thin-film color spectrum
      vec3 iridescentSpectrum(float t) {
        vec3 a = vec3(0.5, 0.5, 0.5);
        vec3 b = vec3(0.5, 0.5, 0.5);
        vec3 c = vec3(1.0, 1.0, 1.0);
        vec3 d = vec3(0.0, 0.33, 0.67);
        return a + b * cos(6.28318 * (c * t + d));
      }

      void main() {
        vec3 normal = normalize(vNormal);
        vec3 viewDir = normalize(cameraPosition - vWorldPosition);
        
        // Reflection vector for studio environment map
        vec3 refVec = reflect(-viewDir, normal);
        vec3 envColor = textureCube(uEnvMap, refVec).rgb;
        
        // Fresnel Rim & Thin-Film Highlights
        float fresnel = pow(1.0 - max(dot(viewDir, normal), 0.0), 3.2);
        
        // Iridescent oil-slick color banding
        float nDotV = dot(normal, viewDir);
        float iridT = nDotV * 2.8 + vPosition.x * 1.4 + vPosition.y * 1.6 + uTime * 0.18;
        vec3 iridColor = iridescentSpectrum(iridT);
        
        // Polished Liquid Chrome Base + Studio Reflection
        vec3 chromeBase = mix(vec3(0.02, 0.03, 0.06), envColor * 1.8, 0.7);
        
        // Combine Chrome with Iridescent Coating & Contrast Gap
        vec3 finalColor = chromeBase + iridColor * (0.45 + fresnel * 0.55);
        
        // High Specular Softbox Glare Highlight
        vec3 lightDir = normalize(vec3(-1.2, 1.6, 1.2));
        vec3 halfDir = normalize(lightDir + viewDir);
        float spec = pow(max(dot(normal, halfDir), 0.0), 64.0);
        finalColor += vec3(1.0) * spec * 0.95;
        
        // Dynamic Rim Glow (Cyan when ready, Red when listening)
        vec3 rimColor = mix(vec3(0.0, 1.0, 1.0), vec3(1.0, 0.25, 0.25), uIsListening);
        finalColor += rimColor * fresnel * 0.85;
        
        gl_FragColor = vec4(finalColor, 1.0);
      }
    `;

    const shaderMaterial = new THREE.ShaderMaterial({
      vertexShader,
      fragmentShader,
      uniforms: {
        uTime: { value: 0 },
        uDistortion: { value: 1.0 },
        uEnvMap: { value: envMapTexture },
        uIsListening: { value: isListening ? 1.0 : 0.0 }
      },
      transparent: true
    });
    materialRef.current = shaderMaterial;

    // 5. High-Resolution Subdivided Sphere Geometry (Icosahedron)
    const geometry = new THREE.IcosahedronGeometry(1.35, 64);
    const sphereMesh = new THREE.Mesh(geometry, shaderMaterial);
    scene.add(sphereMesh);
    meshRef.current = sphereMesh;

    // 6. Studio Lighting Setup
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
    scene.add(ambientLight);

    const keyLight = new THREE.DirectionalLight(0xffffff, 2.5);
    keyLight.position.set(-5, 5, 5);
    scene.add(keyLight);

    const fillLight = new THREE.DirectionalLight(0x00ffff, 1.2);
    fillLight.position.set(5, -3, 3);
    scene.add(fillLight);

    // 7. Animation Loop (5-10 second cycle fluid motion)
    let animationFrameId;
    const clock = new THREE.Clock();

    const animate = () => {
      animationFrameId = requestAnimationFrame(animate);
      const elapsedTime = clock.getElapsedTime();

      if (materialRef.current) {
        materialRef.current.uniforms.uTime.value = elapsedTime;
        materialRef.current.uniforms.uIsListening.value = isListening ? 1.0 : 0.0;
        materialRef.current.uniforms.uDistortion.value = isListening ? 1.8 : 1.0;
      }

      if (meshRef.current) {
        // Slow 3D Rotation along Y and X axes
        meshRef.current.rotation.y = elapsedTime * 0.2;
        meshRef.current.rotation.x = Math.sin(elapsedTime * 0.15) * 0.15;
      }

      renderer.render(scene, camera);
    };

    animate();

    // 8. Responsive Resize Handler
    const handleResize = () => {
      if (!container) return;
      const w = container.clientWidth || 320;
      const h = container.clientHeight || 320;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    };

    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      cancelAnimationFrame(animationFrameId);
      if (container && renderer.domElement) {
        container.removeChild(renderer.domElement);
      }
      geometry.dispose();
      shaderMaterial.dispose();
      renderer.dispose();
    };
  }, []);

  // Update listening state uniform dynamically
  useEffect(() => {
    if (materialRef.current) {
      materialRef.current.uniforms.uIsListening.value = isListening ? 1.0 : 0.0;
    }
  }, [isListening]);

  return (
    <div 
      className="liquid-chrome-canvas-wrap"
      onClick={onClick}
      style={{
        width: '100%',
        height: '100%',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        cursor: 'pointer',
        position: 'relative'
      }}
    >
      <div 
        ref={mountRef} 
        style={{ width: '280px', height: '280px', position: 'relative', zIndex: 2 }}
      />
    </div>
  );
}
